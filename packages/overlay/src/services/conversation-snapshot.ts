import type { ExportSessionResponse } from "@opencorvus-ai/sdk"

export class ConversationExportError extends Error {
  constructor(readonly code: "INVALID_CONVERSATION_EXPORT" | "CONVERSATION_EXPORT_IDENTITY_MISMATCH", readonly field: string) {
    super(`Conversation export ${code}: ${field}`)
    this.name = "ConversationExportError"
  }
}

function invalid(field: string): never {
  throw new ConversationExportError("INVALID_CONVERSATION_EXPORT", field)
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid(field)
  return value as Record<string, unknown>
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) return invalid(field)
  return value
}

function timestamp(value: unknown, field: string): number {
  if (typeof value !== "number" || value <= 0 || !Number.isFinite(new Date(value).getTime())) return invalid(field)
  return value
}

export function readConversationSnapshot(exported: ExportSessionResponse, expectedSessionID: string) {
  const snapshot = record(exported, "export")
  const session = record(snapshot.session, "session")
  const sessionID = text(session.id, "session.id")
  if (sessionID !== expectedSessionID) throw new ConversationExportError("CONVERSATION_EXPORT_IDENTITY_MISMATCH", "session.id")
  if (typeof session.title !== "string") return invalid("session.title")
  const time = record(session.time, "session.time")
  const created = timestamp(time.created, "session.time.created")
  const updated = timestamp(time.updated, "session.time.updated")
  if (!Array.isArray(snapshot.messages)) return invalid("messages")
  const ids = new Set<string>()
  const messages = snapshot.messages.map((value, index) => {
    const field = `messages[${index}]`
    const original = record(value, field)
    const info = record(original.info, `${field}.info`)
    const id = text(info.id, `${field}.info.id`)
    if (ids.has(id)) return invalid(`${field}.info.id`)
    ids.add(id)
    if (info.sessionID !== sessionID) throw new ConversationExportError("CONVERSATION_EXPORT_IDENTITY_MISMATCH", `${field}.info.sessionID`)
    if (info.role !== "user" && info.role !== "assistant") return invalid(`${field}.info.role`)
    const author = text(info.author, `${field}.info.author`)
    const created = timestamp(record(info.time, `${field}.info.time`).created, `${field}.info.time.created`)
    if (!Array.isArray(original.parts)) return invalid(`${field}.parts`)
    const parts = original.parts.map((value, partIndex) => {
      const part = record(value, `${field}.parts[${partIndex}]`)
      text(part.type, `${field}.parts[${partIndex}].type`)
      if (part.type === "text" && typeof part.text !== "string") return invalid(`${field}.parts[${partIndex}].text`)
      return part
    })
    return { original, info, id, author, created, parts }
  })
  return { session, sessionID, title: session.title as string, created, updated, messages }
}
