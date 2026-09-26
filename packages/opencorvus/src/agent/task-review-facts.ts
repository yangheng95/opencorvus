import { Database, and, asc, eq, or, sql } from "@/storage/db"
import { MessageTable, ToolPartRequestTable as PartTable, ToolPartOutcomeTable } from "@/session/session.sql"
import type { TerminalLifecycleReference } from "@/engine/terminal-lifecycle-reference"
import { PanelQueryTaskOutput } from "@/panel/task-query"
import { assistantActionFactScope } from "./artifact-read-facts"
import { panelLeafActionSchemaForAgent } from "@/panel/capability"
import { type TaskArtifactObservation, taskArtifactObservation } from "@/engine/task-artifact-observation-schema"

const MissionPanelQueryTaskInput = panelLeafActionSchemaForAgent("query_task", "mission")

export function reviewedTaskArtifactObservationBeforePanelAction(input: {
  sessionID: string
  assistantMessageID: string
  toolPartID: string
  taskID: string
}): TaskArtifactObservation {
  const scope = assistantActionFactScope(input.sessionID, input.assistantMessageID, input.toolPartID)
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
            sql`${PartTable.time_created} < ${scope.before.timeCreated}`,
            and(eq(PartTable.time_created, scope.before.timeCreated), sql`${PartTable.id} < ${scope.before.partID}`),
          ),
          sql`json_extract(${PartTable.data}, '$.type') = 'tool-request'`,
          sql`json_extract(${PartTable.data}, '$.tool') = 'panel_query_task'`,
          sql`json_extract(${ToolPartOutcomeTable.data}, '$.outcome') = 'completed'`,
        ),
      )
      .orderBy(asc(PartTable.time_created), asc(PartTable.id))
      .all(),
  )
  let reviewed: TaskArtifactObservation | undefined
  for (const row of rows) {
    const state = {
      input: (row.request as { input?: unknown }).input,
      output: (row.outcome as { output?: unknown }).output,
    }
    const panelInput = MissionPanelQueryTaskInput.safeParse(state?.input)
    if (!panelInput.success) continue
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
      reviewed = taskArtifactObservation({ terminal_lifecycle_reference: task.terminal_lifecycle_reference })
    } else if (task && "active_execution_reference" in task && task.active_execution_reference) {
      reviewed = taskArtifactObservation({
        terminal_lifecycle_reference: null,
        active_execution_reference: task.active_execution_reference,
      })
    }
  }
  if (!reviewed) {
    throw new Error(
      `The panel action requires a completed panel.query_task occurrence row for Task ${input.taskID} earlier in the same Turn.`,
    )
  }
  return reviewed
}

export function reviewedTerminalLifecycleReferenceBeforePanelAction(input: {
  sessionID: string
  assistantMessageID: string
  toolPartID: string
  taskID: string
}): TerminalLifecycleReference {
  const observation = reviewedTaskArtifactObservationBeforePanelAction(input)
  if (!observation.terminal_lifecycle_reference) {
    throw new Error(
      `The panel mutation requires a completed panel.query_task terminal row for Task ${input.taskID} earlier in the same Turn.`,
    )
  }
  return observation.terminal_lifecycle_reference
}
