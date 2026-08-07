import z from "zod"

export const TASK_CREATOR_METADATA_RESERVED_KEYS = ["actor", "actor_session_id", "mission"] as const

export const TaskCallerMetadata = z
  .object({
    actor: z.never().optional(),
    actor_session_id: z.never().optional(),
    mission: z.never().optional(),
  })
  .catchall(z.unknown())

export function suppliedTaskCreatorMetadataKeys(metadata: Record<string, unknown> | undefined) {
  if (!metadata) return []
  return TASK_CREATOR_METADATA_RESERVED_KEYS.filter((key) => key in metadata)
}
