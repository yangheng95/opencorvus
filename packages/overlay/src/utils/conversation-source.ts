import type { SourceFilePart } from "@opencorvus-ai/sdk"

export type ConversationSourcePart = {
  type: "source-url" | "source-document" | "source-file"
  sourceId: string
  sessionID?: string
  messageID?: string
  title?: string
  provider?: string
  snippet?: string
  author?: string
  publishedAt?: string
  url?: string
  path?: string
  mediaType?: string
  filename?: string
  origin?: SourceFilePart["origin"]
  range?: SourceFilePart["range"]
}

export function isConversationSourcePart(part: any): part is ConversationSourcePart {
  return part?.type === "source-url" || part?.type === "source-document" || part?.type === "source-file"
}

export function conversationSourceIdentity(source: ConversationSourcePart): string {
  return JSON.stringify([source.type, source.sessionID ?? null, source.messageID ?? null, source.sourceId])
}

export function conversationSourceExcerptKey(source: ConversationSourcePart): string {
  return `source-excerpt:${conversationSourceIdentity(source)}`
}

export function fileSourceLocation(label: string, range: ConversationSourcePart["range"]): string {
  if (!range) return label
  const lines = range.startLine === range.endLine ? `${range.startLine}` : `${range.startLine}-${range.endLine}`
  return `${label}:${lines}${range.startColumn === undefined ? "" : `:${range.startColumn}`}`
}

export function conversationSourceLocation(source: ConversationSourcePart): string {
  if (source.type === "source-url") return source.url || ""
  if (source.type === "source-file" && source.path) return fileSourceLocation(source.path, source.range)
  return ""
}
