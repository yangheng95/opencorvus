import { Message } from "@/session/message"
import { MessageStore } from "@/session/message-store"

export namespace SessionMemory {
  export const filename = "MEMORY.MD"

  export interface Document {
    filename: typeof filename
    sourceMessageID: string
    content: string
    timeCreated: number
    timeUpdated: number
  }

  export function continuationText(parts: Message.Part[]) {
    return Message.compactionContinuationTextParts(parts)
      .map((part) => part.text)
      .join("\n\n")
  }

  function content(message: Message.WithParts) {
    const content = continuationText(message.parts)
    if (!content.trim()) {
      throw new Error(`Session MEMORY.MD source ${message.info.id} has no visible Markdown content`)
    }
    return content
  }

  export async function read(sessionID: string): Promise<Document | null> {
    for await (const message of MessageStore.stream(sessionID)) {
      if (message.info.role !== "assistant") continue
      if (message.info.summary !== true || message.info.time.completed === undefined) continue
      if (!message.parts.some((part) => part.type === "compaction")) continue
      const parent = await MessageStore.get({ sessionID, messageID: message.info.parentID })
      if (parent.info.role !== "user") continue
      return {
        filename,
        sourceMessageID: message.info.id,
        content: content(message),
        timeCreated: message.info.time.created,
        timeUpdated: message.info.time.completed,
      }
    }
    return null
  }
}
