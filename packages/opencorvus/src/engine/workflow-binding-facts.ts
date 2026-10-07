import { EngineArtifactTable, EngineTaskTable } from "./engine.sql"
import { SelectedWorkflowBindingSchema, type SelectedWorkflowBinding } from "./workflow-binding"
import { Database, and, eq, inArray } from "@/storage/db"
import { SessionTable } from "@/session/session.sql"
import z from "zod"
import { requireTaskPackageRevisionBinding } from "./task-package-revision-binding"
import { sameExpertSquadPackageRevisionBinding } from "./expert-squad-package-revision-binding"

const WorkflowBindingCarrierSchema = z.object({ workflow_binding: SelectedWorkflowBindingSchema }).passthrough()

/** Immutable reference snapshots on actual dispatch/completion facts, never a Task plan. */
export function readTaskWorkflowReferencesInTransaction(
  db: Database.TxOrDb,
  taskID: string,
): SelectedWorkflowBinding[] {
  const rows = db
    .select({ payload: EngineArtifactTable.payload })
    .from(EngineArtifactTable)
    .where(
      and(
        eq(EngineArtifactTable.task_id, taskID),
        inArray(EngineArtifactTable.kind, ["dispatch_lineage", "task_completion_decision"]),
      ),
    )
    .all()
  const creationBinding = requireTaskPackageRevisionBinding(taskID, db)
  const references = new Map<string, SelectedWorkflowBinding>()
  for (const row of rows) {
    const binding = WorkflowBindingCarrierSchema.parse(row.payload).workflow_binding
    if (!sameExpertSquadPackageRevisionBinding(creationBinding, binding.package_revision)) {
      throw new Error(`Task ${taskID} dispatch reference conflicts with its immutable package revision`)
    }
    references.set(JSON.stringify(binding), binding)
  }
  return [...references.values()]
}

export function readTaskWorkflowReferences(taskID: string): SelectedWorkflowBinding[] {
  return Database.use((db) => readTaskWorkflowReferencesInTransaction(db, taskID))
}

/** Validate the actual package authority; a reference graph grants no execution authority. */
export function assertTaskWorkflowPackageInTransaction(input: {
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
}
