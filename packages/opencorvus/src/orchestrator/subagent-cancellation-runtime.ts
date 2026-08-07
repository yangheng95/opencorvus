import { abortChildExecutionForSession } from "@/engine/execution-abort"
import { createExecutionCancellationOrigin } from "@/session/prompt/cancellation"

export async function cancelDispatchedSession(input: {
  taskID: string
  sessionID: string
  reason: string
  reasonPrefix: string
  requestID: string
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
  })
  return {
    ...physical,
    summary: physical.promptCancelled
      ? " prompt cancellation requested and settled."
      : " no current physical prompt resource was available to cancel.",
  }
}
