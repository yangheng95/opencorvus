/**
 * Shared transport contracts used by the server, desktop host, browser
 * overlay, and their tests. Keeping these values here prevents route,
 * lifecycle, settings, and native-command validation from drifting.
 */
import { z } from "zod"
import { ProductPillarSchema } from "@opencorvus-ai/sdk/expert-squad-manifest-v1"

export { ProductPillarSchema }
export type { ProductPillar } from "@opencorvus-ai/sdk/expert-squad-manifest-v1"

export const ConversationTargetSchema = z.enum(["chat", "mission"])
export type ConversationTarget = z.output<typeof ConversationTargetSchema>

export const ComposerIntentSchema = z
  .object({
    productPillar: ProductPillarSchema,
    conversationTarget: ConversationTargetSchema,
  })
  .strict()
export type ComposerIntent = z.output<typeof ComposerIntentSchema>

export const DEFAULT_COMPOSER_INTENT: ComposerIntent = {
  productPillar: "work",
  conversationTarget: "chat",
}

export function productPillarFromConversationExperience(experience: "chat" | "work"): "code" | "work" {
  return experience === "work" ? "work" : "code"
}

export function conversationExperienceFromProductPillar(pillar: "code" | "work"): "chat" | "work" {
  return pillar === "work" ? "work" : "chat"
}

export function resolveComposerIntentRoute(intent: ComposerIntent, explicitMission: boolean) {
  if (explicitMission || intent.conversationTarget === "mission") {
    return { kind: "mission" as const, productPillar: intent.productPillar }
  }
  return {
    kind: "conversation" as const,
    productPillar: intent.productPillar,
    experience: conversationExperienceFromProductPillar(intent.productPillar),
  }
}

// ── Task cancellation provenance ──

export const TASK_CANCELLATION_REQUEST_SURFACES = [
  "api",
  "overlay.work_ledger",
  "overlay.selected_task",
  "overlay.composer_stop",
  "overlay.chat_request_stop",
  "overlay.interrupt_task",
  "overlay.archive_panel",
] as const

export const TaskCancellationRequestSurface = z.enum(TASK_CANCELLATION_REQUEST_SURFACES)
export type TaskCancellationRequestSurface = z.infer<typeof TaskCancellationRequestSurface>

export const TaskCancellationReason = z.string().trim().min(1).max(2_000)
export type TaskCancellationReason = z.infer<typeof TaskCancellationReason>

export const TaskCancellationRequestBody = z
  .object({
    surface: TaskCancellationRequestSurface,
    reason: TaskCancellationReason,
  })
  .strict()
export type TaskCancellationRequestBody = z.infer<typeof TaskCancellationRequestBody>

/**
 * Archiving stops active execution while restoring does not. The
 * discriminated transport makes provenance mandatory only for the destructive
 * branch and prevents a restore request from carrying misleading cancellation
 * fields.
 */
export const TaskArchiveRequestBody = z.discriminatedUnion("archived", [
  TaskCancellationRequestBody.extend({ archived: z.literal(true) }).strict(),
  z.object({ archived: z.literal(false) }).strict(),
])
export type TaskArchiveRequestBody = z.infer<typeof TaskArchiveRequestBody>

// ── Visible composer mention directives ──

export const VisibleMentionKind = z.enum(["skill", "mission-skill", "squad"])
export type VisibleMentionKind = z.infer<typeof VisibleMentionKind>

export interface VisibleMentionDirectiveRange {
  kind: VisibleMentionKind
  value: string
  start: number
  end: number
}

export const VisibleComposerReferences = z
  .object({
    skillNames: z.array(z.string()),
    missionSkillNames: z.array(z.string()),
    /** Agent Squad IDs (Identifiers) preserve first-visible-reference order. */
    expertSquadIDs: z.array(z.string()),
  })
  .strict()
export type VisibleComposerReferences = z.infer<typeof VisibleComposerReferences>

const VISIBLE_MENTION_SYNTAX: Readonly<Record<VisibleMentionKind, string>> = {
  skill: "skill",
  "mission-skill": "mission",
  squad: "squad",
}

function visibleMentionKindForSyntax(syntax: string): VisibleMentionKind | undefined {
  return VisibleMentionKind.options.find((kind) => VISIBLE_MENTION_SYNTAX[kind] === syntax)
}

function visibleMentionBoundaryAllows(text: string, index: number): boolean {
  if (index === 0) return true
  return !/[A-Za-z0-9_]/.test(text[index - 1] ?? "")
}

export function visibleMentionDirectiveRanges(text: string): VisibleMentionDirectiveRange[] {
  const directives: VisibleMentionDirectiveRange[] = []
  const pattern = /@([a-z-]+)\((["“])((?:\\.|[^"“”\\])*)(["”])\)/g
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? -1
    if (index < 0 || !visibleMentionBoundaryAllows(text, index)) continue
    const kind = visibleMentionKindForSyntax(match[1]!)
    if (!kind) continue
    const value = JSON.parse(`"${match[3]!}"`)
    if (typeof value !== "string") continue
    directives.push({
      kind,
      value,
      start: index,
      end: index + match[0].length,
    })
  }
  return directives
}

export function visibleComposerReferences(text: string): VisibleComposerReferences {
  const skillNames: string[] = []
  const missionSkillNames: string[] = []
  const expertSquadIDs: string[] = []
  const skills = new Set<string>()
  const missionSkills = new Set<string>()
  const expertSquads = new Set<string>()
  for (const directive of visibleMentionDirectiveRanges(text)) {
    const value = directive.value.trim()
    if (!value) continue
    if (directive.kind === "skill") {
      if (skills.has(value)) continue
      skills.add(value)
      skillNames.push(value)
      continue
    }
    if (directive.kind === "mission-skill") {
      if (missionSkills.has(value)) continue
      missionSkills.add(value)
      missionSkillNames.push(value)
      continue
    }
    if (expertSquads.has(value)) continue
    expertSquads.add(value)
    expertSquadIDs.push(value)
  }
  return VisibleComposerReferences.parse({
    skillNames,
    missionSkillNames,
    expertSquadIDs,
  })
}

// SSE means Server-Sent Events. These names bind browser request evidence to
// the exact transport-owned stream instance that produced it.
export const STREAM_INSTANCE_QUERY_KEY = "opencorvus_stream_instance"
export const STREAM_LIFECYCLE_EVENT_NAME = "opencorvus:stream-lifecycle"
export const STREAM_LIFECYCLE_PROTOCOL = "opencorvus.stream-lifecycle.v1" as const
export const STREAM_SUPERSESSION_INITIATOR = "superseded" as const
export const STREAM_FAILURE_PROVENANCE = "transport" as const

export type StreamCloseInitiator =
  | "superseded"
  | "consumer-dispose"
  | "abort-signal"
  | "consumer-error"
  | "transport-error"
  | "watchdog"

interface StreamLifecycleEventBase {
  protocol: typeof STREAM_LIFECYCLE_PROTOCOL
  streamID: string
  sequence: number
  timestampMilliseconds: number
  requestURL: string
}

export type StreamLifecycleEvent =
  | (StreamLifecycleEventBase & { phase: "opened" })
  | (StreamLifecycleEventBase & {
      phase: "closing"
      initiator: StreamCloseInitiator | "transport"
      reason: string
    })
  | (StreamLifecycleEventBase & {
      phase: "failed"
      failureProvenance: typeof STREAM_FAILURE_PROVENANCE
      reason: string
    })

// ── Panel message stream ──

export function panelMessageStreamEventSchema<ResultSchema extends z.ZodType>(result: ResultSchema) {
  return z.discriminatedUnion("type", [
    z.object({ type: z.literal("start") }).strict(),
    z.object({ type: z.literal("tool"), tool: z.string() }).strict(),
    z.object({ type: z.literal("done"), result }).strict(),
  ])
}

export const UnknownPanelMessageStreamEvent = panelMessageStreamEventSchema(
  z.unknown().refine((value) => value !== undefined, "Panel message done event requires a result"),
)
export type UnknownPanelMessageStreamEvent = z.infer<typeof UnknownPanelMessageStreamEvent>

// ── Version Control System commit-message stream ──

export const VcsCommitMessageStreamEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("delta"), delta: z.string() }).strict(),
  z.object({ type: z.literal("done"), message: z.string() }).strict(),
  z.object({ type: z.literal("error"), message: z.string() }).strict(),
])
export type VcsCommitMessageStreamEvent = z.infer<typeof VcsCommitMessageStreamEvent>

// ── Pseudo Terminal output stream ──

export const PtyOutputStreamEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("data"), data: z.string() }).strict(),
  z.object({ type: z.literal("cursor"), cursor: z.number() }).strict(),
  z.object({ type: z.literal("exit"), code: z.number(), reason: z.string() }).strict(),
])
export type PtyOutputStreamEvent = z.infer<typeof PtyOutputStreamEvent>

// ── Mailbox change stream ──

export const MailboxChangeStreamEvent = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("mailbox.connected"),
      sourceType: z.literal("mailbox.connected"),
      messageID: z.null(),
      taskID: z.null(),
      sequence: z.literal(0),
    })
    .strict(),
  z
    .object({
      type: z.literal("mailbox.heartbeat"),
      sourceType: z.literal("mailbox.heartbeat"),
      messageID: z.null(),
      taskID: z.null(),
      sequence: z.literal(0),
    })
    .strict(),
  z
    .object({
      type: z.literal("mailbox.changed"),
      sourceType: z.string().min(1),
      messageID: z.string().min(1),
      taskID: z.string().min(1).nullable(),
      sequence: z.number(),
    })
    .strict(),
])
export type MailboxChangeStreamEvent = z.infer<typeof MailboxChangeStreamEvent>

// ── Work Ledger projection and change stream ──

export const WorkLedgerChatStatus = z.enum(["active", "idle", "terminal"])
export const WorkLedgerTaskLifecycleStatus = z.enum(["queued", "active", "completed", "failed", "cancelled"])
export const WorkLedgerActivityStatus = z.enum(["running", "inactive"])
export const WorkLedgerTaskPriority = z.enum(["critical", "high", "normal", "low"])
export const WorkLedgerMissionID = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9-]+$/, "missionID must be lowercase alphanumerics and hyphens only")

export const WorkLedgerTaskStats = z
  .object({
    total: z.number(),
    running: z.number(),
    inactive: z.number(),
  })
  .strict()

export const WorkLedgerProjectRow = z
  .object({
    kind: z.literal("project"),
    id: z.string(),
    title: z.string(),
    directory: z.string(),
    created: z.number(),
    updated: z.number(),
    pinned: z.boolean(),
  })
  .strict()

export const WorkLedgerTaskRow = z
  .object({
    kind: z.literal("task"),
    id: z.string(),
    title: z.string(),
    description: z.string(),
    directory: z.string(),
    created: z.number(),
    started: z.number().nullable(),
    updated: z.number(),
    pinned: z.boolean(),
    lifecycleStatus: WorkLedgerTaskLifecycleStatus,
    activityStatus: WorkLedgerActivityStatus,
    priority: WorkLedgerTaskPriority,
    source: z.string(),
    productPillar: ProductPillarSchema,
    queueOrder: z.number(),
    pendingInteractions: z.number().int().nonnegative(),
    archived: z.number().optional(),
    missionID: WorkLedgerMissionID.optional(),
    missionSessionID: z.string().optional(),
  })
  .strict()

export const WorkLedgerMissionTaskRow = WorkLedgerTaskRow.extend({
  missionID: WorkLedgerMissionID,
  missionSessionID: z.string(),
}).strict()

export const WorkLedgerMissionRow = z
  .object({
    kind: z.literal("mission"),
    id: WorkLedgerMissionID,
    missionID: WorkLedgerMissionID,
    sessionID: z.string(),
    title: z.string(),
    directory: z.string(),
    created: z.number(),
    started: z.number(),
    updated: z.number(),
    pinned: z.boolean(),
    archived: z.number().optional(),
    interruptible: z.boolean(),
    productPillar: ProductPillarSchema,
    taskStats: WorkLedgerTaskStats,
    pendingInteractions: z.number().int().nonnegative(),
    tasks: WorkLedgerMissionTaskRow.array(),
  })
  .strict()

export const WorkLedgerChatRow = z
  .object({
    kind: z.literal("chat"),
    experience: z.enum(["chat", "work"]),
    id: z.string(),
    sessionID: z.string(),
    title: z.string(),
    directory: z.string(),
    created: z.number(),
    started: z.number(),
    updated: z.number(),
    pinned: z.boolean(),
    archived: z.number().optional(),
    status: WorkLedgerChatStatus,
  })
  .strict()

export const WorkLedgerRow = z.discriminatedUnion("kind", [
  WorkLedgerProjectRow,
  WorkLedgerMissionRow,
  WorkLedgerChatRow,
])

export const WorkLedgerArchiveRow = z.discriminatedUnion("kind", [
  WorkLedgerMissionRow,
  WorkLedgerTaskRow,
  WorkLedgerChatRow,
])

export const WorkLedgerCursor = z
  .object({
    pinned: z.boolean(),
    updated: z.number(),
    rowKey: z.string(),
  })
  .strict()

export const WorkLedgerList = z
  .object({
    rows: WorkLedgerRow.array(),
    nextCursor: WorkLedgerCursor.nullable(),
  })
  .strict()

export const WorkLedgerArchiveList = z
  .object({
    rows: WorkLedgerArchiveRow.array(),
    nextCursor: WorkLedgerCursor.nullable(),
  })
  .strict()

export type WorkLedgerProjectRow = z.infer<typeof WorkLedgerProjectRow>
export type WorkLedgerTaskRow = z.infer<typeof WorkLedgerTaskRow>
export type WorkLedgerMissionTaskRow = z.infer<typeof WorkLedgerMissionTaskRow>
export type WorkLedgerMissionRow = z.infer<typeof WorkLedgerMissionRow>
export type WorkLedgerChatRow = z.infer<typeof WorkLedgerChatRow>
export type WorkLedgerRow = z.infer<typeof WorkLedgerRow>
export type WorkLedgerArchiveRow = z.infer<typeof WorkLedgerArchiveRow>
export type WorkLedgerArchiveList = z.infer<typeof WorkLedgerArchiveList>
export type WorkLedgerCursor = z.infer<typeof WorkLedgerCursor>
export type WorkLedgerList = z.infer<typeof WorkLedgerList>

const WorkLedgerConnectedEvent = z
  .object({
    type: z.literal("work-ledger.connected"),
    sourceType: z.string(),
    sequence: z.number(),
  })
  .strict()
const WorkLedgerHeartbeatEvent = z
  .object({
    type: z.literal("work-ledger.heartbeat"),
    sourceType: z.string(),
    sequence: z.number(),
  })
  .strict()

export const WorkLedgerChangedEvent = z
  .object({
    type: z.literal("work-ledger.changed"),
    sourceType: z.string(),
    projectID: z.string().optional(),
    directory: z.string().optional(),
    sessionID: z.string().optional(),
    taskID: z.string().nullable().optional(),
    sequence: z.number(),
  })
  .strict()

export const WorkLedgerMissionHandoffEvent = z
  .object({
    type: z.literal("work-ledger.mission-handoff"),
    sourceType: z.literal("mission.handoff"),
    projectID: z.string().min(1),
    directory: z.string().min(1),
    missionID: WorkLedgerMissionID,
    sessionID: z.string().min(1),
    callerSessionID: z.string().min(1),
    callerExperience: z.enum(["chat", "work"]),
    callerMessageID: z.string().min(1),
    sequence: z.number(),
  })
  .strict()

export const WorkLedgerConversationHandoffEvent = z
  .object({
    type: z.literal("work-ledger.conversation-handoff"),
    sourceType: z.literal("conversation.handoff"),
    projectID: z.string().min(1),
    directory: z.string().min(1),
    sessionID: z.string().min(1),
    experience: z.literal("work"),
    callerSessionID: z.string().min(1),
    callerExperience: z.enum(["chat", "work"]),
    callerMessageID: z.string().min(1),
    sequence: z.number(),
  })
  .strict()

export const WorkLedgerActionEvent = z.discriminatedUnion("type", [
  WorkLedgerChangedEvent,
  WorkLedgerMissionHandoffEvent,
  WorkLedgerConversationHandoffEvent,
])
export const WorkLedgerEvent = z.discriminatedUnion("type", [
  WorkLedgerConnectedEvent,
  WorkLedgerHeartbeatEvent,
  WorkLedgerChangedEvent,
  WorkLedgerMissionHandoffEvent,
  WorkLedgerConversationHandoffEvent,
])
export type WorkLedgerActionEvent = z.infer<typeof WorkLedgerActionEvent>
export type WorkLedgerEvent = z.infer<typeof WorkLedgerEvent>

// ── Project Worktree projection ──

export const ProjectWorktreeInfo = z
  .object({
    name: z.string(),
    branch: z.string().optional(),
    directory: z.string(),
    status: z.enum(["primary", "managed"]),
    removable: z.boolean(),
  })
  .strict()
  .meta({ ref: "ProjectWorktree" })
export const ProjectWorktreeList = ProjectWorktreeInfo.array()
export const ProjectWorktreeDeleteReceipt = z.object({ ok: z.literal(true) }).strict()

export type ProjectWorktreeInfo = z.infer<typeof ProjectWorktreeInfo>
export type ProjectWorktreeDeleteReceipt = z.infer<typeof ProjectWorktreeDeleteReceipt>

// ── Conversation message ownership ──

export interface ConversationMessageOrigin {
  role: string
  author: string
  channel: string
  source: string
}

/** Canonical sources whose non-main user-role messages are direct human input. */
export const CONVERSATION_DIRECT_HUMAN_MESSAGE_SOURCES = ["right-sidebar-conversation", "mission.operator"] as const

/** A delegated prompt is a real provider-facing user message owned by the
 * receiving non-main agent session, rather than a second human-authored turn. */
export function isDelegatedContextMessage(origin: ConversationMessageOrigin): boolean {
  return (
    origin.role === "user" &&
    origin.channel !== "main" &&
    !(CONVERSATION_DIRECT_HUMAN_MESSAGE_SOURCES as readonly string[]).includes(origin.source)
  )
}

/** Single display-ownership projection shared by the server conversation view
 * and the Overlay live/hydrated transcript. Provider role is not authorship:
 * delegated user-role prompts belong to their receiving agent channel. */
export function conversationMessageDisplayStage(origin: ConversationMessageOrigin): string {
  const role = String(origin.role || "").trim()
  if (!role) throw new Error("conversation message origin is missing role")
  const channel = String(origin.channel || "").trim()
  if (!channel) throw new Error("conversation message origin is missing channel")
  if (channel === "filtered") {
    throw new Error("conversation message origin cannot use the retired hidden channel")
  }
  if (role === "user" && !isDelegatedContextMessage({ ...origin, role, channel })) return "user"
  if (channel === "main") return "user"
  return channel
}

// ── Attachment resource variants ──

export const SCREENSHOT_BROWSER_THUMBNAIL_VARIANT = "screenshot-browser-thumbnail" as const

// ── Conversation message part projection ──

export const CONVERSATION_DISPLAY_MESSAGE_PART_TYPES = [
  "text",
  "part-error",
  "reasoning",
  "tool",
  "patch",
  "file",
  "interactive-artifact",
  "interaction-question",
  "interaction-permission",
  "subtask",
] as const

export const CONVERSATION_SEPARATOR_MESSAGE_PART_TYPES = ["boundary"] as const

export type ConversationDisplayMessagePartType = (typeof CONVERSATION_DISPLAY_MESSAGE_PART_TYPES)[number]
export type ConversationSeparatorMessagePartType = (typeof CONVERSATION_SEPARATOR_MESSAGE_PART_TYPES)[number]

/** Maximum number of real persisted part facts carried by one child-session
 * progress card. This is deliberately smaller than a transcript: exact
 * session history remains owned by the session conversation route. */
export const CONVERSATION_AGENT_ACTIVITY_LIMIT = 24 as const

interface ConversationAgentActivityBase {
  id: string
  orderKey: string
}

export type ConversationAgentActivityItem =
  | (ConversationAgentActivityBase & {
      type: "text"
      text: string
    })
  | (ConversationAgentActivityBase & {
      type: "tool"
      tool: string
      callID?: string
      state: Record<string, unknown>
    })
  | (ConversationAgentActivityBase & {
      type: "patch"
      files: unknown[]
    })
  | (ConversationAgentActivityBase & {
      type: "file"
      filename: string
    })
  | (ConversationAgentActivityBase & {
      type: "part-error"
      title?: string
      message: string
    })

function compactConversationAgentActivityText(value: unknown, limit: number): string {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
  if (text.length <= limit) return text
  return `${text.slice(0, Math.max(0, limit - 3)).trim()}...`
}

function boundedConversationAgentActivityValue(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return compactConversationAgentActivityText(value, 360)
  if (typeof value === "number" || typeof value === "boolean" || value == null) return value
  if (depth >= 3) {
    if (Array.isArray(value)) return `[${value.length} nested items]`
    if (typeof value === "object") return "{nested value}"
    return compactConversationAgentActivityText(value, 160)
  }
  if (Array.isArray(value)) {
    return value.slice(0, 8).map((item) => boundedConversationAgentActivityValue(item, depth + 1))
  }
  if (typeof value !== "object") return compactConversationAgentActivityText(value, 160)
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(value as Record<string, unknown>)
    .sort()
    .slice(0, 12)) {
    result[key] = boundedConversationAgentActivityValue((value as Record<string, unknown>)[key], depth + 1)
  }
  return result
}

/** Project one visible persisted part into the compact child-progress
 * contract. Transcript-only parts (reasoning, interactions, boundaries, and
 * control markers) intentionally return null. */
export function projectConversationAgentActivityPart(value: unknown): ConversationAgentActivityItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const part = value as Record<string, unknown>
  const id = typeof part.id === "string" ? part.id.trim() : ""
  const orderKey = typeof part.orderKey === "string" ? part.orderKey.trim() : ""
  if (!id || !orderKey) return null
  if (part.type === "text") {
    const text = compactConversationAgentActivityText(part.text, 360)
    return text ? { id, orderKey, type: "text", text } : null
  }
  if (part.type === "tool") {
    const tool = compactConversationAgentActivityText(part.tool, 120)
    if (!tool) return null
    const state =
      part.state && typeof part.state === "object" && !Array.isArray(part.state)
        ? (boundedConversationAgentActivityValue(part.state) as Record<string, unknown>)
        : {}
    const callID = compactConversationAgentActivityText(part.callID, 120)
    return {
      id,
      orderKey,
      type: "tool",
      tool,
      ...(callID ? { callID } : {}),
      state,
    }
  }
  if (part.type === "patch") {
    const files = Array.isArray(part.files) ? (boundedConversationAgentActivityValue(part.files) as unknown[]) : []
    return files.length > 0 ? { id, orderKey, type: "patch", files } : null
  }
  if (part.type === "file") {
    const filename = compactConversationAgentActivityText(part.filename ?? part.name ?? part.url, 180)
    return filename ? { id, orderKey, type: "file", filename } : null
  }
  if (part.type === "part-error") {
    const title = compactConversationAgentActivityText(part.title, 160)
    const message = compactConversationAgentActivityText(part.message ?? part.title, 360)
    return message
      ? {
          id,
          orderKey,
          type: "part-error",
          ...(title ? { title } : {}),
          message,
        }
      : null
  }
  return null
}

export interface ConversationInteractiveArtifactMessagePart {
  type: "interactive-artifact"
  artifactID: string
}

export function parseConversationInteractiveArtifactMessagePart(
  value: unknown,
): ConversationInteractiveArtifactMessagePart {
  if (!value || typeof value !== "object") throw new Error("conversation interactive artifact part must be an object")
  const part = value as Record<string, unknown>
  if (part.type !== "interactive-artifact") {
    throw new Error("conversation interactive artifact part type must be interactive-artifact")
  }
  const artifactID = typeof part.artifactID === "string" ? part.artifactID.trim() : ""
  if (!artifactID) throw new Error("conversation interactive artifact part artifactID is required")
  for (const forbidden of ["url", "html", "payload", "renderer", "sandboxPermissions"]) {
    if (forbidden in part) {
      throw new Error(`conversation interactive artifact part must not contain ${forbidden}`)
    }
  }
  return {
    type: "interactive-artifact",
    artifactID,
  }
}

export function isConversationDisplayMessagePartType(type: string): type is ConversationDisplayMessagePartType {
  return (CONVERSATION_DISPLAY_MESSAGE_PART_TYPES as readonly string[]).includes(type)
}

export function isConversationRenderableMessagePartType(
  type: string,
): type is ConversationDisplayMessagePartType | ConversationSeparatorMessagePartType {
  return (
    isConversationDisplayMessagePartType(type) ||
    (CONVERSATION_SEPARATOR_MESSAGE_PART_TYPES as readonly string[]).includes(type)
  )
}

// ── Server route directory policy ──

/**
 * Routes listed here are served before the project-directory middleware
 * or are intentionally global. They must not receive `?directory=`.
 */
export const PROJECT_DIRECTORY_BYPASS_PATHS = [
  "/doc",
  "/shutdown",
  "/restart",
  "/log",
  "/favicon.ico",
  "/global/tasks",
  "/mission",
  "/mailbox",
  "/work-ledger",
  "/task/events",
] as const

export const PROJECT_DIRECTORY_BYPASS_PREFIXES = [
  "/global/",
  "/auth/",
  "/ui/",
  "/log/",
  "/attachment/",
  "/mailbox/",
  "/work-ledger/",
] as const
export const REQUEST_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const
export type RequestMethod = (typeof REQUEST_METHODS)[number]

const TASK_ROUTE_ID_SEGMENT = "(?!events(?:/|$))[^/]+"
const TASK_RECORD_READ_ROUTE = new RegExp(
  `^/task/${TASK_ROUTE_ID_SEGMENT}(?:/(?:status|bindings|progress|events|brief|board|transcript|operator-model-context|interactions|conversation(?:/(?:history|events|session/${TASK_ROUTE_ID_SEGMENT}))?))?$`,
)
const TASK_ROOT_RECORD_ROUTE = new RegExp(`^/task/${TASK_ROUTE_ID_SEGMENT}$`)
const CHANNEL_ATTACHMENT_PUBLIC_ROUTE = /^\/channel\/attachment\/[^/]+$/

export function normalizedServerRoutePath(routePath: string): string {
  const withoutQuery = String(routePath || "").split("?", 1)[0] || "/"
  const withSlash = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`
  return withSlash.replace(/\/+$/, "") || "/"
}

function normalizedServerRouteMethod(method?: string): RequestMethod {
  const upper = String(method || "GET").toUpperCase()
  return (REQUEST_METHODS as readonly string[]).includes(upper) ? (upper as RequestMethod) : "GET"
}

export function routeRequiresProjectDirectory(routePath: string, method?: string): boolean {
  const pathOnly = normalizedServerRoutePath(routePath)
  const routeMethod = normalizedServerRouteMethod(method)
  if ((PROJECT_DIRECTORY_BYPASS_PATHS as readonly string[]).includes(pathOnly)) return false
  if (pathOnly === "/global" || pathOnly === "/auth" || pathOnly === "/ui") return false
  if (routeMethod === "GET" && TASK_RECORD_READ_ROUTE.test(pathOnly)) return false
  if (routeMethod === "DELETE" && TASK_ROOT_RECORD_ROUTE.test(pathOnly)) return false
  if (routeMethod === "GET" && CHANNEL_ATTACHMENT_PUBLIC_ROUTE.test(pathOnly)) return false
  return !(PROJECT_DIRECTORY_BYPASS_PREFIXES as readonly string[]).some((prefix) => pathOnly.startsWith(prefix))
}

// ── Host native commands ──

export const PROJECT_EDITOR_IDS = ["vscode", "pycharm", "webstorm", "intellij", "cursor"] as const

export type ProjectEditorID = (typeof PROJECT_EDITOR_IDS)[number]

export const OVERLAY_THEME_IDS = ["dark", "light", "system", "vscode-dark"] as const

export type OverlayThemeID = (typeof OVERLAY_THEME_IDS)[number]

export const OVERLAY_SETTINGS_STORAGE_KEY = "oc_settings"

export const WORK_LEDGER_ORGANIZATIONS = ["by-project", "one-list"] as const
export type WorkLedgerOrganization = (typeof WORK_LEDGER_ORGANIZATIONS)[number]

export const WORK_LEDGER_SORTS = ["priority", "updated", "manual"] as const
export type WorkLedgerSort = (typeof WORK_LEDGER_SORTS)[number]

export interface OverlayPersistedSettings {
  serverUrl: string
  autoServer: boolean
  password: string
  username: string
  projectEditor: ProjectEditorID
  initGit: boolean
  sidebarCollapsed: boolean
  sidebarWidth?: number
  rightDockWidth?: number
  workLedgerOrganization: WorkLedgerOrganization
  workLedgerSort: WorkLedgerSort
  zoom: number
  theme: OverlayThemeID
  locale: string
  directory?: string
  preferredProjectEditor: ProjectEditorID
  workspaceTaskID?: string
  workspaceDirectory?: string
  desktopNotifications: boolean
}

export type HostPermission = "granted" | "denied" | "default" | "unsupported"

/** Composer attachment cardinality is one shared client/server data contract. */
export const COMPOSER_FILE_ATTACHMENT_LIMIT = 10
export const COMPOSER_FOLDER_ATTACHMENT_LIMIT = 3
export const DIRECTORY_REFERENCE_MIME = "application/vnd.opencorvus.directory-reference+json"

export interface BrowserPreviewNativeBounds {
  x: number
  y: number
  width: number
  height: number
}

export const BROWSER_PREVIEW_NATIVE_NAVIGATION_ACTIONS = ["back", "forward", "reload"] as const
export type BrowserPreviewNativeNavigationAction = (typeof BROWSER_PREVIEW_NATIVE_NAVIGATION_ACTIONS)[number]

export interface BrowserPreviewNativeSelection {
  x: number
  y: number
  width: number
  height: number
  label: string
  tagName?: string
  selector?: string
  jsPath?: string
  domPath?: string
  textPreview?: string
  role?: string
  accessibleName?: string
  pageUrl?: string
  pageTitle?: string
  sourceHint?: string
  computedColor?: string
  computedFont?: string
  anchorX?: number
  anchorY?: number
  capturedAt?: number
}

/**
 * Localized labels passed into the injected guest comment panel so its DOM
 * overlay renders in the overlay's active language.
 */
export interface BrowserPreviewNativeSelectionLabels {
  page: string
  target: string
  source: string
  color: string
  font: string
  placeholder: string
  cancel: string
  send: string
  label: string
  annotate: string
  contextHint: string
}

/**
 * Resolved semantic colors copied from the active Overlay client into the
 * injected Browser annotation runtime. The guest WebView cannot inherit CSS
 * custom properties from its parent document, so this is the single palette
 * bridge rather than a second theme definition.
 */
export interface BrowserPreviewNativeSelectionPalette {
  surface: string
  surfaceInset: string
  surfaceHover: string
  text: string
  textMuted: string
  border: string
  accent: string
  accentDim: string
  accentRing: string
  shadow: string
}

export interface BrowserPreviewNativeSelectionPresentation {
  labels: BrowserPreviewNativeSelectionLabels
  palette: BrowserPreviewNativeSelectionPalette
}

/**
 * Discriminated result returned by `browserPreview.selection.take`.
 * - `kind: "waiting"` — no selection yet, keep polling.
 * - `kind: "comment"` — user wrote a comment in the injected panel; host writes it to the composer.
 * - `kind: "canceled"` — user exited selection mode.
 */
export type BrowserPreviewNativeSelectionResult =
  | { kind: "waiting" }
  | { kind: "comment"; selection: BrowserPreviewNativeSelection; comment: string }
  | { kind: "canceled" }

export interface BrowserPreviewNativePage {
  url: string
  title: string
  annotationRequested: boolean
  interactionReady: boolean
}

export type NativeCommand =
  | { kind: "open-url"; url: string }
  | { kind: "open-path"; path: string }
  | {
      kind: "browserPreview.sync"
      surfaceID: string
      scopeKey: string
      mountUrl: string
      bounds: BrowserPreviewNativeBounds
    }
  | {
      kind: "browserPreview.navigate"
      surfaceID: string
      scopeKey: string
      action: BrowserPreviewNativeNavigationAction
    }
  | { kind: "browserPreview.navigateUrl"; surfaceID: string; scopeKey: string; url: string }
  | { kind: "browserPreview.close"; surfaceID: string; scopeKey: string }
  | { kind: "browserPreview.destroy"; surfaceID: string }
  | {
      kind: "browserPreview.selection.setEnabled"
      surfaceID: string
      scopeKey: string
      enabled: true
      presentation: BrowserPreviewNativeSelectionPresentation
    }
  | {
      kind: "browserPreview.selection.setEnabled"
      surfaceID: string
      scopeKey: string
      enabled: false
      presentation?: BrowserPreviewNativeSelectionPresentation
    }
  | { kind: "browserPreview.selection.take"; surfaceID: string; scopeKey: string }
  | { kind: "browserPreview.currentPage"; surfaceID: string; scopeKey: string }
  | { kind: "browserPreview.setZoom"; surfaceID: string; scopeKey: string; factor: number }
  | { kind: "settings.load" }
  | { kind: "settings.save"; payload: OverlayPersistedSettings }
  | { kind: "config.write-file"; path: string; content: string }
  | { kind: "server.info" }
  | { kind: "server.restart" }
  | { kind: "devtools.toggle" }
  | { kind: "desktopUpdate.check" }
  | { kind: "desktopUpdate.download"; expectedVersion: string }
  | { kind: "desktopUpdate.install"; expectedVersion: string }
  | { kind: "window.quit" }
  | { kind: "badge.set"; count: number }
  | { kind: "workspace.pickDir"; start?: string }
  | { kind: "workspace.pickFiles"; start?: string; multiple?: boolean }
  | { kind: "workspace.openProjectEditor"; editor: ProjectEditorID; path: string }
  | { kind: "notification.permission" }
  | { kind: "notification.requestPermission" }
  | { kind: "notification.send"; title: string; body?: string; tag?: string }

export type NativeCommandKind = NativeCommand["kind"]

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isHttpBrowserPreviewUrl(value: unknown): value is string {
  if (!isNonBlankString(value)) return false
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

const BROWSER_PREVIEW_NATIVE_SELECTION_LABEL_KEYS = [
  "page",
  "target",
  "source",
  "color",
  "font",
  "placeholder",
  "cancel",
  "send",
  "label",
  "annotate",
  "contextHint",
] as const

const BROWSER_PREVIEW_NATIVE_SELECTION_PALETTE_KEYS = [
  "surface",
  "surfaceInset",
  "surfaceHover",
  "text",
  "textMuted",
  "border",
  "accent",
  "accentDim",
  "accentRing",
  "shadow",
] as const

function isBrowserPreviewNativeSelectionLabels(value: unknown): value is BrowserPreviewNativeSelectionLabels {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const labels = value as Record<string, unknown>
  const keys = Object.keys(labels)
  return (
    keys.length === BROWSER_PREVIEW_NATIVE_SELECTION_LABEL_KEYS.length &&
    keys.every((key) => (BROWSER_PREVIEW_NATIVE_SELECTION_LABEL_KEYS as readonly string[]).includes(key)) &&
    BROWSER_PREVIEW_NATIVE_SELECTION_LABEL_KEYS.every((key) => isNonBlankString(labels[key]))
  )
}

function isBrowserPreviewNativeSelectionPalette(value: unknown): value is BrowserPreviewNativeSelectionPalette {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const palette = value as Record<string, unknown>
  const keys = Object.keys(palette)
  return (
    keys.length === BROWSER_PREVIEW_NATIVE_SELECTION_PALETTE_KEYS.length &&
    keys.every((key) => (BROWSER_PREVIEW_NATIVE_SELECTION_PALETTE_KEYS as readonly string[]).includes(key)) &&
    BROWSER_PREVIEW_NATIVE_SELECTION_PALETTE_KEYS.every((key) => isNonBlankString(palette[key]))
  )
}

function isBrowserPreviewNativeSelectionPresentation(
  value: unknown,
): value is BrowserPreviewNativeSelectionPresentation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const presentation = value as Record<string, unknown>
  const keys = Object.keys(presentation)
  return (
    keys.length === 2 &&
    keys.includes("labels") &&
    keys.includes("palette") &&
    isBrowserPreviewNativeSelectionLabels(presentation["labels"]) &&
    isBrowserPreviewNativeSelectionPalette(presentation["palette"])
  )
}

const OVERLAY_PERSISTED_SETTINGS_KEYS = [
  "serverUrl",
  "autoServer",
  "password",
  "username",
  "projectEditor",
  "initGit",
  "sidebarCollapsed",
  "sidebarWidth",
  "rightDockWidth",
  "workLedgerOrganization",
  "workLedgerSort",
  "zoom",
  "theme",
  "locale",
  "directory",
  "preferredProjectEditor",
  "workspaceTaskID",
  "workspaceDirectory",
  "desktopNotifications",
] as const

const MAXIMUM_UNSIGNED_32_BIT_INTEGER = 0xffff_ffff

function isOptionalPositiveUnsigned32BitInteger(value: unknown): boolean {
  return (
    value === undefined ||
    (typeof value === "number" && Number.isInteger(value) && value > 0 && value <= MAXIMUM_UNSIGNED_32_BIT_INTEGER)
  )
}

function isOptionalNonBlankString(value: unknown): boolean {
  return value === undefined || isNonBlankString(value)
}

export function isOverlayPersistedSettings(value: unknown): value is OverlayPersistedSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const settings = value as Record<string, unknown>
  if (Object.keys(settings).some((key) => !(OVERLAY_PERSISTED_SETTINGS_KEYS as readonly string[]).includes(key))) {
    return false
  }
  return (
    isNonBlankString(settings.serverUrl) &&
    typeof settings.autoServer === "boolean" &&
    typeof settings.password === "string" &&
    isNonBlankString(settings.username) &&
    (PROJECT_EDITOR_IDS as readonly unknown[]).includes(settings.projectEditor) &&
    typeof settings.initGit === "boolean" &&
    typeof settings.sidebarCollapsed === "boolean" &&
    isOptionalPositiveUnsigned32BitInteger(settings.sidebarWidth) &&
    isOptionalPositiveUnsigned32BitInteger(settings.rightDockWidth) &&
    (WORK_LEDGER_ORGANIZATIONS as readonly unknown[]).includes(settings.workLedgerOrganization) &&
    (WORK_LEDGER_SORTS as readonly unknown[]).includes(settings.workLedgerSort) &&
    typeof settings.zoom === "number" &&
    Number.isFinite(settings.zoom) &&
    settings.zoom >= 0.8 &&
    settings.zoom <= 1.6 &&
    (OVERLAY_THEME_IDS as readonly unknown[]).includes(settings.theme) &&
    isNonBlankString(settings.locale) &&
    isOptionalNonBlankString(settings.directory) &&
    (PROJECT_EDITOR_IDS as readonly unknown[]).includes(settings.preferredProjectEditor) &&
    isOptionalNonBlankString(settings.workspaceTaskID) &&
    isOptionalNonBlankString(settings.workspaceDirectory) &&
    typeof settings.desktopNotifications === "boolean"
  )
}

export function isNativeCommand(value: unknown): value is NativeCommand {
  if (!value || typeof value !== "object") return false
  const obj = value as Record<string, unknown>
  switch (obj["kind"]) {
    case "open-url":
      return typeof obj["url"] === "string"
    case "open-path":
      return typeof obj["path"] === "string"
    case "browserPreview.sync":
      return (
        isNonBlankString(obj["surfaceID"]) &&
        isNonBlankString(obj["scopeKey"]) &&
        isHttpBrowserPreviewUrl(obj["mountUrl"]) &&
        isBrowserPreviewNativeBounds(obj["bounds"])
      )
    case "browserPreview.navigate":
      return (
        isNonBlankString(obj["surfaceID"]) &&
        isNonBlankString(obj["scopeKey"]) &&
        (BROWSER_PREVIEW_NATIVE_NAVIGATION_ACTIONS as readonly string[]).includes(obj["action"] as string)
      )
    case "browserPreview.navigateUrl":
      return (
        isNonBlankString(obj["surfaceID"]) && isNonBlankString(obj["scopeKey"]) && isHttpBrowserPreviewUrl(obj["url"])
      )
    case "browserPreview.close":
      return isNonBlankString(obj["surfaceID"]) && isNonBlankString(obj["scopeKey"])
    case "browserPreview.destroy":
      return isNonBlankString(obj["surfaceID"])
    case "browserPreview.selection.setEnabled":
      return (
        isNonBlankString(obj["surfaceID"]) &&
        isNonBlankString(obj["scopeKey"]) &&
        ((obj["enabled"] === true && isBrowserPreviewNativeSelectionPresentation(obj["presentation"])) ||
          (obj["enabled"] === false &&
            (obj["presentation"] === undefined || isBrowserPreviewNativeSelectionPresentation(obj["presentation"]))))
      )
    case "browserPreview.selection.take":
      return isNonBlankString(obj["surfaceID"]) && isNonBlankString(obj["scopeKey"])
    case "browserPreview.currentPage":
      return isNonBlankString(obj["surfaceID"]) && isNonBlankString(obj["scopeKey"])
    case "browserPreview.setZoom":
      return (
        isNonBlankString(obj["surfaceID"]) &&
        isNonBlankString(obj["scopeKey"]) &&
        typeof obj["factor"] === "number" &&
        Number.isFinite(obj["factor"]) &&
        obj["factor"] >= 0.25 &&
        obj["factor"] <= 5
      )
    case "settings.load":
      return true
    case "settings.save":
      return isOverlayPersistedSettings(obj["payload"])
    case "config.write-file":
      return typeof obj["path"] === "string" && typeof obj["content"] === "string"
    case "server.info":
    case "server.restart":
    case "devtools.toggle":
    case "desktopUpdate.check":
    case "window.quit":
    case "notification.permission":
    case "notification.requestPermission":
      return true
    case "desktopUpdate.download":
    case "desktopUpdate.install":
      return isNonBlankString(obj["expectedVersion"])
    case "badge.set":
      return typeof obj["count"] === "number" && Number.isFinite(obj["count"]) && obj["count"] >= 0
    case "workspace.pickDir":
      return obj["start"] === undefined || typeof obj["start"] === "string"
    case "workspace.pickFiles":
      return (
        (obj["start"] === undefined || typeof obj["start"] === "string") &&
        (obj["multiple"] === undefined || typeof obj["multiple"] === "boolean")
      )
    case "workspace.openProjectEditor":
      return (
        (PROJECT_EDITOR_IDS as readonly string[]).includes(obj["editor"] as string) && typeof obj["path"] === "string"
      )
    case "notification.send":
      return (
        typeof obj["title"] === "string" &&
        (obj["body"] === undefined || typeof obj["body"] === "string") &&
        (obj["tag"] === undefined || typeof obj["tag"] === "string")
      )
    default:
      return false
  }
}

function isBrowserPreviewNativeBounds(value: unknown): value is BrowserPreviewNativeBounds {
  if (!value || typeof value !== "object") return false
  const obj = value as Record<string, unknown>
  return (
    finiteNumber(obj["x"]) &&
    finiteNumber(obj["y"]) &&
    finiteNumber(obj["width"]) &&
    finiteNumber(obj["height"]) &&
    (obj["width"] as number) > 0 &&
    (obj["height"] as number) > 0
  )
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

// ── Body encoding helpers (Buffer-free; works in both webview + node) ──

/**
 * Browser-safe base64 encoder for binary payloads. Both the webview and
 * the extension host run on engines (V8 / Chromium) that ship Uint8Array
 * + btoa/atob. We avoid Buffer here so the same module loads cleanly in
 * both runtimes — no node-specific shim.
 */
export function uint8ToBase64(bytes: Uint8Array): string {
  // 8 KiB chunks: V8/Safari/Bun all accept this without "too many
  // arguments to function" (which fired around 65 535 in older
  // engines, 32 768 in some Safari builds — audit-2026-04-29
  // transport F4).
  let bin = ""
  const CHUNK = 0x2000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const sub = bytes.subarray(i, i + CHUNK)
    bin += String.fromCharCode(...sub)
  }
  // btoa is available in webview and in Node 16+.
  return btoa(bin)
}

/**
 * Decode a base64 string. Wraps the engine's `atob` so a
 * malformed payload surfaces a typed `Error` instead of a
 * platform-specific `InvalidCharacterError` that the consumer's
 * try/catch may not recognise (audit-2026-04-29 transport F4).
 */
export function base64ToUint8(b64: string): Uint8Array {
  let bin: string
  try {
    bin = atob(b64)
  } catch (err) {
    throw new Error(`base64ToUint8: invalid base64 payload (${err instanceof Error ? err.message : String(err)})`)
  }
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
