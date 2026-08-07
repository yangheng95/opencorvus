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
import { isDeepStrictEqual } from "node:util"
import { ProtocolStore } from "@/protocol/store"
import { Database, and, desc, eq, sql } from "@/storage/db"
import { Log } from "@/util/log"
import { EngineArtifactTable, EngineTaskTable } from "./engine.sql"
import { insertEngineArtifact, updateEngineArtifact, updateEngineArtifactsWhere } from "./artifact"
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
import { runWithIndependentProjectIdentity } from "@/project/independent-project-owner"
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
import { terminalTask } from "./state"
import { deliverTerminalTaskIngress } from "./terminal-task-conversation-runner"
import { TaskRootMessageProvenance } from "@/task-api/task-root-message"
import { listTaskSessionIDs } from "./task-session-lineage"
import {
  ProcessRecoveryFactContext,
  resolveProcessRecoveryInputAuthority,
  type ProcessRecoveryFactContext as ProcessRecoveryFactContextValue,
} from "./process-recovery-fact"
import { currentProcessPhysicalEvidence, interruptedProcessPhysicalEvidence } from "@/runtime/process-occurrence"
import { findDispatchLineageByDispatchID } from "./dispatch-lineage"

export { TaskQueueError } from "./task-directory"

const log = Log.create({ service: "engine.queue" })
const INTERRUPTED_TASK_WAKE_SETTLE_TIMEOUT_MS = 60_000
const loopCompletionHooksForTest = new Set<Promise<void>>()

function artifactPayloadRecord(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {}
}

type TaskLoopRunner = (input: {
  taskID: string
  event?: OrchestratorEvent
  signal?: AbortSignal
  wakeID?: string
}) => Promise<void>

const taskLoopRuntime = createInstanceState(
  () => ({ runner: undefined as TaskLoopRunner | undefined }),
  undefined,
  "engine-queue-task-loop-runner",
)

export function configureTaskLoopRunner(runner: TaskLoopRunner): void {
  const runtime = taskLoopRuntime()
  if (runtime.runner && runtime.runner !== runner) {
    throw new Error("Engine queue task-loop runner is already configured for this instance")
  }
  runtime.runner = runner
}

function requireTaskLoopRunner(): TaskLoopRunner {
  const runner = taskLoopRuntime().runner
  if (!runner) throw new Error("Engine queue task-loop runner is not configured for this instance")
  return runner
}

export function discardQueuedTaskEvent(taskID: string): void {
  discardPendingQueuedOperatorWakes(taskID)
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
      .orderBy(EngineArtifactTable.time_created, EngineArtifactTable.id)
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
  return persistQueuedOperatorWake(task, event, { messageID, requestID, recoveryFactID })
}

function persistQueuedOperatorWakeInTransaction(
  db: Database.TxOrDb,
  task: TaskRow,
  event: OrchestratorEvent,
  identity: { messageID?: string; requestID?: string; recoveryFactID?: string },
  now = Date.now(),
): string {
  if (!task.session_id) throw new TaskQueueError(`Task ${task.id} has no root session`, "session_not_bound", task.id)
  const messageID = identity.messageID
  const requestID = identity.requestID
  const recoveryFactID = identity.recoveryFactID
  if (messageID || requestID || recoveryFactID) {
    const exists = db
      .select({ id: EngineArtifactTable.id })
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, task.id),
          eq(EngineArtifactTable.kind, "queued_operator_wake"),
          ...(requestID ? [eq(EngineArtifactTable.label, "pending")] : []),
          messageID
            ? sql`json_extract(${EngineArtifactTable.payload}, '$.message_id') = ${messageID}`
            : requestID
              ? sql`json_extract(${EngineArtifactTable.payload}, '$.request_id') = ${requestID}`
              : sql`json_extract(${EngineArtifactTable.payload}, '$.recovery_fact_id') = ${recoveryFactID}`,
        ),
      )
      .get()
    if (exists) return exists.id
  }
  const priorAttempts = requestID
    ? (db
        .select({ count: sql<number>`count(*)` })
        .from(EngineArtifactTable)
        .where(
          and(
            eq(EngineArtifactTable.task_id, task.id),
            eq(EngineArtifactTable.kind, "queued_operator_wake"),
            sql`json_extract(${EngineArtifactTable.payload}, '$.request_id') = ${requestID}`,
          ),
        )
        .get()?.count ?? 0)
    : 0
  const instance = Instance.current()
  const sourceKind = queuedTaskIngressSourceKind(event)
  const payload = QueuedTaskIngressSchema.parse({
    wake_id:
      messageID ??
      (requestID
        ? `${requestID}:${priorAttempts + 1}`
        : recoveryFactID
          ? recoveryFactID
          : Identifier.ascending("artifact")),
    delivery_attempt: priorAttempts + 1,
    task_id: task.id,
    root_session_id: task.session_id,
    ...(messageID ? { message_id: messageID } : {}),
    ...(requestID ? { request_id: requestID } : {}),
    ...(recoveryFactID ? { recovery_fact_id: recoveryFactID } : {}),
    source_kind: sourceKind,
    event: OrchestratorEventSchema.parse(event),
    time_queued: now,
    queued_by_process_id: process.pid,
    ...(instance
      ? { queued_by_instance_directory: instance.directory, queued_by_project_id: instance.project.id }
      : {}),
  })
  return insertEngineArtifact(db, {
    taskID: task.id,
    kind: "queued_operator_wake",
    label: "pending",
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
  identity: { messageID?: string; requestID?: string; recoveryFactID?: string },
): string {
  return Database.use((db) => persistQueuedOperatorWakeInTransaction(db, task, event, identity))
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
          db.select({ timeCreated: SessionTable.time_created }).from(SessionTable).where(eq(SessionTable.id, sessionID)).get(),
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
  Database.use((db) =>
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
  Database.use((db) =>
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
  const row = Database.use((db) =>
    db
      .select({
        id: EngineArtifactTable.id,
        payload: EngineArtifactTable.payload,
        timeCreated: EngineArtifactTable.time_created,
      })
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, taskID),
          eq(EngineArtifactTable.kind, "queued_operator_wake"),
          eq(EngineArtifactTable.label, "pending"),
        ),
      )
      .orderBy(EngineArtifactTable.time_created, EngineArtifactTable.id)
      .get(),
  )
  if (!row) return undefined
  const payload = QueuedTaskIngressSchema.parse(row.payload)
  return {
    id: row.id,
    timeCreated: row.timeCreated,
    wakeID: payload.wake_id,
    rootSessionID: payload.root_session_id,
    ingress: payload,
    event: payload.event,
  }
}

function markQueuedOperatorWakeDrained(artifactID: string): void {
  updateEngineArtifact({ id: artifactID, label: "drained" })
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
      await runWithIndependentProjectIdentity({
        directory,
        fn: async () => {
          if (signal.aborted) {
            if (!isExecutionCancellationError(signal.reason)) {
              throw new Error(`Root Session wake ${wake.id} has an untyped pre-execution cancellation reason`)
            }
            throw signal.reason
          }
          await runTaskLoop({ taskID: task.id, event: wake.event, signal, wakeID: wake.id })
          if (signal.aborted) {
            if (!isExecutionCancellationError(signal.reason)) {
              throw new Error(`Root Session wake ${wake.id} has an untyped in-flight cancellation reason`)
            }
            throw signal.reason
          }
        },
      })
      markQueuedOperatorWakeDrained(wake.id)
    },
  }).catch(async (err) => {
    const error = Database.normalizeError(err, "engine.queue.launchTaskLoop")
    log.error("task loop failed", {
      taskID: task.id,
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : undefined,
    })
    if (isExecutionCancellationError(error)) return
    // The delivery attempt is physically over. Keeping this exact wake
    // pending would make the completion hook immediately launch the same
    // failed attempt again. Durable coordination requests remain pending;
    // bootstrap reconciliation may create/revive one later wake by request
    // identity without turning this catch into a retry state machine.
    updateEngineArtifact({ id: wake.id, label: "delivery_failed" })
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
function attachLoopCompletion(taskID: string, wakeID: string, cwd: string, loopPromise: Promise<void>): void {
  const completionHook = Database.runOutsideContext(() =>
    runOutsideInstanceContext(() =>
      loopPromise
        .finally(async () => {
          // Yield once so `advanceQueue` → `startLoopForTask` → `.finally`
          // re-entry doesn't stack synchronously, while keeping the async
          // completion hook observable for tests and diagnostics.
          await Promise.resolve()
          await runWithIndependentProjectIdentity({
            directory: cwd,
            fn: async () => {
              const task = findTask(taskID)
              if (task && isTaskTerminal(task)) {
                const { disposeTaskExecutionCapsule } = await import("@/execution-capsule/runtime")
                try {
                  await disposeTaskExecutionCapsule(taskID)
                } catch (error) {
                  const { recordTaskInfrastructureError } = await import("@/engine/persist")
                  recordTaskInfrastructureError({
                    taskID,
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
                      eq(EngineArtifactTable.id, wakeID),
                      eq(EngineArtifactTable.task_id, taskID),
                      eq(EngineArtifactTable.kind, "queued_operator_wake"),
                    ),
                  )
                  .get(),
              )
              if (currentWake?.label === "pending") return
              if (await drainQueuedTaskEvent(taskID)) return
              await advanceQueue(cwd)
            },
          })
        })
        .catch((err) => {
          const error = Database.normalizeError(err, "engine.queue.loopCompletion")
          log.error("task loop completion hook observed failure", {
            taskID,
            cwd,
            error: error instanceof Error ? error.message : String(error),
            errorName: error instanceof Error ? error.name : undefined,
          })
        }),
    ),
  )
  loopCompletionHooksForTest.add(completionHook)
  void completionHook.finally(() => {
    loopCompletionHooksForTest.delete(completionHook)
  })
}

function attachTerminalIngressCompletion(
  task: TaskRow,
  wake: NonNullable<ReturnType<typeof findNextPendingQueuedOperatorWake>>,
  directory: string,
): void {
  const completion = Database.runOutsideContext(() =>
    runOutsideInstanceContext(() =>
      runWithIndependentProjectIdentity({
        directory,
        fn: () =>
          deliverTerminalTaskIngress({
            task,
            ingressArtifactID: wake.id,
            ingress: wake.ingress,
          }),
      })
        .then(async (delivery) => {
          if (!delivery.settled) return
          await runWithIndependentProjectIdentity({
            directory,
            fn: async () => {
              if (hasQueuedTaskEvent(task.id)) await drainQueuedTaskEvent(task.id)
            },
          })
        })
        .catch((error) => {
          const normalized = Database.normalizeError(error, "engine.queue.terminalIngressCompletion")
          log.error("terminal Task ingress remains pending after interrupted delivery", {
            taskID: task.id,
            ingressID: wake.id,
            error: normalized instanceof Error ? normalized.message : String(normalized),
            errorName: normalized instanceof Error ? normalized.name : undefined,
          })
        }),
    ),
  )
  loopCompletionHooksForTest.add(completion)
  void completion.finally(() => loopCompletionHooksForTest.delete(completion))
}

export async function waitForQueueCompletionHooksForTest(): Promise<void> {
  for (;;) {
    const pending = [...loopCompletionHooksForTest]
    if (pending.length === 0) return
    await Promise.allSettled(pending)
  }
}

export async function drainQueuedTaskEvent(taskID: string): Promise<boolean> {
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
  attachLoopCompletion(taskID, queuedWake.id, cwd, launchTaskLoop(task, queuedWake, cwd, runTaskLoop))
  log.info("enqueued persisted root Session wake", { taskID, wakeID: queuedWake.id })
  return true
}

export async function drainPendingQueuedOperatorWakes(): Promise<number> {
  reconcilePendingCoordinationRequestWakes()
  const taskIDs = [...new Set(pendingQueuedOperatorWakeTaskIDs(Instance.project.id))]
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

function interruptedSessionEvidence(input: {
  taskID: string
  rootSessionID: string
  ownedSessionIDs: ReadonlySet<string>
}): InterruptedSessionEvidence[] {
  const projected = listTaskConversationAgentSessions(input.taskID).flatMap((session): InterruptedSessionEvidence[] => {
    const event = latestSessionStatusEvent(session.sessionID)
    const descriptor = session.runtimeContractError
      ? undefined
      : WorkerTurnDescriptor.latestForSession(session.sessionID)
    const preparedAfterLatestLifecycle =
      descriptor?.payload.lifecycle.priorLifecycleEventID !== undefined &&
      descriptor.payload.lifecycle.priorLifecycleEventID === event?.id
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
      event?.payload && typeof event.payload.inputMessageID === "string"
        ? event.payload.inputMessageID
        : undefined
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
  const taskIDs = listStartedIncompleteTaskIDs({ projectID: Instance.project.id })
  let recovered = 0
  const failures: string[] = []

  for (const taskID of taskIDs) {
    try {
      const taskSnapshot = findTask(taskID)
      if (!taskSnapshot?.session_id) continue
      const ownedSessionIDs = new Set(listOwnedPromptSessionsForTask(taskID).map((owner) => owner.sessionID))
      const sessions = interruptedSessionEvidence({
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
          const refreshedSessions = interruptedSessionEvidence({
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
            if (!worker) throw new Error(`Interrupted prepared Session ${interrupted.session_id} has no Worker authority`)
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
        const refreshedSessions = interruptedSessionEvidence({
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
  Database.transaction((db) => {
    result = claimNextEngineTaskForCwd(db, { cwd, timeStarted: now })
    if (!result) return
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
  return result ?? undefined
}

export function claimQueuedTaskForCwd(taskID: string, cwd: string, now = Date.now()): TaskRow | undefined {
  if (!taskID || !cwd) return undefined
  let result: TaskRow | undefined
  Database.transaction((db) => {
    result = claimQueuedEngineTaskForCwd(db, { taskID, cwd, timeStarted: now })
    if (!result) return
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
  const claimed = claimQueuedTaskForCwd(taskID, cwd)
  if (!claimed) return undefined
  await startLoopForTask(claimed, undefined, cwd, runTaskLoop)
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
  const claimed = claimQueuedTaskForCwd(candidate.id, cwd)
  if (!claimed) return undefined
  const queuedWake = findNextPendingQueuedOperatorWake(claimed.id)
  const event = queuedWake?.event
  await options?.beforeStart?.({ task: claimed, event })
  await startLoopForTask(claimed, event, cwd, runTaskLoop)
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
  const { assertTaskExecutionCapsuleRuntime } = await import("@/engine/task-execution-capsule-binding")
  await assertTaskExecutionCapsuleRuntime(task.id)
  if (isTaskTerminal(task)) {
    const cwd = taskRootDirectory(task)
    enqueueTaskEvent(task, OrchestratorEventSchema.parse(input.event ?? { note: "Task wake" }))
    await input.beforeAcceptedWake?.({ taskID: task.id, result: "started" })
    if (!(await drainQueuedTaskEvent(task.id))) {
      log.info("terminal Task ingress is queued behind the current root prompt owner", {
        taskID: task.id,
        status: deriveTaskStatus(task),
        directory: cwd,
      })
    }
    return "started"
  }
  const cwd = taskRootDirectory(task)
  enqueueTaskEvent(task, input.event ?? { note: "Task wake" })
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

  // Task is already active — enqueue the persisted wake on the root Session.
  // The new
  // invocation might be the one that drives the task to terminal, so its
  // completion must also advance the cwd queue. Fire-and-forget: callers
  // don't want to block on task completion.
  const runTaskLoop = requireTaskLoopRunner()
  await consumePendingWaitCronForAcceptedWake(task, "task wake accepted as active re-entry")
  await input.beforeAcceptedWake?.({ taskID: task.id, result: "started" })
  const wake = findNextPendingQueuedOperatorWake(task.id)
  if (!wake) throw new Error(`Task ${task.id} persisted wake disappeared before root Session enqueue`)
  attachLoopCompletion(task.id, wake.id, cwd, launchTaskLoop(task, wake, cwd, runTaskLoop))
  return "started"
}

export async function dispatchPersistedTaskLoop(taskID: string): Promise<DispatchTaskLoopResult> {
  const task = findTask(taskID)
  if (!task) throw new TaskQueueError(`Task ${taskID} does not exist`, "task_not_found", taskID)
  const { assertTaskExecutionCapsuleRuntime } = await import("@/engine/task-execution-capsule-binding")
  await assertTaskExecutionCapsuleRuntime(task.id)
  const cwd = taskRootDirectory(task)
  const wake = findNextPendingQueuedOperatorWake(taskID)
  if (!wake) throw new Error(`Task ${taskID} has no persisted wake to dispatch`)
  if (isTaskQueued(task)) {
    const claimed = await advanceQueue(cwd)
    return claimed?.id === taskID ? "started" : "queued"
  }
  if (isTaskActive(task)) {
    if (!(await drainQueuedTaskEvent(taskID))) {
      throw new Error(`Task ${taskID} persisted wake could not be attached to its active root Session`)
    }
    return "started"
  }
  throw new TaskQueueError(`Task ${taskID} is terminal before its persisted wake can dispatch`, "task_terminal", taskID)
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
): Promise<boolean> {
  const taskDirectory = taskRootDirectory(task)
  if (taskDirectory !== cwd) {
    throw new TaskQueueError(
      `Task ${task.id} directory ${taskDirectory} does not match loop directory ${cwd}`,
      "directory_mismatch",
      task.id,
    )
  }
  let wake = findNextPendingQueuedOperatorWake(task.id)
  if (!wake) {
    enqueueTaskEvent(task, event ?? { note: "Queued Task start" })
    wake = findNextPendingQueuedOperatorWake(task.id)
  }
  if (!wake) throw new Error(`Task ${task.id} has no persisted root Session wake`)
  attachLoopCompletion(task.id, wake.id, cwd, launchTaskLoop(task, wake, cwd, runTaskLoop))
  return true
}
