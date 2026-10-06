import { expect, test } from "bun:test"
import { createLLMStreamObservation, llmStreamEventType } from "../src/util/llm-stream-observation"

test("received SDK deltas and actual heartbeat decisions retain distinct scalar facts", () => {
  let clock = 10
  const observation = createLLMStreamObservation({ now: () => clock++ })
  observation.start()
  observation.received({ type: "text-delta", text: " A😀 \n" })
  expect(observation.phase).toBe("hook")
  observation.hookFinished()
  expect(observation.phase).toBe("handler")
  observation.decision(true, true, { type: "text-delta" })
  observation.heartbeat("text-delta", { type: "text-delta" })
  observation.chunkFinished()
  expect(observation.snapshot()).toMatchObject({
    phase: "awaiting_event",
    received: 1,
    finished: 1,
    handlerAccepted: 1,
    heartbeatEligible: 1,
    heartbeats: 1,
    deltaUTF16Length: 6,
    deltaNonWhitespaceLength: 3,
    startedAt: 10,
    lastReceivedAt: 11,
    lastHeartbeatAt: 14,
    acceptedTypes: { "text-delta": 1 },
    eligibleTypes: { "text-delta": 1 },
    heartbeatTypes: { "text-delta": 1 },
  })
})

test("whitespace, unsupported SDK events and fixed rejection reasons have explicit counts", () => {
  const observation = createLLMStreamObservation({ now: () => 20 })
  observation.start()
  observation.received({ type: "tool-input-delta", inputTextDelta: " \t\n" })
  observation.hookFinished()
  observation.reject("empty_delta")
  observation.decision(false, false)
  observation.chunkFinished()
  observation.received({ type: "future-sdk-type" })
  observation.reject("unsupported")
  observation.decision(false, false)
  observation.chunkFinished()
  expect(observation.snapshot()).toMatchObject({
    received: 2,
    finished: 2,
    deltaUTF16Length: 3,
    deltaNonWhitespaceLength: 0,
    handlerAccepted: 0,
    heartbeats: 0,
    types: { "tool-input-delta": 1, unknown: 1 },
    reasons: { empty_delta: 1, unsupported: 1 },
  })
})

test("hook and handler failures and abort remain visible after chunk completion", () => {
  for (const stage of ["hook", "handler", "abort"] as const) {
    const observation = createLLMStreamObservation({ now: () => 30 })
    observation.start()
    observation.received({ type: "tool-call" })
    observation.failed(stage)
    observation.chunkFinished()
    expect(observation.snapshot()).toMatchObject({
      phase: stage === "abort" ? "aborted" : `failed_${stage}`,
      finished: 1,
      lastFailureAt: 30,
      failures: { [stage]: 1 },
    })
  }
})

test("snapshot copies and throwing clocks preserve current producer-independent counts", () => {
  const observation = createLLMStreamObservation({
    now: () => {
      throw new Error("clock failed")
    },
  })
  observation.start()
  observation.received({ type: "reasoning-delta", text: "value" })
  observation.hookFinished()
  observation.decision(true, true)
  observation.heartbeat("reasoning-delta")
  observation.chunkFinished()
  const copy = observation.snapshot()
  copy.types["reasoning-delta"] = 999
  copy.reasons.control = 999
  copy.acceptedTypes.unknown = 999
  expect(observation.snapshot()).toMatchObject({
    phase: "awaiting_event",
    received: 1,
    finished: 1,
    handlerAccepted: 1,
    heartbeats: 1,
    bookkeepingFailures: 6,
    startedAt: null,
    types: { "reasoning-delta": 1 },
    reasons: { control: 0 },
    acceptedTypes: { unknown: 1 },
    eligibleTypes: { unknown: 1 },
    heartbeatTypes: { unknown: 1 },
  })
  expect([
    llmStreamEventType({ type: "tool-result" }),
    llmStreamEventType({ type: "future-sdk" }),
    llmStreamEventType({
      get type() {
        throw new Error("producer getter")
      },
    }),
  ]).toEqual(["tool-result", "unknown", "unknown"])
})
