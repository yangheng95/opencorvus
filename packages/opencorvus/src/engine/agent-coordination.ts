import {
  ProjectedWorkerBindingSchema,
  sameProjectedWorkerBinding,
  type ProjectedWorkerBinding,
} from "@/agent/projected-worker-binding"
import z from "zod"
import {
  EvidenceLocatorListSchema,
  type EvidenceLocator,
} from "@opencorvus-ai/plugin/artifact-catalog"
import { sameSelectedWorkflowBinding } from "./workflow-binding"
import { Event } from "@/engine/model"
import { EngineProtocol } from "@/engine/protocol"
import { Identifier } from "@/id/id"
import { taskIDForSession } from "@/engine/task-session-lineage"
import { and, asc, desc, eq, inArray, sql } from "@/storage/db"
import { Database } from "@/storage/db"
import { EngineArtifactTable, EngineTaskTable, type EngineArtifactKind, type EngineMetadata } from "./engine.sql"
import { insertEngineArtifact } from "./artifact"
import { findDispatchLineageBySession } from "./dispatch-lineage"
import { parseDispatchLineagePayload } from "./dispatch-lineage-facts"
import { persistCoordinationIngressInTransaction } from "./task-root-ingress-delivery"
import { assertTaskEvidenceLocators } from "./evidence-locator"
import type { AgentCoordinationDecision } from "./agent-coordination-decision"
import { taskLifecycleProjection, taskLifecycleProjectionInTransaction } from "./task-lifecycle"
import {
  AgentCoordinationActionFactSchema,
  AgentCoordinationActionOutcomeFactSchema,
  AgentCoordinationRequestFactSchema,
  AgentCoordinationWorkerToolInputSchema,
  AgentCoordinationResponseFactSchema,
  reduceAgentCoordinationFacts,
  reduceAgentCoordinationActionFacts,
  type AgentCoordinationActionFact,
  type AgentCoordinationActionOutcomeFact,
  type AgentCoordinationProjection,
  type AgentCoordinationRequestFact,
  type AgentCoordinationResponseFact,
} from "./agent-coordination-facts"
import { canonicalDigestSource } from "@/util/canonical-digest"
import { ToolPartRequestTable } from "@/session/session.sql"
import { AgentCoordinationFrontierConflictError, OperatorSteerRequestConflictError } from "./agent-coordination-errors"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { findDispatchLineageByDispatchIDInTransaction } from "./dispatch-lineage-facts"
import { taskDeletedInTransaction } from "./store"
import { AgentCoordinationActionSupersededError } from "./agent-coordination-errors"
import { ProtocolEventTable } from "@/protocol/protocol.sql"

export type { AgentCoordinationDecision } from "./agent-coordination-decision"

export {
  AgentCoordinationRedispatchBindingSchema,
  type AgentCoordinationRedispatchBinding,
} from "./agent-coordination-redispatch"
import {
  AgentCoordinationRedispatchBindingSchema,
  type AgentCoordinationRedispatchBinding,
} from "./agent-coordination-redispatch"

export type AgentCoordinationSeverity = "info" | "blocked" | "failure"

export function agentCoordinationQuestionID(actionID: string): string {
  return Identifier.ascending("question", `que_agent_coordination_${actionID}`)
}
export function agentCoordinationQuestionAskedOccurrenceID(actionID: string): string {
  return `bus-occurrence:agent-coordination-question:${actionID}`
}
export type AgentCoordinationRequestStatus = "pending" | "responded" | "superseded"
export type AgentCoordinationRequestOrigin = "worker_handoff" | "operator_steer"
export type AgentCoordinationActionKind =
  | "cancel_worker"
  | "redispatch_worker"
  | "fail_task"
  | "ask_user"
  | "acknowledge_terminal"
export type AgentCoordinationActionStatus = "pending" | "completed" | "failed" | "superseded"
export type AgentCoordinationSessionLineageSource = "task_session_tree" | "dispatch_lineage"

export interface AgentCoordinationSessionLineage {
  source: AgentCoordinationSessionLineageSource
  executionEpoch: number
  dispatchLineageID?: string
}

export type AgentCoordinationRequestPayload = AgentCoordinationRequestFact & {
  status: AgentCoordinationRequestStatus
  responded_at?: number
  response_id?: string
  last_failed_response_id?: string
  last_failed_action_id?: string
  last_action_error?: string
  last_action_failed_at?: number
  cancelled_at?: number
  cancel_reason?: string
}

export type AgentCoordinationResponsePayload = AgentCoordinationResponseFact

export type AgentCoordinationActionPayload = AgentCoordinationActionFact & {
  status: AgentCoordinationActionStatus
  completed_at?: number
  failed_at?: number
  error?: string
  result?: Record<string, unknown>
}

export interface AgentCoordinationRequestRow {
  artifactID: string
  taskID: string
  payload: AgentCoordinationRequestPayload
  timeCreated: number
  timeUpdated: number
  createdNow: boolean
}

export interface AgentCoordinationResponseRow {
  artifactID: string
  taskID: string
  payload: AgentCoordinationResponsePayload
  timeCreated: number
  timeUpdated: number
  createdNow?: boolean
}

export class AgentCoordinationLineagePendingConflictError extends Error {
  readonly taskID: string
  readonly dispatchLineageID: string
  readonly requestIDs: string[]

  constructor(input: { taskID: string; dispatchLineageID: string; requestIDs: string[] }) {
    super(
      `Dispatch lineage ${input.dispatchLineageID} already has pending coordination request(s): ${input.requestIDs.join(", ")}`,
    )
    this.name = "AgentCoordinationLineagePendingConflictError"
    this.taskID = input.taskID
    this.dispatchLineageID = input.dispatchLineageID
    this.requestIDs = input.requestIDs
  }
}

export interface AgentCoordinationActionRow {
  artifactID: string
  taskID: string
  payload: AgentCoordinationActionPayload
  timeCreated: number
  timeUpdated: number
}

type AgentCoordinationArtifactRow = typeof EngineArtifactTable.$inferSelect

function requireTask(taskID: string): void {
  const row = Database.use((db) =>
    db.select({ id: EngineTaskTable.id }).from(EngineTaskTable).where(eq(EngineTaskTable.id, taskID)).get(),
  )
  if (!row) throw new Error(`Agent coordination task not found: ${taskID}`)
}

function requestForInvocationInTransaction(
  db: Database.TxOrDb,
  input: {
    taskID: string
    sessionID: string
    messageID: string
    callID?: string
  },
): AgentCoordinationRequestRow | undefined {
  const rows = db
    .select()
    .from(EngineArtifactTable)
    .where(
      and(
        eq(EngineArtifactTable.task_id, input.taskID),
        eq(EngineArtifactTable.kind, "agent_coordination_request"),
        sql`json_extract(${EngineArtifactTable.payload}, '$.session_id') = ${input.sessionID}`,
        sql`json_extract(${EngineArtifactTable.payload}, '$.message_id') = ${input.messageID}`,
        sql`coalesce(json_extract(${EngineArtifactTable.payload}, '$.tool_call_id'), '') = ${input.callID ?? ""}`,
      ),
    )
    .all()
  if (rows.length > 1) {
    throw new Error(
      `Agent coordination request invocation ${input.sessionID}/${input.messageID}/${input.callID ?? ""} has ${rows.length} persisted requests`,
    )
  }
  const row = rows[0]
  return row ? requestRowFromArtifact(db, row) : undefined
}

function operatorSteerRequestInTransaction(
  db: Database.TxOrDb,
  input: {
    taskID: string
    operatorSteerID: string
  },
): AgentCoordinationRequestRow | undefined {
  const rows = db
    .select()
    .from(EngineArtifactTable)
    .where(
      and(
        eq(EngineArtifactTable.task_id, input.taskID),
        eq(EngineArtifactTable.id, input.operatorSteerID),
        eq(EngineArtifactTable.kind, "agent_coordination_request"),
      ),
    )
    .all()
  if (rows.length > 1) {
    throw new Error(
      `Operator steer request ${input.operatorSteerID} for task ${input.taskID} has ${rows.length} persisted requests`,
    )
  }
  const row = rows[0]
  return row ? requestRowFromArtifact(db, row) : undefined
}

function requestFactFromArtifact(row: AgentCoordinationArtifactRow): AgentCoordinationRequestFact {
  const parsed = AgentCoordinationRequestFactSchema.safeParse(row.payload)
  if (!parsed.success) throw new Error(`Malformed agent coordination request artifact ${row.id} for task ${row.task_id}`)
  return parsed.data
}

function responseFactFromArtifact(row: AgentCoordinationArtifactRow): AgentCoordinationResponseFact {
  const parsed = AgentCoordinationResponseFactSchema.safeParse(row.payload)
  if (!parsed.success) throw new Error(`Malformed agent coordination response artifact ${row.id} for task ${row.task_id}`)
  return parsed.data
}

function actionFactFromArtifact(row: AgentCoordinationArtifactRow): AgentCoordinationActionFact {
  const parsed = AgentCoordinationActionFactSchema.safeParse(row.payload)
  if (!parsed.success) throw new Error(`Malformed agent coordination action artifact ${row.id} for task ${row.task_id}`)
  return parsed.data
}

function outcomeFactFromArtifact(row: AgentCoordinationArtifactRow): AgentCoordinationActionOutcomeFact {
  const parsed = AgentCoordinationActionOutcomeFactSchema.safeParse(row.payload)
  if (!parsed.success) throw new Error(`Malformed agent coordination outcome artifact ${row.id} for task ${row.task_id}`)
  return parsed.data
}

function coordinationProjectionInTransaction(
  db: Database.TxOrDb,
  request: AgentCoordinationRequestFact,
): AgentCoordinationProjection {
  const rows = db
    .select()
    .from(EngineArtifactTable)
    .where(
      and(
        eq(EngineArtifactTable.task_id, request.task_id),
        inArray(EngineArtifactTable.kind, [
          "agent_coordination_response",
          "agent_coordination_action",
          "agent_coordination_action_outcome",
        ]),
        sql`json_extract(${EngineArtifactTable.payload}, '$.request_id') = ${request.request_id}`,
      ),
    )
    .orderBy(asc(EngineArtifactTable.time_created), asc(EngineArtifactTable.id))
    .all()
  return reduceAgentCoordinationFacts({
    request,
    responses: rows.filter((row) => row.kind === "agent_coordination_response").map(responseFactFromArtifact),
    actions: rows.filter((row) => row.kind === "agent_coordination_action").map(actionFactFromArtifact),
    outcomes: rows.filter((row) => row.kind === "agent_coordination_action_outcome").map(outcomeFactFromArtifact),
    currentExecutionEpoch: taskLifecycleProjectionInTransaction(db, request.task_id).epoch,
  })
}

function requestRowsFromArtifacts(
  db: Database.TxOrDb,
  rows: readonly AgentCoordinationArtifactRow[],
): AgentCoordinationRequestRow[] {
  if (rows.length === 0) return []
  const requests = rows.map((row) => ({ row, fact: requestFactFromArtifact(row) }))
  const requestIDs = requests.map(({ fact }) => fact.request_id)
  const frontierOutcomes = db
    .select()
    .from(EngineArtifactTable)
    .where(
      and(
        eq(EngineArtifactTable.task_id, requests[0]!.fact.task_id),
        eq(EngineArtifactTable.kind, "agent_coordination_action_outcome"),
        sql`${EngineArtifactTable.id} IN (
          SELECT (
            SELECT candidate.id
            FROM engine_artifact candidate INDEXED BY engine_agent_coordination_outcome_request_idx
            WHERE candidate.task_id=${requests[0]!.fact.task_id}
              AND candidate.kind='agent_coordination_action_outcome'
              AND json_extract(candidate.payload,'$.request_id')=selected.value
              AND json_extract(candidate.payload,'$.status')='failed'
            ORDER BY candidate.time_created DESC, candidate.id DESC
            LIMIT 1
          )
          FROM json_each(${JSON.stringify(requestIDs)}) selected
        )`,
      ),
    )
    .all()
  if (frontierOutcomes.length > requests.length) {
    throw new Error(`Agent coordination pending frontier contains more terminal outcomes than requests`)
  }
  const actionIDs = frontierOutcomes.map((row) => outcomeFactFromArtifact(row).action_id)
  const actionRows =
    actionIDs.length === 0
      ? []
      : db
          .select()
          .from(EngineArtifactTable)
          .where(
            and(
              eq(EngineArtifactTable.task_id, requests[0]!.fact.task_id),
              eq(EngineArtifactTable.kind, "agent_coordination_action"),
              inArray(EngineArtifactTable.id, actionIDs),
            ),
          )
          .all()
  const responseIDs = actionRows.map((row) => actionFactFromArtifact(row).response_id)
  const responseRows =
    responseIDs.length === 0
      ? []
      : db
          .select()
          .from(EngineArtifactTable)
          .where(
            and(
              eq(EngineArtifactTable.task_id, requests[0]!.fact.task_id),
              eq(EngineArtifactTable.kind, "agent_coordination_response"),
              inArray(EngineArtifactTable.id, responseIDs),
            ),
          )
          .all()
  const outcomeByRequest = new Map<string, AgentCoordinationActionOutcomeFact>()
  for (const row of frontierOutcomes) {
    const fact = outcomeFactFromArtifact(row)
    if (outcomeByRequest.has(fact.request_id)) {
      throw new Error(`Agent coordination request ${fact.request_id} has multiple pending frontier outcomes`)
    }
    outcomeByRequest.set(fact.request_id, fact)
  }
  const actionByID = new Map(actionRows.map((row) => [row.id, actionFactFromArtifact(row)]))
  const responseByID = new Map(responseRows.map((row) => [row.id, responseFactFromArtifact(row)]))
  return requests.map(({ row, fact }) => {
    const lastFailedOutcome = outcomeByRequest.get(fact.request_id)
    const lastFailedAction = lastFailedOutcome ? actionByID.get(lastFailedOutcome.action_id) : undefined
    const lastFailedResponse = lastFailedAction ? responseByID.get(lastFailedAction.response_id) : undefined
    if (lastFailedOutcome && (!lastFailedAction || !lastFailedResponse)) {
      throw new Error(`Agent coordination request ${fact.request_id} has an incomplete pending frontier`)
    }
    const projection: AgentCoordinationProjection = {
      status: "pending",
      frontierID: lastFailedOutcome?.outcome_id ?? fact.request_id,
      previousFailedOutcomeID: lastFailedOutcome?.outcome_id,
      lastFailedResponse,
      lastFailedAction,
      lastFailedOutcome,
      failedAttempts: lastFailedOutcome ? 1 : 0,
    }
    return {
      artifactID: row.id,
      taskID: row.task_id,
      payload: projectedRequestPayload(fact, projection),
      timeCreated: row.time_created,
      timeUpdated: row.time_updated,
      createdNow: false,
    }
  })
}

function projectedRequestPayload(
  request: AgentCoordinationRequestFact,
  projection: AgentCoordinationProjection,
): AgentCoordinationRequestPayload {
  return {
    ...request,
    status: projection.status,
    ...(projection.response
      ? { responded_at: projection.response.created_at, response_id: projection.response.response_id }
      : {}),
    ...(projection.previousFailedOutcomeID
      ? {
          last_failed_response_id: projection.lastFailedResponse?.response_id,
          last_failed_action_id: projection.lastFailedAction?.action_id,
          last_action_error: projection.lastFailedOutcome?.error,
          last_action_failed_at: projection.lastFailedOutcome?.created_at,
        }
      : {}),
    ...(projection.status === "superseded"
      ? {
          cancelled_at: request.created_at,
          cancel_reason: "superseded by a newer Task execution epoch",
        }
      : {}),
  }
}

function requestRowFromArtifact(db: Database.TxOrDb, row: AgentCoordinationArtifactRow): AgentCoordinationRequestRow {
  const request = requestFactFromArtifact(row)
  const payload = projectedRequestPayload(request, coordinationProjectionInTransaction(db, request))
  return {
    artifactID: row.id,
    taskID: row.task_id,
    payload,
    timeCreated: row.time_created,
    timeUpdated: row.time_updated,
    createdNow: false,
  }
}

function responseRowFromArtifact(row: AgentCoordinationArtifactRow): AgentCoordinationResponseRow {
  const payload = responseFactFromArtifact(row)
  return {
    artifactID: row.id,
    taskID: row.task_id,
    payload,
    timeCreated: row.time_created,
    timeUpdated: row.time_updated,
  }
}

function actionKindForDecision(decision: AgentCoordinationDecision): AgentCoordinationActionKind {
  if (decision === "cancel_worker") return "cancel_worker"
  if (decision === "redispatch") return "redispatch_worker"
  return decision
}

function projectedActionPayload(
  action: AgentCoordinationActionFact,
  outcomes: readonly AgentCoordinationActionOutcomeFact[],
  superseded = false,
): AgentCoordinationActionPayload {
  const projection = reduceAgentCoordinationActionFacts({
    action,
    outcomes,
    currentExecutionEpoch: superseded ? action.execution_epoch + 1 : action.execution_epoch,
  })
  const terminal = projection.terminalOutcome
  const result = Object.assign(
    {},
    ...(action.redispatch_binding ? [{ redispatch_binding: action.redispatch_binding }] : []),
    projection.result,
  ) as Record<string, unknown>
  return {
    ...action,
    status: projection.status,
    ...(Object.keys(result).length > 0 ? { result } : {}),
    ...(terminal?.status === "completed" ? { completed_at: terminal.created_at } : {}),
    ...(terminal?.status === "failed" || projection.status === "superseded"
      ? {
          failed_at: terminal?.created_at ?? action.created_at,
          error: terminal?.error ?? "superseded by a newer Task execution epoch",
        }
      : {}),
  }
}

function actionRowFromArtifact(db: Database.TxOrDb, row: AgentCoordinationArtifactRow): AgentCoordinationActionRow {
  const action = actionFactFromArtifact(row)
  const outcomeRows = db
    .select()
    .from(EngineArtifactTable)
    .where(
      and(
        eq(EngineArtifactTable.task_id, action.task_id),
        eq(EngineArtifactTable.kind, "agent_coordination_action_outcome"),
        sql`json_extract(${EngineArtifactTable.payload}, '$.action_id') = ${action.action_id}`,
      ),
    )
    .all()
  const lifecycle = taskLifecycleProjectionInTransaction(db, action.task_id)
  const payload = projectedActionPayload(
    action,
    outcomeRows.map(outcomeFactFromArtifact),
    lifecycle.epoch !== action.execution_epoch,
  )
  return {
    artifactID: row.id,
    taskID: row.task_id,
    payload,
    timeCreated: row.time_created,
    timeUpdated: row.time_updated,
  }
}

function assertAgentCoordinationActionPayload(payload: AgentCoordinationActionFact): void {
  if (!AgentCoordinationActionFactSchema.safeParse(payload).success) {
    throw new Error(`Malformed agent coordination action payload: ${payload.action_id}`)
  }
}

function emitAgentCoordinationActionEventInTransaction(input: {
  taskID: string
  sessionID: string
  payload: AgentCoordinationActionPayload
  summary: string
}): void {
  EngineProtocol.emitInTransaction(
    Event.AgentCoordinationActionUpdated,
    {
      taskID: input.taskID,
      requestID: input.payload.request_id,
      responseID: input.payload.response_id,
      actionID: input.payload.action_id,
      sessionID: input.sessionID,
      action: input.payload.action,
      status: input.payload.status,
      summary: input.summary,
    },
    {
      taskID: input.taskID,
      sessionID: input.sessionID,
      source: "orchestrator",
      target: input.payload.target_agent,
      correlationID: input.payload.request_id,
      causationID: input.payload.action_id,
    },
  )
}

function actionErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function assertRequestedDecisionIsNotRedispatchActionLiteral(value: string): void {
  const normalized = value.trim().toLowerCase()
  if (normalized === "redispatch" || normalized === "redispatch_worker") {
    throw new Error(
      "Agent coordination requested_decision must describe the scheduling question, not the redispatch response action literal.",
    )
  }
}

function sameRedispatchBinding(left: unknown, right: AgentCoordinationRedispatchBinding | undefined): boolean {
  const parsed = AgentCoordinationRedispatchBindingSchema.safeParse(left)
  if (!parsed.success || !right) return !parsed.success && right === undefined
  return (
    sameProjectedWorkerBinding(parsed.data, right) &&
    parsed.data.sourceDispatchLineageID === right.sourceDispatchLineageID &&
    parsed.data.sourceDispatchID === right.sourceDispatchID &&
    sameSelectedWorkflowBinding(parsed.data.workflowBinding, right.workflowBinding) &&
    parsed.data.workflowNodeID === right.workflowNodeID &&
    parsed.data.workflowOccurrenceID === right.workflowOccurrenceID &&
    JSON.stringify(parsed.data.deliverySliceRevisionIDs) === JSON.stringify(right.deliverySliceRevisionIDs)
  )
}

function normalizeRedispatchBinding(
  value: unknown,
  expectedAgent: string,
): AgentCoordinationRedispatchBinding | undefined {
  const parsed = AgentCoordinationRedispatchBindingSchema.safeParse(value)
  if (!parsed.success || parsed.data.identity.agentID !== expectedAgent) return undefined
  return parsed.data
}

function deriveAgentCoordinationRedispatchBinding(input: {
  decision: AgentCoordinationDecision
  request: AgentCoordinationRequestRow
  db: Database.TxOrDb
}): AgentCoordinationRedispatchBinding | undefined {
  if (input.decision !== "redispatch") return undefined
  const sourceDispatchLineageID = input.request.payload.dispatch_lineage_id
  if (!sourceDispatchLineageID) {
    throw new Error(
      `Agent coordination redispatch request ${input.request.payload.request_id} has no original dispatch lineage`,
    )
  }
  const sourceRow = input.db
    .select()
    .from(EngineArtifactTable)
    .where(
      and(
        eq(EngineArtifactTable.task_id, input.request.payload.task_id),
        eq(EngineArtifactTable.id, sourceDispatchLineageID),
        eq(EngineArtifactTable.kind, "dispatch_lineage"),
      ),
    )
    .get()
  if (!sourceRow) {
    throw new Error(`Agent coordination redispatch source lineage ${sourceDispatchLineageID} does not exist`)
  }
  const source = parseDispatchLineagePayload(sourceRow.payload, sourceRow.id)
  if (
    source.child_session_id !== input.request.payload.session_id ||
    source.target_agent_id !== input.request.payload.agent ||
    !sameProjectedWorkerBinding(input.request.payload.worker_binding, {
      ...input.request.payload.worker_binding,
      identity: source.projected_worker_identity,
    })
  ) {
    throw new Error(
      `Agent coordination redispatch source lineage ${sourceDispatchLineageID} does not match the frozen request`,
    )
  }
  return AgentCoordinationRedispatchBindingSchema.parse({
    ...input.request.payload.worker_binding,
    sourceDispatchLineageID,
    sourceDispatchID: source.dispatch_id,
    workflowBinding: source.workflow_binding,
    workflowNodeID: source.workflow_node_id,
    workflowOccurrenceID: source.workflow_occurrence_id,
    deliverySliceRevisionIDs: source.delivery_slice_revision_ids,
  })
}

function redispatchBindingFromExistingAction(input: {
  request: AgentCoordinationRequestRow
  existingAction: AgentCoordinationActionRow
}): AgentCoordinationRedispatchBinding | undefined {
  if (input.existingAction.payload.action !== "redispatch_worker") return undefined
  const rawBinding = input.existingAction.payload.result?.redispatch_binding
  if (!rawBinding || typeof rawBinding !== "object" || Array.isArray(rawBinding)) {
    throw new Error(
      `Agent coordination redispatch action ${input.existingAction.payload.action_id} has malformed redispatch_binding`,
    )
  }
  const binding = normalizeRedispatchBinding(rawBinding, input.request.payload.agent)
  if (!binding) {
    throw new Error(
      `Agent coordination redispatch action ${input.existingAction.payload.action_id} has invalid redispatch_binding`,
    )
  }
  return binding
}

function assertReplayMatchesExistingResponse(input: {
  existingResponse: AgentCoordinationResponseRow
  existingAction: AgentCoordinationActionRow
  requestID: string
  taskID: string
  orchestratorSessionID: string
  orchestratorMessageID: string
  orchestratorToolCallID: string
  orchestratorToolPartID: string
  decision: AgentCoordinationDecision
  reason: string
  message?: string
  redispatchBinding?: AgentCoordinationRedispatchBinding
}): void {
  const response = input.existingResponse.payload
  const action = input.existingAction.payload
  const mismatches: string[] = []
  if (response.request_id !== input.requestID) mismatches.push("request_id")
  if (response.task_id !== input.taskID) mismatches.push("task_id")
  if (response.orchestrator_session_id !== input.orchestratorSessionID) mismatches.push("orchestrator_session_id")
  if (response.orchestrator_message_id !== input.orchestratorMessageID) mismatches.push("orchestrator_message_id")
  if (response.orchestrator_tool_call_id !== input.orchestratorToolCallID) mismatches.push("orchestrator_tool_call_id")
  if (response.orchestrator_tool_part_id !== input.orchestratorToolPartID) mismatches.push("orchestrator_tool_part_id")
  if (response.decision !== input.decision) mismatches.push("decision")
  if (response.reason !== input.reason) mismatches.push("reason")
  if ((response.message ?? undefined) !== (input.message ?? undefined)) mismatches.push("message")
  if (!sameRedispatchBinding(action.redispatch_binding, input.redispatchBinding)) {
    mismatches.push("redispatch_binding")
  }
  if (mismatches.length > 0) {
    throw new AgentCoordinationFrontierConflictError({
      message: `Agent coordination response replay mismatch for ${input.requestID}: ${mismatches.join(", ")}`,
      taskID: input.taskID,
      requestID: input.requestID,
      frontierID: input.existingResponse.payload.frontier_id,
      mismatches,
    })
  }
}

function sameEvidenceLocatorList(
  left: readonly EvidenceLocator[] | undefined,
  right: readonly EvidenceLocator[] | undefined,
): boolean {
  const leftList = left ?? []
  const rightList = right ?? []
  if (leftList.length !== rightList.length) return false
  return leftList.every((value, index) => JSON.stringify(value) === JSON.stringify(rightList[index]))
}

function assertReplayMatchesExistingRequest(input: {
  existing: AgentCoordinationRequestRow
  callID?: string
  agent: string
  workerBinding: ProjectedWorkerBinding
  summary: string
  details: string
  blocking: boolean
  requestedDecision: string
  toolInput: z.input<typeof AgentCoordinationWorkerToolInputSchema>
  evidenceLocators?: EvidenceLocator[]
  severity: AgentCoordinationSeverity
  deliverySliceSubject?: string
}): void {
  const payload = input.existing.payload
  const mismatches: string[] = []
  if (payload.origin !== "worker_handoff") mismatches.push("origin")
  if ((payload.tool_call_id ?? "") !== (input.callID ?? "")) mismatches.push("tool_call_id")
  if (payload.agent !== input.agent) mismatches.push("agent")
  if (!sameProjectedWorkerBinding(payload.worker_binding, input.workerBinding)) mismatches.push("worker_binding")
  if (
    canonicalDigestSource("agent-coordination-worker-tool-input.v1", payload.tool_input ?? {}).bytes !==
    canonicalDigestSource("agent-coordination-worker-tool-input.v1", input.toolInput).bytes
  ) {
    mismatches.push("tool_input")
  }
  if (payload.summary !== input.summary) mismatches.push("summary")
  if (payload.details !== input.details) mismatches.push("details")
  if (payload.blocking !== input.blocking) mismatches.push("blocking")
  if (payload.requested_decision !== input.requestedDecision) mismatches.push("requested_decision")
  if (!sameEvidenceLocatorList(payload.evidence_locators, input.evidenceLocators)) {
    mismatches.push("evidence_locators")
  }
  if (payload.severity !== input.severity) mismatches.push("severity")
  if ((payload.delivery_slice_subject ?? undefined) !== (input.deliverySliceSubject ?? undefined)) {
    mismatches.push("delivery_slice_subject")
  }
  if (mismatches.length === 0) return
  throw new Error(
    `Agent coordination request replay for message ${payload.message_id} conflicts with existing request ${payload.request_id}: ${mismatches.join(", ")}`,
  )
}

function assertReplayMatchesExistingOperatorSteerRequest(input: {
  existing: AgentCoordinationRequestRow
  taskID: string
  sessionID: string
  requestID: string
  operatorMessage: string
}): void {
  const payload = input.existing.payload
  const mismatches: string[] = []
  if (payload.origin !== "operator_steer") mismatches.push("origin")
  if (payload.task_id !== input.taskID) mismatches.push("task_id")
  if (payload.session_id !== input.sessionID) mismatches.push("session_id")
  if (payload.operator_steer_id !== input.requestID) mismatches.push("request_id")
  if ((payload.operator_message ?? "") !== input.operatorMessage) mismatches.push("operator_message")
  if (mismatches.length === 0) return
  throw new OperatorSteerRequestConflictError({
    message: `Operator steer request ${input.requestID} conflicts with its immutable accepted request: ${mismatches.join(", ")}`,
    taskID: input.taskID,
    sessionID: input.sessionID,
    requestID: input.requestID,
    mismatches,
  })
}

export function assertOperatorSteerCoordinationRequestReplay(input: {
  existing: AgentCoordinationRequestRow
  taskID: string
  sessionID: string
  requestID: string
  operatorMessage: string
}): AgentCoordinationRequestRow {
  assertReplayMatchesExistingOperatorSteerRequest(input)
  return input.existing
}

export function resolveAgentCoordinationSessionLineage(input: {
  taskID: string
  sessionID: string
}): AgentCoordinationSessionLineage {
  const owningTask = taskIDForSession(input.sessionID)
  if (owningTask && owningTask !== input.taskID) {
    throw new Error(`Agent coordination session ${input.sessionID} belongs to task ${owningTask}, not ${input.taskID}`)
  }

  const dispatchLineage = findDispatchLineageBySession({ taskID: input.taskID, sessionID: input.sessionID })

  if (dispatchLineage) {
    return {
      source: "dispatch_lineage",
      executionEpoch: dispatchLineage.payload.execution_epoch,
      dispatchLineageID: dispatchLineage.artifactID,
    }
  }
  if (owningTask === input.taskID) {
    return { source: "task_session_tree", executionEpoch: taskLifecycleProjection(input.taskID).epoch }
  }
  throw new Error(`Agent coordination session ${input.sessionID} is not owned by task ${input.taskID}`)
}

export async function createAgentCoordinationRequest(input: {
  taskID: string
  sessionID: string
  agent: string
  workerBinding: ProjectedWorkerBinding
  messageID: string
  callID: string
  summary: string
  details: string
  blocking: boolean
  requestedDecision: string
  toolInput: z.input<typeof AgentCoordinationWorkerToolInputSchema>
  evidenceLocators?: EvidenceLocator[]
  severity?: AgentCoordinationSeverity
  deliverySliceSubject?: string
  now?: number
}): Promise<AgentCoordinationRequestRow> {
  requireTask(input.taskID)
  const evidenceLocators = await assertTaskEvidenceLocators({
    taskID: input.taskID,
    evidenceLocators: input.evidenceLocators ?? [],
  })
  assertRequestedDecisionIsNotRedispatchActionLiteral(input.requestedDecision)
  const severity = input.severity ?? (input.blocking ? "blocked" : "info")
  const workerBinding = ProjectedWorkerBindingSchema.parse(input.workerBinding)
  const toolInput = AgentCoordinationWorkerToolInputSchema.parse(input.toolInput)
  if (workerBinding.identity.agentID !== input.agent) {
    throw new Error(
      `Agent coordination request agent ${input.agent} does not match worker binding ${workerBinding.identity.agentID}`,
    )
  }

  const now = input.now ?? Date.now()
  const requestID = Identifier.ascending("artifact")

  let replay: AgentCoordinationRequestRow | undefined
  let payload: AgentCoordinationRequestFact | undefined
  try {
    Database.immediateTransaction((db) => {
      replay = requestForInvocationInTransaction(db, {
        taskID: input.taskID,
        sessionID: input.sessionID,
        messageID: input.messageID,
        callID: input.callID,
      })
      if (replay) {
        assertReplayMatchesExistingRequest({
          existing: replay,
          callID: input.callID,
          agent: input.agent,
          workerBinding,
          toolInput,
          summary: input.summary,
          details: input.details,
          blocking: input.blocking,
          requestedDecision: input.requestedDecision,
          evidenceLocators,
          severity,
          deliverySliceSubject: input.deliverySliceSubject,
        })
        return
      }

      const descriptor = WorkerTurnDescriptor.getInDatabase(db, {
        id: workerBinding.workerTurnDescriptorID,
        sessionID: input.sessionID,
      })
      if (!descriptor) {
        throw new Error(
          `Worker coordination handoff ${input.sessionID} requires exact descriptor ${workerBinding.workerTurnDescriptorID}`,
        )
      }
      const descriptorBinding = ProjectedWorkerBindingSchema.parse({
        identity: descriptor.payload.identity,
        expertSquadID: descriptor.payload.expertSquadID,
        workerTurnDescriptorID: descriptor.id,
        workerTurnDescriptorHash: descriptor.hash,
      })
      if (!sameProjectedWorkerBinding(workerBinding, descriptorBinding)) {
        throw new Error(`Worker coordination handoff ${input.sessionID} changed its persisted worker binding`)
      }
      const dispatchTurn = descriptor.payload.dispatchTurn
      if (!dispatchTurn) {
        throw new Error(`Worker coordination descriptor ${descriptor.id} has no dispatch Turn`)
      }
      const dispatchLineage = findDispatchLineageByDispatchIDInTransaction({
        db,
        taskID: input.taskID,
        dispatchID: dispatchTurn.current_dispatch_id,
      })
      if (
        !dispatchLineage ||
        dispatchLineage.payload.child_session_id !== input.sessionID ||
        dispatchLineage.payload.target_agent_id !== input.agent ||
        !sameSelectedWorkflowBinding(dispatchLineage.payload.workflow_binding, dispatchTurn.workflow_binding) ||
        (dispatchLineage.payload.workflow_node_id ?? null) !== (dispatchTurn.workflow_node_id ?? null) ||
        dispatchLineage.payload.workflow_occurrence_id !== dispatchTurn.workflow_occurrence_id ||
        dispatchLineage.payload.delivery_slice_revision_ids.length !== dispatchTurn.delivery_slice_revision_ids.length ||
        dispatchLineage.payload.delivery_slice_revision_ids.some(
          (revisionID, index) => revisionID !== dispatchTurn.delivery_slice_revision_ids[index],
        )
      ) {
        throw new Error(
          `Worker coordination descriptor ${descriptor.id} does not map to one exact dispatch lineage for ${input.sessionID}`,
        )
      }
      const lineage: AgentCoordinationSessionLineage = {
        source: "dispatch_lineage",
        executionEpoch: dispatchLineage.payload.execution_epoch,
        dispatchLineageID: dispatchLineage.artifactID,
      }
      const toolParts = db
        .select({ id: ToolPartRequestTable.id })
        .from(ToolPartRequestTable)
        .where(
          and(
            eq(ToolPartRequestTable.message_id, input.messageID),
            sql`json_extract(${ToolPartRequestTable.data}, '$.callID') = ${input.callID}`,
            sql`json_extract(${ToolPartRequestTable.data}, '$.tool') = 'request_orchestrator_decision'`,
          ),
        )
        .all()
      if (toolParts.length !== 1) {
        throw new Error(
          `Worker coordination request ${input.messageID}/${input.callID} requires one exact Tool Part; found ${toolParts.length}`,
        )
      }
      payload = AgentCoordinationRequestFactSchema.parse({
        request_id: requestID,
        task_id: input.taskID,
        execution_epoch: lineage.executionEpoch,
        session_id: input.sessionID,
        agent: input.agent,
        worker_binding: workerBinding,
        origin: "worker_handoff",
        message_id: input.messageID,
        tool_call_id: input.callID,
        tool_part_id: toolParts[0]!.id,
        tool_input: toolInput,
        ...(input.deliverySliceSubject ? { delivery_slice_subject: input.deliverySliceSubject } : {}),
        summary: input.summary,
        details: input.details,
        blocking: input.blocking,
        requested_decision: input.requestedDecision,
        ...(evidenceLocators.length > 0
          ? { evidence_locators: evidenceLocators }
          : {}),
        severity,
        created_at: now,
        session_lineage_source: lineage.source,
        dispatch_lineage_id: lineage.dispatchLineageID,
      })

      insertEngineArtifact(db, {
        id: requestID,
        taskID: input.taskID,
        kind: "agent_coordination_request" as EngineArtifactKind,
        label: "pending",
        payload,
        timeCreated: now,
      })
      EngineProtocol.emitInTransaction(
        Event.AgentCoordinationRequested,
        {
          taskID: input.taskID,
          requestID,
          sessionID: input.sessionID,
          agent: input.agent,
          blocking: input.blocking,
          severity,
          summary: input.summary,
        },
        {
          taskID: input.taskID,
          sessionID: input.sessionID,
          source: input.agent,
          target: "orchestrator",
          correlationID: requestID,
        },
      )
    })
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? (error as { code?: unknown }).code : undefined
    if (code !== "SQLITE_CONSTRAINT_UNIQUE" || !payload?.dispatch_lineage_id) throw error
    const conflicts = listPendingAgentCoordinationRequests(input.taskID).filter(
      (request) => request.payload.dispatch_lineage_id === payload!.dispatch_lineage_id,
    )
    throw new AgentCoordinationLineagePendingConflictError({
      taskID: input.taskID,
      dispatchLineageID: payload.dispatch_lineage_id,
      requestIDs: conflicts.map((request) => request.payload.request_id),
    })
  }

  if (replay) return replay
  if (!payload) throw new Error(`Agent coordination request ${requestID} was not created`)
  return {
    artifactID: requestID,
    taskID: input.taskID,
    payload: { ...payload, status: "pending" },
    timeCreated: now,
    timeUpdated: now,
    createdNow: true,
  }
}

export async function createOperatorSteerCoordinationRequest(input: {
  taskID: string
  sessionID: string
  sessionKind: string
  operatorMessage: string
  deliverySliceSubject?: string
  operatorSteerID: string
  now?: number
}): Promise<AgentCoordinationRequestRow> {
  requireTask(input.taskID)
  const now = input.now ?? Date.now()
  const requestID = Identifier.schema("artifact").parse(input.operatorSteerID)
  const details = input.operatorMessage

  let replay: AgentCoordinationRequestRow | undefined
  let payload: AgentCoordinationRequestFact | undefined
  Database.immediateTransaction((db) => {
    const collision = db.select().from(EngineArtifactTable).where(eq(EngineArtifactTable.id, requestID)).get()
    if (collision && (collision.task_id !== input.taskID || collision.kind !== "agent_coordination_request")) {
      throw new OperatorSteerRequestConflictError({
        message: `Operator steer request ${requestID} already identifies another durable occurrence`,
        taskID: input.taskID,
        sessionID: input.sessionID,
        requestID,
        mismatches: [collision.task_id !== input.taskID ? "task_id" : "artifact_kind"],
      })
    }
    const task = db
      .select({ rootSessionID: EngineTaskTable.session_id })
      .from(EngineTaskTable)
      .where(eq(EngineTaskTable.id, input.taskID))
      .get()
    if (!task?.rootSessionID) {
      throw new Error(`Operator steer task ${input.taskID} has no root Session for durable delivery`)
    }
    replay = operatorSteerRequestInTransaction(db, {
      taskID: input.taskID,
      operatorSteerID: requestID,
    })
    if (replay) {
      assertReplayMatchesExistingOperatorSteerRequest({
        existing: replay,
        taskID: input.taskID,
        sessionID: input.sessionID,
        requestID,
        operatorMessage: input.operatorMessage,
      })
      return
    }
    const target = WorkerTurnDescriptor.latestProjectedBindingForSessionInDatabase(db, {
      sessionID: input.sessionID,
      taskID: input.taskID,
      sessionKind: input.sessionKind,
    })
    if (!target) {
      throw new Error(`Operator steer session ${input.sessionID} has no persisted WorkerTurnDescriptor identity`)
    }
    const dispatchID = target.descriptor.payload.dispatchTurn?.current_dispatch_id
    if (!dispatchID) {
      throw new Error(`Operator steer descriptor ${target.descriptor.id} has no current dispatch identity`)
    }
    const lineage = findDispatchLineageByDispatchIDInTransaction({ db, taskID: input.taskID, dispatchID })
    if (
      !lineage ||
      lineage.payload.child_session_id !== input.sessionID ||
      lineage.payload.target_agent_id !== target.binding.identity.agentID
    ) {
      throw new Error(
        `Operator steer descriptor ${target.descriptor.id} does not map to one exact dispatch lineage for ${input.sessionID}`,
      )
    }
    const agent = target.binding.identity.agentID
    const summary = `Operator steer for ${agent} session ${input.sessionID}`
    payload = AgentCoordinationRequestFactSchema.parse({
      request_id: requestID,
      task_id: input.taskID,
      execution_epoch: lineage.payload.execution_epoch,
      session_id: input.sessionID,
      agent,
      worker_binding: target.binding,
      origin: "operator_steer",
      operator_steer_id: requestID,
      operator_message: input.operatorMessage,
      ...(input.deliverySliceSubject ? { delivery_slice_subject: input.deliverySliceSubject } : {}),
      summary,
      details,
      blocking: true,
      requested_decision: "operator_steer",
      severity: "blocked",
      created_at: now,
      session_lineage_source: "dispatch_lineage",
      dispatch_lineage_id: lineage.artifactID,
    })

    insertEngineArtifact(db, {
      id: requestID,
      taskID: input.taskID,
      kind: "agent_coordination_request" as EngineArtifactKind,
      label: "pending",
      payload,
      timeCreated: now,
    })
    EngineProtocol.emitInTransaction(
      Event.AgentCoordinationRequested,
      {
        taskID: input.taskID,
        requestID,
        sessionID: input.sessionID,
        agent,
        blocking: true,
        severity: "blocked",
        summary,
      },
      {
        taskID: input.taskID,
        sessionID: input.sessionID,
        source: "operator",
        target: "orchestrator",
        correlationID: requestID,
      },
    )
    persistCoordinationIngressInTransaction(db, {
      taskID: input.taskID,
      rootSessionID: task.rootSessionID,
      requestID,
      now,
    })
  })

  if (replay) return replay
  if (!payload) throw new Error(`Operator steer request ${requestID} was not created`)
  return {
    artifactID: requestID,
    taskID: input.taskID,
    payload: { ...payload, status: "pending" },
    timeCreated: now,
    timeUpdated: now,
    createdNow: true,
  }
}

export function listPendingAgentCoordinationRequests(
  taskID: string,
  transaction?: Database.TxOrDb,
  options?: { sessionID?: string; limit?: number },
): AgentCoordinationRequestRow[] {
  const read = (db: Database.TxOrDb) => {
    const epoch = taskLifecycleProjectionInTransaction(db, taskID).epoch
    const limit = options?.limit ?? 64
    const rows = db
      .select()
      .from(EngineArtifactTable)
      .where(pendingAgentCoordinationPredicate(taskID, epoch, options?.sessionID))
      .orderBy(asc(EngineArtifactTable.time_created), asc(EngineArtifactTable.id))
      .limit(limit)
      .all()
    return requestRowsFromArtifacts(db, rows).filter((row) => row.payload.status === "pending")
  }
  return transaction ? read(transaction) : Database.use(read)
}

function pendingAgentCoordinationPredicate(taskID: string, epoch: number, sessionID?: string) {
  return and(
    eq(EngineArtifactTable.task_id, taskID),
    eq(EngineArtifactTable.kind, "agent_coordination_request"),
    sql`json_extract(${EngineArtifactTable.payload}, '$.execution_epoch') = ${epoch}`,
    ...(sessionID ? [sql`json_extract(${EngineArtifactTable.payload}, '$.session_id') = ${sessionID}`] : []),
    sql`NOT EXISTS (
      SELECT 1 FROM engine_artifact action INDEXED BY engine_agent_coordination_action_request_idx
      WHERE action.task_id=${EngineArtifactTable.task_id}
        AND action.kind='agent_coordination_action'
        AND json_extract(action.payload,'$.request_id')=${EngineArtifactTable.id}
        AND NOT EXISTS (
          SELECT 1 FROM engine_artifact failed INDEXED BY engine_agent_coordination_outcome_action_idx
          WHERE failed.task_id=action.task_id
            AND failed.kind='agent_coordination_action_outcome'
            AND json_extract(failed.payload,'$.action_id')=action.id
            AND json_extract(failed.payload,'$.status')='failed'
        )
    )`,
  )
}

export function countPendingAgentCoordinationRequests(taskID: string): number {
  return Database.use((db) => {
    const epoch = taskLifecycleProjectionInTransaction(db, taskID).epoch
    return (
      db
        .select({ count: sql<number>`count(*)` })
        .from(EngineArtifactTable)
        .where(pendingAgentCoordinationPredicate(taskID, epoch))
        .get()?.count ?? 0
    )
  })
}

/**
 * A2A (Agent-to-Agent) session-control request query.
 * Any pending worker request for the same Session must be answered
 * through respond_agent_coordination before a direct control surface may abort
 * that worker.
 */
export function listPendingAgentCoordinationSessionControlRequests(input: {
  taskID: string
  sessionID: string
}): AgentCoordinationRequestRow[] {
  return listPendingAgentCoordinationRequests(input.taskID, undefined, { sessionID: input.sessionID })
}

export function findAgentCoordinationRequest(input: {
  taskID: string
  requestID: string
}): AgentCoordinationRequestRow | undefined {
  return Database.use((db) => {
    const row = db
      .select()
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.id, input.requestID),
          eq(EngineArtifactTable.kind, "agent_coordination_request"),
        ),
      )
      .get()
    return row ? requestRowFromArtifact(db, row) : undefined
  })
}

export function findAgentCoordinationResponse(input: {
  taskID: string
  responseID: string
}): AgentCoordinationResponseRow | undefined {
  const row = Database.use((db) =>
    db
      .select()
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.id, input.responseID),
          eq(EngineArtifactTable.kind, "agent_coordination_response"),
        ),
      )
      .get(),
  )
  if (!row) return undefined
  return responseRowFromArtifact(row)
}

export function findAgentCoordinationAction(input: {
  taskID: string
  actionID: string
}): AgentCoordinationActionRow | undefined {
  return Database.use((db) => {
    const row = db
      .select()
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.id, input.actionID),
          eq(EngineArtifactTable.kind, "agent_coordination_action"),
        ),
      )
      .get()
    return row ? actionRowFromArtifact(db, row) : undefined
  })
}

/** Resolve one bounded recovery page without scanning Task action history or
 * issuing one outcome query per Interaction. */
export function findAgentCoordinationActionsByIDs(actionIDs: readonly string[]): AgentCoordinationActionRow[] {
  if (actionIDs.length === 0) return []
  if (actionIDs.length > 64) throw new Error(`Agent coordination recovery page exceeds 64 actions`)
  const exactIDs = [...new Set(actionIDs.map((id) => Identifier.schema("artifact").parse(id)))]
  return Database.use((db) => {
    const rows = db
      .select()
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.kind, "agent_coordination_action"),
          inArray(EngineArtifactTable.id, exactIDs),
        ),
      )
      .all()
    const taskIDs = [...new Set(rows.map((row) => row.task_id))]
    const outcomeRows = db
      .select()
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.kind, "agent_coordination_action_outcome"),
          inArray(sql<string>`json_extract(${EngineArtifactTable.payload}, '$.action_id')`, exactIDs),
        ),
      )
      .all()
    const epochRows = taskIDs.length === 0
      ? []
      : db
          .select({
            taskID: ProtocolEventTable.aggregate_id,
            epoch: sql<number>`MAX(json_extract(${ProtocolEventTable.payload}, '$.execution_epoch'))`,
          })
          .from(ProtocolEventTable)
          .where(
            and(
              eq(ProtocolEventTable.aggregate_type, "task"),
              inArray(ProtocolEventTable.aggregate_id, taskIDs),
              inArray(ProtocolEventTable.type, ["task.execution.opened", "task.execution.reopened"]),
            ),
          )
          .groupBy(ProtocolEventTable.aggregate_id)
          .all()
    const currentEpochByTask = new Map(epochRows.map((row) => [row.taskID, Number(row.epoch)]))
    const outcomesByAction = new Map<string, AgentCoordinationActionOutcomeFact[]>()
    for (const outcomeRow of outcomeRows) {
      const outcome = outcomeFactFromArtifact(outcomeRow)
      const current = outcomesByAction.get(outcome.action_id) ?? []
      current.push(outcome)
      outcomesByAction.set(outcome.action_id, current)
    }
    return rows.map((row) => {
      const action = actionFactFromArtifact(row)
      return {
        artifactID: row.id,
        taskID: row.task_id,
        payload: projectedActionPayload(
          action,
          outcomesByAction.get(action.action_id) ?? [],
          currentEpochByTask.get(action.task_id) !== action.execution_epoch,
        ),
        timeCreated: row.time_created,
        timeUpdated: row.time_updated,
      }
    })
  })
}

/** Admit an action-owned downstream effect at its real commit boundary.
 * The caller must invoke this from the same immediate transaction (or while
 * holding that transaction's write lock) that makes the effect observable. */
export function assertCurrentAgentCoordinationActionInTransaction(
  db: Database.TxOrDb,
  input: {
    taskID: string
    actionID: string
    executionEpoch: number
    action: AgentCoordinationActionKind
  },
): AgentCoordinationActionFact {
  const row = db
    .select()
    .from(EngineArtifactTable)
    .where(
      and(
        eq(EngineArtifactTable.task_id, input.taskID),
        eq(EngineArtifactTable.id, input.actionID),
        eq(EngineArtifactTable.kind, "agent_coordination_action"),
      ),
    )
    .get()
  if (!row) throw new Error(`Agent coordination action not found: ${input.actionID}`)
  const action = actionFactFromArtifact(row)
  if (action.execution_epoch !== input.executionEpoch || action.action !== input.action) {
    throw new Error(
      `Agent coordination action ${input.actionID} authority mismatch: ` +
        `expected ${input.action}@${input.executionEpoch}, found ${action.action}@${action.execution_epoch}`,
    )
  }
  const lifecycle = taskLifecycleProjectionInTransaction(db, input.taskID)
  if (lifecycle.epoch !== input.executionEpoch) {
    throw new AgentCoordinationActionSupersededError({
      message:
        `Agent coordination action ${input.actionID} belongs to execution epoch ${input.executionEpoch}, ` +
        `current=${lifecycle.epoch}`,
      taskID: input.taskID,
      actionID: input.actionID,
      expectedExecutionEpoch: input.executionEpoch,
      currentExecutionEpoch: lifecycle.epoch,
      currentTaskStatus: lifecycle.status,
    })
  }
  const projection = actionRowFromArtifact(db, row)
  if (projection.payload.status === "superseded") {
    throw new AgentCoordinationActionSupersededError({
      message: `Agent coordination action ${input.actionID} is superseded`,
      taskID: input.taskID,
      actionID: input.actionID,
      expectedExecutionEpoch: input.executionEpoch,
      currentExecutionEpoch: lifecycle.epoch,
      currentTaskStatus: lifecycle.status,
    })
  }
  if (projection.payload.status !== "pending") {
    throw new Error(`Agent coordination action ${input.actionID} is ${projection.payload.status}`)
  }
  return action
}

/** Admit an action effect that is only legal while its Task execution is
 * active. Terminal fail_task settlement deliberately uses the narrower
 * current-action assertion after appending task.failed in the same transaction. */
export function assertActiveAgentCoordinationActionInTransaction(
  db: Database.TxOrDb,
  input: Parameters<typeof assertCurrentAgentCoordinationActionInTransaction>[1],
): AgentCoordinationActionFact {
  const action = assertCurrentAgentCoordinationActionInTransaction(db, input)
  const lifecycle = taskLifecycleProjectionInTransaction(db, input.taskID)
  if (lifecycle.status !== "active" || taskDeletedInTransaction(db, input.taskID)) {
    throw new AgentCoordinationActionSupersededError({
      message:
        `Agent coordination action ${input.actionID} cannot affect Task ${input.taskID}: ` +
        `execution ${lifecycle.epoch} is ${taskDeletedInTransaction(db, input.taskID) ? "deleted" : lifecycle.status}`,
      taskID: input.taskID,
      actionID: input.actionID,
      expectedExecutionEpoch: input.executionEpoch,
      currentExecutionEpoch: lifecycle.epoch,
      currentTaskStatus: taskDeletedInTransaction(db, input.taskID) ? "deleted" : lifecycle.status,
    })
  }
  return action
}

export async function createAgentCoordinationResponse(input: {
  taskID: string
  requestID: string
  orchestratorSessionID: string
  orchestratorMessageID: string
  orchestratorToolCallID: string
  orchestratorToolPartID: string
  decision: AgentCoordinationDecision
  reason: string
  message?: string
  now?: number
}): Promise<AgentCoordinationResponseRow> {
  const now = input.now ?? Date.now()
  const responseID = Identifier.deterministic(
    "artifact",
    `agent-coordination-response.v1\0${input.taskID}\0${input.orchestratorToolPartID}`,
  )
  const actionID = Identifier.deterministic("artifact", `agent-coordination-action.v1\0${responseID}`)
  let result: AgentCoordinationResponseRow | undefined

  Database.immediateTransaction((db) => {
    const requestRow = db
      .select()
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.id, input.requestID),
          eq(EngineArtifactTable.kind, "agent_coordination_request"),
        ),
      )
      .get()
    const request = requestRow ? requestRowFromArtifact(db, requestRow) : undefined
    if (!request) throw new Error(`Agent coordination request not found: ${input.requestID}`)
    const existingResponseRow = db
      .select()
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.id, responseID),
          eq(EngineArtifactTable.kind, "agent_coordination_response"),
        ),
      )
      .get()
    if (existingResponseRow) {
      const existingResponse = responseRowFromArtifact(existingResponseRow)
      const existingActionRow = db
        .select()
        .from(EngineArtifactTable)
        .where(
          and(
            eq(EngineArtifactTable.task_id, input.taskID),
            eq(EngineArtifactTable.id, existingResponse.payload.action_id),
            eq(EngineArtifactTable.kind, "agent_coordination_action"),
          ),
        )
        .get()
      const existingAction = existingActionRow ? actionRowFromArtifact(db, existingActionRow) : undefined
      if (!existingAction) throw new Error(`Agent coordination response ${responseID} has no exact action plan`)
      assertReplayMatchesExistingResponse({
        existingResponse,
        existingAction,
        requestID: input.requestID,
        taskID: input.taskID,
        orchestratorSessionID: input.orchestratorSessionID,
        orchestratorMessageID: input.orchestratorMessageID,
        orchestratorToolCallID: input.orchestratorToolCallID,
        orchestratorToolPartID: input.orchestratorToolPartID,
        decision: input.decision,
        reason: input.reason,
        ...(input.message ? { message: input.message } : {}),
        ...(input.decision === "redispatch"
          ? { redispatchBinding: redispatchBindingFromExistingAction({ request, existingAction }) }
          : {}),
      })
      if (existingAction.payload.status === "superseded") {
        assertCurrentAgentCoordinationActionInTransaction(db, {
          taskID: input.taskID,
          actionID: existingAction.payload.action_id,
          executionEpoch: existingAction.payload.execution_epoch,
          action: existingAction.payload.action,
        })
        throw new Error(`Superseded agent coordination action ${existingAction.payload.action_id} was admitted`)
      }
      result = { ...existingResponse, createdNow: false }
      return
    }
    if (request.payload.status !== "pending") {
      const projection = coordinationProjectionInTransaction(db, requestFactFromArtifact(requestRow!))
      throw new AgentCoordinationFrontierConflictError({
        message: `Agent coordination request ${input.requestID} frontier ${projection.frontierID} is already claimed`,
        taskID: input.taskID,
        requestID: input.requestID,
        frontierID: projection.frontierID,
        mismatches: ["orchestrator_tool_part_id"],
      })
    }
    const requestFact = requestFactFromArtifact(requestRow!)
    const lifecycle = taskLifecycleProjectionInTransaction(db, input.taskID)
    const deleted = taskDeletedInTransaction(db, input.taskID)
    const terminalAcknowledgement = input.decision === "acknowledge_terminal"
    const lifecycleAcceptsDecision = terminalAcknowledgement
      ? lifecycle.status === "completed" || lifecycle.status === "failed" || lifecycle.status === "cancelled"
      : lifecycle.status === "active"
    if (deleted || !lifecycleAcceptsDecision) {
      throw new AgentCoordinationActionSupersededError({
        message:
          `Agent coordination request ${input.requestID} cannot accept ${input.decision}: ` +
          `Task ${input.taskID} execution ${lifecycle.epoch} is ${deleted ? "deleted" : lifecycle.status}`,
        taskID: input.taskID,
        actionID,
        expectedExecutionEpoch: requestFact.execution_epoch,
        currentExecutionEpoch: lifecycle.epoch,
        currentTaskStatus: deleted ? "deleted" : lifecycle.status,
      })
    }
    const projection = coordinationProjectionInTransaction(db, requestFact)
    const redispatchBinding = deriveAgentCoordinationRedispatchBinding({
      decision: input.decision,
      request,
      db,
    })
    const factTime = Math.max(now, (projection.lastFailedOutcome?.created_at ?? requestFact.created_at) + 1)
    const payload = AgentCoordinationResponseFactSchema.parse({
      response_id: responseID,
      request_id: input.requestID,
      frontier_id: projection.frontierID,
      previous_failed_outcome_id: projection.previousFailedOutcomeID ?? null,
      action_id: actionID,
      task_id: input.taskID,
      execution_epoch: requestFact.execution_epoch,
      orchestrator_session_id: input.orchestratorSessionID,
      orchestrator_message_id: input.orchestratorMessageID,
      orchestrator_tool_call_id: input.orchestratorToolCallID,
      orchestrator_tool_part_id: input.orchestratorToolPartID,
      decision: input.decision,
      reason: input.reason,
      ...(input.message ? { message: input.message } : {}),
      created_at: factTime,
    })
    const actionPayload = AgentCoordinationActionFactSchema.parse({
      action_id: actionID,
      request_id: input.requestID,
      response_id: responseID,
      task_id: input.taskID,
      execution_epoch: requestFact.execution_epoch,
      orchestrator_session_id: input.orchestratorSessionID,
      orchestrator_message_id: input.orchestratorMessageID,
      orchestrator_tool_call_id: input.orchestratorToolCallID,
      orchestrator_tool_part_id: input.orchestratorToolPartID,
      action: actionKindForDecision(input.decision),
      decision: input.decision,
      target_session_id: request.payload.session_id,
      target_agent: request.payload.agent,
      ...(request.payload.delivery_slice_subject
        ? { delivery_slice_subject: request.payload.delivery_slice_subject }
        : {}),
      reason: input.reason,
      ...(redispatchBinding ? { redispatch_binding: redispatchBinding } : {}),
      created_at: factTime,
    })
    assertAgentCoordinationActionPayload(actionPayload)
    insertEngineArtifact(db, {
      id: responseID,
      taskID: input.taskID,
      kind: "agent_coordination_response" as EngineArtifactKind,
      label: input.decision,
      payload,
      timeCreated: factTime,
    })
    insertEngineArtifact(db, {
      id: actionID,
      taskID: input.taskID,
      kind: "agent_coordination_action" as EngineArtifactKind,
      label: actionPayload.action,
      payload: actionPayload,
      timeCreated: factTime,
    })
    EngineProtocol.emitInTransaction(
      Event.AgentCoordinationResponded,
      {
        taskID: input.taskID,
        requestID: input.requestID,
        responseID,
        actionID,
        sessionID: request.payload.session_id,
        decision: input.decision,
        summary: input.reason,
      },
      {
        taskID: input.taskID,
        sessionID: request.payload.session_id,
        source: "orchestrator",
        target: request.payload.agent,
        correlationID: input.requestID,
        causationID: responseID,
      },
    )
    emitAgentCoordinationActionEventInTransaction({
      taskID: input.taskID,
      sessionID: request.payload.session_id,
      payload: { ...actionPayload, status: "pending" },
      summary: `Action ${actionPayload.action} is pending`,
    })
    result = {
      artifactID: responseID,
      taskID: input.taskID,
      payload,
      timeCreated: factTime,
      timeUpdated: factTime,
      createdNow: true,
    }
  })
  if (!result) throw new Error(`Agent coordination response transaction failed: ${input.requestID}`)
  return result
}

function coordinationOutcomeIdentity(input: {
  actionID: string
  action: AgentCoordinationActionKind
  status: "completed" | "failed"
  result?: Record<string, unknown>
  error?: string
}): string {
  const digest = canonicalDigestSource("agent-coordination-action-outcome.v1", input)
  return Identifier.deterministic("artifact", digest.bytes)
}

type AppendAgentCoordinationActionOutcomeInput = {
  taskID: string
  actionID: string
  status: "completed" | "failed"
  result?: Record<string, unknown>
  error?: unknown
  summary: string
  now?: number
}

function appendAgentCoordinationActionOutcomeInTransaction(
  db: Database.TxOrDb,
  input: AppendAgentCoordinationActionOutcomeInput,
): { row: AgentCoordinationActionRow; createdNow: boolean } {
  const now = input.now ?? Date.now()
  const error = input.status === "failed" ? actionErrorMessage(input.error) : undefined
  const actionRow = db
    .select()
    .from(EngineArtifactTable)
    .where(
      and(
        eq(EngineArtifactTable.task_id, input.taskID),
        eq(EngineArtifactTable.id, input.actionID),
        eq(EngineArtifactTable.kind, "agent_coordination_action"),
      ),
    )
    .get()
  if (!actionRow) throw new Error(`Agent coordination action not found: ${input.actionID}`)
  const action = actionFactFromArtifact(actionRow)
  const outcomeID = coordinationOutcomeIdentity({
    actionID: input.actionID,
    action: action.action,
    status: input.status,
    ...(input.result ? { result: input.result } : {}),
    ...(error ? { error } : {}),
  })
  const lifecycle = taskLifecycleProjectionInTransaction(db, input.taskID)
  if (lifecycle.epoch !== action.execution_epoch) {
    throw new AgentCoordinationActionSupersededError({
      message:
        `Agent coordination action ${input.actionID} belongs to execution epoch ${action.execution_epoch}, ` +
        `current=${lifecycle.epoch}`,
      taskID: input.taskID,
      actionID: input.actionID,
      expectedExecutionEpoch: action.execution_epoch,
      currentExecutionEpoch: lifecycle.epoch,
      currentTaskStatus: lifecycle.status,
    })
  }
  const current = actionRowFromArtifact(db, actionRow)
  const existingOutcome = db
    .select()
    .from(EngineArtifactTable)
    .where(
      and(
        eq(EngineArtifactTable.task_id, input.taskID),
        eq(EngineArtifactTable.id, outcomeID),
        eq(EngineArtifactTable.kind, "agent_coordination_action_outcome"),
      ),
    )
    .get()
  if (existingOutcome) {
    const exact = outcomeFactFromArtifact(existingOutcome)
    if (
      exact.action_id !== input.actionID ||
      exact.status !== input.status ||
      canonicalDigestSource("agent-coordination-outcome-result.v1", exact.result ?? {}).bytes !==
        canonicalDigestSource("agent-coordination-outcome-result.v1", input.result ?? {}).bytes ||
      (exact.error ?? undefined) !== error
    ) {
      throw new Error(`Agent coordination outcome replay mismatch: ${outcomeID}`)
    }
    return { row: current, createdNow: false }
  }
  if (current.payload.status !== "pending") {
    throw new Error(`Agent coordination action ${input.actionID} is ${current.payload.status}`)
  }
  const factTime = Math.max(now, action.created_at)
  const payload = AgentCoordinationActionOutcomeFactSchema.parse({
    outcome_id: outcomeID,
    request_id: action.request_id,
    response_id: action.response_id,
    action_id: action.action_id,
    task_id: action.task_id,
    execution_epoch: action.execution_epoch,
    action: action.action,
    status: input.status,
    ...(input.result ? { result: input.result } : {}),
    ...(error ? { error } : {}),
    created_at: factTime,
  })
  insertEngineArtifact(db, {
    id: outcomeID,
    taskID: input.taskID,
    kind: "agent_coordination_action_outcome",
    label: input.status,
    payload,
    timeCreated: factTime,
  })
  const projected = actionRowFromArtifact(db, actionRow)
  emitAgentCoordinationActionEventInTransaction({
    taskID: input.taskID,
    sessionID: action.target_session_id,
    payload: projected.payload,
    summary: input.summary,
  })
  return { row: projected, createdNow: true }
}

function appendAgentCoordinationActionOutcome(
  input: AppendAgentCoordinationActionOutcomeInput,
): { row: AgentCoordinationActionRow; createdNow: boolean } {
  return Database.immediateTransaction((db) => appendAgentCoordinationActionOutcomeInTransaction(db, input))
}

export function completeAgentCoordinationActionInTransaction(
  db: Database.TxOrDb,
  input: Omit<AppendAgentCoordinationActionOutcomeInput, "status" | "error">,
): { row: AgentCoordinationActionRow; createdNow: boolean } {
  return appendAgentCoordinationActionOutcomeInTransaction(db, { ...input, status: "completed" })
}

export async function completeAgentCoordinationAction(input: {
  taskID: string
  actionID: string
  result?: Record<string, unknown>
  summary?: string
  now?: number
}): Promise<AgentCoordinationActionRow> {
  return appendAgentCoordinationActionOutcome({
    ...input,
    status: "completed",
    summary: input.summary ?? "agent coordination action completed",
  }).row
}

export function bindAgentCoordinationRedispatchSuccessorInTransaction(db: Database.TxOrDb, input: {
  taskID: string
  actionID: string
  dispatchID: string
  childSessionID: string
  targetAgentID: string
  bindSuccessor: () => Record<string, unknown>
  summary: string
  now?: number
}): { action: AgentCoordinationActionRow; createdNow: boolean } {
  const currentRow = db
    .select()
    .from(EngineArtifactTable)
    .where(
      and(
        eq(EngineArtifactTable.task_id, input.taskID),
        eq(EngineArtifactTable.id, input.actionID),
        eq(EngineArtifactTable.kind, "agent_coordination_action"),
      ),
    )
    .get()
  const current = currentRow ? actionRowFromArtifact(db, currentRow) : undefined
  if (!current) throw new Error(`Agent coordination action not found: ${input.actionID}`)
  if (current.payload.action !== "redispatch_worker") {
    throw new Error(`Agent coordination action ${input.actionID} is ${current.payload.action}, not redispatch_worker`)
  }
  if (current.payload.status === "completed") {
    const result = current.payload.result
    if (
      result?.dispatch_id !== input.dispatchID ||
      result.dispatch_session_id !== input.childSessionID ||
      result.dispatch_agent_id !== input.targetAgentID ||
      typeof result.dispatch_lineage_id !== "string"
    ) {
      throw new Error(`Agent coordination action ${input.actionID} is already bound to another redispatch successor`)
    }
    return { action: current, createdNow: false }
  }
  const result = input.bindSuccessor()
  const appended = appendAgentCoordinationActionOutcomeInTransaction(db, {
    taskID: input.taskID,
    actionID: input.actionID,
    status: "completed",
    result,
    summary: input.summary,
    now: input.now,
  })
  return { action: appended.row, createdNow: appended.createdNow }
}

export async function failAgentCoordinationAction(input: {
  taskID: string
  actionID: string
  error: unknown
  result?: Record<string, unknown>
  summary?: string
  now?: number
}): Promise<AgentCoordinationActionRow> {
  return appendAgentCoordinationActionOutcome({
    ...input,
    status: "failed",
    summary: input.summary ?? "agent coordination action failed",
  }).row
}
