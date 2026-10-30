import { setCardExpanded } from "../store/conversation-ui"

/** Reveal the existing source disclosure inside its mounted original Message. */
export function revealConversationSource(message: HTMLElement, sourceId: string): (() => HTMLElement | null) | null {
  if (!message.isConnected) return null
  const messageID = message.dataset.messageId
  for (const group of message.querySelectorAll<HTMLElement>("[data-source-group-key][data-source-ids]")) {
    const ids: string[] = JSON.parse(group.dataset.sourceIds!)
    if (!ids.includes(sourceId)) continue
    if (ids.length > 1) setCardExpanded(group.dataset.sourceGroupKey!, true)
    return () => message.isConnected && message.dataset.messageId === messageID && group.isConnected
      ? group.querySelector<HTMLElement>(`[data-source-id="${CSS.escape(sourceId)}"]`)
      : null
  }
  return null
}
