import { normalizeSearchText } from "./text-search"
import { assistantMessageFailure } from "../utils/message-part"
import type { readConversationSnapshot } from "./conversation-snapshot"

export type ConversationSearchHit = { id: string; author: string; created: number; preview: string }

/** Search the complete captured snapshot in producer order, independently of mounted cards. */
export function findConversationMessages(snapshot: ReturnType<typeof readConversationSnapshot>, query: string): ConversationSearchHit[] {
  const needle = normalizeSearchText(query)
  if (!needle) return []
  return snapshot.messages.flatMap((message) => {
    const failure = assistantMessageFailure(message.info)
    const body = [...message.parts.filter((part) => part.type === "text").map((part) => String(part.text)), ...(failure ? [failure.reason] : [])].join("\n\n")
    const index = body.toLowerCase().indexOf(needle)
    if (index < 0) return []
    const points = Array.from(body)
    let folded = 0, position = 0
    while (position < points.length && folded < index) folded += points[position++].toLowerCase().length
    const start = Math.max(0, position - 50), end = Math.min(points.length, position + Array.from(needle).length + 100)
    return [{ id: message.id, author: message.author, created: message.created,
      preview: `${start ? "…" : ""}${points.slice(start, end).join("").replace(/\s+/g, " ")}${end < points.length ? "…" : ""}` }]
  })
}
