import { expect, test } from "bun:test"
import {
  createExecutionCancellationOrigin,
  ExecutionCancellationError,
  isExecutionCancellationError,
} from "@/session/prompt/cancellation"
import { TaskCancellationOrigin } from "@/engine/cancellation-origin"
import { SessionWake } from "@/session/wake"
import { projectedAdapterError } from "@/orchestrator/projected-adapter-error"

test("preserves the exact projected adapter cancellation and wraps ordinary execution errors", () => {
  const cancellation = new ExecutionCancellationError({
    source: "session_prompt",
    message: "Cancel worker",
    sessionID: "ses_projected_cancel",
    origin: createExecutionCancellationOrigin({
      actor: "user", source: "task.cancel", surface: "api", reason: "Cancel worker",
      taskID: "tsk_projected_cancel", targetSessionID: "ses_projected_cancel",
    }),
  })
  for (const adapter of ["delegated_worker", "integrity", "build"] as const) {
    expect(projectedAdapterError("worker", adapter, cancellation)).toBe(cancellation)
    const failure = new Error("Provider stream failed")
    expect(projectedAdapterError("worker", adapter, failure)).toMatchObject({
      message: `Projected agent "worker" failed via adapter "${adapter}": Provider stream failed`,
      cause: failure,
    })
  }
})

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

test("classifies the exact aborted reservation reason and preserves unrelated failures", () => {
  const controller = new AbortController()
  const reason = new Error("graceful runtime settlement")
  controller.abort(reason)

  expect(SessionWake.loopFailureDisposition(reason, controller.signal.reason)).toBe("cancelled")
  expect(SessionWake.loopFailureDisposition(new Error(reason.message), controller.signal.reason)).toBe("failed")
  expect(SessionWake.loopFailureDisposition(undefined, undefined)).toBe("failed")
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
