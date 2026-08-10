import z from "zod"
import { ExpertSquadIDSchema } from "@/expert-squad/id"
export { ProductPillarSchema, type ProductPillar } from "@opencorvus-ai/sdk/expert-squad-manifest-v1"

// Mission identifier shape. It matches mission_state's path guard before the
// ID is used as the readable `.opencorvus/.r/missions/<mission-id>/`
// runtime namespace.
export const MissionID = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9-]+$/, "missionID must be lowercase alphanumerics and hyphens only")

export type MissionID = z.infer<typeof MissionID>

export const MissionRequestedExpertSquadIDs = z
  .array(ExpertSquadIDSchema)
  .refine((ids) => new Set(ids).size === ids.length, {
    message: "Mission visible expert squad IDs must be unique",
  })

export type MissionRequestedExpertSquadIDs = z.infer<typeof MissionRequestedExpertSquadIDs>

export const MissionVisibleExpertSquadIDs = MissionRequestedExpertSquadIDs.min(
  1,
  "Mission held expert squad snapshot must contain at least one installed squad",
)

export type MissionVisibleExpertSquadIDs = z.infer<typeof MissionVisibleExpertSquadIDs>

export const MissionPendingPrompt = z
  .object({
    text: z.string().trim().min(1).max(32_000),
  })
  .strict()

export type MissionPendingPrompt = z.infer<typeof MissionPendingPrompt>
