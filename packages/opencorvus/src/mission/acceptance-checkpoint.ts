import { Identifier } from "@/id/id"
import { SessionCompaction } from "@/session/compaction"
import { SessionControl } from "@/session/control"
import { Message } from "@/session/message"
import { acceptanceGapEvidenceLocators, type MissionAcceptanceGap } from "./acceptance-gap"

export interface AcceptanceCheckpointProjection {
  logicalCheckpointID: string
  attempt: number
  control: SessionControl.Record
  successfulSummaryMessageID?: string
}

function logicalCheckpointID(input: {
  sessionID: string
  taskID: string
  executionEpoch: number
  ledgerRevisionArtifactID: string
  gapID: string
}) {
  return Identifier.deterministic(
    "session_control",
    [
      "mission-acceptance-logical-checkpoint-v2",
      input.taskID,
      input.executionEpoch,
      input.ledgerRevisionArtifactID,
      input.gapID,
      input.sessionID,
    ].join("\0"),
  )
}

function checkpointAttempt(control: SessionControl.Record): number | undefined {
  const attempt = control.payload.checkpoint_attempt
  return Number.isInteger(attempt) && Number(attempt) > 0 ? Number(attempt) : undefined
}

function checkpointProjection(
  logicalID: string,
  control: SessionControl.Record,
): AcceptanceCheckpointProjection {
  const attempt = checkpointAttempt(control)
  if (!attempt) throw new Error(`Mission acceptance checkpoint control ${control.id} has no attempt identity.`)
  const summaryMessageID = control.payload.result_summary_message_id
  return {
    logicalCheckpointID: logicalID,
    attempt,
    control,
    ...(control.status === "consumed" && typeof summaryMessageID === "string"
      ? { successfulSummaryMessageID: summaryMessageID }
      : {}),
  }
}

export function currentAcceptanceEpochCheckpoint(input: {
  sessionID: string
  logicalCheckpointID: string
}): AcceptanceCheckpointProjection | undefined {
  const attempts = SessionControl.list(input.sessionID)
    .filter(
      (control) =>
        control.kind === "compaction_request" &&
        control.payload.logical_checkpoint_id === input.logicalCheckpointID &&
        checkpointAttempt(control) !== undefined,
    )
    .sort((left, right) => checkpointAttempt(left)! - checkpointAttempt(right)!)
  const successful = attempts.findLast((control) => control.status === "consumed")
  if (successful) return checkpointProjection(input.logicalCheckpointID, successful)
  const pending = attempts.findLast((control) => control.status === "pending")
  if (pending) return checkpointProjection(input.logicalCheckpointID, pending)
  const failed = attempts.at(-1)
  return failed ? checkpointProjection(input.logicalCheckpointID, failed) : undefined
}

export async function createAcceptanceEpochCheckpoint(input: {
  sessionID: string
  source: Message.User
  taskID: string
  ledgerRevisionArtifactID: string
  gap: MissionAcceptanceGap
  executionEpoch: number
  workflowNodeID?: string | null
}): Promise<AcceptanceCheckpointProjection> {
  const logicalID = logicalCheckpointID({
    sessionID: input.sessionID,
    taskID: input.taskID,
    executionEpoch: input.executionEpoch,
    ledgerRevisionArtifactID: input.ledgerRevisionArtifactID,
    gapID: input.gap.gap_id,
  })
  const current = currentAcceptanceEpochCheckpoint({
    sessionID: input.sessionID,
    logicalCheckpointID: logicalID,
  })
  if (current?.control.status === "pending" || current?.control.status === "consumed") return current

  const attempt = (current?.attempt ?? 0) + 1
  const id = Identifier.deterministic(
    "session_control",
    ["mission-acceptance-checkpoint-attempt-v2", logicalID, attempt].join("\0"),
  )
  const focus = JSON.stringify({
    kind: "mission_acceptance_epoch_checkpoint",
    logical_checkpoint_id: logicalID,
    checkpoint_attempt: attempt,
    task_id: input.taskID,
    execution_epoch: input.executionEpoch,
    ledger_revision_artifact_id: input.ledgerRevisionArtifactID,
    gap_id: input.gap.gap_id,
    workflow_node_id: input.workflowNodeID ?? null,
    criterion_states: input.gap.criteria,
    evidence_locators: acceptanceGapEvidenceLocators(input.gap),
  })
  const control = await SessionCompaction.create({
    id,
    sessionID: input.sessionID,
    source: input.source,
    auto: true,
    overflow: true,
    focus,
    controlLineage: { logicalID, attempt },
  })
  return checkpointProjection(logicalID, control)
}
