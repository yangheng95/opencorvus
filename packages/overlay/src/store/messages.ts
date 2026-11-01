import { createStore } from "solid-js/store"
import type { ApiAuthority } from "../services/api"

export type ChatAbortTarget =
  | { kind: "session"; sessionID: string; directory: string }
  | { kind: "task"; taskID: string; directory: string }
  | { kind: "mission"; missionID: string; directory: string }

export interface ChatRequestState {
  authority: ApiAuthority
  requestID: string
  controller: AbortController
  target: ChatAbortTarget
  messageID?: string
  composerDraftKey?: string
  onAccepted?: () => void
}

export type SseConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting"

const [store, setStore] = createStore({
  sseStatus: "idle" as SseConnectionStatus,
  chatRequest: null as ChatRequestState | null,
  chatAttachments: [] as any[],
})

export { store as messageStore }

export function setSseStatus(status: SseConnectionStatus): void {
  setStore("sseStatus", status)
}

export function setChatRequest(req: ChatRequestState | null): void {
  setStore("chatRequest", req)
}

/** Only an exact, real user Message can acknowledge the owning Session request. */
export function acknowledgeChatRequestMessage(info: { id?: unknown; sessionID?: unknown; role?: unknown }): void {
  const request = store.chatRequest
  if (info.role !== "user" || !request?.messageID || request.target.kind !== "session" ||
    request.messageID !== info.id || request.target.sessionID !== info.sessionID) return
  request.onAccepted?.()
}

export function abortChatRequest(): void {
  store.chatRequest?.controller.abort()
  setStore("chatRequest", null)
}

export function setChatAttachments(attachments: any[]): void {
  setStore("chatAttachments", Array.isArray(attachments) ? attachments : [])
}
