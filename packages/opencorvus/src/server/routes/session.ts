import { Hono } from "hono"
import { streamGlobalSSE } from "../sse"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod"
import { Session } from "../../session"
import { SessionStatus } from "@/session"
import { publishSessionStatus } from "@/session/status-publication"
import { SessionInitializer } from "@/session/initialize"
import {
  conversationMessageHasDisplay,
  conversationTranscriptMessageOrder,
  executionProjectionLifecycleEvents,
  projectConversationAgentView,
  projectConversationView,
} from "@/conversation/view"
import { projectMissionTurnArtifacts } from "@/conversation/turn-artifacts"
import { Config } from "@/config/config"
import { EffectiveConfig } from "@/config/effective"
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { validateConfigModelReferences } from "@/config/model-reference-validation"
import { NativeAgentRegistryLifecycle } from "@/agent/native-agent-registry-lifecycle"
import { PromptProfile } from "@/agent/prompt-profile"
import { Provider } from "@/provider/provider"
import { SessionPrompt } from "../../session/prompt"
import { Instance } from "@/project/instance"
import { provideInitializedProjectExecution } from "@/project/independent-project-owner"
import { clearRewindCursorForSession } from "@/engine/rewind"
import { CompactionHandoff } from "@/session/compaction-handoff"
import { SessionCompaction } from "@/session/compaction"
import { SessionSummary } from "@/session/summary"
import { Message } from "../../session/message"
import { MessageStore } from "../../session/message-store"
import { Todo } from "../../session/todo"
import { TodoStore } from "../../session/todo-store"
import { EngineService } from "@/task-api"
import { Snapshot } from "@/snapshot"
import { Log } from "../../util/log"
import { AuthReadUnavailableResponse, badRequestBody, errors, namedErrorResponse } from "../error"
import { requestID as resolveRequestID } from "../error-handler"
import { createExecutionCancellationOrigin } from "@/session/prompt/cancellation"
import { ProjectMemory } from "@/memory/project-memory"
import { NotFoundError } from "../../storage/db"
import { lazy } from "../../util/lazy"
import { ProtocolStore } from "@/protocol/store"
import {
  enrichStandaloneSessionTranscript,
  mapSessionBusEvent,
  pendingPermissionSessionEvent,
} from "@/protocol/session-mirror"
import { PermissionAuthority } from "@/permission/authority"
import { listConversationAgentSessionsForSessionTree, taskExecutionProjectionForTask } from "@/orchestrator/task-event"
import { BusEvent } from "@/bus/bus-event"
import {
  ConversationTurnArtifactSummary,
  SessionConversationHistoryPage,
  SessionConversationHydration,
  SessionEvent,
} from "@/engine/model"
import {
  applyRightSidebarConversationPromptOverlay,
  isRightSidebarConversationSession,
  rightSidebarConversationExperience,
  rightSidebarConversationSelectedTaskID,
} from "@/chat/session"
import { awaitSessionPromptFinishedInScope, cancelSessionPromptInScope } from "@/engine/cancellation-scope"
import { requireTimelineOrderKeyDomain, timelineOrderKey } from "@/timeline/order"
import { resolveSessionMessageIdentity } from "@/session/message-identity"
import { resolveSessionActivityStatus, resolveSessionLifecycleSnapshot } from "@/session/lifecycle"
import { assertActiveProjectSession, getActiveProjectSession } from "../active-project-session"
import { PersistedProjectContext } from "@/server/persisted-project-context"
import { applyMissionControlPromptOverlay } from "@/mission/session"
import { Question } from "@/question"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { HttpQueryBoolean, HttpQueryLimit } from "../query-schema"
import { visibleComposerReferences } from "@opencorvus-ai/transport-protocol"
import { NamedError } from "@opencorvus-ai/util/error"
import { createHash } from "node:crypto"
import { Identifier } from "@/id/id"
import { SessionContext } from "@/session/context"
import { projectPersistedSessionMessage } from "@/orchestrator/protocol/message-bridge"
import {
  CONVERSATION_HISTORY_PAGE_LIMIT,
  CONVERSATION_TAIL_MESSAGE_LIMIT,
  ConversationHistoryQuery,
  ConversationHydrationQuery,
  conversationHistoryWindow,
} from "@/conversation/history-window"

const log = Log.create({ service: "server" })

export function latestSummarizableUser(messages: Message.WithParts[]): Message.User | undefined {
  return messages.findLast(
    (message): message is Message.WithParts & { info: Message.User } => message.info.role === "user",
  )?.info
}

export function conversationLaunchReferences(messages: readonly Message.WithParts[]) {
  const firstUserMessage = messages.find((message) => message.info.role === "user")
  const text = firstUserMessage
    ? firstUserMessage.parts
        .flatMap((part) => {
          if (part.type !== "text") return []
          if (part.source !== undefined && part.source !== "user") return []
          return [part.text]
        })
        .join("\n")
    : ""
  return visibleComposerReferences(text)
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

const PublicSessionPromptInput = SessionPrompt.PromptInput.omit({
  sessionID: true,
  author: true,
  noReply: true,
  tools: true,
  includeMcpTools: true,
  extra: true,
  byteMaterializationProjectID: true,
})
type SessionPromptRouteBody = z.infer<typeof PublicSessionPromptInput>

const PublicSessionPromptIdentity = z
  .object({
    version: z.literal(1),
    fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict()

const PublicSessionPromptIdentityConflictError = NamedError.create(
  "PublicSessionPromptIdentityConflictError",
  z.object({
    sessionID: z.string(),
    messageID: z.string(),
    message: z.string(),
  }),
)

const publicSessionPromptOperations = new Map<string, { fingerprint: string; operation: Promise<Message.WithParts> }>()

function publicSessionPromptFingerprint(prompt: SessionPromptRouteBody): string {
  return createHash("sha256").update(JSON.stringify(prompt)).digest("hex")
}

async function completedAssistantReplyForUserMessage(
  sessionID: string,
  messageID: string,
): Promise<Message.WithParts | undefined> {
  for await (const candidate of MessageStore.stream(sessionID)) {
    if (
      candidate.info.role === "assistant" &&
      candidate.info.parentID === messageID &&
      candidate.info.time.completed !== undefined &&
      Boolean(candidate.info.finish) &&
      candidate.info.finish !== "error" &&
      candidate.info.finish !== "tool-calls" &&
      candidate.info.error === undefined &&
      candidate.info.summary !== true
    ) {
      return candidate
    }
  }
}

async function executePublicSessionPrompt(
  sessionID: string,
  prompt: SessionPrompt.PromptInput,
): Promise<Message.WithParts> {
  if (!prompt.messageID) {
    throw new Error(`Public Session prompt for ${sessionID} is missing its Host-minted input Message identity`)
  }
  const expectedIdentity = PublicSessionPromptIdentity.parse(prompt.extra?.publicSessionPromptIdentity)
  const operationKey = `${sessionID}\0${prompt.messageID}`
  const active = publicSessionPromptOperations.get(operationKey)
  if (active) {
    if (active.fingerprint !== expectedIdentity.fingerprint) {
      throw new PublicSessionPromptIdentityConflictError({
        sessionID,
        messageID: prompt.messageID,
        message: `Message ${prompt.messageID} is already bound to a different public Session prompt`,
      })
    }
    return active.operation
  }
  const operation = executePublicSessionPromptOperation(
    sessionID,
    { ...prompt, messageID: prompt.messageID },
    expectedIdentity,
  )
  publicSessionPromptOperations.set(operationKey, {
    fingerprint: expectedIdentity.fingerprint,
    operation,
  })
  try {
    return await operation
  } finally {
    if (publicSessionPromptOperations.get(operationKey)?.operation === operation) {
      publicSessionPromptOperations.delete(operationKey)
    }
  }
}

async function executePublicSessionPromptOperation(
  sessionID: string,
  prompt: SessionPrompt.PromptInput & { messageID: string },
  expectedIdentity: z.infer<typeof PublicSessionPromptIdentity>,
): Promise<Message.WithParts> {
  const existing = await MessageStore.get({ sessionID, messageID: prompt.messageID }).catch((error) => {
    if (NotFoundError.isInstance(error as Error)) return undefined
    throw error
  })
  if (!existing) return SessionPrompt.prompt(prompt)
  if (existing.info.role !== "user") {
    throw new PublicSessionPromptIdentityConflictError({
      sessionID,
      messageID: prompt.messageID,
      message: `Message ${prompt.messageID} is already bound to a non-user Session message`,
    })
  }
  const persistedIdentity = PublicSessionPromptIdentity.safeParse(existing.info.extra?.publicSessionPromptIdentity)
  if (!persistedIdentity.success || persistedIdentity.data.fingerprint !== expectedIdentity.fingerprint) {
    throw new PublicSessionPromptIdentityConflictError({
      sessionID,
      messageID: prompt.messageID,
      message: `Message ${prompt.messageID} is already bound to a different public Session prompt`,
    })
  }
  const completed = await completedAssistantReplyForUserMessage(sessionID, prompt.messageID)
  if (completed) return completed
  const session = await Session.get(sessionID)
  return SessionContext.provide(session, () =>
    provideInitializedProjectExecution({
      directory: session.directory,
      fn: () =>
        SessionPrompt.loop({
          sessionID,
          reply_to_message_id: prompt.messageID,
          retry_failed_reply: true,
        }),
    }),
  )
}

function projectedWorkerPublicPromptRejection(sessionID: string): string | undefined {
  const workerTurn = WorkerTurnDescriptor.latestForSession(sessionID)
  if (!workerTurn) return
  return (
    `Session ${sessionID} is a projected worker for task ${workerTurn.payload.lifecycle.taskID}. ` +
    "Use the task-scoped operator-steer route so guidance remains durable across process restart."
  )
}

async function validatedRightSidebarConversationTaskID(session: Session.Info): Promise<string | undefined> {
  const taskID = rightSidebarConversationSelectedTaskID(session)
  if (!taskID) return undefined
  const task = await EngineService.getTask(taskID)
  if (task.projectID !== session.projectID || task.directory !== session.directory) {
    throw new NotFoundError({ message: `Task not found: ${taskID}` })
  }
  return taskID
}

async function preparePublicSessionPrompt(sessionID: string, prompt: SessionPromptRouteBody) {
  const session = await getActiveProjectSession(sessionID)
  const rejection = projectedWorkerPublicPromptRejection(sessionID)
  if (rejection) {
    return {
      ok: false as const,
      message: rejection,
    }
  }
  if (prompt.agent === "control") {
    return {
      ok: false as const,
      message: "Control Agent messages are accepted only through the typed Control ingress.",
    }
  }
  const runtimeContract = SessionPrompt.getSessionRuntimeContract(sessionID)
  const identifiedPrompt = {
    ...prompt,
    messageID: prompt.messageID ?? Identifier.ascending("message"),
  }
  const publicSessionPromptIdentity = {
    version: 1 as const,
    fingerprint: publicSessionPromptFingerprint(identifiedPrompt),
  }
  const authoredPrompt: Omit<SessionPrompt.PromptInput, "sessionID"> = {
    ...identifiedPrompt,
    author: "user",
    extra: {
      ...ProjectMemory.userInputExtra({
        surface: "session.prompt",
        literalText: prompt.parts
          .filter((part): part is Extract<(typeof prompt.parts)[number], { type: "text" }> => part.type === "text")
          .map((part) => part.text)
          .join("\n\n"),
      }),
      publicSessionPromptIdentity,
    },
  }
  const overlaidPrompt =
    session.kind === "mission"
      ? applyMissionControlPromptOverlay(authoredPrompt)
      : isRightSidebarConversationSession(session)
        ? applyRightSidebarConversationPromptOverlay(authoredPrompt, {
            experience: rightSidebarConversationExperience(session)!,
            taskID: await validatedRightSidebarConversationTaskID(session),
          })
        : authoredPrompt
  const identity = await resolveSessionMessageIdentity({
    session,
    requestedAgentID:
      runtimeContract?.identity.agentID ?? (session.kind === "assistant" ? overlaidPrompt.agent : undefined),
    config: await EffectiveConfig.effective({ sessionID }),
  })
  return {
    ok: true as const,
    prompt: { ...overlaidPrompt, agent: identity.agentID },
  }
}

export function protocolSessionEvent(event: ReturnType<typeof ProtocolStore.listTaskEventsAfter>[number]) {
  const timestamp = event.time.emitted
  if (!(typeof timestamp === "number" && timestamp > 0)) {
    throw new Error(`protocolSessionEvent: event ${event.id} missing time.emitted (schema-invariant violated)`)
  }
  const notify = BusEvent.resolveNotify(event.type, event.payload ?? {})
  const payload = event.payload || {}
  const orderKey = typeof event.orderKey === "string" && event.orderKey.length > 0 ? event.orderKey : undefined
  if (!orderKey) {
    throw new Error(`protocolSessionEvent: event ${event.id} (${event.type}) missing orderKey`)
  }
  const payloadOrderKey =
    typeof payload.orderKey === "string"
      ? payload.orderKey
      : event.type.startsWith("message.") && payload.info && typeof payload.info === "object"
        ? (payload.info as Record<string, unknown>).orderKey
        : undefined
  if (typeof payloadOrderKey === "string" && payloadOrderKey.length > 0 && payloadOrderKey !== orderKey) {
    throw new Error(
      `protocolSessionEvent: event ${event.id} (${event.type}) orderKey drift between envelope and payload`,
    )
  }
  if (event.type === "agent.execution.lifecycle" || event.type === "session.error") {
    requireTimelineOrderKeyDomain(
      orderKey,
      `protocolSessionEvent: event ${event.id} (${event.type}) envelope`,
      "session",
    )
    requireTimelineOrderKeyDomain(
      payloadOrderKey,
      `protocolSessionEvent: event ${event.id} (${event.type}) payload`,
      "session",
    )
  }
  return {
    event_id: event.id,
    session_id: event.sessionID,
    orderKey,
    type: event.type.replace("engine.", ""),
    emittedAt: timestamp,
    timestamp,
    sequence: event.sequence,
    summary: event.summary,
    payload,
    ...(notify ? { notify } : {}),
  }
}

function pendingQuestionSessionEvent(request: Question.Request): z.output<typeof SessionEvent> {
  const orderKey = timelineOrderKey({
    domain: "interaction",
    time: request.timeCreated,
    id: request.id,
  })
  const mapped = mapSessionBusEvent(
    {
      type: Question.Event.Asked.type,
      properties: request,
    },
    { sessionID: request.sessionID },
  )
  if (!mapped?.summary || !mapped.payload) {
    throw new Error(`pendingQuestionSessionEvent: failed to map pending question ${request.id}`)
  }
  return {
    event_id: `pending-question-${request.id}`,
    session_id: request.sessionID,
    orderKey,
    type: mapped.type,
    emittedAt: request.timeCreated,
    timestamp: request.timeCreated,
    sequence: 0,
    summary: mapped.summary,
    payload: mapped.payload,
  }
}

function pendingPermissionProtocolSessionEvent(request: PermissionAuthority.Request): z.output<typeof SessionEvent> {
  const orderKey = timelineOrderKey({
    domain: "interaction",
    time: request.timeCreated,
    id: request.id,
  })
  const mapped = pendingPermissionSessionEvent(request)
  return {
    event_id: `pending-permission-${request.id}`,
    session_id: request.sessionID,
    orderKey,
    type: mapped.type,
    emittedAt: request.timeCreated,
    timestamp: request.timeCreated,
    sequence: 0,
    summary: mapped.summary!,
    payload: { ...mapped.payload!, orderKey },
  }
}

const SessionConfigResponse = z
  .object({
    config: Config.Info,
    origin: z.record(z.string(), z.unknown()).meta({
      description: "Per-key origin tree. Leaf values are 'project' or 'session'.",
    }),
  })
  .meta({ ref: "SessionConfig" })

type Origin = "project" | "session"

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function originTree(effective: unknown, overlay: unknown): unknown {
  if (!isRecord(effective)) return overlay === undefined ? ("project" as Origin) : ("session" as Origin)
  const out: Record<string, unknown> = {}
  const overlayRecord = isRecord(overlay) ? overlay : undefined
  for (const [key, value] of Object.entries(effective)) {
    if (overlayRecord && Object.hasOwn(overlayRecord, key)) {
      const override = overlayRecord[key]
      if (override === null) continue
      out[key] = isRecord(value) && isRecord(override) ? originTree(value, override) : "session"
      continue
    }
    out[key] = isRecord(value) ? originTree(value, undefined) : "project"
  }
  return out
}

/**
 * A persisted session overlay is normalized by `Session.mergeConfigOverlay`
 * (it re-parses the result of `Config.mergeOverlay`, which strips RFC 7396
 * null-deletes). A `null` therefore must NEVER appear in the STORED overlay —
 * if one does, the write path is corrupt and we fail fast (R5.1 item 7)
 * instead of serving a half-deleted config. Pinned keys are already rejected
 * by `Config.Overlay` `.strict()` at parse time (same single schema).
 */
function assertNoStoredNull(value: unknown, path = "configOverlay"): void {
  if (value === null) {
    throw new Error(
      `Stored session overlay contains a null at ${path}; the persisted overlay must be ` +
        `null-normalized. This indicates a corrupt write path (R5.1 item 7).`,
    )
  }
  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) assertNoStoredNull(child, `${path}.${key}`)
  }
}

async function sessionConfig(input: {
  sessionID: string
  projectID: string
}): Promise<z.output<typeof SessionConfigResponse>> {
  const { sessionID, projectID } = input
  const session = await Session.assertLineageInProject({ sessionID, projectID })
  // R5.1 item 2: only a root session (task root or standalone root) owns a
  // config overlay; a child session is rejected (same guard as the write path).
  Session.assertConfigurableRoot(session)
  const base = await EffectiveConfig.base({ sessionID })
  const stored = session.metadata?.configOverlay ?? {}
  // R5.1 item 7: fail fast on a null or pinned key in the STORED overlay.
  // `.strict()` rejects pinned/unknown keys; assertNoStoredNull rejects nulls.
  const overlay = Config.Overlay.parse(stored)
  assertNoStoredNull(stored)
  const config = Config.mergeOverlay(base, overlay)
  return {
    config,
    origin: originTree(config, overlay) as Record<string, unknown>,
  }
}

export const SessionRoutes = lazy(() =>
  new Hono()
    // === query: list ===
    .get(
      "/",
      describeRoute({
        summary: "List sessions",
        description: "Get a list of all OpenCorvus sessions, sorted by most recently updated.",
        operationId: "session.list",
        responses: {
          200: {
            description: "List of sessions",
            content: { "application/json": { schema: resolver(Session.Info.array()) } },
          },
        },
      }),
      validator(
        "query",
        z.object({
          directory: z.string().optional().meta({ description: "Filter sessions by project directory" }),
          roots: HttpQueryBoolean.optional().meta({ description: "Only return root sessions (no parentID)" }),
          start: z.coerce
            .number()
            .optional()
            .meta({ description: "Filter sessions updated on or after this timestamp (milliseconds since epoch)" }),
          search: z.string().optional().meta({ description: "Filter sessions by title (case-insensitive)" }),
          limit: HttpQueryLimit.optional().meta({ description: "Maximum number of sessions to return" }),
        }),
      ),
      async (c) => {
        const query = c.req.valid("query")
        const sessions: Session.Info[] = []
        for await (const session of Session.list({
          directory: query.directory,
          roots: query.roots,
          start: query.start,
          search: query.search,
          limit: query.limit,
        })) {
          sessions.push(session)
        }
        return c.json(sessions)
      },
    )
    .get(
      "/global",
      describeRoute({
        summary: "List sessions across projects",
        description:
          "List sessions across all projects with compound cursor-based pagination and optional archived inclusion. Sets x-next-cursor-updated and x-next-cursor-session-id response headers when more results are available.",
        operationId: "session.listGlobal",
        responses: {
          200: {
            description: "List of sessions across projects",
            headers: {
              "x-next-cursor-updated": {
                description: "Next page compound cursor updated timestamp when more sessions are available",
                schema: { type: "string" },
              },
              "x-next-cursor-session-id": {
                description: "Next page compound cursor session ID when more sessions are available",
                schema: { type: "string" },
              },
            },
            content: { "application/json": { schema: resolver(Session.GlobalInfo.array()) } },
          },
          ...errors(400),
        },
      }),
      validator(
        "query",
        z
          .object({
            directory: z.string().optional().meta({ description: "Filter sessions by project directory" }),
            roots: HttpQueryBoolean.optional().meta({ description: "Only return root sessions (no parentID)" }),
            start: z.coerce
              .number()
              .optional()
              .meta({ description: "Filter sessions updated on or after this timestamp (milliseconds since epoch)" }),
            cursorUpdated: z.coerce
              .number()
              .optional()
              .meta({ description: "Compound cursor updated timestamp (milliseconds since epoch)" }),
            cursorSessionID: z.string().trim().min(1).optional().meta({ description: "Compound cursor session ID" }),
            search: z.string().optional().meta({ description: "Filter sessions by title (case-insensitive)" }),
            limit: HttpQueryLimit.optional().meta({ description: "Maximum number of sessions to return" }),
            archived: HttpQueryBoolean.optional().meta({ description: "Include archived sessions (default false)" }),
          })
          .superRefine((value, ctx) => {
            const hasUpdated = value.cursorUpdated !== undefined
            const hasSessionID = value.cursorSessionID !== undefined
            if (hasUpdated === hasSessionID) return
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: hasUpdated ? ["cursorSessionID"] : ["cursorUpdated"],
              message: "cursorUpdated and cursorSessionID must be supplied together",
            })
          }),
      ),
      async (c) => {
        const query = c.req.valid("query")
        const limit = query.limit ?? 100
        const sessions: Session.GlobalInfo[] = []
        for await (const session of Session.listGlobal({
          directory: query.directory,
          roots: query.roots,
          start: query.start,
          cursorUpdated: query.cursorUpdated,
          cursorSessionID: query.cursorSessionID,
          search: query.search,
          limit: limit + 1,
          archived: query.archived,
        })) {
          sessions.push(session)
        }
        const hasMore = sessions.length > limit
        const list = hasMore ? sessions.slice(0, limit) : sessions
        if (hasMore && list.length > 0) {
          c.header("x-next-cursor-updated", String(list[list.length - 1].time.updated))
          c.header("x-next-cursor-session-id", list[list.length - 1].id)
        }
        return c.json(list)
      },
    )
    .get(
      "/status",
      describeRoute({
        summary: "Get session status",
        description: "Retrieve the current status of all sessions, including active, idle, and completed states.",
        operationId: "session.status",
        responses: {
          200: {
            description: "Get session status",
            content: { "application/json": { schema: resolver(z.record(z.string(), SessionStatus.Info)) } },
          },
          ...errors(400),
        },
      }),
      async (c) => {
        return c.json(SessionStatus.list())
      },
    )
    .get(
      "/:sessionID/config",
      describeRoute({
        summary: "Get session effective configuration",
        description:
          "Return project configuration with the session overlay applied, plus a per-key origin tree for project vs session values.",
        operationId: "session.config.get",
        responses: {
          200: {
            description: "Effective session configuration",
            content: { "application/json": { schema: resolver(SessionConfigResponse) } },
          },
          ...errors(400, 404),
          503: AuthReadUnavailableResponse,
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
        }),
      ),
      async (c) => {
        return c.json(
          await sessionConfig({
            sessionID: c.req.valid("param").sessionID,
            projectID: Instance.project.id,
          }),
        )
      },
    )
    .patch(
      "/:sessionID/config",
      describeRoute({
        summary: "Update session configuration overlay",
        description:
          "Merge a sparse session-scoped config overlay into session metadata. Project configuration is unchanged.",
        operationId: "session.config.update",
        responses: {
          200: {
            description: "Effective session configuration after update",
            content: { "application/json": { schema: resolver(SessionConfigResponse) } },
          },
          ...errors(400, 404),
          503: AuthReadUnavailableResponse,
          409: namedErrorResponse(
            "Task creation binding owns the root expert-squad profile",
            "TaskPromptProfileImmutableError",
            "TaskPackageRevisionBindingError",
          ),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
        }),
      ),
      validator("json", Config.Overlay),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const patch = c.req.valid("json")
        const projectID = Instance.project.id
        await Session.assertLineageInProject({ sessionID, projectID })
        const [baseConfig, currentOverlay, projectDirectory] = await Promise.all([
          EffectiveConfig.base({ sessionID }),
          EffectiveConfig.overlay({ sessionID }),
          EffectiveConfig.capabilityProjectDirectory({ sessionID }),
        ])
        const preview = Config.previewOverlayUpdate(baseConfig, currentOverlay ?? {}, patch)
        await validateConfigModelReferences(preview.effective, "configOverlay")
        try {
          await PromptProfileResolver.assertKnownProfileID({
            projectDirectory,
            profileID: PromptProfile.activeID(preview.effective),
            config: preview.effective,
          })
        } catch (error) {
          return c.json(badRequestBody(error instanceof Error ? error.message : String(error)), 400)
        }
        await Session.mergeConfigOverlayInProject({ sessionID, projectID, patch })
        await Promise.all([Provider.reset(), NativeAgentRegistryLifecycle.reset()])
        return c.json(await sessionConfig({ sessionID, projectID }))
      },
    )
    .get(
      "/:sessionID/turn-artifacts",
      describeRoute({
        summary: "Project Mission child Task artifacts onto their owning turns",
        operationId: "session.turnArtifacts",
        responses: {
          200: {
            description: "Mission artifact summaries keyed by assistant message",
            content: {
              "application/json": {
                schema: resolver(ConversationTurnArtifactSummary.array()),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const session = await getActiveProjectSession(sessionID)
        if (session.kind !== "mission") return c.json([])
        const sessionIDs = await Session.treeInProject({ sessionID, projectID: Instance.project.id })
        const messages = (await Promise.all(sessionIDs.map((id) => Session.messages({ sessionID: id }))))
          .flat()
          .sort(conversationTranscriptMessageOrder)
        const transcript = enrichStandaloneSessionTranscript(messages).filter(conversationMessageHasDisplay)
        const agentSessions = listConversationAgentSessionsForSessionTree({
          sessionID,
          projectID: Instance.project.id,
        })
        const view = projectConversationView({ transcript, ledgerSessions: agentSessions })
        return c.json(await projectMissionTurnArtifacts({ transcript, view }))
      },
    )
    .get(
      "/:sessionID/conversation",
      describeRoute({
        summary: "Hydrate session conversation state",
        description:
          "Load the persisted conversation inputs needed to rebuild the overlay conversation tree for a supervisor session before SSE resumes.",
        operationId: "session.conversation",
        responses: {
          200: {
            description: "Session conversation hydrate payload",
            content: {
              "application/json": {
                schema: resolver(SessionConversationHydration),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
        }),
      ),
      validator("query", ConversationHydrationQuery),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const query = c.req.valid("query")
        const session = await getActiveProjectSession(sessionID)
        const sessionIDs = await Session.treeInProject({ sessionID, projectID: Instance.project.id })
        const tailLimit = query.tail_limit ?? CONVERSATION_TAIL_MESSAGE_LIMIT
        const latestMessages = await MessageStore.latestAcrossSessions({ sessionIDs, limit: tailLimit + 1 })
        const truncated = latestMessages.length > tailLimit
        const visibleMessages = truncated ? latestMessages.slice(latestMessages.length - tailLimit) : latestMessages
        const transcript = enrichStandaloneSessionTranscript(visibleMessages)
          .filter(conversationMessageHasDisplay)
          .sort(conversationTranscriptMessageOrder)
        const historyWindow = conversationHistoryWindow(transcript, { tailLimit })
        const history = { ...historyWindow.history, hasMore: truncated || historyWindow.history.hasMore }
        const rootMessages = await MessageStore.earliestInSession({ sessionID, limit: 20 })
        const sessionIDSet = new Set(sessionIDs)
        const pendingQuestions = (await Question.list())
          .filter((request) => sessionIDSet.has(request.sessionID))
          .map((request) => ({
            ...request,
            orderKey: timelineOrderKey({
              domain: "interaction",
              time: request.timeCreated,
              id: request.id,
            }),
          }))
        const board = {
          kind: "session" as const,
          sessionID,
          status: session.time.archived ? "archived" : resolveSessionActivityStatus(sessionID),
          composerReferences: conversationLaunchReferences(rootMessages),
          title: session.title ?? null,
          directory: session.directory ?? null,
          changes: await SessionSummary.diff({ sessionID }),
          ...(isRightSidebarConversationSession(session)
            ? {
                selectedTaskID: (await validatedRightSidebarConversationTaskID(session)) ?? null,
                experience: rightSidebarConversationExperience(session),
              }
            : {}),
        }
        const agentSessions = listConversationAgentSessionsForSessionTree({
          sessionID: session.id,
          projectID: Instance.project.id,
        })
        const rootLifecycle = resolveSessionLifecycleSnapshot(sessionID)
        const hydratedAgentSessions = agentSessions.map((entry) =>
          entry.sessionID === sessionID
            ? {
                ...entry,
                latestStatus: rootLifecycle.status,
                latestStatusEmittedAt: rootLifecycle.observedAt,
              }
            : entry,
        )
        const view = projectConversationView({
          transcript: historyWindow.transcript,
          ledgerSessions: hydratedAgentSessions,
        })
        const turnArtifacts =
          session.kind === "mission"
            ? await projectMissionTurnArtifacts({
                transcript: historyWindow.transcript,
                view,
              })
            : []
        const executionProjection =
          "selectedTaskID" in board && typeof board.selectedTaskID === "string"
            ? taskExecutionProjectionForTask(board.selectedTaskID)
            : undefined
        const agentView = projectConversationAgentView(
          historyWindow.transcript,
          executionProjection ? executionProjectionLifecycleEvents(executionProjection) : [],
          hydratedAgentSessions,
          new Map(),
          TodoStore.getBySessionIDs(hydratedAgentSessions.map((entry) => entry.sessionID)),
          executionProjection?.occurrences ?? [],
        )
        return c.json({
          board,
          pendingQuestions,
          transcript: historyWindow.transcript,
          events: [],
          view,
          turnArtifacts,
          agentView,
          history,
        })
      },
    )
    .get(
      "/:sessionID/conversation/history",
      describeRoute({
        summary: "Page older session conversation transcript",
        description: "Return a bounded Mission or conversation transcript slice older than the current hydrate tail.",
        operationId: "session.conversation.history",
        responses: {
          200: {
            description: "Session conversation history page",
            content: { "application/json": { schema: resolver(SessionConversationHistoryPage) } },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ sessionID: z.string().min(1) })),
      validator("query", ConversationHistoryQuery),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const query = c.req.valid("query")
        await getActiveProjectSession(sessionID)
        const sessionIDs = await Session.treeInProject({ sessionID, projectID: Instance.project.id })
        const messages = await MessageStore.latestAcrossSessionsBefore({
          sessionIDs,
          before: query.before,
          beforeID: query.before_id,
          limit: query.limit + 1,
        })
        const truncated = messages.length > query.limit
        const visibleMessages = truncated ? messages.slice(messages.length - query.limit) : messages
        const transcript = enrichStandaloneSessionTranscript(visibleMessages)
          .filter(conversationMessageHasDisplay)
          .sort(conversationTranscriptMessageOrder)
        const historyWindow = conversationHistoryWindow(transcript, { tailLimit: query.limit })
        const history = { ...historyWindow.history, hasMore: truncated || historyWindow.history.hasMore }
        const agentSessions = listConversationAgentSessionsForSessionTree({
          sessionID,
          projectID: Instance.project.id,
        })
        return c.json({
          transcript: historyWindow.transcript,
          events: [],
          view: projectConversationView({ transcript: historyWindow.transcript, ledgerSessions: agentSessions }),
          history,
        })
      },
    )
    .get(
      "/:sessionID/events",
      describeRoute({
        summary: "Subscribe to session events",
        operationId: "session.events",
        responses: {
          200: {
            description: "Session event stream",
            content: {
              "text/event-stream": {
                schema: resolver(SessionEvent),
              },
            },
          },
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const session = await assertActiveProjectSession(sessionID)
        const directory = Instance.directory
        const readPendingQuestions = await Question.pendingSnapshotReader()
        c.header("X-Accel-Buffering", "no")
        c.header("X-Content-Type-Options", "nosniff")
        return streamGlobalSSE(c, async (stream, bind) => {
          let heartbeat: ReturnType<typeof setInterval> | undefined
          let stopProtocol = () => {}
          let finishStream = () => {}
          let closed = false
          const cleanup = (input?: { closeStream?: boolean; error?: unknown }) => {
            if (closed) return
            closed = true
            if (heartbeat) clearInterval(heartbeat)
            stopProtocol()
            if (input?.error) {
              log.warn("session event stream write failed", {
                sessionID,
                error: errorMessage(input.error),
              })
            }
            if (input?.closeStream) stream.close()
            finishStream()
          }
          const finished = new Promise<void>((resolve) => {
            finishStream = resolve
          })
          let writes = Promise.resolve()
          const writeData = (data: string) => {
            writes = writes
              .then(() => {
                if (closed) return
                return stream.writeSSE({ data })
              })
              .catch((error) => {
                cleanup({ closeStream: true, error })
              })
            return writes
          }
          stopProtocol = ProtocolStore.subscribeEvents(
            bind((event) => {
              if (event.sessionID !== sessionID) return
              void writeData(JSON.stringify(protocolSessionEvent(event)))
            }),
            { sessionID },
          )
          // Subscribe before reading the canonical pending-question state. A
          // question created before the subscription is present in this
          // snapshot; one created afterwards arrives through ProtocolStore.
          // The overlap can repeat the same request ID, which the overlay
          // interaction projection intentionally upserts idempotently.
          for (const request of readPendingQuestions().filter((item) => item.sessionID === sessionID)) {
            await writeData(JSON.stringify(pendingQuestionSessionEvent(request)))
          }
          for (const request of (await PermissionAuthority.list()).filter((item) => item.sessionID === sessionID)) {
            await writeData(JSON.stringify(pendingPermissionProtocolSessionEvent(request)))
          }
          await writeData(
            JSON.stringify({
              event_id: `session-connected-${Date.now()}`,
              session_id: sessionID,
              orderKey: timelineOrderKey({
                domain: "session",
                time: session.time.created,
                id: sessionID,
              }),
              type: "session.connected",
              emittedAt: Date.now(),
              timestamp: Date.now(),
              sequence: 0,
              summary: "Session event stream connected",
              payload: { sessionID },
            }),
          )
          if (closed) {
            await writes
            return
          }
          heartbeat = setInterval(
            bind(() => {
              const now = Date.now()
              const eventID = `session-heartbeat-${now}`
              void writeData(
                JSON.stringify({
                  event_id: eventID,
                  session_id: sessionID,
                  orderKey: timelineOrderKey({
                    domain: "session",
                    time: session.time.created,
                    id: sessionID,
                  }),
                  type: "session.heartbeat",
                  emittedAt: now,
                  timestamp: now,
                  sequence: 0,
                  summary: "Session event stream heartbeat",
                  payload: { sessionID },
                }),
              )
            }),
            10_000,
          )
          stream.onAbort(() => {
            cleanup()
          })
          await finished
          await writes
        })
      },
    )
    .get(
      "/:sessionID",
      describeRoute({
        summary: "Get session",
        description: "Retrieve detailed information about a specific OpenCorvus session.",
        tags: ["Session"],
        operationId: "session.get",
        responses: {
          200: {
            description: "Get session",
            content: { "application/json": { schema: resolver(Session.Info) } },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: Session.get.schema,
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const session = await getActiveProjectSession(sessionID)
        log.info("session.get", { sessionID, session })
        return c.json(session)
      },
    )
    .get(
      "/:sessionID/children",
      describeRoute({
        summary: "Get session children",
        tags: ["Session"],
        description: "Retrieve all child sessions that were forked from the specified parent session.",
        operationId: "session.children",
        responses: {
          200: {
            description: "List of children",
            content: { "application/json": { schema: resolver(Session.Info.array()) } },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: Session.children.schema,
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        await assertActiveProjectSession(sessionID)
        return c.json(await Session.children(sessionID))
      },
    )
    .get(
      "/:sessionID/todo",
      describeRoute({
        summary: "Get session todos",
        description: "Retrieve the todo list associated with a specific session, showing tasks and action items.",
        operationId: "session.todo",
        responses: {
          200: {
            description: "Todo list",
            content: { "application/json": { schema: resolver(Todo.Info.array()) } },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        await assertActiveProjectSession(sessionID)
        return c.json(await TodoStore.get(sessionID))
      },
    )
    // === mutate: CRUD ===
    .post(
      "/",
      describeRoute({
        summary: "Create session",
        description: "Create a new OpenCorvus session for interacting with AI assistants and managing conversations.",
        operationId: "session.create",
        responses: {
          ...errors(400),
          200: {
            description: "Successfully created session",
            content: { "application/json": { schema: resolver(Session.Info) } },
          },
        },
      }),
      validator("json", Session.create.schema),
      async (c) => {
        const session = await Session.create(c.req.valid("json"))
        return c.json(session)
      },
    )
    .delete(
      "/:sessionID",
      describeRoute({
        summary: "Delete session",
        description: "Delete a session and permanently remove all associated data, including messages and history.",
        operationId: "session.delete",
        responses: {
          200: {
            description: "Successfully deleted session",
            content: { "application/json": { schema: resolver(z.boolean()) } },
          },
          ...errors(400, 404),
          409: namedErrorResponse(
            "Session execution has not settled or still owns a Task",
            "TaskCancellationIncompleteError",
            "TaskBoundSessionDeletionError",
          ),
          500: namedErrorResponse(
            "Session deletion failed or committed with Task cleanup diagnostics",
            "TaskArtifactDeletionCommittedError",
            "UnknownError",
          ),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: Session.remove.schema,
        }),
      ),
      validator(
        "query",
        z.object({
          deleteTasks: HttpQueryBoolean.optional(),
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const projectID = PersistedProjectContext.currentProject().id
        await Session.getInProject({ sessionID, projectID })
        await EngineService.deleteSession(sessionID, {
          deleteTasks: c.req.valid("query").deleteTasks === true,
          projectID,
          cancellationOrigin: {
            actor: "user",
            source: "session.delete",
            surface: "api",
            requestID: resolveRequestID(c),
            reason: "Session deletion requested",
            sessionID,
          },
        })
        return c.json(true)
      },
    )
    .patch(
      "/:sessionID",
      describeRoute({
        summary: "Update session",
        description: "Update properties of an existing session, such as title or other metadata.",
        operationId: "session.update",
        responses: {
          200: {
            description: "Successfully updated session",
            content: { "application/json": { schema: resolver(Session.Info) } },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string(),
        }),
      ),
      validator(
        "json",
        z.object({
          title: z.string().optional(),
          time: z
            .object({
              archived: z.number().nullable().optional(),
            })
            .optional(),
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const updates = c.req.valid("json")

        let session = await getActiveProjectSession(sessionID)
        if (updates.title !== undefined) {
          session = await Session.setTitle({ sessionID, title: updates.title })
        }
        if (updates.time?.archived !== undefined) {
          session = await Session.setArchived({ sessionID, time: updates.time.archived })
        }

        return c.json(session)
      },
    )
    // === mutate: flow (init / fork / abort) ===
    .post(
      "/:sessionID/init",
      describeRoute({
        summary: "Initialize session",
        description:
          "Analyze the current application and create an AGENTS.md file with project-specific agent configurations.",
        operationId: "session.init",
        responses: {
          200: { description: "200", content: { "application/json": { schema: resolver(z.boolean()) } } },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
        }),
      ),
      validator("json", SessionInitializer.initialize.schema.omit({ sessionID: true })),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const body = c.req.valid("json")
        await assertActiveProjectSession(sessionID)
        await SessionInitializer.initialize({ ...body, sessionID })
        return c.json(true)
      },
    )
    .post(
      "/:sessionID/fork",
      describeRoute({
        summary: "Fork session",
        description: "Create a new session by forking an existing session at a specific message point.",
        operationId: "session.fork",
        responses: {
          200: { description: "200", content: { "application/json": { schema: resolver(Session.Info) } } },
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: Session.fork.schema.shape.sessionID,
        }),
      ),
      validator("json", Session.fork.schema.omit({ sessionID: true })),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const body = c.req.valid("json")
        await assertActiveProjectSession(sessionID)
        const result = await Session.fork({ ...body, sessionID })
        return c.json(result)
      },
    )
    .post(
      "/:sessionID/abort",
      describeRoute({
        summary: "Abort session",
        description: "Abort an active session and stop any ongoing AI processing or command execution.",
        operationId: "session.abort",
        responses: {
          200: {
            description: "Aborted session",
            content: { "application/json": { schema: resolver(z.boolean()) } },
          },
          ...errors(400, 404, 409),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string(),
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const session = await assertActiveProjectSession(sessionID)
        const origin = createExecutionCancellationOrigin({
          actor: "user",
          source: "session.abort",
          surface: "session",
          requestID: resolveRequestID(c),
          reason: "session aborted",
          targetSessionID: session.id,
        })
        cancelSessionPromptInScope({ session, origin, settleBeforeReuse: true })
        await awaitSessionPromptFinishedInScope({ session, handle: "session.abort" })
        const occurrence = SessionStatus.executionOccurrence(sessionID)
        if (occurrence && SessionStatus.getExecution(sessionID, occurrence.inputMessageID).type !== "terminal") {
          await publishSessionStatus(
            session,
            { type: "terminal", reason: "aborted", error: "session aborted" },
            { inputMessageID: occurrence.inputMessageID },
          )
        }
        return c.json(true)
      },
    )
    // === share: diff / summarize ===
    .get(
      "/:sessionID/diff",
      describeRoute({
        summary: "Get message diff",
        description: "Get the file changes (diff) that resulted from a specific user message in the session.",
        operationId: "session.diff",
        responses: {
          200: {
            description: "Successfully retrieved diff",
            content: { "application/json": { schema: resolver(Snapshot.FileDiff.array()) } },
          },
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: SessionSummary.diff.schema.shape.sessionID,
        }),
      ),
      validator(
        "query",
        z.object({
          messageID: SessionSummary.diff.schema.shape.messageID,
        }),
      ),
      async (c) => {
        const query = c.req.valid("query")
        const params = c.req.valid("param")
        await assertActiveProjectSession(params.sessionID)
        const result = await SessionSummary.diff({
          sessionID: params.sessionID,
          messageID: query.messageID,
        })
        return c.json(result)
      },
    )
    .post(
      "/:sessionID/summarize",
      describeRoute({
        summary: "Summarize session",
        description: "Generate a concise summary of the session using AI compaction to preserve key information.",
        operationId: "session.summarize",
        responses: {
          200: {
            description: "Summarized session",
            content: { "application/json": { schema: resolver(z.boolean()) } },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
        }),
      ),
      validator(
        "json",
        z.object({
          providerID: z.string(),
          modelID: z.string(),
          auto: z.boolean().optional().default(false),
          focus: z.string().optional(),
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const body = c.req.valid("json")
        const session = await getActiveProjectSession(sessionID)
        const result = await SessionContext.provide(session, () =>
          provideInitializedProjectExecution({
            directory: session.directory,
            fn: async () => {
              await clearRewindCursorForSession(sessionID)
              const msgs = await Session.messages({ sessionID })
              const source = latestSummarizableUser(msgs)
              if (!source) {
                throw new Error(`Cannot compact session ${sessionID}: no real user message found`)
              }
              await SessionCompaction.create({
                sessionID,
                source,
                model: { providerID: body.providerID, modelID: body.modelID },
                auto: body.auto,
                overflow: false,
                focus: body.focus,
              })
              return SessionPrompt.loop(body.auto ? { sessionID } : { sessionID, result_mode: "summary" })
            },
          }),
        )
        return c.json(result.info.role === "assistant" && CompactionHandoff.isValidSummaryMessage(result.info))
      },
    )
    // === message read / delete / patch ===
    .get(
      "/:sessionID/message",
      describeRoute({
        summary: "Get session messages",
        description: "Retrieve all messages in a session, including user prompts and AI responses.",
        operationId: "session.messages",
        responses: {
          200: {
            description: "List of messages",
            content: { "application/json": { schema: resolver(Message.VisibleWithParts.array()) } },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
        }),
      ),
      validator(
        "query",
        z.object({
          limit: HttpQueryLimit.optional(),
        }),
      ),
      async (c) => {
        const query = c.req.valid("query")
        const sessionID = c.req.valid("param").sessionID
        await assertActiveProjectSession(sessionID)
        const messages = await Session.messages({
          sessionID,
          limit: query.limit,
        })
        return c.json(messages)
      },
    )
    .get(
      "/:sessionID/message/:messageID",
      describeRoute({
        summary: "Get message",
        description: "Retrieve a specific message from a session by its message ID.",
        operationId: "session.message",
        responses: {
          200: {
            description: "Message",
            content: {
              "application/json": {
                schema: resolver(Message.VisibleWithParts),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
          messageID: z.string().meta({ description: "Message ID" }),
        }),
      ),
      async (c) => {
        const params = c.req.valid("param")
        await assertActiveProjectSession(params.sessionID)
        return c.json(await MessageStore.get({ sessionID: params.sessionID, messageID: params.messageID }))
      },
    )
    .delete(
      "/:sessionID/message/:messageID",
      describeRoute({
        summary: "Delete message",
        description:
          "Permanently delete a specific message (and all of its parts) from a session. This does not revert any file changes that may have been made while processing the message.",
        operationId: "session.deleteMessage",
        responses: {
          200: {
            description: "Successfully deleted message",
            content: { "application/json": { schema: resolver(z.boolean()) } },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
          messageID: z.string().meta({ description: "Message ID" }),
        }),
      ),
      async (c) => {
        const params = c.req.valid("param")
        await Session.getInProject({
          sessionID: params.sessionID,
          projectID: PersistedProjectContext.currentProject().id,
        })
        SessionPrompt.assertNoOwnedPrompt(params.sessionID)
        await Session.removeMessage({ sessionID: params.sessionID, messageID: params.messageID })
        return c.json(true)
      },
    )
    .delete(
      "/:sessionID/message/:messageID/part/:partID",
      describeRoute({
        description: "Delete a part from a message",
        operationId: "part.delete",
        responses: {
          200: {
            description: "Successfully deleted part",
            content: { "application/json": { schema: resolver(z.boolean()) } },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
          messageID: z.string().meta({ description: "Message ID" }),
          partID: z.string().meta({ description: "Part ID" }),
        }),
      ),
      async (c) => {
        const params = c.req.valid("param")
        await Session.getInProject({
          sessionID: params.sessionID,
          projectID: PersistedProjectContext.currentProject().id,
        })
        await Session.removePart({
          sessionID: params.sessionID,
          messageID: params.messageID,
          partID: params.partID,
        })
        return c.json(true)
      },
    )
    .patch(
      "/:sessionID/message/:messageID/part/:partID",
      describeRoute({
        description: "Update a part in a message",
        operationId: "part.update",
        responses: {
          200: {
            description: "Successfully updated part",
            content: { "application/json": { schema: resolver(Message.VisiblePart) } },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
          messageID: z.string().meta({ description: "Message ID" }),
          partID: z.string().meta({ description: "Part ID" }),
        }),
      ),
      validator("json", Message.Part),
      async (c) => {
        const params = c.req.valid("param")
        const body = c.req.valid("json")
        if (body.id !== params.partID || body.messageID !== params.messageID || body.sessionID !== params.sessionID) {
          throw new Error(
            `Part mismatch: body.id='${body.id}' vs partID='${params.partID}', body.messageID='${body.messageID}' vs messageID='${params.messageID}', body.sessionID='${body.sessionID}' vs sessionID='${params.sessionID}'`,
          )
        }
        await assertActiveProjectSession(params.sessionID)
        const part = await Session.updatePart(body)
        return c.json(part)
      },
    )
    // === prompt (sync / async) / command / shell ===
    .post(
      "/:sessionID/message",
      describeRoute({
        summary: "Send message",
        description:
          "Create and send a new message to a standalone, Mission, or Coding Assistant session, waiting until assistant output is complete. Projected worker guidance uses the task-scoped operator-steer route.",
        operationId: "session.prompt",
        responses: {
          200: {
            description: "Created message",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    info: Message.Assistant.safeExtend({
                      orderKey: z.string().min(1),
                      resolvedRole: z.string().min(1),
                      channel: z.string().min(1),
                      agentID: z.string().min(1),
                      sessionAgentID: z.string().min(1),
                      originSource: z.string(),
                      parentSessionID: z.string().optional(),
                    }),
                    parts: Message.VisiblePart.array(),
                  }),
                ),
              },
            },
          },
          ...errors(400, 404),
          409: namedErrorResponse(
            "Message identity is already bound to another public Session prompt",
            "PublicSessionPromptIdentityConflictError",
          ),
          503: AuthReadUnavailableResponse,
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
        }),
      ),
      validator("json", PublicSessionPromptInput),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const body = c.req.valid("json")
        const prepared = await preparePublicSessionPrompt(sessionID, body)
        if (!prepared.ok) return c.json(badRequestBody(prepared.message), 400)
        const msg = await executePublicSessionPrompt(sessionID, { sessionID, ...prepared.prompt })
        return c.json(projectPersistedSessionMessage(msg))
      },
    )
    .post(
      "/:sessionID/command",
      describeRoute({
        summary: "Send command",
        description:
          "Send a new command to a standalone, Mission, or Coding Assistant session for execution by the AI assistant. Projected worker guidance uses the task-scoped operator-steer route.",
        operationId: "session.command",
        responses: {
          200: {
            description: "Created message",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    info: Message.Assistant.safeExtend({ orderKey: z.string().min(1) }),
                    parts: Message.VisiblePart.array(),
                  }),
                ),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
        }),
      ),
      validator("json", SessionPrompt.CommandInput.omit({ sessionID: true })),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const body = c.req.valid("json")
        await assertActiveProjectSession(sessionID)
        const rejection = projectedWorkerPublicPromptRejection(sessionID)
        if (rejection) return c.json(badRequestBody(rejection), 400)
        const msg = await SessionPrompt.command({ ...body, sessionID })
        return c.json(msg)
      },
    )
    .post(
      "/:sessionID/shell",
      describeRoute({
        summary: "Run shell command",
        description:
          "Execute a shell command within a standalone, Mission, or Coding Assistant session context and return the AI's response. Projected worker guidance uses the task-scoped operator-steer route.",
        operationId: "session.shell",
        responses: {
          200: {
            description: "Created message",
            content: {
              "application/json": {
                schema: resolver(Message.Assistant.safeExtend({ orderKey: z.string().min(1) })),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
        }),
      ),
      validator("json", SessionPrompt.ShellInput.omit({ sessionID: true })),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const body = c.req.valid("json")
        await assertActiveProjectSession(sessionID)
        const rejection = projectedWorkerPublicPromptRejection(sessionID)
        if (rejection) return c.json(badRequestBody(rejection), 400)
        const msg = await SessionPrompt.shell({ ...body, sessionID })
        return c.json(msg)
      },
    ),
)
