/**
 * A model that repeats one Tool call forever must be stopped with feedback.
 *
 * `DOOM_LOOP_THRESHOLD` only inspects parts of the current assistant message,
 * so it never fires for the common one-Tool-call-per-message shape. Observed
 * 2026-08-17 on Mission ses_-zUXWiACkzzlEtt8eqES: 40+ `panel read_task_artifact`
 * calls alternating two locators, each returning `complete: true,
 * next_offset: null`, one call per completed message, every ~12s for nine
 * minutes until the operator aborted. Every call succeeded, so no error
 * surfaced and nothing bounded it.
 */
import { describe, expect, test } from "bun:test"
import { SessionProcessor } from "@/session/processor"

const { observeRepeatedToolCall, forgetRepeatedToolCalls, REPEATED_CALL_ACROSS_TURNS_THRESHOLD, REPEATED_CALL_RUN_IDLE_MS } =
  SessionProcessor.RepeatedCallTestHooks

describe("repeated Tool call runs across assistant turns", () => {
  test("counts byte-identical calls that span separate assistant messages", () => {
    const sessionID = `ses_repeat_${Date.now()}`
    const input = { action: "read_task_artifact", artifact_locator_ref: "al_GIh18i81dETs6b3d", byte_offset: 0 }
    try {
      const counts = Array.from({ length: REPEATED_CALL_ACROSS_TURNS_THRESHOLD + 1 }, () =>
        observeRepeatedToolCall(sessionID, "panel", input),
      )
      expect(counts).toEqual([1, 2, 3, 4, 5, 6, 7])
      // The run has to outlive message completion, which is exactly what the
      // observed loop did; only exceeding the bound trips the guard.
      expect(counts.at(-1)! > REPEATED_CALL_ACROSS_TURNS_THRESHOLD).toBe(true)
    } finally {
      forgetRepeatedToolCalls(sessionID)
    }
  })

  test("a different call resets the run", () => {
    const sessionID = `ses_reset_${Date.now()}`
    try {
      expect(observeRepeatedToolCall(sessionID, "panel", { a: 1 })).toBe(1)
      expect(observeRepeatedToolCall(sessionID, "panel", { a: 1 })).toBe(2)
      expect(observeRepeatedToolCall(sessionID, "panel", { a: 2 })).toBe(1)
      expect(observeRepeatedToolCall(sessionID, "read", { a: 2 })).toBe(1)
      // Alternating between two inputs is not a run of identical calls, so the
      // guard stays silent — the model is still free to interleave reads.
      expect(observeRepeatedToolCall(sessionID, "panel", { a: 2 })).toBe(1)
    } finally {
      forgetRepeatedToolCalls(sessionID)
    }
  })

  test("keeps sessions independent and forgets a session on demand", () => {
    const first = `ses_a_${Date.now()}`
    const second = `ses_b_${Date.now()}`
    try {
      expect(observeRepeatedToolCall(first, "panel", { a: 1 })).toBe(1)
      expect(observeRepeatedToolCall(second, "panel", { a: 1 })).toBe(1)
      expect(observeRepeatedToolCall(first, "panel", { a: 1 })).toBe(2)
      forgetRepeatedToolCalls(first)
      expect(observeRepeatedToolCall(first, "panel", { a: 1 })).toBe(1)
      expect(observeRepeatedToolCall(second, "panel", { a: 1 })).toBe(2)
    } finally {
      forgetRepeatedToolCalls(first)
      forgetRepeatedToolCalls(second)
    }
  })

  test("declares an idle window so a long-lived session cannot trip on old history", () => {
    // Without it, a Tool called five times this morning and once tonight would
    // count as a six-long run.
    expect(REPEATED_CALL_RUN_IDLE_MS).toBeGreaterThan(0)
    expect(REPEATED_CALL_ACROSS_TURNS_THRESHOLD).toBeGreaterThan(3)
  })
})
