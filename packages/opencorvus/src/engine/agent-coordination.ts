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
import { SelectedWorkflowBindingSchema, sameSelectedWorkflowBinding } from "./workflow-binding"
import { Event } from "@/engine/model"
import { EngineProtocol } from "@/engine/protocol"
import { Identifier } from "@/id/id"
import { taskIDForSession } from "@/engine/task-session-lineage"
import { and, desc, eq, sql } from "@/storage/db"
import { Database } from "@/storage/db"
import { EngineArtifactTable, EngineTaskTable, type EngineArtifactKind, type EngineMetadata } from "./engine.sql"
import { insertEngineArtifact, updateEngineArtifactsWhere, updateEngineArtifactWhereReturning } from "./artifact"
import { findDispatchLineageBySession, parseDispatchLineagePayload } from "./dispatch-lineage"
import { persistCoordinationIngressInTransaction } from "./task-root-ingress-delivery"
import { assertTaskEvidenceLocators } from "./evidence-locator"

export const AgentCoordinationRedispatchBindingSchema = ProjectedWorkerBindingSchema.safeExtend({
  sourceDispatchLineageID: z.string().min(1),
  sourceDispatchID: z.string().min(1),
  workflowBinding: SelectedWorkflowBindingSchema,
  workflowNodeID: z.string().min(1).nullable(),
  workflowOccurrenceID: z.string().min(1),
  deliverySliceRevisionIDs: z.array(Identifier.schema("goal")),
}).strict()

export type AgentCoordinationRedispatchBinding = z.infer<typeof AgentCoordinationRedispatchBindingSchema>

export type AgentCoordinationSeverity = "info" | "blocked" | "failure"

export function agentCoordinationQuestionID(actionID: string): string {
  return Identifier.ascending("question", `que_agent_coordination_${actionID}`)
}
export type AgentCoordinationRequestStatus = "pending" | "responded" | "cancelled"
export type AgentCoordinationRequestOrigin = "worker_handoff" | "operator_steer"
export type AgentCoordinationDecision =
  | "cancel_worker"
  | "redispatch"
  | "fail_task"
  | "ask_user"
  | "acknowledge_terminal"
export type AgentCoordinationActionKind =
  | "cancel_worker"
  | "redispatch_worker"
  | "fail_task"
  | "ask_user"
  | "acknowledge_terminal"
export type AgentCoordinationActionStatus = "pending" | "completed" | "failed"
export type AgentCoordinationSessionLineageSource = "task_session_tree" | "dispatch_lineage"

export interface AgentCoordinationSessionLineage {
  source: AgentCoordinationSessionLineageSource
  dispatchLineageID?: string
}

export interface AgentCoordinationRequestPayload extends EngineMetadata {
  request_id: string
  task_id: string
  session_id: string
  agent: string
  worker_binding: ProjectedWorkerBinding
  origin: AgentCoordinationRequestOrigin
  message_id?: string
  tool_call_id?: string
  operator_steer_id?: string
  operator_message?: string
  delivery_slice_subject?: string
  summary: string
  details: string
  blocking: boolean
  requested_decision: string
  evidence_locators?: EvidenceLocator[]
  severity: AgentCoordinationSeverity
  status: AgentCoordinationRequestStatus
  created_at: number
  responded_at?: number
  response_id?: string
  last_failed_response_id?: string
  last_failed_action_id?: string
  last_action_error?: string
  last_action_failed_at?: number
  cancelled_at?: number
  cancel_reason?: string
  session_lineage_source?: AgentCoordinationSessionLineageSource
  dispatch_lineage_id?: string
}

export interface AgentCoordinationResponsePayload extends EngineMetadata {
  response_id: string
  request_id: string
  action_id: string
  task_id: string
  orchestrator_session_id: string
  orchestrator_message_id: string
  orchestrator_tool_call_id: string
  orchestrator_tool_part_id: string
  decision: AgentCoordinationDecision
  reason: string
  message?: string
  created_at: number
}

export interface AgentCoordinationActionPayload extends EngineMetadata {
  action_id: string
  request_id: string
  response_id: string
  task_id: string
  orchestrator_session_id: string
  orchestrator_message_id: string
  orchestrator_tool_call_id: string
  orchestrator_tool_part_id: string
  action: AgentCoordinationActionKind
  decision: AgentCoordinationDecision
  target_session_id: string
  target_agent: string
  delivery_slice_subject?: string
  reason: string
  status: AgentCoordinationActionStatus
  created_at: number
  completed_at?: number
  failed_at?: number
  worker_message_id?: string
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
  return row ? requestRowFromArtifact(row) : undefined
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
        eq(EngineArtifactTable.kind, "agent_coordination_request"),
        sql`json_extract(${EngineArtifactTable.payload}, '$.operator_steer_id') = ${input.operatorSteerID}`,
      ),
    )
    .all()
  if (rows.length > 1) {
    throw new Error(
      `Operator steer request ${input.operatorSteerID} for task ${input.taskID} has ${rows.length} persisted requests`,
    )
  }
  const row = rows[0]
  return row ? requestRowFromArtifact(row) : undefined
}

function requestRowFromArtifact(row: AgentCoordinationArtifactRow): AgentCoordinationRequestRow {
  const payload = normalizeAgentCoordinationRequestPayload(row.payload)
  if (!payload) {
    throw new Error(`Malformed agent coordination request artifact ${row.id} for task ${row.task_id}`)
  }
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
  const payload = normalizeAgentCoordinationResponsePayload(row.payload)
  if (!payload) {
    throw new Error(`Malformed agent coordination response artifact ${row.id} for task ${row.task_id}`)
  }
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

function actionRowFromArtifact(row: AgentCoordinationArtifactRow): AgentCoordinationActionRow {
  const payload = normalizeAgentCoordinationActionPayload(row.payload)
  if (!payload) {
    throw new Error(`Malformed agent coordination action artifact ${row.id} for task ${row.task_id}`)
  }
  return {
    artifactID: row.id,
    taskID: row.task_id,
    payload,
    timeCreated: row.time_created,
    timeUpdated: row.time_updated,
  }
}

function assertAgentCoordinationActionPayload(payload: AgentCoordinationActionPayload): void {
  if (!normalizeAgentCoordinationActionPayload(payload)) {
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

function mergeAgentCoordinationActionResult(input: {
  current: AgentCoordinationActionPayload
  patch: Record<string, unknown>
}): Record<string, unknown> {
  const currentResult = input.current.result ?? {}
  if (input.current.action !== "redispatch_worker") return { ...currentResult, ...input.patch }

  const currentBinding = normalizeRedispatchBinding(currentResult.redispatch_binding, input.current.target_agent)
  if (!currentBinding) {
    throw new Error(`Agent coordination redispatch action ${input.current.action_id} has invalid redispatch_binding`)
  }
  if (Object.hasOwn(input.patch, "redispatch_binding")) {
    const patchBinding = normalizeRedispatchBinding(input.patch.redispatch_binding, input.current.target_agent)
    if (!sameRedispatchBinding(patchBinding, currentBinding)) {
      throw new Error(
        `Agent coordination redispatch action ${input.current.action_id} cannot replace scheduler-derived redispatch_binding`,
      )
    }
  }
  const { redispatch_binding: _redispatchBinding, ...patchWithoutBinding } = input.patch
  return { ...currentResult, ...patchWithoutBinding, redispatch_binding: currentResult.redispatch_binding }
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
  if (!sameRedispatchBinding(action.result?.redispatch_binding, input.redispatchBinding)) {
    mismatches.push("redispatch_binding")
  }
  if (mismatches.length > 0) {
    throw new Error(`Agent coordination response replay mismatch for ${input.requestID}: ${mismatches.join(", ")}`)
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
  agent: string
  workerBinding: ProjectedWorkerBinding
  operatorMessage: string
  summary: string
  details: string
  deliverySliceSubject?: string
}): void {
  const payload = input.existing.payload
  const mismatches: string[] = []
  if (payload.origin !== "operator_steer") mismatches.push("origin")
  if (payload.agent !== input.agent) mismatches.push("agent")
  if (!sameProjectedWorkerBinding(payload.worker_binding, input.workerBinding)) mismatches.push("worker_binding")
  if ((payload.operator_message ?? "") !== input.operatorMessage) mismatches.push("operator_message")
  if (payload.summary !== input.summary) mismatches.push("summary")
  if (payload.details !== input.details) mismatches.push("details")
  if ((payload.delivery_slice_subject ?? undefined) !== (input.deliverySliceSubject ?? undefined)) {
    mismatches.push("delivery_slice_subject")
  }
  if (mismatches.length === 0) return
  throw new Error(
    `Operator steer request replay for ${payload.operator_steer_id ?? payload.request_id} conflicts with existing request ${payload.request_id}: ${mismatches.join(", ")}`,
  )
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
      dispatchLineageID: dispatchLineage.artifactID,
    }
  }
  if (owningTask === input.taskID) return { source: "task_session_tree" }
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
  if (workerBinding.identity.agentID !== input.agent) {
    throw new Error(
      `Agent coordination request agent ${input.agent} does not match worker binding ${workerBinding.identity.agentID}`,
    )
  }

  const now = input.now ?? Date.now()
  const requestID = Identifier.ascending("artifact")

  let replay: AgentCoordinationRequestRow | undefined
  let payload: AgentCoordinationRequestPayload | undefined
  try {
    Database.transaction((db) => {
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

      const lineage = resolveAgentCoordinationSessionLineage(input)
      if (lineage.source !== "dispatch_lineage" || !lineage.dispatchLineageID) {
        throw new Error(`Worker coordination handoff ${input.sessionID} requires immutable dispatch lineage`)
      }
      payload = {
        request_id: requestID,
        task_id: input.taskID,
        session_id: input.sessionID,
        agent: input.agent,
        worker_binding: workerBinding,
        origin: "worker_handoff",
        message_id: input.messageID,
        tool_call_id: input.callID,
        ...(input.deliverySliceSubject ? { delivery_slice_subject: input.deliverySliceSubject } : {}),
        summary: input.summary,
        details: input.details,
        blocking: input.blocking,
        requested_decision: input.requestedDecision,
        ...(evidenceLocators.length > 0
          ? { evidence_locators: evidenceLocators }
          : {}),
        severity,
        status: "pending",
        created_at: now,
        session_lineage_source: lineage.source,
        dispatch_lineage_id: lineage.dispatchLineageID,
      }

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
  return { artifactID: requestID, taskID: input.taskID, payload, timeCreated: now, timeUpdated: now, createdNow: true }
}

export async function createOperatorSteerCoordinationRequest(input: {
  taskID: string
  sessionID: string
  agent: string
  workerBinding: ProjectedWorkerBinding
  operatorMessage: string
  deliverySliceSubject?: string
  operatorSteerID?: string
  now?: number
}): Promise<AgentCoordinationRequestRow> {
  requireTask(input.taskID)
  const now = input.now ?? Date.now()
  const requestID = input.operatorSteerID ?? Identifier.ascending("artifact")
  const summary = `Operator steer for ${input.agent} session ${input.sessionID}`
  const details = input.operatorMessage
  const workerBinding = ProjectedWorkerBindingSchema.parse(input.workerBinding)
  if (workerBinding.identity.agentID !== input.agent) {
    throw new Error(
      `Operator steer agent ${input.agent} does not match worker binding ${workerBinding.identity.agentID}`,
    )
  }

  let replay: AgentCoordinationRequestRow | undefined
  let payload: AgentCoordinationRequestPayload | undefined
  Database.transaction((db) => {
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
        agent: input.agent,
        workerBinding,
        operatorMessage: input.operatorMessage,
        summary,
        details,
        deliverySliceSubject: input.deliverySliceSubject,
      })
      persistCoordinationIngressInTransaction(db, {
        taskID: input.taskID,
        rootSessionID: task.rootSessionID,
        requestID,
        now,
      })
      return
    }
    const lineage = resolveAgentCoordinationSessionLineage(input)
    payload = {
      request_id: requestID,
      task_id: input.taskID,
      session_id: input.sessionID,
      agent: input.agent,
      worker_binding: workerBinding,
      origin: "operator_steer",
      operator_steer_id: requestID,
      operator_message: input.operatorMessage,
      ...(input.deliverySliceSubject ? { delivery_slice_subject: input.deliverySliceSubject } : {}),
      summary,
      details,
      blocking: true,
      requested_decision: "operator_steer",
      severity: "blocked",
      status: "pending",
      created_at: now,
      session_lineage_source: lineage.source,
      ...(lineage.dispatchLineageID ? { dispatch_lineage_id: lineage.dispatchLineageID } : {}),
    }

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
  return { artifactID: requestID, taskID: input.taskID, payload, timeCreated: now, timeUpdated: now, createdNow: true }
}

export function listAgentCoordinationRequests(
  taskID: string,
  transaction?: Database.TxOrDb,
): AgentCoordinationRequestRow[] {
  const select = (db: Database.TxOrDb) =>
    db
      .select()
      .from(EngineArtifactTable)
      .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "agent_coordination_request")))
      .orderBy(desc(EngineArtifactTable.time_updated), desc(EngineArtifactTable.id))
      .all()
  const rows = transaction ? select(transaction) : Database.use(select)
  return rows.map((row) => requestRowFromArtifact(row))
}

export function listPendingAgentCoordinationRequests(
  taskID: string,
  transaction?: Database.TxOrDb,
): AgentCoordinationRequestRow[] {
  return listAgentCoordinationRequests(taskID, transaction)
    .filter((row) => row.payload.status === "pending")
    .sort((left, right) => left.timeCreated - right.timeCreated || left.artifactID.localeCompare(right.artifactID))
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
  return listPendingAgentCoordinationRequests(input.taskID).filter(
    (request) => request.payload.session_id === input.sessionID,
  )
}

export function findAgentCoordinationRequest(input: {
  taskID: string
  requestID: string
}): AgentCoordinationRequestRow | undefined {
  const row = Database.use((db) =>
    db
      .select()
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.id, input.requestID),
          eq(EngineArtifactTable.kind, "agent_coordination_request"),
        ),
      )
      .get(),
  )
  if (!row) return undefined
  return requestRowFromArtifact(row)
}

export function listAgentCoordinationResponses(taskID: string): AgentCoordinationResponseRow[] {
  const rows = Database.use((db) =>
    db
      .select()
      .from(EngineArtifactTable)
      .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "agent_coordination_response")))
      .orderBy(desc(EngineArtifactTable.time_updated), desc(EngineArtifactTable.id))
      .all(),
  )
  return rows.map((row) => responseRowFromArtifact(row))
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

export function listAgentCoordinationActions(taskID: string): AgentCoordinationActionRow[] {
  const rows = Database.use((db) =>
    db
      .select()
      .from(EngineArtifactTable)
      .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "agent_coordination_action")))
      .orderBy(desc(EngineArtifactTable.time_updated), desc(EngineArtifactTable.id))
      .all(),
  )
  return rows.map((row) => actionRowFromArtifact(row))
}

export function findAgentCoordinationAction(input: {
  taskID: string
  actionID: string
}): AgentCoordinationActionRow | undefined {
  const row = Database.use((db) =>
    db
      .select()
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.id, input.actionID),
          eq(EngineArtifactTable.kind, "agent_coordination_action"),
        ),
      )
      .get(),
  )
  if (!row) return undefined
  return actionRowFromArtifact(row)
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
  const responseID = Identifier.ascending("artifact")
  const actionID = Identifier.ascending("artifact")
  let responseArtifactID = responseID
  let responseTimeCreated = now
  let responseTimeUpdated = now
  let createdNow = true
  let request: AgentCoordinationRequestRow | undefined
  let payload: AgentCoordinationResponsePayload | undefined
  let actionPayload: AgentCoordinationActionPayload | undefined
  let redispatchBinding: AgentCoordinationRedispatchBinding | undefined

  Database.transaction((db) => {
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
    request = requestRow ? requestRowFromArtifact(requestRow) : undefined
    if (!request) throw new Error(`Agent coordination request not found: ${input.requestID}`)
    if (request.payload.status !== "pending") {
      if (request.payload.status === "responded" && request.payload.response_id) {
        const existingResponseRow = db
          .select()
          .from(EngineArtifactTable)
          .where(
            and(
              eq(EngineArtifactTable.task_id, input.taskID),
              eq(EngineArtifactTable.id, request.payload.response_id),
              eq(EngineArtifactTable.kind, "agent_coordination_response"),
            ),
          )
          .get()
        const existingResponse = existingResponseRow ? responseRowFromArtifact(existingResponseRow) : undefined
        if (!existingResponse) {
          throw new Error(
            `Agent coordination request ${input.requestID} points to missing response ${request.payload.response_id}`,
          )
        }
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
        const existingAction = existingActionRow ? actionRowFromArtifact(existingActionRow) : undefined
        if (!existingAction) {
          throw new Error(
            `Agent coordination response ${existingResponse.payload.response_id} points to missing action ${existingResponse.payload.action_id}`,
          )
        }
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
            ? {
                redispatchBinding: redispatchBindingFromExistingAction({
                  request,
                  existingAction,
                }),
              }
            : {}),
        })
        responseArtifactID = existingResponse.artifactID
        responseTimeCreated = existingResponse.timeCreated
        responseTimeUpdated = existingResponse.timeUpdated
        payload = existingResponse.payload
        actionPayload = existingAction.payload
        createdNow = false
        return
      }
      throw new Error(`Agent coordination request ${input.requestID} is ${request.payload.status}`)
    }

    redispatchBinding = deriveAgentCoordinationRedispatchBinding({
      decision: input.decision,
      request,
      db,
    })

    if (request.payload.last_failed_response_id || request.payload.last_failed_action_id) {
      if (!request.payload.last_failed_response_id || !request.payload.last_failed_action_id) {
        throw new Error(`Agent coordination request ${input.requestID} has incomplete failed action replay pointers`)
      }
      const failedResponseRow = db
        .select()
        .from(EngineArtifactTable)
        .where(
          and(
            eq(EngineArtifactTable.task_id, input.taskID),
            eq(EngineArtifactTable.id, request.payload.last_failed_response_id),
            eq(EngineArtifactTable.kind, "agent_coordination_response"),
          ),
        )
        .get()
      const failedResponse = failedResponseRow ? responseRowFromArtifact(failedResponseRow) : undefined
      if (!failedResponse) {
        throw new Error(
          `Agent coordination request ${input.requestID} points to missing failed response ${request.payload.last_failed_response_id}`,
        )
      }
      const failedActionRow = db
        .select()
        .from(EngineArtifactTable)
        .where(
          and(
            eq(EngineArtifactTable.task_id, input.taskID),
            eq(EngineArtifactTable.id, request.payload.last_failed_action_id),
            eq(EngineArtifactTable.kind, "agent_coordination_action"),
          ),
        )
        .get()
      const failedAction = failedActionRow ? actionRowFromArtifact(failedActionRow) : undefined
      if (!failedAction) {
        throw new Error(
          `Agent coordination request ${input.requestID} points to missing failed action ${request.payload.last_failed_action_id}`,
        )
      }
      if (failedResponse.payload.action_id !== failedAction.payload.action_id) {
        throw new Error(
          `Agent coordination failed response ${failedResponse.payload.response_id} points to action ${failedResponse.payload.action_id}, not ${failedAction.payload.action_id}`,
        )
      }
      if (failedAction.payload.status !== "failed") {
        throw new Error(
          `Agent coordination failed action ${failedAction.payload.action_id} is ${failedAction.payload.status}`,
        )
      }
      const sameToolExecution =
        failedResponse.payload.orchestrator_session_id === input.orchestratorSessionID &&
        failedResponse.payload.orchestrator_message_id === input.orchestratorMessageID &&
        failedResponse.payload.orchestrator_tool_call_id === input.orchestratorToolCallID &&
        failedResponse.payload.orchestrator_tool_part_id === input.orchestratorToolPartID
      if (sameToolExecution) {
        assertReplayMatchesExistingResponse({
          existingResponse: failedResponse,
          existingAction: failedAction,
          requestID: input.requestID,
          taskID: input.taskID,
          orchestratorSessionID: input.orchestratorSessionID,
          orchestratorMessageID: input.orchestratorMessageID,
          orchestratorToolCallID: input.orchestratorToolCallID,
          orchestratorToolPartID: input.orchestratorToolPartID,
          decision: input.decision,
          reason: input.reason,
          ...(input.message ? { message: input.message } : {}),
          ...(redispatchBinding ? { redispatchBinding } : {}),
        })
        responseArtifactID = failedResponse.artifactID
        responseTimeCreated = failedResponse.timeCreated
        responseTimeUpdated = failedResponse.timeUpdated
        payload = failedResponse.payload
        actionPayload = failedAction.payload
        createdNow = false
        return
      }
    }

    payload = {
      response_id: responseID,
      request_id: input.requestID,
      action_id: actionID,
      task_id: input.taskID,
      orchestrator_session_id: input.orchestratorSessionID,
      orchestrator_message_id: input.orchestratorMessageID,
      orchestrator_tool_call_id: input.orchestratorToolCallID,
      orchestrator_tool_part_id: input.orchestratorToolPartID,
      decision: input.decision,
      reason: input.reason,
      ...(input.message ? { message: input.message } : {}),
      created_at: now,
    }
    actionPayload = {
      action_id: actionID,
      request_id: input.requestID,
      response_id: responseID,
      task_id: input.taskID,
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
      status: "pending",
      ...(redispatchBinding ? { result: { redispatch_binding: redispatchBinding } } : {}),
      created_at: now,
    }
    assertAgentCoordinationActionPayload(actionPayload)

    const updated = updateEngineArtifactWhereReturning(db, {
      kind: "agent_coordination_request",
      label: "responded",
      payload: {
        ...request.payload,
        status: "responded",
        responded_at: now,
        response_id: responseID,
      } satisfies AgentCoordinationRequestPayload,
      timeUpdated: now,
      where: and(
        eq(EngineArtifactTable.task_id, input.taskID),
        eq(EngineArtifactTable.id, input.requestID),
        eq(EngineArtifactTable.kind, "agent_coordination_request"),
        eq(EngineArtifactTable.label, "pending"),
        sql`json_extract(${EngineArtifactTable.payload}, '$.status') = 'pending'`,
      )!,
    })
    if (!updated) throw new Error(`Agent coordination request ${input.requestID} was already claimed`)

    insertEngineArtifact(db, {
      id: responseID,
      taskID: input.taskID,
      kind: "agent_coordination_response" as EngineArtifactKind,
      label: input.decision,
      payload,
      timeCreated: now,
    })
    insertEngineArtifact(db, {
      id: actionID,
      taskID: input.taskID,
      kind: "agent_coordination_action" as EngineArtifactKind,
      label: "pending",
      payload: actionPayload,
      timeCreated: now,
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
      payload: actionPayload,
      summary: `Action ${actionPayload.action} is pending`,
    })
  })

  if (!request || !payload || !actionPayload) {
    throw new Error(`Agent coordination response transaction failed: ${input.requestID}`)
  }

  return {
    artifactID: responseArtifactID,
    taskID: input.taskID,
    payload,
    timeCreated: responseTimeCreated,
    timeUpdated: responseTimeUpdated,
    createdNow,
  }
}

async function updateAgentCoordinationAction(input: {
  taskID: string
  actionID: string
  status: "completed" | "failed"
  workerMessageID?: string
  result?: Record<string, unknown>
  error?: unknown
  summary?: string
  now?: number
}): Promise<AgentCoordinationActionRow> {
  const now = input.now ?? Date.now()
  let updated: AgentCoordinationArtifactRow | undefined

  Database.transaction((db) => {
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
    const current = currentRow ? actionRowFromArtifact(currentRow) : undefined
    if (!current) throw new Error(`Agent coordination action not found: ${input.actionID}`)
    if (current.payload.status !== "pending") {
      throw new Error(`Agent coordination action ${input.actionID} is ${current.payload.status}`)
    }

    const payload: AgentCoordinationActionPayload = {
      ...current.payload,
      status: input.status,
      ...(input.workerMessageID ? { worker_message_id: input.workerMessageID } : {}),
      ...(input.result !== undefined
        ? { result: mergeAgentCoordinationActionResult({ current: current.payload, patch: input.result }) }
        : {}),
      ...(input.status === "completed" ? { completed_at: now } : {}),
      ...(input.status === "failed" ? { failed_at: now, error: actionErrorMessage(input.error) } : {}),
    }
    assertAgentCoordinationActionPayload(payload)

    updated = updateEngineArtifactWhereReturning(db, {
      kind: "agent_coordination_action",
      label: input.status,
      payload,
      timeUpdated: now,
      where: and(
        eq(EngineArtifactTable.task_id, input.taskID),
        eq(EngineArtifactTable.id, input.actionID),
        eq(EngineArtifactTable.kind, "agent_coordination_action"),
        eq(EngineArtifactTable.label, "pending"),
        sql`json_extract(${EngineArtifactTable.payload}, '$.status') = 'pending'`,
      )!,
    })
    if (!updated) throw new Error(`Agent coordination action ${input.actionID} was already completed`)

    if (input.status === "failed") {
      const requestRow = db
        .select()
        .from(EngineArtifactTable)
        .where(
          and(
            eq(EngineArtifactTable.task_id, input.taskID),
            eq(EngineArtifactTable.id, current.payload.request_id),
            eq(EngineArtifactTable.kind, "agent_coordination_request"),
          ),
        )
        .get()
      const request = requestRow ? requestRowFromArtifact(requestRow) : undefined
      if (request?.payload.status === "responded" && request.payload.response_id === current.payload.response_id) {
        const { response_id: _responseID, responded_at: _respondedAt, ...requestPayload } = request.payload
        updateEngineArtifactsWhere(db, {
          kind: "agent_coordination_request",
          label: "pending",
          payload: {
            ...requestPayload,
            status: "pending",
            last_failed_response_id: current.payload.response_id,
            last_failed_action_id: current.payload.action_id,
            last_action_error: actionErrorMessage(input.error),
            last_action_failed_at: now,
          } satisfies AgentCoordinationRequestPayload,
          timeUpdated: now,
          where: and(
            eq(EngineArtifactTable.task_id, input.taskID),
            eq(EngineArtifactTable.id, current.payload.request_id),
            eq(EngineArtifactTable.kind, "agent_coordination_request"),
            eq(EngineArtifactTable.label, "responded"),
            sql`json_extract(${EngineArtifactTable.payload}, '$.response_id') = ${current.payload.response_id}`,
          )!,
        })
      }
    }
    emitAgentCoordinationActionEventInTransaction({
      taskID: input.taskID,
      sessionID: payload.target_session_id,
      payload,
      summary: input.summary ?? `Action ${payload.action} ${payload.status}`,
    })
  })

  if (!updated) throw new Error(`Agent coordination action update failed: ${input.actionID}`)
  return actionRowFromArtifact(updated)
}

export async function recordAgentCoordinationActionProgress(input: {
  taskID: string
  actionID: string
  result: Record<string, unknown>
  summary: string
  now?: number
}): Promise<AgentCoordinationActionRow> {
  const now = input.now ?? Date.now()
  let updated: AgentCoordinationArtifactRow | undefined
  Database.transaction((db) => {
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
    const current = currentRow ? actionRowFromArtifact(currentRow) : undefined
    if (!current) throw new Error(`Agent coordination action not found: ${input.actionID}`)
    if (current.payload.status !== "pending") {
      throw new Error(`Agent coordination action ${input.actionID} is ${current.payload.status}`)
    }
    const payload: AgentCoordinationActionPayload = {
      ...current.payload,
      result: mergeAgentCoordinationActionResult({ current: current.payload, patch: input.result }),
    }
    assertAgentCoordinationActionPayload(payload)
    updated = updateEngineArtifactWhereReturning(db, {
      kind: "agent_coordination_action",
      payload,
      timeUpdated: now,
      where: and(
        eq(EngineArtifactTable.task_id, input.taskID),
        eq(EngineArtifactTable.id, input.actionID),
        eq(EngineArtifactTable.kind, "agent_coordination_action"),
        eq(EngineArtifactTable.label, "pending"),
        sql`json_extract(${EngineArtifactTable.payload}, '$.status') = 'pending'`,
      )!,
    })
    if (!updated) throw new Error(`Agent coordination action ${input.actionID} was already completed`)
    emitAgentCoordinationActionEventInTransaction({
      taskID: input.taskID,
      sessionID: payload.target_session_id,
      payload,
      summary: input.summary,
    })
  })
  if (!updated) throw new Error(`Agent coordination action progress update failed: ${input.actionID}`)
  return actionRowFromArtifact(updated)
}

export async function completeAgentCoordinationAction(input: {
  taskID: string
  actionID: string
  workerMessageID?: string
  result?: Record<string, unknown>
  summary?: string
  now?: number
}): Promise<AgentCoordinationActionRow> {
  return await updateAgentCoordinationAction({
    ...input,
    status: "completed",
  })
}

export function bindAgentCoordinationRedispatchSuccessor(input: {
  taskID: string
  actionID: string
  dispatchID: string
  childSessionID: string
  targetAgentID: string
  bindSuccessor: () => Record<string, unknown>
  summary: string
  now?: number
}): { action: AgentCoordinationActionRow; createdNow: boolean } {
  const now = input.now ?? Date.now()
  let updated: AgentCoordinationArtifactRow | undefined
  let existing: AgentCoordinationArtifactRow | undefined

  Database.transaction((db) => {
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
    const current = currentRow ? actionRowFromArtifact(currentRow) : undefined
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
        throw new Error(
          `Agent coordination action ${input.actionID} is already bound to another redispatch successor`,
        )
      }
      existing = currentRow
      return
    }
    if (current.payload.status !== "pending") {
      throw new Error(`Agent coordination action ${input.actionID} is ${current.payload.status}`)
    }

    const successorResult = input.bindSuccessor()
    const payload: AgentCoordinationActionPayload = {
      ...current.payload,
      status: "completed",
      completed_at: now,
      result: mergeAgentCoordinationActionResult({ current: current.payload, patch: successorResult }),
    }
    assertAgentCoordinationActionPayload(payload)
    updated = updateEngineArtifactWhereReturning(db, {
      kind: "agent_coordination_action",
      label: "completed",
      payload,
      timeUpdated: now,
      where: and(
        eq(EngineArtifactTable.task_id, input.taskID),
        eq(EngineArtifactTable.id, input.actionID),
        eq(EngineArtifactTable.kind, "agent_coordination_action"),
        eq(EngineArtifactTable.label, "pending"),
        sql`json_extract(${EngineArtifactTable.payload}, '$.status') = 'pending'`,
      )!,
    })
    if (!updated) throw new Error(`Agent coordination action ${input.actionID} was already completed`)
    emitAgentCoordinationActionEventInTransaction({
      taskID: input.taskID,
      sessionID: payload.target_session_id,
      payload,
      summary: input.summary,
    })
  })

  const row = updated ?? existing
  if (!row) throw new Error(`Agent coordination redispatch binding failed: ${input.actionID}`)
  return { action: actionRowFromArtifact(row), createdNow: updated !== undefined }
}

export async function failAgentCoordinationAction(input: {
  taskID: string
  actionID: string
  workerMessageID?: string
  error: unknown
  result?: Record<string, unknown>
  summary?: string
  now?: number
}): Promise<AgentCoordinationActionRow> {
  return await updateAgentCoordinationAction({
    ...input,
    status: "failed",
  })
}

type CancelPendingAgentCoordinationRequestsInput = {
  taskID: string
  reason: string
  filter?: (row: AgentCoordinationRequestRow) => boolean
  now?: number
  signal?: AbortSignal
}

export function cancelPendingAgentCoordinationRequestsInTransaction(
  db: Database.TxOrDb,
  input: CancelPendingAgentCoordinationRequestsInput,
): number {
  input.signal?.throwIfAborted()
  const pending = listPendingAgentCoordinationRequests(input.taskID, db).filter((row) => input.filter?.(row) ?? true)
  const now = input.now ?? Date.now()
  let cancelled = 0
  for (const request of pending) {
    input.signal?.throwIfAborted()
    const payload: AgentCoordinationRequestPayload = {
      ...request.payload,
      status: "cancelled",
      cancelled_at: now,
      cancel_reason: input.reason,
    }
    const updated = updateEngineArtifactWhereReturning(db, {
      kind: "agent_coordination_request",
      label: "cancelled",
      payload,
      timeUpdated: now,
      where: and(
        eq(EngineArtifactTable.task_id, input.taskID),
        eq(EngineArtifactTable.id, request.artifactID),
        eq(EngineArtifactTable.kind, "agent_coordination_request"),
        eq(EngineArtifactTable.label, "pending"),
        sql`json_extract(${EngineArtifactTable.payload}, '$.status') = 'pending'`,
      )!,
    })
    if (!updated) continue
    EngineProtocol.emitInTransaction(
      Event.AgentCoordinationCancelled,
      {
        taskID: input.taskID,
        requestID: request.payload.request_id,
        sessionID: request.payload.session_id,
        summary: input.reason,
      },
      {
        taskID: input.taskID,
        sessionID: request.payload.session_id,
        source: "orchestrator",
        target: request.payload.agent,
        correlationID: request.payload.request_id,
      },
    )
    cancelled += 1
  }
  return cancelled
}

async function cancelPendingAgentCoordinationRequests(
  input: CancelPendingAgentCoordinationRequestsInput,
): Promise<number> {
  return Database.transaction((db) => cancelPendingAgentCoordinationRequestsInTransaction(db, input))
}

export async function cancelPendingAgentCoordinationRequestsForSession(input: {
  taskID: string
  sessionID: string
  reason: string
  now?: number
}): Promise<number> {
  return await cancelPendingAgentCoordinationRequests({
    taskID: input.taskID,
    reason: input.reason,
    now: input.now,
    filter: (row) => row.payload.session_id === input.sessionID,
  })
}

export async function cancelPendingAgentCoordinationRequest(input: {
  taskID: string
  requestID: string
  reason: string
  now?: number
}): Promise<number> {
  return await cancelPendingAgentCoordinationRequests({
    taskID: input.taskID,
    reason: input.reason,
    now: input.now,
    filter: (row) => row.payload.request_id === input.requestID,
  })
}

export async function cancelPendingAgentCoordinationRequestsForTask(input: {
  taskID: string
  reason: string
  now?: number
  signal?: AbortSignal
}): Promise<number> {
  return await cancelPendingAgentCoordinationRequests(input)
}

function normalizeAgentCoordinationRequestPayload(payload: unknown): AgentCoordinationRequestPayload | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined
  const value = payload as Record<string, unknown>
  if (typeof value.request_id !== "string" || value.request_id.length === 0) return undefined
  if (typeof value.task_id !== "string" || value.task_id.length === 0) return undefined
  if (typeof value.session_id !== "string" || value.session_id.length === 0) return undefined
  if (typeof value.agent !== "string" || value.agent.length === 0) return undefined
  const workerBinding = ProjectedWorkerBindingSchema.safeParse(value.worker_binding)
  if (!workerBinding.success || workerBinding.data.identity.agentID !== value.agent) return undefined
  if (value.origin !== "worker_handoff" && value.origin !== "operator_steer") return undefined
  if (value.origin === "operator_steer") {
    if (typeof value.operator_steer_id !== "string" || value.operator_steer_id.length === 0) return undefined
    if (typeof value.operator_message !== "string" || value.operator_message.length === 0) return undefined
    if (value.message_id !== undefined && (typeof value.message_id !== "string" || value.message_id.length === 0)) {
      return undefined
    }
  } else {
    if (typeof value.message_id !== "string" || value.message_id.length === 0) return undefined
    if (typeof value.tool_call_id !== "string" || value.tool_call_id.length === 0) return undefined
    if (typeof value.dispatch_lineage_id !== "string" || value.dispatch_lineage_id.length === 0) return undefined
  }
  if (value.tool_call_id !== undefined && (typeof value.tool_call_id !== "string" || value.tool_call_id.length === 0)) {
    return undefined
  }
  if (
    value.operator_steer_id !== undefined &&
    (typeof value.operator_steer_id !== "string" || value.operator_steer_id.length === 0)
  ) {
    return undefined
  }
  if (
    value.operator_message !== undefined &&
    (typeof value.operator_message !== "string" || value.operator_message.length === 0)
  ) {
    return undefined
  }
  if (
    value.delivery_slice_subject !== undefined &&
    (typeof value.delivery_slice_subject !== "string" || value.delivery_slice_subject.length === 0)
  ) {
    return undefined
  }
  if (typeof value.summary !== "string" || value.summary.length === 0) return undefined
  if (typeof value.details !== "string" || value.details.length === 0) return undefined
  if (typeof value.blocking !== "boolean") return undefined
  if (typeof value.requested_decision !== "string" || value.requested_decision.length === 0) return undefined
  const evidenceLocators =
    value.evidence_locators === undefined
      ? undefined
      : EvidenceLocatorListSchema.safeParse(value.evidence_locators)
  if (value.evidence_refs !== undefined) return undefined
  if (evidenceLocators && !evidenceLocators.success) return undefined
  if (value.severity !== "info" && value.severity !== "blocked" && value.severity !== "failure") return undefined
  if (value.status !== "pending" && value.status !== "responded" && value.status !== "cancelled") return undefined
  if (typeof value.created_at !== "number" || !(value.created_at > 0)) return undefined
  if (
    value.session_lineage_source !== undefined &&
    value.session_lineage_source !== "task_session_tree" &&
    value.session_lineage_source !== "dispatch_lineage"
  ) {
    return undefined
  }
  if (
    value.dispatch_lineage_id !== undefined &&
    (typeof value.dispatch_lineage_id !== "string" || value.dispatch_lineage_id.length === 0)
  ) {
    return undefined
  }
  return {
    ...value,
    worker_binding: workerBinding.data,
    ...(evidenceLocators?.success ? { evidence_locators: evidenceLocators.data } : {}),
  } as unknown as AgentCoordinationRequestPayload
}

function normalizeAgentCoordinationResponsePayload(payload: unknown): AgentCoordinationResponsePayload | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined
  const value = payload as Record<string, unknown>
  if (typeof value.response_id !== "string" || value.response_id.length === 0) return undefined
  if (typeof value.request_id !== "string" || value.request_id.length === 0) return undefined
  if (typeof value.action_id !== "string" || value.action_id.length === 0) return undefined
  if (typeof value.task_id !== "string" || value.task_id.length === 0) return undefined
  if (typeof value.orchestrator_session_id !== "string" || value.orchestrator_session_id.length === 0) {
    return undefined
  }
  if (typeof value.orchestrator_message_id !== "string" || value.orchestrator_message_id.length === 0) {
    return undefined
  }
  if (typeof value.orchestrator_tool_call_id !== "string" || value.orchestrator_tool_call_id.length === 0) {
    return undefined
  }
  if (typeof value.orchestrator_tool_part_id !== "string" || value.orchestrator_tool_part_id.length === 0) {
    return undefined
  }
  if (
    value.decision !== "cancel_worker" &&
    value.decision !== "redispatch" &&
    value.decision !== "fail_task" &&
    value.decision !== "ask_user" &&
    value.decision !== "acknowledge_terminal"
  ) {
    return undefined
  }
  if (typeof value.reason !== "string" || value.reason.length === 0) return undefined
  if (value.message !== undefined && (typeof value.message !== "string" || value.message.length === 0)) {
    return undefined
  }
  if (typeof value.created_at !== "number" || !(value.created_at > 0)) return undefined
  return value as unknown as AgentCoordinationResponsePayload
}

function normalizeAgentCoordinationActionPayload(payload: unknown): AgentCoordinationActionPayload | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined
  const value = payload as Record<string, unknown>
  if (typeof value.action_id !== "string" || value.action_id.length === 0) return undefined
  if (typeof value.request_id !== "string" || value.request_id.length === 0) return undefined
  if (typeof value.response_id !== "string" || value.response_id.length === 0) return undefined
  if (typeof value.task_id !== "string" || value.task_id.length === 0) return undefined
  if (typeof value.orchestrator_session_id !== "string" || value.orchestrator_session_id.length === 0) {
    return undefined
  }
  if (typeof value.orchestrator_message_id !== "string" || value.orchestrator_message_id.length === 0) {
    return undefined
  }
  if (typeof value.orchestrator_tool_call_id !== "string" || value.orchestrator_tool_call_id.length === 0) {
    return undefined
  }
  if (typeof value.orchestrator_tool_part_id !== "string" || value.orchestrator_tool_part_id.length === 0) {
    return undefined
  }
  if (
    value.decision !== "cancel_worker" &&
    value.decision !== "redispatch" &&
    value.decision !== "fail_task" &&
    value.decision !== "ask_user" &&
    value.decision !== "acknowledge_terminal"
  ) {
    return undefined
  }
  if (
    value.action !== "cancel_worker" &&
    value.action !== "redispatch_worker" &&
    value.action !== "fail_task" &&
    value.action !== "ask_user" &&
    value.action !== "acknowledge_terminal"
  ) {
    return undefined
  }
  if (value.action !== actionKindForDecision(value.decision)) return undefined
  if (typeof value.target_session_id !== "string" || value.target_session_id.length === 0) return undefined
  if (typeof value.target_agent !== "string" || value.target_agent.length === 0) return undefined
  if (
    value.delivery_slice_subject !== undefined &&
    (typeof value.delivery_slice_subject !== "string" || value.delivery_slice_subject.length === 0)
  ) {
    return undefined
  }
  if (typeof value.reason !== "string" || value.reason.length === 0) return undefined
  if (value.status !== "pending" && value.status !== "completed" && value.status !== "failed") return undefined
  if (typeof value.created_at !== "number" || !(value.created_at > 0)) return undefined
  if (
    value.worker_message_id !== undefined &&
    (typeof value.worker_message_id !== "string" || value.worker_message_id.length === 0)
  ) {
    return undefined
  }
  if (
    value.result !== undefined &&
    (!value.result || typeof value.result !== "object" || Array.isArray(value.result))
  ) {
    return undefined
  }
  const result = value.result as Record<string, unknown> | undefined
  if (value.action === "redispatch_worker") {
    if (!result || !normalizeRedispatchBinding(result.redispatch_binding, value.target_agent)) return undefined
  } else if (result?.redispatch_binding !== undefined) {
    return undefined
  }
  if (value.status === "pending") {
    if (value.completed_at !== undefined || value.failed_at !== undefined || value.error !== undefined) return undefined
  }
  if (value.status === "completed") {
    if (typeof value.completed_at !== "number" || !(value.completed_at > 0)) return undefined
    if (value.failed_at !== undefined || value.error !== undefined) return undefined
  }
  if (value.status === "failed") {
    if (typeof value.failed_at !== "number" || !(value.failed_at > 0)) return undefined
    if (typeof value.error !== "string" || value.error.length === 0) return undefined
    if (value.completed_at !== undefined) return undefined
  }
  return value as unknown as AgentCoordinationActionPayload
}
