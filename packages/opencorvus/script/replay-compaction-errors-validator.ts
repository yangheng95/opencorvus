import { Database } from "bun:sqlite"
import { CompactionHandoff } from "../src/session/compaction-handoff"
import { Message } from "../src/session/message"

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
  const marker = markers[0]!
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
  const text = Message.compactionContinuationTextParts(parts)
    .map((part) => part.text)
    .join("\n\n")
  if (!text.trim()) throw new Error(`Checkpoint ${summaryID} has no final visible continuation`)
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
    }),
  )
} finally {
  database.close()
}
