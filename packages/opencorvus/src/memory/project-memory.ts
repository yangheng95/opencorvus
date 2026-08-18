import { Token } from "@/util/token"
import z from "zod"
import { NamedError } from "@opencorvus-ai/util/error"
import { Database, and, asc, desc, eq, inArray, lt, or } from "@/storage/db"
import { MemoryChunkTable, MemoryFileTable } from "./memory.sql"
import type { HostOwnedMemoryKind } from "./types"
import { MessageTable, PartTable, SessionTable } from "@/session/session.sql"
import { EngineTaskTable } from "@/engine/engine.sql"
import { Message } from "@/session/message"
import { AttachmentStore } from "@/storage/attachment-store"
import { redactInlinePayloads } from "@/util/inline-base64"
import { ProviderError } from "@/provider/error"
import { deriveTitle } from "@/title/derive"
import { Bus } from "@/bus"
import { BusEvent } from "@/bus/bus-event"
import { Identifier } from "@/id/id"
export { InteractionUserInput } from "./interaction-user-input"

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

const Attachment = z.object({
  filename: z.string(),
  mime: z.string(),
  reference: z.string(),
  size: z.number().int().nonnegative().optional(),
})

const Snapshot = z.object({
  messageID: z.string(),
  role: z.enum(["user", "assistant"]),
  author: z.string(),
  text: z.string(),
  structured: z.record(z.string(), z.json()).optional(),
  attachments: z.array(Attachment),
})

const Entry = z.object({
  version: z.literal(SEMANTIC_VERSION),
  occurrenceKind: z.enum(["message", "task_create", "interaction_reply", "interaction_reject"]),
  occurrenceID: z.string().min(1),
  projectID: z.string().min(1),
  sessionID: z.string().optional(),
  taskID: z.string().optional(),
  ownerKind: z.enum(["task", "conversation"]),
  ownerID: z.string().min(1),
  ownerNameAtCapture: z.string().min(1),
  surface: z.string().min(1),
  timeCreated: z.number().int().nonnegative(),
  text: z.string(),
  structured: z.record(z.string(), z.json()).optional(),
  attachments: z.array(Attachment),
  context: z.array(Snapshot).max(2),
})
export type Entry = z.infer<typeof Entry>

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

export const ProjectMemoryInvariantError = NamedError.create(
  "ProjectMemoryInvariantError",
  z.object({ message: z.string(), occurrenceID: z.string(), fileID: z.string() }),
)

export const ProtectedProjectMemoryError = NamedError.create(
  "ProtectedProjectMemoryError",
  z.object({
    message: z.string(),
    code: z.literal("protected_project_memory"),
    fileID: z.string(),
  }),
)

function fileID(projectID: string, kind: Entry["occurrenceKind"], occurrenceID: string) {
  return Identifier.deterministic("memory", `project-user-input\0${projectID}\0${kind}\0${occurrenceID}`)
}

function chunkID(id: string) {
  return Identifier.deterministic("memchunk", `project-user-input\0${id}`)
}

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

function assertFileOwnership(
  row: typeof MemoryFileTable.$inferSelect | undefined,
  expected: {
    id: string
    projectID: string
    source: "user" | "reflection"
    // Restating the pair here made this the third place that decided what the
    // Host owns; `HOST_OWNED_MEMORY_KINDS` is the one that does.
    kind: HostOwnedMemoryKind
    key: string
    occurrenceID: string
  },
) {
  if (
    row &&
    (row.project_id !== expected.projectID ||
      row.source !== expected.source ||
      row.kind !== expected.kind ||
      row.key !== expected.key)
  ) {
    throw new ProjectMemoryInvariantError({
      message: `Project memory identity ${expected.id} is owned by incompatible file metadata`,
      occurrenceID: expected.occurrenceID,
      fileID: expected.id,
    })
  }
}

function assertChunkOwnership(
  row: typeof MemoryChunkTable.$inferSelect | undefined,
  expected: { id: string; fileID: string; projectID: string; occurrenceID: string },
) {
  if (row && (row.file_id !== expected.fileID || row.project_id !== expected.projectID)) {
    throw new ProjectMemoryInvariantError({
      message: `Project memory chunk identity ${expected.id} is owned by an incompatible file`,
      occurrenceID: expected.occurrenceID,
      fileID: expected.fileID,
    })
  }
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

function pendingRows(db: Database.TxOrDb, projectID: string) {
  return db
    .select({ id: MemoryFileTable.id, content: MemoryChunkTable.content })
    .from(MemoryFileTable)
    .innerJoin(MemoryChunkTable, eq(MemoryChunkTable.file_id, MemoryFileTable.id))
    .where(and(eq(MemoryFileTable.project_id, projectID), eq(MemoryFileTable.kind, "user_message")))
    .orderBy(asc(MemoryFileTable.time_created), asc(MemoryFileTable.id))
    .all()
    .map((row) => ({ fileID: row.id, entry: Entry.parse(JSON.parse(row.content)) }))
}

function sanitizeText(input: string) {
  let value = redactInlinePayloads(ProviderError.redactSensitiveProviderText(input))
  value = value.replace(
    /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/gi,
    "<redacted>",
  )
  value = value.replace(
    /\b(password|passwd|pwd|token|access[_ -]?token|refresh[_ -]?token|client[_ -]?secret|private[_ -]?key|credential)s?(["']?\s*[:=]\s*["']?)([^\s,;"'}]+)/gi,
    "$1$2<redacted>",
  )
  return value
}

function sanitizeJSON(input: z.infer<typeof z.json>): z.infer<typeof z.json> {
  if (typeof input === "string") return sanitizeText(input)
  if (Array.isArray(input)) return input.map(sanitizeJSON)
  if (input && typeof input === "object") {
    return Object.fromEntries(Object.entries(input).map(([key, value]) => [sanitizeText(key), sanitizeJSON(value)]))
  }
  return input
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

function safeMetadata(input: string, fallback: string) {
  const value = sanitizeText(input)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
  return value || fallback
}

function canonical(entry: Entry) {
  return JSON.stringify(Entry.parse(entry))
}

function insert(db: Database.TxOrDb, entry: Entry) {
  const payload = canonical(entry)
  const id = fileID(entry.projectID, entry.occurrenceKind, entry.occurrenceID)
  const cid = chunkID(id)
  const existingFile = db.select().from(MemoryFileTable).where(eq(MemoryFileTable.id, id)).get()
  const existingChunk = db.select().from(MemoryChunkTable).where(eq(MemoryChunkTable.id, cid)).get()
  assertFileOwnership(existingFile, {
    id,
    projectID: entry.projectID,
    source: "user",
    kind: "user_message",
    key: `${entry.occurrenceKind}:${entry.occurrenceID}`,
    occurrenceID: entry.occurrenceID,
  })
  assertChunkOwnership(existingChunk, { id: cid, fileID: id, projectID: entry.projectID, occurrenceID: entry.occurrenceID })
  const existed = Boolean(existingFile)
  db.insert(MemoryFileTable)
    .values({
      id,
      project_id: entry.projectID,
      title: entry.ownerNameAtCapture,
      source: "user",
      kind: "user_message",
      key: `${entry.occurrenceKind}:${entry.occurrenceID}`,
      importance: 100,
      confidence: 100,
      time_created: entry.timeCreated,
      time_updated: entry.timeCreated,
    })
    .onConflictDoNothing()
    .run()
  db.insert(MemoryChunkTable)
    .values({
      id: cid,
      file_id: id,
      project_id: entry.projectID,
      content: payload,
      token_count: Token.estimate(payload),
      time_created: entry.timeCreated,
      time_updated: entry.timeCreated,
    })
    .onConflictDoNothing()
    .run()
  const stored = db
    .select({ content: MemoryChunkTable.content })
    .from(MemoryChunkTable)
    .where(and(eq(MemoryChunkTable.id, cid), eq(MemoryChunkTable.file_id, id)))
    .get()
  if (!stored || stored.content !== payload) {
    throw new ProjectMemoryInvariantError({
      message: `Project memory occurrence ${entry.occurrenceID} changed its canonical payload`,
      occurrenceID: entry.occurrenceID,
      fileID: id,
    })
  }
  if (!existed) {
    Bus.publishOwnedInTransaction(OrganizationRequested, { projectID: entry.projectID })
  }
  return { classification: "user_input" as const, fileID: id, occurrenceID: entry.occurrenceID }
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

  export function read(projectID: string) {
    return Database.transaction((db) => readInTransaction(db, projectID))
  }

  export function readInTransaction(db: Database.TxOrDb, projectID: string) {
    const envelope = envelopeInTransaction(db, projectID)
    const pendingCount = db
      .select({ id: MemoryFileTable.id })
      .from(MemoryFileTable)
      .where(and(eq(MemoryFileTable.project_id, projectID), eq(MemoryFileTable.kind, "user_message")))
      .all().length
    return {
      filename,
      scope,
      content: envelope.markdown,
      revision: envelope.revision,
      tokenCount: envelope.tokenCount,
      status: envelope.status,
      pendingCount,
      droppedPendingCount: envelope.droppedPendingCount,
      notice: envelope.notice,
      timeCreated: envelope.timeCreated,
      timeUpdated: envelope.timeUpdated,
    }
  }

  export function pending(projectID: string) {
    return Database.use((db) => pendingRows(db, projectID).map((item) => item.entry))
  }

  export function requestOrganizationInTransaction(
    db: Database.TxOrDb,
    input: { projectID: string },
  ) {
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
      status: envelope.status === "unavailable" ? "retry_wait" : envelope.status,
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
