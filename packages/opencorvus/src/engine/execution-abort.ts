import { Session } from "@/session"
import { assertSessionPromptSubtreeFinished, requestSessionPromptSubtreeCancellation } from "./cancellation-scope"
import type { ExecutionCancellationOrigin } from "@/session/prompt/cancellation"
import type { Database } from "@/storage/db"

export type AbortChildExecutionResult = {
  cancelled: boolean
  promptCancelled: boolean
}

export async function abortChildExecutionForSession(input: {
  taskID: string
  sessionID: string
  origin: Omit<ExecutionCancellationOrigin, "targetSessionID">
  promptSettleInactivityMs?: number
  admission?: (db: Database.TxOrDb) => void
}): Promise<AbortChildExecutionResult> {
  const result = emptyResult()
  const session = await Session.get(input.sessionID)
  const promptCancellation = await requestSessionPromptSubtreeCancellation({
    sessionID: input.sessionID,
    projectID: session.projectID,
    taskID: input.taskID,
    origin: input.origin,
    admission: input.admission,
  })
  result.promptCancelled = promptCancellation.cancelledSessions.length > 0

  await assertSessionPromptSubtreeFinished({
    sessions: promptCancellation.cancelledSessions,
    failures: promptCancellation.failures,
    taskID: input.taskID,
    inactivityTimeoutMs: input.promptSettleInactivityMs,
  })
  result.cancelled = result.promptCancelled
  return result
}

function emptyResult(): AbortChildExecutionResult {
  return {
    cancelled: false,
    promptCancelled: false,
  }
}
