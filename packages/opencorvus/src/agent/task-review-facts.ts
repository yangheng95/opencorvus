import { Database, and, asc, eq, or, sql } from "@/storage/db"
import { MessageTable, PartTable } from "@/session/session.sql"
import type { TerminalLifecycleReference } from "@/engine/terminal-lifecycle-reference"
import { PanelQueryTaskOutput } from "@/panel/task-query"
import { assistantTurnFactScope } from "./artifact-read-facts"

export function reviewedTerminalLifecycleReferenceBeforePanelAction(input: {
  sessionID: string
  assistantMessageID: string
  taskID: string
}): TerminalLifecycleReference {
  const scope = assistantTurnFactScope(input.sessionID, input.assistantMessageID)
  const rows = Database.use((db) =>
    db
      .select({ id: PartTable.id, data: PartTable.data })
      .from(PartTable)
      .innerJoin(MessageTable, eq(MessageTable.id, PartTable.message_id))
      .where(
        and(
          eq(PartTable.session_id, input.sessionID),
          sql`json_extract(${MessageTable.data}, '$.parentID') = ${scope.turnParentMessageID}`,
          or(
            sql`${MessageTable.time_created} < ${scope.message.timeCreated}`,
            and(
              eq(MessageTable.time_created, scope.message.timeCreated),
              sql`${MessageTable.id} < ${scope.message.messageID}`,
            ),
          ),
          sql`json_extract(${PartTable.data}, '$.type') = 'tool'`,
          sql`json_extract(${PartTable.data}, '$.tool') = 'panel'`,
          sql`json_extract(${PartTable.data}, '$.state.status') = 'completed'`,
          sql`json_extract(${PartTable.data}, '$.state.input.action') = 'query_task'`,
        ),
      )
      .orderBy(asc(PartTable.time_created), asc(PartTable.id))
      .all(),
  )
  let reviewed: TerminalLifecycleReference | undefined
  for (const row of rows) {
    const state = (row.data as { state?: { output?: unknown } }).state
    if (typeof state?.output !== "string") {
      throw new Error(`Completed panel.query_task tool part ${row.id} has no canonical string output.`)
    }
    let decoded: unknown
    try {
      decoded = JSON.parse(state.output)
    } catch (cause) {
      throw new Error(`Completed panel.query_task tool part ${row.id} output is not JSON.`, { cause })
    }
    const output = PanelQueryTaskOutput.parse(decoded)
    const task = output.tasks.find((candidate) => candidate.taskID === input.taskID)
    if (task && "terminal_lifecycle_reference" in task && task.terminal_lifecycle_reference) {
      reviewed = task.terminal_lifecycle_reference
    }
  }
  if (!reviewed) {
    throw new Error(
      `The panel mutation requires a completed panel.query_task terminal row for Task ${input.taskID} earlier in the same Turn.`,
    )
  }
  return reviewed
}
