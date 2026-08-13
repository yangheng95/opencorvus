/**
 * Task serialization queue — single source of truth for queue=true task
 * admission in a working directory.
 *
 * Lock key: the task root session's required `session.directory`.
 *
 * queue=true tasks in the same cwd are serialized. queue=false creation
 * intentionally starts immediately so same-project tasks can run in parallel;
 * runtime isolation is provided by task/session-scoped runtime paths.
 *
 * All queued scheduling requests must go through this module so queued-task
 * claiming and active-task re-entry share one coordinator.
 */

import { MessageTable, SessionTable } from "@/session/session.sql"
import { Message } from "@/session/message"
import { MessageStore } from "@/session/message-store"
import { isDeepStrictEqual } from "node:util"
import { ProtocolStore } from "@/protocol/store"
import { Database, and, desc, eq, isNull, sql } from "@/storage/db"
import { Log } from "@/util/log"
import {
  EngineArtifactTable,
  EngineArtifactVersionTable,
  EngineTaskCancellationAuthorityTable,
  EngineTaskTable,
} from "./engine.sql"
import {
  insertEngineArtifact,
  patchEngineArtifact,
  updateEngineArtifact,
  updateEngineArtifactsWhere,
  updateEngineArtifactWhereReturning,
} from "./artifact"
import { insertEngineProgressSnapshot } from "./progress"
import { claimNextEngineTaskForCwd, claimQueuedEngineTaskForCwd, setEngineTaskQueueOrder } from "./task"
import { findTask, listOwnedPromptSessionsForTask, listStartedIncompleteTaskIDs, type TaskRow } from "./store"
import { deriveTaskStatus, isTaskActive, isTaskQueued, isTaskTerminal } from "./task-status"
import { OrchestratorEventSchema, type OrchestratorEvent } from "@/orchestrator/event"
import { Identifier } from "@/id/id"
import { Event } from "./model"
import { EngineProtocol } from "./protocol"
import { QueuedTaskIngressSchema, queuedTaskIngressSourceKind, type QueuedTaskIngress } from "./queued-task-ingress"
import { Instance, runOutsideInstanceContext } from "@/project/instance"
import {
  runWithIndependentProjectIdentity,
  runWithInitializedIndependentProject,
} from "@/project/independent-project-owner"
import { createInstanceState } from "@/project/instance-state"
import { requireTaskWakeRuntime } from "@/scheduler/task-wake-runtime"
import { SessionPromptState } from "@/session/prompt/state"
import { createExecutionCancellationOrigin, isExecutionCancellationError } from "@/session/prompt/cancellation"
import { TaskQueueError, taskRootDirectory } from "./task-directory"
import { isAgentInvocationSession, listTaskConversationAgentSessions } from "@/orchestrator/task-event"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { RuntimeTemplateRegistry } from "@/agent/runtime-template-registry"
import { recordTaskInfrastructureError, recordTaskInfrastructureErrorInTransaction } from "./persist"
import { Session } from "@/session"
import { publishSettledSessionTerminalStatusInCurrentProject } from "@/session/status-publication"
import { SessionStatus } from "@/session/status"
import { terminalTask, writeTaskUpdateInTransaction } from "./state"
import { deliverTerminalTaskIngress } from "./terminal-task-conversation-runner"
import { TaskRootMessageProvenance } from "@/task-api/task-root-message"
import { listTaskSessionIDs } from "./task-session-lineage"
import {
  ProcessRecoveryFactContext,
  resolveProcessRecoveryInputAuthority,
  type ProcessRecoveryFactContext as ProcessRecoveryFactContextValue,
} from "./process-recovery-fact"
import { currentProcessPhysicalEvidence, interruptedProcessPhysicalEvidence } from "@/runtime/process-occurrence"
import {
  findDispatchLineageByDispatchID,
  listDispatchLineage,
  resolveDispatchOccurrenceAuthority,
} from "./dispatch-lineage"
import { findDispatchSettlementByDispatchID, recordDispatchSettlement } from "./dispatch-settlement"
import {
  RuntimeExecutionAdmissionClosedError,
  RuntimeExecutionSettlement,
  type RuntimeExecutionReservation,
} from "@/runtime/execution-settlement"
import { DispatchOutcome } from "@/agent/dispatch-outcome"
import { exactEngineArtifactLocator } from "@/artifact-catalog"
import { RuntimeServerOwnership } from "@/server/runtime-server-ownership"
import { Filesystem } from "@/util/filesystem"

const immutableArtifactEnqueueOrdinal = sql<number>`coalesce(
  (
    SELECT min(${EngineArtifactVersionTable.catalog_revision})
    FROM ${EngineArtifactVersionTable}
    WHERE ${EngineArtifactVersionTable.artifact_id} = ${EngineArtifactTable.id}
  ),
  ${EngineArtifactTable.catalog_revision}
)`

export { TaskQueueError } from "./task-directory"

const log = Log.create({ service: "engine.queue" })
const INTERRUPTED_TASK_WAKE_SETTLE_TIMEOUT_MS = 60_000
const MAX_CURRENT_RUNTIME_TERMINAL_INGRESS_DELIVERY_ATTEMPTS = 2
const TERMINAL_INGRESS_DELAYED_RETRY_BASE_MS = 1_000
const TERMINAL_INGRESS_DELAYED_RETRY_MAX_MS = 60_000
let terminalIngressDeliveryRuntimeOverrideForTest: string | undefined
let terminalIngressDelayedRetryDelayOverrideForTest: number | undefined
const loopCompletionHooksForTest = new Set<Promise<void>>()
const taskLoopCompletionOperations = new Map<string, Promise<void>>()
const taskLoopLaunchAuthorities = new Map<string, string>()
const terminalIngressDelayedRetryOwners = new Map<string, Promise<void>>()
let taskLoopLaunchAcceptanceFailuresForTest = 0
let taskLoopLaunchAcceptanceAttemptsForTest = 0
let taskLoopCompletionAdvanceFailuresForTest = 0

function terminalIngressDeliveryRuntimeID(): string {
  const occurrenceID = RuntimeServerOwnership.currentOccurrenceID(Database.Path())
  if (occurrenceID) return occurrenceID
  if (terminalIngressDeliveryRuntimeOverrideForTest) return terminalIngressDeliveryRuntimeOverrideForTest
  throw new RuntimeServerOwnershipRequiredError(Database.Path())
}

export class RuntimeServerOwnershipRequiredError extends Error {
  override readonly name = "RuntimeServerOwnershipRequiredError"

  constructor(public readonly database: string) {
    super(`Exact Task ingress delivery requires RuntimeServerOwnership for ${database}`)
  }
}

export class TaskLoopLaunchHandoffError extends Error {
  override readonly name = "TaskLoopLaunchHandoffError"

  constructor(
    public readonly taskID: string,
    public readonly launchID: string,
    cause: unknown,
  ) {
    super(`Task ${taskID} failed before its claimed queue launch was attached`, { cause })
  }
}

function recordTaskLoopLaunch(db: Database.TxOrDb, input: { task: TaskRow; cwd: string; now: number }): string {
  const exactWake = db
    .select({ id: EngineArtifactTable.id })
    .from(EngineArtifactTable)
    .where(
      and(
        eq(EngineArtifactTable.task_id, input.task.id),
        eq(EngineArtifactTable.kind, "queued_operator_wake"),
        eq(EngineArtifactTable.label, "pending"),
      ),
    )
    .orderBy(EngineArtifactTable.time_created, EngineArtifactTable.id)
    .get()
  return insertEngineArtifact(db, {
    taskID: input.task.id,
    kind: "task_loop_launch",
    label: "pending",
    payload: {
      task_id: input.task.id,
      cwd: input.cwd,
      status: "claimed",
      ...(exactWake ? { wake_id: exactWake.id, time_wake_bound: input.now } : {}),
      owner_process_id: process.pid,
      time_claimed: input.now,
    },
    timeCreated: input.now,
  })
}

function bindTaskLoopLaunchWake(taskID: string, wakeID: string): void {
  const launchID = taskLoopLaunchAuthorities.get(taskID)
  if (!launchID) return
  Database.immediateTransaction((db) => {
    const row = db
      .select({ label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.id, launchID),
          eq(EngineArtifactTable.task_id, taskID),
          eq(EngineArtifactTable.kind, "task_loop_launch"),
        ),
      )
      .get()
    if (!row) throw new Error(`Task loop launch ${launchID} disappeared before exact wake binding`)
    const payload = artifactPayloadRecord(row.payload)
    const boundWakeID = typeof payload.wake_id === "string" ? payload.wake_id : undefined
    if (boundWakeID && boundWakeID !== wakeID) {
      throw new Error(`Task loop launch ${launchID} is bound to wake ${boundWakeID}, not ${wakeID}`)
    }
    if (boundWakeID === wakeID) return
    if (row.label !== "pending") {
      throw new Error(`Task loop launch ${launchID} cannot bind wake ${wakeID} from ${row.label}`)
    }
    patchEngineArtifact(db, {
      id: launchID,
      payload: {
        ...payload,
        wake_id: wakeID,
        time_wake_bound: Date.now(),
      },
    })
  })
}

async function returnClaimedTaskToQueue(task: TaskRow, cause: unknown): Promise<TaskLoopLaunchHandoffError> {
  const launchID = taskLoopLaunchAuthorities.get(task.id)
  if (!launchID) {
    return new TaskLoopLaunchHandoffError(task.id, "missing-launch-authority", cause)
  }
  const now = Date.now()
  try {
    Database.transaction((db) => {
      writeTaskUpdateInTransaction({
        db,
        taskID: task.id,
        values: { status: "queued" },
        summary: "Task launch handoff returned to queue",
        now,
      })
      patchEngineArtifact(db, {
        id: launchID,
        label: "completed",
        payload: {
          task_id: task.id,
          status: "returned_to_queue",
          owner_process_id: process.pid,
          reason: cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause),
          time_settled: now,
        },
      })
    })
  } catch (settlementError) {
    return new TaskLoopLaunchHandoffError(
      task.id,
      launchID,
      new AggregateError([cause, settlementError], "Task launch failure and durable rollback both failed"),
    )
  }
  taskLoopLaunchAuthorities.delete(task.id)
  return new TaskLoopLaunchHandoffError(task.id, launchID, cause)
}

function acceptTaskLoopLaunch(taskID: string): void {
  const launchID = taskLoopLaunchAuthorities.get(taskID)
  if (!launchID) return
  const authority = RuntimeExecutionSettlement.reserve(
    "engine_queue_completion",
    `task-loop-launch-acceptance:${taskID}:${launchID}`,
  )
  const acceptance = (async () => {
    let attempt = 0
    while (!authority.signal.aborted) {
      attempt += 1
      taskLoopLaunchAcceptanceAttemptsForTest += 1
      try {
        if (taskLoopLaunchAcceptanceFailuresForTest > 0) {
          taskLoopLaunchAcceptanceFailuresForTest -= 1
          throw new Error("injected task loop launch acceptance persistence failure")
        }
        const launch = Database.use((db) =>
          db
            .select({ payload: EngineArtifactTable.payload })
            .from(EngineArtifactTable)
            .where(
              and(
                eq(EngineArtifactTable.id, launchID),
                eq(EngineArtifactTable.task_id, taskID),
                eq(EngineArtifactTable.kind, "task_loop_launch"),
              ),
            )
            .get(),
        )
        if (!launch) throw new Error(`Task loop launch ${launchID} disappeared before acceptance`)
        updateEngineArtifact({
          id: launchID,
          label: "completed",
          payload: {
            ...artifactPayloadRecord(launch.payload),
            task_id: taskID,
            status: "loop_attached",
            owner_process_id: process.pid,
            acceptance_attempt: attempt,
            time_settled: Date.now(),
          },
        })
        if (taskLoopLaunchAuthorities.get(taskID) === launchID) taskLoopLaunchAuthorities.delete(taskID)
        return
      } catch (error) {
        if (attempt === 1 || (attempt & (attempt - 1)) === 0) {
          log.warn("Task loop launch acceptance persistence will retry", {
            taskID,
            launchID,
            attempt,
            error: error instanceof Error ? error.message : String(error),
          })
        }
        const delay = Math.min(1_000, 25 * 2 ** Math.min(attempt - 1, 6))
        await new Promise<void>((resolve) => {
          if (authority.signal.aborted) return resolve()
          const timer = setTimeout(finish, delay)
          function finish() {
            clearTimeout(timer)
            authority.signal.removeEventListener("abort", finish)
            resolve()
          }
          authority.signal.addEventListener("abort", finish, { once: true })
        })
      }
    }
    if (taskLoopLaunchAuthorities.get(taskID) === launchID) taskLoopLaunchAuthorities.delete(taskID)
  })()
  authority.settleWith(acceptance)
}
const terminalIngressCompletions = new Map<string, Promise<void>>()

function artifactPayloadRecord(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {}
}

async function settleDetachedDispatchRecovery(dispatchLineageID: string): Promise<void> {
  const { settleDetachedDispatchPipelineRecovery } = await import("@/orchestrator/dispatch-agent-tool")
  settleDetachedDispatchPipelineRecovery(dispatchLineageID)
}

function canRetryTerminalIngressInCurrentRuntime(ingress: QueuedTaskIngress): boolean {
  const runtimeID = terminalIngressDeliveryRuntimeID()
  return (
    ingress.delivery_runtime_id !== runtimeID ||
    (ingress.delivery_runtime_attempt ?? ingress.delivery_attempt) <
      MAX_CURRENT_RUNTIME_TERMINAL_INGRESS_DELIVERY_ATTEMPTS
  )
}

function terminalIngressDelayedRetryDelay(ingress: QueuedTaskIngress): number {
  if (terminalIngressDelayedRetryDelayOverrideForTest !== undefined) {
    return terminalIngressDelayedRetryDelayOverrideForTest
  }
  const exhaustedWindows = Math.max(
    0,
    Math.floor((ingress.delivery_attempt - 1) / MAX_CURRENT_RUNTIME_TERMINAL_INGRESS_DELIVERY_ATTEMPTS),
  )
  return Math.min(
    TERMINAL_INGRESS_DELAYED_RETRY_MAX_MS,
    TERMINAL_INGRESS_DELAYED_RETRY_BASE_MS * 2 ** Math.min(exhaustedWindows, 6),
  )
}

export type TaskLoopRunResult = {
  finalMessageID?: string
}

type MessageFence = {
  timeCreated: number
  id: string
}

type TaskLoopRunner = (input: {
  taskID: string
  event?: OrchestratorEvent
  signal?: AbortSignal
  wakeID?: string
}) => Promise<TaskLoopRunResult | void>

const taskLoopRuntime = createInstanceState(
  () => ({ runner: undefined as TaskLoopRunner | undefined }),
  undefined,
  "engine-queue-task-loop-runner",
)
const taskLoopRunnerOverridesForTest = new Map<
  string,
  { token: symbol; runner: TaskLoopRunner; configurationCount: number }
>()

function taskLoopRunnerOverrideKey(directory: string): string {
  const resolved = Filesystem.resolve(directory)
  return process.platform === "win32" ? resolved.toLowerCase() : resolved
}

export function configureTaskLoopRunner(runner: TaskLoopRunner): void {
  const runtime = taskLoopRuntime()
  const override = taskLoopRunnerOverridesForTest.get(taskLoopRunnerOverrideKey(Instance.directory))
  if (override) override.configurationCount += 1
  const configured = override?.runner ?? runner
  if (runtime.runner && runtime.runner !== configured) {
    throw new Error("Engine queue task-loop runner is already configured for this instance")
  }
  runtime.runner = configured
}

function requireTaskLoopRunner(): TaskLoopRunner {
  const runner = taskLoopRuntime().runner
  if (!runner) throw new Error("Engine queue task-loop runner is not configured for this instance")
  return runner
}

export function discardQueuedTaskEvent(taskID: string): void {
  discardPendingQueuedOperatorWakes(taskID)
}

export function terminalizeQueuedTaskEventsForCancellation(input: {
  taskID: string
  cancellationRequestEventID: string
  now?: number
}): void {
  const now = input.now ?? Date.now()
  Database.transaction((db) => terminalizeQueuedTaskEventsForCancellationInTransaction(db, { ...input, now }))
}

export function terminalizeQueuedTaskEventsForCancellationInTransaction(
  db: Database.TxOrDb,
  input: { taskID: string; cancellationRequestEventID: string; now: number },
): void {
  const rows = db
    .select({ id: EngineArtifactTable.id, payload: EngineArtifactTable.payload })
    .from(EngineArtifactTable)
    .where(
      and(
        eq(EngineArtifactTable.task_id, input.taskID),
        eq(EngineArtifactTable.kind, "queued_operator_wake"),
        sql`${EngineArtifactTable.label} IN ('pending', 'running', 'delivery_failed')`,
      ),
    )
    .all()
  for (const row of rows) {
    const ingress = QueuedTaskIngressSchema.parse(row.payload)
    patchEngineArtifact(db, {
      id: row.id,
      label: "terminal_inapplicable",
      payload: QueuedTaskIngressSchema.parse({
        ...ingress,
        delivery_result: {
          status: "terminal_inapplicable",
          reason: `Task cancellation ${input.cancellationRequestEventID} made this ingress inapplicable.`,
          time_completed: input.now,
        },
      }),
      timeUpdated: input.now,
    })
  }
}

export function retirePendingQueuedTaskEventsForOperatorIntentInTransaction(
  db: Database.TxOrDb,
  input: { taskID: string; now: number },
): string[] {
  const task = db
    .select({ rootSessionID: EngineTaskTable.session_id })
    .from(EngineTaskTable)
    .where(eq(EngineTaskTable.id, input.taskID))
    .get()
  if (!task?.rootSessionID) {
    throw new Error(`Task ${input.taskID} has no root Session while retiring queued ingress`)
  }
  const rows = db
    .select({ id: EngineArtifactTable.id, taskID: EngineArtifactTable.task_id, payload: EngineArtifactTable.payload })
    .from(EngineArtifactTable)
    .where(
      and(
        eq(EngineArtifactTable.task_id, input.taskID),
        eq(EngineArtifactTable.kind, "queued_operator_wake"),
        eq(EngineArtifactTable.label, "pending"),
      ),
    )
    .orderBy(EngineArtifactTable.time_created, EngineArtifactTable.id)
    .all()
  const supersededOperatorMessageIDs = rows.flatMap((row) => {
    if (row.taskID !== input.taskID) {
      throw new Error(`Queued ingress ${row.id} belongs to Task ${row.taskID}, expected ${input.taskID}`)
    }
    const ingress = QueuedTaskIngressSchema.parse(row.payload)
    if (ingress.task_id !== input.taskID || ingress.root_session_id !== task.rootSessionID) {
      throw new Error(`Queued ingress ${row.id} conflicts with Task/root Session authority`)
    }
    if (ingress.source_kind !== "operator_message") return []
    const message = db
      .select({ data: MessageTable.data })
      .from(MessageTable)
      .where(and(eq(MessageTable.id, ingress.message_id), eq(MessageTable.session_id, task.rootSessionID)))
      .get()
    if (!message) {
      throw new Error(`Queued operator ingress ${row.id} has no exact visible operator root message`)
    }
    const visibleOperatorMessage = Message.User.safeParse({
      ...message.data,
      id: ingress.message_id,
      sessionID: task.rootSessionID,
    })
    if (!visibleOperatorMessage.success || visibleOperatorMessage.data.author !== "user") {
      throw new Error(`Queued operator ingress ${row.id} has no exact visible operator root message`)
    }
    const provenance = TaskRootMessageProvenance.parse(visibleOperatorMessage.data.extra?.task_root_message)
    if (provenance.taskID !== input.taskID || provenance.kind !== "operator") {
      throw new Error(`Queued operator ingress ${row.id} message provenance conflicts with Task authority`)
    }
    return [ingress.message_id]
  })
  if (new Set(supersededOperatorMessageIDs).size !== supersededOperatorMessageIDs.length) {
    throw new Error(`Task ${input.taskID} has duplicate pending operator message ingress`)
  }
  updateEngineArtifactsWhere(db, {
    label: "discarded",
    timeUpdated: input.now,
    where: and(
      eq(EngineArtifactTable.task_id, input.taskID),
      eq(EngineArtifactTable.kind, "queued_operator_wake"),
      eq(EngineArtifactTable.label, "pending"),
    )!,
  })
  return supersededOperatorMessageIDs
}

export function queuedTaskEventStats(taskID?: string) {
  if (taskID) {
    const durableCount = pendingQueuedOperatorWakeTaskIDs().filter((id) => id === taskID).length
    return {
      tasks: durableCount > 0 ? 1 : 0,
      events: durableCount,
    }
  }
  const durableRows = pendingQueuedOperatorWakeTaskIDs()
  return {
    tasks: new Set<string>(durableRows).size,
    events: durableRows.length,
  }
}

function pendingQueuedOperatorWakeTaskIDs(projectID?: string): string[] {
  return Database.use((db) =>
    db
      .select({ taskID: EngineArtifactTable.task_id })
      .from(EngineArtifactTable)
      .innerJoin(EngineTaskTable, eq(EngineTaskTable.id, EngineArtifactTable.task_id))
      .where(
        and(
          eq(EngineArtifactTable.kind, "queued_operator_wake"),
          eq(EngineArtifactTable.label, "pending"),
          ...(projectID ? [eq(EngineTaskTable.project_id, projectID)] : []),
        ),
      )
      .all()
      .map((row) => row.taskID),
  )
}

/**
 * Rebuild missing delivery notices from durable coordination requests.
 *
 * A coordination request is the user/worker fact. The queued wake is only a
 * disposable delivery mechanism, so a crash between those two writes must not
 * require the operator to submit the request again.
 */
export function reconcilePendingCoordinationRequestWakes(): number {
  const projectID = Instance.project.id
  const requests = Database.use((db) =>
    db
      .select({
        requestID: EngineArtifactTable.id,
        taskID: EngineArtifactTable.task_id,
      })
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.kind, "agent_coordination_request"),
          eq(EngineArtifactTable.label, "pending"),
          sql`json_extract(${EngineArtifactTable.payload}, '$.status') = 'pending'`,
        ),
      )
      .orderBy(immutableArtifactEnqueueOrdinal, EngineArtifactTable.id)
      .all(),
  )
  let reconciled = 0
  for (const request of requests) {
    const task = findTask(request.taskID)
    if (!task) {
      log.warn("pending coordination request belongs to a missing task", request)
      continue
    }
    if (task.project_id !== projectID) continue
    const existing = Database.use((db) =>
      db
        .select({ id: EngineArtifactTable.id })
        .from(EngineArtifactTable)
        .where(
          and(
            eq(EngineArtifactTable.task_id, task.id),
            eq(EngineArtifactTable.kind, "queued_operator_wake"),
            eq(EngineArtifactTable.label, "pending"),
            sql`json_extract(${EngineArtifactTable.payload}, '$.request_id') = ${request.requestID}`,
          ),
        )
        .get(),
    )
    if (existing) continue
    persistQueuedOperatorWake(
      task,
      { coordinationRequest: { requestID: request.requestID } },
      { requestID: request.requestID },
    )
    reconciled += 1
  }
  return reconciled
}

function enqueueTaskEvent(task: TaskRow, event: OrchestratorEvent): string {
  const messageID = event.rootMessage?.messageID.trim() ?? event.missionAcceptanceResume?.messageID.trim()
  const requestID = event.coordinationRequest?.requestID.trim()
  const recoveryFactID = event.processRecovery?.recoveryFactID.trim()
  const infrastructureFactID = event.dispatchInfrastructureFailure?.infrastructureFactID.trim()
  const waitJobID = event.taskWaitWake?.jobID.trim()
  const lifecycleEventID = event.agentLifecycleDelivery?.eventID.trim()
  return persistQueuedOperatorWake(task, event, {
    messageID,
    requestID,
    recoveryFactID,
    infrastructureFactID,
    waitJobID,
    lifecycleEventID,
  })
}

function persistQueuedOperatorWakeInTransaction(
  db: Database.TxOrDb,
  task: TaskRow,
  event: OrchestratorEvent,
  identity: {
    messageID?: string
    requestID?: string
    recoveryFactID?: string
    infrastructureFactID?: string
    waitJobID?: string
    lifecycleEventID?: string
  },
  now = Date.now(),
): string {
  if (!task.session_id) throw new TaskQueueError(`Task ${task.id} has no root session`, "session_not_bound", task.id)
  const messageID = identity.messageID
  const requestID = identity.requestID
  const recoveryFactID = identity.recoveryFactID
  const infrastructureFactID = identity.infrastructureFactID
  const waitJobID = identity.waitJobID
  const lifecycleEventID = identity.lifecycleEventID
  const cancellationAuthority = db
    .select({ requestEventID: EngineTaskCancellationAuthorityTable.request_event_id })
    .from(EngineTaskCancellationAuthorityTable)
    .innerJoin(EngineTaskTable, eq(EngineTaskTable.id, EngineTaskCancellationAuthorityTable.task_id))
    .where(and(eq(EngineTaskCancellationAuthorityTable.task_id, task.id), isNull(EngineTaskTable.time_completed)))
    .get()
  if (messageID || requestID || recoveryFactID || infrastructureFactID || waitJobID || lifecycleEventID) {
    const exists = db
      .select({ id: EngineArtifactTable.id, label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, task.id),
          eq(EngineArtifactTable.kind, "queued_operator_wake"),
          messageID
            ? sql`json_extract(${EngineArtifactTable.payload}, '$.message_id') = ${messageID}`
            : requestID
              ? sql`json_extract(${EngineArtifactTable.payload}, '$.request_id') = ${requestID}`
              : recoveryFactID
                ? sql`json_extract(${EngineArtifactTable.payload}, '$.recovery_fact_id') = ${recoveryFactID}`
                : infrastructureFactID
                  ? sql`json_extract(${EngineArtifactTable.payload}, '$.infrastructure_fact_id') = ${infrastructureFactID}`
                  : waitJobID
                    ? sql`json_extract(${EngineArtifactTable.payload}, '$.wait_job_id') = ${waitJobID}`
                    : sql`json_extract(${EngineArtifactTable.payload}, '$.lifecycle_event_id') = ${lifecycleEventID}`,
        ),
      )
      .get()
    if (exists) {
      if (cancellationAuthority && ["pending", "running", "delivery_failed"].includes(exists.label)) {
        const ingress = QueuedTaskIngressSchema.parse(exists.payload)
        patchEngineArtifact(db, {
          id: exists.id,
          label: "terminal_inapplicable",
          payload: QueuedTaskIngressSchema.parse({
            ...ingress,
            delivery_result: {
              status: "terminal_inapplicable",
              reason: `Task cancellation ${cancellationAuthority.requestEventID} made this ingress inapplicable.`,
              time_completed: now,
            },
          }),
          timeUpdated: now,
        })
        return exists.id
      }
      if (exists.label === "delivery_failed") {
        const ingress = QueuedTaskIngressSchema.parse(exists.payload)
        if (canRetryTerminalIngressInCurrentRuntime(ingress)) {
          const {
            delivery_result: _failedDelivery,
            queued_by_instance_directory: _failedInstanceDirectory,
            queued_by_project_id: _failedProjectID,
            ...retryIngress
          } = ingress
          patchEngineArtifact(db, {
            id: exists.id,
            label: "pending",
            payload: {
              ...retryIngress,
              delivery_attempt: ingress.delivery_attempt + 1,
              delivery_runtime_id: terminalIngressDeliveryRuntimeID(),
              delivery_runtime_attempt:
                ingress.delivery_runtime_id === terminalIngressDeliveryRuntimeID()
                  ? (ingress.delivery_runtime_attempt ?? ingress.delivery_attempt) + 1
                  : 1,
              time_queued: now,
              queued_by_process_id: process.pid,
              ...(Instance.current()
                ? {
                    queued_by_instance_directory: Instance.directory,
                    queued_by_project_id: Instance.project.id,
                  }
                : {}),
            },
            timeUpdated: now,
          })
        }
      }
      return exists.id
    }
  }
  const instance = Instance.current()
  const sourceKind = queuedTaskIngressSourceKind(event)
  const payload = QueuedTaskIngressSchema.parse({
    wake_id:
      messageID ??
      (requestID
        ? requestID
        : recoveryFactID
          ? recoveryFactID
          : infrastructureFactID
            ? infrastructureFactID
            : waitJobID
              ? event.taskWaitWake?.fireID
              : lifecycleEventID
                ? lifecycleEventID
                : Identifier.ascending("artifact")),
    delivery_attempt: 1,
    delivery_runtime_id: terminalIngressDeliveryRuntimeID(),
    delivery_runtime_attempt: 1,
    task_id: task.id,
    root_session_id: task.session_id,
    ...(messageID ? { message_id: messageID } : {}),
    ...(requestID ? { request_id: requestID } : {}),
    ...(recoveryFactID ? { recovery_fact_id: recoveryFactID } : {}),
    ...(infrastructureFactID ? { infrastructure_fact_id: infrastructureFactID } : {}),
    ...(waitJobID ? { wait_job_id: waitJobID } : {}),
    ...(lifecycleEventID ? { lifecycle_event_id: lifecycleEventID } : {}),
    source_kind: sourceKind,
    event: OrchestratorEventSchema.parse(event),
    time_queued: now,
    queued_by_process_id: process.pid,
    ...(instance
      ? { queued_by_instance_directory: instance.directory, queued_by_project_id: instance.project.id }
      : {}),
    ...(cancellationAuthority
      ? {
          delivery_result: {
            status: "terminal_inapplicable",
            reason: `Task cancellation ${cancellationAuthority.requestEventID} made this ingress inapplicable.`,
            time_completed: now,
          },
        }
      : {}),
  })
  return insertEngineArtifact(db, {
    taskID: task.id,
    kind: "queued_operator_wake",
    label: cancellationAuthority ? "terminal_inapplicable" : "pending",
    payload,
    timeCreated: now,
  })
}

export function persistQueuedTaskIntentInTransaction(
  db: Database.TxOrDb,
  input: {
    task: TaskRow
    intent: "retry" | "replan"
    supersededOperatorMessageIDs: string[]
    now: number
  },
): string {
  return persistQueuedOperatorWakeInTransaction(
    db,
    input.task,
    {
      taskIntent: {
        kind: input.intent,
        actor: "operator",
        supersededOperatorMessageIDs: input.supersededOperatorMessageIDs,
      },
    },
    {},
    input.now,
  )
}

export function persistQueuedRootMessageWakeInTransaction(
  db: Database.TxOrDb,
  input: {
    task: TaskRow
    messageID: string
    kind: "operator" | "orchestrator" | "mission"
    schedulerDelivery?: import("@/task-api/task-root-message").SchedulerDeliveryReference
    now: number
  },
): string {
  return persistQueuedOperatorWakeInTransaction(
    db,
    input.task,
    {
      rootMessage: {
        messageID: input.messageID,
        kind: input.kind,
        ...(input.schedulerDelivery ? { schedulerDelivery: input.schedulerDelivery } : {}),
      },
    },
    { messageID: input.messageID },
    input.now,
  )
}

export function persistQueuedMissionAcceptanceResumeInTransaction(
  db: Database.TxOrDb,
  input: {
    task: TaskRow
    event: Extract<OrchestratorEvent, { missionAcceptanceResume?: unknown }>
    now: number
  },
): string {
  const resume = input.event.missionAcceptanceResume
  if (!resume) throw new Error(`Mission acceptance-resume ingress is missing its exact provenance.`)
  return persistQueuedOperatorWakeInTransaction(db, input.task, input.event, { messageID: resume.messageID }, input.now)
}

function persistQueuedOperatorWake(
  task: TaskRow,
  event: OrchestratorEvent,
  identity: {
    messageID?: string
    requestID?: string
    recoveryFactID?: string
    infrastructureFactID?: string
    waitJobID?: string
    lifecycleEventID?: string
  },
): string {
  return Database.transaction((db) => persistQueuedOperatorWakeInTransaction(db, task, event, identity))
}

export function persistQueuedTaskWaitWakeInTransaction(
  db: Database.TxOrDb,
  input: {
    taskID: string
    projectID: string
    jobID: string
    fireID: string
    dueAt: number
    note: string
    now: number
  },
): string {
  const task = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, input.taskID)).get()
  if (!task) throw new Error(`Queued Task wait wake task not found: ${input.taskID}`)
  if (task.project_id !== input.projectID) {
    throw new Error(
      `Queued Task wait wake project mismatch for ${input.taskID}: expected ${input.projectID}, found ${task.project_id}`,
    )
  }
  return persistQueuedOperatorWakeInTransaction(
    db,
    task,
    {
      note: input.note,
      taskWaitWake: { jobID: input.jobID, fireID: input.fireID, dueAt: input.dueAt },
    },
    { waitJobID: input.jobID },
    input.now,
  )
}

export const TestHooks = {
  replaceTaskLoopRunner(input: { directory: string; runner: TaskLoopRunner }): Disposable & {
    configurationCount(): number
  } {
    const key = taskLoopRunnerOverrideKey(input.directory)
    if (taskLoopRunnerOverridesForTest.has(key)) {
      throw new Error(`Engine queue Task-loop test runner is already overridden for ${input.directory}`)
    }
    const token = Symbol(key)
    const entry = { token, runner: input.runner, configurationCount: 0 }
    taskLoopRunnerOverridesForTest.set(key, entry)
    return {
      configurationCount() {
        return entry.configurationCount
      },
      [Symbol.dispose]() {
        if (taskLoopRunnerOverridesForTest.get(key)?.token === token) taskLoopRunnerOverridesForTest.delete(key)
      },
    }
  },
  reconcileHistoricalNonTailFailedIngress(taskID: string, wakeID: string): boolean {
    return reconcileHistoricalNonTailFailedIngress(taskID, wakeID)
  },
  taskLoopExitProjection(error: unknown) {
    const exit = classifyTaskLoopExit(error)
    return exit.kind === "cancelled"
      ? {
          kind: exit.kind,
          source: exit.error.origin.source,
          requestID: exit.error.origin.requestID,
        }
      : { kind: exit.kind, errorName: exit.error.name, message: exit.error.message }
  },
  startQueuedWake(wakeID: string): boolean {
    return markQueuedOperatorWakeRunning(wakeID)
  },
  completeQueuedWake(wakeID: string, assistantMessageID: string): void {
    markQueuedOperatorWakeDrained({ artifactID: wakeID, assistantMessageID })
  },
  taskLoopLaunchAcceptanceAttempts(): number {
    return taskLoopLaunchAcceptanceAttemptsForTest
  },
  taskLoopCompletionAdvanceFailuresRemaining(): number {
    return taskLoopCompletionAdvanceFailuresForTest
  },
  failNextTaskLoopCompletionAdvances(count = 1): Disposable {
    const previous = taskLoopCompletionAdvanceFailuresForTest
    taskLoopCompletionAdvanceFailuresForTest = count
    return {
      [Symbol.dispose]() {
        taskLoopCompletionAdvanceFailuresForTest = previous
      },
    }
  },
  failNextTaskLoopLaunchAcceptanceWrites(count = 1): Disposable {
    const previous = taskLoopLaunchAcceptanceFailuresForTest
    taskLoopLaunchAcceptanceFailuresForTest = count
    return {
      [Symbol.dispose]() {
        taskLoopLaunchAcceptanceFailuresForTest = previous
      },
    }
  },
  replaceTerminalIngressDeliveryRuntime(runtimeID: string): Disposable {
    const previous = terminalIngressDeliveryRuntimeOverrideForTest
    terminalIngressDeliveryRuntimeOverrideForTest = runtimeID
    return {
      [Symbol.dispose]() {
        if (terminalIngressDeliveryRuntimeOverrideForTest === runtimeID) {
          terminalIngressDeliveryRuntimeOverrideForTest = previous
        }
      },
    }
  },
  replaceTerminalIngressDelayedRetryDelay(delayMilliseconds: number): Disposable {
    if (!Number.isInteger(delayMilliseconds) || delayMilliseconds <= 0) {
      throw new Error(`Invalid terminal ingress delayed retry delay ${delayMilliseconds}`)
    }
    const previous = terminalIngressDelayedRetryDelayOverrideForTest
    terminalIngressDelayedRetryDelayOverrideForTest = delayMilliseconds
    return {
      [Symbol.dispose]() {
        if (terminalIngressDelayedRetryDelayOverrideForTest === delayMilliseconds) {
          terminalIngressDelayedRetryDelayOverrideForTest = previous
        }
      },
    }
  },
  persistTaskWaitWake(input: { taskID: string; jobID: string; fireID: string; dueAt?: number; note: string }): string {
    const task = findTask(input.taskID)
    if (!task) throw new Error(`Task wait wake task not found: ${input.taskID}`)
    return enqueueTaskEvent(task, {
      note: input.note,
      taskWaitWake: { jobID: input.jobID, fireID: input.fireID, dueAt: input.dueAt ?? 0 },
    })
  },
}

export function persistQueuedCoordinationWakeInTransaction(
  db: Database.TxOrDb,
  input: { taskID: string; rootSessionID: string; requestID: string; now?: number },
): string {
  const task = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, input.taskID)).get()
  if (!task) throw new Error(`Queued coordination wake task not found: ${input.taskID}`)
  if (task.session_id !== input.rootSessionID) {
    throw new Error(
      `Queued coordination wake root Session mismatch for ${input.taskID}: expected ${input.rootSessionID}, found ${task.session_id ?? "null"}`,
    )
  }
  return persistQueuedOperatorWakeInTransaction(
    db,
    task,
    { coordinationRequest: { requestID: input.requestID } },
    { requestID: input.requestID },
    input.now,
  )
}

function persistQueuedRecoveryWakeInTransaction(
  db: Database.TxOrDb,
  input: { task: TaskRow; recoveryFactID: string; note: string; now: number },
): string {
  return persistQueuedOperatorWakeInTransaction(
    db,
    input.task,
    {
      note: input.note,
      processRecovery: { recoveryFactID: input.recoveryFactID },
    },
    { recoveryFactID: input.recoveryFactID },
    input.now,
  )
}

/**
 * Persist the exact process-shutdown ownership handoff before prompt
 * controllers are cancelled. The infrastructure fact is the structured
 * occurrence; its paired wake is only durable delivery to the same natural
 * Orchestrator decision path after the next process starts.
 */
export function persistProcessShutdownRecoveryHandoffs(input: {
  tasks: Array<{
    taskID: string
    ownedSessionIDs: string[]
  }>
  reason: string
  now?: number
}): Array<{
  taskID: string
  recoveryFactID: string
  wakeID: string
}> {
  const now = input.now ?? Date.now()
  const tasks = input.tasks
    .map((task) => ({
      taskID: task.taskID,
      ownedSessionIDs: [...new Set(task.ownedSessionIDs)].sort(),
    }))
    .filter((task) => task.ownedSessionIDs.length > 0)
  if (tasks.length === 0) return []
  const physicalEvidence = currentProcessPhysicalEvidence()
  const recoveryContextByTask = new Map<string, ProcessRecoveryFactContextValue>()
  for (const task of tasks) {
    const affectedSubjects: ProcessRecoveryFactContextValue["affected_subjects"] = task.ownedSessionIDs.map(
      (sessionID) => {
        const session = Database.use((db) =>
          db
            .select({ timeCreated: SessionTable.time_created })
            .from(SessionTable)
            .where(eq(SessionTable.id, sessionID))
            .get(),
        )
        if (!session) throw new Error(`Process shutdown Session ${sessionID} is missing`)
        const occurrence = SessionStatus.executionOccurrence(sessionID)
        const descriptor = WorkerTurnDescriptor.latestForSession(sessionID)
        const worker = descriptor
          ? (() => {
              const dispatchID = descriptor.payload.dispatchTurn?.current_dispatch_id
              if (!dispatchID) {
                throw new Error(`Process shutdown Worker Turn ${descriptor.id} has no dispatch authority`)
              }
              const lineage = findDispatchLineageByDispatchID({ taskID: task.taskID, dispatchID })
              if (!lineage || lineage.payload.child_session_id !== sessionID) {
                throw new Error(`Process shutdown Worker Turn ${descriptor.id} has no exact dispatch lineage`)
              }
              return {
                worker_turn_descriptor: { id: descriptor.id, hash: descriptor.hash },
                dispatch_lineage_artifact_id: lineage.artifactID,
              }
            })()
          : undefined
        if (!occurrence && !descriptor) {
          return {
            kind: "affected_created_session" as const,
            session_id: sessionID,
            session_created_at: session.timeCreated,
          }
        }
        if (!occurrence && descriptor && worker) {
          return {
            kind: "affected_prepared_worker_turn" as const,
            session_id: sessionID,
            input_message_id: descriptor.payload.messageAuthority.user_message_id,
            worker,
          }
        }
        if (descriptor && descriptor.payload.messageAuthority.user_message_id !== occurrence.inputMessageID) {
          throw new Error(
            `Process shutdown Session ${sessionID} occurrence ${occurrence.inputMessageID} conflicts with descriptor ${descriptor.id}`,
          )
        }
        const lifecycle = ProtocolStore.latestSessionEvent(sessionID, SessionStatus.Event.Status.type)
        if (lifecycle?.payload?.inputMessageID !== occurrence.inputMessageID) {
          throw new Error(
            `Process shutdown Session ${sessionID} occurrence ${occurrence.inputMessageID} has no exact lifecycle event`,
          )
        }
        return {
          kind: "affected_execution" as const,
          session_id: sessionID,
          input_message_id: occurrence.inputMessageID,
          lifecycle_event_id: lifecycle.id,
          ...(worker ? { worker } : {}),
        }
      },
    )
    recoveryContextByTask.set(
      task.taskID,
      ProcessRecoveryFactContext.parse({
        schema_version: 1,
        origin: "process_shutdown",
        physical_evidence: physicalEvidence,
        affected_subjects: affectedSubjects,
      }),
    )
  }
  const results = Database.transaction((db) => {
    return tasks.flatMap(({ taskID, ownedSessionIDs }) => {
      const task = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, taskID)).get()
      if (!task || !isTaskActive(task)) return []
      const recoveryFactID = recordTaskInfrastructureErrorInTransaction(db, {
        taskID: task.id,
        component: "process-recovery",
        operation: "handoff-process-owned-task-execution",
        reason: `Backend shutdown interrupted current-process-owned Task execution: ${input.reason}`,
        errorName: "ProcessShutdownInterruptionError",
        context: {
          ...recoveryContextByTask.get(taskID)!,
        },
        now,
      })
      const wakeID = persistQueuedRecoveryWakeInTransaction(db, {
        task,
        recoveryFactID,
        note: `Recover process-shutdown Task execution handoff: ${ownedSessionIDs.join(", ")}`,
        now,
      })
      return [
        {
          taskID: task.id,
          recoveryFactID,
          wakeID,
        },
      ]
    })
  })
  return results
}

function discardPendingQueuedOperatorWakes(taskID: string): void {
  const now = Date.now()
  Database.transaction((db) =>
    updateEngineArtifactsWhere(db, {
      label: "discarded",
      timeUpdated: now,
      where: and(
        eq(EngineArtifactTable.task_id, taskID),
        eq(EngineArtifactTable.kind, "queued_operator_wake"),
        eq(EngineArtifactTable.label, "pending"),
      )!,
    }),
  )
}

export function discardPendingQueuedOperatorWakeForRequest(input: { taskID: string; requestID: string }): void {
  const now = Date.now()
  Database.transaction((db) =>
    updateEngineArtifactsWhere(db, {
      label: "discarded",
      timeUpdated: now,
      where: and(
        eq(EngineArtifactTable.task_id, input.taskID),
        eq(EngineArtifactTable.kind, "queued_operator_wake"),
        eq(EngineArtifactTable.label, "pending"),
        sql`json_extract(${EngineArtifactTable.payload}, '$.request_id') = ${input.requestID}`,
      )!,
    }),
  )
}

function peekQueuedTaskEvent(taskID: string): OrchestratorEvent | undefined {
  const durable = findNextPendingQueuedOperatorWake(taskID)
  return durable?.event
}

type QueuedOperatorWakeHead = {
  id: string
  label: string
  timeCreated: number
  wakeID: string
  rootSessionID: string
  ingress: QueuedTaskIngress
  event: OrchestratorEvent
}

function findQueuedOperatorWakeHead(taskID: string): QueuedOperatorWakeHead | undefined {
  const row = Database.use((db) =>
    db
      .select({
        id: EngineArtifactTable.id,
        label: EngineArtifactTable.label,
        payload: EngineArtifactTable.payload,
        timeCreated: EngineArtifactTable.time_created,
      })
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, taskID),
          eq(EngineArtifactTable.kind, "queued_operator_wake"),
          sql`${EngineArtifactTable.label} IN ('pending', 'running', 'delivery_failed')`,
        ),
      )
      .orderBy(immutableArtifactEnqueueOrdinal, EngineArtifactTable.id)
      .get(),
  )
  if (!row) return undefined
  const payload = QueuedTaskIngressSchema.parse(row.payload)
  return {
    id: row.id,
    label: row.label,
    timeCreated: row.timeCreated,
    wakeID: payload.wake_id,
    rootSessionID: payload.root_session_id,
    ingress: payload,
    event: payload.event,
  }
}

export const QueueOrderingTestHooks = {
  head(taskID: string): { id: string; label: string } | undefined {
    const head = findQueuedOperatorWakeHead(taskID)
    return head ? { id: head.id, label: head.label } : undefined
  },
}

function findNextPendingQueuedOperatorWake(taskID: string):
  | {
      id: string
      timeCreated: number
      wakeID: string
      rootSessionID: string
      ingress: QueuedTaskIngress
      event: OrchestratorEvent
    }
  | undefined {
  const head = findQueuedOperatorWakeHead(taskID)
  if (!head || head.label !== "pending") return undefined
  return head
}

function findQueuedOperatorWakeByID(taskID: string, artifactID: string) {
  const row = Database.use((db) =>
    db
      .select({
        id: EngineArtifactTable.id,
        label: EngineArtifactTable.label,
        payload: EngineArtifactTable.payload,
        timeCreated: EngineArtifactTable.time_created,
      })
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.id, artifactID),
          eq(EngineArtifactTable.task_id, taskID),
          eq(EngineArtifactTable.kind, "queued_operator_wake"),
        ),
      )
      .get(),
  )
  if (!row) return undefined
  return { ...row, ingress: QueuedTaskIngressSchema.parse(row.payload) }
}

export function dispatchInfrastructureFailureWakeDisposition(input: {
  taskID: string
  infrastructureFactID: string
}): "pending" | "running" | "drained" | "delivery_failed" | "terminal_inapplicable" {
  const rows = Database.use((db) =>
    db
      .select({ label: EngineArtifactTable.label })
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.kind, "queued_operator_wake"),
          sql`json_extract(${EngineArtifactTable.payload}, '$.infrastructure_fact_id') = ${input.infrastructureFactID}`,
        ),
      )
      .all(),
  )
  if (rows.length !== 1) {
    throw new Error(
      `Task ${input.taskID} infrastructure fact ${input.infrastructureFactID} has ${rows.length} durable wake receipts`,
    )
  }
  const label = rows[0]!.label
  if (
    label !== "pending" &&
    label !== "running" &&
    label !== "drained" &&
    label !== "delivery_failed" &&
    label !== "terminal_inapplicable"
  ) {
    throw new Error(
      `Task ${input.taskID} infrastructure fact ${input.infrastructureFactID} has unsupported wake disposition ${label}`,
    )
  }
  return label
}

function reconcileHistoricalNonTailFailedIngress(taskID: string, wakeID: string): boolean {
  const wake = findQueuedOperatorWakeByID(taskID, wakeID)
  if (
    wake?.label !== "delivery_failed" ||
    !["agent_lifecycle_delivery", "dispatch_infrastructure_failure"].includes(wake.ingress.source_kind)
  ) {
    return false
  }
  const controlMessageID = `msg_orchestrator_control_${wakeID}`
  const control = Database.use((db) =>
    db
      .select({ sessionID: MessageTable.session_id })
      .from(MessageTable)
      .where(
        and(
          eq(MessageTable.id, controlMessageID),
          sql`json_extract(${MessageTable.data}, '$.role') = 'user'`,
          sql`json_extract(${MessageTable.data}, '$.author') = 'orchestrator'`,
        ),
      )
      .get(),
  )
  if (!control || SessionPromptState.hasOwnedPromptInAnyDirectory(control.sessionID)) return false
  const latestUser = Database.use((db) =>
    db
      .select({ id: MessageTable.id })
      .from(MessageTable)
      .where(
        and(eq(MessageTable.session_id, control.sessionID), sql`json_extract(${MessageTable.data}, '$.role') = 'user'`),
      )
      .orderBy(desc(MessageTable.time_created), desc(MessageTable.id))
      .get(),
  )
  if (!latestUser || latestUser.id === controlMessageID) return false
  const assistantEvidence = Database.use((db) =>
    db
      .select({
        id: MessageTable.id,
        parentID: sql<string | null>`json_extract(${MessageTable.data}, '$.parentID')`,
      })
      .from(MessageTable)
      .where(
        and(
          eq(MessageTable.session_id, control.sessionID),
          sql`json_extract(${MessageTable.data}, '$.role') = 'assistant'`,
          sql`json_extract(${MessageTable.data}, '$.taskIngress.id') = ${wakeID}`,
        ),
      )
      .orderBy(MessageTable.time_created, MessageTable.id)
      .all(),
  )
  const task = findTask(taskID)
  if (!task) return false
  return Database.immediateTransaction((db) => {
    const head = db
      .select({ id: EngineArtifactTable.id, label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, taskID),
          eq(EngineArtifactTable.kind, "queued_operator_wake"),
          sql`${EngineArtifactTable.label} IN ('pending', 'running', 'delivery_failed')`,
        ),
      )
      .orderBy(immutableArtifactEnqueueOrdinal, EngineArtifactTable.id)
      .get()
    if (head?.id !== wakeID || head.label !== "delivery_failed") return false
    const activeDelivery = db
      .select({ id: EngineArtifactTable.id })
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, taskID),
          eq(EngineArtifactTable.kind, "queued_operator_wake"),
          sql`${EngineArtifactTable.label} IN ('pending', 'running')`,
        ),
      )
      .get()
    if (activeDelivery) return false
    const ingress = QueuedTaskIngressSchema.parse(head.payload)
    const now = Date.now()
    const reason =
      `Historical scheduler FIFO/provenance conflict: exact control ${controlMessageID} was superseded by ` +
      `${latestUser.id}; the failed ingress is preserved and will not be replayed against a different input.`
    patchEngineArtifact(db, {
      id: wakeID,
      label: "terminal_inapplicable",
      payload: QueuedTaskIngressSchema.parse({
        ...ingress,
        delivery_result: { status: "terminal_inapplicable", reason, time_completed: now },
      }),
      timeUpdated: now,
    })
    const recoveryFactID = recordTaskInfrastructureErrorInTransaction(db, {
      taskID,
      component: "engine-queue",
      operation: "reconcile-historical-wake-provenance-conflict",
      reason,
      errorName: "HistoricalWakeProvenanceConflictError",
      sessionID: control.sessionID,
      context: {
        historical_wake_id: wakeID,
        control_message_id: controlMessageID,
        latest_user_message_id: latestUser.id,
        assistant_evidence: assistantEvidence,
      },
      now,
    })
    persistQueuedRecoveryWakeInTransaction(db, {
      task,
      recoveryFactID,
      note: `Recover historical scheduler wake provenance conflict ${wakeID}`,
      now,
    })
    return true
  })
}

function findDurableAssistantForLaunchWake(input: {
  taskID: string
  wakeID: string
  ingress: QueuedTaskIngress
}): Message.Assistant | undefined {
  const row = Database.use((db) =>
    db
      .select({ id: MessageTable.id, sessionID: MessageTable.session_id, data: MessageTable.data })
      .from(MessageTable)
      .innerJoin(SessionTable, eq(SessionTable.id, MessageTable.session_id))
      .where(
        and(
          eq(SessionTable.parent_id, input.ingress.root_session_id),
          eq(SessionTable.kind, "orchestrator"),
          sql`json_extract(${MessageTable.data}, '$.role') = 'assistant'`,
          sql`json_extract(${MessageTable.data}, '$.taskIngress.id') = ${input.wakeID}`,
          sql`json_extract(${MessageTable.data}, '$.taskIngress.kind') = ${input.ingress.source_kind}`,
          sql`json_extract(${MessageTable.data}, '$.time.completed') IS NOT NULL`,
        ),
      )
      .orderBy(desc(MessageTable.time_created), desc(MessageTable.id))
      .get(),
  )
  if (!row) return undefined
  return Message.Assistant.parse({ ...row.data, id: row.id, sessionID: row.sessionID })
}

type RunningIngressReconciliation =
  | "owned"
  | "pending"
  | "drained"
  | "delivery_failed"
  | "terminal_inapplicable"
  | "missing"

async function reconcileOwnerlessRunningTaskIngress(input: {
  id: string
  taskID: string
  timeCreated: number
  ingress: QueuedTaskIngress
}): Promise<RunningIngressReconciliation> {
  if (SessionPromptState.rootWakeQueuePosition(input.ingress.root_session_id, input.id) !== undefined) {
    return "owned"
  }
  const durableAssistant = findDurableAssistantForLaunchWake({
    taskID: input.taskID,
    wakeID: input.id,
    ingress: input.ingress,
  })
  if (durableAssistant) {
    if (durableAssistant.error) {
      markQueuedOperatorWakeDeliveryFailed({
        artifactID: input.id,
        ingress: input.ingress,
        errorName: durableAssistant.error.name,
        message:
          typeof durableAssistant.error.data?.message === "string"
            ? durableAssistant.error.data.message
            : `Assistant delivery failed with ${durableAssistant.error.name}`,
        now: durableAssistant.time.completed,
      })
    } else {
      try {
        await assertQueuedWakeSettlement({
          taskID: input.taskID,
          wake: {
            id: input.id,
            timeCreated: input.timeCreated,
            wakeID: input.ingress.wake_id,
            rootSessionID: input.ingress.root_session_id,
            ingress: input.ingress,
            event: input.ingress.event,
          },
          result: { finalMessageID: durableAssistant.id },
        })
        markQueuedOperatorWakeDrained({
          artifactID: input.id,
          assistantMessageID: durableAssistant.id,
          now: durableAssistant.time.completed,
        })
      } catch (error) {
        markQueuedOperatorWakeDeliveryFailed({
          artifactID: input.id,
          ingress: input.ingress,
          errorName: error instanceof Error ? error.name : "QueuedWakeSettlementError",
          message: error instanceof Error ? error.message : String(error),
          now: durableAssistant.time.completed,
        })
      }
    }
  } else {
    Database.immediateTransaction((db) => {
      updateEngineArtifactWhereReturning(db, {
        where: and(
          eq(EngineArtifactTable.id, input.id),
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.kind, "queued_operator_wake"),
          eq(EngineArtifactTable.label, "running"),
        )!,
        kind: "queued_operator_wake",
        label: "pending",
        timeUpdated: Date.now(),
      })
    })
  }
  const current = findQueuedOperatorWakeByID(input.taskID, input.id)
  if (!current) return "missing"
  if (
    current.label === "pending" ||
    current.label === "drained" ||
    current.label === "delivery_failed" ||
    current.label === "terminal_inapplicable"
  ) {
    return current.label
  }
  if (current.label === "running") {
    if (SessionPromptState.rootWakeQueuePosition(current.ingress.root_session_id, current.id) !== undefined) {
      return "owned"
    }
    throw new Error(
      `Queued operator ingress ${input.id} remained running without a physical owner after reconciliation`,
    )
  }
  throw new Error(`Queued operator ingress ${input.id} has unsupported reconciliation state ${current.label}`)
}

async function reconcileOwnerlessRunningTaskIngressHead(
  taskID: string,
): Promise<RunningIngressReconciliation | undefined> {
  const head = findQueuedOperatorWakeHead(taskID)
  if (!head || head.label !== "running") return undefined
  return reconcileOwnerlessRunningTaskIngress({
    id: head.id,
    taskID,
    timeCreated: head.timeCreated,
    ingress: head.ingress,
  })
}

export async function requeueInterruptedRunningTaskIngresses(): Promise<number> {
  const cancelledTasks = Database.use((db) =>
    db
      .select({ id: EngineTaskTable.id, requestEventID: EngineTaskCancellationAuthorityTable.request_event_id })
      .from(EngineTaskTable)
      .innerJoin(
        EngineTaskCancellationAuthorityTable,
        eq(EngineTaskCancellationAuthorityTable.task_id, EngineTaskTable.id),
      )
      .where(
        and(eq(EngineTaskTable.project_id, Instance.project.id), sql`${EngineTaskTable.time_completed} IS NOT NULL`),
      )
      .all(),
  )
  for (const task of cancelledTasks) {
    terminalizeQueuedTaskEventsForCancellation({
      taskID: task.id,
      cancellationRequestEventID: task.requestEventID!,
    })
  }
  const rows = Database.use((db) =>
    db
      .select({
        id: EngineArtifactTable.id,
        taskID: EngineArtifactTable.task_id,
        payload: EngineArtifactTable.payload,
        timeCreated: EngineArtifactTable.time_created,
      })
      .from(EngineArtifactTable)
      .innerJoin(EngineTaskTable, eq(EngineTaskTable.id, EngineArtifactTable.task_id))
      .leftJoin(
        EngineTaskCancellationAuthorityTable,
        eq(EngineTaskCancellationAuthorityTable.task_id, EngineTaskTable.id),
      )
      .where(
        and(
          eq(EngineArtifactTable.kind, "queued_operator_wake"),
          eq(EngineArtifactTable.label, "running"),
          eq(EngineTaskTable.project_id, Instance.project.id),
          isNull(EngineTaskCancellationAuthorityTable.request_event_id),
        ),
      )
      .all(),
  )
  let requeued = 0
  const failures: Error[] = []
  for (const row of rows) {
    try {
      const ingress = QueuedTaskIngressSchema.parse(row.payload)
      const disposition = await reconcileOwnerlessRunningTaskIngress({
        id: row.id,
        taskID: row.taskID,
        timeCreated: row.timeCreated,
        ingress,
      })
      if (disposition === "pending") requeued += 1
    } catch (error) {
      failures.push(
        new Error(`Task ingress ${row.id}: ${error instanceof Error ? error.message : String(error)}`, {
          cause: error,
        }),
      )
    }
  }
  if (failures.length > 0)
    throw new AggregateError(failures, `Failed to requeue ${failures.length} running ingress(es)`)
  return requeued
}

function markQueuedOperatorWakeDrained(input: { artifactID: string; assistantMessageID: string; now?: number }): void {
  const now = input.now ?? Date.now()
  Database.immediateTransaction((db) => {
    const row = db
      .select({ label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
      .from(EngineArtifactTable)
      .where(and(eq(EngineArtifactTable.id, input.artifactID), eq(EngineArtifactTable.kind, "queued_operator_wake")))
      .get()
    if (!row) throw new Error(`Queued operator ingress ${input.artifactID} disappeared before settlement`)
    if (["drained", "terminal_inapplicable"].includes(row.label)) return
    if (row.label !== "running") {
      throw new Error(`Queued operator ingress ${input.artifactID} cannot settle from ${row.label}`)
    }
    patchEngineArtifact(db, {
      id: input.artifactID,
      label: "drained",
      payload: QueuedTaskIngressSchema.parse({
        ...QueuedTaskIngressSchema.parse(row.payload),
        delivery_result: {
          status: "completed",
          assistant_message_id: input.assistantMessageID,
          time_completed: now,
        },
      }),
      timeUpdated: now,
    })
  })
}

function markQueuedOperatorWakeRunning(artifactID: string): boolean {
  return Database.immediateTransaction((db) => {
    const updated = updateEngineArtifactWhereReturning(db, {
      where: and(
        eq(EngineArtifactTable.id, artifactID),
        eq(EngineArtifactTable.kind, "queued_operator_wake"),
        eq(EngineArtifactTable.label, "pending"),
      )!,
      kind: "queued_operator_wake",
      label: "running",
    })
    if (updated) return true
    const current = db
      .select({ label: EngineArtifactTable.label })
      .from(EngineArtifactTable)
      .where(and(eq(EngineArtifactTable.id, artifactID), eq(EngineArtifactTable.kind, "queued_operator_wake")))
      .get()
    if (!current) throw new Error(`Queued operator ingress ${artifactID} disappeared before execution`)
    if (current.label === "running") return true
    if (current.label === "terminal_inapplicable") return false
    throw new Error(`Queued operator ingress ${artifactID} cannot start from ${current.label}`)
  })
}

function markQueuedOperatorWakeDeliveryFailed(input: {
  artifactID: string
  ingress: QueuedTaskIngress
  errorName: string
  message: string
  now?: number
}): void {
  const now = input.now ?? Date.now()
  Database.immediateTransaction((db) => {
    const row = db
      .select({ label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
      .from(EngineArtifactTable)
      .where(and(eq(EngineArtifactTable.id, input.artifactID), eq(EngineArtifactTable.kind, "queued_operator_wake")))
      .get()
    if (!row) throw new Error(`Queued operator ingress ${input.artifactID} disappeared before failure settlement`)
    if (!["pending", "running", "delivery_failed"].includes(row.label)) return
    const currentIngress = QueuedTaskIngressSchema.parse(row.payload)
    updateEngineArtifactWhereReturning(db, {
      where: and(
        eq(EngineArtifactTable.id, input.artifactID),
        eq(EngineArtifactTable.kind, "queued_operator_wake"),
        sql`${EngineArtifactTable.label} IN ('pending', 'running', 'delivery_failed')`,
      )!,
      kind: "queued_operator_wake",
      label: "delivery_failed",
      payload: QueuedTaskIngressSchema.parse({
        ...currentIngress,
        delivery_result: {
          status: "delivery_failed",
          error_name: input.errorName,
          message: input.message,
          time_completed: now,
        },
      }),
      timeUpdated: now,
    })
  })
}

class QueuedWakeSettlementError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "QueuedWakeSettlementError"
  }
}

async function assistantMessagesForWakeSettlement(input: {
  taskID: string
  wakeID: string
  finalMessageID: string
  messageFence?: MessageFence
}): Promise<Message.WithParts[]> {
  const row = Database.use((db) =>
    db
      .select({
        sessionID: MessageTable.session_id,
        parentID: sql<string | null>`json_extract(${MessageTable.data}, '$.parentID')`,
        timeCreated: MessageTable.time_created,
      })
      .from(MessageTable)
      .where(eq(MessageTable.id, input.finalMessageID))
      .get(),
  )
  if (!row) {
    throw new QueuedWakeSettlementError(
      `Task ${input.taskID} wake ${input.wakeID} completed without persisted assistant message ${input.finalMessageID}`,
    )
  }
  if (!row.parentID) {
    throw new QueuedWakeSettlementError(
      `Task ${input.taskID} wake ${input.wakeID} final message ${input.finalMessageID} has no parent user message`,
    )
  }
  const wake = findQueuedOperatorWakeByID(input.taskID, input.wakeID)
  if (!wake) {
    throw new QueuedWakeSettlementError(`Task ${input.taskID} wake ${input.wakeID} disappeared before settlement`)
  }
  if (
    ["agent_lifecycle_delivery", "dispatch_infrastructure_failure"].includes(wake.ingress.source_kind) &&
    row.parentID !== `msg_orchestrator_control_${input.wakeID}`
  ) {
    throw new QueuedWakeSettlementError(
      `Task ${input.taskID} wake ${input.wakeID} final message ${input.finalMessageID} parent ${row.parentID} ` +
        `does not match exact control Message msg_orchestrator_control_${input.wakeID}`,
    )
  }
  const messageIDs = Database.use((db) =>
    db
      .select({ id: MessageTable.id })
      .from(MessageTable)
      .where(
        and(
          eq(MessageTable.session_id, row.sessionID),
          sql`json_extract(${MessageTable.data}, '$.role') = 'assistant'`,
          sql`json_extract(${MessageTable.data}, '$.taskIngress.id') = ${input.wakeID}`,
          sql`json_extract(${MessageTable.data}, '$.parentID') = ${row.parentID}`,
          input.messageFence
            ? sql`(${MessageTable.time_created} > ${input.messageFence.timeCreated} OR (${MessageTable.time_created} = ${input.messageFence.timeCreated} AND ${MessageTable.id} > ${input.messageFence.id}))`
            : undefined,
          sql`${MessageTable.time_created} <= ${row.timeCreated}`,
        )!,
      )
      .orderBy(MessageTable.time_created, MessageTable.id)
      .all()
      .map((message) => message.id),
  )
  const storedMessages = await MessageStore.byIDs({ sessionID: row.sessionID, messageIDs })
  const messagesByID = new Map(storedMessages.map((message) => [message.info.id, message]))
  const messages = messageIDs
    .map((id) => messagesByID.get(id))
    .filter((message): message is Message.WithParts => Boolean(message))
  if (
    messages.length === 0 ||
    messages.length !== messageIDs.length ||
    messages.at(-1)?.info.id !== input.finalMessageID
  ) {
    throw new QueuedWakeSettlementError(
      `Task ${input.taskID} wake ${input.wakeID} final message ${input.finalMessageID} is not the final assistant message for its invocation`,
    )
  }
  return messages
}

async function assertQueuedWakeSettlement(input: {
  taskID: string
  wake: NonNullable<ReturnType<typeof findNextPendingQueuedOperatorWake>>
  result: TaskLoopRunResult | void
  messageFence?: MessageFence
}): Promise<void> {
  const finalMessageID = input.result?.finalMessageID
  if (!finalMessageID) {
    throw new QueuedWakeSettlementError(
      `Task ${input.taskID} wake ${input.wake.id} completed without a final assistant message for ${input.wake.ingress.source_kind} ingress`,
    )
  }
  await assistantMessagesForWakeSettlement({
    taskID: input.taskID,
    wakeID: input.wake.id,
    finalMessageID,
    messageFence: input.messageFence,
  })
}

function latestMessageFence(): MessageFence | undefined {
  return Database.use((db) =>
    db
      .select({
        id: MessageTable.id,
        timeCreated: MessageTable.time_created,
      })
      .from(MessageTable)
      .orderBy(desc(MessageTable.time_created), desc(MessageTable.id))
      .get(),
  )
}

function hasQueuedTaskEvent(taskID: string): boolean {
  return findNextPendingQueuedOperatorWake(taskID) !== undefined
}

type QueuedTask = {
  id: string
  priority: string
  queueOrder: number
  timeCreated: number
  timeUpdated: number
}

export class TaskQueueReorderError extends Error {
  constructor(
    message: string,
    readonly code: "not_found" | "conflict" | "invalid_order",
  ) {
    super(message)
    this.name = "TaskQueueReorderError"
  }
}

function queueRevision(tasks: Array<Pick<QueuedTask, "id" | "queueOrder" | "timeUpdated">>) {
  return tasks.map((task) => `${task.id}:${task.queueOrder}:${task.timeUpdated}`).join("|")
}

function queuedTasksForCwd(cwd: string, input: { projectID?: string } = {}): QueuedTask[] {
  if (!cwd) return []
  return Database.use((db) => {
    const where = [
      sql`${EngineTaskTable.time_started} IS NULL`,
      sql`${EngineTaskTable.time_completed} IS NULL`,
      eq(SessionTable.directory, cwd),
    ]
    if (input.projectID) where.push(eq(EngineTaskTable.project_id, input.projectID))
    return db
      .select({
        id: EngineTaskTable.id,
        priority: EngineTaskTable.priority,
        queueOrder: EngineTaskTable.queue_order,
        timeCreated: EngineTaskTable.time_created,
        timeUpdated: EngineTaskTable.time_updated,
      })
      .from(EngineTaskTable)
      .innerJoin(SessionTable, eq(SessionTable.id, EngineTaskTable.session_id))
      .where(and(...where))
      .orderBy(
        sql`CASE ${EngineTaskTable.priority} WHEN 'critical' THEN 0 ELSE 1 END`,
        EngineTaskTable.queue_order,
        EngineTaskTable.time_created,
        EngineTaskTable.id,
      )
      .all()
  })
}

function nextQueuedTaskForCwd(cwd: string): TaskRow | undefined {
  if (!cwd) return undefined
  const row = Database.use((db) =>
    db
      .select({ task: EngineTaskTable })
      .from(EngineTaskTable)
      .innerJoin(SessionTable, eq(SessionTable.id, EngineTaskTable.session_id))
      .where(
        and(
          sql`${EngineTaskTable.time_started} IS NULL`,
          sql`${EngineTaskTable.time_completed} IS NULL`,
          eq(SessionTable.directory, cwd),
          sql`NOT EXISTS (
            SELECT 1
            FROM engine_task t2
            JOIN session s2 ON s2.id = t2.session_id
            WHERE t2.time_started IS NOT NULL AND t2.time_completed IS NULL
              AND COALESCE(json_extract(t2.metadata, '$.interrupted'), 0) != 1
              AND s2.directory = ${cwd}
          )`,
        ),
      )
      .orderBy(
        sql`CASE ${EngineTaskTable.priority} WHEN 'critical' THEN 0 ELSE 1 END`,
        EngineTaskTable.queue_order,
        EngineTaskTable.time_created,
        EngineTaskTable.id,
      )
      .get(),
  )
  return row?.task
}

export function directoryQueueSnapshot(cwd: string) {
  const queued = queuedTasksForCwd(cwd)
  return {
    directory: cwd,
    revision: queueRevision(queued),
    queuedTaskIDs: queued.map((task) => task.id),
  }
}

export function reorderQueuedTasksForCwd(input: {
  cwd: string
  projectID: string
  orderedTaskIDs: string[]
  revision?: string
  now?: number
}) {
  const cwd = input.cwd.trim()
  if (!cwd) throw new TaskQueueReorderError("directory is required", "invalid_order")
  const orderedTaskIDs = [...input.orderedTaskIDs]
  if (orderedTaskIDs.length !== new Set(orderedTaskIDs).size) {
    throw new TaskQueueReorderError("orderedTaskIDs contains duplicate task IDs", "invalid_order")
  }

  const now = input.now ?? Date.now()
  return Database.transaction((db) => {
    const queued = queuedTasksForCwd(cwd, { projectID: input.projectID })
    const currentRevision = queueRevision(queued)
    if (input.revision !== undefined && input.revision !== currentRevision) {
      throw new TaskQueueReorderError("directory queue changed; reload before reordering", "conflict")
    }
    const currentIDs = queued.map((task) => task.id)
    const currentSet = new Set(currentIDs)
    if (orderedTaskIDs.length !== currentIDs.length || !orderedTaskIDs.every((id) => currentSet.has(id))) {
      throw new TaskQueueReorderError(
        "orderedTaskIDs must contain every queued task in the directory and no active/completed tasks",
        "invalid_order",
      )
    }

    for (const [index, taskID] of orderedTaskIDs.entries()) {
      setEngineTaskQueueOrder(db, { taskID, queueOrder: index, timeUpdated: now })
    }
    const next = orderedTaskIDs.map((id, index) => ({ id, queueOrder: index, timeUpdated: now }))
    return {
      directory: cwd,
      revision: queueRevision(next),
      queuedTaskIDs: orderedTaskIDs,
    }
  })
}

function launchTaskLoop(
  task: TaskRow,
  wake: NonNullable<ReturnType<typeof findNextPendingQueuedOperatorWake>>,
  directory: string,
  runTaskLoop: TaskLoopRunner,
): Promise<void> {
  // Return the loop's own promise (absorbing errors). Callers that want to
  // observe actual loop exit (queue-advance hook) attach `.finally` to the
  // returned promise; callers that only want fire-and-forget ignore it.
  // Previously this was `void runTaskLoop(...).catch(...)` which discarded
  // the inner promise and resolved after mere scheduling — any `.finally`
  // attached by the caller fired before the loop had done anything, so the
  // queue-advance hook never fired on real task termination and sibling
  // queued tasks in the same cwd stayed stuck forever.
  return SessionPromptState.enqueueRootWake({
    rootSessionID: wake.rootSessionID,
    wakeID: wake.id,
    run: async (signal) => {
      if (!markQueuedOperatorWakeRunning(wake.id)) return
      const result = await runWithInitializedIndependentProject({
        directory,
        fn: async () => {
          if (signal.aborted) {
            if (!isExecutionCancellationError(signal.reason)) {
              throw new Error(`Root Session wake ${wake.id} has an untyped pre-execution cancellation reason`)
            }
            throw signal.reason
          }
          const messageFence = latestMessageFence()
          const result = await runTaskLoop({ taskID: task.id, event: wake.event, signal, wakeID: wake.id })
          if (signal.aborted) {
            if (!isExecutionCancellationError(signal.reason)) {
              throw new Error(`Root Session wake ${wake.id} has an untyped in-flight cancellation reason`)
            }
            throw signal.reason
          }
          await assertQueuedWakeSettlement({ taskID: task.id, wake, result, messageFence })
          return result
        },
      })
      const finalMessageID = result?.finalMessageID
      if (!finalMessageID) {
        throw new QueuedWakeSettlementError(`Task ${task.id} wake ${wake.id} lost its final assistant settlement`)
      }
      markQueuedOperatorWakeDrained({ artifactID: wake.id, assistantMessageID: finalMessageID })
    },
  }).catch(async (err) => {
    // Preserve the typed destructive-operation authority before database
    // normalization rebuilds unknown failures as plain Error instances.
    const exit = classifyTaskLoopExit(err)
    if (exit.kind === "cancelled") {
      log.info("task loop cancelled by typed execution authority", {
        taskID: task.id,
        wakeID: wake.id,
        source: exit.error.origin.source,
        requestID: exit.error.origin.requestID,
      })
      return
    }
    const error = exit.error
    log.error("task loop failed", {
      taskID: task.id,
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : undefined,
    })
    // The delivery attempt is physically over. Persist the exact failure
    // before the completion hook applies the bounded retry reserved for
    // exact terminal-lifecycle or dispatch-infrastructure delivery identities.
    markQueuedOperatorWakeDeliveryFailed({
      artifactID: wake.id,
      ingress: wake.ingress,
      errorName: error instanceof Error ? error.name : "Error",
      message: error instanceof Error ? error.message : String(error),
    })
    await runWithIndependentProjectIdentity({
      directory,
      fn: async () => {
        const current = findTask(task.id)
        if (!current || isTaskTerminal(current)) return
        const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
        const { recordTaskInfrastructureError } = await import("@/engine/persist")
        recordTaskInfrastructureError({
          taskID: current.id,
          component: "engine-queue",
          operation: "launch-task-loop",
          reason: message,
          errorName: error instanceof Error ? error.name : undefined,
          now: Date.now(),
        })
      },
    })
  })
}

function classifyTaskLoopExit(
  error: unknown,
):
  | { kind: "cancelled"; error: import("@/session/prompt/cancellation").ExecutionCancellationError }
  | { kind: "failed"; error: Error } {
  if (isExecutionCancellationError(error)) return { kind: "cancelled", error }
  const normalized = Database.normalizeError(error, "engine.queue.launchTaskLoop")
  return { kind: "failed", error: normalized instanceof Error ? normalized : new Error(String(normalized)) }
}

/**
 * Bind the cwd queue-advance hook to an in-flight loop promise.
 *
 * Single authoritative bind point between per-invocation loop lifecycle
 * and serial-queue progression. All paths that start a loop (initial
 * claim, operator retrigger on already-active task) route through here so
 * the "loop exited → advance siblings" contract is written exactly once.
 *
 * Idempotent against overlapping invocations for the same task: the Set
 * add/delete and the claim SQL both treat repeated calls as no-ops.
 */
function attachLoopCompletion(
  taskID: string,
  wakeID: string,
  cwd: string,
  launch: () => Promise<void>,
  reservedAuthority?: RuntimeExecutionReservation,
): void {
  const authority =
    reservedAuthority ??
    RuntimeExecutionSettlement.reserve("engine_queue_completion", `task-loop-completion:${taskID}:${wakeID}`)
  const launchID = taskLoopLaunchAuthorities.get(taskID)
  const completionKey = launchID ? `launch:${launchID}:wake:${wakeID}` : `wake:${wakeID}`
  const existingCompletion = taskLoopCompletionOperations.get(completionKey)
  if (existingCompletion) {
    authority.settleWith(existingCompletion)
    return
  }
  let completionHook: Promise<void>
  try {
    const loopPromise = launch()
    completionHook = Database.runOutsideContext(() =>
      runOutsideInstanceContext(() =>
        loopPromise.then(
          async () => {
            // Yield once so `advanceQueue` → `startLoopForTask` → `.finally`
            // re-entry doesn't stack synchronously, while keeping the async
            // completion hook observable for tests and diagnostics.
            await Promise.resolve()
            await settleTaskLoopCompletion({ taskID, wakeID, launchID, cwd, authority })
          },
          async () => {
            await Promise.resolve()
            await settleTaskLoopCompletion({ taskID, wakeID, launchID, cwd, authority })
          },
        ),
      ),
    )
  } catch (error) {
    authority.settle()
    throw error
  }
  taskLoopCompletionOperations.set(completionKey, completionHook)
  loopCompletionHooksForTest.add(completionHook)
  authority.settleWith(completionHook)
  void completionHook.finally(() => {
    if (taskLoopCompletionOperations.get(completionKey) === completionHook) {
      taskLoopCompletionOperations.delete(completionKey)
    }
    loopCompletionHooksForTest.delete(completionHook)
  })
}

type TaskLoopCompletionDisposition =
  | "same_task_wake_pending"
  | "exact_ingress_retry_attached"
  | "same_task_wake_attached"
  | "cwd_queue_observed"
  | "runtime_handoff"

async function runTaskLoopCompletionAttempt(input: {
  taskID: string
  wakeID: string
  cwd: string
}): Promise<TaskLoopCompletionDisposition> {
  return runWithInitializedIndependentProject({
    directory: input.cwd,
    fn: async () => {
      const task = findTask(input.taskID)
      if (task && isTaskTerminal(task)) {
        const { disposeTaskExecutionCapsule } = await import("@/execution-capsule/runtime")
        try {
          await disposeTaskExecutionCapsule(input.taskID)
        } catch (error) {
          const { recordTaskInfrastructureError } = await import("@/engine/persist")
          recordTaskInfrastructureError({
            taskID: input.taskID,
            component: "execution-capsule",
            operation: "dispose-terminal-task-container",
            reason: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
            errorName: error instanceof Error ? error.name : undefined,
            now: Date.now(),
          })
          throw error
        }
      }
      const currentWake = Database.use((db) =>
        db
          .select({ label: EngineArtifactTable.label })
          .from(EngineArtifactTable)
          .where(
            and(
              eq(EngineArtifactTable.id, input.wakeID),
              eq(EngineArtifactTable.task_id, input.taskID),
              eq(EngineArtifactTable.kind, "queued_operator_wake"),
            ),
          )
          .get(),
      )
      if (currentWake?.label === "running") {
        const wake = findQueuedOperatorWakeByID(input.taskID, input.wakeID)
        if (wake) {
          await reconcileOwnerlessRunningTaskIngress({
            id: wake.id,
            taskID: input.taskID,
            timeCreated: wake.timeCreated,
            ingress: wake.ingress,
          })
        }
      }
      const reconciledWake = findQueuedOperatorWakeByID(input.taskID, input.wakeID)
      if (reconciledWake?.label === "pending") return "same_task_wake_pending"
      if (reconciledWake?.label === "delivery_failed") {
        if (await retryFailedExactTerminalIngress(input.taskID, input.wakeID)) {
          return "exact_ingress_retry_attached"
        }
      }
      if (await drainQueuedTaskEvent(input.taskID)) return "same_task_wake_attached"
      if (taskLoopCompletionAdvanceFailuresForTest > 0) {
        taskLoopCompletionAdvanceFailuresForTest -= 1
        throw new Error("injected Task loop completion advanceQueue failure")
      }
      await advanceQueue(input.cwd)
      return "cwd_queue_observed"
    },
  })
}

function persistTaskLoopCompletionReceipt(input: {
  launchID: string
  taskID: string
  wakeID: string
  disposition: TaskLoopCompletionDisposition
  attempt: number
}): "recorded" | "launch_pending" {
  return Database.immediateTransaction((db) => {
    const row = db
      .select({ label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.id, input.launchID),
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.kind, "task_loop_launch"),
        ),
      )
      .get()
    if (!row) throw new Error(`Task loop launch ${input.launchID} disappeared before completion settlement`)
    if (row.label === "pending") return "launch_pending"
    const payload = artifactPayloadRecord(row.payload)
    patchEngineArtifact(db, {
      id: input.launchID,
      payload: {
        ...payload,
        completion_receipt: {
          status: "completed",
          wake_id: input.wakeID,
          disposition: input.disposition,
          attempt: input.attempt,
          owner_process_id: process.pid,
          time_completed: Date.now(),
        },
      },
    })
    return "recorded"
  })
}

async function settleTaskLoopCompletion(input: {
  taskID: string
  wakeID: string
  launchID?: string
  cwd: string
  authority: RuntimeExecutionReservation
}): Promise<void> {
  let attempt = 0
  for (;;) {
    attempt += 1
    try {
      if (settleAbortedTaskLoopCompletionHandoff({ ...input, attempt })) return
      const disposition = await runTaskLoopCompletionAttempt(input)
      if (input.launchID) {
        const receipt = persistTaskLoopCompletionReceipt({
          launchID: input.launchID,
          taskID: input.taskID,
          wakeID: input.wakeID,
          disposition,
          attempt,
        })
        if (receipt === "launch_pending") {
          if (settleAbortedTaskLoopCompletionHandoff({ ...input, attempt })) return
          throw new Error(`Task loop launch ${input.launchID} has not accepted its attached loop yet`)
        }
      }
      return
    } catch (cause) {
      let error = Database.normalizeError(cause, "engine.queue.loopCompletion")
      if (input.authority.signal.aborted) {
        try {
          if (settleAbortedTaskLoopCompletionHandoff({ ...input, attempt })) return
        } catch (handoffCause) {
          const handoffError = Database.normalizeError(handoffCause, "engine.queue.loopCompletionHandoff")
          error = new AggregateError(
            [error, handoffError],
            `Task ${input.taskID} wake ${input.wakeID} completion and durable runtime handoff both failed`,
          )
        }
      }
      if (attempt === 1 || (attempt & (attempt - 1)) === 0) {
        log.warn("Task loop completion will retry under its exact runtime authority", {
          taskID: input.taskID,
          wakeID: input.wakeID,
          launchID: input.launchID,
          cwd: input.cwd,
          attempt,
          error: error instanceof Error ? error.message : String(error),
          errorName: error instanceof Error ? error.name : undefined,
        })
      }
      const delay = Math.min(1_000, 25 * 2 ** Math.min(attempt - 1, 6))
      await new Promise<void>((resolve) => {
        if (input.authority.signal.aborted) {
          setTimeout(resolve, delay)
          return
        }
        const timer = setTimeout(finish, delay)
        function finish() {
          clearTimeout(timer)
          input.authority.signal.removeEventListener("abort", finish)
          resolve()
        }
        input.authority.signal.addEventListener("abort", finish, { once: true })
      })
    }
  }
}

function settleAbortedTaskLoopCompletionHandoff(input: {
  taskID: string
  wakeID: string
  launchID?: string
  authority: RuntimeExecutionReservation
  attempt: number
}): boolean {
  if (!input.authority.signal.aborted) return false
  const launchID = input.launchID
  if (!launchID) {
    const wake = Database.use((db) =>
      db
        .select({ id: EngineArtifactTable.id })
        .from(EngineArtifactTable)
        .where(
          and(
            eq(EngineArtifactTable.id, input.wakeID),
            eq(EngineArtifactTable.task_id, input.taskID),
            eq(EngineArtifactTable.kind, "queued_operator_wake"),
          ),
        )
        .get(),
    )
    if (!wake) throw new Error(`Task loop wake ${input.wakeID} disappeared before runtime handoff`)
    return true
  }
  return Database.immediateTransaction((db) => {
    const row = db
      .select({ label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.id, launchID),
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.kind, "task_loop_launch"),
        ),
      )
      .get()
    if (!row) throw new Error(`Task loop launch ${launchID} disappeared before runtime handoff`)
    if (row.label === "pending") {
      const payload = artifactPayloadRecord(row.payload)
      const handedOff = updateEngineArtifactWhereReturning(db, {
        where: and(
          eq(EngineArtifactTable.id, launchID),
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.kind, "task_loop_launch"),
          eq(EngineArtifactTable.label, "pending"),
        )!,
        kind: "task_loop_launch",
        label: "pending",
        payload: {
          ...payload,
          status: "runtime_handoff_pending",
          wake_id: input.wakeID,
          handoff_process_id: process.pid,
          handoff_attempt: Math.max(1, input.attempt),
          time_handed_off: Date.now(),
        },
      })
      if (handedOff) return true
    }
    const current = db
      .select({ label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
      .from(EngineArtifactTable)
      .where(eq(EngineArtifactTable.id, launchID))
      .get()
    if (!current) throw new Error(`Task loop launch ${launchID} disappeared during runtime handoff`)
    if (current.label === "pending") return true
    const payload = artifactPayloadRecord(current.payload)
    patchEngineArtifact(db, {
      id: launchID,
      payload: {
        ...payload,
        completion_receipt: {
          status: "completed",
          wake_id: input.wakeID,
          disposition: "runtime_handoff",
          attempt: Math.max(1, input.attempt),
          owner_process_id: process.pid,
          time_completed: Date.now(),
        },
      },
    })
    return true
  })
}

function resetFailedExactTerminalIngress(input: {
  taskID: string
  wakeID: string
  restartRuntimeAttemptWindow: boolean
}): QueuedTaskIngress | undefined {
  return Database.immediateTransaction((db) => {
    const current = db
      .select({ label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.id, input.wakeID),
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.kind, "queued_operator_wake"),
        ),
      )
      .get()
    if (current?.label !== "delivery_failed") return undefined
    const head = db
      .select({ id: EngineArtifactTable.id })
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.kind, "queued_operator_wake"),
          sql`${EngineArtifactTable.label} IN ('pending', 'running', 'delivery_failed')`,
        ),
      )
      .orderBy(EngineArtifactTable.time_created, EngineArtifactTable.id)
      .get()
    if (head?.id !== input.wakeID) return undefined
    const currentIngress = QueuedTaskIngressSchema.parse(current.payload)
    if (!input.restartRuntimeAttemptWindow && !canRetryTerminalIngressInCurrentRuntime(currentIngress)) {
      return undefined
    }
    const {
      delivery_result: _failedDelivery,
      queued_by_instance_directory: _failedInstanceDirectory,
      queued_by_project_id: _failedProjectID,
      ...retryIngress
    } = currentIngress
    const now = Date.now()
    patchEngineArtifact(db, {
      id: input.wakeID,
      label: "pending",
      payload: {
        ...retryIngress,
        delivery_attempt: currentIngress.delivery_attempt + 1,
        delivery_runtime_id: terminalIngressDeliveryRuntimeID(),
        delivery_runtime_attempt: input.restartRuntimeAttemptWindow
          ? 1
          : currentIngress.delivery_runtime_id === terminalIngressDeliveryRuntimeID()
            ? (currentIngress.delivery_runtime_attempt ?? currentIngress.delivery_attempt) + 1
            : 1,
        time_queued: now,
        queued_by_process_id: process.pid,
        ...(Instance.current()
          ? {
              queued_by_instance_directory: Instance.directory,
              queued_by_project_id: Instance.project.id,
            }
          : {}),
      },
      timeUpdated: now,
    })
    return currentIngress
  })
}

function restoreDelayedTerminalIngressFailure(input: {
  taskID: string
  wakeID: string
  failedIngress: QueuedTaskIngress
}): void {
  Database.immediateTransaction((db) => {
    const current = db
      .select({ label: EngineArtifactTable.label })
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.id, input.wakeID),
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.kind, "queued_operator_wake"),
        ),
      )
      .get()
    if (current?.label !== "pending") return
    patchEngineArtifact(db, {
      id: input.wakeID,
      label: "delivery_failed",
      payload: input.failedIngress,
      timeUpdated: Date.now(),
    })
  })
}

async function settleAcceptedExactTerminalIngressRecovery(ingress: QueuedTaskIngress): Promise<void> {
  if (ingress.source_kind === "agent_lifecycle_delivery") {
    const lifecycle = ingress.event.agentLifecycleDelivery
    const lineage = listDispatchLineage(ingress.task_id).find(
      (candidate) =>
        candidate.dispatchID === lifecycle.dispatchID && candidate.payload.child_session_id === lifecycle.sessionID,
    )
    if (!lineage) throw new Error(`Exact lifecycle ingress ${ingress.wake_id} has no dispatch lineage`)
    await settleDetachedDispatchRecovery(lineage.artifactID)
    return
  }
  if (ingress.source_kind !== "dispatch_infrastructure_failure") return
  const authority = ingress.event.dispatchInfrastructureFailure.outcome.recovery_authority
  if (authority.occurrence_status === "occurrence_committed") {
    await settleDetachedDispatchRecovery(authority.dispatch_lineage_id)
  }
}

function scheduleDelayedExactTerminalIngressRetry(input: {
  taskID: string
  wakeID: string
  ingress: QueuedTaskIngress
}): void {
  if (terminalIngressDelayedRetryOwners.has(input.wakeID)) return
  const task = findTask(input.taskID)
  if (!task) return
  const directory = taskRootDirectory(task)
  let authority: RuntimeExecutionReservation
  try {
    authority = RuntimeExecutionSettlement.reserve(
      "engine_queue_completion",
      `terminal-ingress-delayed-retry:${input.taskID}:${input.wakeID}`,
    )
  } catch (error) {
    if (error instanceof RuntimeExecutionAdmissionClosedError && error.kind === "engine_queue_completion") return
    throw error
  }
  const delay = terminalIngressDelayedRetryDelay(input.ingress)
  let operation!: Promise<void>
  let retryAfterFailure = false
  operation = new Promise<void>((resolve) => {
    if (authority.signal.aborted) return resolve()
    const timer = setTimeout(finish, delay)
    function finish() {
      clearTimeout(timer)
      authority.signal.removeEventListener("abort", finish)
      resolve()
    }
    authority.signal.addEventListener("abort", finish, { once: true })
  })
    .then(async () => {
      if (authority.signal.aborted) return
      await runWithInitializedIndependentProject({
        directory,
        fn: async () => {
          authority.signal.throwIfAborted()
          const failedIngress = resetFailedExactTerminalIngress({
            taskID: input.taskID,
            wakeID: input.wakeID,
            restartRuntimeAttemptWindow: true,
          })
          if (!failedIngress) {
            const current = findQueuedOperatorWakeByID(input.taskID, input.wakeID)
            if (current?.label === "delivery_failed") retryAfterFailure = true
            return
          }
          let result: DispatchTaskLoopResult
          try {
            authority.signal.throwIfAborted()
            result = await dispatchPersistedTaskLoop(input.taskID, input.wakeID)
          } catch (error) {
            restoreDelayedTerminalIngressFailure({
              taskID: input.taskID,
              wakeID: input.wakeID,
              failedIngress,
            })
            throw error
          }
          if (result !== "started" && result !== "queued") {
            restoreDelayedTerminalIngressFailure({
              taskID: input.taskID,
              wakeID: input.wakeID,
              failedIngress,
            })
            if (result === "ignored") {
              retryAfterFailure = true
              return
            }
            throw new Error(`Delayed exact terminal ingress retry was ${result}`)
          }
          await settleAcceptedExactTerminalIngressRecovery(failedIngress)
        },
      })
    })
    .catch((error) => {
      if (authority.signal.aborted) return
      retryAfterFailure = true
      log.error("delayed exact terminal ingress retry failed", {
        taskID: input.taskID,
        ingressID: input.wakeID,
        error: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : undefined,
      })
    })
    .finally(() => {
      if (terminalIngressDelayedRetryOwners.get(input.wakeID) === operation) {
        terminalIngressDelayedRetryOwners.delete(input.wakeID)
      }
      if (!retryAfterFailure || authority.signal.aborted) return
      const failed = Database.use((db) =>
        db
          .select({ label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
          .from(EngineArtifactTable)
          .where(
            and(
              eq(EngineArtifactTable.id, input.wakeID),
              eq(EngineArtifactTable.task_id, input.taskID),
              eq(EngineArtifactTable.kind, "queued_operator_wake"),
            ),
          )
          .get(),
      )
      if (failed?.label === "delivery_failed") {
        scheduleDelayedExactTerminalIngressRetry({
          taskID: input.taskID,
          wakeID: input.wakeID,
          ingress: QueuedTaskIngressSchema.parse(failed.payload),
        })
      }
    })
  terminalIngressDelayedRetryOwners.set(input.wakeID, operation)
  authority.settleWith(operation)
}

async function retryFailedExactTerminalIngress(
  taskID: string,
  wakeID: string,
  options: { dispatchAfterReset?: boolean } = {},
): Promise<boolean> {
  if (reconcileHistoricalNonTailFailedIngress(taskID, wakeID)) {
    await drainQueuedTaskEvent(taskID)
    return true
  }
  const row = Database.use((db) =>
    db
      .select({ label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.id, wakeID),
          eq(EngineArtifactTable.task_id, taskID),
          eq(EngineArtifactTable.kind, "queued_operator_wake"),
        ),
      )
      .get(),
  )
  if (row?.label !== "delivery_failed") return false
  const ingress = QueuedTaskIngressSchema.parse(row.payload)
  if (!canRetryTerminalIngressInCurrentRuntime(ingress)) {
    scheduleDelayedExactTerminalIngressRetry({ taskID, wakeID, ingress })
    return false
  }
  if (ingress.source_kind === "agent_lifecycle_delivery") {
    const lifecycle = ingress.event.agentLifecycleDelivery
    const result = await reconcileTerminalAgentLifecycleDelivery({
      taskID,
      sessionID: lifecycle.sessionID,
      dispatchID: lifecycle.dispatchID,
    })
    if (result === "delivered" || result === "already_delivered") return true
    log.warn("exact lifecycle ingress retry was not accepted", { taskID, wakeID, result })
    return false
  }
  if (ingress.source_kind === "dispatch_infrastructure_failure") {
    const result = await dispatchTaskLoop({ taskID, event: ingress.event })
    if (result === "started" || result === "queued") {
      const authority = ingress.event.dispatchInfrastructureFailure.outcome.recovery_authority
      if (authority.occurrence_status === "occurrence_committed") {
        await settleDetachedDispatchRecovery(authority.dispatch_lineage_id)
      }
      return true
    }
    log.warn("exact infrastructure ingress retry was not accepted", { taskID, wakeID, result })
    return false
  }
  const reset = resetFailedExactTerminalIngress({
    taskID,
    wakeID,
    restartRuntimeAttemptWindow: false,
  })
  if (!reset) return false
  if (options.dispatchAfterReset === false) return true
  const result = await dispatchPersistedTaskLoop(taskID, wakeID)
  if (result === "started" || result === "queued") return true
  log.warn("exact terminal ingress retry was not accepted", { taskID, wakeID, sourceKind: ingress.source_kind, result })
  return false
}

function attachTerminalIngressCompletion(
  task: TaskRow,
  wake: NonNullable<ReturnType<typeof findNextPendingQueuedOperatorWake>>,
  directory: string,
): void {
  if (terminalIngressCompletions.has(wake.id)) return
  const authority = RuntimeExecutionSettlement.reserve(
    "engine_queue_completion",
    `terminal-ingress-completion:${task.id}:${wake.id}`,
  )
  let retryAfterOwnershipRelease = false
  let deliveryCompletion: Promise<void>
  try {
    deliveryCompletion = Database.runOutsideContext(() =>
      runOutsideInstanceContext(() =>
        SessionPromptState.waitForRootWakeSettlement(wake.rootSessionID, wake.id)
          .then(() =>
            runWithInitializedIndependentProject({
              directory,
              fn: () => {
                const currentWake = Database.use((db) =>
                  db
                    .select({ label: EngineArtifactTable.label })
                    .from(EngineArtifactTable)
                    .where(
                      and(
                        eq(EngineArtifactTable.id, wake.id),
                        eq(EngineArtifactTable.task_id, task.id),
                        eq(EngineArtifactTable.kind, "queued_operator_wake"),
                      ),
                    )
                    .get(),
                )
                if (currentWake?.label !== "pending") return undefined
                return deliverTerminalTaskIngress({
                  task,
                  ingressArtifactID: wake.id,
                  ingress: wake.ingress,
                })
              },
            }),
          )
          .then(async (delivery) => {
            if (!delivery?.settled) return
            await runWithInitializedIndependentProject({
              directory,
              fn: async () => {
                if (delivery.result.status === "delivery_failed") {
                  if (
                    await retryFailedExactTerminalIngress(task.id, wake.id, {
                      dispatchAfterReset: false,
                    })
                  ) {
                    retryAfterOwnershipRelease = true
                    return
                  }
                }
                if (hasQueuedTaskEvent(task.id)) await drainQueuedTaskEvent(task.id)
              },
            })
          })
          .catch(async (error) => {
            const normalized = Database.normalizeError(error, "engine.queue.terminalIngressCompletion")
            log.error("terminal Task ingress remains pending after interrupted delivery", {
              taskID: task.id,
              ingressID: wake.id,
              error: normalized instanceof Error ? normalized.message : String(normalized),
              errorName: normalized instanceof Error ? normalized.name : undefined,
            })
            await runWithInitializedIndependentProject({
              directory,
              fn: async () => {
                if (
                  await retryFailedExactTerminalIngress(task.id, wake.id, {
                    dispatchAfterReset: false,
                  })
                ) {
                  retryAfterOwnershipRelease = true
                  return
                }
                if (hasQueuedTaskEvent(task.id)) await drainQueuedTaskEvent(task.id)
              },
            })
          }),
      ),
    )
  } catch (error) {
    authority.settle()
    throw error
  }
  let completion: Promise<void>
  completion = deliveryCompletion
    .finally(() => {
      if (terminalIngressCompletions.get(wake.id) === completion) terminalIngressCompletions.delete(wake.id)
    })
    .then(async () => {
      if (!retryAfterOwnershipRelease) return
      await runWithInitializedIndependentProject({
        directory,
        fn: async () => {
          if (hasQueuedTaskEvent(task.id)) await drainQueuedTaskEvent(task.id)
        },
      })
    })
  terminalIngressCompletions.set(wake.id, completion)
  loopCompletionHooksForTest.add(completion)
  authority.settleWith(completion)
  void completion.finally(() => {
    loopCompletionHooksForTest.delete(completion)
  })
}

export async function waitForQueueCompletionHooksForTest(): Promise<void> {
  for (;;) {
    const pending = [...loopCompletionHooksForTest]
    if (pending.length === 0) return
    await Promise.allSettled(pending)
  }
}

export async function drainQueuedTaskEvent(taskID: string): Promise<boolean> {
  await reconcileOwnerlessRunningTaskIngressHead(taskID)
  if (!hasQueuedTaskEvent(taskID)) return false

  const task = findTask(taskID)
  if (!task) {
    discardQueuedTaskEvent(taskID)
    log.warn("discarding queued wake for missing task", { taskID })
    return false
  }

  const queuedEvent = peekQueuedTaskEvent(taskID)
  if (
    task.session_id &&
    queuedEvent?.processRecovery &&
    SessionPromptState.isRootSessionProcessShutdownHandoffActive(task.session_id)
  ) {
    log.info("preserving process-shutdown recovery wake for the replacement process", {
      taskID,
      sessionID: task.session_id,
      recoveryFactID: queuedEvent.processRecovery.recoveryFactID,
    })
    return false
  }

  const cwd = taskRootDirectory(task)

  if (isTaskTerminal(task)) {
    const queuedWake = findNextPendingQueuedOperatorWake(taskID)
    if (!queuedWake) return false
    if (task.session_id && SessionPromptState.hasOwnedPrompt(task.session_id, cwd)) {
      log.info("terminal decision remains owned by the root prompt delivering this wake", {
        taskID,
        sessionID: task.session_id,
        status: deriveTaskStatus(task),
      })
      return false
    }
    attachTerminalIngressCompletion(task, queuedWake, cwd)
    log.info("enqueued persisted terminal Task ingress", {
      taskID,
      ingressID: queuedWake.id,
      sourceKind: queuedWake.ingress.source_kind,
      status: deriveTaskStatus(task),
    })
    return true
  }

  if (isTaskQueued(task)) {
    await advanceQueue(cwd)
    return !hasQueuedTaskEvent(taskID)
  }

  const runTaskLoop = requireTaskLoopRunner()
  const queuedWake = findNextPendingQueuedOperatorWake(taskID)
  if (!queuedWake) return false
  attachLoopCompletion(taskID, queuedWake.id, cwd, () => launchTaskLoop(task, queuedWake, cwd, runTaskLoop))
  log.info("enqueued persisted root Session wake", { taskID, wakeID: queuedWake.id })
  return true
}

export async function drainPendingQueuedOperatorWakes(): Promise<number> {
  reconcilePendingCoordinationRequestWakes()
  const cancellingTaskIDs = new Set(
    Database.use((db) =>
      db
        .select({ taskID: EngineTaskCancellationAuthorityTable.task_id })
        .from(EngineTaskCancellationAuthorityTable)
        .innerJoin(EngineTaskTable, eq(EngineTaskTable.id, EngineTaskCancellationAuthorityTable.task_id))
        .where(eq(EngineTaskTable.project_id, Instance.project.id))
        .all()
        .map((row) => row.taskID),
    ),
  )
  const taskIDs = [
    ...new Set(
      pendingQueuedOperatorWakeTaskIDs(Instance.project.id).filter((taskID) => !cancellingTaskIDs.has(taskID)),
    ),
  ]
  let drained = 0
  const failures: string[] = []
  for (const taskID of taskIDs) {
    try {
      if (await drainQueuedTaskEvent(taskID)) drained += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failures.push(`${taskID}: ${message}`)
      log.error("queued operator wake failed lineage validation", {
        taskID,
        error: message,
        errorName: error instanceof Error ? error.name : undefined,
      })
    }
  }
  if (failures.length > 0) {
    throw new Error(`Failed to drain ${failures.length} queued operator wake(s): ${failures.join("; ")}`)
  }
  return drained
}

type InterruptedSessionEvidence = {
  session_id: string
  agent_id?: string
  session_kind: string
  status: "created" | "prepared" | "streaming" | "retry"
  status_event_id: string
  status_emitted_at: number
  input_message_id?: string
  worker_turn_descriptor_id?: string
  worker_turn_descriptor_hash?: string
  runtime_contract_error?: {
    code: "worker_turn_descriptor_incompatible"
    descriptor_id: string
    message: string
  }
}

function latestSessionStatusEvent(sessionID: string) {
  const event = ProtocolStore.latestSessionEvent(sessionID, SessionStatus.Event.Status.type)
  return event ? { id: event.id, emittedAt: event.time.emitted, payload: event.payload } : undefined
}

export function listInterruptedSessionEvidence(input: {
  taskID: string
  rootSessionID: string
  ownedSessionIDs: ReadonlySet<string>
}): InterruptedSessionEvidence[] {
  const projected = listTaskConversationAgentSessions(input.taskID).flatMap((session): InterruptedSessionEvidence[] => {
    const event = latestSessionStatusEvent(session.sessionID)
    const descriptor = session.runtimeContractError
      ? undefined
      : WorkerTurnDescriptor.latestForSession(session.sessionID)
    const priorLifecycleEventID = descriptor?.payload.lifecycle.priorLifecycleEventID
    if (priorLifecycleEventID) {
      let priorLifecycle
      try {
        priorLifecycle = ProtocolStore.requireEvent(priorLifecycleEventID)
      } catch (error) {
        throw new Error(
          `Interrupted Session ${session.sessionID} Worker Turn ${descriptor.id} references missing prior lifecycle event ${priorLifecycleEventID}`,
          { cause: error },
        )
      }
      if (priorLifecycle.sessionID !== session.sessionID || priorLifecycle.type !== SessionStatus.Event.Status.type) {
        throw new Error(
          `Interrupted Session ${session.sessionID} Worker Turn ${descriptor.id} prior lifecycle event ${priorLifecycleEventID} has different authority`,
        )
      }
    }
    const preparedAfterLatestLifecycle = descriptor !== undefined && priorLifecycleEventID === event?.id
    if (
      session.sessionID === input.rootSessionID ||
      input.ownedSessionIDs.has(session.sessionID) ||
      !isAgentInvocationSession(session) ||
      (session.latestStatus !== undefined &&
        session.latestStatus.type !== "streaming" &&
        session.latestStatus.type !== "retry" &&
        !preparedAfterLatestLifecycle)
    ) {
      return []
    }
    const status: InterruptedSessionEvidence["status"] = preparedAfterLatestLifecycle
      ? "prepared"
      : session.latestStatus?.type === "streaming"
        ? "streaming"
        : session.latestStatus?.type === "retry"
          ? "retry"
          : "created"
    const eventStatus =
      event?.payload &&
      typeof event.payload === "object" &&
      !Array.isArray(event.payload) &&
      event.payload.status &&
      typeof event.payload.status === "object" &&
      !Array.isArray(event.payload.status)
        ? (event.payload.status as { type?: unknown }).type
        : undefined
    const eventInputMessageID =
      event?.payload && typeof event.payload.inputMessageID === "string" ? event.payload.inputMessageID : undefined
    const inputMessageID = resolveProcessRecoveryInputAuthority({
      preparedWorkerInputMessageID: preparedAfterLatestLifecycle
        ? descriptor?.payload.messageAuthority.user_message_id
        : undefined,
      lifecycleInputMessageID: eventInputMessageID,
    })
    if (
      status !== "created" &&
      status !== "prepared" &&
      (!event || eventStatus !== status || event.emittedAt !== session.latestStatusEmittedAt)
    ) {
      throw new Error(
        `Interrupted Session ${session.sessionID} latest lifecycle identity does not match its Task ledger projection`,
      )
    }
    if ((status === "streaming" || status === "retry") && !eventInputMessageID) {
      throw new Error(`Interrupted Session ${session.sessionID} lifecycle has no input message identity`)
    }
    return [
      {
        session_id: session.sessionID,
        agent_id: session.agentID,
        session_kind: session.stage,
        status,
        status_event_id: preparedAfterLatestLifecycle
          ? `worker-turn-prepared:${descriptor.id}`
          : (event?.id ?? `session-created:${session.sessionID}:${session.timeCreated}`),
        status_emitted_at: preparedAfterLatestLifecycle
          ? descriptor.time.created
          : (event?.emittedAt ?? session.timeCreated),
        ...(inputMessageID ? { input_message_id: inputMessageID } : {}),
        ...(descriptor
          ? { worker_turn_descriptor_id: descriptor.id, worker_turn_descriptor_hash: descriptor.hash }
          : session.runtimeContractError
            ? { worker_turn_descriptor_id: session.runtimeContractError.descriptorID }
            : {}),
        ...(session.runtimeContractError
          ? {
              runtime_contract_error: {
                code: session.runtimeContractError.code,
                descriptor_id: session.runtimeContractError.descriptorID,
                message: session.runtimeContractError.message,
              },
            }
          : {}),
      },
    ]
  })
  const projectedIDs = new Set(projected.map((session) => session.session_id))
  const rows = Database.use((db) =>
    db
      .select({
        id: SessionTable.id,
        parentID: SessionTable.parent_id,
        kind: SessionTable.kind,
        timeCreated: SessionTable.time_created,
      })
      .from(SessionTable)
      .where(eq(SessionTable.project_id, Instance.project.id))
      .all(),
  )
  const byID = new Map(rows.map((row) => [row.id, row]))
  const belongsToTaskRoot = (sessionID: string): boolean => {
    let current = byID.get(sessionID)
    const visited = new Set<string>()
    while (current && !visited.has(current.id)) {
      if (current.id === input.rootSessionID) return true
      visited.add(current.id)
      current = current.parentID ? byID.get(current.parentID) : undefined
    }
    return false
  }
  const created = rows.flatMap((row): InterruptedSessionEvidence[] => {
    if (
      row.id === input.rootSessionID ||
      projectedIDs.has(row.id) ||
      input.ownedSessionIDs.has(row.id) ||
      !belongsToTaskRoot(row.id) ||
      !RuntimeTemplateRegistry.isWorkerSessionKind(row.kind) ||
      latestSessionStatusEvent(row.id) ||
      WorkerTurnDescriptor.latestForSession(row.id)
    ) {
      return []
    }
    const message = Database.use((db) =>
      db.select({ id: MessageTable.id }).from(MessageTable).where(eq(MessageTable.session_id, row.id)).get(),
    )
    if (message) return []
    return [
      {
        session_id: row.id,
        session_kind: row.kind,
        status: "created",
        status_event_id: `session-created:${row.id}:${row.timeCreated}`,
        status_emitted_at: row.timeCreated,
      },
    ]
  })
  return [...projected, ...created].sort((left, right) => left.status_event_id.localeCompare(right.status_event_id))
}

/**
 * Recover a Task whose prior process disappeared while an Agent invocation
 * was physically active.
 *
 * A created worker Session, a prepared Turn authority, or persisted
 * streaming/retry status is interruption evidence only after the current
 * process proves it owns no prompt controller. The Host closes those
 * ownerless physical Sessions, records that fact, and wakes the existing
 * Orchestrator; it does not retry a workflow occurrence or reconstruct the
 * lost provider stream.
 */
export async function reconcileInterruptedTaskExecutions(): Promise<number> {
  const interruptedLaunches = Database.use((db) =>
    db
      .select({ task: EngineTaskTable, launchID: EngineArtifactTable.id, launchPayload: EngineArtifactTable.payload })
      .from(EngineArtifactTable)
      .innerJoin(EngineTaskTable, eq(EngineTaskTable.id, EngineArtifactTable.task_id))
      .where(
        and(
          eq(EngineArtifactTable.kind, "task_loop_launch"),
          eq(EngineArtifactTable.label, "pending"),
          eq(EngineTaskTable.project_id, Instance.project.id),
        ),
      )
      .all(),
  )
  let recoveredLaunches = 0
  const failures: string[] = []
  for (const row of interruptedLaunches) {
    if (taskLoopLaunchAuthorities.has(row.task.id)) continue
    if (listOwnedPromptSessionsForTask(row.task.id).length > 0) continue
    try {
      const now = Date.now()
      if (row.task.time_completed != null) {
        Database.transaction((db) =>
          patchEngineArtifact(db, {
            id: row.launchID,
            label: "completed",
            payload: {
              task_id: row.task.id,
              status: "terminal_inapplicable",
              terminal_status: deriveTaskStatus(row.task),
              recovery_process_id: process.pid,
              time_settled: now,
            },
          }),
        )
        recoveredLaunches += 1
        continue
      }
      const launchPayload = artifactPayloadRecord(row.launchPayload)
      const wakeID = typeof launchPayload.wake_id === "string" ? launchPayload.wake_id : undefined
      if (wakeID) {
        const exactWake = Database.use((db) =>
          db
            .select({
              label: EngineArtifactTable.label,
              payload: EngineArtifactTable.payload,
              timeCreated: EngineArtifactTable.time_created,
            })
            .from(EngineArtifactTable)
            .where(
              and(
                eq(EngineArtifactTable.id, wakeID),
                eq(EngineArtifactTable.task_id, row.task.id),
                eq(EngineArtifactTable.kind, "queued_operator_wake"),
              ),
            )
            .get(),
        )
        if (!exactWake) {
          throw new Error(`Task loop launch ${row.launchID} is bound to missing wake ${wakeID}`)
        }
        const ingress = QueuedTaskIngressSchema.parse(exactWake.payload)
        const assistant = findDurableAssistantForLaunchWake({ taskID: row.task.id, wakeID, ingress })
        if ((exactWake.label === "drained" || exactWake.label === "running") && assistant) {
          if (assistant.error) {
            throw new Error(
              `Task loop launch ${row.launchID} wake ${wakeID} has failed assistant ${assistant.id}: ${assistant.error.name}`,
            )
          }
          if (exactWake.label === "running") {
            await assertQueuedWakeSettlement({
              taskID: row.task.id,
              wake: {
                id: wakeID,
                timeCreated: exactWake.timeCreated,
                wakeID: ingress.wake_id,
                rootSessionID: ingress.root_session_id,
                ingress,
                event: ingress.event,
              },
              result: { finalMessageID: assistant.id },
            })
            markQueuedOperatorWakeDrained({ artifactID: wakeID, assistantMessageID: assistant.id })
          }
          Database.transaction((db) =>
            patchEngineArtifact(db, {
              id: row.launchID,
              label: "completed",
              payload: {
                task_id: row.task.id,
                wake_id: wakeID,
                status: "recovered_exact_wake_completion",
                assistant_message_id: assistant.id,
                recovery_process_id: process.pid,
                time_settled: now,
              },
            }),
          )
          recoveredLaunches += 1
          continue
        }
        if (exactWake.label === "drained") {
          throw new Error(`Task loop launch ${row.launchID} wake ${wakeID} is drained without an assistant anchor`)
        }
        if (["delivery_failed", "terminal_inapplicable"].includes(exactWake.label)) {
          Database.transaction((db) =>
            patchEngineArtifact(db, {
              id: row.launchID,
              label: "completed",
              payload: {
                task_id: row.task.id,
                wake_id: wakeID,
                status: "recovered_exact_wake_settlement",
                wake_status: exactWake.label,
                recovery_process_id: process.pid,
                time_settled: now,
              },
            }),
          )
          recoveredLaunches += 1
          continue
        }
        if (exactWake.label === "running") {
          updateEngineArtifact({ id: wakeID, label: "pending", timeUpdated: now })
        }
      }
      Database.transaction((db) => {
        writeTaskUpdateInTransaction({
          db,
          taskID: row.task.id,
          values: { status: "queued" },
          summary: "Recovered interrupted Task launch handoff",
          now,
        })
        patchEngineArtifact(db, {
          id: row.launchID,
          label: "completed",
          payload: {
            task_id: row.task.id,
            status: "recovered_to_queue",
            recovery_process_id: process.pid,
            time_settled: now,
          },
        })
      })
      recoveredLaunches += 1
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      failures.push(`Task ${row.task.id} launch ${row.launchID}: ${message}`)
      log.error("interrupted Task launch recovery failed", {
        taskID: row.task.id,
        launchID: row.launchID,
        error: message,
        errorName: cause instanceof Error ? cause.name : undefined,
      })
    }
  }
  const taskIDs = listStartedIncompleteTaskIDs({ projectID: Instance.project.id })
  let recovered = recoveredLaunches

  for (const taskID of taskIDs) {
    try {
      const taskSnapshot = findTask(taskID)
      if (!taskSnapshot?.session_id) continue
      const ownedSessionIDs = new Set(listOwnedPromptSessionsForTask(taskID).map((owner) => owner.sessionID))
      const sessions = listInterruptedSessionEvidence({
        taskID,
        rootSessionID: taskSnapshot.session_id,
        ownedSessionIDs,
      })
      if (sessions.length === 0) continue
      const incompatibleSessions = sessions.filter((session) => session.runtime_contract_error)
      if (incompatibleSessions.length > 0) {
        const currentBeforeRecovery = findTask(taskID)
        const ownedBeforeRecovery = listOwnedPromptSessionsForTask(taskID)
        if (!currentBeforeRecovery || isTaskTerminal(currentBeforeRecovery) || ownedBeforeRecovery.length > 0) {
          continue
        }
        const destructiveScope = SessionPromptState.beginRootSessionDestructiveScope(
          taskSnapshot.session_id,
          createExecutionCancellationOrigin({
            actor: "runtime",
            source: "task.lifecycle",
            surface: "task-recovery",
            requestID: taskID,
            reason: "Settle an ownerless Task with an incompatible persisted Worker Turn Descriptor",
            taskID,
          }),
        )
        try {
          await SessionPromptState.waitForRootWakeQueueIdle(
            taskSnapshot.session_id,
            INTERRUPTED_TASK_WAKE_SETTLE_TIMEOUT_MS,
          )
          const current = findTask(taskID)
          const ownedAfterReservation = listOwnedPromptSessionsForTask(taskID)
          if (!current || isTaskTerminal(current) || ownedAfterReservation.length > 0) {
            continue
          }
          using _promptStartReservation = SessionPromptState.claimPromptStartReservation(listTaskSessionIDs(taskID))
          const refreshedSessions = listInterruptedSessionEvidence({
            taskID,
            rootSessionID: taskSnapshot.session_id,
            ownedSessionIDs: new Set(),
          })
          if (!isDeepStrictEqual(refreshedSessions, sessions)) continue
          const now = Date.now()
          const reason =
            `Interrupted Task cannot resume ${incompatibleSessions.length} Agent Session(s) because their persisted ` +
            `Worker Turn Descriptor is incompatible with the current runtime contract: ` +
            incompatibleSessions
              .map(
                (session) =>
                  `${session.session_id}/${session.runtime_contract_error!.descriptor_id}: ${
                    session.runtime_contract_error!.message
                  }`,
              )
              .join("; ")
          recordTaskInfrastructureError({
            taskID,
            component: "process-recovery",
            operation: "recover-incompatible-worker-turn-descriptor",
            reason,
            errorName: "PersistedWorkerTurnDescriptorIncompatibleError",
            context: { sessions: incompatibleSessions },
            now,
          })
          for (const interrupted of sessions) {
            if (!interrupted.input_message_id) continue
            const session = await Session.getInProject({
              sessionID: interrupted.session_id,
              projectID: taskSnapshot.project_id,
            })
            await publishSettledSessionTerminalStatusInCurrentProject({
              session,
              taskID,
              inputMessageID: interrupted.input_message_id,
              status: {
                type: "terminal",
                reason: "aborted",
                error: reason,
              },
            })
          }
          await terminalTask(
            findTask(taskID) ?? current,
            {
              status: "failed",
              error: reason,
              time_started: current.time_started ?? Math.min(current.time_created, now - 1),
              time_completed: now,
            },
            "Interrupted Task cannot resume its exact persisted worker runtime contract",
            { terminalReason: "interrupted" },
          )
          discardQueuedTaskEvent(taskID)
          recovered += 1
          continue
        } finally {
          destructiveScope.close()
        }
      }
      const note = `Recover interrupted Agent execution: ${sessions
        .map((session) => `${session.session_id} (${session.agent_id}, ${session.status})`)
        .join("; ")}`
      const now = Date.now()
      const physicalEvidence = interruptedProcessPhysicalEvidence()
      const recoveryContext = ProcessRecoveryFactContext.parse({
        schema_version: 1,
        origin: "abrupt_process_recovery",
        physical_evidence: physicalEvidence,
        affected_subjects: sessions.map((interrupted) => {
          if (interrupted.status === "created") {
            const sessionRow = Database.use((db) =>
              db
                .select({ timeCreated: SessionTable.time_created })
                .from(SessionTable)
                .where(eq(SessionTable.id, interrupted.session_id))
                .get(),
            )
            if (!sessionRow) throw new Error(`Interrupted Session ${interrupted.session_id} is missing`)
            return {
              kind: "affected_created_session" as const,
              session_id: interrupted.session_id,
              session_created_at: sessionRow.timeCreated,
            }
          }
          if (!interrupted.input_message_id) {
            throw new Error(`Interrupted Session ${interrupted.session_id} has no committed input message authority`)
          }
          const descriptor = WorkerTurnDescriptor.latestForSession(interrupted.session_id)
          if (descriptor && descriptor.payload.messageAuthority.user_message_id !== interrupted.input_message_id) {
            throw new Error(
              `Interrupted Session ${interrupted.session_id} input ${interrupted.input_message_id} conflicts with descriptor ${descriptor.id}`,
            )
          }
          const worker = descriptor
            ? (() => {
                if (!descriptor.payload.dispatchTurn) {
                  throw new Error(`Interrupted Worker Turn ${descriptor.id} has no dispatch authority`)
                }
                const lineage = findDispatchLineageByDispatchID({
                  taskID,
                  dispatchID: descriptor.payload.dispatchTurn.current_dispatch_id,
                })
                if (!lineage || lineage.payload.child_session_id !== interrupted.session_id) {
                  throw new Error(`Interrupted Worker Turn ${descriptor.id} has no exact dispatch lineage`)
                }
                return {
                  worker_turn_descriptor: { id: descriptor.id, hash: descriptor.hash },
                  dispatch_lineage_artifact_id: lineage.artifactID,
                }
              })()
            : undefined
          if (interrupted.status === "prepared") {
            if (!worker)
              throw new Error(`Interrupted prepared Session ${interrupted.session_id} has no Worker authority`)
            return {
              kind: "affected_prepared_worker_turn" as const,
              session_id: interrupted.session_id,
              input_message_id: interrupted.input_message_id,
              worker,
            }
          }
          return {
            kind: "affected_execution" as const,
            session_id: interrupted.session_id,
            input_message_id: interrupted.input_message_id,
            lifecycle_event_id: interrupted.status_event_id,
            ...(worker ? { worker } : {}),
          }
        }),
      })
      const ownedBeforeFact = listOwnedPromptSessionsForTask(taskID)
      if (ownedBeforeFact.length > 0) continue
      const promptStartReservation = SessionPromptState.claimPromptStartReservation(listTaskSessionIDs(taskID))
      let recovery: { recoveryFactID: string; wakeAvailable: boolean } | undefined
      try {
        const refreshedSessions = listInterruptedSessionEvidence({
          taskID,
          rootSessionID: taskSnapshot.session_id,
          ownedSessionIDs: new Set(),
        })
        if (!isDeepStrictEqual(refreshedSessions, sessions)) continue
        recovery = Database.transaction((db) => {
          const task = db
            .select()
            .from(EngineTaskTable)
            .where(
              and(
                eq(EngineTaskTable.id, taskID),
                eq(EngineTaskTable.project_id, Instance.project.id),
                sql`${EngineTaskTable.time_started} IS NOT NULL`,
                sql`${EngineTaskTable.time_completed} IS NULL`,
              ),
            )
            .get()
          if (!task) return undefined
          const existingFacts = db
            .select({ id: EngineArtifactTable.id, payload: EngineArtifactTable.payload })
            .from(EngineArtifactTable)
            .where(
              and(
                eq(EngineArtifactTable.task_id, taskID),
                eq(EngineArtifactTable.kind, "task-infrastructure-error"),
                eq(EngineArtifactTable.label, "process-recovery"),
                sql`json_extract(${EngineArtifactTable.payload}, '$.operation') = 'recover-interrupted-task-execution'`,
              ),
            )
            .all()
          const existingFact = existingFacts.find((fact) => {
            const payload = artifactPayloadRecord(fact.payload)
            const parsed = ProcessRecoveryFactContext.safeParse(payload.context)
            return parsed.success && isDeepStrictEqual(parsed.data, recoveryContext)
          })
          // The fact and its first delivery wake are written in one transaction.
          // Once that wake is drained, the interruption has been delivered to
          // the Orchestrator and must not become a host-side retry loop on every
          // later process restart. A genuinely new interruption has a different
          // latest lifecycle event identity and therefore creates a new fact.
          if (existingFact) {
            const exactWake = db
              .select({ id: EngineArtifactTable.id })
              .from(EngineArtifactTable)
              .where(
                and(
                  eq(EngineArtifactTable.task_id, taskID),
                  eq(EngineArtifactTable.kind, "queued_operator_wake"),
                  eq(EngineArtifactTable.label, "pending"),
                  sql`json_extract(${EngineArtifactTable.payload}, '$.recovery_fact_id') = ${existingFact.id}`,
                ),
              )
              .get()
            if (!exactWake) {
              persistQueuedRecoveryWakeInTransaction(db, { task, recoveryFactID: existingFact.id, note, now })
            }
            return { recoveryFactID: existingFact.id, wakeAvailable: true }
          }
          const reason =
            `The previous backend process ended while ${sessions.length} Agent Session(s) still had durable ` +
            `interruption evidence and no current-process prompt owner: ` +
            sessions.map((session) => `${session.session_id}=${session.status}`).join(", ")
          const recoveryFactID = recordTaskInfrastructureErrorInTransaction(db, {
            taskID,
            component: "process-recovery",
            operation: "recover-interrupted-task-execution",
            reason,
            errorName: "InterruptedTaskExecutionError",
            context: {
              ...recoveryContext,
            },
            now,
          })
          persistQueuedRecoveryWakeInTransaction(db, {
            task,
            recoveryFactID,
            note,
            now,
          })
          return { recoveryFactID, wakeAvailable: true }
        })
        if (!recovery) continue
        for (const interrupted of sessions) {
          if (!interrupted.input_message_id) continue
          const session = await Session.getInProject({
            sessionID: interrupted.session_id,
            projectID: taskSnapshot.project_id,
          })
          await publishSettledSessionTerminalStatusInCurrentProject({
            session,
            taskID,
            inputMessageID: interrupted.input_message_id,
            status: {
              type: "terminal",
              reason: "aborted",
              error: "Previous backend process ended while this Session had no current prompt owner",
            },
          })
        }
      } finally {
        promptStartReservation[Symbol.dispose]()
      }
      if (recovery.wakeAvailable && (await drainQueuedTaskEvent(taskID))) recovered += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failures.push(`${taskID}: ${message}`)
      log.error("interrupted Task execution recovery failed", {
        taskID,
        error: message,
        errorName: error instanceof Error ? error.name : undefined,
      })
    }
  }

  if (failures.length > 0) {
    throw new Error(`Failed to recover ${failures.length} interrupted Task execution(s): ${failures.join("; ")}`)
  }
  return recovered
}

/**
 * Resolve the working directory for a task.
 *
 * Source of truth: task.session_id → session.directory. Missing task/session
 * identity is a typed queue error; no project-level directory is consulted.
 */
export function taskCwd(taskID: string): string {
  const task = findTask(taskID)
  if (!task) throw new TaskQueueError(`Task ${taskID} does not exist`, "task_not_found", taskID)
  return taskRootDirectory(task)
}

/**
 * Atomically claim the next queued task for the given cwd.
 *
 * Semantics:
 *   - If another task is already `active` in this cwd → return undefined.
 *   - Otherwise → pick the highest-priority queued task (FIFO within priority),
 *     flip its status `queued → active`, and return the updated row.
 *
 * Atomicity is provided by SQLite's statement-level write serialization:
 * the subquery + UPDATE run as a single statement, so two concurrent calls
 * cannot both observe the same "no active task" state.
 *
 * Returns undefined when nothing was claimed (active task present, or no
 * queued tasks).
 */
export function claimNextForCwd(cwd: string, now = Date.now()): TaskRow | undefined {
  if (!cwd) return undefined
  // Phase-6-f-2: no status column. Queued = time_started IS NULL (never
  // picked up). Active = time_started IS NOT NULL AND time_completed IS NULL.
  // Terminal = time_completed IS NOT NULL.
  let result: TaskRow | undefined
  let launchID: string | undefined
  Database.transaction((db) => {
    result = claimNextEngineTaskForCwd(db, { cwd, timeStarted: now })
    if (!result) return
    launchID = recordTaskLoopLaunch(db, { task: result, cwd, now })
    insertEngineProgressSnapshot(db, {
      taskID: result.id,
      status: "active",
      summary: "Task started",
      payload: { status: "active" },
      timeCreated: now,
    })
    Database.effect(() =>
      EngineProtocol.emit(
        Event.TaskUpdated,
        { taskID: result!.id, status: "active", summary: "Task started" },
        { source: "engine.queue" },
      ),
    )
  })
  if (result && launchID) taskLoopLaunchAuthorities.set(result.id, launchID)
  return result ?? undefined
}

export function claimQueuedTaskForCwd(taskID: string, cwd: string, now = Date.now()): TaskRow | undefined {
  if (!taskID || !cwd) return undefined
  let result: TaskRow | undefined
  let launchID: string | undefined
  Database.transaction((db) => {
    result = claimQueuedEngineTaskForCwd(db, { taskID, cwd, timeStarted: now })
    if (!result) return
    launchID = recordTaskLoopLaunch(db, { task: result, cwd, now })
    insertEngineProgressSnapshot(db, {
      taskID: result.id,
      status: "active",
      summary: "Task started",
      payload: { status: "active" },
      timeCreated: now,
    })
    Database.effect(() =>
      EngineProtocol.emit(
        Event.TaskUpdated,
        { taskID: result!.id, status: "active", summary: "Task started" },
        { source: "engine.queue" },
      ),
    )
  })
  if (result && launchID) taskLoopLaunchAuthorities.set(result.id, launchID)
  return result ?? undefined
}

export async function startQueuedTaskInCwd(taskID: string, cwd: string): Promise<TaskRow | undefined> {
  const task = findTask(taskID)
  if (!task) throw new TaskQueueError(`Task ${taskID} does not exist`, "task_not_found", taskID)
  const taskDirectory = taskRootDirectory(task)
  if (taskDirectory !== cwd) {
    throw new TaskQueueError(
      `Task ${taskID} directory ${taskDirectory} does not match requested queue directory ${cwd}`,
      "directory_mismatch",
      taskID,
    )
  }
  const runTaskLoop = requireTaskLoopRunner()
  const { assertTaskExecutionCapsuleRuntime } = await import("@/engine/task-execution-capsule-binding")
  await assertTaskExecutionCapsuleRuntime(task.id)
  const completionAuthority = RuntimeExecutionSettlement.reserve(
    "engine_queue_completion",
    `task-loop-launch:${task.id}`,
  )
  const claimed = claimQueuedTaskForCwd(taskID, cwd)
  if (!claimed) {
    completionAuthority.settle()
    return undefined
  }
  await startLoopForTask(claimed, undefined, cwd, runTaskLoop, completionAuthority)
  return claimed
}

/**
 * List active tasks for a cwd.
 */
export function listActiveForCwd(cwd: string): TaskRow[] {
  if (!cwd) return []
  return Database.use((db) =>
    db
      .select({ task: EngineTaskTable })
      .from(EngineTaskTable)
      .innerJoin(SessionTable, eq(SessionTable.id, EngineTaskTable.session_id))
      .where(
        and(
          sql`${EngineTaskTable.time_started} IS NOT NULL`,
          sql`${EngineTaskTable.time_completed} IS NULL`,
          eq(SessionTable.directory, cwd),
        ),
      )
      .orderBy(desc(EngineTaskTable.time_updated))
      .all(),
  ).map((r) => r.task)
}

/**
 * List distinct cwds that have any queued tasks for the given project.
 */
export function listQueuedCwdsInProject(projectID: string): string[] {
  const rows = Database.use((db) =>
    db
      .select({
        cwd: SessionTable.directory,
      })
      .from(EngineTaskTable)
      .innerJoin(SessionTable, eq(SessionTable.id, EngineTaskTable.session_id))
      .where(
        and(
          eq(EngineTaskTable.project_id, projectID),
          sql`${EngineTaskTable.time_started} IS NULL`,
          sql`${EngineTaskTable.time_completed} IS NULL`,
        ),
      )
      .all(),
  )
  return [...new Set(rows.map((r) => r.cwd).filter((x): x is string => !!x))]
}

/**
 * Advance the queue for a cwd: if the cwd is idle, claim the next queued
 * task and start its loop. Called from every dispatch site (createTask,
 * retryTask, operator message, loop exit).
 *
 * Idempotent: calling advanceQueue multiple times for the same cwd is safe.
 * The atomic claim ensures only one call will actually start a loop.
 */
export async function advanceQueue(
  cwd: string,
  options?: {
    beforeStart?: (input: { task: TaskRow; event?: OrchestratorEvent }) => void | Promise<void>
  },
): Promise<TaskRow | undefined> {
  if (!cwd) return undefined
  const candidate = nextQueuedTaskForCwd(cwd)
  if (!candidate) return undefined
  if (candidate.session_id && SessionPromptState.isRootSessionProcessShutdownHandoffActive(candidate.session_id)) {
    return undefined
  }
  taskRootDirectory(candidate)
  const runTaskLoop = requireTaskLoopRunner()
  const { assertTaskExecutionCapsuleRuntime } = await import("@/engine/task-execution-capsule-binding")
  await assertTaskExecutionCapsuleRuntime(candidate.id)
  const completionAuthority = RuntimeExecutionSettlement.reserve(
    "engine_queue_completion",
    `task-loop-launch:${candidate.id}`,
  )
  const claimed = claimQueuedTaskForCwd(candidate.id, cwd)
  if (!claimed) {
    completionAuthority.settle()
    return undefined
  }
  const queuedWake = findNextPendingQueuedOperatorWake(claimed.id)
  const event = queuedWake?.event
  try {
    await options?.beforeStart?.({ task: claimed, event })
  } catch (error) {
    completionAuthority.settle()
    throw await returnClaimedTaskToQueue(claimed, error)
  }
  await startLoopForTask(claimed, event, cwd, runTaskLoop, completionAuthority)
  return claimed
}

export type DispatchTaskLoopResult = "started" | "queued" | "ignored"
export type DispatchTaskLoopAcceptedWake = {
  taskID: string
  result: Exclude<DispatchTaskLoopResult, "ignored">
}

export type DispatchTaskLoopInput = {
  taskID: string
  event?: OrchestratorEvent
  beforeAcceptedWake?: (wake: DispatchTaskLoopAcceptedWake) => void | Promise<void>
}

export function dispatchTaskLoopInBackground(input: DispatchTaskLoopInput, operation: string): void {
  void dispatchTaskLoop(input).catch((err) => {
    const error = Database.normalizeError(err, operation)
    log.error("background task wake failed", {
      taskID: input.taskID,
      operation,
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : undefined,
    })
  })
}

export async function dispatchTaskLoop(input: DispatchTaskLoopInput): Promise<DispatchTaskLoopResult> {
  const task = findTask(input.taskID)
  if (!task) throw new TaskQueueError(`Task ${input.taskID} does not exist`, "task_not_found", input.taskID)
  const persistedWakeID = enqueueTaskEvent(task, OrchestratorEventSchema.parse(input.event ?? { note: "Task wake" }))
  if (findQueuedOperatorWakeByID(task.id, persistedWakeID)?.label === "terminal_inapplicable") {
    return "ignored"
  }
  if (isTaskTerminal(task) && findQueuedOperatorWakeByID(task.id, persistedWakeID)?.label === "delivery_failed") {
    return "ignored"
  }
  const { assertTaskExecutionCapsuleRuntime } = await import("@/engine/task-execution-capsule-binding")
  try {
    await assertTaskExecutionCapsuleRuntime(task.id)
  } catch (error) {
    const wake = findQueuedOperatorWakeByID(task.id, persistedWakeID)
    if (wake?.label === "pending") {
      markQueuedOperatorWakeDeliveryFailed({
        artifactID: wake.id,
        ingress: wake.ingress,
        errorName: error instanceof Error ? error.name : "TaskExecutionCapsuleRuntimeError",
        message: error instanceof Error ? error.message : String(error),
      })
    }
    throw error
  }
  if (isTaskTerminal(task)) {
    const cwd = taskRootDirectory(task)
    const authority = RuntimeExecutionSettlement.reserve(
      "engine_queue_completion",
      `terminal-wake-acceptance:${task.id}:${persistedWakeID}`,
    )
    const acceptance = (async (): Promise<DispatchTaskLoopResult> => {
      await input.beforeAcceptedWake?.({ taskID: task.id, result: "started" })
      if (!(await drainQueuedTaskEvent(task.id))) {
        log.info("terminal Task ingress is queued behind the current root prompt owner", {
          taskID: task.id,
          status: deriveTaskStatus(task),
          directory: cwd,
        })
      }
      return "started"
    })()
    authority.settleWith(acceptance)
    return acceptance
  }
  const cwd = taskRootDirectory(task)
  if (task.session_id && SessionPromptState.isRootSessionProcessShutdownHandoffActive(task.session_id)) {
    await consumePendingWaitCronForAcceptedWake(task, "task wake accepted for post-destructive-scope delivery")
    await input.beforeAcceptedWake?.({ taskID: task.id, result: "queued" })
    return "queued"
  }
  if (isTaskQueued(task)) {
    const claimed = await advanceQueue(cwd, {
      beforeStart: async ({ task: claimedTask }) => {
        if (claimedTask.id === task.id) {
          await consumePendingWaitCronForAcceptedWake(task, "task wake accepted as started")
          await input.beforeAcceptedWake?.({ taskID: task.id, result: "started" })
        }
      },
    })
    if (claimed?.id === task.id) return "started"
    await consumePendingWaitCronForAcceptedWake(task, "task wake accepted as queued")
    await input.beforeAcceptedWake?.({ taskID: task.id, result: "queued" })
    return "queued"
  }

  // Task is already active. Every re-entry is admitted through the same
  // durable head selector; a newly persisted wake never bypasses an older
  // running or delivery-failed occurrence.
  await consumePendingWaitCronForAcceptedWake(task, "task wake accepted as active re-entry")
  const attachedHead = await drainQueuedTaskEvent(task.id)
  const existing = findQueuedOperatorWakeByID(task.id, persistedWakeID)
  if (!existing) throw new Error(`Task ${task.id} persisted wake disappeared before root Session enqueue`)
  let result: Exclude<DispatchTaskLoopResult, "ignored">
  if (existing.label === "running") {
    const position = SessionPromptState.rootWakeQueuePosition(existing.ingress.root_session_id, existing.id)
    result = position === undefined || position === 0 ? "started" : "queued"
  } else if (existing.label === "pending") {
    const position = SessionPromptState.rootWakeQueuePosition(existing.ingress.root_session_id, existing.id)
    result = attachedHead && position === 0 ? "started" : "queued"
  } else if (["drained", "terminal_inapplicable"].includes(existing.label)) {
    result = "started"
  } else if (existing.label === "delivery_failed") {
    return "ignored"
  } else {
    throw new Error(`Task ${task.id} persisted wake ${persistedWakeID} has unsupported state ${existing.label}`)
  }
  await input.beforeAcceptedWake?.({ taskID: task.id, result })
  return result
}

export async function dispatchPersistedTaskLoop(
  taskID: string,
  expectedWakeID?: string,
): Promise<DispatchTaskLoopResult> {
  const task = findTask(taskID)
  if (!task) throw new TaskQueueError(`Task ${taskID} does not exist`, "task_not_found", taskID)
  const { assertTaskExecutionCapsuleRuntime } = await import("@/engine/task-execution-capsule-binding")
  await assertTaskExecutionCapsuleRuntime(task.id)
  const cwd = taskRootDirectory(task)
  const reconciliation = await reconcileOwnerlessRunningTaskIngressHead(taskID)
  const head = findQueuedOperatorWakeHead(taskID)
  if (!head) {
    const expected = expectedWakeID ? findQueuedOperatorWakeByID(taskID, expectedWakeID) : undefined
    if (expected && ["drained", "terminal_inapplicable"].includes(expected.label)) return "started"
    if (expected?.label === "delivery_failed") return "ignored"
    if (reconciliation === "drained" || reconciliation === "terminal_inapplicable") return "started"
    throw new Error(`Task ${taskID} has no persisted wake to dispatch`)
  }
  if (expectedWakeID && head.id !== expectedWakeID) {
    const expected = findQueuedOperatorWakeByID(taskID, expectedWakeID)
    if (expected && ["running", "drained", "terminal_inapplicable"].includes(expected.label)) {
      if (head.label === "pending") await drainQueuedTaskEvent(taskID)
      return "started"
    }
    if (expected?.label === "pending") {
      if (head.label === "pending") await drainQueuedTaskEvent(taskID)
      return "queued"
    }
    if (expected?.label === "delivery_failed") return "ignored"
    throw new Error(`Task ${taskID} durable wake head is ${head.id}, not expected ${expectedWakeID}`)
  }
  if (head.label === "running") {
    const position = SessionPromptState.rootWakeQueuePosition(head.rootSessionID, head.id)
    return position === undefined || position === 0 ? "started" : "queued"
  }
  if (head.label !== "pending") {
    if (expectedWakeID === head.id && head.label === "delivery_failed") return "ignored"
    if (!expectedWakeID && head.label === "delivery_failed") return "queued"
    throw new Error(`Task ${taskID} durable wake head ${head.id} cannot dispatch from ${head.label}`)
  }
  const wake = head
  if (isTaskQueued(task)) {
    const claimed = await advanceQueue(cwd)
    return claimed?.id === taskID ? "started" : "queued"
  }
  if (isTaskActive(task)) {
    if (!(await drainQueuedTaskEvent(taskID))) {
      throw new Error(`Task ${taskID} persisted wake could not be attached to its active root Session`)
    }
    const position = SessionPromptState.rootWakeQueuePosition(wake.rootSessionID, wake.id)
    return position === undefined || position === 0 ? "started" : "queued"
  }
  if (!(await drainQueuedTaskEvent(taskID))) {
    throw new Error(`Task ${taskID} persisted wake could not be attached to its terminal conversation`)
  }
  return "started"
}

export type TerminalAgentLifecycleDeliveryReconciliation =
  | "missing_lineage"
  | "missing_descriptor"
  | "nonterminal"
  | "delivery_exhausted"
  | "already_delivered"
  | "delivered"

/**
 * Reconcile one exact dispatch lineage into its lifecycle-event-keyed root wake.
 * This is the sole writer for normal detached completion and startup recovery;
 * callers decide whether a not-yet-terminal result is expected in their phase.
 */
export async function reconcileTerminalAgentLifecycleDelivery(input: {
  taskID: string
  sessionID: string
  dispatchID: string
}): Promise<TerminalAgentLifecycleDeliveryReconciliation> {
  const lineage = listDispatchLineage(input.taskID).find(
    (candidate) => candidate.dispatchID === input.dispatchID && candidate.payload.child_session_id === input.sessionID,
  )
  if (!lineage) return "missing_lineage"
  const descriptor = WorkerTurnDescriptor.findForDispatch({
    sessionID: input.sessionID,
    dispatchID: input.dispatchID,
  })
  if (!descriptor) return "missing_descriptor"
  const lifecycle = ProtocolStore.latestSessionOccurrenceEvent(
    input.sessionID,
    "agent.execution.lifecycle",
    descriptor.payload.messageAuthority.user_message_id,
  )
  const status = lifecycle?.payload?.status
  if (!lifecycle || !status || typeof status !== "object" || (status as Record<string, unknown>).type !== "terminal") {
    return "nonterminal"
  }
  if (!findDispatchSettlementByDispatchID({ taskID: input.taskID, dispatchID: input.dispatchID })) {
    const finalMessage = Database.use((db) =>
      db
        .select({ id: MessageTable.id })
        .from(MessageTable)
        .where(
          and(
            eq(MessageTable.session_id, input.sessionID),
            sql`json_extract(${MessageTable.data}, '$.role') = 'assistant'`,
            sql`json_extract(${MessageTable.data}, '$.parentID') = ${descriptor.payload.messageAuthority.user_message_id}`,
            sql`json_extract(${MessageTable.data}, '$.time.completed') IS NOT NULL`,
          ),
        )
        .orderBy(desc(MessageTable.time_created), desc(MessageTable.id))
        .get(),
    )
    if (!finalMessage) return "nonterminal"
    recordDispatchSettlement({
      taskID: input.taskID,
      dispatchID: input.dispatchID,
      outcome: DispatchOutcome.partial({
        sessionID: input.sessionID,
        finalMessageID: finalMessage.id,
        failedOperation: "recover_dispatch_domain_settlement",
      }),
    })
  }
  const delivered = Database.use((db) =>
    db
      .select({ id: EngineArtifactTable.id, label: EngineArtifactTable.label })
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.kind, "queued_operator_wake"),
          sql`json_extract(${EngineArtifactTable.payload}, '$.lifecycle_event_id') = ${lifecycle.id}`,
        ),
      )
      .get(),
  )
  if (delivered) {
    if (delivered.label !== "delivery_failed") {
      await settleDetachedDispatchRecovery(lineage.artifactID)
      return "already_delivered"
    }
    const ingress = Database.use((db) =>
      db
        .select({ payload: EngineArtifactTable.payload })
        .from(EngineArtifactTable)
        .where(eq(EngineArtifactTable.id, delivered.id))
        .get(),
    )
    if (ingress && !canRetryTerminalIngressInCurrentRuntime(QueuedTaskIngressSchema.parse(ingress.payload))) {
      scheduleDelayedExactTerminalIngressRetry({
        taskID: input.taskID,
        wakeID: delivered.id,
        ingress: QueuedTaskIngressSchema.parse(ingress.payload),
      })
      return "delivery_exhausted"
    }
  }
  const dispatchResult = await dispatchTaskLoop({
    taskID: input.taskID,
    event: {
      note: `Worker Session ${input.sessionID} completed dispatch ${input.dispatchID}.`,
      agentLifecycleDelivery: {
        eventID: lifecycle.id,
        sessionID: input.sessionID,
        dispatchID: input.dispatchID,
      },
    },
  })
  if (dispatchResult === "ignored") return "delivery_exhausted"
  await settleDetachedDispatchRecovery(lineage.artifactID)
  return "delivered"
}

export async function reconcileTerminalAgentLifecycleDeliveries(): Promise<number> {
  const tasks = Database.use((db) =>
    db
      .select({ id: EngineTaskTable.id })
      .from(EngineTaskTable)
      .where(and(eq(EngineTaskTable.project_id, Instance.project.id), sql`${EngineTaskTable.time_started} IS NOT NULL`))
      .all(),
  )
  let reconciled = 0
  const failures: Error[] = []
  for (const task of tasks) {
    let lineages: ReturnType<typeof listDispatchLineage>
    try {
      lineages = listDispatchLineage(task.id)
    } catch (error) {
      failures.push(
        new Error(`Task ${task.id} dispatch lineage: ${error instanceof Error ? error.message : String(error)}`, {
          cause: error,
        }),
      )
      continue
    }
    for (const lineage of lineages) {
      try {
        const result = await reconcileTerminalAgentLifecycleDelivery({
          taskID: task.id,
          sessionID: lineage.payload.child_session_id,
          dispatchID: lineage.dispatchID,
        })
        if (result === "delivered") reconciled += 1
      } catch (error) {
        failures.push(
          new Error(
            `Task ${task.id} dispatch ${lineage.dispatchID}: ${error instanceof Error ? error.message : String(error)}`,
            { cause: error },
          ),
        )
      }
    }
  }
  if (failures.length > 0) {
    throw new AggregateError(failures, `Failed to reconcile ${failures.length} terminal Agent delivery item(s)`)
  }
  return reconciled
}

export async function reconcileFailedExactTerminalIngressDeliveries(): Promise<number> {
  const rows = Database.use((db) =>
    db
      .select({ id: EngineArtifactTable.id, taskID: EngineArtifactTable.task_id })
      .from(EngineArtifactTable)
      .innerJoin(EngineTaskTable, eq(EngineTaskTable.id, EngineArtifactTable.task_id))
      .where(
        and(
          eq(EngineArtifactTable.kind, "queued_operator_wake"),
          eq(EngineArtifactTable.label, "delivery_failed"),
          eq(EngineTaskTable.project_id, Instance.project.id),
        ),
      )
      .orderBy(EngineArtifactTable.time_created, EngineArtifactTable.id)
      .all(),
  )
  let reconciled = 0
  const failures: Error[] = []
  for (const row of rows) {
    try {
      if (reconcileHistoricalNonTailFailedIngress(row.taskID, row.id)) {
        reconciled += 1
        continue
      }
      if (await retryFailedExactTerminalIngress(row.taskID, row.id)) reconciled += 1
    } catch (error) {
      failures.push(
        new Error(
          `Task ${row.taskID} exact ingress ${row.id}: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error },
        ),
      )
    }
  }
  if (failures.length > 0) {
    throw new AggregateError(failures, `Failed to reconcile ${failures.length} exact terminal ingress item(s)`)
  }
  return reconciled
}

export async function reconcileUndeliveredDispatchInfrastructureFacts(): Promise<number> {
  const facts = Database.use((db) =>
    db
      .select({ id: EngineArtifactTable.id, taskID: EngineArtifactTable.task_id, payload: EngineArtifactTable.payload })
      .from(EngineArtifactTable)
      .innerJoin(EngineTaskTable, eq(EngineTaskTable.id, EngineArtifactTable.task_id))
      .where(
        and(
          eq(EngineArtifactTable.kind, "task-infrastructure-error"),
          eq(EngineTaskTable.project_id, Instance.project.id),
        ),
      )
      .orderBy(EngineArtifactTable.time_created, EngineArtifactTable.id)
      .all(),
  )
  let reconciled = 0
  const failures: Error[] = []
  for (const fact of facts) {
    try {
      const payload = artifactPayloadRecord(fact.payload)
      const context = artifactPayloadRecord(payload.context)
      const component = typeof payload.component === "string" ? payload.component : undefined
      const operation = typeof payload.operation === "string" ? payload.operation : undefined
      const dispatchID =
        typeof context.current_dispatch_id === "string"
          ? context.current_dispatch_id
          : typeof context.dispatchID === "string"
            ? context.dispatchID
            : undefined
      if (!operation || !dispatchID) continue
      if (component !== "worker-runtime" && component !== "dispatch-agent") continue
      const existingWake = Database.use((db) =>
        db
          .select({ id: EngineArtifactTable.id })
          .from(EngineArtifactTable)
          .where(
            and(
              eq(EngineArtifactTable.task_id, fact.taskID),
              eq(EngineArtifactTable.kind, "queued_operator_wake"),
              sql`json_extract(${EngineArtifactTable.payload}, '$.infrastructure_fact_id') = ${fact.id}`,
            ),
          )
          .get(),
      )
      if (existingWake) continue
      const authority = resolveDispatchOccurrenceAuthority({ taskID: fact.taskID, dispatchID })
      if (authority.occurrence_status !== "occurrence_committed") continue
      const outcome = DispatchOutcome.infrastructureFailure({
        operation,
        message: typeof payload.reason === "string" ? payload.reason : `${component} infrastructure failure`,
        errorName: typeof payload.errorName === "string" ? payload.errorName : undefined,
        sessionID: typeof payload.sessionID === "string" ? payload.sessionID : undefined,
        recoveryAuthority: authority,
        infrastructureError: exactEngineArtifactLocator({ taskID: fact.taskID, artifactID: fact.id }),
        ...(typeof context.worker_turn_descriptor_id === "string" &&
        typeof context.worker_turn_descriptor_hash === "string" &&
        typeof context.input_message_id === "string"
          ? {
              workerTurn: {
                descriptorID: context.worker_turn_descriptor_id,
                descriptorHash: context.worker_turn_descriptor_hash,
                inputMessageID: context.input_message_id,
                currentDispatchID: dispatchID,
              },
            }
          : {}),
      })
      if (outcome.kind !== "infrastructure_failure") {
        throw new Error(`Infrastructure recovery constructor returned ${outcome.kind}`)
      }
      const result = await dispatchTaskLoop({
        taskID: fact.taskID,
        event: {
          note: `Recovered accepted dispatch ${dispatchID} infrastructure failure ${fact.id}`,
          dispatchInfrastructureFailure: { infrastructureFactID: fact.id, outcome },
        },
      })
      if (result === "started" || result === "queued") {
        await settleDetachedDispatchRecovery(authority.dispatch_lineage_id)
        reconciled += 1
      }
    } catch (error) {
      failures.push(
        new Error(
          `Task ${fact.taskID} infrastructure fact ${fact.id}: ${error instanceof Error ? error.message : String(error)}`,
          {
            cause: error,
          },
        ),
      )
    }
  }
  if (failures.length > 0) {
    throw new AggregateError(failures, `Failed to reconcile ${failures.length} dispatch infrastructure fact(s)`)
  }
  return reconciled
}

async function consumePendingWaitCronForAcceptedWake(task: TaskRow, reason: string): Promise<void> {
  await requireTaskWakeRuntime().consumePendingTaskWaits({
    taskId: task.id,
    projectId: task.project_id,
    reason,
  })
}

/**
 * Internal: actually start the loop for a claimed or operator-dispatched task.
 * Serial dispatch is guaranteed by the DB claim SQL, not by blocking the
 * caller; advance-on-exit is wired via `attachLoopCompletion`.
 *
 * Dynamic import of task-loop avoids a circular dependency
 * (task-loop → queue → task-loop).
 */
async function startLoopForTask(
  task: TaskRow,
  event: OrchestratorEvent | undefined,
  cwd: string,
  runTaskLoop: TaskLoopRunner,
  reservedAuthority?: RuntimeExecutionReservation,
): Promise<boolean> {
  const completionAuthority =
    reservedAuthority ?? RuntimeExecutionSettlement.reserve("engine_queue_completion", `task-loop-launch:${task.id}`)
  let wake: NonNullable<ReturnType<typeof findNextPendingQueuedOperatorWake>>
  try {
    const taskDirectory = taskRootDirectory(task)
    if (taskDirectory !== cwd) {
      throw new TaskQueueError(
        `Task ${task.id} directory ${taskDirectory} does not match loop directory ${cwd}`,
        "directory_mismatch",
        task.id,
      )
    }
    let pendingWake = findNextPendingQueuedOperatorWake(task.id)
    if (!pendingWake) {
      const blockedHead = findQueuedOperatorWakeHead(task.id)
      if (blockedHead) {
        throw new Error(
          `Task ${task.id} cannot create a root Session wake while durable head ${blockedHead.id} is ${blockedHead.label}`,
        )
      }
      enqueueTaskEvent(task, event ?? { note: "Queued Task start" })
      pendingWake = findNextPendingQueuedOperatorWake(task.id)
    }
    if (!pendingWake) throw new Error(`Task ${task.id} has no persisted root Session wake`)
    wake = pendingWake
    bindTaskLoopLaunchWake(task.id, wake.id)
  } catch (error) {
    completionAuthority.settle()
    throw await returnClaimedTaskToQueue(task, error)
  }
  try {
    attachLoopCompletion(task.id, wake.id, cwd, () => launchTaskLoop(task, wake, cwd, runTaskLoop), completionAuthority)
  } catch (error) {
    completionAuthority.settle()
    throw await returnClaimedTaskToQueue(task, error)
  }
  acceptTaskLoopLaunch(task.id)
  return true
}
