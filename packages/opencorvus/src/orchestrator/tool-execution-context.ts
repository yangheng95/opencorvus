import z from "zod"
import { taskIDForSession } from "@/engine/task-session-lineage"
import { requireTask, type TaskRow } from "@/engine/store"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { MessageStore } from "@/session/message-store"

export type OrchestratorToolExecutionContext = {
  orchestratorSessionID: string
  orchestratorMessageID: string
  toolCallID: string
  toolPartID: string
  visibleToolName: string
  collectionMember?: { index: number; count: number }
}

type TaskOrchestratorToolExecutionExpectation = {
  taskID: string
  agentSessionID: string
}

export type TaskWithRootSession = TaskRow & { session_id: string }

export async function assertTaskRootSessionLineageForConfig(task: TaskRow): Promise<TaskWithRootSession> {
  if (!task.session_id) throw new Error(`Task ${task.id} has no root session`)
  await Session.assertLineageInProject({ sessionID: task.session_id, projectID: task.project_id })
  return task as TaskWithRootSession
}

export function optionsWithVisibleOrchestratorToolName(
  options: unknown,
  visibleToolName: string,
): unknown {
  const record = options && typeof options === "object" && !Array.isArray(options) ? options : {}
  const meta =
    (record as { opencorvus?: unknown }).opencorvus &&
    typeof (record as { opencorvus?: unknown }).opencorvus === "object" &&
    !Array.isArray((record as { opencorvus?: unknown }).opencorvus)
      ? (record as { opencorvus: Record<string, unknown> }).opencorvus
      : {}
  return {
    ...(record as object),
    opencorvus: {
      ...meta,
      visibleToolName,
    },
  }
}

/**
 * The identity the Session loop attaches to every projected Orchestrator tool
 * call. Named and parsed in one place: this used to be four independent
 * `typeof` narrowings over an `unknown` bag, each defaulting to `""` before a
 * combined emptiness check, so a renamed field degraded into the same error as
 * a genuinely absent one.
 */
export const OrchestratorToolInvocationSchema = z
  .object({
    sessionID: z.string().min(1),
    messageID: z.string().min(1),
    toolCallID: z.string().min(1),
    toolPartID: z.string().min(1),
    visibleToolName: z.string().min(1).optional(),
    collectionMember: z
      .object({
        index: z.number().int().min(0),
        count: z.number().int().min(1),
      })
      .strict()
      .optional(),
  })
  .loose()

export type OrchestratorToolInvocation = z.infer<typeof OrchestratorToolInvocationSchema>

export function requireOrchestratorToolExecutionContext(
  options: unknown,
  toolName: string,
): OrchestratorToolExecutionContext {
  const meta = (options as { opencorvus?: unknown } | undefined)?.opencorvus
  const parsed = OrchestratorToolInvocationSchema.safeParse(meta)
  if (!parsed.success) {
    throw new Error(
      `${toolName}: missing real tool execution identity; refusing to run because ownership cannot be tied to a persisted message/tool part. ` +
        `received: ${JSON.stringify(meta)}, expected: ${z.prettifyError(parsed.error)}`,
    )
  }
  if (parsed.data.collectionMember && parsed.data.collectionMember.index >= parsed.data.collectionMember.count) {
    throw new Error(`${toolName}: collection member index must be smaller than its count.`)
  }
  return {
    orchestratorSessionID: parsed.data.sessionID,
    orchestratorMessageID: parsed.data.messageID,
    toolCallID: parsed.data.toolCallID,
    toolPartID: parsed.data.toolPartID,
    visibleToolName: parsed.data.visibleToolName ?? toolName,
    ...(parsed.data.collectionMember ? { collectionMember: parsed.data.collectionMember } : {}),
  }
}

export async function requireTaskOrchestratorToolExecutionContext(
  options: unknown,
  toolName: string,
  expected: TaskOrchestratorToolExecutionExpectation,
): Promise<OrchestratorToolExecutionContext> {
  const toolExecution = requireOrchestratorToolExecutionContext(options, toolName)
  const sdkToolCallID =
    typeof (options as { toolCallId?: unknown } | undefined)?.toolCallId === "string"
      ? (options as { toolCallId: string }).toolCallId
      : ""
  if (!sdkToolCallID || sdkToolCallID !== toolExecution.toolCallID) {
    throw new Error(
      `${toolName}: tool execution identity callID does not match the AI SDK tool call identity; refusing to write an unauditable A2A response.`,
    )
  }
  if (toolExecution.orchestratorSessionID !== expected.agentSessionID) {
    throw new Error(
      `${toolName}: tool execution identity session ${toolExecution.orchestratorSessionID} does not match current orchestrator session ${expected.agentSessionID}.`,
    )
  }
  const owningTaskID = taskIDForSession(toolExecution.orchestratorSessionID)
  if (owningTaskID !== expected.taskID) {
    throw new Error(
      `${toolName}: tool execution identity session ${toolExecution.orchestratorSessionID} belongs to task ${owningTaskID ?? "unknown"}, not ${expected.taskID}.`,
    )
  }
  const task = await assertTaskRootSessionLineageForConfig(requireTask(expected.taskID))
  await Session.assertLineageInProject({
    sessionID: toolExecution.orchestratorSessionID,
    projectID: task.project_id,
  })

  let message: Message.WithParts
  try {
    message = await MessageStore.get({
      sessionID: toolExecution.orchestratorSessionID,
      messageID: toolExecution.orchestratorMessageID,
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(
      `${toolName}: persisted orchestrator message ${toolExecution.orchestratorMessageID} was not found in session ${toolExecution.orchestratorSessionID}; ${detail}`,
    )
  }
  if (message.info.role !== "assistant") {
    throw new Error(
      `${toolName}: persisted orchestrator message ${toolExecution.orchestratorMessageID} is ${message.info.role}, not assistant.`,
    )
  }
  const part = message.parts.find((candidate) => candidate.id === toolExecution.toolPartID)
  if (!part) {
    throw new Error(
      `${toolName}: persisted tool part ${toolExecution.toolPartID} was not found on orchestrator message ${toolExecution.orchestratorMessageID}.`,
    )
  }
  if (part.type !== "tool" || part.callID !== toolExecution.toolCallID || part.tool !== toolExecution.visibleToolName) {
    throw new Error(
      `${toolName}: persisted tool part ${toolExecution.toolPartID} does not match visible tool=${toolExecution.visibleToolName} callID=${toolExecution.toolCallID}.`,
    )
  }
  return toolExecution
}
