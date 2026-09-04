import { expect, test } from "bun:test"
import {
  createExecutionCancellationOrigin,
  ExecutionCancellationError,
  isExecutionCancellationError,
} from "@/session/prompt/cancellation"
import { TaskCancellationOrigin } from "@/engine/cancellation-origin"
import { SessionWake } from "@/session/wake"

test("classifies typed runtime shutdown cancellation as an expected wake settlement", () => {
  const cancellation = new ExecutionCancellationError({
    source: "session_prompt",
    message: "Runtime settlement cancelled the exact wake owner",
    sessionID: "ses_runtime_shutdown",
    origin: createExecutionCancellationOrigin({
      actor: "runtime",
      source: "process.shutdown",
      surface: "session-wake-loop",
      reason: "runtime settlement",
      targetSessionID: "ses_runtime_shutdown",
    }),
  })

  expect(SessionWake.loopFailureDisposition(cancellation, undefined)).toBe("cancelled")
  expect(SessionWake.loopFailureDisposition(new Error("provider failed"), undefined)).toBe("failed")
})

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

test("records historical Mission child cancellation as runtime reconciliation provenance", () => {
  expect(
    TaskCancellationOrigin.parse({
      actor: "mission",
      source: "mission.abort",
      surface: "runtime",
      requestID: "req_historical_mission_close",
      reason: "Resume historical Mission close event evt_historical_mission_close",
      sessionID: "ses_historical_mission_close",
      missionID: "mission-historical-close",
    }),
  ).toEqual({
    actor: "mission",
    source: "mission.abort",
    surface: "runtime",
    requestID: "req_historical_mission_close",
    reason: "Resume historical Mission close event evt_historical_mission_close",
    sessionID: "ses_historical_mission_close",
    missionID: "mission-historical-close",
  })
})
