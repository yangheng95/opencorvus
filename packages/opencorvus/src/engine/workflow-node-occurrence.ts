import { and, asc, eq, sql, Database } from "@/storage/db"
import { EngineArtifactTable, EngineWorkflowNodeOccurrenceTable } from "./engine.sql"
import {
  SelectedWorkflowBindingSchema,
  sameSelectedWorkflowBinding,
  type SelectedWorkflowBinding,
} from "./workflow-binding"
import { assertTaskWorkflowBindingInTransaction } from "./workflow-binding-facts"

export type WorkflowNodeOccurrenceLineageReference = Readonly<{
  artifactID: string
  dispatchID: string
  childSessionID: string
  workflowOccurrenceID: string
}>

export class WorkflowNodeOccurrenceConflictError extends Error {
  override readonly name = "WorkflowNodeOccurrenceConflictError"
  readonly code = "workflow_node_occurrence_conflict"

  constructor(
    readonly taskID: string,
    readonly workflowID: string,
    readonly workflowNodeID: string,
    readonly existing: readonly WorkflowNodeOccurrenceLineageReference[],
  ) {
    const authorities = existing.length
      ? existing
          .map(
            (reference) =>
              `${reference.artifactID}/${reference.dispatchID}/${reference.childSessionID}/${reference.workflowOccurrenceID}`,
          )
          .join(", ")
      : "occurrence authority has no readable dispatch lineage"
    super(
      `Task ${taskID} workflow ${workflowID} node ${workflowNodeID} already has an initial logical occurrence: ${authorities}. Use one exact prior dispatch continuation authority; do not issue another initial dispatch.`,
    )
  }
}

type VirtualWorkflowSubject = Readonly<{
  binding: Extract<SelectedWorkflowBinding, { kind: "virtual_workflow" }>
  workflowID: string
  workflowNodeID: string
}>

function virtualWorkflowSubject(
  workflowBinding: SelectedWorkflowBinding,
  workflowNodeID: string | null,
): VirtualWorkflowSubject | undefined {
  const binding = SelectedWorkflowBindingSchema.parse(workflowBinding)
  if (binding.kind === "direct") {
    if (workflowNodeID !== null) throw new Error("Direct workflow occurrence cannot name a workflow node")
    return undefined
  }
  if (!workflowNodeID) throw new Error(`Workflow ${binding.workflow_id} occurrence requires a node ID`)
  if (!binding.nodes.some((node) => node.node_id === workflowNodeID)) {
    throw new Error(`Workflow ${binding.workflow_id} does not declare node ${workflowNodeID}`)
  }
  return { binding, workflowID: binding.workflow_id, workflowNodeID }
}

function existingLineageReferences(
  db: Database.TxOrDb,
  input: { taskID: string; workflowID: string; workflowNodeID: string },
): WorkflowNodeOccurrenceLineageReference[] {
  return db
    .select({ id: EngineArtifactTable.id, payload: EngineArtifactTable.payload })
    .from(EngineArtifactTable)
    .where(
      and(
        eq(EngineArtifactTable.task_id, input.taskID),
        eq(EngineArtifactTable.kind, "dispatch_lineage"),
        sql`json_extract(${EngineArtifactTable.payload}, '$.workflow_binding.kind') = 'virtual_workflow'`,
        sql`json_extract(${EngineArtifactTable.payload}, '$.workflow_binding.workflow_id') = ${input.workflowID}`,
        sql`json_extract(${EngineArtifactTable.payload}, '$.workflow_node_id') = ${input.workflowNodeID}`,
      ),
    )
    .orderBy(asc(EngineArtifactTable.time_created), asc(EngineArtifactTable.id))
    .all()
    .map((row) => {
      const payload = row.payload as Record<string, unknown>
      const dispatchID = payload.dispatch_id
      const childSessionID = payload.child_session_id
      const workflowOccurrenceID = payload.workflow_occurrence_id
      if (
        typeof dispatchID !== "string" ||
        typeof childSessionID !== "string" ||
        typeof workflowOccurrenceID !== "string"
      ) {
        throw new Error(`Dispatch lineage ${row.id} has invalid workflow occurrence references`)
      }
      return { artifactID: row.id, dispatchID, childSessionID, workflowOccurrenceID }
    })
}

function occurrenceRow(
  db: Database.TxOrDb,
  input: { taskID: string; workflowID: string; workflowNodeID: string },
) {
  return db
    .select()
    .from(EngineWorkflowNodeOccurrenceTable)
    .where(
      and(
        eq(EngineWorkflowNodeOccurrenceTable.task_id, input.taskID),
        eq(EngineWorkflowNodeOccurrenceTable.workflow_id, input.workflowID),
        eq(EngineWorkflowNodeOccurrenceTable.workflow_node_id, input.workflowNodeID),
      ),
    )
    .get()
}

export type WorkflowNodeOccurrenceCommit =
  | Readonly<{ kind: "direct" }>
  | Readonly<{
      kind: "initial" | "continuation"
      taskID: string
      workflowID: string
      workflowNodeID: string
      dispatchID: string
      workflowOccurrenceID: string
      childSessionID: string
    }>

export function assertWorkflowNodeOccurrenceLineageInTransaction(input: {
  db: Database.TxOrDb
  taskID: string
  workflowBinding: SelectedWorkflowBinding
  workflowNodeID: string | null
  dispatchID: string
  workflowOccurrenceID: string
  childSessionID: string
  continuation: boolean
}): WorkflowNodeOccurrenceCommit {
  const subject = virtualWorkflowSubject(input.workflowBinding, input.workflowNodeID)
  if (!subject) return { kind: "direct" }
  assertTaskWorkflowBindingInTransaction({
    db: input.db,
    taskID: input.taskID,
    workflowBinding: subject.binding,
  })
  const row = occurrenceRow(input.db, {
    taskID: input.taskID,
    workflowID: subject.workflowID,
    workflowNodeID: subject.workflowNodeID,
  })
  if (row && !sameSelectedWorkflowBinding(row.workflow_binding, subject.binding)) {
    throw new Error(
      `Task ${input.taskID} workflow ${subject.workflowID} node ${subject.workflowNodeID} occurrence binding drift`,
    )
  }
  if (row?.state === "conflicted") {
    throw new WorkflowNodeOccurrenceConflictError(
      input.taskID,
      subject.workflowID,
      subject.workflowNodeID,
      existingLineageReferences(input.db, {
        taskID: input.taskID,
        workflowID: subject.workflowID,
        workflowNodeID: subject.workflowNodeID,
      }),
    )
  }
  if (input.continuation) {
    if (
      row?.state !== "bound" ||
      row.workflow_occurrence_id !== input.workflowOccurrenceID ||
      row.child_session_id !== input.childSessionID
    ) {
      throw new Error(
        `Task ${input.taskID} workflow ${subject.workflowID} node ${subject.workflowNodeID} continuation does not reuse its bound occurrence and Session`,
      )
    }
    return {
      kind: "continuation",
      taskID: input.taskID,
      workflowID: subject.workflowID,
      workflowNodeID: subject.workflowNodeID,
      dispatchID: input.dispatchID,
      workflowOccurrenceID: input.workflowOccurrenceID,
      childSessionID: input.childSessionID,
    }
  }
  if (input.workflowOccurrenceID !== input.dispatchID) {
    throw new Error(
      `Task ${input.taskID} workflow ${subject.workflowID} node ${subject.workflowNodeID} initial lineage must own its occurrence identity`,
    )
  }
  if (row) {
    throw new WorkflowNodeOccurrenceConflictError(
      input.taskID,
      subject.workflowID,
      subject.workflowNodeID,
      existingLineageReferences(input.db, {
        taskID: input.taskID,
        workflowID: subject.workflowID,
        workflowNodeID: subject.workflowNodeID,
      }),
    )
  }
  const now = Date.now()
  input.db
    .insert(EngineWorkflowNodeOccurrenceTable)
    .values({
      task_id: input.taskID,
      workflow_id: subject.workflowID,
      workflow_node_id: subject.workflowNodeID,
      workflow_binding: subject.binding,
      state: "bound",
      workflow_occurrence_id: input.workflowOccurrenceID,
      initial_dispatch_id: input.dispatchID,
      child_session_id: input.childSessionID,
      conflict_lineage_ids: [],
      time_created: now,
      time_updated: now,
    })
    .onConflictDoNothing({
      target: [
        EngineWorkflowNodeOccurrenceTable.task_id,
        EngineWorkflowNodeOccurrenceTable.workflow_id,
        EngineWorkflowNodeOccurrenceTable.workflow_node_id,
      ],
    })
    .run()
  const admitted = occurrenceRow(input.db, {
    taskID: input.taskID,
    workflowID: subject.workflowID,
    workflowNodeID: subject.workflowNodeID,
  })
  if (
    admitted?.state !== "bound" ||
    admitted.initial_dispatch_id !== input.dispatchID ||
    admitted.workflow_occurrence_id !== input.workflowOccurrenceID ||
    admitted.child_session_id !== input.childSessionID ||
    admitted.dispatch_lineage_artifact_id !== null
  ) {
    throw new WorkflowNodeOccurrenceConflictError(
      input.taskID,
      subject.workflowID,
      subject.workflowNodeID,
      existingLineageReferences(input.db, {
        taskID: input.taskID,
        workflowID: subject.workflowID,
        workflowNodeID: subject.workflowNodeID,
      }),
    )
  }
  return {
    kind: "initial",
    taskID: input.taskID,
    workflowID: subject.workflowID,
    workflowNodeID: subject.workflowNodeID,
    dispatchID: input.dispatchID,
    workflowOccurrenceID: input.workflowOccurrenceID,
    childSessionID: input.childSessionID,
  }
}

export function bindWorkflowNodeOccurrenceLineageInTransaction(input: {
  db: Database.TxOrDb
  commit: WorkflowNodeOccurrenceCommit
  lineageArtifactID: string
  now: number
}): void {
  if (input.commit.kind !== "initial") return
  input.db
    .update(EngineWorkflowNodeOccurrenceTable)
    .set({
      dispatch_lineage_artifact_id: input.lineageArtifactID,
      time_updated: input.now,
    })
    .where(
      and(
        eq(EngineWorkflowNodeOccurrenceTable.task_id, input.commit.taskID),
        eq(EngineWorkflowNodeOccurrenceTable.workflow_id, input.commit.workflowID),
        eq(EngineWorkflowNodeOccurrenceTable.workflow_node_id, input.commit.workflowNodeID),
        eq(EngineWorkflowNodeOccurrenceTable.state, "bound"),
        eq(EngineWorkflowNodeOccurrenceTable.initial_dispatch_id, input.commit.dispatchID),
        sql`${EngineWorkflowNodeOccurrenceTable.dispatch_lineage_artifact_id} IS NULL`,
      ),
    )
    .run()
  const bound = occurrenceRow(input.db, input.commit)
  if (
    bound?.state !== "bound" ||
    bound.child_session_id !== input.commit.childSessionID ||
    bound.dispatch_lineage_artifact_id !== input.lineageArtifactID
  ) {
    throw new Error(
      `Task ${input.commit.taskID} workflow ${input.commit.workflowID} node ${input.commit.workflowNodeID} failed to bind its initial lineage`,
    )
  }
}
