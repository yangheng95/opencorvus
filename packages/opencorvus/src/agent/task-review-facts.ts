import { Database, and, asc, eq, or, sql } from "@/storage/db"
import { MessageTable, ToolPartRequestTable as PartTable, ToolPartOutcomeTable } from "@/session/session.sql"
import type { TerminalLifecycleReference } from "@/engine/terminal-lifecycle-reference"
import { PanelQueryTaskOutput } from "@/panel/task-query"
import { assistantTurnFactScope } from "./artifact-read-facts"
import { MissionPanelActionSchema } from "@/panel/capability"
import { materializeToolExecutionInput } from "@/provider/tool-execution-input"

export function reviewedTerminalLifecycleReferenceBeforePanelAction(input: {
  sessionID: string
  assistantMessageID: string
  taskID: string
}): TerminalLifecycleReference {
  const scope = assistantTurnFactScope(input.sessionID, input.assistantMessageID)
  const rows = Database.use((db) =>
    db
      .select({ id: PartTable.id, request: PartTable.data, outcome: ToolPartOutcomeTable.data })
      .from(PartTable)
      .innerJoin(ToolPartOutcomeTable, eq(ToolPartOutcomeTable.request_part_id, PartTable.id))
      .innerJoin(MessageTable, eq(MessageTable.id, PartTable.message_id))
      .where(
        and(
          eq(MessageTable.session_id, input.sessionID),
          sql`json_extract(${MessageTable.data}, '$.parentID') = ${scope.turnParentMessageID}`,
          or(
            sql`${MessageTable.time_created} < ${scope.message.timeCreated}`,
            and(
              eq(MessageTable.time_created, scope.message.timeCreated),
              sql`${MessageTable.id} < ${scope.message.messageID}`,
            ),
          ),
          sql`json_extract(${PartTable.data}, '$.type') = 'tool-request'`,
          sql`json_extract(${PartTable.data}, '$.tool') = 'panel'`,
          sql`json_extract(${ToolPartOutcomeTable.data}, '$.outcome') = 'completed'`,
        ),
      )
      .orderBy(asc(PartTable.time_created), asc(PartTable.id))
      .all(),
  )
  let reviewed: TerminalLifecycleReference | undefined
  for (const row of rows) {
    const state = {
      input: (row.request as { input?: unknown }).input,
      output: (row.outcome as { output?: unknown }).output,
    }
    const panelInput = MissionPanelActionSchema.safeParse(
      materializeToolExecutionInput(MissionPanelActionSchema, state?.input),
    )
    if (!panelInput.success || panelInput.data.action !== "query_task") continue
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
