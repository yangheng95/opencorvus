import { abortChildExecutionForSession } from "@/engine/execution-abort"
import { createExecutionCancellationOrigin } from "@/session/prompt/cancellation"
import { assertActiveAgentCoordinationActionInTransaction } from "@/engine/agent-coordination"

export async function cancelDispatchedSession(input: {
  taskID: string
  sessionID: string
  reason: string
  reasonPrefix: string
  requestID: string
  coordinationAction?: { actionID: string; executionEpoch: number }
}) {
  const cancelReason = `${input.reasonPrefix}: ${input.reason}`
  const physical = await abortChildExecutionForSession({
    taskID: input.taskID,
    sessionID: input.sessionID,
    origin: createExecutionCancellationOrigin({
      actor: "orchestrator",
      source: "engine.child_execution_abort",
      surface: "orchestrator",
      requestID: input.requestID,
      reason: cancelReason,
      targetSessionID: input.sessionID,
      taskID: input.taskID,
    }),
    ...(input.coordinationAction
      ? {
          admission: (db) =>
            assertActiveAgentCoordinationActionInTransaction(db, {
              taskID: input.taskID,
              actionID: input.coordinationAction!.actionID,
              executionEpoch: input.coordinationAction!.executionEpoch,
              action: "cancel_worker",
            }),
        }
      : {}),
  })
  return {
    ...physical,
    summary: physical.promptCancelled
      ? " prompt cancellation requested and settled."
      : " no current physical prompt resource was available to cancel.",
  }
}
