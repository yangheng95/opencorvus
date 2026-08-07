import { requireTask } from "@/engine/store"
import { publishSettledSessionTerminalStatus } from "@/session/status-publication"
import { Session } from "@/session"
import type { SessionStatus } from "@/session/status"

/**
 * Publish the failed Turn fact for the exact worker Session whose
 * Agent-to-Agent (A2A) request caused Task failure. This status is historical
 * execution evidence and does not close the Session against a later Turn.
 */
export async function publishFailedAgentCoordinationTurnStatus(input: {
  taskID: string
  sessionID: string
  inputMessageID: string
  status: Extract<SessionStatus.Info, { type: "terminal" }>
}): Promise<Extract<SessionStatus.Info, { type: "terminal" }>> {
  const task = requireTask(input.taskID)
  const session = await Session.getInProject({
    sessionID: input.sessionID,
    projectID: task.project_id,
  })
  return publishSettledSessionTerminalStatus({
    session,
    taskID: input.taskID,
    inputMessageID: input.inputMessageID,
    status: input.status,
  })
}
