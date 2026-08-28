import { Identifier } from "@/id/id"
import { SessionCompaction } from "@/session/compaction"
import { SessionControl } from "@/session/control"
import { Message } from "@/session/message"
import type { MissionAcceptanceGap } from "./acceptance-gap"

export async function createAcceptanceEpochCheckpoint(input: {
  sessionID: string
  source: Message.User
  taskID: string
  ledgerRevisionArtifactID: string
  gap: MissionAcceptanceGap
  executionEpoch: number
  workflowNodeID?: string | null
}) {
  const identity = [
    "mission-acceptance-epoch-checkpoint-v1",
    input.taskID,
    input.executionEpoch,
    input.ledgerRevisionArtifactID,
    input.gap.gap_id,
    input.sessionID,
  ].join("\0")
  const id = Identifier.deterministic("session_control", identity)
  const focus = JSON.stringify({
    kind: "mission_acceptance_epoch_checkpoint",
    task_id: input.taskID,
    execution_epoch: input.executionEpoch,
    ledger_revision_artifact_id: input.ledgerRevisionArtifactID,
    gap_id: input.gap.gap_id,
    workflow_node_id: input.workflowNodeID ?? null,
    preserved_acceptances: input.gap.preserved_acceptances,
    open_criteria: input.gap.criteria,
    evidence_locators: input.gap.criteria.flatMap((criterion) => [
      ...criterion.relied_evidence_locators,
      ...criterion.contradictory_evidence_locators,
    ]),
    requested_next_action: input.gap.requested_next_action,
  })
  const existing = SessionControl.get(id)
  if (existing) {
    if (
      existing.sessionID !== input.sessionID ||
      existing.kind !== "compaction_request" ||
      existing.status === "failed" ||
      existing.payload.overflow !== true ||
      existing.payload.focus !== focus
    ) {
      throw new Error(`Mission acceptance epoch checkpoint ${id} does not match its immutable semantics.`)
    }
    return existing
  }
  return SessionCompaction.create({
    id,
    sessionID: input.sessionID,
    source: input.source,
    auto: true,
    overflow: true,
    focus,
  })
}
