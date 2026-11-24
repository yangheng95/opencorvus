import { normalizeSearchText } from "./text-search"
import { assistantMessageFailure } from "../utils/message-part"
import type { ConversationSearchSnapshot } from "./conversation-snapshot"
import { conversationSourceLocation, isConversationSourcePart } from "../utils/conversation-source"

export type ConversationSearchHit = Pick<ConversationSearchSnapshot["messages"][number], "id" | "role" | "author" | "created"> & {
  preview: { before: string; match: string; after: string }
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
    let folded = 0
    let matchStart = 0
    let matchEnd = 0
    const foldedMatchEnd = previewIndex + needle.length
    while (matchEnd < points.length && folded < foldedMatchEnd) {
      folded += points[matchEnd].toLowerCase().length
      matchEnd += 1
      if (folded <= previewIndex) matchStart = matchEnd
    }
    const start = Math.max(0, matchStart - 50)
    const end = Math.min(points.length, matchEnd + 100)
    return [{ id: message.id, role: message.role, author: message.author, created: message.created,
      preview: {
        before: `${start ? "…" : ""}${points.slice(start, matchStart).join("")}`,
        match: points.slice(matchStart, matchEnd).join(""),
        after: `${points.slice(matchEnd, end).join("")}${end < points.length ? "…" : ""}`,
      },
      ...(sourceId ? { sourceId } : {}), }]
  })
}
