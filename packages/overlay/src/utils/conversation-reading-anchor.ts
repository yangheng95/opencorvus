export type ConversationReadingAnchor = { messageID: string; offset: number } & (
  | { kind: "text"; textIndex: number; blockIndex: number }
  | { kind: "source"; sourceIdentity: string }
  | { kind: "tool-payload"; payloadIdentity: string; textOffset: number }
)

function readingRect(element: HTMLElement): DOMRect | undefined {
  // Closed native details can retain layout boxes for their hidden content.
  // The summary remains visible, so exclude only the content subtree.
  if (element.closest("details:not([open]) > :not(summary)")) return undefined
  const rect = element.getBoundingClientRect()
  return rect.height > 0 ? rect : undefined
}

export function conversationReadingAnchorOwner(container: HTMLElement, anchor: ConversationReadingAnchor): HTMLElement | undefined {
  if (anchor.kind === "tool-payload")
    return container.querySelector<HTMLElement>(`[data-tool-payload-identity="${CSS.escape(anchor.payloadIdentity)}"]`) ?? undefined
  return anchor.kind === "source"
    ? container.querySelector<HTMLElement>(`[data-source-identity="${CSS.escape(anchor.sourceIdentity)}"]`) ?? undefined
    : container.querySelectorAll<HTMLElement>(`[data-quotation-message="${CSS.escape(anchor.messageID)}"]`)[anchor.textIndex]
}

function capturePayloadText(element: HTMLElement, viewport: DOMRect): { textOffset: number; offset: number } | undefined {
  const content = element.getBoundingClientRect()
  const visibleTop = Math.max(viewport.top, content.top)
  const visibleBottom = Math.min(viewport.bottom, content.bottom)
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  const range = element.ownerDocument.createRange()
  let textOffset = 0
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const preceding = textOffset
    textOffset += node.length
    if (!node.length || !node.parentElement || !readingRect(node.parentElement)) continue
    range.selectNodeContents(node)
    const rect = range.getBoundingClientRect()
    if (rect.height <= 0 || rect.bottom <= visibleTop || rect.top >= visibleBottom) continue
    // Prefix bounds grow monotonically through the lines of this text node.
    // Locate the first visible character without splitting the actual output.
    let low = 1, high = node.length
    while (low < high) {
      const middle = Math.floor((low + high) / 2)
      range.setEnd(node, middle)
      if (range.getBoundingClientRect().bottom > visibleTop) high = middle
      else low = middle + 1
    }
    range.setStart(node, low - 1)
    range.setEnd(node, low)
    return { textOffset: preceding + low - 1, offset: range.getBoundingClientRect().top - viewport.top }
  }
}

function payloadTextRect(element: HTMLElement, textOffset: number): DOMRect | undefined {
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    if (textOffset >= node.length) { textOffset -= node.length; continue }
    if (!node.parentElement || !readingRect(node.parentElement)) return undefined
    const range = element.ownerDocument.createRange()
    range.setStart(node, textOffset)
    range.setEnd(node, textOffset + 1)
    const rect = range.getBoundingClientRect()
    return rect.height > 0 ? rect : undefined
  }
}

export function captureConversationReadingAnchor(container: HTMLElement, previous?: ConversationReadingAnchor): ConversationReadingAnchor | undefined {
  const viewport = container.getBoundingClientRect()
  if (previous?.kind === "tool-payload") {
    const owner = conversationReadingAnchorOwner(container, previous)
    const bounds = owner && readingRect(owner)
    const rect = owner && payloadTextRect(owner, previous.textOffset)
    if (bounds && rect && rect.bottom > Math.max(viewport.top, bounds.top) && rect.top < Math.min(viewport.bottom, bounds.bottom))
      return { ...previous, offset: rect.top - viewport.top }
  }
  const quotes = Array.from(container.querySelectorAll<HTMLElement>("[data-quotation-message]"))
  const candidates = Array.from(container.querySelectorAll<HTMLElement>("[data-quotation-message], [data-source-identity][data-source-message-id], [data-tool-payload-identity][data-tool-message-id]"))
  // Keep the reader's selected citation while it remains visible, including
  // after a layout control takes focus and the restored position is saved.
  const previousSource = previous?.kind === "source" ? conversationReadingAnchorOwner(container, previous) : undefined
  const focusedSource = container.ownerDocument.activeElement?.closest<HTMLElement>("[data-source-identity][data-source-message-id]")
  for (const source of [previousSource, focusedSource]) {
    const index = source ? candidates.indexOf(source) : -1
    if (index > 0) candidates.unshift(candidates.splice(index, 1)[0]!)
  }
  for (const candidate of candidates) {
    const rect = readingRect(candidate)
    if (!rect || rect.bottom <= viewport.top || rect.top >= viewport.bottom) continue
    if (candidate.dataset.toolPayloadIdentity && candidate.dataset.toolMessageId) {
      const text = capturePayloadText(candidate, viewport)
      if (!text) continue
      return { kind: "tool-payload", payloadIdentity: candidate.dataset.toolPayloadIdentity, messageID: candidate.dataset.toolMessageId, ...text }
    }
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
      const rect = readingRect(block)
      return rect && rect.bottom > viewport.top && rect.top < viewport.bottom
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
  const element = anchor.kind === "text" ? owner?.querySelectorAll<HTMLElement>(".md-frozen-block")[anchor.blockIndex] : owner
  const rect = element && (anchor.kind === "tool-payload" ? payloadTextRect(element, anchor.textOffset) : readingRect(element))
  if (!rect) return null
  return Math.max(0, container.scrollTop + rect.top - container.getBoundingClientRect().top - anchor.offset)
}
