import { taskIDForSession } from "./task-session-lineage"
import { Database, and, eq } from "@/storage/db"
import { Message } from "@/session/message"
import { MessageTable, ToolPartRequestTable, SessionTable, type SessionKind } from "@/session/session.sql"
import { projectToolPartInTransaction } from "@/session/tool-part-facts"

type TaskAssistantProducerMessageInput = {
  taskID: string
  sessionID: string
  messageID: string
  expectedSessionKind?: SessionKind
  requireCompleted?: boolean
}

/**
 * Assert the immutable producer identity shared by append-only domain facts.
 *
 * This is a data-integrity boundary: it proves that the referenced assistant
 * message exists in the exact Session and Task. It does not decide scheduling,
 * completion, or which domain fact should be selected.
 */
export function assertTaskAssistantProducerMessage(input: TaskAssistantProducerMessageInput): Message.Assistant {
  if (taskIDForSession(input.sessionID) !== input.taskID) {
    throw new Error(`Producer session ${input.sessionID} does not belong to Task ${input.taskID}.`)
  }
  const session = Database.use((db) =>
    db.select({ kind: SessionTable.kind }).from(SessionTable).where(eq(SessionTable.id, input.sessionID)).get(),
  )
  if (!session) {
    throw new Error(`Producer session ${input.sessionID} does not exist.`)
  }
  if (input.expectedSessionKind && session.kind !== input.expectedSessionKind) {
    throw new Error(
      `Producer session ${input.sessionID} has kind=${session.kind}, expected ${input.expectedSessionKind}.`,
    )
  }
  const row = Database.use((db) =>
    db
      .select({ sessionID: MessageTable.session_id, data: MessageTable.data })
      .from(MessageTable)
      .where(and(eq(MessageTable.id, input.messageID), eq(MessageTable.session_id, input.sessionID)))
      .get(),
  )
  if (!row) {
    throw new Error(`Producer assistant message ${input.messageID} does not exist in Session ${input.sessionID}.`)
  }
  const message = Message.Assistant.safeParse({
    ...row.data,
    id: input.messageID,
    sessionID: row.sessionID,
  })
  if (!message.success) {
    throw new Error(
      `Producer message ${input.messageID} in Session ${input.sessionID} is not a valid assistant message.`,
    )
  }
  if (input.requireCompleted && message.data.time.completed === undefined) {
    throw new Error(`Producer assistant message ${input.messageID} in Session ${input.sessionID} is not completed.`)
  }
  return message.data
}

export function assertTaskAssistantProducerToolPart(
  input: TaskAssistantProducerMessageInput & {
    toolPartID: string
    toolCallID: string
    visibleToolName: string
  },
): void {
  assertTaskAssistantProducerMessage(input)
  const row = Database.use((db) => {
    const persisted = db
      .select()
      .from(ToolPartRequestTable)
      .where(and(eq(ToolPartRequestTable.id, input.toolPartID), eq(ToolPartRequestTable.message_id, input.messageID)))
      .get()
    return persisted ? projectToolPartInTransaction(db, persisted) : undefined
  })
  if (!row) {
    throw new Error(`Producer tool part ${input.toolPartID} does not exist on assistant message ${input.messageID}.`)
  }
  const part = Message.ToolPart.safeParse(row)
  if (!part.success || part.data.callID !== input.toolCallID || part.data.tool !== input.visibleToolName) {
    throw new Error(
      `Producer tool part ${input.toolPartID} does not match tool=${input.visibleToolName} callID=${input.toolCallID}.`,
    )
  }
}
