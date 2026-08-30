import { ProjectedAgentWorkScopeSchema, type ProjectedAgentWorkScope } from "@/agent/projected-agent-work-scope"
import { ProjectedWorkerIdentitySchema, type ProjectedWorkerIdentity } from "@/agent/projected-worker-identity"
import { insertEngineArtifact } from "@/engine/artifact"
import { EngineArtifactTable, EngineTaskTable } from "@/engine/engine.sql"
import { Identifier } from "@/id/id"
import { currentRuntimeOccurrenceID } from "@/runtime/process-occurrence"
import { WorkerTurnDescriptorTable } from "@/session/session.sql"
import { and, asc, desc, eq, sql, Database } from "@/storage/db"
import { isDeepStrictEqual } from "node:util"
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
  acquireControlLeaseInTransaction,
  assertControlLeaseInTransaction,
  ControlLeaseFenceLostError,
  currentControlLeaseInTransaction,
  releaseControlLease,
  releaseControlLeaseInTransaction,
  releaseControlLeaseOnErrorPath,
  renewControlLease,
  type ControlLease,
} from "./control-lease"
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

let dispatchAdmissionLeaseMilliseconds = 120_000
let dispatchAdmissionRenewalMilliseconds = 40_000

export interface DispatchAdmissionOwner {
  lineageArtifactID: string
  leaseID: string
  ownerOccurrenceID: string
  expiresAt: number
}

function dispatchAdmissionOwner(lineageArtifactID: string, lease: ControlLease): DispatchAdmissionOwner {
  return {
    lineageArtifactID,
    leaseID: lease.id,
    ownerOccurrenceID: lease.owner_occurrence_id,
    expiresAt: lease.expires_at,
  }
}

/** Renew one exact pre-effect owner until the descriptor transaction consumes it. */
export function holdDispatchAdmission(owner: DispatchAdmissionOwner): Disposable & { signal: AbortSignal } {
  let closed = false
  let expiresAt = owner.expiresAt
  const fence = new AbortController()
  const renewal = setInterval(() => {
    if (closed) return
    const now = Date.now()
    try {
      renewControlLease({
        target: "dispatch_admission",
        targetID: owner.lineageArtifactID,
        leaseID: owner.leaseID,
        ownerOccurrenceID: owner.ownerOccurrenceID,
        now,
        expiresAt: now + dispatchAdmissionLeaseMilliseconds,
      })
      expiresAt = now + dispatchAdmissionLeaseMilliseconds
    } catch (error) {
      if (!(error instanceof ControlLeaseFenceLostError) && now < expiresAt) return
      closed = true
      clearInterval(renewal)
      fence.abort(error)
    }
  }, dispatchAdmissionRenewalMilliseconds)
  renewal.unref?.()
  return {
    signal: fence.signal,
    [Symbol.dispose]() {
      if (closed) return
      closed = true
      clearInterval(renewal)
    },
  }
}

export function releaseDispatchAdmission(owner: DispatchAdmissionOwner): boolean {
  return releaseControlLease({
    target: "dispatch_admission",
    targetID: owner.lineageArtifactID,
    leaseID: owner.leaseID,
    ownerOccurrenceID: owner.ownerOccurrenceID,
    now: Date.now(),
  })
}

export function releaseDispatchAdmissionOnError(owner: DispatchAdmissionOwner): void {
  releaseControlLeaseOnErrorPath({
    target: "dispatch_admission",
    targetID: owner.lineageArtifactID,
    leaseID: owner.leaseID,
    ownerOccurrenceID: owner.ownerOccurrenceID,
    now: Date.now(),
  })
}

export interface DispatchLineageOrigin {
  dispatchID: string
  taskID: string
  orchestratorSessionID: string
  orchestratorMessageID: string
  toolPartID: string
  toolCallID: string
  toolName?: "dispatch_agent" | "dispatch_agents"
  collectionMemberIndex?: number
  collectionMemberCount?: number
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

function assertCoordinationDispatchAdmissionInTransaction(
  db: Database.TxOrDb,
  input: { taskID: string; actionID?: string; childSessionID: string; targetAgentID: string },
): void {
  if (!input.actionID) return
  const actionRow = db
    .select({ payload: EngineArtifactTable.payload })
    .from(EngineArtifactTable)
    .where(
      and(
        eq(EngineArtifactTable.task_id, input.taskID),
        eq(EngineArtifactTable.id, input.actionID),
        eq(EngineArtifactTable.kind, "agent_coordination_action"),
      ),
    )
    .get()
  const action = actionRow?.payload as
    | { action?: unknown; status?: unknown; target_session_id?: unknown; target_agent?: unknown }
    | undefined
  if (
    action?.action !== "redispatch_worker" ||
    action.status !== "pending" ||
    action.target_session_id !== input.childSessionID ||
    action.target_agent !== input.targetAgentID
  ) {
    throw new Error(`Dispatch coordination action ${input.actionID} is not the exact pending redispatch authority`)
  }
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
  const dispatchID =
    input.dispatchID ??
    Identifier.deterministic(
      "artifact",
      `dispatch-tool-occurrence\0${input.taskID}\0${input.toolPartID}\0${input.toolCallID}\0${input.toolName ?? "dispatch_agent"}\0${input.collectionMemberIndex ?? "direct"}`,
    )
  const adapterInput = freezeDispatchAdapterInput(input.adapterInput)
  const identity = ProjectedWorkerIdentitySchema.parse(input.projectedWorkerIdentity)
  if (identity.agentID !== input.targetAgentID) {
    throw new Error(
      `Dispatch target ${input.targetAgentID} does not match projected worker identity ${identity.agentID}`,
    )
  }
  const workflowBinding = SelectedWorkflowBindingSchema.parse(input.workflowBinding)
  const toolName = input.toolName ?? "dispatch_agent"
  if (toolName === "dispatch_agent") {
    if (input.collectionMemberIndex !== undefined || input.collectionMemberCount !== undefined) {
      throw new Error("Direct dispatch_agent origin cannot carry collection member identity")
    }
  } else if (
    input.collectionMemberIndex === undefined ||
    input.collectionMemberCount === undefined ||
    input.collectionMemberIndex < 0 ||
    input.collectionMemberIndex >= input.collectionMemberCount
  ) {
    throw new Error("dispatch_agents origin requires an exact collection member index and count")
  }
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
    toolName,
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
  deferWorkflowOccurrenceProjection?: boolean
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
      tool_name: input.origin.toolName ?? "dispatch_agent",
      ...(input.origin.toolName === "dispatch_agents"
        ? {
            collection_member_index: input.origin.collectionMemberIndex,
            collection_member_count: input.origin.collectionMemberCount,
          }
        : {}),
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
    assertCoordinationDispatchAdmissionInTransaction(db, {
      taskID: input.origin.taskID,
      actionID: input.origin.coordinationActionID,
      childSessionID: input.childSessionID,
      targetAgentID: input.origin.targetAgentID,
    })
    insertEngineArtifact(db, {
      id: artifactID,
      taskID: input.origin.taskID,
      kind: "dispatch_lineage",
      label: "dispatch-lineage",
      payload,
      timeCreated: now,
    })
    if (!input.deferWorkflowOccurrenceProjection) {
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
    }
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
          sql`json_extract(${EngineArtifactTable.payload}, '$.tool_name') = 'dispatch_agent'`,
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

/** Resolve one exact member of a real persisted dispatch_agents Tool occurrence. */
export function findDispatchLineageByCollectionMember(input: {
  taskID: string
  toolPartID: string
  toolCallID: string
  memberIndex: number
  memberCount: number
}): DispatchLineageRow | undefined {
  return Database.use((db) => {
    const rows = db
      .select()
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.kind, "dispatch_lineage"),
          sql`json_extract(${EngineArtifactTable.payload}, '$.tool_name') = 'dispatch_agents'`,
          sql`json_extract(${EngineArtifactTable.payload}, '$.tool_part_id') = ${input.toolPartID}`,
          sql`json_extract(${EngineArtifactTable.payload}, '$.tool_call_id') = ${input.toolCallID}`,
          sql`json_extract(${EngineArtifactTable.payload}, '$.collection_member_index') = ${input.memberIndex}`,
        ),
      )
      .orderBy(asc(EngineArtifactTable.time_created), asc(EngineArtifactTable.id))
      .all()
    if (rows.length > 1) {
      throw new Error(
        `Dispatch collection member ${input.toolPartID}/${input.toolCallID}/${input.memberIndex} has ${rows.length} immutable lineages`,
      )
    }
    const lineage = rows[0] ? dispatchLineageRow(rows[0]) : undefined
    if (lineage && lineage.payload.collection_member_count !== input.memberCount) {
      throw new Error(
        `Dispatch collection member ${input.toolPartID}/${input.toolCallID}/${input.memberIndex} count drift: ` +
          `${lineage?.payload.collection_member_count ?? "missing"} != ${input.memberCount}`,
      )
    }
    return lineage
  })
}

function dispatchLineageMatchesClaim(input: {
  lineage: DispatchLineageRow
  origin: DispatchLineageOrigin
  childSessionID: string
}): boolean {
  const payload = input.lineage.payload
  return (
    input.lineage.dispatchID === input.origin.dispatchID &&
    payload.child_session_id === input.childSessionID &&
    payload.orchestrator_session_id === input.origin.orchestratorSessionID &&
    payload.orchestrator_message_id === input.origin.orchestratorMessageID &&
    payload.tool_part_id === input.origin.toolPartID &&
    payload.tool_call_id === input.origin.toolCallID &&
    payload.tool_name === (input.origin.toolName ?? "dispatch_agent") &&
    payload.collection_member_index === input.origin.collectionMemberIndex &&
    payload.collection_member_count === input.origin.collectionMemberCount &&
    payload.target_agent_id === input.origin.targetAgentID &&
    isDeepStrictEqual(payload.projected_worker_identity, input.origin.projectedWorkerIdentity) &&
    isDeepStrictEqual(payload.work_scope, input.origin.workScope) &&
    isDeepStrictEqual(payload.delivery_slice_revision_ids, input.origin.deliverySliceRevisionIDs ?? []) &&
    isDeepStrictEqual(payload.workflow_binding, input.origin.workflowBinding) &&
    payload.workflow_node_id === input.origin.workflowNodeID &&
    payload.workflow_occurrence_id === (input.origin.workflowOccurrenceID ?? input.origin.dispatchID) &&
    payload.coordination_action_id === input.origin.coordinationActionID &&
    payload.continuation_of_dispatch_id === input.origin.continuationOfDispatchID &&
    isDeepStrictEqual(payload.adapter_input, input.origin.adapterInput)
  )
}

/**
 * Atomically claim one real parent Tool occurrence before any child Session or
 * Provider effect. A concurrent loser resolves the exact immutable winner and
 * never receives authority to create physical work.
 */
export function claimDispatchLineage(input: {
  origin: DispatchLineageOrigin
  childSessionID: string
  now?: number
}): {
  lineage: DispatchLineageRow
  createdNow: boolean
  admission?: DispatchAdmissionOwner
  currentAdmission?: DispatchAdmissionOwner
} {
  const now = input.now ?? Date.now()
  let ownerProcessOccurrenceID: string
  try {
    ownerProcessOccurrenceID = currentRuntimeOccurrenceID()
  } catch (error) {
    throw new ProcessLivenessOwnerUnavailableError(
      `Dispatch ${input.origin.dispatchID} cannot establish its admission owner`,
      error,
    )
  }
  return Database.immediateTransaction((db) => {
    let lineage: DispatchLineageRow
    let createdNow = false
    try {
      lineage = recordDispatchLineage({ ...input, now, deferWorkflowOccurrenceProjection: true })
      createdNow = true
    } catch (error) {
      const winner =
        input.origin.toolName === "dispatch_agents"
          ? findDispatchLineageByCollectionMember({
              taskID: input.origin.taskID,
              toolPartID: input.origin.toolPartID,
              toolCallID: input.origin.toolCallID,
              memberIndex: input.origin.collectionMemberIndex!,
              memberCount: input.origin.collectionMemberCount!,
            })
          : findDispatchLineageByToolExecution({
              taskID: input.origin.taskID,
              toolPartID: input.origin.toolPartID,
              toolCallID: input.origin.toolCallID,
            })
      if (!winner) throw error
      if (!dispatchLineageMatchesClaim({ lineage: winner, origin: input.origin, childSessionID: input.childSessionID })) {
        throw new Error(
          `Dispatch tool occurrence ${input.origin.toolPartID}/${input.origin.toolCallID} claim input drift`,
          { cause: error },
        )
      }
      lineage = winner
    }
    const acceptedDescriptor = db
      .select({ id: WorkerTurnDescriptorTable.id })
      .from(WorkerTurnDescriptorTable)
      .where(
        and(
          eq(WorkerTurnDescriptorTable.session_id, lineage.payload.child_session_id),
          sql`json_extract(${WorkerTurnDescriptorTable.payload}, '$.dispatchTurn.current_dispatch_id') = ${lineage.dispatchID}`,
        ),
      )
      .get()
    const terminalSettlement = db
      .select({ id: EngineArtifactTable.id })
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, lineage.taskID),
          eq(EngineArtifactTable.kind, "dispatch_settlement"),
          sql`json_extract(${EngineArtifactTable.payload}, '$.dispatch_id') = ${lineage.dispatchID}`,
        ),
      )
      .get()
    if (acceptedDescriptor || terminalSettlement) {
      const current = currentControlLeaseInTransaction(db, "dispatch_admission", lineage.artifactID)
      return {
        lineage,
        createdNow,
        ...(current ? { currentAdmission: dispatchAdmissionOwner(lineage.artifactID, current) } : {}),
      }
    }
    assertCoordinationDispatchAdmissionInTransaction(db, {
      taskID: input.origin.taskID,
      actionID: input.origin.coordinationActionID,
      childSessionID: input.childSessionID,
      targetAgentID: input.origin.targetAgentID,
    })
    const acquisition = acquireControlLeaseInTransaction(db, {
      target: "dispatch_admission",
      targetID: lineage.artifactID,
      ownerOccurrenceID: ownerProcessOccurrenceID,
      now,
      leaseMilliseconds: dispatchAdmissionLeaseMilliseconds,
    })
    return {
      lineage,
      createdNow,
      ...(acquisition.acquired ? { admission: dispatchAdmissionOwner(lineage.artifactID, acquisition.lease) } : {}),
      currentAdmission: dispatchAdmissionOwner(lineage.artifactID, acquisition.lease),
    }
  })
}

export const DispatchLineageTestHooks = Object.freeze({
  replaceAdmissionTiming(input: { leaseMilliseconds: number; renewalMilliseconds: number }): Disposable {
    if (
      !Number.isSafeInteger(input.leaseMilliseconds) ||
      input.leaseMilliseconds <= 0 ||
      !Number.isSafeInteger(input.renewalMilliseconds) ||
      input.renewalMilliseconds <= 0 ||
      input.renewalMilliseconds >= input.leaseMilliseconds
    ) {
      throw new Error("Dispatch admission test timing requires positive renewal shorter than the lease")
    }
    const priorLease = dispatchAdmissionLeaseMilliseconds
    const priorRenewal = dispatchAdmissionRenewalMilliseconds
    dispatchAdmissionLeaseMilliseconds = input.leaseMilliseconds
    dispatchAdmissionRenewalMilliseconds = input.renewalMilliseconds
    return {
      [Symbol.dispose]() {
        dispatchAdmissionLeaseMilliseconds = priorLease
        dispatchAdmissionRenewalMilliseconds = priorRenewal
      },
    }
  },
})

/** Materialize the workflow-node projection after the claimed child Session is durable. */
export function commitDispatchLineageSession(
  lineage: DispatchLineageRow,
  admission?: DispatchAdmissionOwner,
): void {
  Database.transaction((db) => {
    if (admission) {
      assertControlLeaseInTransaction(db, {
        target: "dispatch_admission",
        targetID: lineage.artifactID,
        leaseID: admission.leaseID,
        ownerOccurrenceID: admission.ownerOccurrenceID,
        now: Date.now(),
      })
    }
    const descriptor = db
      .select({ id: WorkerTurnDescriptorTable.id })
      .from(WorkerTurnDescriptorTable)
      .where(
        and(
          eq(WorkerTurnDescriptorTable.session_id, lineage.payload.child_session_id),
          sql`json_extract(${WorkerTurnDescriptorTable.payload}, '$.dispatchTurn.current_dispatch_id') = ${lineage.dispatchID}`,
        ),
      )
      .get()
    if (!descriptor) {
      throw new Error(
        `Dispatch ${lineage.dispatchID} cannot materialize workflow occurrence without its exact durable Turn descriptor`,
      )
    }
    assertWorkflowNodeOccurrenceLineageInTransaction({
      db,
      taskID: lineage.taskID,
      workflowBinding: lineage.payload.workflow_binding,
      workflowNodeID: lineage.payload.workflow_node_id,
      dispatchID: lineage.dispatchID,
      workflowOccurrenceID: lineage.payload.workflow_occurrence_id,
      childSessionID: lineage.payload.child_session_id,
      lineageArtifactID: lineage.artifactID,
      continuation:
        !!lineage.payload.continuation_of_dispatch_id || !!lineage.payload.coordination_action_id,
    })
    if (admission) {
      const released = releaseControlLeaseInTransaction(db, {
        target: "dispatch_admission",
        targetID: lineage.artifactID,
        leaseID: admission.leaseID,
        ownerOccurrenceID: admission.ownerOccurrenceID,
        now: Date.now(),
      })
      if (!released) throw new Error(`Dispatch admission ${admission.leaseID} could not be consumed`)
    }
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
