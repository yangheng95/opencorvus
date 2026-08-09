import z from "zod"
import { Identifier } from "@/id/id"

export const DispatchOccurrenceAuthoritySchema = z.discriminatedUnion("occurrence_status", [
  z.object({ occurrence_status: z.literal("occurrence_not_committed") }).strict(),
  z
    .object({
      occurrence_status: z.literal("occurrence_committed"),
      dispatch_lineage_id: Identifier.schema("artifact"),
      dispatch_id: z.string().min(1),
    })
    .strict(),
])

export type DispatchOccurrenceAuthority = z.infer<typeof DispatchOccurrenceAuthoritySchema>
