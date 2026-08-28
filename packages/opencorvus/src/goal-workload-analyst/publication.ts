import { createHash } from "node:crypto"
import { isDeepStrictEqual } from "node:util"
import { artifactProvenanceForAgentTurn } from "@/agent/artifact-read-facts"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { resolveDeliverySliceRevisionIdentity } from "@/engine/delivery-slice"
import { resolveGoalGraphMembershipBeforeCatalogRevision } from "@/engine/delivery-slice-membership-facts"
import { findDispatchLineageByDispatchIDInTransaction } from "@/engine/dispatch-lineage-facts"
import { insertEngineArtifact } from "@/engine/artifact"
import { EngineArtifactTable, EngineGoalTable } from "@/engine/engine.sql"
import { assertTaskAssistantProducerMessage } from "@/engine/producer-turn"
import { MessageTable, SessionTable } from "@/session/session.sql"
import { Message } from "@/session/message"
import { Database, and, eq, sql } from "@/storage/db"
import { EngineArtifactLocatorSchema, type EngineArtifactLocator } from "@opencorvus-ai/plugin/artifact-catalog"
import {
  GoalWorkloadArtifactSchema,
  deriveGoalWorkloadCoverage,
  validateGoalWorkloadArtifactAgainstMembership,
  type GoalWorkloadArtifact,
  type WorkloadBrief,
} from "./types"

export type GoalWorkloadPublicationIdentityErrorCode =
  | "dispatch_not_owned_by_task"
  | "dispatch_adapter_identity_mismatch"
  | "child_session_identity_mismatch"
  | "child_session_parent_mismatch"
  | "worker_turn_descriptor_mismatch"
  | "producer_turn_mismatch"

export class GoalWorkloadPublicationIdentityError extends Error {
  override readonly name = "GoalWorkloadPublicationIdentityError"

  constructor(
    readonly code: GoalWorkloadPublicationIdentityErrorCode,
    readonly taskID: string,
    readonly dispatchID: string,
    readonly details: Readonly<Record<string, unknown>>,
  ) {
    super(`Goal Workload publication ${dispatchID} failed identity check ${code}`)
  }
}

export class GoalWorkloadPublicationConflictError extends Error {
  override readonly name = "GoalWorkloadPublicationConflictError"
  readonly code = "publication_payload_mismatch" as const

  constructor(
    readonly taskID: string,
    readonly dispatchID: string,
    readonly artifactID: string,
    readonly mismatchedFields: readonly string[],
  ) {
    super(`Goal Workload publication ${dispatchID} conflicts in ${mismatchedFields.join(", ")}`)
  }
}

export function goalWorkloadPublicationArtifactID(input: { taskID: string; dispatchID: string }): string {
  const digest = createHash("sha256")
    .update(`opencorvus.goal-workload.publication.v2\0${input.taskID}\0${input.dispatchID}`)
    .digest("hex")
  return `art_goal_workload_${digest}`
}

function exactArtifactLocator(row: typeof EngineArtifactTable.$inferSelect): EngineArtifactLocator {
  return EngineArtifactLocatorSchema.parse({
    source: "engine_artifact",
    artifact_id: row.id,
    catalog_revision: row.catalog_revision,
    expected_sha256: row.payload_sha256,
  })
}

export function validateGoalWorkloadArtifactRelationalIntegrity(input: {
  db: Database.TxOrDb
  row: typeof EngineArtifactTable.$inferSelect
  payload?: GoalWorkloadArtifact
}): GoalWorkloadArtifact {
  const payload = input.payload ?? GoalWorkloadArtifactSchema.parse(input.row.payload)
  if (input.row.id !== goalWorkloadPublicationArtifactID({
    taskID: input.row.task_id,
    dispatchID: payload.dispatch.dispatch_id,
  })) {
    throw new Error(`Goal Workload ${input.row.id} does not match its Task/dispatch publication identity`)
  }
  const lineage = findDispatchLineageByDispatchIDInTransaction({
    db: input.db,
    taskID: input.row.task_id,
    dispatchID: payload.dispatch.dispatch_id,
  })
  if (!lineage || lineage.artifactID !== payload.dispatch.dispatch_lineage_artifact_id) {
    throw new Error(`Goal Workload ${input.row.id} does not reference its exact dispatch lineage`)
  }
  const identity = lineage.payload.projected_worker_identity
  if (
    identity.dispatchAdapterID !== "workload_analysis" ||
    identity.sessionKind !== "goal-workload-analyst" ||
    lineage.payload.child_session_id !== payload.producer.session_id ||
    lineage.payload.workflow_occurrence_id !== payload.dispatch.workflow_occurrence_id ||
    payload.dispatch.task_id !== input.row.task_id
  ) {
    throw new Error(`Goal Workload ${input.row.id} dispatch identity is inconsistent`)
  }
  const session = input.db
    .select({ kind: SessionTable.kind, parentID: SessionTable.parent_id })
    .from(SessionTable)
    .where(eq(SessionTable.id, payload.producer.session_id))
    .get()
  if (
    !session ||
    session.kind !== "goal-workload-analyst" ||
    session.parentID !== lineage.payload.orchestrator_session_id
  ) {
    throw new Error(`Goal Workload ${input.row.id} producer Session is inconsistent`)
  }
  const orchestratorInTaskTree = input.db.get<{ id: string }>(sql`
    WITH RECURSIVE session_tree(id, project_id) AS (
      SELECT session_id, project_id
      FROM engine_task
      WHERE id = ${input.row.task_id} AND session_id IS NOT NULL
      UNION
      SELECT session.id, session.project_id
      FROM session
      JOIN session_tree
        ON session.parent_id = session_tree.id
       AND session.project_id = session_tree.project_id
    )
    SELECT id
    FROM session_tree
    WHERE id = ${lineage.payload.orchestrator_session_id}
    LIMIT 1
  `)
  if (!orchestratorInTaskTree) {
    throw new Error(`Goal Workload ${input.row.id} producer Session does not descend from its Task root`)
  }
  const descriptor = WorkerTurnDescriptor.findForDispatchInDatabase(input.db, {
    sessionID: payload.producer.session_id,
    dispatchID: payload.dispatch.dispatch_id,
  })
  const turn = descriptor?.payload.dispatchTurn
  if (
    !descriptor ||
    !turn ||
    descriptor.payload.lifecycle.taskID !== input.row.task_id ||
    !isDeepStrictEqual(descriptor.payload.identity, identity) ||
    !isDeepStrictEqual(descriptor.payload.lifecycle.workScope, lineage.payload.work_scope) ||
    turn.current_dispatch_id !== payload.dispatch.dispatch_id ||
    turn.workflow_occurrence_id !== lineage.payload.workflow_occurrence_id ||
    !isDeepStrictEqual(turn.workflow_binding, lineage.payload.workflow_binding) ||
    turn.workflow_node_id !== lineage.payload.workflow_node_id ||
    turn.task_authority.task_id !== input.row.task_id ||
    !isDeepStrictEqual(turn.delivery_slice_revision_ids, lineage.payload.delivery_slice_revision_ids) ||
    (turn.kind === "continuation"
      ? turn.child_session_id !== payload.producer.session_id ||
        turn.source_dispatch_id !== lineage.payload.continuation_of_dispatch_id
      : lineage.payload.continuation_of_dispatch_id !== undefined)
  ) {
    throw new Error(`Goal Workload ${input.row.id} Worker Turn descriptor is inconsistent`)
  }
  const producerRow = input.db
    .select({ data: MessageTable.data })
    .from(MessageTable)
    .where(
      and(
        eq(MessageTable.id, payload.producer.final_message_id),
        eq(MessageTable.session_id, payload.producer.session_id),
      ),
    )
    .get()
  const producer = Message.Assistant.safeParse(
    producerRow
      ? { ...producerRow.data, id: payload.producer.final_message_id, sessionID: payload.producer.session_id }
      : undefined,
  )
  if (
    !producer.success ||
    producer.data.time.completed === undefined ||
    producer.data.parentID !== descriptor.payload.messageAuthority.user_message_id ||
    producer.data.agent !== descriptor.payload.identity.agentID
  ) {
    throw new Error(`Goal Workload ${input.row.id} producer Message is inconsistent`)
  }
  const goals = input.db.select().from(EngineGoalTable).where(eq(EngineGoalTable.task_id, input.row.task_id)).all()
  const goalsByID = new Map(goals.map((goal) => [goal.id, goal]))
  const selectedSubjects = [...lineage.payload.delivery_slice_revision_ids].sort().map((revisionID) => {
    const goal = goalsByID.get(revisionID)
    if (!goal) throw new Error(`Goal Workload ${input.row.id} selected revision ${revisionID} does not exist`)
    const resolved = resolveDeliverySliceRevisionIdentity(goal, goals)
    return {
      delivery_slice_id: resolved.deliverySliceID,
      delivery_slice_revision_id: resolved.deliverySliceRevisionID,
      revision: resolved.revision,
    }
  })
  if (!isDeepStrictEqual(payload.selected_subjects, selectedSubjects)) {
    throw new Error(`Goal Workload ${input.row.id} selected subjects differ from its dispatch lineage`)
  }
  const provenance = artifactProvenanceForAgentTurn(payload.producer.session_id, payload.producer.final_message_id)
  if (
    !isDeepStrictEqual(payload.observed_artifact_locators, provenance.observedArtifactLocators) ||
    !isDeepStrictEqual(payload.source_artifact_locators, provenance.sourceArtifactLocators)
  ) {
    throw new Error(`Goal Workload ${input.row.id} provenance differs from its exact producer Turn`)
  }
  const membership = resolveGoalGraphMembershipBeforeCatalogRevision({
    db: input.db,
    taskID: input.row.task_id,
    catalogRevision: input.row.catalog_revision,
  })
  return validateGoalWorkloadArtifactAgainstMembership({ ...input, payload, membership })
}

function publicationResult(row: typeof EngineArtifactTable.$inferSelect, payload: GoalWorkloadArtifact) {
  return {
    locator: exactArtifactLocator(row),
    deliveryStatus: payload.coverage_receipt.status,
  } as const
}

function identityError(
  code: GoalWorkloadPublicationIdentityErrorCode,
  input: { taskID: string; dispatchID: string },
  details: Record<string, unknown>,
): never {
  throw new GoalWorkloadPublicationIdentityError(code, input.taskID, input.dispatchID, details)
}

export function publishGoalWorkload(input: {
  taskID: string
  dispatchID: string
  sessionID: string
  finalMessageID: string
  briefs: readonly WorkloadBrief[]
  now: number
}): { locator: EngineArtifactLocator; deliveryStatus: "complete" | "incomplete" | "conflict" } {
  return Database.immediateTransaction((db) => {
    const artifactID = goalWorkloadPublicationArtifactID(input)
    const existing = db.select().from(EngineArtifactTable).where(eq(EngineArtifactTable.id, artifactID)).get()
    if (existing) {
      if (existing.task_id !== input.taskID || existing.kind !== "goal_workload") {
        throw new GoalWorkloadPublicationConflictError(input.taskID, input.dispatchID, artifactID, ["task_or_kind"])
      }
      const payload = GoalWorkloadArtifactSchema.parse(existing.payload)
      const mismatched = [
        ...(payload.dispatch.dispatch_id === input.dispatchID ? [] : ["dispatch_id"]),
        ...(payload.producer.session_id === input.sessionID ? [] : ["producer.session_id"]),
        ...(payload.producer.final_message_id === input.finalMessageID ? [] : ["producer.final_message_id"]),
        ...(isDeepStrictEqual(payload.briefs, input.briefs) ? [] : ["briefs"]),
      ]
      if (mismatched.length > 0) {
        throw new GoalWorkloadPublicationConflictError(input.taskID, input.dispatchID, artifactID, mismatched)
      }
      validateGoalWorkloadArtifactRelationalIntegrity({ db, row: existing, payload })
      return publicationResult(existing, payload)
    }

    const lineage = findDispatchLineageByDispatchIDInTransaction({
      db,
      taskID: input.taskID,
      dispatchID: input.dispatchID,
    })
    if (!lineage) {
      const conflicting = db
        .select({ id: EngineArtifactTable.id, taskID: EngineArtifactTable.task_id })
        .from(EngineArtifactTable)
        .where(
          and(
            eq(EngineArtifactTable.kind, "dispatch_lineage"),
            sql`json_extract(${EngineArtifactTable.payload}, '$.dispatch_id') = ${input.dispatchID}`,
          ),
        )
        .get()
      identityError("dispatch_not_owned_by_task", input, {
        requested_task_id: input.taskID,
        conflicting_dispatch_lineage_artifact_id: conflicting?.id,
        conflicting_task_id: conflicting?.taskID,
      })
    }
    const identity = lineage.payload.projected_worker_identity
    if (identity.dispatchAdapterID !== "workload_analysis" || identity.sessionKind !== "goal-workload-analyst") {
      identityError("dispatch_adapter_identity_mismatch", input, {
        dispatch_lineage_artifact_id: lineage.artifactID,
        dispatch_adapter_id: identity.dispatchAdapterID,
        session_kind: identity.sessionKind,
      })
    }
    if (lineage.payload.child_session_id !== input.sessionID) {
      identityError("child_session_identity_mismatch", input, {
        dispatch_lineage_artifact_id: lineage.artifactID,
        expected_session_id: lineage.payload.child_session_id,
        actual_session_id: input.sessionID,
      })
    }
    const session = db.select().from(SessionTable).where(eq(SessionTable.id, input.sessionID)).get()
    if (!session || session.kind !== "goal-workload-analyst") {
      identityError("child_session_identity_mismatch", input, {
        expected_session_kind: "goal-workload-analyst",
        actual_session_kind: session?.kind,
      })
    }
    if (session.parent_id !== lineage.payload.orchestrator_session_id) {
      identityError("child_session_parent_mismatch", input, {
        expected_parent_session_id: lineage.payload.orchestrator_session_id,
        actual_parent_session_id: session.parent_id,
      })
    }
    const descriptor = WorkerTurnDescriptor.findForDispatch({
      sessionID: input.sessionID,
      dispatchID: input.dispatchID,
    })
    const turn = descriptor?.payload.dispatchTurn
    if (
      !descriptor ||
      !turn ||
      descriptor.payload.lifecycle.taskID !== input.taskID ||
      !isDeepStrictEqual(descriptor.payload.identity, identity) ||
      !isDeepStrictEqual(descriptor.payload.lifecycle.workScope, lineage.payload.work_scope) ||
      turn.current_dispatch_id !== input.dispatchID ||
      turn.workflow_occurrence_id !== lineage.payload.workflow_occurrence_id ||
      !isDeepStrictEqual(turn.workflow_binding, lineage.payload.workflow_binding) ||
      turn.workflow_node_id !== lineage.payload.workflow_node_id ||
      turn.task_authority.task_id !== input.taskID ||
      !isDeepStrictEqual(turn.delivery_slice_revision_ids, lineage.payload.delivery_slice_revision_ids) ||
      (turn.kind === "continuation"
        ? turn.child_session_id !== input.sessionID ||
          turn.source_dispatch_id !== lineage.payload.continuation_of_dispatch_id
        : lineage.payload.continuation_of_dispatch_id !== undefined)
    ) {
      identityError("worker_turn_descriptor_mismatch", input, {
        descriptor_id: descriptor?.id,
        dispatch_lineage_artifact_id: lineage.artifactID,
      })
    }
    let producer
    try {
      producer = assertTaskAssistantProducerMessage({
        taskID: input.taskID,
        sessionID: input.sessionID,
        messageID: input.finalMessageID,
        expectedSessionKind: "goal-workload-analyst",
        requireCompleted: true,
      })
    } catch (cause) {
      identityError("producer_turn_mismatch", input, {
        final_message_id: input.finalMessageID,
        reason: cause instanceof Error ? cause.message : String(cause),
      })
    }
    if (
      producer.parentID !== descriptor.payload.messageAuthority.user_message_id ||
      producer.agent !== descriptor.payload.identity.agentID
    ) {
      identityError("producer_turn_mismatch", input, {
        final_message_id: input.finalMessageID,
        expected_parent_message_id: descriptor.payload.messageAuthority.user_message_id,
        actual_parent_message_id: producer.parentID,
        expected_agent_id: descriptor.payload.identity.agentID,
        actual_agent_id: producer.agent,
      })
    }

    const goals = db.select().from(EngineGoalTable).where(eq(EngineGoalTable.task_id, input.taskID)).all()
    const goalsByID = new Map(goals.map((goal) => [goal.id, goal]))
    const selectedSubjects = [...lineage.payload.delivery_slice_revision_ids].sort().map((revisionID) => {
      const goal = goalsByID.get(revisionID)
      if (!goal) {
        identityError("worker_turn_descriptor_mismatch", input, { missing_selected_revision_id: revisionID })
      }
      const resolved = resolveDeliverySliceRevisionIdentity(goal, goals)
      return {
        delivery_slice_id: resolved.deliverySliceID,
        delivery_slice_revision_id: resolved.deliverySliceRevisionID,
        revision: resolved.revision,
      }
    })
    const membership = resolveGoalGraphMembershipBeforeCatalogRevision({
      db,
      taskID: input.taskID,
      catalogRevision: Number.MAX_SAFE_INTEGER,
    })
    const coverage = deriveGoalWorkloadCoverage({
      selectedRevisionIDs: selectedSubjects.map((subject) => subject.delivery_slice_revision_id),
      submittedRevisionIDs: input.briefs.map((brief) => brief.goal_id),
      currentRevisionIDs: membership?.revisionIDs ?? [],
      currentGoalGraphAvailable: !!membership,
    })
    const provenance = artifactProvenanceForAgentTurn(input.sessionID, input.finalMessageID)
    const payload = GoalWorkloadArtifactSchema.parse({
      schema_version: 2,
      producer: { session_id: input.sessionID, final_message_id: input.finalMessageID },
      dispatch: {
        task_id: input.taskID,
        dispatch_id: input.dispatchID,
        dispatch_lineage_artifact_id: lineage.artifactID,
        workflow_occurrence_id: lineage.payload.workflow_occurrence_id,
      },
      selected_subjects: selectedSubjects,
      briefs: input.briefs,
      coverage_receipt: {
        ...coverage,
        current_goal_graph_projection_artifact_locator: membership?.locator ?? null,
      },
      observed_artifact_locators: provenance.observedArtifactLocators,
      source_artifact_locators: provenance.sourceArtifactLocators,
    })
    insertEngineArtifact(db, {
      id: artifactID,
      taskID: input.taskID,
      kind: "goal_workload",
      label: "GoalWorkload",
      payload,
      timeCreated: input.now,
    })
    const row = db.select().from(EngineArtifactTable).where(eq(EngineArtifactTable.id, artifactID)).get()
    if (!row) throw new Error(`Goal Workload Artifact ${artifactID} was not persisted`)
    validateGoalWorkloadArtifactRelationalIntegrity({ db, row, payload })
    return publicationResult(row, payload)
  })
}
