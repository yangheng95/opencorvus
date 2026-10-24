import { Token } from "@/util/token"
import z from "zod"
import { NamedError } from "@opencorvus-ai/util/error"
import { Database, and, asc, desc, eq, inArray, lt, or } from "@/storage/db"
import { MemoryChunkTable, MemoryFileTable } from "./memory.sql"
import { MessageTable, PartTable, SessionTable } from "@/session/session.sql"
import { EngineTaskTable } from "@/engine/engine.sql"
import { Message } from "@/session/message"
import { AttachmentStore } from "@/storage/attachment-store"
import { deriveTitle } from "@/title/derive"
import { Bus } from "@/bus"
import { BusEvent } from "@/bus/bus-event"
import { Identifier } from "@/id/id"
import { ProtocolEventTable } from "@/protocol/protocol.sql"
export { InteractionUserInput } from "./interaction-user-input"
export { ProjectMemoryInvariantError } from "./project-memory-entry"
export type { Entry } from "./project-memory-entry"
import {
  Entry,
  Attachment,
  Snapshot,
  ProjectMemoryInvariantError,
  fileID,
  chunkID,
  assertFileOwnership,
  assertChunkOwnership,
  sanitizeText,
  sanitizeJSON,
  safeMetadata,
  insertEntry,
} from "./project-memory-entry"

const EXTRA_KEY = "project_memory_user_input"
const SEMANTIC_VERSION = 1 as const
const DOCUMENT_VERSION = 1 as const
const DEFAULT_DOCUMENT_TOKEN_LIMIT = 10_000
const RECENT_COVERAGE_LIMIT = 500
const ORGANIZER_LEASE_TTL_MS = 15 * 60_000

const OrganizationRequested = BusEvent.define(
  "project.memory.organize.requested",
  z.object({ projectID: z.string().min(1) }),
)

const NoticeChanged = BusEvent.define(
  "project.memory.notice.changed",
  z.object({
    projectID: z.string().min(1),
    status: z.enum([
      "idle",
      "organizing",
      "capacity_reached",
      "evidence_too_large",
      "model_context_incompatible",
      "unavailable",
      "retry_wait",
    ]),
    message: z.string().min(1),
    generation: z.string().min(1),
    acknowledged: z.boolean(),
  }),
)

const Provenance = z
  .object({
    version: z.literal(SEMANTIC_VERSION),
    surface: z.string().min(1),
    literalText: z.string(),
  })
  .strict()

const OrganizerStatus = z.enum([
  "idle",
  "organizing",
  "capacity_reached",
  "evidence_too_large",
  "model_context_incompatible",
  "unavailable",
  "retry_wait",
])
export type OrganizerStatus = z.infer<typeof OrganizerStatus>

const DocumentEnvelope = z.object({
  version: z.literal(DOCUMENT_VERSION),
  revision: z.number().int().nonnegative(),
  markdown: z.string(),
  tokenCount: z.number().int().nonnegative(),
  status: OrganizerStatus,
  recentCoveredOccurrenceIDs: z.array(z.string()).max(RECENT_COVERAGE_LIMIT),
  droppedPendingCount: z.number().int().nonnegative(),
  availabilityGeneration: z.number().int().nonnegative(),
  organizerLease: z
    .object({
      id: z.string().min(1),
      availabilityGeneration: z.number().int().nonnegative(),
      revision: z.number().int().nonnegative(),
      expiresAt: z.number().int().nonnegative(),
    })
    .optional(),
  notice: z
    .object({
      status: OrganizerStatus,
      message: z.string().min(1),
      generation: z.string().min(1),
      acknowledged: z.boolean(),
    })
    .optional(),
  timeCreated: z.number().int().nonnegative(),
  timeUpdated: z.number().int().nonnegative(),
})
export type DocumentEnvelope = z.infer<typeof DocumentEnvelope>

export const ProtectedProjectMemoryError = NamedError.create(
  "ProtectedProjectMemoryError",
  z.object({
    message: z.string(),
    code: z.literal("protected_project_memory"),
    fileID: z.string(),
  }),
)

function documentFileID(projectID: string) {
  return Identifier.deterministic("memory", `project-context\0${projectID}`)
}

function documentChunkID(projectID: string) {
  return Identifier.deterministic("memchunk", `project-context\0${projectID}`)
}

function ownsOrganizerLease(
  envelope: DocumentEnvelope,
  input: { leaseID: string; expectedRevision: number; time: number },
) {
  const lease = envelope.organizerLease
  return Boolean(
    lease &&
      lease.id === input.leaseID &&
      lease.availabilityGeneration === envelope.availabilityGeneration &&
      lease.revision === input.expectedRevision &&
      lease.expiresAt > input.time,
  )
}

function initialEnvelope(now = Date.now()): DocumentEnvelope {
  return DocumentEnvelope.parse({
    version: DOCUMENT_VERSION,
    revision: 0,
    markdown: "",
    tokenCount: 0,
    status: "idle",
    recentCoveredOccurrenceIDs: [],
    droppedPendingCount: 0,
    availabilityGeneration: 0,
    timeCreated: now,
    timeUpdated: now,
  })
}

function envelopeInTransaction(db: Database.TxOrDb, projectID: string): DocumentEnvelope {
  const id = documentFileID(projectID)
  const cid = documentChunkID(projectID)
  const file = db.select().from(MemoryFileTable).where(eq(MemoryFileTable.id, id)).get()
  const chunk = db.select().from(MemoryChunkTable).where(eq(MemoryChunkTable.id, cid)).get()
  assertFileOwnership(file, {
    id,
    projectID,
    source: "reflection",
    kind: "project_context",
    key: "project-memory-document",
    occurrenceID: "project-context",
  })
  assertChunkOwnership(chunk, { id: cid, fileID: id, projectID, occurrenceID: "project-context" })
  const existing = db
    .select({ content: MemoryChunkTable.content })
    .from(MemoryChunkTable)
    .where(and(eq(MemoryChunkTable.id, cid), eq(MemoryChunkTable.file_id, id)))
    .get()
  if (existing) return DocumentEnvelope.parse(JSON.parse(existing.content))
  const envelope = initialEnvelope()
  const content = JSON.stringify(envelope)
  db.insert(MemoryFileTable)
    .values({
      id,
      project_id: projectID,
      title: "Project MEMORY.MD",
      source: "reflection",
      kind: "project_context",
      key: "project-memory-document",
      importance: 100,
      confidence: 100,
      time_created: envelope.timeCreated,
      time_updated: envelope.timeUpdated,
    })
    .onConflictDoNothing()
    .run()
  db.insert(MemoryChunkTable)
    .values({
      id: cid,
      file_id: id,
      project_id: projectID,
      content,
      token_count: 0,
      time_created: envelope.timeCreated,
      time_updated: envelope.timeUpdated,
    })
    .onConflictDoNothing()
    .run()
  const stored = db
    .select({ content: MemoryChunkTable.content })
    .from(MemoryChunkTable)
    .where(eq(MemoryChunkTable.id, cid))
    .get()
  if (!stored) throw new Error(`Project MEMORY.MD envelope could not be initialized for ${projectID}`)
  return DocumentEnvelope.parse(JSON.parse(stored.content))
}

function writeEnvelope(db: Database.TxOrDb, projectID: string, envelope: DocumentEnvelope) {
  const parsed = DocumentEnvelope.parse(envelope)
  db.update(MemoryChunkTable)
    .set({ content: JSON.stringify(parsed), token_count: parsed.tokenCount, time_updated: parsed.timeUpdated })
    .where(and(eq(MemoryChunkTable.id, documentChunkID(projectID)), eq(MemoryChunkTable.project_id, projectID)))
    .run()
  db.update(MemoryFileTable)
    .set({ time_updated: parsed.timeUpdated })
    .where(and(eq(MemoryFileTable.id, documentFileID(projectID)), eq(MemoryFileTable.project_id, projectID)))
    .run()
}

function inboxRows(db: Database.TxOrDb, projectID: string) {
  return db
    .select({ id: MemoryFileTable.id, content: MemoryChunkTable.content })
    .from(MemoryFileTable)
    .innerJoin(MemoryChunkTable, eq(MemoryChunkTable.file_id, MemoryFileTable.id))
    .where(and(eq(MemoryFileTable.project_id, projectID), eq(MemoryFileTable.kind, "user_message")))
    .orderBy(asc(MemoryFileTable.time_created), asc(MemoryFileTable.id))
    .all()
    .map((row) => {
      const entry = Entry.parse(JSON.parse(row.content))
      if (entry.projectID !== projectID)
        throw new ProjectMemoryInvariantError({
          message: `Project memory occurrence ${entry.occurrenceID} has a conflicting source Project`,
          occurrenceID: entry.occurrenceID,
          fileID: row.id,
        })
      const owner =
        entry.ownerKind === "task"
          ? db
              .select({ projectID: EngineTaskTable.project_id })
              .from(EngineTaskTable)
              .where(eq(EngineTaskTable.id, entry.ownerID))
              .get()
          : db
              .select({ projectID: SessionTable.project_id })
              .from(SessionTable)
              .where(eq(SessionTable.id, entry.ownerID))
              .get()
      if (owner && owner.projectID !== projectID)
        throw new ProjectMemoryInvariantError({
          message: `Project memory occurrence ${entry.occurrenceID} has a conflicting owner Project`,
          occurrenceID: entry.occurrenceID,
          fileID: row.id,
        })
      const deleted =
        entry.ownerKind === "task" &&
        db
          .select({ id: ProtocolEventTable.id })
          .from(ProtocolEventTable)
          .where(
            and(
              eq(ProtocolEventTable.aggregate_type, "task"),
              eq(ProtocolEventTable.aggregate_id, entry.ownerID),
              eq(ProtocolEventTable.type, "task.deleted"),
            ),
          )
          .get()
      const sessionIDs = new Set(
        [entry.sessionID, ...(entry.ownerKind === "conversation" ? [entry.ownerID] : [])].filter((id): id is string =>
          Boolean(id),
        ),
      )
      let sourceSessionUnavailable = false
      for (const id of sessionIDs) {
        const source = db
          .select({ projectID: SessionTable.project_id })
          .from(SessionTable)
          .where(eq(SessionTable.id, id))
          .get()
        if (source && source.projectID !== projectID)
          throw new ProjectMemoryInvariantError({
            message: `Project memory occurrence ${entry.occurrenceID} has a conflicting source Session Project`,
            occurrenceID: entry.occurrenceID,
            fileID: row.id,
          })
        const tombstone = db
          .select({ id: ProtocolEventTable.id })
          .from(ProtocolEventTable)
          .where(
            and(
              eq(ProtocolEventTable.aggregate_type, "session"),
              eq(ProtocolEventTable.aggregate_id, id),
              eq(ProtocolEventTable.type, "session.deleted"),
            ),
          )
          .get()
        sourceSessionUnavailable ||= !source || Boolean(tombstone)
      }
      return {
        fileID: row.id,
        content: row.content,
        entry,
        unresolved:
          entry.recovery?.ownerResolution === "unresolved" || !owner || Boolean(deleted) || sourceSessionUnavailable,
      }
    })
}

function pendingRows(db: Database.TxOrDb, projectID: string) {
  return inboxRows(db, projectID).filter((row) => !row.unresolved)
}

function safeAttachment(
  input: { url: string; mime: string; filename?: string; size?: number },
  index: number,
  projectID?: string,
) {
  const located = AttachmentStore.nameFromUrl(input.url)
  return Attachment.parse({
    filename: safeMetadata(
      AttachmentStore.displayFilename({ filename: input.filename, mime: input.mime, index }),
      `attachment-${index + 1}`,
    ),
    mime: safeMetadata(input.mime, "application/octet-stream"),
    reference:
      located && (!projectID || located.projectID === projectID)
        ? `/attachment/${located.projectID}/${located.name}`
        : "<external-reference-omitted>",
    ...(input.size === undefined ? {} : { size: input.size }),
  })
}

function snapshot(info: Message.Info, parts: Message.Part[], projectID?: string): z.infer<typeof Snapshot> {
  const attachments = parts
    .filter((part): part is Message.FilePart => part.type === "file")
    .map((part, index) => safeAttachment(part, index, projectID))
  return Snapshot.parse({
    messageID: info.id,
    role: info.role,
    author: info.author,
    text: sanitizeText(
      parts
        .filter((part): part is Message.TextPart => part.type === "text")
        .map((part) => part.text)
        .join("\n\n"),
    ),
    attachments,
  })
}

function persistedMessage(row: typeof MessageTable.$inferSelect, parts: Array<typeof PartTable.$inferSelect>) {
  const info = Message.Info.parse({ ...row.data, id: row.id, sessionID: row.session_id })
  const parsedParts = parts.map((part) =>
    Message.Part.parse({
      ...part.data,
      id: part.id,
      messageID: part.message_id,
      sessionID: row.session_id,
    }),
  )
  return { info, parts: parsedParts }
}

function previousContext(
  db: Database.TxOrDb,
  sessionID: string,
  before?: { messageID: string; timeCreated: number },
  projectID?: string,
) {
  const rows = db
    .select()
    .from(MessageTable)
    .where(
      before
        ? and(
            eq(MessageTable.session_id, sessionID),
            or(
              lt(MessageTable.time_created, before.timeCreated),
              and(eq(MessageTable.time_created, before.timeCreated), lt(MessageTable.id, before.messageID)),
            ),
          )
        : eq(MessageTable.session_id, sessionID),
    )
    .orderBy(desc(MessageTable.time_created), desc(MessageTable.id))
    .limit(2)
    .all()
    .reverse()
  return rows.map((row) => {
    const parts = db
      .select()
      .from(PartTable)
      .where(eq(PartTable.message_id, row.id))
      .orderBy(asc(PartTable.time_created), asc(PartTable.id))
      .all()
    const message = persistedMessage(row, parts)
    return snapshot(message.info, message.parts, projectID)
  })
}

function owner(db: Database.TxOrDb, input: { sessionID?: string; taskID?: string; text: string }) {
  if (input.taskID) {
    const task = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, input.taskID)).get()
    if (!task) throw new Error(`Project memory Task owner not found: ${input.taskID}`)
    return {
      ownerKind: "task" as const,
      ownerID: task.id,
      ownerNameAtCapture: safeMetadata(task.title, "Untitled task"),
    }
  }
  if (!input.sessionID) throw new Error("Project memory occurrence requires a Task or Session owner")
  let current: string | undefined = input.sessionID
  const visited = new Set<string>()
  while (current && !visited.has(current)) {
    visited.add(current)
    const task = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.session_id, current)).get()
    if (task)
      return {
        ownerKind: "task" as const,
        ownerID: task.id,
        ownerNameAtCapture: safeMetadata(task.title, "Untitled task"),
      }
    const session = db.select().from(SessionTable).where(eq(SessionTable.id, current)).get()
    if (!session) break
    if (current === input.sessionID) {
      const defaultTitle = ["Chat", "Work", "Mission Control"].includes(session.title)
      const title = defaultTitle && input.text.trim() ? deriveTitle(sanitizeText(input.text)) : session.title
      if (!session.parent_id) {
        return {
          ownerKind: "conversation" as const,
          ownerID: session.id,
          ownerNameAtCapture: safeMetadata(title, "Untitled conversation"),
        }
      }
    }
    current = session.parent_id ?? undefined
  }
  const session = db.select().from(SessionTable).where(eq(SessionTable.id, input.sessionID)).get()
  if (!session) throw new Error(`Project memory Session owner not found: ${input.sessionID}`)
  return {
    ownerKind: "conversation" as const,
    ownerID: session.id,
    ownerNameAtCapture: safeMetadata(session.title, "Untitled conversation"),
  }
}

function insert(db: Database.TxOrDb, entry: Entry) {
  const { created, ...result } = insertEntry(db, entry)
  if (created) Bus.publishOwnedInTransaction(OrganizationRequested, { projectID: entry.projectID })
  return result
}

function provenance(info: Message.Info) {
  if (info.role !== "user") return
  return Provenance.safeParse(info.extra?.[EXTRA_KEY]).success ? Provenance.parse(info.extra?.[EXTRA_KEY]) : undefined
}

export namespace ProjectMemory {
  export const Event = { OrganizationRequested, NoticeChanged }
  export const filename = "MEMORY.MD" as const
  export const scope = "project" as const
  export const documentTokenLimit = DEFAULT_DOCUMENT_TOKEN_LIMIT
  export const TestHooks = {
    userFile: fileID,
    userChunk: (projectID: string, kind: Entry["occurrenceKind"], occurrenceID: string) =>
      chunkID(fileID(projectID, kind, occurrenceID)),
    documentFile: documentFileID,
    documentChunk: documentChunkID,
  }

  export function userInputExtra(input: { surface: string; literalText: string }) {
    return { [EXTRA_KEY]: Provenance.parse({ version: SEMANTIC_VERSION, ...input }) }
  }

  export function captureMessageInTransaction(
    db: Database.TxOrDb,
    input: { info: Message.Info; parts: Message.Part[] },
  ) {
    const marker = provenance(input.info)
    if (!marker) return { classification: "runtime_internal" as const, messageID: input.info.id }
    if (input.info.copySources !== undefined)
      return { classification: "copied_context" as const, messageID: input.info.id }
    const session = db.select().from(SessionTable).where(eq(SessionTable.id, input.info.sessionID)).get()
    if (!session) throw new Error(`Project memory Session not found: ${input.info.sessionID}`)
    const literal = marker.literalText
    const resolvedOwner = owner(db, { sessionID: session.id, text: literal })
    return insert(
      db,
      Entry.parse({
        version: SEMANTIC_VERSION,
        occurrenceKind: "message",
        occurrenceID: input.info.id,
        projectID: session.project_id,
        sessionID: session.id,
        ...(resolvedOwner.ownerKind === "task" ? { taskID: resolvedOwner.ownerID } : {}),
        ...resolvedOwner,
        surface: marker.surface,
        timeCreated: input.info.time.created,
        text: sanitizeText(literal),
        attachments: input.parts
          .filter((part): part is Message.FilePart => part.type === "file")
          .map((part, index) => safeAttachment(part, index, session.project_id)),
        context: previousContext(
          db,
          session.id,
          {
            messageID: input.info.id,
            timeCreated: input.info.time.created,
          },
          session.project_id,
        ),
      }),
    )
  }

  export function captureOccurrenceInTransaction(
    db: Database.TxOrDb,
    input: {
      occurrenceKind: Exclude<Entry["occurrenceKind"], "message">
      occurrenceID: string
      projectID: string
      sessionID?: string
      taskID?: string
      surface: string
      timeCreated: number
      text: string
      structured?: Record<string, z.infer<typeof z.json>>
      attachments?: Array<{ url: string; mime: string; filename?: string; size?: number }>
    },
  ) {
    const resolvedOwner = owner(db, { sessionID: input.sessionID, taskID: input.taskID, text: input.text })
    return insert(
      db,
      Entry.parse({
        version: SEMANTIC_VERSION,
        ...input,
        ...resolvedOwner,
        text: sanitizeText(input.text),
        ...(input.structured ? { structured: sanitizeJSON(z.json().parse(input.structured)) } : {}),
        attachments: (input.attachments ?? []).map((item, index) => safeAttachment(item, index, input.projectID)),
        context: input.sessionID ? previousContext(db, input.sessionID, undefined, input.projectID) : [],
      }),
    )
  }

  export function read(projectID: string, input: { unresolvedOffset?: number } = {}) {
    return Database.transaction((db) => readInTransaction(db, projectID, input))
  }

  export function readInTransaction(db: Database.TxOrDb, projectID: string, input: { unresolvedOffset?: number } = {}) {
    const unresolvedOffset = z
      .number()
      .int()
      .nonnegative()
      .parse(input.unresolvedOffset ?? 0)
    const envelope = envelopeInTransaction(db, projectID)
    const inbox = inboxRows(db, projectID)
    const unresolved = inbox.filter((row) => row.unresolved)
    const pendingCount = inbox.length - unresolved.length
    return {
      filename,
      scope,
      content: envelope.markdown,
      revision: envelope.revision,
      tokenCount: envelope.tokenCount,
      status: envelope.status,
      pendingCount,
      ...(unresolved.length
        ? {
            unresolvedCount: unresolved.length,
            unresolvedOffset,
            unresolvedNextOffset: unresolvedOffset + 50 < unresolved.length ? unresolvedOffset + 50 : null,
            unresolvedOccurrences: unresolved.slice(unresolvedOffset, unresolvedOffset + 50).map(({ entry }) => ({
              occurrenceID: entry.occurrenceID,
              originalTaskID: entry.taskID,
              originalSessionID: entry.sessionID,
              publicationID: entry.recovery?.publicationID,
              ownerResolution: "unresolved" as const,
            })),
          }
        : {}),
      droppedPendingCount: envelope.droppedPendingCount,
      notice: envelope.notice,
      timeCreated: envelope.timeCreated,
      timeUpdated: envelope.timeUpdated,
    }
  }

  export function pending(projectID: string) {
    return Database.use((db) => pendingRows(db, projectID).map((item) => item.entry))
  }

  /** Read the same protected inbox evidence without assigning an unknown old
   * owner to the current Project generation. Pages bound ordinary Tool output. */
  export function readRecovery(projectID: string, input: { occurrenceID: string; offset?: number; limit?: number }) {
    const offset = z
      .number()
      .int()
      .nonnegative()
      .parse(input.offset ?? 0)
    const limit = z
      .number()
      .int()
      .min(1)
      .max(4000)
      .parse(input.limit ?? 4000)
    return Database.use((db) => {
      const row = inboxRows(db, projectID).find(
        (row) => row.entry.occurrenceID === input.occurrenceID && row.unresolved,
      )
      if (!row) return { status: "not_found" as const, occurrenceID: input.occurrenceID }
      const end = Math.min(row.content.length, offset + limit)
      return {
        status: "available" as const,
        occurrenceID: input.occurrenceID,
        ownerResolution: "unresolved" as const,
        offset,
        totalCharacters: row.content.length,
        content: row.content.slice(offset, end),
        nextOffset: end < row.content.length ? end : null,
      }
    })
  }

  export function requestOrganizationInTransaction(db: Database.TxOrDb, input: { projectID: string }) {
    if (pendingRows(db, input.projectID).length === 0) return false
    Bus.publishOwnedInTransaction(OrganizationRequested, input)
    return true
  }

  export function setStatusInTransaction(
    db: Database.TxOrDb,
    input: {
      projectID: string
      status: OrganizerStatus
      generation: string
      message?: string
      expectedRevision?: number
      leaseID?: string
      timeUpdated?: number
    },
  ) {
    const envelope = envelopeInTransaction(db, input.projectID)
    if (input.expectedRevision !== undefined && envelope.revision !== input.expectedRevision) return false
    const timeUpdated = input.timeUpdated ?? Date.now()
    if (input.leaseID) {
      if (
        !ownsOrganizerLease(envelope, {
          leaseID: input.leaseID,
          expectedRevision: input.expectedRevision ?? envelope.revision,
          time: timeUpdated,
        })
      )
        return false
    } else if (envelope.organizerLease) {
      return false
    }
    const nextNotice = input.message
      ? {
          status: input.status,
          message: safeMetadata(input.message, "Project MEMORY.MD requires attention"),
          generation: input.generation,
          acknowledged: false,
        }
      : undefined
    const noticeChanged = JSON.stringify(envelope.notice) !== JSON.stringify(nextNotice)
    writeEnvelope(
      db,
      input.projectID,
      DocumentEnvelope.parse({
        ...envelope,
        status: input.status,
        organizerLease: undefined,
        notice: nextNotice,
        timeUpdated,
      }),
    )
    if (nextNotice && noticeChanged) {
      Bus.publishOwnedInTransaction(NoticeChanged, {
        projectID: input.projectID,
        ...nextNotice,
      })
    }
    return true
  }

  export function beginOrganizerAttemptInTransaction(
    db: Database.TxOrDb,
    input: {
      projectID: string
      leaseID: string
      expectedRevision: number
      leaseTtlMs?: number
      timeUpdated?: number
    },
  ) {
    const envelope = envelopeInTransaction(db, input.projectID)
    if (envelope.revision !== input.expectedRevision) return undefined
    const timeUpdated = input.timeUpdated ?? Date.now()
    if (envelope.organizerLease) {
      if (
        envelope.organizerLease.id === input.leaseID &&
        envelope.organizerLease.availabilityGeneration === envelope.availabilityGeneration &&
        envelope.organizerLease.revision === envelope.revision
      ) {
        return envelope.organizerLease
      }
      if (envelope.organizerLease.expiresAt > timeUpdated) return undefined
    }
    const lease = {
      id: input.leaseID,
      availabilityGeneration: envelope.availabilityGeneration,
      revision: envelope.revision,
      expiresAt: timeUpdated + (input.leaseTtlMs ?? ORGANIZER_LEASE_TTL_MS),
    }
    writeEnvelope(
      db,
      input.projectID,
      DocumentEnvelope.parse({
        ...envelope,
        status: "organizing",
        organizerLease: lease,
        timeUpdated,
      }),
    )
    return lease
  }

  export function releaseOrganizerAttemptInTransaction(
    db: Database.TxOrDb,
    input: { projectID: string; leaseID: string; timeUpdated?: number },
  ) {
    const envelope = envelopeInTransaction(db, input.projectID)
    const timeUpdated = input.timeUpdated ?? Date.now()
    if (
      !ownsOrganizerLease(envelope, {
        leaseID: input.leaseID,
        expectedRevision: envelope.revision,
        time: timeUpdated,
      })
    )
      return false
    writeEnvelope(
      db,
      input.projectID,
      DocumentEnvelope.parse({
        ...envelope,
        organizerLease: undefined,
        status: "retry_wait",
        timeUpdated,
      }),
    )
    return true
  }

  export function invalidateOrganizerAvailabilityInTransaction(
    db: Database.TxOrDb,
    input: { projectID: string; timeUpdated?: number },
  ) {
    const envelope = envelopeInTransaction(db, input.projectID)
    const next = DocumentEnvelope.parse({
      ...envelope,
      availabilityGeneration: envelope.availabilityGeneration + 1,
      organizerLease: undefined,
      status: envelope.organizerLease || envelope.status === "unavailable" ? "retry_wait" : envelope.status,
      timeUpdated: input.timeUpdated ?? Date.now(),
    })
    writeEnvelope(db, input.projectID, next)
    return next.availabilityGeneration
  }

  export function acknowledgeNoticeInTransaction(
    db: Database.TxOrDb,
    input: { projectID: string; generation: string; timeUpdated?: number },
  ) {
    const envelope = envelopeInTransaction(db, input.projectID)
    if (!envelope.notice || envelope.notice.generation !== input.generation) return false
    if (envelope.notice.acknowledged) return true
    const notice = { ...envelope.notice, acknowledged: true }
    writeEnvelope(
      db,
      input.projectID,
      DocumentEnvelope.parse({ ...envelope, notice, timeUpdated: input.timeUpdated ?? Date.now() }),
    )
    Bus.publishOwnedInTransaction(NoticeChanged, { projectID: input.projectID, ...notice })
    return true
  }

  export function markUnavailableAndTrimInTransaction(
    db: Database.TxOrDb,
    input: {
      projectID: string
      leaseID: string
      generation: string
      expectedRevision: number
      expectedOccurrenceIDs: string[]
      pendingAvailabilityLimit: number
      allowTrim: boolean
      message: string
      timeUpdated?: number
    },
  ) {
    const envelope = envelopeInTransaction(db, input.projectID)
    const pending = pendingRows(db, input.projectID)
    const pendingIDs = pending.map((item) => item.entry.occurrenceID)
    const timeUpdated = input.timeUpdated ?? Date.now()
    if (
      envelope.revision !== input.expectedRevision ||
      !ownsOrganizerLease(envelope, {
        leaseID: input.leaseID,
        expectedRevision: input.expectedRevision,
        time: timeUpdated,
      }) ||
      pendingIDs.join("\0") !== input.expectedOccurrenceIDs.join("\0")
    ) {
      return { applied: false as const, droppedOccurrenceIDs: [] as string[] }
    }
    // One unavailable generation proves only the current FIFO head's owner and
    // configuration. Never use that proof to discard a later owner's evidence.
    const excess = input.allowTrim && pending.length > input.pendingAvailabilityLimit ? 1 : 0
    const dropped = pending.slice(0, excess)
    const droppedOccurrenceIDs = dropped.map((item) => item.entry.occurrenceID)
    const message =
      excess > 0
        ? `${input.message} ${excess} oldest pending input(s) were removed by the unavailable-only FIFO limit.`
        : input.message
    writeEnvelope(
      db,
      input.projectID,
      DocumentEnvelope.parse({
        ...envelope,
        status: "unavailable",
        organizerLease: undefined,
        droppedPendingCount: envelope.droppedPendingCount + excess,
        notice: {
          status: "unavailable",
          message: safeMetadata(message, "Project MEMORY.MD Organizer is unavailable"),
          generation: input.generation,
          acknowledged: false,
        },
        timeUpdated,
      }),
    )
    Bus.publishOwnedInTransaction(NoticeChanged, {
      projectID: input.projectID,
      status: "unavailable",
      message: safeMetadata(message, "Project MEMORY.MD Organizer is unavailable"),
      generation: input.generation,
      acknowledged: false,
    })
    if (dropped.length > 0) {
      const ids = dropped.map((item) => item.fileID)
      db.delete(MemoryChunkTable)
        .where(and(eq(MemoryChunkTable.project_id, input.projectID), inArray(MemoryChunkTable.file_id, ids)))
        .run()
      db.delete(MemoryFileTable)
        .where(and(eq(MemoryFileTable.project_id, input.projectID), inArray(MemoryFileTable.id, ids)))
        .run()
    }
    return { applied: true as const, droppedOccurrenceIDs }
  }

  export function commitOrganizationInTransaction(
    db: Database.TxOrDb,
    input: {
      projectID: string
      leaseID: string
      baseRevision: number
      coveredOccurrenceIDs: string[]
      markdown: string
      documentTokenLimit?: number
      timeUpdated?: number
    },
  ) {
    const envelope = envelopeInTransaction(db, input.projectID)
    const normalizedMarkdown = input.markdown.trim() + "\n"
    const replayedCoverage = input.coveredOccurrenceIDs.every(
      (id, index) =>
        envelope.recentCoveredOccurrenceIDs[
          envelope.recentCoveredOccurrenceIDs.length - input.coveredOccurrenceIDs.length + index
        ] === id,
    )
    if (envelope.revision === input.baseRevision + 1 && replayedCoverage && envelope.markdown === normalizedMarkdown) {
      return {
        revision: envelope.revision,
        tokenCount: envelope.tokenCount,
        coveredOccurrenceIDs: input.coveredOccurrenceIDs,
      }
    }
    if (
      !ownsOrganizerLease(envelope, {
        leaseID: input.leaseID,
        expectedRevision: input.baseRevision,
        time: input.timeUpdated ?? Date.now(),
      })
    ) {
      throw new ProjectMemoryInvariantError({
        message: `Project MEMORY.MD organization lease is stale for revision ${input.baseRevision}`,
        occurrenceID: input.coveredOccurrenceIDs[0] ?? "<empty-prefix>",
        fileID: documentFileID(input.projectID),
      })
    }
    const pending = pendingRows(db, input.projectID)
    const expected = pending.slice(0, input.coveredOccurrenceIDs.length)
    const expectedIDs = expected.map((item) => item.entry.occurrenceID)
    if (envelope.revision !== input.baseRevision || expectedIDs.join("\0") !== input.coveredOccurrenceIDs.join("\0")) {
      throw new ProjectMemoryInvariantError({
        message: `Project MEMORY.MD organization candidate is stale for revision ${input.baseRevision}`,
        occurrenceID: input.coveredOccurrenceIDs[0] ?? "<empty-prefix>",
        fileID: documentFileID(input.projectID),
      })
    }
    if (expected.length === 0) {
      throw new ProjectMemoryInvariantError({
        message: "Project MEMORY.MD organization must cover a nonempty pending prefix",
        occurrenceID: "<empty-prefix>",
        fileID: documentFileID(input.projectID),
      })
    }
    const markdown = normalizedMarkdown
    const tokenCount = Token.estimate(markdown)
    const limit = input.documentTokenLimit ?? DEFAULT_DOCUMENT_TOKEN_LIMIT
    if (!input.markdown.trim() || tokenCount > limit || sanitizeText(markdown) !== markdown) {
      throw new ProjectMemoryInvariantError({
        message: `Project MEMORY.MD candidate failed structural or safety validation`,
        occurrenceID: input.coveredOccurrenceIDs[0]!,
        fileID: documentFileID(input.projectID),
      })
    }
    const timeUpdated = input.timeUpdated ?? Date.now()
    const next = DocumentEnvelope.parse({
      ...envelope,
      revision: envelope.revision + 1,
      markdown,
      tokenCount,
      status: "idle",
      organizerLease: undefined,
      recentCoveredOccurrenceIDs: [...envelope.recentCoveredOccurrenceIDs, ...input.coveredOccurrenceIDs].slice(
        -RECENT_COVERAGE_LIMIT,
      ),
      notice: undefined,
      timeUpdated,
    })
    writeEnvelope(db, input.projectID, next)
    if (envelope.notice) {
      Bus.publishOwnedInTransaction(NoticeChanged, {
        projectID: input.projectID,
        ...envelope.notice,
        acknowledged: true,
      })
    }
    const coveredFileIDs = expected.map((item) => item.fileID)
    db.delete(MemoryChunkTable)
      .where(and(eq(MemoryChunkTable.project_id, input.projectID), inArray(MemoryChunkTable.file_id, coveredFileIDs)))
      .run()
    db.delete(MemoryFileTable)
      .where(and(eq(MemoryFileTable.project_id, input.projectID), inArray(MemoryFileTable.id, coveredFileIDs)))
      .run()
    return { revision: next.revision, tokenCount, coveredOccurrenceIDs: input.coveredOccurrenceIDs }
  }
}
