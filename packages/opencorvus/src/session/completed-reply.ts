import { Message } from "./message"
import { MessageStore } from "./message-store"
import { toolResultControl } from "./tool-result-control"

export function isSettledReplyToUserMessage(
  message: Message.WithParts,
  userMessageID: string,
): message is Message.WithParts & { info: Message.Assistant } {
  const committedTurnControl = message.parts.some(
    (part) =>
      part.type === "tool" &&
      part.state.status === "completed" &&
      toolResultControl(part.state.metadata) !== undefined,
  )
  return (
    message.info.role === "assistant" &&
    Message.acceptsInputMessage(message.info, userMessageID) &&
    message.info.time.completed !== undefined &&
    Boolean(message.info.finish) &&
    (message.info.finish !== "tool-calls" || committedTurnControl) &&
    message.info.summary !== true
  )
}

export function isCompletedReplyToUserMessage(
  message: Message.WithParts,
  userMessageID: string,
): message is Message.WithParts & { info: Message.Assistant } {
  return (
    isSettledReplyToUserMessage(message, userMessageID) &&
    message.info.finish !== "error" &&
    message.info.error === undefined
  )
}

export async function completedReplyToUserMessage(
  sessionID: string,
  userMessageID: string,
  includeFailedReply: boolean,
): Promise<Message.WithParts | undefined> {
  for await (const message of MessageStore.stream(sessionID)) {
    if (
      isCompletedReplyToUserMessage(message, userMessageID) ||
      (includeFailedReply && isSettledReplyToUserMessage(message, userMessageID))
    ) {
      return message
    }
    if (message.info.id === userMessageID) return undefined
  }
  return undefined
}
