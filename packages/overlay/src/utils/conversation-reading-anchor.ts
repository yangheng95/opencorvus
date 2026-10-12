export type ConversationReadingAnchor = { messageID: string; offset: number } & (
  | { kind: "text"; textIndex: number; blockIndex: number }
  | { kind: "source"; sourceIdentity: string }
)

export function conversationReadingAnchorOwner(container: HTMLElement, anchor: ConversationReadingAnchor): HTMLElement | undefined {
  return anchor.kind === "source"
    ? container.querySelector<HTMLElement>(`[data-source-identity="${CSS.escape(anchor.sourceIdentity)}"]`) ?? undefined
    : container.querySelectorAll<HTMLElement>(`[data-quotation-message="${CSS.escape(anchor.messageID)}"]`)[anchor.textIndex]
}

export function captureConversationReadingAnchor(container: HTMLElement): ConversationReadingAnchor | undefined {
  const viewport = container.getBoundingClientRect()
  const quotes = Array.from(container.querySelectorAll<HTMLElement>("[data-quotation-message]"))
  const candidates = container.querySelectorAll<HTMLElement>("[data-quotation-message], [data-source-identity][data-source-message-id]")
  for (const candidate of candidates) {
    const rect = candidate.getBoundingClientRect()
    if (rect.height <= 0 || rect.bottom <= viewport.top || rect.top >= viewport.bottom) continue
    if (candidate.dataset.sourceIdentity && candidate.dataset.sourceMessageId) {
      return {
        kind: "source",
        sourceIdentity: candidate.dataset.sourceIdentity,
        messageID: candidate.dataset.sourceMessageId,
        offset: rect.top - viewport.top,
      }
    }
    const blocks = Array.from(candidate.querySelectorAll<HTMLElement>(".md-frozen-block"))
    const blockIndex = blocks.findIndex(block => {
      const rect = block.getBoundingClientRect()
      return rect.height > 0 && rect.bottom > viewport.top && rect.top < viewport.bottom
    })
    const messageID = candidate.dataset.quotationMessage
    if (blockIndex < 0 || !messageID) continue
    return {
      kind: "text",
      messageID,
      textIndex: quotes.filter(node => node.dataset.quotationMessage === messageID).indexOf(candidate),
      blockIndex,
      offset: blocks[blockIndex]!.getBoundingClientRect().top - viewport.top,
    }
  }
}

export function resolveConversationReadingTop(container: HTMLElement, anchor: ConversationReadingAnchor): number | null {
  const owner = conversationReadingAnchorOwner(container, anchor)
  const element = anchor.kind === "source" ? owner : owner?.querySelectorAll<HTMLElement>(".md-frozen-block")[anchor.blockIndex]
  if (!element || element.getBoundingClientRect().height <= 0) return null
  return Math.max(0, container.scrollTop + element.getBoundingClientRect().top - container.getBoundingClientRect().top - anchor.offset)
}
