import { boundaryMessageHasNarrativeContent, isBoundaryMessagePart } from "./message-part"

export interface CardMessageRun {
  key: string
  messageID: string
  collapsedContext: boolean
  parts: any[]
}

/** Presentation groups retain every persisted message represented by their parts. */
export function messageIDsForCardRuns(runs: readonly CardMessageRun[]): string[] {
  const ids = new Set<string>()
  for (const run of runs) {
    if (run.messageID) ids.add(run.messageID)
    for (const part of run.parts) {
      const id = String(part?.messageID || "")
      if (id) ids.add(id)
    }
  }
  return [...ids]
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
  return runs.filter((run) => run.parts.length > 0 || projected.has(run.messageID))
}
