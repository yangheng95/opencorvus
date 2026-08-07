import { Identifier } from "@/id/id"
import { Database, eq } from "@/storage/db"
import { EngineChannelBindingTable, type EngineMetadata } from "./engine.sql"

export interface InsertEngineChannelBindingInput {
  taskID: string
  platform: string
  channel: string
  thread: string
  payload: EngineMetadata
  timeCreated?: number
}

export function insertEngineChannelBinding(db: Database.TxOrDb, input: InsertEngineChannelBindingInput): string {
  const id = Identifier.ascending("binding")
  const timeCreated = input.timeCreated ?? Date.now()
  db.insert(EngineChannelBindingTable)
    .values({
      id,
      task_id: input.taskID,
      platform: input.platform,
      channel: input.channel,
      thread: input.thread,
      payload: input.payload,
      time_created: timeCreated,
      time_updated: timeCreated,
    })
    .run()
  return id
}

export function deleteEngineChannelBindingsForTask(db: Database.TxOrDb, taskID: string): void {
  db.delete(EngineChannelBindingTable).where(eq(EngineChannelBindingTable.task_id, taskID)).run()
}
