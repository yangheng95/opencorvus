import { Instance } from "@/project/instance"
import { ProjectTable } from "@/project/project.sql"
import { Database, eq } from "@/storage/db"
import { NamedError } from "@opencorvus-ai/util/error"
import z from "zod"

/** The reserved execution owns a Project occurrence, not a reusable Project ID. */
export function schedulerProjectDisposition(
  db: Database.TxOrDb,
  input: {
    projectID: string | null
    generation: string | null
  },
): "owner_unresolved" | "target_deleted" | undefined {
  if (!input.generation || !input.projectID) return "owner_unresolved"
  const project = db
    .select({ generation: ProjectTable.generation })
    .from(ProjectTable)
    .where(eq(ProjectTable.id, input.projectID))
    .get()
  if (!project || project.generation !== input.generation) return "target_deleted"
}

export const SchedulerProjectOwnerError = NamedError.create(
  "SchedulerProjectOwnerError",
  z.object({
    message: z.string(),
    occurrenceID: z.string(),
    disposition: z.enum(["owner_unresolved", "target_deleted", "context_mismatch"]),
  }),
)

export function assertSchedulerProjectOwner(
  db: Database.TxOrDb,
  input: {
    occurrenceID: string
    projectID: string | null
    generation: string | null
  },
  requireInstance = true,
): void {
  const disposition = schedulerProjectDisposition(db, input)
  if (disposition)
    throw new SchedulerProjectOwnerError({
      occurrenceID: input.occurrenceID,
      disposition,
      message: `Scheduler occurrence ${input.occurrenceID} Project owner: ${disposition}`,
    })
  if (requireInstance && (Instance.project.id !== input.projectID || Instance.projectGeneration !== input.generation))
    throw new SchedulerProjectOwnerError({
      occurrenceID: input.occurrenceID,
      disposition: "context_mismatch",
      message: `Scheduler occurrence ${input.occurrenceID} is outside its original Project context`,
    })
}
