import { expect, test } from "bun:test"
import {
  createExecutionCancellationOrigin,
  ExecutionCancellationError,
  isExecutionCancellationError,
} from "@/session/prompt/cancellation"

test("recognizes an exact cancellation protocol value after a module-realm clone", () => {
  const error = new ExecutionCancellationError({
    source: "session_prompt",
    message: "Cancel the exact root wake owner",
    sessionID: "ses_structural_cancellation",
    origin: createExecutionCancellationOrigin({
      actor: "orchestrator",
      source: "orchestrator.abort_cascade",
      surface: "orchestrator",
      requestID: "req_structural_cancellation",
      reason: "The root wake owner was cancelled",
      targetSessionID: "ses_structural_cancellation",
      taskID: "tsk_structural_cancellation",
      wakeID: "art_structural_cancellation",
    }),
  })
  const cloned = structuredClone({
    name: error.name,
    message: error.message,
    source: error.source,
    sessionID: error.sessionID,
    origin: error.origin,
  })

  expect(isExecutionCancellationError(cloned)).toBe(true)
  if (!isExecutionCancellationError(cloned)) throw new Error("expected a typed cancellation protocol value")
  expect(cloned).toMatchObject({
    source: "session_prompt",
    sessionID: "ses_structural_cancellation",
    origin: {
      actor: "orchestrator",
      source: "orchestrator.abort_cascade",
      wakeID: "art_structural_cancellation",
    },
  })
})
