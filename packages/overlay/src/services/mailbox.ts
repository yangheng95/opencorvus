import { apiJson } from "./api"
import type { MailboxListResponse } from "@opencorvus-ai/sdk"
import { subscribeMailboxChanges } from "./sse"

export type MailboxCategory = "progress" | "status" | "notification"
export type MailboxView = "active" | "archived"
export type MailboxAction = "read" | "archive" | "restore"

export type MailboxPage = MailboxListResponse
export type MailboxItem = MailboxPage["items"][number]
export type MailboxCursor = NonNullable<MailboxPage["nextCursor"]>

export interface MailboxReadAllResult {
  changedCount: number
}

export interface MailboxDeleteResult {
  changedCount: number
}

export async function loadMailbox(input: {
  view: MailboxView
  limit?: number
  cursor?: MailboxCursor | null
  signal?: AbortSignal
}): Promise<MailboxPage> {
  const params = new URLSearchParams({ view: input.view })
  if (typeof input.limit === "number") params.set("limit", String(input.limit))
  if (input.cursor) {
    params.set("cursorCreatedAt", String(input.cursor.createdAt))
    params.set("cursorID", input.cursor.id)
  }
  return apiJson<MailboxPage>(`mailbox?${params.toString()}`, { signal: input.signal })
}

export async function acknowledgeMailboxItem(
  messageID: string,
  action: MailboxAction,
): Promise<void> {
  await apiJson(`mailbox/${encodeURIComponent(messageID)}`, {
    method: "PATCH",
    body: JSON.stringify({ action }),
    headers: { "Content-Type": "application/json" },
  })
}

export async function markAllMailboxItemsRead(): Promise<MailboxReadAllResult> {
  return apiJson<MailboxReadAllResult>("mailbox/read-all", { method: "PATCH" })
}

export async function deleteMailboxItem(messageID: string): Promise<void> {
  await apiJson(`mailbox/${encodeURIComponent(messageID)}`, { method: "DELETE" })
}

export async function deleteMailboxItems(messageIDs: string[]): Promise<MailboxDeleteResult> {
  return apiJson<MailboxDeleteResult>("mailbox", {
    method: "DELETE",
    body: JSON.stringify({ messageIDs }),
    headers: { "Content-Type": "application/json" },
  })
}

export function subscribeMailboxChangeNotifications(input: {
  onRefresh: () => void
  onError: (error: unknown) => void
}): () => void {
  return subscribeMailboxChanges(() => {
    try {
      input.onRefresh()
    } catch (error) {
      input.onError(error)
    }
  })
}
