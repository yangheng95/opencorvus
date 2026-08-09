import { ProjectedAgentWorkScopeSchema, type ProjectedAgentWorkScope } from "@/agent/projected-agent-work-scope"
import { ProjectedWorkerIdentitySchema, type ProjectedWorkerIdentity } from "@/agent/projected-worker-identity"
import { insertEngineArtifact } from "@/engine/artifact"
import { EngineArtifactTable, type EngineMetadata } from "@/engine/engine.sql"
import { Identifier } from "@/id/id"
import { and, asc, desc, eq, sql, Database } from "@/storage/db"
import z from "zod"
import { SelectedWorkflowBindingSchema, type SelectedWorkflowBinding } from "./workflow-binding"
import { assertCurrentDeliverySliceRevisionIDs } from "./store"
import { assertTaskWorkflowBindingInTransaction } from "./workflow-binding-facts"
import { assertCurrentDeliverySliceRevisionIDsInTransaction } from "./delivery-slice-membership-facts"
import type { DispatchOccurrenceAuthority } from "./dispatch-occurrence-authority"
import {
  assertWorkflowNodeOccurrenceLineageInTransaction,
  bindWorkflowNodeOccurrenceLineageInTransaction,
} from "./workflow-node-occurrence"

export interface DispatchLineagePayload extends EngineMetadata {
  dispatch_id: string
  task_id: string
  orchestrator_session_id: string
  orchestrator_message_id: string
  tool_part_id: string
  tool_call_id: string
  tool_name: "dispatch_agent"
  child_session_id: string
  target_agent_id: string
  projected_worker_identity: ProjectedWorkerIdentity
  work_scope: ProjectedAgentWorkScope
  delivery_slice_revision_ids: string[]
  workflow_binding: SelectedWorkflowBinding
  workflow_node_id: string | null
  workflow_occurrence_id: string
  coordination_action_id?: string
  continuation_of_dispatch_id?: string
  adapter_input: Record<string, unknown>
  time_created: number
}

export interface DispatchLineageRow {
  artifactID: string
  taskID: string
  dispatchID: string
  payload: DispatchLineagePayload
  timeCreated: number
}

export interface DispatchLineageOrigin {
  dispatchID: string
  taskID: string
  orchestratorSessionID: string
  orchestratorMessageID: string
  toolPartID: string
  toolCallID: string
  targetAgentID: string
  projectedWorkerIdentity: ProjectedWorkerIdentity
  workScope: ProjectedAgentWorkScope
  deliverySliceRevisionIDs?: string[]
  workflowBinding: SelectedWorkflowBinding
  workflowNodeID: string | null
  workflowOccurrenceID?: string
  coordinationActionID?: string
  continuationOfDispatchID?: string
  adapterInput: Record<string, unknown>
}

const DispatchLineagePayloadSchema = z
  .object({
    dispatch_id: z.string().min(1),
    task_id: z.string().min(1),
    orchestrator_session_id: z.string().min(1),
    orchestrator_message_id: z.string().min(1),
    tool_part_id: z.string().min(1),
    tool_call_id: z.string().min(1),
    tool_name: z.literal("dispatch_agent"),
    child_session_id: z.string().min(1),
    target_agent_id: z.string().min(1),
    projected_worker_identity: ProjectedWorkerIdentitySchema,
    work_scope: ProjectedAgentWorkScopeSchema,
    delivery_slice_revision_ids: z.array(Identifier.schema("goal")),
    workflow_binding: SelectedWorkflowBindingSchema,
    workflow_node_id: z.string().min(1).nullable(),
    workflow_occurrence_id: z.string().min(1),
    coordination_action_id: z.string().min(1).optional(),
    continuation_of_dispatch_id: z.string().min(1).optional(),
    adapter_input: z.record(z.string(), z.unknown()),
    time_created: z.number().positive(),
  })
  .strict()

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested)
  return Object.freeze(value)
}

export function freezeDispatchAdapterInput(input: Record<string, unknown>): Readonly<Record<string, unknown>> {
  const parsed = z.record(z.string(), z.unknown()).parse(input)
  return deepFreeze(structuredClone(parsed))
}

export function createDispatchLineageOrigin(
  input: Omit<DispatchLineageOrigin, "dispatchID"> & { dispatchID?: string },
): DispatchLineageOrigin {
  const dispatchID = input.dispatchID ?? Identifier.ascending("artifact")
  const adapterInput = freezeDispatchAdapterInput(input.adapterInput)
  const identity = ProjectedWorkerIdentitySchema.parse(input.projectedWorkerIdentity)
  if (identity.agentID !== input.targetAgentID) {
    throw new Error(
      `Dispatch target ${input.targetAgentID} does not match projected worker identity ${identity.agentID}`,
    )
  }
  const workflowBinding = SelectedWorkflowBindingSchema.parse(input.workflowBinding)
  if (workflowBinding.kind === "direct" && input.workflowNodeID !== null) {
    throw new Error("Direct dispatch lineage cannot claim a workflow node")
  }
  if (workflowBinding.kind === "virtual_workflow") {
    const node = workflowBinding.nodes.find((candidate) => candidate.node_id === input.workflowNodeID)
    if (!node) {
      throw new Error(
        `Dispatch lineage workflow ${workflowBinding.workflow_id} does not declare node ${input.workflowNodeID}`,
      )
    }
    if (node.agent_id !== input.targetAgentID) {
      throw new Error(
        `Dispatch lineage workflow node ${node.node_id} targets ${node.agent_id}, not ${input.targetAgentID}`,
      )
    }
  }
  return Object.freeze({
    ...input,
    dispatchID,
    workflowOccurrenceID: input.workflowOccurrenceID ?? dispatchID,
    projectedWorkerIdentity: identity,
    workScope: ProjectedAgentWorkScopeSchema.parse(input.workScope),
    deliverySliceRevisionIDs: [...new Set(input.deliverySliceRevisionIDs ?? [])],
    adapterInput,
    workflowBinding,
  })
}

export function recordDispatchLineage(input: {
  origin: DispatchLineageOrigin
  childSessionID: string
  now?: number
}): DispatchLineageRow {
  const now = input.now ?? Date.now()
  const artifactID = Identifier.ascending("artifact")
  const deliverySliceRevisionIDs = assertCurrentDeliverySliceRevisionIDs({
    taskID: input.origin.taskID,
    deliverySliceRevisionIDs: input.origin.deliverySliceRevisionIDs ?? [],
    subject: "Dispatch lineage",
  })
  const payload = parseDispatchLineagePayload(
    {
      dispatch_id: input.origin.dispatchID,
      task_id: input.origin.taskID,
      orchestrator_session_id: input.origin.orchestratorSessionID,
      orchestrator_message_id: input.origin.orchestratorMessageID,
      tool_part_id: input.origin.toolPartID,
      tool_call_id: input.origin.toolCallID,
      tool_name: "dispatch_agent",
      child_session_id: input.childSessionID,
      target_agent_id: input.origin.targetAgentID,
      projected_worker_identity: input.origin.projectedWorkerIdentity,
      work_scope: input.origin.workScope,
      delivery_slice_revision_ids: deliverySliceRevisionIDs,
      workflow_binding: input.origin.workflowBinding,
      workflow_node_id: input.origin.workflowNodeID,
      workflow_occurrence_id: input.origin.workflowOccurrenceID ?? input.origin.dispatchID,
      ...(input.origin.coordinationActionID ? { coordination_action_id: input.origin.coordinationActionID } : {}),
      ...(input.origin.continuationOfDispatchID
        ? { continuation_of_dispatch_id: input.origin.continuationOfDispatchID }
        : {}),
      adapter_input: input.origin.adapterInput,
      time_created: now,
    },
    artifactID,
  )
  Database.transaction((db) => {
    assertTaskWorkflowBindingInTransaction({
      db,
      taskID: input.origin.taskID,
      workflowBinding: input.origin.workflowBinding,
    })
    assertCurrentDeliverySliceRevisionIDsInTransaction({
      db,
      taskID: input.origin.taskID,
      deliverySliceRevisionIDs: payload.delivery_slice_revision_ids,
      subject: "Dispatch lineage",
    })
    const occurrenceCommit = assertWorkflowNodeOccurrenceLineageInTransaction({
      db,
      taskID: input.origin.taskID,
      workflowBinding: input.origin.workflowBinding,
      workflowNodeID: input.origin.workflowNodeID,
      dispatchID: input.origin.dispatchID,
      workflowOccurrenceID: input.origin.workflowOccurrenceID ?? input.origin.dispatchID,
      childSessionID: input.childSessionID,
      continuation: !!input.origin.continuationOfDispatchID || !!input.origin.coordinationActionID,
    })
    insertEngineArtifact(db, {
      id: artifactID,
      taskID: input.origin.taskID,
      kind: "dispatch_lineage",
      label: "dispatch-lineage",
      payload,
      timeCreated: now,
    })
    bindWorkflowNodeOccurrenceLineageInTransaction({
      db,
      commit: occurrenceCommit,
      lineageArtifactID: artifactID,
      now,
    })
  })
  return {
    artifactID,
    taskID: input.origin.taskID,
    dispatchID: input.origin.dispatchID,
    payload,
    timeCreated: now,
  }
}

export function findDispatchLineageBySession(input: {
  taskID: string
  sessionID: string
}): DispatchLineageRow | undefined {
  return Database.use((db) => {
    const row = db
      .select()
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.kind, "dispatch_lineage"),
          sql`json_extract(${EngineArtifactTable.payload}, '$.child_session_id') = ${input.sessionID}`,
        ),
      )
      .orderBy(desc(EngineArtifactTable.time_created), desc(EngineArtifactTable.id))
      .get()
    return row ? dispatchLineageRow(row) : undefined
  })
}

export function findDispatchLineageByDispatchID(input: {
  taskID: string
  dispatchID: string
}): DispatchLineageRow | undefined {
  const matches = listDispatchLineage(input.taskID).filter((lineage) => lineage.dispatchID === input.dispatchID)
  if (matches.length > 1) {
    throw new Error(`Dispatch identity ${input.dispatchID} has ${matches.length} lineages in Task ${input.taskID}`)
  }
  return matches[0]
}

export function resolveDispatchOccurrenceAuthority(input: {
  taskID: string
  dispatchID: string
}): DispatchOccurrenceAuthority {
  const lineage = findDispatchLineageByDispatchID(input)
  return lineage
    ? {
        occurrence_status: "occurrence_committed",
        dispatch_lineage_id: lineage.artifactID,
        dispatch_id: lineage.dispatchID,
      }
    : { occurrence_status: "occurrence_not_committed" }
}

/** Resolve the immutable child created by one exact parent tool execution. */
export function findDispatchLineageByToolExecution(input: {
  taskID: string
  toolPartID: string
  toolCallID: string
}): DispatchLineageRow | undefined {
  return Database.use((db) => {
    const rows = db
      .select()
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.kind, "dispatch_lineage"),
          sql`json_extract(${EngineArtifactTable.payload}, '$.tool_part_id') = ${input.toolPartID}`,
          sql`json_extract(${EngineArtifactTable.payload}, '$.tool_call_id') = ${input.toolCallID}`,
        ),
      )
      .orderBy(asc(EngineArtifactTable.time_created), asc(EngineArtifactTable.id))
      .all()
    if (rows.length > 1) {
      throw new Error(
        `Dispatch tool execution ${input.toolPartID}/${input.toolCallID} has ${rows.length} immutable lineages`,
      )
    }
    return rows[0] ? dispatchLineageRow(rows[0]) : undefined
  })
}

export function findDispatchLineageByArtifactID(input: {
  taskID: string
  artifactID: string
}): DispatchLineageRow | undefined {
  return Database.use((db) => {
    const row = db
      .select()
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.id, input.artifactID),
          eq(EngineArtifactTable.kind, "dispatch_lineage"),
        ),
      )
      .get()
    return row ? dispatchLineageRow(row) : undefined
  })
}

export function listDispatchLineage(taskID: string): DispatchLineageRow[] {
  return Database.use((db) =>
    db
      .select()
      .from(EngineArtifactTable)
      .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "dispatch_lineage")))
      .orderBy(asc(EngineArtifactTable.time_created), asc(EngineArtifactTable.id))
      .all()
      .map(dispatchLineageRow),
  )
}

export function parseDispatchLineagePayload(payload: unknown, artifactID: string): DispatchLineagePayload {
  const parsed = DispatchLineagePayloadSchema.safeParse(payload)
  if (!parsed.success) {
    throw new Error(`Invalid dispatch_lineage artifact ${artifactID}: ${parsed.error.message}`)
  }
  return deepFreeze({
    ...parsed.data,
    adapter_input: freezeDispatchAdapterInput(parsed.data.adapter_input),
  }) as DispatchLineagePayload
}

function dispatchLineageRow(row: typeof EngineArtifactTable.$inferSelect): DispatchLineageRow {
  const payload = parseDispatchLineagePayload(row.payload, row.id)
  return {
    artifactID: row.id,
    taskID: row.task_id,
    dispatchID: payload.dispatch_id,
    payload,
    timeCreated: row.time_created,
  }
}
