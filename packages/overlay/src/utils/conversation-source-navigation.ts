import { setCardExpanded } from "../store/conversation-ui"
import type { ConversationCardScrollRequest } from "../services/conversation-scroll"

/** Resolve original identities within the mounted card, including aggregated runs. */
export function conversationNavigationTarget(
  container: HTMLElement,
  request: Pick<ConversationCardScrollRequest, "messageID" | "sourceIdentity">,
): (() => HTMLElement | null) | null {
  if (!container.isConnected) return null
  if (request.sourceIdentity) {
    const identity = request.sourceIdentity
    for (const group of container.querySelectorAll<HTMLElement>("[data-source-group-key][data-source-identities]")) {
      const identities: string[] = JSON.parse(group.dataset.sourceIdentities!)
      if (!identities.includes(identity)) continue
      if (identities.length > 1) setCardExpanded(group.dataset.sourceGroupKey!, true)
      return () => container.isConnected && group.isConnected
        ? group.querySelector<HTMLElement>(`[data-source-identity="${CSS.escape(identity)}"]`)
        : null
    }
    return null
  }
  return () => {
    if (!container.isConnected) return null
    if (!request.messageID) return container
    return Array.from(container.querySelectorAll<HTMLElement>("[data-message-ids]"))
      .find((group) => (JSON.parse(group.dataset.messageIds!) as string[]).includes(request.messageID!)) ?? null
  }
}
