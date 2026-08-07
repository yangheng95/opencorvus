import { and, desc, eq } from "drizzle-orm"
import { Database } from "@/storage/db"
import { Identifier } from "@/id/id"
import { EngineArtifactTable } from "@/engine/engine.sql"
import { recordEngineArtifact } from "@/engine/artifact"
import {
  FactCheckReviewArtifactSchema,
  type FactCheckReview,
  type FactCheckReviewArtifact,
} from "./schema"
import type { ArtifactReadLocator } from "@opencorvus-ai/plugin/artifact-catalog"

export interface FactCheckReviewRow {
  artifactID: string
  taskID: string
  payload: FactCheckReviewArtifact
  timeCreated: number
}

export interface RecordFactCheckReviewInput {
  taskID: string
  targetSessionID: string
  targetAgent: string
  targetMessageID: string
  targetMessageContentHash: string
  invokedByOrchestratorSessionID: string
  factCheckSessionID: string
  observedArtifactLocators: ArtifactReadLocator[]
  sourceArtifactLocators: ArtifactReadLocator[]
  review: FactCheckReview
  now?: number
}

export function recordFactCheckReview(input: RecordFactCheckReviewInput): string {
  const id = Identifier.ascending("artifact")
  const now = input.now ?? Date.now()
  const payload = FactCheckReviewArtifactSchema.parse({
    target_session_id: input.targetSessionID,
    target_agent: input.targetAgent,
    target_message_id: input.targetMessageID,
    target_message_content_hash: input.targetMessageContentHash,
    invoked_by_orchestrator_session_id: input.invokedByOrchestratorSessionID,
    fact_check_session_id: input.factCheckSessionID,
    observed_artifact_locators: input.observedArtifactLocators,
    source_artifact_locators: input.sourceArtifactLocators,
    review: input.review,
  })
  recordEngineArtifact({
    id,
    taskID: input.taskID,
    kind: "fact_check_review",
    label: `fact-check-${payload.review.overall_verdict}`,
    payload: payload as unknown as Record<string, unknown>,
    timeCreated: now,
  })
  return id
}

export function listFactCheckReviews(taskID: string): FactCheckReviewRow[] {
  return Database.use((db) =>
    db
      .select()
      .from(EngineArtifactTable)
      .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "fact_check_review")))
      .orderBy(desc(EngineArtifactTable.time_created), desc(EngineArtifactTable.id))
      .all()
      .map((row) => {
        const payload = FactCheckReviewArtifactSchema.parse(row.payload)
        return {
          artifactID: row.id,
          taskID: row.task_id,
          payload,
          timeCreated: row.time_created,
        }
      }),
  )
}
