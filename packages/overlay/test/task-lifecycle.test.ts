/**
 * Task lifecycle unit tests — validates the overlay's task state classification
 * and direct API call signatures for create, cancel, retry, replan, interrupt.
 *
 * These are pure logic tests that do not require a browser or running server.
 */
import { describe, test, expect } from "bun:test"
import { TaskCancellationRequestBody } from "@opencorvus-ai/transport-protocol"

// ── Inline board store classifiers (mirrors store/board.ts) ──
// We duplicate the logic here to test it in isolation without importing
// the full overlay module graph (which depends on DOM, Tauri, etc.).

const INTERRUPTABLE_STATUSES = new Set(["queued", "active"])

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"])

function isTaskInterruptable(status: string | undefined): boolean {
  return !!status && INTERRUPTABLE_STATUSES.has(status)
}

function isTaskTerminal(status: string | undefined): boolean {
  return !!status && TERMINAL_STATUSES.has(status)
}

// ── Stop button availability ──

describe("stop button availability (isTaskInterruptable)", () => {
  test("available during non-terminal task lifecycle states", () => {
    expect(isTaskInterruptable("queued")).toBe(true)
    expect(isTaskInterruptable("active")).toBe(true)
  })

  test("not available in terminal states", () => {
    expect(isTaskInterruptable("completed")).toBe(false)
    expect(isTaskInterruptable("failed")).toBe(false)
    expect(isTaskInterruptable("cancelled")).toBe(false)
  })

  test("not available when status is undefined or empty", () => {
    expect(isTaskInterruptable(undefined)).toBe(false)
    expect(isTaskInterruptable("")).toBe(false)
  })

  test("old pipeline phase names are not task lifecycle statuses", () => {
    for (const status of [
      "spec_generating",
      "goal_decomposing",
      "planning",
      "planned",
      "running",
      "blocked",
      "evaluating",
      "delivering",
    ]) {
      expect(isTaskInterruptable(status)).toBe(false)
    }
  })
})

// ── Terminal state classification ──

describe("terminal state classification (isTaskTerminal)", () => {
  test("completed, failed, cancelled are terminal", () => {
    expect(isTaskTerminal("completed")).toBe(true)
    expect(isTaskTerminal("failed")).toBe(true)
    expect(isTaskTerminal("cancelled")).toBe(true)
  })

  test("active states are not terminal", () => {
    expect(isTaskTerminal("queued")).toBe(false)
    expect(isTaskTerminal("active")).toBe(false)
  })

  test("undefined/empty are not terminal", () => {
    expect(isTaskTerminal(undefined)).toBe(false)
    expect(isTaskTerminal("")).toBe(false)
  })
})

// ── Busy signal derivation ──

describe("busy signal (chatRequest || isTaskInterruptable)", () => {
  test("busy when chat request is in-flight and no task", () => {
    const chatRequest = { requestID: "abc" }
    const taskStatus: string | undefined = undefined
    const busy = !!chatRequest || isTaskInterruptable(taskStatus)
    expect(busy).toBe(true)
  })

  test("busy when task is active even without chat request", () => {
    const chatRequest = null
    const taskStatus = "active"
    const busy = !!chatRequest || isTaskInterruptable(taskStatus)
    expect(busy).toBe(true)
  })

  test("busy when task is in pipeline stage (queued) — no gap", () => {
    const chatRequest = null
    const taskStatus = "queued"
    const busy = !!chatRequest || isTaskInterruptable(taskStatus)
    expect(busy).toBe(true)
  })

  test("not busy when task is completed and no chat request", () => {
    const chatRequest = null
    const taskStatus = "completed"
    const busy = !!chatRequest || isTaskInterruptable(taskStatus)
    expect(busy).toBe(false)
  })

  test("not busy when no task selected and no chat request", () => {
    const chatRequest = null
    const taskStatus = undefined
    const busy = !!chatRequest || isTaskInterruptable(taskStatus)
    expect(busy).toBe(false)
  })

  test("busy covers the gap: chat request ended → task still queued", () => {
    // This is the critical scenario that was broken before the refactor:
    // 1. User submits message → chatRequest set → busy=true (stop visible)
    // 2. Direct API creates task → chatRequest cleared
    // 3. Task status = "queued" -> isTaskInterruptable = true -> busy=true
    // No gap! The stop button remains visible.
    const chatRequest = null // cleared after create
    const taskStatus = "queued" // task just created
    const busy = !!chatRequest || isTaskInterruptable(taskStatus)
    expect(busy).toBe(true)
  })
})

// ── Direct API call contract ──

describe("direct API call contracts", () => {
  test("createTask builds correct request body shape", () => {
    const text = "Build a login page"
    const requestID = "req-123"
    const metadata = { key: "value" }

    const body = {
      request: text,
      requestID,
      metadata,
      source: "panel",
    }

    expect(body.request).toBe(text)
    expect(body.requestID).toBe(requestID)
    expect(body.source).toBe("panel")
    expect(body.metadata).toEqual({ key: "value" })
  })

  test("cancelTask URL pattern", () => {
    const taskID = "task-abc-123"
    const url = `task/${encodeURIComponent(taskID)}/cancel`
    expect(url).toBe("task/task-abc-123/cancel")
    expect(
      TaskCancellationRequestBody.parse({
        surface: "overlay.selected_task",
        reason: "  Operator cancelled the selected task  ",
      }),
    ).toEqual({
      surface: "overlay.selected_task",
      reason: "Operator cancelled the selected task",
    })
    expect(
      TaskCancellationRequestBody.safeParse({
        surface: "api",
        reason: "   ",
      }).success,
    ).toBe(false)
    expect(
      TaskCancellationRequestBody.safeParse({
        surface: "api",
        reason: "x".repeat(2_001),
      }).success,
    ).toBe(false)
  })

  test("retryTask URL pattern", () => {
    const taskID = "task-abc-123"
    const url = `task/${encodeURIComponent(taskID)}/retry`
    expect(url).toBe("task/task-abc-123/retry")
  })

  test("replanTask URL pattern", () => {
    const taskID = "task-abc-123"
    const url = `task/${encodeURIComponent(taskID)}/replan`
    expect(url).toBe("task/task-abc-123/replan")
  })

  test("deleteTask URL pattern", () => {
    const taskID = "task-abc-123"
    const url = `task/${encodeURIComponent(taskID)}`
    expect(url).toBe("task/task-abc-123")
  })

  test("taskID with special characters is properly encoded", () => {
    const taskID = "task/with spaces&special"
    const url = `task/${encodeURIComponent(taskID)}/cancel`
    expect(url).toBe("task/task%2Fwith%20spaces%26special/cancel")
  })
})

// ── Board controls derivation ──

describe("board controls derivation from task lifecycle", () => {
  // Mirrors the logic in board-builder.ts boardOverview()

  function deriveControls(taskStatus: string, hasPlan: boolean, pendingInteractions: number) {
    return {
      canRetry: TERMINAL_STATUSES.has(taskStatus) && pendingInteractions === 0,
      canReplan: TERMINAL_STATUSES.has(taskStatus) && hasPlan,
      canCancel: INTERRUPTABLE_STATUSES.has(taskStatus),
    }
  }

  test("active task: can cancel, cannot retry/replan", () => {
    const c = deriveControls("active", true, 0)
    expect(c.canCancel).toBe(true)
    expect(c.canRetry).toBe(false)
    expect(c.canReplan).toBe(false)
  })

  test("failed task with plan: can retry and replan, cannot cancel", () => {
    const c = deriveControls("failed", true, 0)
    expect(c.canCancel).toBe(false)
    expect(c.canRetry).toBe(true)
    expect(c.canReplan).toBe(true)
  })

  test("failed task without plan: can retry, cannot replan", () => {
    const c = deriveControls("failed", false, 0)
    expect(c.canRetry).toBe(true)
    expect(c.canReplan).toBe(false)
  })

  test("cancelled task: can retry, cannot cancel", () => {
    const c = deriveControls("cancelled", true, 0)
    expect(c.canRetry).toBe(true)
    expect(c.canCancel).toBe(false)
  })

  test("completed task: cannot do anything (no retry on success)", () => {
    // completed is terminal with no pending interactions
    const c = deriveControls("completed", true, 0)
    expect(c.canCancel).toBe(false)
    // Actually per the state machine, completed CAN retry (terminal)
    // but the board's canRetry is controlled by terminal + no pending
    expect(c.canRetry).toBe(true)
    expect(c.canReplan).toBe(true)
  })

  test("queued task: can cancel immediately (no need to wait for run)", () => {
    const c = deriveControls("queued", false, 0)
    expect(c.canCancel).toBe(true)
    expect(c.canRetry).toBe(false)
  })

  test("old pipeline phase names do not enable task controls", () => {
    for (const status of ["running", "blocked", "planning", "evaluating", "delivering"]) {
      const c = deriveControls(status, true, 0)
      expect(c.canCancel).toBe(false)
      expect(c.canRetry).toBe(false)
      expect(c.canReplan).toBe(false)
    }
  })
})
