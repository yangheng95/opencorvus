import type { WorkLedgerItemRow } from "./work-ledger"

export function archiveRowKey(row: WorkLedgerItemRow): string {
  if (row.kind === "mission") return `mission:${row.missionID}:${row.directory}`
  if (row.kind === "chat") return `chat:${row.sessionID}:${row.directory}`
  return `task:${row.id}:${row.directory}`
}
