import z from "zod"
import { DefaultSkillRefSchema } from "./default-skill-ref"
import { DynamicAgentIDSchema } from "@/agent/dynamic-agent-id"
import { ExpertSquadIDSchema } from "@/expert-squad/id"

export const SkillMountProjectConfigSchema = z.record(
  ExpertSquadIDSchema,
  z.record(DynamicAgentIDSchema, z.record(DefaultSkillRefSchema, z.boolean())),
)

const NullableDefaultSkillOverridesSchema = z.record(DefaultSkillRefSchema, z.boolean().nullable())
const NullableAgentOverridesSchema = z.record(
  DynamicAgentIDSchema,
  z.union([NullableDefaultSkillOverridesSchema, z.null()]),
)

export const SkillMountOverlaySchema = z.record(ExpertSquadIDSchema, z.union([NullableAgentOverridesSchema, z.null()]))

export type SkillMountProjectConfig = z.infer<typeof SkillMountProjectConfigSchema>
export type SkillMountOverlay = z.infer<typeof SkillMountOverlaySchema>
