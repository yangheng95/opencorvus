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

function persistedPart(
  db: Database.TxOrDb,
  row: typeof PartTable.$inferSelect,
  knownSessionID?: string,
): Message.Part {
  const sessionID = knownSessionID || db.select({ sessionID: MessageTable.session_id }).from(MessageTable)
    .where(eq(MessageTable.id, row.message_id)).get()?.sessionID
  if (!sessionID) throw new Error(`Part ${row.id} has no parent Message`)
  const part = {
    ...row.data,
    id: row.id,
    sessionID,
    messageID: row.message_id,
    orderKey: timelineOrderKey({
      domain: "part",
      time: row.time_created,
      id: row.id,
    }),
  }
  const parsed = Message.VisiblePart.safeParse(part)
  if (!parsed.success) {
    return persistedPartCorruption(row, sessionID, parsed.error)
  }
  return parsed.data
}

type LoadedPartRow =
  | { kind: "part"; row: typeof PartTable.$inferSelect }
  | { kind: "tool"; row: typeof ToolPartRequestTable.$inferSelect }

type ConversationActivityQueryRow = {
  executionID: string
  sessionID: string
  id: string
  message_id: string
  time_created: number
  time_updated?: number
  data: unknown
}

type ConversationActivityQueryScope = {
  executionID: string
  sessionID: string
  inputMessageID?: string
  cursor?: { timeCreated: number; id: string }
}

type ConversationActivityMessageScope = {
  executionID: string
  sessionID: string
  messageID: string
}

const CONVERSATION_ACTIVITY_QUERY_SCOPE_CHUNK_SIZE = 64

function conversationActivityChunks<T>(items: T[]): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += CONVERSATION_ACTIVITY_QUERY_SCOPE_CHUNK_SIZE) {
    chunks.push(items.slice(index, index + CONVERSATION_ACTIVITY_QUERY_SCOPE_CHUNK_SIZE))
  }
  return chunks
}

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

function conversationActivityMessageScopes(
  scopes: ConversationActivityQueryScope[],
): ConversationActivityMessageScope[] {
  if (scopes.length === 0) return []
  return Database.use((db) => conversationActivityChunks(scopes).flatMap((chunk) => {
    const requestedScopes = sql.join(
      chunk.map((scope) => sql`(${scope.executionID}, ${scope.sessionID}, ${scope.inputMessageID ?? null})`),
      sql`, `,
    )
    return db.all<ConversationActivityMessageScope>(sql`
      WITH requested_scope(execution_id, session_id, input_message_id) AS (
        VALUES ${requestedScopes}
      )
      SELECT
        scope.execution_id AS executionID,
        scope.session_id AS sessionID,
        m.id AS messageID
      FROM requested_scope scope
      JOIN message m ON m.session_id = scope.session_id
      WHERE
        scope.input_message_id IS NULL OR
        m.id = scope.input_message_id OR
        json_extract(m.data, '$.parentID') = scope.input_message_id
      ORDER BY scope.execution_id, m.time_created, m.id
    `)
  }))
}

function conversationActivityRowsPage(input: {
  scopes: ConversationActivityQueryScope[]
  messagesByExecution: Map<string, ConversationActivityMessageScope[]>
  type: string
  beforeOrAt?: number | null
}): ConversationActivityQueryRow[] {
  if (input.scopes.length === 0) return []
  const requestedParts = input.scopes.flatMap((scope) =>
    (input.messagesByExecution.get(scope.executionID) ?? []).map((message) => ({ scope, message })),
  )
  if (requestedParts.length === 0) return []
  const rows = Database.use((db) => conversationActivityChunks(requestedParts).flatMap((chunk) => {
    const requestedScopes = sql.join(
      chunk.map(({ scope, message }) => sql`(
        ${message.executionID},
        ${message.sessionID},
        ${message.messageID},
        ${scope.cursor?.timeCreated ?? null},
        ${scope.cursor?.id ?? null}
      )`),
      sql`, `,
    )
    const rewind = typeof input.beforeOrAt === "number" ? sql`AND p.time_created <= ${input.beforeOrAt}` : sql.empty()
    const source = input.type === VISIBLE_PART_TYPE.tool
      ? sql`
          SELECT
            scope.execution_id,
            scope.session_id,
            p.id,
            p.message_id,
            p.time_created,
            NULL AS time_updated,
            p.data,
            ROW_NUMBER() OVER (
              PARTITION BY scope.execution_id
              ORDER BY p.time_created DESC, p.id DESC
            ) AS page_rank
          FROM requested_scope scope
          JOIN tool_part_request p ON p.message_id = scope.message_id
          WHERE 1 = 1
            ${rewind}
            AND (
              scope.cursor_time IS NULL OR
              p.time_created < scope.cursor_time OR
              (p.time_created = scope.cursor_time AND p.id < scope.cursor_id)
            )
        `
      : sql`
          SELECT
            scope.execution_id,
            scope.session_id,
            p.id,
            p.message_id,
            p.time_created,
            p.time_updated,
            p.data,
            ROW_NUMBER() OVER (
              PARTITION BY scope.execution_id
              ORDER BY p.time_created DESC, p.id DESC
            ) AS page_rank
          FROM requested_scope scope
          JOIN part p ON p.message_id = scope.message_id
          WHERE json_extract(p.data, '$.type') = ${input.type}
            ${rewind}
            AND (
              scope.cursor_time IS NULL OR
              p.time_created < scope.cursor_time OR
              (p.time_created = scope.cursor_time AND p.id < scope.cursor_id)
            )
        `
    return db.all<ConversationActivityQueryRow>(sql`
      WITH requested_scope(execution_id, session_id, message_id, cursor_time, cursor_id) AS (
        VALUES ${requestedScopes}
      ), ranked AS (${source})
      SELECT
        execution_id AS executionID,
        session_id AS sessionID,
        id,
        message_id,
        time_created,
        time_updated,
        data
      FROM ranked
      WHERE page_rank <= ${CONVERSATION_AGENT_ACTIVITY_LIMIT}
      ORDER BY execution_id, time_created DESC, id DESC
    `)
  }))
  const rowsByExecution = new Map<string, ConversationActivityQueryRow[]>()
  for (const row of rows) {
    const group = rowsByExecution.get(row.executionID)
    if (group) group.push(row)
    else rowsByExecution.set(row.executionID, [row])
  }
  return [...rowsByExecution.values()].flatMap((group) => group
    .sort((left, right) => right.time_created - left.time_created || right.id.localeCompare(left.id))
    .slice(0, CONVERSATION_AGENT_ACTIVITY_LIMIT))
}

function projectConversationActivityRows(
  rows: ConversationActivityQueryRow[],
  type: string,
): Array<{ executionID: string; activity: ConversationAgentActivityItem | null }> {
  return Database.use((db) => rows.map((row) => {
    const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data
    const part = type === VISIBLE_PART_TYPE.tool
      ? projectToolPartInTransaction(db, { ...row, data } as typeof ToolPartRequestTable.$inferSelect)
      : persistedPart(db, { ...row, data } as typeof PartTable.$inferSelect, row.sessionID)
    return {
      executionID: row.executionID,
      activity: part ? projectConversationAgentActivityPart(part) : null,
    }
  }))
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
    const candidatesByExecution = new Map<string, ConversationAgentActivityItem[]>()
    for (const executionID of scopes.keys()) candidatesByExecution.set(executionID, [])
    const messagesByExecution = new Map<string, ConversationActivityMessageScope[]>()
    for (const message of conversationActivityMessageScopes(
      [...scopes].map(([executionID, scope]) => ({ executionID, ...scope })),
    )) {
      const group = messagesByExecution.get(message.executionID)
      if (group) group.push(message)
      else messagesByExecution.set(message.executionID, [message])
    }
    for (const type of activityTypes) {
      const projectedByExecution = new Map<string, ConversationAgentActivityItem[]>()
      let pending: ConversationActivityQueryScope[] = [...scopes].map(([executionID, scope]) => ({
        executionID,
        ...scope,
      }))
      while (pending.length > 0) {
        const rows = conversationActivityRowsPage({
          scopes: pending,
          messagesByExecution,
          type,
          beforeOrAt: input.beforeOrAt,
        })
        const rowsByExecution = new Map<string, ConversationActivityQueryRow[]>()
        for (const row of rows) {
          const group = rowsByExecution.get(row.executionID)
          if (group) group.push(row)
          else rowsByExecution.set(row.executionID, [row])
        }
        for (const projected of projectConversationActivityRows(rows, type)) {
          if (!projected.activity) continue
          const group = projectedByExecution.get(projected.executionID)
          if (group) group.push(projected.activity)
          else projectedByExecution.set(projected.executionID, [projected.activity])
        }
        const nextPending: ConversationActivityQueryScope[] = []
        for (const scope of pending) {
          const page = rowsByExecution.get(scope.executionID) ?? []
          const projected = projectedByExecution.get(scope.executionID) ?? []
          if (projected.length >= CONVERSATION_AGENT_ACTIVITY_LIMIT) continue
          const last = page.at(-1)
          if (!last || page.length < CONVERSATION_AGENT_ACTIVITY_LIMIT) continue
          nextPending.push({
            ...scope,
            cursor: { timeCreated: last.time_created, id: last.id },
          })
        }
        pending = nextPending
      }
      for (const [executionID, projected] of projectedByExecution) {
        candidatesByExecution.get(executionID)?.push(...projected.slice(0, CONVERSATION_AGENT_ACTIVITY_LIMIT))
      }
    }
    for (const executionID of scopes.keys()) {
      const activity = (candidatesByExecution.get(executionID) ?? [])
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
