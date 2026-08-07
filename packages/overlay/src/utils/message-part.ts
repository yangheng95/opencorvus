import {
  isConversationDisplayMessagePartType,
  isConversationRenderableMessagePartType,
} from "@opencorvus-ai/transport-protocol"
import { requireTimelineOrderKey } from "./timeline-order"

const CONTROL_PROTOCOL_MESSAGE_PART_TYPES = new Set(["step-start", "step-finish"])

export function messagePartType(part: any): string {
  return String(part?.type || "")
}

export function isProtocolControlMessagePart(part: any): boolean {
  const type = messagePartType(part)
  return Boolean(type && CONTROL_PROTOCOL_MESSAGE_PART_TYPES.has(type))
}

export function isBoundaryMessagePart(part: any): boolean {
  return messagePartType(part) === "boundary"
}

export function isCardRenderableMessagePartType(type: string): boolean {
  return isConversationRenderableMessagePartType(type)
}

export function isCardBodyMessagePart(part: any): boolean {
  const type = messagePartType(part)
  return Boolean(type && isConversationDisplayMessagePartType(type))
}

export function messagePartHasDisplayContent(part: any): boolean {
  if (!isCardBodyMessagePart(part)) return false
  const type = messagePartType(part)
  // Reasoning remains in the protocol/store for runtime evidence but is not
  // user-facing message-card content.
  if (type === "reasoning") return false
  if (type === "text") return Boolean(String(part?.text || "").trim())
  return true
}

/** Parts rendered inside chronological collapsed execution disclosures. */
export function isCollapsedExecutionMessagePart(part: any): boolean {
  const type = messagePartType(part)
  if (type === "patch") return Array.isArray(part?.files) && part.files.length > 0
  return type === "tool"
}

/** Visible message content that forms a narrative section outside execution details. */
export function messagePartHasNarrativeContent(part: any): boolean {
  if (messagePartType(part) === "patch") return false
  return messagePartHasDisplayContent(part) && !isCollapsedExecutionMessagePart(part)
}

export interface MessagePartRenderRun {
  kind: "body" | "execution"
  parts: any[]
  startIndex: number
}

/** Stable task user-interface identity for one adjacent execution run.
 * Later tool or reasoning parts may extend the run, so only its canonical
 * first part owns the key. */
export function executionDisclosureKey(parts: any[]): string {
  const first = Array.isArray(parts) ? parts[0] : undefined
  const id = String(first?.id || "")
  // Card execution runs include both persisted message parts (`part` domain)
  // and event-backed review reasoning (`protocol` domain). The writer owns
  // domain validation at insertion; the renderer only needs the canonical
  // timeline key as a stable disclosure identity.
  const orderKey = requireTimelineOrderKey(first?.orderKey, `execution disclosure first part ${id}`)
  return `execution:${orderKey}`
}

/** Whether a non-execution part produces visible content in the collapsed
 * transcript. Tool-only message boundaries and empty display parts are
 * transparent so they cannot fragment one visually consecutive execution run. */
function messagePartHasCollapsedBodyContent(parts: any[], index: number): boolean {
  const part = parts[index]
  const type = messagePartType(part)
  if (isBoundaryMessagePart(part)) return boundaryMessageHasNarrativeContent(parts, index)
  if (type === "reasoning" || type === "text") return messagePartHasDisplayContent(part)
  if (type === "patch") return false
  return true
}

/**
 * Partition one turn into chronological body/execution runs. Rendering owns
 * the single disclosure; this projection never moves a part from its source
 * position relative to narrative or message boundaries.
 */
export function partitionMessagePartRenderRuns(parts: any[], collapseWorkDetails: boolean): MessagePartRenderRun[] {
  const source = Array.isArray(parts) ? parts : []
  if (source.length === 0) return []
  if (!collapseWorkDetails) return [{ kind: "body", parts: source, startIndex: 0 }]

  const runs: MessagePartRenderRun[] = []
  for (const [index, part] of source.entries()) {
    const kind: MessagePartRenderRun["kind"] = isCollapsedExecutionMessagePart(part) ? "execution" : "body"
    if (kind === "body" && !messagePartHasCollapsedBodyContent(source, index)) continue
    const previous = runs.at(-1)
    if (previous?.kind === kind) previous.parts.push(part)
    else runs.push({ kind, parts: [part], startIndex: index })
  }
  return runs
}

/** A flattened boundary has collapsed body meaning only when its message
 * segment contains visible non-execution content. */
export function boundaryMessageHasNarrativeContent(parts: any[], boundaryIndex: number): boolean {
  const source = Array.isArray(parts) ? parts : []
  if (!isBoundaryMessagePart(source[boundaryIndex])) return false
  for (let index = boundaryIndex + 1; index < source.length; index += 1) {
    const part = source[index]
    if (isBoundaryMessagePart(part)) break
    if (messagePartHasNarrativeContent(part)) return true
  }
  return false
}
