import type { Database as SQLite } from "bun:sqlite"
import { parseExpertSquadMutationReceiptProjection } from "@/expert-squad/mutation-receipt-validation"

/** Report projections once owned the only successful mutation evidence. Move
 * that authority to the installation lifetime without changing any old row or
 * inventing facts for journals whose original receipt has already disappeared. */
export function preserveInstallationMutationReceipts(sqlite: SQLite): void {
  sqlite.exec(`CREATE TABLE expert_squad_mutation_receipt (
    artifact_id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    envelope TEXT NOT NULL,
    time_created INTEGER NOT NULL
  )`)
  const select = sqlite.query<
    { id: string; task_id: string; kind: string; payload: string; time_created: number },
    []
  >(`
    SELECT id,task_id,kind,payload,time_created FROM engine_artifact
    WHERE kind='expert_output'
      AND json_extract(payload,'$.artifact_type')='evolution-lab/promotion-receipt'
      AND json_extract(payload,'$.producer.owner_kind')='core'
      AND json_extract(payload,'$.producer.component_id')='expert-squad-package-manager'
      AND json_type(payload,'$.import_lineage') IS NULL
    ORDER BY rowid`)
  const insert = sqlite.query(`INSERT INTO expert_squad_mutation_receipt
    (artifact_id,task_id,envelope,time_created) VALUES (?,?,?,?)`)
  try {
    for (const row of select.all()) {
      const parsed = parseExpertSquadMutationReceiptProjection({
        artifactID: row.id,
        taskID: row.task_id,
        kind: row.kind,
        payload: JSON.parse(row.payload),
      })
      if (!parsed) continue
      // Preserve the original stored bytes and commit time. The validator does
      // not reserialize a historical report into a newly claimed success.
      insert.run(row.id, row.task_id, row.payload, row.time_created)
    }
  } finally {
    select.finalize()
    insert.finalize()
  }
}
