import z from "zod"
import { Identifier } from "@/id/id"
import type { TaskRow } from "@/engine"
import { MessageStore } from "@/session/message-store"
import { MessageTable, PartTable } from "@/session/session.sql"
import { Session } from "@/session"
import { Database, eq } from "@/storage/db"

export const TaskRootMessageKind = z.enum(["operator", "orchestrator", "mission"])
export type TaskRootMessageKind = z.infer<typeof TaskRootMessageKind>

export const SchedulerDeliveryReference = z
  .object({
    eventID: Identifier.schema("protocol_event"),
    inboxID: Identifier.schema("protocol_inbox"),
    sequence: z.number().int().positive(),
    threadID: z.string().min(1),
    replyTo: Identifier.schema("protocol_event").optional(),
  })
  .strict()
export type SchedulerDeliveryReference = z.infer<typeof SchedulerDeliveryReference>

export const TaskRootMessageProvenance = z
  .object({
    protocol: z.literal("task-root-message"),
    taskID: Identifier.schema("task"),
    kind: TaskRootMessageKind,
    source: z.string().min(1),
    schedulerDelivery: SchedulerDeliveryReference.optional(),
  })
  .strict()

export type TaskRootMessageProvenance = z.infer<typeof TaskRootMessageProvenance>

export async function getTaskRootMessage(task: Pick<TaskRow, "id" | "session_id" | "project_id">, messageID: string) {
  if (!task.session_id) throw new Error(`Task ${task.id} has no root Session.`)
  const messageSessionID = Database.use(
    (db) =>
      db.select({ sessionID: MessageTable.session_id }).from(MessageTable).where(eq(MessageTable.id, messageID)).get()
        ?.sessionID,
  )
  if (!messageSessionID) throw new Error(`Task-root Message ${messageID} does not exist.`)
  const taskSessionIDs = await Session.treeInProject({ sessionID: task.session_id, projectID: task.project_id })
  if (!taskSessionIDs.includes(messageSessionID)) {
    throw new Error(`Task-root Message ${messageID} is outside Task ${task.id} Session lineage.`)
  }
  return MessageStore.get({ sessionID: messageSessionID, messageID })
}

/**
 * Deliver one already-persisted Task-root participant Message into the Task's
 * Orchestrator conversation without copying its body or creating a synthetic
 * second Message. The stable Message/Part identities remain the protocol
 * receipt; only their containing Task-owned Session changes.
 */
export async function deliverTaskRootMessageToOrchestratorSession(input: {
  task: Pick<TaskRow, "id" | "session_id" | "project_id">
  messageID: string
  orchestratorSessionID: string
}): Promise<void> {
  const message = await getTaskRootMessage(input.task, input.messageID)
  if (message.info.sessionID === input.orchestratorSessionID) return
  if (message.info.sessionID !== input.task.session_id) {
    throw new Error(
      `Task-root Message ${input.messageID} is already bound to unexpected Session ${message.info.sessionID}.`,
    )
  }
  const taskSessionIDs = await Session.treeInProject({
    sessionID: input.task.session_id!,
    projectID: input.task.project_id,
  })
  if (!taskSessionIDs.includes(input.orchestratorSessionID)) {
    throw new Error(`Orchestrator Session ${input.orchestratorSessionID} is outside Task ${input.task.id} lineage.`)
  }
  Database.transaction((db) => {
    db.update(MessageTable)
      .set({ session_id: input.orchestratorSessionID, time_updated: Date.now() })
      .where(eq(MessageTable.id, input.messageID))
      .run()
    db.update(PartTable)
      .set({ session_id: input.orchestratorSessionID, time_updated: Date.now() })
      .where(eq(PartTable.message_id, input.messageID))
      .run()
  })
}
