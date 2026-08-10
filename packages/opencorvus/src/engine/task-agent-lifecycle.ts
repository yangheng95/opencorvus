import { Session } from "@/session"
import { publishSettledSessionTerminalStatus } from "@/session/status-publication"
import { isAgentInvocationSession, listTaskConversationAgentSessions } from "@/orchestrator/task-event"
import type { TaskRow } from "./store"
import { cancelSessionPromptInScope, type TaskAgentPromptSession } from "./cancellation-scope"
import type { ExecutionCancellationOrigin } from "@/session/prompt/cancellation"
import { ProtocolStore } from "@/protocol/store"
import { SessionStatus } from "@/session/status"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"

export type TaskAgentLifecycleReport = {
  taskID: string
  sessionIDs: string[]
  cancelledSessions: TaskAgentPromptSession[]
  cancellationFailures: unknown[]
}

export async function collectTaskAgentLifecycleHandles(task: TaskRow, signal?: AbortSignal): Promise<{
  taskID: string
  sessionIDs: string[]
  promptSessions: TaskAgentPromptSession[]
}> {
  const rootSessionIDs = new Set<string>()
  if (task.session_id) rootSessionIDs.add(task.session_id)

  const sessionIDs = new Set<string>()
  for (const sessionID of rootSessionIDs) {
    signal?.throwIfAborted()
    const tree = await Session.treeInProject({ sessionID, projectID: task.project_id })
    signal?.throwIfAborted()
    for (const id of tree) sessionIDs.add(id)
  }

  const promptSessions = await Promise.all(
    [...sessionIDs].map(async (sessionID) => {
      signal?.throwIfAborted()
      const session = await Session.getInProject({ sessionID, projectID: task.project_id })
      signal?.throwIfAborted()
      return session
    }),
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
  signal?: AbortSignal
}): Promise<TaskAgentLifecycleReport> {
  const handles = await collectTaskAgentLifecycleHandles(input.task, input.signal)
  const cancelledSessions: TaskAgentPromptSession[] = []
  const cancellationFailures: unknown[] = []

  for (const session of handles.promptSessions.slice().reverse()) {
    input.signal?.throwIfAborted()
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
      input.signal?.throwIfAborted()
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
  signal?: AbortSignal
}): Promise<string[]> {
  input.signal?.throwIfAborted()
  const sessions = listTaskConversationAgentSessions(input.task.id).flatMap((session) => {
    if (!isAgentInvocationSession(session)) return []
    const descriptorInputMessageID = WorkerTurnDescriptor.latestForSession(session.sessionID)?.payload.messageAuthority
      .user_message_id
    const sessionLifecycle = descriptorInputMessageID
      ? ProtocolStore.latestSessionOccurrenceEvent(
          session.sessionID,
          SessionStatus.Event.Status.type,
          descriptorInputMessageID,
        )
      : ProtocolStore.latestSessionEvent(session.sessionID, SessionStatus.Event.Status.type)
    if ((sessionLifecycle?.payload?.status as SessionStatus.Info | undefined)?.type === "terminal") return []
    const lifecycleInputMessageID =
      typeof sessionLifecycle?.payload?.inputMessageID === "string"
        ? sessionLifecycle.payload.inputMessageID
        : undefined
    const inputMessageID = descriptorInputMessageID ?? lifecycleInputMessageID
    if (!inputMessageID) return []
    return [{ session, inputMessageID }]
  })
  for (const row of sessions) {
    input.signal?.throwIfAborted()
    const session = await Session.getInProject({
      sessionID: row.session.sessionID,
      projectID: input.task.project_id,
    })
    input.signal?.throwIfAborted()
    await publishSettledSessionTerminalStatus({
      session,
      taskID: input.task.id,
      inputMessageID: row.inputMessageID,
      status: {
        type: "terminal",
        reason: "aborted",
        error: input.reason,
      },
      signal: input.signal,
    })
  }
  return sessions.map((row) => row.session.sessionID)
}
