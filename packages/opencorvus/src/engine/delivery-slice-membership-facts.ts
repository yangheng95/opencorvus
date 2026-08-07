import { Database, and, eq } from "@/storage/db"
import { assertEngineArtifactPayloadIdentity } from "./artifact-catalog-metadata"
import { EngineArtifactTable } from "./engine.sql"
import { GoalGraphProjectionArtifactPayloadSchema, resolveGoalGraphProjectionTip } from "./goal-graph-projection"

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
