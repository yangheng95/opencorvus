import z from "zod"

export const EXPERT_SQUAD_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
export const EXPERT_SQUAD_VERSION_PATTERN = /^(\d{4})\.(\d{2})\.(\d{2})\.([1-9]\d*)$/

const RESERVED_DYNAMIC_AGENT_IDS = new Set(["orchestrator", "shared", "universal-build"])
const NonBlankStringSchema = z.string().trim().min(1)
const NonEmptyStringSchema = z.string().min(1)

export const ProductPillarSchema = z.enum(["code", "work"])
export type ProductPillar = z.output<typeof ProductPillarSchema>

export const ProductPillarsSchema = z
  .array(ProductPillarSchema)
  .min(1, "product_pillars requires at least one product pillar")
  .superRefine((values, context) => {
    for (const [index, value] of values.entries()) {
      if (values.indexOf(value) !== index) {
        context.addIssue({ code: "custom", path: [index], message: `product_pillars repeats ${value}` })
      }
      if (index > 0 && values[index - 1]! >= value) {
        context.addIssue({ code: "custom", path: [index], message: "product_pillars must be canonically sorted" })
      }
    }
  })

export const ExpertSquadSystemRoleSchema = z.enum(["expert_squad_generator"])
export type ExpertSquadSystemRole = z.output<typeof ExpertSquadSystemRoleSchema>

export const ExpertSquadIDSchema = z
  .string()
  .min(1, "expert squad id cannot be empty")
  .max(64, "expert squad id must be at most 64 characters")
  .regex(EXPERT_SQUAD_ID_PATTERN, "expert squad id must be kebab-case")

export const ExpertSquadNamespaceSchema = ExpertSquadIDSchema

export const ExpertSquadVersionSchema = z
  .string()
  .regex(EXPERT_SQUAD_VERSION_PATTERN, "version must use YYYY.MM.DD.N with a positive daily revision")
  .superRefine((value, context) => {
    const match = EXPERT_SQUAD_VERSION_PATTERN.exec(value)
    if (!match) return
    const [, yearText, monthText, dayText] = match
    const year = Number(yearText)
    const month = Number(monthText)
    const day = Number(dayText)
    const date = new Date(Date.UTC(year, month - 1, day))
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      context.addIssue({ code: "custom", message: "version date must be a real calendar date" })
    }
  })

export const ExpertSquadDynamicAgentIDSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(EXPERT_SQUAD_ID_PATTERN, "dynamic agent id must be kebab-case")
  .superRefine((agentID, context) => {
    if (!RESERVED_DYNAMIC_AGENT_IDS.has(agentID)) return
    context.addIssue({ code: "custom", message: `dynamic agent id "${agentID}" is reserved` })
  })

const ExpertSquadConfigurationKeySchema = z.string().regex(/^[a-z][a-z0-9_]*$/)

export const ExpertSquadConfigurationFieldSchema = z
  .object({
    key: ExpertSquadConfigurationKeySchema,
    label: NonBlankStringSchema,
    description: NonBlankStringSchema.optional(),
    type: z.enum(["boolean", "text", "secret"]),
    required: z.boolean(),
    placeholder: z.string().optional(),
  })
  .strict()

export const ExpertSquadConfigurationSchema = z
  .object({
    fields: z.array(ExpertSquadConfigurationFieldSchema).min(1),
  })
  .strict()
  .superRefine((configuration, context) => {
    const keys = new Set<string>()
    for (const [index, field] of configuration.fields.entries()) {
      if (keys.has(field.key)) {
        context.addIssue({
          code: "custom",
          path: ["fields", index, "key"],
          message: `configuration repeats ${field.key}`,
        })
      }
      keys.add(field.key)
    }
  })

function uniqueRefList(field: string) {
  return z.array(NonEmptyStringSchema).superRefine((refs, context) => {
    const seen = new Set<string>()
    for (const [index, ref] of refs.entries()) {
      if (seen.has(ref)) context.addIssue({ code: "custom", path: [index], message: `${field} repeats ${ref}` })
      seen.add(ref)
    }
  })
}

function canonicalIDList(field: string) {
  return z.array(ExpertSquadIDSchema).superRefine((values, context) => {
    const seen = new Set<string>()
    for (const [index, value] of values.entries()) {
      if (seen.has(value)) context.addIssue({ code: "custom", path: [index], message: `${field} repeats ${value}` })
      seen.add(value)
      if (index > 0 && values[index - 1]! >= value) {
        context.addIssue({ code: "custom", path: [index], message: `${field} must be canonically sorted` })
      }
    }
  })
}

export const ExpertSquadProjectionResourcesSchema = z.object({
  inherit_base_tools: z.boolean(),
  built_in_tool_ids: uniqueRefList("built_in_tool_ids"),
  default_skill_refs: uniqueRefList("default_skill_refs"),
  package_skill_refs: uniqueRefList("package_skill_refs"),
  default_tool_refs: uniqueRefList("default_tool_refs"),
  package_tool_refs: uniqueRefList("package_tool_refs"),
  default_mcp_server_refs: uniqueRefList("default_mcp_server_refs"),
  package_mcp_server_refs: uniqueRefList("package_mcp_server_refs"),
  default_mcp_tool_refs: uniqueRefList("default_mcp_tool_refs"),
  package_mcp_tool_refs: uniqueRefList("package_mcp_tool_refs"),
  default_mcp_prompt_refs: uniqueRefList("default_mcp_prompt_refs"),
  package_mcp_prompt_refs: uniqueRefList("package_mcp_prompt_refs"),
  default_mcp_resource_refs: uniqueRefList("default_mcp_resource_refs"),
  package_mcp_resource_refs: uniqueRefList("package_mcp_resource_refs"),
})

export const ExpertSquadSchedulerProjectionSchema = ExpertSquadProjectionResourcesSchema.extend({
  base_role: z.literal("orchestrator"),
  prompt: NonEmptyStringSchema.optional(),
}).strict()

export const ExpertSquadAgentProjectionSchema = ExpertSquadProjectionResourcesSchema.extend({
  label: NonBlankStringSchema,
  description: NonBlankStringSchema.optional(),
  base_role: NonEmptyStringSchema,
  execution_contract: z.literal("platform_integrity_review").optional(),
  prompt: NonEmptyStringSchema.optional(),
})
  .strict()
  .superRefine((projection, context) => {
    if (projection.base_role === "integrity" && projection.execution_contract !== "platform_integrity_review") {
      context.addIssue({
        code: "custom",
        path: ["execution_contract"],
        message: "integrity base_role requires the explicit platform_integrity_review execution contract",
      })
    }
    if (projection.base_role !== "integrity" && projection.execution_contract !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["execution_contract"],
        message: "platform_integrity_review execution contract requires integrity base_role",
      })
    }
  })

export const ExpertSquadVirtualWorkflowNodeSchema = z
  .object({
    agent_id: ExpertSquadDynamicAgentIDSchema,
    description: NonBlankStringSchema,
    depends_on: canonicalIDList("depends_on"),
  })
  .strict()

export const ExpertSquadVirtualWorkflowSchema: z.ZodType<ExpertSquadVirtualWorkflow> = z
  .object({
    label: NonBlankStringSchema,
    description: NonBlankStringSchema,
    nodes: z
      .record(ExpertSquadIDSchema, ExpertSquadVirtualWorkflowNodeSchema)
      .refine((nodes) => Object.keys(nodes).length > 0, { message: "virtual workflow requires at least one node" }),
  })
  .strict()

export const ExpertSquadVirtualWorkflowsSchema: z.ZodType<ExpertSquadVirtualWorkflows> = z.record(
  ExpertSquadIDSchema,
  ExpertSquadVirtualWorkflowSchema,
)

export const ExpertSquadCapabilityProjectionSchema: z.ZodType<ExpertSquadCapabilityProjection> = z
  .object({
    scheduler: ExpertSquadSchedulerProjectionSchema,
    agents: z.record(ExpertSquadDynamicAgentIDSchema, ExpertSquadAgentProjectionSchema),
    virtual_workflows: ExpertSquadVirtualWorkflowsSchema,
  })
  .strict()

export const ExpertSquadManifestV1Schema: z.ZodType<ExpertSquadManifestV1> = z
  .object({
    schema_version: z.literal(1),
    namespace: ExpertSquadNamespaceSchema,
    id: ExpertSquadIDSchema,
    name: z.string().trim().min(1).optional(),
    label: z.string().min(1),
    description: z.string().optional(),
    version: ExpertSquadVersionSchema,
    product_pillars: ProductPillarsSchema,
    system_role: ExpertSquadSystemRoleSchema.optional(),
    readme: z.literal("README.md"),
    selector: z
      .object({
        summary: z.string().min(1),
        selection_guidance: z.string().min(1),
        instructions: z.literal("selector.md", {
          error: "selector instructions must be top-level selector.md",
        }),
      })
      .strict(),
    configuration: ExpertSquadConfigurationSchema.optional(),
    capability_projection: ExpertSquadCapabilityProjectionSchema,
  })
  .strict()

export type ExpertSquadConfiguration = z.output<typeof ExpertSquadConfigurationSchema>
export type ExpertSquadConfigurationField = z.output<typeof ExpertSquadConfigurationFieldSchema>
export type ExpertSquadSchedulerProjection = z.output<typeof ExpertSquadSchedulerProjectionSchema>
export type ExpertSquadAgentProjection = z.output<typeof ExpertSquadAgentProjectionSchema>
export type ExpertSquadVirtualWorkflowNode = z.output<typeof ExpertSquadVirtualWorkflowNodeSchema>
export interface ExpertSquadVirtualWorkflow {
  label: string
  description: string
  nodes: Record<string, ExpertSquadVirtualWorkflowNode>
}
export type ExpertSquadVirtualWorkflows = Record<string, ExpertSquadVirtualWorkflow>
export interface ExpertSquadCapabilityProjection {
  scheduler: ExpertSquadSchedulerProjection
  agents: Record<string, ExpertSquadAgentProjection>
  virtual_workflows: ExpertSquadVirtualWorkflows
}
export interface ExpertSquadManifestV1 {
  schema_version: 1
  namespace: string
  id: string
  name?: string
  label: string
  description?: string
  version: string
  product_pillars: ProductPillar[]
  system_role?: ExpertSquadSystemRole
  readme: "README.md"
  selector: {
    summary: string
    selection_guidance: string
    instructions: "selector.md"
  }
  configuration?: ExpertSquadConfiguration
  capability_projection: ExpertSquadCapabilityProjection
}
