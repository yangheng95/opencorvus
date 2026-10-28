import type { ExportSessionResponse } from "@opencorvus-ai/sdk"
import { artifactFilename } from "./artifact-export"
import { assistantMessageFailure } from "../utils/message-part"

export type ConversationExportFormat = "markdown" | "json"
export type ConversationExportLabels = {
  sessionID: string
  messageID: string
  created: string
  updated: string
  sessionData: string
  messageData: string
  empty: string
  stopped: string
  failed: string
}

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

function htmlText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}

function heading(value: string): string {
  return htmlText(value).replace(/[\\`*_{}\[\]()#+.!|~-]/g, "\\$&").replace(/\r?\n/g, " ")
}

function ticks(value: string, minimum: number): string {
  let length = minimum
  for (const match of value.matchAll(/`+/g)) length = Math.max(length, match[0].length + 1)
  return "`".repeat(length)
}

function code(value: string): string {
  const fence = ticks(value, 1)
  return `${fence} ${value} ${fence}`
}

function originalData(label: string, value: unknown): string {
  const json = JSON.stringify(value, null, 2)
  const fence = ticks(json, 3)
  return `<details>\n<summary>${htmlText(label)}</summary>\n\n${fence}json\n${json}\n${fence}\n\n</details>`
}

/** Both downloads are projections of the same complete server snapshot. */
export function conversationExport(exported: ExportSessionResponse, options: {
  sessionID: string
  format: ConversationExportFormat
  locale: string
  timeZone?: string
  labels: ConversationExportLabels
}): { filename: string; mime: string; text: string } {
  if (options.format !== "json" && options.format !== "markdown") return invalid("format")
  const snapshot = record(exported, "export")
  const session = record(snapshot.session, "session")
  const sessionID = text(session.id, "session.id")
  if (sessionID !== options.sessionID) throw new ConversationExportError("CONVERSATION_EXPORT_IDENTITY_MISMATCH", "session.id")
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
  const basename = `${session.title || sessionID} - ${sessionID}`
  if (options.format === "json") return {
    filename: artifactFilename(`${basename}.json`),
    mime: "application/json;charset=utf-8",
    text: JSON.stringify(exported, null, 2) + "\n",
  }
  const labels = options.labels
  const date = new Intl.DateTimeFormat(options.locale, { dateStyle: "medium", timeStyle: "short", timeZone: options.timeZone })
  const sections = [
    `# ${heading(session.title || sessionID)}`,
    `**${heading(labels.sessionID)}:** ${code(sessionID)}\n\n**${heading(labels.created)}:** ${date.format(created)}\n\n**${heading(labels.updated)}:** ${date.format(updated)}`,
    originalData(labels.sessionData, session),
  ]
  if (messages.length === 0) sections.push(labels.empty)
  for (const message of messages) {
    sections.push(`## ${heading(message.author)}\n\n**${heading(labels.messageID)}:** ${code(message.id)}\n\n**${heading(labels.created)}:** ${date.format(message.created)}`)
    for (const part of message.parts) if (part.type === "text") sections.push(part.text as string)
    const failure = assistantMessageFailure(message.info)
    if (failure) sections.push(`> **${heading(failure.cancelled ? labels.stopped : labels.failed)}**\n> ${failure.reason.split(/\r?\n/).join("\n> ")}`)
    sections.push(originalData(labels.messageData, message.original))
  }
  return {
    filename: artifactFilename(`${basename}.md`),
    mime: "text/markdown;charset=utf-8",
    text: sections.join("\n\n") + "\n",
  }
}
