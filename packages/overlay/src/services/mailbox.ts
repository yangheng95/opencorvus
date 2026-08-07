import { apiJson } from "./api"
import type { StreamHandle } from "./host-transport"
import { getHostTransport } from "./host-transport-runtime"
import type { MailboxListResponse } from "@opencorvus-ai/sdk"
import {
  MailboxChangeStreamEvent,
  type MailboxChangeStreamEvent as MailboxChangeEvent,
} from "@opencorvus-ai/transport-protocol"
export type { MailboxChangeStreamEvent as MailboxChangeEvent } from "@opencorvus-ai/transport-protocol"

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

export function openMailboxChangeStream(input: {
  onRefresh: (event: MailboxChangeEvent) => void
  onClose: () => void
  onError: (error: unknown) => void
}): StreamHandle {
  let handle: StreamHandle | undefined
  let consumerFailed = false
  handle = getHostTransport().openStream(
    { path: "mailbox/events" },
    {
      onEvent(data) {
        if (consumerFailed) return
        let value: unknown
        try {
          value = JSON.parse(data)
        } catch (error) {
          consumerFailed = true
          input.onError(error)
          handle?.close("consumer-error")
          return
        }
        const parsed = MailboxChangeStreamEvent.safeParse(value)
        if (!parsed.success) {
          consumerFailed = true
          input.onError(new Error("Invalid mailbox change stream event", { cause: parsed.error }))
          handle?.close("consumer-error")
          return
        }
        if (parsed.data.type === "mailbox.connected" || parsed.data.type === "mailbox.changed")
          input.onRefresh(parsed.data)
      },
      onClose() {
        input.onClose()
      },
      onError(error) {
        input.onError(error)
        handle?.close("transport-error")
      },
    },
  )
  if (consumerFailed) handle.close("consumer-error")
  return handle
}
