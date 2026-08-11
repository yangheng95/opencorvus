import z from "zod"
import { Instance, runAsInstanceActivity } from "@/project/instance"
import {
  provideInitializedProjectExecution,
  runWithIndependentProjectIdentity,
  runWithInitializedIndependentProject,
} from "@/project/independent-project-owner"
import { createInstanceState } from "@/project/instance-state"
import { Bus } from "@/bus"
import { GlobalBus } from "@/bus/global"
import { BusEvent } from "@/bus/bus-event"
import { Session } from "@/session"
import { SessionStatus, executionLifecycleOrderKey, sessionLifecycleOrderKey } from "@/session/status"
import { SessionPrompt } from "@/session/prompt"
import { SessionPromptReplyError } from "@/session/prompt/state"
import { SessionContext } from "@/session/context"
import { SessionTable } from "@/session/session.sql"
import { Message } from "@/session/message"
import { Database, and, eq, inArray, sql, type SQL } from "@/storage/db"
import { Identifier } from "@/id/id"
import { Log } from "@/util/log"
import { AwaitTimeoutError } from "@/util/await-with-timeout"
import { awaitWithAbort } from "@/util/abort"
import { EngineConfig } from "@/engine/config"
import { createExecutionCancellationOrigin, type ExecutionCancellationOrigin } from "@/session/prompt/cancellation"
import { TaskQueueTable } from "./task-queue.sql"
import { SessionWake } from "@/session/wake"
import { NamedError } from "@opencorvus-ai/util/error"
import {
  RuntimeExecutionAdmissionClosedError,
  RuntimeExecutionSettlement,
  type RuntimeExecutionReservation,
} from "@/runtime/execution-settlement"

export const TaskQueueEvent = {
  Changed: BusEvent.define(
    "task-queue.changed",
    z.object({
      queueTaskID: z.string(),
      sessionID: z.string(),
      status: z.enum(["queued", "failed"]),
      sequence: z.number(),
    }),
  ),
  Completed: BusEvent.define(
    "task-queue.completed",
    z.object({
      queueTaskID: z.string(),
      sessionID: z.string(),
    }),
  ),
}

export class RuntimeExecutionHandoffCancellation extends Error {
  override readonly name = "RuntimeExecutionHandoffCancellation"

  constructor(
    readonly taskID: string,
    readonly queueOccurrenceID: string,
    readonly reason: string,
  ) {
    super(`Task Queue execution ${taskID} returned to queued state during runtime handoff: ${reason}`)
  }
}

export class TaskQueueProcessRollbackRecoveryError extends Error {
  override readonly name = "TaskQueueProcessRollbackRecoveryError"

  constructor(
    readonly directory: string,
    readonly taskIDs: readonly string[],
    cause: unknown,
  ) {
    super(`Task Queue rollback recovery failed for ${directory} (${taskIDs.join(", ") || "directory drain"})`, {
      cause,
    })
  }
}

const RawTaskMetadata = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("session_wake"),
    messageID: z.string(),
    input: z.unknown(),
  }),
  z.object({
    kind: z.literal("session_compaction"),
    input: z.unknown(),
  }),
])

const EnqueuePromptInput = z.object({
  sessionID: Identifier.schema("session"),
  prompt: z.unknown(),
  priority: z.enum(["high", "normal", "low"]).optional(),
  source: z.string().optional(),
})

const CompactionModelRef = z.object({
  providerID: z.string(),
  modelID: z.string(),
})

const ExecuteCompactionInput = z.object({
  sessionID: Identifier.schema("session"),
  sourceUserMessageID: Identifier.schema("message"),
  model: CompactionModelRef.optional(),
  auto: z.boolean().optional().default(false),
  overflow: z.boolean().optional().default(false),
  focus: z.string().optional(),
})

const StoredCompactionInput = ExecuteCompactionInput.omit({ sessionID: true })

const EnqueueCompactionInput = ExecuteCompactionInput.extend({
  priority: z.enum(["high", "normal", "low"]).optional(),
  source: z.string().optional(),
})

export namespace TaskQueueService {
  const log = Log.create({ service: "task-queue-service" })

  const CONCURRENCY_ENV = "OPENCORVUS_TASK_QUEUE_CONCURRENCY"
  const CONCURRENCY_LIMIT = 100
  const RECOVERY_CONTROL_RETRY_MS = 1_000

  function publishQueueChangedInTransaction(input: {
    queueTaskID: string
    sessionID: string
    status: "queued" | "failed"
    sequence: number
  }) {
    return Bus.publishOwnedInTransaction(TaskQueueEvent.Changed, input)
  }

  export function deleteSettledForSessions(db: Database.TxOrDb, input: { sessionIDs: string[] }): void {
    if (input.sessionIDs.length === 0) return
    db.delete(TaskQueueTable)
      .where(
        and(
          inArray(TaskQueueTable.session_id, input.sessionIDs),
          inArray(TaskQueueTable.status, ["completed", "failed"]),
        ),
      )
      .run()
    const unsettled = db
      .select({ id: TaskQueueTable.id, status: TaskQueueTable.status })
      .from(TaskQueueTable)
      .where(inArray(TaskQueueTable.session_id, input.sessionIDs))
      .orderBy(TaskQueueTable.time_created, TaskQueueTable.id)
      .all()
    if (unsettled.length > 0) {
      throw new Error(
        `Session deletion requires settled task queue rows: ${unsettled.map((row) => `${row.id}:${row.status}`).join(", ")}`,
      )
    }
  }

  type QueueTaskRow = typeof TaskQueueTable.$inferSelect
  type InFlightTask = {
    promise: Promise<void>
    cleanup: () => void
    sessionID: string
    source: string
    directory: string
    authority: RuntimeExecutionReservation
    cancellationReason?: string
    cancellationOrigin?: ExecutionCancellationOrigin
    promptOwner?: AbortSignal
    progressSessionIDs?: Set<string>
  }

  type QueueProgressEnvelope = {
    directory?: string
    payload: any
  }

  type QueuePromptStartHook = (signal: AbortSignal) => void | Promise<void>
  let beforeQueuePromptStartForTest: QueuePromptStartHook | undefined
  let beforeQueueClaimReservationForTest: ((taskID: string) => void | Promise<void>) | undefined
  let beforeProgressTouchForTest:
    | ((input: { taskID: string; progressEpoch: number }) => void | Promise<void>)
    | undefined
  let beforeProcessRollbackRecoveryForTest:
    | ((input: { directory: string; taskIDs: readonly string[] }) => void | Promise<void>)
    | undefined

  // Queue execution ownership is process/project-wide. Multiple Instance
  // directories (primary worktree and managed worktrees) can represent the
  // same project, so an Instance-local map cannot decide that a durable
  // running claim is ownerless.
  const processInFlight = new Map<string, InFlightTask>()
  const processActiveDrains = new Map<Promise<Promise<void>[]>, { directory: string }>()
  let progressEpochSequence = 0
  const observedProgressEpochs = new Map<string, number>()
  const durableProgressEpochs = new Map<string, number>()
  const progressTouchOwners = new Map<string, Promise<void>>()
  const interruptedRecoveryTimers = new Map<string, { task: QueueTaskRow; directory: string }>()
  const runtimeRequeuedDirectories = new Set<string>()
  type ProcessRollbackScope = {
    token: symbol
    recoveryTaskIDsByDirectory: Map<string, Set<string>>
    requeuedTaskIDsByDirectory: Map<string, Set<string>>
    drains: Set<Promise<Promise<void>[]>>
  }
  let processSettlementGate: ProcessRollbackScope | undefined

  function captureProcessRollbackTask(
    kind: "recovery" | "requeued",
    directory: string,
    taskID: string,
  ): void {
    const gate = processSettlementGate
    if (!gate) return
    const target = kind === "recovery" ? gate.recoveryTaskIDsByDirectory : gate.requeuedTaskIDsByDirectory
    const taskIDs = target.get(directory) ?? new Set<string>()
    taskIDs.add(taskID)
    target.set(directory, taskIDs)
  }

  function captureProcessRollbackTaskForScope(
    target: Map<string, Set<string>>,
    directory: string,
    taskID: string,
  ): void {
    const taskIDs = target.get(directory) ?? new Set<string>()
    taskIDs.add(taskID)
    target.set(directory, taskIDs)
  }

  function processRollbackDirectories(scope: ProcessRollbackScope): string[] {
    return [...new Set([...scope.recoveryTaskIDsByDirectory.keys(), ...scope.requeuedTaskIDsByDirectory.keys()])].sort()
  }

  function clearProcessRollbackScope(scope: ProcessRollbackScope): void {
    for (const [directory, taskIDs] of scope.recoveryTaskIDsByDirectory) {
      for (const taskID of taskIDs) {
        if (interruptedRecoveryTimers.get(taskID)?.directory === directory) interruptedRecoveryTimers.delete(taskID)
      }
    }
    for (const directory of scope.requeuedTaskIDsByDirectory.keys()) runtimeRequeuedDirectories.delete(directory)
  }

  async function drainStartedExecutions(drain: Promise<Promise<void>[]>): Promise<Promise<void>[]> {
    const result = await Promise.allSettled([drain])
    const started = result[0]
    return started.status === "fulfilled" ? started.value : []
  }

  async function joinDrainExecution(drain: Promise<Promise<void>[]>): Promise<void> {
    await Promise.allSettled(await drainStartedExecutions(drain))
  }

  async function recoverProcessRollbackScope(scope: ProcessRollbackScope): Promise<void> {
    let joinedDrains = 0
    while (joinedDrains < scope.drains.size) {
      const drains = [...scope.drains].slice(joinedDrains)
      joinedDrains += drains.length
      await Promise.all(drains.map(joinDrainExecution))
    }
    const failures: TaskQueueProcessRollbackRecoveryError[] = []
    for (const directory of processRollbackDirectories(scope)) {
      const recoveryTaskIDs = [...(scope.recoveryTaskIDsByDirectory.get(directory) ?? [])].sort()
      const requeuedTaskIDs = [...(scope.requeuedTaskIDsByDirectory.get(directory) ?? [])].sort()
      const taskIDs = [...new Set([...recoveryTaskIDs, ...requeuedTaskIDs])].sort()
      try {
        await runWithInitializedIndependentProject({
          directory,
          fn: async () => {
            await beforeProcessRollbackRecoveryForTest?.({ directory, taskIDs })
            for (const taskID of recoveryTaskIDs) {
              const owner = interruptedRecoveryTimers.get(taskID)
              if (!owner || owner.directory !== directory) continue
              const current = Database.use((db) =>
                db.select().from(TaskQueueTable).where(eq(TaskQueueTable.id, taskID)).get(),
              )
              if (current?.status === "running") {
                scheduleRunningRecoveryTimer(current, "runtime settlement rollback resumed")
              }
              if (interruptedRecoveryTimers.get(taskID)?.directory === directory) {
                interruptedRecoveryTimers.delete(taskID)
              }
            }
            await drainUntilIdle("runtime settlement rollback resumed")
            if (scope.requeuedTaskIDsByDirectory.has(directory)) runtimeRequeuedDirectories.delete(directory)
          },
        })
      } catch (error) {
        failures.push(new TaskQueueProcessRollbackRecoveryError(directory, taskIDs, error))
      }
    }
    if (failures.length > 0) {
      throw new AggregateError(failures, "Failed to resume Task Queue projects after runtime rollback")
    }
  }

  const state = createInstanceState(
    () => ({
      acceptingDrain: true,
      generation: 0,
      draining: false,
      activeDrain: undefined as Promise<Promise<void>[]> | undefined,
      inFlight: new Map<string, InFlightTask>(),
      recoveryTimers: new Map<string, ReturnType<typeof setTimeout>>(),
      recoveryAuthorities: new Map<string, RuntimeExecutionReservation>(),
      recoveryTimerTokens: new Map<string, number>(),
      recoveryTimerSequence: 0,
      progressListener: undefined as ((message: QueueProgressEnvelope) => void) | undefined,
    }),
    async (current) => {
      current.acceptingDrain = false
      current.generation += 1
      let drainStarted: Promise<void>[] = []
      if (current.activeDrain) {
        const activeDrain = current.activeDrain
        processSettlementGate?.drains.add(activeDrain)
        // Seal every in-progress async validation/hook before cancellation so
        // no claim can appear after the disposer snapshots physical owners.
        drainStarted = await drainStartedExecutions(activeDrain)
      }
      if (current.progressListener) GlobalBus.off("event", current.progressListener)
      for (const timer of current.recoveryTimers.values()) clearTimeout(timer)
      for (const authority of current.recoveryAuthorities.values()) authority.settle()
      current.recoveryTimers.clear()
      current.recoveryAuthorities.clear()
      current.recoveryTimerTokens.clear()
      for (const task of current.inFlight.values()) {
        const origin = runtimeCancellationOrigin(task, "Task Queue instance is disposing")
        requestExecutionCancellation(task, origin.reason, origin)
      }
      await Promise.allSettled([
        ...new Set([...drainStarted, ...[...current.inFlight.values()].map((task) => task.promise)]),
      ])
      for (const [taskID, task] of current.inFlight) {
        if (processInFlight.get(taskID) === task) processInFlight.delete(taskID)
        releaseProgressEpochIfIdle(taskID)
      }
      current.inFlight.clear()
      for (const [taskID, owner] of interruptedRecoveryTimers) {
        const retainedByRollback = processSettlementGate?.recoveryTaskIDsByDirectory
          .get(owner.directory)
          ?.has(taskID)
        if (owner.directory === Instance.directory && !retainedByRollback) interruptedRecoveryTimers.delete(taskID)
      }
      if (!processSettlementGate?.requeuedTaskIDsByDirectory.has(Instance.directory)) {
        runtimeRequeuedDirectories.delete(Instance.directory)
      }
    },
    "task-queue-service",
  )

  export function init() {
    log.info("task queue service registered")
  }

  export function start() {
    const recovered = requeueOwnerlessRunningRows()
    requestDrain(recovered > 0 ? "project bootstrap recovered ownerless queue rows" : "project bootstrap completed")
    log.info("task queue service started", { recoveredOwnerlessRows: recovered })
  }

  export type ProcessSettlementGate = Disposable & {
    commit(): void
    rollback(): () => Promise<void>
  }

  export function acquireProcessSettlementGate(): ProcessSettlementGate {
    if (processSettlementGate) throw new Error("Task Queue process settlement is already in progress")
    const token = Symbol("task-queue-process-settlement")
    const scope: ProcessRollbackScope = {
      token,
      recoveryTaskIDsByDirectory: new Map(),
      requeuedTaskIDsByDirectory: new Map(),
      drains: new Set(),
    }
    for (const [taskID, owner] of interruptedRecoveryTimers) {
      captureProcessRollbackTaskForScope(scope.recoveryTaskIDsByDirectory, owner.directory, taskID)
    }
    for (const [taskID, task] of processInFlight) {
      captureProcessRollbackTaskForScope(scope.requeuedTaskIDsByDirectory, task.directory, taskID)
    }
    for (const directory of runtimeRequeuedDirectories) {
      if (!scope.requeuedTaskIDsByDirectory.has(directory)) {
        scope.requeuedTaskIDsByDirectory.set(directory, new Set())
      }
    }
    for (const drain of processActiveDrains.keys()) scope.drains.add(drain)
    processSettlementGate = scope
    let decision: "pending" | "commit" | "rollback" = "pending"
    let disposed = false
    let rollbackCompleted = false
    let rollbackOperation: Promise<void> | undefined
    return {
      commit() {
        if (decision === "rollback") throw new Error("Task Queue process settlement rollback is already authoritative")
        decision = "commit"
      },
      rollback() {
        if (decision === "commit") throw new Error("Task Queue process settlement commit is already authoritative")
        decision = "rollback"
        return async () => {
          if (!disposed) throw new Error("Task Queue rollback can resume only after all runtime admission gates reopen")
          if (rollbackCompleted) return
          if (rollbackOperation) return await rollbackOperation
          rollbackOperation = recoverProcessRollbackScope(scope).then(() => {
            rollbackCompleted = true
          })
          try {
            await rollbackOperation
          } finally {
            rollbackOperation = undefined
          }
        }
      },
      [Symbol.dispose]() {
        if (processSettlementGate?.token !== token) return
        if (decision === "pending") {
          throw new Error("Task Queue process settlement gate requires an explicit commit or rollback decision")
        }
        processSettlementGate = undefined
        disposed = true
        if (decision === "commit") clearProcessRollbackScope(scope)
      },
    }
  }

  export async function runNow() {
    await runTaskQueueOwner(Instance.directory, () => drainUntilIdle("runNow"))
  }

  function runtimeCancellationOrigin(task: Pick<InFlightTask, "sessionID">, reason: unknown): ExecutionCancellationOrigin {
    const message = reason instanceof Error ? reason.message : String(reason)
    return createExecutionCancellationOrigin({
      actor: "runtime",
      source: "process.shutdown",
      surface: "runtime",
      requestID: `task-queue:${task.sessionID}`,
      reason: message,
      targetSessionID: task.sessionID,
    })
  }

  function isExecutionCancellationOrigin(value: unknown): value is ExecutionCancellationOrigin {
    if (!value || typeof value !== "object") return false
    const candidate = value as Partial<ExecutionCancellationOrigin>
    return (
      typeof candidate.actor === "string" &&
      typeof candidate.source === "string" &&
      typeof candidate.surface === "string" &&
      typeof candidate.requestID === "string" &&
      typeof candidate.reason === "string"
    )
  }

  function requestExecutionCancellation(
    task: InFlightTask,
    reason: string,
    origin: ExecutionCancellationOrigin,
  ): void {
    if (!task.authority.signal.aborted) {
      task.authority.cancel(origin)
      return
    }
    task.cancellationReason = reason
    task.cancellationOrigin = origin
    task.cleanup()
    if (!task.promptOwner) return
    SessionPrompt.cancelOwned(task.sessionID, task.directory, task.promptOwner, { origin })
  }

  function createInFlightTask(input: {
    taskID: string
    sessionID: string
    source: string
    directory: string
  }): InFlightTask {
    const authority = RuntimeExecutionSettlement.reserve("task_queue", `queue-execution:${input.taskID}`)
    const task: InFlightTask = {
      promise: Promise.resolve(),
      cleanup: () => undefined,
      sessionID: input.sessionID,
      source: input.source,
      directory: input.directory,
      authority,
    }
    authority.onCancel((reason) => {
      const origin = isExecutionCancellationOrigin(reason) ? reason : runtimeCancellationOrigin(task, reason)
      requestExecutionCancellation(task, origin.reason, origin)
    })
    return task
  }

  async function enterQueuePromptLoop(
    task: Pick<QueueTaskRow, "id" | "session_id">,
    inFlight: InFlightTask,
    directory: string,
  ): Promise<void> {
    await beforeQueuePromptStartForTest?.(inFlight.authority.signal)
    inFlight.authority.signal.throwIfAborted()
    SessionPrompt.capturePromptOwner(task.session_id, directory)
    if (inFlight.cancellationReason) throw new Error(inFlight.cancellationReason)
  }

  export const TestHooks = {
    installBeforeProcessRollbackRecovery(
      hook: (input: { directory: string; taskIDs: readonly string[] }) => void | Promise<void>,
    ): Disposable {
      if (beforeProcessRollbackRecoveryForTest) {
        throw new Error("Task Queue process rollback recovery test hook is already installed")
      }
      beforeProcessRollbackRecoveryForTest = hook
      return {
        [Symbol.dispose]() {
          if (beforeProcessRollbackRecoveryForTest === hook) beforeProcessRollbackRecoveryForTest = undefined
        },
      }
    },
    installBeforeQueueClaimReservation(hook: (taskID: string) => void | Promise<void>): Disposable {
      if (beforeQueueClaimReservationForTest) throw new Error("Task Queue claim-reservation test hook is already installed")
      beforeQueueClaimReservationForTest = hook
      return {
        [Symbol.dispose]() {
          if (beforeQueueClaimReservationForTest === hook) beforeQueueClaimReservationForTest = undefined
        },
      }
    },
    installBeforeProgressTouch(
      hook: (input: { taskID: string; progressEpoch: number }) => void | Promise<void>,
    ): Disposable {
      if (beforeProgressTouchForTest) throw new Error("Task Queue progress-touch test hook is already installed")
      beforeProgressTouchForTest = hook
      return {
        [Symbol.dispose]() {
          if (beforeProgressTouchForTest === hook) beforeProgressTouchForTest = undefined
        },
      }
    },
    runClaimedPromptStart(input: { taskID: string; sessionID: string; directory: string }): Promise<void> {
      const inFlight = createInFlightTask({
        taskID: input.taskID,
        sessionID: input.sessionID,
        source: "task-queue-claim-cancellation-contract",
        directory: input.directory,
      })
      const operation = enterQueuePromptLoop(
        { id: input.taskID, session_id: input.sessionID },
        inFlight,
        input.directory,
      )
      inFlight.promise = operation
      inFlight.authority.settleWith(operation)
      return operation
    },
    installBeforeQueuePromptStart(hook: QueuePromptStartHook): Disposable {
      if (beforeQueuePromptStartForTest) throw new Error("Task Queue prompt-start test hook is already installed")
      beforeQueuePromptStartForTest = hook
      return {
        [Symbol.dispose]() {
          if (beforeQueuePromptStartForTest === hook) beforeQueuePromptStartForTest = undefined
        },
      }
    },
    async claimReadyTaskIDs(input: {
      limit: number
      beforeValidation?: (sessionID: string) => void | Promise<void>
    }): Promise<string[]> {
      const claimed = await claimReadyTasks(input.limit, async (sessionID) => {
        await input.beforeValidation?.(sessionID)
        return assertSessionLineageInCurrentProject(sessionID)
      })
      return claimed.map((task) => task.id)
    },
    waitForDrainProgress(input: { started: Promise<void>[]; running: Promise<void>[] }): Promise<void> {
      return waitForNextDrainSettlement(input.started, input.running)
    },
    trackChildSessionProgress(input: {
      taskID: string
      rootSessionID: string
      directory: string
      projectID: string
    }): () => void {
      const current = state()
      if (current.inFlight.has(input.taskID)) {
        throw new Error(`Task Queue test progress owner already exists: ${input.taskID}`)
      }
      const inFlight = createInFlightTask({
        taskID: input.taskID,
        sessionID: input.rootSessionID,
        source: "task-queue-child-progress-positive-contract",
        directory: input.directory,
      })
      inFlight.progressSessionIDs = new Set([input.rootSessionID])
      current.inFlight.set(input.taskID, inFlight)
      processInFlight.set(input.taskID, inFlight)
      ensureProgressSubscription({ directory: input.directory, projectID: input.projectID })
      return () => {
        if (current.inFlight.get(input.taskID) === inFlight) current.inFlight.delete(input.taskID)
        if (processInFlight.get(input.taskID) === inFlight) processInFlight.delete(input.taskID)
        releaseProgressEpochIfIdle(input.taskID)
        inFlight.authority.settle()
        releaseProgressSubscriptionIfIdle(current)
      }
    },
    trackRecoverableExecution(input: {
      taskID: string
      physicalSettlement: Promise<void>
    }): Promise<RuntimeExecutionHandoffCancellation | undefined> {
      const task = Database.use((db) => db.select().from(TaskQueueTable).where(eq(TaskQueueTable.id, input.taskID)).get())
      if (!task || task.status !== "running") {
        throw new Error(`Recoverable queue test execution requires running row ${input.taskID}`)
      }
      const current = state()
      if (current.inFlight.has(task.id)) throw new Error(`Queue execution ${task.id} is already in flight`)
      const inFlight = createInFlightTask({
        taskID: task.id,
        sessionID: task.session_id,
        source: task.source,
        directory: Instance.directory,
      })
      let settleDisposition!: (value: RuntimeExecutionHandoffCancellation | undefined) => void
      const disposition = new Promise<RuntimeExecutionHandoffCancellation | undefined>((resolve) => {
        settleDisposition = resolve
      })
      let running!: Promise<void>
      current.inFlight.set(task.id, inFlight)
      processInFlight.set(task.id, inFlight)
      running = input.physicalSettlement
        .then(() => {
          assertInFlightNotCancelled(task, inFlight)
          settleDisposition(undefined)
        })
        .catch(async (error) => {
          settleDisposition(await settleExecutionFailure(task, inFlight, error))
        })
        .finally(() => {
          if (current.inFlight.get(task.id)?.promise === running) current.inFlight.delete(task.id)
          if (processInFlight.get(task.id)?.promise === running) processInFlight.delete(task.id)
          releaseProgressEpochIfIdle(task.id)
          if (Instance.current() && inFlight.cancellationOrigin?.source !== "process.shutdown") {
            requestDrain(`recoverable queue execution ${task.id} settled`)
          }
        })
      inFlight.promise = running
      inFlight.authority.settleWith(running)
      return disposition
    },
    async recoverAt(now: number): Promise<number> {
      return recover(now)
    },
    async waitForRecoveryCancellation(taskID: string): Promise<string> {
      const deadline = Date.now() + 5_000
      while (Date.now() < deadline) {
        const reason = state().inFlight.get(taskID)?.cancellationReason
        if (reason) return reason
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
      throw new Error(`Queue execution ${taskID} did not receive recovery cancellation`)
    },
    completeRunning(taskID: string): boolean {
      const task = Database.use((db) => db.select().from(TaskQueueTable).where(eq(TaskQueueTable.id, taskID)).get())
      if (!task) throw new Error(`Queue task not found: ${taskID}`)
      return complete(task) !== undefined
    },
    async failRunning(taskID: string, error: Error): Promise<void> {
      const task = Database.use((db) => db.select().from(TaskQueueTable).where(eq(TaskQueueTable.id, taskID)).get())
      if (!task) throw new Error(`Queue task not found: ${taskID}`)
      await fail(task, error)
    },
  }

  export type QueuedTaskStatus = {
    taskID: string
    sessionID: string
    status: "queued" | "running" | "completed" | "failed"
    source: string
    prompt: string
    error: string | null
    startedAt: number | null
    completedAt: number | null
    updatedAt: number
  }

  export function getStatus(input: { sessionID: string; taskID: string; source: string }): QueuedTaskStatus | null {
    const row = Database.use((db) =>
      db
        .select()
        .from(TaskQueueTable)
        .where(
          and(
            eq(TaskQueueTable.id, input.taskID),
            eq(TaskQueueTable.session_id, input.sessionID),
            eq(TaskQueueTable.source, input.source),
          ),
        )
        .get(),
    )
    return row ? queuedTaskStatusFromRow(row) : null
  }

  export function getStatusByID(taskID: string): QueuedTaskStatus | null {
    const row = Database.use((db) => db.select().from(TaskQueueTable).where(eq(TaskQueueTable.id, taskID)).get())
    return row ? queuedTaskStatusFromRow(row) : null
  }

  function queuedTaskStatusFromRow(row: QueueTaskRow): QueuedTaskStatus {
    return {
      taskID: row.id,
      sessionID: row.session_id,
      status: row.status,
      source: row.source,
      prompt: row.prompt,
      error: row.error_message ?? null,
      startedAt: row.time_started ?? null,
      completedAt: row.time_completed ?? null,
      updatedAt: row.time_updated,
    }
  }

  export async function executePrompt(
    raw: { sessionID: string; prompt: unknown; source?: string },
    hooks?: { beforeLoop?: (signal?: AbortSignal) => void | Promise<void>; signal?: AbortSignal },
  ) {
    const input = z
      .object({
        sessionID: Identifier.schema("session"),
        prompt: z.unknown(),
        source: z.string().optional(),
      })
      .parse(raw)
    await assertSessionLineageInCurrentProject(input.sessionID)
    const prompt = stampTaskQueueWakeReason(
      validateQueuedPromptMaterialization(input.sessionID, promptSchema().parse(input.prompt), "new"),
      { queueSource: input.source },
    )
    const promptInput = {
      sessionID: input.sessionID,
      ...prompt,
    }
    if (hooks) return SessionPrompt.prompt(promptInput, hooks)
    return SessionPrompt.prompt(promptInput)
  }

  export async function executeCompaction(
    raw: z.input<typeof ExecuteCompactionInput>,
    hooks?: { beforeLoop?: (signal?: AbortSignal) => void | Promise<void>; signal?: AbortSignal },
  ) {
    const input = ExecuteCompactionInput.parse(raw)
    const session = await assertSessionLineageInCurrentProject(input.sessionID)
    const source = await compactionSource(input.sessionID, input.sourceUserMessageID)
    const { SessionCompaction } = await import("@/session/compaction")
    await SessionCompaction.create({
      sessionID: input.sessionID,
      source,
      model: input.model,
      auto: input.auto,
      overflow: input.overflow,
      focus: input.focus,
    })
    return SessionContext.provide(session, () =>
      provideInitializedProjectExecution({
        directory: session.directory,
        signal: hooks?.signal,
        fn: async () => {
          hooks?.signal?.throwIfAborted()
          const beforeLoop = hooks?.beforeLoop?.(hooks.signal)
          if (beforeLoop) await beforeLoop
          hooks?.signal?.throwIfAborted()
          return SessionPrompt.loop(
            input.auto ? { sessionID: input.sessionID } : { sessionID: input.sessionID, result_mode: "summary" },
          )
        },
      }),
    )
  }

  export function enqueueCompaction(raw: z.input<typeof EnqueueCompactionInput>) {
    const input = EnqueueCompactionInput.parse(raw)
    const id = Identifier.ascending("task")
    const now = Date.now()
    const payload = StoredCompactionInput.parse({
      sourceUserMessageID: input.sourceUserMessageID,
      model: input.model,
      auto: input.auto,
      overflow: input.overflow,
      focus: input.focus,
    })
    Database.transaction((db) => {
      db
        .insert(TaskQueueTable)
        .values({
          id,
          session_id: input.sessionID,
          prompt: compactionPrompt(payload),
          priority: input.priority ?? "normal",
          status: "queued",
          source: input.source ?? "api",
          metadata: {
            kind: "session_compaction",
            input: payload,
          },
          time_created: now,
          time_updated: now,
        })
        .run()
      publishQueueChangedInTransaction({
        queueTaskID: id,
        sessionID: input.sessionID,
        status: "queued",
        sequence: now,
      })
    })
    log.info("compaction task queued", { id, sessionID: input.sessionID, source: input.source ?? "api" })
    requestDrain("enqueueCompaction")
    return id
  }

  export async function enqueuePromptAfterPersistingUserMessage(raw: z.input<typeof EnqueuePromptInput>) {
    const input = EnqueuePromptInput.parse(raw)
    const id = Identifier.ascending("task")
    const prompt = stampTaskQueueWakeReason(
      validateQueuedPromptMaterialization(input.sessionID, promptSchema().parse(input.prompt), "new"),
      { queueTaskID: id, queueSource: input.source ?? "api" },
    )
    const now = Date.now()
    const userMessage = await SessionPrompt.prompt(
      {
        sessionID: input.sessionID,
        ...prompt,
        noReply: true,
      },
      {
        commitBundle: (message) => {
          Database.use((db) =>
            db
              .insert(TaskQueueTable)
              .values({
                id,
                session_id: input.sessionID,
                prompt: firstText(prompt),
                priority: input.priority ?? "normal",
                status: "queued",
                source: input.source ?? "api",
                metadata: {
                  kind: "session_wake",
                  messageID: message.id,
                  input: { ...prompt },
                },
                time_created: now,
                time_updated: now,
              })
              .run(),
          )
          publishQueueChangedInTransaction({
            queueTaskID: id,
            sessionID: input.sessionID,
            status: "queued",
            sequence: now,
          })
        },
      },
    )
    log.info("task queued after visible user message persisted", {
      id,
      sessionID: input.sessionID,
      messageID: userMessage.info.id,
      source: input.source ?? "api",
    })
    requestDrain("enqueuePromptAfterPersistingUserMessage")
    return { taskID: id, userMessage }
  }

  export function cancelSessionPrompts(input: {
    sessionIDs: string[]
    reason: string
    origin: Omit<ExecutionCancellationOrigin, "targetSessionID">
    source?: string
  }): number {
    const sessionIDs = normalizeSessionIDs(input.sessionIDs)
    if (sessionIDs.length === 0) return 0
    const now = Date.now()
    const reason = input.reason
    const cancelledRows = Database.transaction((db) => {
      const where: SQL[] = [inArray(TaskQueueTable.session_id, sessionIDs), eq(TaskQueueTable.status, "queued")]
      if (input.source) where.push(eq(TaskQueueTable.source, input.source))
      const rows = db
        .update(TaskQueueTable)
        .set({
          status: "failed",
          time_completed: now,
          error_message: reason,
          time_updated: now,
        })
        .where(and(...where))
        .returning({ id: TaskQueueTable.id, sessionID: TaskQueueTable.session_id })
        .all()
      for (const row of rows) {
        publishQueueChangedInTransaction({
          queueTaskID: row.id,
          sessionID: row.sessionID,
          status: "failed",
          sequence: now,
        })
      }
      return rows
    })
    if (Instance.current()) {
      for (const row of cancelledRows) clearRecoveryTimer(row.id)
    }
    const inFlightCancellations = requestInFlightCancellation({
      sessionIDs,
      reason,
      source: input.source,
      origin: input.origin,
    })
    return cancelledRows.length + inFlightCancellations
  }

  /** Project whether an exact Session owns queued or running prompt work. */
  export function sessionPromptsInterruptible(input: { sessionID: string; source?: string }): boolean {
    const where: SQL[] = [
      eq(TaskQueueTable.session_id, input.sessionID),
      inArray(TaskQueueTable.status, ["queued", "running"]),
    ]
    if (input.source) where.push(eq(TaskQueueTable.source, input.source))
    const row = Database.use((db) =>
      db
        .select({ id: TaskQueueTable.id })
        .from(TaskQueueTable)
        .where(and(...where))
        .limit(1)
        .get(),
    )
    return row !== undefined
  }

  export function failQueuedOrRunning(input: { taskIDs: string[]; reason: string }): number {
    const taskIDs = [...new Set(input.taskIDs.filter((id) => id.length > 0))]
    if (taskIDs.length === 0) return 0
    const candidates = Database.use((db) =>
      db
        .select({ id: TaskQueueTable.id, sessionID: TaskQueueTable.session_id, status: TaskQueueTable.status })
        .from(TaskQueueTable)
        .where(and(inArray(TaskQueueTable.id, taskIDs), inArray(TaskQueueTable.status, ["queued", "running"])))
        .all(),
    )
    const ownedRunning = candidates.filter((row) => row.status === "running" && processInFlight.has(row.id))
    const immediateIDs = candidates
      .filter((row) => row.status === "queued" || !processInFlight.has(row.id))
      .map((row) => row.id)
    const now = Date.now()
    const rows =
      immediateIDs.length === 0
        ? []
        : Database.transaction((db) => {
            const failed = db
              .update(TaskQueueTable)
              .set({
                status: "failed",
                error_message: input.reason,
                time_completed: now,
                time_updated: now,
              })
              .where(
                and(inArray(TaskQueueTable.id, immediateIDs), inArray(TaskQueueTable.status, ["queued", "running"])),
              )
              .returning({ id: TaskQueueTable.id, sessionID: TaskQueueTable.session_id })
              .all()
            for (const row of failed) {
              publishQueueChangedInTransaction({
                queueTaskID: row.id,
                sessionID: row.sessionID,
                status: "failed",
                sequence: now,
              })
            }
            return failed
          })
    if (Instance.current()) {
      for (const row of rows) clearRecoveryTimer(row.id)
      for (const row of ownedRunning) {
        clearRecoveryTimer(row.id)
        const inFlight = processInFlight.get(row.id)
        if (!inFlight) continue
        const origin = createExecutionCancellationOrigin({
          actor: "scheduler",
          source: "task.lifecycle",
          surface: "scheduler",
          requestID: row.id,
          reason: input.reason,
          targetSessionID: row.sessionID,
          queueOccurrenceID: row.id,
        })
        requestExecutionCancellation(inFlight, input.reason, origin)
      }
    }
    return rows.length + ownedRunning.length
  }

  export async function awaitSessionPromptsIdle(input: {
    sessionIDs: string[]
    source?: string
    inactivityTimeoutMs?: number
    signal?: AbortSignal
  }) {
    input.signal?.throwIfAborted()
    const sessionIDs = normalizeSessionIDs(input.sessionIDs)
    if (sessionIDs.length === 0) return
    if (!Instance.current()) return
    const sessions = new Set(sessionIDs)
    const inactivityTimeoutMs = input.inactivityTimeoutMs
    if (inactivityTimeoutMs !== undefined && (!Number.isInteger(inactivityTimeoutMs) || inactivityTimeoutMs <= 0)) {
      throw new Error(`awaitSessionPromptsIdle: invalid inactivityTimeoutMs ${inactivityTimeoutMs}`)
    }
    const pollMs =
      inactivityTimeoutMs === undefined ? 250 : Math.min(250, Math.max(25, Math.floor(inactivityTimeoutMs / 10)))
    let lastSignature = ""
    let idleDeadline = inactivityTimeoutMs === undefined ? undefined : Date.now() + inactivityTimeoutMs
    while (true) {
      input.signal?.throwIfAborted()
      const running = [...processInFlight.entries()]
        .filter(([, task]) => sessions.has(task.sessionID))
        .filter(([, task]) => !input.source || task.source === input.source)
      if (running.length === 0) {
        const stillRunning = Database.use((db) => {
          const where: SQL[] = [inArray(TaskQueueTable.session_id, sessionIDs), eq(TaskQueueTable.status, "running")]
          if (input.source) where.push(eq(TaskQueueTable.source, input.source))
          return db
            .select({ id: TaskQueueTable.id })
            .from(TaskQueueTable)
            .where(and(...where))
            .all()
        })
        if (stillRunning.length === 0) return
        throw new Error(
          `queue task(s) still running without an in-flight prompt: ${stillRunning.map((row) => row.id).join(", ")}`,
        )
      }
      if (inactivityTimeoutMs === undefined) {
        await awaitWithAbort(Promise.all(running.map(([, task]) => task.promise)), input.signal)
        continue
      }
      const signature = running
        .map(([id, task]) => {
          const status = SessionStatus.get(task.sessionID)
          const activity = SessionStatus.getActivity(task.sessionID)
          return [
            id,
            task.sessionID,
            task.cancellationReason ?? "",
            status.type,
            status.type === "terminal" ? status.reason : "",
            activity?.last_activity_at ?? 0,
          ].join(":")
        })
        .sort()
        .join("|")
      if (signature !== lastSignature) {
        lastSignature = signature
        idleDeadline = Date.now() + inactivityTimeoutMs
      }
      if (Date.now() > idleDeadline!) {
        throw new AwaitTimeoutError(
          `TaskQueueService.awaitSessionPromptsIdle inactive (${running.map(([id]) => id).join(", ")})`,
          inactivityTimeoutMs,
        )
      }
      await awaitWithAbort(
        Promise.race([
          Promise.allSettled(running.map(([, task]) => task.promise)),
          new Promise<void>((resolve) => setTimeout(resolve, pollMs)),
        ]),
        input.signal,
      )
    }
  }

  function normalizeSessionIDs(sessionIDs: string[]) {
    return [...new Set(sessionIDs.map((id) => String(id || "").trim()).filter(Boolean))]
  }

  function requestInFlightCancellation(input: {
    sessionIDs: string[]
    reason: string
    origin: Omit<ExecutionCancellationOrigin, "targetSessionID">
    source?: string
  }) {
    if (!Instance.current()) return 0
    const sessions = new Set(input.sessionIDs)
    let cancelled = 0
    for (const task of processInFlight.values()) {
      if (!sessions.has(task.sessionID)) continue
      if (input.source && task.source !== input.source) continue
      const origin = { ...input.origin, targetSessionID: task.sessionID }
      requestExecutionCancellation(task, input.reason, origin)
      cancelled += 1
    }
    return cancelled
  }

  function assertInFlightNotCancelled(task: typeof TaskQueueTable.$inferSelect, inFlight: InFlightTask) {
    if (!inFlight.cancellationReason) return
    throw new Error(inFlight.cancellationReason || `queue task ${task.id} cancelled`)
  }

  function requestDrain(reason: string) {
    const directory = Instance.directory
    void runTaskQueueOwner(directory, () => drainUntilIdle(reason)).catch((error) => {
      log.error("explicit queue drain failed", {
        reason,
        error: message(error),
      })
    })
  }

  async function drainUntilIdle(reason: string) {
    const directory = Instance.directory
    while (true) {
      const started = await drainReadyTasks(reason)
      const running = [...processInFlight.values()]
        .filter((task) => task.directory === directory)
        .map((task) => task.promise)
      if (started.length === 0 && running.length === 0) return
      await waitForNextDrainSettlement(started, running)
    }
  }

  function waitForNextDrainSettlement(started: Promise<void>[], running: Promise<void>[]): Promise<void> {
    const operations = [...new Set([...started, ...running])]
    return Promise.race(operations.map((operation) => operation.catch(() => undefined)))
  }

  async function drainReadyTasks(reason: string) {
    const current = state()
    if (!current.acceptingDrain) throw new RuntimeExecutionAdmissionClosedError("task_queue")
    if (current.draining) {
      return current.activeDrain ? await current.activeDrain : []
    }
    const generation = current.generation
    current.draining = true
    const activeDrain = run(Date.now(), reason, current, generation)
    current.activeDrain = activeDrain
    processActiveDrains.set(activeDrain, { directory: Instance.directory })
    processSettlementGate?.drains.add(activeDrain)
    try {
      return await activeDrain
    } finally {
      processActiveDrains.delete(activeDrain)
      if (current.activeDrain === activeDrain) {
        current.activeDrain = undefined
        current.draining = false
      }
    }
  }

  function assertDrainAuthority(current: ReturnType<typeof state>, generation: number): void {
    if (!current.acceptingDrain || current.generation !== generation) {
      throw new RuntimeExecutionAdmissionClosedError("task_queue")
    }
  }

  async function run(
    now: number,
    reason: string,
    current: ReturnType<typeof state>,
    generation: number,
  ): Promise<Promise<void>[]> {
    await recover(now)
    assertDrainAuthority(current, generation)
    const limit = Math.max(0, concurrency() - current.inFlight.size)
    if (limit === 0) return []
    const started = await claimAndStartReadyTasks(limit, current, generation)
    if (started.length > 0) {
      log.info("claimed queued tasks", { count: started.length, projectID: Instance.project.id, reason })
    }
    return started
  }

  function startClaimedExecution(
    task: QueueTaskRow,
    inFlight: InFlightTask,
    current: ReturnType<typeof state>,
  ): Promise<void> {
    let running!: Promise<void>
    current.inFlight.set(task.id, inFlight)
    processInFlight.set(task.id, inFlight)
    running = execute(task, inFlight)
      .catch(async (error) => {
        try {
          await settleExecutionFailure(
            task,
            inFlight,
            inFlight.cancellationReason ? new Error(inFlight.cancellationReason) : error,
          )
        } catch (failError) {
          log.error("task failure handler failed", {
            id: task.id,
            sessionID: task.session_id,
            originalError: message(error),
            error: message(failError),
          })
        }
      })
      .finally(() => {
        if (current.inFlight.get(task.id)?.promise === running) {
          current.inFlight.delete(task.id)
          if (processInFlight.get(task.id) === inFlight) processInFlight.delete(task.id)
          releaseProgressEpochIfIdle(task.id)
        }
        releaseProgressSubscriptionIfIdle(current)
        if (Instance.current() && inFlight.cancellationOrigin?.source !== "process.shutdown") {
          requestDrain(`queue execution ${task.id} settled`)
        }
      })
    inFlight.promise = running
    inFlight.authority.settleWith(running)
    return running
  }

  async function claimAndStartReadyTasks(
    limit: number,
    current: ReturnType<typeof state>,
    generation: number,
  ): Promise<Promise<void>[]> {
    const started: Promise<void>[] = []
    while (started.length < limit) {
      const queued = pending(limit - started.length)
      if (queued.length === 0) break
      for (const item of queued) {
        const valid = await assertSessionLineageInCurrentProject(item.session_id).catch(async (error) => {
          await failQueued(item.id, item.session_id, error)
          return undefined
        })
        if (!valid) continue
        await beforeQueueClaimReservationForTest?.(item.id)
        assertDrainAuthority(current, generation)
        const inFlight = createInFlightTask({
          taskID: item.id,
          sessionID: item.session_id,
          source: "claim-pending",
          directory: Instance.directory,
        })
        try {
          inFlight.authority.signal.throwIfAborted()
          const task = claim(item.id, item.session_id)
          if (!task) {
            inFlight.authority.settle()
            continue
          }
          inFlight.source = task.source
          const running = startClaimedExecution(task, inFlight, current)
          try {
            scheduleRunningRecoveryTimer(task, "claim")
          } catch (error) {
            log.error("Task Queue claim recovery timer failed after execution owner binding", {
              id: task.id,
              sessionID: task.session_id,
              error: message(error),
            })
          }
          started.push(running)
        } catch (error) {
          inFlight.authority.settle()
          throw error
        }
        if (started.length >= limit) break
      }
    }
    return started
  }

  async function claimReadyTasks(
    limit: number,
    validateSession: (sessionID: string) => Promise<Session.Info> = assertSessionLineageInCurrentProject,
  ): Promise<QueueTaskRow[]> {
    const current = state()
    const generation = current.generation
    assertDrainAuthority(current, generation)
    const list: Array<typeof TaskQueueTable.$inferSelect> = []
    while (list.length < limit) {
      const queued = pending(limit - list.length)
      if (queued.length === 0) break
      for (const item of queued) {
        const valid = await validateSession(item.session_id).catch(async (error) => {
          await failQueued(item.id, item.session_id, error)
          return undefined
        })
        if (!valid) continue
        assertDrainAuthority(current, generation)
        const task = claim(item.id, item.session_id)
        if (!task) continue
        list.push(task)
        if (list.length >= limit) break
      }
    }
    return list
  }

  function concurrency() {
    const raw = process.env[CONCURRENCY_ENV]
    if (!raw) return CONCURRENCY_LIMIT
    const value = Number(raw)
    if (!Number.isFinite(value)) return CONCURRENCY_LIMIT
    if (value < 1) return 1
    return Math.min(Math.floor(value), CONCURRENCY_LIMIT)
  }

  function pending(limit: number) {
    const now = Date.now()
    const capacity = concurrency()
    const runningCount = projectRunningTaskCount(Instance.project.id)
    const priorityRank = effectivePriorityRank(
      sql`${TaskQueueTable.priority}`,
      sql`${TaskQueueTable.time_created}`,
      now,
    )
    return Database.use((db) => {
      const rows = db
        .select({
          id: TaskQueueTable.id,
          session_id: TaskQueueTable.session_id,
          running_count: runningCount,
        })
        .from(TaskQueueTable)
        .where(
          sql`${TaskQueueTable.status} = 'queued'
            AND ${TaskQueueTable.session_id} IN (
              SELECT ${SessionTable.id}
              FROM ${SessionTable}
              WHERE ${SessionTable.project_id} = ${Instance.project.id}
            )
            AND NOT EXISTS (
              SELECT 1
              FROM a2a_task_queue running
              WHERE running.session_id = ${TaskQueueTable.session_id}
                AND running.status = 'running'
            )
            AND ${runningCount} < ${capacity}
            AND ${isBestQueuedTaskForSession(now)}`,
        )
        .orderBy(
          priorityRank,
          TaskQueueTable.time_created,
          TaskQueueTable.id,
        )
        .limit(limit)
        .all()
      const available = Math.max(0, capacity - Number(rows[0]?.running_count ?? capacity))
      return rows.slice(0, Math.min(limit, available)).map(({ id, session_id }) => ({ id, session_id }))
    })
  }

  function claim(id: string, sessionID: string) {
    const now = Date.now()
    const capacity = concurrency()
    const runningCount = projectRunningTaskCount(Instance.project.id)
    const task = Database.use((db) =>
      db
        .update(TaskQueueTable)
        .set({
          status: "running",
          time_started: now,
          time_completed: null,
          error_message: null,
          time_updated: now,
        })
        .where(
          sql`${TaskQueueTable.id} = ${id}
            AND ${TaskQueueTable.session_id} = ${sessionID}
            AND ${TaskQueueTable.status} = 'queued'
            AND NOT EXISTS (
              SELECT 1
              FROM a2a_task_queue running
              WHERE running.session_id = ${sessionID}
                AND running.status = 'running'
                AND running.id != ${id}
            )
            AND ${TaskQueueTable.session_id} IN (
              SELECT ${SessionTable.id}
              FROM ${SessionTable}
              WHERE ${SessionTable.project_id} = ${Instance.project.id}
            )
            AND ${runningCount} < ${capacity}
            AND ${isBestQueuedTaskForSession(now)}`,
        )
        .returning()
        .get(),
    )
    return task
  }

  function projectRunningTaskCount(projectID: string): SQL {
    return sql`(
      SELECT COUNT(*)
      FROM ${TaskQueueTable} project_running
      INNER JOIN ${SessionTable} project_running_session
        ON project_running_session.id = project_running.session_id
      WHERE project_running.status = 'running'
        AND project_running_session.project_id = ${projectID}
    )`
  }

  function effectivePriorityRank(priority: SQL, timeCreated: SQL, now: number): SQL {
    const normalPromotionAt = now - 30_000
    const lowNormalPromotionAt = now - 30_000
    const lowHighPromotionAt = now - 60_000
    return sql`CASE
      WHEN ${priority} = 'high' THEN 0
      WHEN ${priority} = 'normal' AND ${timeCreated} <= ${normalPromotionAt} THEN 0
      WHEN ${priority} = 'normal' THEN 1
      WHEN ${priority} = 'low' AND ${timeCreated} <= ${lowHighPromotionAt} THEN 0
      WHEN ${priority} = 'low' AND ${timeCreated} <= ${lowNormalPromotionAt} THEN 1
      WHEN ${priority} = 'low' THEN 2
      ELSE 3
    END`
  }

  function isBestQueuedTaskForSession(now: number): SQL {
    const betterRank = effectivePriorityRank(sql`better.priority`, sql`better.time_created`, now)
    const currentRank = effectivePriorityRank(
      sql`${TaskQueueTable.priority}`,
      sql`${TaskQueueTable.time_created}`,
      now,
    )
    return sql`NOT EXISTS (
      SELECT 1
      FROM a2a_task_queue better
      WHERE better.session_id = ${TaskQueueTable.session_id}
        AND better.status = 'queued'
        AND (
          ${betterRank} < ${currentRank}
          OR (
            ${betterRank} = ${currentRank}
            AND (
              better.time_created < ${TaskQueueTable.time_created}
              OR (
                better.time_created = ${TaskQueueTable.time_created}
                AND better.id < ${TaskQueueTable.id}
              )
            )
          )
        )
    )`
  }

  function ensureProgressSubscription(input: { directory: string; projectID: string }) {
    const current = state()
    if (current.progressListener) return
    const handler = (envelope: QueueProgressEnvelope) => {
      const event = envelope.payload
      if (!event || typeof event.type !== "string") return
      if (event.type === Session.Event.Created.type) {
        const info = event.properties?.info
        if (
          !info ||
          typeof info.id !== "string" ||
          typeof info.projectID !== "string" ||
          info.projectID !== input.projectID ||
          typeof info.parentID !== "string"
        ) {
          return
        }
        for (const [taskID, task] of current.inFlight) {
          if (!task.progressSessionIDs?.has(info.parentID)) continue
          task.progressSessionIDs.add(info.id)
          observeTaskProgress(taskID, task, input.directory, info.id)
        }
        return
      }
      if (event.type !== Message.Event.PartDelta.type && event.type !== Message.Event.PartUpdated.type) return
      const properties = event.properties ?? {}
      const sessionID =
        (typeof properties.sessionID === "string" && properties.sessionID) ||
        (typeof properties.part === "object" &&
          properties.part &&
          typeof properties.part.sessionID === "string" &&
          properties.part.sessionID) ||
        undefined
      if (!sessionID) return
      for (const [taskID, task] of current.inFlight) {
        if (!task.progressSessionIDs?.has(sessionID)) continue
        observeTaskProgress(taskID, task, input.directory)
      }
    }
    current.progressListener = handler
    GlobalBus.on("event", handler)
  }

  function observeTaskProgress(taskID: string, task: InFlightTask, directory: string, childSessionID?: string) {
    const progressEpoch = ++progressEpochSequence
    observedProgressEpochs.set(taskID, progressEpoch)
    ensureProgressTouchOwner(taskID, task, directory, childSessionID)
  }

  function ensureProgressTouchOwner(
    taskID: string,
    task: InFlightTask,
    directory: string,
    childSessionID?: string,
  ): void {
    if (progressTouchOwners.has(taskID)) return
    let owner!: Promise<void>
    owner = runTaskQueueOwner(directory, async () => {
      await beforeProgressTouchForTest?.({
        taskID,
        progressEpoch: observedProgressEpochs.get(taskID) ?? 0,
      })
      const progressEpoch = observedProgressEpochs.get(taskID) ?? 0
      touch(taskID)
      durableProgressEpochs.set(taskID, progressEpoch)
    })
      .catch((error) => {
        // A failed durable touch must not become a permanent process-local
        // liveness shadow. Restore the observed fact to the last epoch that
        // actually reached storage; the next real progress gets a fresh epoch.
        observedProgressEpochs.set(taskID, durableProgressEpochs.get(taskID) ?? 0)
        log.warn(childSessionID ? "task child Session creation touch failed" : "task progress touch failed", {
          id: taskID,
          sessionID: task.sessionID,
          ...(childSessionID ? { childSessionID } : {}),
          error: message(error),
        })
      })
      .finally(() => {
        if (progressTouchOwners.get(taskID) !== owner) return
        progressTouchOwners.delete(taskID)
        if (
          processInFlight.has(taskID) &&
          (observedProgressEpochs.get(taskID) ?? 0) > (durableProgressEpochs.get(taskID) ?? 0)
        ) {
          ensureProgressTouchOwner(taskID, task, directory)
          return
        }
        releaseProgressEpochIfIdle(taskID)
      })
    progressTouchOwners.set(taskID, owner)
  }

  function releaseProgressEpochIfIdle(taskID: string): void {
    if (processInFlight.has(taskID) || progressTouchOwners.has(taskID)) return
    observedProgressEpochs.delete(taskID)
    durableProgressEpochs.delete(taskID)
  }

  function recoveryStillOwnsProgressEpoch(taskID: string, observedEpoch: number): boolean {
    const current = observedProgressEpochs.get(taskID) ?? 0
    const durable = durableProgressEpochs.get(taskID) ?? 0
    return current === observedEpoch && current === durable
  }

  function releaseProgressSubscriptionIfIdle(current: ReturnType<typeof state>) {
    if (current.inFlight.size > 0 || !current.progressListener) return
    GlobalBus.off("event", current.progressListener)
    current.progressListener = undefined
  }

  async function execute(task: typeof TaskQueueTable.$inferSelect, inFlight: InFlightTask) {
    const queueDirectory = Instance.directory
    inFlight.promptOwner ??= SessionPrompt.promptOwner(task.session_id)
    await assertSessionLineageInCurrentProject(task.session_id)
    inFlight.promptOwner = SessionPrompt.promptOwner(task.session_id) ?? inFlight.promptOwner
    const queueProjectID = Instance.project.id
    const progressSessionIDs = new Set(
      await Session.treeInProject({
        sessionID: task.session_id,
        projectID: queueProjectID,
      }),
    )
    const metadata = RawTaskMetadata.safeParse(task.metadata)
    if (!metadata.success) {
      throw new Error("invalid queue metadata")
    }
    // Chunk-driven heartbeat: touch() only fires when the queued prompt's
    // durable session tree makes progress (message.part.delta /
    // message.part.updated). The initial tree comes from Session.treeInProject;
    // authoritative session.created events extend the task-local membership
    // while execution is live. This replaces the old exact-root filter, which
    // cancelled a parent prompt after the inactivity window even while its
    // delegated child Agent was actively streaming. It also preserves the
    // removal of the unconditional setInterval(touch, 15s), which masked a
    // genuinely dead upstream stream. One shared subscription per active
    // Project queue multiplexes progress across all in-flight tasks, so the
    // supported 100-way concurrency does not create 100 EventEmitter
    // listeners. GlobalBus covers worktree Instances too (session lives in
    // one, executor in another).
    inFlight.progressSessionIDs = progressSessionIDs
    ensureProgressSubscription({ directory: queueDirectory, projectID: queueProjectID })
    const cleanup = () => {
      inFlight.progressSessionIDs = undefined
    }
    inFlight.cleanup = cleanup
    const beforeLoop = () => enterQueuePromptLoop(task, inFlight, queueDirectory)
    try {
      assertInFlightNotCancelled(task, inFlight)
      await SessionPrompt.withPromptOwnerCapture(
        (owner) => {
          inFlight.promptOwner = owner
          if (inFlight.cancellationReason && inFlight.cancellationOrigin) {
            SessionPrompt.cancelOwned(task.session_id, queueDirectory, owner, {
              origin: inFlight.cancellationOrigin,
            })
          }
        },
        async () => {
          let result: Message.WithParts
          if (metadata.data.kind === "session_wake") {
            result = await executeSessionWake(task.session_id, metadata.data.messageID, {
              beforeLoop,
              signal: inFlight.authority.signal,
            })
          } else {
            result = await executeCompaction(
              {
                sessionID: task.session_id,
                ...StoredCompactionInput.parse(metadata.data.input),
              },
              {
                beforeLoop,
                signal: inFlight.authority.signal,
              },
            )
          }
          if (result.info.role === "assistant" && (result.info.error !== undefined || result.info.finish === "error")) {
            throw new SessionPromptReplyError(task.session_id, result.info.id, result.info.error)
          }
        },
      )
      assertInFlightNotCancelled(task, inFlight)
    } catch (error) {
      cleanup()
      if (inFlight.promptOwner) {
        const settlement = SessionPrompt.cancelOwned(task.session_id, queueDirectory, inFlight.promptOwner, {
          origin: createExecutionCancellationOrigin({
            actor: "runtime",
            source: "runtime.prompt_owner",
            surface: "scheduler",
            requestID: task.id,
            reason: message(error),
            targetSessionID: task.session_id,
            queueOccurrenceID: task.id,
          }),
        })
        await (settlement?.finished ??
          SessionPrompt.waitForOwnedFinish(task.session_id, queueDirectory, inFlight.promptOwner))
        SessionPrompt.clearCancellationReceipt(task.session_id, inFlight.promptOwner)
      }
      throw error
    }
    cleanup()
    const now = Date.now()
    const completed = complete(task, now)
    if (!completed) {
      log.info("task finished after queue row was no longer running", { id: task.id, sessionID: task.session_id })
      return
    }
    clearRecoveryTimer(task.id)
    log.info("task completed", { id: task.id, sessionID: task.session_id })
  }

  async function executeSessionWake(
    sessionID: string,
    messageID: string,
    hooks?: { beforeLoop?: (signal?: AbortSignal) => void | Promise<void>; signal?: AbortSignal },
  ) {
    const session = await assertSessionLineageInCurrentProject(sessionID)
    return SessionContext.provide(session, () =>
      provideInitializedProjectExecution({
        directory: session.directory,
        signal: hooks?.signal,
        fn: async () => {
          hooks?.signal?.throwIfAborted()
          const beforeLoop = hooks?.beforeLoop?.(hooks.signal)
          if (beforeLoop) await beforeLoop
          hooks?.signal?.throwIfAborted()
          return SessionPrompt.loop({ sessionID, reply_to_message_id: messageID })
        },
      }),
    )
  }

  async function recover(now: number) {
    const timeout = await runTimeout()
    const stale = Database.use((db) =>
      db
        .select()
        .from(TaskQueueTable)
        .where(
          sql`${TaskQueueTable.status} = 'running'
            AND (
              ${TaskQueueTable.time_updated} <= ${now - timeout}
              OR (
                ${TaskQueueTable.time_updated} IS NULL
                AND ${TaskQueueTable.time_started} <= ${now - timeout}
              )
            )
            AND ${TaskQueueTable.session_id} IN (
              SELECT ${SessionTable.id}
              FROM ${SessionTable}
              WHERE ${SessionTable.project_id} = ${Instance.project.id}
            )`,
        )
        .all()
        .map((task) => ({
          task,
          observedProgressEpoch: observedProgressEpochs.get(task.id) ?? 0,
        })),
    )
    if (stale.length === 0) return 0
    let recovered = 0
    for (const candidate of stale) {
      const { task, observedProgressEpoch } = candidate
      if (!recoveryStillOwnsProgressEpoch(task.id, observedProgressEpoch)) continue
      const session = await assertSessionLineageInCurrentProject(task.session_id).catch(async (error) => {
        await fail(task, error)
        return undefined
      })
      if (!session) continue
      if (!recoveryStillOwnsProgressEpoch(task.id, observedProgressEpoch)) continue
      const inFlight = processInFlight.get(task.id)
      const cancellationReason = "task timed out while running"
      const cancellationOrigin = createExecutionCancellationOrigin({
        actor: "scheduler",
        source: "task.queue_timeout",
        surface: "scheduler",
        requestID: task.id,
        reason: cancellationReason,
        targetSessionID: session.id,
        queueOccurrenceID: task.id,
      })
      const promptCancelled = Boolean(inFlight?.promptOwner)
      if (inFlight) {
        requestExecutionCancellation(inFlight, cancellationReason, cancellationOrigin)
        // The persisted running claim remains the concurrency authority until
        // the exact physical executor (including prompt cleanup and failure
        // publication) has settled.  Releasing it here would let the next row
        // for the same Session start while the cancelled executor still owns
        // resources.
        void inFlight.promise
          .then(() => {
            clearRecoveryTimer(task.id)
            log.warn("settled stale running task after inactivity cancellation", {
              id: task.id,
              sessionID: task.session_id,
              promptCancelled,
            })
          })
          .catch((error) => {
            log.error("stale running task settlement observer failed", {
              id: task.id,
              sessionID: task.session_id,
              error: message(error),
            })
          })
        continue
      }
      const failed = Database.transaction((db) => {
        const row = db
          .update(TaskQueueTable)
          .set({
            status: "failed",
            time_completed: now,
            error_message: cancellationReason,
            time_updated: now,
          })
          .where(and(eq(TaskQueueTable.id, task.id), eq(TaskQueueTable.status, "running")))
          .returning({ id: TaskQueueTable.id })
          .get()
        if (row) {
          publishQueueChangedInTransaction({
            queueTaskID: task.id,
            sessionID: task.session_id,
            status: "failed",
            sequence: now,
          })
        }
        return row
      })
      if (!failed) continue
      recovered += 1
      clearRecoveryTimer(task.id)
      log.warn("marked stale running task failed after inactivity", {
        id: task.id,
        sessionID: task.session_id,
      })
      log.warn("cancelled stale running session prompt after inactivity", {
        id: task.id,
        sessionID: task.session_id,
        promptCancelled,
      })
    }
    return recovered
  }

  /**
   * A persisted `running` value describes the previous process's claim; it is
   * not proof that an executor is live in this process. Project bootstrap
   * releases every claim that has no real in-memory owner immediately.
   */
  function requeueOwnerlessRunningRows(): number {
    const current = state()
    const rows = Database.use((db) =>
      db
        .select({ id: TaskQueueTable.id, sessionID: TaskQueueTable.session_id })
        .from(TaskQueueTable)
        .where(
          sql`${TaskQueueTable.status} = 'running'
            AND ${TaskQueueTable.session_id} IN (
              SELECT ${SessionTable.id}
              FROM ${SessionTable}
              WHERE ${SessionTable.project_id} = ${Instance.project.id}
            )`,
        )
        .all(),
    )
    const ownerless = rows.filter((row) => !processInFlight.has(row.id))
    if (ownerless.length === 0) return 0
    const ids = ownerless.map((row) => row.id)
    const now = Date.now()
    const released = Database.transaction((db) => {
      const rows = db
        .update(TaskQueueTable)
        .set({
          status: "queued",
          time_started: null,
          time_completed: null,
          error_message: null,
          time_updated: now,
        })
        .where(and(inArray(TaskQueueTable.id, ids), eq(TaskQueueTable.status, "running")))
        .returning({ id: TaskQueueTable.id })
        .all()
      for (const row of ownerless) {
        if (!rows.some((releasedRow) => releasedRow.id === row.id)) continue
        publishQueueChangedInTransaction({
          queueTaskID: row.id,
          sessionID: row.sessionID,
          status: "queued",
          sequence: now,
        })
      }
      return rows
    })
    for (const row of released) clearRecoveryTimer(row.id)
    if (released.length > 0) {
      log.warn("released ownerless persisted queue claims after runtime restart", {
        taskIDs: released.map((row) => row.id),
      })
    }
    return released.length
  }

  async function assertSessionLineageInCurrentProject(sessionID: string): Promise<Session.Info> {
    return Session.assertLineageInProject({ sessionID, projectID: Instance.project.id })
  }

  function complete(task: Pick<QueueTaskRow, "id" | "session_id">, now = Date.now()) {
    return Database.transaction((db) => {
      const row = db
        .update(TaskQueueTable)
        .set({
          status: "completed",
          time_completed: now,
          error_message: null,
          time_updated: now,
        })
        .where(and(eq(TaskQueueTable.id, task.id), eq(TaskQueueTable.status, "running")))
        .returning({ id: TaskQueueTable.id })
        .get()
      if (row) {
        Bus.publishOwnedInTransaction(TaskQueueEvent.Completed, {
          queueTaskID: task.id,
          sessionID: task.session_id,
        })
      }
      return row
    })
  }

  async function fail(task: QueueTaskRow, error: unknown) {
    const now = Date.now()
    const errorMessage = message(error)
    const publishTerminal = SessionStatus.get(task.session_id).type !== "terminal"
    const occurrence = publishTerminal ? SessionStatus.executionOccurrence(task.session_id) : undefined
    const terminalStatus = { type: "terminal", reason: "error", error: errorMessage } as const
    const failed = Database.transaction((db) => {
      const row = db
        .update(TaskQueueTable)
        .set({
          status: "failed",
          time_completed: now,
          error_message: errorMessage,
          time_updated: now,
        })
        .where(and(eq(TaskQueueTable.id, task.id), eq(TaskQueueTable.status, "running")))
        .returning({ id: TaskQueueTable.id })
        .get()
      if (!row) return undefined
      publishQueueChangedInTransaction({
        queueTaskID: task.id,
        sessionID: task.session_id,
        status: "failed",
        sequence: now,
      })
      if (publishTerminal) {
        Bus.publishOwnedInTransaction(Session.Event.Error, {
          sessionID: task.session_id,
          orderKey: sessionLifecycleOrderKey(task.session_id),
          error: new NamedError.Unknown({ message: errorMessage }).toObject(),
        })
        if (occurrence) {
          Bus.publishOwnedInTransaction(SessionStatus.Event.Status, {
            sessionID: task.session_id,
            inputMessageID: occurrence.inputMessageID,
            orderKey: executionLifecycleOrderKey(task.session_id, occurrence.inputMessageID),
            status: terminalStatus,
          })
        }
      }
      return row
    })
    if (!failed) {
      log.info("task failed after queue row was no longer running", {
        id: task.id,
        sessionID: task.session_id,
        error: message(error),
      })
      return
    }
    clearRecoveryTimer(task.id)
    if (publishTerminal && occurrence) {
      await SessionStatus.set(task.session_id, terminalStatus, {
        publish: false,
        inputMessageID: occurrence.inputMessageID,
      })
    }
    log.error("task failed", {
      id: task.id,
      sessionID: task.session_id,
      error: message(error),
    })
  }

  async function settleExecutionFailure(
    task: QueueTaskRow,
    inFlight: InFlightTask,
    error: unknown,
  ): Promise<RuntimeExecutionHandoffCancellation | undefined> {
    if (inFlight.cancellationOrigin?.source !== "process.shutdown") {
      await fail(task, error)
      return undefined
    }
    const handoff = new RuntimeExecutionHandoffCancellation(
      task.id,
      task.id,
      inFlight.cancellationOrigin.reason,
    )
    const now = Date.now()
    const resumed = Database.transaction((db) => {
      const row = db
        .update(TaskQueueTable)
        .set({
          status: "queued",
          time_started: null,
          time_completed: null,
          error_message: null,
          time_updated: now,
        })
        .where(and(eq(TaskQueueTable.id, task.id), eq(TaskQueueTable.status, "running")))
        .returning({ id: TaskQueueTable.id })
        .get()
      if (row) {
        publishQueueChangedInTransaction({
          queueTaskID: task.id,
          sessionID: task.session_id,
          status: "queued",
          sequence: now,
        })
      }
      return row
    })
    if (!resumed) return handoff
    clearRecoveryTimer(task.id)
    runtimeRequeuedDirectories.add(inFlight.directory)
    captureProcessRollbackTask("requeued", inFlight.directory, task.id)
    log.info("returned Task Queue execution to resumable state after runtime handoff", {
      id: task.id,
      sessionID: task.session_id,
      disposition: handoff.name,
    })
    return handoff
  }

  async function failQueued(id: string, sessionID: string, error: unknown) {
    const now = Date.now()
    const failed = Database.transaction((db) => {
      const row = db
        .update(TaskQueueTable)
        .set({
          status: "failed",
          time_completed: now,
          error_message: message(error),
          time_updated: now,
        })
        .where(and(eq(TaskQueueTable.id, id), eq(TaskQueueTable.status, "queued")))
        .returning({ id: TaskQueueTable.id })
        .get()
      if (row) {
        publishQueueChangedInTransaction({ queueTaskID: id, sessionID, status: "failed", sequence: now })
      }
      return row
    })
    if (!failed) return
    clearRecoveryTimer(id)
    log.error("queued task rejected before claim", {
      id,
      sessionID,
      error: message(error),
    })
  }

  function touch(id: string) {
    const updated = Database.use((db) =>
      db
        .update(TaskQueueTable)
        .set({
          time_updated: Date.now(),
        })
        .where(and(eq(TaskQueueTable.id, id), eq(TaskQueueTable.status, "running")))
        .returning()
        .get(),
    )
    if (updated) scheduleRunningRecoveryTimer(updated, "progress")
  }

  function scheduleRunningRecoveryTimers(reason: string) {
    const rows = Database.use((db) =>
      db
        .select()
        .from(TaskQueueTable)
        .where(
          sql`${TaskQueueTable.status} = 'running'
            AND ${TaskQueueTable.session_id} IN (
              SELECT ${SessionTable.id}
              FROM ${SessionTable}
              WHERE ${SessionTable.project_id} = ${Instance.project.id}
            )`,
        )
        .all(),
    )
    for (const row of rows) scheduleRunningRecoveryTimer(row, reason)
  }

  function scheduleRunningRecoveryTimer(task: QueueTaskRow, reason: string) {
    const directory = Instance.directory
    const current = state()
    const authority = RuntimeExecutionSettlement.reserve("task_queue", `queue-recovery-timer:${task.id}`)
    const token = current.recoveryTimerSequence + 1
    current.recoveryTimerSequence = token
    current.recoveryTimerTokens.set(task.id, token)
    const existing = current.recoveryTimers.get(task.id)
    if (existing) {
      clearTimeout(existing)
      current.recoveryTimers.delete(task.id)
    }
    current.recoveryAuthorities.get(task.id)?.settle()
    current.recoveryAuthorities.set(task.id, authority)
    authority.onCancel(() => {
      if (current.recoveryTimerTokens.get(task.id) !== token) return
      interruptedRecoveryTimers.set(task.id, { task, directory })
      captureProcessRollbackTask("recovery", directory, task.id)
      const timer = current.recoveryTimers.get(task.id)
      if (timer) clearTimeout(timer)
      current.recoveryTimers.delete(task.id)
      current.recoveryTimerTokens.delete(task.id)
      if (current.recoveryAuthorities.get(task.id) === authority) current.recoveryAuthorities.delete(task.id)
      authority.settle()
    })
    void runAsInstanceActivity(async () => {
      const timeout = await runTimeout()
      if (state().recoveryTimerTokens.get(task.id) !== token) return
      const anchor = task.time_updated ?? task.time_started ?? Date.now()
      const delay = Math.max(0, anchor + timeout - Date.now())
      const timer = setTimeout(() => {
        const operation = runTaskQueueOwner(directory, async () => {
          const latest = state()
          if (latest.recoveryTimerTokens.get(task.id) !== token) return
          latest.recoveryTimers.delete(task.id)
          latest.recoveryTimerTokens.delete(task.id)
          if (latest.recoveryAuthorities.get(task.id) === authority) latest.recoveryAuthorities.delete(task.id)
          try {
            const recovered = await recover(Date.now())
            if (recovered > 0) await drainUntilIdle("task inactivity timeout")
            scheduleRunningRecoveryTimers(
              recovered > 0
                ? "task inactivity timeout recovered running rows"
                : "task inactivity timeout not yet stale",
            )
          } catch (error) {
            log.error("task inactivity recovery failed", {
              id: task.id,
              reason,
              error: message(error),
            })
            scheduleRunningRecoveryRetry(task, "task inactivity recovery failed")
          }
        }).catch((error) => {
          log.error("task inactivity recovery owner failed", {
            id: task.id,
            directory,
            reason,
            error: message(error),
          })
          scheduleRecoveryControlRetry(task, directory, "task inactivity recovery owner failed")
        })
        authority.settleWith(operation)
      }, delay)
      timer.unref()
      const latest = state()
      if (latest.recoveryTimerTokens.get(task.id) !== token) {
        clearTimeout(timer)
        return
      }
      latest.recoveryTimers.set(task.id, timer)
    }).catch((error) => {
      const latest = state()
      if (latest.recoveryAuthorities.get(task.id) === authority) latest.recoveryAuthorities.delete(task.id)
      authority.settle()
      log.error("task inactivity timer scheduling failed", {
        id: task.id,
        directory,
        reason,
        error: message(error),
      })
      scheduleRecoveryControlRetry(task, directory, "task inactivity timer scheduling failed")
    })
  }

  function scheduleRecoveryControlRetry(task: QueueTaskRow, directory: string, reason: string) {
    const current = state()
    const authority = RuntimeExecutionSettlement.reserve("task_queue", `queue-recovery-control:${task.id}`)
    const token = current.recoveryTimerSequence + 1
    current.recoveryTimerSequence = token
    current.recoveryTimerTokens.set(task.id, token)
    const existing = current.recoveryTimers.get(task.id)
    if (existing) clearTimeout(existing)
    current.recoveryAuthorities.get(task.id)?.settle()
    current.recoveryAuthorities.set(task.id, authority)
    authority.onCancel(() => {
      if (current.recoveryTimerTokens.get(task.id) !== token) return
      interruptedRecoveryTimers.set(task.id, { task, directory })
      captureProcessRollbackTask("recovery", directory, task.id)
      const timer = current.recoveryTimers.get(task.id)
      if (timer) clearTimeout(timer)
      current.recoveryTimers.delete(task.id)
      current.recoveryTimerTokens.delete(task.id)
      if (current.recoveryAuthorities.get(task.id) === authority) current.recoveryAuthorities.delete(task.id)
      authority.settle()
    })
    const timer = setTimeout(() => {
      const latest = state()
      if (latest.recoveryTimerTokens.get(task.id) !== token) return
      latest.recoveryTimers.delete(task.id)
      latest.recoveryTimerTokens.delete(task.id)
      if (latest.recoveryAuthorities.get(task.id) === authority) latest.recoveryAuthorities.delete(task.id)
      const operation = runTaskQueueOwner(directory, () => scheduleRunningRecoveryRetry(task, reason)).catch((error) => {
        log.error("task inactivity recovery retry owner failed", {
          id: task.id,
          directory,
          reason,
          error: message(error),
        })
        scheduleRecoveryControlRetry(task, directory, reason)
      })
      authority.settleWith(operation)
    }, RECOVERY_CONTROL_RETRY_MS)
    timer.unref()
    current.recoveryTimers.set(task.id, timer)
  }

  function scheduleRunningRecoveryRetry(task: QueueTaskRow, reason: string) {
    const retryAnchor = Date.now()
    scheduleRunningRecoveryTimer(
      { ...task, time_updated: retryAnchor, time_started: task.time_started ?? retryAnchor },
      reason,
    )
  }

  function clearRecoveryTimer(taskID: string) {
    const current = state()
    const timer = current.recoveryTimers.get(taskID)
    if (timer) clearTimeout(timer)
    current.recoveryTimers.delete(taskID)
    current.recoveryTimerTokens.delete(taskID)
    current.recoveryAuthorities.get(taskID)?.settle()
    current.recoveryAuthorities.delete(taskID)
    interruptedRecoveryTimers.delete(taskID)
  }

  async function runTimeout() {
    // Single source: engine/config.ts ActivityConfig.task_queue_run_timeout_ms.
    // No OPENCORVUS_TASK_QUEUE_RUN_TIMEOUT_MS env — assistant.activity in
    // opencorvus.jsonc is the one place to adjust it (CLAUDE.md #25).
    const cfg = await EngineConfig.get()
    return cfg.activity.task_queue_run_timeout_ms
  }

  async function runTaskQueueOwner<R>(directory: string, fn: () => R): Promise<Awaited<R>> {
    const authority = RuntimeExecutionSettlement.reserve("task_queue", `queue-control:${directory}`)
    const operation = runWithIndependentProjectIdentity({ directory, fn })
    authority.settleWith(operation)
    return await operation
  }
}

function message(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error)
}

function promptSchema() {
  return SessionPrompt.PromptInput.omit({
    sessionID: true,
  })
}

function validateQueuedPromptMaterialization<T extends z.infer<ReturnType<typeof promptSchema>>>(
  sessionID: string,
  prompt: T,
  mode: "new" | "stored",
): T {
  const row = Database.use((db) =>
    db
      .select({
        projectID: SessionTable.project_id,
        kind: SessionTable.kind,
      })
      .from(SessionTable)
      .where(eq(SessionTable.id, sessionID))
      .get(),
  )
  if (!row) throw new Error(`Session not found: ${sessionID}`)
  if (!prompt.agent) {
    throw new Error(`Queued prompt for session ${sessionID} requires an explicit agent identity`)
  }
  const installedRuntimeContract = SessionPrompt.getSessionRuntimeContract(sessionID)
  SessionPrompt.validateSessionRuntimeContractForContinuation({
    sessionID,
    expectedSessionKind: row.kind,
    expectedAgentID: prompt.agent,
    requireWorkerTurnDescriptor: installedRuntimeContract?.identity.identityKind === "projected-worker",
    requireRuntimeContract: SessionPrompt.sessionKindRequiresRuntimeContract(row.kind),
  })
  if (mode === "stored" && !prompt.byteMaterializationProjectID) {
    throw new Error(`Stored queued prompt for session ${sessionID} is missing byteMaterializationProjectID`)
  }
  if (prompt.byteMaterializationProjectID && prompt.byteMaterializationProjectID !== row.projectID) {
    throw new Error(
      `SessionPrompt byteMaterializationProjectID ${prompt.byteMaterializationProjectID} does not match session project ${row.projectID}`,
    )
  }
  return {
    ...prompt,
    byteMaterializationProjectID: row.projectID,
  }
}

function stampTaskQueueWakeReason<T extends z.infer<ReturnType<typeof promptSchema>>>(
  prompt: T,
  reason: { queueTaskID?: string; queueSource?: string },
): T {
  const existing = SessionWake.WakeReason.safeParse(prompt.extra?.wake_reason)
  if (existing.success && existing.data.source === "scheduler.task_queue") return prompt
  return {
    ...prompt,
    extra: {
      ...(prompt.extra ?? {}),
      ...SessionWake.reasonExtra({
        source: "scheduler.task_queue",
        ...reason,
      }),
    },
  }
}

async function compactionSource(sessionID: string, sourceUserMessageID: string): Promise<Message.User> {
  const source = (await Session.messages({ sessionID })).find(
    (message) => message.info.id === sourceUserMessageID,
  )?.info
  if (!source) throw new Error(`Compaction source message not found: ${sourceUserMessageID}`)
  if (source.role !== "user") {
    throw new Error(`Compaction source message ${sourceUserMessageID} is ${source.role}, not user`)
  }
  return source
}

function compactionPrompt(input: z.infer<typeof StoredCompactionInput>) {
  const kind = input.auto ? "automatic compaction" : "manual summarize"
  return input.focus ? `${kind}: ${input.focus}` : kind
}

type PromptPart = z.infer<ReturnType<typeof promptSchema>>["parts"][number]
type TextPart = Extract<PromptPart, { type: "text" }>

function textPart(part: PromptPart): part is TextPart {
  return part.type === "text"
}

function firstText(input: z.infer<ReturnType<typeof promptSchema>>) {
  const part = input.parts.find(textPart)
  if (!part) return "[task]"
  if (part.text.trim().length === 0) return "[task]"
  return part.text
}
