import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import { Log } from "../util/log"
import { LSPClient } from "./client"
import path from "path"
import { pathToFileURL, fileURLToPath } from "url"
import { LSPServer } from "./server"
import z from "zod"
import { Config } from "../config/config"
import { Instance } from "../project/instance"
import { createInstanceState } from "../project/instance-state"
import { Flag } from "@/flag/flag"
import { entries, values as objectValues } from "@/util/object"
import type { DocumentSymbol, Symbol } from "./schema"
import { SessionContext } from "@/session/context"
import { taskIDForSession } from "@/engine/task-session-lineage"
import {
  readTaskProcessBinding,
  TASK_EXECUTION_CAPSULE_BINDING_PROTOCOL,
} from "@/engine/task-execution-capsule-binding"
import { Process } from "@/util/process"

export namespace LSP {
  const log = Log.create({ service: "lsp" })
  let clientIdleTtlMs = Number.parseInt(process.env.OPENCORVUS_LSP_CLIENT_IDLE_TTL_MS ?? "600000", 10)
  let brokenTtlMs = Number.parseInt(process.env.OPENCORVUS_LSP_BROKEN_TTL_MS ?? "600000", 10)

  export const Event = {
    Updated: BusEvent.define("lsp.updated", z.object({})),
  }

  export function setRetentionForTest(input: { clientIdleTtlMs?: number; brokenTtlMs?: number }) {
    const previous = { clientIdleTtlMs, brokenTtlMs }
    if (input.clientIdleTtlMs !== undefined) clientIdleTtlMs = input.clientIdleTtlMs
    if (input.brokenTtlMs !== undefined) brokenTtlMs = input.brokenTtlMs
    return () => {
      clientIdleTtlMs = previous.clientIdleTtlMs
      brokenTtlMs = previous.brokenTtlMs
    }
  }

  const filterExperimentalServers = (servers: Record<string, LSPServer.Info>) => {
    if (Flag.OPENCORVUS_EXPERIMENTAL_LSP_TY) {
      // If experimental flag is enabled, disable pyright
      if (servers["pyright"]) {
        log.info("LSP server pyright is disabled because OPENCORVUS_EXPERIMENTAL_LSP_TY is enabled")
        delete servers["pyright"]
      }
    } else {
      // If experimental flag is disabled, disable ty
      if (servers["ty"]) {
        delete servers["ty"]
      }
    }
  }

  type State = {
    broken: Map<string, number>
    servers: Record<string, LSPServer.Info>
    clients: LSPClient.Info[]
    spawning: Map<string, Promise<LSPClient.Info | undefined>>
    disposed: boolean
  }
  type ProcessAuthority = { kind: "host" } | { kind: "task"; taskID: string }
  const clientProcessAuthorities = new WeakMap<LSPClient.Info, string>()

  function processAuthorityKey(authority: ProcessAuthority) {
    return authority.kind === "host" ? "host" : `task:${authority.taskID}`
  }

  function taskProcessAuthority(): ProcessAuthority {
    const session = SessionContext.use()
    const taskID = taskIDForSession(session.id)
    if (!taskID) throw new Error(`Language Server Protocol Session ${session.id} requires explicit Task authority`)
    return { kind: "task", taskID }
  }

  const createState = (servers: Record<string, LSPServer.Info>, clients: LSPClient.Info[] = []): State => ({
    broken: new Map<string, number>(),
    servers,
    clients,
    spawning: new Map<string, Promise<LSPClient.Info | undefined>>(),
    disposed: false,
  })

  async function disposeClient(client: LSPClient.Info) {
    await client.shutdown()
  }

  async function disposeClients(clients: readonly LSPClient.Info[]) {
    const results = await Promise.allSettled(clients.map(disposeClient))
    const disposed = new Set<LSPClient.Info>()
    const failures: unknown[] = []
    results.forEach((result, index) => {
      const client = clients[index]!
      if (result.status === "fulfilled") {
        disposed.add(client)
        return
      }
      failures.push(result.reason)
      log.warn("LSP client shutdown failed during dispose", {
        serverID: client.serverID,
        root: client.root,
        error: String(result.reason),
      })
    })
    return { disposed, failures }
  }

  function throwDisposalFailures(failures: readonly unknown[], message: string) {
    if (failures.length === 0) return
    if (failures.length === 1) throw failures[0]
    throw new AggregateError(failures, message)
  }

  async function disposeHandle(handle: LSPServer.Handle) {
    if (handle.dispose) {
      await handle.dispose()
      return
    }
    const owned = handle.process as typeof handle.process & { opencorvusDispose?: () => Promise<void> }
    if (owned.opencorvusDispose) {
      await owned.opencorvusDispose()
      return
    }
    handle.process.kill()
  }

  function markBroken(state: State, key: string) {
    state.broken.set(key, Date.now())
  }

  function pruneBroken(state: State, now: number) {
    if (!Number.isFinite(brokenTtlMs) || brokenTtlMs <= 0) return
    for (const [key, failedAt] of state.broken) {
      if (now - failedAt > brokenTtlMs) state.broken.delete(key)
    }
  }

  async function pruneIdleClients(state: State, now: number) {
    if (!Number.isFinite(clientIdleTtlMs) || clientIdleTtlMs <= 0) return
    const stale: LSPClient.Info[] = []
    for (const client of state.clients) {
      if (now - client.lastUsedAt > clientIdleTtlMs) stale.push(client)
    }
    if (stale.length === 0) return
    const result = await disposeClients(stale)
    // Shutdown yields to the event loop. Reconcile against the current client
    // collection so a concurrently spawned client is never overwritten by the
    // pre-shutdown snapshot.
    state.clients = state.clients.filter((client) => !result.disposed.has(client))
    throwDisposalFailures(result.failures, `${result.failures.length} idle LSP clients failed to dispose`)
  }

  const state = createInstanceState(
    async () => {
      const clients: LSPClient.Info[] = []
      const servers: Record<string, LSPServer.Info> = {}
      const cfg = await Config.get()

      if (cfg.lsp === false) {
        log.info("all LSPs are disabled")
        return createState(servers, clients)
      }

      for (const server of LSPServer.builtInServers()) {
        servers[server.id] = server
      }

      filterExperimentalServers(servers)

      for (const [name, item] of entries((cfg.lsp ?? {}) as Exclude<NonNullable<Config.Info["lsp"]>, false>)) {
        const existing = servers[name]
        if (item.disabled) {
          log.info(`LSP server ${name} is disabled`)
          delete servers[name]
          continue
        }
        servers[name] = {
          ...existing,
          id: name,
          root: existing?.root ?? (async () => Instance.directory),
          extensions: item.extensions ?? existing?.extensions ?? [],
          spawn: async (root, stdio) => {
            return {
              process: await stdio(item.command[0], item.command.slice(1), {
                cwd: root,
                env: {
                  ...process.env,
                  ...item.env,
                },
              }),
              initialization: item.initialization,
            }
          },
        }
      }

      log.info("enabled LSP servers", {
        serverIds: objectValues(servers)
          .map((server) => server.id)
          .join(", "),
      })

      return createState(servers, clients)
    },
    async (state) => {
      state.disposed = true
      const clients = new Set<LSPClient.Info>(state.clients)
      const inflight = [...state.spawning.values()]
      const settled = await Promise.allSettled(inflight)
      for (const item of settled) {
        if (item.status === "fulfilled" && item.value) clients.add(item.value)
      }
      const result = await disposeClients([...clients])
      state.clients = state.clients.filter((client) => !result.disposed.has(client))
      state.spawning.clear()
      throwDisposalFailures(result.failures, `${result.failures.length} LSP clients failed to dispose`)
    },
    "lsp",
  )

  export async function init() {
    return state()
  }

  export const Status = z
    .object({
      id: z.string(),
      name: z.string(),
      root: z.string(),
      status: z.union([z.literal("connected"), z.literal("error")]),
    })
    .meta({
      ref: "LSPStatus",
    })
  export type Status = z.infer<typeof Status>

  export async function status() {
    return state().then((x) => {
      const result: Status[] = []
      for (const client of x.clients) {
        result.push({
          id: client.serverID,
          name: x.servers[client.serverID].id,
          root: path.relative(Instance.directory, client.root),
          status: "connected",
        })
      }
      return result
    })
  }

  async function getClients(file: string, authority: ProcessAuthority) {
    const binding = authority.kind === "task" ? readTaskProcessBinding(authority.taskID) : undefined
    let capsuleServerIDs: ReadonlySet<string> | undefined
    if (binding?.protocol === TASK_EXECUTION_CAPSULE_BINDING_PROTOCOL) {
      const { activeExecutionCapsuleRuntimeFact } = await import("@/execution-capsule/runtime")
      const runtime = await activeExecutionCapsuleRuntimeFact()
      if (!runtime) throw new Error("Language Server Protocol Capsule runtime is unavailable")
      if (runtime.lspServerIDs.length === 0) return []
      capsuleServerIDs = new Set(runtime.lspServerIDs)
    }
    const s = await state()
    if (s.disposed) return []
    const now = Date.now()
    pruneBroken(s, now)
    await pruneIdleClients(s, now)
    const extension = path.parse(file).ext || file
    const result: LSPClient.Info[] = []
    const authorityKey = processAuthorityKey(authority)
    const stdio: LSPServer.StdioSpawner = authority.kind === "host"
      ? async (command, argsOrOptions, maybeOptions) => LSPServer.spawnHostStdio(command, argsOrOptions, maybeOptions)
      : async (command, argsOrOptions, maybeOptions) =>
          LSPServer.spawnTaskStdio(authority.taskID, command, argsOrOptions, maybeOptions)
    const probe: LSPServer.ProcessProbe = authority.kind === "host"
      ? (root, argv) => Process.runHost(argv, {
          cwd: root,
          stdin: "ignore",
          nothrow: true,
          inactivityTimeoutMs: 30_000,
          inactivityTimeoutMessage: `LSP capability probe ${argv.join(" ")} was inactive`,
        })
      : (root, argv) => Process.runTask({ taskID: authority.taskID, cwd: root }, argv, {
          stdin: "ignore",
          nothrow: true,
          inactivityTimeoutMs: 30_000,
          inactivityTimeoutMessage: `LSP capability probe ${argv.join(" ")} was inactive`,
        })

    async function schedule(server: LSPServer.Info, root: string, key: string) {
      if (s.disposed) return undefined
      const handle = await server
        .spawn(root, stdio, probe)
        .then((value) => {
          if (!value) markBroken(s, key)
          return value
        })
        .catch((err) => {
          markBroken(s, key)
          log.error(`Failed to spawn LSP server ${server.id}`, { error: err })
          return undefined
        })

      if (!handle) return undefined
      if (s.disposed) {
        await disposeHandle(handle)
        return undefined
      }
      log.info("spawned lsp server", { serverID: server.id })

      let client: LSPClient.Info | undefined
      let exitBeforeRegistration: Error | undefined
      const created = await LSPClient.create({
        serverID: server.id,
        server: handle,
        root,
        onExit(reason) {
          if (!client) {
            exitBeforeRegistration = reason
            return
          }
          const retained = s.clients.filter((candidate) => candidate !== client)
          if (retained.length === s.clients.length) return
          s.clients = retained
          log.warn(`LSP server ${server.id} exited; evicted client`, { root, error: reason.message })
          Bus.publish(Event.Updated, {})
        },
      }).catch(async (err) => {
        markBroken(s, key)
        log.error(`Failed to initialize LSP client ${server.id}`, { error: err })
        return undefined
      })

      if (!created) return undefined
      client = created
      clientProcessAuthorities.set(client, authorityKey)
      if (exitBeforeRegistration) {
        await disposeClient(client).catch(() => undefined)
        return undefined
      }
      if (s.disposed) {
        await disposeClient(client)
        return undefined
      }

      const existing = s.clients.find(
        (x) => x.root === root && x.serverID === server.id && clientProcessAuthorities.get(x) === authorityKey,
      )
      if (existing) {
        await disposeClient(client)
        return existing
      }

      s.clients.push(client)
      return client
    }

    for (const server of objectValues(s.servers)) {
      if (s.disposed) break
      if (capsuleServerIDs && !capsuleServerIDs.has(server.id)) continue
      if (server.extensions.length && !server.extensions.includes(extension)) continue

      const root = await server.root(file)
      if (!root) continue
      const spawnKey = `${authorityKey}\u0000${root}\u0000${server.id}`
      if (s.broken.has(spawnKey)) continue

      const match = s.clients.find(
        (x) => x.root === root && x.serverID === server.id && clientProcessAuthorities.get(x) === authorityKey,
      )
      if (match) {
        match.touch()
        result.push(match)
        continue
      }

      const inflight = s.spawning.get(spawnKey)
      if (inflight) {
        const client = await inflight
        if (!client) continue
        result.push(client)
        continue
      }

      const task = schedule(server, root, spawnKey)
      s.spawning.set(spawnKey, task)

      void task
        .finally(() => {
          if (s.spawning.get(spawnKey) === task) {
            s.spawning.delete(spawnKey)
          }
        })
        .catch((error) => {
          log.warn("lsp spawn cleanup failed", {
            serverID: server.id,
            error: error instanceof Error ? error.message : String(error),
          })
        })

      const client = await task
      if (!client) continue
      if (s.disposed) continue

      result.push(client)
      Bus.publish(Event.Updated, {})
    }

    return result
  }

  export async function hasClients(file: string) {
    const s = await state()
    pruneBroken(s, Date.now())
    const authorityKey = processAuthorityKey(taskProcessAuthority())
    const extension = path.parse(file).ext || file
    for (const server of objectValues(s.servers)) {
      if (server.extensions.length && !server.extensions.includes(extension)) continue
      const root = await server.root(file)
      if (!root) continue
      if (s.broken.has(`${authorityKey}\u0000${root}\u0000${server.id}`)) continue
      return true
    }
    return false
  }

  export const TestHooks = {
    pruneIdleClients,
    async replaceServers(servers: Record<string, LSPServer.Info>) {
      const current = await state()
      const previous = current.servers
      current.servers = servers
      return () => {
        current.servers = previous
      }
    },
    async lifecycle() {
      const current = await state()
      return {
        spawning: current.spawning.size,
        broken: current.broken.size,
        clients: current.clients.length,
      }
    },
  }

  async function touchFileWithAuthority(
    authority: ProcessAuthority,
    input: string,
    waitForDiagnostics?: boolean,
  ) {
    log.info("touching file", { file: input })
    const clients = await getClients(input, authority)
    await Promise.all(
      clients.map(async (client) => {
        const wait = waitForDiagnostics ? client.waitForDiagnostics({ path: input }) : Promise.resolve()
        await client.notify.open({ path: input })
        return wait
      }),
    ).catch((err) => {
      log.error("failed to touch file", { err, file: input })
    })
  }

  export async function touchFile(input: string, waitForDiagnostics?: boolean) {
    return touchFileWithAuthority(taskProcessAuthority(), input, waitForDiagnostics)
  }

  type WarmFileTouch = (input: string, waitForDiagnostics?: boolean) => Promise<void>
  let warmFileTouchForTest: WarmFileTouch | undefined

  export function setWarmFileTouchForTest(touch: WarmFileTouch) {
    const previous = warmFileTouchForTest
    warmFileTouchForTest = touch
    return () => {
      warmFileTouchForTest = previous
    }
  }

  /**
   * Starts optional Language Server Protocol (LSP) preparation for a file that
   * has already been read. Warm-up is not part of the read contract: a slow or
   * broken language server records its own failure without holding the file
   * result or its tool lifecycle open.
   */
  export function warmFile(input: string) {
    const operation = (warmFileTouchForTest ?? touchFile)(input, false)
    void operation.catch((error) => {
      log.error("LSP file warm-up failed", { file: input, error: String(error) })
    })
  }

  async function diagnosticsWithAuthority(authority: ProcessAuthority) {
    const results: Record<string, LSPClient.Diagnostic[]> = {}
    for (const result of await runAllWithAuthority(authority, async (client) => client.diagnostics)) {
      for (const [path, diagnostics] of result.entries()) {
        const arr = results[path] || []
        arr.push(...diagnostics)
        results[path] = arr
      }
    }
    return results
  }

  export async function diagnostics() {
    return diagnosticsWithAuthority(taskProcessAuthority())
  }

  export async function hover(input: { file: string; line: number; character: number }) {
    return run(input.file, (client) => {
      return client.connection
        .sendRequest("textDocument/hover", {
          textDocument: {
            uri: pathToFileURL(input.file).href,
          },
          position: {
            line: input.line,
            character: input.character,
          },
        })
        .catch(() => null)
    })
  }

  enum SymbolKind {
    File = 1,
    Module = 2,
    Namespace = 3,
    Package = 4,
    Class = 5,
    Method = 6,
    Property = 7,
    Field = 8,
    Constructor = 9,
    Enum = 10,
    Interface = 11,
    Function = 12,
    Variable = 13,
    Constant = 14,
    String = 15,
    Number = 16,
    Boolean = 17,
    Array = 18,
    Object = 19,
    Key = 20,
    Null = 21,
    EnumMember = 22,
    Struct = 23,
    Event = 24,
    Operator = 25,
    TypeParameter = 26,
  }

  const kinds = [
    SymbolKind.Class,
    SymbolKind.Function,
    SymbolKind.Method,
    SymbolKind.Interface,
    SymbolKind.Variable,
    SymbolKind.Constant,
    SymbolKind.Struct,
    SymbolKind.Enum,
  ]

  async function workspaceSymbolWithAuthority(authority: ProcessAuthority, query: string) {
    return runAllWithAuthority(authority, (client) =>
      client.connection
        .sendRequest("workspace/symbol", {
          query,
        })
        .then((result: any) => result.filter((x: Symbol) => kinds.includes(x.kind)))
        .then((result: any) => result.slice(0, 10))
        .catch(() => []),
    ).then((result) => result.flat() as Symbol[])
  }

  export async function workspaceSymbol(query: string) {
    return workspaceSymbolWithAuthority(taskProcessAuthority(), query)
  }

  async function documentSymbolWithAuthority(authority: ProcessAuthority, uri: string) {
    const file = fileURLToPath(uri)
    return runWithAuthority(authority, file, (client) =>
      client.connection.sendRequest("textDocument/documentSymbol", {
        textDocument: {
          uri,
        },
      }),
    )
      .then((result) => result.flat() as (DocumentSymbol | Symbol)[])
      .then((result) => result.filter(Boolean))
  }

  export async function documentSymbol(uri: string) {
    return documentSymbolWithAuthority(taskProcessAuthority(), uri)
  }

  export async function definition(input: { file: string; line: number; character: number }) {
    return run(input.file, (client) =>
      client.connection
        .sendRequest("textDocument/definition", {
          textDocument: { uri: pathToFileURL(input.file).href },
          position: { line: input.line, character: input.character },
        })
        .catch(() => null),
    ).then((result) => result.flat().filter(Boolean))
  }

  export async function references(input: { file: string; line: number; character: number }) {
    return run(input.file, (client) =>
      client.connection
        .sendRequest("textDocument/references", {
          textDocument: { uri: pathToFileURL(input.file).href },
          position: { line: input.line, character: input.character },
          context: { includeDeclaration: true },
        })
        .catch(() => []),
    ).then((result) => result.flat().filter(Boolean))
  }

  export async function implementation(input: { file: string; line: number; character: number }) {
    return run(input.file, (client) =>
      client.connection
        .sendRequest("textDocument/implementation", {
          textDocument: { uri: pathToFileURL(input.file).href },
          position: { line: input.line, character: input.character },
        })
        .catch(() => null),
    ).then((result) => result.flat().filter(Boolean))
  }

  export async function prepareCallHierarchy(input: { file: string; line: number; character: number }) {
    return run(input.file, (client) =>
      client.connection
        .sendRequest("textDocument/prepareCallHierarchy", {
          textDocument: { uri: pathToFileURL(input.file).href },
          position: { line: input.line, character: input.character },
        })
        .catch(() => []),
    ).then((result) => result.flat().filter(Boolean))
  }

  export async function incomingCalls(input: { file: string; line: number; character: number }) {
    return run(input.file, async (client) => {
      const items = (await client.connection
        .sendRequest("textDocument/prepareCallHierarchy", {
          textDocument: { uri: pathToFileURL(input.file).href },
          position: { line: input.line, character: input.character },
        })
        .catch(() => [])) as any[]
      if (!items?.length) return []
      return client.connection.sendRequest("callHierarchy/incomingCalls", { item: items[0] }).catch(() => [])
    }).then((result) => result.flat().filter(Boolean))
  }

  export async function outgoingCalls(input: { file: string; line: number; character: number }) {
    return run(input.file, async (client) => {
      const items = (await client.connection
        .sendRequest("textDocument/prepareCallHierarchy", {
          textDocument: { uri: pathToFileURL(input.file).href },
          position: { line: input.line, character: input.character },
        })
        .catch(() => [])) as any[]
      if (!items?.length) return []
      return client.connection.sendRequest("callHierarchy/outgoingCalls", { item: items[0] }).catch(() => [])
    }).then((result) => result.flat().filter(Boolean))
  }

  async function runAllWithAuthority<T>(
    authority: ProcessAuthority,
    input: (client: LSPClient.Info) => Promise<T>,
  ): Promise<T[]> {
    const authorityKey = processAuthorityKey(authority)
    const clients = await state().then((x) =>
      x.clients.filter((client) => clientProcessAuthorities.get(client) === authorityKey),
    )
    const tasks = clients.map((x) => input(x))
    return Promise.all(tasks)
  }

  async function runAll<T>(input: (client: LSPClient.Info) => Promise<T>): Promise<T[]> {
    return runAllWithAuthority(taskProcessAuthority(), input)
  }

  async function runWithAuthority<T>(
    authority: ProcessAuthority,
    file: string,
    input: (client: LSPClient.Info) => Promise<T>,
  ): Promise<T[]> {
    const clients = await getClients(file, authority)
    const tasks = clients.map((x) => input(x))
    return Promise.all(tasks)
  }

  async function run<T>(file: string, input: (client: LSPClient.Info) => Promise<T>): Promise<T[]> {
    return runWithAuthority(taskProcessAuthority(), file, input)
  }

  export namespace Host {
    const authority = { kind: "host" } as const

    export async function touchFile(input: string, waitForDiagnostics?: boolean) {
      return touchFileWithAuthority(authority, input, waitForDiagnostics)
    }

    export async function diagnostics() {
      return diagnosticsWithAuthority(authority)
    }

    export async function workspaceSymbol(query: string) {
      return workspaceSymbolWithAuthority(authority, query)
    }

    export async function documentSymbol(uri: string) {
      return documentSymbolWithAuthority(authority, uri)
    }
  }

  export namespace Diagnostic {
    export function pretty(diagnostic: LSPClient.Diagnostic) {
      const severityMap = {
        1: "ERROR",
        2: "WARN",
        3: "INFO",
        4: "HINT",
      }

      const severity = severityMap[diagnostic.severity || 1]
      const line = diagnostic.range.start.line + 1
      const col = diagnostic.range.start.character + 1

      return `${severity} [${line}:${col}] ${diagnostic.message}`
    }
  }
}
