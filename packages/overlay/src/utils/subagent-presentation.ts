import type { CardNode } from "../store/card-tree"
import type { AgentActivityRecord } from "./agent-activity"
import type { IconName } from "../components/ui/Icon"
import { CONVERSATION_AGENT_ACTIVITY_LIMIT } from "@opencorvus-ai/transport-protocol"
import { compareTimelineOrderKeys, requireTimelineOrderKey } from "./timeline-order"
import { describeCurrentToolPart, type ToolDisplayStatus } from "./tool"

const SUBAGENT_PROGRESS_CARD_PREFIX = "subagent-session:"
const SUBAGENT_PROGRESS_GRID_PREFIX = "subagent-grid:"

export interface SubagentProgressGridItem {
  id: string
  kind: "subagent-grid"
  sessionIDs: string[]
}

export interface ConversationCardItem {
  id: string
  kind: "card"
  cardID: string
}

export type SubagentConversationItem = SubagentProgressGridItem | ConversationCardItem

export type SubagentProgressEvent =
  | {
      id: string
      kind: "text"
      text: string
    }
  | {
      id: string
      kind: "tool"
      icon: IconName
      label: string
      detail: string
      status?: ToolDisplayStatus
    }
  | {
      id: string
      kind: "patch"
      files: string[]
    }
  | {
      id: string
      kind: "file"
      filename: string
    }
  | {
      id: string
      kind: "error"
      text: string
    }

interface TimelineEntry {
  id: string
  kind: "card" | "subagent"
  orderKey: string
  sessionID?: string
}

function compactProgressText(value: unknown, limit = 180): string {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
  if (!text) return ""
  if (text.length <= limit) return text
  return `${text.slice(0, Math.max(0, limit - 3)).trim()}...`
}

export function isSubagentActivityRecord(record: AgentActivityRecord): boolean {
  return Boolean(record.parentSessionID.trim()) && record.stage !== "orchestrator"
}

/**
 * One record per sub-agent Session, newest occurrence first-come order.
 *
 * A Session that ran more than once carries one activity record per execution
 * occurrence, so the raw list repeats a sessionID. Every sub-agent surface is
 * keyed by Session — the selector tabs, the overflow menu, and the progress
 * grid all address one agent — so they must agree on which occurrence speaks
 * for it. That is the newest one, matching how the store resolves a Session
 * without an exact occurrence. Order follows each Session's first appearance so
 * the surfaces stay stable as later occurrences arrive.
 */
export function subagentSessionRecords(records: readonly AgentActivityRecord[]): AgentActivityRecord[] {
  const bySession = new Map<string, AgentActivityRecord>()
  for (const record of records) {
    const current = bySession.get(record.sessionID)
    if (!current) {
      bySession.set(record.sessionID, record)
      continue
    }
    const newer =
      record.lastObservedAt > current.lastObservedAt ||
      (record.lastObservedAt === current.lastObservedAt && record.startedAt > current.startedAt)
    if (newer) bySession.set(record.sessionID, record)
  }
  return [...bySession.values()]
}

export function subagentProgressCardID(sessionID: string): string {
  const value = String(sessionID || "").trim()
  if (!value) throw new Error("subagent progress card requires a sessionID")
  return `${SUBAGENT_PROGRESS_CARD_PREFIX}${value}`
}

export function subagentSessionIDFromProgressCardID(cardID: string): string | undefined {
  return cardID.startsWith(SUBAGENT_PROGRESS_CARD_PREFIX)
    ? cardID.slice(SUBAGENT_PROGRESS_CARD_PREFIX.length) || undefined
    : undefined
}

function subagentProgressGridID(sessionID: string): string {
  return `${SUBAGENT_PROGRESS_GRID_PREFIX}${sessionID}`
}

export function buildSubagentConversationItems(input: {
  order: string[]
  cards: Record<string, CardNode>
  records: AgentActivityRecord[]
}): SubagentConversationItem[] {
  const records = subagentSessionRecords(input.records.filter(isSubagentActivityRecord))
  const recordsBySession = new Map(records.map((record) => [record.sessionID, record]))
  const timeline: TimelineEntry[] = []
  for (const cardID of input.order) {
    const card = input.cards[cardID]
    if (!card) throw new Error(`subagent conversation projection references missing card ${cardID}`)
    if (card.sessionID && recordsBySession.has(card.sessionID)) continue
    timeline.push({
      id: cardID,
      kind: "card",
      orderKey: requireTimelineOrderKey(card.orderKey, `conversation card ${cardID}`),
    })
  }
  for (const record of records) {
    timeline.push({
      id: subagentProgressCardID(record.sessionID),
      kind: "subagent",
      orderKey: requireTimelineOrderKey(record.orderKey, `subagent session ${record.sessionID}`),
      sessionID: record.sessionID,
    })
  }
  timeline.sort((left, right) => compareTimelineOrderKeys(left.orderKey, right.orderKey, "subagent progress grid"))

  const items: SubagentConversationItem[] = []
  let pendingSessionIDs: string[] = []
  const flushGrid = () => {
    if (pendingSessionIDs.length === 0) return
    items.push({
      id: subagentProgressGridID(pendingSessionIDs[0]!),
      kind: "subagent-grid",
      sessionIDs: pendingSessionIDs,
    })
    pendingSessionIDs = []
  }
  for (const entry of timeline) {
    if (entry.kind === "subagent") {
      if (!entry.sessionID) throw new Error(`subagent timeline entry ${entry.id} is missing sessionID`)
      pendingSessionIDs.push(entry.sessionID)
      continue
    }
    flushGrid()
    items.push({ id: entry.id, kind: "card", cardID: entry.id })
  }
  flushGrid()
  return items
}

export function subagentProgressEvents(input: {
  record: AgentActivityRecord
  directory: string
}): SubagentProgressEvent[] {
  const events: SubagentProgressEvent[] = []
  for (let index = 0; index < input.record.activity.length; index += 1) {
    const part = input.record.activity[index]
    const id = String(part?.id || `${input.record.sessionID}:${index}`)
    if (part?.type === "text") {
      const text = compactProgressText(part.text)
      if (text) events.push({ id, kind: "text", text })
      continue
    }
    if (part?.type === "tool") {
      const display = describeCurrentToolPart([part], input.directory)
      if (!display) throw new Error(`subagent progress tool ${id} could not be described`)
      events.push({
        id,
        kind: "tool",
        icon: display.icon,
        label: display.label,
        detail: compactProgressText(display.detail, 120),
        status: display.status,
      })
      continue
    }
    if (part?.type === "patch") {
      const files = Array.isArray(part.files)
        ? part.files
            .map((file: unknown) => {
              if (!file || typeof file !== "object") return compactProgressText(file, 96)
              const entry = file as Record<string, unknown>
              return compactProgressText(entry.file || entry.path || entry.filename, 96)
            })
            .filter(Boolean)
        : []
      if (files.length > 0) events.push({ id, kind: "patch", files })
      continue
    }
    if (part?.type === "file") {
      const filename = compactProgressText(part.filename, 120)
      if (filename) events.push({ id, kind: "file", filename })
      continue
    }
    if (part?.type === "part-error") {
      const text = compactProgressText(part.message || part.title, 160)
      if (text) events.push({ id, kind: "error", text })
    }
  }
  if (input.record.status === "error" && input.record.errorReason) {
    events.push({
      id: `${input.record.sessionID}:error`,
      kind: "error",
      text: compactProgressText(input.record.errorReason, 160),
    })
  }
  return events.slice(-CONVERSATION_AGENT_ACTIVITY_LIMIT)
}

export function subagentGridItemForSession(
  items: SubagentConversationItem[],
  sessionID: string,
): SubagentProgressGridItem | undefined {
  return items.find(
    (item): item is SubagentProgressGridItem => item.kind === "subagent-grid" && item.sessionIDs.includes(sessionID),
  )
}
