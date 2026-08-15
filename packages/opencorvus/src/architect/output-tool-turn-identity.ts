import { assertTaskAssistantProducerToolPart } from "@/engine/producer-turn"
import { Instance } from "@/project/instance"

/** Validate the exact persisted producer identity injected by SessionLoop for
 * every Architect-owned output Tool. */
export function assertArchitectOutputToolTurnIdentity(input: {
  taskID: string
  toolName: string
  options: unknown
}): { sessionID: string; messageID: string; toolPartID: string } {
  const options = input.options as
    | {
        toolCallId?: unknown
        opencorvus?: Record<string, unknown>
      }
    | undefined
  const meta = options?.opencorvus
  const projectID = typeof meta?.projectID === "string" ? meta.projectID : ""
  const sessionID = typeof meta?.sessionID === "string" ? meta.sessionID : ""
  const messageID = typeof meta?.messageID === "string" ? meta.messageID : ""
  const toolCallID = typeof meta?.toolCallID === "string" ? meta.toolCallID : ""
  const toolPartID = typeof meta?.toolPartID === "string" ? meta.toolPartID : ""
  const providerName = typeof meta?.providerName === "string" ? meta.providerName : ""
  if (!projectID || !sessionID || !messageID || !toolCallID || !toolPartID || !providerName) {
    throw new Error(
      `${input.toolName}: Architect output tool is missing persisted project/session/message/call/part/tool identity.`,
    )
  }
  if (projectID !== Instance.project.id) {
    throw new Error(
      `${input.toolName}: Architect output tool project ${projectID} does not match current project ${Instance.project.id}.`,
    )
  }
  if (providerName !== input.toolName) {
    throw new Error(
      `${input.toolName}: Architect output tool provider ${providerName} does not match the visible tool name.`,
    )
  }
  if (options?.toolCallId !== toolCallID) {
    throw new Error(
      `${input.toolName}: Architect output tool Software Development Kit call identifier does not match persisted identity.`,
    )
  }
  assertTaskAssistantProducerToolPart({
    taskID: input.taskID,
    sessionID,
    messageID,
    expectedSessionKind: "architect",
    toolPartID,
    toolCallID,
    visibleToolName: input.toolName,
  })
  return { sessionID, messageID, toolPartID }
}
