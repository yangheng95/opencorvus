import z from "zod"
import { Config } from "@/config/config"
import { Buffer } from "node:buffer"
import { Tool } from "./tool"
import { EngineService } from "@/task-api"
import { requireMissionTaskCreationOpenedOccurrence } from "@/task-api/task-creator"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { MessageStore } from "@/session/message-store"
import { Question } from "@/question"
import { captureWindowScreenshot } from "@/gui/screenshot"
import {
  derivePanelActor,
  panelActionKind,
  panelActionSetForActor,
  panelActionSchemaForAgent,
  panelLeafActionSchemaForAgent,
  panelLeafCapability,
  PanelSurface,
  type PanelActor,
} from "@/panel/capability"
import { PANEL_ACTIONS, panelLeafToolID } from "@/panel/action-ids"
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
import { Provider } from "@/provider/provider"
import { attachMissionCaller, publishMissionHandoff } from "@/mission/caller-receipt"
import {
  missionOperatorAttachmentInputs,
  missionOperatorWakeReason,
  openMissionExecutionWithWake,
} from "@/mission/execution-closure"
import { MulticaExpertSquadImport } from "@/expert-squad/multica-import"
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { Instance } from "@/project/instance"
import { AttachmentStore } from "@/storage/attachment-store"
import { withImmediateParkToolResultControl } from "@/session/tool-result-control"
import { assertPublicSessionOperationAuthority } from "@/mission/public-session-authority"
import { Identifier } from "@/id/id"
import { Database, NotFoundError, and, eq, sql } from "@/storage/db"
import { SessionTable } from "@/session/session.sql"
import { taskIDForCreatorToolPart } from "@/engine/task-creation-contract"
import { TaskCreationAcceptedTargetUnavailableError } from "@/engine/task-project-error"
import { buildPanelCreationFact, PanelCreationFact, panelCreationTargetID } from "@/engine/panel-creation-fact"
import { canonicalJSONValue } from "@/util/canonical-digest"

import { ChannelId } from "@/channel/catalog"
import { ControlPromptContext } from "@/control/prompt"
import {
  ArtifactReadInputSchema,
  ArtifactReadReferenceChunkSchema,
  ArtifactReadReferenceInputSchema,
  ArtifactSchemaLimits,
  ArtifactSearchInputSchema,
  ArtifactSearchReferenceTransportPageSchema,
  artifactReadLocatorKey,
  mintArtifactLocatorReference,
  mintArtifactReadReference,
} from "@opencorvus-ai/plugin/artifact-catalog"

import {
  completeArtifactReadsBeforePanelAction,
  resolvePanelArtifactLocatorReferenceBeforeRead,
  resolvePanelArtifactReadReferencesBeforeAction,
} from "@/agent/artifact-read-facts"
import { reviewedTerminalLifecycleReferenceBeforePanelAction } from "@/agent/task-review-facts"
import { listMissionTasks } from "@/engine/store"
import { MissionCompletionReceipt, MissionCompletionTaskAcceptance } from "@/mission/completion"
import {
  acceptanceGapEvidenceLocators,
  acceptanceGapReadReferences,
  materializeMissionAcceptanceGap,
} from "@/mission/acceptance-gap"
import { readLatestTaskAcceptanceLedger } from "@/mission/acceptance-ledger"
import {
  requireCurrentTerminalLifecycleReference,
  resolveTerminalLifecycleReference,
  type TerminalLifecycleReference,
} from "@/engine/terminal-lifecycle-reference"
import {
  sameTerminalLifecycleReference,
  TerminalLifecycleReferenceSchema,
} from "@/engine/terminal-lifecycle-reference-schema"
import {
  PanelQueryTaskErrorRow,
  PanelQueryTaskOutput,
  PanelQueryTaskRow,
  PanelQueryTaskSummaryRow,
  PanelTaskFailureResult,
  PanelTaskResult,
} from "@/panel/task-query"

let missionWakeForTest: typeof SessionWake.wakeWithReceipt | undefined

export const PanelToolTestHooks = {
  installMissionWakeExecutor(executor: typeof SessionWake.wakeWithReceipt): Disposable {
    if (missionWakeForTest) throw new Error("Panel Mission wake executor is already installed")
    missionWakeForTest = executor
    return {
      [Symbol.dispose]() {
        if (missionWakeForTest === executor) missionWakeForTest = undefined
      },
    }
  },
}

const localOnly = (ctx: Tool.Context) => {
  const surface = resolvePanelSurface(ctx)
  return surface === "panel" || surface === "right-sidebar"
}

const PanelTaskArtifactPage = ArtifactSearchReferenceTransportPageSchema.omit({ next_cursor: true }).extend({
  taskID: z.string().min(1),
  terminal_lifecycle_reference: TerminalLifecycleReferenceSchema,
  page_number: z.number().int().min(1),
  next_page_number: z.number().int().min(2).nullable(),
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
  input: Omit<z.input<typeof ArtifactSearchInputSchema>, "limit" | "cursor"> & {
    terminal_lifecycle_reference: TerminalLifecycleReference
    page_number: number
  },
): Promise<string> {
  const { terminal_lifecycle_reference: expectedTerminalReference, page_number: requestedPageNumber, ...search } = input
  const assertCurrentTerminalOccurrence = () => {
    const current = requireCurrentTerminalLifecycleReference(taskID)
    if (!sameTerminalLifecycleReference(current, expectedTerminalReference)) {
      throw new Error(
        `panel.query_task_artifacts terminal occurrence changed for Task ${taskID}; query the current Task before enumerating its Artifact catalog`,
      )
    }
    return current
  }

  assertCurrentTerminalOccurrence()
  let cursor: string | undefined
  for (let pageNumber = 1; pageNumber <= requestedPageNumber; pageNumber += 1) {
    let limit = PANEL_ARTIFACT_PAGE_INITIAL_LIMIT
    for (;;) {
      assertCurrentTerminalOccurrence()
      const page = await EngineService.searchArtifactCatalog(taskID, {
        ...search,
        limit,
        ...(cursor ? { cursor } : {}),
      })
      const terminalReference = assertCurrentTerminalOccurrence()
      const projected = PanelTaskArtifactPage.parse({
        taskID,
        terminal_lifecycle_reference: terminalReference,
        page_number: pageNumber,
        next_page_number: page.next_cursor ? pageNumber + 1 : null,
        entries: page.entries.map((entry) => ({
          ...entry,
          artifact_locator_ref: mintArtifactLocatorReference(),
        })),
        catalog_total: page.catalog_total,
        filtered_total: page.filtered_total,
        catalog_complete: page.catalog_complete,
        metadata_truncated: page.metadata_truncated,
        provider_errors: page.provider_errors,
        resolution: page.resolution,
      })
      const output = JSON.stringify(projected)
      if (Buffer.byteLength(output, "utf8") <= ArtifactSchemaLimits.structuredOutputBytes) {
        if (pageNumber === requestedPageNumber) return output
        if (pageNumber === 1 && requestedPageNumber > Math.max(1, page.filtered_total)) {
          throw new Error(
            `panel.query_task_artifacts page ${requestedPageNumber} exceeds the catalog's ${page.filtered_total} matching entries for Task ${taskID}`,
          )
        }
        if (!page.next_cursor) {
          throw new Error(
            `panel.query_task_artifacts page ${requestedPageNumber} is beyond the complete ${pageNumber}-page catalog for Task ${taskID}`,
          )
        }
        cursor = page.next_cursor
        break
      }
      if (limit === 1) {
        throw new Error(
          `panel.query_task_artifacts cannot encode one catalog page within the ${ArtifactSchemaLimits.structuredOutputBytes}-byte structured-output boundary`,
        )
      }
      limit = Math.max(1, Math.floor(limit / 2))
    }
  }
  throw new Error(`panel.query_task_artifacts failed to resolve requested page ${requestedPageNumber}`)
}

async function panelTaskSummaryRow(board: PanelTaskBoard): Promise<z.infer<typeof PanelQueryTaskSummaryRow>> {
  const terminalLifecycleReference = ["completed", "failed", "cancelled"].includes(board.task.status)
    ? requireCurrentTerminalLifecycleReference(board.task.id)
    : undefined
  const acceptanceLedger = readLatestTaskAcceptanceLedger(board.task.id)
  return PanelQueryTaskSummaryRow.parse({
    taskID: board.task.id,
    title: board.task.title,
    status: board.task.status,
    created: board.task.time?.created,
    started: board.task.time.started,
    completed: board.task.time?.completed,
    error: board.task.error,
    result: panelTaskResult(board),
    terminal_lifecycle_reference: terminalLifecycleReference,
    ...(acceptanceLedger
      ? {
          acceptance_ledger: {
            artifact_id: acceptanceLedger.artifactID,
            revision: acceptanceLedger.revision.revision,
            execution_epoch: acceptanceLedger.revision.execution_epoch,
            previous_revision_artifact_id: acceptanceLedger.revision.previous_revision_artifact_id,
            gap: acceptanceLedger.revision.gap,
          },
        }
      : {}),
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

async function resolvePanelTaskCreator(actor: string, ctx: Tool.Context) {
  if (actor === "panel_ui" && panelUIRequestContext(ctx)) {
    return { actor: "user" as const }
  }
  const parsed = PanelTaskCreatorActor.safeParse(actor)
  if (!parsed.success) {
    throw new Error(`panel.create_task is not permitted for non-author actor ${actor}.`)
  }
  const toolIdentity = await requirePanelToolIdentity(ctx, "create_task")
  return parsed.data === "mission"
    ? {
        actor: parsed.data,
        openedOccurrence: requireMissionTaskCreationOpenedOccurrence(ctx.sessionID),
        ...toolIdentity,
      }
    : { actor: parsed.data, ...toolIdentity }
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
  const toolIdentity = await requirePanelToolIdentity(ctx, operation)
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

async function requirePanelToolIdentity(
  ctx: Tool.Context,
  operation:
    | "cancel_task"
    | "complete_mission"
    | "create_task"
    | "delete_session"
    | "read_task_artifact"
    | "resume_task"
    | "wake_mission"
    | "wake_work",
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
    (part): part is Message.ToolPart =>
      part.type === "tool" && part.callID === callID && part.tool === `panel_${operation}`,
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

function panelCreationMetadata(input: {
  operation: "wake_mission" | "wake_work"
  toolIdentity: Awaited<ReturnType<typeof requirePanelToolIdentity>>
  params: unknown
  callerUserMessageID: string
}) {
  const { action, ...toolInput } = z.record(z.string(), z.unknown()).parse(input.params)
  if (action !== input.operation) {
    throw new Error(`panel.${input.operation} received a divergent umbrella action`)
  }
  return {
    panelCreation: buildPanelCreationFact({
      operation: input.operation,
      toolPartID: input.toolIdentity.toolPartID,
      toolCallID: input.toolIdentity.toolCallID,
      messageID: input.toolIdentity.messageID,
      callerUserMessageID: input.callerUserMessageID,
      params: toolInput,
    }),
  }
}

async function initialForwardedConversationOverlay(model: string): Promise<Record<string, unknown>> {
  const base = await Config.get()
  return Config.previewOverlayUpdate(base, {}, Config.Overlay.parse({ model, prompt_profile: null })).nextOverlay
}

function assertPanelCreationMetadata(
  session: Session.Info,
  expected: ReturnType<typeof panelCreationMetadata>["panelCreation"],
): void {
  const actual = (session.metadata as { panelCreation?: unknown } | undefined)?.panelCreation
  if (
    canonicalJSONValue(actual, `Session ${session.id} panel creation`) !==
    canonicalJSONValue(expected, `Session ${session.id} expected panel creation`)
  ) {
    throw new Error(`Session ${session.id} is already bound to another persisted panel creation occurrence`)
  }
}

function frozenPanelTargetModel(session: Session.Info) {
  const metadata = session.metadata && typeof session.metadata === "object" ? session.metadata : {}
  const overlay = Config.Overlay.parse((metadata as Record<string, unknown>).configOverlay ?? {})
  if (!overlay.model) {
    throw new Error(`Panel-created Session ${session.id} has no frozen model in its accepted config overlay`)
  }
  return { overlay, model: Provider.parseModel(overlay.model), modelID: overlay.model }
}

async function ensurePanelWorkSession(input: {
  id: string
  title?: string
  configOverlay: Record<string, unknown>
  creationMetadata: ReturnType<typeof panelCreationMetadata>
}) {
  const existing = await Session.get(input.id).catch((error) => {
    if (NotFoundError.isInstance(error as Error)) return undefined
    throw error
  })
  if (existing) {
    if (rightSidebarConversationExperience(existing) !== "work") {
      throw new Error(`Panel Work identity ${input.id} is already owned by another Session kind`)
    }
    assertPanelCreationMetadata(existing, input.creationMetadata.panelCreation)
    return existing
  }
  try {
    return await createRightSidebarConversationSession("work", input)
  } catch (error) {
    const winner = await Session.get(input.id).catch(() => undefined)
    if (!winner) throw error
    assertPanelCreationMetadata(winner, input.creationMetadata.panelCreation)
    return winner
  }
}

type RecoveredPanelCreationResult = {
  title: string
  output: string
  metadata: Record<string, unknown>
}

function recoveredUnavailablePanelCreationResult(input: {
  operation: "create_task" | "wake_mission" | "wake_work"
  targetID: string
  callerKind?: Session.Info["kind"]
}): RecoveredPanelCreationResult {
  return {
    title: "Accepted target unavailable",
    output: JSON.stringify({
      kind: "accepted_target_unavailable",
      operation: input.operation,
      target_id: input.targetID,
      message: `The accepted ${input.operation} target ${input.targetID} is no longer available.`,
    }),
    metadata:
      input.operation === "create_task" && input.callerKind === "mission"
        ? withImmediateParkToolResultControl({ truncated: false })
        : { truncated: false },
  }
}

function recoveredPanelCreationMetadata(input: {
  session: Session.Info
  operation: "wake_mission" | "wake_work"
  messageID: string
  part: Message.ToolPart
  params: unknown
}) {
  const raw = (input.session.metadata as { panelCreation?: unknown } | undefined)?.panelCreation
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined
  const parsed = PanelCreationFact.safeParse(raw)
  if (!parsed.success) throw new Error(`Session ${input.session.id} has an invalid persisted panel creation fact`)
  const value = parsed.data
  if (
    value.protocol !== "panel-creation-v1" ||
    value.operation !== input.operation ||
    value.tool_part_id !== input.part.id ||
    value.tool_call_id !== input.part.callID ||
    value.message_id !== input.messageID ||
    value.target_id !== panelCreationTargetID(input.operation, input.part.id) ||
    canonicalJSONValue(value.input, `Session ${input.session.id} persisted panel input`) !==
      canonicalJSONValue(input.params, `Session ${input.session.id} recovered panel input`)
  ) {
    throw new Error(`Session ${input.session.id} conflicts with persisted panel Tool occurrence ${input.part.id}`)
  }
  return value as {
    caller_user_message_id: string
  }
}

/** Recover only creation effects whose durable target was already accepted.
 * A pre-target interruption has no aggregate to replay and remains an ordinary
 * interrupted Tool. A post-target interruption completes the exact same wake,
 * caller receipt and visible Tool outcome. */
export async function recoverPanelCreationToolPart(input: {
  sessionID: string
  messageID: string
  agent: string
  part: Message.ToolPart
}): Promise<RecoveredPanelCreationResult | undefined> {
  const operation =
    input.part.tool === panelLeafToolID("create_task")
      ? "create_task"
      : input.part.tool === panelLeafToolID("wake_mission")
        ? "wake_mission"
        : input.part.tool === panelLeafToolID("wake_work")
          ? "wake_work"
          : undefined
  if (!operation) return undefined
  const params = z.record(z.string(), z.unknown()).parse(input.part.state.input)
  if (Object.hasOwn(params, "action")) {
    throw new Error(`Recovered ${input.part.tool} input must not repeat its Tool action`)
  }
  if (operation === "create_task") {
    let taskID: string | undefined
    try {
      taskID = taskIDForCreatorToolPart(input.part.id)
    } catch (error) {
      if (!TaskCreationAcceptedTargetUnavailableError.isInstance(error)) throw error
      const caller = await Session.get(input.sessionID)
      return recoveredUnavailablePanelCreationResult({
        operation: "create_task",
        targetID: error.data.taskID,
        callerKind: caller.kind,
      })
    }
    if (!taskID) return undefined
    const caller = await Session.get(input.sessionID)
    return {
      title: "Task created",
      output: JSON.stringify({
        kind: "created",
        task_id: taskID,
        artifact_import_mappings: EngineService.getCrossTaskArtifactImportMappings(taskID),
        message: `Task accepted: \`${taskID}\``,
      }),
      metadata:
        caller.kind === "mission" ? withImmediateParkToolResultControl({ truncated: false }) : { truncated: false },
    }
  }
  const callerSession = await Session.get(input.sessionID)
  const request = typeof params.request === "string" ? params.request : undefined
  if (!request) throw new Error(`Recovered panel.${operation} has no persisted request text`)

  if (operation === "wake_mission") {
    const missionID = panelCreationTargetID("wake_mission", input.part.id)
    const target = Database.use((db) => {
      const row = db
        .select()
        .from(SessionTable)
        .where(
          and(
            eq(SessionTable.project_id, Instance.project.id),
            sql`json_type(${SessionTable.metadata}, '$.panelCreation') IS NOT NULL`,
            sql`json_extract(${SessionTable.metadata}, '$.panelCreation.tool_part_id') = ${input.part.id}`,
          ),
        )
        .get()
      return row ? { session: Session.fromRow(row), deleted: Session.deletedInTransaction(db, row.id) } : undefined
    })
    if (!target) return undefined
    const missionSession = target.session
    const creation = recoveredPanelCreationMetadata({
      session: missionSession,
      operation: "wake_mission",
      messageID: input.messageID,
      part: input.part,
      params,
    })!
    if (target.deleted) {
      return recoveredUnavailablePanelCreationResult({ operation: "wake_mission", targetID: missionSession.id })
    }
    const frozenTarget = frozenPanelTargetModel(missionSession)
    const callerFileParts = await replayMissionCallerFileParts({
      callerSession,
      callerMessageID: creation.caller_user_message_id,
    })
    const attached = await attachMissionCaller({
      missionSessionID: missionSession.id,
      callerSession,
      callerMessageID: creation.caller_user_message_id,
    })
    await openMissionExecutionWithWake({
      missionID,
      sessionID: missionSession.id,
      source: "mission.wake",
      requestID: input.part.id,
      acceptedInput: {
        text: request,
        model: frozenTarget.modelID,
        attachments: missionOperatorAttachmentInputs(callerFileParts),
        configPatch: frozenTarget.overlay,
        context: {
          surface: "panel.wake_mission",
          callerSessionID: callerSession.id,
          callerMessageID: creation.caller_user_message_id,
          title: typeof params.title === "string" ? params.title : null,
          productPillar: missionProductPillar(missionSession),
          heldExpertSquadIDs: missionVisibleExpertSquadIDs(missionSession),
        },
      },
      wake: (admission) =>
        SessionWake.wakeWithReceipt({
          sessionID: missionSession.id,
          messageID: admission.messageID,
          textPartID: admission.textPartID,
          controlID: admission.controlID,
          prompt: request,
          author: input.agent,
          agent: "mission",
          model: frozenTarget.model,
          surface: "panel",
          parts: callerFileParts,
          reason: missionOperatorWakeReason(admission, missionID),
          commitBundle: admission.commitBundle,
          preflightBundle: admission.preflightBundle,
          ownerPreflight: admission.ownerPreflight,
          ownerLifecycle: admission.ownerLifecycle,
        }),
    })
    await publishMissionHandoff(attached)
    return {
      title: "Mission started",
      output: JSON.stringify({
        kind: "mission_wake",
        mission_id: missionID,
        session_id: missionSession.id,
        message: `Mission accepted: \`${missionID}\``,
      }),
      metadata: { truncated: false },
    }
  }

  const workSessionID = panelCreationTargetID("wake_work", input.part.id)
  const target = Database.use((db) => {
    const row = db
      .select()
      .from(SessionTable)
      .where(
        and(
          eq(SessionTable.id, workSessionID),
          eq(SessionTable.project_id, Instance.project.id),
          sql`json_type(${SessionTable.metadata}, '$.panelCreation') IS NOT NULL`,
          sql`json_extract(${SessionTable.metadata}, '$.panelCreation.tool_part_id') = ${input.part.id}`,
        ),
      )
      .get()
    return row ? { session: Session.fromRow(row), deleted: Session.deletedInTransaction(db, row.id) } : undefined
  })
  if (!target) return undefined
  const workSession = target.session
  const creation = recoveredPanelCreationMetadata({
    session: workSession,
    operation: "wake_work",
    messageID: input.messageID,
    part: input.part,
    params,
  })!
  if (target.deleted) {
    return recoveredUnavailablePanelCreationResult({ operation: "wake_work", targetID: workSession.id })
  }
  const callerFileParts = await replayMissionCallerFileParts({
    callerSession,
    callerMessageID: creation.caller_user_message_id,
  })
  await SessionWake.wakeWithReceipt({
    sessionID: workSession.id,
    messageID: Identifier.deterministic("message", `panel.wake_work\0${input.part.id}\0message`),
    textPartID: Identifier.deterministic("part", `panel.wake_work\0${input.part.id}\0text`),
    controlID: Identifier.deterministic("session_control", `panel.wake_work\0${input.part.id}\0control`),
    prompt: request,
    author: input.agent,
    agent: "work",
    surface: "right-sidebar",
    parts: callerFileParts,
    reason: {
      source: "conversation.handoff",
      callerSessionID: callerSession.id,
      callerMessageID: creation.caller_user_message_id,
      targetExperience: "work",
    },
  })
  await publishConversationHandoff({
    targetSession: await Session.get(workSession.id),
    callerSession,
    callerMessageID: creation.caller_user_message_id,
  })
  return {
    title: "Work started",
    output: JSON.stringify({
      kind: "work_wake",
      session_id: workSession.id,
      message: `Work accepted: \`${workSession.id}\``,
    }),
    metadata: { truncated: false },
  }
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
  executionMode:
    initCtx?.agentID === "mission"
      ? (input) => {
          const action = (input as { action?: unknown } | undefined)?.action
          if (typeof action !== "string") throw new Error("Mission panel execution requires one parsed action.")
          return panelActionKind(action) === "query" ? "ordinary" : "turn_control_exclusive"
        }
      : "ordinary",
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
      case "expert_squad_inspect": {
        if (actor !== "mission") {
          throw new Error(`panel.expert_squad_inspect is only permitted for Mission.`)
        }
        const missionSession = await Session.get(ctx.sessionID)
        const heldExpertSquadIDs = missionVisibleExpertSquadIDs(missionSession)
        if (!heldExpertSquadIDs.includes(params.id)) {
          throw new Error(`Mission does not hold Expert Squad ${JSON.stringify(params.id)}.`)
        }
        const projectDirectory = await EffectiveConfig.capabilityProjectDirectory({ sessionID: ctx.sessionID })
        const [candidate] = await PromptProfileResolver.recommendationCatalog({
          projectDirectory,
          productPillar: missionProductPillar(missionSession),
          restrictToExpertSquadIDs: [params.id],
        })
        const squad = candidate
          ? await PromptProfileResolver.catalogInspection({
              projectDirectory,
              id: candidate.id,
              workflowCursor: params.workflowCursor,
            })
          : undefined
        if (!squad) throw new Error(`Mission-held Expert Squad ${JSON.stringify(params.id)} is unavailable.`)
        return {
          title: "Expert Squad",
          output: JSON.stringify({ squad }),
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
        if (actor === "mission") {
          const mission = await requireMissionSession(ctx.sessionID)
          const tasks = listMissionTasks({
            projectID: mission.projectID,
            missionID: mission.missionID,
            sessionID: mission.id,
          })
          const boards = await Promise.all(tasks.map((task) => EngineService.getBoard(task.id)))
          return {
            title: "Mission Tasks",
            output:
              boards.length === 0
                ? "No Mission-owned tasks found."
                : boards
                    .map(
                      (board, index) => `${index + 1}. ${board.task.title} [${board.task.status}] (${board.task.id})`,
                    )
                    .join("\n"),
            metadata: { missionID: mission.missionID, count: boards.length },
          }
        }
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
        const transport = ArtifactReadReferenceInputSchema.parse(rawRead)
        const resolvedReference = resolvePanelArtifactLocatorReferenceBeforeRead({
          sessionID: ctx.sessionID,
          assistantMessageID: ctx.messageID,
          toolPartID: (await requirePanelToolIdentity(ctx, "read_task_artifact")).toolPartID,
          taskID,
          reference: transport.artifact_locator_ref,
        })
        const currentReference = requireCurrentTerminalLifecycleReference(taskID)
        if (!sameTerminalLifecycleReference(currentReference, resolvedReference.terminalLifecycleReference)) {
          throw new Error(
            `panel.read_task_artifact terminal occurrence changed for Task ${taskID}; query the current Task and Artifact catalog before reading`,
          )
        }
        const result = await EngineService.readMissionTaskArtifact({
          taskID,
          importer: { missionID: mission.missionID, sessionID: mission.id },
          read: ArtifactReadInputSchema.parse({
            locator: resolvedReference.locator,
            byte_offset: transport.byte_offset,
            max_bytes: transport.max_bytes,
            delivery: transport.delivery,
          }),
        })
        const settledReference = requireCurrentTerminalLifecycleReference(taskID)
        if (!sameTerminalLifecycleReference(settledReference, resolvedReference.terminalLifecycleReference)) {
          throw new Error(
            `panel.read_task_artifact terminal occurrence changed while reading Task ${taskID}; query the current Task and Artifact catalog again`,
          )
        }
        const transportChunk = ArtifactReadReferenceChunkSchema.extend({
          taskID: z.string().min(1),
          terminal_lifecycle_reference: TerminalLifecycleReferenceSchema,
        }).parse({
          ...result.chunk,
          taskID,
          terminal_lifecycle_reference: settledReference,
          artifact_transport_version: 2,
          artifact_locator_ref: transport.artifact_locator_ref,
          artifact_read_ref: mintArtifactReadReference(),
        })
        return {
          title: "Task Artifact",
          output: JSON.stringify(transportChunk),
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
        const identity = await requirePanelToolIdentity(ctx, "complete_mission")
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
            toolPartID: identity.toolPartID,
            taskID: acceptance.task_id,
          })
          if (
            resolveTerminalLifecycleReference(acceptance.task_id, currentReference).terminalStatus !== "completed" ||
            !sameTerminalLifecycleReference(currentReference, reviewedReference)
          ) {
            throw new Error(
              `panel.complete_mission Task ${acceptance.task_id} must cite its exact current completed occurrence.`,
            )
          }
          const evidenceLocators = resolvePanelArtifactReadReferencesBeforeAction({
            sessionID: ctx.sessionID,
            assistantMessageID: ctx.messageID,
            toolPartID: identity.toolPartID,
            taskID: acceptance.task_id,
            terminalLifecycleReference: reviewedReference,
            references: acceptance.evidence_read_refs,
          })
          authoritativeAcceptances.push({
            task_id: acceptance.task_id,
            evidence_locators: evidenceLocators,
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
        if (actor === "mission") {
          requireMissionTaskSemanticTitle(params.title)
        }
        if (params.artifact_sources && params.artifact_sources.length > 0 && actor !== "mission") {
          throw new Error("panel.create_task artifact_sources is only available to a real Mission")
        }
        const taskCreator = await resolvePanelTaskCreator(actor, ctx)
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
        if (panelUIRequest && params.request_id !== undefined && params.request_id !== panelUIRequest.requestID) {
          throw new Error("panel.create_task request_id conflicts with the server-owned Panel UI request identity.")
        }
        const taskID = await EngineService.createTask(
          {
            requestID: panelUIRequest
              ? panelUIRequest.requestID
              : (params.request_id ??
                (actor === "control_agent" ? controlContext(ctx).requestID : ctx.extra?.requestID)),
            artifactSources: params.artifact_sources,
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
            artifact_import_mappings: EngineService.getCrossTaskArtifactImportMappings(taskID),
            message: `Task accepted: \`${taskID}\``,
          }),
          metadata: actor === "mission" ? withImmediateParkToolResultControl({}) : {},
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
        const toolIdentity = await requirePanelToolIdentity(ctx, "wake_mission")
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
        const missionID = panelCreationTargetID("wake_mission", toolIdentity.toolPartID)
        const creationMetadata = panelCreationMetadata({
          operation: "wake_mission",
          toolIdentity,
          params,
          callerUserMessageID: callerMessageID,
        })
        const capabilityProjectDirectory = await EffectiveConfig.capabilityProjectDirectory({
          sessionID: callerSession.id,
        })
        const heldExpertSquadIDs = await resolveMissionLaunchExpertSquadIDs({
          projectDirectory: capabilityProjectDirectory,
          productPillar: rightSidebarConversationExperience(callerSession) === "work" ? "work" : "code",
        })
        // The title and model overlay are resolved BEFORE the Session exists
        // and commit in its insert, so a Mission Session is never published
        // carrying the base model with its real one still unwritten.
        const callerModel = await resolveConfiguredModelRef({ sessionID: callerSession.id })
        const intendedModel = `${callerModel.providerID}/${callerModel.modelID}`
        const intendedOverlay = await initialForwardedConversationOverlay(intendedModel)
        const missionSession = await ensureMissionSession({
          missionID,
          defaultCwd: callerSession.directory,
          productPillar: rightSidebarConversationExperience(callerSession) === "work" ? "work" : "code",
          heldExpertSquadIDs,
          initialTitle: params.title,
          initialConfigOverlay: intendedOverlay,
          creationMetadata,
        })
        assertPanelCreationMetadata(missionSession, creationMetadata.panelCreation)
        if (params.title && missionSession.title !== params.title) {
          await Session.setTitle({ sessionID: missionSession.id, title: params.title })
        }
        const attachedMissionSession = await attachMissionCaller({
          missionSessionID: missionSession.id,
          callerSession,
          callerMessageID,
        })
        await openMissionExecutionWithWake({
          missionID,
          sessionID: missionSession.id,
          source: "mission.wake",
          requestID: toolIdentity.toolPartID,
          acceptedInput: {
            text: params.request,
            model: intendedModel,
            attachments: missionOperatorAttachmentInputs(callerFileParts),
            configPatch: intendedOverlay,
            context: {
              surface: "panel.wake_mission",
              callerSessionID: callerSession.id,
              callerMessageID,
              title: params.title ?? null,
              productPillar: rightSidebarConversationExperience(callerSession) === "work" ? "work" : "code",
              heldExpertSquadIDs,
            },
          },
          wake: (admission) =>
            (missionWakeForTest ?? SessionWake.wakeWithReceipt)({
              sessionID: missionSession.id,
              messageID: admission.messageID,
              textPartID: admission.textPartID,
              controlID: admission.controlID,
              prompt: params.request,
              author: ctx.agent,
              agent: "mission",
              model: callerModel,
              surface: "panel",
              parts: callerFileParts,
              reason: missionOperatorWakeReason(admission, missionID),
              commitBundle: admission.commitBundle,
              preflightBundle: admission.preflightBundle,
              ownerPreflight: admission.ownerPreflight,
              ownerLifecycle: admission.ownerLifecycle,
            }),
        })
        await publishMissionHandoff(attachedMissionSession)
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
        const toolIdentity = await requirePanelToolIdentity(ctx, "wake_work")
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
        const callerModel = await resolveConfiguredModelRef({ sessionID: callerSession.id })
        const creationMetadata = panelCreationMetadata({
          operation: "wake_work",
          toolIdentity,
          params,
          callerUserMessageID: callerMessageID,
        })
        const workSession = await ensurePanelWorkSession({
          id: panelCreationTargetID("wake_work", toolIdentity.toolPartID),
          title: params.title,
          configOverlay: await initialForwardedConversationOverlay(`${callerModel.providerID}/${callerModel.modelID}`),
          creationMetadata,
        })
        await SessionWake.wakeWithReceipt({
          sessionID: workSession.id,
          messageID: Identifier.deterministic("message", `panel.wake_work\0${toolIdentity.toolPartID}\0message`),
          textPartID: Identifier.deterministic("part", `panel.wake_work\0${toolIdentity.toolPartID}\0text`),
          controlID: Identifier.deterministic(
            "session_control",
            `panel.wake_work\0${toolIdentity.toolPartID}\0control`,
          ),
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
        await publishConversationHandoff({
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
        const identity = await requirePanelToolIdentity(ctx, "resume_task")
        const reviewedTerminalLifecycleReference = reviewedTerminalLifecycleReferenceBeforePanelAction({
          sessionID: ctx.sessionID,
          assistantMessageID: ctx.messageID,
          toolPartID: identity.toolPartID,
          taskID: params.taskID,
        })
        const evidenceByReadReference = new Map(
          acceptanceGapReadReferences(params.acceptance_gap).map((reference) => {
            const resolved = resolvePanelArtifactReadReferencesBeforeAction({
              sessionID: ctx.sessionID,
              assistantMessageID: ctx.messageID,
              toolPartID: identity.toolPartID,
              taskID: params.taskID,
              terminalLifecycleReference: reviewedTerminalLifecycleReference,
              references: [reference],
            })
            const locator = resolved[0]
            if (!locator) throw new Error(`Mission acceptance evidence reference ${reference} did not resolve.`)
            return [reference, locator] as const
          }),
        )
        const acceptanceGap = materializeMissionAcceptanceGap({
          gap: params.acceptance_gap,
          reviewedTerminalLifecycleReference,
          evidenceByReadReference,
        })
        const evidenceLocators = acceptanceGapEvidenceLocators(acceptanceGap)
        const result = await EngineService.resumeMissionTask({
          taskID: params.taskID,
          importer: {
            missionID: mission.missionID,
            sessionID: mission.id,
            messageID: identity.messageID,
            toolCallID: identity.toolCallID,
          },
          reviewedTerminalLifecycleReference,
          expectedAcceptanceLedgerArtifactID: params.acceptance_gap.current_ledger_revision_artifact_id,
          acceptanceGap,
          completeEvidenceLocators: evidenceLocators,
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
            ? {
                decision: params.reply === "always" ? ("allow_project" as const) : ("allow_once" as const),
                autoReply: false,
              }
            : params.message
              ? { message: params.message, autoReply: false }
              : { decision: "allow_once", autoReply: false },
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
        const target = await Session.getInProject({ sessionID: params.sessionID, projectID: Instance.project.id })
        assertPublicSessionOperationAuthority(target, "session.fork")
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
        let deletion = await EngineService.replaySessionDeletion(params.sessionID, {
          projectID: Instance.project.id,
          authority: { surface: "panel" },
        })
        if (!deletion) {
          const target = await Session.getInProject({ sessionID: params.sessionID, projectID: Instance.project.id })
          assertPublicSessionOperationAuthority(target, "session.delete")
          deletion = await EngineService.deleteSession(params.sessionID, {
            deleteTasks: true,
            cancellationOrigin: {
              ...deletionIdentity,
              source: "session.delete",
              surface,
              reason: "Session deletion requested",
            },
          })
        }
        const retained = deletion.sessionHistoryRetained
        const pendingRuntimeCleanup = deletion.status === "physically_deleted_with_residue"
        return {
          title: retained ? "Session retired" : pendingRuntimeCleanup ? "Session cleanup pending" : "Session deleted",
          output: JSON.stringify({
            kind: "panel_response",
            session_id: params.sessionID,
            deletion,
            message: retained
              ? `Session retired with immutable Session history and authorization audit: ${params.sessionID}`
              : pendingRuntimeCleanup
                ? `Session causal history deleted; authorization audit retained; conversation runtime cleanup remains pending for ${params.sessionID}`
                : `Session causal history and conversation runtime deleted; authorization audit retained: ${params.sessionID}`,
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

/** Model-facing Panel leaves. The umbrella remains only for the non-model UI route. */
export const PanelLeafTools = Object.freeze(
  PANEL_ACTIONS.map(({ action }) =>
    Tool.define(panelLeafToolID(action), async (initCtx) => {
      const capability = panelLeafCapability(action)
      const umbrella = await PanelTool.init(initCtx)
      return {
        description: capability.description,
        parameters: panelLeafActionSchemaForAgent(action, initCtx?.agentID),
        executionMode:
          initCtx?.agentID === "mission" && capability.kind === "mutation"
            ? ("turn_control_exclusive" as const)
            : ("ordinary" as const),
        async execute(params: Record<string, unknown>, ctx: Tool.Context) {
          return umbrella.execute({ action, ...params } as never, ctx)
        },
      }
    }),
  ),
)
