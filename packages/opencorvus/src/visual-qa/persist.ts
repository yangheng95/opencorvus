import z from "zod"
import { recordEngineArtifact } from "@/engine/artifact"
import { EngineArtifactTable } from "@/engine/engine.sql"
import { Database, and, eq } from "@/storage/db"
import { VisualReviewSchema, type VisualReview } from "./schema"
import {
  ArtifactConsumptionProvenanceSchema,
  ArtifactReadLocatorSchema,
  type ArtifactReadLocator,
} from "@opencorvus-ai/plugin/artifact-catalog"
import { artifactCatalogAuthority, readTaskArtifact } from "@/artifact-catalog"
import { assertCurrentDeliverySliceRevisionIDs } from "@/engine/store"
import { Identifier } from "@/id/id"

export const VisualReviewArtifactPayloadSchema =
  ArtifactConsumptionProvenanceSchema.safeExtend({
    session_id: z.string().min(1),
    final_message_id: z.string().min(1),
    goal_ids: z.array(Identifier.schema("goal")),
    evidence_artifact_locators: z.array(ArtifactReadLocatorSchema),
    review: VisualReviewSchema,
    completeness_findings: z.array(z.string()),
    judgment_tool: z
      .object({
        message_id: z.string().min(1),
        part_id: z.string().min(1),
        call_id: z.string().min(1),
      })
      .strict()
      .optional(),
  })

export type VisualReviewArtifactPayload = z.infer<typeof VisualReviewArtifactPayloadSchema>

export type VisualReviewArtifact = {
  id: string
  taskID: string
  payload: VisualReviewArtifactPayload
  timeCreated: number
}

function visualReviewArtifactFromRow(row: typeof EngineArtifactTable.$inferSelect): VisualReviewArtifact {
  return {
    id: row.id,
    taskID: row.task_id,
    payload: VisualReviewArtifactPayloadSchema.parse(row.payload),
    timeCreated: row.time_created,
  }
}

export async function persistVisualReview(input: {
  taskID: string
  sessionID: string
  finalMessageID: string
  goalIDs: string[]
  evidenceArtifactLocators: ArtifactReadLocator[]
  observedArtifactLocators: ArtifactReadLocator[]
  sourceArtifactLocators: ArtifactReadLocator[]
  review: VisualReview
  completenessFindings: string[]
  judgmentTool?: { messageID: string; partID: string; callID: string }
  now?: number
}): Promise<string> {
  const evidenceArtifactLocators = input.evidenceArtifactLocators.map((locator) =>
    ArtifactReadLocatorSchema.parse(locator),
  )
  const observedArtifactLocators = input.observedArtifactLocators.map((locator) =>
    ArtifactReadLocatorSchema.parse(locator),
  )
  const sourceArtifactLocators = input.sourceArtifactLocators.map((locator) =>
    ArtifactReadLocatorSchema.parse(locator),
  )
  const authority = artifactCatalogAuthority(input.taskID)
  for (const locator of evidenceArtifactLocators) {
    await readTaskArtifact({
      authority,
      read: { locator, byte_offset: 0, max_bytes: 1 },
    })
  }
  const goalIDs = assertCurrentDeliverySliceRevisionIDs({
    taskID: input.taskID,
    deliverySliceRevisionIDs: [...new Set(input.goalIDs)],
    subject: "VisualReview",
  })
  return recordEngineArtifact({
    taskID: input.taskID,
    kind: "visual_review",
    label: input.review.accepted === undefined ? "judgment-not-recorded" : `accepted-${input.review.accepted}`,
    payload: {
      session_id: input.sessionID,
      final_message_id: input.finalMessageID,
      goal_ids: goalIDs,
      evidence_artifact_locators: evidenceArtifactLocators,
      observed_artifact_locators: observedArtifactLocators,
      source_artifact_locators: sourceArtifactLocators,
      review: input.review,
      completeness_findings: input.completenessFindings,
      ...(input.judgmentTool
        ? {
            judgment_tool: {
              message_id: input.judgmentTool.messageID,
              part_id: input.judgmentTool.partID,
              call_id: input.judgmentTool.callID,
            },
          }
        : {}),
    },
    timeCreated: input.now,
  })
}

export function listVisualReviews(taskID: string): VisualReviewArtifact[] {
  const rows = Database.use((db) =>
    db
      .select()
      .from(EngineArtifactTable)
      .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "visual_review")))
      .orderBy(EngineArtifactTable.time_created, EngineArtifactTable.id)
      .all(),
  )
  return rows.map(visualReviewArtifactFromRow)
}

export function findVisualReviewByID(input: { taskID: string; artifactID: string }): VisualReviewArtifact | undefined {
  const row = Database.use((db) =>
    db
      .select()
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.id, input.artifactID),
          eq(EngineArtifactTable.kind, "visual_review"),
        ),
      )
      .limit(1)
      .get(),
  )
  return row ? visualReviewArtifactFromRow(row) : undefined
}
