import z from "zod"
import { ExpertSquadIDSchema } from "@/expert-squad/id"
import { DYNAMIC_EXPERT_SQUAD_ID } from "@/expert-squad/builtin/ids"

export const DEFAULT_PROMPT_PROFILE_ID = DYNAMIC_EXPERT_SQUAD_ID
export const PromptProfileIDSchema = ExpertSquadIDSchema

export const PromptProfileConfigSchema = z
  .object({
    active: PromptProfileIDSchema.default(DEFAULT_PROMPT_PROFILE_ID),
  })
  .strict()
  .default({ active: DEFAULT_PROMPT_PROFILE_ID })

export const PromptProfileOverlaySchema = z
  .object({
    active: PromptProfileIDSchema.nullable().optional(),
  })
  .strict()

export type PromptProfileConfig = z.output<typeof PromptProfileConfigSchema>
export type PromptProfileOverlay = z.output<typeof PromptProfileOverlaySchema>

type ConfigLike = {
  prompt_profile?: PromptProfileConfig
}

export namespace PromptProfile {
  export function activeID(config: ConfigLike): string {
    if (!config.prompt_profile?.active) {
      throw new Error("Config prompt_profile.active is not materialized.")
    }
    return config.prompt_profile.active
  }
}
