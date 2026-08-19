import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test"
import { applyEvent, resetWriter } from "../src/services/tree-writer"
import { cardTreeStore } from "../src/store/card-tree"

const taskID = "tsk_review_stream_projection"
const sessionID = "ses_review_stream_projection"
const reviewID = `integrity:${sessionID}`
const agentID = "system-integrity-reviewer"
const emittedAt = 1_787_115_199_871
const orderKey = `v1:${String(emittedAt).padStart(16, "0")}:${String(40).padStart(16, "0")}:${String(346).padStart(16, "0")}:protocol:pev_review_stream_projection`
const integrityCardID = `integrity:session:${sessionID}`
const originalRequestAnimationFrame = globalThis.requestAnimationFrame

beforeAll(() => {
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    callback(performance.now())
    return 1
  }) as typeof requestAnimationFrame
})

afterAll(() => {
  if (originalRequestAnimationFrame) globalThis.requestAnimationFrame = originalRequestAnimationFrame
  else Reflect.deleteProperty(globalThis, "requestAnimationFrame")
})

beforeEach(() => {
  resetWriter({ scrollIntent: "preserve", cause: "review-stream-test" })
})

/** The backend moves Task and Session identity out of every protocol payload
 * into the envelope (`task_id`/`session_id`). review.stream.* must project
 * from that shape — the wire shape the server actually emits. */
test("review.stream.started projects the integrity card from envelope identity", () => {
  applyEvent({
    event_id: "pev_review_stream_projection",
    task_id: taskID,
    session_id: sessionID,
    source: agentID,
    type: "review.stream.started",
    orderKey,
    emittedAt,
    timestamp: emittedAt,
    sequence: 346,
    summary: "review.stream.started",
    payload: { reviewID, phase: "integrity", agentID },
  })

  const card = cardTreeStore.cards[integrityCardID]
  expect(card).toBeDefined()
  expect(card?.stage).toBe("integrity")
  expect(card?.agentID).toBe(agentID)
  expect(card?.sessionID).toBe(sessionID)
  expect(card?.status).toBe("running")
})

test("review.stream.chunk appends reasoning to the integrity card", () => {
  applyEvent({
    event_id: "pev_review_stream_projection",
    task_id: taskID,
    session_id: sessionID,
    source: agentID,
    type: "review.stream.started",
    orderKey,
    emittedAt,
    timestamp: emittedAt,
    sequence: 346,
    payload: { reviewID, phase: "integrity", agentID },
  })
  applyEvent({
    event_id: "pev_review_stream_projection_chunk",
    task_id: taskID,
    session_id: sessionID,
    source: agentID,
    type: "review.stream.chunk",
    orderKey: `v1:${String(emittedAt + 1).padStart(16, "0")}:${String(40).padStart(16, "0")}:${String(347).padStart(16, "0")}:protocol:pev_review_stream_projection_chunk`,
    emittedAt: emittedAt + 1,
    timestamp: emittedAt + 1,
    sequence: 347,
    payload: { reviewID, phase: "integrity", agentID, kind: "reasoning", delta: "checking manifests", attempt: 1 },
  })

  const card = cardTreeStore.cards[integrityCardID]
  expect(card).toBeDefined()
  const reasoning = (card?.parts ?? []).filter((part: any) => part?.type === "reasoning")
  expect(reasoning.length).toBeGreaterThan(0)
  expect(reasoning.map((part: any) => String(part.text)).join("")).toContain("checking manifests")
})
