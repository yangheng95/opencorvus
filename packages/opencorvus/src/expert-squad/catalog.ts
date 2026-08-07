import z from "zod"
import {
  ExpertSquadCapabilityProjectionSchema,
  ExpertSquadConfigurationSchema,
  ExpertSquadVirtualWorkflowsSchema,
  ProductPillarsSchema,
} from "@/expert-squad/protocol-schema"
import { ExpertSquadPackageLocations } from "@/expert-squad/locations"
import { ExpertSquadRegistry } from "@/expert-squad/registry"
import { ExpertSquadGenerationMetadataSchema } from "@/expert-squad/installation-metadata"

export const ExpertSquadCatalogSourceSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("built_in"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("installed_package"),
      installation_scope: ExpertSquadPackageLocations.InstallationScopeSchema,
      package_digest: z.string().regex(/^[a-f0-9]{64}$/),
      namespace: z.string(),
      root: z.string(),
      manifest_path: z.string(),
      readme_path: z.string(),
      generation: ExpertSquadGenerationMetadataSchema.optional(),
    })
    .strict(),
])

export const ExpertSquadCatalogReadmeSchema = z
  .object({
    path: z.literal("README.md"),
    append_target: z.literal("orchestrator"),
    content: z.string(),
  })
  .strict()

export const ExpertSquadCatalogSelectorSchema = z
  .object({
    ref: z.string(),
    id: z.string(),
    label: z.string(),
    description: z.string().optional(),
    summary: z.string(),
    selection_guidance: z.string(),
    instructions_path: z.literal("selector.md"),
    instructions: z.string(),
  })
  .strict()

export const ExpertSquadCatalogProfileSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    label: z.string(),
    description: z.string().optional(),
    built_in: z.boolean(),
    editable: z.boolean(),
    declaration_hash: z.string(),
    product_pillars: ProductPillarsSchema,
    system_role: z.enum(["expert_squad_generator"]).optional(),
    configuration: ExpertSquadConfigurationSchema.optional(),
    capability_projection: ExpertSquadCapabilityProjectionSchema,
  })
  .strict()

export type ExpertSquadCatalogProfile = z.output<typeof ExpertSquadCatalogProfileSchema>

export const ExpertSquadCatalogSummarySchema = ExpertSquadCatalogProfileSchema.extend({
  version: z.string(),
  package_digest: z.string().regex(/^[a-f0-9]{64}$/),
  display_label: z.string(),
  source: ExpertSquadCatalogSourceSchema,
  readme: ExpertSquadCatalogReadmeSchema,
  selector: ExpertSquadCatalogSelectorSchema,
}).strict()

export const ExpertSquadRecommendationSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    label: z.string(),
    display_label: z.string(),
    description: z.string().optional(),
    version: z.string(),
    built_in: z.boolean(),
    product_pillars: ProductPillarsSchema,
    package_digest: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    selector: z
      .object({
        summary: z.string(),
        selection_guidance: z.string(),
      })
      .strict(),
    workflows: z.array(
      z
        .object({
          id: z.string(),
          label: z.string(),
          description: z.string(),
          node_count: z.number().int().positive(),
        })
        .strict(),
    ),
  })
  .strict()

export const ExpertSquadCatalogActiveSchema = z
  .object({
    effective: z.string(),
    project: z.string(),
    session_override: z.string().nullable(),
  })
  .strict()

export const ExpertSquadCatalogScopeSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("project"),
      directory: z.string(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("session"),
      directory: z.string(),
      sessionID: z.string(),
    })
    .strict(),
])

export const ExpertSquadCatalogSkillSummarySchema = z
  .object({
    name: z.string(),
    description: z.string(),
    builtin: z.boolean(),
    location: z.string(),
    required_tools: z.array(z.string()),
  })
  .strict()

export const ExpertSquadCatalogSelectorSkillSchema = z
  .object({
    kind: z.literal("selector"),
    expert_squad_id: z.string(),
    name: z.string(),
    description: z.string(),
    instructions: z.string(),
    digest: z.string(),
    location: z.string(),
    required_tools: z.tuple([]),
  })
  .strict()

export const ExpertSquadCatalogProductionGrantSchema = z
  .object({
    kind: z.literal("production"),
    authority: z.enum(["manifest", "operator"]),
    source: z.enum(["default", "package"]),
    ref: z.string(),
    agent_ids: z.array(z.string()),
    skill: ExpertSquadCatalogSkillSummarySchema,
  })
  .strict()

export const ExpertSquadActiveSkillProjectionSchema = z
  .object({
    active_squad_id: z.string(),
    built_in: z.boolean(),
    projection_hash: z.string(),
    projected_tool_ids: z.array(z.string()),
    projected_agent_ids: z.array(z.string()),
    selector_skill_names: z.array(z.string()),
    production_skill_names: z.array(z.string()),
    projected_skill_names: z.array(z.string()),
    selector_skills: z.array(ExpertSquadCatalogSelectorSkillSchema),
    production_grants: z.array(ExpertSquadCatalogProductionGrantSchema),
  })
  .strict()

export const ExpertSquadActiveAgentProjectionAgentSchema = z
  .object({
    agent_id: z.string(),
    base_role: z.string(),
    session_kind: z.string(),
    dispatch_adapter_id: z.string(),
    label: z.string(),
    description: z.string().optional(),
    projection_hash: z.string(),
    built_in_tool_ids: z.array(z.string()),
    default_skill_refs: z.array(z.string()),
    package_skill_refs: z.array(z.string()),
    default_tool_refs: z.array(z.string()),
    package_tool_refs: z.array(z.string()),
    default_mcp_server_refs: z.array(z.string()),
    package_mcp_server_refs: z.array(z.string()),
    default_mcp_tool_refs: z.array(z.string()),
    package_mcp_tool_refs: z.array(z.string()),
    default_mcp_prompt_refs: z.array(z.string()),
    package_mcp_prompt_refs: z.array(z.string()),
    default_mcp_resource_refs: z.array(z.string()),
    package_mcp_resource_refs: z.array(z.string()),
  })
  .strict()

export const ExpertSquadActiveAgentProjectionSchema = z
  .object({
    source_expert_squad_id: z.string(),
    prompt_profile_active: z.string(),
    scheduler_projection_hash: z.string(),
    projection_hash: z.string(),
    virtual_workflows: ExpertSquadVirtualWorkflowsSchema,
    agents: z.array(ExpertSquadActiveAgentProjectionAgentSchema),
  })
  .strict()

export const ExpertSquadCatalogSchema = z
  .object({
    active: ExpertSquadCatalogActiveSchema,
    default: z.string(),
    scope: ExpertSquadCatalogScopeSchema,
    squads: z.array(ExpertSquadCatalogSummarySchema),
    installations: z.array(ExpertSquadCatalogSummarySchema),
    issues: z.array(ExpertSquadRegistry.DiscoveryIssue),
    warnings: z.array(ExpertSquadRegistry.DiscoveryWarning),
    active_agent_projection: ExpertSquadActiveAgentProjectionSchema,
    active_skill_projection: ExpertSquadActiveSkillProjectionSchema,
  })
  .strict()

export const ExpertSquadSettingsSurfaceSchema = z
  .object({
    scope: z.object({ kind: z.literal("project"), directory: z.string() }).strict(),
    squads: z.array(ExpertSquadCatalogSummarySchema),
    installations: z.array(ExpertSquadCatalogSummarySchema),
    warnings: z.array(ExpertSquadRegistry.DiscoveryWarning),
    selected: ExpertSquadCatalogSummarySchema,
  })
  .strict()
  .meta({ ref: "ExpertSquadSettingsSurface" })

export type ExpertSquadCatalogSummary = z.output<typeof ExpertSquadCatalogSummarySchema>
export type ExpertSquadRecommendation = z.output<typeof ExpertSquadRecommendationSchema>
export type ExpertSquadCatalog = z.output<typeof ExpertSquadCatalogSchema>
