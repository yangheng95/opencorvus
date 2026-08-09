import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import path from "path"
import { pathToFileURL, fileURLToPath } from "url"
import { createMessageConnection, StreamMessageReader, StreamMessageWriter } from "vscode-jsonrpc/node"
import type { Diagnostic as VSCodeDiagnostic } from "vscode-languageserver-types"
import { Log } from "../util/log"
import { LANGUAGE_EXTENSIONS } from "./language"
import z from "zod"
import type { LSPServer } from "./server"
import { NamedError } from "@opencorvus-ai/util/error"
import { withTimeout } from "../util/timeout"
import { Instance } from "../project/instance"
import { Filesystem } from "../util/filesystem"

const DIAGNOSTICS_DEBOUNCE_MS = 150
let initializeTimeoutMs = 45_000

export namespace LSPClient {
  const log = Log.create({ service: "lsp.client" })

  export type Info = NonNullable<Awaited<ReturnType<typeof create>>>

  export type Diagnostic = VSCodeDiagnostic

  export function setInitializeTimeoutForTest(timeoutMs: number) {
    const previous = initializeTimeoutMs
    initializeTimeoutMs = timeoutMs
    return () => {
      initializeTimeoutMs = previous
    }
  }

  export const InitializeError = NamedError.create(
    "LSPInitializeError",
    z.object({
      serverID: z.string(),
    }),
  )

  export const Event = {
    Diagnostics: BusEvent.define(
      "lsp.client.diagnostics",
      z.object({
        serverID: z.string(),
        path: z.string(),
      }),
    ),
  }

  async function disposeServer(input: LSPServer.Handle) {
    if (input.dispose) {
      await input.dispose()
      return
    }
    const owned = input.process as typeof input.process & { opencorvusDispose?: () => Promise<void> }
    if (owned.opencorvusDispose) {
      await owned.opencorvusDispose()
      return
    }
    input.process.kill()
  }

  function processExited(input: LSPServer.Handle) {
    return input.process.exitCode !== null || input.process.signalCode !== null
  }

  async function rejectOnServerExit<T>(input: LSPServer.Handle, promise: Promise<T>): Promise<T> {
    if (processExited(input)) throw new Error("LSP server exited before initialize completed")
    return await new Promise<T>((resolve, reject) => {
      const onExit = (exitCode: number | null, signal: NodeJS.Signals | null) => {
        cleanup()
        reject(new Error(`LSP server exited before initialize completed: ${exitCode ?? signal ?? "unknown"}`))
      }
      const onError = (error: Error) => {
        cleanup()
        reject(error)
      }
      const cleanup = () => {
        input.process.off("exit", onExit)
        input.process.off("error", onError)
      }
      input.process.once("exit", onExit)
      input.process.once("error", onError)
      promise.then(
        (value) => {
          cleanup()
          resolve(value)
        },
        (error) => {
          cleanup()
          reject(error)
        },
      )
    })
  }

  function observeConnectionRequest<T>(input: {
    method: string
    promise: Promise<T>
    log: ReturnType<typeof log.clone>
  }): Promise<T> {
    input.promise.catch((error) => {
      input.log.warn("LSP request rejected", {
        method: input.method,
        error: String(error),
      })
    })
    return input.promise
  }

  export async function create(input: {
    serverID: string
    server: LSPServer.Handle
    root: string
    onExit?: (reason: Error) => void
    onDiagnostics?: (properties: z.output<(typeof Event.Diagnostics)["properties"]>) => void | Promise<void>
  }) {
    const l = log.clone().tag("serverID", input.serverID)
    l.info("starting client")

    let connection: ReturnType<typeof createMessageConnection>
    try {
      connection = createMessageConnection(
        new StreamMessageReader(input.server.process.stdout as any),
        new StreamMessageWriter(input.server.process.stdin as any),
      )
    } catch (error) {
      await disposeServer(input.server)
      throw new InitializeError({ serverID: input.serverID }, { cause: error })
    }

    const diagnostics = new Map<string, Diagnostic[]>()
    connection.onNotification("textDocument/publishDiagnostics", (params) => {
      const filePath = Filesystem.normalizePath(fileURLToPath(params.uri))
      l.info("textDocument/publishDiagnostics", {
        path: filePath,
        count: params.diagnostics.length,
      })
      const exists = diagnostics.has(filePath)
      diagnostics.set(filePath, params.diagnostics)
      if (!exists && input.serverID === "typescript") return
      void input.onDiagnostics?.({ path: filePath, serverID: input.serverID })
    })
    connection.onRequest("window/workDoneProgress/create", (params) => {
      l.info("window/workDoneProgress/create", params)
      return null
    })
    connection.onRequest("workspace/configuration", async () => {
      // Return server initialization options
      return [input.server.initialization ?? {}]
    })
    connection.onRequest("client/registerCapability", async () => {})
    connection.onRequest("client/unregisterCapability", async () => {})
    connection.onRequest("workspace/workspaceFolders", async () => [
      {
        name: "workspace",
        uri: pathToFileURL(input.root).href,
      },
    ])
    connection.listen()

    l.info("sending initialize")
    try {
      const initializeRequest = observeConnectionRequest({
        method: "initialize",
        log: l,
        promise: connection.sendRequest("initialize", {
          rootUri: pathToFileURL(input.root).href,
          processId: input.server.process.pid,
          workspaceFolders: [
            {
              name: "workspace",
              uri: pathToFileURL(input.root).href,
            },
          ],
          initializationOptions: {
            ...input.server.initialization,
          },
          capabilities: {
            window: {
              workDoneProgress: true,
            },
            workspace: {
              configuration: true,
              didChangeWatchedFiles: {
                dynamicRegistration: true,
              },
            },
            textDocument: {
              synchronization: {
                didOpen: true,
                didChange: true,
              },
              publishDiagnostics: {
                versionSupport: true,
              },
            },
          },
        }),
      })
      await withTimeout(rejectOnServerExit(input.server, initializeRequest), initializeTimeoutMs)
    } catch (err) {
      connection.end()
      connection.dispose()
      let cause: unknown = err
      try {
        await disposeServer(input.server)
      } catch (disposeError) {
        l.error("server dispose failed after initialize error", { error: String(disposeError) })
        cause = new AggregateError([err, disposeError], `LSP ${input.serverID} initialize and disposal both failed`)
      }
      l.error("initialize error", { error: err })
      throw new InitializeError(
        { serverID: input.serverID },
        {
          cause,
        },
      )
    }

    let shutdownOperation: Promise<void> | undefined
    let connectionReleased = false
    let pendingUnexpectedExit: Error | undefined
    let unexpectedExitNotified = false
    const commitUnexpectedExit = () => {
      if (!pendingUnexpectedExit || unexpectedExitNotified) return
      unexpectedExitNotified = true
      try {
        input.onExit?.(pendingUnexpectedExit)
      } catch (error) {
        l.warn("LSP exit callback failed", { error: String(error) })
      }
    }
    const closeLifecycle = (graceful: boolean) => {
      if (shutdownOperation) return shutdownOperation
      const operation = (async () => {
        input.server.process.off("exit", onServerExit)
        input.server.process.off("error", onServerError)
        if (graceful && !connectionReleased && !processExited(input.server)) {
          const shutdownRequest = observeConnectionRequest({
            method: "shutdown",
            log: l,
            promise: connection.sendRequest("shutdown"),
          })
          await withTimeout(shutdownRequest, 1_000).catch(() => {})
          await connection.sendNotification("exit").catch(() => {})
        }
        if (!connectionReleased) {
          try {
            connection.end()
          } catch {}
          try {
            connection.dispose()
          } catch {}
          connectionReleased = true
        }
        await disposeServer(input.server)
        commitUnexpectedExit()
      })()
      shutdownOperation = operation
      void operation.catch(() => {
        if (shutdownOperation === operation) shutdownOperation = undefined
      })
      return operation
    }
    const notifyExitAfterCleanup = (reason: Error, failureMessage: string) => {
      pendingUnexpectedExit ??= reason
      void closeLifecycle(false).catch((error) => {
        l.warn(failureMessage, { error: String(error) })
      })
    }
    const onServerExit = (exitCode: number | null, signal: NodeJS.Signals | null) => {
      const reason = new Error(`LSP server exited after initialize: ${exitCode ?? signal ?? "unknown"}`)
      notifyExitAfterCleanup(reason, "LSP lifecycle disposal failed after process exit")
    }
    const onServerError = (error: Error) => {
      l.warn("LSP server process error", { error: error.message })
      notifyExitAfterCleanup(error, "LSP lifecycle disposal failed after process error")
    }
    input.server.process.on("exit", onServerExit)
    input.server.process.on("error", onServerError)

    try {
      if (processExited(input.server)) {
        throw new Error("LSP server exited immediately after initialize")
      }
      await connection.sendNotification("initialized", {})
      if (input.server.initialization) {
        await connection.sendNotification("workspace/didChangeConfiguration", {
          settings: input.server.initialization,
        })
      }
    } catch (error) {
      await closeLifecycle(false).catch((disposeError) => {
        l.warn("LSP lifecycle disposal failed after post-initialize error", { error: String(disposeError) })
      })
      throw new InitializeError({ serverID: input.serverID }, { cause: error })
    }

    const files: {
      [path: string]: number
    } = {}

    const result = {
      root: input.root,
      lastUsedAt: Date.now(),
      touch() {
        this.lastUsedAt = Date.now()
      },
      get serverID() {
        return input.serverID
      },
      get connection() {
        return connection
      },
      notify: {
        async open(input: { path: string }) {
          result.touch()
          input.path = path.isAbsolute(input.path) ? input.path : path.resolve(Instance.directory, input.path)
          const text = await Filesystem.readText(input.path)
          const extension = path.extname(input.path)
          const languageId = LANGUAGE_EXTENSIONS[extension] ?? "plaintext"

          const version = files[input.path]
          if (version !== undefined) {
            log.info("workspace/didChangeWatchedFiles", input)
            await connection.sendNotification("workspace/didChangeWatchedFiles", {
              changes: [
                {
                  uri: pathToFileURL(input.path).href,
                  type: 2, // Changed
                },
              ],
            })

            const next = version + 1
            files[input.path] = next
            log.info("textDocument/didChange", {
              path: input.path,
              version: next,
            })
            await connection.sendNotification("textDocument/didChange", {
              textDocument: {
                uri: pathToFileURL(input.path).href,
                version: next,
              },
              contentChanges: [{ text }],
            })
            return
          }

          log.info("workspace/didChangeWatchedFiles", input)
          await connection.sendNotification("workspace/didChangeWatchedFiles", {
            changes: [
              {
                uri: pathToFileURL(input.path).href,
                type: 1, // Created
              },
            ],
          })

          log.info("textDocument/didOpen", input)
          diagnostics.delete(input.path)
          await connection.sendNotification("textDocument/didOpen", {
            textDocument: {
              uri: pathToFileURL(input.path).href,
              languageId,
              version: 0,
              text,
            },
          })
          files[input.path] = 0
          return
        },
      },
      get diagnostics() {
        return diagnostics
      },
      async waitForDiagnostics(input: { path: string }) {
        const normalizedPath = Filesystem.normalizePath(
          path.isAbsolute(input.path) ? input.path : path.resolve(Instance.directory, input.path),
        )
        log.info("waiting for diagnostics", { path: normalizedPath })
        let unsub: () => void
        let debounceTimer: ReturnType<typeof setTimeout> | undefined
        return await withTimeout(
          new Promise<void>((resolve) => {
            unsub = Bus.subscribe(Event.Diagnostics, (event) => {
              if (event.properties.path === normalizedPath && event.properties.serverID === result.serverID) {
                // Debounce to allow LSP to send follow-up diagnostics (e.g., semantic after syntax)
                if (debounceTimer) clearTimeout(debounceTimer)
                debounceTimer = setTimeout(() => {
                  log.info("got diagnostics", { path: normalizedPath })
                  unsub?.()
                  resolve()
                }, DIAGNOSTICS_DEBOUNCE_MS)
              }
            })
          }),
          3000,
        )
          .catch(() => {})
          .finally(() => {
            if (debounceTimer) clearTimeout(debounceTimer)
            unsub?.()
          })
      },
      async shutdown() {
        l.info("shutting down")
        await closeLifecycle(true)
        l.info("shutdown")
      },
    }

    l.info("initialized")

    return result
  }
}
