import z from "zod"
import { compareTimelineOrderKeys } from "@/timeline/order"

export const CONVERSATION_TAIL_MESSAGE_LIMIT = 80
export const CONVERSATION_HISTORY_PAGE_LIMIT = 160

export const ConversationHydrationQuery = z.object({
  tail_limit: z.coerce.number().int().min(1).max(2000).optional(),
})

export const ConversationHistoryQuery = z.object({
  before: z.coerce.number().positive(),
  before_order_key: z.string().min(1),
  before_id: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(CONVERSATION_HISTORY_PAGE_LIMIT),
})

export function conversationItemTimestamp(item: any): number {
  const value =
    typeof item?.timestamp === "number"
      ? item.timestamp
      : typeof item?.info?.time?.created === "number"
        ? item.info.time.created
        : 0
  return Number.isFinite(value) ? value : 0
}

export function conversationItemSessionID(item: any): string {
  return String(item?.info?.sessionID || "")
}

export function conversationItemID(item: any): string {
  return String(item?.info?.id || item?.id || "")
}

export function conversationItemOrderKey(item: any): string {
  const key =
    typeof item?.orderKey === "string"
      ? item.orderKey
      : typeof item?.info?.orderKey === "string"
        ? item.info.orderKey
        : ""
  if (!key) throw new Error(`conversation item ${conversationItemID(item) || "<unknown>"} missing orderKey`)
  return key
}

export function compareConversationItems(left: any, right: any): number {
  return compareTimelineOrderKeys(conversationItemOrderKey(left), conversationItemOrderKey(right))
}

export function conversationHistoryState(allTranscript: any[], visibleTranscript: any[], limit: number) {
  const oldestItem = visibleTranscript[0] ?? null
  return {
    oldestTimestamp: oldestItem ? conversationItemTimestamp(oldestItem) : null,
    oldestOrderKey: oldestItem ? conversationItemOrderKey(oldestItem) : null,
    oldestMessageID: oldestItem ? conversationItemID(oldestItem) || null : null,
    hasMore: oldestItem != null && allTranscript.some((item) => compareConversationItems(item, oldestItem) < 0),
    limit,
  }
}

export function conversationHistoryWindow(transcript: any[], input: { tailLimit: number }) {
  const orderedTranscript = [...transcript].sort(compareConversationItems)
  const visibleTranscript = orderedTranscript.slice(Math.max(0, orderedTranscript.length - input.tailLimit))
  return {
    transcript: visibleTranscript,
    history: conversationHistoryState(orderedTranscript, visibleTranscript, input.tailLimit),
  }
}

export function conversationHistoryBefore(
  transcript: any[],
  input: { before: number; beforeOrderKey: string; beforeID?: string; limit: number },
) {
  const olderTranscript = [...transcript]
    .filter((item) => compareTimelineOrderKeys(conversationItemOrderKey(item), input.beforeOrderKey) < 0)
    .sort(compareConversationItems)
  const visibleTranscript = olderTranscript.slice(Math.max(0, olderTranscript.length - input.limit))
  return {
    transcript: visibleTranscript,
    history: conversationHistoryState(olderTranscript, visibleTranscript, input.limit),
  }
}
