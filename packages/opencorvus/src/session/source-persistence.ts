import { Identifier } from "@/id/id"
import { Session } from "."
import { Message } from "./message"
import { MessageStore } from "./message-store"

/** Persist source facts once per semantic source identity within a real assistant message. */
export async function persistMessageSources(input: {
  sessionID: string
  messageID: string
  sources: readonly unknown[]
}): Promise<Message.SourcePart[]> {
  const payloads = input.sources.map((source) => Message.SourcePayload.parse(source))
  const existingSources = new Set(
    (await MessageStore.parts(input.messageID)).flatMap((part) =>
      part.type === "source-url" || part.type === "source-document" || part.type === "source-file"
        ? [`${part.type}\0${part.sourceId}`]
        : [],
    ),
  )
  const created: Message.SourcePart[] = []
  for (const source of payloads) {
    const key = `${source.type}\0${source.sourceId}`
    if (existingSources.has(key)) continue
    const persisted = await Session.updatePart({
      ...source,
      id: Identifier.ascending("part"),
      sessionID: input.sessionID,
      messageID: input.messageID,
    })
    created.push(persisted as Message.SourcePart)
    existingSources.add(key)
  }
  return created
}
