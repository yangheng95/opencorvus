import { boundaryMessageHasNarrativeContent, isBoundaryMessagePart } from "./message-part"

export interface CardMessageRun {
  key: string
  messageID: string
  collapsedContext: boolean
  parts: any[]
}

/** Group the flattened card timeline by its persisted message boundaries.
 * Boundary identity stays attached to the exact message while presentation
 * renders the card-level Agent identity only once. */
export function partitionCardMessageRuns(
  parts: any[],
  collapsedMessageIDs: string[],
  projectedMessageIDs: string[] = [],
): CardMessageRun[] {
  const collapsed = new Set(collapsedMessageIDs)
  const projected = new Set(projectedMessageIDs)
  const runs: CardMessageRun[] = []
  for (const [index, part] of parts.entries()) {
    const messageID = String(part?.messageID || "")
    const collapsedContext = Boolean(messageID && collapsed.has(messageID))
    if (isBoundaryMessagePart(part)) {
      if (!boundaryMessageHasNarrativeContent(parts, index) && !projected.has(messageID)) continue
      runs.push({
        key: `message:${messageID || String(part?.id || index)}`,
        messageID,
        collapsedContext,
        parts: [],
      })
      continue
    }
    const previous = runs.at(-1)
    if (previous) {
      previous.parts.push(part)
      continue
    }
    runs.push({
      key: `message:${messageID || String(part?.id || index)}`,
      messageID,
      collapsedContext,
      parts: [part],
    })
  }
  return runs.filter((run) => run.parts.length > 0)
}
