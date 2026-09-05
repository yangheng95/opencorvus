/**
 * Fact-reduced Task-root control plane.
 *
 * This module deliberately owns no durable delivery status. Acceptance writes
 * one immutable ingress, execution appends a physical lease, and every public
 * result is reduced from those rows plus the real conversation/domain facts.
 * Normal wakeup, restart and post-Turn continuation all enter the same
 * reconciler below.
 */
import { createHash } from "node:crypto"
import { Identifier } from "@/id/id"
import { OrchestratorEventSchema, type OrchestratorEvent } from "@/orchestrator/event"
import {
  isOrchestratorDecisionToolName,
  orchestratorDecisionToolCompletionEffect,
} from "@/orchestrator/decision-tool-names"
import { Instance } from "@/project/instance"
import { runWithInitializedIndependentProject } from "@/project/independent-project-owner"
import { reenterActiveInstance } from "@/project/instance"
import { createInstanceState } from "@/project/instance-state"
import { ProtocolEventTable } from "@/protocol/protocol.sql"
import { ProtocolStore } from "@/protocol/store"
import { currentRuntimeOccurrenceID, replaceRuntimeOccurrenceIDForTest } from "@/runtime/process-occurrence"
import { RuntimeExecutionSettlement, type RuntimeExecutionReservation } from "@/runtime/execution-settlement"
import { Message } from "@/session/message"
import { SessionStatus } from "@/session/status"
import {
  MessageTable,
  PartTable,
  ProviderActivityOutcomeTable,
  ProviderActivityRequestTable,
  ToolPartOutcomeTable,
  ToolPartRequestTable,
  SessionTable,
} from "@/session/session.sql"
import { projectToolPartInTransaction } from "@/session/tool-part-facts"
import { Database, and, asc, desc, eq, inArray, sql } from "@/storage/db"
import { Log } from "@/util/log"
import { compareCanonicalStrings } from "@/util/canonical-digest"
import { Filesystem } from "@/util/filesystem"
import { IntentBundle } from "@/intent/bundle"
import {
  TaskRootMessageProvenance,
  type SchedulerDeliveryReference,
  type TaskRootMessageKind,
} from "@/protocol/task-root-message-schema"
import {
  EngineControlActivationLeaseTable,
  EngineInteractionRequestTable,
  EngineArtifactTable,
  EngineTaskRootIngressTable,
  EngineTaskTable,
} from "./engine.sql"
import { findTask, taskDeletedInTransaction, type TaskRow } from "./store"
import { projectInteractionRowInTransaction } from "./store"
import { taskLifecycleProjectionInTransaction } from "./task-lifecycle"
import {
  acceptTaskRootIngressInTransaction,
  acquireTaskRootIngressLease,
  DEFAULT_TASK_ROOT_INGRESS_POLICY,
  projectTaskRootIngress,
  renewTaskRootIngressLease,
  taskRootIngressFactsInTransaction,
  type TaskRootIngressEvidence,
  type TaskRootIngressEvidenceReader,
} from "./task-root-fact-store"
import type {
  ActivityOutcomeFact,
  ActivityRequestFact,
  AssistantTurnFact,
  DecisionFact,
  DecisionGapFact,
  InteractionFact,
  TaskLifecycleFact,
  TaskRootIngressProjection,
} from "./task-root-ingress-reducer"
import {
  CANCELLATION_RECONCILE_WAKE_MS,
  classifyTaskRootIngressWake,
  reduceTaskRootIngressFacts,
  taskRootIngressSemanticAttemptIDs,
  taskRootIngressSemanticTurnIDs,
} from "./task-root-ingress-reducer"
import { TaskControlDriver, type TaskControlScanContext, type TaskControlScanResult } from "./task-control-driver"
import { TaskRootIngressIntegrityError } from "./task-root-ingress-integrity"
import { joinProcessLivenessLease } from "./process-liveness"
import { currentControlLease } from "./control-lease"
import { TaskRootIngressError, taskRootDirectory } from "./task-directory"
import { findDispatchLineageByDispatchID } from "./dispatch-lineage"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import {
  findDispatchSettlementByDispatchID,
  settleDispatchOrReturnExisting,
  type DispatchSettlementRow,
} from "./dispatch-settlement"
import { DispatchOutcome } from "@/agent/dispatch-outcome"
import { recordTaskInfrastructureError, recordTaskInfrastructureErrorInTransaction } from "./persist"
import { exactEngineArtifactLocator } from "@/artifact-catalog"
import { taskRootIngressSourceKind } from "./task-root-ingress-source"
import { insertEngineInteractionRequest } from "./interaction-request"
import { orchestratorControlOccurrenceIdentity } from "@/orchestrator/control-message-identity"
import { resolveDispatchOccurrenceAuthority } from "./dispatch-lineage"
import {
  dispatchCollectionWakeCandidateMatchesInTransaction,
  dispatchCollectionWakeDecisionInTransaction,
  dispatchRecoveryCandidateExistsInTransaction,
  recordDispatchBudgetSuppressionInTransaction,
  unresolvedDispatchRecoveryPageInTransaction,
  type DispatchCollectionWakeSource,
  type DispatchRecoveryFrontierCursor,
} from "./dispatch-delivery-disposition"
import {
  dueTaskWaitsInTransaction,
  nextTaskWaitDueAtInTransaction,
  settleTaskWaitForIngressInTransaction,
} from "./task-wait"
import {
  recordTaskRootIngressDispositionInTransaction,
  restartTaskControlProjectFrontier,
  taskControlProjectFrontierSliceInTransaction,
  taskRootIngressReconciliationPageInTransaction,
  type TaskRootDecisionOccurrence,
  type TaskControlProjectFrontierCursor,
  type TaskRootIngressFrontierCursor,
} from "./task-root-ingress-disposition"

export { TaskRootIngressError } from "./task-directory"

const log = Log.create({ service: "engine.task-root-fact-control" })
let leaseMilliseconds = 120_000
let leaseRenewalMilliseconds = 40_000
const completionHooks = new Set<Promise<void>>()
const activeProjectDirectories = new Set<string>()
let operatorGateWriterForTest: ((input: Parameters<typeof recordTaskInfrastructureError>[0]) => void) | undefined
let afterSourceReconciliationForTest: ((input: { taskID: string; pass: number }) => void | Promise<void>) | undefined
let beforeDispatchSettlementDeliveryForTest:
  | ((input: { taskID: string; dispatchID: string; settlementArtifactID: string }) => void | Promise<void>)
  | undefined
let beforeTerminalLifecycleDeliveryForTest:
  | ((input: { taskID: string; dispatchID: string; settlementArtifactID: string }) => void | Promise<void>)
  | undefined

export type TaskIngressRunResult = { finalMessageID?: string }
type TaskIngressRunner = (input: {
  taskID: string
  event?: OrchestratorEvent
  signal?: AbortSignal
  wakeID?: string
  activationID?: string
  predecessorID?: string
}) => Promise<TaskIngressRunResult | void>

/** Drives one Task's requested cancellation to convergence. Injected because
 * the Task API owns cancellation and the engine may not depend on it. */
type TaskCancellationReconciler = (taskID: string) => Promise<void>

const runtimeState = createInstanceState(
  () => {
    const directory = Filesystem.resolve(Instance.directory)
    activeProjectDirectories.add(directory)
    return {
      directory,
      runner: undefined as TaskIngressRunner | undefined,
      runnerOverrideForTest: undefined as TaskIngressRunner | undefined,
      cancellationReconciler: undefined as TaskCancellationReconciler | undefined,
      /** Bounded raw-lineage scan cursor. It carries no settlement authority;
       * restart merely resumes from the first immutable page. */
      dispatchRecoveryCursors: new Map<
        string,
        { after: DispatchRecoveryFrontierCursor; wakeAt?: number; retryRequired?: boolean }
      >(),
    }
  },
  async (state) => {
    activeProjectDirectories.delete(state.directory)
  },
  "task-root-fact-runner",
)

function ownerOccurrenceID(): string {
  return currentRuntimeOccurrenceID()
}

function runner(): TaskIngressRunner {
  const state = runtimeState()
  const configured = state.runnerOverrideForTest ?? state.runner
  if (!configured) throw new Error("Task-root fact runner is not configured for this instance")
  return configured
}

export function configureTaskIngressRunner(next: TaskIngressRunner): void {
  const state = runtimeState()
  if (state.runner && state.runner !== next) throw new Error("Task-root fact runner is already configured")
  state.runner = next
}

export function configureTaskCancellationReconciler(next: TaskCancellationReconciler): void {
  const state = runtimeState()
  if (state.cancellationReconciler && state.cancellationReconciler !== next) {
    throw new Error("Task cancellation reconciler is already configured")
  }
  state.cancellationReconciler = next
}

/** Undefined before the Task API is wired, which is the case in engine-only
 * unit tests; a `cancelling` Task then simply keeps its periodic wake. */
function cancellationReconciler(): TaskCancellationReconciler | undefined {
  return runtimeState().cancellationReconciler
}

function stableInlineSource(event: OrchestratorEvent): string {
  return createHash("sha256")
    .update(JSON.stringify(OrchestratorEventSchema.parse(event)))
    .digest("hex")
}

function sourceForEvent(event: OrchestratorEvent, identity: Record<string, string | undefined>) {
  const messageID = identity.messageID?.trim()
  if (messageID) return { source: "message" as const, sourceID: messageID }
  const lifecycleEventID = identity.lifecycleEventID?.trim()
  if (lifecycleEventID) return { source: "protocol_event" as const, sourceID: lifecycleEventID }
  const artifactID =
    identity.infrastructureFactID?.trim() || identity.recoveryFactID?.trim() || identity.requestID?.trim()
  if (artifactID) return { source: "engine_artifact" as const, sourceID: artifactID }
  const taskCreationID = identity.taskCreationID?.trim()
  if (taskCreationID) return { source: "task" as const, sourceID: taskCreationID }
  return {
    source: "inline" as const,
    sourceID: identity.waitJobID?.trim() || stableInlineSource(event),
    inlinePayload: OrchestratorEventSchema.parse(event) as Record<string, unknown>,
  }
}

export function persistTaskRootIngressInTransaction(
  db: Database.TxOrDb,
  task: Pick<TaskRow, "id" | "session_id">,
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
    throw new TaskRootIngressError(`Task ${task.id} has no root Session`, "session_not_bound", task.id)
  const lifecycle = taskLifecycleProjectionInTransaction(db, task.id)
  const sourceKind = taskRootIngressSourceKind(event)
  const terminalConversation = sourceKind === "operator_message" || sourceKind === "coordination_request"
  if (lifecycle.status !== "active" && !terminalConversation) {
    throw new TaskRootIngressError(
      `Task ${task.id} epoch ${lifecycle.epoch} does not accept ordinary ingress while ${lifecycle.status}`,
      "task_terminal",
      task.id,
    )
  }
  const source = sourceForEvent(OrchestratorEventSchema.parse(event), identity)
  return acceptTaskRootIngressInTransaction(db, {
    taskID: task.id,
    executionEpoch: lifecycle.epoch,
    ...source,
    ...DEFAULT_TASK_ROOT_INGRESS_POLICY,
    now,
  }).id
}

export function persistTaskRootMessageIngressInTransaction(
  db: Database.TxOrDb,
  input: {
    task: TaskRow
    messageID: string
    kind: TaskRootMessageKind
    schedulerDelivery?: SchedulerDeliveryReference
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
  input: { task: TaskRow; event: Extract<OrchestratorEvent, { missionAcceptanceResume?: unknown }>; now: number },
): string {
  const resume = input.event.missionAcceptanceResume
  if (!resume) throw new Error("Mission acceptance resume has no exact Message source")
  return persistTaskRootIngressInTransaction(db, input.task, input.event, { messageID: resume.messageID }, input.now)
}

function materializeDueTaskWaitInTransaction(
  db: Database.TxOrDb,
  input: { task: Pick<TaskRow, "id" | "session_id">; executionEpoch: number; now: number },
): string | undefined {
  const wait = dueTaskWaitsInTransaction(db, {
    taskID: input.task.id,
    executionEpoch: input.executionEpoch,
    now: input.now,
  })[0]
  if (!wait) return undefined
  // A Task wait is already the immutable logical occurrence. Reusing that
  // identity for its one due Fire avoids a second derivation that SQLite could
  // not independently validate at the settlement boundary.
  const fireID = wait.id
  const ingressID = persistTaskRootIngressInTransaction(
    db,
    input.task,
    {
      note: `Task wait ${wait.id} became due`,
      taskWaitWake: { jobID: wait.id, fireID, dueAt: wait.due_at },
    },
    { waitJobID: wait.id },
    input.now,
  )
  settleTaskWaitForIngressInTransaction(db, {
    waitID: wait.id,
    ingressID,
    disposition: "due_ingress_accepted",
    now: input.now,
  })
  return ingressID
}

export function persistCoordinationIngressInTransaction(
  db: Database.TxOrDb,
  input: { taskID: string; rootSessionID: string; requestID: string; now?: number },
): string {
  const task = findTask(input.taskID)
  if (!task || task.session_id !== input.rootSessionID)
    throw new Error(`Coordination request ${input.requestID} has no exact Task root Session`)
  const ingressID = persistTaskRootIngressInTransaction(
    db,
    task,
    { coordinationRequest: { requestID: input.requestID } },
    { requestID: input.requestID },
    input.now ?? Date.now(),
  )
  // Callers persist this inside their own transaction and do not all request a
  // scan afterwards, which left an operator steer or a worker handoff waiting
  // for the heartbeat. The hint is idempotent, so signalling here is safe even
  // where the caller also signals.
  Database.effect(() => requestTaskControlScanInBackground(input.taskID, "engine.agent-coordination.request"))
  return ingressID
}

function eventForIngress(ingress: typeof EngineTaskRootIngressTable.$inferSelect): OrchestratorEvent {
  if (ingress.source === "inline") return OrchestratorEventSchema.parse(ingress.inline_payload)
  if (ingress.source === "task") {
    const task = Database.use((db) =>
      db
        .select({ id: EngineTaskTable.id })
        .from(EngineTaskTable)
        .where(eq(EngineTaskTable.id, ingress.source_id))
        .get(),
    )
    if (!task || task.id !== ingress.task_id)
      throw new TaskRootIngressIntegrityError(
        ingress.id,
        `Task-root ingress ${ingress.id} references missing Task creation ${ingress.source_id}`,
      )
    return OrchestratorEventSchema.parse({ taskCreation: { taskID: task.id } })
  }
  if (ingress.source === "engine_artifact") {
    const artifact = Database.use((db) =>
      db.select().from(EngineArtifactTable).where(eq(EngineArtifactTable.id, ingress.source_id)).get(),
    )
    if (!artifact || artifact.task_id !== ingress.task_id)
      throw new TaskRootIngressIntegrityError(
        ingress.id,
        `Task-root ingress ${ingress.id} references invalid Engine Artifact ${ingress.source_id}`,
      )
    if (artifact.kind === "agent_coordination_request")
      return OrchestratorEventSchema.parse({ coordinationRequest: { requestID: artifact.id } })
    if (artifact.kind === "task-infrastructure-error") {
      const payload = artifact.payload as {
        operation?: string
        reason?: string
        errorName?: string
        sessionID?: string
        context?: { dispatchID?: string }
      }
      const dispatchID = payload.context?.dispatchID
      if (!payload.operation || !payload.reason || !dispatchID)
        return OrchestratorEventSchema.parse({ processRecovery: { recoveryFactID: artifact.id } })
      return OrchestratorEventSchema.parse({
        dispatchInfrastructureFailure: {
          infrastructureFactID: artifact.id,
          outcome: DispatchOutcome.infrastructureFailure({
            operation: payload.operation,
            message: payload.reason,
            errorName: payload.errorName,
            sessionID: payload.sessionID,
            recoveryAuthority: resolveDispatchOccurrenceAuthority({ taskID: ingress.task_id, dispatchID }),
            infrastructureError: {
              source: "engine_artifact",
              artifact_id: artifact.id,
              catalog_revision: artifact.catalog_revision,
              expected_sha256: artifact.payload_sha256,
            },
          }),
        },
      })
    }
    return OrchestratorEventSchema.parse({ processRecovery: { recoveryFactID: artifact.id } })
  }
  if (ingress.source === "protocol_event") {
    const event = Database.use((db) =>
      db.select().from(ProtocolEventTable).where(eq(ProtocolEventTable.id, ingress.source_id)).get(),
    )
    if (!event)
      throw new TaskRootIngressIntegrityError(
        ingress.id,
        `Task-root ingress ${ingress.id} references missing Protocol Event ${ingress.source_id}`,
      )
    if (event.type === "agent.execution.lifecycle") {
      const payload = event.payload as Record<string, unknown>
      const sessionID = event.session_id
      const inputMessageID = typeof payload.inputMessageID === "string" ? payload.inputMessageID : undefined
      if (!sessionID || !inputMessageID) {
        throw new TaskRootIngressIntegrityError(
          ingress.id,
          `Agent lifecycle Protocol Event ${event.id} has no exact Session/input Message authority`,
        )
      }
      const descriptor = WorkerTurnDescriptor.findForMessageAuthority({ sessionID, inputMessageID })
      const dispatchID = descriptor?.payload.dispatchTurn?.current_dispatch_id
      if (!descriptor || descriptor.payload.lifecycle.taskID !== ingress.task_id || !dispatchID) {
        throw new TaskRootIngressIntegrityError(
          ingress.id,
          `Agent lifecycle Protocol Event ${event.id} has no exact Worker Turn dispatch authority`,
        )
      }
      return OrchestratorEventSchema.parse({
        note: `Agent lifecycle ${event.id}`,
        agentLifecycleDelivery: { eventID: event.id, sessionID, dispatchID },
      })
    }
    return OrchestratorEventSchema.parse({ note: `Protocol occurrence ${event.id}` })
  }
  const row = Database.use((db) =>
    db
      .select({ id: MessageTable.id, sessionID: MessageTable.session_id, data: MessageTable.data })
      .from(MessageTable)
      .where(eq(MessageTable.id, ingress.source_id))
      .get(),
  )
  if (!row)
    throw new TaskRootIngressIntegrityError(
      ingress.id,
      `Task-root ingress ${ingress.id} references missing Message ${ingress.source_id}`,
    )
  const message = Message.Info.parse({ ...row.data, id: row.id, sessionID: row.sessionID })
  if (message.role !== "user")
    throw new TaskRootIngressIntegrityError(
      ingress.id,
      `Task-root ingress ${ingress.id} source Message is not participant-authored input`,
    )
  const parsedProvenance = TaskRootMessageProvenance.safeParse(message.extra?.task_root_message)
  if (!parsedProvenance.success)
    throw new TaskRootIngressIntegrityError(
      ingress.id,
      `Task-root ingress ${ingress.id} source Message ${message.id} has no well-formed Task-root provenance`,
    )
  const provenance = parsedProvenance.data
  return OrchestratorEventSchema.parse({
    note: `Task-root Message ${message.id}`,
    rootMessage: {
      messageID: message.id,
      kind: provenance.kind,
      ...(provenance.schedulerDelivery ? { schedulerDelivery: provenance.schedulerDelivery } : {}),
    },
  })
}

function interactionFacts(
  db: Database.TxOrDb,
  ingress: typeof EngineTaskRootIngressTable.$inferSelect,
  assistantIDs: Set<string>,
): InteractionFact[] {
  const ingressID = ingress.id
  const rootSessionID = db
    .select({ sessionID: EngineTaskTable.session_id })
    .from(EngineTaskTable)
    .where(eq(EngineTaskTable.id, ingress.task_id))
    .get()?.sessionID
  return (
    db
      .select()
      .from(EngineInteractionRequestTable)
      // Direct rows carry the Task they gate. Source-owned rows (a Question, a
      // permission request) hold no Task by schema, and the orchestrator
      // `question` Tool arrives as one of those — but it always carries the
      // asking Session, and only rows asked from this Task's root Session tree
      // can name an assistant this evidence read accepts. Enumerating every
      // other Task's questions here made each reduction O(all interactions).
      .where(
        sql`${EngineInteractionRequestTable.task_id} = ${ingress.task_id} OR (${EngineInteractionRequestTable.task_id} IS NULL AND ${EngineInteractionRequestTable.session_id} IN (SELECT ${SessionTable.id} FROM ${SessionTable} WHERE ${SessionTable.parent_id} = ${rootSessionID ?? ""} OR ${SessionTable.id} = ${rootSessionID ?? ""}))`,
      )
      .all()
      .map((row) => projectInteractionRowInTransaction(db, row))
      .flatMap((row) => {
        const payload = row.payload as {
          tool?: { messageID?: string }
          expiry?: { timeExpires?: number }
          activity_reconciliation?: { ingress_id?: string; request_id?: string; assistant_message_id?: string }
        }
        const reconciliation = payload.activity_reconciliation
        const assistantMessageID =
          reconciliation?.ingress_id === ingressID ? reconciliation.assistant_message_id : payload.tool?.messageID
        if (!assistantMessageID || !assistantIDs.has(assistantMessageID)) return []
        return [
          {
            id: row.id,
            ingressID,
            assistantMessageID,
            ...(row.status === "pending" ? {} : { outcome: row.status as "answered" | "rejected" | "expired" }),
            ...(Number.isSafeInteger(payload.expiry?.timeExpires) ? { resumeAt: payload.expiry!.timeExpires } : {}),
            ...(reconciliation?.request_id ? { activityRequestID: reconciliation.request_id } : {}),
          },
        ]
      })
  )
}

/** Read canonical conversation/effect facts. Mutable transport rows are
 * interpreted only at their terminal immutable boundary; the Tool storage
 * normalization in the same cutover replaces the remaining transport shape. */
export const readTaskRootIngressEvidence: TaskRootIngressEvidenceReader = (db, ingress) => {
  const leaseIDs = db
    .select({ id: EngineControlActivationLeaseTable.id })
    .from(EngineControlActivationLeaseTable)
    .where(
      and(
        eq(EngineControlActivationLeaseTable.target, "task_root_ingress"),
        eq(EngineControlActivationLeaseTable.target_id, ingress.id),
      ),
    )
    .all()
    .map((row) => row.id)
  if (leaseIDs.length === 0)
    return {
      turns: [],
      decisions: [],
      decisionGaps: [],
      interactions: [],
      activityRequests: [],
      activityOutcomes: [],
    }
  const assistantRows = db
    .select()
    .from(MessageTable)
    .where(
      sql`json_extract(${MessageTable.data}, '$.activationID') IN (${sql.join(
        leaseIDs.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    )
    .orderBy(asc(MessageTable.time_created), asc(MessageTable.id))
    .all()
  const turns: AssistantTurnFact[] = []
  const decisions: DecisionFact[] = []
  const decisionGaps: DecisionGapFact[] = []
  const activityRequests: ActivityRequestFact[] = []
  const activityOutcomes: ActivityOutcomeFact[] = []
  const assistantIDs = new Set<string>()
  const activationAssistants = new Map<string, string>()
  const continuationAssistants = new Map<string, string>()
  const task = db
    .select({ sessionID: EngineTaskTable.session_id, projectID: EngineTaskTable.project_id })
    .from(EngineTaskTable)
    .where(eq(EngineTaskTable.id, ingress.task_id))
    .get()
  if (!task?.sessionID)
    throw new TaskRootIngressIntegrityError(ingress.id, `Task-root ingress ${ingress.id} has no root Session authority`)
  for (const row of assistantRows) {
    const parsedAssistant = Message.Assistant.safeParse({ ...row.data, id: row.id, sessionID: row.session_id })
    if (!parsedAssistant.success) {
      throw new TaskRootIngressIntegrityError(
        ingress.id,
        `Task-root assistant Message ${row.id} is not a well-formed assistant Message`,
      )
    }
    const assistant = parsedAssistant.data
    assistantIDs.add(assistant.id)
    if (!assistant.activationID) continue
    const priorAssistant = activationAssistants.get(assistant.activationID)
    const session = db
      .select({ parentID: SessionTable.parent_id, projectID: SessionTable.project_id, kind: SessionTable.kind })
      .from(SessionTable)
      .where(eq(SessionTable.id, row.session_id))
      .get()
    if (
      !session ||
      session.parentID !== task.sessionID ||
      session.projectID !== task.projectID ||
      session.kind !== "orchestrator" ||
      (priorAssistant && priorAssistant !== assistant.id)
    ) {
      throw new TaskRootIngressIntegrityError(
        ingress.id,
        `Task-root activation ${assistant.activationID} has conflicting assistant authority`,
      )
    }
    activationAssistants.set(assistant.activationID, assistant.id)
    const priorContinuationAssistant = continuationAssistants.get(assistant.parentID)
    if (priorContinuationAssistant && priorContinuationAssistant !== assistant.id) {
      throw new TaskRootIngressIntegrityError(
        ingress.id,
        `Task-root continuation ${assistant.parentID} has multiple assistant Messages`,
      )
    }
    continuationAssistants.set(assistant.parentID, assistant.id)
    const parent = db
      .select({ data: MessageTable.data, sessionID: MessageTable.session_id })
      .from(MessageTable)
      .where(eq(MessageTable.id, assistant.parentID))
      .get()
    const control = (
      parent?.data as
        | { extra?: { orchestrator_control_ingress?: { ingress_id?: unknown; predecessor_id?: unknown } } }
        | undefined
    )?.extra?.orchestrator_control_ingress
    if (
      parent?.sessionID !== row.session_id ||
      control?.ingress_id !== ingress.id ||
      typeof control.predecessor_id !== "string" ||
      orchestratorControlOccurrenceIdentity(ingress.id, control.predecessor_id).messageID !== assistant.parentID
    ) {
      throw new TaskRootIngressIntegrityError(
        ingress.id,
        `Assistant Message ${assistant.id} is outside ingress ${ingress.id} continuation chain`,
      )
    }
    const requests = db
      .select()
      .from(ToolPartRequestTable)
      .where(eq(ToolPartRequestTable.message_id, assistant.id))
      .orderBy(asc(ToolPartRequestTable.time_created), asc(ToolPartRequestTable.id))
      .all()
    const toolParts = requests.map((part) => projectToolPartInTransaction(db, part)!)
    for (const part of toolParts) {
      activityRequests.push({
        id: part.id,
        activationID: assistant.activationID,
        assistantMessageID: assistant.id,
        idempotency: "query_required",
      })
      const outcome = db
        .select()
        .from(ToolPartOutcomeTable)
        .where(eq(ToolPartOutcomeTable.request_part_id, part.id))
        .get()
      if (outcome) {
        activityOutcomes.push({
          id: outcome.id,
          requestID: part.id,
          outcome: outcome.data.outcome === "completed" ? "completed" : "failed",
        })
      }
      if (outcome?.data.outcome !== "completed" || !isOrchestratorDecisionToolName(part.tool)) continue
      const effect = orchestratorDecisionToolCompletionEffect({ tool: part.tool, stateInput: part.state.input })
      if (effect === "satisfies_current_epoch" || effect === "inspect_dispatch_outcome") {
        decisions.push({ id: part.id, assistantMessageID: assistant.id, command: part.tool })
      }
    }
    const stepFinishRows = db
      .select({ id: PartTable.id, data: PartTable.data })
      .from(PartTable)
      .where(eq(PartTable.message_id, assistant.id))
      .orderBy(asc(PartTable.time_created), asc(PartTable.id))
      .all()
    for (const step of stepFinishRows) {
      const data = step.data as { type?: unknown; reason?: unknown }
      if (data.type !== "step-finish" || typeof data.reason !== "string") continue
      if (data.reason === "tool-calls") continue
      decisionGaps.push({
        id: step.id,
        activationID: assistant.activationID,
        assistantMessageID: assistant.id,
      })
    }
    if (!assistant.time.completed) continue
    const predecessorID = control.predecessor_id
    const outstanding = toolParts.some((part) => part.state.status === "running")
    const boundary: AssistantTurnFact["boundary"] = assistant.error
      ? "provider_error"
      : assistant.finish?.includes("tool") || outstanding
        ? "tool_calls"
        : "final"
    turns.push({
      id: assistant.id,
      activationID: assistant.activationID,
      predecessorID,
      timeCompleted: assistant.time.completed,
      boundary,
    })
  }
  if (assistantIDs.size > 0) {
    const providerRequests = db
      .select()
      .from(ProviderActivityRequestTable)
      .where(inArray(ProviderActivityRequestTable.assistant_message_id, [...assistantIDs]))
      .all()
    for (const request of providerRequests) {
      activityRequests.push({
        id: request.id,
        activationID: Message.Assistant.parse({
          ...assistantRows.find((row) => row.id === request.assistant_message_id)!.data,
          id: request.assistant_message_id,
          sessionID: assistantRows.find((row) => row.id === request.assistant_message_id)!.session_id,
        }).activationID!,
        assistantMessageID: request.assistant_message_id,
        idempotency: "query_required",
      })
      const outcome = db
        .select()
        .from(ProviderActivityOutcomeTable)
        .where(eq(ProviderActivityOutcomeTable.request_id, request.id))
        .get()
      if (outcome) {
        activityOutcomes.push({
          id: outcome.id,
          requestID: request.id,
          outcome: outcome.data.outcome === "done" ? "completed" : "failed",
        })
      }
    }
  }
  const interactions = interactionFacts(db, ingress, assistantIDs)
  for (const interaction of interactions) {
    if (interaction.activityRequestID && interaction.outcome === "answered") {
      activityOutcomes.push({
        id: interaction.id,
        requestID: interaction.activityRequestID,
        outcome: "reconciled_unknown",
      })
    }
  }
  return { turns, decisions, decisionGaps, interactions, activityRequests, activityOutcomes }
}

function ensureActivityReconciliationInteractions(
  taskID: string,
  ingressID: string,
  requestIDs: readonly string[],
  now: number,
): number {
  return Database.immediateTransaction((db) => {
    const task = db
      .select({ sessionID: EngineTaskTable.session_id })
      .from(EngineTaskTable)
      .where(eq(EngineTaskTable.id, taskID))
      .get()
    if (!task?.sessionID) throw new Error(`Task ${taskID} has no root Session for activity reconciliation`)
    let created = 0
    for (const requestID of requestIDs) {
      const externalID = `task-root-activity-reconciliation-v1:${requestID}`
      const existing = db
        .select({ id: EngineInteractionRequestTable.id })
        .from(EngineInteractionRequestTable)
        .where(eq(EngineInteractionRequestTable.external_id, externalID))
        .get()
      if (existing) continue
      const tool = db
        .select({ assistantMessageID: ToolPartRequestTable.message_id })
        .from(ToolPartRequestTable)
        .where(eq(ToolPartRequestTable.id, requestID))
        .get()
      const provider = db
        .select({ assistantMessageID: ProviderActivityRequestTable.assistant_message_id })
        .from(ProviderActivityRequestTable)
        .where(eq(ProviderActivityRequestTable.id, requestID))
        .get()
      if (Boolean(tool) === Boolean(provider)) {
        throw new Error(`Task-root activity request ${requestID} has ambiguous or missing canonical storage`)
      }
      const assistantMessageID = tool?.assistantMessageID ?? provider!.assistantMessageID
      insertEngineInteractionRequest(db, {
        taskID,
        sessionID: task.sessionID,
        externalID,
        requestType: "question",
        title: "外部操作结果待确认",
        body: `外部操作 ${requestID} 已发出，但进程在结果收据落盘前中断。系统不会自动重放；确认后将以“结果未知”继续。`,
        payload: {
          activity_reconciliation: {
            ingress_id: ingressID,
            request_id: requestID,
            assistant_message_id: assistantMessageID,
          },
          questions: [
            {
              header: "结果确认",
              question: "是否确认该外部操作的最终结果无法从权威来源确定，并允许会话以“结果未知”继续？",
              options: [
                {
                  value: "acknowledge_unknown",
                  label: "确认结果未知",
                  description: "不会重放外部操作；保留未知结果事实并继续决策。",
                },
              ],
            },
          ],
        },
        eventSource: "task-control.activity-reconciliation",
        eventSummary: "External activity outcome requires operator reconciliation",
        timeCreated: now,
      })
      created += 1
    }
    return created
  })
}

function predecessorFor(
  projection: TaskRootIngressProjection,
  ingressID: string,
  evidence: TaskRootIngressEvidence,
): string {
  if (projection.state !== "ready") return ingressID
  return (
    evidence.turns.toSorted((a, b) => b.timeCompleted - a.timeCompleted || b.id.localeCompare(a.id))[0]?.id ?? ingressID
  )
}

function evidenceFor(ingressID: string): TaskRootIngressEvidence {
  return Database.use((db) => {
    const ingress = db
      .select()
      .from(EngineTaskRootIngressTable)
      .where(eq(EngineTaskRootIngressTable.id, ingressID))
      .get()
    if (!ingress) throw new Error(`Task-root ingress not found: ${ingressID}`)
    return readTaskRootIngressEvidence(db, ingress)
  })
}

/** Terminalize exact assistants abandoned behind expired Task-root leases
 * before reduction chooses exhaustion or a successor activation. This is
 * physical crash recovery only; it never starts a Provider step. */
async function terminalizeExpiredTaskRootAssistants(ingressID: string, now: number): Promise<number> {
  const candidates = Database.use((db) => {
    const ingress = db
      .select()
      .from(EngineTaskRootIngressTable)
      .where(eq(EngineTaskRootIngressTable.id, ingressID))
      .get()
    if (!ingress) throw new Error(`Task-root ingress not found: ${ingressID}`)
    const expiredLeases = db
      .select({ id: EngineControlActivationLeaseTable.id, expiresAt: EngineControlActivationLeaseTable.expires_at })
      .from(EngineControlActivationLeaseTable)
      .where(
        and(
          eq(EngineControlActivationLeaseTable.target, "task_root_ingress"),
          eq(EngineControlActivationLeaseTable.target_id, ingressID),
          sql`${EngineControlActivationLeaseTable.expires_at} <= ${now}`,
        ),
      )
      .all()
    const expiredByID = new Map(expiredLeases.map((lease) => [lease.id, lease.expiresAt]))
    if (expiredLeases.length === 0) return []
    return db
      .select({ id: MessageTable.id, sessionID: MessageTable.session_id, data: MessageTable.data })
      .from(MessageTable)
      .where(
        sql`json_extract(${MessageTable.data}, '$.activationID') IN (${sql.join(
          expiredLeases.map((lease) => sql`${lease.id}`),
          sql`, `,
        )})`,
      )
      .all()
      .flatMap((row) => {
        const assistant = Message.Assistant.parse({ ...row.data, id: row.id, sessionID: row.sessionID })
        if (assistant.time.completed !== undefined || !assistant.activationID) return []
        const completedAt = expiredByID.get(assistant.activationID)
        if (completedAt === undefined) {
          throw new TaskRootIngressIntegrityError(
            ingressID,
            `Expired Task-root assistant ${assistant.id} has no matching activation lease`,
          )
        }
        return [{ sessionID: row.sessionID, messageID: row.id, completedAt }]
      })
  })
  if (candidates.length === 0) return 0
  const bySession = new Map<string, typeof candidates>()
  for (const candidate of candidates) {
    bySession.set(candidate.sessionID, [...(bySession.get(candidate.sessionID) ?? []), candidate])
  }
  const { SessionLoop } = await import("@/session/loop")
  let terminalized = 0
  for (const [sessionID, messages] of bySession) {
    if (
      await SessionLoop.terminalizeRecoveredIncompleteAssistant(
        sessionID,
        undefined,
        messages.map((message) => ({ messageID: message.messageID, completedAt: message.completedAt })),
      )
    ) {
      terminalized += messages.length
    }
  }
  return terminalized
}

type ActivationAttempt =
  | { activated: true }
  /** The exact projection that refused activation, for wake-instant pacing. */
  | { activated: false; projection: TaskRootIngressProjection }

async function activate(input: {
  taskID: string
  ingressID: string
  runWithActivationOwner?: <T>(run: () => Promise<T>) => Promise<T>
}): Promise<ActivationAttempt> {
  let reservation: RuntimeExecutionReservation | undefined
  let bound = false
  reservation = RuntimeExecutionSettlement.reserve(
    "task_control_activation",
    `task-control:${input.taskID}:${input.ingressID}`,
  )
  try {
    const now = Date.now()
    const projection = projectTaskRootIngress(input.ingressID, now, readTaskRootIngressEvidence)
    if (projection.state !== "ready") {
      reservation.settle()
      return { activated: false, projection }
    }
    // Everything derived from immutable sources is computed before the lease
    // is taken. An integrity violation here is a durable `host_fault` value,
    // and reaching it after acquisition would burn one of only 4 activations
    // per ingress on every heartbeat.
    const faulted: ActivationAttempt = {
      activated: false,
      projection: { state: "host_fault", reason: "evidence_violation" },
    }
    let evidence: TaskRootIngressEvidence
    let event: OrchestratorEvent
    const ingress = Database.use((db) =>
      db.select().from(EngineTaskRootIngressTable).where(eq(EngineTaskRootIngressTable.id, input.ingressID)).get(),
    )!
    try {
      evidence = evidenceFor(input.ingressID)
      event = eventForIngress(ingress)
    } catch (error) {
      if (!(error instanceof TaskRootIngressIntegrityError)) throw error
      reservation.settle()
      return faulted
    }
    const ownerID = ownerOccurrenceID()
    const liveness = driverState().liveness
    const acquired = acquireTaskRootIngressLease({
      ingressID: input.ingressID,
      ownerOccurrenceID: ownerID,
      now,
      leaseMilliseconds,
      readEvidence: readTaskRootIngressEvidence,
      assertControlOwnerInTransaction: (db) => liveness.assertOwnedInTransaction(db, ownerID, Date.now()),
    })
    if (!acquired.acquired) {
      reservation.settle()
      // The acquisition transaction reread the facts; its projection is newer
      // than the one this caller reduced, so pacing must use it. A stale
      // `ready` would arm no timer at all and strand the Task.
      return { activated: false, projection: acquired.projection }
    }
    const runActivation = () =>
      runner()({
        taskID: input.taskID,
        event,
        signal: reservation.signal,
        wakeID: ingress.id,
        activationID: acquired.activationID,
        predecessorID: predecessorFor(projection, ingress.id, evidence),
      })
    const operation = input.runWithActivationOwner ? input.runWithActivationOwner(runActivation) : runActivation()
    reservation.settleWith(operation)
    bound = true
    let renewalFailure: unknown
    // Every durable append re-asserts this activation against its lease, so a
    // renewal that fails cannot corrupt anything — it only risks losing the
    // activation at expiry. A transient fault (SQLITE_BUSY, a momentarily
    // unavailable database) is therefore retried on the next tick while the
    // current lease still leaves room for one, instead of destroying a live
    // Provider Turn and burning a semantic attempt against a budget of 3.
    let currentExpiry = acquired.expiresAt
    const renewal = setInterval(() => {
      const renewalNow = Date.now()
      try {
        renewTaskRootIngressLease({
          ingressID: ingress.id,
          activationID: acquired.activationID,
          ownerOccurrenceID: ownerID,
          now: renewalNow,
          expiresAt: renewalNow + leaseMilliseconds,
        })
        currentExpiry = renewalNow + leaseMilliseconds
      } catch (error) {
        if (renewalNow + leaseRenewalMilliseconds < currentExpiry) {
          log.warn("Task-root lease renewal failed; retrying before expiry", {
            taskID: input.taskID,
            ingressID: ingress.id,
            activationID: acquired.activationID,
            expiresAt: currentExpiry,
            error,
          })
          return
        }
        renewalFailure = error
        reservation?.cancel(error)
      }
    }, leaseRenewalMilliseconds)
    ;(renewal as { unref?: () => void }).unref?.()
    try {
      await operation
    } finally {
      clearInterval(renewal)
    }
    if (renewalFailure) throw renewalFailure
    return { activated: true }
  } catch (error) {
    if (!bound) reservation.settle()
    throw error
  }
}

function currentProjectOwnsTask(taskID: string): boolean {
  return Database.use((db) => {
    const task = db
      .select({ id: EngineTaskTable.id })
      .from(EngineTaskTable)
      .where(and(eq(EngineTaskTable.project_id, Instance.project.id), eq(EngineTaskTable.id, taskID)))
      .get()
    return Boolean(task && !taskDeletedInTransaction(db, task.id))
  })
}

/**
 * Tasks a level-triggered sweep must cover: those whose lifecycle can still
 * enable an ingress.
 *
 * That is not only the open ones. A terminal Task absorbs ordinary ingress,
 * but acceptance deliberately keeps admitting `operator_message` and
 * `coordination_request` there — the post-completion conversation — and those
 * rely on the same wake edges as everything else. A terminal Task with an
 * ingress accepted at-or-after its terminal instant therefore stays in the
 * sweep until an immutable release proof exists; excluding it earlier is the
 * exact lost-wake class the sweep exists to close. The same indexed candidate
 * frontier serves terminal eligibility and execution, including after restart.
 */
const PROJECT_SOURCE_FRONTIER_PAGE_SIZE = 8
const PROJECT_MAXIMUM_CONCURRENT_SCANS = 4
const PROJECT_MAXIMUM_PENDING_SCANS = PROJECT_SOURCE_FRONTIER_PAGE_SIZE * 4 - PROJECT_MAXIMUM_CONCURRENT_SCANS

function currentProjectFrontierSlice(cursor?: TaskControlProjectFrontierCursor) {
  return Database.use((db) =>
    taskControlProjectFrontierSliceInTransaction(db, {
      projectID: Instance.project.id,
      ...(cursor ? { cursor } : {}),
      perSourceLimit: PROJECT_SOURCE_FRONTIER_PAGE_SIZE,
    }),
  )
}

/**
 * Make a settled rest state visible.
 *
 * `host_fault` and `exhausted` are legal places for one ingress to stop, and
 * neither can be left by a timer or a fact append. Both release the Task's
 * FIFO, so the Task keeps making progress and this artifact is the only trace
 * the abandoned ingress leaves — an unsurfaced settlement is indistinguishable
 * from silently dropping the input. One deterministic artifact per
 * (ingress, state, reason) stays idempotent across the heartbeat's repeated
 * observations.
 */
function surfaceOperatorGatedTaskRootIngress(input: {
  taskID: string
  ingressID: string
  projection: TaskRootIngressProjection
  now: number
}): boolean {
  const reason =
    input.projection.state === "host_fault" || input.projection.state === "exhausted"
      ? input.projection.reason
      : "unknown"
  try {
    if (input.projection.state !== "host_fault" && input.projection.state !== "exhausted") return false
    recordAbsorbingTaskRootIngressDisposition({
      taskID: input.taskID,
      ingressID: input.ingressID,
      expected: input.projection,
      now: input.now,
    })
    return true
  } catch (error) {
    // Surfacing is an observability obligation, not a scheduling one. Losing
    // it must not convert a resting Task into a faulting one.
    log.error("Could not surface an operator-gated Task-root ingress", {
      taskID: input.taskID,
      ingressID: input.ingressID,
      error,
    })
    return false
  }
}

function taskRootIngressOperatorGateID(ingressID: string, state: string, reason: string): string {
  return Identifier.deterministic("artifact", `task-control-operator-gate-v2\0${ingressID}\0${state}\0${reason}`)
}

/** Persist only reducer verdicts whose named evidence can never be undone. */
function exactTaskRootDecisionOccurrenceInTransaction(
  db: Database.TxOrDb,
  input: { ingressID: string; decisionIDs: readonly string[] },
): TaskRootDecisionOccurrence {
  const requests = db
    .select({ id: ToolPartRequestTable.id, assistantMessageID: ToolPartRequestTable.message_id })
    .from(ToolPartRequestTable)
    .where(inArray(ToolPartRequestTable.id, [...input.decisionIDs]))
    .all()
  if (
    requests.length !== input.decisionIDs.length ||
    new Set(requests.map((row) => row.assistantMessageID)).size !== 1
  ) {
    throw new Error(`Task-root ingress ${input.ingressID} decisions do not share one exact assistant occurrence`)
  }
  const assistantRow = db
    .select({ id: MessageTable.id, sessionID: MessageTable.session_id, data: MessageTable.data })
    .from(MessageTable)
    .where(eq(MessageTable.id, requests[0]!.assistantMessageID))
    .get()
  if (!assistantRow) throw new Error(`Task-root ingress ${input.ingressID} decision assistant is missing`)
  const assistant = Message.Assistant.parse({
    ...assistantRow.data,
    id: assistantRow.id,
    sessionID: assistantRow.sessionID,
  })
  if (assistant.author !== "orchestrator" || !assistant.activationID) {
    throw new Error(`Task-root ingress ${input.ingressID} decision assistant has no Orchestrator activation authority`)
  }
  const controlRow = db
    .select({ id: MessageTable.id, sessionID: MessageTable.session_id, data: MessageTable.data })
    .from(MessageTable)
    .where(eq(MessageTable.id, assistant.parentID))
    .get()
  if (!controlRow || controlRow.sessionID !== assistant.sessionID) {
    throw new Error(`Task-root ingress ${input.ingressID} decision control Message is missing or outside its Session`)
  }
  const control = Message.User.parse({ ...controlRow.data, id: controlRow.id, sessionID: controlRow.sessionID })
  const lineage = control.extra?.orchestrator_control_ingress as
    | { ingress_id?: unknown; predecessor_id?: unknown }
    | undefined
  if (
    control.author !== "orchestrator" ||
    control.agent !== "orchestrator" ||
    lineage?.ingress_id !== input.ingressID ||
    typeof lineage.predecessor_id !== "string" ||
    orchestratorControlOccurrenceIdentity(input.ingressID, lineage.predecessor_id).messageID !== control.id
  ) {
    throw new Error(`Task-root ingress ${input.ingressID} decision control lineage is invalid`)
  }
  return {
    assistant_message_id: assistant.id,
    control_message_id: control.id,
    predecessor_id: lineage.predecessor_id,
    activation_id: assistant.activationID,
  }
}

function taskRootLifecycleDispositionEvidence(input: {
  lifecycle: readonly TaskLifecycleFact[]
  boundary: "deleted" | "reopened" | "cancelled" | "closed"
  executionEpoch: number
  timeAccepted: number
}): TaskLifecycleFact | undefined {
  return input.lifecycle
    .filter((fact) => {
      if (input.boundary === "deleted") return fact.kind === "deleted" && fact.time >= input.timeAccepted
      if (input.boundary === "reopened") {
        return (fact.kind === "opened" || fact.kind === "reopened") && fact.epoch > input.executionEpoch
      }
      if (fact.epoch !== input.executionEpoch || fact.time < input.timeAccepted) return false
      return input.boundary === "cancelled" ? fact.kind === "cancelled" : fact.kind === "closed"
    })
    .toSorted(
      (left, right) =>
        left.sequence - right.sequence ||
        compareCanonicalStrings(left.id, right.id),
    )[0]
}

function recordAbsorbingTaskRootIngressDisposition(input: {
  taskID: string
  ingressID: string
  expected: Extract<
    TaskRootIngressProjection,
    { state: "resolved" | "terminal_inapplicable" | "exhausted" | "host_fault" }
  >
  now: number
}): void {
  Database.immediateTransaction((db) => {
    const facts = taskRootIngressFactsInTransaction(db, input.ingressID, readTaskRootIngressEvidence)
    const current = reduceTaskRootIngressFacts(facts, input.now)
    if (current.state !== input.expected.state) {
      throw new Error(
        `Task-root ingress ${input.ingressID} disposition raced from ${input.expected.state} to ${current.state}`,
      )
    }
    let evidenceIDs: string[]
    let decisionOccurrence: TaskRootDecisionOccurrence | undefined
    if (current.state === "resolved") {
      evidenceIDs = [...current.decisionIDs]
      decisionOccurrence = exactTaskRootDecisionOccurrenceInTransaction(db, {
        ingressID: input.ingressID,
        decisionIDs: evidenceIDs,
      })
    } else if (current.state === "exhausted" || current.state === "host_fault") {
      const gateID = taskRootIngressOperatorGateID(input.ingressID, current.state, current.reason)
      const exit =
        current.state === "host_fault"
          ? `Exit: later ingresses continue only after this abandonment receipt commits; repair the Host invariant ` +
            `it names, then send a new operator message to redo this work.`
          : `Exit: later ingresses continue past it; send a new operator message to redo the abandoned work, ` +
            `or retry the Task for a fresh budget.`
      const gateInput = {
        id: gateID,
        taskID: input.taskID,
        component: "task-control",
        operation: "surface-operator-gated-ingress",
        reason:
          `Task-root ingress ${input.ingressID} rests in ${current.state} (${current.reason}); ` +
          `automatic scheduling cannot resume it. ${exit}`,
        context: { ingressID: input.ingressID, state: current.state, gateReason: current.reason },
        now: input.now,
      }
      operatorGateWriterForTest?.(gateInput)
      recordTaskInfrastructureErrorInTransaction(db, gateInput)
      evidenceIDs = [gateID]
    } else {
      const lifecycle = taskRootLifecycleDispositionEvidence({
        lifecycle: facts.lifecycle,
        boundary: current.boundary,
        executionEpoch: facts.ingress.executionEpoch,
        timeAccepted: facts.ingress.timeAccepted,
      })
      if (!lifecycle) {
        throw new Error(
          `Task-root ingress ${input.ingressID} has no exact ${current.boundary} lifecycle disposition evidence`,
        )
      }
      evidenceIDs = [lifecycle.id]
    }
    const common = {
      taskID: input.taskID,
      ingressID: input.ingressID,
      executionEpoch: facts.ingress.executionEpoch,
      evidenceIDs,
      now: input.now,
    }
    if (current.state === "resolved") {
      recordTaskRootIngressDispositionInTransaction(db, {
        ...common,
        disposition: "resolved",
        decisionOccurrence: decisionOccurrence!,
      })
    } else {
      recordTaskRootIngressDispositionInTransaction(db, {
        ...common,
        disposition: current.state === "host_fault" ? "operator_abandoned" : current.state,
      })
    }
  })
}

/**
 * Name a lifecycle boundary this runtime cannot converge.
 *
 * `cancelling` is non-absorbing by design: an owner is expected to finish it.
 * When no converger is wired for the boundary, the periodic wake degenerates
 * into a silent poll — progress-free, log-free, invisible. The deterministic
 * artifact turns that into a durable operator-visible fact; repeated
 * observation reuses it.
 */
function surfaceUnconvergedTaskBoundary(input: {
  taskID: string
  epoch: number
  status: "cancelling"
  now: number
}): void {
  try {
    recordTaskInfrastructureError({
      id: Identifier.deterministic(
        "artifact",
        `task-control-unconverged-boundary-v1\0${input.taskID}\0${input.epoch}\0${input.status}`,
      ),
      taskID: input.taskID,
      component: "task-control",
      operation: "surface-unconverged-boundary",
      reason:
        `Task epoch ${input.epoch} rests in ${input.status} with no converger available in this runtime; ` +
        `the control plane re-checks periodically but cannot finish the boundary itself. ` +
        `Exit: complete the cancellation from the Task API, ` +
        `or retry the Task to supersede this epoch.`,
      context: { epoch: input.epoch, status: input.status },
      now: input.now,
    })
  } catch (error) {
    log.error("Could not surface an unconverged Task boundary", {
      taskID: input.taskID,
      status: input.status,
      error,
    })
  }
}

/**
 * Settle dispatches whose delivery owner no longer exists.
 *
 * A dispatch decision resolves its ingress the moment the worker is accepted;
 * from then on the only thing that can wake the Orchestrator is the owner's
 * in-process completion callback. If that owner dies — crash, kill, OOM — the
 * Task holds an empty ready set, no lease, and no timer: a stall no ingress
 * projection can express, because the missing fact is the worker's outcome.
 *
 * Only descriptor-backed accepted workers enter this reconciler. Within that
 * durable boundary two cases are provable:
 *
 *   1. the worker reached a terminal lifecycle but its delivery was lost — the
 *      outcome exists, so replaying delivery is idempotent gap-closing;
 *   2. the accepted worker has no terminal lifecycle and its exact process
 *      owner is dead — the run is abandoned, so its interruption is recorded
 *      as an infrastructure outcome and handed back to the Orchestrator.
 *
 * A lineage without its exact Worker Turn descriptor is only a write-ahead
 * admission request. Its dispatch_admission lease/takeover loop is the sole
 * recovery authority and this reconciler never terminalizes it.
 *
 * Liveness of the owner is decided from durable evidence, never from this
 * process's memory: a peer backend sharing this database owns dispatches whose
 * pipelines are absent from every local registry here, and settling those would
 * terminalize live workers on each sweep. Local registries remain as a fast
 * path for this process's own lineages.
 */
async function reconcileAbandonedDispatches(
  taskID: string,
): Promise<{ recovered: number; hasMore: boolean; wakeAt?: number; retryRequired: boolean }> {
  const pageSize = 32
  const cursors = runtimeState().dispatchRecoveryCursors
  const physicalConnectionEpoch = Database.physicalConnectionEpoch()
  const prior = cursors.get(taskID)
  const traversal = prior?.after.connectionEpoch === physicalConnectionEpoch ? prior : undefined
  const after = traversal?.after
  let recovered = 0
  let wakeAt = traversal?.wakeAt
  let retryRequired = traversal?.retryRequired ?? false
  const page = Database.use((db) =>
    unresolvedDispatchRecoveryPageInTransaction(db, {
      taskID,
      ...(after ? { after } : {}),
      limit: pageSize,
    }),
  )
  for (const lineage of page.lineages) {
    const childSessionID = lineage.payload.child_session_id
    const ownerWakeAt = await dispatchDeliveryOwnerLiveUntil(lineage, Date.now())
    if (ownerWakeAt !== undefined) {
      wakeAt = wakeAt === undefined ? ownerWakeAt : Math.min(wakeAt, ownerWakeAt)
      continue
    }
    try {
      if (findDispatchSettlementByDispatchID({ taskID, dispatchID: lineage.dispatchID })) {
        recovered += await recoverSettledUndeliveredDispatch({ taskID, lineage })
        continue
      }
      const delivery = await reconcileTerminalAgentLifecycleDelivery({
        taskID,
        sessionID: childSessionID,
        dispatchID: lineage.dispatchID,
      })
      if (delivery === "delivered") {
        recovered += 1
        continue
      }
      if (
        delivery === "collection_pending" ||
        delivery === "suppressed_budget_exhausted" ||
        delivery === "already_delivered"
      )
        continue
      const collection = collectionDeliveryPlan({ taskID, sessionID: childSessionID, dispatchID: lineage.dispatchID })
      if (collection.kind === "delivered") continue
      if (collection.kind === "ready") {
        const collectionDelivery = await deliverReadyCollection({
          taskID,
          sessionID: childSessionID,
          dispatchID: lineage.dispatchID,
          source: collection.source,
          event: collection.event,
        })
        if (collectionDelivery === "delivered") recovered += 1
        continue
      }
      if (await settleAbandonedDispatch({ taskID, lineage })) recovered += 1
    } catch (error) {
      // One unrecoverable dispatch must not stop the sweep: its siblings and
      // the rest of this Task's frontier are independent. The traversal keeps
      // one retry obligation; after its final page the driver backoff starts a
      // fresh descriptor pass, where completed siblings filter out and only
      // the still-undelivered occurrence replays.
      retryRequired = true
      log.error("abandoned dispatch reconciliation failed", {
        taskID,
        dispatchID: lineage.dispatchID,
        sessionID: childSessionID,
        error,
      })
    }
  }
  if (page.next) {
    cursors.set(taskID, {
      after: page.next,
      ...(wakeAt === undefined ? {} : { wakeAt }),
      ...(retryRequired ? { retryRequired: true } : {}),
    })
  }
  else cursors.delete(taskID)
  return {
    recovered,
    hasMore: page.next !== undefined,
    ...(wakeAt === undefined ? {} : { wakeAt }),
    retryRequired,
  }
}

/**
 * Close the gap between a dispatch's settlement and its delivery.
 *
 * The outcome is recorded before it is handed to the Orchestrator, so a failure
 * in between leaves a dispatch that is settled — invisible to abandonment
 * recovery, which by definition looks for unsettled work — yet never woke
 * anything. Every ingress reduces to `resolved`, no timer is owed, and the Task
 * rests forever with a database that looks entirely healthy. This is the only
 * sweep that can observe that state.
 */
async function recoverSettledUndeliveredDispatch(input: {
  taskID: string
  lineage: {
    artifactID: string
    dispatchID: string
    payload: {
      child_session_id: string
      delivery_owner: { kind: "runtime_process"; process_occurrence_id: string }
    }
  }
}): Promise<number> {
  const result = await reconcileSettledDispatchDelivery({
    taskID: input.taskID,
    sessionID: input.lineage.payload.child_session_id,
    dispatchID: input.lineage.dispatchID,
  })
  if (result !== "delivered") return 0
  const settlement = findDispatchSettlementByDispatchID({
    taskID: input.taskID,
    dispatchID: input.lineage.dispatchID,
  })
  log.warn("recovered a settled dispatch that never reached the Orchestrator", {
    taskID: input.taskID,
    dispatchID: input.lineage.dispatchID,
    settlementArtifactID: settlement?.artifactID,
  })
  return 1
}

/**
 * Whether the process responsible for delivering this dispatch still exists.
 *
 * The order matters. This process's own registries are authoritative for its
 * own lineages and answer without a query. For a lineage another process
 * claimed, only that process's liveness lease can answer — its absence from
 * local memory means nothing. Every current lineage has one runtime process
 * owner; predecessor owner shapes belong to an incompatible database epoch.
 */
async function dispatchDeliveryOwnerLiveUntil(
  lineage: {
    artifactID: string
    payload: {
      child_session_id: string
      delivery_owner: { kind: "runtime_process"; process_occurrence_id: string }
    }
  },
  now: number,
): Promise<number | undefined> {
  const { hasLiveDetachedDispatchPipeline } = await import("@/orchestrator/dispatch-agent-tool")
  const { SessionPrompt } = await import("@/session/prompt")
  const deliveryOwner = lineage.payload.delivery_owner
  const processExpiry = (occurrenceID: string) => {
    const lease = currentControlLease("runtime_process", occurrenceID)
    return lease && lease.expires_at > now ? lease.expires_at : undefined
  }
  if (hasLiveDetachedDispatchPipeline(lineage.artifactID)) {
    return processExpiry(deliveryOwner.process_occurrence_id) ?? now + 25
  }
  if (SessionPrompt.hasGeneration(lineage.payload.child_session_id)) {
    return processExpiry(deliveryOwner.process_occurrence_id) ?? now + 25
  }
  const acceptedAdmission = currentControlLease("dispatch_admission", lineage.artifactID)
  if (acceptedAdmission) {
    const owner = acceptedAdmission.owner_occurrence_id
    if (owner === ownerOccurrenceID()) return undefined
    return processExpiry(owner)
  }
  const owner = deliveryOwner.process_occurrence_id
  // This process claimed it and neither registry holds it: the work is gone,
  // and our own memory is the authority on that.
  if (owner === ownerOccurrenceID()) return undefined
  return processExpiry(owner)
}

async function recordAbandonedDispatchSettlement(input: {
  taskID: string
  lineage: { artifactID: string; dispatchID: string; payload: { child_session_id: string; target_agent_id: string } }
}): Promise<DispatchSettlementRow> {
  const childSessionID = input.lineage.payload.child_session_id
  const { SessionLoop } = await import("@/session/loop")
  await SessionLoop.terminalizeRecoveredIncompleteAssistant(childSessionID)
  const reason =
    `Worker Session ${childSessionID} for dispatch ${input.lineage.dispatchID} lost its delivery owner ` +
    `before any terminal lifecycle was recorded`
  const infrastructureFactID = recordTaskInfrastructureError({
    // Deterministic in the dispatch it recovers: a crash between this
    // settlement and its ingress replays to the same artifact, which the
    // ingress source index then dedupes. A fresh id each time would mint a
    // second wake carrying a second full retry budget.
    id: Identifier.deterministic("artifact", `abandoned-dispatch-v1\0${input.taskID}\0${input.lineage.dispatchID}`),
    taskID: input.taskID,
    component: "dispatch-agent",
    operation: "recover-abandoned-dispatch",
    reason,
    errorName: "AbandonedDispatchError",
    sessionID: childSessionID,
    context: { target: input.lineage.payload.target_agent_id, dispatchID: input.lineage.dispatchID },
    now: Date.now(),
  })
  const outcome = DispatchOutcome.infrastructureFailure({
    operation: "recover-abandoned-dispatch",
    message: reason,
    errorName: "AbandonedDispatchError",
    sessionID: childSessionID,
    recoveryAuthority: resolveDispatchOccurrenceAuthority({
      taskID: input.taskID,
      dispatchID: input.lineage.dispatchID,
    }),
    infrastructureError: exactEngineArtifactLocator({
      taskID: input.taskID,
      artifactID: infrastructureFactID,
    }),
  })
  if (outcome.kind !== "infrastructure_failure") {
    throw new Error("Abandoned dispatch recovery constructed a non-infrastructure outcome")
  }
  return settleDispatchOrReturnExisting({ taskID: input.taskID, dispatchID: input.lineage.dispatchID, outcome })
}

/** Record the interruption of one abandoned worker as its durable outcome and
 * hand it back to the Orchestrator as an ordinary accepted ingress. */
async function settleAbandonedDispatch(input: {
  taskID: string
  lineage: {
    artifactID: string
    dispatchID: string
    payload: {
      child_session_id: string
      target_agent_id: string
      delivery_owner: { kind: "runtime_process"; process_occurrence_id: string }
    }
  }
}): Promise<boolean> {
  await recordAbandonedDispatchSettlement(input)
  return (await recoverSettledUndeliveredDispatch(input)) > 0
}

/**
 * Bound on ingress steps inside one scan. Every `continue` below must be
 * justified by a strictly decreasing well-founded measure — an abandoned
 * assistant terminalized, a reconciliation Interaction created, an activation
 * consumed against its immutable budget. The bound is a guard against a
 * measure that stops decreasing: exceeding it paces the Task on a timer
 * instead of spinning the reconciler hot.
 */
const MAX_INGRESS_STEPS_PER_SCAN = 32

/**
 * One pass of the project-partitioned recovery/activation algorithm for one
 * Task. The epoch ingress list is re-read on every pass, so an ingress
 * accepted while this Task was blocked in a long activation is visible to the
 * next pass; the driver guarantees that pass exists.
 */
async function scanTaskControlPlane(
  taskID: string,
  context: TaskControlScanContext = { pass: 0 },
): Promise<TaskControlScanResult> {
  if (!currentProjectOwnsTask(taskID)) {
    // Task retention is also the lifetime boundary of its process-local page
    // state. A deletion between descriptor pages has no future Project source
    // wake, so leaving this cursor behind would leak one entry per deleted
    // Task for the lifetime of the Project Instance.
    runtimeState().dispatchRecoveryCursors.delete(taskID)
    return { activated: 0 }
  }
  await IntentBundle.ensure(taskID)
  let lifecycle = Database.use((db) => taskLifecycleProjectionInTransaction(db, taskID))
  if (lifecycle.status === "cancelling") {
    // A boundary request that failed midway leaves a status no fact append can
    // leave, and every ingress under it reduces to the same. Re-attempting
    // convergence here is what makes the escape independent of a restart; a
    // throw becomes an ordinary scan fault and is paced by the driver.
    const reconcile = cancellationReconciler()
    if (reconcile) await reconcile(taskID)
    lifecycle = Database.use((db) => taskLifecycleProjectionInTransaction(db, taskID))
    if (lifecycle.status === "cancelling") {
      if (!reconcile) {
        // No converger exists for this boundary in this runtime. The periodic
        // wake alone would poll it silently forever — an invisible stall, the
        // exact condition operator gates exist to name. Surfacing is
        // deterministic per (task, epoch, status), so repeated observation
        // reuses one artifact.
        surfaceUnconvergedTaskBoundary({ taskID, epoch: lifecycle.epoch, status: lifecycle.status, now: Date.now() })
      }
      return { activated: 0, wakeAt: Date.now() + CANCELLATION_RECONCILE_WAKE_MS }
    }
  }
  if (lifecycle.status === "active") {
    Database.immediateTransaction((db) => {
      const current = taskLifecycleProjectionInTransaction(db, taskID)
      if (current.status !== "active" || current.epoch !== lifecycle.epoch) return
      const task = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, taskID)).get()
      if (!task) return
      materializeDueTaskWaitInTransaction(db, { task, executionEpoch: current.epoch, now: Date.now() })
    })
    lifecycle = Database.use((db) => taskLifecycleProjectionInTransaction(db, taskID))
  }
  const taskWaitWakeAt = Database.use((db) =>
    lifecycle.status === "active"
      ? nextTaskWaitDueAtInTransaction(db, { taskID, executionEpoch: lifecycle.epoch })
      : undefined,
  )
  // Worker completion is delivered by an in-process callback owned by the
  // dispatching runtime. That owner can vanish (crash, kill, OOM) after the
  // dispatch decision resolved its ingress, leaving the Task with an empty
  // ready set and no pending timer — a permanent stall no ingress projection
  // can see. Settling abandoned dispatches is therefore part of every scan,
  // once per driver revision. A source request can coalesce after a prior pass
  // crossed this boundary; every following pass must therefore read its fixed
  // descriptor page before the provisional Project cursor may be considered
  // consumed.
  const dispatchRecovery = await reconcileAbandonedDispatches(taskID)
  await afterSourceReconciliationForTest?.({ taskID, pass: context.pass })
  const recovered = dispatchRecovery.recovered
  let activated = 0
  let after: TaskRootIngressFrontierCursor | undefined
  for (;;) {
    const page = Database.use((db) =>
      taskRootIngressReconciliationPageInTransaction(db, {
        taskID,
        executionEpoch: lifecycle.epoch,
        ...(after ? { after } : {}),
        limit: 32,
      }),
    )
    if (page.scannedCount === 0) break
    for (const ingress of page.ingresses) {
      let stopTask = false
      let wakeAt: number | undefined
      let noProgress = false
      const absoluteDeadline = Database.use(
        (db) => taskRootIngressFactsInTransaction(db, ingress.id).policy.absoluteDeadline,
      )
      /**
       * Classify where this ingress comes to rest and honour the obligation that
       * class carries: a finite wake is returned for the driver to arm, and an
       * operator gate that only an infrastructure fact can express is surfaced
       * durably. Every arm is covered by construction, so no state can rest with
       * neither a timer nor a trace.
       */
      const settle = (projection: TaskRootIngressProjection): number | undefined => {
        const classification = classifyTaskRootIngressWake(projection, absoluteDeadline, Date.now())
        if (classification.class === "finite_wake") return classification.wakeAt
        if (classification.class === "operator_gated" && classification.surface === "infrastructure_fact") {
          const surfaced = surfaceOperatorGatedTaskRootIngress({
            taskID,
            ingressID: ingress.id,
            projection,
            now: Date.now(),
          })
          if (!surfaced) return Date.now() + 1_000
        }
        // `interaction` gates are already surfaced by their pending Interaction
        // row, and `fifo_deferred`/`absorbing` owe nothing.
        return undefined
      }
      for (let step = 0; ; step += 1) {
        const now = Date.now()
        if (step >= MAX_INGRESS_STEPS_PER_SCAN) {
          log.warn("Task-root ingress made no reducible progress within one scan", { taskID, ingressID: ingress.id })
          noProgress = true
          stopTask = true
          break
        }
        if ((await terminalizeExpiredTaskRootAssistants(ingress.id, now)) > 0) continue
        const projection = projectTaskRootIngress(ingress.id, now, readTaskRootIngressEvidence)
        if (projection.state === "resolved" || projection.state === "terminal_inapplicable") {
          recordAbsorbingTaskRootIngressDisposition({
            taskID,
            ingressID: ingress.id,
            expected: projection,
            now,
          })
          break
        }
        if (projection.state === "exhausted") {
          // Absorbing for this ingress but not for the Task: later ingresses may
          // still run. The gate is surfaced so the abandoned work is visible,
          // and only a surfaced gate may be memoized.
          const surfaced = surfaceOperatorGatedTaskRootIngress({
            taskID,
            ingressID: ingress.id,
            projection,
            now: Date.now(),
          })
          if (surfaced) break
          return {
            activated: activated + recovered,
            wakeAt: Date.now() + 1_000,
          }
        }
        if (projection.state === "host_fault") {
          // A Host fault executed no effect and releases the FIFO so a later
          // participant ingress can continue. Once its operator gate exists,
          // the old occurrence is therefore abandoned permanently: allowing a
          // later repair to make it ready would execute A after successor B.
          // The operator can redo the work only through a new ingress.
          if (surfaceOperatorGatedTaskRootIngress({ taskID, ingressID: ingress.id, projection, now })) break
          wakeAt = Date.now() + 1_000
          stopTask = true
          break
        }
        if (projection.state === "reconcile_required") {
          if (ensureActivityReconciliationInteractions(taskID, ingress.id, projection.requestIDs, now) > 0) continue
          wakeAt = settle(projection)
          stopTask = true
          break
        }
        if (projection.state === "ready") {
          const attempt = await activate({
            taskID,
            ingressID: ingress.id,
            runWithActivationOwner: context.runWithActivationOwner,
          })
          if (attempt.activated) {
            activated += 1
            continue
          }
          // Pace on what the acquisition actually saw, never on the stale
          // `ready` that led here.
          wakeAt = settle(attempt.projection)
          stopTask = true
          break
        }
        wakeAt = settle(projection)
        stopTask = true
        break
      }
      if (stopTask) {
        const dispatchRecoveryWakeAt = dispatchRecovery.hasMore
          ? Math.min(dispatchRecovery.wakeAt ?? Number.POSITIVE_INFINITY, Date.now() + 25)
          : dispatchRecovery.wakeAt
        return {
          activated: activated + recovered,
          ...(wakeAt === undefined && taskWaitWakeAt === undefined && dispatchRecoveryWakeAt === undefined
            ? {}
            : {
                wakeAt: Math.min(
                  wakeAt ?? Number.POSITIVE_INFINITY,
                  taskWaitWakeAt ?? Number.POSITIVE_INFINITY,
                  dispatchRecoveryWakeAt ?? Number.POSITIVE_INFINITY,
                ),
              }),
          ...(noProgress ? { noProgress: true } : {}),
          ...(!dispatchRecovery.hasMore && dispatchRecovery.retryRequired ? { noProgress: true } : {}),
        }
      }
    }
    if (!page.next) break
    after = page.next
  }
  return {
    activated: activated + recovered,
    ...(taskWaitWakeAt === undefined && !dispatchRecovery.hasMore && dispatchRecovery.wakeAt === undefined
      ? {}
      : {
          wakeAt: Math.min(
            taskWaitWakeAt ?? Number.POSITIVE_INFINITY,
            dispatchRecovery.wakeAt ?? Number.POSITIVE_INFINITY,
            dispatchRecovery.hasMore ? Date.now() + 25 : Number.POSITIVE_INFINITY,
          ),
        }),
    ...(!dispatchRecovery.hasMore && dispatchRecovery.retryRequired ? { noProgress: true } : {}),
  }
}

const driverState = createInstanceState(
  () => {
    const directory = Filesystem.resolve(Instance.directory)
    // Every Project driver joins one process-wide owner. Recovery in another
    // backend reads this row before it may settle our dispatches, so joining
    // and asserting the exact occurrence precedes every scan.
    const liveness = joinProcessLivenessLease(ownerOccurrenceID())
    let heartbeatTraversal: { cursor?: TaskControlProjectFrontierCursor } | undefined
    let heartbeatCheckpoint: TaskControlProjectFrontierCursor | undefined
    return {
      driver: new TaskControlDriver({
        inputRevision: (taskID) =>
          Database.use((db) => {
            const ingress = db
              .select({
                epoch: EngineTaskRootIngressTable.execution_epoch,
                sequence: EngineTaskRootIngressTable.sequence,
              })
              .from(EngineTaskRootIngressTable)
              .where(eq(EngineTaskRootIngressTable.task_id, taskID))
              .orderBy(desc(EngineTaskRootIngressTable.execution_epoch), desc(EngineTaskRootIngressTable.sequence))
              .limit(1)
              .get()
            const event = db
              .select({ sequence: ProtocolEventTable.seq })
              .from(ProtocolEventTable)
              .where(and(eq(ProtocolEventTable.aggregate_type, "task"), eq(ProtocolEventTable.aggregate_id, taskID)))
              .orderBy(desc(ProtocolEventTable.seq))
              .limit(1)
              .get()
            return `${ingress?.epoch ?? 0}:${ingress?.sequence ?? 0}:${event?.sequence ?? 0}`
          }),
        scan: async (taskID, context) => {
          liveness.assertOwned(ownerOccurrenceID())
          return scanTaskControlPlane(taskID, context)
        },
        liveTasks: () => {
          try {
            const traversal = heartbeatTraversal ?? { cursor: heartbeatCheckpoint }
            const slice = currentProjectFrontierSlice(traversal.cursor)
            return {
              taskIDs: slice.taskIDs,
              hasMore: slice.next !== undefined,
              commit() {
                if (slice.next) {
                  heartbeatTraversal = { cursor: slice.next }
                } else {
                  heartbeatCheckpoint = restartTaskControlProjectFrontier(slice.checkpoint)
                  heartbeatTraversal = undefined
                }
              },
            }
          } catch (error) {
            log.error("Task-control heartbeat could not read its bounded candidate page", { error })
            heartbeatTraversal = undefined
            return { taskIDs: [], hasMore: false, commit() {} }
          }
        },
        maximumConcurrentScans: PROJECT_MAXIMUM_CONCURRENT_SCANS,
        maximumPendingScans: PROJECT_MAXIMUM_PENDING_SCANS,
        retireSettledEntries: true,
        reenter: async (fn) => {
          await reenterActiveInstance({ directory, fn })
        },
      }),
      liveness,
    }
  },
  async (state) => {
    state.driver.dispose()
    // Intermediate Project disposal leaves the process fact live. Only the
    // final Project reference publishes graceful process exit.
    state.liveness.release()
  },
  "task-control-driver",
)

/**
 * One project-partitioned recovery/activation algorithm.
 *
 * A single-Task request reports its owner's first-pass fault; a project-wide
 * request isolates each Task so one faulted Task cannot starve the rest.
 */
export async function reconcileTaskControlPlane(
  taskID?: string,
  options?: { runWithActivationOwner?: <T>(run: () => Promise<T>) => Promise<T> },
): Promise<number> {
  const state = driverState()
  state.liveness.assertOwned(ownerOccurrenceID())
  const driver = state.driver
  if (taskID) {
    return driver.request(taskID, {
      propagateFailure: true,
      runWithActivationOwner: options?.runWithActivationOwner,
    })
  }
  // Install the first discovery tick; physical Turns acquire their own Project
  // scope after initialization and cannot delay Project open.
  return driver.bootstrapHeartbeatSlice()
}

/** Pending Task-control re-arms and faults, for diagnostics only. */
export function taskControlDriverSnapshot() {
  return driverState().driver.snapshot()
}

/**
 * Request one Task's scan and report the activations *this call* owned.
 *
 * Zero does not mean no drain will happen: when another caller already owns
 * this Task's scan, the demand is recorded in its revision and this call
 * returns immediately rather than joining. Callers deciding whether work is
 * pending must consult the durable ingress state, not this number.
 */
export async function deliverTaskRootIngress(taskID: string): Promise<number> {
  return reconcileTaskControlPlane(taskID)
}

export async function deliverPendingTaskRootIngresses(): Promise<number> {
  return reconcileTaskControlPlane()
}

/**
 * How many infrastructure-failure wakes one epoch may auto-retry.
 *
 * Retry budgets are frozen per ingress, but an infrastructure failure *mints a
 * new ingress*, and each one arrives with a full budget. A worker that fails
 * the same way every time therefore has no bound at all: each cycle costs a
 * whole Orchestrator Turn and produces the next cycle. The budget must be
 * quantified over something the retry cannot create, and the epoch is that
 * thing — it changes only when an operator Message or exact Mission
 * acceptance resume opens the next Task occurrence.
 */
export const TASK_EPOCH_INFRASTRUCTURE_INGRESS_BUDGET = 5

/** Ingresses in this epoch that were minted by a dispatch infrastructure
 * failure. Exactly the set `eventForIngress` classifies as
 * `dispatchInfrastructureFailure`. */
function countInfrastructureFailureIngressesInTransaction(db: Database.TxOrDb, taskID: string, epoch: number): number {
  return db
    .select({ id: EngineTaskRootIngressTable.id })
    .from(EngineTaskRootIngressTable)
    .innerJoin(
      EngineArtifactTable,
      and(
        eq(EngineArtifactTable.id, EngineTaskRootIngressTable.source_id),
        eq(EngineArtifactTable.kind, "task-infrastructure-error"),
      ),
    )
    .where(
      and(
        eq(EngineTaskRootIngressTable.task_id, taskID),
        eq(EngineTaskRootIngressTable.execution_epoch, epoch),
        eq(EngineTaskRootIngressTable.source, "engine_artifact"),
        sql`json_extract(${EngineArtifactTable.payload}, '$.context.dispatchID') IS NOT NULL`,
        sql`json_extract(${EngineArtifactTable.payload}, '$.operation') IS NOT NULL`,
        sql`json_extract(${EngineArtifactTable.payload}, '$.reason') IS NOT NULL`,
      ),
    )
    .all().length
}

export type DispatchTaskLoopResult = "accepted" | "ignored" | "suppressed_budget_exhausted"
export type DispatchTaskLoopAcceptedWake = { taskID: string; result: "accepted" }
export type DispatchTaskLoopInput = {
  taskID: string
  event?: OrchestratorEvent
  /** Transaction-local immutable-fact admission. When supplied, the check and
   * ingress acceptance share one BEGIN IMMEDIATE ownership boundary. */
  admitInTransaction?: (db: Database.TxOrDb) => boolean
  beforeAcceptedWake?: (wake: DispatchTaskLoopAcceptedWake) => void | Promise<void>
}

export async function dispatchTaskLoop(input: DispatchTaskLoopInput): Promise<DispatchTaskLoopResult> {
  const task = findTask(input.taskID)
  if (!task) throw new TaskRootIngressError(`Task ${input.taskID} does not exist`, "task_not_found", input.taskID)
  const event = OrchestratorEventSchema.parse(input.event ?? { note: "Task wake" })
  const identity = {
    messageID: event.rootMessage?.messageID ?? event.missionAcceptanceResume?.messageID,
    requestID: event.coordinationRequest?.requestID,
    recoveryFactID: event.processRecovery?.recoveryFactID,
    infrastructureFactID: event.dispatchInfrastructureFailure?.infrastructureFactID,
    waitJobID: event.taskWaitWake?.fireID,
    lifecycleEventID: event.agentLifecycleDelivery?.eventID,
    taskCreationID: event.taskCreation?.taskID,
  }
  const accept = (db: Database.TxOrDb): DispatchTaskLoopResult => {
    if (input.admitInTransaction && !input.admitInTransaction(db)) return "ignored"
    if (event.dispatchInfrastructureFailure) {
      const epoch = taskLifecycleProjectionInTransaction(db, task.id).epoch
      if (
        countInfrastructureFailureIngressesInTransaction(db, task.id, epoch) >= TASK_EPOCH_INFRASTRUCTURE_INGRESS_BUDGET
      ) {
        // The failure stays recorded and visible; only the automatic retry
        // stops. Suppressing the wake is what makes the measure well-founded.
        const budgetArtifactID = recordTaskInfrastructureErrorInTransaction(db, {
          id: Identifier.deterministic("artifact", `task-control-infra-budget-v1\0${task.id}\0${epoch}`),
          taskID: task.id,
          component: "task-control",
          operation: "infrastructure-failure-budget-exhausted",
          reason:
            `Task epoch ${epoch} consumed its infrastructure-failure retry budget ` +
            `(${TASK_EPOCH_INFRASTRUCTURE_INGRESS_BUDGET}); further failures are recorded but no longer re-dispatched`,
          // Identity and payload are both keyed to the epoch alone, so every
          // later suppression reuses this exact artifact. Naming the specific
          // suppressed fact here would make the payload differ under a
          // deterministic id and be rejected as publication drift; those facts
          // are each recorded as artifacts in their own right.
          context: { epoch },
          now: Date.now(),
        })
        const authority = event.dispatchInfrastructureFailure.outcome.recovery_authority
        if (authority.occurrence_status === "occurrence_committed") {
          recordDispatchBudgetSuppressionInTransaction(db, {
            taskID: task.id,
            dispatchLineageID: authority.dispatch_lineage_id,
            dispatchID: authority.dispatch_id,
            infrastructureSourceArtifactID: event.dispatchInfrastructureFailure.infrastructureFactID,
            executionEpoch: epoch,
            budgetArtifactID,
            now: Date.now(),
          })
        }
        log.warn("suppressed an infrastructure-failure wake; epoch retry budget is spent", {
          taskID: task.id,
          epoch,
          suppressedInfrastructureFactID: event.dispatchInfrastructureFailure.infrastructureFactID,
        })
        return "suppressed_budget_exhausted"
      }
    }
    persistTaskRootIngressInTransaction(db, task, event, identity)
    return "accepted"
  }
  const accepted = input.admitInTransaction
    ? Database.immediateTransaction(accept)
    : Database.transaction(accept)
  if (accepted !== "accepted") return accepted
  await input.beforeAcceptedWake?.({ taskID: task.id, result: "accepted" })
  await reconcileTaskControlPlane(task.id)
  return "accepted"
}

/**
 * Re-scan one Task without accepting any new ingress.
 *
 * Answering an Interaction, for example, changes an existing ingress from
 * `waiting` to `ready` by appending a fact the reducer already reads — there is
 * nothing new to accept, only something new to observe. The scan is detached
 * because the caller (a Bus subscriber, an HTTP reply handler) must not block
 * on the Orchestrator Turn its own edge just enabled.
 */
/** Detach `run` from the caller's instance lease before letting it float.
 *
 * A background completion outlives the request that spawned it, but the
 * request's instance cache lease does not: the detached work would keep the
 * closed lease in its async context and fault on its next database access.
 * Re-entering acquires a fresh lease held exactly for the work's duration; a
 * project disposed in the meantime drops the work instead of faulting it. */
function runDetachedFromCallerLease(run: () => Promise<unknown>): Promise<unknown> {
  const directory = runtimeState().directory
  return reenterActiveInstance({ directory, fn: run })
}

export function requestTaskControlScanInBackground(taskID: string, operation: string): void {
  const completion = runDetachedFromCallerLease(() => reconcileTaskControlPlane(taskID))
    .then(() => undefined)
    .catch((error) => {
      log.error("background Task-control scan failed", { taskID, operation, error })
    })
    .finally(() => completionHooks.delete(completion))
  completionHooks.add(completion)
}

export function dispatchTaskLoopInBackground(input: DispatchTaskLoopInput, operation: string): void {
  const completion = runDetachedFromCallerLease(() => dispatchTaskLoop(input))
    .then(() => undefined)
    .catch((error) => {
      log.error("background Task-root reconciliation failed", { taskID: input.taskID, operation, error })
    })
    .finally(() => completionHooks.delete(completion))
  completionHooks.add(completion)
}

/** Re-scan for an already-persisted ingress. It accepts no event, so it can
 * never meet the infrastructure-failure budget gate. */
export async function dispatchPersistedTaskLoop(
  taskID: string,
  expectedWakeID?: string,
  options?: { runWithActivationOwner?: <T>(run: () => Promise<T>) => Promise<T> },
): Promise<"accepted" | "ignored"> {
  if (expectedWakeID) {
    const exists = Database.use((db) =>
      db
        .select({ id: EngineTaskRootIngressTable.id })
        .from(EngineTaskRootIngressTable)
        .where(and(eq(EngineTaskRootIngressTable.task_id, taskID), eq(EngineTaskRootIngressTable.id, expectedWakeID)))
        .get(),
    )
    if (!exists) throw new Error(`Task ${taskID} has no persisted ingress ${expectedWakeID}`)
  }
  await reconcileTaskControlPlane(taskID, options)
  return "accepted"
}

export function taskRootIngressStats(taskID?: string) {
  const rows = Database.use((db) =>
    db
      .select({ taskID: EngineTaskRootIngressTable.task_id })
      .from(EngineTaskRootIngressTable)
      .where(taskID ? eq(EngineTaskRootIngressTable.task_id, taskID) : undefined)
      .all(),
  )
  return { tasks: new Set(rows.map((row) => row.taskID)).size, events: rows.length }
}

export function taskRootIngressDebugProjection(taskID: string, now = Date.now()) {
  return Database.use((db) =>
    db
      .select()
      .from(EngineTaskRootIngressTable)
      .where(eq(EngineTaskRootIngressTable.task_id, taskID))
      .orderBy(
        asc(EngineTaskRootIngressTable.execution_epoch),
        asc(EngineTaskRootIngressTable.sequence),
        asc(EngineTaskRootIngressTable.id),
      )
      .all()
      .map((ingress) => {
        const facts = taskRootIngressFactsInTransaction(db, ingress.id, readTaskRootIngressEvidence)
        return {
          ingressID: ingress.id,
          source: ingress.source,
          sourceID: ingress.source_id,
          executionEpoch: ingress.execution_epoch,
          sequence: ingress.sequence,
          acceptedAt: ingress.time_accepted,
          activationIDs: facts.leases.map((lease) => lease.id),
          activations: facts.leases.map((lease) => ({
            activationID: lease.id,
            ownerOccurrenceID: lease.ownerOccurrenceID,
            activatedAt: lease.timeActivated,
            expiresAt: lease.expiresAt,
          })),
          semanticTurnIDs: taskRootIngressSemanticTurnIDs(facts),
          decisionGapStepIDs: facts.decisionGaps.map((gap) => gap.id),
          semanticAttemptIDs: taskRootIngressSemanticAttemptIDs(facts),
          decisions: facts.decisions.map((decision) => ({
            receiptID: decision.id,
            assistantMessageID: decision.assistantMessageID,
            command: decision.command,
          })),
          projection: reduceTaskRootIngressFacts(facts, now),
        }
      }),
  )
}

export function requireTaskCreationIngressID(taskID: string): string {
  const ingress = Database.use((db) =>
    db
      .select()
      .from(EngineTaskRootIngressTable)
      .where(
        and(
          eq(EngineTaskRootIngressTable.task_id, taskID),
          eq(EngineTaskRootIngressTable.source, "task"),
          eq(EngineTaskRootIngressTable.source_id, taskID),
        ),
      )
      .get(),
  )
  if (!ingress) throw new Error(`Task ${taskID} has no durable creation ingress`)
  return ingress.id
}

export function taskCwd(taskID: string): string {
  const task = findTask(taskID)
  if (!task) throw new TaskRootIngressError(`Task ${taskID} does not exist`, "task_not_found", taskID)
  return taskRootDirectory(task)
}

export function snapshotTaskControlReconciliationDirectories(): string[] {
  return [...activeProjectDirectories]
}

export async function reconcileTaskControlAfterRuntimeRollback(directories: readonly string[]): Promise<void> {
  const failures: unknown[] = []
  for (const directory of directories) {
    try {
      await runWithInitializedIndependentProject({ directory, fn: () => reconcileTaskControlPlane() })
    } catch (error) {
      failures.push(error)
    }
  }
  if (failures.length) throw new AggregateError(failures, "Task-control rollback reconciliation failed")
}

export function persistProcessShutdownRecoveryHandoffs(input: {
  tasks: Array<{ taskID: string; ownedSessionIDs: string[] }>
  reason: string
  now?: number
}): Array<{ taskID: string; recoveryFactID: string; wakeID: string }> {
  const now = input.now ?? Date.now()
  return Database.transaction((db) =>
    input.tasks.flatMap((item) => {
      const task = findTask(item.taskID)
      if (!task || item.ownedSessionIDs.length === 0) return []
      // Physical Prompt cleanup can outlive Task execution. Only an active
      // occurrence admits a new recovery input; cancellation and terminal
      // conversations retain their existing durable authorities. The caller
      // still cancels and awaits every physical owner in all lifecycle states.
      if (taskLifecycleProjectionInTransaction(db, task.id).status !== "active") return []
      // Write the exact current context consumed by the single strict reader.
      // A predecessor payload belongs to an incompatible database epoch.
      const affectedSubjects = item.ownedSessionIDs.toSorted().flatMap((sessionID) => {
        const session = db
          .select({ timeCreated: SessionTable.time_created })
          .from(SessionTable)
          .where(eq(SessionTable.id, sessionID))
          .get()
        if (!session) return []
        return [
          {
            kind: "affected_created_session" as const,
            session_id: sessionID,
            session_created_at: session.timeCreated,
          },
        ]
      })
      if (affectedSubjects.length === 0) return []
      const recoveryFactID = recordTaskInfrastructureErrorInTransaction(db, {
        taskID: item.taskID,
        component: "process-recovery",
        operation: "handoff-process-owned-task-execution",
        reason: input.reason,
        context: {
          schema_version: 1,
          origin: "process_shutdown",
          physical_evidence: { kind: "unmanaged_process_cause_unknown", reason: input.reason },
          affected_subjects: affectedSubjects,
        },
        now,
      })
      const wakeID = persistTaskRootIngressInTransaction(
        db,
        task,
        { processRecovery: { recoveryFactID } },
        { recoveryFactID },
        now,
      )
      return [{ taskID: item.taskID, recoveryFactID, wakeID }]
    }),
  )
}

export type TerminalAgentLifecycleDeliveryReconciliation =
  | "missing_lineage"
  | "missing_descriptor"
  | "missing_settlement"
  | "nonterminal"
  | "collection_pending"
  | "already_delivered"
  | "suppressed_budget_exhausted"
  | "delivered"

function orchestratorEventForCollectionWakeSource(source: DispatchCollectionWakeSource): OrchestratorEvent {
  const outcome = source.settlement.payload.outcome
  if (source.kind === "protocol_event") {
    return {
      note: `Dispatch collection completed at worker lifecycle ${source.sourceID}`,
      agentLifecycleDelivery: {
        eventID: source.sourceID,
        sessionID: source.sessionID,
        dispatchID: source.dispatchID,
      },
    }
  }
  if (outcome.kind === "infrastructure_failure" && outcome.infrastructure_error?.artifact_id === source.sourceID) {
    return {
      note: `Dispatch collection completed with infrastructure failure ${source.sourceID}`,
      dispatchInfrastructureFailure: { infrastructureFactID: source.sourceID, outcome },
    }
  }
  if (source.sourceID !== source.settlement.artifactID) {
    throw new Error(`Dispatch collection wake source ${source.sourceID} does not match its representative settlement`)
  }
  return {
    note: `Dispatch collection settled without a terminal lifecycle projection`,
    processRecovery: { recoveryFactID: source.settlement.artifactID },
  }
}

function collectionDeliveryPlan(input: {
  taskID: string
  sessionID: string
  dispatchID: string
}):
  | { kind: "direct" }
  | { kind: "pending" }
  | { kind: "delivered" }
  | { kind: "ready"; source: DispatchCollectionWakeSource; event: OrchestratorEvent } {
  const decision = Database.use((db) => dispatchCollectionWakeDecisionInTransaction(db, input))
  if (decision.kind === "direct" || decision.kind === "pending") return decision
  if (decision.delivered) return { kind: "delivered" }
  return { kind: "ready", source: decision.source, event: orchestratorEventForCollectionWakeSource(decision.source) }
}

async function deliverReadyCollection(input: {
  taskID: string
  sessionID: string
  dispatchID: string
  source: DispatchCollectionWakeSource
  event: OrchestratorEvent
}): Promise<TerminalAgentLifecycleDeliveryReconciliation> {
  await beforeTerminalLifecycleDeliveryForTest?.({
    taskID: input.taskID,
    dispatchID: input.source.dispatchID,
    settlementArtifactID: input.source.settlement.artifactID,
  })
  const result = await dispatchTaskLoop({
    taskID: input.taskID,
    admitInTransaction: (db) =>
      dispatchCollectionWakeCandidateMatchesInTransaction(db, {
        taskID: input.taskID,
        sessionID: input.sessionID,
        dispatchID: input.dispatchID,
        source: input.source,
      }),
    event: input.event,
  })
  if (result === "suppressed_budget_exhausted") return "suppressed_budget_exhausted"
  return result === "ignored" ? "already_delivered" : "delivered"
}

export async function reconcileSettledDispatchDelivery(input: {
  taskID: string
  sessionID: string
  dispatchID: string
}): Promise<TerminalAgentLifecycleDeliveryReconciliation> {
  const lineage = findDispatchLineageByDispatchID({ taskID: input.taskID, dispatchID: input.dispatchID })
  if (!lineage || lineage.payload.child_session_id !== input.sessionID) return "missing_lineage"
  const settlement = findDispatchSettlementByDispatchID({ taskID: input.taskID, dispatchID: input.dispatchID })
  if (!settlement) return "missing_settlement"
  const collection = collectionDeliveryPlan(input)
  if (collection.kind === "pending") return "collection_pending"
  if (collection.kind === "delivered") return "already_delivered"
  if (collection.kind === "ready") {
    return deliverReadyCollection({ ...input, source: collection.source, event: collection.event })
  }
  const outcome = settlement.payload.outcome
  const infrastructureFactID =
    outcome.kind === "infrastructure_failure" ? outcome.infrastructure_error?.artifact_id : undefined
  if (outcome.kind === "infrastructure_failure" && !infrastructureFactID) {
    throw new Error(`Dispatch ${input.dispatchID} infrastructure settlement has no exact Artifact source`)
  }
  const sourceID = infrastructureFactID ?? settlement.artifactID
  const existed = Database.use((db) =>
    db
      .select({ id: EngineTaskRootIngressTable.id })
      .from(EngineTaskRootIngressTable)
      .where(
        and(
          eq(EngineTaskRootIngressTable.task_id, input.taskID),
          eq(EngineTaskRootIngressTable.source, "engine_artifact"),
          eq(EngineTaskRootIngressTable.source_id, sourceID),
        ),
      )
      .get(),
  )
  if (existed) return "already_delivered"
  await beforeDispatchSettlementDeliveryForTest?.({
    taskID: input.taskID,
    dispatchID: input.dispatchID,
    settlementArtifactID: settlement.artifactID,
  })
  const result = await dispatchTaskLoop({
    taskID: input.taskID,
    admitInTransaction: (db) => dispatchRecoveryCandidateExistsInTransaction(db, input),
    event:
      outcome.kind === "infrastructure_failure" && infrastructureFactID
        ? {
            note: `Accepted worker Session ${input.sessionID} failed ${outcome.operation}`,
            dispatchInfrastructureFailure: { infrastructureFactID, outcome },
          }
        : {
            note: `Dispatch ${input.dispatchID} settled without reaching the Orchestrator`,
            processRecovery: { recoveryFactID: settlement.artifactID },
          },
  })
  if (result === "suppressed_budget_exhausted") return "suppressed_budget_exhausted"
  return result === "ignored" ? "already_delivered" : "delivered"
}

function requireTerminalLifecycleFinalMessageAuthority(input: {
  lifecycleID: string
  dispatchID: string
  sessionID: string
  inputMessageID: string
  finalMessageID: string
}): string {
  const final = Database.use((db) =>
    db
      .select({ id: MessageTable.id, data: MessageTable.data })
      .from(MessageTable)
      .where(and(eq(MessageTable.id, input.finalMessageID), eq(MessageTable.session_id, input.sessionID)))
      .get(),
  )
  if (!final) {
    throw new Error(
      `Terminal lifecycle ${input.lifecycleID} final Message ${input.finalMessageID} ` +
        `is not the completed reply for dispatch ${input.dispatchID}`,
    )
  }
  const parsedFinal = Message.Assistant.safeParse({ ...final.data, id: final.id, sessionID: input.sessionID })
  if (
    !parsedFinal.success ||
    parsedFinal.data.time.completed === undefined ||
    !parsedFinal.data.finish ||
    !Message.acceptsInputMessage(parsedFinal.data, input.inputMessageID)
  ) {
    throw new Error(
      `Terminal lifecycle ${input.lifecycleID} final Message ${input.finalMessageID} ` +
        `is not the completed reply for dispatch ${input.dispatchID}`,
    )
  }
  return input.finalMessageID
}

function settleTerminalAgentLifecycleFailure(input: {
  taskID: string
  dispatchID: string
  sessionID: string
  lineageArtifactID: string
  descriptor: WorkerTurnDescriptor.Info
  lifecycle: NonNullable<ReturnType<typeof ProtocolStore.latestSessionOccurrenceEvent>>
  lifecycleStatus: {
    type: "terminal"
    reason: "error" | "aborted"
    error?: string
    final_message_id?: string
  }
}): DispatchSettlementRow {
  return Database.immediateTransaction((db) => {
    const existing = findDispatchSettlementByDispatchID({ taskID: input.taskID, dispatchID: input.dispatchID })
    if (existing) return existing
    const operation = "recover-terminal-agent-lifecycle"
    const errorName = input.lifecycleStatus.reason === "aborted" ? "AgentExecutionAbortedError" : "AgentExecutionError"
    const message =
      input.lifecycleStatus.error ??
      `Worker Session ${input.sessionID} ended with lifecycle reason ${input.lifecycleStatus.reason}`
    const finalMessageID = input.lifecycleStatus.final_message_id
      ? requireTerminalLifecycleFinalMessageAuthority({
          lifecycleID: input.lifecycle.id,
          dispatchID: input.dispatchID,
          sessionID: input.sessionID,
          inputMessageID: input.descriptor.payload.messageAuthority.user_message_id,
          finalMessageID: input.lifecycleStatus.final_message_id,
        })
      : undefined
    const infrastructureFactID = recordTaskInfrastructureErrorInTransaction(db, {
      id: Identifier.deterministic(
        "artifact",
        `terminal-agent-lifecycle-failure-v1\0${input.taskID}\0${input.dispatchID}\0${input.lifecycle.id}`,
      ),
      taskID: input.taskID,
      component: "dispatch-agent",
      operation,
      reason: message,
      errorName,
      sessionID: input.sessionID,
      context: {
        dispatchID: input.dispatchID,
        dispatchLineageID: input.lineageArtifactID,
        lifecycleEventID: input.lifecycle.id,
        lifecycleReason: input.lifecycleStatus.reason,
        inputMessageID: input.descriptor.payload.messageAuthority.user_message_id,
      },
      now: input.lifecycle.time.emitted,
    })
    const outcome = DispatchOutcome.infrastructureFailure({
      operation,
      message,
      errorName,
      sessionID: input.sessionID,
      ...(finalMessageID ? { finalMessageID } : {}),
      recoveryAuthority: resolveDispatchOccurrenceAuthority({
        taskID: input.taskID,
        dispatchID: input.dispatchID,
      }),
      infrastructureError: exactEngineArtifactLocator({
        taskID: input.taskID,
        artifactID: infrastructureFactID,
      }),
      workerTurn: {
        descriptorID: input.descriptor.id,
        descriptorHash: input.descriptor.hash,
        inputMessageID: input.descriptor.payload.messageAuthority.user_message_id,
        currentDispatchID: input.dispatchID,
      },
      failureIssues: [
        {
          code: input.lifecycleStatus.reason,
          path: ["agent_execution_lifecycle", "status"],
          message,
        },
      ],
    })
    return settleDispatchOrReturnExisting({
      taskID: input.taskID,
      dispatchID: input.dispatchID,
      outcome,
      now: input.lifecycle.time.emitted,
    })
  })
}

export async function reconcileTerminalAgentLifecycleDelivery(input: {
  taskID: string
  sessionID: string
  dispatchID: string
}): Promise<TerminalAgentLifecycleDeliveryReconciliation> {
  const lineage = findDispatchLineageByDispatchID({ taskID: input.taskID, dispatchID: input.dispatchID })
  if (!lineage || lineage.payload.child_session_id !== input.sessionID) return "missing_lineage"
  const descriptor = WorkerTurnDescriptor.findForDispatch({ sessionID: input.sessionID, dispatchID: input.dispatchID })
  if (!descriptor) return "missing_descriptor"
  const lifecycle = ProtocolStore.latestSessionOccurrenceEvent(
    input.sessionID,
    "agent.execution.lifecycle",
    descriptor.payload.messageAuthority.user_message_id,
  )
  if (!lifecycle) return "nonterminal"
  if (
    lifecycle.type !== "agent.execution.lifecycle" ||
    lifecycle.taskID !== input.taskID ||
    lifecycle.sessionID !== input.sessionID ||
    lifecycle.payload?.inputMessageID !== descriptor.payload.messageAuthority.user_message_id
  ) {
    throw new Error(`Lifecycle ${lifecycle.id} identity drift for dispatch ${input.dispatchID}`)
  }
  const lifecycleStatus = SessionStatus.Info.parse(lifecycle.payload?.status)
  if (lifecycleStatus.type !== "terminal") return "nonterminal"
  if (lifecycleStatus.reason === "error" || lifecycleStatus.reason === "aborted") {
    const settlement = settleTerminalAgentLifecycleFailure({
      taskID: input.taskID,
      dispatchID: input.dispatchID,
      sessionID: input.sessionID,
      lineageArtifactID: lineage.artifactID,
      descriptor,
      lifecycle,
      lifecycleStatus: {
        type: "terminal",
        reason: lifecycleStatus.reason,
        ...(lifecycleStatus.error ? { error: lifecycleStatus.error } : {}),
        ...(lifecycleStatus.final_message_id ? { final_message_id: lifecycleStatus.final_message_id } : {}),
      },
    })
    const outcome = settlement.payload.outcome
    if (outcome.kind !== "infrastructure_failure" || !outcome.infrastructure_error) {
      throw new Error(
        `Terminal lifecycle ${lifecycle.id} failure conflicts with dispatch ${input.dispatchID} settlement ${outcome.kind}`,
      )
    }
    const infrastructureError = outcome.infrastructure_error
    const collection = collectionDeliveryPlan(input)
    if (collection.kind === "pending") return "collection_pending"
    if (collection.kind === "delivered") return "already_delivered"
    if (collection.kind === "ready") {
      return deliverReadyCollection({ ...input, source: collection.source, event: collection.event })
    }
    const existed = Database.use((db) =>
      db
        .select({ id: EngineTaskRootIngressTable.id })
        .from(EngineTaskRootIngressTable)
        .where(
          and(
            eq(EngineTaskRootIngressTable.task_id, input.taskID),
            eq(EngineTaskRootIngressTable.source, "engine_artifact"),
            eq(EngineTaskRootIngressTable.source_id, infrastructureError.artifact_id),
          ),
        )
        .get(),
    )
    if (existed) return "already_delivered"
    await beforeTerminalLifecycleDeliveryForTest?.({
      taskID: input.taskID,
      dispatchID: input.dispatchID,
      settlementArtifactID: settlement.artifactID,
    })
    const result = await dispatchTaskLoop({
      taskID: input.taskID,
      admitInTransaction: (db) =>
        dispatchRecoveryCandidateExistsInTransaction(db, {
          taskID: input.taskID,
          sessionID: input.sessionID,
          dispatchID: input.dispatchID,
        }),
      event: {
        note:
          `Worker Session ${input.sessionID} ended dispatch ${input.dispatchID} ` +
          `with lifecycle reason ${lifecycleStatus.reason}.`,
        dispatchInfrastructureFailure: {
          infrastructureFactID: infrastructureError.artifact_id,
          outcome,
        },
      },
    })
    if (result === "suppressed_budget_exhausted") return "suppressed_budget_exhausted"
    return result === "ignored" ? "already_delivered" : "delivered"
  }
  if (!findDispatchSettlementByDispatchID({ taskID: input.taskID, dispatchID: input.dispatchID })) {
    const finalMessageID = lifecycleStatus.final_message_id
    if (!finalMessageID) {
      throw new Error(
        `Terminal lifecycle ${lifecycle.id} for dispatch ${input.dispatchID} has no final_message_id authority`,
      )
    }
    requireTerminalLifecycleFinalMessageAuthority({
      lifecycleID: lifecycle.id,
      dispatchID: input.dispatchID,
      sessionID: input.sessionID,
      inputMessageID: descriptor.payload.messageAuthority.user_message_id,
      finalMessageID,
    })
    settleDispatchOrReturnExisting({
      taskID: input.taskID,
      dispatchID: input.dispatchID,
      outcome: DispatchOutcome.partial({
        sessionID: input.sessionID,
        finalMessageID,
        failedOperation: "recover_dispatch_domain_settlement",
      }),
    })
  }
  const settlement = findDispatchSettlementByDispatchID({ taskID: input.taskID, dispatchID: input.dispatchID })
  if (!settlement) throw new Error(`Terminal lifecycle ${lifecycle.id} did not settle dispatch ${input.dispatchID}`)
  const collection = collectionDeliveryPlan(input)
  if (collection.kind === "pending") return "collection_pending"
  if (collection.kind === "delivered") return "already_delivered"
  if (collection.kind === "ready") {
    return deliverReadyCollection({ ...input, source: collection.source, event: collection.event })
  }
  const existed = Database.use((db) =>
    db
      .select({ id: EngineTaskRootIngressTable.id })
      .from(EngineTaskRootIngressTable)
      .where(
        and(
          eq(EngineTaskRootIngressTable.task_id, input.taskID),
          eq(EngineTaskRootIngressTable.source, "protocol_event"),
          eq(EngineTaskRootIngressTable.source_id, lifecycle.id),
        ),
      )
      .get(),
  )
  if (existed) return "already_delivered"
  await beforeTerminalLifecycleDeliveryForTest?.({
    taskID: input.taskID,
    dispatchID: input.dispatchID,
    settlementArtifactID: settlement.artifactID,
  })
  const result = await dispatchTaskLoop({
    taskID: input.taskID,
    admitInTransaction: (db) =>
      dispatchRecoveryCandidateExistsInTransaction(db, {
        taskID: input.taskID,
        sessionID: input.sessionID,
        dispatchID: input.dispatchID,
      }),
    event: {
      note: `Worker Session ${input.sessionID} completed dispatch ${input.dispatchID}.`,
      agentLifecycleDelivery: { eventID: lifecycle.id, sessionID: input.sessionID, dispatchID: input.dispatchID },
    },
  })
  return result === "ignored" ? "already_delivered" : "delivered"
}

export async function waitForIngressDeliveryHooksForTest(): Promise<void> {
  await Promise.all([...completionHooks])
}

export const TestHooks = {
  reconcileAbandonedDispatches(taskID: string) {
    return reconcileAbandonedDispatches(taskID)
  },
  taskRootLifecycleDispositionEvidence(input: Parameters<typeof taskRootLifecycleDispositionEvidence>[0]) {
    return taskRootLifecycleDispositionEvidence(input)
  },
  hasDispatchRecoveryCursor(taskID: string): boolean {
    return runtimeState().dispatchRecoveryCursors.has(taskID)
  },
  scanTaskControlPlane(taskID: string, context: TaskControlScanContext) {
    return scanTaskControlPlane(taskID, context)
  },
  replaceAfterSourceReconciliation(
    hook: (input: { taskID: string; pass: number }) => void | Promise<void>,
  ): Disposable {
    const prior = afterSourceReconciliationForTest
    afterSourceReconciliationForTest = hook
    return {
      [Symbol.dispose]() {
        afterSourceReconciliationForTest = prior
      },
    }
  },
  replaceBeforeDispatchSettlementDelivery(
    hook: (input: { taskID: string; dispatchID: string; settlementArtifactID: string }) => void | Promise<void>,
  ): Disposable {
    const prior = beforeDispatchSettlementDeliveryForTest
    beforeDispatchSettlementDeliveryForTest = hook
    return {
      [Symbol.dispose]() {
        beforeDispatchSettlementDeliveryForTest = prior
      },
    }
  },
  replaceBeforeTerminalLifecycleDelivery(
    hook: (input: { taskID: string; dispatchID: string; settlementArtifactID: string }) => void | Promise<void>,
  ): Disposable {
    const prior = beforeTerminalLifecycleDeliveryForTest
    beforeTerminalLifecycleDeliveryForTest = hook
    return {
      [Symbol.dispose]() {
        beforeTerminalLifecycleDeliveryForTest = prior
      },
    }
  },
  currentProjectFrontierSlice(cursor?: TaskControlProjectFrontierCursor) {
    return currentProjectFrontierSlice(cursor)
  },
  replaceOperatorGateWriter(writer: (input: Parameters<typeof recordTaskInfrastructureError>[0]) => void): Disposable {
    const prior = operatorGateWriterForTest
    operatorGateWriterForTest = writer
    return {
      [Symbol.dispose]() {
        operatorGateWriterForTest = prior
      },
    }
  },
  replaceTerminalIngressDeliveryRuntime(value: string): Disposable {
    const prior = replaceRuntimeOccurrenceIDForTest(value)
    return {
      [Symbol.dispose]() {
        replaceRuntimeOccurrenceIDForTest(prior)
      },
    }
  },
  replaceTaskIngressRunner(input: { runner: TaskIngressRunner }): Disposable {
    const state = runtimeState()
    const prior = state.runnerOverrideForTest
    state.runnerOverrideForTest = input.runner
    return {
      [Symbol.dispose]() {
        state.runnerOverrideForTest = prior
      },
    }
  },
  replaceLeaseTiming(input: { leaseMilliseconds: number; renewalMilliseconds: number }): Disposable {
    if (
      !Number.isSafeInteger(input.leaseMilliseconds) ||
      input.leaseMilliseconds <= 0 ||
      !Number.isSafeInteger(input.renewalMilliseconds) ||
      input.renewalMilliseconds <= 0 ||
      input.renewalMilliseconds >= input.leaseMilliseconds
    ) {
      throw new Error("Task-control lease test timing requires positive renewal shorter than the lease")
    }
    const priorLease = leaseMilliseconds
    const priorRenewal = leaseRenewalMilliseconds
    leaseMilliseconds = input.leaseMilliseconds
    leaseRenewalMilliseconds = input.renewalMilliseconds
    return {
      [Symbol.dispose]() {
        leaseMilliseconds = priorLease
        leaseRenewalMilliseconds = priorRenewal
      },
    }
  },
}
