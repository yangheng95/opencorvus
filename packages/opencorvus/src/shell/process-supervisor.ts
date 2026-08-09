import { spawn, spawnSync, type ChildProcess } from "child_process"
import { randomUUID } from "crypto"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { PassThrough } from "node:stream"
import { Filesystem } from "@/util/filesystem"
import { Global } from "@/global"
import { which } from "@/util/which"
import {
  disposeTaskExecutionCapsule,
  wrapTaskCapsuleCommand,
  type TaskExecutionCapsuleRequest,
} from "@/execution-capsule/runtime"
import { resolveTaskProcessExecution } from "@/engine/task-execution-capsule-binding"
import { Lock } from "@/util/lock"

const SIGKILL_TIMEOUT_MS = 200

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined
  const code = (error as { code?: unknown }).code
  return typeof code === "string" ? code : undefined
}

async function rethrowWithCleanup(
  primaryError: unknown,
  message: string,
  cleanup: Array<() => Promise<unknown>>,
): Promise<never> {
  const results = await Promise.allSettled(cleanup.map((operation) => Promise.resolve().then(operation)))
  const errors = [primaryError, ...results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []))]
  if (errors.length > 1) throw new AggregateError(errors, message)
  throw primaryError
}

export namespace ProcessSupervisor {
  export interface SpawnOptions {
    command: string
    shell: string
    cwd?: string
    env?: NodeJS.ProcessEnv
    stdin?: "ignore" | "pipe"
    gracefulTerminationMs?: number
    owner?: string
  }

  export interface CommandSpawnOptions {
    executable: string
    args: string[]
    cwd?: string
    env?: NodeJS.ProcessEnv
    stdin?: "ignore" | "pipe"
    gracefulTerminationMs?: number
    owner?: string
    /** Launch a replacement process outside the current supervisor's native cleanup job. */
    detached?: boolean
  }

  export type TaskProcessIdentity = Readonly<{ taskID: string; cwd: string }>

  export interface Handle {
    pid: number
    stdin: NodeJS.WritableStream | null
    stdout: NodeJS.ReadableStream | null
    stderr: NodeJS.ReadableStream | null
    exited: Promise<number>
    terminate(): Promise<void>
    dispose(): Promise<void>
    unref(): void
  }

  export const TERMINATION_CLEANUP_TIMEOUT_MS = 5_000
  export const TERMINATION_EXIT_TIMEOUT_MS = 1_000

  export function combineFailures(message: string, failures: readonly unknown[]): unknown {
    const flattened = failures.flatMap((failure) =>
      failure instanceof AggregateError ? Array.from(failure.errors) : [failure],
    )
    const unique = Array.from(new Set(flattened))
    if (unique.length === 0) return new Error(message)
    if (unique.length === 1) return unique[0]
    return new AggregateError(unique, `${message}: ${unique.map(errorMessage).join("; ")}`)
  }

  type Factory = (opts: SpawnOptions) => Promise<Handle>
  type CommandFactory = (opts: CommandSpawnOptions) => Promise<Handle>
  type WindowsHelperResolver = () => Promise<string | undefined>
  type WindowsHelperBinding = {
    resolver?: WindowsHelperResolver
    path?: string
    resolution?: Promise<string | undefined>
  }
  type WindowsOutputObserver = (stdout: NodeJS.ReadableStream, stderr: NodeJS.ReadableStream) => void
  type PosixProcessSnapshotResult = {
    error?: Error
    status: number | null
    signal: NodeJS.Signals | null
    stdout: string
    stderr: string
  }
  type PosixProcessSnapshot = () => PosixProcessSnapshotResult
  type LiveHandle = {
    id: number
    pid: number
    cwd?: string
    owner: string
    taskID?: string
    handle: Handle
  }

  let factory: Factory | undefined
  let commandFactory: CommandFactory | undefined
  let windowsHelperBinding: WindowsHelperBinding = {}
  let windowsOutputObserver: WindowsOutputObserver | undefined
  let posixProcessSnapshot: PosixProcessSnapshot = defaultPosixProcessSnapshot
  let nextLiveHandleID = 1
  const liveHandles = new Map<number, LiveHandle>()
  const taskSpawnRegistrations = new Map<string, Set<Promise<void>>>()
  const taskLeaseKey = (taskID: string) => `task-process:${taskID}`

  function registerTaskSpawn(taskID: string): () => void {
    let settle!: () => void
    const registration = new Promise<void>((resolve) => (settle = resolve))
    const registrations = taskSpawnRegistrations.get(taskID) ?? new Set<Promise<void>>()
    registrations.add(registration)
    taskSpawnRegistrations.set(taskID, registrations)
    return () => {
      registrations.delete(registration)
      if (registrations.size === 0) taskSpawnRegistrations.delete(taskID)
      settle()
    }
  }

  async function taskProcessReadLease(taskID: string) {
    let finishRegistration: (() => void) | undefined
    const lease = await Lock.read(taskLeaseKey(taskID), () => {
      finishRegistration = registerTaskSpawn(taskID)
    })
    return {
      lease,
      finishRegistration: () => finishRegistration?.(),
    }
  }

  export async function spawnTaskShell(identity: TaskProcessIdentity, opts: Omit<SpawnOptions, "cwd">): Promise<Handle> {
    const spawn = await taskProcessReadLease(identity.taskID)
    try {
      const execution = await resolveTaskProcessExecution(identity)
      const handle = execution.kind === "task_capsule"
        ? await spawnTaskCapsuleCommand({
            command: { executable: opts.shell, args: ["-c", opts.command], env: opts.env },
            capsule: execution.capsule,
            stdin: opts.stdin,
            gracefulTerminationMs: opts.gracefulTerminationMs,
          })
        : await (factory ?? defaultSpawnShell)({ ...opts, cwd: identity.cwd })
      const tracked = trackLiveHandle({ ...opts, cwd: identity.cwd }, handle, identity.taskID)
      spawn.finishRegistration()
      void tracked.exited.finally(() => spawn.lease[Symbol.dispose]()).catch(() => undefined)
      return tracked
    } catch (error) {
      spawn.finishRegistration()
      spawn.lease[Symbol.dispose]()
      throw error
    }
  }

  export async function spawnHostShell(opts: SpawnOptions): Promise<Handle> {
    return trackLiveHandle(opts, await (factory ?? defaultSpawnShell)(opts))
  }

  export async function spawnTaskCommand(
    identity: TaskProcessIdentity,
    opts: Omit<CommandSpawnOptions, "cwd">,
  ): Promise<Handle> {
    if (opts.detached) {
      throw new Error("Task Execution Capsule commands cannot detach from their systemd lifecycle owner")
    }
    const spawn = await taskProcessReadLease(identity.taskID)
    try {
      const execution = await resolveTaskProcessExecution(identity)
      const handle = execution.kind === "task_capsule"
        ? await spawnTaskCapsuleCommand({
            command: { executable: opts.executable, args: opts.args, env: opts.env },
            capsule: execution.capsule,
            stdin: opts.stdin,
            gracefulTerminationMs: opts.gracefulTerminationMs,
          })
        : await (commandFactory ?? defaultSpawnCommand)({ ...opts, cwd: identity.cwd })
      const tracked = trackLiveHandle({ ...opts, cwd: identity.cwd }, handle, identity.taskID)
      spawn.finishRegistration()
      void tracked.exited.finally(() => spawn.lease[Symbol.dispose]()).catch(() => undefined)
      return tracked
    } catch (error) {
      spawn.finishRegistration()
      spawn.lease[Symbol.dispose]()
      throw error
    }
  }

  export async function spawnHostCommand(opts: CommandSpawnOptions): Promise<Handle> {
    return trackLiveHandle(opts, await (commandFactory ?? defaultSpawnCommand)(opts))
  }

  async function runSystemctlStop(input: {
    executable: string
    unitName: string
    env: NodeJS.ProcessEnv
  }): Promise<void> {
    const proc = spawn(input.executable, ["--user", "--quiet", "stop", input.unitName], {
      cwd: "/srv",
      env: input.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    })
    let stderr = ""
    proc.stderr?.setEncoding("utf8")
    proc.stderr?.on("data", (chunk) => {
      stderr += String(chunk)
    })
    const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
      proc.once("error", reject)
      proc.once("exit", (code, signal) => resolve({ code, signal }))
    })
    if (result.code !== 0) {
      throw new Error(
        `Task Capsule unit ${input.unitName} stop failed with code ${result.code ?? "null"}, signal ${result.signal ?? "none"}: ${stderr.trim()}`,
      )
    }
  }

  async function spawnTaskCapsuleCommand(input: {
    command: { executable: string; args: string[]; env?: NodeJS.ProcessEnv }
    capsule: TaskExecutionCapsuleRequest
    stdin?: "ignore" | "pipe"
    gracefulTerminationMs?: number
  }): Promise<Handle> {
    const wrapped = await wrapTaskCapsuleCommand({ capsule: input.capsule, command: input.command })
    const base = await defaultSpawnCommand({
      executable: wrapped.executable,
      args: [...wrapped.args],
      cwd: wrapped.cwd,
      env: wrapped.env,
      stdin: input.stdin,
      gracefulTerminationMs: input.gracefulTerminationMs,
    })
    let settled = false
    void base.exited
      .finally(() => {
        settled = true
        if (wrapped.processFile) void fs.unlink(wrapped.processFile).catch(() => undefined)
      })
      .catch(() => undefined)
    let stop: Promise<void> | undefined
    const stopUnit = () => {
      if (!wrapped.unitName || !wrapped.systemctl) return Promise.resolve()
      if (!stop) {
        stop = runSystemctlStop({ executable: wrapped.systemctl, unitName: wrapped.unitName, env: wrapped.env })
      }
      return stop
    }
    return {
      ...base,
      terminate: async () => {
        if (!settled) {
          try {
            await stopUnit()
          } catch (error) {
            if (!settled) throw error
          }
        }
        await base.terminate()
      },
      dispose: async () => {
        if (!settled) await stopUnit()
        await base.dispose()
      },
    }
  }

  export async function disposeLiveProcessesUnder(directory: string): Promise<{ disposed: number; pids: number[] }> {
    const target = normalizeCwd(directory)
    const matches = Array.from(liveHandles.values()).filter(
      (entry) => entry.cwd !== undefined && Filesystem.contains(target, entry.cwd),
    )
    const results = await Promise.allSettled(
      matches.map((entry) => disposeAndWaitForExit(entry.handle, `supervised process ${entry.pid}`)),
    )
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected")
    if (failures.length > 0) {
      throw combineFailures(
        `Failed to dispose ${failures.length}/${matches.length} live supervised process(es) under ${directory}`,
        failures.map((failure) => failure.reason),
      )
    }
    return { disposed: matches.length, pids: matches.map((entry) => entry.pid) }
  }

  async function disposeLiveProcessesForTask(taskID: string): Promise<void> {
    const matches = Array.from(liveHandles.values()).filter((entry) => entry.taskID === taskID)
    const results = await Promise.allSettled(
      matches.map((entry) => disposeAndWaitForExit(entry.handle, `Task ${taskID} supervised process ${entry.pid}`)),
    )
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected")
    if (failures.length > 0) {
      throw combineFailures(
        `Failed to dispose ${failures.length}/${matches.length} Task ${taskID} process(es)`,
        failures.map((failure) => failure.reason),
      )
    }
  }

  export async function withTaskCheckpointLease<T>(taskID: string, run: () => Promise<T>): Promise<T> {
    const reservation = Lock.reserveWrite(taskLeaseKey(taskID))
    try {
      const registrations = taskSpawnRegistrations.get(taskID)
      if (registrations) await Promise.all([...registrations])
      await disposeLiveProcessesForTask(taskID)
      await disposeTaskExecutionCapsule(taskID)
      using lease = await reservation.acquired
      return run()
    } catch (error) {
      reservation.cancel()
      throw error
    }
  }

  export function metricsSnapshot() {
    const owners: Record<string, { count: number; pids: number[] }> = {}
    for (const entry of liveHandles.values()) {
      const current = owners[entry.owner] ?? { count: 0, pids: [] }
      current.count++
      current.pids.push(entry.pid)
      owners[entry.owner] = current
    }
    for (const value of Object.values(owners)) value.pids.sort((a, b) => a - b)
    return { live: liveHandles.size, owners }
  }

  export function setFactoryForTest(next: Factory | undefined) {
    const previous = factory
    factory = next
    return () => {
      factory = previous
    }
  }

  export function setCommandFactoryForTest(next: CommandFactory | undefined) {
    const previous = commandFactory
    commandFactory = next
    return () => {
      commandFactory = previous
    }
  }

  export function setWindowsHelperResolverForTest(next: WindowsHelperResolver | undefined) {
    const previous = windowsHelperBinding
    windowsHelperBinding = { resolver: next }
    return () => {
      windowsHelperBinding = previous
    }
  }

  export function setWindowsOutputObserverForTest(next: WindowsOutputObserver | undefined) {
    const previous = windowsOutputObserver
    windowsOutputObserver = next
    return () => {
      windowsOutputObserver = previous
    }
  }

  export function setPosixProcessSnapshotForTest(next: PosixProcessSnapshot | undefined) {
    const previous = posixProcessSnapshot
    posixProcessSnapshot = next ?? defaultPosixProcessSnapshot
    return () => {
      posixProcessSnapshot = previous
    }
  }

  async function defaultSpawnShell(opts: SpawnOptions): Promise<Handle> {
    if (process.platform === "win32") return await spawnWindowsShell(opts)
    return spawnUnixShell(opts)
  }

  async function defaultSpawnCommand(opts: CommandSpawnOptions): Promise<Handle> {
    if (process.platform === "win32") return await spawnWindowsCommand(opts)
    if (opts.detached) {
      const proc = spawn(opts.executable, opts.args, {
        cwd: opts.cwd,
        env: opts.env,
        shell: false,
        stdio: [opts.stdin ?? "ignore", "pipe", "pipe"],
        detached: true,
        windowsHide: true,
      })
      return await initializedChildHandle(proc, `Detached command process '${opts.executable}'`, {
        cleanupProcessGroup: false,
        gracefulTerminationMs: opts.gracefulTerminationMs,
      })
    }
    return spawnUnixCommand(opts)
  }

  function normalizeCwd(cwd: string) {
    return path.resolve(Filesystem.windowsPath(cwd))
  }

  function trackLiveHandle(
    opts: { cwd?: string; owner?: string; detached?: boolean },
    handle: Handle,
    taskID?: string,
  ): Handle {
    const id = nextLiveHandleID++
    const cwd = opts.cwd ? normalizeCwd(opts.cwd) : undefined
    const owner = opts.owner?.trim() || "unclassified"
    let unregistered = false
    const unregister = () => {
      if (unregistered) return
      unregistered = true
      liveHandles.delete(id)
    }
    const tracked: Handle = {
      pid: handle.pid,
      stdin: handle.stdin,
      stdout: handle.stdout,
      stderr: handle.stderr,
      exited: handle.exited,
      terminate: () => handle.terminate(),
      dispose: async () => {
        await handle.dispose()
        unregister()
      },
      unref: () => {
        handle.unref()
        if (opts.detached) unregister()
      },
    }
    liveHandles.set(id, { id, pid: handle.pid, cwd, owner, taskID, handle: tracked })
    void handle.exited.finally(unregister).catch(() => undefined)
    return tracked
  }

  export async function awaitWithTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error(message)), timeoutMs)
        }),
      ])
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  export async function terminateAndWaitForExit(
    handle: Handle,
    label: string,
    opts: { cleanupTimeoutMs?: number; exitTimeoutMs?: number } = {},
  ): Promise<number> {
    const cleanupTimeoutMs = opts.cleanupTimeoutMs ?? TERMINATION_CLEANUP_TIMEOUT_MS
    const exitTimeoutMs = opts.exitTimeoutMs ?? TERMINATION_EXIT_TIMEOUT_MS
    void handle.exited.catch(() => undefined)
    const cleanup = await Promise.allSettled([
      awaitWithTimeout(
        handle.terminate(),
        cleanupTimeoutMs,
        `${label} terminate cleanup did not finish within ${cleanupTimeoutMs}ms`,
      ),
    ]).then(([result]) => result!)
    const exit = await Promise.allSettled([
      awaitWithTimeout(
        handle.exited,
        exitTimeoutMs,
        `${label} terminate cleanup completed but process did not exit within ${exitTimeoutMs}ms`,
      ),
    ]).then(([result]) => result!)
    if (cleanup.status === "rejected" || exit.status === "rejected") {
      const failures = [
        ...(cleanup.status === "rejected" ? [cleanup.reason] : []),
        ...(exit.status === "rejected" ? [exit.reason] : []),
      ]
      throw combineFailures(`${label} termination failed`, failures)
    }
    return exit.value
  }

  export async function disposeAndWaitForExit(
    handle: Handle,
    label: string,
    opts: { cleanupTimeoutMs?: number; exitTimeoutMs?: number } = {},
  ): Promise<number> {
    const cleanupTimeoutMs = opts.cleanupTimeoutMs ?? TERMINATION_CLEANUP_TIMEOUT_MS
    const exitTimeoutMs = opts.exitTimeoutMs ?? TERMINATION_EXIT_TIMEOUT_MS
    void handle.exited.catch(() => undefined)
    const cleanup = await Promise.allSettled([
      awaitWithTimeout(
        handle.dispose(),
        cleanupTimeoutMs,
        `${label} dispose cleanup did not finish within ${cleanupTimeoutMs}ms`,
      ),
    ]).then(([result]) => result!)
    const exit = await Promise.allSettled([
      awaitWithTimeout(
        handle.exited,
        exitTimeoutMs,
        `${label} dispose cleanup completed but process did not exit within ${exitTimeoutMs}ms`,
      ),
    ]).then(([result]) => result!)
    if (cleanup.status === "rejected" || exit.status === "rejected") {
      const failures = [
        ...(cleanup.status === "rejected" ? [cleanup.reason] : []),
        ...(exit.status === "rejected" ? [exit.reason] : []),
      ]
      throw combineFailures(`${label} disposal failed`, failures)
    }
    return exit.value
  }

  export async function terminateProcessTree(pid: number, label = `process ${pid}`): Promise<void> {
    if (!Number.isInteger(pid) || pid <= 0) throw new Error(`${label} has invalid process id ${pid}`)
    if (process.platform === "win32") {
      await terminateWindowsProcessTree(pid, label)
      return
    }
    await terminatePosixProcessGroup(pid, label)
  }

  export async function terminateProcessGroup(pid: number, label = `process group ${pid}`): Promise<void> {
    if (!Number.isInteger(pid) || pid <= 0) throw new Error(`${label} has invalid process group id ${pid}`)
    if (process.platform === "win32") {
      await terminateWindowsProcessTree(pid, label)
      return
    }
    await terminatePosixProcessGroup(pid, label)
  }

  /**
   * Terminate a directly owned POSIX child gracefully before escalating to its
   * snapshotted descendants. macOS may reject an app's group-wide signal even
   * though it can signal each owned process; PID and PPID plus the root's PGID
   * preserve ownership after the root exits and its descendants are reparented.
   */
  export async function terminateOwnedChildProcessTree(
    proc: ChildProcess,
    label: string,
    opts: { gracefulTimeoutMs?: number } = {},
  ): Promise<void> {
    const pid = proc.pid
    if (!pid) return
    if (process.platform === "win32") {
      await terminateWindowsProcessTree(pid, label)
      return
    }

    const gracefulTimeoutMs = opts.gracefulTimeoutMs ?? TERMINATION_EXIT_TIMEOUT_MS
    const ownedPids = ownedPosixProcessIDs(pid)
    if (proc.exitCode === null && proc.signalCode === null) {
      try {
        proc.kill("SIGTERM")
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error
      }
      await waitForOwnedChildExit(proc, gracefulTimeoutMs)
    }
    for (const ownedPid of ownedPosixProcessIDs(pid)) ownedPids.add(ownedPid)
    await terminateOwnedPosixProcessIDs(ownedPids, label)
  }

  type PosixProcessIdentity = {
    pid: number
    ppid: number
    pgid: number
  }

  function defaultPosixProcessSnapshot(): PosixProcessSnapshotResult {
    const result = spawnSync("ps", ["-axo", "pid=,ppid=,pgid="], {
      encoding: "utf8",
    })
    return {
      error: result.error,
      status: result.status,
      signal: result.signal,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    }
  }

  function posixProcessIdentities(): PosixProcessIdentity[] {
    const failures: string[] = []
    let stdout: string | undefined
    for (let attempt = 1; attempt <= 2; attempt++) {
      const result = posixProcessSnapshot()
      if (!result.error && result.status === 0) {
        stdout = result.stdout
        break
      }
      failures.push(
        `attempt ${attempt}: ${result.error?.message ?? `exit=${result.status}, signal=${result.signal ?? "none"}`}` +
          `${result.stderr.trim() ? `, stderr=${result.stderr.trim()}` : ""}`,
      )
    }
    if (stdout === undefined) {
      throw new Error(`Failed to inspect owned POSIX process descendants after 2 attempts: ${failures.join("; ")}`)
    }
    const identities: PosixProcessIdentity[] = []
    for (const line of stdout.split(/\r?\n/)) {
      const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s*$/)
      if (!match) continue
      identities.push({
        pid: Number(match[1]),
        ppid: Number(match[2]),
        pgid: Number(match[3]),
      })
    }
    return identities
  }

  function ownedPosixProcessIDs(rootPid: number): Set<number> {
    const rows = posixProcessIdentities()
    const owned = new Set<number>([rootPid])
    let changed = true
    while (changed) {
      changed = false
      for (const row of rows) {
        if (owned.has(row.pid) || !owned.has(row.ppid)) continue
        owned.add(row.pid)
        changed = true
      }
    }
    for (const row of rows) {
      if (row.pgid === rootPid) owned.add(row.pid)
    }
    return owned
  }

  function posixProcessIsRunning(pid: number): boolean {
    try {
      process.kill(pid, 0)
      return true
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === "ESRCH") return false
      return code === "EPERM"
    }
  }

  function signalOwnedPosixProcess(pid: number, signal: NodeJS.Signals, label: string) {
    try {
      process.kill(pid, signal)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ESRCH") return
      throw new Error(`${label} could not send ${signal} to owned process ${pid}: ${errorMessage(error)}`, {
        cause: error,
      })
    }
  }

  async function waitForOwnedPosixProcessIDs(pids: readonly number[], timeoutMs: number): Promise<number[]> {
    const deadline = Date.now() + timeoutMs
    let running = pids.filter(posixProcessIsRunning)
    while (running.length > 0 && Date.now() < deadline) {
      await Bun.sleep(Math.min(25, Math.max(1, deadline - Date.now())))
      running = running.filter(posixProcessIsRunning)
    }
    return running
  }

  async function terminateOwnedPosixProcessIDs(ownedPids: ReadonlySet<number>, label: string) {
    const candidates = [...ownedPids].filter((pid) => pid !== process.pid && posixProcessIsRunning(pid))
    for (const pid of candidates) signalOwnedPosixProcess(pid, "SIGTERM", label)
    const afterTerm = await waitForOwnedPosixProcessIDs(candidates, SIGKILL_TIMEOUT_MS)
    for (const pid of afterTerm) signalOwnedPosixProcess(pid, "SIGKILL", label)
    const afterKill = await waitForOwnedPosixProcessIDs(afterTerm, SIGKILL_TIMEOUT_MS)
    if (afterKill.length > 0) {
      throw new Error(`${label} left owned process IDs alive after SIGKILL: ${afterKill.join(", ")}`)
    }
  }

  function childSpawnFailure(proc: ChildProcess, label: string): Promise<unknown> {
    return new Promise((resolve) => {
      proc.once("error", resolve)
      proc.once("close", (code, signal) => {
        resolve(new Error(`${label} closed without a process id (exit=${code}, signal=${signal})`))
      })
    })
  }

  async function initializedChildHandle(
    proc: ChildProcess,
    label: string,
    opts: { cleanupProcessGroup: boolean; gracefulTerminationMs?: number },
  ): Promise<Handle> {
    if (!proc.pid) throw await childSpawnFailure(proc, label)
    return childHandle(proc, opts)
  }

  async function spawnUnixShell(opts: SpawnOptions): Promise<Handle> {
    const proc = spawn(opts.command, {
      shell: opts.shell,
      cwd: opts.cwd,
      env: opts.env,
      stdio: [opts.stdin ?? "ignore", "pipe", "pipe"],
      detached: true,
    })
    return await initializedChildHandle(proc, `Shell process '${opts.command}'`, {
      cleanupProcessGroup: true,
      gracefulTerminationMs: opts.gracefulTerminationMs,
    })
  }

  async function spawnUnixCommand(opts: CommandSpawnOptions): Promise<Handle> {
    const proc = spawn(opts.executable, opts.args, {
      cwd: opts.cwd,
      env: opts.env,
      shell: false,
      stdio: [opts.stdin ?? "ignore", "pipe", "pipe"],
      detached: true,
    })
    return await initializedChildHandle(proc, `Command process '${opts.executable}'`, {
      cleanupProcessGroup: true,
      gracefulTerminationMs: opts.gracefulTerminationMs,
    })
  }

  async function spawnWindowsShell(opts: SpawnOptions): Promise<Handle> {
    return await spawnWindowsRequest({
      label: opts.command,
      stdin: opts.stdin,
      request: (readyPath, requestID) => ({
        kind: "shell",
        command: opts.command,
        shell: opts.shell,
        cwd: opts.cwd,
        env: opts.env ?? process.env,
        ready_file: readyPath,
        request_id: requestID,
      }),
    })
  }

  async function spawnWindowsCommand(opts: CommandSpawnOptions): Promise<Handle> {
    const env = opts.env ?? process.env
    const executable = resolveWindowsCommandExecutable(opts.executable, env)
    return await spawnWindowsRequest({
      label: executable,
      stdin: opts.stdin,
      request: (readyPath, requestID) => ({
        kind: "command",
        executable,
        args: opts.args,
        detached: opts.detached ?? false,
        cwd: opts.cwd,
        env,
        ready_file: readyPath,
        request_id: requestID,
      }),
    })
  }

  function resolveWindowsCommandExecutable(executable: string, env: NodeJS.ProcessEnv): string {
    if (path.isAbsolute(executable) || executable.includes("/") || executable.includes("\\")) return executable
    const resolved = which(executable, env)
    if (!resolved) throw new Error(`Windows command executable "${executable}" was not found in PATH`)
    return resolved
  }

  async function spawnWindowsRequest(opts: {
    label: string
    stdin?: "ignore" | "pipe"
    request: (readyPath: string, requestID: string) => Record<string, unknown>
  }): Promise<Handle> {
    const helper = await resolveWindowsHelper()
    if (!helper) {
      throw new Error("Windows process supervisor helper is required for process-tree cleanup")
    }
    const requestDir = await Global.createTemporaryDirectory("supervisor-")
    const requestPath = path.join(requestDir, "request.json")
    const readyPath = path.join(requestDir, "ready.json")
    const requestID = randomUUID()
    try {
      await fs.writeFile(requestPath, JSON.stringify(opts.request(readyPath, requestID)), "utf8")
    } catch (error) {
      await rethrowWithCleanup(error, "Windows process supervisor request creation and cleanup failed", [
        () => fs.rm(requestDir, { recursive: true, force: true }),
      ])
    }
    let proc: ChildProcess
    try {
      proc = spawn(helper, ["--request", requestPath], {
        stdio: [opts.stdin ?? "ignore", "pipe", "pipe"],
        windowsHide: true,
      })
    } catch (error) {
      return await rethrowWithCleanup(error, "Windows process supervisor spawn and request cleanup failed", [
        () => fs.rm(requestDir, { recursive: true, force: true }),
      ])
    }
    if (!proc.pid) {
      const spawnFailure = await childSpawnFailure(proc, "Windows process supervisor helper")
      return await rethrowWithCleanup(spawnFailure, "Windows process supervisor spawn and request cleanup failed", [
        () => fs.rm(requestDir, { recursive: true, force: true }),
      ])
    }
    const helperHandle = childHandle(proc, { cleanupProcessGroup: false })
    const helperStdout = proc.stdout
    const helperStderr = proc.stderr
    if (!helperStdout || !helperStderr) {
      return await rethrowWithCleanup(
        new Error("Windows process supervisor did not expose stdout/stderr pipes"),
        "Windows process supervisor pipe validation and cleanup failed",
        [() => helperHandle.dispose(), () => fs.rm(requestDir, { recursive: true, force: true })],
      )
    }
    const stdout = new PassThrough()
    const stderr = new PassThrough()
    const outputFailures: Error[] = []
    const observedOutputErrors = new Set<unknown>()
    const recordOutputFailure = (channel: string, error: unknown) => {
      if (observedOutputErrors.has(error)) return
      observedOutputErrors.add(error)
      outputFailures.push(
        new Error(`Windows process supervisor ${channel} stream failed: ${errorMessage(error)}`, { cause: error }),
      )
    }
    const forwardSourceFailure = (channel: string, destination: PassThrough) => (error: unknown) => {
      const failure =
        error instanceof Error
          ? error
          : new Error(`Windows process supervisor ${channel} stream failed: ${errorMessage(error)}`)
      recordOutputFailure(channel, failure)
      destination.destroy(failure)
    }
    stdout.on("error", (error) => recordOutputFailure("stdout", error))
    stderr.on("error", (error) => recordOutputFailure("stderr", error))
    helperStdout.on("error", forwardSourceFailure("stdout", stdout))
    helperStderr.on("error", forwardSourceFailure("stderr", stderr))
    const startupStdout: Buffer[] = []
    const startupStderr: Buffer[] = []
    const captureStdout = (chunk: Buffer | string) => {
      startupStdout.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    const captureStderr = (chunk: Buffer | string) => {
      startupStderr.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    const detachStartupCapture = () => {
      helperStdout.removeListener("data", captureStdout)
      helperStderr.removeListener("data", captureStderr)
    }
    const startupDetails = () =>
      [Buffer.concat(startupStderr).toString().trim(), Buffer.concat(startupStdout).toString().trim()]
        .filter(Boolean)
        .join("\n")
    helperStdout.on("data", captureStdout)
    helperStderr.on("data", captureStderr)
    helperStdout.pipe(stdout)
    helperStderr.pipe(stderr)
    let pid: number
    try {
      windowsOutputObserver?.(helperStdout, helperStderr)
      pid = await waitForReadyMarker({
        readyPath,
        requestID,
        helperPID: helperHandle.pid,
        helperPath: helper,
        exited: helperHandle.exited,
        command: opts.label,
        startupDetails,
        outputFailures: () => outputFailures,
      })
    } catch (error) {
      try {
        await rethrowWithCleanup(error, "Windows process supervisor startup and cleanup failed", [
          () =>
            disposeAndWaitForExit(helperHandle, "Windows process supervisor startup helper", {
              cleanupTimeoutMs: TERMINATION_CLEANUP_TIMEOUT_MS,
              exitTimeoutMs: TERMINATION_EXIT_TIMEOUT_MS,
            }),
          () => fs.rm(requestDir, { recursive: true, force: true }),
        ])
      } finally {
        detachStartupCapture()
      }
      throw error
    }
    detachStartupCapture()

    let helperExited = false
    const helperExitOutcome = helperHandle.exited.then(
      (code) => {
        helperExited = true
        return { code } as const
      },
      (error) => {
        helperExited = true
        return { error } as const
      },
    )
    const exited = helperExitOutcome.then((outcome) => {
      const failures = [...outputFailures]
      if ("error" in outcome) {
        failures.unshift(outcome.error)
      } else if (failures.length === 0) {
        return outcome.code
      }
      if (failures.length === 1) throw failures[0]
      throw new AggregateError(failures, "Windows process supervisor process and output streams failed")
    })
    // Consumers still observe the original rejected promise; this attachment
    // prevents an early process or stream rejection from becoming unhandled.
    void exited.catch(() => undefined)

    let requestCleanupComplete = false
    let requestCleanupAttempt: Promise<void> | undefined
    const cleanupRequestDirectory = () => {
      if (requestCleanupComplete) return Promise.resolve()
      if (requestCleanupAttempt) return requestCleanupAttempt
      const attempt = fs.rm(requestDir, { recursive: true, force: true }).then(() => {
        requestCleanupComplete = true
      })
      requestCleanupAttempt = attempt
      void attempt.catch(() => {
        if (requestCleanupAttempt === attempt) requestCleanupAttempt = undefined
      })
      return attempt
    }

    let termination: Promise<void> | undefined
    const terminate = () => {
      if (termination) return termination
      const attempt = (async () => {
        if (helperExited) return
        await helperHandle.terminate()
      })()
      termination = attempt
      void attempt.catch(() => {
        if (termination === attempt) termination = undefined
      })
      return attempt
    }

    let disposal: Promise<void> | undefined
    const dispose = () => {
      if (disposal) return disposal
      const attempt = (async () => {
        const helperResult = await Promise.allSettled([helperHandle.dispose()]).then(([result]) => result!)
        const cleanupResult =
          helperResult.status === "fulfilled" || helperExited
            ? await Promise.allSettled([cleanupRequestDirectory()]).then(([result]) => result!)
            : undefined
        const failures = [
          ...(helperResult.status === "rejected" ? [helperResult.reason] : []),
          ...(cleanupResult?.status === "rejected" ? [cleanupResult.reason] : []),
        ]
        if (failures.length === 1) throw failures[0]
        if (failures.length > 1) {
          throw new AggregateError(failures, "Windows process supervisor disposal and request cleanup failed")
        }
      })()
      disposal = attempt
      void attempt.catch(() => {
        if (disposal === attempt) disposal = undefined
      })
      return attempt
    }

    return {
      ...helperHandle,
      pid,
      stdout,
      stderr,
      exited,
      terminate,
      dispose,
    }
  }

  function childHandle(
    proc: ChildProcess,
    opts: { cleanupProcessGroup: boolean; gracefulTerminationMs?: number },
  ): Handle {
    if (!proc.pid) throw new Error("Process supervisor child has no pid")
    let disposal: Promise<void> | undefined
    let termination: Promise<void> | undefined
    let settled = false
    let exitCode: number | null = null
    let exitSignal: NodeJS.Signals | null = null
    const exited = new Promise<number>((resolve, reject) => {
      proc.once("exit", (code, signal) => {
        settled = true
        exitCode = code
        exitSignal = signal
      })
      proc.once("close", (code, signal) => {
        settled = true
        resolve(code ?? exitCode ?? (signal || exitSignal ? 1 : 0))
      })
      proc.once("error", (error) => {
        settled = true
        reject(error)
      })
    })

    const terminate = () => {
      if (termination) return termination
      const attempt = (async () => {
        if (opts.cleanupProcessGroup) {
          await terminateOwnedChildProcessTree(proc, `process group ${proc.pid}`, {
            gracefulTimeoutMs: opts.gracefulTerminationMs,
          })
          return
        }
        if (!settled && proc.exitCode === null && proc.signalCode === null) {
          proc.kill("SIGTERM")
          await Bun.sleep(SIGKILL_TIMEOUT_MS)
          if (!settled && proc.exitCode === null && proc.signalCode === null) {
            proc.kill("SIGKILL")
          }
        }
      })()
      termination = attempt
      void attempt.catch(() => {
        if (termination === attempt) termination = undefined
      })
      return attempt
    }

    const dispose = () => {
      if (disposal) return disposal
      const attempt = (async () => {
        await terminate()
        await exited
      })()
      disposal = attempt
      void attempt.catch(() => {
        if (disposal === attempt) disposal = undefined
      })
      return attempt
    }

    return {
      pid: proc.pid,
      stdin: proc.stdin,
      stdout: proc.stdout,
      stderr: proc.stderr,
      exited,
      terminate,
      dispose,
      unref() {
        proc.unref?.()
        ;(proc.stdout as unknown as { unref?: () => void } | null)?.unref?.()
        ;(proc.stderr as unknown as { unref?: () => void } | null)?.unref?.()
      },
    }
  }

  function processGroupIsRunning(pid: number) {
    try {
      process.kill(-pid, 0)
      return true
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === "ESRCH") return false
      return code === "EPERM"
    }
  }

  async function waitForOwnedChildExit(proc: ChildProcess, timeoutMs: number): Promise<boolean> {
    if (proc.exitCode !== null || proc.signalCode !== null) return true
    return await new Promise<boolean>((resolve) => {
      let settled = false
      const finish = (value: boolean) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        proc.off("exit", onExit)
        proc.off("close", onExit)
        resolve(value)
      }
      const onExit = () => finish(true)
      const timer = setTimeout(() => finish(false), timeoutMs)
      timer.unref()
      proc.once("exit", onExit)
      proc.once("close", onExit)
    })
  }

  function signalProcessGroupIfRunning(pid: number, signal: NodeJS.Signals) {
    try {
      process.kill(-pid, signal)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ESRCH") return
      throw error
    }
  }

  async function terminatePosixProcessGroup(pid: number, label: string) {
    if (!processGroupIsRunning(pid)) return
    signalProcessGroupIfRunning(pid, "SIGTERM")
    await Bun.sleep(SIGKILL_TIMEOUT_MS)
    if (processGroupIsRunning(pid)) signalProcessGroupIfRunning(pid, "SIGKILL")
    await Bun.sleep(SIGKILL_TIMEOUT_MS)
    if (processGroupIsRunning(pid)) throw new Error(`${label} did not exit after SIGKILL`)
  }

  async function terminateWindowsProcessTree(pid: number, label: string) {
    const helper = await resolveWindowsHelper()
    if (!helper) {
      throw new Error("Windows process supervisor helper is required for process-tree cleanup")
    }
    await runWindowsProcessTreeCleanup(helper, pid, label)
  }

  async function runWindowsProcessTreeCleanup(helper: string, pid: number, label: string) {
    const proc = spawn(helper, ["--kill-tree", String(pid)], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    })
    let stdout = ""
    let stderr = ""
    proc.stdout?.setEncoding("utf8")
    proc.stderr?.setEncoding("utf8")
    proc.stdout?.on("data", (chunk) => {
      stdout += chunk
    })
    proc.stderr?.on("data", (chunk) => {
      stderr += chunk
    })

    let exitCode: number | null = null
    let exitSignal: NodeJS.Signals | null = null
    const exited = new Promise<number>((resolve, reject) => {
      proc.once("exit", (code, signal) => {
        exitCode = code
        exitSignal = signal
      })
      proc.once("close", (code, signal) => resolve(code ?? exitCode ?? (signal || exitSignal ? 1 : 0)))
      proc.once("error", reject)
    })
    try {
      const code = await awaitWithTimeout(
        exited,
        TERMINATION_CLEANUP_TIMEOUT_MS,
        `${label} Windows process tree cleanup timed out after ${TERMINATION_CLEANUP_TIMEOUT_MS}ms`,
      )
      if (code !== 0) {
        const detail = [stderr, stdout].filter(Boolean).join("\n").trim()
        throw new Error(detail || `${label} Windows process tree cleanup failed with exit code ${code}`)
      }
    } catch (error) {
      void exited.catch(() => undefined)
      proc.kill("SIGKILL")
      proc.stdout?.destroy()
      proc.stderr?.destroy()
      proc.unref()
      throw error
    }
  }

  type WindowsReadyMarker = {
    protocol: 1
    request_id: string
    helper_pid: number
    target_pid: number
  }

  function parseWindowsReadyMarker(input: { text: string; requestID: string; helperPID: number }): WindowsReadyMarker {
    let value: unknown
    try {
      value = JSON.parse(input.text)
    } catch (error) {
      throw new Error(`Windows process supervisor ready marker is not valid JSON: ${errorMessage(error)}`)
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Windows process supervisor ready marker must be an object")
    }
    const marker = value as Record<string, unknown>
    const keys = Object.keys(marker).sort()
    const expectedKeys = ["helper_pid", "protocol", "request_id", "target_pid"]
    if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
      throw new Error("Windows process supervisor ready marker has unexpected fields")
    }
    if (marker.protocol !== 1) throw new Error("Windows process supervisor ready marker has invalid protocol")
    if (marker.request_id !== input.requestID) {
      throw new Error("Windows process supervisor ready marker request identity does not match")
    }
    if (marker.helper_pid !== input.helperPID) {
      throw new Error("Windows process supervisor ready marker helper process identity does not match")
    }
    if (!Number.isInteger(marker.target_pid) || (marker.target_pid as number) <= 0) {
      throw new Error("Windows process supervisor ready marker has invalid target process id")
    }
    return marker as WindowsReadyMarker
  }

  async function waitForReadyMarker(input: {
    readyPath: string
    requestID: string
    helperPID: number
    helperPath: string
    exited: Promise<number>
    command: string
    startupDetails: () => string
    outputFailures: () => readonly Error[]
  }): Promise<number> {
    const deadline = Date.now() + 5_000
    const startupIdentity = `request_id=${input.requestID} helper_pid=${input.helperPID} helper_path=${input.helperPath} ready_path=${input.readyPath}`
    let exitCode: number | undefined
    let exitError: unknown
    let exitObserved = false
    input.exited
      .then((code) => {
        exitCode = code
        exitObserved = true
      })
      .catch((error) => {
        exitError = error
        exitObserved = true
      })
    const readReadyMarker = async () => {
      try {
        const text = await fs.readFile(input.readyPath, "utf8")
        return parseWindowsReadyMarker({ text, requestID: input.requestID, helperPID: input.helperPID })
      } catch (error) {
        if (errorCode(error) === "ENOENT") return undefined
        throw error
      }
    }
    const throwStreamFailures = () => {
      const streamFailures = input.outputFailures()
      if (streamFailures.length === 1) throw streamFailures[0]
      if (streamFailures.length > 1) {
        throw new AggregateError(streamFailures, "Windows process supervisor output streams failed during startup")
      }
    }
    while (Date.now() < deadline) {
      throwStreamFailures()
      const marker = await readReadyMarker()
      if (marker) return marker.target_pid
      await Bun.sleep(20)
    }
    throwStreamFailures()
    const finalMarker = await readReadyMarker()
    if (finalMarker) return finalMarker.target_pid
    const detail = input.startupDetails()
    const suffix = detail ? `\n${detail}` : ""
    if (exitObserved) {
      if (exitError) {
        throw new Error(
          `Windows process supervisor failed before publishing readiness for command '${input.command}' (${startupIdentity}): ${errorMessage(exitError)}${suffix}`,
        )
      }
      throw new Error(
        `Windows process supervisor exited before publishing readiness for command '${input.command}' (exit=${exitCode}; ${startupIdentity})${suffix}`,
      )
    }
    throw new Error(
      `Windows process supervisor did not publish readiness for command '${input.command}' (${startupIdentity})${suffix}`,
    )
  }

  async function resolveWindowsHelper(): Promise<string | undefined> {
    const binding = windowsHelperBinding
    if (binding.path) return binding.path
    const resolution = binding.resolution ?? resolveWindowsHelperUnbound(binding.resolver)
    binding.resolution = resolution
    try {
      const helper = await resolution
      if (helper) binding.path = helper
      return helper
    } finally {
      if (binding.resolution === resolution) binding.resolution = undefined
    }
  }

  async function resolveWindowsHelperUnbound(resolver: WindowsHelperResolver | undefined): Promise<string | undefined> {
    if (resolver) return await resolver()

    const envPath = process.env.OPENCORVUS_PROCESS_SUPERVISOR
    if (envPath && Filesystem.stat(envPath)?.size) return envPath

    const execDir = path.dirname(process.execPath)
    const packagedCandidates = [
      path.join(execDir, exe),
      path.join(execDir, "bin", exe),
      path.join(path.dirname(execDir), exe),
      path.join(path.dirname(execDir), "bin", exe),
    ]
    for (const candidate of packagedCandidates) {
      if (Filesystem.stat(candidate)?.size) return candidate
    }

    const manifest = path.resolve(import.meta.dir, "../../native/process-supervisor/Cargo.toml")
    const localCandidates = [
      path.resolve(import.meta.dir, "../../native/process-supervisor/target/debug", exe),
      path.resolve(import.meta.dir, "../../native/process-supervisor/target/release", exe),
    ]
    for (const candidate of localCandidates) {
      if (Filesystem.stat(candidate)?.size) return candidate
    }

    return buildLocalWindowsHelper(manifest)
  }

  const exe = "opencorvus-process-supervisor.exe"

  function buildLocalWindowsHelper(manifest: string): string {
    if (!Filesystem.stat(manifest)?.size) {
      throw new Error(`Windows process supervisor source manifest is missing: ${manifest}`)
    }
    const cargo = which("cargo")
    if (!cargo) throw new Error("Cargo is required to build the Windows process supervisor helper")
    const result = spawnSync(cargo, ["build", "--manifest-path", manifest], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    })
    if (result.error) {
      throw new Error(`Failed to start Cargo for the Windows process supervisor helper: ${result.error.message}`, {
        cause: result.error,
      })
    }
    if (result.status !== 0) {
      const details = [result.stderr, result.stdout]
        .map((value) => value?.trim())
        .filter(Boolean)
        .join("\n")
      throw new Error(
        `Cargo failed to build the Windows process supervisor helper (exit=${result.status}, signal=${result.signal})${
          details ? `\n${details}` : ""
        }`,
      )
    }
    const debug = path.resolve(import.meta.dir, "../../native/process-supervisor/target/debug", exe)
    if (!Filesystem.stat(debug)?.size) {
      throw new Error(`Cargo completed without producing the Windows process supervisor helper: ${debug}`)
    }
    return debug
  }
}
