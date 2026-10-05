import { Database as NativeDatabase } from "bun:sqlite"
import { queryAllFinalized } from "../../src/storage/sqlite-statement"

export interface ExistingDatabaseSelection {
  projects: Array<{ id: string }>
  cases: Array<{
    automationID: string
    label: string
    fire: { id: string }
    run: { id: string }
    session: { id: string }
  }>
}

/** Read the exact selected real-run facts; opening/validation belongs to Database.Client in the checker. */
export function readExistingDatabaseFacts(databasePath: string, selected: ExistingDatabaseSelection) {
  const native = new NativeDatabase(databasePath, { readonly: true })
  try {
    const rows = <T extends Record<string, any> = Record<string, any>>(statement: string) =>
      queryAllFinalized<T>(native, statement)
    const definitions = rows("SELECT * FROM automation ORDER BY revision")
    const targets = rows("SELECT * FROM automation_project_target ORDER BY position")
    const fires = rows("SELECT * FROM automation_fire")
    const runs = rows("SELECT * FROM automation_run")
    const receipts = rows("SELECT * FROM automation_run_receipt ORDER BY time_created,id")
    const sessions = rows("SELECT id,project_id,directory,kind FROM session")
    const messages = rows("SELECT id,session_id,data FROM message ORDER BY time_created,id")
    const parts = rows("SELECT id,message_id,data FROM part ORDER BY time_created,id")
    const tools = rows(
      "SELECT r.id,r.data request,o.data outcome,m.session_id FROM tool_part_request r JOIN message m ON m.id=r.message_id JOIN tool_part_outcome o ON o.request_part_id=r.id ORDER BY r.time_created,r.id",
    )
    const projectIDs = new Set(selected.projects.map((project) => project.id))
    return {
      projects: rows("SELECT id,worktree,generation FROM project ORDER BY id").filter((project) =>
        projectIDs.has(project.id),
      ),
      cases: selected.cases.map((item) => {
        const selectedMessages = messages.filter((message) => message.session_id === item.session.id)
        const messageIDs = new Set(selectedMessages.map((message) => message.id))
        return {
          label: item.label,
          automationID: item.automationID,
          definitions: definitions
            .filter((row) => row.definition_id === item.automationID)
            .map((row): Record<string, any> & { projectTargets: Record<string, any>[] } => ({
              ...row,
              projectTargets: targets.filter((target) => target.automation_revision_id === row.id),
            })),
          fire: fires.find((fire) => fire.id === item.fire.id),
          run: runs.find((run) => run.id === item.run.id),
          runReceipts: receipts.filter((receipt) => receipt.run_id === item.run.id),
          session: sessions.find((session) => session.id === item.session.id),
          messages: selectedMessages.map((message) => ({ ...message, data: JSON.parse(message.data) })),
          parts: parts
            .filter((part) => messageIDs.has(part.message_id))
            .map((part) => ({ ...part, data: JSON.parse(part.data) })),
          toolParts: tools
            .filter((tool) => tool.session_id === item.session.id)
            .map(({ id, request, outcome }) => ({ id, request: JSON.parse(request), outcome: JSON.parse(outcome) })),
        }
      }),
      schema: rows("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type,name"),
      quickCheck: rows("PRAGMA quick_check"),
      journalMode: rows("PRAGMA journal_mode"),
    }
  } finally {
    native.close(true)
  }
}
