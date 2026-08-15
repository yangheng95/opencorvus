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
import { OrchestratorEventSchema, type OrchestratorEvent } from "@/orchestrator/event"
import {
  isOrchestratorDecisionToolName,
  orchestratorDecisionToolCompletionEffect,
} from "@/orchestrator/decision-tool-names"
import { Instance } from "@/project/instance"
import { runWithInitializedIndependentProject } from "@/project/independent-project-owner"
import { createInstanceState } from "@/project/instance-state"
import { ProtocolEventTable } from "@/protocol/protocol.sql"
import { ProtocolStore } from "@/protocol/store"
import { currentRuntimeProcessOccurrence } from "@/runtime/process-occurrence"
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
import { TaskRootMessageProvenance } from "@/task-api/task-root-message"
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
  reduceTaskRootIngressFacts,
  taskRootIngressSemanticAttemptIDs,
  taskRootIngressSemanticTurnIDs,
} from "./task-root-ingress-reducer"
import { TaskRootIngressError, taskRootDirectory } from "./task-directory"
import { listDispatchLineage } from "./dispatch-lineage"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { findDispatchSettlementByDispatchID, settleDispatchOrReturnExisting } from "./dispatch-settlement"
import { DispatchOutcome } from "@/agent/dispatch-outcome"
import { recordTaskInfrastructureErrorInTransaction } from "./persist"
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
let runtimeOccurrenceOverrideForTest: string | undefined

export type TaskIngressRunResult = { finalMessageID?: string }
type TaskIngressRunner = (input: {
  taskID: string
  event?: OrchestratorEvent
  signal?: AbortSignal
  wakeID?: string
  activationID?: string
  predecessorID?: string
}) => Promise<TaskIngressRunResult | void>

const runtimeState = createInstanceState(
  () => {
    const directory = Filesystem.resolve(Instance.directory)
    activeProjectDirectories.add(directory)
    return {
      directory,
      runner: undefined as TaskIngressRunner | undefined,
      runnerOverrideForTest: undefined as TaskIngressRunner | undefined,
    }
  },
  async (state) => {
    activeProjectDirectories.delete(state.directory)
  },
  "task-root-fact-runner",
)

function ownerOccurrenceID(): string {
  return runtimeOccurrenceOverrideForTest ?? currentRuntimeProcessOccurrence().occurrenceID
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

export function persistTaskRootIntentIngressInTransaction(
  db: Database.TxOrDb,
  input: { task: TaskRow; intent: "retry" | "replan"; supersededOperatorMessageIDs: string[]; now: number },
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

export function persistCoordinationIngressInTransaction(
  db: Database.TxOrDb,
  input: { taskID: string; rootSessionID: string; requestID: string; now?: number },
): string {
  const task = findTask(input.taskID)
  if (!task || task.session_id !== input.rootSessionID)
    throw new Error(`Coordination request ${input.requestID} has no exact Task root Session`)
  return persistTaskRootIngressInTransaction(
    db,
    task,
    { coordinationRequest: { requestID: input.requestID } },
    { requestID: input.requestID },
    input.now ?? Date.now(),
  )
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
      throw new Error(`Task-root ingress ${ingress.id} references missing Task creation ${ingress.source_id}`)
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
      throw new Error(`Task-root ingress ${ingress.id} references invalid Automation run ${ingress.source_id}`)
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
      throw new Error(`Task-root ingress ${ingress.id} references invalid Engine Artifact ${ingress.source_id}`)
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
      throw new Error(`Task-root ingress ${ingress.id} references missing Protocol Event ${ingress.source_id}`)
    if (event.type === "agent.execution.lifecycle") {
      const payload = event.payload as Record<string, unknown>
      const sessionID = event.session_id
      const inputMessageID = typeof payload.inputMessageID === "string" ? payload.inputMessageID : undefined
      if (!sessionID || !inputMessageID) {
        throw new Error(`Agent lifecycle Protocol Event ${event.id} has no exact Session/input Message authority`)
      }
      const descriptor = WorkerTurnDescriptor.findForMessageAuthority({ sessionID, inputMessageID })
      const dispatchID = descriptor?.payload.dispatchTurn?.current_dispatch_id
      if (!descriptor || descriptor.payload.lifecycle.taskID !== ingress.task_id || !dispatchID) {
        throw new Error(`Agent lifecycle Protocol Event ${event.id} has no exact Worker Turn dispatch authority`)
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
  if (!row) throw new Error(`Task-root ingress ${ingress.id} references missing Message ${ingress.source_id}`)
  const message = Message.Info.parse({ ...row.data, id: row.id, sessionID: row.sessionID })
  if (message.role !== "user")
    throw new Error(`Task-root ingress ${ingress.id} source Message is not participant-authored input`)
  const provenance = TaskRootMessageProvenance.parse(message.extra?.task_root_message)
  return OrchestratorEventSchema.parse({
    note: `Task-root Message ${message.id}`,
    rootMessage: {
      messageID: message.id,
      kind: provenance.kind,
      ...(provenance.schedulerDelivery ? { schedulerDelivery: provenance.schedulerDelivery } : {}),
    },
  })
}

function interactionFacts(db: Database.TxOrDb, ingressID: string, assistantIDs: Set<string>): InteractionFact[] {
  return db
    .select()
    .from(EngineInteractionRequestTable)
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
  if (!task?.sessionID) throw new Error(`Task-root ingress ${ingress.id} has no root Session authority`)
  for (const row of assistantRows) {
    const assistant = Message.Assistant.parse({ ...row.data, id: row.id, sessionID: row.session_id })
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
      throw new Error(`Task-root activation ${assistant.activationID} has conflicting assistant authority`)
    }
    activationAssistants.set(assistant.activationID, assistant.id)
    const priorContinuationAssistant = continuationAssistants.get(assistant.parentID)
    if (priorContinuationAssistant && priorContinuationAssistant !== assistant.id) {
      throw new Error(`Task-root continuation ${assistant.parentID} has multiple assistant Messages`)
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
      throw new Error(`Assistant Message ${assistant.id} is outside ingress ${ingress.id} continuation chain`)
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
  const interactions = interactionFacts(db, ingress.id, assistantIDs)
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
    readTaskRootIngressEvidence(db, ingress)
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
          throw new Error(`Expired Task-root assistant ${assistant.id} has no matching activation lease`)
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

async function activate(input: { taskID: string; ingressID: string }): Promise<boolean> {
  let reservation: RuntimeExecutionReservation | undefined
  let bound = false
  reservation = RuntimeExecutionSettlement.reserve(
    "task_control_activation",
    `task-control:${input.taskID}:${input.ingressID}`,
  )
  try {
    const now = Date.now()
    const evidence = evidenceFor(input.ingressID)
    const projection = projectTaskRootIngress(input.ingressID, now, readTaskRootIngressEvidence)
    if (projection.state !== "ready") {
      reservation.settle()
      return false
    }
    const ownerID = ownerOccurrenceID()
    const acquired = acquireTaskRootIngressLease({
      ingressID: input.ingressID,
      ownerOccurrenceID: ownerID,
      now,
      leaseMilliseconds,
      readEvidence: readTaskRootIngressEvidence,
    })
    if (!acquired.acquired) {
      reservation.settle()
      return false
    }
    const ingress = Database.use((db) =>
      db.select().from(EngineTaskRootIngressTable).where(eq(EngineTaskRootIngressTable.id, input.ingressID)).get(),
    )!
    const operation = runner()({
      taskID: input.taskID,
      event: eventForIngress(ingress),
      signal: reservation.signal,
      wakeID: ingress.id,
      activationID: acquired.activationID,
      predecessorID: predecessorFor(projection, ingress.id, evidence),
    })
    reservation.settleWith(operation)
    bound = true
    let renewalFailure: unknown
    const renewal = setInterval(() => {
      try {
        const renewalNow = Date.now()
        renewTaskRootIngressLease({
          ingressID: ingress.id,
          activationID: acquired.activationID,
          ownerOccurrenceID: ownerID,
          now: renewalNow,
          expiresAt: renewalNow + leaseMilliseconds,
        })
      } catch (error) {
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
    return true
  } catch (error) {
    if (!bound) reservation.settle()
    throw error
  }
}

/** One project-partitioned recovery/activation algorithm. */
export async function reconcileTaskControlPlane(taskID?: string): Promise<number> {
  const tasks = Database.use((db) =>
    db
      .select({ id: EngineTaskTable.id })
      .from(EngineTaskTable)
      .where(
        and(eq(EngineTaskTable.project_id, Instance.project.id), ...(taskID ? [eq(EngineTaskTable.id, taskID)] : [])),
      )
      .all()
      .filter((task) => !taskDeletedInTransaction(db, task.id)),
  )
  let activated = 0
  for (const task of tasks) {
    const lifecycle = Database.use((db) => taskLifecycleProjectionInTransaction(db, task.id))
    const ingresses = listTaskRootIngresses(task.id, lifecycle.epoch)
    for (const ingress of ingresses) {
      let stopTask = false
      for (;;) {
        const now = Date.now()
        if ((await terminalizeExpiredTaskRootAssistants(ingress.id, now)) > 0) continue
        const projection = projectTaskRootIngress(ingress.id, now, readTaskRootIngressEvidence)
        if (projection.state === "resolved" || projection.state === "terminal_inapplicable") break
        if (projection.state === "exhausted") break
        if (projection.state === "reconcile_required") {
          if (ensureActivityReconciliationInteractions(task.id, ingress.id, projection.requestIDs, now) > 0) continue
          stopTask = true
          break
        }
        if (projection.state === "ready") {
          if (await activate({ taskID: task.id, ingressID: ingress.id })) {
            activated += 1
            continue
          }
        }
        stopTask = true
        break
      }
      if (stopTask) break
    }
  }
  return activated
}

export async function deliverTaskRootIngress(taskID: string): Promise<boolean> {
  return (await reconcileTaskControlPlane(taskID)) > 0
}

export async function deliverPendingTaskRootIngresses(): Promise<number> {
  return reconcileTaskControlPlane()
}

export type DispatchTaskLoopResult = "accepted" | "ignored"
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
  Database.transaction((db) => persistTaskRootIngressInTransaction(db, task, event, identity))
  await input.beforeAcceptedWake?.({ taskID: task.id, result: "accepted" })
  await reconcileTaskControlPlane(task.id)
  return "accepted"
}

export function dispatchTaskLoopInBackground(input: DispatchTaskLoopInput, operation: string): void {
  const completion = dispatchTaskLoop(input)
    .then(() => undefined)
    .catch((error) => {
      log.error("background Task-root reconciliation failed", { taskID: input.taskID, operation, error })
    })
    .finally(() => completionHooks.delete(completion))
  completionHooks.add(completion)
}

export async function dispatchPersistedTaskLoop(
  taskID: string,
  expectedWakeID?: string,
): Promise<DispatchTaskLoopResult> {
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
  await reconcileTaskControlPlane(taskID)
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

export function retirePendingTaskRootIngressesForOperatorIntentInTransaction(
  db: Database.TxOrDb,
  input: { taskID: string; now: number },
): string[] {
  const lifecycle = taskLifecycleProjectionInTransaction(db, input.taskID)
  return db
    .select({ sourceID: EngineTaskRootIngressTable.source_id })
    .from(EngineTaskRootIngressTable)
    .where(
      and(
        eq(EngineTaskRootIngressTable.task_id, input.taskID),
        eq(EngineTaskRootIngressTable.execution_epoch, lifecycle.epoch),
        eq(EngineTaskRootIngressTable.source, "message"),
      ),
    )
    .orderBy(asc(EngineTaskRootIngressTable.sequence))
    .all()
    .map((row) => row.sourceID)
}

/** Ingress facts are immutable. Explicit Task deletion cascades them; ordinary
 * cancellation/discard never rewrites or deletes accepted history. */
export function discardTaskRootIngress(_taskID: string): void {}
export function discardAcceptedTaskRootIngressForRequest(_input: { taskID: string; requestID: string }): void {}

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
      const recoveryFactID = recordTaskInfrastructureErrorInTransaction(db, {
        taskID: item.taskID,
        component: "process-recovery",
        operation: "handoff-process-owned-task-execution",
        reason: input.reason,
        context: { owned_session_ids: item.ownedSessionIDs.toSorted() },
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
    const prior = runtimeOccurrenceOverrideForTest
    runtimeOccurrenceOverrideForTest = value
    return {
      [Symbol.dispose]() {
        runtimeOccurrenceOverrideForTest = prior
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
