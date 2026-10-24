import z from "zod"

export const PROJECT_DELETION_CLEANUP_FORMAT = "opencorvus.project-deletion-cleanup.v6"

/** Historical identity only. It grants no filesystem mutation authority. */
export const ProjectDeletionIdentity = z.object({
  operationID: z.string().uuid(),
  databaseInstanceID: z.string().uuid(),
  projectID: z.string().min(1),
  projectGeneration: z.string().uuid(),
})

export const CompletedNumericReceipt = ProjectDeletionIdentity.extend({
  format: z.literal("opencorvus.project-deletion-cleanup.v5"),
})
