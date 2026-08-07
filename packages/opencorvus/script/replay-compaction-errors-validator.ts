import { Database } from "bun:sqlite"
import { SessionCompaction } from "../src/session/compaction"
import { CompactionHandoff } from "../src/session/compaction-handoff"
import type { Message } from "../src/session/message"
import { patchEvidenceSummary } from "../src/snapshot/types"

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} is required`)
  }
  return value
}

const DB_PATH = requiredEnv("OPENCORVUS_DB")
const SESSION_ID = requiredEnv("SESSION_ID")
const COMPACTION_MESSAGE_ID = requiredEnv("COMPACTION_MESSAGE_ID")
const SOURCE_BASE_ROLE = CompactionHandoff.requireHandoffBaseRole(requiredEnv("SOURCE_BASE_ROLE"))

type MessageRow = {
  id: string
  session_id: string
  time_created: number
  data: string
}

type PartRow = {
  id: string
  message_id: string
  session_id: string
  time_created: number
  data: string
}

function messageFromRow(row: MessageRow, parts: Message.Part[]): Message.WithParts {
  return {
    info: {
      id: row.id,
      sessionID: row.session_id,
      ...JSON.parse(row.data),
    },
    parts,
  } as Message.WithParts
}

function partFromRow(row: PartRow): Message.Part {
  return {
    id: row.id,
    messageID: row.message_id,
    sessionID: row.session_id,
    ...JSON.parse(row.data),
  } as Message.Part
}

const db = new Database(DB_PATH, { readonly: true })

const compactionMessage = db
  .query<MessageRow, [string]>("SELECT id, session_id, time_created, data FROM message WHERE id = ?")
  .get(COMPACTION_MESSAGE_ID)
if (!compactionMessage) throw new Error(`Missing compaction message ${COMPACTION_MESSAGE_ID}`)

const compactionInfo = JSON.parse(compactionMessage.data)
const parentID = compactionInfo.parentID
if (typeof parentID !== "string" || parentID.length === 0) {
  throw new Error(`Compaction message ${COMPACTION_MESSAGE_ID} has no parentID`)
}

const parentMessage = db
  .query<MessageRow, [string]>("SELECT id, session_id, time_created, data FROM message WHERE id = ?")
  .get(parentID)
if (!parentMessage) throw new Error(`Missing compaction parent message ${parentID}`)
const parentInfo = JSON.parse(parentMessage.data)
const sourceAgent = parentInfo.agent
if (typeof sourceAgent !== "string" || sourceAgent.trim().length === 0) {
  throw new Error(`Compaction parent message ${parentID} has no source agent`)
}

const toolPart = db
  .query<
    PartRow,
    [string]
  >("SELECT id, message_id, session_id, time_created, data FROM part WHERE message_id = ? AND json_extract(data, '$.type') = 'tool'")
  .get(COMPACTION_MESSAGE_ID)
if (!toolPart) throw new Error(`Missing StructuredOutput tool part for ${COMPACTION_MESSAGE_ID}`)

const handoff = JSON.parse(toolPart.data).state.input as CompactionHandoff.Info

const messageRows = db
  .query<
    MessageRow,
    [string, number]
  >("SELECT id, session_id, time_created, data FROM message WHERE session_id = ? AND time_created < ? ORDER BY time_created ASC, id ASC")
  .all(SESSION_ID, parentMessage.time_created)
const partRows = db
  .query<
    PartRow,
    [string, number]
  >("SELECT id, message_id, session_id, time_created, data FROM part WHERE session_id = ? AND time_created < ? ORDER BY time_created ASC, id ASC")
  .all(SESSION_ID, parentMessage.time_created)

const partsByMessage = new Map<string, Message.Part[]>()
for (const row of partRows) {
  const parts = partsByMessage.get(row.message_id) ?? []
  parts.push(partFromRow(row))
  partsByMessage.set(row.message_id, parts)
}

const selectedHead = messageRows.map((row) => messageFromRow(row, partsByMessage.get(row.id) ?? []))
const requirements = SessionCompaction.TestHooks.selectedHeadEvidenceRequirements({
  messages: selectedHead,
  instructionPaths: [],
  sourceUserMessageID: parentID,
  sourceAgent,
  sourceBaseRole: SOURCE_BASE_ROLE,
  summarizePatchEvidence: patchEvidenceSummary,
})
const verdict = CompactionHandoff.validateMinimumEvidence(handoff, requirements)

console.log(`db: ${DB_PATH}`)
console.log(`session: ${SESSION_ID}`)
console.log(`compactionMessage: ${COMPACTION_MESSAGE_ID}`)
console.log(`sourceBaseRole: ${SOURCE_BASE_ROLE}`)
console.log(`selectedHeadMessages: ${selectedHead.length}`)
console.log(`requiredPatchFiles: ${requirements.patchFiles.length}`)
console.log(`requiredErrorNames: ${JSON.stringify(requirements.errorNames)}`)
console.log(`emittedErrorsAndBlockers: ${JSON.stringify(handoff.errorsAndBlockers)}`)
console.log(`verdict: ${JSON.stringify(verdict)}`)

if (!verdict.success) {
  throw new Error(verdict.error)
}
