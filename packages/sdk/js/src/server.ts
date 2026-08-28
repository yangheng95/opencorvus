import { randomUUID } from "node:crypto"
import { ProcessAbortedError, ProcessDeadlineExceededError } from "@opencorvus-ai/util/process"
import { NodeProcess } from "@opencorvus-ai/util/process-node"
import { createStartupReceiptChannel } from "./startup-receipt.js"
import { type ConfigGetResponse } from "./gen/types.gen.js"
import { DEFAULT_SERVER_HOST, DEFAULT_SERVER_PORT } from "./defaults.js"
import { BoundedDiagnosticTail } from "./server-diagnostic-tail.js"

type Config = ConfigGetResponse

export type ServerOptions = {
  hostname?: string
  port?: number
  signal?: AbortSignal
  timeout?: number
  config?: Config
}

export type OpenCorvusServer = {
  url: string
  close(): Promise<void>
}

export function combineServerStartupFailures(primary: unknown, cleanupFailures: readonly unknown[]): unknown {
  const flattenedCleanup = cleanupFailures.flatMap((failure) =>
    failure instanceof AggregateError ? Array.from(failure.errors) : [failure],
  )
  const failures = Array.from(new Set([primary, ...flattenedCleanup]))
  return failures.length === 1 ? primary : new AggregateError(failures, "Server startup and cleanup failed")
}

function resolveCommand() {
  return process.env.OPENCORVUS_BIN_PATH || "opencorvus"
}

export async function createOpenCorvusServer(options?: ServerOptions): Promise<OpenCorvusServer> {
  options = Object.assign(
    {
      hostname: DEFAULT_SERVER_HOST,
      port: DEFAULT_SERVER_PORT,
      timeout: 5000,
    },
    options ?? {},
  )

  // Readiness is a framed receipt this launcher owns, never a line of the
  // server's human output.
  const startupOccurrenceID = randomUUID()
  const receipt = await createStartupReceiptChannel(startupOccurrenceID)
  const startupTimeoutMs = options.timeout ?? 5_000
  const startupDeadlineAt = Date.now() + startupTimeoutMs
  let openedServer: OpenCorvusServer | undefined
  let cleanupAdmittedProcess: (() => Promise<void>) | undefined
  try {
    const args = [
      `serve`,
      `--hostname=${options.hostname}`,
      `--port=${options.port}`,
      `--startup-receipt=${receipt.path}`,
      `--startup-occurrence=${startupOccurrenceID}`,
    ]
    if (options.config?.logLevel) args.push(`--log-level=${options.config.logLevel}`)
    const config = options.config === undefined ? process.env.OPENCORVUS_CONFIG_CONTENT : JSON.stringify(options.config)

    let proc: Awaited<ReturnType<typeof NodeProcess.spawn>>
    try {
      proc = await NodeProcess.spawn({
        command: { executable: resolveCommand(), args },
        ownership: "owned_tree",
        signal: options.signal,
        deadlineAt: startupDeadlineAt,
        env: {
          ...process.env,
          ...(config === undefined ? {} : { OPENCORVUS_CONFIG_CONTENT: config }),
        },
      })
    } catch (error) {
      if (error instanceof ProcessDeadlineExceededError)
        throw new Error(`Timeout waiting for server to start after ${startupTimeoutMs}ms`)
      if (error instanceof ProcessAbortedError) throw new Error("Aborted")
      throw error
    }
    // Give the host one turn to publish any immediate child error/exit before
    // readiness polling and the startup deadline begin competing for I/O.
    await new Promise<void>((resolve) => setImmediate(resolve))
    let stopTask: Promise<void> | undefined
    let outputObservationSettled: Promise<void> = Promise.resolve()
    const stopProcess = () => {
      if (!stopTask) {
        stopTask = Promise.allSettled([proc.dispose(), outputObservationSettled])
          .then((outcomes) => {
            const failures = Array.from(
              new Set(outcomes.flatMap((outcome) => (outcome.status === "rejected" ? [outcome.reason] : []))),
            )
            if (failures.length === 1) throw failures[0]
            if (failures.length > 1) throw new AggregateError(failures, "Server process and output cleanup failed")
          })
          // `close` proves the child and pipes settled; one host turn then
          // releases the adapter's libuv registrations before another server
          // occurrence can be admitted in this process.
          .then(() => new Promise<void>((resolve) => setImmediate(resolve)))
          .then(() => undefined)
      }
      return stopTask
    }
    cleanupAdmittedProcess = stopProcess

    const url = await new Promise<string>((resolve, reject) => {
      let state: "pending" | "stopping_failure" | "ready" | "failed" = "pending"
      const diagnostics = new BoundedDiagnosticTail()
      const receiptObservation = new AbortController()
      const cleanupStartup = () => {
        receiptObservation.abort()
      }
      const failStartupAfterCleanup = (error: Error) => {
        if (state !== "pending") return
        state = "stopping_failure"
        cleanupStartup()
        void stopProcess().then(
          () => {
            state = "failed"
            reject(error)
          },
          () => {
            state = "failed"
            // The outer startup owner joins this memoized cleanup exactly once
            // and constructs the ordered primary+cleanup failure contract.
            reject(error)
          },
        )
      }
      const finishStartup = (serverUrl: string) => {
        if (state !== "pending") return
        const release = proc.releaseControls()
        if (release !== "released") {
          failStartupAfterCleanup(
            new Error(
              release === "deadline_exceeded"
                ? `Timeout waiting for server to start after ${startupTimeoutMs}ms`
                : "Aborted",
            ),
          )
          return
        }
        state = "ready"
        cleanupStartup()
        diagnostics.clear()
        // The caller signal and timeout own startup admission only. Once the
        // framed readiness receipt is accepted, normal server lifetime is
        // governed exclusively by `close()`.
        resolve(serverUrl)
      }
      // Server output is retained for diagnostics only; it decides nothing.
      const observeOutput = async (source: typeof proc.stdout, append: (chunk: Uint8Array) => void) => {
        if (!source) return
        for await (const chunk of source) {
          if (state === "pending" || state === "stopping_failure") append(chunk)
        }
      }
      void receipt.wait(receiptObservation.signal).then(
        (published) => {
          if (published.outcome === "listening") {
            if (published.pid !== proc.pid) {
              failStartupAfterCleanup(
                new Error(`Server startup receipt pid ${published.pid} does not match spawned process ${proc.pid}`),
              )
              return
            }
            finishStartup(published.url)
          } else failStartupAfterCleanup(new Error(published.error))
        },
        (error) => {
          if (!receiptObservation.signal.aborted)
            failStartupAfterCleanup(error instanceof Error ? error : new Error(String(error)))
        },
      )
      outputObservationSettled = Promise.all([
        observeOutput(proc.stdout, (chunk) => diagnostics.append(chunk)),
        observeOutput(proc.stderr, (chunk) => diagnostics.append(chunk)),
      ]).then(() => undefined)
      void outputObservationSettled.catch((error) =>
        failStartupAfterCleanup(error instanceof Error ? error : new Error(String(error))),
      )
      void proc.terminal.then(
        (terminal) => {
          if (state !== "pending") return
          if (terminal.reason === "deadline_exceeded") {
            failStartupAfterCleanup(new Error(`Timeout waiting for server to start after ${startupTimeoutMs}ms`))
            return
          }
          if (terminal.reason === "aborted") {
            failStartupAfterCleanup(new Error("Aborted"))
            return
          }
          const diagnostic = diagnostics.snapshot()
          let msg = `Server exited with code ${terminal.exitCode}`
          if (diagnostic.text.trim()) {
            msg += diagnostic.truncated
              ? `\nServer output (truncated=true, retained_bytes=${diagnostic.retainedBytes}): ${diagnostic.text}`
              : `\nServer output: ${diagnostic.text}`
          }
          failStartupAfterCleanup(new Error(msg))
        },
        (error) => failStartupAfterCleanup(error instanceof Error ? error : new Error(String(error))),
      )
    })

    openedServer = {
      url,
      async close() {
        await stopProcess()
      },
    }
  } catch (error) {
    const cleanupFailures: unknown[] = []
    try {
      await cleanupAdmittedProcess?.()
    } catch (cleanupError) {
      cleanupFailures.push(cleanupError)
    }
    try {
      await receipt.dispose()
    } catch (cleanupError) {
      cleanupFailures.push(cleanupError)
    }
    if (cleanupFailures.length) throw combineServerStartupFailures(error, cleanupFailures)
    throw error
  }
  try {
    // The launcher owns the receipt channel on EVERY exit path: a timeout,
    // a child that died, a spawn error and an abort each leave a directory
    // holding the bound URL behind otherwise.
    await receipt.dispose()
  } catch (cleanupError) {
    try {
      await openedServer?.close()
    } catch (processCleanupError) {
      throw new AggregateError(
        [cleanupError, processCleanupError],
        "Server receipt and admitted process cleanup failed",
      )
    }
    throw cleanupError
  }
  return openedServer!
}
