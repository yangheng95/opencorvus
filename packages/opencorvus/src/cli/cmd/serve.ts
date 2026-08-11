import { Server } from "../../server/server"
import path from "node:path"
import { cmd } from "./cmd"
import { withNetworkOptions, resolveNetworkOptions, type NetworkOptions } from "../network"
import { Flag } from "../../flag/flag"
import {
  clearServerShutdownHandler,
  registerServerShutdownHandler,
  type ServerShutdownRequest,
} from "../../server/shutdown"
import { recordCurrentProcessShutdownRequest } from "../../runtime/process-occurrence"
import {
  childRestartHandoff,
  beginRestartHandoff,
  sendRestartHandoffMessage,
  waitForReleasedListener,
  waitForRestartBind,
} from "../../server/restart-handoff"
import { clearServerRestartHandler, registerServerRestartHandler } from "../../server/restart"
import { stopServerWithTimeout } from "../../server/stop"
import { ManagedServerOwnership } from "../../server/managed-server-ownership"
import {
  RuntimeServerOwnership,
  RuntimeServerOwnershipHandoffPendingError,
} from "../../server/runtime-server-ownership"
import { Database } from "../../storage/db"
import {
  assertStartedTaskProjectRecoverySucceeded,
  recoverStartedTaskExecutions,
} from "../../engine/host-recovery"
import { Instance } from "../../project/instance"
import type { ArgumentsCamelCase } from "yargs"
import { acquireServerRuntimeAfterRecovery, listenWithRecoveredServerRuntime } from "../server-runtime"

/** Hide the console window on Windows using Win32 API. */
function hideConsoleWindow() {
  if (process.platform !== "win32") return
  try {
    const { dlopen, FFIType } = require("bun:ffi")
    const kernel32 = dlopen("kernel32.dll", {
      GetConsoleWindow: { returns: FFIType.ptr, args: [] },
    })
    const user32 = dlopen("user32.dll", {
      ShowWindow: { returns: FFIType.i32, args: [FFIType.ptr, FFIType.i32] },
    })
    const hwnd = kernel32.symbols.GetConsoleWindow()
    if (hwnd) user32.symbols.ShowWindow(hwnd, 0) // SW_HIDE
    kernel32.close()
    user32.close()
  } catch {}
}

type ServeOptions = NetworkOptions & {
  "project-dir"?: string
  "managed-scope"?: string
  "parent-pid"?: number
  "watchdog-interval-ms"?: number
}
const SERVE_STOP_TIMEOUT_MILLISECONDS = 5000

export async function releaseServeRuntimeOwnership(input: {
  database: string
  occurrenceID: string
  releaseOwnership(afterRelease: () => void | Promise<void>): Promise<void>
  commit(): void | Promise<void>
  rollback(): void | Promise<void>
}): Promise<void> {
  try {
    await input.releaseOwnership(input.commit)
  } catch (error) {
    if (
      !(error instanceof RuntimeServerOwnershipHandoffPendingError) &&
      RuntimeServerOwnership.currentOccurrenceID(input.database) === input.occurrenceID
    ) {
      await input.rollback()
    }
    throw error
  }
}

const serveBuilder = (yargs: Parameters<typeof withNetworkOptions>[0]) =>
  withNetworkOptions(yargs)
    .option("project-dir", {
      type: "string",
      describe: "default project directory for all task operations (sandbox)",
    })
    .option("managed-scope", {
      type: "string",
      describe: "exclusive managed-server ownership scope (requires --parent-pid)",
    })
    .option("parent-pid", {
      type: "number",
      describe: "owning host process identifier (requires --managed-scope)",
    })
    .option("watchdog-interval-ms", {
      type: "number",
      describe: "managed parent watchdog interval in milliseconds",
    })

function managedOwnershipInput(args: ArgumentsCamelCase<ServeOptions>) {
  const rawScope = args["managed-scope"]
  const rawParentPid = args["parent-pid"]
  const hasScope = typeof rawScope === "string" && rawScope.trim().length > 0
  const hasParentPid = rawParentPid !== undefined
  if (!hasScope && !hasParentPid) return undefined
  if (!hasScope || !Number.isInteger(rawParentPid) || rawParentPid! <= 0) {
    throw new Error("Managed serve requires both --managed-scope and a positive --parent-pid")
  }
  return {
    scope: path.resolve(rawScope!),
    parentPid: rawParentPid!,
    watchdogIntervalMilliseconds: args["watchdog-interval-ms"],
  }
}

export async function handleServeCommand(args: ArgumentsCamelCase<ServeOptions>) {
  // When launched as default entry (double-click), hide console window
  const isDefaultMode = !process.argv.slice(2).some((a) => a === "serve")
  if (isDefaultMode) {
    hideConsoleWindow()
  }

  if (!Flag.OPENCORVUS_SERVER_PASSWORD) {
    console.log("Warning: OPENCORVUS_SERVER_PASSWORD is not set; server is unsecured.")
  }
  const managed = managedOwnershipInput(args)
  const resolvedOptions = await resolveNetworkOptions(args)
  const childHandoff = childRestartHandoff()
  const opts = childHandoff
    ? {
        ...resolvedOptions,
        hostname: childHandoff.hostname,
        port: childHandoff.port,
        randomPort: false,
      }
    : resolvedOptions

  // Resolve --project-dir: CLI argument > environment variable.
  const configuredProjectDir = args["project-dir"] || process.env.OPENCORVUS_PROJECT_DIR || undefined
  const projectDir = configuredProjectDir ? path.resolve(configuredProjectDir) : undefined
  if (projectDir) {
    process.env.OPENCORVUS_PROJECT_DIR = projectDir
    console.log(`Project directory (sandbox): ${projectDir}`)
  }

  process.on("uncaughtException", (err) => {
    console.error("[serve] uncaughtException:", err)
  })
  process.on("unhandledRejection", (err) => {
    console.error("[serve] unhandledRejection:", err)
  })

  if (childHandoff) await waitForRestartBind(childHandoff)

  let preparedRuntime: Awaited<ReturnType<typeof listenWithRecoveredServerRuntime>>
  try {
    preparedRuntime = await listenWithRecoveredServerRuntime({
      options: opts,
      recover: () => recoverStartedTasks(),
      disposeInstances: () => Instance.disposeAll(),
    })
  } catch (recoveryError) {
    if (childHandoff) {
      sendRestartHandoffMessage(
        { type: "failed", error: recoveryError instanceof Error ? recoveryError.message : String(recoveryError) },
        childHandoff,
      )
    }
    throw recoveryError
  }
  const startupRuntimeOwnership = preparedRuntime.ownership
  let runtimeOccurrenceID = startupRuntimeOwnership.owner.occurrenceID
  let startedTaskRecovery: Promise<void> = preparedRuntime.recovery

  let server = preparedRuntime.server
  const serverUrl = `http://${server.hostname}:${server.port}`
  // Publish actual server URL so ChannelSupervisor can connect channel runtime to it
  process.env.OPENCORVUS_SERVER_URL = serverUrl
  console.log(`opencorvus server listening on ${serverUrl}`)
  console.log(`overlay UI available at ${serverUrl}/ui/`)

  let shutdownPromise: Promise<void> | null = null
  let processExecutionSettlement: Promise<void> | undefined
  let releaseProcessExecutionHandoff: ((commit?: boolean) => void | Promise<void>) | undefined
  let runtimeTransfer: Server.RuntimeTransferHandle | undefined
  let ownership: ManagedServerOwnership.Handle | undefined
  let listenerTransferred = false
  const settleCurrentProcessExecution = (request: ServerShutdownRequest) => {
    if (processExecutionSettlement) return processExecutionSettlement
    const reason = `Server shutdown source=${request.source} reason=${request.reason}`
    const settlement = (async () => {
      await startedTaskRecovery
      const terminated = await Server.settleCurrentProcessExecution(reason, {
        disposeInstances: () => Instance.disposeAll(),
      })
      releaseProcessExecutionHandoff = terminated.releaseHandoff
      console.log(
        `[serve] settled process-owned prompts sessions=${terminated.sessions} toolParts=${terminated.toolParts}`,
      )
    })()
    processExecutionSettlement = settlement
    void settlement.catch(() => {
      if (processExecutionSettlement === settlement) processExecutionSettlement = undefined
    })
    return settlement
  }
  const requestShutdown = (request: ServerShutdownRequest) => {
    if (shutdownPromise) return shutdownPromise
    const shutdown = (async () => {
      recordCurrentProcessShutdownRequest(request)
      console.log(`[serve] shutdown requested via ${request.source}: ${request.reason}`)
      if (!listenerTransferred) {
        await stopServerWithTimeout({
          stop: async () => {
            runtimeTransfer = Server.beginRuntimeTransfer(server)
            await runtimeTransfer.quiesced
          },
          timeoutMilliseconds: SERVE_STOP_TIMEOUT_MILLISECONDS,
          onStopError: (error) => {
            console.error("[serve] listener quiesce failed during shutdown:", error)
          },
          onTimeout: () => {
            console.error("[serve] listener quiesce timeout, escalating:", SERVE_STOP_TIMEOUT_MILLISECONDS)
          },
        })
        listenerTransferred = true
      }
      await settleCurrentProcessExecution(request)
      try {
        if (runtimeTransfer) {
          await releaseServeRuntimeOwnership({
            database: Database.Path(),
            occurrenceID: runtimeOccurrenceID,
            releaseOwnership: (afterRelease) => runtimeTransfer!.releaseOwnership(afterRelease),
            commit: () => releaseProcessExecutionHandoff?.(true),
            rollback: () => releaseProcessExecutionHandoff?.(false),
          })
        }
        releaseProcessExecutionHandoff = undefined
      } catch (error) {
        releaseProcessExecutionHandoff = undefined
        throw error
      }
      ownership?.release()
    })()
    shutdownPromise = shutdown
    void shutdown.then(
      () => {
        clearServerShutdownHandler(requestShutdown)
        clearServerRestartHandler(requestRestart)
        setTimeout(() => process.exit(0), 0)
      },
      (error) => {
        clearServerShutdownHandler(requestShutdown)
        clearServerRestartHandler(requestRestart)
        console.error("[serve] shutdown failed:", error)
        setTimeout(() => process.exit(1), 0)
      },
    )
    return shutdown
  }

  if (managed) {
    try {
      ownership = ManagedServerOwnership.acquire({
        ...managed,
        port: server.port!,
        hostname: opts.hostname,
        onParentExit: (reason) => {
          void requestShutdown({ source: "managed-parent-watchdog", reason })
        },
      })
    } catch (error) {
      await server.stop(true)
      throw error
    }
  }
  registerServerShutdownHandler(requestShutdown)

  const actualPort = server.port!
  const actualHostname = server.hostname ?? opts.hostname
  let restartAttempt: Promise<void> | undefined
  const requestRestart = (reason: string) => {
    if (restartAttempt) return restartAttempt
    const operation = beginRestartHandoff({
      hostname: actualHostname,
      port: actualPort,
      quiesceListener: async () => {
        console.log("[serve] restart quiescing current listener")
        runtimeTransfer = Server.beginRuntimeTransfer(server)
        await runtimeTransfer.quiesced
        listenerTransferred = true
        console.log("[serve] restart current listener quiesced")
      },
      settleExecution: async () => {
        console.log("[serve] restart settling process-owned execution")
        await settleCurrentProcessExecution({ source: "http-client", reason })
      },
      releaseRuntimeOwnership: async () => {
        const release = () =>
          releaseServeRuntimeOwnership({
            database: Database.Path(),
            occurrenceID: runtimeOccurrenceID,
            releaseOwnership: (afterRelease) => runtimeTransfer!.releaseOwnership(afterRelease),
            commit: () => releaseProcessExecutionHandoff?.(true),
            rollback: () => releaseProcessExecutionHandoff?.(false),
          })
        try {
          if (runtimeTransfer) await release()
          releaseProcessExecutionHandoff = undefined
        } catch (error) {
          if (error instanceof RuntimeServerOwnershipHandoffPendingError) {
            await release()
            releaseProcessExecutionHandoff = undefined
          } else {
            releaseProcessExecutionHandoff = undefined
            processExecutionSettlement = undefined
            throw error
          }
        }
        ownership?.release()
        ownership = undefined
      },
      restoreListener: async () => {
        await waitForReleasedListener(actualHostname, actualPort)
        const listenOptions = { ...opts, hostname: actualHostname, port: actualPort, randomPort: false }
        const retainedOccurrenceID = RuntimeServerOwnership.currentOccurrenceID(Database.Path())
        let restoredServer: ReturnType<typeof Server.listen>
        if (retainedOccurrenceID === runtimeOccurrenceID) {
          startedTaskRecovery = recoverStartedTasks()
          await startedTaskRecovery
          restoredServer = runtimeTransfer!.restoreListener(listenOptions)
        } else {
          const prepared = await listenWithRecoveredServerRuntime({
            options: listenOptions,
            recover: () => recoverStartedTasks(),
            disposeInstances: () => Instance.disposeAll(),
          })
          startedTaskRecovery = prepared.recovery
          runtimeOccurrenceID = prepared.ownership.owner.occurrenceID
          restoredServer = prepared.server
        }
        try {
          if (managed && !ownership) {
            ownership = ManagedServerOwnership.acquire({
              ...managed,
              port: actualPort,
              hostname: actualHostname,
              onParentExit: (parentReason) => {
                void requestShutdown({ source: "managed-parent-watchdog", reason: parentReason })
              },
            })
          }
        } catch (error) {
          await restoredServer.stop(true).catch((stopError) => {
            throw new AggregateError([error, stopError], "Managed ownership restore and listener cleanup failed")
          })
          throw error
        }
        server = restoredServer
        runtimeOccurrenceID = RuntimeServerOwnership.currentOccurrenceID(Database.Path()) ?? runtimeOccurrenceID
        listenerTransferred = false
        runtimeTransfer = undefined
        processExecutionSettlement = undefined
      },
    }).then(({ drained }) => {
      clearServerRestartHandler(requestRestart)
      void drained.then(
        () => {
          void requestShutdown({ source: "internal-restart", reason })
        },
        (error) => {
          console.error("[serve] restart request connection drain failed:", error)
          void requestShutdown({ source: "internal-restart", reason })
        },
      )
    })
    restartAttempt = operation
    void operation.catch(() => {
      if (restartAttempt === operation) restartAttempt = undefined
    })
    return operation
  }
  registerServerRestartHandler(requestRestart)

  const signals: NodeJS.Signals[] =
    process.platform === "win32" ? ["SIGINT", "SIGTERM", "SIGBREAK"] : ["SIGINT", "SIGTERM"]
  for (const signal of signals) {
    process.on(signal, () => {
      void requestShutdown({ source: "process-signal", reason: signal })
    })
  }

  function recoverStartedTasks() {
    return recoverStartedTaskExecutions({
      ...(projectDir ? { scopeProjectWorktree: projectDir } : {}),
    })
      .then((result) => {
        console.log(
          `[serve] runtime project recovery attempted=${result.attempted} initialized=${result.initialized} mission_attempted=${result.missionAttempted} mission_woken=${result.missionWoken} mission_completed=${result.missionCompleted} failures=${result.failures.length}`,
        )
        for (const failure of result.failures) {
          console.error(
            `[serve] runtime project recovery failed directory=${failure.directory || "<unresolved>"}: ${failure.error}`,
          )
        }
        assertStartedTaskProjectRecoverySucceeded(result)
        return Instance.converge({ maximumRetained: Flag.OPENCORVUS_PROJECT_RUNTIME_CACHE_LIMIT })
      })
      .then((result) => {
        if (result.disposed.length > 0) {
          console.log(
            `[serve] idle Project runtime convergence retained=${result.retained} active=${result.active} disposed=${result.disposed.length}`,
          )
        }
      })
  }

  if (childHandoff) {
    sendRestartHandoffMessage({ type: "ready", url: serverUrl }, childHandoff)
  }

  await new Promise(() => {})
}

export const DefaultServeCommand = cmd({
  command: "$0",
  builder: serveBuilder,
  describe: false,
  handler: handleServeCommand,
})

export const ServeCommand = cmd({
  command: "serve",
  builder: serveBuilder,
  describe: "starts a headless opencorvus server",
  handler: handleServeCommand,
})
