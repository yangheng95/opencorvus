import { Identifier } from "@/id/id"
import { Database } from "@/storage/db"
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
  // Reserve the SQLite writer before reading identities, including across
  // separate permission continuations. Publication follows the same commit.
  return Database.immediateTransaction((db) => {
    const existingSources = new Set(
      MessageStore.sourcePartsInTransaction(db, input).map((part) => `${part.type}\0${part.sourceId}`),
    )
    const created: Message.SourcePart[] = []
    for (const source of payloads) {
      const key = `${source.type}\0${source.sourceId}`
      if (existingSources.has(key)) continue
      const { outputPart } = Session.writePartInTransaction(db, {
        ...source,
        id: Identifier.ascending("part"),
        sessionID: input.sessionID,
        messageID: input.messageID,
      })
      created.push(outputPart as Message.SourcePart)
      existingSources.add(key)
    }
    return created
  })
}
