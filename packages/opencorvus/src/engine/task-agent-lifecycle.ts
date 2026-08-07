import { Session } from "@/session"
import { publishSettledSessionTerminalStatus } from "@/session/status-publication"
import { isAgentInvocationSession, listTaskConversationAgentSessions } from "@/orchestrator/task-event"
import type { TaskRow } from "./store"
import { cancelSessionPromptInScope, type TaskAgentPromptSession } from "./cancellation-scope"
import type { ExecutionCancellationOrigin } from "@/session/prompt/cancellation"
import { ProtocolStore } from "@/protocol/store"
import { SessionStatus } from "@/session/status"

export type TaskAgentLifecycleReport = {
  taskID: string
  sessionIDs: string[]
  cancelledSessions: TaskAgentPromptSession[]
  cancellationFailures: unknown[]
}

export async function collectTaskAgentLifecycleHandles(task: TaskRow): Promise<{
  taskID: string
  sessionIDs: string[]
  promptSessions: TaskAgentPromptSession[]
}> {
  const rootSessionIDs = new Set<string>()
  if (task.session_id) rootSessionIDs.add(task.session_id)

  const sessionIDs = new Set<string>()
  for (const sessionID of rootSessionIDs) {
    const tree = await Session.treeInProject({ sessionID, projectID: task.project_id })
    for (const id of tree) sessionIDs.add(id)
  }

  const promptSessions = await Promise.all(
    [...sessionIDs].map((sessionID) => Session.getInProject({ sessionID, projectID: task.project_id })),
  )

  return {
    taskID: task.id,
    sessionIDs: [...sessionIDs],
    promptSessions: promptSessions.map((session) => ({ id: session.id, directory: session.directory })),
  }
}

export async function requestTaskAgentLifecycleCancellation(input: {
  task: TaskRow
  reason: string
  handle?: string
  origin: Omit<ExecutionCancellationOrigin, "targetSessionID">
}): Promise<TaskAgentLifecycleReport> {
  const handles = await collectTaskAgentLifecycleHandles(input.task)
  const cancelledSessions: TaskAgentPromptSession[] = []
  const cancellationFailures: unknown[] = []

  for (const session of handles.promptSessions.slice().reverse()) {
    try {
      if (
        cancelSessionPromptInScope({
          session,
          taskID: input.task.id,
          handle: input.handle ?? "task-agent-lifecycle.cancel",
          origin: { ...input.origin, targetSessionID: session.id },
        })
      ) {
        cancelledSessions.push(session)
      }
    } catch (error) {
      cancellationFailures.push(error)
    }
  }

  return {
    taskID: handles.taskID,
    sessionIDs: handles.sessionIDs,
    cancelledSessions,
    cancellationFailures,
  }
}

/**
 * Converge durable Agent lifecycle evidence only after physical prompt and
 * queue ownership settlement has succeeded. Persisted streaming/retry is
 * historical evidence, never a liveness source.
 */
export async function publishTaskAgentCancellationStatusesAfterSettlement(input: {
  task: TaskRow
  reason: string
}): Promise<string[]> {
  const sessions = listTaskConversationAgentSessions(input.task.id).filter(
    (session) =>
      isAgentInvocationSession(session) &&
      session.latestStatus !== undefined &&
      session.latestStatus.type !== "terminal",
  )
  for (const row of sessions) {
    const lifecycle = ProtocolStore.latestSessionEvent(row.sessionID, SessionStatus.Event.Status.type)
    const inputMessageID = lifecycle?.payload?.inputMessageID
    if (typeof inputMessageID !== "string" || inputMessageID.length === 0) {
      throw new Error(`Task ${input.task.id} execution ${row.sessionID} has no input message identity`)
    }
    const session = await Session.getInProject({
      sessionID: row.sessionID,
      projectID: input.task.project_id,
    })
    await publishSettledSessionTerminalStatus({
      session,
      taskID: input.task.id,
      inputMessageID,
      status: {
        type: "terminal",
        reason: "aborted",
        error: input.reason,
      },
    })
  }
  return sessions.map((session) => session.sessionID)
}
