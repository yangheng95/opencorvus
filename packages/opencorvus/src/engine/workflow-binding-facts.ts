import { EngineArtifactTable, EngineTaskTable } from "./engine.sql"
import {
  SelectedWorkflowBindingSchema,
  sameSelectedWorkflowBinding,
  type SelectedWorkflowBinding,
} from "./workflow-binding"
import { Database, and, eq, inArray } from "@/storage/db"
import { SessionTable } from "@/session/session.sql"
import z from "zod"
import { requireTaskPackageRevisionBinding } from "./task-package-revision-binding"
import { sameExpertSquadPackageRevisionBinding } from "./expert-squad-package-revision-binding"

const WorkflowBindingCarrierSchema = z.object({ workflow_binding: SelectedWorkflowBindingSchema }).passthrough()

export class TaskWorkflowBindingConflictError extends Error {
  readonly code = "task_workflow_binding_conflict"

  constructor(
    readonly taskID: string,
    readonly artifactID: string,
  ) {
    super(`Task ${taskID} workflow artifact ${artifactID} already selected a different immutable workflow binding`)
    this.name = "TaskWorkflowBindingConflictError"
  }
}

export function readTaskWorkflowBindingInTransaction(
  db: Database.TxOrDb,
  taskID: string,
): SelectedWorkflowBinding | undefined {
  const rows = db
    .select({ id: EngineArtifactTable.id, payload: EngineArtifactTable.payload })
    .from(EngineArtifactTable)
    .where(
      and(
        eq(EngineArtifactTable.task_id, taskID),
        inArray(EngineArtifactTable.kind, ["dispatch_lineage", "task_completion_decision"]),
      ),
    )
    .all()
  const first = rows[0]
  if (!first) return undefined
  const binding = WorkflowBindingCarrierSchema.parse(first.payload).workflow_binding
  for (const row of rows.slice(1)) {
    const candidate = WorkflowBindingCarrierSchema.parse(row.payload).workflow_binding
    if (!sameSelectedWorkflowBinding(binding, candidate)) {
      throw new Error(`Task ${taskID} workflow artifact ${row.id} conflicts with immutable binding from ${first.id}`)
    }
  }
  const creationBinding = requireTaskPackageRevisionBinding(taskID, db)
  if (!sameExpertSquadPackageRevisionBinding(creationBinding, binding.package_revision)) {
    throw new Error(`Task ${taskID} workflow binding conflicts with immutable creation package revision binding`)
  }
  return binding
}

export function readTaskWorkflowBinding(taskID: string): SelectedWorkflowBinding | undefined {
  return Database.use((db) => readTaskWorkflowBindingInTransaction(db, taskID))
}

/** Enforce one immutable Task workflow binding at the same transaction boundary
 * that writes either a dispatch lineage or the terminal completion decision. */
export function assertTaskWorkflowBindingInTransaction(input: {
  db: Database.TxOrDb
  taskID: string
  workflowBinding: SelectedWorkflowBinding
}): void {
  const task = input.db
    .select({ sessionID: EngineTaskTable.session_id })
    .from(EngineTaskTable)
    .where(eq(EngineTaskTable.id, input.taskID))
    .get()
  if (!task?.sessionID) throw new Error(`Task ${input.taskID} has no root Session for workflow binding`)
  const session = input.db
    .select({ metadata: SessionTable.metadata })
    .from(SessionTable)
    .where(eq(SessionTable.id, task.sessionID))
    .get()
  if (!session) throw new Error(`Task ${input.taskID} root Session ${task.sessionID} is missing`)
  const metadata = (session.metadata ?? {}) as Record<string, unknown>
  const overlay = metadata.configOverlay as Record<string, unknown> | undefined
  const snapshot = metadata.taskConfigSnapshot as Record<string, unknown> | undefined
  const activeProfileID = [overlay, snapshot]
    .map((source) => {
      const promptProfile = source?.prompt_profile
      if (!promptProfile || typeof promptProfile !== "object" || Array.isArray(promptProfile)) return undefined
      const active = (promptProfile as Record<string, unknown>).active
      return typeof active === "string" && active.length > 0 ? active : undefined
    })
    .find((active) => active !== undefined)
  if (!activeProfileID) {
    throw new Error(`Task ${input.taskID} root Session ${task.sessionID} has no frozen active expert squad`)
  }
  if (activeProfileID !== input.workflowBinding.package_revision.id) {
    throw new Error(
      `Task ${input.taskID} active expert squad ${activeProfileID} does not match first workflow binding package ${input.workflowBinding.package_revision.id}`,
    )
  }
  const creationBinding = requireTaskPackageRevisionBinding(input.taskID, input.db)
  if (!sameExpertSquadPackageRevisionBinding(creationBinding, input.workflowBinding.package_revision)) {
    throw new Error(
      `Task ${input.taskID} workflow package revision does not match immutable creation package revision binding`,
    )
  }
  const rows = input.db
    .select({ id: EngineArtifactTable.id, payload: EngineArtifactTable.payload })
    .from(EngineArtifactTable)
    .where(
      and(
        eq(EngineArtifactTable.task_id, input.taskID),
        inArray(EngineArtifactTable.kind, ["dispatch_lineage", "task_completion_decision"]),
      ),
    )
    .all()
  for (const row of rows) {
    const existing = WorkflowBindingCarrierSchema.parse(row.payload).workflow_binding
    if (!sameSelectedWorkflowBinding(existing, input.workflowBinding)) {
      throw new TaskWorkflowBindingConflictError(input.taskID, row.id)
    }
  }
}
