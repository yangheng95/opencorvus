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

export const ExpertSquadCatalogIndexSourceSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("built_in"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("installed_package"),
      installation_scope: ExpertSquadPackageLocations.InstallationScopeSchema,
      namespace: z.string(),
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
})
  .strict()
  .meta({ ref: "ExpertSquadCatalogSummary" })

export const ExpertSquadCatalogIndexEntrySchema = z
  .object({
    id: z.string().min(1).max(160),
    name: z.string().min(1).max(160),
    display_label: z.string().min(1).max(240),
    description: z.string().min(1).max(1_000).optional(),
    built_in: z.boolean(),
    product_pillars: ProductPillarsSchema,
    system_role: z.enum(["expert_squad_generator"]).optional(),
    source: ExpertSquadCatalogIndexSourceSchema,
  })
  .strict()
  .meta({ ref: "ExpertSquadCatalogIndexEntry" })

export const ExpertSquadCatalogInspectionSchema = ExpertSquadCatalogIndexEntrySchema.extend({
  label: z.string().min(1).max(160),
  version: z.string().min(1).max(80),
  selector: z
    .object({
      summary: z.string().min(1).max(1_000),
      selection_guidance: z.string().min(1).max(2_000),
    })
    .strict(),
  workflow_count: z.number().int().nonnegative(),
  workflows: z
    .array(
      z
        .object({
          id: z.string().min(1).max(160),
          label: z.string().min(1).max(240),
          description: z.string().min(1).max(500),
          node_count: z.number().int().positive(),
        })
        .strict(),
    )
    .max(20),
  next_workflow_cursor: z.string().min(1).nullable(),
})
  .strict()
  .meta({ ref: "ExpertSquadCatalogInspection" })

export const ExpertSquadCatalogPageSchema = z
  .object({
    catalog_revision: z.string().regex(/^[a-f0-9]{64}$/),
    entries: z.array(ExpertSquadCatalogIndexEntrySchema).max(20),
    next_cursor: z.string().min(1).nullable(),
    total_count: z.number().int().nonnegative(),
  })
  .strict()
  .meta({ ref: "ExpertSquadCatalogPage" })

export const ExpertSquadPackageRevisionSchema = z
  .object({
    scope: z.enum(["built_in", "project", "global"]),
    project_id: z.string().nullable(),
    namespace: z.string().min(1),
    id: z.string().min(1),
    version: z.string().min(1),
    package_digest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()
  .meta({ ref: "ExpertSquadPackageRevision" })

export const ExpertSquadInventoryStatusSchema = z
  .object({
    catalog_revision: z.string().regex(/^[a-f0-9]{64}$/),
    effective_count: z.number().int().nonnegative(),
    installation_count: z.number().int().nonnegative(),
    issue_count: z.number().int().nonnegative(),
    warning_count: z.number().int().nonnegative(),
  })
  .strict()
  .meta({ ref: "ExpertSquadInventoryStatus" })

export const ExpertSquadDiagnosticSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("issue"), issue: ExpertSquadRegistry.DiscoveryIssue }).strict(),
  z.object({ kind: z.literal("warning"), warning: ExpertSquadRegistry.DiscoveryWarning }).strict(),
])

export const ExpertSquadDiagnosticPageSchema = z
  .object({
    catalog_revision: z.string().regex(/^[a-f0-9]{64}$/),
    entries: z.array(ExpertSquadDiagnosticSchema).max(20),
    next_cursor: z.string().min(1).nullable(),
    total_count: z.number().int().nonnegative(),
  })
  .strict()
  .meta({ ref: "ExpertSquadDiagnosticPage" })

export const ExpertSquadSettingsDetailSchema = z
  .object({
    scope: z.object({ kind: z.literal("project"), directory: z.string() }).strict(),
    selected: ExpertSquadCatalogSummarySchema,
  })
  .strict()
  .meta({ ref: "ExpertSquadSettingsDetail" })

export const ExpertSquadCatalogSearchQuerySchema = z.object({
  view: z.enum(["effective", "installations"]).default("effective"),
  query: z.string().max(500).default(""),
  productPillar: z.enum(["code", "work"]).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(20).default(20),
})

export const ExpertSquadCatalogInspectionQuerySchema = z
  .object({
    directory: z.string().min(1),
    id: z.string().min(1).max(160),
    installationScope: z.enum(["built_in", "project", "global"]).optional(),
    namespace: z.string().min(1).max(160).optional(),
    workflowCursor: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((query, context) => {
    const installed = query.installationScope === "project" || query.installationScope === "global"
    if (installed === Boolean(query.namespace)) return
    context.addIssue({
      code: "custom",
      message: "namespace is required exactly when installationScope selects a physical installation",
      path: ["namespace"],
    })
  })

export const ExpertSquadSettingsDetailQuerySchema = z
  .object({
    directory: z.string().min(1),
    id: z.string().min(1).max(160),
    installationScope: z.enum(["built_in", "project", "global"]),
    namespace: z.string().min(1).max(160).optional(),
  })
  .strict()
  .superRefine((query, context) => {
    const installed = query.installationScope === "project" || query.installationScope === "global"
    if (installed === Boolean(query.namespace)) return
    context.addIssue({
      code: "custom",
      message: "namespace is required exactly when installationScope selects a physical installation",
      path: ["namespace"],
    })
  })

export const ExpertSquadCatalogActiveSchema = z
  .object({
    effective: z.string(),
    project: z.string(),
    session_override: z.string().nullable(),
    package_revision: ExpertSquadPackageRevisionSchema,
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
    launch_catalog_revision: z.string().regex(/^[a-f0-9]{64}$/),
    active_agent_projection: ExpertSquadActiveAgentProjectionSchema,
    active_skill_projection: ExpertSquadActiveSkillProjectionSchema,
  })
  .strict()

export type ExpertSquadCatalogSummary = z.output<typeof ExpertSquadCatalogSummarySchema>
export type ExpertSquadCatalogIndexEntry = z.output<typeof ExpertSquadCatalogIndexEntrySchema>
export type ExpertSquadCatalogInspection = z.output<typeof ExpertSquadCatalogInspectionSchema>
export type ExpertSquadCatalogPage = z.output<typeof ExpertSquadCatalogPageSchema>
export type ExpertSquadDiagnosticPage = z.output<typeof ExpertSquadDiagnosticPageSchema>
export type ExpertSquadCatalog = z.output<typeof ExpertSquadCatalogSchema>
