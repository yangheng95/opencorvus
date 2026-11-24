import { normalizeSearchText } from "./text-search"
import { assistantMessageFailure } from "../utils/message-part"
import type { ConversationSearchSnapshot } from "./conversation-snapshot"
import { conversationSourceLocation, isConversationSourcePart } from "../utils/conversation-source"

export type ConversationSearchHit = Pick<ConversationSearchSnapshot["messages"][number], "id" | "role" | "author" | "created"> & {
  preview: string
  sourceId?: string
}

function collapseSearchWhitespace(text: string): string {
  return text.trim().replace(/\s+/gu, " ")
}

export function normalizeConversationSearchQuery(query: string): string {
  return normalizeSearchText(collapseSearchWhitespace(query))
}

/** Search the complete captured snapshot in producer order, independently of mounted cards. */
export function findConversationMessages(snapshot: ConversationSearchSnapshot, query: string): ConversationSearchHit[] {
  const needle = normalizeConversationSearchQuery(query)
  if (!needle) return []
  return snapshot.messages.flatMap((message) => {
    const failure = assistantMessageFailure(message.info)
    const segments = message.parts.flatMap((part): Array<{ text: string; sourceId?: string }> => {
      if (part.type === "text") return [{ text: String(part.text) }]
      if (!isConversationSourcePart(part)) return []
      return [{ sourceId: part.sourceId, text: [
        part.title, part.filename, conversationSourceLocation(part), part.snippet, part.author, part.mediaType,
      ].filter(Boolean).join("\n") }]
    })
    if (failure) segments.push({ text: failure.reason })
    const visibleSegments = segments
      .map(segment => ({ ...segment, text: collapseSearchWhitespace(segment.text) }))
      .filter(segment => segment.text)
    const body = visibleSegments.map(segment => segment.text).join(" ")
    const index = body.toLowerCase().indexOf(needle)
    if (index < 0) return []
    let offset = 0, sourceId: string | undefined, previewBody = body, previewIndex = index
    for (const segment of visibleSegments) {
      const segmentEnd = offset + segment.text.toLowerCase().length
      if (index < segmentEnd) {
        if (segment.sourceId && index + needle.length <= segmentEnd) {
          sourceId = segment.sourceId
          previewBody = segment.text
          previewIndex = index - offset
        }
        break
      }
      offset = segmentEnd + 1
    }
    const points = Array.from(previewBody)
    let folded = 0, position = 0
    while (position < points.length && folded < previewIndex) folded += points[position++].toLowerCase().length
    const start = Math.max(0, position - 50), end = Math.min(points.length, position + Array.from(needle).length + 100)
    return [{ id: message.id, role: message.role, author: message.author, created: message.created,
      preview: `${start ? "…" : ""}${points.slice(start, end).join("")}${end < points.length ? "…" : ""}`,
      ...(sourceId ? { sourceId } : {}), }]
  })
}
