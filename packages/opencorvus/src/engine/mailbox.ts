import z from "zod"
import {
  EvidenceLocatorListSchema,
  type EvidenceLocator,
} from "@opencorvus-ai/plugin/artifact-catalog"
import { BusEvent } from "@/bus/bus-event"
import { EngineProtocol } from "@/engine/protocol"
import { Event } from "@/engine/model"
import { ProtocolEventTable } from "@/protocol/protocol.sql"
import { ProjectTable } from "@/project/project.sql"
import { Database, and, desc, eq, inArray } from "@/storage/db"
import { EngineTaskTable } from "./engine.sql"

export const MailboxCategory = z.enum(["progress", "status", "notification"])
export type MailboxCategory = z.infer<typeof MailboxCategory>

export const MailboxView = z.enum(["active", "archived"])
export type MailboxView = z.infer<typeof MailboxView>

export const MailboxAction = z.enum(["read", "archive", "restore", "delete"])
export type MailboxAction = z.infer<typeof MailboxAction>

export const MailboxUpdateAction = MailboxAction.exclude(["delete"])
export type MailboxUpdateAction = z.infer<typeof MailboxUpdateAction>

export const MailboxProgress = z.number().min(0).max(1)

export const MailboxAgentMessagePayload = z
  .object({
    taskID: z.string().min(1),
    sessionID: z.string().min(1),
    agentID: z.string().min(1),
    expertSquadID: z.string().min(1),
    category: MailboxCategory,
    subject: z.string().min(1),
    body: z.string().min(1),
    attention: z.boolean(),
    progress: MailboxProgress.optional(),
    evidenceLocators: EvidenceLocatorListSchema.default([]),
    summary: z.string().min(1),
  })
  .strict()
export type MailboxAgentMessagePayload = z.infer<typeof MailboxAgentMessagePayload>

const MailboxAcknowledgementPayload = z.object({
  taskID: z.string().min(1),
  messageID: z.string().min(1),
  action: MailboxAction,
  summary: z.string().min(1),
})

export const MailboxItem = z.object({
  id: z.string().min(1),
  eventType: z.string().min(1),
  category: MailboxCategory,
  attention: z.boolean(),
  subject: z.string().min(1),
  body: z.string(),
  evidenceLocators: EvidenceLocatorListSchema,
  progress: MailboxProgress.optional(),
  sourceAgentID: z.string().min(1),
  expertSquadID: z.string().optional(),
  sessionID: z.string().optional(),
  taskID: z.string().min(1),
  taskTitle: z.string().min(1),
  taskDirectory: z.string().min(1),
  orderKey: z.string().min(1),
  createdAt: z.number().int().positive(),
  readAt: z.number().int().positive().optional(),
  archivedAt: z.number().int().positive().optional(),
})
export type MailboxItem = z.infer<typeof MailboxItem>

export const MailboxCursor = z.object({
  createdAt: z.number().int().positive(),
  id: z.string().min(1),
})
export type MailboxCursor = z.infer<typeof MailboxCursor>

export const MailboxPage = z.object({
  items: z.array(MailboxItem),
  nextCursor: MailboxCursor.nullable(),
  unreadCount: z.number().int().nonnegative(),
  activeCount: z.number().int().nonnegative(),
  archivedCount: z.number().int().nonnegative(),
})
export type MailboxPage = z.infer<typeof MailboxPage>

export const MailboxReadAllResult = z.object({
  changedCount: z.number().int().nonnegative(),
})
export type MailboxReadAllResult = z.infer<typeof MailboxReadAllResult>

export const MailboxDeleteResult = z.object({
  changedCount: z.number().int().nonnegative(),
})
export type MailboxDeleteResult = z.infer<typeof MailboxDeleteResult>

export const MailboxSchedulerMessage = z
  .object({
    id: z.string().min(1),
    taskID: z.string().min(1),
    createdAt: z.number().int().positive(),
    sourceAgentID: z.string().min(1),
    expertSquadID: z.string().min(1),
    sessionID: z.string().min(1),
    category: MailboxCategory,
    attention: z.boolean(),
    subject: z.string().min(1),
    body: z.string().min(1),
    evidenceLocators: EvidenceLocatorListSchema,
    progress: MailboxProgress.optional(),
  })
  .strict()
export type MailboxSchedulerMessage = z.infer<typeof MailboxSchedulerMessage>

export const MAILBOX_DEFAULT_PAGE_SIZE = 40
export const MAILBOX_MAX_PAGE_SIZE = 100
export const MAILBOX_SCHEDULER_MESSAGE_LIMIT = 8
export const MAILBOX_MESSAGE_EVENT_TYPE = Event.MailboxMessage.type
export const MAILBOX_ACKNOWLEDGEMENT_EVENT_TYPE = Event.MailboxAcknowledged.type

type ProtocolEventRow = typeof ProtocolEventTable.$inferSelect

const canonicalMailboxPresentation = {
  "task.completed": { category: "status", attention: false },
  "task.failed": { category: "notification", attention: true },
  "task.infrastructure.failed": { category: "notification", attention: true },
  "interaction.requested": { category: "notification", attention: true },
  "agent.coordination.requested": { category: "notification", attention: true },
  "agent.coordination.responded": { category: "status", attention: false },
  "agent.coordination.action": { category: "status", attention: false },
  "agent.coordination.cancelled": { category: "status", attention: false },
} as const satisfies Record<string, { category: MailboxCategory; attention: boolean }>

const excludedSystemMailboxEventTypes = new Set(["task.cancelled"])

interface MailboxState {
  readAt?: number
  archiveResolved: boolean
  archivedAt?: number
  deletedAt?: number
}

interface MailboxSourceRow {
  event: ProtocolEventRow
  taskTitle: string
  directory: string
}

export class MailboxItemNotFoundError extends Error {
  readonly messageID: string

  constructor(messageID: string) {
    super(`Mailbox item not found: ${messageID}`)
    this.name = "MailboxItemNotFoundError"
    this.messageID = messageID
  }
}

function payloadRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function textField(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key]
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function evidenceLocatorList(payload: Record<string, unknown>, key: string): EvidenceLocator[] {
  const value = payload[key]
  if (value === undefined) return []
  const parsed = EvidenceLocatorListSchema.safeParse(value)
  if (!parsed.success) throw new Error(`Mailbox source evidence field ${key} is malformed`)
  return parsed.data
}

function structuredErrorMessage(payload: Record<string, unknown>): string | undefined {
  const error = payloadRecord(payload.error)
  const data = payloadRecord(error.data)
  const message = textField(data, "message")
  if (message) return message
  if (error.name === "MessageOutputLengthError") return "The model response exceeded its output limit."
  return undefined
}

function systemMailboxBody(eventType: string, payload: Record<string, unknown>): string {
  const message =
    textField(payload, "details") ??
    textField(payload, "error") ??
    textField(payload, "requestedDecision") ??
    textField(payload, "requested_decision") ??
    textField(payload, "message") ??
    textField(payload, "summary") ??
    structuredErrorMessage(payload)
  if (!message) throw new Error(`Mailbox source event ${eventType} has no user-facing message`)
  return message
}

function mailboxState(): Map<string, MailboxState> {
  const rows = Database.use((db) =>
    db
      .select({ event: ProtocolEventTable })
      .from(ProtocolEventTable)
      .innerJoin(EngineTaskTable, eq(EngineTaskTable.id, ProtocolEventTable.task_id))
      .where(eq(ProtocolEventTable.type, MAILBOX_ACKNOWLEDGEMENT_EVENT_TYPE))
      .orderBy(desc(ProtocolEventTable.emitted_at), desc(ProtocolEventTable.id))
      .all(),
  )
  const state = new Map<string, MailboxState>()
  for (const row of rows) {
    const parsed = MailboxAcknowledgementPayload.safeParse(row.event.payload)
    if (!parsed.success) throw new Error(`Malformed mailbox acknowledgement event ${row.event.id}`)
    const current = state.get(parsed.data.messageID) ?? { archiveResolved: false }
    if (parsed.data.action === "delete" && current.deletedAt === undefined) current.deletedAt = row.event.emitted_at
    if (parsed.data.action === "read" && current.readAt === undefined) current.readAt = row.event.emitted_at
    if (!current.archiveResolved && (parsed.data.action === "archive" || parsed.data.action === "restore")) {
      current.archiveResolved = true
      if (parsed.data.action === "archive") current.archivedAt = row.event.emitted_at
    }
    state.set(parsed.data.messageID, current)
  }
  return state
}

function canonicalPresentation(eventType: string) {
  return canonicalMailboxPresentation[eventType as keyof typeof canonicalMailboxPresentation]
}

function mailboxPresentation(eventType: string, payload: Record<string, unknown>) {
  const canonical = canonicalPresentation(eventType)
  if (canonical) return canonical
  if (excludedSystemMailboxEventTypes.has(eventType)) return undefined
  const notify = BusEvent.resolveNotify(eventType, payload)
  if (!notify || notify.tier === 3) return undefined
  return { category: "notification" as const, attention: notify.tier === 1 || notify.badge === true }
}

function mailboxSourceEventTypes(): string[] {
  return [
    ...new Set([MAILBOX_MESSAGE_EVENT_TYPE, ...Object.keys(canonicalMailboxPresentation), ...BusEvent.notifyTypes()]),
  ]
}

function isMailboxSourceEvent(type: string, payload: unknown): boolean {
  if (type === MAILBOX_MESSAGE_EVENT_TYPE) return true
  return mailboxPresentation(type, payloadRecord(payload)) !== undefined
}

function mailboxItemFromRow(input: { row: MailboxSourceRow; state?: MailboxState }): MailboxItem {
  const { event, taskTitle } = input.row
  const payload = payloadRecord(event.payload)
  if (event.type === MAILBOX_MESSAGE_EVENT_TYPE) {
    const message = MailboxAgentMessagePayload.safeParse(payload)
    if (!message.success) throw new Error(`Malformed mailbox message event ${event.id}`)
    return MailboxItem.parse({
      id: event.id,
      eventType: event.type,
      category: message.data.category,
      attention: message.data.attention,
      subject: message.data.subject,
      body: message.data.body,
      evidenceLocators: message.data.evidenceLocators,
      progress: message.data.progress,
      sourceAgentID: message.data.agentID,
      expertSquadID: message.data.expertSquadID,
      sessionID: message.data.sessionID,
      taskID: message.data.taskID,
      taskTitle,
      taskDirectory: input.row.directory,
      orderKey: event.order_key,
      createdAt: event.emitted_at,
      readAt: input.state?.readAt,
      archivedAt: input.state?.archivedAt,
    })
  }

  const presentation = mailboxPresentation(event.type, payload)
  if (!presentation) throw new Error(`Unsupported mailbox source event ${event.type}`)
  const agent = textField(payload, "agent") ?? event.source
  return MailboxItem.parse({
    id: event.id,
    eventType: event.type,
    category: presentation.category,
    attention: presentation.attention || payload.blocking === true,
    subject: taskTitle,
    body: systemMailboxBody(event.type, payload),
    evidenceLocators: evidenceLocatorList(payload, "evidenceLocators"),
    sourceAgentID: agent,
    sessionID: event.session_id ?? textField(payload, "sessionID") ?? textField(payload, "session_id"),
    taskID: event.task_id ?? event.aggregate_id,
    taskTitle,
    taskDirectory: input.row.directory,
    orderKey: event.order_key,
    createdAt: event.emitted_at,
    readAt: input.state?.readAt,
    archivedAt: input.state?.archivedAt,
  })
}

function allMailboxSourceRows(): MailboxSourceRow[] {
  return Database.use((db) =>
    db
      .select({ event: ProtocolEventTable, taskTitle: EngineTaskTable.title, directory: ProjectTable.worktree })
      .from(ProtocolEventTable)
      .innerJoin(EngineTaskTable, eq(EngineTaskTable.id, ProtocolEventTable.task_id))
      .innerJoin(ProjectTable, eq(ProjectTable.id, EngineTaskTable.project_id))
      .where(inArray(ProtocolEventTable.type, mailboxSourceEventTypes()))
      .orderBy(desc(ProtocolEventTable.emitted_at), desc(ProtocolEventTable.id))
      .all(),
  ).filter((row) => isMailboxSourceEvent(row.event.type, row.event.payload))
}

export function listMailbox(input: { view?: MailboxView; cursor?: MailboxCursor; limit?: number }): MailboxPage {
  const view = input.view ?? "active"
  const limit = Math.min(MAILBOX_MAX_PAGE_SIZE, Math.max(1, input.limit ?? MAILBOX_DEFAULT_PAGE_SIZE))
  const state = mailboxState()
  const allRows = allMailboxSourceRows()
  let activeCount = 0
  let archivedCount = 0
  let unreadCount = 0
  for (const row of allRows) {
    const itemState = state.get(row.event.id)
    if (itemState?.deletedAt !== undefined) continue
    if (itemState?.archivedAt) archivedCount += 1
    else {
      activeCount += 1
      if (!itemState?.readAt) unreadCount += 1
    }
  }

  const pageRows = allRows.filter((row) => {
    const itemState = state.get(row.event.id)
    if (itemState?.deletedAt !== undefined) return false
    const inView = view === "archived" ? itemState?.archivedAt !== undefined : itemState?.archivedAt === undefined
    if (!inView) return false
    if (!input.cursor) return true
    return (
      row.event.emitted_at < input.cursor.createdAt ||
      (row.event.emitted_at === input.cursor.createdAt && row.event.id < input.cursor.id)
    )
  })
  const hasMore = pageRows.length > limit
  const scannedRows = pageRows.slice(0, limit)
  const items = scannedRows.map((row) => mailboxItemFromRow({ row, state: state.get(row.event.id) }))
  const cursorRow = hasMore ? scannedRows.at(-1)?.event : undefined
  return MailboxPage.parse({
    items,
    nextCursor: cursorRow ? { createdAt: cursorRow.emitted_at, id: cursorRow.id } : null,
    unreadCount,
    activeCount,
    archivedCount,
  })
}

export function listRecentTaskMailboxMessages(
  taskID: string,
  limit = MAILBOX_SCHEDULER_MESSAGE_LIMIT,
): MailboxSchedulerMessage[] {
  return Database.use((db) =>
    db
      .select({ event: ProtocolEventTable })
      .from(ProtocolEventTable)
      .where(and(eq(ProtocolEventTable.task_id, taskID), eq(ProtocolEventTable.type, MAILBOX_MESSAGE_EVENT_TYPE)))
      .orderBy(desc(ProtocolEventTable.emitted_at), desc(ProtocolEventTable.id))
      .limit(Math.max(1, limit))
      .all(),
  ).map(({ event }) => {
    const payload = MailboxAgentMessagePayload.parse(event.payload)
    if (payload.taskID !== taskID) {
      throw new Error(`Mailbox event ${event.id} payload task ${payload.taskID} does not match indexed task ${taskID}`)
    }
    return MailboxSchedulerMessage.parse({
      id: event.id,
      taskID: payload.taskID,
      createdAt: event.emitted_at,
      sourceAgentID: payload.agentID,
      expertSquadID: payload.expertSquadID,
      sessionID: payload.sessionID,
      category: payload.category,
      attention: payload.attention,
      subject: payload.subject,
      body: payload.body,
      evidenceLocators: payload.evidenceLocators,
      progress: payload.progress,
    })
  })
}

export function recordMailboxMessage(input: MailboxAgentMessagePayload & { correlationID: string }) {
  const { correlationID, ...payloadInput } = input
  const parsed = MailboxAgentMessagePayload.parse(payloadInput)
  let result: { id: string; createdNow: boolean; payload: MailboxAgentMessagePayload } | undefined
  Database.transaction((db) => {
    const existing = db
      .select()
      .from(ProtocolEventTable)
      .where(
        and(
          eq(ProtocolEventTable.type, MAILBOX_MESSAGE_EVENT_TYPE),
          eq(ProtocolEventTable.task_id, parsed.taskID),
          eq(ProtocolEventTable.session_id, parsed.sessionID),
          eq(ProtocolEventTable.correlation_id, correlationID),
        ),
      )
      .get()
    if (existing) {
      const payload = MailboxAgentMessagePayload.parse(existing.payload)
      if (JSON.stringify(payload) !== JSON.stringify(parsed)) {
        throw new Error(`Mailbox invocation ${correlationID} replay payload drift`)
      }
      result = { id: existing.id, createdNow: false, payload }
      return
    }
    const event = EngineProtocol.emitInTransaction(Event.MailboxMessage, parsed, {
      taskID: parsed.taskID,
      sessionID: parsed.sessionID,
      source: parsed.agentID,
      target: "orchestrator",
      correlationID,
    })
    result = { id: event.id, createdNow: true, payload: parsed }
  })
  if (!result) throw new Error("Mailbox message transaction produced no event")
  return result
}

function mailboxSourceEvent(messageID: string): ProtocolEventRow | undefined {
  const event = Database.use(
    (db) =>
      db
        .select({ event: ProtocolEventTable })
        .from(ProtocolEventTable)
        .innerJoin(EngineTaskTable, eq(EngineTaskTable.id, ProtocolEventTable.task_id))
        .where(eq(ProtocolEventTable.id, messageID))
        .get()?.event,
  )
  return event && isMailboxSourceEvent(event.type, event.payload) ? event : undefined
}

function emitMailboxAcknowledgement(source: ProtocolEventRow, messageID: string, action: MailboxAction) {
  if (!source.task_id) throw new Error(`Mailbox source event ${messageID} has no task identity`)
  return EngineProtocol.emitInTransaction(
    Event.MailboxAcknowledged,
    {
      taskID: source.task_id,
      messageID,
      action,
      summary: `Mailbox item ${action}`,
    },
    {
      taskID: source.task_id,
      sessionID: source.session_id ?? undefined,
      source: "operator",
      target: source.source,
      causationID: messageID,
      correlationID: messageID,
    },
  )
}

export function acknowledgeMailboxItem(input: { messageID: string; action: MailboxAction }) {
  return Database.transaction(() => {
    const source = mailboxSourceEvent(input.messageID)
    if (!source?.task_id) throw new MailboxItemNotFoundError(input.messageID)
    const state = mailboxState().get(input.messageID)
    const alreadyApplied =
      state?.deletedAt !== undefined ||
      (input.action === "read" && state?.readAt !== undefined) ||
      (input.action === "archive" && state?.archivedAt !== undefined) ||
      (input.action === "restore" && state?.archivedAt === undefined)
    if (alreadyApplied) return { changed: false, messageID: input.messageID, action: input.action }
    const event = emitMailboxAcknowledgement(source, input.messageID, input.action)
    return { changed: true, eventID: event.id, messageID: input.messageID, action: input.action }
  })
}

export function acknowledgeAllMailboxItemsRead(): MailboxReadAllResult {
  return Database.transaction(() => {
    const state = mailboxState()
    let changedCount = 0
    for (const row of allMailboxSourceRows()) {
      const itemState = state.get(row.event.id)
      if (itemState?.deletedAt !== undefined || itemState?.archivedAt !== undefined || itemState?.readAt !== undefined)
        continue
      emitMailboxAcknowledgement(row.event, row.event.id, "read")
      changedCount += 1
    }
    return MailboxReadAllResult.parse({ changedCount })
  })
}

export function deleteMailboxItems(input: { messageIDs: string[] }): MailboxDeleteResult {
  const messageIDs = [...new Set(input.messageIDs)]
  return Database.transaction(() => {
    const sources = messageIDs.map((messageID) => {
      const source = mailboxSourceEvent(messageID)
      if (!source?.task_id) throw new MailboxItemNotFoundError(messageID)
      return { messageID, source }
    })
    const state = mailboxState()
    let changedCount = 0
    for (const { messageID, source } of sources) {
      if (state.get(messageID)?.deletedAt !== undefined) continue
      emitMailboxAcknowledgement(source, messageID, "delete")
      changedCount += 1
    }
    return MailboxDeleteResult.parse({ changedCount })
  })
}

export function isMailboxChangeEventType(type: string, payload?: unknown): boolean {
  return type === MAILBOX_ACKNOWLEDGEMENT_EVENT_TYPE || isMailboxSourceEvent(type, payload)
}
