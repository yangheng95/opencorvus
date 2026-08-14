import { spawn, spawnSync, type ChildProcess } from "child_process"
import { createHash, randomUUID } from "crypto"
import fs from "fs/promises"
import { readFileSync } from "node:fs"
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
import { awaitWithAbort } from "@/util/abort"
import { RuntimeServerOwnership } from "@/server/runtime-server-ownership"
import type { RuntimeProcessOccurrenceObserver } from "@/server/runtime-server-ownership"

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
  export type TaskCancellationRole = "mandatory" | "auxiliary"

  export interface SpawnOptions {
    command: string
    shell: string
    cwd?: string
    env?: NodeJS.ProcessEnv
    stdin?: "ignore" | "pipe"
    gracefulTerminationMs?: number
    owner?: string
    taskCancellationRole?: TaskCancellationRole
    signal?: AbortSignal
    deadlineAt?: number
  }

  export interface CommandSpawnOptions {
    executable: string
    args: string[]
    cwd?: string
    env?: NodeJS.ProcessEnv
    stdin?: "ignore" | "pipe"
    gracefulTerminationMs?: number
    owner?: string
    taskCancellationRole?: TaskCancellationRole
    signal?: AbortSignal
    deadlineAt?: number
    /** Launch a replacement process outside the current supervisor's native cleanup job. */
    detached?: boolean
  }

  export type TaskProcessIdentity = Readonly<{ taskID: string; cwd: string }>

  export interface Handle {
    pid: number
    stdin: NodeJS.WritableStream | null
    stdout: NodeJS.ReadableStream | null
    stderr: NodeJS.ReadableStream | null
    /** Physical process exit. Output collectors must separately await outputSettled. */
    exited: Promise<number>
    /** Completion of stdout/stderr delivery after physical exit. */
    outputSettled?: Promise<void>
    /** One authoritative settlement: physical exit, output closure, and
     * supervisor-owned request cleanup. */
    settled?: Promise<void>
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

  async function joinPhysicalAndOutputSettlement(handle: Pick<Handle, "exited" | "outputSettled">): Promise<void> {
    const [physical, output] = await Promise.allSettled([
      handle.exited.then(() => undefined),
      handle.outputSettled ?? Promise.resolve(),
    ])
    const failures = [
      ...(physical.status === "rejected" ? [physical.reason] : []),
      ...(output.status === "rejected" ? [output.reason] : []),
    ]
    if (failures.length > 0) throw combineFailures("Process physical/output settlement failed", failures)
  }

  async function waitForOwnedPhysicalSettlement(handle: Handle): Promise<void> {
    await handle.exited
    await Promise.allSettled([handle.settled ?? joinPhysicalAndOutputSettlement(handle)])
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
  type WindowsRequestObserver = (request: Readonly<Record<string, unknown>>) => void
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
    taskCancellationRole: TaskCancellationRole
    handle: Handle
  }

  let factory: Factory | undefined
  let commandFactory: CommandFactory | undefined
  let windowsHelperBinding: WindowsHelperBinding = {}
  let windowsOutputObserver: WindowsOutputObserver | undefined
  let windowsRequestObserver: WindowsRequestObserver | undefined
  let posixProcessSnapshot: PosixProcessSnapshot = defaultPosixProcessSnapshot
  let nextLiveHandleID = 1
  const liveHandles = new Map<number, LiveHandle>()
  const taskSpawnRegistrations = new Map<string, Set<Promise<void>>>()
  const taskLeaseKey = (taskID: string, role: TaskCancellationRole) => `task-process:${taskID}:${role}`
  const RUNTIME_MANDATORY_SPAWN_LEASE_KEY = "runtime-task-process:mandatory"

  function registerTaskSpawn(leaseKey: string): () => void {
    let settle!: () => void
    const registration = new Promise<void>((resolve) => (settle = resolve))
    const registrations = taskSpawnRegistrations.get(leaseKey) ?? new Set<Promise<void>>()
    registrations.add(registration)
    taskSpawnRegistrations.set(leaseKey, registrations)
    return () => {
      registrations.delete(registration)
      if (registrations.size === 0) taskSpawnRegistrations.delete(leaseKey)
      settle()
    }
  }

  async function taskProcessReadLease(taskID: string, role: TaskCancellationRole) {
    const runtimeAdmission = role === "mandatory" ? await Lock.read(RUNTIME_MANDATORY_SPAWN_LEASE_KEY) : undefined
    let finishRegistration: (() => void) | undefined
    const leaseKey = taskLeaseKey(taskID, role)
    try {
      const lease = await Lock.read(leaseKey, () => {
        finishRegistration = registerTaskSpawn(leaseKey)
      })
      return {
        lease,
        finishRegistration: () => {
          finishRegistration?.()
          runtimeAdmission?.[Symbol.dispose]()
        },
      }
    } catch (error) {
      runtimeAdmission?.[Symbol.dispose]()
      throw error
    }
  }

  export async function spawnTaskShell(
    identity: TaskProcessIdentity,
    opts: Omit<SpawnOptions, "cwd">,
  ): Promise<Handle> {
    const spawn = await taskProcessReadLease(identity.taskID, opts.taskCancellationRole ?? "mandatory")
    try {
      const execution = await resolveTaskProcessExecution(identity)
      const handle =
        execution.kind === "task_capsule"
          ? await spawnTaskCapsuleCommand({
              command: { executable: opts.shell, args: ["-c", opts.command], env: opts.env },
              capsule: execution.capsule,
              stdin: opts.stdin,
              gracefulTerminationMs: opts.gracefulTerminationMs,
            })
          : await (factory ?? defaultSpawnShell)({ ...opts, cwd: identity.cwd })
      const tracked = trackLiveHandle({ ...opts, cwd: identity.cwd }, handle, identity.taskID)
      spawn.finishRegistration()
      void waitForOwnedPhysicalSettlement(tracked)
        .then(() => spawn.lease[Symbol.dispose]())
        .catch(() => undefined)
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
    const spawn = await taskProcessReadLease(identity.taskID, opts.taskCancellationRole ?? "mandatory")
    try {
      const execution = await resolveTaskProcessExecution(identity)
      const handle =
        execution.kind === "task_capsule"
          ? await spawnTaskCapsuleCommand({
              command: { executable: opts.executable, args: opts.args, env: opts.env },
              capsule: execution.capsule,
              stdin: opts.stdin,
              gracefulTerminationMs: opts.gracefulTerminationMs,
            })
          : await (commandFactory ?? defaultSpawnCommand)({ ...opts, cwd: identity.cwd })
      const tracked = trackLiveHandle({ ...opts, cwd: identity.cwd }, handle, identity.taskID)
      spawn.finishRegistration()
      void waitForOwnedPhysicalSettlement(tracked)
        .then(() => spawn.lease[Symbol.dispose]())
        .catch(() => undefined)
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

  async function disposeLiveProcessesForTask(
    taskID: string,
    role?: TaskCancellationRole,
    physicalExitOnly = false,
  ): Promise<void> {
    const matches = Array.from(liveHandles.values()).filter(
      (entry) => entry.taskID === taskID && (role === undefined || entry.taskCancellationRole === role),
    )
    const results = await Promise.allSettled(
      matches.map((entry) =>
        physicalExitOnly
          ? requestDisposeAndWaitForPhysicalExit(entry.handle, `Task ${taskID} supervised process ${entry.pid}`)
          : disposeAndWaitForExit(entry.handle, `Task ${taskID} supervised process ${entry.pid}`),
      ),
    )
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected")
    if (failures.length > 0) {
      throw combineFailures(
        `Failed to dispose ${failures.length}/${matches.length} Task ${taskID} process(es)`,
        failures.map((failure) => failure.reason),
      )
    }
  }

  /** Holds the Task process write lease across the physical stop proof and the
   * terminal commit so no new mutating Task process can enter the gap. */
  export async function withTaskCancellationBarrier<T>(
    taskID: string,
    terminalCommit: () => Promise<T>,
    options?: { signal?: AbortSignal },
  ): Promise<T> {
    options?.signal?.throwIfAborted()
    const leaseKey = taskLeaseKey(taskID, "mandatory")
    const reservation = Lock.reserveWrite(leaseKey)
    try {
      const registrations = taskSpawnRegistrations.get(leaseKey)
      if (registrations) await awaitWithAbort(Promise.all([...registrations]), options?.signal)
      options?.signal?.throwIfAborted()
      await disposeLiveProcessesForTask(taskID, "mandatory", true)
      options?.signal?.throwIfAborted()
      await disposeTaskExecutionCapsule(taskID)
      options?.signal?.throwIfAborted()
      using lease = await awaitWithAbort(reservation.acquired, options?.signal)
      const remaining = Array.from(liveHandles.values()).filter(
        (entry) => entry.taskID === taskID && entry.taskCancellationRole === "mandatory",
      )
      if (remaining.length > 0) {
        throw new Error(`Task ${taskID} still owns ${remaining.length} mandatory process(es) after cancellation stop`)
      }
      options?.signal?.throwIfAborted()
      return await terminalCommit()
    } catch (error) {
      reservation.cancel()
      throw error
    }
  }

  export async function settleTaskAuxiliaryProcesses(
    taskID: string,
    options?: { signal?: AbortSignal },
  ): Promise<void> {
    options?.signal?.throwIfAborted()
    await disposeLiveProcessesForTask(taskID, "auxiliary")
    options?.signal?.throwIfAborted()
  }

  /** Stops every Task-owned mutating process before this backend relinquishes
   * its exclusive database runtime ownership. Prompt/tool settlement runs
   * first, so no new mandatory spawn may be admitted while this proof runs. */
  export async function acquireRuntimeMandatorySettlementGate(): Promise<Disposable> {
    const reservation = Lock.reserveWrite(RUNTIME_MANDATORY_SPAWN_LEASE_KEY)
    let gate: Disposable | undefined
    try {
      gate = await reservation.acquired
      const taskIDs = [
        ...new Set(
          [...liveHandles.values()]
            .filter((entry) => entry.taskID && entry.taskCancellationRole === "mandatory")
            .map((entry) => entry.taskID!),
        ),
      ]
      for (const taskID of taskIDs) await withTaskCancellationBarrier(taskID, async () => undefined)
      const remaining = [...liveHandles.values()].filter(
        (entry) => entry.taskID && entry.taskCancellationRole === "mandatory",
      )
      if (remaining.length > 0) {
        throw new Error(`Runtime still owns ${remaining.length} mandatory Task process(es) after settlement`)
      }
      return gate
    } catch (error) {
      reservation.cancel()
      gate?.[Symbol.dispose]()
      throw error
    }
  }

  export async function withTaskCheckpointLease<T>(taskID: string, run: () => Promise<T>): Promise<T> {
    const mandatoryLeaseKey = taskLeaseKey(taskID, "mandatory")
    const auxiliaryLeaseKey = taskLeaseKey(taskID, "auxiliary")
    const mandatoryReservation = Lock.reserveWrite(mandatoryLeaseKey)
    const auxiliaryReservation = Lock.reserveWrite(auxiliaryLeaseKey)
    try {
      const registrations = [
        ...(taskSpawnRegistrations.get(mandatoryLeaseKey) ?? []),
        ...(taskSpawnRegistrations.get(auxiliaryLeaseKey) ?? []),
      ]
      if (registrations.length > 0) await Promise.all(registrations)
      await disposeLiveProcessesForTask(taskID)
      await disposeTaskExecutionCapsule(taskID)
      using mandatoryLease = await mandatoryReservation.acquired
      using auxiliaryLease = await auxiliaryReservation.acquired
      return run()
    } catch (error) {
      mandatoryReservation.cancel()
      auxiliaryReservation.cancel()
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

  export function taskMetricsSnapshot(taskID: string) {
    const owners: Record<string, { count: number; pids: number[] }> = {}
    for (const entry of liveHandles.values()) {
      if (entry.taskID !== taskID) continue
      const current = owners[entry.owner] ?? { count: 0, pids: [] }
      current.count++
      current.pids.push(entry.pid)
      owners[entry.owner] = current
    }
    for (const value of Object.values(owners)) value.pids.sort((a, b) => a - b)
    return {
      live: Object.values(owners).reduce((total, owner) => total + owner.count, 0),
      owners,
    }
  }

  export type WindowsOrphanRequestRecoveryResult = {
    inspected: number
    removed: number
    retainedCurrent: number
    retainedLive: number
    retainedUnknown: number
  }

  export class WindowsOrphanRequestArtifactUnknownError extends Error {
    override readonly name = "WindowsOrphanRequestArtifactUnknownError"

    constructor(
      readonly requestDirectory: string,
      cause: unknown,
    ) {
      super(`Windows supervisor request artifact cannot be reconciled: ${requestDirectory}: ${errorMessage(cause)}`, {
        cause,
      })
    }
  }

  export class WindowsOrphanRequestRecoveryBlockedError extends AggregateError {
    override readonly name = "WindowsOrphanRequestRecoveryBlockedError"

    constructor(
      errors: WindowsOrphanRequestArtifactUnknownError[],
      readonly result: WindowsOrphanRequestRecoveryResult,
    ) {
      super(errors, `Windows supervisor request recovery retained ${errors.length} unknown artifact occurrence(s)`)
    }
  }

  type DurableWindowsRequest = {
    request_id: string
    ready_file: string
    launch_failed_file: string
    cancel_file: string
    settled_file: string
    owner_pid: number
    owner_process_instance_id: string
    runtime_occurrence_id: string
  }

  function parseDurableWindowsRequest(value: unknown, requestDir: string): DurableWindowsRequest {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`Windows supervisor request is not an object: ${requestDir}`)
    }
    const request = value as Record<string, unknown>
    const kind = request.kind
    const required = [
      "cancel_file",
      "cwd",
      "kind",
      "launch_failed_file",
      "owner_pid",
      "owner_process_instance_id",
      "ready_file",
      "request_id",
      "runtime_occurrence_id",
      "settled_file",
      ...(kind === "shell" ? ["command", "shell"] : kind === "command" ? ["args", "detached", "executable"] : []),
    ].filter((key) => key !== "cwd" || Object.hasOwn(request, "cwd"))
    const keys = Object.keys(request).sort()
    required.sort()
    if (kind !== "shell" && kind !== "command") {
      throw new Error(`Windows supervisor request has unsupported kind: ${requestDir}`)
    }
    if (keys.length !== required.length || keys.some((key, index) => key !== required[index])) {
      throw new Error(`Windows supervisor request has unexpected fields: ${requestDir}`)
    }
    if (
      typeof request.request_id !== "string" ||
      request.request_id.length === 0 ||
      typeof request.owner_process_instance_id !== "string" ||
      request.owner_process_instance_id.length === 0 ||
      typeof request.runtime_occurrence_id !== "string" ||
      request.runtime_occurrence_id.length === 0 ||
      !Number.isInteger(request.owner_pid) ||
      Number(request.owner_pid) <= 0
    ) {
      throw new Error(`Windows supervisor request has invalid owner identity: ${requestDir}`)
    }
    const expectedPaths = {
      ready_file: path.join(requestDir, "ready.json"),
      launch_failed_file: path.join(requestDir, "launch-failed.json"),
      cancel_file: path.join(requestDir, "cancel"),
      settled_file: path.join(requestDir, "settled.json"),
    }
    for (const [field, expected] of Object.entries(expectedPaths)) {
      const actual = request[field]
      if (typeof actual !== "string" || normalizeCwd(actual) !== normalizeCwd(expected)) {
        throw new Error(`Windows supervisor request ${field} is outside its exact request root: ${requestDir}`)
      }
    }
    return request as DurableWindowsRequest
  }

  async function readJsonFile(file: string): Promise<unknown | undefined> {
    try {
      return JSON.parse(await fs.readFile(file, "utf8"))
    } catch (error) {
      if (errorCode(error) === "ENOENT") return undefined
      throw error
    }
  }

  /** Reconcile only exact prior/dead Windows request occurrences. Recovery
   * never targets a numeric PID; it writes the request's own cancel authority
   * and requires the helper's exact active-zero marker before removal. */
  export async function recoverOrphanedWindowsRequests(input: {
    currentOccurrenceID: string
    timeoutMilliseconds?: number
    observeProcessOccurrence?: RuntimeProcessOccurrenceObserver
  }): Promise<WindowsOrphanRequestRecoveryResult> {
    const result: WindowsOrphanRequestRecoveryResult = {
      inspected: 0,
      removed: 0,
      retainedCurrent: 0,
      retainedLive: 0,
      retainedUnknown: 0,
    }
    if (process.platform !== "win32") return result
    const observeProcessOccurrence =
      input.observeProcessOccurrence ?? RuntimeServerOwnership.cachedProcessOccurrenceObserver()
    const unknownArtifacts: WindowsOrphanRequestArtifactUnknownError[] = []
    const entries = await fs.readdir(Global.Path.temporary, { withFileTypes: true }).catch((error) => {
      if (errorCode(error) === "ENOENT") return []
      throw error
    })
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith("supervisor-")) continue
      const requestDir = path.join(Global.Path.temporary, entry.name)
      result.inspected += 1
      try {
        const raw = await readJsonFile(path.join(requestDir, "request.json"))
        if (raw === undefined) throw new Error("request.json is missing")
        const request = parseDurableWindowsRequest(raw, requestDir)
        if (request.runtime_occurrence_id === input.currentOccurrenceID) {
          result.retainedCurrent += 1
          continue
        }
        const observation = observeProcessOccurrence({
          pid: request.owner_pid,
          processInstanceID: request.owner_process_instance_id,
          occurrenceID: request.runtime_occurrence_id,
        })
        if (observation !== "dead_or_reused") {
          result.retainedLive += 1
          continue
        }
        await fs.writeFile(request.cancel_file, request.request_id, "utf8")
        const deadline = Date.now() + (input.timeoutMilliseconds ?? TERMINATION_CLEANUP_TIMEOUT_MS)
        let ready: WindowsReadyMarker | undefined
        let settlement: WindowsSettlementMarker | undefined
        let preTargetSettlement: WindowsPreTargetSettlementMarker | undefined
        while (Date.now() <= deadline) {
          const rawPreTargetSettlement = await readJsonFile(request.launch_failed_file)
          if (rawPreTargetSettlement) {
            const rawReady = await readJsonFile(request.ready_file)
            const rawSettlement = await readJsonFile(request.settled_file)
            if (rawReady || rawSettlement) {
              throw new Error("pre-target settlement marker conflicts with target process markers")
            }
            preTargetSettlement = parseWindowsPreTargetSettlementMarker({
              text: JSON.stringify(rawPreTargetSettlement),
              requestID: request.request_id,
              runtimeOccurrenceID: request.runtime_occurrence_id,
            })
            break
          }
          const rawReady = await readJsonFile(request.ready_file)
          if (rawReady) {
            ready = parseWindowsReadyMarker({
              text: JSON.stringify(rawReady),
              requestID: request.request_id,
              runtimeOccurrenceID: request.runtime_occurrence_id,
            })
            const rawSettlement = await readJsonFile(request.settled_file)
            if (rawSettlement) {
              settlement = parseWindowsSettlementMarker({
                text: JSON.stringify(rawSettlement),
                requestID: request.request_id,
                runtimeOccurrenceID: request.runtime_occurrence_id,
                helperPID: ready.helper_pid,
                targetPID: ready.target_pid,
              })
              break
            }
          }
          await new Promise((resolve) => setTimeout(resolve, 20))
        }
        if (!preTargetSettlement && (!ready || !settlement)) {
          throw new Error(`prior request did not prove active-process-zero within its recovery deadline`)
        }
        await fs.rm(requestDir, { recursive: true, force: true })
        result.removed += 1
      } catch (error) {
        result.retainedUnknown += 1
        unknownArtifacts.push(new WindowsOrphanRequestArtifactUnknownError(requestDir, error))
      }
    }
    if (unknownArtifacts.length > 0) throw new WindowsOrphanRequestRecoveryBlockedError(unknownArtifacts, result)
    return result
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

  export function setWindowsRequestObserverForTest(next: WindowsRequestObserver | undefined) {
    const previous = windowsRequestObserver
    windowsRequestObserver = next
    return () => {
      windowsRequestObserver = previous
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
    opts: { cwd?: string; owner?: string; detached?: boolean; taskCancellationRole?: TaskCancellationRole },
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
    const settled = handle.settled ?? joinPhysicalAndOutputSettlement(handle)
    void settled.catch(() => undefined)
    const tracked: Handle = {
      pid: handle.pid,
      stdin: handle.stdin,
      stdout: handle.stdout,
      stderr: handle.stderr,
      exited: handle.exited,
      outputSettled: handle.outputSettled,
      settled,
      terminate: () => handle.terminate(),
      dispose: async () => {
        await handle.dispose()
      },
      unref: () => {
        handle.unref()
        if (opts.detached) unregister()
      },
    }
    liveHandles.set(id, {
      id,
      pid: handle.pid,
      cwd,
      owner,
      taskID,
      taskCancellationRole: opts.taskCancellationRole ?? "mandatory",
      handle: tracked,
    })
    void waitForOwnedPhysicalSettlement(tracked)
      .then(unregister)
      .catch(() => undefined)
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
    opts: { cleanupTimeoutMs?: number; exitTimeoutMs?: number; deadlineAt?: number } = {},
  ): Promise<number> {
    const remaining = (fallback: number) =>
      opts.deadlineAt === undefined ? fallback : Math.max(1, opts.deadlineAt - Date.now())
    const cleanupTimeoutMs = remaining(opts.cleanupTimeoutMs ?? TERMINATION_CLEANUP_TIMEOUT_MS)
    void handle.exited.catch(() => undefined)
    const cleanup = await Promise.allSettled([
      awaitWithTimeout(
        handle.terminate(),
        cleanupTimeoutMs,
        `${label} terminate cleanup did not finish within ${cleanupTimeoutMs}ms`,
      ),
    ]).then(([result]) => result!)
    const exitTimeoutMs = remaining(opts.exitTimeoutMs ?? TERMINATION_EXIT_TIMEOUT_MS)
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
    opts: { cleanupTimeoutMs?: number; exitTimeoutMs?: number; deadlineAt?: number } = {},
  ): Promise<number> {
    const remaining = (fallback: number) =>
      opts.deadlineAt === undefined ? fallback : Math.max(1, opts.deadlineAt - Date.now())
    const cleanupTimeoutMs = remaining(opts.cleanupTimeoutMs ?? TERMINATION_CLEANUP_TIMEOUT_MS)
    const exitTimeoutMs = remaining(opts.exitTimeoutMs ?? TERMINATION_EXIT_TIMEOUT_MS)
    const [cleanup, exit, output, settlement] = await Promise.allSettled([
      awaitWithTimeout(
        handle.dispose(),
        cleanupTimeoutMs,
        `${label} dispose cleanup did not finish within ${cleanupTimeoutMs}ms`,
      ),
      awaitWithTimeout(
        handle.exited,
        exitTimeoutMs,
        `${label} process did not exit within ${exitTimeoutMs}ms after disposal was requested`,
      ),
      awaitWithTimeout(
        handle.outputSettled ?? handle.exited.then(() => undefined),
        exitTimeoutMs,
        `${label} output did not settle within ${exitTimeoutMs}ms after disposal was requested`,
      ),
      awaitWithTimeout(
        handle.settled ?? joinPhysicalAndOutputSettlement(handle),
        cleanupTimeoutMs,
        `${label} supervisor settlement did not finish within ${cleanupTimeoutMs}ms after disposal was requested`,
      ),
    ])
    if (
      cleanup.status === "rejected" ||
      exit.status === "rejected" ||
      output.status === "rejected" ||
      settlement.status === "rejected"
    ) {
      throw combineFailures(`${label} disposal failed`, [
        ...(cleanup.status === "rejected" ? [cleanup.reason] : []),
        ...(exit.status === "rejected" ? [exit.reason] : []),
        ...(output.status === "rejected" ? [output.reason] : []),
        ...(settlement.status === "rejected" ? [settlement.reason] : []),
      ])
    }
    return exit.value
  }

  export async function requestDisposeAndWaitForPhysicalExit(
    handle: Handle,
    label: string,
    opts: { exitTimeoutMs?: number } = {},
  ): Promise<number> {
    const cleanup = handle.dispose()
    void cleanup.catch((error) => {
      process.emitWarning(`${label} deferred cleanup failed after physical exit: ${errorMessage(error)}`)
    })
    return await awaitWithTimeout(
      handle.exited,
      opts.exitTimeoutMs ?? TERMINATION_EXIT_TIMEOUT_MS,
      `${label} process did not exit after disposal was requested`,
    )
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
      env: opts.env ?? process.env,
      signal: opts.signal,
      deadlineAt: opts.deadlineAt,
      request: (readyPath, requestID) => ({
        kind: "shell",
        command: opts.command,
        shell: opts.shell,
        cwd: opts.cwd,
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
      env,
      signal: opts.signal,
      deadlineAt: opts.deadlineAt,
      request: (readyPath, requestID) => ({
        kind: "command",
        executable,
        args: opts.args,
        detached: opts.detached ?? false,
        cwd: opts.cwd,
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
    env: NodeJS.ProcessEnv
    signal?: AbortSignal
    deadlineAt?: number
    request: (readyPath: string, requestID: string) => Record<string, unknown>
  }): Promise<Handle> {
    const helper = await resolveWindowsHelper()
    if (!helper) {
      throw new Error("Windows process supervisor helper is required for process-tree cleanup")
    }
    const requestDir = await Global.createTemporaryDirectory("supervisor-")
    const requestPath = path.join(requestDir, "request.json")
    const readyPath = path.join(requestDir, "ready.json")
    const launchFailedPath = path.join(requestDir, "launch-failed.json")
    const cancelPath = path.join(requestDir, "cancel")
    const settledPath = path.join(requestDir, "settled.json")
    const requestID = randomUUID()
    const runtimeOwner = RuntimeServerOwnership.currentProcessOccurrence()
    try {
      const request = {
        ...opts.request(readyPath, requestID),
        launch_failed_file: launchFailedPath,
        cancel_file: cancelPath,
        settled_file: settledPath,
        owner_pid: runtimeOwner.pid,
        owner_process_instance_id: runtimeOwner.processInstanceID,
        runtime_occurrence_id: runtimeOwner.occurrenceID,
      }
      windowsRequestObserver?.(request)
      await fs.writeFile(requestPath, JSON.stringify(request), "utf8")
    } catch (error) {
      await rethrowWithCleanup(error, "Windows process supervisor request creation and cleanup failed", [
        () => fs.rm(requestDir, { recursive: true, force: true }),
      ])
    }
    let proc: ChildProcess
    try {
      proc = spawn(helper, ["--request", requestPath], {
        stdio: [opts.stdin ?? "ignore", "pipe", "pipe"],
        env: opts.env,
        detached: true,
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
    let readyTargetPID: number | undefined
    const validateDurablePhysicalSettlement = async (): Promise<number | undefined> => {
      const rawPreTargetSettlement = await readJsonFile(launchFailedPath)
      if (rawPreTargetSettlement) {
        const [rawReady, rawSettlement] = await Promise.all([readJsonFile(readyPath), readJsonFile(settledPath)])
        if (rawReady || rawSettlement) {
          throw new Error("Windows process supervisor pre-target settlement conflicts with target process markers")
        }
        parseWindowsPreTargetSettlementMarker({
          text: JSON.stringify(rawPreTargetSettlement),
          requestID,
          runtimeOccurrenceID: runtimeOwner.occurrenceID,
          helperPID: helperHandle.pid,
        })
        return undefined
      }
      const ready = parseWindowsReadyMarker({
        text: await fs.readFile(readyPath, "utf8"),
        requestID,
        runtimeOccurrenceID: runtimeOwner.occurrenceID,
        helperPID: helperHandle.pid,
      })
      if (readyTargetPID !== undefined && ready.target_pid !== readyTargetPID) {
        throw new Error(`Windows process supervisor ready marker target process identity does not match`)
      }
      parseWindowsSettlementMarker({
        text: await fs.readFile(settledPath, "utf8"),
        requestID,
        runtimeOccurrenceID: runtimeOwner.occurrenceID,
        helperPID: helperHandle.pid,
        targetPID: ready.target_pid,
      })
      return ready.target_pid
    }
    const waitForDurablePhysicalSettlement = async (): Promise<number | undefined> => {
      const deadline = Date.now() + TERMINATION_CLEANUP_TIMEOUT_MS
      for (;;) {
        try {
          return await validateDurablePhysicalSettlement()
        } catch (error) {
          // A Windows child exit notification can become observable before
          // the helper's atomically renamed settlement marker is visible to
          // this process under filesystem pressure. Only absence is
          // retryable: malformed or conflicting proof still fails at once.
          if (errorCode(error) !== "ENOENT" || Date.now() >= deadline) throw error
          await Bun.sleep(20)
        }
      }
    }
    let cancellationRequest: Promise<void> | undefined
    const requestCancellation = () => {
      if (cancellationRequest) return cancellationRequest
      cancellationRequest = fs.writeFile(cancelPath, requestID, "utf8")
      void cancellationRequest.catch(() => {
        cancellationRequest = undefined
      })
      return cancellationRequest
    }
    const cancelAndSettleHelper = async () => {
      await requestCancellation()
      await awaitWithTimeout(
        helperHandle.exited,
        TERMINATION_CLEANUP_TIMEOUT_MS,
        "Windows process supervisor did not publish physical settlement after cancellation",
      )
      await helperHandle.dispose()
    }
    const helperStdout = proc.stdout
    const helperStderr = proc.stderr
    if (!helperStdout || !helperStderr) {
      return await rethrowWithCleanup(
        new Error("Windows process supervisor did not expose stdout/stderr pipes"),
        "Windows process supervisor pipe validation and cleanup failed",
        [
          async () => {
            await cancelAndSettleHelper()
            await validateDurablePhysicalSettlement()
            await fs.rm(requestDir, { recursive: true, force: true })
          },
        ],
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
        runtimeOccurrenceID: runtimeOwner.occurrenceID,
        helperPID: helperHandle.pid,
        helperPath: helper,
        exited: helperHandle.exited,
        command: opts.label,
        startupDetails,
        outputFailures: () => outputFailures,
        signal: opts.signal,
        deadlineAt: opts.deadlineAt,
      })
      readyTargetPID = pid
    } catch (error) {
      try {
        await rethrowWithCleanup(error, "Windows process supervisor startup and cleanup failed", [
          async () => {
            await cancelAndSettleHelper()
            await validateDurablePhysicalSettlement()
            await fs.rm(requestDir, { recursive: true, force: true })
          },
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
    const exited = helperExitOutcome.then(async (outcome) => {
      if ("error" in outcome) throw outcome.error
      try {
        await waitForDurablePhysicalSettlement()
      } catch (error) {
        throw new Error(
          `Windows process supervisor exited without a physical settlement marker for request ${requestID}: ${errorMessage(error)}`,
          { cause: error },
        )
      }
      return outcome.code
    })
    const outputSettled = (helperHandle.outputSettled ?? helperHandle.exited.then(() => undefined)).then(() => {
      if (outputFailures.length === 1) throw outputFailures[0]
      if (outputFailures.length > 1) {
        throw new AggregateError(outputFailures, "Windows process supervisor output streams failed")
      }
    })
    // Consumers still observe the original rejected promise; this attachment
    // prevents an early process or stream rejection from becoming unhandled.
    void exited.catch(() => undefined)
    void outputSettled.catch(() => undefined)

    let requestCleanupComplete = false
    let requestCleanupAttempt: Promise<void> | undefined
    const cleanupRequestDirectory = () => {
      if (requestCleanupComplete) return Promise.resolve()
      if (requestCleanupAttempt) return requestCleanupAttempt
      const attempt = validateDurablePhysicalSettlement()
        .then(() => fs.rm(requestDir, { recursive: true, force: true }))
        .then(() => {
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
        await requestCancellation()
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
        const helperResult = await Promise.allSettled([
          helperExited ? helperHandle.dispose() : cancelAndSettleHelper(),
        ]).then(([result]) => result!)
        const physicalResult = await Promise.allSettled([exited]).then(([result]) => result!)
        const cleanupResult =
          physicalResult.status === "fulfilled"
            ? await Promise.allSettled([cleanupRequestDirectory()]).then(([result]) => result!)
            : undefined
        const failures = [
          ...(helperResult.status === "rejected" ? [helperResult.reason] : []),
          ...(physicalResult.status === "rejected" ? [physicalResult.reason] : []),
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

    const settled = (async () => {
      const [physical, output] = await Promise.allSettled([exited, outputSettled])
      const cleanup =
        physical.status === "fulfilled"
          ? await Promise.allSettled([cleanupRequestDirectory()]).then(([result]) => result!)
          : undefined
      const failures = [
        ...(physical.status === "rejected" ? [physical.reason] : []),
        ...(output.status === "rejected" ? [output.reason] : []),
        ...(cleanup?.status === "rejected" ? [cleanup.reason] : []),
      ]
      if (failures.length > 0) throw combineFailures("Windows process supervisor settlement failed", failures)
    })()
    void settled.catch(() => undefined)

    return {
      ...helperHandle,
      pid,
      stdout,
      stderr,
      exited,
      outputSettled,
      settled,
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
    let physicallyExited = false
    const controlFailures: unknown[] = []
    const exited = new Promise<number>((resolve, reject) => {
      proc.once("exit", (code, signal) => {
        physicallyExited = true
        resolve(code ?? (signal ? 1 : 0))
      })
      proc.once("error", (error) => {
        controlFailures.push(error)
      })
    })
    const outputSettled = new Promise<void>((resolve, reject) => {
      proc.once("close", () => {
        if (controlFailures.length === 1) reject(controlFailures[0])
        else if (controlFailures.length > 1) reject(new AggregateError(controlFailures, "Child process control failed"))
        else resolve()
      })
    })
    void outputSettled.catch(() => undefined)
    const settled = joinPhysicalAndOutputSettlement({ exited, outputSettled })
    void settled.catch(() => undefined)

    const terminate = () => {
      if (termination) return termination
      const attempt = (async () => {
        if (opts.cleanupProcessGroup) {
          await terminateOwnedChildProcessTree(proc, `process group ${proc.pid}`, {
            gracefulTimeoutMs: opts.gracefulTerminationMs,
          })
          return
        }
        if (!physicallyExited && proc.exitCode === null && proc.signalCode === null) {
          proc.kill("SIGTERM")
          await Bun.sleep(SIGKILL_TIMEOUT_MS)
          if (!physicallyExited && proc.exitCode === null && proc.signalCode === null) {
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
      outputSettled,
      settled,
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
    runtime_occurrence_id: string
  }

  type WindowsSettlementMarker = WindowsReadyMarker & { active_processes: 0 }

  type WindowsPreTargetSettlementMarker = {
    protocol: 1
    request_id: string
    helper_pid: number
    stage: "target_not_created"
    active_processes: 0
    runtime_occurrence_id: string
  }

  function parseWindowsPreTargetSettlementMarker(input: {
    text: string
    requestID: string
    runtimeOccurrenceID: string
    helperPID?: number
  }): WindowsPreTargetSettlementMarker {
    let value: unknown
    try {
      value = JSON.parse(input.text)
    } catch (error) {
      throw new Error(
        `Windows process supervisor pre-target settlement marker is not valid JSON: ${errorMessage(error)}`,
      )
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Windows process supervisor pre-target settlement marker must be an object")
    }
    const marker = value as Record<string, unknown>
    const keys = Object.keys(marker).sort()
    const expectedKeys = ["active_processes", "helper_pid", "protocol", "request_id", "runtime_occurrence_id", "stage"]
    if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
      throw new Error("Windows process supervisor pre-target settlement marker has unexpected fields")
    }
    if (
      marker.protocol !== 1 ||
      marker.request_id !== input.requestID ||
      marker.runtime_occurrence_id !== input.runtimeOccurrenceID ||
      marker.stage !== "target_not_created" ||
      marker.active_processes !== 0
    ) {
      throw new Error("Windows process supervisor pre-target settlement marker identity does not match")
    }
    if (!Number.isInteger(marker.helper_pid) || (marker.helper_pid as number) <= 0) {
      throw new Error("Windows process supervisor pre-target settlement marker has invalid helper process id")
    }
    if (input.helperPID !== undefined && marker.helper_pid !== input.helperPID) {
      throw new Error("Windows process supervisor pre-target settlement marker helper process identity does not match")
    }
    return marker as WindowsPreTargetSettlementMarker
  }

  function parseWindowsReadyMarker(input: {
    text: string
    requestID: string
    runtimeOccurrenceID: string
    helperPID?: number
  }): WindowsReadyMarker {
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
    const expectedKeys = ["helper_pid", "protocol", "request_id", "runtime_occurrence_id", "target_pid"]
    if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
      throw new Error("Windows process supervisor ready marker has unexpected fields")
    }
    if (marker.protocol !== 1) throw new Error("Windows process supervisor ready marker has invalid protocol")
    if (marker.request_id !== input.requestID) {
      throw new Error("Windows process supervisor ready marker request identity does not match")
    }
    if (marker.runtime_occurrence_id !== input.runtimeOccurrenceID) {
      throw new Error("Windows process supervisor ready marker runtime occurrence does not match")
    }
    if (!Number.isInteger(marker.helper_pid) || (marker.helper_pid as number) <= 0) {
      throw new Error("Windows process supervisor ready marker has invalid helper process id")
    }
    if (input.helperPID !== undefined && marker.helper_pid !== input.helperPID) {
      throw new Error("Windows process supervisor ready marker helper process identity does not match")
    }
    if (!Number.isInteger(marker.target_pid) || (marker.target_pid as number) <= 0) {
      throw new Error("Windows process supervisor ready marker has invalid target process id")
    }
    return marker as WindowsReadyMarker
  }

  function parseWindowsSettlementMarker(input: {
    text: string
    requestID: string
    runtimeOccurrenceID: string
    helperPID: number
    targetPID: number
  }): WindowsSettlementMarker {
    let value: unknown
    try {
      value = JSON.parse(input.text)
    } catch (error) {
      throw new Error(`Windows process supervisor settlement marker is not valid JSON: ${errorMessage(error)}`)
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Windows process supervisor settlement marker must be an object")
    }
    const marker = value as Record<string, unknown>
    const keys = Object.keys(marker).sort()
    const expectedKeys = [
      "active_processes",
      "helper_pid",
      "protocol",
      "request_id",
      "runtime_occurrence_id",
      "target_pid",
    ]
    if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
      throw new Error("Windows process supervisor settlement marker has unexpected fields")
    }
    if (marker.protocol !== 1) throw new Error("Windows process supervisor settlement marker has invalid protocol")
    if (
      marker.request_id !== input.requestID ||
      marker.runtime_occurrence_id !== input.runtimeOccurrenceID ||
      marker.helper_pid !== input.helperPID ||
      marker.target_pid !== input.targetPID
    ) {
      throw new Error("Windows process supervisor settlement marker identity does not match")
    }
    if (marker.active_processes !== 0) {
      throw new Error("Windows process supervisor settlement marker does not prove active-process-zero")
    }
    return marker as WindowsSettlementMarker
  }

  async function waitForReadyMarker(input: {
    readyPath: string
    requestID: string
    runtimeOccurrenceID: string
    helperPID: number
    helperPath: string
    exited: Promise<number>
    command: string
    startupDetails: () => string
    outputFailures: () => readonly Error[]
    signal?: AbortSignal
    deadlineAt?: number
  }): Promise<number> {
    const deadline = Math.min(input.deadlineAt ?? Number.POSITIVE_INFINITY, Date.now() + 5_000)
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
        return parseWindowsReadyMarker({
          text,
          requestID: input.requestID,
          runtimeOccurrenceID: input.runtimeOccurrenceID,
          helperPID: input.helperPID,
        })
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
      input.signal?.throwIfAborted()
      throwStreamFailures()
      const marker = await readReadyMarker()
      if (marker) return marker.target_pid
      if (exitObserved) break
      await Bun.sleep(20)
    }
    input.signal?.throwIfAborted()
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
    const lockfile = path.resolve(import.meta.dir, "../../native/process-supervisor/Cargo.lock")
    const nativeSource = path.resolve(import.meta.dir, "../../native/process-supervisor/src/main.rs")
    const sourceIdentity = createHash("sha256")
      .update(readFileSync(manifest))
      .update(readFileSync(lockfile))
      .update(readFileSync(nativeSource))
      .digest("hex")
      .slice(0, 16)
    const targetDir = path.resolve(
      import.meta.dir,
      "../../native/process-supervisor/target",
      `runtime-${sourceIdentity}`,
    )
    const candidate = path.join(targetDir, "debug", exe)
    if (Filesystem.stat(candidate)?.size) return candidate
    return buildLocalWindowsHelper(manifest, targetDir)
  }

  const exe = "opencorvus-process-supervisor.exe"

  function buildLocalWindowsHelper(manifest: string, targetDir: string): string {
    if (!Filesystem.stat(manifest)?.size) {
      throw new Error(`Windows process supervisor source manifest is missing: ${manifest}`)
    }
    const cargo = which("cargo")
    if (!cargo) throw new Error("Cargo is required to build the Windows process supervisor helper")
    const result = spawnSync(cargo, ["build", "--manifest-path", manifest, "--target-dir", targetDir], {
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
    const debug = path.join(targetDir, "debug", exe)
    if (!Filesystem.stat(debug)?.size) {
      throw new Error(`Cargo completed without producing the Windows process supervisor helper: ${debug}`)
    }
    return debug
  }
}
