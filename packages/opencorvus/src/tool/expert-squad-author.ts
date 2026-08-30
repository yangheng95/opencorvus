import { ExpertSquadConversationAuthoring } from "@/expert-squad/conversation-authoring"
import { RuntimeTemplateID } from "@/agent/runtime-template-id"
import { Instance } from "@/project/instance"
import {
  ExpertSquadCapabilitySetsSchema,
  ExpertSquadConfigurationSchema,
  ExpertSquadDynamicAgentIDSchema,
  ExpertSquadIDSchema,
  ExpertSquadNamespaceSchema,
  ExpertSquadProjectionCapabilitiesSchema,
  ProductPillarsSchema,
  ExpertSquadTextPackageDefinitionSchema,
  ExpertSquadVersionSchema,
  ExpertSquadVirtualWorkflowNodeSchema,
} from "@opencorvus-ai/sdk/expert-squad-authoring"
import { tool as aiTool } from "ai"
import z from "zod"
import { Tool } from "./tool"
import { taskExecutionID } from "./execution-files"
import {
  expertSquadGenerationAuthority,
  type ExpertSquadGenerationTrace,
} from "@/expert-squad/installation-metadata"

const AuthoringCapabilityRefs = ExpertSquadProjectionCapabilitiesSchema.shape.capability_refs.default([]).describe(
  "Canonical encoded leaf or one-level capability-set refs granted to this projection. base_role is only a runtime upper bound and grants nothing; include the exact matching platform base CapabilitySet ref when its members are required. Package files referenced by a package capability must be supplied in extra_files.",
)

const AuthoringVirtualWorkflowNodeSchema = z
  .object({
    agent_id: ExpertSquadVirtualWorkflowNodeSchema.shape.agent_id,
    description: ExpertSquadVirtualWorkflowNodeSchema.shape.description,
    depends_on: z
      .array(ExpertSquadIDSchema)
      .default([])
      .overwrite((values) => [...new Set(values)].sort()),
  })
  .strict()

const AuthoringVirtualWorkflowSchema = z
  .object({
    label: z.string().trim().min(1),
    description: z.string().trim().min(1),
    nodes: z
      .record(ExpertSquadIDSchema, AuthoringVirtualWorkflowNodeSchema)
      .refine((nodes) => Object.keys(nodes).length > 0, { message: "virtual workflow requires at least one node" }),
  })
  .strict()

export const ExpertSquadAuthorDefinitionSchema = ExpertSquadTextPackageDefinitionSchema

const AuthoringSchedulerInputSchema = z
  .object({
    prompt: z.string().trim().min(1),
    capability_refs: AuthoringCapabilityRefs,
  })
  .strict()

const AuthoringAgentInputSchema = z
  .object({
    label: z.string().trim().min(1),
    description: z.string().trim().min(1),
    base_role: z
      .enum(RuntimeTemplateID.ids)
      .describe(
        "fact-check reviews exactly one existing assistant message per workflow node. Give it exactly one upstream producer dependency; use separate fact-check nodes for separate messages, or synthesize them into one message first. Use deep-research for independent public-source investigation.",
      ),
    prompt: z.string().trim().min(1),
    capability_refs: AuthoringCapabilityRefs,
  })
  .strict()

export const ExpertSquadAuthorParameters = z
  .object({
    schema_version: z.literal(2),
    namespace: ExpertSquadNamespaceSchema,
    id: ExpertSquadIDSchema,
    name: z.string().trim().min(1).optional(),
    label: z.string().trim().min(1),
    description: z.string().trim().min(1),
    version: ExpertSquadVersionSchema,
    product_pillars: ProductPillarsSchema.describe("Product pillars where this Expert Squad is valid."),
    configuration: ExpertSquadConfigurationSchema.optional(),
    capability_sets: ExpertSquadCapabilitySetsSchema.default({}),
    expected_current_package_digest: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional()
      .describe("Required current installed package digest when replacing an existing package."),
    readme: z.string().trim().min(1).describe("Complete README.md content."),
    selector: z
      .object({
        summary: z.string().trim().min(1),
        selection_guidance: z.string().trim().min(1),
        instructions: z.string().trim().min(1).describe("Complete selector.md content."),
      })
      .strict(),
    scheduler: AuthoringSchedulerInputSchema,
    agents: z
      .record(ExpertSquadDynamicAgentIDSchema, AuthoringAgentInputSchema)
      .refine((agents) => Object.keys(agents).length > 0, { message: "at least one agent is required" }),
    virtual_workflows: z.record(ExpertSquadIDSchema, AuthoringVirtualWorkflowSchema),
    extra_files: z
      .record(z.string(), z.string())
      .default({})
      .describe(
        "Additional package files required by declared resources. Package tool entrypoints are tools/<tool-id>.ts for shared refs or agents/<agent-id>/tools/<tool-id>.ts for Agent-owned refs; supporting code belongs under lib/ or agents/<agent-id>/lib/. Omit when unused. There is no top-level tools input field.",
      ),
  })
  .strict()
  .superRefine((value, context) => {
    const canonicalPaths = new Set([
      "README.md",
      "selector.md",
      "agents/orchestrator/system.md",
      ...Object.keys(value.agents).map((agentID) => `agents/${agentID}/system.md`),
    ])
    for (const file of Object.keys(value.extra_files)) {
      if (!canonicalPaths.has(file)) continue
      context.addIssue({
        code: "custom",
        path: ["extra_files", file],
        message: `${file} is Host-owned; provide its content through the matching inline blueprint field`,
      })
    }
  })

export function buildExpertSquadAuthorDefinition(args: z.infer<typeof ExpertSquadAuthorParameters>) {
  const input = ExpertSquadAuthorParameters.parse(args)
  const { prompt: schedulerPrompt, ...schedulerProjection } = input.scheduler
  const files: Record<string, string> = {
    ...input.extra_files,
    "README.md": input.readme,
    "selector.md": input.selector.instructions,
    "agents/orchestrator/system.md": schedulerPrompt,
  }
  const agents = Object.fromEntries(
    Object.entries(input.agents).map(([agentID, agent]) => {
      const prompt = `agents/${agentID}/system.md`
      const { prompt: agentPrompt, ...projection } = agent
      files[prompt] = agentPrompt
      return [
        agentID,
        {
          ...projection,
          prompt,
        },
      ]
    }),
  )
  return ExpertSquadAuthorDefinitionSchema.parse({
    manifest: {
      schema_version: input.schema_version,
      namespace: input.namespace,
      id: input.id,
      ...(input.name ? { name: input.name } : {}),
      label: input.label,
      description: input.description,
      version: input.version,
      product_pillars: input.product_pillars,
      configuration: input.configuration,
      capability_sets: input.capability_sets,
      readme: "README.md",
      selector: {
        summary: input.selector.summary,
        selection_guidance: input.selector.selection_guidance,
        instructions: "selector.md",
      },
      capability_projection: {
        scheduler: {
          ...schedulerProjection,
          base_role: "orchestrator",
          prompt: "agents/orchestrator/system.md",
        },
        agents,
        virtual_workflows: input.virtual_workflows,
      },
    },
    files,
  })
}

function generationTrace(trace: ExpertSquadGenerationTrace) {
  return {
    ...expertSquadGenerationAuthority(trace),
    method: "sdk_authoring" as const,
  }
}

export async function authorProjectExpertSquad(
  args: z.infer<typeof ExpertSquadAuthorParameters>,
  trace: ExpertSquadGenerationTrace,
) {
  return ExpertSquadConversationAuthoring.author({
    projectDirectory: Instance.project.worktree,
    definition: buildExpertSquadAuthorDefinition(args),
    installationScope: "project",
    generation: generationTrace(trace),
    expectedCurrentPackageDigest: args.expected_current_package_digest,
  })
}

const DESCRIPTION = [
  "Author, validate, and explicitly import one OpenCorvus Expert Squad through the canonical SDK writer.",
  "Prefer one package-owned Planner node followed by at least two independent worker nodes that all depend only on that Planner. Use a richer acyclic evidence graph only when an exact producer/consumer Artifact dependency makes the edge unavoidable; never manufacture roles or edges for topology metrics.",
  "Submit the compact authoring blueprint directly. Prompts and README/selector content are inline; the Host deterministically owns canonical manifest paths and package file projection. base_role only selects a runtime upper bound and grants nothing: every projection that needs the matching platform base capabilities must declare that exact CapabilitySet in capability_refs. Empty capability_refs may be omitted only when runtime-owned transport is sufficient; empty capability_sets, depends_on, and extra_files may also be omitted.",
  'Package tools use no top-level tools field. Put each shared entrypoint in extra_files["tools/<tool-id>.ts"] and grant its canonical capability:tool:package:<squad-id>:<ref> identity through capability_refs or one package capability set; Agent-owned entries use extra_files["agents/<agent-id>/tools/<tool-id>.ts"]. Supporting code lives under lib/ or the matching Agent lib/.',
  "The Host writes a temporary source package with @opencorvus-ai/sdk/expert-squad-authoring, validates it through the Registry, records exact Task and Session generation provenance, imports it into the current project's canonical .opencorvus/expert-squads root through the Manager, removes the temporary source, and returns exact installed identity, scope, agents, deterministic workflow structure/frontier analysis, file count, canonical package digest, mutation operation, generation trace, and target.",
  "A new project-owned ID installs directly. Replacing an existing exact ID requires expected_current_package_digest; a stale digest returns an explicit compare-and-swap conflict.",
  "Every successful generation becomes discoverable through the current project catalog. The tool never activates the generated Squad and exposes no model-selected installation scope or target path.",
].join("\n")

export const ExpertSquadAuthorTool = Tool.define("expert_squad_author", {
  description: DESCRIPTION,
  parameters: ExpertSquadAuthorParameters,
  async execute(args, ctx) {
    const taskID = taskExecutionID(ctx, "expert_squad_author")
    const result = await authorProjectExpertSquad(args, { taskID, sessionID: ctx.sessionID })
    return {
      title: `Authored Expert Squad ${result.id}`,
      metadata: result,
      output: JSON.stringify(result, null, 2),
    }
  },
})

export function createExpertSquadAuthorAiTool(trace: ExpertSquadGenerationTrace) {
  return aiTool({
    description: DESCRIPTION,
    inputSchema: ExpertSquadAuthorParameters,
    execute: (args) => authorProjectExpertSquad(args, trace),
  })
}
