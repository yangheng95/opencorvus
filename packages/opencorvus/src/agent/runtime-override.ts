import z from "zod"
import { DynamicAgentIDSchema } from "./dynamic-agent-id"
import { RUNTIME_TEMPLATE_IDS } from "./runtime-template-id"
import { ExpertSquadIDSchema } from "@/expert-squad/id"
import { isModelReference } from "@/provider/model-ref"
import { isUniversalBuildAgentID } from "./universal-build"

const ModelReferenceSchema = z.string().refine(isModelReference, {
  message: "Model references must use provider/model format",
})

/** Operator-owned execution overrides. Identity and capability grants are intentionally absent. */
export const RuntimeExecutionOverrideSchema = z
  .object({
    model: ModelReferenceSchema.optional(),
    variant: z.string().min(1).optional(),
    temperature: z.number().optional(),
    top_p: z.number().optional(),
    prompt_append: z.string().min(1).optional(),
    steps: z.number().int().positive().optional(),
    options: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()

export type RuntimeExecutionOverride = z.output<typeof RuntimeExecutionOverrideSchema>

export const RuntimeExecutionOverlaySchema = z
  .object({
    model: ModelReferenceSchema.nullable().optional(),
    variant: z.string().min(1).nullable().optional(),
    temperature: z.number().nullable().optional(),
    top_p: z.number().nullable().optional(),
    prompt_append: z.string().min(1).nullable().optional(),
    steps: z.number().int().positive().nullable().optional(),
    options: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .strict()

const ProjectedAgentRuntimeConfigSchema = z
  .object({
    runtime: RuntimeExecutionOverrideSchema,
  })
  .strict()

const ProjectedAgentRuntimeOverlaySchema = z
  .object({
    runtime: RuntimeExecutionOverlaySchema.nullable().optional(),
  })
  .strict()

export const RuntimeTemplateOverridesSchema = z.partialRecord(
  z.enum(RUNTIME_TEMPLATE_IDS),
  RuntimeExecutionOverrideSchema,
)

export const RuntimeTemplateOverlaysSchema = z.partialRecord(
  z.enum(RUNTIME_TEMPLATE_IDS),
  RuntimeExecutionOverlaySchema.nullable(),
)

export const ExpertSquadRuntimeOverridesSchema = z.record(
  ExpertSquadIDSchema,
  z
    .object({
      agents: z.record(DynamicAgentIDSchema, ProjectedAgentRuntimeConfigSchema),
    })
    .strict(),
)

export const ExpertSquadRuntimeOverlaysSchema = z.record(
  ExpertSquadIDSchema,
  z
    .object({
      agents: z.record(DynamicAgentIDSchema, ProjectedAgentRuntimeOverlaySchema.nullable()).nullable().optional(),
    })
    .strict()
    .nullable(),
)

export interface RuntimeOverrideConfig {
  runtime_templates?: z.output<typeof RuntimeTemplateOverridesSchema>
  expert_squads?: z.output<typeof ExpertSquadRuntimeOverridesSchema>
}

export function runtimeOverrideLayers(
  config: RuntimeOverrideConfig,
  identity: {
    expertSquadID: string
    agentID: string
    baseRole: (typeof RUNTIME_TEMPLATE_IDS)[number]
    capabilityOwner?: "package" | "platform"
  },
): {
  template: RuntimeExecutionOverride | undefined
  projectedAgent: RuntimeExecutionOverride | undefined
} {
  return {
    template: config.runtime_templates?.[identity.baseRole],
    projectedAgent: isUniversalBuildAgentID(identity.agentID)
      ? undefined
      : config.expert_squads?.[identity.expertSquadID]?.agents[identity.agentID]?.runtime,
  }
}
