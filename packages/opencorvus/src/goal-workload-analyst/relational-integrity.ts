import { createHash } from "node:crypto"
import { isDeepStrictEqual } from "node:util"
import { artifactProvenanceForAgentTurn } from "@/agent/artifact-read-facts"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { resolveDeliverySliceRevisionIdentity } from "@/engine/delivery-slice"
import { resolveGoalGraphMembershipBeforeCatalogRevision } from "@/engine/delivery-slice-membership-facts"
import { findDispatchLineageByDispatchIDInTransaction } from "@/engine/dispatch-lineage-facts"
import { EngineArtifactTable, EngineGoalTable } from "@/engine/engine.sql"
import { Message } from "@/session/message"
import { MessageTable, SessionTable } from "@/session/session.sql"
import type { Database } from "@/storage/db"
import { and, eq, sql } from "drizzle-orm"
import {
  GoalWorkloadArtifactSchema,
  validateGoalWorkloadArtifactAgainstMembership,
  type GoalWorkloadArtifact,
} from "./types"

export function goalWorkloadPublicationArtifactID(input: { taskID: string; dispatchID: string }): string {
  const digest = createHash("sha256")
    .update(`opencorvus.goal-workload.publication.v2\0${input.taskID}\0${input.dispatchID}`)
    .digest("hex")
  return `art_goal_workload_${digest}`
}

export function validateGoalWorkloadArtifactRelationalIntegrity(input: {
  db: Database.TxOrDb
  row: typeof EngineArtifactTable.$inferSelect
  payload?: GoalWorkloadArtifact
}): GoalWorkloadArtifact {
  const payload = input.payload ?? GoalWorkloadArtifactSchema.parse(input.row.payload)
  if (
    input.row.id !==
    goalWorkloadPublicationArtifactID({
      taskID: input.row.task_id,
      dispatchID: payload.dispatch.dispatch_id,
    })
  ) {
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
