import type { CardNode } from "./card-tree"
import { selectedTaskDirectory } from "../store/board"
import { displayToolArguments, toolNameKey } from "./tool"
import { requireTimelineOrderKeyDomain } from "./timeline-order"

const TODO_CARD_TITLE_KEYS: Record<string, string> = {
  todowrite: "tool.card.todos",
  todoread: "tool.card.todos",
  todoupdate: "tool.card.todos",
  updateplan: "tool.card.plan",
}

function positiveFiniteTimestamp(value: unknown): number | undefined {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : undefined
}

function requireNonEmptyString(value: unknown, label: string): string {
  const text = typeof value === "string" ? value.trim() : ""
  if (!text) throw new Error(`${label} missing`)
  return text
}

function requirePositiveFiniteTimestamp(value: unknown, label: string): number {
  const timestamp = positiveFiniteTimestamp(value)
  if (timestamp === undefined) throw new Error(`${label} missing positive timestamp`)
  return timestamp
}

/** Build a transient CardNode for a tool part so every tool shares the same card chrome. */
export function toolToCardNode(part: any): CardNode {
  const id = requireNonEmptyString(part?.id, "tool part id")
  const toolName = requireNonEmptyString(part?.tool, `tool part ${id} tool`)
  const state = typeof part?.state === "object" && part.state !== null ? part.state : {}
  const status = (() => {
    const s = String(state.status || "").toLowerCase()
    if (s === "pending" || s === "running" || s === "completed" || s === "error") return s as any
    if (s === "failed") return "error"
    return undefined
  })()
  const key = toolNameKey(toolName)
  const args = displayToolArguments(toolName, state.input, state, selectedTaskDirectory())
  const title = TODO_CARD_TITLE_KEYS[key] || toolName
  const time = requirePositiveFiniteTimestamp(state?.time?.start, `tool part ${id} start time`)
  const timeCompleted = positiveFiniteTimestamp(state?.time?.end)
  if (state?.time?.end !== undefined && timeCompleted === undefined) {
    throw new Error(`tool part ${id} end time missing positive timestamp`)
  }
  if (timeCompleted !== undefined && timeCompleted <= time) {
    throw new Error(`tool part ${id} end time must be later than start time`)
  }
  const orderKey = requireTimelineOrderKeyDomain(part?.orderKey, `tool part ${id}`, "part")
  return {
    id,
    kind: "tool",
    stage: key,
    status,
    title,
    subtitle: args || undefined,
    parts: [],
    childIDs: [],
    toolPart: part,
    orderKey,
    time,
    ...(timeCompleted !== undefined ? { timeCompleted } : {}),
  }
}
