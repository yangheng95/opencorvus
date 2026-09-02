import { recordDispatchLineage } from "../../src/engine/dispatch-lineage"
import { joinProcessLivenessLease } from "../../src/engine/process-liveness"
import { currentRuntimeOccurrenceID } from "../../src/runtime/process-occurrence"
import {
  EngineControlActivationLeaseTable,
  EngineTaskRootIngressTable,
} from "../../src/engine/engine.sql"
import { MessageTable, ToolPartRequestTable } from "../../src/session/session.sql"
import { Database, and, desc, eq, sql } from "../../src/storage/db"
import { Identifier } from "../../src/id/id"

export function materializeTestDispatchCreatorOccurrence(
  input: Parameters<typeof recordDispatchLineage>[0],
): void {
  Database.immediateTransaction((db) => {
    const existing = db
      .select({ id: ToolPartRequestTable.id })
      .from(ToolPartRequestTable)
      .where(eq(ToolPartRequestTable.id, input.origin.toolPartID))
      .get()
    if (existing) return
    const ingress = db
      .select()
      .from(EngineTaskRootIngressTable)
      .where(eq(EngineTaskRootIngressTable.task_id, input.origin.taskID))
      .orderBy(desc(EngineTaskRootIngressTable.execution_epoch), desc(EngineTaskRootIngressTable.sequence))
      .get()
    if (!ingress) throw new Error(`Test dispatch ${input.origin.dispatchID} requires a Task-root creator ingress`)
    const now = input.now ?? Date.now()
    const existingMessage = db
      .select({ id: MessageTable.id })
      .from(MessageTable)
      .where(eq(MessageTable.id, input.origin.orchestratorMessageID))
      .get()
    let createdAssistantData: typeof MessageTable.$inferInsert.data | undefined
    if (!existingMessage) {
      const activationID = Identifier.ascending("artifact")
      db.insert(EngineControlActivationLeaseTable)
        .values({
          id: activationID,
          target: "task_root_ingress",
          target_id: ingress.id,
          owner_occurrence_id: currentRuntimeOccurrenceID(),
          time_activated: now,
          expires_at: now + 60_000,
        })
        .run()
      db.insert(MessageTable)
        .values({
          id: input.origin.orchestratorMessageID,
          session_id: input.origin.orchestratorSessionID,
          time_created: now,
          data: (createdAssistantData = {
            parentID: Identifier.ascending("message"),
            role: "assistant",
            author: "orchestrator",
            time: { created: now },
            agent: "orchestrator",
            providerID: "test",
            modelID: "test-model",
            path: { cwd: "test", root: "test" },
            cost: 0,
            tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
            activationID,
          }),
        })
        .run()
    }
    db.insert(ToolPartRequestTable)
      .values({
        id: input.origin.toolPartID,
        message_id: input.origin.orchestratorMessageID,
        data: {
          type: "tool-request",
          callID: input.origin.toolCallID,
          tool: input.origin.toolName ?? "dispatch_agent",
          input: {},
          time: { start: now },
        },
        time_created: now,
      })
      .run()
    if (createdAssistantData) {
      db.update(MessageTable)
        .set({
          data: {
            ...createdAssistantData,
            time: { created: now, completed: now },
            finish: "stop",
          },
        })
        .where(eq(MessageTable.id, input.origin.orchestratorMessageID))
        .run()
    }
    const linked = db
      .select({ id: ToolPartRequestTable.id })
      .from(ToolPartRequestTable)
      .innerJoin(MessageTable, eq(MessageTable.id, ToolPartRequestTable.message_id))
      .where(
        and(
          eq(ToolPartRequestTable.id, input.origin.toolPartID),
          sql`json_extract(${MessageTable.data}, '$.activationID') IS NOT NULL`,
        ),
      )
      .get()
    if (!linked) throw new Error(`Test dispatch ${input.origin.dispatchID} creator occurrence did not materialize`)
  })
}

/** Direct engine fixtures do not enter the production Task-control driver.
 * Give their exact lineage commit the same process fence for the duration of
 * its writer transaction, then expire that fixture owner. */
export function recordTestDispatchLineage(
  input: Parameters<typeof recordDispatchLineage>[0],
  options: { joinLiveness?: boolean } = {},
) {
  const liveness = options.joinLiveness === false ? undefined : joinProcessLivenessLease(currentRuntimeOccurrenceID())
  try {
    materializeTestDispatchCreatorOccurrence(input)
    return recordDispatchLineage(input)
  } finally {
    liveness?.release()
  }
}
