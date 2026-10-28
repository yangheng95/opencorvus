import type { ExportSessionResponse } from "@opencorvus-ai/sdk"
import { artifactFilename } from "./artifact-export"
import { assistantMessageFailure } from "../utils/message-part"
import { ConversationExportError, readConversationSnapshot } from "./conversation-snapshot"
export { ConversationExportError } from "./conversation-snapshot"

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
  if (options.format !== "json" && options.format !== "markdown") throw new ConversationExportError("INVALID_CONVERSATION_EXPORT", "format")
  const { session, sessionID, title, created, updated, messages } = readConversationSnapshot(exported, options.sessionID)
  const basename = `${title || sessionID} - ${sessionID}`
  if (options.format === "json") return {
    filename: artifactFilename(`${basename}.json`),
    mime: "application/json;charset=utf-8",
    text: JSON.stringify(exported, null, 2) + "\n",
  }
  const labels = options.labels
  const date = new Intl.DateTimeFormat(options.locale, { dateStyle: "medium", timeStyle: "short", timeZone: options.timeZone })
  const sections = [
    `# ${heading(title || sessionID)}`,
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
