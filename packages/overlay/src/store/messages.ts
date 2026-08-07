import { createStore } from "solid-js/store"

export type ChatAbortTarget =
  | { kind: "session"; sessionID: string; directory: string }
  | { kind: "task"; taskID: string; directory: string }

export interface ChatRequestState {
  requestID: string
  controller: AbortController
  target: ChatAbortTarget
}

const [store, setStore] = createStore({
  sseConnected: false,
  sseExpected: false,
  chatRequest: null as ChatRequestState | null,
  chatAttachments: [] as any[],
})

export { store as messageStore }

export function setSseConnected(connected: boolean) {
  setStore("sseConnected", connected)
}

export function setSseExpected(expected: boolean) {
  setStore("sseExpected", expected)
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
