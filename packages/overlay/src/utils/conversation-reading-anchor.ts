export type TextReadingAnchor = { textOffset: number; offset: number }

export type ConversationReadingAnchor = { messageID: string; offset: number } & (
  | { kind: "text"; textIndex: number; blockIndex: number; textOffset: number }
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

export function captureTextReadingAnchor(element: HTMLElement, viewport: DOMRect, previous?: TextReadingAnchor): TextReadingAnchor | undefined {
  const content = element.getBoundingClientRect()
  const visibleTop = Math.max(viewport.top, content.top)
  const visibleBottom = Math.min(viewport.bottom, content.bottom)
  const previousRect = previous && payloadTextRect(element, previous.textOffset)
  if (previousRect && previousRect.bottom > visibleTop && previousRect.top < visibleBottom)
    return { textOffset: previous!.textOffset, offset: previousRect.top - viewport.top }
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
    const text = owner && readingRect(owner) && captureTextReadingAnchor(owner, viewport, previous)
    if (text && text.textOffset === previous.textOffset) return { ...previous, ...text }
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
      const text = captureTextReadingAnchor(candidate, viewport)
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
    const textIndex = quotes.filter(node => node.dataset.quotationMessage === messageID).indexOf(candidate)
    const previousText = previous?.kind === "text" && previous.messageID === messageID &&
      previous.textIndex === textIndex && previous.blockIndex === blockIndex ? previous : undefined
    const text = captureTextReadingAnchor(blocks[blockIndex]!, viewport, previousText)
    if (!text) continue
    return {
      kind: "text",
      messageID,
      textIndex,
      blockIndex,
      ...text,
    }
  }
}

export function resolveTextReadingTop(container: HTMLElement, anchor: TextReadingAnchor, content = container): number | null {
  const rect = payloadTextRect(content, anchor.textOffset)
  return rect ? Math.max(0, container.scrollTop + rect.top - container.getBoundingClientRect().top - anchor.offset) : null
}

export function resolveConversationReadingTop(container: HTMLElement, anchor: ConversationReadingAnchor): number | null {
  const owner = conversationReadingAnchorOwner(container, anchor)
  if (anchor.kind === "tool-payload") return owner ? resolveTextReadingTop(container, anchor, owner) : null
  const element = anchor.kind === "text" ? owner?.querySelectorAll<HTMLElement>(".md-frozen-block")[anchor.blockIndex] : owner
  if (anchor.kind === "text") return element ? resolveTextReadingTop(container, anchor, element) : null
  const rect = element && readingRect(element)
  if (!rect) return null
  const viewport = container.getBoundingClientRect()
  const available = viewport.height - rect.height
  const offset = Math.max(Math.min(0, available), Math.min(anchor.offset, Math.max(0, available)))
  return Math.max(0, container.scrollTop + rect.top - viewport.top - offset)
}
