import z from "zod"
import { ProductPillarSchema } from "@opencorvus-ai/sdk/expert-squad-manifest-v1"
import { AcceptanceSpecSchema } from "@/acceptance/types"
import { CheckConfig } from "@/engine/check-config"
import { ChannelId, ChannelSurface as SharedChannelSurface } from "@/channel/catalog"
import { ExpertSquadIDSchema } from "@/expert-squad/id"
import { isModelReference } from "@/provider/model-ref"
import { TaskCallerMetadata } from "@/task-api/task-caller-metadata"
import {
  ArtifactReadReferenceInputSchema,
  ArtifactSearchWithoutLimitSchema,
  CrossTaskArtifactSourceListSchema,
  refineArtifactSearchInput,
} from "@opencorvus-ai/plugin/artifact-catalog"
import { MissionCompletionInput } from "@/mission/completion"
import { MissionAcceptanceGapInputSchema } from "@/mission/acceptance-gap"
import { TaskCancellationReason } from "@opencorvus-ai/transport-protocol"
import { TerminalLifecycleReferenceSchema } from "@/engine/terminal-lifecycle-reference-schema"

const { cursor: _genericArtifactCursor, ...PanelArtifactSearchShape } = ArtifactSearchWithoutLimitSchema.shape

export const RIGHT_SIDEBAR_SURFACE = "right-sidebar"
export const PanelSurface = z.enum([...SharedChannelSurface.options, RIGHT_SIDEBAR_SURFACE])
export const PanelCapabilityKind = z.enum(["query", "mutation"])
export const PanelLocalActionType = z.enum(["select_task", "select_session", "invalidate_session"])

/**
 * Who initiated a panel action — server-derived, NEVER client-supplied.
 *
 *   panel_ui        external UI / mobile gateway client / direct HTTP call
 *   control_agent   the OpenCorvus control LLM agent (`control`)
 *   mission         the OpenCorvus Mission LLM agent (`mission`)
 *   explore        the read-only exploration subagent (`explore`)
 *   right_sidebar_conversation
 *                  the project-bound Chat embedded in the right sidebar
 *
 * `actor` is the provenance dimension (who); `surface` is the channel
 * dimension (where). They are independent: a control_agent can run on
 * panel surface, a panel_ui can run on the gateway (remote/mobile) surface,
 * etc. Note `gateway` here is the infrastructure access surface, unrelated
 * to the `mission` actor identity.
 *
 * Replaces the prior free-text `source` field as the authoritative input
 * for authorization decisions and audit trails. `source` is preserved
 * for business-meaningful labels (e.g. "channel:slack:thread-123").
 */
export const PanelActor = z.enum(["panel_ui", "control_agent", "mission", "explore", "right_sidebar_conversation"])
export type PanelActor = z.infer<typeof PanelActor>

/**
 * Map a Tool.Context agent name to the panel actor identity.
 *
 * Only LLM agents that legitimately drive the panel are recognized.
 * External user-interface callers are not inferred from an agent name; they
 * must carry the server-created `panel-ui-request` context consumed by the
 * Panel tool.
 */
export function derivePanelActor(agent: string | undefined): Exclude<PanelActor, "panel_ui"> | undefined {
  if (agent === "control") return "control_agent"
  if (agent === "mission") return "mission"
  if (agent === "explore") return "explore"
  return undefined
}
export const PanelCapabilityQuery = z.object({
  surface: PanelSurface.default("panel"),
})

const allProjectSurfaces = PanelSurface.options
const sharedSurfaces = SharedChannelSurface.options
const localSurfaces = ["panel", RIGHT_SIDEBAR_SURFACE] as const
const localSurfaceSet: ReadonlySet<Surface> = new Set(localSurfaces)
const nonGatewaySharedSurfaces = SharedChannelSurface.options.filter((surface) => surface !== "gateway")
const AgentTaskCheckConfig = CheckConfig.omit({ named: true })
  .strict()
  .describe(
    "Executable Host verification configuration. Workflow IDs, phase names, sequencing, planning metadata, and evidence do not belong here; keep those as authored intent in request.",
  )

type Shape = z.ZodRawShape
type Surface = z.infer<typeof PanelSurface>
type Kind = z.infer<typeof PanelCapabilityKind>
type Local = z.infer<typeof PanelLocalActionType>
type Capability<S extends Shape = Shape, A extends string = string> = {
  action: A
  description: string
  kind: Kind
  surfaces: readonly Surface[]
  params: S
  local_action_types?: readonly Local[]
  local_action_surfaces?: readonly Surface[]
  schema: z.ZodObject<{ action: z.ZodLiteral<A> } & S>
}

function item<const A extends string, const S extends Shape>(input: {
  action: A
  description: string
  kind: Kind
  surfaces: readonly Surface[]
  params: S
  local_action_types?: readonly Local[]
  local_action_surfaces?: readonly Surface[]
  refine?: (value: z.output<z.ZodObject<{ action: z.ZodLiteral<A> } & S>>, context: z.RefinementCtx) => void
}) {
  const { refine, ...definition } = input
  const schema = z
    .object({
      action: z.literal(input.action),
      ...input.params,
    })
    .strict()
  return {
    ...definition,
    schema: refine ? schema.superRefine(refine) : schema,
  } satisfies Capability<S, A>
}

function list<const T extends readonly [Capability, ...Capability[]]>(...items: T) {
  return items
}

type CapabilityTuple = [Capability, Capability, ...Capability[]]
type SchemaTuple = [z.ZodObject<any>, z.ZodObject<any>, ...z.ZodObject<any>[]]

function refineCreateTaskChannelBinding(
  value: { platform?: unknown; channel?: unknown; thread?: unknown },
  context: z.RefinementCtx,
) {
  const bindingFields = [value.platform, value.channel, value.thread]
  const suppliedBindingFields = bindingFields.filter((field) => field !== undefined).length
  if (suppliedBindingFields !== 0 && suppliedBindingFields !== bindingFields.length) {
    context.addIssue({
      code: "custom",
      message: "platform, channel, and thread must be supplied together.",
      path: ["platform"],
    })
  }
}

function schemas<const T extends readonly Capability[]>(items: T) {
  return items.map((item) => item.schema) as unknown as {
    [K in keyof T]: T[K] extends Capability<infer S, infer A> ? z.ZodObject<{ action: z.ZodLiteral<A> } & S> : never
  }
}

function schemaTuple(items: CapabilityTuple): SchemaTuple {
  return schemas(items) as unknown as SchemaTuple
}

function unrefinedCapabilitySchema(item: Capability) {
  return z
    .object({
      action: z.literal(item.action),
      ...item.params,
    })
    .strict() as z.ZodObject<any>
}

function agentSchemas<const T extends readonly Capability[]>(
  items: T,
  options: { requireMissionTaskIdentity?: boolean } = {},
) {
  return items.map((item) => {
    if (item.action === "create_task") {
      const baseSchema = unrefinedCapabilitySchema(item).omit({ metadata: true, source: true }).extend({
        checks: AgentTaskCheckConfig.optional(),
      })
      const schema = options.requireMissionTaskIdentity
        ? baseSchema.required({ title: true, promptProfile: true })
        : baseSchema
      return schema.superRefine(refineCreateTaskChannelBinding)
    }
    if (item.action === "send_task_message") {
      return item.schema.omit({ source: true })
    }
    if (item.action === "update_checks") {
      return item.schema.extend({
        checks: AgentTaskCheckConfig,
      })
    }
    return item.schema
  }) as SchemaTuple
}

function panelUISchema(item: Capability) {
  return item.action === "create_task"
    ? unrefinedCapabilitySchema(item).omit({ artifact_sources: true }).superRefine(refineCreateTaskChannelBinding)
    : item.schema
}

function panelUISchemas<const T extends readonly Capability[]>(items: T) {
  return items.map(panelUISchema) as SchemaTuple
}

const MissionPanelCapabilityActions = [
  "expert_squad_inspect",
  "multica_catalog",
  "create_task",
  "query_task",
  "query_task_artifacts",
  "read_task_artifact",
  "complete_mission",
  "view_board",
  "view_plan",
  "view_tasks",
  "resume_task",
  "cancel_task",
  "reply_interaction",
  "reject_interaction",
] as const
const ExplorePanelCapabilityActions = ["query_task", "view_board", "view_plan", "view_tasks"] as const

function selectCapabilities(actions: readonly string[], context: string): CapabilityTuple {
  const byAction: Map<string, Capability> = new Map(PanelCapabilityRegistry.map((item) => [item.action, item] as const))
  const items = actions.map((action) => {
    const capability = byAction.get(action)
    if (!capability) throw new Error(`${context} references unknown panel action ${action}.`)
    return capability
  })
  if (items.length < 2) throw new Error(`${context} must declare at least two panel actions.`)
  return items as CapabilityTuple
}

export const PanelCapabilityRegistry = list(
  item({
    action: "expert_squad_inspect",
    description:
      "Inspect selector guidance and workflow summaries for one exact Expert Squad candidate returned by held-filtered capability_search. This never enumerates the Mission held set or returns a full package declaration.",
    kind: "query",
    surfaces: ["panel"],
    params: {
      id: ExpertSquadIDSchema.describe("Exact held Expert Squad manifest ID returned by capability_search."),
      workflowCursor: z
        .string()
        .min(1)
        .optional()
        .describe("Opaque next_workflow_cursor returned by the preceding inspection of this exact Squad."),
    },
  }),
  item({
    action: "multica_catalog",
    description:
      "List every Multica Squad with authoritative installed status only for an explicitly requested Multica import workflow, without writing project state or exposing credentials. This is not an expert-squad discovery, selection, validation, activation, or fallback surface.",
    kind: "query",
    surfaces: ["panel"],
    params: {},
  }),
  item({
    action: "view_plan",
    description: "Inspect a task plan and goal list.",
    kind: "query",
    surfaces: allProjectSurfaces,
    params: {
      taskID: z.string().describe("Task ID whose plan should be inspected."),
    },
  }),
  item({
    action: "view_board",
    description: "Inspect a task board or list recent tasks when taskID is omitted.",
    kind: "query",
    surfaces: allProjectSurfaces,
    params: {
      taskID: z.string().optional().describe("Task ID whose board should be inspected; omit to list recent tasks."),
    },
  }),
  item({
    action: "view_tasks",
    description: "List recent tasks in the current project.",
    kind: "query",
    surfaces: allProjectSurfaces,
    params: {},
  }),
  item({
    action: "query_task",
    description:
      "Structured batch task status query for LLM reconciliation. Returns stable JSON for up to 50 taskIDs " +
      "at a time. Distinct from view_board (which produces human-oriented prose, single-task at a time) — " +
      "use this when an agent needs to programmatically inspect outcomes of tasks it has dispatched. " +
      "The current acceptance-ledger obligation is projected when present; other Artifact bodies remain excluded and are enumerated through query_task_artifacts.",
    kind: "query",
    surfaces: allProjectSurfaces,
    params: {
      taskIDs: z.array(z.string().min(1)).min(1).max(50).describe("Task IDs to query in one request."),
      includeInteractions: z
        .boolean()
        .optional()
        .describe("Include pending interaction counts for each requested task."),
    },
  }),
  item({
    action: "query_task_artifacts",
    description:
      "Enumerate one terminal Task occurrence's canonical Artifact catalog through a bounded numbered page. Start with page_number 1 and repeat with next_page_number until null; the Host retains and authenticates opaque catalog cursors internally. Empty entries are a valid result. Each entry returns a short Host-minted artifact_locator_ref for read_task_artifact; the model never reconstructs its canonical locator.",
    kind: "query",
    surfaces: allProjectSurfaces,
    params: {
      taskID: z.string().min(1).describe("Source Task whose Artifact catalog should be enumerated."),
      terminal_lifecycle_reference: TerminalLifecycleReferenceSchema.describe(
        "Exact current terminal occurrence returned by panel.query_task for this source Task.",
      ),
      page_number: z
        .number()
        .int()
        .min(1)
        .max(1_000)
        .describe("One-based page number. Start at 1, then use the preceding response's next_page_number."),
      ...PanelArtifactSearchShape,
    },
    refine: refineArtifactSearchInput,
  }),
  item({
    action: "read_task_artifact",
    description:
      "Read one exact Artifact selected by a Host-minted catalog reference from one terminal Task occurrence in this Mission lineage. Continue through every next_offset until complete, then use the returned occurrence-bound artifact_read_ref for acceptance or resume.",
    kind: "query",
    surfaces: ["panel"],
    params: {
      taskID: z.string().min(1).describe("Terminal source Task in the current Mission lineage."),
      ...ArtifactReadReferenceInputSchema.shape,
    },
  }),
  item({
    action: "complete_mission",
    description:
      "Record the current Mission outcome as accepted only after completely reading the exact current completed child-Task evidence. The visible Tool result is the durable completion fact; later Mission input requires a newer decision.",
    kind: "mutation",
    surfaces: ["panel"],
    params: MissionCompletionInput.shape,
  }),
  item({
    action: "create_task",
    description:
      "Create one outcome-complete Task, optionally binding it to a channel thread. Mission creates another Task only for a genuinely different fixed Expert Squad, accepted external Task evidence or operator-authority boundary, or an explicit operator request for a separate lifecycle.",
    kind: "mutation",
    surfaces: allProjectSurfaces,
    params: {
      title: z.string().trim().min(1).max(80).optional().describe("Short task title shown in the project board."),
      request: z.string().describe("Full user request to execute in the new task."),
      productPillar: ProductPillarSchema.optional().describe(
        "Product pillar for direct panel-UI creation. Mission and conversation callers inherit their persisted pillar.",
      ),
      directory: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe(
          "Absolute execution repository for the new Task. Sessions, tools, artifacts, and git operations use this directory while Task storage remains in the caller project.",
        ),
      request_id: z.string().optional().describe("External request ID used for idempotent task creation."),
      artifact_sources: CrossTaskArtifactSourceListSchema.optional().describe(
        "Mission-only cross-Task delivery authorities. For a completed source, provide only {authority:'completion_decision',source_task_id}; the Host imports the complete current deliverable set without copied locator IDs. For failed/cancelled recovery, provide {authority:'terminal_lifecycle',source_task_id,locator}.",
      ),
      model: z
        .string()
        .refine(isModelReference, {
          message: 'Model must be in the format "provider/model".',
        })
        .optional()
        .describe("Model reference in provider/model format for the new task."),
      promptProfile: ExpertSquadIDSchema.optional().describe(
        "Exact expert-squad manifest ID that owns the new Task for its full lifetime. Mission must choose a held ID returned by capability_search and may inspect it with expert_squad_inspect. Non-Mission callers may omit it to inherit their effective prompt_profile.active.",
      ),
      expectedPackageDigest: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .optional()
        .describe(
          "Optional compare-and-swap assertion for the exact immutable expert-squad package revision resolved at Task creation.",
        ),
      checks: CheckConfig.optional().describe("Host verification check configuration for the new task."),
      channel: z.string().optional().describe("External channel identifier to bind to the new task."),
      thread: z.string().optional().describe("External thread identifier to bind to the new task."),
      platform: ChannelId.optional().describe("Channel platform for an external task binding."),
      metadata: TaskCallerMetadata.optional().describe(
        "Structured metadata to attach to the new task. Creator identity fields are server-owned.",
      ),
      source: z.string().optional().describe("Business source label for the new task."),
      allow_create: z.boolean().optional().describe("Set false to return without creating a task."),
    },
    refine: refineCreateTaskChannelBinding,
  }),
  item({
    action: "wake_mission",
    description:
      "Recommend a new Mission from right-sidebar Chat or Work when the request clearly needs durable multi-step workflow orchestration. Shows the operator the concrete recommendation reason and asks Yes/No before creating anything; after 10 seconds without input, the real Question defaults to Yes. Returns a receipt to the caller conversation when the confirmed Mission reaches a terminal status.",
    kind: "mutation",
    surfaces: [RIGHT_SIDEBAR_SURFACE],
    params: {
      title: z.string().trim().min(1).max(80).optional().describe("Short Mission title shown in the Work Ledger."),
      request: z.string().trim().min(1).max(32_000).describe("Full workflow request to hand to Mission."),
      reason: z
        .string()
        .trim()
        .min(1)
        .max(1_000)
        .describe(
          "Complete user-visible popup question, in the user's language, that explains why durable Mission orchestration is recommended for this request and asks whether to route there.",
        ),
    },
  }),
  item({
    action: "wake_work",
    description:
      "Move the current Chat request into a new Work conversation only when the user explicitly asks to continue that request in Work. Never infer or recommend Work from request length, complexity, deliverable type, or artifact needs. Shows the operator a Yes/No confirmation before creating anything.",
    kind: "mutation",
    surfaces: [RIGHT_SIDEBAR_SURFACE],
    params: {
      title: z.string().trim().min(1).max(200).optional().describe("Short title shown for the new Work conversation."),
      request: z.string().trim().min(1).max(32_000).describe("Full request to hand to Work."),
      reason: z
        .string()
        .trim()
        .min(1)
        .max(1_000)
        .describe(
          "Complete user-visible popup question, in the user's language, that restates the user's explicit request to continue in Work and asks for confirmation.",
        ),
    },
  }),
  item({
    action: "send_task_message",
    description: "Send a follow-up message to an existing task.",
    kind: "mutation",
    surfaces: allProjectSurfaces,
    params: {
      taskID: z.string().describe("Task ID that should receive the follow-up message."),
      text: z.string().describe("Follow-up message text to append to the task."),
      source: z.string().min(1).describe("Business source label for the follow-up message."),
      model: z
        .string()
        .refine(isModelReference, {
          message: 'Model must be in the format "provider/model".',
        })
        .optional()
        .describe("Explicit provider/model reference for this Task continuation."),
      user_id: z.string().optional().describe("External user ID associated with the follow-up message."),
    },
  }),
  item({
    action: "resume_task",
    description:
      "Resume the same completed or failed Mission-owned Task from an evidence-backed acceptance gap. This writes one visible Mission message and opens a new execution occurrence; scheduler_message remains communication-only and never reopens a terminal Task.",
    kind: "mutation",
    surfaces: ["panel"],
    params: {
      taskID: z.string().min(1).describe("Completed or failed source Task in the current Mission lineage."),
      acceptance_gap: MissionAcceptanceGapInputSchema.describe(
        "Exact failed or unresolved criteria, preserved acceptances, current ledger revision, workflow ownership, and completely read evidence for the next execution epoch. The Host renders the visible Mission repair Message from this single structure.",
      ),
    },
  }),
  item({
    action: "reply_interaction",
    description: "Answer a pending task interaction.",
    kind: "mutation",
    surfaces: allProjectSurfaces,
    params: {
      interactionID: z.string().describe("Pending interaction ID to answer."),
      reply: z.enum(["once", "always"]).optional().describe("Preset reply behavior for the interaction."),
      message: z.string().optional().describe("Custom answer text for the pending interaction."),
    },
  }),
  item({
    action: "reject_interaction",
    description: "Reject a pending task interaction.",
    kind: "mutation",
    surfaces: allProjectSurfaces,
    params: {
      interactionID: z.string().describe("Pending interaction ID to reject."),
      message: z.string().optional().describe("Reason shown when rejecting the pending interaction."),
    },
  }),
  item({
    action: "cancel_task",
    description: "Cancel a task.",
    kind: "mutation",
    surfaces: allProjectSurfaces,
    params: {
      taskID: z.string().describe("Task ID to cancel."),
      reason: TaskCancellationReason.describe("Why the task is being cancelled."),
    },
  }),
  item({
    action: "update_checks",
    description: "Replace the complete Host verification check configuration for a task.",
    kind: "mutation",
    surfaces: allProjectSurfaces,
    params: {
      taskID: z.string().describe("Task ID whose verification checks should change."),
      checks: CheckConfig.describe("Complete replacement Host verification check configuration."),
    },
  }),
  item({
    action: "capture_overlay_screenshot",
    description: "Capture the current OpenCorvus GUI window and return it as an image attachment.",
    kind: "query",
    surfaces: nonGatewaySharedSurfaces,
    params: {
      match: z.string().optional().describe("Optional window title or process match hint for the screenshot."),
    },
  }),
  item({
    action: "select_task",
    description: "Focus a task in the local project assistant surface.",
    kind: "mutation",
    surfaces: localSurfaces,
    params: {
      taskID: z.string().describe("Task ID to focus in the local project assistant surface."),
    },
    local_action_types: ["select_task"],
    local_action_surfaces: localSurfaces,
  }),
  item({
    action: "select_session",
    description: "Focus a session in the local project assistant surface.",
    kind: "mutation",
    surfaces: localSurfaces,
    params: {
      sessionID: z.string().describe("Session ID to focus in the local project assistant surface."),
    },
    local_action_types: ["select_session"],
    local_action_surfaces: localSurfaces,
  }),
  item({
    action: "create_session",
    description: "Create a blank session.",
    kind: "mutation",
    surfaces: sharedSurfaces,
    params: {},
    local_action_types: ["select_session"],
    local_action_surfaces: ["panel"],
  }),
  item({
    action: "fork_session",
    description: "Fork an existing session.",
    kind: "mutation",
    surfaces: sharedSurfaces,
    params: {
      sessionID: z.string().describe("Session ID to fork."),
    },
    local_action_types: ["select_session"],
    local_action_surfaces: ["panel"],
  }),
  item({
    action: "delete_session",
    description: "Delete a session and its linked tasks.",
    kind: "mutation",
    surfaces: sharedSurfaces,
    params: {
      sessionID: z.string().describe("Session ID to delete."),
    },
    local_action_types: ["invalidate_session"],
    local_action_surfaces: ["panel"],
  }),
  item({
    action: "update_goal",
    description: "Replace a goal title and its complete structured acceptance contract.",
    kind: "mutation",
    surfaces: allProjectSurfaces,
    params: {
      goalID: z.string().describe("Goal ID to update."),
      title: z.string().min(1).describe("Replacement goal title."),
      acceptance_specs: z
        .array(AcceptanceSpecSchema)
        .min(1)
        .describe("Complete replacement acceptance specs for the goal."),
    },
  }),
  item({
    action: "delete_goal",
    description: "Delete a goal.",
    kind: "mutation",
    surfaces: allProjectSurfaces,
    params: {
      goalID: z.string().describe("Goal ID to delete."),
    },
  }),
)

const RegistryPanelActionSchema = z.discriminatedUnion("action", schemas(PanelCapabilityRegistry))
export type PanelActionInput = z.infer<typeof RegistryPanelActionSchema>
export type PanelActionParameterSchema = z.ZodType<PanelActionInput>
export const PanelActionSchema = z.discriminatedUnion(
  "action",
  panelUISchemas(PanelCapabilityRegistry),
) as unknown as PanelActionParameterSchema
export const MissionPanelCapabilityRegistry = selectCapabilities(
  MissionPanelCapabilityActions,
  "mission panel capability registry",
)
export const ExplorePanelCapabilityRegistry = selectCapabilities(
  ExplorePanelCapabilityActions,
  "explore panel capability registry",
)
export const MissionPanelActionSchema = z.discriminatedUnion(
  "action",
  agentSchemas(MissionPanelCapabilityRegistry, { requireMissionTaskIdentity: true }),
)
export const ExplorePanelActionSchema = z.discriminatedUnion("action", schemaTuple(ExplorePanelCapabilityRegistry))
export const AgentPanelActionSchema = z.discriminatedUnion("action", agentSchemas(PanelCapabilityRegistry))

export function panelActionSchemaForAgent(agent: string | undefined): PanelActionParameterSchema {
  if (agent === "panel_ui") return PanelActionSchema as PanelActionParameterSchema
  const actor = derivePanelActor(agent)
  if (actor === "mission") return MissionPanelActionSchema as unknown as PanelActionParameterSchema
  if (actor === "explore") return ExplorePanelActionSchema as unknown as PanelActionParameterSchema
  return AgentPanelActionSchema as unknown as PanelActionParameterSchema
}

export const PanelCapability = z.object({
  action: z.string(),
  description: z.string(),
  kind: PanelCapabilityKind,
  surfaces: z.array(PanelSurface),
  local_only: z.boolean(),
  local_action_types: z.array(PanelLocalActionType).optional(),
  local_action_surfaces: z.array(PanelSurface).optional(),
  schema: z.record(z.string(), z.unknown()),
})

export const PanelCapabilityResponse = z.object({
  surface: PanelSurface,
  actions: z.array(PanelCapability),
})

function view(item: Capability) {
  return {
    action: item.action,
    description: item.description,
    kind: item.kind,
    surfaces: [...item.surfaces],
    local_only: item.surfaces.every((surface) => localSurfaceSet.has(surface)),
    ...(item.local_action_types ? { local_action_types: [...item.local_action_types] } : {}),
    ...(item.local_action_surfaces ? { local_action_surfaces: [...item.local_action_surfaces] } : {}),
    schema: z.toJSONSchema(panelUISchema(item)),
  }
}

export function panelCapabilities(surface: Surface) {
  return PanelCapabilityResponse.parse({
    surface,
    actions: PanelCapabilityRegistry.filter((item) => item.surfaces.includes(surface)).map(view),
  })
}

export function panelCapabilityActionSet(surface: Surface) {
  return new Set(panelCapabilities(surface).actions.map((item) => item.action))
}

function panelCapabilityItemsForActor(actor: PanelActor, surface?: Surface): readonly Capability[] {
  const actorItems =
    actor === "mission"
      ? MissionPanelCapabilityRegistry
      : actor === "explore"
        ? ExplorePanelCapabilityRegistry
        : actor === "right_sidebar_conversation" && surface
          ? PanelCapabilityRegistry.filter((item) => item.surfaces.includes(surface))
          : PanelCapabilityRegistry
  return surface ? actorItems.filter((item) => item.surfaces.includes(surface)) : actorItems
}

export function panelActionSetForActor(actor: PanelActor, surface?: Surface) {
  return new Set(panelCapabilityItemsForActor(actor, surface).map((item) => item.action))
}

export function panelCapabilityPrompt(surface: Surface) {
  return panelCapabilities(surface)
    .actions.map((item) => {
      const local = item.local_only ? " Desktop panel only." : ""
      const action = item.local_action_types?.length
        ? ` Emits local actions: ${item.local_action_types.join(", ")} on ${item.local_action_surfaces?.join(", ")}.`
        : ""
      return `- ${item.action}: ${item.description}${local}${action}`
    })
    .join("\n")
}
