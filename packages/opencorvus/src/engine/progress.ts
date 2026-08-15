import { Identifier } from "@/id/id"
import type { Database } from "@/storage/db"
import { EngineProgressSnapshotTable, type EngineMetadata } from "./engine.sql"

export interface EngineProgressSnapshotInput {
  taskID: string
  summary: string
  payload: EngineMetadata
  timeCreated?: number
}

export function insertEngineProgressSnapshot(db: Database.TxOrDb, input: EngineProgressSnapshotInput): string {
  const id = Identifier.ascending("progress")
  const timeCreated = input.timeCreated ?? Date.now()
  db.insert(EngineProgressSnapshotTable)
    .values({
      id,
      task_id: input.taskID,
      summary: input.summary,
      payload: input.payload,
      time_created: timeCreated,
    })
    .run()
  return id
}
