import { ProtocolStore } from "@/protocol/store"
import { SessionStatus } from "@/session/status"
import { Message } from "@/session/message"
import { MessageTable } from "@/session/session.sql"
import { Database, eq, asc } from "@/storage/db"
import { getMissionSessionByDirectory } from "@/mission/session"
import { missionRecord } from "@/mission/projection"

export function missionCompletionExecution(sessionID: string, inputMessageID?: string) {
  if (!inputMessageID) return {}
  const event = ProtocolStore.latestSessionOccurrenceEvent(sessionID, "agent.execution.lifecycle", inputMessageID)
  return { inputMessageID, status: event ? SessionStatus.Info.parse(event.payload?.status) : undefined }
}

export type MissionFinalReplyInput = {
  missionSessionID: string
  completionMessageID?: string
  completionParentMessageID?: string
  messages: readonly {
    id: string
    sessionID: string
    role: string
    parentMessageID?: string
    completedAtMs?: number
    finish?: string
    error?: unknown
  }[]
  execution: { inputMessageID?: string; status?: SessionStatus.Info }
}

export function missionFinalReplyState(input: MissionFinalReplyInput) {
  const replies = input.completionParentMessageID
    ? input.messages.filter(
        (message) =>
          message.sessionID === input.missionSessionID &&
          message.role === "assistant" &&
          message.parentMessageID === input.completionParentMessageID,
      )
    : []
  const completionReply = replies.find((message) => message.id === input.completionMessageID)
  const sameExecution = input.execution.inputMessageID === input.completionParentMessageID
  const failedReplyIDs = replies
    .filter((message) => message.error != null)
    .map((message) => message.id)
    .sort()
  const successfulStops =
    completionReply?.completedAtMs !== undefined
      ? replies.filter(
          (message) =>
            message.error == null &&
            message.finish === "stop" &&
            message.completedAtMs !== undefined &&
            message.completedAtMs >= completionReply.completedAtMs!,
        )
      : []
  const executionFailed =
    sameExecution &&
    input.execution.status?.type === "terminal" &&
    (input.execution.status.reason === "error" || input.execution.status.reason === "aborted")
  const executionSettled =
    sameExecution &&
    (input.execution.status?.type === "idle" ||
      (input.execution.status?.type === "terminal" && input.execution.status.reason === "completed"))
  const replyFailed = failedReplyIDs.length > 0 || executionFailed
  const replySettled = Boolean(
    completionReply &&
      successfulStops.length > 0 &&
      replies.every((message) => message.completedAtMs !== undefined) &&
      executionSettled &&
      !replyFailed,
  )
  const finalReply = {
    status: replyFailed ? ("failed" as const) : replySettled ? ("settled" as const) : ("pending" as const),
    responseMessageIDs: successfulStops.map((message) => message.id).sort(),
    completedAtMs: replySettled ? Math.max(...successfulStops.map((message) => message.completedAtMs!)) : undefined,
    failedReplyIDs,
  }
  return finalReply
}

/** Read existing authorities; this observation never completes or wakes a Mission. */
export async function observeMissionSettlement(input: { directory: string; missionID: string; sessionID: string }) {
  const session = await getMissionSessionByDirectory(input)
  if (session.id !== input.sessionID)
    throw new Error(`Mission settlement Session identity mismatch: ${input.missionID}`)
  return Database.transaction((db) => {
    const record = missionRecord(session)
    const messages = db
      .select()
      .from(MessageTable)
      .where(eq(MessageTable.session_id, session.id))
      .orderBy(asc(MessageTable.time_created), asc(MessageTable.id))
      .all()
      .map((row) => {
        const message = Message.Info.parse({ ...row.data, id: row.id, sessionID: row.session_id })
        return {
          id: message.id,
          sessionID: message.sessionID,
          role: message.role,
          ...(message.role === "assistant"
            ? {
                parentMessageID: message.parentID,
                completedAtMs: message.time.completed,
                finish: message.finish,
                error: message.error,
                acceptedInputMessageIDs: Message.acceptedInputMessageIDs(message),
              }
            : {}),
        }
      })
    const completion = messages.find((message) => message.id === record.outcome?.messageID)
    const finalReply = missionFinalReplyState({
      missionSessionID: session.id,
      completionMessageID: completion?.id,
      completionParentMessageID: completion?.parentMessageID,
      messages,
      execution: missionCompletionExecution(session.id, completion?.parentMessageID),
    })
    // A retained accepted receipt must not hide an already admitted later wake.
    const latestInput = messages.findLast((message) => message.role === "user")
    const firstLatestReply = messages.find(
      (message) =>
        message.role === "assistant" && latestInput && message.acceptedInputMessageIDs?.includes(latestInput.id),
    )
    const latestOccurrenceID = firstLatestReply?.parentMessageID ?? latestInput?.id
    const latestReply = missionFinalReplyState({
      missionSessionID: session.id,
      completionMessageID: firstLatestReply?.id,
      completionParentMessageID: latestOccurrenceID,
      messages,
      execution: missionCompletionExecution(session.id, latestOccurrenceID),
    })
    const status =
      finalReply.status === "failed" || latestReply.status === "failed"
        ? "failed"
        : record.outcome && finalReply.status === "settled" && latestReply.status === "settled" && !record.interruptible
          ? record.outcome.kind
          : "pending"
    return {
      status,
      missionID: record.missionID,
      sessionID: record.sessionID,
      outcome: record.outcome,
      interruptible: record.interruptible,
      finalReply,
      latestReply,
    }
  })
}
