import type { BoardSource } from "../store/board"

export interface ConversationHistoryPathInput {
  directory: string
  before: number
  beforeOrderKey: string
  beforeID: string | null
  limit: number
}

/** Select the canonical persisted-history route for the exact active source.
 * Task and Session pages share one cursor and response contract; only their
 * route family differs. */
export function conversationHistoryPath(source: BoardSource, input: ConversationHistoryPathInput): string {
  const prefix = source.kind === "task" ? "task" : "session"
  const params = new URLSearchParams({
    directory: input.directory,
    before: String(input.before),
    before_order_key: input.beforeOrderKey,
  })
  if (input.beforeID) params.set("before_id", input.beforeID)
  params.set("limit", String(input.limit))
  return `${prefix}/${encodeURIComponent(source.id)}/conversation/history?${params.toString()}`
}
