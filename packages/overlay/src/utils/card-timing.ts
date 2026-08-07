import type { CardNode } from "../store/card-tree"

export function cardDurationMs(node: CardNode, now: number): number | null {
  const start = node.time
  if (!Number.isFinite(start) || (start as number) <= 0) return null
  const end = node.timeCompleted
  if (Number.isFinite(end) && (end as number) > (start as number)) {
    return (end as number) - (start as number)
  }
  if (node.status === "running") {
    const duration = now - (start as number)
    return duration > 0 ? duration : null
  }
  return null
}
