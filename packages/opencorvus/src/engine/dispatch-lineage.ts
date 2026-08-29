import { ProjectedAgentWorkScopeSchema, type ProjectedAgentWorkScope } from "@/agent/projected-agent-work-scope"
import { ProjectedWorkerIdentitySchema, type ProjectedWorkerIdentity } from "@/agent/projected-worker-identity"
import { insertEngineArtifact } from "@/engine/artifact"
import { EngineArtifactTable, EngineTaskTable } from "@/engine/engine.sql"
import { Identifier } from "@/id/id"
import { currentRuntimeOccurrenceID } from "@/runtime/process-occurrence"
import { and, asc, desc, eq, sql, Database } from "@/storage/db"
import { SelectedWorkflowBindingSchema, type SelectedWorkflowBinding } from "./workflow-binding"
import { assertCurrentDeliverySliceRevisionIDs, projectTaskRowInTransaction } from "./store"
import { assertTaskWorkflowBindingInTransaction } from "./workflow-binding-facts"
import { assertCurrentDeliverySliceRevisionIDsInTransaction } from "./delivery-slice-membership-facts"
import type { DispatchOccurrenceAuthority } from "./dispatch-occurrence-authority"
import { assertWorkflowNodeOccurrenceLineageInTransaction } from "./workflow-node-occurrence"
import { taskCancellationAuthorityExecutionErrorInTransaction } from "./cancellation-projection"
import { taskCompletionClosureInTransaction, TaskCompletionClosureConflictError } from "./task-completion-closure"
import { assertProcessLivenessOwnerInTransaction, ProcessLivenessOwnerUnavailableError } from "./process-liveness"
import {
  dispatchLineageRow,
  findDispatchLineageByDispatchIDInTransaction,
  freezeDispatchAdapterInput,
  parseDispatchLineagePayload,
  type DispatchLineageRow,
} from "./dispatch-lineage-facts"

export class TaskDispatchAdmissionClosedError extends Error {
  override readonly name = "TaskDispatchAdmissionClosedError"
  readonly code = "TASK_DISPATCH_ADMISSION_CLOSED"

  constructor(
    readonly taskID: string,
    readonly timeCompleted: number,
    readonly dispatchID: string,
  ) {
    super(`Task ${taskID} completed at ${timeCompleted}; dispatch ${dispatchID} admission is closed`)
  }
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

export function resolveDispatchContinuationSourceID(input: {
  continuationDispatchID?: string
  coordinationSourceDispatchID?: string
}): string | undefined {
  if (
    input.continuationDispatchID &&
    input.coordinationSourceDispatchID &&
    input.continuationDispatchID !== input.coordinationSourceDispatchID
  ) {
    throw new Error(
      `Dispatch continuation source ${input.continuationDispatchID} conflicts with coordination source ${input.coordinationSourceDispatchID}`,
    )
  }
  return input.continuationDispatchID ?? input.coordinationSourceDispatchID
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
  let ownerProcessOccurrenceID: string
  try {
    ownerProcessOccurrenceID = currentRuntimeOccurrenceID()
  } catch (error) {
    throw new ProcessLivenessOwnerUnavailableError(
      `Dispatch ${input.origin.dispatchID} cannot establish its runtime process occurrence`,
      error,
    )
  }
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
      delivery_owner: {
        kind: "runtime_process",
        process_occurrence_id: ownerProcessOccurrenceID,
      },
      adapter_input: input.origin.adapterInput,
      time_created: now,
    },
    artifactID,
  )
  Database.transaction((db) => {
    assertProcessLivenessOwnerInTransaction(db, ownerProcessOccurrenceID, now)
    const cancellation = taskCancellationAuthorityExecutionErrorInTransaction(
      db,
      input.origin.taskID,
      `dispatch_agent ${input.origin.targetAgentID} lineage commit`,
    )
    if (cancellation) throw cancellation
    const persistedTask = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, input.origin.taskID)).get()
    if (!persistedTask) throw new Error(`Dispatch Task ${input.origin.taskID} does not exist`)
    const task = projectTaskRowInTransaction(db, persistedTask)
    if (task.time_completed !== null) {
      throw new TaskDispatchAdmissionClosedError(input.origin.taskID, task.time_completed, input.origin.dispatchID)
    }
    const completionClosure = taskCompletionClosureInTransaction(db, input.origin.taskID)
    if (completionClosure) {
      throw new TaskCompletionClosureConflictError(input.origin.taskID, completionClosure.owner_id)
    }
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
    insertEngineArtifact(db, {
      id: artifactID,
      taskID: input.origin.taskID,
      kind: "dispatch_lineage",
      label: "dispatch-lineage",
      payload,
      timeCreated: now,
    })
    assertWorkflowNodeOccurrenceLineageInTransaction({
      db,
      taskID: input.origin.taskID,
      workflowBinding: input.origin.workflowBinding,
      workflowNodeID: input.origin.workflowNodeID,
      dispatchID: input.origin.dispatchID,
      workflowOccurrenceID: input.origin.workflowOccurrenceID ?? input.origin.dispatchID,
      childSessionID: input.childSessionID,
      lineageArtifactID: artifactID,
      continuation: !!input.origin.continuationOfDispatchID || !!input.origin.coordinationActionID,
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
  return Database.use((db) => findDispatchLineageByDispatchIDInTransaction({ db, ...input }))
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
