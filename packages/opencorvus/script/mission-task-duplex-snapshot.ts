import { EngineTaskTable } from "@/engine/engine.sql"
import { projectTaskRowsInTransaction } from "@/engine/store"
import { PublishableInteractiveArtifactPayload } from "@/interactive-artifact/schema"
import { projectProtocolDeliveryInTransaction } from "@/protocol/delivery-projection"
import { ProtocolInboxTable } from "@/protocol/protocol.sql"
import {
  MessageTable,
  PartTable,
  ToolPartOutcomeTable,
  ToolPartProgressTable,
  ToolPartRequestTable,
} from "@/session/session.sql"
import { projectToolPartInTransaction } from "@/session/tool-part-facts"
import type { Database } from "@/storage/db"

export type MissionTaskDuplexUsageRow = {
  sessionID: string | null
  agentID: string | null
  inputTokens: number
  outputTokens: number
  reasoningTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  totalTokens: number
}

export type MissionTaskDuplexUsageOwner = {
  sessionID: string
  agentID: "mission" | "orchestrator"
}

export function missionTaskDuplexUsageOwnerRequirements(input: {
  missionSessionID: string
  taskRootSessionIDs: readonly string[]
  sessions: readonly { id: string; parentID?: string | null; kind: string }[]
}) {
  const owners: MissionTaskDuplexUsageOwner[] = [
    { sessionID: input.missionSessionID, agentID: "mission" },
  ]
  const unresolvedTaskRootSessionIDs: string[] = []
  for (const taskRootSessionID of input.taskRootSessionIDs) {
    const orchestrators = input.sessions.filter(
      (session) => session.parentID === taskRootSessionID && session.kind === "orchestrator",
    )
    if (orchestrators.length !== 1) {
      unresolvedTaskRootSessionIDs.push(taskRootSessionID)
      continue
    }
    owners.push({ sessionID: orchestrators[0]!.id, agentID: "orchestrator" })
  }
  return { owners, unresolvedTaskRootSessionIDs }
}

export function missionTaskDuplexFinalEvidenceState(input: {
  missionSessionID: string
  completionMessageID?: string
  completionParentMessageID?: string
  nonce: string
  artifacts: readonly {
    id: string
    messageID: string
    sessionID: string
    parentMessageID?: string
    payload: unknown
  }[]
  usage: readonly MissionTaskDuplexUsageRow[]
  requiredUsageOwners: readonly MissionTaskDuplexUsageOwner[]
  unresolvedUsageOwners?: readonly string[]
}) {
  const completionArtifacts = input.completionMessageID && input.completionParentMessageID
    ? input.artifacts.filter(
        (artifact) =>
          artifact.sessionID === input.missionSessionID &&
          artifact.parentMessageID === input.completionParentMessageID,
      )
    : []
  const parsedArtifact =
    completionArtifacts.length === 1
      ? PublishableInteractiveArtifactPayload.safeParse(completionArtifacts[0]!.payload)
      : undefined
  const canonicalArtifact = parsedArtifact?.success === true ? parsedArtifact.data : undefined
  const artifactContainsNonce = canonicalArtifact
    ? JSON.stringify(canonicalArtifact).includes(input.nonce)
    : false
  const requiredSessionIDs = new Set(input.requiredUsageOwners.map((owner) => owner.sessionID))
  const exactUsage = input.usage.filter(
    (row) => row.sessionID !== null && requiredSessionIDs.has(row.sessionID),
  )
  const missingUsageOwners = [
    ...(input.unresolvedUsageOwners ?? []),
    ...input.requiredUsageOwners
    .filter(
      (owner) =>
        !exactUsage.some(
          (row) =>
            row.sessionID === owner.sessionID &&
            row.agentID === owner.agentID &&
            row.totalTokens > 0,
        ),
    )
    .map((owner) => `${owner.agentID}:${owner.sessionID}`),
  ]
  const usageByAgent = Object.values(
    exactUsage.reduce<
      Record<
        string,
        {
          agentID: string
          calls: number
          inputTokens: number
          outputTokens: number
          reasoningTokens: number
          cacheReadTokens: number
          cacheWriteTokens: number
          totalTokens: number
        }
      >
    >((summary, row) => {
      const agentID = row.agentID ?? "unknown"
      const current = summary[agentID] ?? {
        agentID,
        calls: 0,
        inputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 0,
      }
      current.calls += 1
      current.inputTokens += row.inputTokens
      current.outputTokens += row.outputTokens
      current.reasoningTokens += row.reasoningTokens
      current.cacheReadTokens += row.cacheReadTokens
      current.cacheWriteTokens += row.cacheWriteTokens
      current.totalTokens += row.totalTokens
      summary[agentID] = current
      return summary
    }, {}),
  ).sort((left, right) => left.agentID.localeCompare(right.agentID))
  const blockingReasons = [
    ...(!input.completionMessageID ? ["mission_completion_missing" as const] : []),
    ...(input.completionMessageID && !input.completionParentMessageID
      ? ["mission_completion_occurrence_missing" as const]
      : []),
    ...(completionArtifacts.length !== 1 ? ["final_artifact_occurrence_missing" as const] : []),
    ...(!canonicalArtifact ? ["final_artifact_payload_invalid" as const] : []),
    ...(!artifactContainsNonce ? ["final_artifact_nonce_missing" as const] : []),
    ...(missingUsageOwners.length > 0 ? ["required_usage_missing" as const] : []),
  ]
  return {
    ready: blockingReasons.length === 0,
    blockingReasons,
    finalArtifactID: canonicalArtifact ? completionArtifacts[0]!.id : undefined,
    finalArtifactCount: completionArtifacts.length,
    artifactContainsNonce,
    missingUsageOwners,
    usageByAgent,
  }
}

export function projectMissionTaskDuplexControlStateInTransaction(
  db: Database.TxOrDb,
  input: {
    tasks: readonly (typeof EngineTaskTable.$inferSelect)[]
    inboxes: readonly (typeof ProtocolInboxTable.$inferSelect)[]
    toolRequests: readonly (typeof ToolPartRequestTable.$inferSelect)[]
  },
  now = Date.now(),
) {
  return {
    tasks: projectTaskRowsInTransaction(db, input.tasks),
    inboxes: input.inboxes.map((row) => projectProtocolDeliveryInTransaction(db, row, now)),
    toolParts: input.toolRequests
      .map((row) => projectToolPartInTransaction(db, row))
      .filter((part) => part !== undefined),
  }
}

export function missionTaskDuplexProgressKey(
  input: ReturnType<typeof projectMissionTaskDuplexControlStateInTransaction> & {
    schedulerEventCount: number
    missionCompleted: boolean
  },
) {
  const terminalDeliveries = input.inboxes.filter(
    (row) => row.status === "delivered" || row.status === "dead_letter",
  ).length
  const terminalTasks = input.tasks.filter((row) => row.time_completed !== null).length
  return `${input.tasks.length}:${input.schedulerEventCount}:${terminalDeliveries}:${terminalTasks}:${input.missionCompleted ? 1 : 0}`
}

function durableActivityFrontier(rows: readonly { id: string; time: number }[]) {
  let latestTime = 0
  let latestID = ""
  for (const row of rows) {
    if (row.time > latestTime || (row.time === latestTime && row.id > latestID)) {
      latestTime = row.time
      latestID = row.id
    }
  }
  return { count: rows.length, latestTime, latestID }
}

export function missionTaskDuplexActivityKey(input: {
  taskCount: number
  schedulerEventCount: number
  deliveredInboxCount: number
  messages: readonly Pick<typeof MessageTable.$inferSelect, "id" | "time_updated">[]
  parts: readonly Pick<typeof PartTable.$inferSelect, "id" | "time_updated">[]
  toolRequests: readonly Pick<typeof ToolPartRequestTable.$inferSelect, "id" | "time_created">[]
  toolProgress: readonly Pick<typeof ToolPartProgressTable.$inferSelect, "id" | "time_created">[]
  toolOutcomes: readonly Pick<typeof ToolPartOutcomeTable.$inferSelect, "id" | "time_created">[]
}) {
  return JSON.stringify({
    tasks: input.taskCount,
    schedulerEvents: input.schedulerEventCount,
    deliveredInboxes: input.deliveredInboxCount,
    messages: durableActivityFrontier(
      input.messages.map((row) => ({ id: row.id, time: row.time_updated })),
    ),
    parts: durableActivityFrontier(input.parts.map((row) => ({ id: row.id, time: row.time_updated }))),
    toolRequests: durableActivityFrontier(
      input.toolRequests.map((row) => ({ id: row.id, time: row.time_created })),
    ),
    toolProgress: durableActivityFrontier(
      input.toolProgress.map((row) => ({ id: row.id, time: row.time_created })),
    ),
    toolOutcomes: durableActivityFrontier(
      input.toolOutcomes.map((row) => ({ id: row.id, time: row.time_created })),
    ),
  })
}

export type MissionTaskDuplexActivityDeadline = {
  activityKey: string
  deadlineMs: number
}

export function observeMissionTaskDuplexActivity(input: {
  previous?: MissionTaskDuplexActivityDeadline
  activityKey: string
  observedAtMs: number
  inactivityWindowMs: number
  absoluteDeadlineMs: number
}): MissionTaskDuplexActivityDeadline {
  if (input.activityKey.length === 0) throw new Error("Mission Task duplex activity key must not be empty")
  for (const [label, value] of [
    ["observation time", input.observedAtMs],
    ["inactivity window", input.inactivityWindowMs],
    ["absolute deadline", input.absoluteDeadlineMs],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`Mission Task duplex ${label} must be a non-negative safe integer`)
    }
  }
  if (input.inactivityWindowMs === 0) {
    throw new Error("Mission Task duplex inactivity window must be positive")
  }
  if (input.previous?.activityKey === input.activityKey) return input.previous
  const renewedDeadline = input.observedAtMs + input.inactivityWindowMs
  if (!Number.isSafeInteger(renewedDeadline)) {
    throw new Error("Mission Task duplex inactivity deadline must be a safe integer")
  }
  return {
    activityKey: input.activityKey,
    deadlineMs: Math.min(input.absoluteDeadlineMs, renewedDeadline),
  }
}

export function missionTaskDuplexToolHealth(
  toolParts: readonly ReturnType<typeof projectToolPartInTransaction>[],
) {
  const visible = toolParts.filter((part) => part !== undefined)
  return {
    failedToolPartIDs: visible
      .filter((part) => part.state.status === "error")
      .map((part) => part.id)
      .sort(),
    runningToolPartIDs: visible
      .filter((part) => part.state.status === "running")
      .map((part) => part.id)
      .sort(),
  }
}
