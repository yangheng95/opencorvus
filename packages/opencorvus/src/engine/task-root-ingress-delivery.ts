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
import { OrchestratorControlMessageExtra } from "@/protocol/orchestrator-control-message-schema"
import { currentRuntimeOccurrenceID, replaceRuntimeOccurrenceIDForTest } from "@/runtime/process-occurrence"
import { RuntimeExecutionSettlement, type RuntimeExecutionReservation } from "@/runtime/execution-settlement"
import { Message } from "@/session/message"
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
import { Database, and, asc, eq, inArray, sql } from "@/storage/db"
import { Log } from "@/util/log"
import { Filesystem } from "@/util/filesystem"
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
  listTaskRootIngresses,
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
import { isProcessOccurrenceLive, joinProcessLivenessLease, PROCESS_LIVENESS_LEASE_MS } from "./process-liveness"
import { TaskRootIngressError, taskRootDirectory } from "./task-directory"
import { listDispatchLineage } from "./dispatch-lineage"
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
import { AutomationRunTable, AutomationTable } from "@/scheduler/automation.sql"
import { resolveDispatchOccurrenceAuthority } from "./dispatch-lineage"

export { TaskRootIngressError } from "./task-directory"

const log = Log.create({ service: "engine.task-root-fact-control" })
let leaseMilliseconds = 120_000
let leaseRenewalMilliseconds = 40_000
const completionHooks = new Set<Promise<void>>()
const activeProjectDirectories = new Set<string>()

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
      /**
       * Ingresses this process has already reduced to an absorbing state
       * (`resolved`, `terminal_inapplicable`, `exhausted`). Those states are
       * monotone in the durable facts — appends to a resolved activation are
       * fenced off, epochs only advance, budgets only fill — so a memoized
       * verdict can never silently become wrong. Pure performance cache: it is
       * reconstructible by one reduction, holds no authority, and its loss on
       * restart costs exactly one re-verification per ingress. Without it every
       * heartbeat re-reads full evidence for the entire settled history of
       * every open Task, which is quadratic-by-time load on the event loop.
       */
      settledIngressIDs: new Set<string>(),
      /**
       * Dispatches whose settlement is durably delivered (or durably
       * suppressed). Same cache discipline as above; without it every sweep
       * replays the terminal-lifecycle delivery check for every historical
       * dispatch of every open Task.
       */
      closedDispatchIDs: new Set<string>(),
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
  const automationRunID = identity.automationRunID?.trim()
  if (automationRunID) return { source: "automation_run" as const, sourceID: automationRunID }
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
    automationRunID?: string
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

export function persistTaskWaitIngressInTransaction(
  db: Database.TxOrDb,
  input: { task: TaskRow; jobID: string; fireID: string; runID: string; dueAt: number; now: number },
): string {
  return persistTaskRootIngressInTransaction(
    db,
    input.task,
    {
      note: `Task wait ${input.jobID} became due`,
      taskWaitWake: { jobID: input.jobID, fireID: input.fireID, dueAt: input.dueAt },
    },
    { automationRunID: input.runID },
    input.now,
  )
}

/**
 * Transfer one or more pending Task waits to one durable activity occurrence.
 *
 * The Automation definitions remain the authority for which waits were
 * claimed; their exact revision identities make the Task ingress stable across
 * a claimant crash before this transaction. The participant detail is retained
 * as the real event payload, but it does not mint a second logical occurrence
 * when another activity races the same wait revisions.
 */
export function persistTaskWaitActivityIngressInTransaction(
  db: Database.TxOrDb,
  input: {
    task: TaskRow
    jobIDs: readonly string[]
    jobRevisionIDs: readonly string[]
    source: string
    detail: string
    now: number
  },
): string {
  const jobRevisionIDs = [...new Set(input.jobRevisionIDs)].toSorted()
  const jobIDs = [...new Set(input.jobIDs)].toSorted()
  if (jobRevisionIDs.length === 0) throw new Error("Task wait activity requires an exact Automation revision")
  if (jobIDs.length !== jobRevisionIDs.length) {
    throw new Error("Task wait activity requires one exact definition for every Automation revision")
  }
  const sourceID = createHash("sha256")
    .update(["task-wait-activity-v1", input.task.id, ...jobRevisionIDs].join("\0"))
    .digest("hex")
  return persistTaskRootIngressInTransaction(
    db,
    input.task,
    {
      note: `Task wait activity consumed ${jobRevisionIDs.length} pending wait(s)`,
      taskWaitActivity: {
        source: input.source,
        detail: input.detail,
        jobIDs,
      },
    },
    { waitJobID: sourceID },
    input.now,
  )
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
  if (ingress.source === "automation_run") {
    const row = Database.use((db) =>
      db
        .select({ run: AutomationRunTable, definition: AutomationTable })
        .from(AutomationRunTable)
        .innerJoin(AutomationTable, eq(AutomationTable.id, AutomationRunTable.automation_revision_id))
        .where(eq(AutomationRunTable.id, ingress.source_id))
        .get(),
    )
    if (
      !row ||
      row.definition.task_id !== ingress.task_id ||
      row.definition.kind !== "delay" ||
      row.definition.due_at == null
    ) {
      throw new TaskRootIngressIntegrityError(
        ingress.id,
        `Task-root ingress ${ingress.id} references invalid Automation run ${ingress.source_id}`,
      )
    }
    return OrchestratorEventSchema.parse({
      note: `Task wait ${row.definition.definition_id} became due`,
      taskWaitWake: { jobID: row.definition.definition_id, fireID: row.run.fire_id, dueAt: row.definition.due_at },
    })
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
  return db
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
    const controlExtra = OrchestratorControlMessageExtra.safeParse(
      (parent?.data as { extra?: unknown } | undefined)?.extra,
    )
    const control = controlExtra.success ? controlExtra.data.orchestrator_control_ingress : undefined
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
    const operation = input.runWithActivationOwner
      ? input.runWithActivationOwner(runActivation)
      : runActivation()
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

function currentProjectTaskIDs(taskID?: string): string[] {
  return Database.use((db) =>
    db
      .select({ id: EngineTaskTable.id })
      .from(EngineTaskTable)
      .where(
        and(eq(EngineTaskTable.project_id, Instance.project.id), ...(taskID ? [eq(EngineTaskTable.id, taskID)] : [])),
      )
      .all()
      .filter((task) => !taskDeletedInTransaction(db, task.id))
      .map((task) => task.id),
  )
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
 * sweep until this process has verified that ingress settled; excluding it is
 * exactly the lost-wake class the sweep exists to close. The settled memo
 * bounds the cost: one verification per ingress per process lifetime.
 */
function currentSweepProjectTaskIDs(): string[] {
  const settledIngressIDs = runtimeState().settledIngressIDs
  return Database.use((db) =>
    currentProjectTaskIDs().filter((id) => {
      try {
        const lifecycle = taskLifecycleProjectionInTransaction(db, id)
        if (lifecycle.status === "active" || lifecycle.status === "cancelling") {
          return true
        }
        if (lifecycle.terminalAt === undefined) return false
        const hasUnsettledPostTerminalIngress = db
          .select({ id: EngineTaskRootIngressTable.id })
          .from(EngineTaskRootIngressTable)
          .where(
            and(
              eq(EngineTaskRootIngressTable.task_id, id),
              eq(EngineTaskRootIngressTable.execution_epoch, lifecycle.epoch),
              sql`${EngineTaskRootIngressTable.time_accepted} >= ${lifecycle.terminalAt}`,
            ),
          )
          .all()
          .some((ingress) => !settledIngressIDs.has(ingress.id))
        if (hasUnsettledPostTerminalIngress) return true
        // Completion refuses to terminalize with an open dispatch, but failure
        // and cancellation can win while a committed child lineage is still
        // physically settling. That lineage is itself an exact recovery
        // obligation; hiding the terminal parent from the sweep strands it
        // forever after the owner process disappears.
        return listDispatchLineage(id).some(
          (lineage) => findDispatchSettlementByDispatchID({ taskID: id, dispatchID: lineage.dispatchID }) === undefined,
        )
      } catch (error) {
        log.error("Task-control sweep could not project a Task lifecycle", { taskID: id, error })
        return false
      }
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
}): void {
  const reason =
    input.projection.state === "host_fault" || input.projection.state === "exhausted"
      ? input.projection.reason
      : "unknown"
  try {
    // A settlement without a named exit still reads as a deadlock to the
    // operator, so the artifact says what would move it.
    const exit =
      input.projection.state === "host_fault"
        ? `Exit: later ingresses continue past it, and this Turn executed no effect; repair the Host invariant ` +
          `it names, then send a new operator message to redo this work.`
        : `Exit: later ingresses continue past it; send a new operator message to redo the abandoned work, ` +
          `or retry the Task for a fresh budget.`
    recordTaskInfrastructureError({
      id: Identifier.deterministic(
        "artifact",
        `task-control-operator-gate-v2\0${input.ingressID}\0${input.projection.state}\0${reason}`,
      ),
      taskID: input.taskID,
      component: "task-control",
      operation: "surface-operator-gated-ingress",
      reason:
        `Task-root ingress ${input.ingressID} rests in ${input.projection.state} (${reason}); ` +
        `automatic scheduling cannot resume it. ${exit}`,
      context: { ingressID: input.ingressID, state: input.projection.state, gateReason: reason },
      now: input.now,
    })
  } catch (error) {
    // Surfacing is an observability obligation, not a scheduling one. Losing
    // it must not convert a resting Task into a faulting one.
    log.error("Could not surface an operator-gated Task-root ingress", {
      taskID: input.taskID,
      ingressID: input.ingressID,
      error,
    })
  }
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
 * Two cases are settled here, and only these two, because only these two are
 * provable from durable evidence:
 *
 *   1. the worker reached a terminal lifecycle but its delivery was lost — the
 *      outcome exists, so replaying delivery is idempotent gap-closing;
 *   2. the worker has no terminal lifecycle and no owner in this process — the
 *      run is abandoned, so its interruption is recorded as an infrastructure
 *      outcome and handed back to the Orchestrator as a real fact.
 *
 * Liveness of the owner is decided from durable evidence, never from this
 * process's memory: a peer backend sharing this database owns dispatches whose
 * pipelines are absent from every local registry here, and settling those would
 * terminalize live workers on each sweep. Local registries remain as a fast
 * path for this process's own lineages.
 */
async function reconcileAbandonedDispatches(taskID: string): Promise<number> {
  const settled = new Set(
    Database.use((db) =>
      db
        .select({ payload: EngineArtifactTable.payload })
        .from(EngineArtifactTable)
        .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "dispatch_settlement")))
        .all()
        .map((row) => (row.payload as { dispatch_id?: string }).dispatch_id)
        .filter((id): id is string => typeof id === "string"),
    ),
  )
  const lineages = listDispatchLineage(taskID)
  const closedDispatchIDs = runtimeState().closedDispatchIDs
  let recovered = 0
  for (const lineage of lineages) {
    const childSessionID = lineage.payload.child_session_id
    // A dispatch this process has verified as settled-and-delivered (or
    // deliberately suppressed) is finished history; without the memo every
    // sweep replays its delivery check against the protocol store.
    if (closedDispatchIDs.has(lineage.dispatchID)) continue
    if (await dispatchDeliveryOwnerIsLive(lineage, Date.now())) continue
    try {
      if (settled.has(lineage.dispatchID)) {
        recovered += await recoverSettledUndeliveredDispatch({ taskID, lineage })
        // Reaching here without a throw means the settlement is delivered,
        // just delivered now, or durably suppressed — all closed.
        closedDispatchIDs.add(lineage.dispatchID)
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
      if (delivery === "already_delivered") continue
      if (await settleAbandonedDispatch({ taskID, lineage })) recovered += 1
    } catch (error) {
      // One unrecoverable dispatch must not stop the sweep: its siblings and
      // the rest of this Task's frontier are independent.
      log.error("abandoned dispatch reconciliation failed", {
        taskID,
        dispatchID: lineage.dispatchID,
        sessionID: childSessionID,
        error,
      })
    }
  }
  return recovered
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
  lineage: { artifactID: string; dispatchID: string; payload: { child_session_id: string } }
}): Promise<number> {
  const settlement = findDispatchSettlementByDispatchID({
    taskID: input.taskID,
    dispatchID: input.lineage.dispatchID,
  })
  if (!settlement) return 0
  if (dispatchSettlementDelivered({ taskID: input.taskID, settlement })) return 0
  // The canonical replay is idempotent and produces the ordinary lifecycle
  // ingress, so it is always preferred over a synthetic recovery wake.
  const replay = await reconcileTerminalAgentLifecycleDelivery({
    taskID: input.taskID,
    sessionID: input.lineage.payload.child_session_id,
    dispatchID: input.lineage.dispatchID,
  })
  if (replay === "delivered") return 1
  if (replay === "already_delivered") return 0
  // No terminal lifecycle to replay: wake the Orchestrator on the settlement
  // itself, keyed so the ingress source index makes the replay idempotent.
  //
  // An infrastructure settlement must re-enter through the same gate its
  // original wake would have used. Routing it as `processRecovery` would slip
  // past the epoch's infrastructure-failure budget — the exact loop the budget
  // terminates would continue at one wake per crash cycle, just under a
  // different event name.
  const outcome = settlement.payload.outcome
  const infrastructureFactID = outcome.kind === "infrastructure_failure" ? outcome.infrastructure_error?.artifact_id : undefined
  const result = await dispatchTaskLoop({
    taskID: input.taskID,
    event:
      outcome.kind === "infrastructure_failure" && infrastructureFactID
        ? {
            note: `Dispatch ${input.lineage.dispatchID} settled as infrastructure failure without reaching the Orchestrator`,
            dispatchInfrastructureFailure: { infrastructureFactID, outcome },
          }
        : {
            note: `Dispatch ${input.lineage.dispatchID} settled without reaching the Orchestrator`,
            processRecovery: { recoveryFactID: settlement.artifactID },
          },
  })
  if (result === "suppressed_budget_exhausted") {
    // The budget already surfaced its own durable gate; this dispatch is
    // deliberately, permanently quiet.
    return 0
  }
  log.warn("recovered a settled dispatch that never reached the Orchestrator", {
    taskID: input.taskID,
    dispatchID: input.lineage.dispatchID,
    settlementArtifactID: settlement.artifactID,
  })
  return 1
}

/** Whether some accepted ingress already carries this settlement's outcome. */
function dispatchSettlementDelivered(input: { taskID: string; settlement: DispatchSettlementRow }): boolean {
  const outcome = input.settlement.payload.outcome
  const sourceIDs = [
    input.settlement.artifactID,
    outcome.kind === "infrastructure_failure" ? outcome.infrastructure_error?.artifact_id : undefined,
  ].filter((id): id is string => typeof id === "string")
  return Database.use((db) => {
    const artifactSourced =
      sourceIDs.length > 0 &&
      db
        .select({ id: EngineTaskRootIngressTable.id })
        .from(EngineTaskRootIngressTable)
        .where(
          and(
            eq(EngineTaskRootIngressTable.task_id, input.taskID),
            eq(EngineTaskRootIngressTable.source, "engine_artifact"),
            inArray(EngineTaskRootIngressTable.source_id, sourceIDs),
          ),
        )
        .get() !== undefined
    return artifactSourced
  })
}

/**
 * Whether the process responsible for delivering this dispatch still exists.
 *
 * The order matters. This process's own registries are authoritative for its
 * own lineages and answer without a query. For a lineage another process
 * claimed, only that process's liveness lease can answer — its absence from
 * local memory means nothing. A lineage written before the claim existed gets
 * one lease period of grace from its commit, which is the longest a live owner
 * could plausibly have gone unrecorded.
 */
async function dispatchDeliveryOwnerIsLive(
  lineage: { artifactID: string; payload: { child_session_id: string; owner_process_occurrence_id?: string } },
  now: number,
  timeCreated?: number,
): Promise<boolean> {
  const { hasLiveDetachedDispatchPipeline } = await import("@/orchestrator/dispatch-agent-tool")
  const { SessionPrompt } = await import("@/session/prompt")
  if (hasLiveDetachedDispatchPipeline(lineage.artifactID)) return true
  if (SessionPrompt.hasGeneration(lineage.payload.child_session_id)) return true
  const owner = lineage.payload.owner_process_occurrence_id
  if (owner === undefined) {
    const created = timeCreated ?? lineageTimeCreated(lineage.artifactID)
    return created !== undefined && created + PROCESS_LIVENESS_LEASE_MS > now
  }
  // This process claimed it and neither registry holds it: the work is gone,
  // and our own memory is the authority on that.
  if (owner === ownerOccurrenceID()) return false
  return Database.use((db) => isProcessOccurrenceLive(db, owner, now))
}

function lineageTimeCreated(artifactID: string): number | undefined {
  return Database.use(
    (db) =>
      db
        .select({ timeCreated: EngineArtifactTable.time_created })
        .from(EngineArtifactTable)
        .where(eq(EngineArtifactTable.id, artifactID))
        .get()?.timeCreated,
  )
}

/** Record the interruption of one abandoned worker as its durable outcome and
 * hand it back to the Orchestrator as an ordinary accepted ingress. */
async function settleAbandonedDispatch(input: {
  taskID: string
  lineage: { artifactID: string; dispatchID: string; payload: { child_session_id: string; target_agent_id: string } }
}): Promise<boolean> {
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
  settleDispatchOrReturnExisting({ taskID: input.taskID, dispatchID: input.lineage.dispatchID, outcome })
  const lifecycle = Database.use((db) => taskLifecycleProjectionInTransaction(db, input.taskID))
  if (lifecycle.status !== "active" && lifecycle.status !== "cancelling") {
    // A terminal parent cannot legally accept another Orchestrator ingress.
    // Its exact child settlement is the recovery obligation, and committing it
    // is sufficient for project discovery to converge and drop this Task.
    return true
  }
  await dispatchTaskLoop({
    taskID: input.taskID,
    event: {
      note: `Worker Session ${childSessionID} was abandoned before completing dispatch ${input.lineage.dispatchID}`,
      dispatchInfrastructureFailure: { infrastructureFactID, outcome },
    },
  })
  return true
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
  if (!currentProjectTaskIDs(taskID).includes(taskID)) return { activated: 0 }
  let lifecycle = Database.use((db) => taskLifecycleProjectionInTransaction(db, taskID))
  if (lifecycle.status === "cancelling" && context.pass === 0) {
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
  // Worker completion is delivered by an in-process callback owned by the
  // dispatching runtime. That owner can vanish (crash, kill, OOM) after the
  // dispatch decision resolved its ingress, leaving the Task with an empty
  // ready set and no pending timer — a permanent stall no ingress projection
  // can see. Settling abandoned dispatches is therefore part of every scan,
  // but once per scan: the sweep's own effects re-enter the fixpoint, so
  // running it per pass would rescan the artifact tables for no new evidence.
  const recovered = context.pass === 0 ? await reconcileAbandonedDispatches(taskID) : 0
  const ingresses = listTaskRootIngresses(taskID, lifecycle.epoch)
  const settledIngressIDs = runtimeState().settledIngressIDs
  let activated = 0
  for (const ingress of ingresses) {
    // Absorbing verdicts this process already reduced are skipped without a
    // fresh evidence read; see the memo's declaration for why that is sound.
    if (settledIngressIDs.has(ingress.id)) continue
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
        surfaceOperatorGatedTaskRootIngress({ taskID, ingressID: ingress.id, projection, now: Date.now() })
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
        settledIngressIDs.add(ingress.id)
        break
      }
      if (projection.state === "exhausted") {
        // Absorbing for this ingress but not for the Task: later ingresses may
        // still run. The gate is surfaced so the abandoned work is visible,
        // and only a surfaced gate may be memoized.
        settle(projection)
        settledIngressIDs.add(ingress.id)
        break
      }
      if (projection.state === "host_fault") {
        // A Host fault is local to this ingress. It executed no effect — the
        // reduction returns it before any decision can be read as one — so the
        // FIFO continues to the next ingress instead of holding every later
        // operator message behind the Host's own broken write. Each later
        // ingress reads its own evidence, so nothing runs under the violation.
        //
        // Deliberately not memoized, unlike `exhausted`: the invariant this
        // names can be repaired by a later append, and a process-local memo
        // would make this process blind to the repair until it restarts. The
        // surfaced artifact is deterministic, so re-observing costs one
        // evidence read and no duplicate fact.
        settle(projection)
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
      return {
        activated: activated + recovered,
        ...(wakeAt === undefined ? {} : { wakeAt }),
        ...(noProgress ? { noProgress: true } : {}),
      }
    }
  }
  return { activated: activated + recovered }
}

const driverState = createInstanceState(
  () => {
    const directory = Filesystem.resolve(Instance.directory)
    // Every Project driver joins one process-wide owner. Recovery in another
    // backend reads this row before it may settle our dispatches, so joining
    // and asserting the exact occurrence precedes every scan.
    const liveness = joinProcessLivenessLease(ownerOccurrenceID())
    return {
      driver: new TaskControlDriver({
        scan: async (taskID, context) => {
          liveness.assertOwned(ownerOccurrenceID())
          return scanTaskControlPlane(taskID, context)
        },
        liveTasks: () => {
          try {
            return currentSweepProjectTaskIDs()
          } catch (error) {
            log.error("Task-control heartbeat could not enumerate live Tasks", { error })
            return []
          }
        },
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
  // A project-wide request only has to *start* every Task. Awaiting them in
  // sequence would make each Task's whole Orchestrator Turn a prerequisite of
  // the next Task's first scan — at startup that serializes recovery for the
  // entire project behind one Provider call, and it is the reason project open
  // could block for minutes. Faults stay isolated per Task inside the driver.
  const results = await Promise.allSettled(currentSweepProjectTaskIDs().map((id) => driver.request(id)))
  let activated = 0
  for (const result of results) {
    if (result.status === "fulfilled") activated += result.value
    else log.error("project Task-control reconciliation faulted", { error: result.reason })
  }
  return activated
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
  const accepted = Database.transaction((db) => {
    if (event.dispatchInfrastructureFailure) {
      const epoch = taskLifecycleProjectionInTransaction(db, task.id).epoch
      if (
        countInfrastructureFailureIngressesInTransaction(db, task.id, epoch) >=
        TASK_EPOCH_INFRASTRUCTURE_INGRESS_BUDGET
      ) {
        // The failure stays recorded and visible; only the automatic retry
        // stops. Suppressing the wake is what makes the measure well-founded.
        recordTaskInfrastructureErrorInTransaction(db, {
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
        log.warn("suppressed an infrastructure-failure wake; epoch retry budget is spent", {
          taskID: task.id,
          epoch,
          suppressedInfrastructureFactID: event.dispatchInfrastructureFailure.infrastructureFactID,
        })
        return false
      }
    }
    persistTaskRootIngressInTransaction(db, task, event, identity)
    return true
  })
  if (!accepted) return "suppressed_budget_exhausted"
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
      // Write the same v1 context the readers parse. The v1 reader contract
      // shipped without this writer following it, so every graceful shutdown
      // minted a fact the next build refused — and refused as HTTP 500 for
      // the whole Task view. Readers keep a legacy branch for rows written
      // before this; the writer must never widen that set again.
      const affectedSubjects = item.ownedSessionIDs
        .toSorted()
        .flatMap((sessionID) => {
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
  | "nonterminal"
  | "already_delivered"
  | "delivered"
export async function reconcileTerminalAgentLifecycleDelivery(input: {
  taskID: string
  sessionID: string
  dispatchID: string
}): Promise<TerminalAgentLifecycleDeliveryReconciliation> {
  const lineage = listDispatchLineage(input.taskID).find(
    (row) => row.dispatchID === input.dispatchID && row.payload.child_session_id === input.sessionID,
  )
  if (!lineage) return "missing_lineage"
  const descriptor = WorkerTurnDescriptor.findForDispatch({ sessionID: input.sessionID, dispatchID: input.dispatchID })
  if (!descriptor) return "missing_descriptor"
  const lifecycle = ProtocolStore.latestSessionOccurrenceEvent(
    input.sessionID,
    "agent.execution.lifecycle",
    descriptor.payload.messageAuthority.user_message_id,
  )
  if (!lifecycle || (lifecycle.payload?.status as { type?: string } | undefined)?.type !== "terminal")
    return "nonterminal"
  if (!findDispatchSettlementByDispatchID({ taskID: input.taskID, dispatchID: input.dispatchID })) {
    const final = Database.use((db) =>
      db
        .select({ id: MessageTable.id })
        .from(MessageTable)
        .where(
          and(
            eq(MessageTable.session_id, input.sessionID),
            sql`json_extract(${MessageTable.data}, '$.role') = 'assistant'`,
            sql`json_extract(${MessageTable.data}, '$.time.completed') IS NOT NULL`,
          ),
        )
        .orderBy(sql`${MessageTable.time_created} DESC`, sql`${MessageTable.id} DESC`)
        .get(),
    )
    if (!final) return "nonterminal"
    settleDispatchOrReturnExisting({
      taskID: input.taskID,
      dispatchID: input.dispatchID,
      outcome: DispatchOutcome.partial({
        sessionID: input.sessionID,
        finalMessageID: final.id,
        failedOperation: "recover_dispatch_domain_settlement",
      }),
    })
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
  await dispatchTaskLoop({
    taskID: input.taskID,
    event: {
      note: `Worker Session ${input.sessionID} completed dispatch ${input.dispatchID}.`,
      agentLifecycleDelivery: { eventID: lifecycle.id, sessionID: input.sessionID, dispatchID: input.dispatchID },
    },
  })
  return "delivered"
}

export async function waitForIngressDeliveryHooksForTest(): Promise<void> {
  await Promise.all([...completionHooks])
}

export const TestHooks = {
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
