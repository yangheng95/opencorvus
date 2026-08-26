import z from "zod"
import { Bus } from "@/bus"
import { Identifier } from "@/id/id"
import type { TaskRow } from "@/engine"
import { Message } from "@/session/message"
import { MessageStore } from "@/session/message-store"
import { MessageTable, PartTable } from "@/session/session.sql"
import { Session } from "@/session"
import { Database, and, desc, eq } from "@/storage/db"
import { timelineMessageOrderKey, timelinePartOrderKey } from "@/timeline/order"

export const TaskRootMessageKind = z.enum(["operator", "orchestrator", "mission"])
export type TaskRootMessageKind = z.infer<typeof TaskRootMessageKind>

export const SchedulerDeliveryReference = z
  .object({
    eventID: Identifier.schema("protocol_event"),
    inboxID: Identifier.schema("protocol_inbox"),
    sequence: z.number().int().positive(),
    threadID: z.string().min(1),
    targetTaskExecutionEpoch: z.number().int().positive(),
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
  if (message.info.sessionID !== input.orchestratorSessionID && message.info.sessionID !== input.task.session_id) {
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
  const sourceSessionID = message.info.sessionID
  Database.immediateTransaction((db) => {
    const current = db
      .select({ data: MessageTable.data, sessionID: MessageTable.session_id })
      .from(MessageTable)
      .where(eq(MessageTable.id, input.messageID))
      .get()
    if (!current) throw new Error(`Task-root Message ${input.messageID} disappeared before delivery.`)
    const currentParts = db.select().from(PartTable).where(eq(PartTable.message_id, input.messageID)).all()
    if (current.sessionID === input.orchestratorSessionID) {
      return
    }
    if (current.sessionID !== sourceSessionID) {
      throw new Error(
        `Task-root Message ${input.messageID} moved from ${sourceSessionID} to unexpected Session ${current.sessionID}.`,
      )
    }
    const targetFrontier = db
      .select({ timeCreated: MessageTable.time_created })
      .from(MessageTable)
      .where(eq(MessageTable.session_id, input.orchestratorSessionID))
      .orderBy(desc(MessageTable.time_created), desc(MessageTable.id))
      .get()
    const visibleAt = Math.max(Date.now(), (targetFrontier?.timeCreated ?? 0) + 1)
    const nextData = {
      ...current.data,
      time: { ...current.data.time, created: visibleAt },
      orderKey: timelineMessageOrderKey({ info: { id: input.messageID, time: { created: visibleAt } } }),
    }
    const deliveredInfo = Message.VisibleInfo.parse({
      ...nextData,
      id: input.messageID,
      sessionID: input.orchestratorSessionID,
    })
    const deliveredParts = currentParts.map((row) =>
      Message.VisiblePart.parse({
        ...row.data,
        id: row.id,
        messageID: row.message_id,
        sessionID: input.orchestratorSessionID,
        orderKey: timelinePartOrderKey({ id: row.id, timeCreated: visibleAt }),
      }),
    )
    db.update(MessageTable)
      .set({
        session_id: input.orchestratorSessionID,
        time_created: visibleAt,
        time_updated: visibleAt,
        data: nextData,
      })
      .where(and(eq(MessageTable.id, input.messageID), eq(MessageTable.session_id, sourceSessionID)))
      .run()
    db.update(PartTable)
      .set({ time_created: visibleAt, time_updated: visibleAt })
      .where(eq(PartTable.message_id, input.messageID))
      .run()
    Bus.publishOwnedInTransaction(Message.Event.Moved, {
      sourceSessionID,
      info: deliveredInfo,
      parts: deliveredParts,
    })
  })
}
