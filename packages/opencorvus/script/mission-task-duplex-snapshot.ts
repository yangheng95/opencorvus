import { EngineTaskTable } from "@/engine/engine.sql"
import { projectTaskRowsInTransaction } from "@/engine/store"
import { projectProtocolDeliveryInTransaction } from "@/protocol/delivery-projection"
import { ProtocolInboxTable } from "@/protocol/protocol.sql"
import type { Database } from "@/storage/db"

export function projectMissionTaskDuplexControlStateInTransaction(
  db: Database.TxOrDb,
  input: {
    tasks: readonly (typeof EngineTaskTable.$inferSelect)[]
    inboxes: readonly (typeof ProtocolInboxTable.$inferSelect)[]
  },
  now = Date.now(),
) {
  return {
    tasks: projectTaskRowsInTransaction(db, input.tasks),
    inboxes: input.inboxes.map((row) => projectProtocolDeliveryInTransaction(db, row, now)),
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
