import z from "zod"
import { NamedError } from "@opencorvus-ai/util/error"
import { and, eq } from "drizzle-orm"
import type { Database } from "@/storage/db"
import { Identifier } from "@/id/id"
import { Token } from "@/util/token"
import { ProviderError } from "@/provider/error"
import { redactInlinePayloads } from "@/util/inline-base64"
import { MemoryFileTable, MemoryChunkTable } from "./memory.sql"
import type { HostOwnedMemoryKind } from "./types"

export const Attachment = z.object({
  filename: z.string(),
  mime: z.string(),
  reference: z.string(),
  size: z.number().int().nonnegative().optional(),
})

export const Snapshot = z.object({
  messageID: z.string(),
  role: z.enum(["user", "assistant"]),
  author: z.string(),
  text: z.string(),
  structured: z.record(z.string(), z.json()).optional(),
  attachments: z.array(Attachment),
})

export const Entry = z.object({
  version: z.literal(1),
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
  recovery: z
    .object({
      kind: z.literal("permission_memory_recovery"),
      schemaVersion: z.literal(6),
      publicationID: z.string().min(1),
      previousCapture: z.literal("unknown"),
      recoveredAt: z.number().int().nonnegative(),
      ownerResolution: z.literal("unresolved").optional(),
    })
    .strict()
    .optional(),
})
export type Entry = z.infer<typeof Entry>

export const ProjectMemoryInvariantError = NamedError.create(
  "ProjectMemoryInvariantError",
  z.object({ message: z.string(), occurrenceID: z.string(), fileID: z.string() }),
)

export function fileID(projectID: string, kind: Entry["occurrenceKind"], occurrenceID: string) {
  return Identifier.deterministic("memory", `project-user-input\0${projectID}\0${kind}\0${occurrenceID}`)
}

export function chunkID(id: string) {
  return Identifier.deterministic("memchunk", `project-user-input\0${id}`)
}

export function assertFileOwnership(
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

export function assertChunkOwnership(
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

export function sanitizeText(input: string) {
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

export function sanitizeJSON(input: z.infer<typeof z.json>): z.infer<typeof z.json> {
  if (typeof input === "string") return sanitizeText(input)
  if (Array.isArray(input)) return input.map(sanitizeJSON)
  if (input && typeof input === "object") {
    return Object.fromEntries(Object.entries(input).map(([key, value]) => [sanitizeText(key), sanitizeJSON(value)]))
  }
  return input
}

export function safeMetadata(input: string, fallback: string) {
  const value = sanitizeText(input)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
  return value || fallback
}

function canonical(entry: Entry) {
  return JSON.stringify(Entry.parse(entry))
}

export function insertEntry(db: Database.TxOrDb, entry: Entry) {
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
  assertChunkOwnership(existingChunk, {
    id: cid,
    fileID: id,
    projectID: entry.projectID,
    occurrenceID: entry.occurrenceID,
  })
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
  return { classification: "user_input" as const, fileID: id, occurrenceID: entry.occurrenceID, created: !existed }
}
