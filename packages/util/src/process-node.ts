import { spawn, type ChildProcess } from "node:child_process"
import { existsSync } from "node:fs"
import { mkdtemp, readFile, rm, watch, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  createProcessFacade,
  type ProcessByteSink,
  type ProcessByteSource,
  type ProcessFacade,
  type ProcessSpawnedHandle,
  type ProcessSpawnerRequest,
  type ProcessSpawnRequest,
  type ProcessTerminalReason,
  type ProcessTerminalReceipt,
} from "./process.js"

const DEFAULT_GRACEFUL_TERMINATION_MS = 2_000
const DEFAULT_TERMINAL_WAIT_MS = 5_000

function processIsRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    return code === "ESRCH" ? false : code === "EPERM"
  }
}
async function waitUntil(check: () => boolean, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (!check()) return true
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  return !check()
}
async function terminateRootProcess(child: ChildProcess, gracefulMs: number): Promise<void> {
  const pid = child.pid
  if (!pid || !processIsRunning(pid)) return
  child.kill("SIGTERM")
  if (await waitUntil(() => processIsRunning(pid), gracefulMs)) return
  child.kill("SIGKILL")
  if (!(await waitUntil(() => processIsRunning(pid), DEFAULT_TERMINAL_WAIT_MS)))
    throw new Error(`Process ${pid} did not exit after SIGKILL`)
}
async function terminatePosixTree(child: ChildProcess, gracefulMs: number): Promise<void> {
  const pid = child.pid
  if (!pid) return
  const running = () => {
    try {
      process.kill(-pid, 0)
      return true
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === "EPERM"
    }
  }
  if (!running()) return
  try {
    process.kill(-pid, "SIGTERM")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error
  }
  if (await waitUntil(() => running(), gracefulMs)) return
  try {
    process.kill(-pid, "SIGKILL")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error
  }
  if (!(await waitUntil(() => running(), DEFAULT_TERMINAL_WAIT_MS)))
    throw new Error(`Process group ${pid} did not exit after SIGKILL`)
}
export function nodeProcessByteSource(stream: NodeJS.ReadableStream | null): ProcessByteSource | null {
  if (!stream) return null
  return {
    async *[Symbol.asyncIterator]() {
      for await (const value of stream as AsyncIterable<unknown>) {
        yield Buffer.isBuffer(value) ? value : Buffer.from(value as Uint8Array)
      }
    },
  }
}

type WindowsReadyMarker = Readonly<{
  protocol: 2
  request_id: string
  helper_pid: number
  target_pid: number
  target_process_instance_id: string
  runtime_occurrence_id: string
}>
type WindowsSettlementMarker = Readonly<{
  protocol: 1
  request_id: string
  helper_pid: number
  target_pid: number
  active_processes: 0
  runtime_occurrence_id: string
}>
type WindowsPreTargetSettlementMarker = Readonly<{
  protocol: 1
  request_id: string
  helper_pid: number
  stage: "target_not_created"
  active_processes: 0
  runtime_occurrence_id: string
}>

function resolveWindowsProcessSupervisor(): string {
  const configured = process.env.OPENCORVUS_PROCESS_SUPERVISOR
  const executable = "opencorvus-process-supervisor.exe"
  const candidates = [
    configured,
    path.join(path.dirname(fileURLToPath(import.meta.url)), executable),
    path.join(path.dirname(process.execPath), executable),
    path.join(path.dirname(process.execPath), "bin", executable),
    path.join(path.dirname(path.dirname(process.execPath)), executable),
  ]
  const resolved = candidates.find((candidate): candidate is string => Boolean(candidate && existsSync(candidate)))
  if (!resolved) {
    throw new Error(
      "Windows owned_tree execution requires opencorvus-process-supervisor.exe or OPENCORVUS_PROCESS_SUPERVISOR",
    )
  }
  return resolved
}

async function runControlledWindowsProbe(input: {
  executable: string
  args: string[]
  controlSignal: AbortSignal
  environment?: ProcessSpawnRequest["env"]
  label: string
}): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  const probe = spawn(input.executable, input.args, {
    env: input.environment as NodeJS.ProcessEnv | undefined,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  })
  let stdout = ""
  let stderr = ""
  probe.stdout?.setEncoding("utf8")
  probe.stderr?.setEncoding("utf8")
  probe.stdout?.on("data", (chunk) => (stdout += String(chunk)))
  probe.stderr?.on("data", (chunk) => (stderr += String(chunk)))
  const terminal = new Promise<{ error?: Error; exitCode?: number | null }>((resolve) => {
    let settled = false
    const settle = (outcome: { error?: Error; exitCode?: number | null }) => {
      if (settled) return
      settled = true
      resolve(outcome)
    }
    probe.once("error", (error) => settle({ error }))
    probe.once("exit", (exitCode) => settle({ exitCode }))
  })
  const outputSettled = new Promise<void>((resolve) => {
    probe.once("close", () => resolve())
    probe.once("error", () => resolve())
  })
  let controlCleanup: Promise<never> | undefined
  let abort!: () => void
  const controlled = new Promise<never>((_resolve, reject) => {
    abort = () => {
      if (controlCleanup) return
      const primary = input.controlSignal.reason ?? new Error(`${input.label} was cancelled`)
      controlCleanup = Promise.allSettled([terminateRootProcess(probe, 0), terminal, outputSettled]).then(
        (outcomes) => {
          const cleanupFailures = Array.from(
            new Set(outcomes.flatMap((outcome) => (outcome.status === "rejected" ? [outcome.reason] : []))),
          )
          reject(
            cleanupFailures.length
              ? new AggregateError([primary, ...cleanupFailures], `${input.label} cancellation failed`)
              : primary,
          )
          throw primary
        },
      )
      void controlCleanup.catch(() => undefined)
    }
    input.controlSignal.addEventListener("abort", abort, { once: true })
    if (input.controlSignal.aborted) abort()
  })
  try {
    const outcome = await Promise.race([Promise.all([terminal, outputSettled]).then(([value]) => value), controlled])
    if (input.controlSignal.aborted) return await controlled
    if (outcome.error) throw outcome.error
    return { stdout, stderr, exitCode: outcome.exitCode ?? null }
  } finally {
    input.controlSignal.removeEventListener("abort", abort)
  }
}

async function readWindowsProcessInstanceID(helper: string, pid: number, controlSignal: AbortSignal): Promise<string> {
  const result = await runControlledWindowsProbe({
    executable: helper,
    args: ["--process-instance-id", String(pid)],
    controlSignal,
    label: "Windows owner identity probe",
  })
  const identity = result.stdout.trim()
  if (result.exitCode !== 0 || !/^win32:\d+$/.test(identity)) {
    throw new Error(`Windows process supervisor could not identify owner process ${pid}: ${result.stderr.trim()}`)
  }
  return identity
}

async function resolveWindowsExecutable(
  executable: string,
  environment: ProcessSpawnRequest["env"],
  controlSignal: AbortSignal,
): Promise<string> {
  if (path.isAbsolute(executable) || executable.includes("\\") || executable.includes("/")) return executable
  const result = await runControlledWindowsProbe({
    executable: "where.exe",
    args: [executable],
    controlSignal,
    environment,
    label: `Windows executable resolution for ${executable}`,
  })
  const resolved = result.stdout
    .split(/\r?\n/)
    .map((value) => value.trim())
    .find(Boolean)
  if (result.exitCode !== 0 || !resolved) throw new Error(`Windows process executable is unavailable: ${executable}`)
  return resolved
}

function parseWindowsReadyMarker(text: string, requestID: string, helperPID: number): WindowsReadyMarker {
  const marker = JSON.parse(text) as Partial<WindowsReadyMarker>
  if (
    marker.protocol !== 2 ||
    marker.request_id !== requestID ||
    marker.runtime_occurrence_id !== requestID ||
    marker.helper_pid !== helperPID ||
    !Number.isInteger(marker.target_pid) ||
    (marker.target_pid ?? 0) <= 0 ||
    typeof marker.target_process_instance_id !== "string" ||
    !marker.target_process_instance_id
  ) {
    throw new Error("Windows process supervisor ready marker does not match the process occurrence")
  }
  return marker as WindowsReadyMarker
}

function parseWindowsSettlementMarker(
  text: string,
  requestID: string,
  helperPID: number,
  targetPID: number,
): WindowsSettlementMarker {
  const marker = JSON.parse(text) as Partial<WindowsSettlementMarker>
  if (
    marker.protocol !== 1 ||
    marker.request_id !== requestID ||
    marker.runtime_occurrence_id !== requestID ||
    marker.helper_pid !== helperPID ||
    marker.target_pid !== targetPID ||
    marker.active_processes !== 0
  ) {
    throw new Error("Windows process supervisor settlement marker does not prove active-process-zero")
  }
  return marker as WindowsSettlementMarker
}

function parseWindowsPreTargetSettlementMarker(
  text: string,
  requestID: string,
  helperPID: number,
): WindowsPreTargetSettlementMarker {
  const marker = JSON.parse(text) as Partial<WindowsPreTargetSettlementMarker>
  if (
    marker.protocol !== 1 ||
    marker.request_id !== requestID ||
    marker.runtime_occurrence_id !== requestID ||
    marker.helper_pid !== helperPID ||
    marker.stage !== "target_not_created" ||
    marker.active_processes !== 0
  ) {
    throw new Error("Windows process supervisor pre-target marker does not prove active-process-zero")
  }
  return marker as WindowsPreTargetSettlementMarker
}

async function readIfPresent(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined
    throw error
  }
}

async function waitForWindowsReady(input: {
  directory: string
  readyPath: string
  launchFailedPath: string
  requestID: string
  helperPID: number
  helperTerminal: Promise<ProcessTerminalReceipt>
  controlSignal: AbortSignal
  requestCancellation(): Promise<void>
}): Promise<WindowsReadyMarker> {
  const watcherController = new AbortController()
  const events = watch(input.directory, { signal: watcherController.signal })[Symbol.asyncIterator]()
  let abort!: () => void
  const controlled = new Promise<never>((_resolve, reject) => {
    abort = () => {
      void input.requestCancellation().catch(() => undefined)
      reject(input.controlSignal.reason ?? new Error("Process admission was cancelled"))
    }
    input.controlSignal.addEventListener("abort", abort, { once: true })
    if (input.controlSignal.aborted) abort()
  })
  try {
    // Node's fs.promises.watch is an async generator: the filesystem watch is
    // not armed until the first next() call. Keep one event read pending before
    // every marker read so an atomic rename cannot fall into a lost-event gap.
    let nextEvent = events.next()
    while (true) {
      const ready = await readIfPresent(input.readyPath)
      if (ready) return parseWindowsReadyMarker(ready, input.requestID, input.helperPID)
      if (await readIfPresent(input.launchFailedPath)) {
        await input.helperTerminal
        throw new Error("Windows process supervisor failed before creating the target process")
      }
      await Promise.race([
        nextEvent.then((event) => {
          if (event.done) throw new Error("Windows process supervisor readiness watcher closed")
        }),
        input.helperTerminal.then((receipt) => {
          throw new Error(`Windows process supervisor exited before readiness with code ${receipt.exitCode}`)
        }),
        controlled,
      ])
      nextEvent = events.next()
    }
  } finally {
    input.controlSignal.removeEventListener("abort", abort)
    watcherController.abort()
    await events.return?.()
  }
}

async function spawnWindowsOwnedTree(request: ProcessSpawnerRequest): Promise<ProcessSpawnedHandle> {
  const helper = resolveWindowsProcessSupervisor()
  const directory = await mkdtemp(path.join(tmpdir(), "opencorvus-node-process-"))
  const requestPath = path.join(directory, "request.json")
  const readyPath = path.join(directory, "ready.json")
  const launchFailedPath = path.join(directory, "launch-failed.json")
  const settledPath = path.join(directory, "settled.json")
  const cancelPath = path.join(directory, "cancel")
  const requestID = request.occurrenceID
  let child: ChildProcess
  try {
    const ownerProcessInstanceID = await readWindowsProcessInstanceID(helper, process.pid, request.controlSignal)
    const executable = await resolveWindowsExecutable(request.command.executable, request.env, request.controlSignal)
    await writeFile(
      requestPath,
      JSON.stringify({
        kind: "command",
        executable,
        args: [...request.command.args],
        detached: false,
        cwd: request.cwd,
        cancel_file: cancelPath,
        ready_file: readyPath,
        launch_failed_file: launchFailedPath,
        settled_file: settledPath,
        request_id: requestID,
        owner_pid: process.pid,
        owner_process_instance_id: ownerProcessInstanceID,
        runtime_occurrence_id: requestID,
      }),
      "utf8",
    )
    child = spawn(helper, ["--request", requestPath], {
      env: request.env as NodeJS.ProcessEnv | undefined,
      shell: false,
      stdio: [request.stdin ?? "ignore", request.stdout ?? "pipe", request.stderr ?? "pipe"],
      windowsHide: request.windowsHide ?? true,
    })
  } catch (error) {
    try {
      await rm(directory, { recursive: true, force: true })
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "Windows process setup and request cleanup failed")
    }
    throw error
  }
  let helperExited = false
  let termination: Promise<ProcessTerminalReceipt> | undefined
  const helperTerminal = new Promise<ProcessTerminalReceipt>((resolve, reject) => {
    child.once("error", reject)
    child.once("exit", (exitCode, signal) => {
      helperExited = true
      resolve({ occurrenceID: requestID, pid: child.pid ?? 0, reason: "exited", exitCode, signal })
    })
  })
  const outputSettled = new Promise<void>((resolve) => child.once("close", () => resolve()))
  let cancellation: Promise<void> | undefined
  const requestCancellation = () => (cancellation ??= writeFile(cancelPath, requestID, "utf8"))
  const validatePhysicalSettlement = async (targetPID?: number) => {
    const preTarget = await readIfPresent(launchFailedPath)
    if (preTarget) {
      parseWindowsPreTargetSettlementMarker(preTarget, requestID, child.pid!)
      return
    }
    const readyText = await readFile(readyPath, "utf8")
    const ready = parseWindowsReadyMarker(readyText, requestID, child.pid!)
    if (targetPID !== undefined && ready.target_pid !== targetPID) {
      throw new Error("Windows process supervisor settled a different target occurrence")
    }
    parseWindowsSettlementMarker(await readFile(settledPath, "utf8"), requestID, child.pid!, ready.target_pid)
  }
  const cancelAndJoinHelper = async (): Promise<void> => {
    const failures: unknown[] = []
    try {
      await requestCancellation()
    } catch (error) {
      failures.push(error)
    }
    if (!helperExited && !(await waitUntil(() => !helperExited, DEFAULT_TERMINAL_WAIT_MS))) {
      try {
        await terminateRootProcess(child, 0)
      } catch (error) {
        failures.push(error)
      }
    }
    const [terminalOutcome, outputOutcome] = await Promise.allSettled([helperTerminal, outputSettled])
    if (terminalOutcome.status === "rejected") failures.push(terminalOutcome.reason)
    if (outputOutcome.status === "rejected") failures.push(outputOutcome.reason)
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1) throw new AggregateError(failures, "Windows process supervisor cleanup failed")
  }
  try {
    await new Promise<void>((resolve, reject) => {
      child.once("spawn", resolve)
      child.once("error", reject)
      if (child.pid) resolve()
    })
    if (!child.pid) throw new Error("Windows process supervisor has no pid after spawn")
    const ready = await waitForWindowsReady({
      directory,
      readyPath,
      launchFailedPath,
      requestID,
      helperPID: child.pid,
      helperTerminal,
      controlSignal: request.controlSignal,
      requestCancellation,
    })
    const terminal = helperTerminal.then(async (helperReceipt) => {
      await validatePhysicalSettlement(ready.target_pid)
      return { ...helperReceipt, pid: ready.target_pid }
    })
    const settled = (async () => {
      const [terminalOutcome, outputOutcome] = await Promise.allSettled([terminal, outputSettled])
      const [cleanupOutcome] = await Promise.allSettled([rm(directory, { recursive: true, force: true })])
      const failures = [
        ...(terminalOutcome.status === "rejected" ? [terminalOutcome.reason] : []),
        ...(outputOutcome.status === "rejected" ? [outputOutcome.reason] : []),
        ...(cleanupOutcome.status === "rejected" ? [cleanupOutcome.reason] : []),
      ]
      if (failures.length === 1) throw failures[0]
      if (failures.length > 1) throw new AggregateError(failures, "Windows process settlement failed")
      if (terminalOutcome.status !== "fulfilled") {
        throw new Error("Windows process supervisor terminal settlement was unavailable")
      }
      return terminalOutcome.value
    })()
    void settled.catch(() => undefined)
    const terminate = (reason: Exclude<ProcessTerminalReason, "exited"> = "terminated") => {
      if (!termination) {
        termination = cancelAndJoinHelper().then(async () => ({ ...(await settled), reason }))
        void termination.catch(() => undefined)
      }
      return termination
    }
    return {
      occurrenceID: requestID,
      pid: ready.target_pid,
      stdin: nodeProcessByteSink(child.stdin),
      stdout: nodeProcessByteSource(child.stdout),
      stderr: nodeProcessByteSource(child.stderr),
      terminal,
      outputSettled,
      settled,
      terminate,
      dispose: () => (helperExited ? settled : terminate("terminated")),
      unref() {
        child.unref()
      },
    }
  } catch (error) {
    child.stdout?.resume()
    child.stderr?.resume()
    const cleanupFailures: unknown[] = []
    const [helperCleanup] = await Promise.allSettled([cancelAndJoinHelper()])
    if (helperCleanup.status === "rejected") cleanupFailures.push(helperCleanup.reason)
    const [physicalSettlement] = await Promise.allSettled([validatePhysicalSettlement()])
    if (physicalSettlement.status === "rejected") {
      cleanupFailures.push(physicalSettlement.reason)
    }
    try {
      await rm(directory, { recursive: true, force: true })
    } catch (cleanupError) {
      cleanupFailures.push(cleanupError)
    }
    if (cleanupFailures.length) {
      throw new AggregateError([error, ...cleanupFailures], "Windows process admission and cleanup failed")
    }
    throw error
  }
}
export function nodeProcessByteSink(stream: NodeJS.WritableStream | null): ProcessByteSink | null {
  if (!stream) return null
  let closed = false
  return {
    async write(chunk) {
      if (closed || stream.write(chunk)) return
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          stream.removeListener("drain", drained)
          stream.removeListener("error", failed)
        }
        const drained = () => {
          cleanup()
          resolve()
        }
        const failed = (error: unknown) => {
          cleanup()
          reject(error)
        }
        stream.once("drain", drained)
        stream.once("error", failed)
      })
    },
    async close() {
      if (closed) return
      closed = true
      await new Promise<void>((resolve) => {
        if ((stream as NodeJS.WritableStream & { destroyed?: boolean }).destroyed) return resolve()
        const onError = () => resolve()
        stream.once("error", onError)
        stream.end(() => {
          stream.removeListener("error", onError)
          resolve()
        })
      })
    },
  }
}

async function spawnNodeProcess(request: ProcessSpawnerRequest): Promise<ProcessSpawnedHandle> {
  const command = request.command
  if (!command.executable.trim()) throw new Error("Process executable is required")
  const ownership = request.ownership ?? "owned_process"
  if (ownership === "owned_tree" && process.platform === "win32") return spawnWindowsOwnedTree(request)
  const child = spawn(command.executable, [...command.args], {
    cwd: request.cwd,
    env: request.env as NodeJS.ProcessEnv | undefined,
    shell: false,
    stdio: [request.stdin ?? "ignore", request.stdout ?? "pipe", request.stderr ?? "pipe"],
    detached: ownership === "detached" || ownership === "owned_tree",
    windowsHide: request.windowsHide ?? true,
    windowsVerbatimArguments: request.windowsVerbatimArguments ?? false,
  })
  let physicallyExited = false
  let termination: Promise<ProcessTerminalReceipt> | undefined
  const baseTerminal = new Promise<ProcessTerminalReceipt>((resolve, reject) => {
    let settled = false
    const exited = (exitCode: number | null, signal: NodeJS.Signals | null) => {
      if (settled) return
      settled = true
      physicallyExited = true
      resolve({ occurrenceID: request.occurrenceID, pid: child.pid ?? 0, reason: "exited", exitCode, signal })
    }
    child.once("error", reject)
    child.once("exit", exited)
    if (child.exitCode !== null || child.signalCode !== null) exited(child.exitCode, child.signalCode)
  })
  const outputSettled = new Promise<void>((resolve) => {
    let settled = false
    const closed = () => {
      if (settled) return
      settled = true
      resolve()
    }
    child.once("close", closed)
    queueMicrotask(() => {
      const streams = [child.stdin, child.stdout, child.stderr].filter(Boolean) as Array<{
        destroyed?: boolean
        readableEnded?: boolean
        writableEnded?: boolean
      }>
      if (
        (child.exitCode !== null || child.signalCode !== null) &&
        streams.every((stream) => stream.destroyed || stream.readableEnded || stream.writableEnded)
      ) {
        closed()
      }
    })
  })
  const terminal =
    ownership === "owned_tree"
      ? baseTerminal.then(async (receipt) => {
          const pid = child.pid
          if (pid) {
            while (true) {
              try {
                process.kill(-pid, 0)
              } catch (error) {
                if ((error as NodeJS.ErrnoException).code === "ESRCH") break
                if ((error as NodeJS.ErrnoException).code !== "EPERM") throw error
              }
              await new Promise((resolve) => setTimeout(resolve, 25))
            }
          }
          return receipt
        })
      : baseTerminal
  let occurrenceSettled = false
  const baseSettled = Promise.all([terminal, outputSettled]).then(([receipt]) => {
    occurrenceSettled = true
    return receipt
  })
  void baseSettled.catch(() => undefined)
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      child.off("spawn", spawned)
      child.off("error", failed)
    }
    const spawned = () => {
      cleanup()
      resolve()
    }
    const failed = (error: Error) => {
      cleanup()
      // A failed spawn owns libuv handles until `close`, just like a process
      // that reached `spawn`. Do not admit the next occurrence while this
      // failed attempt can still publish terminal resource events.
      child.once("close", () => reject(error))
    }
    child.once("spawn", spawned)
    child.once("error", failed)
    // Node guarantees a positive pid only after successful OS admission. Bun's
    // compatibility layer may publish `spawn` before returning the ChildProcess,
    // so the already-bound pid is the equivalent success fact.
    if (child.pid) spawned()
  })
  if (!child.pid) throw new Error(`Process has no pid after spawn: ${[command.executable, ...command.args].join(" ")}`)
  const terminate = (reason: Exclude<ProcessTerminalReason, "exited"> = "terminated") => {
    if (!termination) {
      termination = (async () => {
        if (ownership === "owned_tree") {
          await terminatePosixTree(child, request.gracefulTerminationMs ?? DEFAULT_GRACEFUL_TERMINATION_MS)
        } else if (!physicallyExited) {
          await terminateRootProcess(child, request.gracefulTerminationMs ?? DEFAULT_GRACEFUL_TERMINATION_MS)
        }
        return { ...(await baseSettled), reason }
      })()
      void termination.catch(() => undefined)
    }
    return termination
  }
  return {
    occurrenceID: request.occurrenceID,
    pid: child.pid,
    stdin: nodeProcessByteSink(child.stdin),
    stdout: nodeProcessByteSource(child.stdout),
    stderr: nodeProcessByteSource(child.stderr),
    terminal,
    outputSettled,
    settled: baseSettled,
    terminate,
    async dispose() {
      return occurrenceSettled ? await baseSettled : await terminate("terminated")
    },
    unref() {
      child.unref()
      ;(child.stdout as (NodeJS.ReadableStream & { unref?: () => void }) | null)?.unref?.()
      ;(child.stderr as (NodeJS.ReadableStream & { unref?: () => void }) | null)?.unref?.()
    },
  }
}

export const NodeProcess: ProcessFacade = createProcessFacade(spawnNodeProcess)
