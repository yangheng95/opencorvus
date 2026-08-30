import z from "zod"
import { ProductPillarSchema, type ProductPillar } from "@opencorvus-ai/util/product-pillar"
import { CapabilityRefCodec, EncodedCapabilityRef } from "@opencorvus-ai/util/capability-ref"

function decodedCapabilityRef(value: string) {
  try {
    return CapabilityRefCodec.decode(value)
  } catch {
    return undefined
  }
}

export const EXPERT_SQUAD_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
export const EXPERT_SQUAD_VERSION_PATTERN = /^(\d{4})\.(\d{2})\.(\d{2})\.([1-9]\d*)$/

const RESERVED_DYNAMIC_AGENT_IDS = new Set(["orchestrator", "shared", "universal-build"])
const NonBlankStringSchema = z.string().trim().min(1)
const NonEmptyStringSchema = z.string().min(1)

// The product pillar is owned by @opencorvus-ai/util, the lowest package
// both the SDK and the Transport Protocol can depend on without a cycle.
export { ProductPillarSchema }
export type { ProductPillar }

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

function canonicalCapabilityRefList(field: string, options: { leafOnly?: boolean } = {}) {
  return z.array(EncodedCapabilityRef).superRefine((refs, context) => {
    const seen = new Set<string>()
    for (const [index, ref] of refs.entries()) {
      if (seen.has(ref)) context.addIssue({ code: "custom", path: [index], message: `${field} repeats ${ref}` })
      seen.add(ref)
      if (index > 0 && refs[index - 1]! >= ref) {
        context.addIssue({ code: "custom", path: [index], message: `${field} must be canonically sorted` })
      }
      if (options.leafOnly && decodedCapabilityRef(ref)?.kind === "capability_set") {
        context.addIssue({ code: "custom", path: [index], message: `${field} cannot contain a capability set` })
      }
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

export const ExpertSquadCapabilitySetSchema = z
  .object({
    description: NonBlankStringSchema,
    member_refs: canonicalCapabilityRefList("member_refs", { leafOnly: true }).min(1),
  })
  .strict()

export const ExpertSquadCapabilitySetsSchema = z.record(ExpertSquadIDSchema, ExpertSquadCapabilitySetSchema)

export const ExpertSquadProjectionCapabilitiesSchema = z.object({
  capability_refs: canonicalCapabilityRefList("capability_refs"),
})

export const ExpertSquadSchedulerProjectionSchema = ExpertSquadProjectionCapabilitiesSchema.extend({
  base_role: z.literal("orchestrator"),
  prompt: NonEmptyStringSchema.optional(),
}).strict()

export const ExpertSquadAgentProjectionSchema = ExpertSquadProjectionCapabilitiesSchema.extend({
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

export const ExpertSquadManifestV2Schema: z.ZodType<ExpertSquadManifestV2> = z
  .object({
    schema_version: z.literal(2),
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
    capability_sets: ExpertSquadCapabilitySetsSchema,
    capability_projection: ExpertSquadCapabilityProjectionSchema,
  })
  .strict()
  .superRefine((manifest, context) => {
    const referencedPackageSets = new Set<string>()
    const projections = [
      ["scheduler", manifest.capability_projection.scheduler],
      ...Object.entries(manifest.capability_projection.agents).map(([agentID, projection]) => [
        `agents.${agentID}`,
        projection,
      ] as const),
    ] as const
    for (const [projectionPath, projection] of projections) {
      for (const [index, encoded] of projection.capability_refs.entries()) {
        const ref = decodedCapabilityRef(encoded)
        if (!ref) continue
        if (ref.source === "package" && ref.owner_ref !== manifest.id) {
          context.addIssue({
            code: "custom",
            path: ["capability_projection", ...projectionPath.split("."), "capability_refs", index],
            message: `package capability owner ${ref.owner_ref} must equal manifest id ${manifest.id}`,
          })
        }
        if (ref.kind !== "capability_set") continue
        if (ref.source === "package") {
          referencedPackageSets.add(ref.local_ref)
          if (!Object.hasOwn(manifest.capability_sets, ref.local_ref)) {
            context.addIssue({
              code: "custom",
              path: ["capability_projection", ...projectionPath.split("."), "capability_refs", index],
              message: `references missing package capability set ${ref.local_ref}`,
            })
          }
          continue
        }
        if (ref.source !== "platform" || ref.owner_ref !== "tool-registry") {
          context.addIssue({
            code: "custom",
            path: ["capability_projection", ...projectionPath.split("."), "capability_refs", index],
            message: "non-package capability sets must be owned by platform tool-registry",
          })
        }
      }
    }
    for (const [setID, set] of Object.entries(manifest.capability_sets)) {
      if (!referencedPackageSets.has(setID)) {
        context.addIssue({
          code: "custom",
          path: ["capability_sets", setID],
          message: `package capability set ${setID} is not referenced by a projection`,
        })
      }
      for (const [index, encoded] of set.member_refs.entries()) {
        const ref = decodedCapabilityRef(encoded)
        if (!ref) continue
        if (ref.source === "package" && ref.owner_ref !== manifest.id) {
          context.addIssue({
            code: "custom",
            path: ["capability_sets", setID, "member_refs", index],
            message: `package capability owner ${ref.owner_ref} must equal manifest id ${manifest.id}`,
          })
        }
      }
    }
  })

export type ExpertSquadConfiguration = z.output<typeof ExpertSquadConfigurationSchema>
export type ExpertSquadConfigurationField = z.output<typeof ExpertSquadConfigurationFieldSchema>
export type ExpertSquadCapabilitySet = z.output<typeof ExpertSquadCapabilitySetSchema>
export type ExpertSquadCapabilitySets = z.output<typeof ExpertSquadCapabilitySetsSchema>
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
export interface ExpertSquadManifestV2 {
  schema_version: 2
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
  capability_sets: ExpertSquadCapabilitySets
  capability_projection: ExpertSquadCapabilityProjection
}
