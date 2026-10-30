const CONVERSATION_CARD_SCROLL_EVENT = "opencorvus:conversation-card-scroll"

export interface ConversationCardScrollRequest {
  cardID: string
  messageID?: string
  sourceId?: string
  sessionID?: string
  surface?: "main" | "subagent"
  block?: ScrollLogicalPosition
  highlight?: boolean
  readingRestore?: boolean
}

export interface ConversationCardScrollEventDetail extends ConversationCardScrollRequest {
  handle: (result: boolean | Promise<boolean>) => void
}

export function requestConversationCardScroll(request: ConversationCardScrollRequest): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false)
  return new Promise<boolean>((resolve) => {
    let handled = false
    const detail: ConversationCardScrollEventDetail = {
      ...request,
      handle: (result) => {
        handled = true
        void Promise.resolve(result).then(resolve, () => resolve(false))
      },
    }
    window.dispatchEvent(new CustomEvent(CONVERSATION_CARD_SCROLL_EVENT, { detail }))
    if (!handled) resolve(false)
  })
}

export function listenConversationCardScroll(
  handler: (request: ConversationCardScrollRequest) => boolean | Promise<boolean>,
  surface: "main" | "subagent" = "main",
): () => void {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<ConversationCardScrollEventDetail>).detail
    if (!detail?.cardID || typeof detail.handle !== "function") return
    if ((detail.surface ?? "main") !== surface) return
    detail.handle(handler(detail))
  }
  window.addEventListener(CONVERSATION_CARD_SCROLL_EVENT, listener)
  return () => window.removeEventListener(CONVERSATION_CARD_SCROLL_EVENT, listener)
}
