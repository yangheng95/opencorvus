import type { ApiAuthority } from "./api"
import { setConversationSessionArchived } from "./conversation-session"
import { setMissionArchived } from "./mission"
import { setTaskArchived } from "./task"
import type { WorkLedgerItemRow } from "./work-ledger"

export async function restoreArchivedWork(row: WorkLedgerItemRow, authority: ApiAuthority): Promise<void> {
  const target = { directory: row.directory, authority }
  if (row.kind === "task") {
    await setTaskArchived({ ...target, taskID: row.id }, false)
  } else if (row.kind === "mission") {
    await setMissionArchived({ ...target, missionID: row.missionID, sessionID: row.sessionID }, false)
  } else {
    await setConversationSessionArchived({ ...target, sessionID: row.sessionID, experience: row.experience }, false)
  }
}
