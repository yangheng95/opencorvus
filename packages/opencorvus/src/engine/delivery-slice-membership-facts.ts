import type { Database } from "@/storage/db"
import { and, eq, lt } from "drizzle-orm"
import { assertEngineArtifactPayloadIdentity } from "./artifact-catalog-metadata"
import { EngineArtifactTable } from "./engine.sql"
import { GoalGraphProjectionArtifactPayloadSchema, resolveGoalGraphProjectionTip } from "./goal-graph-projection"
import { EngineArtifactLocatorSchema, type EngineArtifactLocator } from "@opencorvus-ai/plugin/artifact-catalog"

export interface GoalGraphMembershipFact {
  locator: EngineArtifactLocator
  revisionIDs: string[]
}

/** Resolve the unique successful GoalGraph tip visible before an Artifact
 * catalog high-water mark. Later conflict candidates and supersessions cannot
 * rewrite the publication-time membership fact. */
export function resolveGoalGraphMembershipBeforeCatalogRevision(input: {
  db: Database.TxOrDb
  taskID: string
  catalogRevision: number
}): GoalGraphMembershipFact | undefined {
  const rows = input.db
    .select()
    .from(EngineArtifactTable)
    .where(
      and(
        eq(EngineArtifactTable.task_id, input.taskID),
        eq(EngineArtifactTable.kind, "goal_graph_projection"),
        lt(EngineArtifactTable.catalog_revision, input.catalogRevision),
      ),
    )
    .all()
    .map((row) => {
      assertEngineArtifactPayloadIdentity({
        id: row.id,
        kind: row.kind,
        payload: row.payload,
        payloadSHA256: row.payload_sha256,
        payloadBytes: row.payload_bytes,
      })
      return { ...row, payload: GoalGraphProjectionArtifactPayloadSchema.parse(row.payload) }
    })
  const tip = resolveGoalGraphProjectionTip(input.taskID, rows)
  if (!tip?.payload.projection) return undefined
  return {
    locator: EngineArtifactLocatorSchema.parse({
      source: "engine_artifact",
      artifact_id: tip.id,
      catalog_revision: tip.catalog_revision,
      expected_sha256: tip.payload_sha256,
    }),
    revisionIDs: [...tip.payload.projection.goal_revision_ids],
  }
}

/** Validate exact current Slice subjects with the transaction that persists
 * their consuming lineage or completion fact. */
export function assertCurrentDeliverySliceRevisionIDsInTransaction(input: {
  db: Database.TxOrDb
  taskID: string
  deliverySliceRevisionIDs: readonly string[]
  subject: string
}): string[] {
  const rows = input.db
    .select()
    .from(EngineArtifactTable)
    .where(and(eq(EngineArtifactTable.task_id, input.taskID), eq(EngineArtifactTable.kind, "goal_graph_projection")))
    .all()
    .map((row) => {
      assertEngineArtifactPayloadIdentity({
        id: row.id,
        kind: row.kind,
        payload: row.payload,
        payloadSHA256: row.payload_sha256,
        payloadBytes: row.payload_bytes,
      })
      return { ...row, payload: GoalGraphProjectionArtifactPayloadSchema.parse(row.payload) }
    })
  const tip = resolveGoalGraphProjectionTip(input.taskID, rows)
  const currentRevisionIDs = new Set(tip?.payload.projection?.goal_revision_ids ?? [])
  const missing = input.deliverySliceRevisionIDs.filter((revisionID) => !currentRevisionIDs.has(revisionID))
  if (missing.length > 0) {
    throw new Error(
      `${input.subject} Delivery Slice revisions are not current members of Task ${input.taskID}: ${[...new Set(missing)].join(", ")}`,
    )
  }
  return [...input.deliverySliceRevisionIDs]
}
