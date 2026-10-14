import { Database } from "bun:sqlite"
import { CompactionHandoff } from "../src/session/compaction-handoff"
import { Message } from "../src/session/message"
import { CompactionUserText } from "../src/session/compaction-user-text"
import { projectToolPartInTransaction } from "../src/session/tool-part-facts"
import { drizzle } from "drizzle-orm/bun-sqlite"
import type { Database as StoredDatabase } from "../src/storage/db"

function requiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}
const database = new Database(requiredEnv("OPENCORVUS_DB"), { readonly: true })
try {
  const sessionID = requiredEnv("SESSION_ID")
  const summaryID = requiredEnv("COMPACTION_MESSAGE_ID")
  const rows = database
    .query<
      { id: string; data: string; time_created: number },
      [string]
    >("SELECT id, data, time_created FROM message WHERE session_id = ? ORDER BY time_created, id")
    .all(sessionID)
  const messages = rows.map((row) => ({ id: row.id, sessionID, ...JSON.parse(row.data) }))
  const summary = messages.find((message) => message.id === summaryID)
  if (!summary || !CompactionHandoff.isValidSummaryMessage(summary) || summary.time.completed === undefined) {
    throw new Error(`Checkpoint ${summaryID} is not a complete successful summary in Session ${sessionID}`)
  }
  const parts = database
    .query<{ id: string; data: string }, [string]>(
      "SELECT id, data FROM part WHERE message_id = ? ORDER BY time_created, id",
    )
    .all(summaryID)
    .map((row) => ({ id: row.id, sessionID, messageID: summaryID, ...JSON.parse(row.data) })) as Message.Part[]
  const markers = parts.filter((part): part is Message.CompactionPart => part.type === "compaction")
  if (markers.length !== 1) throw new Error(`Checkpoint ${summaryID} must own one compaction marker`)
  const marker = Message.CompactionPart.parse(markers[0]!)
  const parent = messages.find((message) => message.id === summary.parentID)
  if (parent?.role !== "user") throw new Error(`Checkpoint ${summaryID} has no owned source user Message`)
  if (marker.anchor_id && messages.find((message) => message.id === marker.anchor_id)?.role !== "user") {
    throw new Error(`Checkpoint ${summaryID} has an invalid anchor`)
  }
  if (marker.tail_start_id) {
    const tail = messages.find((message) => message.id === marker.tail_start_id)
    const tailParts = database
      .query<{ id: string; data: string }, [string]>(
        "SELECT id, data FROM part WHERE message_id = ? ORDER BY time_created, id",
      )
      .all(marker.tail_start_id)
      .map((row) => ({
        id: row.id,
        sessionID,
        messageID: marker.tail_start_id!,
        ...JSON.parse(row.data),
      })) as Message.Part[]
    if (!tail || !Message.isCompactionTailBoundary({ info: tail, parts: tailParts }))
      throw new Error(`Checkpoint ${summaryID} has an incomplete tail`)
    const openRequests = database
      .query<
        { count: number },
        [string]
      >("SELECT count(*) AS count FROM tool_part_request AS request LEFT JOIN tool_part_outcome AS outcome ON outcome.request_part_id = request.id WHERE request.message_id = ? AND outcome.id IS NULL")
      .get(marker.tail_start_id)?.count
    if (openRequests) throw new Error(`Checkpoint ${summaryID} tail has unsettled tool requests`)
  }
  for (const entry of marker.covered_parts ?? []) {
    const source = messages.find((message) => message.id === entry.messageID)
    if (source?.role !== "assistant")
      throw new Error(`Checkpoint ${summaryID} has no covered assistant ${entry.messageID}`)
    const partIDs = new Set(
      database
        .query<{ id: string }, [string, string]>(
          "SELECT id FROM part WHERE message_id = ? UNION ALL SELECT id FROM tool_part_request WHERE message_id = ?",
        )
        .all(entry.messageID, entry.messageID)
        .map((part) => part.id),
    )
    for (const bound of entry.parts) {
      if (!partIDs.has(bound.partID)) throw new Error(`Checkpoint ${summaryID} has no covered Part ${bound.partID}`)
    }
  }
  const text = Message.compactionContinuationTextParts(parts)
    .map((part) => part.text)
    .join("\n\n")
  if (!text.trim()) throw new Error(`Checkpoint ${summaryID} has no final visible continuation`)
  const reader = drizzle({ client: database }) as unknown as StoredDatabase.TxOrDb
  const history: Message.WithParts[] = messages.map((info) => ({
    info,
    parts: database
      .query<{ id: string; data: string }, [string]>(
        "SELECT id, data FROM part WHERE message_id = ? ORDER BY time_created, id",
      )
      .all(info.id)
      .map((row) => ({ ...JSON.parse(row.data), id: row.id, sessionID, messageID: info.id })),
  }))
  for (const message of history) {
    const requests = database
      .query<
        { id: string; message_id: string; data: string; time_created: number },
        [string, string]
      >("SELECT * FROM tool_part_request WHERE message_id = ? AND json_extract(data, '$.tool') = ? ORDER BY time_created, id")
      .all(message.info.id, CompactionUserText.TOOL_NAME)
    for (const request of requests) {
      const part = projectToolPartInTransaction(reader, { ...request, data: JSON.parse(request.data) })
      if (part) message.parts.push(part)
    }
  }
  const retained = CompactionUserText.project(CompactionUserText.selection(history, summaryID), history)
  console.log(
    JSON.stringify({
      status: "valid_checkpoint",
      sessionID,
      summaryID,
      finish: summary.finish,
      sourceMessageID: parent.id,
      anchorID: marker.anchor_id,
      tailStartID: marker.tail_start_id,
      summaryCharacters: text.length,
      retainedUserSources: retained.map((message) => ({
        messageID: message.info.id,
        role: message.info.role,
        author: message.info.author,
        parts: message.parts.map((part) => ({ partID: part.id, ...(part.type === "text" ? { text: part.text } : {}) })),
      })),
      coveredMessages: marker.covered_parts?.length ?? 0,
      coveredParts: marker.covered_parts?.reduce((count, entry) => count + entry.parts.length, 0) ?? 0,
    }),
  )
} finally {
  database.close()
}
