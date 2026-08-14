/**
 * Durable Task root-Session ingress.
 *
 * Task scheduling belongs to the Mission/Orchestrator model. This module owns
 * only causal first-in-first-out delivery inside one Task root Session,
 * terminal ingress settlement, and interrupted physical-execution recovery.
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
import { findTask, listOwnedPromptSessionsForTask, listStartedIncompleteTaskIDs, type TaskRow } from "./store"
import { deriveTaskStatus, isTaskActive, isTaskTerminal } from "./task-status"
import { OrchestratorEventSchema, type OrchestratorEvent } from "@/orchestrator/event"
import { Identifier } from "@/id/id"
import { TaskRootIngressSchema, taskRootIngressSourceKind, type TaskRootIngress } from "./task-root-ingress"
import { Instance, runOutsideInstanceContext } from "@/project/instance"
import {
  runWithIndependentProjectIdentity,
  runWithInitializedIndependentProject,
} from "@/project/independent-project-owner"
import { createInstanceState } from "@/project/instance-state"
import { requireTaskWakeRuntime } from "@/scheduler/task-wake-runtime"
import { SessionPromptState } from "@/session/prompt/state"
import { orchestratorControlOccurrenceIdentity } from "@/orchestrator/control-message-identity"
import { createExecutionCancellationOrigin, isExecutionCancellationError } from "@/session/prompt/cancellation"
import { TaskRootIngressError, taskRootDirectory } from "./task-directory"
import { isAgentInvocationSession, listTaskConversationAgentSessions } from "@/orchestrator/task-event"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { hasProjectedWorkerTurnOwnership } from "@/agent/projected-worker-turn-owner"
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
import {
  findDispatchLineageByDispatchID,
  listDispatchLineage,
  resolveDispatchOccurrenceAuthority,
} from "./dispatch-lineage"
import { findDispatchSettlementByDispatchID, settleDispatchOrReturnExisting } from "./dispatch-settlement"
import {
  RuntimeExecutionAdmissionClosedError,
  RuntimeExecutionSettlement,
  type RuntimeExecutionReservation,
} from "@/runtime/execution-settlement"
import { DispatchOutcome } from "@/agent/dispatch-outcome"
import { exactEngineArtifactLocator } from "@/artifact-catalog"
import { RuntimeServerOwnership } from "@/server/runtime-server-ownership"
import { Filesystem } from "@/util/filesystem"
import {
  isOrchestratorDecisionToolName,
  orchestratorDecisionToolCompletionEffect,
} from "@/orchestrator/decision-tool-names"
import type { OrchestratorDecisionToolName } from "@/orchestrator/decision-tool-names"

const immutableArtifactIngressOrdinal = sql<number>`coalesce(
  (
    SELECT min(${EngineArtifactVersionTable.catalog_revision})
    FROM ${EngineArtifactVersionTable}
    WHERE ${EngineArtifactVersionTable.artifact_id} = ${EngineArtifactTable.id}
  ),
  ${EngineArtifactTable.catalog_revision}
)`

export { TaskRootIngressError } from "./task-directory"

const log = Log.create({ service: "engine.task-root-ingress" })
const INTERRUPTED_TASK_WAKE_SETTLE_TIMEOUT_MS = 60_000
const MAX_CURRENT_RUNTIME_TERMINAL_INGRESS_DELIVERY_ATTEMPTS = 2
const TERMINAL_INGRESS_DELAYED_RETRY_BASE_MS = 1_000
const TERMINAL_INGRESS_DELAYED_RETRY_MAX_MS = 60_000
let terminalIngressDeliveryRuntimeOverrideForTest: string | undefined
let terminalIngressDelayedRetryDelayOverrideForTest: number | undefined
const loopCompletionHooksForTest = new Set<Promise<void>>()
const taskIngressDeliveryCompletionOperations = new Map<string, Promise<void>>()
const terminalIngressDelayedRetryOwners = new Map<string, Promise<void>>()

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

const terminalIngressCompletions = new Map<string, Promise<void>>()

function artifactPayloadRecord(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {}
}

async function settleDetachedDispatchRecovery(dispatchLineageID: string): Promise<void> {
  const { settleDetachedDispatchPipelineRecovery } = await import("@/orchestrator/dispatch-agent-tool")
  settleDetachedDispatchPipelineRecovery(dispatchLineageID)
}

function canRetryTerminalIngressInCurrentRuntime(ingress: TaskRootIngress): boolean {
  const runtimeID = terminalIngressDeliveryRuntimeID()
  return (
    ingress.delivery_runtime_id !== runtimeID ||
    (ingress.delivery_runtime_attempt ?? ingress.delivery_attempt) <
      MAX_CURRENT_RUNTIME_TERMINAL_INGRESS_DELIVERY_ATTEMPTS
  )
}

function terminalIngressDelayedRetryDelay(ingress: TaskRootIngress): number {
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

export type TaskIngressRunResult = {
  finalMessageID?: string
}

type MessageFence = {
  timeCreated: number
  id: string
}

type TaskIngressRunner = (input: {
  taskID: string
  event?: OrchestratorEvent
  signal?: AbortSignal
  wakeID?: string
}) => Promise<TaskIngressRunResult | void>

const activeTaskIngressProjectDirectories = new Set<string>()

const taskIngressRuntime = createInstanceState(
  () => {
    const directory = Filesystem.resolve(Instance.directory)
    activeTaskIngressProjectDirectories.add(directory)
    return { runner: undefined as TaskIngressRunner | undefined, directory }
  },
  async (runtime) => {
    activeTaskIngressProjectDirectories.delete(runtime.directory)
  },
  "task-root-ingress-runner",
)
const taskIngressRunnerOverridesForTest = new Map<
  string,
  { token: symbol; runner: TaskIngressRunner; configurationCount: number }
>()

function taskIngressRunnerOverrideKey(directory: string): string {
  const resolved = Filesystem.resolve(directory)
  return process.platform === "win32" ? resolved.toLowerCase() : resolved
}

export function configureTaskIngressRunner(runner: TaskIngressRunner): void {
  const runtime = taskIngressRuntime()
  const override = taskIngressRunnerOverridesForTest.get(taskIngressRunnerOverrideKey(Instance.directory))
  if (override) override.configurationCount += 1
  const configured = override?.runner ?? runner
  if (runtime.runner && runtime.runner !== configured) {
    throw new Error("Task ingress task-ingress runner is already configured for this instance")
  }
  runtime.runner = configured
}

export function snapshotTaskIngressRecoveryDirectories(): string[] {
  return [...activeTaskIngressProjectDirectories]
}

export async function recoverTaskRootIngressesAfterRuntimeRollback(directories: readonly string[]): Promise<void> {
  const failures: unknown[] = []
  for (const directory of directories) {
    try {
      await runWithInitializedIndependentProject({
        directory,
        fn: async () => {
          await recoverInterruptedTaskIngressDeliveries()
          await deliverPendingTaskRootIngresses()
        },
      })
    } catch (error) {
      failures.push(error)
    }
  }
  if (failures.length > 0) {
    throw new AggregateError(failures, "Task root ingress recovery after runtime rollback failed")
  }
}

function requireTaskIngressRunner(): TaskIngressRunner {
  const runner = taskIngressRuntime().runner
  if (!runner) throw new Error("Task ingress task-ingress runner is not configured for this instance")
  return runner
}

export function discardTaskRootIngress(taskID: string): void {
  discardAcceptedTaskRootIngresses(taskID)
}

export function terminalizeTaskRootIngressesForCancellation(input: {
  taskID: string
  cancellationRequestEventID: string
  now?: number
}): void {
  const now = input.now ?? Date.now()
  Database.transaction((db) => terminalizeTaskRootIngressesForCancellationInTransaction(db, { ...input, now }))
}

export function terminalizeTaskRootIngressesForCancellationInTransaction(
  db: Database.TxOrDb,
  input: { taskID: string; cancellationRequestEventID: string; now: number },
): void {
  const rows = db
    .select({ id: EngineArtifactTable.id, payload: EngineArtifactTable.payload })
    .from(EngineArtifactTable)
    .where(
      and(
        eq(EngineArtifactTable.task_id, input.taskID),
        eq(EngineArtifactTable.kind, "task_root_ingress"),
        sql`${EngineArtifactTable.label} IN ('accepted', 'delivering', 'delivery_failed')`,
      ),
    )
    .all()
  for (const row of rows) {
    const ingress = TaskRootIngressSchema.parse(row.payload)
    patchEngineArtifact(db, {
      id: row.id,
      label: "terminal_inapplicable",
      payload: TaskRootIngressSchema.parse({
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

export function retirePendingTaskRootIngressesForOperatorIntentInTransaction(
  db: Database.TxOrDb,
  input: { taskID: string; now: number },
): string[] {
  const task = db
    .select({ rootSessionID: EngineTaskTable.session_id })
    .from(EngineTaskTable)
    .where(eq(EngineTaskTable.id, input.taskID))
    .get()
  if (!task?.rootSessionID) {
    throw new Error(`Task ${input.taskID} has no root Session while retiring accepted ingress`)
  }
  const rows = db
    .select({ id: EngineArtifactTable.id, taskID: EngineArtifactTable.task_id, payload: EngineArtifactTable.payload })
    .from(EngineArtifactTable)
    .where(
      and(
        eq(EngineArtifactTable.task_id, input.taskID),
        eq(EngineArtifactTable.kind, "task_root_ingress"),
        eq(EngineArtifactTable.label, "accepted"),
      ),
    )
    .orderBy(EngineArtifactTable.time_created, EngineArtifactTable.id)
    .all()
  const supersededOperatorMessageIDs = rows.flatMap((row) => {
    if (row.taskID !== input.taskID) {
      throw new Error(`Task root ingress ${row.id} belongs to Task ${row.taskID}, expected ${input.taskID}`)
    }
    const ingress = TaskRootIngressSchema.parse(row.payload)
    if (ingress.task_id !== input.taskID || ingress.root_session_id !== task.rootSessionID) {
      throw new Error(`Task root ingress ${row.id} conflicts with Task/root Session authority`)
    }
    if (ingress.source_kind !== "operator_message") return []
    const message = db
      .select({ data: MessageTable.data })
      .from(MessageTable)
      .where(and(eq(MessageTable.id, ingress.message_id), eq(MessageTable.session_id, task.rootSessionID)))
      .get()
    if (!message) {
      throw new Error(`Task root ingress ${row.id} has no exact visible operator root message`)
    }
    const visibleOperatorMessage = Message.User.safeParse({
      ...message.data,
      id: ingress.message_id,
      sessionID: task.rootSessionID,
    })
    if (!visibleOperatorMessage.success || visibleOperatorMessage.data.author !== "user") {
      throw new Error(`Task root ingress ${row.id} has no exact visible operator root message`)
    }
    const provenance = TaskRootMessageProvenance.parse(visibleOperatorMessage.data.extra?.task_root_message)
    if (provenance.taskID !== input.taskID || provenance.kind !== "operator") {
      throw new Error(`Task root ingress ${row.id} message provenance conflicts with Task authority`)
    }
    return [ingress.message_id]
  })
  if (new Set(supersededOperatorMessageIDs).size !== supersededOperatorMessageIDs.length) {
    throw new Error(`Task ${input.taskID} has duplicate accepted operator message ingress`)
  }
  updateEngineArtifactsWhere(db, {
    label: "discarded",
    timeUpdated: input.now,
    where: and(
      eq(EngineArtifactTable.task_id, input.taskID),
      eq(EngineArtifactTable.kind, "task_root_ingress"),
      eq(EngineArtifactTable.label, "accepted"),
    )!,
  })
  return supersededOperatorMessageIDs
}

export function taskRootIngressStats(taskID?: string) {
  if (taskID) {
    const durableCount = acceptedTaskRootIngressTaskIDs().filter((id) => id === taskID).length
    return {
      tasks: durableCount > 0 ? 1 : 0,
      events: durableCount,
    }
  }
  const durableRows = acceptedTaskRootIngressTaskIDs()
  return {
    tasks: new Set<string>(durableRows).size,
    events: durableRows.length,
  }
}

function acceptedTaskRootIngressTaskIDs(projectID?: string): string[] {
  return Database.use((db) =>
    db
      .select({ taskID: EngineArtifactTable.task_id })
      .from(EngineArtifactTable)
      .innerJoin(EngineTaskTable, eq(EngineTaskTable.id, EngineArtifactTable.task_id))
      .where(
        and(
          eq(EngineArtifactTable.kind, "task_root_ingress"),
          eq(EngineArtifactTable.label, "accepted"),
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
 * A coordination request is the user/worker fact. The accepted ingress is only a
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
          eq(EngineArtifactTable.label, "accepted"),
          sql`json_extract(${EngineArtifactTable.payload}, '$.status') = 'pending'`,
        ),
      )
      .orderBy(immutableArtifactIngressOrdinal, EngineArtifactTable.id)
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
            eq(EngineArtifactTable.kind, "task_root_ingress"),
            eq(EngineArtifactTable.label, "accepted"),
            sql`json_extract(${EngineArtifactTable.payload}, '$.request_id') = ${request.requestID}`,
          ),
        )
        .get(),
    )
    if (existing) continue
    persistTaskRootIngress(
      task,
      { coordinationRequest: { requestID: request.requestID } },
      { requestID: request.requestID },
    )
    reconciled += 1
  }
  return reconciled
}

function persistTaskIngressEvent(task: TaskRow, event: OrchestratorEvent): string {
  const messageID = event.rootMessage?.messageID.trim() ?? event.missionAcceptanceResume?.messageID.trim()
  const requestID = event.coordinationRequest?.requestID.trim()
  const recoveryFactID = event.processRecovery?.recoveryFactID.trim()
  const infrastructureFactID = event.dispatchInfrastructureFailure?.infrastructureFactID.trim()
  const waitJobID = event.taskWaitWake?.jobID.trim()
  const lifecycleEventID = event.agentLifecycleDelivery?.eventID.trim()
  return persistTaskRootIngress(task, event, {
    messageID,
    requestID,
    recoveryFactID,
    infrastructureFactID,
    waitJobID,
    lifecycleEventID,
  })
}

export function persistTaskRootIngressInTransaction(
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
    taskCreationID?: string
  },
  now = Date.now(),
): string {
  if (!task.session_id)
    throw new TaskRootIngressError(`Task ${task.id} has no root session`, "session_not_bound", task.id)
  const messageID = identity.messageID
  const requestID = identity.requestID
  const recoveryFactID = identity.recoveryFactID
  const infrastructureFactID = identity.infrastructureFactID
  const waitJobID = identity.waitJobID
  const lifecycleEventID = identity.lifecycleEventID
  const taskCreationID = identity.taskCreationID
  const cancellationAuthority = db
    .select({ requestEventID: EngineTaskCancellationAuthorityTable.request_event_id })
    .from(EngineTaskCancellationAuthorityTable)
    .innerJoin(EngineTaskTable, eq(EngineTaskTable.id, EngineTaskCancellationAuthorityTable.task_id))
    .where(and(eq(EngineTaskCancellationAuthorityTable.task_id, task.id), isNull(EngineTaskTable.time_completed)))
    .get()
  if (
    messageID ||
    requestID ||
    recoveryFactID ||
    infrastructureFactID ||
    waitJobID ||
    lifecycleEventID ||
    taskCreationID
  ) {
    const exists = db
      .select({ id: EngineArtifactTable.id, label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, task.id),
          eq(EngineArtifactTable.kind, "task_root_ingress"),
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
                    : lifecycleEventID
                      ? sql`json_extract(${EngineArtifactTable.payload}, '$.lifecycle_event_id') = ${lifecycleEventID}`
                      : sql`json_extract(${EngineArtifactTable.payload}, '$.task_creation_id') = ${taskCreationID}`,
        ),
      )
      .get()
    if (exists) {
      if (cancellationAuthority && ["accepted", "delivering", "delivery_failed"].includes(exists.label)) {
        const ingress = TaskRootIngressSchema.parse(exists.payload)
        patchEngineArtifact(db, {
          id: exists.id,
          label: "terminal_inapplicable",
          payload: TaskRootIngressSchema.parse({
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
        const ingress = TaskRootIngressSchema.parse(exists.payload)
        if (canRetryTerminalIngressInCurrentRuntime(ingress)) {
          const {
            delivery_result: _failedDelivery,
            accepted_by_instance_directory: _failedInstanceDirectory,
            accepted_by_project_id: _failedProjectID,
            ...retryIngress
          } = ingress
          patchEngineArtifact(db, {
            id: exists.id,
            label: "accepted",
            payload: {
              ...retryIngress,
              delivery_attempt: ingress.delivery_attempt + 1,
              delivery_runtime_id: terminalIngressDeliveryRuntimeID(),
              delivery_runtime_attempt:
                ingress.delivery_runtime_id === terminalIngressDeliveryRuntimeID()
                  ? (ingress.delivery_runtime_attempt ?? ingress.delivery_attempt) + 1
                  : 1,
              time_accepted: now,
              accepted_by_process_id: process.pid,
              ...(Instance.current()
                ? {
                    accepted_by_instance_directory: Instance.directory,
                    accepted_by_project_id: Instance.project.id,
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
  const sourceKind = taskRootIngressSourceKind(event)
  const payload = TaskRootIngressSchema.parse({
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
                : taskCreationID
                  ? taskCreationID
                  : Identifier.ascending("artifact")),
    delivery_attempt: 1,
    delivery_runtime_id: terminalIngressDeliveryRuntimeID(),
    delivery_runtime_attempt: 1,
    task_id: task.id,
    root_session_id: task.session_id,
    task_occurrence_started_at: task.time_started,
    ...(messageID ? { message_id: messageID } : {}),
    ...(requestID ? { request_id: requestID } : {}),
    ...(recoveryFactID ? { recovery_fact_id: recoveryFactID } : {}),
    ...(infrastructureFactID ? { infrastructure_fact_id: infrastructureFactID } : {}),
    ...(waitJobID ? { wait_job_id: waitJobID } : {}),
    ...(lifecycleEventID ? { lifecycle_event_id: lifecycleEventID } : {}),
    ...(taskCreationID ? { task_creation_id: taskCreationID } : {}),
    source_kind: sourceKind,
    event: OrchestratorEventSchema.parse(event),
    time_accepted: now,
    accepted_by_process_id: process.pid,
    ...(instance
      ? { accepted_by_instance_directory: instance.directory, accepted_by_project_id: instance.project.id }
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
    kind: "task_root_ingress",
    label: cancellationAuthority ? "terminal_inapplicable" : "accepted",
    payload,
    timeCreated: now,
  })
}

export function persistTaskRootIntentIngressInTransaction(
  db: Database.TxOrDb,
  input: {
    task: TaskRow
    intent: "retry" | "replan"
    supersededOperatorMessageIDs: string[]
    now: number
  },
): string {
  return persistTaskRootIngressInTransaction(
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

export function requireTaskCreationIngressID(taskID: string): string {
  const row = Database.use((db) =>
    db
      .select({ id: EngineArtifactTable.id })
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, taskID),
          eq(EngineArtifactTable.kind, "task_root_ingress"),
          sql`json_extract(${EngineArtifactTable.payload}, '$.source_kind') = 'task_creation'`,
          sql`json_extract(${EngineArtifactTable.payload}, '$.task_creation_id') = ${taskID}`,
        ),
      )
      .get(),
  )
  if (!row) throw new Error(`Task ${taskID} has no durable creation ingress`)
  return row.id
}

export function persistTaskRootMessageIngressInTransaction(
  db: Database.TxOrDb,
  input: {
    task: TaskRow
    messageID: string
    kind: "operator" | "orchestrator" | "mission"
    schedulerDelivery?: import("@/task-api/task-root-message").SchedulerDeliveryReference
    now: number
  },
): string {
  return persistTaskRootIngressInTransaction(
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

export function persistMissionAcceptanceResumeIngressInTransaction(
  db: Database.TxOrDb,
  input: {
    task: TaskRow
    event: Extract<OrchestratorEvent, { missionAcceptanceResume?: unknown }>
    now: number
  },
): string {
  const resume = input.event.missionAcceptanceResume
  if (!resume) throw new Error(`Mission acceptance-resume ingress is missing its exact provenance.`)
  return persistTaskRootIngressInTransaction(db, input.task, input.event, { messageID: resume.messageID }, input.now)
}

function persistTaskRootIngress(
  task: TaskRow,
  event: OrchestratorEvent,
  identity: {
    messageID?: string
    requestID?: string
    recoveryFactID?: string
    infrastructureFactID?: string
    waitJobID?: string
    lifecycleEventID?: string
    taskCreationID?: string
  },
): string {
  return Database.transaction((db) => persistTaskRootIngressInTransaction(db, task, event, identity))
}

export function persistTaskWaitIngressInTransaction(
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
  if (!task) throw new Error(`Task wait ingress task not found: ${input.taskID}`)
  if (task.project_id !== input.projectID) {
    throw new Error(
      `Task wait ingress project mismatch for ${input.taskID}: expected ${input.projectID}, found ${task.project_id}`,
    )
  }
  return persistTaskRootIngressInTransaction(
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
  replaceTaskIngressRunner(input: { directory: string; runner: TaskIngressRunner }): Disposable & {
    configurationCount(): number
  } {
    const key = taskIngressRunnerOverrideKey(input.directory)
    if (taskIngressRunnerOverridesForTest.has(key)) {
      throw new Error(`Task ingress test runner is already overridden for ${input.directory}`)
    }
    const token = Symbol(key)
    const entry = { token, runner: input.runner, configurationCount: 0 }
    taskIngressRunnerOverridesForTest.set(key, entry)
    return {
      configurationCount() {
        return entry.configurationCount
      },
      [Symbol.dispose]() {
        if (taskIngressRunnerOverridesForTest.get(key)?.token === token) taskIngressRunnerOverridesForTest.delete(key)
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
  startTaskRootIngress(wakeID: string): boolean {
    return markTaskRootIngressDelivering(wakeID)
  },
  completeTaskRootIngress(wakeID: string, assistantMessageID: string): void {
    markTaskRootIngressDelivered({ artifactID: wakeID, assistantMessageID })
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
    return persistTaskIngressEvent(task, {
      note: input.note,
      taskWaitWake: { jobID: input.jobID, fireID: input.fireID, dueAt: input.dueAt ?? 0 },
    })
  },
}

export function persistCoordinationIngressInTransaction(
  db: Database.TxOrDb,
  input: { taskID: string; rootSessionID: string; requestID: string; now?: number },
): string {
  const task = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, input.taskID)).get()
  if (!task) throw new Error(`Coordination ingress task not found: ${input.taskID}`)
  if (task.session_id !== input.rootSessionID) {
    throw new Error(
      `Coordination ingress root Session mismatch for ${input.taskID}: expected ${input.rootSessionID}, found ${task.session_id ?? "null"}`,
    )
  }
  return persistTaskRootIngressInTransaction(
    db,
    task,
    { coordinationRequest: { requestID: input.requestID } },
    { requestID: input.requestID },
    input.now,
  )
}

function persistRecoveryIngressInTransaction(
  db: Database.TxOrDb,
  input: { task: TaskRow; recoveryFactID: string; note: string; now: number },
): string {
  return persistTaskRootIngressInTransaction(
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
      const wakeID = persistRecoveryIngressInTransaction(db, {
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

function discardAcceptedTaskRootIngresses(taskID: string): void {
  const now = Date.now()
  Database.transaction((db) =>
    updateEngineArtifactsWhere(db, {
      label: "discarded",
      timeUpdated: now,
      where: and(
        eq(EngineArtifactTable.task_id, taskID),
        eq(EngineArtifactTable.kind, "task_root_ingress"),
        eq(EngineArtifactTable.label, "accepted"),
      )!,
    }),
  )
}

export function discardAcceptedTaskRootIngressForRequest(input: { taskID: string; requestID: string }): void {
  const now = Date.now()
  Database.transaction((db) =>
    updateEngineArtifactsWhere(db, {
      label: "discarded",
      timeUpdated: now,
      where: and(
        eq(EngineArtifactTable.task_id, input.taskID),
        eq(EngineArtifactTable.kind, "task_root_ingress"),
        eq(EngineArtifactTable.label, "accepted"),
        sql`json_extract(${EngineArtifactTable.payload}, '$.request_id') = ${input.requestID}`,
      )!,
    }),
  )
}

function peekTaskRootIngressEvent(taskID: string): OrchestratorEvent | undefined {
  const durable = findNextAcceptedTaskRootIngress(taskID)
  return durable?.event
}

type TaskRootIngressHead = {
  id: string
  label: string
  timeCreated: number
  wakeID: string
  rootSessionID: string
  ingress: TaskRootIngress
  event: OrchestratorEvent
}

function findTaskRootIngressHead(taskID: string): TaskRootIngressHead | undefined {
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
          eq(EngineArtifactTable.kind, "task_root_ingress"),
          sql`${EngineArtifactTable.label} IN ('accepted', 'delivering', 'delivery_failed')`,
        ),
      )
      .orderBy(immutableArtifactIngressOrdinal, EngineArtifactTable.id)
      .get(),
  )
  if (!row) return undefined
  const payload = TaskRootIngressSchema.parse(row.payload)
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

export const IngressOrderingTestHooks = {
  head(taskID: string): { id: string; label: string } | undefined {
    const head = findTaskRootIngressHead(taskID)
    return head ? { id: head.id, label: head.label } : undefined
  },
}

function findNextAcceptedTaskRootIngress(taskID: string):
  | {
      id: string
      timeCreated: number
      wakeID: string
      rootSessionID: string
      ingress: TaskRootIngress
      event: OrchestratorEvent
    }
  | undefined {
  const head = findTaskRootIngressHead(taskID)
  if (!head || head.label !== "accepted") return undefined
  return head
}

function findTaskRootIngressByID(taskID: string, artifactID: string) {
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
          eq(EngineArtifactTable.kind, "task_root_ingress"),
        ),
      )
      .get(),
  )
  if (!row) return undefined
  return { ...row, ingress: TaskRootIngressSchema.parse(row.payload) }
}

export function dispatchInfrastructureFailureWakeDisposition(input: {
  taskID: string
  infrastructureFactID: string
}): "accepted" | "delivering" | "delivered" | "delivery_failed" | "terminal_inapplicable" {
  const rows = Database.use((db) =>
    db
      .select({ label: EngineArtifactTable.label })
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.kind, "task_root_ingress"),
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
    label !== "accepted" &&
    label !== "delivering" &&
    label !== "delivered" &&
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
  const wake = findTaskRootIngressByID(taskID, wakeID)
  if (
    wake?.label !== "delivery_failed" ||
    !["agent_lifecycle_delivery", "dispatch_infrastructure_failure"].includes(wake.ingress.source_kind)
  ) {
    return false
  }
  const controlMessageID = orchestratorControlOccurrenceIdentity(wakeID).messageID
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
          eq(EngineArtifactTable.kind, "task_root_ingress"),
          sql`${EngineArtifactTable.label} IN ('accepted', 'delivering', 'delivery_failed')`,
        ),
      )
      .orderBy(immutableArtifactIngressOrdinal, EngineArtifactTable.id)
      .get()
    if (head?.id !== wakeID || head.label !== "delivery_failed") return false
    const activeDelivery = db
      .select({ id: EngineArtifactTable.id })
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, taskID),
          eq(EngineArtifactTable.kind, "task_root_ingress"),
          sql`${EngineArtifactTable.label} IN ('accepted', 'delivering')`,
        ),
      )
      .get()
    if (activeDelivery) return false
    const ingress = TaskRootIngressSchema.parse(head.payload)
    const now = Date.now()
    const reason =
      `Historical scheduler FIFO/provenance conflict: exact control ${controlMessageID} was superseded by ` +
      `${latestUser.id}; the failed ingress is preserved and will not be replayed against a different input.`
    patchEngineArtifact(db, {
      id: wakeID,
      label: "terminal_inapplicable",
      payload: TaskRootIngressSchema.parse({
        ...ingress,
        delivery_result: { status: "terminal_inapplicable", reason, time_completed: now },
      }),
      timeUpdated: now,
    })
    const recoveryFactID = recordTaskInfrastructureErrorInTransaction(db, {
      taskID,
      component: "task-root-ingress",
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
    persistRecoveryIngressInTransaction(db, {
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
  ingress: TaskRootIngress
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

type DeliveringIngressReconciliation =
  | "owned"
  | "accepted"
  | "delivered"
  | "delivery_failed"
  | "terminal_inapplicable"
  | "missing"

async function reconcileOwnerlessDeliveringTaskIngress(input: {
  id: string
  taskID: string
  timeCreated: number
  ingress: TaskRootIngress
}): Promise<DeliveringIngressReconciliation> {
  if (SessionPromptState.hasTaskRootIngressOwner(input.ingress.root_session_id, input.id)) {
    return "owned"
  }
  const durableAssistant = findDurableAssistantForLaunchWake({
    taskID: input.taskID,
    wakeID: input.id,
    ingress: input.ingress,
  })
  if (durableAssistant) {
    if (durableAssistant.error) {
      markTaskRootIngressDeliveryFailed({
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
        await assertTaskRootIngressSettlement({
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
        markTaskRootIngressDelivered({
          artifactID: input.id,
          assistantMessageID: durableAssistant.id,
          now: durableAssistant.time.completed,
        })
      } catch (error) {
        markTaskRootIngressDeliveryFailed({
          artifactID: input.id,
          ingress: input.ingress,
          errorName: error instanceof Error ? error.name : "TaskRootIngressSettlementError",
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
          eq(EngineArtifactTable.kind, "task_root_ingress"),
          eq(EngineArtifactTable.label, "delivering"),
        )!,
        kind: "task_root_ingress",
        label: "accepted",
        timeUpdated: Date.now(),
      })
    })
  }
  const current = findTaskRootIngressByID(input.taskID, input.id)
  if (!current) return "missing"
  if (
    current.label === "accepted" ||
    current.label === "delivered" ||
    current.label === "delivery_failed" ||
    current.label === "terminal_inapplicable"
  ) {
    return current.label
  }
  if (current.label === "delivering") {
    if (SessionPromptState.hasTaskRootIngressOwner(current.ingress.root_session_id, current.id)) {
      return "owned"
    }
    throw new Error(`Task root ingress ${input.id} remained delivering without a physical owner after reconciliation`)
  }
  throw new Error(`Task root ingress ${input.id} has unsupported reconciliation state ${current.label}`)
}

async function reconcileOwnerlessDeliveringTaskIngressHead(
  taskID: string,
): Promise<DeliveringIngressReconciliation | undefined> {
  const head = findTaskRootIngressHead(taskID)
  if (!head || head.label !== "delivering") return undefined
  return reconcileOwnerlessDeliveringTaskIngress({
    id: head.id,
    taskID,
    timeCreated: head.timeCreated,
    ingress: head.ingress,
  })
}

export async function recoverInterruptedTaskIngressDeliveries(): Promise<number> {
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
    terminalizeTaskRootIngressesForCancellation({
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
          eq(EngineArtifactTable.kind, "task_root_ingress"),
          eq(EngineArtifactTable.label, "delivering"),
          eq(EngineTaskTable.project_id, Instance.project.id),
          isNull(EngineTaskCancellationAuthorityTable.request_event_id),
        ),
      )
      .all(),
  )
  let recovered = 0
  const failures: Error[] = []
  for (const row of rows) {
    try {
      const ingress = TaskRootIngressSchema.parse(row.payload)
      const disposition = await reconcileOwnerlessDeliveringTaskIngress({
        id: row.id,
        taskID: row.taskID,
        timeCreated: row.timeCreated,
        ingress,
      })
      if (disposition === "accepted") recovered += 1
    } catch (error) {
      failures.push(
        new Error(`Task ingress ${row.id}: ${error instanceof Error ? error.message : String(error)}`, {
          cause: error,
        }),
      )
    }
  }
  if (failures.length > 0)
    throw new AggregateError(failures, `Failed to recover ${failures.length} delivering ingress(es)`)
  return recovered
}

function markTaskRootIngressDelivered(input: { artifactID: string; assistantMessageID: string; now?: number }): void {
  const now = input.now ?? Date.now()
  Database.immediateTransaction((db) => {
    const row = db
      .select({ label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
      .from(EngineArtifactTable)
      .where(and(eq(EngineArtifactTable.id, input.artifactID), eq(EngineArtifactTable.kind, "task_root_ingress")))
      .get()
    if (!row) throw new Error(`Task root ingress ${input.artifactID} disappeared before settlement`)
    if (["delivered", "terminal_inapplicable"].includes(row.label)) return
    if (row.label !== "delivering") {
      throw new Error(`Task root ingress ${input.artifactID} cannot settle from ${row.label}`)
    }
    patchEngineArtifact(db, {
      id: input.artifactID,
      label: "delivered",
      payload: TaskRootIngressSchema.parse({
        ...TaskRootIngressSchema.parse(row.payload),
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

function markTaskRootIngressDelivering(artifactID: string): boolean {
  return Database.immediateTransaction((db) => {
    const row = db
      .select({
        label: EngineArtifactTable.label,
        payload: EngineArtifactTable.payload,
        taskID: EngineArtifactTable.task_id,
      })
      .from(EngineArtifactTable)
      .where(and(eq(EngineArtifactTable.id, artifactID), eq(EngineArtifactTable.kind, "task_root_ingress")))
      .get()
    if (!row) throw new Error(`Task root ingress ${artifactID} disappeared before execution`)
    if (row.label === "delivering") return true
    if (row.label === "terminal_inapplicable") return false
    if (row.label !== "accepted") {
      throw new Error(`Task root ingress ${artifactID} cannot start from ${row.label}`)
    }
    const ingress = TaskRootIngressSchema.parse(row.payload)
    const task = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, row.taskID)).get()
    if (
      !task ||
      task.session_id !== ingress.root_session_id ||
      task.time_started !== ingress.task_occurrence_started_at
    ) {
      const currentOccurrence = task?.time_started
      const reason =
        `TaskIngressOccurrenceStaleError: ingress ${artifactID} belongs to Task ${row.taskID} occurrence ` +
        `${ingress.task_occurrence_started_at}, but the current occurrence is ${currentOccurrence ?? "missing"}.`
      const now = Date.now()
      patchEngineArtifact(db, {
        id: artifactID,
        label: "terminal_inapplicable",
        payload: TaskRootIngressSchema.parse({
          ...ingress,
          delivery_result: { status: "terminal_inapplicable", reason, time_completed: now },
        }),
        timeUpdated: now,
      })
      return false
    }
    const updated = updateEngineArtifactWhereReturning(db, {
      where: and(
        eq(EngineArtifactTable.id, artifactID),
        eq(EngineArtifactTable.kind, "task_root_ingress"),
        eq(EngineArtifactTable.label, "accepted"),
      )!,
      kind: "task_root_ingress",
      label: "delivering",
    })
    if (updated) return true
    throw new Error(`Task root ingress ${artifactID} lost its accepted claim before execution`)
  })
}

function markTaskRootIngressDeliveryFailed(input: {
  artifactID: string
  ingress: TaskRootIngress
  errorName: string
  message: string
  now?: number
}): void {
  const now = input.now ?? Date.now()
  Database.immediateTransaction((db) => {
    const row = db
      .select({ label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
      .from(EngineArtifactTable)
      .where(and(eq(EngineArtifactTable.id, input.artifactID), eq(EngineArtifactTable.kind, "task_root_ingress")))
      .get()
    if (!row) throw new Error(`Task root ingress ${input.artifactID} disappeared before failure settlement`)
    if (!["accepted", "delivering", "delivery_failed"].includes(row.label)) return
    const currentIngress = TaskRootIngressSchema.parse(row.payload)
    updateEngineArtifactWhereReturning(db, {
      where: and(
        eq(EngineArtifactTable.id, input.artifactID),
        eq(EngineArtifactTable.kind, "task_root_ingress"),
        sql`${EngineArtifactTable.label} IN ('accepted', 'delivering', 'delivery_failed')`,
      )!,
      kind: "task_root_ingress",
      label: "delivery_failed",
      payload: TaskRootIngressSchema.parse({
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

class TaskRootIngressSettlementError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "TaskRootIngressSettlementError"
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
    throw new TaskRootIngressSettlementError(
      `Task ${input.taskID} wake ${input.wakeID} completed without persisted assistant message ${input.finalMessageID}`,
    )
  }
  if (!row.parentID) {
    throw new TaskRootIngressSettlementError(
      `Task ${input.taskID} wake ${input.wakeID} final message ${input.finalMessageID} has no parent user message`,
    )
  }
  const wake = findTaskRootIngressByID(input.taskID, input.wakeID)
  if (!wake) {
    throw new TaskRootIngressSettlementError(`Task ${input.taskID} wake ${input.wakeID} disappeared before settlement`)
  }
  if (
    ["agent_lifecycle_delivery", "dispatch_infrastructure_failure"].includes(wake.ingress.source_kind) &&
    row.parentID !== orchestratorControlOccurrenceIdentity(input.wakeID).messageID
  ) {
    throw new TaskRootIngressSettlementError(
      `Task ${input.taskID} wake ${input.wakeID} final message ${input.finalMessageID} parent ${row.parentID} ` +
        `does not match exact control Message ${orchestratorControlOccurrenceIdentity(input.wakeID).messageID}`,
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
    throw new TaskRootIngressSettlementError(
      `Task ${input.taskID} wake ${input.wakeID} final message ${input.finalMessageID} is not the final assistant message for its invocation`,
    )
  }
  const executionControlIngress = !["operator_message", "orchestrator_message", "mission_message"].includes(
    wake.ingress.source_kind,
  )
  let hasStepBoundary = false
  let completedDecisionInCurrentEpoch = false
  let currentStepParts: Message.Part[] = []
  const settleCurrentStep = () => {
    const attempts = currentStepParts.filter(
      (part): part is Message.ToolPart & { tool: OrchestratorDecisionToolName } =>
        part.type === "tool" && isOrchestratorDecisionToolName(part.tool),
    )
    if (attempts.length === 0) return
    if (attempts.some((part) => part.state.status !== "completed")) {
      completedDecisionInCurrentEpoch = false
      return
    }
    const decisions = attempts.filter(
      (part): part is Message.ToolPart & { tool: OrchestratorDecisionToolName; state: Message.ToolStateCompleted } =>
        part.state.status === "completed",
    )
    let followupDecisionRequired = false
    for (const part of decisions) {
      let effect: ReturnType<typeof orchestratorDecisionToolCompletionEffect>
      try {
        effect = orchestratorDecisionToolCompletionEffect({ tool: part.tool, stateInput: part.state.input })
      } catch (error) {
        throw new TaskRootIngressSettlementError(
          `Task ${input.taskID} wake ${input.wakeID} decision ${part.id} has no valid persisted completion contract: ` +
            (error instanceof Error ? error.message : String(error)),
        )
      }
      if (effect === "requires_followup_decision") {
        followupDecisionRequired = true
        continue
      }
      if (effect !== "inspect_dispatch_outcome") continue
      let outcome: ReturnType<typeof DispatchOutcome.parse>
      try {
        outcome = DispatchOutcome.parse(JSON.parse(part.state.output))
      } catch (error) {
        throw new TaskRootIngressSettlementError(
          `Task ${input.taskID} wake ${input.wakeID} dispatch decision ${part.id} has no valid persisted DispatchOutcome: ` +
            (error instanceof Error ? error.message : String(error)),
        )
      }
      if (outcome.kind !== "accepted") followupDecisionRequired = true
    }
    completedDecisionInCurrentEpoch = !followupDecisionRequired
  }
  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type === "step-start") {
        if (hasStepBoundary) settleCurrentStep()
        hasStepBoundary = true
        currentStepParts = []
        continue
      }
      if (hasStepBoundary) currentStepParts.push(part)
    }
  }
  if (hasStepBoundary) settleCurrentStep()
  if (executionControlIngress && (!hasStepBoundary || !completedDecisionInCurrentEpoch)) {
    throw new TaskRootIngressSettlementError(
      `Task ${input.taskID} wake ${input.wakeID} final message ${input.finalMessageID} did not commit a current ` +
        `Orchestrator scheduling or lifecycle decision for ${wake.ingress.source_kind} ingress`,
    )
  }
  return messages
}

async function assertTaskRootIngressSettlement(input: {
  taskID: string
  wake: NonNullable<ReturnType<typeof findNextAcceptedTaskRootIngress>>
  result: TaskIngressRunResult | void
  messageFence?: MessageFence
}): Promise<void> {
  const finalMessageID = input.result?.finalMessageID
  if (!finalMessageID) {
    throw new TaskRootIngressSettlementError(
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

function hasTaskRootIngress(taskID: string): boolean {
  return findNextAcceptedTaskRootIngress(taskID) !== undefined
}

function launchTaskLoop(
  task: TaskRow,
  wake: NonNullable<ReturnType<typeof findNextAcceptedTaskRootIngress>>,
  directory: string,
  runTaskLoop: TaskIngressRunner,
): Promise<void> {
  // Return the loop's own promise (absorbing errors). Callers that want to
  // observe actual loop exit, attach `.finally` to the
  // returned promise; callers that only want fire-and-forget ignore it.
  // Previously this was `void runTaskLoop(...).catch(...)` which discarded
  // the inner promise and resolved after mere scheduling — any `.finally`
  // attached by the caller fired before the loop had done anything, so the
  // completion hook never fired on real task termination and sibling
  // accepted root Session ingress for a Task must remain independently deliverable.
  return SessionPromptState.runTaskRootIngress({
    rootSessionID: wake.rootSessionID,
    wakeID: wake.id,
    run: async (signal) => {
      if (!markTaskRootIngressDelivering(wake.id)) return
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
          await assertTaskRootIngressSettlement({ taskID: task.id, wake, result, messageFence })
          return result
        },
      })
      const finalMessageID = result?.finalMessageID
      if (!finalMessageID) {
        throw new TaskRootIngressSettlementError(`Task ${task.id} wake ${wake.id} lost its final assistant settlement`)
      }
      markTaskRootIngressDelivered({ artifactID: wake.id, assistantMessageID: finalMessageID })
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
    markTaskRootIngressDeliveryFailed({
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
          component: "task-root-ingress",
          operation: "launch-task-ingress",
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
  const normalized = Database.normalizeError(error, "engine.task-root-ingress.launchTaskLoop")
  return { kind: "failed", error: normalized instanceof Error ? normalized : new Error(String(normalized)) }
}

/**
 * Bind same-Task ingress settlement to an in-flight root-Session Turn.
 *
 * All physical starts route through this point so the exact wake is settled
 * and the next ingress for this same root Session can be attached.
 *
 * Idempotent against overlapping invocations for the same task: the Set
 * add/delete and the claim SQL both treat repeated calls as no-ops.
 */
function attachLoopCompletion(taskID: string, wakeID: string, cwd: string, launch: () => Promise<void>): void {
  const authority = RuntimeExecutionSettlement.reserve("task_root_ingress_delivery", `root-ingress:${taskID}:${wakeID}`)
  const completionKey = `wake:${wakeID}`
  const existingCompletion = taskIngressDeliveryCompletionOperations.get(completionKey)
  if (existingCompletion) {
    authority.settleWith(existingCompletion)
    return
  }
  let completionHook: Promise<void>
  try {
    const loopPromise = launch()
    const settlementHook = Database.runOutsideContext(() =>
      runOutsideInstanceContext(() =>
        loopPromise.then(
          async () => {
            // Yield once so same-Session FIFO re-entry does not stack
            // synchronously while the completion remains observable.
            await Promise.resolve()
            return await settleTaskLoopCompletion({ taskID, wakeID, cwd, authority })
          },
          async () => {
            await Promise.resolve()
            return await settleTaskLoopCompletion({ taskID, wakeID, cwd, authority })
          },
        ),
      ),
    )
    completionHook = settlementHook.then(async (disposition) => {
      if (disposition !== "exact_ingress_retry_attached" && disposition !== "same_task_ingress_accepted") return
      // The retry is durably accepted, but it could not acquire physical
      // ownership while this exact wake's previous completion was still in
      // taskIngressDeliveryCompletionOperations. This includes a retry admitted by a
      // concurrent publisher before completion reconciliation observes the
      // failed row. Release that owner before delivering the accepted retry so
      // its next attempt receives a fresh completion hook.
      if (taskIngressDeliveryCompletionOperations.get(completionKey) === completionHook) {
        taskIngressDeliveryCompletionOperations.delete(completionKey)
      }
      await runWithInitializedIndependentProject({
        directory: cwd,
        fn: async () => {
          if (hasTaskRootIngress(taskID)) await deliverTaskRootIngress(taskID)
        },
      })
    })
  } catch (error) {
    authority.settle()
    throw error
  }
  taskIngressDeliveryCompletionOperations.set(completionKey, completionHook)
  loopCompletionHooksForTest.add(completionHook)
  authority.settleWith(completionHook)
  void completionHook.finally(() => {
    if (taskIngressDeliveryCompletionOperations.get(completionKey) === completionHook) {
      taskIngressDeliveryCompletionOperations.delete(completionKey)
    }
    loopCompletionHooksForTest.delete(completionHook)
  })
}

type TaskLoopCompletionDisposition =
  | "same_task_ingress_accepted"
  | "exact_ingress_retry_attached"
  | "same_task_wake_attached"
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
              eq(EngineArtifactTable.kind, "task_root_ingress"),
            ),
          )
          .get(),
      )
      if (currentWake?.label === "delivering") {
        const wake = findTaskRootIngressByID(input.taskID, input.wakeID)
        if (wake) {
          await reconcileOwnerlessDeliveringTaskIngress({
            id: wake.id,
            taskID: input.taskID,
            timeCreated: wake.timeCreated,
            ingress: wake.ingress,
          })
        }
      }
      const reconciledWake = findTaskRootIngressByID(input.taskID, input.wakeID)
      if (reconciledWake?.label === "accepted") return "same_task_ingress_accepted"
      if (reconciledWake?.label === "delivery_failed") {
        if (await retryFailedExactTerminalIngress(input.taskID, input.wakeID)) {
          return "exact_ingress_retry_attached"
        }
      }
      if (await deliverTaskRootIngress(input.taskID)) return "same_task_wake_attached"
      return "runtime_handoff"
    },
  })
}

async function settleTaskLoopCompletion(input: {
  taskID: string
  wakeID: string
  cwd: string
  authority: RuntimeExecutionReservation
}): Promise<TaskLoopCompletionDisposition> {
  let attempt = 0
  for (;;) {
    attempt += 1
    try {
      if (settleAbortedTaskLoopCompletionHandoff({ ...input, attempt })) return "runtime_handoff"
      return await runTaskLoopCompletionAttempt(input)
    } catch (cause) {
      let error = Database.normalizeError(cause, "engine.task-root-ingress.loopCompletion")
      if (input.authority.signal.aborted) {
        try {
          if (settleAbortedTaskLoopCompletionHandoff({ ...input, attempt })) return "runtime_handoff"
        } catch (handoffCause) {
          const handoffError = Database.normalizeError(handoffCause, "engine.task-root-ingress.loopCompletionHandoff")
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
  authority: RuntimeExecutionReservation
  attempt: number
}): boolean {
  if (!input.authority.signal.aborted) return false
  const wake = Database.use((db) =>
    db
      .select({ id: EngineArtifactTable.id })
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.id, input.wakeID),
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.kind, "task_root_ingress"),
        ),
      )
      .get(),
  )
  if (!wake) throw new Error(`Task root ingress ${input.wakeID} disappeared before runtime handoff`)
  return true
}

function resetFailedExactTerminalIngress(input: {
  taskID: string
  wakeID: string
  restartRuntimeAttemptWindow: boolean
}): TaskRootIngress | undefined {
  return Database.immediateTransaction((db) => {
    const current = db
      .select({ label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.id, input.wakeID),
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.kind, "task_root_ingress"),
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
          eq(EngineArtifactTable.kind, "task_root_ingress"),
          sql`${EngineArtifactTable.label} IN ('accepted', 'delivering', 'delivery_failed')`,
        ),
      )
      .orderBy(EngineArtifactTable.time_created, EngineArtifactTable.id)
      .get()
    if (head?.id !== input.wakeID) return undefined
    const currentIngress = TaskRootIngressSchema.parse(current.payload)
    if (!input.restartRuntimeAttemptWindow && !canRetryTerminalIngressInCurrentRuntime(currentIngress)) {
      return undefined
    }
    const {
      delivery_result: _failedDelivery,
      accepted_by_instance_directory: _failedInstanceDirectory,
      accepted_by_project_id: _failedProjectID,
      ...retryIngress
    } = currentIngress
    const now = Date.now()
    patchEngineArtifact(db, {
      id: input.wakeID,
      label: "accepted",
      payload: {
        ...retryIngress,
        delivery_attempt: currentIngress.delivery_attempt + 1,
        delivery_runtime_id: terminalIngressDeliveryRuntimeID(),
        delivery_runtime_attempt: input.restartRuntimeAttemptWindow
          ? 1
          : currentIngress.delivery_runtime_id === terminalIngressDeliveryRuntimeID()
            ? (currentIngress.delivery_runtime_attempt ?? currentIngress.delivery_attempt) + 1
            : 1,
        time_accepted: now,
        accepted_by_process_id: process.pid,
        ...(Instance.current()
          ? {
              accepted_by_instance_directory: Instance.directory,
              accepted_by_project_id: Instance.project.id,
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
  failedIngress: TaskRootIngress
}): void {
  Database.immediateTransaction((db) => {
    const current = db
      .select({ label: EngineArtifactTable.label })
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.id, input.wakeID),
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.kind, "task_root_ingress"),
        ),
      )
      .get()
    if (current?.label !== "accepted") return
    patchEngineArtifact(db, {
      id: input.wakeID,
      label: "delivery_failed",
      payload: input.failedIngress,
      timeUpdated: Date.now(),
    })
  })
}

async function settleAcceptedExactTerminalIngressRecovery(ingress: TaskRootIngress): Promise<void> {
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
  ingress: TaskRootIngress
}): void {
  if (terminalIngressDelayedRetryOwners.has(input.wakeID)) return
  const task = findTask(input.taskID)
  if (!task) return
  const directory = taskRootDirectory(task)
  let authority: RuntimeExecutionReservation
  try {
    authority = RuntimeExecutionSettlement.reserve(
      "task_root_ingress_delivery",
      `terminal-ingress-delayed-retry:${input.taskID}:${input.wakeID}`,
    )
  } catch (error) {
    if (error instanceof RuntimeExecutionAdmissionClosedError && error.kind === "task_root_ingress_delivery") return
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
            const current = findTaskRootIngressByID(input.taskID, input.wakeID)
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
          if (result !== "accepted") {
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
              eq(EngineArtifactTable.kind, "task_root_ingress"),
            ),
          )
          .get(),
      )
      if (failed?.label === "delivery_failed") {
        scheduleDelayedExactTerminalIngressRetry({
          taskID: input.taskID,
          wakeID: input.wakeID,
          ingress: TaskRootIngressSchema.parse(failed.payload),
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
    await deliverTaskRootIngress(taskID)
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
          eq(EngineArtifactTable.kind, "task_root_ingress"),
        ),
      )
      .get(),
  )
  if (row?.label !== "delivery_failed") return false
  const ingress = TaskRootIngressSchema.parse(row.payload)
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
    if (result === "accepted") {
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
  if (result === "accepted") return true
  log.warn("exact terminal ingress retry was not accepted", { taskID, wakeID, sourceKind: ingress.source_kind, result })
  return false
}

function attachTerminalIngressCompletion(
  task: TaskRow,
  wake: NonNullable<ReturnType<typeof findNextAcceptedTaskRootIngress>>,
  directory: string,
): void {
  if (terminalIngressCompletions.has(wake.id)) return
  const authority = RuntimeExecutionSettlement.reserve(
    "task_root_ingress_delivery",
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
                        eq(EngineArtifactTable.kind, "task_root_ingress"),
                      ),
                    )
                    .get(),
                )
                if (currentWake?.label !== "accepted") return undefined
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
                if (hasTaskRootIngress(task.id)) await deliverTaskRootIngress(task.id)
              },
            })
          })
          .catch(async (error) => {
            const normalized = Database.normalizeError(error, "engine.task-root-ingress.terminalIngressCompletion")
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
                if (hasTaskRootIngress(task.id)) await deliverTaskRootIngress(task.id)
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
          if (hasTaskRootIngress(task.id)) await deliverTaskRootIngress(task.id)
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

export async function waitForIngressDeliveryHooksForTest(): Promise<void> {
  for (;;) {
    await Database.awaitEffectIdle(60_000)
    const owners = new Set<Promise<void>>([
      ...loopCompletionHooksForTest,
      ...taskIngressDeliveryCompletionOperations.values(),
      ...terminalIngressCompletions.values(),
    ])
    if (owners.size === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
      await Database.awaitEffectIdle(60_000)
      if (
        loopCompletionHooksForTest.size === 0 &&
        taskIngressDeliveryCompletionOperations.size === 0 &&
        terminalIngressCompletions.size === 0
      ) {
        return
      }
      continue
    }
    await Promise.allSettled([...owners])
  }
}

export async function deliverTaskRootIngress(taskID: string): Promise<boolean> {
  await reconcileOwnerlessDeliveringTaskIngressHead(taskID)
  if (!hasTaskRootIngress(taskID)) return false

  const task = findTask(taskID)
  if (!task) {
    discardTaskRootIngress(taskID)
    log.warn("discarding accepted ingress for missing task", { taskID })
    return false
  }

  const ingressEvent = peekTaskRootIngressEvent(taskID)
  if (
    task.session_id &&
    ingressEvent?.processRecovery &&
    SessionPromptState.isRootSessionProcessShutdownHandoffActive(task.session_id)
  ) {
    log.info("preserving process-shutdown recovery wake for the replacement process", {
      taskID,
      sessionID: task.session_id,
      recoveryFactID: ingressEvent.processRecovery.recoveryFactID,
    })
    return false
  }

  const cwd = taskRootDirectory(task)

  if (isTaskTerminal(task)) {
    const taskRootIngress = findNextAcceptedTaskRootIngress(taskID)
    if (!taskRootIngress) return false
    if (task.session_id && SessionPromptState.hasOwnedPrompt(task.session_id, cwd)) {
      log.info("terminal decision remains owned by the root prompt delivering this wake", {
        taskID,
        sessionID: task.session_id,
        status: deriveTaskStatus(task),
      })
      return false
    }
    attachTerminalIngressCompletion(task, taskRootIngress, cwd)
    log.info("persisted terminal Task ingress", {
      taskID,
      ingressID: taskRootIngress.id,
      sourceKind: taskRootIngress.ingress.source_kind,
      status: deriveTaskStatus(task),
    })
    return true
  }

  const runTaskLoop = requireTaskIngressRunner()
  const taskRootIngress = findNextAcceptedTaskRootIngress(taskID)
  if (!taskRootIngress) return false
  attachLoopCompletion(taskID, taskRootIngress.id, cwd, () => launchTaskLoop(task, taskRootIngress, cwd, runTaskLoop))
  log.info("persisted root Session wake", { taskID, wakeID: taskRootIngress.id })
  return true
}

export async function deliverPendingTaskRootIngresses(): Promise<number> {
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
    ...new Set(acceptedTaskRootIngressTaskIDs(Instance.project.id).filter((taskID) => !cancellingTaskIDs.has(taskID))),
  ]
  let delivered = 0
  const failures: string[] = []
  for (const taskID of taskIDs) {
    try {
      if (await deliverTaskRootIngress(taskID)) delivered += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failures.push(`${taskID}: ${message}`)
      log.error("Task root ingress failed lineage validation", {
        taskID,
        error: message,
        errorName: error instanceof Error ? error.name : undefined,
      })
    }
  }
  if (failures.length > 0) {
    throw new Error(`Failed to deliver ${failures.length} Task root ingress(es): ${failures.join("; ")}`)
  }
  return delivered
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
      hasProjectedWorkerTurnOwnership(session.sessionID) ||
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
      hasProjectedWorkerTurnOwnership(row.id) ||
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
          await SessionPromptState.waitForTaskRootIngressIdle(
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
              time_started: current.time_started,
              time_completed: now,
            },
            "Interrupted Task cannot resume its exact persisted worker runtime contract",
            { terminalReason: "interrupted" },
          )
          discardTaskRootIngress(taskID)
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
          // Once that ingress is delivered, the interruption has reached
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
                  eq(EngineArtifactTable.kind, "task_root_ingress"),
                  eq(EngineArtifactTable.label, "accepted"),
                  sql`json_extract(${EngineArtifactTable.payload}, '$.recovery_fact_id') = ${existingFact.id}`,
                ),
              )
              .get()
            if (!exactWake) {
              persistRecoveryIngressInTransaction(db, { task, recoveryFactID: existingFact.id, note, now })
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
          persistRecoveryIngressInTransaction(db, {
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
      if (recovery.wakeAvailable && (await deliverTaskRootIngress(taskID))) recovered += 1
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
 * identity is a typed ingress error; no project-level directory is consulted.
 */
export function taskCwd(taskID: string): string {
  const task = findTask(taskID)
  if (!task) throw new TaskRootIngressError(`Task ${taskID} does not exist`, "task_not_found", taskID)
  return taskRootDirectory(task)
}

export type DispatchTaskLoopResult = "accepted" | "ignored"
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
  if (!task) throw new TaskRootIngressError(`Task ${input.taskID} does not exist`, "task_not_found", input.taskID)
  const persistedWakeID = persistTaskIngressEvent(
    task,
    OrchestratorEventSchema.parse(input.event ?? { note: "Task wake" }),
  )
  if (findTaskRootIngressByID(task.id, persistedWakeID)?.label === "terminal_inapplicable") {
    return "ignored"
  }
  if (isTaskTerminal(task) && findTaskRootIngressByID(task.id, persistedWakeID)?.label === "delivery_failed") {
    return "ignored"
  }
  const { assertTaskExecutionCapsuleRuntime } = await import("@/engine/task-execution-capsule-binding")
  try {
    await assertTaskExecutionCapsuleRuntime(task.id)
  } catch (error) {
    const wake = findTaskRootIngressByID(task.id, persistedWakeID)
    if (wake?.label === "accepted") {
      markTaskRootIngressDeliveryFailed({
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
      "task_root_ingress_delivery",
      `terminal-wake-acceptance:${task.id}:${persistedWakeID}`,
    )
    const acceptance = (async (): Promise<DispatchTaskLoopResult> => {
      await input.beforeAcceptedWake?.({ taskID: task.id, result: "accepted" })
      if (!(await deliverTaskRootIngress(task.id))) {
        log.info("terminal Task ingress remains accepted behind the current root prompt owner", {
          taskID: task.id,
          status: deriveTaskStatus(task),
          directory: cwd,
        })
      }
      return "accepted"
    })()
    authority.settleWith(acceptance)
    return acceptance
  }
  const cwd = taskRootDirectory(task)
  if (task.session_id && SessionPromptState.isRootSessionProcessShutdownHandoffActive(task.session_id)) {
    await consumePendingWaitCronForAcceptedWake(task, "task wake accepted for post-destructive-scope delivery")
    await input.beforeAcceptedWake?.({ taskID: task.id, result: "accepted" })
    return "accepted"
  }
  // Task is already active. Every re-entry is admitted through the same
  // durable head selector; a newly persisted wake never bypasses an older
  // delivering or delivery-failed occurrence.
  await consumePendingWaitCronForAcceptedWake(task, "task wake accepted as active re-entry")
  await deliverTaskRootIngress(task.id)
  const existing = findTaskRootIngressByID(task.id, persistedWakeID)
  if (!existing) throw new Error(`Task ${task.id} persisted wake disappeared before root Session delivery`)
  let result: Exclude<DispatchTaskLoopResult, "ignored">
  if (["accepted", "delivering", "delivered", "terminal_inapplicable"].includes(existing.label)) {
    result = "accepted"
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
  if (!task) throw new TaskRootIngressError(`Task ${taskID} does not exist`, "task_not_found", taskID)
  const { assertTaskExecutionCapsuleRuntime } = await import("@/engine/task-execution-capsule-binding")
  await assertTaskExecutionCapsuleRuntime(task.id)
  const cwd = taskRootDirectory(task)
  const reconciliation = await reconcileOwnerlessDeliveringTaskIngressHead(taskID)
  const head = findTaskRootIngressHead(taskID)
  if (!head) {
    const expected = expectedWakeID ? findTaskRootIngressByID(taskID, expectedWakeID) : undefined
    if (expected && ["delivered", "terminal_inapplicable"].includes(expected.label)) return "accepted"
    if (expected?.label === "delivery_failed") return "ignored"
    if (reconciliation === "delivered" || reconciliation === "terminal_inapplicable") return "accepted"
    throw new Error(`Task ${taskID} has no persisted wake to dispatch`)
  }
  if (expectedWakeID && head.id !== expectedWakeID) {
    const expected = findTaskRootIngressByID(taskID, expectedWakeID)
    if (expected && ["delivering", "delivered", "terminal_inapplicable"].includes(expected.label)) {
      if (head.label === "accepted") await deliverTaskRootIngress(taskID)
      return "accepted"
    }
    if (expected?.label === "accepted") {
      if (head.label === "accepted") await deliverTaskRootIngress(taskID)
      return "accepted"
    }
    if (expected?.label === "delivery_failed") return "ignored"
    throw new Error(`Task ${taskID} durable wake head is ${head.id}, not expected ${expectedWakeID}`)
  }
  if (head.label === "delivering") {
    return "accepted"
  }
  if (head.label !== "accepted") {
    if (expectedWakeID === head.id && head.label === "delivery_failed") return "ignored"
    if (!expectedWakeID && head.label === "delivery_failed") return "accepted"
    throw new Error(`Task ${taskID} durable wake head ${head.id} cannot dispatch from ${head.label}`)
  }
  if (isTaskActive(task)) {
    if (!(await deliverTaskRootIngress(taskID))) {
      throw new Error(`Task ${taskID} persisted wake could not be attached to its active root Session`)
    }
    return "accepted"
  }
  if (!(await deliverTaskRootIngress(taskID))) {
    throw new Error(`Task ${taskID} persisted wake could not be attached to its terminal conversation`)
  }
  return "accepted"
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
    settleDispatchOrReturnExisting({
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
          eq(EngineArtifactTable.kind, "task_root_ingress"),
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
    if (ingress && !canRetryTerminalIngressInCurrentRuntime(TaskRootIngressSchema.parse(ingress.payload))) {
      scheduleDelayedExactTerminalIngressRetry({
        taskID: input.taskID,
        wakeID: delivered.id,
        ingress: TaskRootIngressSchema.parse(ingress.payload),
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
      .where(eq(EngineTaskTable.project_id, Instance.project.id))
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
          eq(EngineArtifactTable.kind, "task_root_ingress"),
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
              eq(EngineArtifactTable.kind, "task_root_ingress"),
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
      if (result === "accepted") {
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
