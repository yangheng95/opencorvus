import type { ConversationAgentActivityItem } from "@opencorvus-ai/transport-protocol"
import type { TodoItem } from "./todos"

export type AgentActivityStatus = "pending" | "running" | "idle" | "completed" | "error" | "skipped"

export function isAgentActivityTerminalStatus(status: AgentActivityStatus): boolean {
  return status === "completed" || status === "error" || status === "skipped"
}

export interface AgentActivityRecord {
  id: string
  inputMessageID?: string
  messageIDs?: string[]
  sessionID: string
  parentSessionID: string
  agentID: string
  stage: string
  rawStage?: string
  viewSource?: "hydrate" | "live"
  status: AgentActivityStatus
  orderKey?: string
  startedAt: number
  lastObservedAt: number
  completedAt?: number
  attempts: number
  depth: number
  cardID?: string
  renderedCardID?: string
  targetMessageID?: string
  targetObservedAt?: number
  /** Latest persisted task protocol sequence that changed this session's transcript. */
  transcriptSequence?: number
  model?: string
  /** Bounded persisted/live activity facts for the progress card. Full
   * transcript content remains owned by the exact session route. */
  activity: ConversationAgentActivityItem[]
  /** Canonical persisted/live TODO snapshot for this exact execution session. */
  todos: TodoItem[]
  todoUpdatedAt: number
  errorReason?: string
  inputPreview?: {
    text: string
    messageID: string
    observedAt: number
    source: "user_message"
  }
}

export interface AgentActivityStack {
  id: string
  agentID: string
  parentSessionID: string
  depth: number
  startedAt: number
  records: AgentActivityRecord[]
}

export interface AgentActivityProjection {
  records: AgentActivityRecord[]
  stacks: AgentActivityStack[]
}

export function groupAdjacentAgentActivityRecordsByIdentity(records: AgentActivityRecord[]): AgentActivityRecord[][] {
  const groups: AgentActivityRecord[][] = []
  for (const record of records) {
    const previous = groups[groups.length - 1]
    if (previous?.[0]?.agentID === record.agentID) {
      previous.push(record)
      continue
    }
    groups.push([record])
  }
  return groups
}
