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
          settleBeforeReuse: true,
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
  const sessions = listTaskConversationAgentSessions(input.task.id).flatMap((session) => {
    if (!isAgentInvocationSession(session) || session.latestStatus?.type === "terminal") return []
    const lifecycle = ProtocolStore.latestSessionEvent(session.sessionID, SessionStatus.Event.Status.type)
    const lifecycleInputMessageID =
      typeof lifecycle?.payload?.inputMessageID === "string" ? lifecycle.payload.inputMessageID : undefined
    const descriptorInputMessageID = WorkerTurnDescriptor.latestForSession(session.sessionID)?.payload.messageAuthority
      .user_message_id
    if (
      descriptorInputMessageID &&
      lifecycleInputMessageID &&
      descriptorInputMessageID !== lifecycleInputMessageID
    ) {
      throw new Error(
        `Task ${input.task.id} execution ${session.sessionID} lifecycle input ${lifecycleInputMessageID} conflicts with Worker Turn Descriptor input ${descriptorInputMessageID}`,
      )
    }
    const inputMessageID = descriptorInputMessageID ?? lifecycleInputMessageID
    if (!inputMessageID) return []
    return [{ session, inputMessageID }]
  })
  for (const row of sessions) {
    const session = await Session.getInProject({
      sessionID: row.session.sessionID,
      projectID: input.task.project_id,
    })
    await publishSettledSessionTerminalStatus({
      session,
      taskID: input.task.id,
      inputMessageID: row.inputMessageID,
      status: {
        type: "terminal",
        reason: "aborted",
        error: input.reason,
      },
    })
  }
  return sessions.map((row) => row.session.sessionID)
}
