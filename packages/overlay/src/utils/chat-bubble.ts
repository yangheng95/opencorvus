import type { CardNode } from "../store/card-tree"
import { messagePartHasDisplayContent } from "./message-part"

export function renderAsBubble(node: CardNode): boolean {
  return node.kind === "message" || node.kind === "agent"
}

export function renderAsPendingAgent(node: CardNode): boolean {
  if (node.kind !== "agent" || node.status !== "running") return false
  if (node.reviewStream || (node.childIDs?.length ?? 0) > 0) return false
  return !(node.parts || []).some(messagePartHasDisplayContent)
}

export function bubbleAlign(_node: CardNode): "left" {
  return "left"
}
