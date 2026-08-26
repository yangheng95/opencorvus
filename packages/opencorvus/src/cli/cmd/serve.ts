import { Server } from "../../server/server"
import * as fsp from "node:fs/promises"
import { observedProcessOccurrence } from "@/runtime/process-occurrence"
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
import { ManagedServerLifecycle } from "../../server/managed-server-lifecycle"
import {
  assertStartedTaskProjectRecoverySucceeded,
  recoverStartedTaskExecutions,
} from "../../engine/host-recovery"
import { Instance } from "../../project/instance"
import type { ArgumentsCamelCase } from "yargs"
import { listenWithRecoveredServerRuntime, settleRecoveringServerRuntime } from "../server-runtime"

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
  "startup-receipt"?: string
  "startup-occurrence"?: string
  "parent-pid"?: number
  "watchdog-interval-ms"?: number
}
const SERVE_STOP_TIMEOUT_MILLISECONDS = 5000

const serveBuilder = (yargs: Parameters<typeof withNetworkOptions>[0]) =>
  withNetworkOptions(yargs)
    .option("project-dir", {
      type: "string",
      describe: "default project directory for all task operations (sandbox)",
    })
    .option("startup-receipt", {
      type: "string",
      describe: "path a framed machine startup receipt is published to",
    })
    .option("startup-occurrence", {
      type: "string",
      describe: "identity of the launch occurrence the startup receipt settles",
    })
    .option("parent-pid", {
      type: "number",
      describe: "managed host process identifier",
    })
    .option("watchdog-interval-ms", {
      type: "number",
      describe: "managed parent watchdog interval in milliseconds",
    })

function managedLifecycleInput(args: ArgumentsCamelCase<ServeOptions>) {
  const rawParentPid = args["parent-pid"]
  if (rawParentPid === undefined) return undefined
  if (!Number.isInteger(rawParentPid) || rawParentPid <= 0) throw new Error("Managed serve requires a positive --parent-pid")
  // The host is alive at this instant — it just launched this process — so the
  // fingerprint observed now IS the occurrence this backend is bound to. A
  // later reuse of the same process number cannot match it.
  const parent = observedProcessOccurrence(rawParentPid) ?? { pid: rawParentPid }
  return {
    parent,
    watchdogIntervalMilliseconds: args["watchdog-interval-ms"],
  }
}

async function publishStartupReceipt(
  args: ArgumentsCamelCase<ServeOptions>,
  fact: { outcome: "listening"; url: string; pid: number } | { outcome: "failed"; error: string },
) {
  const target = args["startup-receipt"]
  const occurrenceID = args["startup-occurrence"]
  if (!target || !occurrenceID) return
  const body = JSON.stringify({ schemaVersion: 1, occurrenceID, ...fact })
  const temporary = `${target}.${process.pid}.tmp`
  try {
    await fsp.writeFile(temporary, body, "utf8")
    await fsp.rename(temporary, target)
  } catch (error) {
    await fsp.rm(temporary, { force: true }).catch(() => undefined)
    // The receipt IS the readiness protocol for a managed launch. A publish
    // that fails silently leaves the launcher polling a file that will never
    // appear until it times out and kills a server that is actually serving,
    // so the failure is terminal for this launch rather than a log line.
    throw new Error(
      `Failed to publish the server startup receipt to ${target}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    )
  }
}

/** Settle a managed launch that is failing before it ever bound. */
async function publishStartupFailure(args: ArgumentsCamelCase<ServeOptions>, error: unknown) {
  try {
    await publishStartupReceipt(args, {
      outcome: "failed",
      error: error instanceof Error ? error.message : String(error),
    })
  } catch (publishError) {
    console.error("[serve] failed to publish the terminal startup receipt:", publishError)
  }
}

export async function handleServeCommand(args: ArgumentsCamelCase<ServeOptions>) {
  // A launcher waiting on the receipt must learn about EVERY terminal
  // outcome, including the ones that happen before a listener is attempted:
  // an invalid managed argument, network option resolution, the restart
  // handoff. Without this, those failures were indistinguishable from a
  // server that was simply slow.
  try {
    return await handleServeCommandInner(args)
  } catch (error) {
    await publishStartupFailure(args, error)
    throw error
  }
}

async function handleServeCommandInner(args: ArgumentsCamelCase<ServeOptions>) {
  // When launched as default entry (double-click), hide console window
  const isDefaultMode = !process.argv.slice(2).some((a) => a === "serve")
  if (isDefaultMode) {
    hideConsoleWindow()
  }

  if (!Flag.OPENCORVUS_SERVER_PASSWORD) {
    console.log("Warning: OPENCORVUS_SERVER_PASSWORD is not set; server is unsecured.")
  }
  const managed = managedLifecycleInput(args)
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
    // A launcher waiting on the receipt learns the terminal failure now
    // instead of waiting out its timeout.
    await publishStartupReceipt(args, {
      outcome: "failed",
      error: recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
    })
    throw recoveryError
  }
  const observeStartedTaskRecovery = (recovery: Promise<void>) => {
    void recovery.catch((error) => {
      console.error("[serve] runtime project recovery failed after listener bind:", error)
    })
    return recovery
  }
  let startedTaskRecovery: Promise<void> = observeStartedTaskRecovery(preparedRuntime.recovery)

  let server = preparedRuntime.server
  const serverUrl = `http://${server.hostname}:${server.port}`
  // Publish actual server URL so ChannelSupervisor can connect channel runtime to it
  process.env.OPENCORVUS_SERVER_URL = serverUrl
  console.log(`opencorvus server listening on ${serverUrl}`)
  // The launcher's readiness protocol: a framed fact, published atomically,
  // so console wording is diagnostics and never a contract.
  await publishStartupReceipt(args, { outcome: "listening", url: serverUrl, pid: process.pid })
  console.log(`overlay UI available at ${serverUrl}/ui/`)

  let shutdownPromise: Promise<void> | null = null
  let processExecutionSettlement: Promise<void> | undefined
  let releaseProcessExecutionHandoff: ((commit?: boolean) => void | Promise<void>) | undefined
  let runtimeTransfer: Server.RuntimeTransferHandle | undefined
  let managedLifecycle: ManagedServerLifecycle.Handle | undefined
  let listenerTransferred = false
  const settleCurrentProcessExecution = (request: ServerShutdownRequest) => {
    if (processExecutionSettlement) return processExecutionSettlement
    const reason = `Server shutdown source=${request.source} reason=${request.reason}`
    const settlement = (async () => {
      // Settlement requests cancellation from the Session/Task owners that can
      // be holding recovery. Joining recovery first would deadlock restart.
      const terminated = await settleRecoveringServerRuntime({
        reason,
        recovery: startedTaskRecovery,
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
      if (releaseProcessExecutionHandoff) await Server.releaseRuntimeHandoff(releaseProcessExecutionHandoff)
      releaseProcessExecutionHandoff = undefined
      managedLifecycle?.release()
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
      managedLifecycle = ManagedServerLifecycle.start({
        ...managed,
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
      releaseRuntimeState: async () => {
        const release = releaseProcessExecutionHandoff
        if (release) await Server.releaseRuntimeHandoff(release)
        releaseProcessExecutionHandoff = undefined
        managedLifecycle?.release()
        managedLifecycle = undefined
      },
      restoreListener: async () => {
        await waitForReleasedListener(actualHostname, actualPort)
        const listenOptions = { ...opts, hostname: actualHostname, port: actualPort, randomPort: false }
        const prepared = await listenWithRecoveredServerRuntime({
          options: listenOptions,
          recover: () => recoverStartedTasks(),
          disposeInstances: () => Instance.disposeAll(),
        })
        startedTaskRecovery = observeStartedTaskRecovery(prepared.recovery)
        const restoredServer = prepared.server
        try {
          if (managed && !managedLifecycle) {
            managedLifecycle = ManagedServerLifecycle.start({
              ...managed,
              onParentExit: (parentReason) => {
                void requestShutdown({ source: "managed-parent-watchdog", reason: parentReason })
              },
            })
          }
        } catch (error) {
          await restoredServer.stop(true).catch((stopError) => {
            throw new AggregateError([error, stopError], "Managed lifecycle restore and listener cleanup failed")
          })
          throw error
        }
        server = restoredServer
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
