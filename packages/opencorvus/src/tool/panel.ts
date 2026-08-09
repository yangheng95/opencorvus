import z from "zod"
import { Buffer } from "node:buffer"
import { randomBytes } from "node:crypto"
import { Tool } from "./tool"
import { EngineService } from "@/task-api"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { MessageStore } from "@/session/message-store"
import { Question } from "@/question"
import { captureWindowScreenshot } from "@/gui/screenshot"
import {
  derivePanelActor,
  panelActionSetForActor,
  panelActionSchemaForAgent,
  PanelSurface,
  type PanelActor,
} from "@/panel/capability"
import {
  RIGHT_SIDEBAR_CONVERSATION_SOURCE,
  createRightSidebarConversationSession,
  isRightSidebarConversationSession,
  rightSidebarConversationExperience,
  setRightSidebarConversationSelectedTask,
} from "@/chat/session"
import { publishConversationHandoff } from "@/chat/handoff"
import {
  ensureMissionSession,
  missionProductPillar,
  missionVisibleExpertSquadIDs,
  requireMissionSession,
} from "@/mission/session"
import { resolveMissionLaunchExpertSquadIDs } from "@/mission/expert-squad-authority"
import { SessionWake } from "@/session/wake"
import { EffectiveConfig } from "@/config/effective"
import { resolveConfiguredModelRef } from "@/agent/model"
import { attachMissionCaller, publishMissionHandoff } from "@/mission/caller-receipt"
import { MulticaExpertSquadImport } from "@/expert-squad/multica-import"
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { Instance } from "@/project/instance"
import { AttachmentStore } from "@/storage/attachment-store"

import { ChannelId } from "@/channel/catalog"
import { ControlPromptContext } from "@/control/prompt"
import {
  ArtifactReadInputSchema,
  ArtifactSchemaLimits,
  ArtifactSearchInputSchema,
  ArtifactSearchTransportPageSchema,
  artifactReadLocatorKey,
} from "@opencorvus-ai/plugin/artifact-catalog"
import { completeArtifactReadsBeforePanelAction } from "@/agent/artifact-read-facts"
import { reviewedTerminalLifecycleReferenceBeforePanelAction } from "@/agent/task-review-facts"
import { listMissionTasks } from "@/engine/store"
import { MissionCompletionReceipt, MissionCompletionTaskAcceptance } from "@/mission/completion"
import {
  requireCurrentTerminalLifecycleReference,
  sameTerminalLifecycleReference,
} from "@/engine/terminal-lifecycle-reference"
import {
  PanelQueryTaskErrorRow,
  PanelQueryTaskOutput,
  PanelQueryTaskRow,
  PanelQueryTaskSummaryRow,
  PanelTaskFailureResult,
  PanelTaskResult,
} from "@/panel/task-query"

const localOnly = (ctx: Tool.Context) => {
  const surface = resolvePanelSurface(ctx)
  return surface === "panel" || surface === "right-sidebar"
}

const PanelTaskArtifactPage = ArtifactSearchTransportPageSchema.extend({
  taskID: z.string().min(1),
})

const PANEL_ARTIFACT_PAGE_INITIAL_LIMIT = 16
const MISSION_RECOMMENDATION_TIMEOUT_MS = 10_000

const PanelUIRequestContext = z
  .object({
    protocol: z.literal("panel-ui-request"),
    surface: PanelSurface,
    requestID: z.string().uuid(),
  })
  .strict()

type PanelTaskBoard = Awaited<ReturnType<typeof EngineService.getBoard>>
const PanelChannelBindingIdentity = z.object({
  platform: ChannelId,
  channel: z.string().min(1),
  thread: z.string().min(1),
})
type PanelChannelBindingIdentity = z.infer<typeof PanelChannelBindingIdentity>

function nonEmptyString(input: unknown) {
  return typeof input === "string" && input.trim().length > 0 ? input.trim() : undefined
}

async function callerUserAttachmentRefs(ctx: Tool.Context) {
  const assistant = await MessageStore.get({ sessionID: ctx.sessionID, messageID: ctx.messageID })
  if (assistant.info.role !== "assistant" || !assistant.info.parentID) {
    throw new Error(`panel tool call ${ctx.callID} has no exact caller user message`)
  }
  const user = await MessageStore.get({
    sessionID: ctx.sessionID,
    messageID: assistant.info.parentID,
  })
  if (user.info.role !== "user") {
    throw new Error(`panel tool call ${ctx.callID} parent ${assistant.info.parentID} is not a user message`)
  }
  return user.parts
    .filter((part): part is Message.FilePart => part.type === "file")
    .map((part) => ({
      url: part.url,
      mime: part.mime,
      ...(part.filename ? { filename: part.filename } : {}),
    }))
}

function channelBindingKey(input: PanelChannelBindingIdentity) {
  return `${input.platform}:${input.channel}:${input.thread}`
}

function channelBindingFromContext(ctx: Tool.Context): PanelChannelBindingIdentity | undefined {
  if (ctx.agent === "control") {
    const control = controlContext(ctx)
    const platform = ChannelId.safeParse(control.surface)
    if (!platform.success) return undefined
    if (!control.channel || !control.thread) {
      throw new Error(`Control channel surface "${control.surface}" requires channel and thread.`)
    }
    return PanelChannelBindingIdentity.parse({
      platform: platform.data,
      channel: control.channel,
      thread: control.thread,
    })
  }
  const raw = ctx.extra?.channelBinding
  if (raw === undefined) return undefined
  return PanelChannelBindingIdentity.parse(raw)
}

function explicitCreateTaskChannelBinding(params: {
  platform?: z.infer<typeof ChannelId>
  channel?: string
  thread?: string
}): PanelChannelBindingIdentity | undefined {
  const hasPlatform = params.platform !== undefined
  const hasChannel = params.channel !== undefined
  const hasThread = params.thread !== undefined
  if (!hasPlatform && !hasChannel && !hasThread) return undefined
  if (!hasPlatform || !hasChannel || !hasThread) {
    throw new Error("panel.create_task channel binding requires platform, channel, and thread together.")
  }
  return PanelChannelBindingIdentity.parse({
    platform: params.platform,
    channel: params.channel,
    thread: params.thread,
  })
}

function resolveCreateTaskChannelBinding(
  params: {
    platform?: z.infer<typeof ChannelId>
    channel?: string
    thread?: string
    metadata?: Record<string, unknown>
  },
  ctx: Tool.Context,
) {
  const serverBinding = channelBindingFromContext(ctx)
  const toolBinding = explicitCreateTaskChannelBinding(params)
  if (serverBinding && toolBinding && channelBindingKey(serverBinding) !== channelBindingKey(toolBinding)) {
    throw new Error(
      `panel.create_task channel binding conflict: server context ${channelBindingKey(
        serverBinding,
      )} does not match tool params ${channelBindingKey(toolBinding)}.`,
    )
  }
  const identity = serverBinding ?? toolBinding
  if (!identity) return undefined
  return {
    ...identity,
    payload: params.metadata ?? {},
  }
}

function panelTaskFailure(board: PanelTaskBoard): z.infer<typeof PanelTaskFailureResult> | undefined {
  const failure = board.overview?.currentFailure
  const taskError = nonEmptyString(board.task.error)
  if (taskError) {
    return {
      source: "task",
      title: "Task failed",
      summary: taskError,
    }
  }
  if (failure) {
    return {
      source: failure.source,
      title: failure.title,
      summary: failure.summary,
    }
  }
  return undefined
}

function panelTaskResult(board: PanelTaskBoard): z.infer<typeof PanelTaskResult> {
  const failure = panelTaskFailure(board)
  const summary =
    failure?.summary ?? nonEmptyString(board.overview?.summary) ?? `${board.task.title} is ${board.task.status}.`
  return {
    status: board.task.status,
    summary,
    ...(failure ? { failure } : {}),
  }
}

function panelStructuredOutput(value: unknown, context: string): string {
  const output = JSON.stringify(value)
  const bytes = Buffer.byteLength(output, "utf8")
  if (bytes > ArtifactSchemaLimits.structuredOutputBytes) {
    throw new Error(
      `${context} produced ${bytes} bytes, above the ${ArtifactSchemaLimits.structuredOutputBytes}-byte structured-output boundary`,
    )
  }
  return output
}

async function panelTaskArtifactPage(
  taskID: string,
  input: Omit<z.input<typeof ArtifactSearchInputSchema>, "limit">,
): Promise<string> {
  let limit = PANEL_ARTIFACT_PAGE_INITIAL_LIMIT
  for (;;) {
    const page = await EngineService.searchArtifactCatalog(taskID, {
      ...input,
      limit,
    })
    const projected = PanelTaskArtifactPage.parse({
      taskID,
      entries: page.entries,
      next_cursor: page.next_cursor,
      catalog_total: page.catalog_total,
      filtered_total: page.filtered_total,
      catalog_complete: page.catalog_complete,
      metadata_truncated: page.metadata_truncated,
      provider_errors: page.provider_errors,
      resolution: page.resolution,
    })
    const output = JSON.stringify(projected)
    if (Buffer.byteLength(output, "utf8") <= ArtifactSchemaLimits.structuredOutputBytes) return output
    if (limit === 1) {
      throw new Error(
        `panel.query_task_artifacts cannot encode one catalog page within the ${ArtifactSchemaLimits.structuredOutputBytes}-byte structured-output boundary`,
      )
    }
    limit = Math.max(1, Math.floor(limit / 2))
  }
}

async function panelTaskSummaryRow(board: PanelTaskBoard): Promise<z.infer<typeof PanelQueryTaskSummaryRow>> {
  const terminalLifecycleReference = ["completed", "failed", "cancelled"].includes(board.task.status)
    ? requireCurrentTerminalLifecycleReference(board.task.id)
    : undefined
  return PanelQueryTaskSummaryRow.parse({
    taskID: board.task.id,
    title: board.task.title,
    status: board.task.status,
    created: board.task.time?.created,
    started: board.task.time?.started,
    completed: board.task.time?.completed,
    error: board.task.error,
    result: panelTaskResult(board),
    terminal_lifecycle_reference: terminalLifecycleReference,
  })
}

async function panelQueryTaskRow(
  taskID: string,
  input: { includeInteractions?: boolean },
): Promise<z.infer<typeof PanelQueryTaskRow>> {
  try {
    const board = await EngineService.getBoard(taskID)
    const item: z.infer<typeof PanelQueryTaskRow> = {
      ...(await panelTaskSummaryRow(board)),
      ...(input.includeInteractions
        ? {
            pendingInteractions: (board.interactions ?? []).filter((req) => req.status === "pending").length,
          }
        : {}),
    }
    return PanelQueryTaskRow.parse(item)
  } catch (err) {
    return PanelQueryTaskErrorRow.parse({ taskID, error: err instanceof Error ? err.message : String(err) })
  }
}

function panelUIRequestContext(ctx: Tool.Context) {
  if (ctx.extra?.panelUIRequest === undefined) return undefined
  const request = PanelUIRequestContext.parse(ctx.extra.panelUIRequest)
  if (ctx.sessionID || ctx.messageID || ctx.callID) {
    throw new Error("Panel user-interface requests must not carry Session, message, or tool-call identity.")
  }
  return request
}

export function createPanelUIRequestToolContext(input: {
  surface: z.infer<typeof PanelSurface>
  requestID: string
}): Tool.Context {
  const request = PanelUIRequestContext.parse({
    protocol: "panel-ui-request",
    ...input,
  })
  return {
    sessionID: "",
    messageID: "",
    agent: "panel_ui",
    abort: new AbortController().signal,
    extra: { panelUIRequest: request },
    messages: [],
    executionSurface: Tool.executionSurface([], []),
    metadata() {},
    async ask() {
      throw new Error("Panel user-interface requests cannot ask interactive tool permissions.")
    },
  }
}

async function resolvePanelActor(ctx: Tool.Context) {
  if (panelUIRequestContext(ctx)) return "panel_ui" as const
  const session = await Session.get(ctx.sessionID)
  if (isRightSidebarConversationSession(session)) return "right_sidebar_conversation"
  const actor = derivePanelActor(ctx.agent)
  if (!actor) {
    throw new Error(
      `panel tool does not recognize Session-bound agent "${ctx.agent || "<empty>"}"; ` +
        "panel_ui authority requires a server-created panel-ui-request context.",
    )
  }
  return actor
}

const PanelTaskCreatorActor = z.enum(["control_agent", "mission", "right_sidebar_conversation"])

function resolvePanelTaskCreator(actor: string, ctx: Tool.Context) {
  if (actor === "panel_ui" && panelUIRequestContext(ctx)) {
    return { actor: "user" as const }
  }
  const parsed = PanelTaskCreatorActor.safeParse(actor)
  if (!parsed.success) {
    throw new Error(`panel.create_task is not permitted for non-author actor ${actor}.`)
  }
  return parsed.data === "mission"
    ? {
        actor: parsed.data,
        sessionID: ctx.sessionID,
        messageID: ctx.messageID,
        ...(ctx.callID ? { toolCallID: ctx.callID } : {}),
      }
    : { actor: parsed.data, sessionID: ctx.sessionID }
}

function resolvePanelSurface(ctx: Tool.Context): z.infer<typeof PanelSurface> {
  const panelUIRequest = panelUIRequestContext(ctx)
  const result = PanelSurface.safeParse(
    panelUIRequest?.surface ?? (ctx.agent === "control" ? controlContext(ctx).surface : ctx.extra?.surface),
  )
  if (!result.success) {
    throw new Error("panel tool requires ctx.extra.surface to authorize surface-specific actions.")
  }
  return result.data
}

function panelCancellationActor(actor: Exclude<PanelActor, "panel_ui">) {
  if (actor === "control_agent" || actor === "mission" || actor === "right_sidebar_conversation") return actor
  throw new Error(`panel.cancel_task is not permitted for actor ${actor}.`)
}

async function panelMutationIdentity(
  ctx: Tool.Context,
  actor: PanelActor,
  operation: "cancel_task" | "complete_mission" | "delete_session" | "resume_task",
) {
  const panelUIRequest = panelUIRequestContext(ctx)
  if (panelUIRequest) {
    return {
      actor: "user" as const,
      requestID: panelUIRequest.requestID,
    }
  }
  if (actor === "panel_ui") {
    throw new Error(`panel.${operation} panel_ui authority requires a server-created panel-ui-request context.`)
  }
  const cancellationActor = panelCancellationActor(actor)
  const toolIdentity = await requirePanelMutationToolIdentity(ctx, operation)
  if (cancellationActor === "control_agent") {
    const requestID = nonEmptyString(controlContext(ctx).requestID)
    if (!requestID) {
      throw new Error(`panel.${operation} by control_agent requires its projected request identifier.`)
    }
    return {
      actor: cancellationActor,
      requestID,
      ...toolIdentity,
    }
  }
  if (cancellationActor === "mission") {
    const mission = await requireMissionSession(ctx.sessionID)
    return {
      actor: cancellationActor,
      requestID: toolIdentity.toolCallID,
      missionID: mission.missionID,
      ...toolIdentity,
    }
  }
  return {
    actor: cancellationActor,
    requestID: toolIdentity.toolCallID,
    ...toolIdentity,
  }
}

async function requirePanelMutationToolIdentity(
  ctx: Tool.Context,
  operation: "cancel_task" | "complete_mission" | "delete_session" | "resume_task",
) {
  const callID = nonEmptyString(ctx.callID)
  if (!callID) {
    throw new Error(`panel.${operation} requires the current persisted tool-call identifier.`)
  }
  await Session.assertLineageInProject({
    sessionID: ctx.sessionID,
    projectID: Instance.project.id,
  })
  const message = await MessageStore.get({
    sessionID: ctx.sessionID,
    messageID: ctx.messageID,
  })
  if (message.info.role !== "assistant") {
    throw new Error(`panel.${operation} message ${ctx.messageID} is not an assistant message.`)
  }
  const parts = message.parts.filter(
    (part): part is Message.ToolPart => part.type === "tool" && part.callID === callID && part.tool === "panel",
  )
  if (parts.length !== 1) {
    throw new Error(
      `panel.${operation} requires one persisted panel ToolPart for message=${ctx.messageID} call=${callID}; found ${parts.length}.`,
    )
  }
  return {
    sessionID: ctx.sessionID,
    messageID: ctx.messageID,
    toolCallID: callID,
    toolPartID: parts[0].id,
  }
}

function controlContext(ctx: Tool.Context): ControlPromptContext {
  return ControlPromptContext.parse(ctx.extra?.controlPromptContext)
}

function requireMissionTaskSemanticTitle(input: unknown): string {
  if (typeof input !== "string" || input.trim().length === 0) {
    throw new Error(
      'panel.create_task by actor "mission" requires create_task.title. ' +
        "Provide a short semantic title; the host formats the Mission prefix.",
    )
  }
  return input.trim().replace(/\s+/g, " ")
}

function newChatForwardedMissionID(): string {
  return `chat-${randomBytes(6).toString("hex")}`
}

async function requirePanelToolCallerUserMessageID(ctx: Tool.Context): Promise<string> {
  const message = await MessageStore.get({
    sessionID: ctx.sessionID,
    messageID: ctx.messageID,
  })
  if (message.info.role !== "assistant") {
    throw new Error(`panel.wake_mission requires an assistant tool-call message: ${ctx.messageID}`)
  }
  return message.info.parentID
}

async function replayMissionCallerFileParts(input: {
  callerSession: Session.Info
  callerMessageID: string
}): Promise<Array<{ type: "file"; mime: string; url: string; filename?: string }>> {
  const callerMessage = await MessageStore.get({
    sessionID: input.callerSession.id,
    messageID: input.callerMessageID,
  })
  if (callerMessage.info.role !== "user") {
    throw new Error(`panel.wake_mission caller message must be user-authored: ${input.callerMessageID}`)
  }
  const parts: Array<{ type: "file"; mime: string; url: string; filename?: string }> = []
  for (const part of callerMessage.parts) {
    if (part.type !== "file") continue
    const located = AttachmentStore.nameFromUrl(part.url)
    if (!located) {
      throw new Error(`panel.wake_mission caller attachment is not a canonical stored reference: ${part.url}`)
    }
    if (located.projectID !== input.callerSession.projectID) {
      throw new Error(
        `panel.wake_mission caller attachment belongs to project ${located.projectID}, expected ${input.callerSession.projectID}`,
      )
    }
    const url = await AttachmentStore.dataUrlFromReference(part.url, part.mime)
    if (!url) {
      throw new Error(`panel.wake_mission caller attachment cannot be materialized: ${part.url}`)
    }
    parts.push({
      type: "file",
      mime: part.mime,
      url,
      ...(part.filename ? { filename: part.filename } : {}),
    })
  }
  return parts
}

export const PanelTool = Tool.define<ReturnType<typeof panelActionSchemaForAgent>, {}>("panel", async (initCtx) => ({
  description:
    "Operate the OpenCorvus control plane: inspect plans/boards, manage task state, reply to interactions, and manage sessions.",
  parameters: panelActionSchemaForAgent(initCtx?.agentID),
  async execute(params, ctx) {
    const actor = await resolvePanelActor(ctx)
    const surface = resolvePanelSurface(ctx)
    const allowedActions = panelActionSetForActor(actor, surface)
    if (!allowedActions.has(params.action)) {
      throw new Error(
        `panel action "${params.action}" is not permitted for actor ${actor} on surface ${surface}. ` +
          `Allowed actions: ${[...allowedActions].join(", ")}.`,
      )
    }
    switch (params.action) {
      case "expert_squad_catalog": {
        if (actor !== "mission") {
          throw new Error(`panel.expert_squad_catalog is only permitted for Mission.`)
        }
        const missionSession = await Session.get(ctx.sessionID)
        const squads = await PromptProfileResolver.recommendationCatalog({
          projectDirectory: missionSession.directory,
          productPillar: missionProductPillar(missionSession),
          visibleExpertSquadIDs: missionVisibleExpertSquadIDs(missionSession),
        })
        return {
          title: "Expert Squads",
          output: JSON.stringify({ squads }),
          metadata: {},
        }
      }
      case "multica_catalog": {
        const squads = await MulticaExpertSquadImport.catalog({ projectDirectory: Instance.project.worktree })
        return {
          title: "Multica Squads",
          output: JSON.stringify({ squads }),
          metadata: {},
        }
      }
      case "view_plan": {
        const board = await EngineService.getBoard(params.taskID)
        const goals = board.goals
        const planningArtifacts = board.artifacts.filter(
          (artifact) => artifact.kind === "requirement_set" || artifact.kind === "architect_contract_graph",
        )
        return {
          title: "Task goals and planning artifacts",
          output: [
            `Task: ${board.task.title}`,
            planningArtifacts.length > 0
              ? `Planning artifacts:\n${planningArtifacts
                  .map((artifact) => `- locator=${JSON.stringify(artifact.locator)} kind=${artifact.kind}`)
                  .join("\n")}`
              : "No RequirementSet or ContractGraph artifacts recorded.",
            goals.length > 0 ? "Goals:" : undefined,
            ...goals.map(
              (goal, index) =>
                `${index + 1}. ${goal.goalTitle} [accepted=${goal.acceptance.accepted}; active_sessions=${goal.activity.activeSessionIDs.length}; reviews=${goal.reviewAssociations.length}]`,
            ),
          ]
            .filter(Boolean)
            .join("\n"),
          metadata: {},
        }
      }
      case "view_board": {
        if (!params.taskID) {
          const project = await EngineService.getProjectBoard({ limit: 8 })
          return {
            title: "Tasks",
            output:
              project.tasks.length === 0
                ? "No tasks found."
                : project.tasks
                    .map((item, index) => `${index + 1}. ${item.task.title} [${item.task.status}] (${item.task.id})`)
                    .join("\n"),
            metadata: {},
          }
        }
        const board = await EngineService.getBoard(params.taskID)
        return {
          title: "Board",
          output: [
            `Task: ${board.task.title}`,
            `Status: ${board.task.status}`,
            board.overview?.headline,
            board.overview?.summary,
          ]
            .filter(Boolean)
            .join("\n"),
          metadata: {},
        }
      }
      case "view_tasks": {
        const board = await EngineService.getProjectBoard({ limit: 8 })
        return {
          title: "Tasks",
          output:
            board.tasks.length === 0
              ? "No tasks found."
              : board.tasks
                  .map((item, index) => `${index + 1}. ${item.task.title} [${item.task.status}] (${item.task.id})`)
                  .join("\n"),
          metadata: {},
        }
      }
      case "query_task_artifacts": {
        const { action: _action, taskID, ...search } = params
        if (actor === "mission") {
          const mission = await requireMissionSession(ctx.sessionID)
          EngineService.requireMissionArtifactSource(taskID, {
            missionID: mission.missionID,
            sessionID: mission.id,
          })
        }
        return {
          title: "Task Artifacts",
          output: await panelTaskArtifactPage(taskID, search),
          metadata: { truncated: false },
        }
      }
      case "read_task_artifact": {
        if (actor !== "mission") {
          throw new Error(`panel.read_task_artifact is only available to a real Mission.`)
        }
        const mission = await requireMissionSession(ctx.sessionID)
        const { action: _action, taskID, ...rawRead } = params
        const result = await EngineService.readMissionTaskArtifact({
          taskID,
          importer: { missionID: mission.missionID, sessionID: mission.id },
          read: ArtifactReadInputSchema.parse(rawRead),
        })
        return {
          title: "Task Artifact",
          output: JSON.stringify(result.chunk),
          metadata: { truncated: false },
          ...(result.attachment
            ? {
                attachments: [
                  {
                    type: "file" as const,
                    mime: result.chunk.media_type,
                    filename: result.attachment.filename,
                    url: `data:${result.chunk.media_type};base64,${Buffer.from(result.attachment.bytes).toString("base64")}`,
                  },
                ],
              }
            : {}),
        }
      }
      case "complete_mission": {
        if (actor !== "mission") {
          throw new Error(`panel.complete_mission is only available to a real Mission.`)
        }
        const mission = await requireMissionSession(ctx.sessionID)
        const identity = await requirePanelMutationToolIdentity(ctx, "complete_mission")
        const missionTasks = listMissionTasks({
          projectID: mission.projectID,
          missionID: mission.missionID,
          sessionID: mission.id,
        })
        const expectedTaskIDs = missionTasks.map((task) => task.id).sort()
        const acceptedTaskIDs = params.task_acceptances.map((acceptance) => acceptance.task_id).sort()
        if (
          new Set(acceptedTaskIDs).size !== acceptedTaskIDs.length ||
          expectedTaskIDs.length !== acceptedTaskIDs.length ||
          expectedTaskIDs.some((taskID, index) => taskID !== acceptedTaskIDs[index])
        ) {
          throw new Error(
            `panel.complete_mission requires the complete current child Task set. ` +
              `Expected [${expectedTaskIDs.join(", ")}], received [${acceptedTaskIDs.join(", ")}].`,
          )
        }
        const authoritativeAcceptances: Array<z.infer<typeof MissionCompletionTaskAcceptance>> = []
        for (const acceptance of params.task_acceptances) {
          EngineService.requireMissionArtifactSource(acceptance.task_id, {
            missionID: mission.missionID,
            sessionID: mission.id,
          })
          const currentReference = requireCurrentTerminalLifecycleReference(acceptance.task_id)
          const reviewedReference = reviewedTerminalLifecycleReferenceBeforePanelAction({
            sessionID: ctx.sessionID,
            assistantMessageID: ctx.messageID,
            taskID: acceptance.task_id,
          })
          if (
            currentReference.terminalStatus !== "completed" ||
            !sameTerminalLifecycleReference(currentReference, reviewedReference)
          ) {
            throw new Error(
              `panel.complete_mission Task ${acceptance.task_id} must cite its exact current completed occurrence.`,
            )
          }
          const completeLocatorKeys = new Set(
            completeArtifactReadsBeforePanelAction({
              sessionID: ctx.sessionID,
              assistantMessageID: ctx.messageID,
              taskID: acceptance.task_id,
            }).map(artifactReadLocatorKey),
          )
          const acceptedLocatorKeys = acceptance.evidence_locators.map(artifactReadLocatorKey)
          if (
            new Set(acceptedLocatorKeys).size !== acceptedLocatorKeys.length ||
            acceptedLocatorKeys.some((key) => !completeLocatorKeys.has(key))
          ) {
            throw new Error(
              `panel.complete_mission Task ${acceptance.task_id} evidence must be completely read in this Mission Turn.`,
            )
          }
          authoritativeAcceptances.push({
            ...acceptance,
            terminal_lifecycle_reference: reviewedReference,
          })
        }
        return {
          title: "Mission completed",
          output: JSON.stringify(
            MissionCompletionReceipt.parse({
              kind: "mission_completed",
              mission_id: mission.missionID,
              mission_session_id: mission.id,
              summary: params.summary,
              task_acceptances: authoritativeAcceptances,
              assistant_message_id: identity.messageID,
              tool_call_id: identity.toolCallID,
              tool_part_id: identity.toolPartID,
              time_recorded: Date.now(),
            }),
          ),
          metadata: { truncated: false },
        }
      }
      case "query_task": {
        // Structured batch reconciliation for agents (mission, etc.).
        // view_board is the prose surface; this is the stable JSON surface.
        // Each input ID maps to one output entry — failures (not found,
        // cross-project, etc.) surface as { taskID, error } so the caller
        // gets a deterministic 1:1 row count back.
        const results = await Promise.all(
          params.taskIDs.map((taskID) =>
            panelQueryTaskRow(taskID, {
              includeInteractions: params.includeInteractions,
            }),
          ),
        )
        return {
          title: "Tasks",
          output: panelStructuredOutput(PanelQueryTaskOutput.parse({ tasks: results }), "panel.query_task"),
          metadata: { truncated: false },
        }
      }
      case "create_task": {
        if (params.allow_create === false) {
          return {
            title: "Ignored",
            output: "No task is bound to this thread.",
            metadata: {},
          }
        }
        const panelUIRequest = panelUIRequestContext(ctx)
        const attachments = panelUIRequest ? [] : await callerUserAttachmentRefs(ctx)
        const queue = params.queue ?? false
        if (actor === "mission") {
          requireMissionTaskSemanticTitle(params.title)
        }
        if (params.artifact_imports && params.artifact_imports.length > 0 && actor !== "mission") {
          throw new Error("panel.create_task artifact_imports is only available to a real Mission")
        }
        const taskCreator = resolvePanelTaskCreator(actor, ctx)
        const taskChannelBinding = resolveCreateTaskChannelBinding(params, ctx)
        const inheritedPromptProfile = panelUIRequest
          ? params.promptProfile
          : actor === "mission"
            ? params.promptProfile
            : (params.promptProfile ??
              (await EffectiveConfig.effective({ sessionID: ctx.sessionID })).prompt_profile?.active)
        const callerModel = panelUIRequest
          ? params.model
          : (params.model ?? (await resolveConfiguredModelRef({ sessionID: ctx.sessionID })))
        const source = panelUIRequest
          ? params.source
          : actor === "mission"
            ? "mission"
            : actor === "right_sidebar_conversation"
              ? RIGHT_SIDEBAR_CONVERSATION_SOURCE
              : (params.source ??
                (actor === "control_agent" ? controlContext(ctx).source : ctx.extra?.source) ??
                (taskChannelBinding ? `channel:${taskChannelBinding.platform}` : "panel"))
        const productPillar = panelUIRequest
          ? params.productPillar
          : actor === "mission"
            ? (await requireMissionSession(ctx.sessionID)).productPillar
            : actor === "right_sidebar_conversation"
              ? rightSidebarConversationExperience(await Session.get(ctx.sessionID)) === "work"
                ? "work"
                : "code"
              : params.productPillar
        if (!productPillar) {
          throw new Error("panel.create_task requires a product pillar for direct Task creation.")
        }
        const taskID = await EngineService.createTask(
          {
            requestID: panelUIRequest
              ? params.request_id
              : (params.request_id ??
                (actor === "control_agent" ? controlContext(ctx).requestID : ctx.extra?.requestID)),
            artifactImports: params.artifact_imports,
            directory: params.directory,
            title: params.title,
            request: params.request,
            productPillar,
            ...(callerModel
              ? {
                  model:
                    typeof callerModel === "string" ? callerModel : `${callerModel.providerID}/${callerModel.modelID}`,
                }
              : {}),
            promptProfile: inheritedPromptProfile,
            expectedPackageDigest: params.expectedPackageDigest,
            queue,
            checks: params.checks,
            source,
            ...(taskChannelBinding ? { channelBinding: taskChannelBinding } : {}),
            ...(attachments.length > 0 ? { attachments } : {}),
            metadata: params.metadata,
          },
          taskCreator,
        )
        if (actor === "right_sidebar_conversation") {
          const callerSession = await Session.get(ctx.sessionID)
          await setRightSidebarConversationSelectedTask({ session: callerSession, taskID })
        }
        return {
          title: "Task created",
          output: JSON.stringify({
            kind: "created",
            task_id: taskID,
            artifact_imports: EngineService.getCrossTaskArtifactImportMappings(taskID),
            message: `Task accepted: \`${taskID}\``,
          }),
          metadata: {},
        }
      }
      case "wake_mission": {
        if (actor !== "right_sidebar_conversation") {
          throw new Error(`panel.wake_mission is only permitted for a right-sidebar conversation.`)
        }
        const callerSession = await Session.get(ctx.sessionID)
        if (!isRightSidebarConversationSession(callerSession)) {
          throw new Error(`panel.wake_mission requires a right-sidebar conversation: ${ctx.sessionID}`)
        }
        const callerMessageID = await requirePanelToolCallerUserMessageID(ctx)
        const callerFileParts = await replayMissionCallerFileParts({ callerSession, callerMessageID })
        const missionDecision = await Question.askAndFormat({
          sessionID: ctx.sessionID,
          tool: ctx.callID ? { messageID: ctx.messageID, callID: ctx.callID } : undefined,
          questions: [
            {
              header: "Mission",
              question: params.reason,
              options: [
                {
                  value: "yes",
                  label: "Yes",
                  description: "Start Mission with the complete request and continue in the Mission conversation.",
                },
                {
                  value: "no",
                  label: "No",
                  description: "Keep this request in Chat and do not create a Mission.",
                },
              ],
              multiple: false,
              custom: false,
            },
          ],
          automatic: {
            timeoutMs: MISSION_RECOMMENDATION_TIMEOUT_MS,
            answers: [["yes"]],
          },
        })
        if (missionDecision.status !== "answered" || missionDecision.answers[0]?.[0] !== "yes") {
          return {
            title: "Mission declined",
            output: JSON.stringify({
              kind: "mission_declined",
              message: "Mission recommendation declined; no Mission was created.",
            }),
            metadata: {},
          }
        }
        const missionID = newChatForwardedMissionID()
        const heldExpertSquadIDs = await resolveMissionLaunchExpertSquadIDs({
          projectDirectory: callerSession.directory,
          productPillar: rightSidebarConversationExperience(callerSession) === "work" ? "work" : "code",
          requestedExpertSquadIDs: [],
        })
        const missionSession = await ensureMissionSession({
          missionID,
          defaultCwd: callerSession.directory,
          productPillar: rightSidebarConversationExperience(callerSession) === "work" ? "work" : "code",
          heldExpertSquadIDs,
        })
        if (params.title) {
          await Session.setTitle({
            sessionID: missionSession.id,
            title: params.title,
          })
        }
        const callerModel = await resolveConfiguredModelRef({ sessionID: callerSession.id })
        await Session.mergeConfigOverlay({
          sessionID: missionSession.id,
          patch: {
            model: `${callerModel.providerID}/${callerModel.modelID}`,
            prompt_profile: null,
          },
        })
        const attachedMissionSession = await attachMissionCaller({
          missionSessionID: missionSession.id,
          callerSession,
          callerMessageID,
        })
        await SessionWake.wake({
          sessionID: missionSession.id,
          prompt: params.request,
          author: ctx.agent,
          agent: "mission",
          surface: "panel",
          parts: callerFileParts,
          reason: {
            source: "mission.operator",
            missionID,
          },
        })
        publishMissionHandoff(attachedMissionSession)
        return {
          title: "Mission started",
          output: JSON.stringify({
            kind: "mission_wake",
            mission_id: missionID,
            session_id: missionSession.id,
            message: `Mission accepted: \`${missionID}\``,
          }),
          metadata: {},
        }
      }
      case "wake_work": {
        if (actor !== "right_sidebar_conversation") {
          throw new Error(`panel.wake_work is only permitted for a right-sidebar conversation.`)
        }
        const callerSession = await Session.get(ctx.sessionID)
        if (!isRightSidebarConversationSession(callerSession)) {
          throw new Error(`panel.wake_work requires a right-sidebar conversation: ${ctx.sessionID}`)
        }
        const callerExperience = rightSidebarConversationExperience(callerSession)
        if (callerExperience !== "chat") {
          throw new Error(`panel.wake_work requires a Chat caller, found ${callerExperience ?? "unknown"}.`)
        }
        const callerMessageID = await requirePanelToolCallerUserMessageID(ctx)
        const callerFileParts = await replayMissionCallerFileParts({ callerSession, callerMessageID })
        const workDecision = await Question.askAndFormat({
          sessionID: ctx.sessionID,
          tool: ctx.callID ? { messageID: ctx.messageID, callID: ctx.callID } : undefined,
          questions: [
            {
              header: "Work",
              question: params.reason,
              options: [
                {
                  value: "yes",
                  label: "Yes",
                  description: "Start Work with the complete request and continue in the new Work conversation.",
                },
                {
                  value: "no",
                  label: "No",
                  description: "Keep this request in Chat and do not create Work.",
                },
              ],
              multiple: false,
              custom: false,
            },
          ],
        })
        if (workDecision.status === "expired") {
          return {
            title: "Work decision expired",
            output: JSON.stringify({
              kind: "work_question_expired",
              question_id: workDecision.requestID,
              time_expires: workDecision.timeExpires,
              time_resolved: workDecision.timeResolved,
              message: "Work recommendation expired without an operator decision; no Work conversation was created.",
            }),
            metadata: { interaction_status: "expired" },
          }
        }
        if (workDecision.status !== "answered" || workDecision.answers[0]?.[0] !== "yes") {
          return {
            title: "Work declined",
            output: JSON.stringify({
              kind: "work_declined",
              message: "Work recommendation declined; no Work conversation was created.",
            }),
            metadata: {},
          }
        }
        const workSession = await createRightSidebarConversationSession("work")
        if (params.title) {
          await Session.setTitle({
            sessionID: workSession.id,
            title: params.title,
          })
        }
        const callerModel = await resolveConfiguredModelRef({ sessionID: callerSession.id })
        await Session.mergeConfigOverlay({
          sessionID: workSession.id,
          patch: {
            model: `${callerModel.providerID}/${callerModel.modelID}`,
            prompt_profile: null,
          },
        })
        await SessionWake.wake({
          sessionID: workSession.id,
          prompt: params.request,
          author: ctx.agent,
          agent: "work",
          surface: "right-sidebar",
          parts: callerFileParts,
          reason: {
            source: "conversation.handoff",
            callerSessionID: callerSession.id,
            callerMessageID,
            targetExperience: "work",
          },
        })
        const hydratedWorkSession = await Session.get(workSession.id)
        publishConversationHandoff({
          targetSession: hydratedWorkSession,
          callerSession,
          callerMessageID,
        })
        return {
          title: "Work started",
          output: JSON.stringify({
            kind: "work_wake",
            session_id: workSession.id,
            message: `Work accepted: \`${workSession.id}\``,
          }),
          metadata: {},
        }
      }
      case "send_task_message": {
        const panelUIRequest = panelUIRequestContext(ctx)
        const persistedAttachments = panelUIRequest ? [] : await callerUserAttachmentRefs(ctx)
        const result = await EngineService.handleTaskMessage(params.taskID, {
          text: params.text,
          source: panelUIRequest
            ? params.source
            : actor === "mission"
              ? "mission"
              : actor === "right_sidebar_conversation"
                ? RIGHT_SIDEBAR_CONVERSATION_SOURCE
                : (params.source ??
                  (actor === "control_agent" ? controlContext(ctx).source : ctx.extra?.source) ??
                  "panel"),
          user_id: params.user_id,
          model: params.model,
          ...(persistedAttachments.length > 0 ? { attachments: persistedAttachments } : {}),
        })
        return {
          title: "Task message",
          output: JSON.stringify({ kind: "message", task_id: params.taskID, message: result.message }),
          metadata: {},
        }
      }
      case "resume_task": {
        if (actor !== "mission") {
          throw new Error(`panel.resume_task is only available to a real Mission.`)
        }
        const mission = await requireMissionSession(ctx.sessionID)
        const identity = await requirePanelMutationToolIdentity(ctx, "resume_task")
        const completeEvidenceLocators = completeArtifactReadsBeforePanelAction({
          sessionID: ctx.sessionID,
          assistantMessageID: ctx.messageID,
          taskID: params.taskID,
        })
        const result = await EngineService.resumeMissionTask({
          taskID: params.taskID,
          importer: {
            missionID: mission.missionID,
            sessionID: mission.id,
            messageID: identity.messageID,
            toolCallID: identity.toolCallID,
          },
          reviewedTerminalLifecycleReference: reviewedTerminalLifecycleReferenceBeforePanelAction({
            sessionID: ctx.sessionID,
            assistantMessageID: ctx.messageID,
            taskID: params.taskID,
          }),
          text: params.text,
          evidenceLocators: params.evidence_locators,
          completeEvidenceLocators,
          toolPartID: identity.toolPartID,
        })
        return {
          title: result.kind === "resumed" ? "Task resumed" : "Task cancellation authority required",
          output: JSON.stringify(result),
          metadata: { truncated: false },
        }
      }
      case "reply_interaction": {
        const result = await EngineService.replyInteraction(
          params.interactionID,
          params.reply
            ? { reply: params.reply, autoReply: false }
            : params.message
              ? { message: params.message, autoReply: false }
              : { reply: "once", autoReply: false },
        )
        return {
          title: "Interaction replied",
          output: JSON.stringify({
            kind: "interaction",
            task_id: result.taskID,
            interaction_id: result.id,
            message: "Interaction answered.",
          }),
          metadata: {},
        }
      }
      case "reject_interaction": {
        const result = await EngineService.rejectInteraction(params.interactionID, {
          message: params.message,
          autoReply: false,
        })
        return {
          title: "Interaction rejected",
          output: JSON.stringify({
            kind: "interaction",
            task_id: result.taskID,
            interaction_id: result.id,
            message: "Interaction rejected.",
          }),
          metadata: {},
        }
      }
      case "retry_task":
        await EngineService.retryTask(params.taskID)
        return {
          title: "Retry queued",
          output: JSON.stringify({ kind: "message", task_id: params.taskID, message: "Retry queued." }),
          metadata: {},
        }
      case "replan_task":
        await EngineService.replanTask(params.taskID)
        return {
          title: "Replan queued",
          output: JSON.stringify({ kind: "message", task_id: params.taskID, message: "Replan queued." }),
          metadata: {},
        }
      case "cancel_task":
        const cancellationIdentity = await panelMutationIdentity(ctx, actor, "cancel_task")
        await EngineService.cancelTask(params.taskID, {
          origin: {
            ...cancellationIdentity,
            source: "panel.cancel_task",
            surface,
            reason: params.reason,
          },
        })
        return {
          title: "Task cancelled",
          output: JSON.stringify({ kind: "message", task_id: params.taskID, message: "Task cancelled." }),
          metadata: {},
        }
      case "update_checks":
        await EngineService.updateTaskChecks(params.taskID, { checks: params.checks })
        return {
          title: "Checks updated",
          output: JSON.stringify({ kind: "message", task_id: params.taskID, message: "Task checks updated." }),
          metadata: {},
        }
      case "capture_overlay_screenshot":
        try {
          const shot = await captureWindowScreenshot(params.match)
          return {
            title: "Screenshot captured",
            output: JSON.stringify({
              kind: "panel_response",
              message: `Captured OpenCorvus GUI: ${shot.title} (${shot.width}x${shot.height}).`,
              attachments: [
                {
                  mime: shot.mime,
                  url: shot.url,
                  filename: shot.filename,
                },
              ],
            }),
            metadata: {},
          }
        } catch (error) {
          return {
            title: "Screenshot unavailable",
            output: JSON.stringify({
              kind: "panel_response",
              message: `Failed to capture OpenCorvus GUI: ${error instanceof Error ? error.message : String(error)}`,
            }),
            metadata: {},
          }
        }
      case "select_task":
        if (!localOnly(ctx)) throw new Error("Task selection is only available in the desktop panel.")
        return {
          title: "Task selected",
          output: JSON.stringify({
            kind: "panel_response",
            task_id: params.taskID,
            message: `Selected task ${params.taskID}.`,
            local_action: { type: "select_task", taskID: params.taskID },
          }),
          metadata: {},
        }
      case "select_session":
        if (!localOnly(ctx)) throw new Error("Session selection is only available in the desktop panel.")
        return {
          title: "Session selected",
          output: JSON.stringify({
            kind: "panel_response",
            session_id: params.sessionID,
            message: `Selected session ${params.sessionID}.`,
            local_action: { type: "select_session", sessionID: params.sessionID },
          }),
          metadata: {},
        }
      case "create_session": {
        const session = await Session.create({ kind: "assistant" })
        return {
          title: "Session created",
          output: JSON.stringify({
            kind: "panel_response",
            session_id: session.id,
            message: `Session created: ${session.id}`,
            ...(localOnly(ctx)
              ? {
                  local_action: {
                    type: "select_session",
                    sessionID: session.id,
                  },
                }
              : {}),
          }),
          metadata: {},
        }
      }
      case "fork_session": {
        const session = await Session.fork({ sessionID: params.sessionID })
        return {
          title: "Session forked",
          output: JSON.stringify({
            kind: "panel_response",
            session_id: session.id,
            message: `Session forked: ${session.id}`,
            ...(localOnly(ctx)
              ? {
                  local_action: {
                    type: "select_session",
                    sessionID: session.id,
                  },
                }
              : {}),
          }),
          metadata: {},
        }
      }
      case "delete_session": {
        const deletionIdentity = await panelMutationIdentity(ctx, actor, "delete_session")
        await EngineService.deleteSession(params.sessionID, {
          deleteTasks: true,
          cancellationOrigin: {
            ...deletionIdentity,
            source: "session.delete",
            surface,
            reason: "Session deletion requested",
          },
        })
        return {
          title: "Session deleted",
          output: JSON.stringify({
            kind: "panel_response",
            session_id: params.sessionID,
            message: `Session deleted: ${params.sessionID}`,
            ...(localOnly(ctx)
              ? {
                  local_action: {
                    type: "invalidate_session",
                    sessionID: params.sessionID,
                  },
                }
              : {}),
          }),
          metadata: {},
        }
      }
      case "update_goal":
        await EngineService.replaceGoalContract(params.goalID, {
          title: params.title,
          acceptance_specs: params.acceptance_specs as import("@/acceptance/types").AcceptanceSpec[],
        })
        return {
          title: "Goal updated",
          output: JSON.stringify({ kind: "panel_response", message: "Goal updated." }),
          metadata: {},
        }
      case "delete_goal":
        await EngineService.deleteGoal(params.goalID)
        return {
          title: "Goal deleted",
          output: JSON.stringify({ kind: "panel_response", message: "Goal deleted." }),
          metadata: {},
        }
    }
  },
}))
