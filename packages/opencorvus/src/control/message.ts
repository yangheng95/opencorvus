import z from "zod"
import { PrimaryAssistantRegistry } from "@/agent/primary-assistant-registry"
import { Provider } from "@/provider/provider"
import { Session } from "@/session"
import { Message } from "@/session"
import { SessionPrompt } from "@/session/prompt"
import { MessageStore } from "@/session/message-store"
import { Database, and, eq } from "@/storage/db"
import { EngineTaskTable } from "@/engine"
import { ControlMessageInput, ControlMessageResult, PanelMessageStreamEvent } from "./message-schema"
import { ControlPromptContext, withControlPromptContext } from "./prompt"
import { Bus } from "@/bus"
import { Log } from "@/util/log"
import { Instance } from "@/project/instance"
import { ChannelId } from "@/channel/catalog"
import { createExecutionCancellationOrigin } from "@/session/prompt/cancellation"

const log = Log.create({ service: "control-message" })

type StreamCallback = (event: z.output<typeof PanelMessageStreamEvent>) => void
type RunResult = { type: "completed"; result: z.infer<typeof ControlMessageResult> } | { type: "aborted" }
type SessionInfo = Awaited<ReturnType<typeof Session.create>>
type ControlSession = {
  info: SessionInfo
  created: boolean
}

export namespace ControlMessage {
  export async function handle(raw: z.input<typeof ControlMessageInput>) {
    const input = ControlMessageInput.parse(raw)
    const runResult = await run(input)
    if (runResult.type !== "completed") throw new Error("Non-streaming control message aborted unexpectedly")
    return runResult.result
  }

  export async function handleStream(
    raw: z.input<typeof ControlMessageInput>,
    onEvent: StreamCallback,
    options: { signal: AbortSignal },
  ) {
    const input = ControlMessageInput.parse(raw)
    const runResult = await run(input, onEvent, options)
    return runResult.type === "completed" ? runResult.result : undefined
  }
}

async function run(
  input: z.infer<typeof ControlMessageInput>,
  onEvent?: StreamCallback,
  streamOptions?: { signal: AbortSignal },
) {
  const payload = loggedInput(input)
  log.info("panel request received", {
    input: payload,
    stream: !!onEvent,
  })
  const model = await resolveModel(input.model)

  let control: ControlSession | undefined
  let promptOwner: AbortSignal | undefined
  let abortSettle: Promise<boolean> | undefined
  let abortListener: (() => void) | undefined

  const unsubs: (() => void)[] = []

  try {
    control = await resolveSession(input)
    const controlSession = control
    if (streamOptions?.signal.aborted) return { type: "aborted" } satisfies RunResult
    if (streamOptions) SessionPrompt.assertNoOwnedPrompt(controlSession.info.id)
    const settleOwnedPrompt = () => {
      if (!promptOwner || !streamOptions) return
      abortSettle ??= import("@/engine/cancellation-scope").then(({ terminateOwnedSessionPromptInScope }) =>
        terminateOwnedSessionPromptInScope({
          session: controlSession.info,
          owner: promptOwner!,
          origin: createExecutionCancellationOrigin({
            actor: "control_agent",
            source: "control.message_stream_disconnect",
            surface: input.surface,
            requestID: input.request_id,
            reason: "panel message stream request aborted",
            targetSessionID: controlSession.info.id,
            ...(input.taskID ? { taskID: input.taskID } : {}),
          }),
          handle: "ControlMessage.handleStream.abort",
        }),
      )
    }
    if (streamOptions) {
      abortListener = settleOwnedPrompt
      streamOptions.signal.addEventListener("abort", abortListener, { once: true })
    }
    log.info(control.created ? "panel control session created" : "panel control session reused", {
      input: payload,
      panel_session: control.info,
      stream: !!onEvent,
    })

    if (onEvent) {
      unsubs.push(
        Bus.subscribe(Message.Event.PartUpdated, (event) => {
          if (streamOptions?.signal.aborted) return
          const part = event.properties.part as Record<string, unknown>
          if (part.sessionID !== control?.info.id) return
          if (part.type === "tool") {
            onEvent(PanelMessageStreamEvent.parse({ type: "tool", tool: part.tool }))
          }
        }),
      )
      onEvent(PanelMessageStreamEvent.parse({ type: "start" }))
    }

    const agent = "control"
    const parts = buildUserParts(input)
    const promptContext = controlPromptContextForMessage(input)
    const existingMessageIDs = new Set(
      (await Session.messages({ sessionID: controlSession.info.id })).map((message) => message.info.id),
    )

    const executePrompt = () =>
      withControlPromptContext(controlSession.info.id, promptContext, () =>
        SessionPrompt.prompt({
          sessionID: controlSession.info.id,
          author: "user",
          agent,
          model,
          byteMaterializationProjectID: controlSession.info.projectID,
          parts: parts as any,
        }),
      )
    const result = await (streamOptions
      ? SessionPrompt.withPromptOwnerCapture((owner) => {
          if (promptOwner) return
          promptOwner = owner
          if (streamOptions.signal.aborted) settleOwnedPrompt()
        }, executePrompt)
      : executePrompt())

    if (result.info.role !== "assistant") {
      throw new Error(`Control message ended with unexpected ${result.info.role} message ${result.info.id}`)
    }
    const providerError = assistantErrorText(result)
    if (providerError) throw new Error(providerError)
    const turnMessages = (await Session.messages({ sessionID: controlSession.info.id })).filter(
      (message) => !existingMessageIDs.has(message.info.id),
    )
    const output = buildResult({
      control: controlSession,
      finalMessage: result,
      turnMessages,
    })
    log.info("panel request completed", {
      input: payload,
      panel_session_id: controlSession.info.id,
      result: loggedResult(output),
    })
    return { type: "completed", result: output } satisfies RunResult
  } catch (error) {
    if (streamOptions?.signal.aborted) return { type: "aborted" } satisfies RunResult
    log.error("panel request failed", {
      input: payload,
      panel_session_id: control?.info.id,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  } finally {
    if (streamOptions && abortListener) streamOptions.signal.removeEventListener("abort", abortListener)
    if (abortSettle) await abortSettle
    for (const unsub of unsubs) unsub()
  }
}

export function controlPromptContextForMessage(input: z.infer<typeof ControlMessageInput>) {
  serverChannelBinding(input)
  return ControlPromptContext.parse({
    surface: input.surface,
    taskID: input.taskID,
    sessionID: input.sessionID,
    channel: input.channel,
    thread: input.thread,
    userID: input.user_id,
    source: input.source,
    allowCreate: input.allow_create,
    requestID: input.request_id,
  })
}

async function resolveModel(explicitModel?: string) {
  // Control messages always execute as the fixed control primary. Their model
  // must resolve from that same identity rather than the user's default coding
  // assistant.
  const { resolveAgentModelRef } = await import("@/agent/model")
  const control = await PrimaryAssistantRegistry.get("control")
  return resolveAgentModelRef(control.name, {
    explicitModel: explicitModel ? Provider.parseModel(explicitModel) : null,
  })
}

function buildUserParts(input: z.infer<typeof ControlMessageInput>) {
  const parts: Array<Record<string, unknown>> = [
    {
      type: "text" as const,
      text: input.text,
    },
  ]
  if (input.attachments?.length) {
    for (const att of input.attachments) {
      parts.push({
        type: "file" as const,
        mime: att.mime,
        url: att.url,
        ...(att.filename ? { filename: att.filename } : {}),
      })
    }
  }
  return parts
}

function assistantErrorText(message: Message.WithParts) {
  if (message.info.role !== "assistant" || !message.info.error) return
  const source = `${message.info.providerID}/${message.info.modelID}`
  const error = message.info.error
  const status =
    "statusCode" in error.data && typeof error.data.statusCode === "number" ? `, status ${error.data.statusCode}` : ""
  const detail = "message" in error.data && typeof error.data.message === "string" ? error.data.message : undefined
  if (detail) return `Provider error (${source}${status}): ${detail}`
  return `Provider error (${source}): ${error.name}`
}

function serverChannelBinding(input: z.infer<typeof ControlMessageInput>) {
  const platform = ChannelId.safeParse(input.surface)
  if (!platform.success) return undefined
  if (!input.channel || !input.thread) {
    throw new Error(`Control channel surface "${platform.data}" requires channel and thread.`)
  }
  return {
    platform: platform.data,
    channel: input.channel,
    thread: input.thread,
  }
}

async function resolveSession(input: z.infer<typeof ControlMessageInput>) {
  const reusable = input.surface === "panel" && !input.taskID
  if (reusable && input.sessionID) {
    return {
      info: await Session.getInProject({ sessionID: input.sessionID, projectID: Instance.project.id }),
      created: false,
    } satisfies ControlSession
  }
  const parentID = input.taskID ? taskScope(input.taskID)?.sessionID : undefined
  const info = await Session.create({
    kind: "assistant",
    title: `Panel control (${input.surface})`,
    ...(parentID ? { parentID } : {}),
  })
  return {
    info,
    created: true,
  } satisfies ControlSession
}

const PanelToolObservation = z
  .object({
    kind: ControlMessageResult.shape.kind.optional(),
    task_id: z.string().optional(),
    interaction_id: z.string().optional(),
    session_id: z.string().optional(),
    local_action: ControlMessageResult.shape.local_action,
    attachments: ControlMessageResult.shape.attachments,
  })
  .strip()

function buildResult(input: {
  control: ControlSession
  finalMessage: Message.WithParts
  turnMessages: Message.WithParts[]
}): z.infer<typeof ControlMessageResult> {
  const toolResultRefs: z.infer<typeof ControlMessageResult>["tool_result_refs"] = []
  let observation: z.infer<typeof PanelToolObservation> | undefined
  for (const message of input.turnMessages) {
    for (const part of message.parts) {
      if (part.type !== "tool" || part.tool !== "panel" || part.state.status !== "completed") continue
      toolResultRefs.push({
        session_id: part.sessionID,
        message_id: part.messageID,
        part_id: part.id,
        call_id: part.callID,
        tool_name: part.tool,
      })
      try {
        const parsed = PanelToolObservation.safeParse(JSON.parse(part.state.output))
        if (parsed.success) observation = parsed.data
      } catch {
        // The durable tool part remains the fact even when its output is not a
        // panel action projection. Do not turn a completed physical call into
        // a Control Agent failure.
      }
    }
  }

  return ControlMessageResult.parse({
    kind: observation?.kind ?? "panel_response",
    message_id: input.finalMessage.info.id,
    control_session_id: input.control.info.id,
    tool_result_refs: toolResultRefs,
    ...(observation?.task_id ? { task_id: observation.task_id } : {}),
    ...(observation?.interaction_id ? { interaction_id: observation.interaction_id } : {}),
    ...(observation?.session_id ? { session_id: observation.session_id } : {}),
    ...(observation?.local_action ? { local_action: observation.local_action } : {}),
    ...(observation?.attachments ? { attachments: observation.attachments } : {}),
  })
}

function taskScope(taskID?: string) {
  if (!taskID) return
  const row = Database.use((db) =>
    db
      .select({ taskID: EngineTaskTable.id, sessionID: EngineTaskTable.session_id })
      .from(EngineTaskTable)
      .where(and(eq(EngineTaskTable.id, taskID), eq(EngineTaskTable.project_id, Instance.project.id)))
      .get(),
  )
  return row
}

function loggedInput(input: z.infer<typeof ControlMessageInput>) {
  return {
    surface: input.surface,
    text: input.text,
    ...(input.taskID ? { taskID: input.taskID } : {}),
    ...(input.sessionID ? { sessionID: input.sessionID } : {}),
    ...(input.model ? { model: input.model } : {}),
    ...(input.channel ? { channel: input.channel } : {}),
    ...(input.thread ? { thread: input.thread } : {}),
    ...(input.user_id ? { user_id: input.user_id } : {}),
    ...(input.request_id ? { request_id: input.request_id } : {}),
    ...(input.source ? { source: input.source } : {}),
    allow_create: input.allow_create,
  }
}

function loggedResult(result: z.infer<typeof ControlMessageResult>) {
  return {
    kind: result.kind,
    message_id: result.message_id,
    control_session_id: result.control_session_id,
    ...(result.task_id ? { task_id: result.task_id } : {}),
    ...(result.session_id ? { session_id: result.session_id } : {}),
    ...(result.interaction_id ? { interaction_id: result.interaction_id } : {}),
    ...(result.local_action ? { local_action: result.local_action } : {}),
    ...(result.attachments ? { attachments: result.attachments } : {}),
  }
}

export async function controlFinalMessageText(
  result: Pick<z.infer<typeof ControlMessageResult>, "control_session_id" | "message_id">,
): Promise<string> {
  const message = await MessageStore.get({
    sessionID: result.control_session_id,
    messageID: result.message_id,
  })
  if (message.info.role !== "assistant") {
    throw new Error(`Control final message ${result.message_id} is not an assistant message`)
  }
  return message.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n")
    .trim()
}
