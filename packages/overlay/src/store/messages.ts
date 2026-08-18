import { createStore } from "solid-js/store"

export type ChatAbortTarget =
  | { kind: "session"; sessionID: string; directory: string }
  | { kind: "task"; taskID: string; directory: string }
  | { kind: "mission"; missionID: string; directory: string }

export interface ChatRequestState {
  requestID: string
  controller: AbortController
  target: ChatAbortTarget
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

export function abortChatRequest(): void {
  store.chatRequest?.controller.abort()
  setStore("chatRequest", null)
}

export function setChatAttachments(attachments: any[]): void {
  setStore("chatAttachments", Array.isArray(attachments) ? attachments : [])
}
