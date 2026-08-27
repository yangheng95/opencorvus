import z from "zod"
import { Identifier } from "../id/id"
import { Database, NotFoundError, and, desc, eq, inArray, lt, lte, or, sql } from "@/storage/db"
import { MessageTable, PartTable, ToolPartRequestTable } from "./session.sql"
import { fn } from "@/util/fn"
import { compareTimelineOrderKeys, timelineOrderKey } from "@/timeline/order"
import { Message } from "./message"
import { VISIBLE_PART_TYPE } from "./part-types"
import { projectToolPartInTransaction } from "./tool-part-facts"
import {
  CONVERSATION_AGENT_ACTIVITY_LIMIT,
  projectConversationAgentActivityPart,
  type ConversationAgentActivityItem,
} from "@opencorvus-ai/transport-protocol"

function persistedPartCorruption(row: typeof PartTable.$inferSelect, sessionID: string, error: z.ZodError): Message.PartErrorPart {
  const issues = error.issues.map((issue) => ({
    path: issue.path.join(".") || "<root>",
    message: issue.message,
  }))
  const issueText = issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
  const data: Record<string, unknown> =
    row.data && typeof row.data === "object" && !Array.isArray(row.data) ? row.data : {}
  return {
    id: row.id,
    sessionID,
    messageID: row.message_id,
    orderKey: timelineOrderKey({
      domain: "part",
      time: row.time_created,
      id: row.id,
    }),
    type: "part-error",
    title: "Persisted message part is corrupt",
    message: `Persisted part ${row.id} violates Message.VisiblePart: ${issueText}`,
    issues,
    ...(typeof data.type === "string" ? { originalType: data.type } : {}),
    ...(typeof data.tool === "string" ? { originalTool: data.tool } : {}),
  }
}

function persistedPart(db: Database.TxOrDb, row: typeof PartTable.$inferSelect): Message.Part {
  const message = db.select({ sessionID: MessageTable.session_id }).from(MessageTable)
    .where(eq(MessageTable.id, row.message_id)).get()
  if (!message) throw new Error(`Part ${row.id} has no parent Message`)
  const part = {
    ...row.data,
    id: row.id,
    sessionID: message.sessionID,
    messageID: row.message_id,
    orderKey: timelineOrderKey({
      domain: "part",
      time: row.time_created,
      id: row.id,
    }),
  }
  const parsed = Message.VisiblePart.safeParse(part)
  if (!parsed.success) {
    return persistedPartCorruption(row, message.sessionID, parsed.error)
  }
  return parsed.data
}

type LoadedPartRow =
  | { kind: "part"; row: typeof PartTable.$inferSelect }
  | { kind: "tool"; row: typeof ToolPartRequestTable.$inferSelect }

function loadPartRows(db: Database.TxOrDb, messageIDs: readonly string[]): LoadedPartRow[] {
  if (messageIDs.length === 0) return []
  const parts = db.select().from(PartTable).where(inArray(PartTable.message_id, [...messageIDs])).all()
    .map((row) => ({ kind: "part" as const, row }))
  const tools = db.select().from(ToolPartRequestTable)
    .where(inArray(ToolPartRequestTable.message_id, [...messageIDs])).all()
    .map((row) => ({ kind: "tool" as const, row }))
  return [...parts, ...tools].sort((left, right) =>
    left.row.message_id.localeCompare(right.row.message_id) ||
    left.row.time_created - right.row.time_created ||
    left.row.id.localeCompare(right.row.id),
  )
}

function loadedPart(db: Database.TxOrDb, loaded: LoadedPartRow): Message.Part {
  if (loaded.kind === "part") return persistedPart(db, loaded.row)
  const projected = projectToolPartInTransaction(db, loaded.row)
  if (!projected) throw new Error(`Tool request Part ${loaded.row.id} could not be projected`)
  return {
    ...projected,
    orderKey: timelineOrderKey({ domain: "part", time: loaded.row.time_created, id: loaded.row.id }),
  }
}

function partsByMessageIDs(messageIDs: readonly string[]): Map<string, Message.Part[]> {
  return Database.use((db) => {
    const result = new Map<string, Message.Part[]>()
    for (const loaded of loadPartRows(db, messageIDs)) {
      const part = loadedPart(db, loaded)
      const list = result.get(loaded.row.message_id)
      if (list) list.push(part)
      else result.set(loaded.row.message_id, [part])
    }
    return result
  })
}

export namespace MessageStore {
  export async function earliestInSession(input: { sessionID: string; limit: number }): Promise<Message.WithParts[]> {
    const rows = Database.use((db) =>
      db
        .select({ id: MessageTable.id })
        .from(MessageTable)
        .where(eq(MessageTable.session_id, input.sessionID))
        .orderBy(MessageTable.time_created, MessageTable.id)
        .limit(Math.max(1, Math.floor(input.limit)))
        .all(),
    )
    return byIDs({ sessionID: input.sessionID, messageIDs: rows.map((row) => row.id) })
  }

  export async function byIDs(input: { sessionID: string; messageIDs: string[] }): Promise<Message.WithParts[]> {
    const messageIDs = [...new Set(input.messageIDs.map((id) => String(id || "").trim()).filter(Boolean))]
    if (messageIDs.length === 0) return []
    const rows = Database.use((db) =>
      db
        .select()
        .from(MessageTable)
        .where(and(eq(MessageTable.session_id, input.sessionID), inArray(MessageTable.id, messageIDs)))
        .orderBy(MessageTable.time_created, MessageTable.id)
        .all(),
    )
    if (rows.length === 0) return []
    const partsByMessage = partsByMessageIDs(rows.map((row) => row.id))
    return rows.map((row) => ({
      info: { ...row.data, id: row.id, sessionID: row.session_id } as Message.Info,
      parts: partsByMessage.get(row.id) ?? [],
    }))
  }

  export const stream = fn(Identifier.schema("session"), async function* (sessionID) {
    const size = 50
    let cursor: { timeCreated: number; id: string } | undefined
    while (true) {
      const conditions = [eq(MessageTable.session_id, sessionID)]
      if (cursor) {
        conditions.push(
          or(
            lt(MessageTable.time_created, cursor.timeCreated),
            and(eq(MessageTable.time_created, cursor.timeCreated), lt(MessageTable.id, cursor.id)),
          )!,
        )
      }
      const rows = Database.use((db) =>
        db
          .select()
          .from(MessageTable)
          .where(and(...conditions))
          .orderBy(desc(MessageTable.time_created), desc(MessageTable.id))
          .limit(size)
          .all(),
      )
      if (rows.length === 0) break

      const ids = rows.map((row) => row.id)
      const partsByMessage = partsByMessageIDs(ids)

      for (const row of rows) {
        const info = { ...row.data, id: row.id, sessionID: row.session_id } as Message.Info
        yield {
          info,
          parts: partsByMessage.get(row.id) ?? [],
        }
      }

      const last = rows.at(-1)!
      cursor = { timeCreated: last.time_created, id: last.id }
      if (rows.length < size) break
    }
  })

  export const latestAcrossSessions = fn(
    z.object({
      sessionIDs: z.array(Identifier.schema("session")),
      limit: z.number().int().positive(),
    }),
    async (input) => {
      const sessionIDs = [...new Set(input.sessionIDs)]
      if (sessionIDs.length === 0) return [] as Message.WithParts[]
      const rows = Database.use((db) =>
        db
          .select()
          .from(MessageTable)
          .where(inArray(MessageTable.session_id, sessionIDs))
          .orderBy(desc(MessageTable.time_created), desc(MessageTable.id))
          .limit(input.limit)
          .all(),
      )
      const ids = rows.map((row) => row.id)
      const partsByMessage = partsByMessageIDs(ids)
      return rows
        .map((row) => ({
          info: { ...row.data, id: row.id, sessionID: row.session_id } as Message.Info,
          parts: partsByMessage.get(row.id) ?? [],
        }))
        .reverse()
    },
  )

  export const latestAcrossSessionsBefore = fn(
    z.object({
      sessionIDs: z.array(Identifier.schema("session")),
      before: z.number().positive(),
      beforeID: Identifier.schema("message").optional(),
      limit: z.number().int().positive(),
    }),
    async (input) => {
      const sessionIDs = [...new Set(input.sessionIDs)]
      if (sessionIDs.length === 0) return [] as Message.WithParts[]
      const before = input.beforeID
        ? or(
            lt(MessageTable.time_created, input.before),
            and(eq(MessageTable.time_created, input.before), lt(MessageTable.id, input.beforeID)),
          )
        : lt(MessageTable.time_created, input.before)
      const rows = Database.use((db) =>
        db
          .select()
          .from(MessageTable)
          .where(and(inArray(MessageTable.session_id, sessionIDs), before))
          .orderBy(desc(MessageTable.time_created), desc(MessageTable.id))
          .limit(input.limit)
          .all(),
      )
      const ids = rows.map((row) => row.id)
      const partsByMessage = partsByMessageIDs(ids)
      return rows
        .map((row) => ({
          info: { ...row.data, id: row.id, sessionID: row.session_id } as Message.Info,
          parts: partsByMessage.get(row.id) ?? [],
        }))
        .reverse()
    },
  )

  /** Load a compact latest-part projection for every requested execution
   * occurrence. A physical Session may serve multiple turns, so the persisted
   * query is bound to the authoritative input Message (and assistant Messages
   * parented to it) before applying the activity limit. Sessions that have not
   * emitted an execution lifecycle yet use their explicit precommit scope. */
  export async function latestConversationAgentActivityByExecution(input: {
    executions: Array<{ sessionID: string; inputMessageID?: string }>
    beforeOrAt?: number | null
  }): Promise<Map<string, ConversationAgentActivityItem[]>> {
    const scopes = new Map<string, { sessionID: string; inputMessageID?: string }>()
    for (const execution of input.executions) {
      const sessionID = String(execution.sessionID || "").trim()
      const inputMessageID = String(execution.inputMessageID || "").trim() || undefined
      if (!sessionID) continue
      const executionID = inputMessageID ?? `precommit:${sessionID}`
      const existing = scopes.get(executionID)
      if (existing && existing.sessionID !== sessionID) {
        throw new Error(`execution activity ${executionID} spans multiple Sessions`)
      }
      scopes.set(executionID, { sessionID, inputMessageID })
    }
    const result = new Map<string, ConversationAgentActivityItem[]>()
    for (const executionID of scopes.keys()) result.set(executionID, [])
    if (scopes.size === 0) return result

    const activityTypes = [
      VISIBLE_PART_TYPE.text,
      VISIBLE_PART_TYPE.tool,
      VISIBLE_PART_TYPE.patch,
      VISIBLE_PART_TYPE.file,
      VISIBLE_PART_TYPE.partError,
      VISIBLE_PART_TYPE.sourceUrl,
      VISIBLE_PART_TYPE.sourceDocument,
      VISIBLE_PART_TYPE.sourceFile,
    ]
    for (const [executionID, scope] of scopes) {
      const candidates: ConversationAgentActivityItem[] = []
      const rewind = typeof input.beforeOrAt === "number" ? sql`AND p.time_created <= ${input.beforeOrAt}` : sql.empty()
      const occurrence = scope.inputMessageID
        ? sql`AND (p.message_id = ${scope.inputMessageID} OR json_extract(m.data, '$.parentID') = ${scope.inputMessageID})`
        : sql.empty()
      for (const type of activityTypes) {
        const projected: ConversationAgentActivityItem[] = []
        let cursor: { timeCreated: number; id: string } | undefined
        while (projected.length < CONVERSATION_AGENT_ACTIVITY_LIMIT) {
          const page = cursor
            ? sql`AND (p.time_created < ${cursor.timeCreated} OR (p.time_created = ${cursor.timeCreated} AND p.id < ${cursor.id}))`
            : sql.empty()
          const rows = type === VISIBLE_PART_TYPE.tool
            ? Database.use((db) => db.all<typeof ToolPartRequestTable.$inferSelect>(sql`
                SELECT p.id, p.message_id, p.time_created, p.data
                FROM tool_part_request p
                JOIN message m ON m.id = p.message_id
                WHERE m.session_id = ${scope.sessionID}
                  ${occurrence}
                  ${rewind}
                  ${page}
                ORDER BY p.time_created DESC, p.id DESC
                LIMIT ${CONVERSATION_AGENT_ACTIVITY_LIMIT}
              `))
            : Database.use((db) => db.all<typeof PartTable.$inferSelect>(sql`
                SELECT p.id, p.message_id, p.time_created, p.time_updated, p.data
                FROM part p
                JOIN message m ON m.id = p.message_id
                WHERE m.session_id = ${scope.sessionID}
                  AND json_extract(p.data, '$.type') = ${type}
                  ${occurrence}
                  ${rewind}
                  ${page}
                ORDER BY p.time_created DESC, p.id DESC
                LIMIT ${CONVERSATION_AGENT_ACTIVITY_LIMIT}
              `))
          for (const row of rows) {
            const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data
            const part = type === VISIBLE_PART_TYPE.tool
              ? Database.use((db) => projectToolPartInTransaction(db, { ...row, data } as typeof ToolPartRequestTable.$inferSelect))
              : Database.use((db) => persistedPart(db, { ...row, data } as typeof PartTable.$inferSelect))
            const activity = part ? projectConversationAgentActivityPart(part) : undefined
            if (activity) projected.push(activity)
            if (projected.length >= CONVERSATION_AGENT_ACTIVITY_LIMIT) break
          }
          const last = rows.at(-1)
          if (last) cursor = { timeCreated: last.time_created, id: last.id }
          if (rows.length < CONVERSATION_AGENT_ACTIVITY_LIMIT) break
        }
        candidates.push(...projected)
      }
      const activity = candidates
        .sort((left, right) => compareTimelineOrderKeys(left.orderKey, right.orderKey))
        .slice(-CONVERSATION_AGENT_ACTIVITY_LIMIT)
      result.set(executionID, activity)
    }
    return result
  }

  export const parts = fn(Identifier.schema("message"), async (messageID) => {
    return partsByMessageIDs([messageID]).get(messageID) ?? []
  })

  export const part = fn(
    z.object({
      sessionID: Identifier.schema("session"),
      messageID: Identifier.schema("message"),
      partID: Identifier.schema("part"),
    }),
    async (input): Promise<Message.Part> => {
      return Database.use((db) => {
        const message = db
          .select({ id: MessageTable.id })
          .from(MessageTable)
          .where(and(eq(MessageTable.id, input.messageID), eq(MessageTable.session_id, input.sessionID)))
          .get()
        if (!message) throw new NotFoundError({ message: `Message not found: ${input.messageID}` })

        const persisted = db
          .select()
          .from(PartTable)
          .where(and(eq(PartTable.id, input.partID), eq(PartTable.message_id, input.messageID)))
          .get()
        if (persisted) return loadedPart(db, { kind: "part", row: persisted })

        const tool = db
          .select()
          .from(ToolPartRequestTable)
          .where(and(eq(ToolPartRequestTable.id, input.partID), eq(ToolPartRequestTable.message_id, input.messageID)))
          .get()
        if (tool) return loadedPart(db, { kind: "tool", row: tool })

        throw new NotFoundError({
          message: `Part not found: ${input.partID} in message ${input.messageID}`,
        })
      })
    },
  )

  export const get = fn(
    z.object({
      sessionID: Identifier.schema("session"),
      messageID: Identifier.schema("message"),
    }),
    async (input): Promise<Message.WithParts> => {
      const row = Database.use((db) =>
        db
          .select()
          .from(MessageTable)
          .where(and(eq(MessageTable.id, input.messageID), eq(MessageTable.session_id, input.sessionID)))
          .get(),
      )
      if (!row) throw new NotFoundError({ message: `Message not found: ${input.messageID}` })
      const info = { ...row.data, id: row.id, sessionID: row.session_id } as Message.Info
      return {
        info,
        parts: await parts(input.messageID),
      }
    },
  )
}
