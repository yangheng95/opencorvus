import { EngineTaskTable } from "@/engine/engine.sql"
import { projectTaskRowsInTransaction } from "@/engine/store"
import { PublishableInteractiveArtifactPayload } from "@/interactive-artifact/schema"
import { projectProtocolDeliveryInTransaction } from "@/protocol/delivery-projection"
import { ProtocolInboxTable } from "@/protocol/protocol.sql"
import { ToolPartRequestTable } from "@/session/session.sql"
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

export function missionTaskDuplexFinalEvidenceState(input: {
  missionSessionID: string
  completionMessageID?: string
  nonce: string
  artifacts: readonly { id: string; messageID: string; sessionID: string; payload: unknown }[]
  usage: readonly MissionTaskDuplexUsageRow[]
  requiredUsageOwners: readonly MissionTaskDuplexUsageOwner[]
}) {
  const completionArtifacts = input.completionMessageID
    ? input.artifacts.filter(
        (artifact) =>
          artifact.sessionID === input.missionSessionID && artifact.messageID === input.completionMessageID,
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
  const missingUsageOwners = input.requiredUsageOwners
    .filter(
      (owner) =>
        !exactUsage.some(
          (row) =>
            row.sessionID === owner.sessionID &&
            row.agentID === owner.agentID &&
            row.totalTokens > 0,
        ),
    )
    .map((owner) => `${owner.agentID}:${owner.sessionID}`)
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
