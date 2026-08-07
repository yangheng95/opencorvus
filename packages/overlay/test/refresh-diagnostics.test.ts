import { afterEach, describe, expect, test } from "bun:test"
import {
  RECOVERY_DIAGNOSTICS_PREFIX,
  __resetConversationRecoveryDiagnosticsSinkForTest,
  __setConversationRecoveryDiagnosticsSinkForTest,
  recordConversationRecoveryAborted,
  recordConversationRecoveryFailed,
  recordConversationRecoveryStarted,
  recordConversationRecoverySucceeded,
  type ConversationRecoveryDiagnosticsRecord,
} from "../src/services/refresh-diagnostics"

interface CapturedRecoveryDiagnostic {
  prefix: string
  record: ConversationRecoveryDiagnosticsRecord
}

function captureRecoveryDiagnostics(): CapturedRecoveryDiagnostic[] {
  const captured: CapturedRecoveryDiagnostic[] = []
  __setConversationRecoveryDiagnosticsSinkForTest((prefix, record) => {
    captured.push({ prefix, record })
  })
  return captured
}

afterEach(() => {
  __resetConversationRecoveryDiagnosticsSinkForTest()
})

describe("refresh diagnostics", () => {
  test("recordConversationRecoveryStarted emits one structured record", () => {
    const captured = captureRecoveryDiagnostics()

    recordConversationRecoveryStarted({
      channel: "sse-reconnect",
      reason: "sse stream reconnect",
      taskID: "tsk_started",
      source: "sse-reconnect",
    })

    expect(captured).toEqual([
      {
        prefix: "[recovery-diagnostics]",
        record: {
          event: "conversation-recovery.started",
          channel: "sse-reconnect",
          reason: "sse stream reconnect",
          taskID: "tsk_started",
          source: "sse-reconnect",
        },
      },
    ])
  })

  test("recordConversationRecoveryFailed emits one structured record", () => {
    const captured = captureRecoveryDiagnostics()

    recordConversationRecoveryFailed({
      channel: "sse-reconnect",
      reason: "sse stream reconnect",
      taskID: "tsk_failed",
      source: "sse-reconnect",
      durationMs: 15,
      error: "hydrate failed",
    })

    expect(captured).toEqual([
      {
        prefix: "[recovery-diagnostics]",
        record: {
          event: "conversation-recovery.failed",
          channel: "sse-reconnect",
          reason: "sse stream reconnect",
          taskID: "tsk_failed",
          source: "sse-reconnect",
          durationMs: 15,
          error: "hydrate failed",
        },
      },
    ])
  })

  test("recordConversationRecoveryAborted emits one structured record", () => {
    const captured = captureRecoveryDiagnostics()

    recordConversationRecoveryAborted({
      channel: "sse-reconnect",
      reason: "sse stream reconnect",
      taskID: "tsk_aborted",
      source: "sse-reconnect",
      durationMs: 21,
      error: "task changed before restart",
    })

    expect(captured).toEqual([
      {
        prefix: "[recovery-diagnostics]",
        record: {
          event: "conversation-recovery.aborted",
          channel: "sse-reconnect",
          reason: "sse stream reconnect",
          taskID: "tsk_aborted",
          source: "sse-reconnect",
          durationMs: 21,
          error: "task changed before restart",
        },
      },
    ])
  })

  test("recordConversationRecoverySucceeded emits one structured record", () => {
    const captured = captureRecoveryDiagnostics()

    recordConversationRecoverySucceeded({
      channel: "sse-reconnect",
      reason: "sse stream reconnect",
      taskID: "tsk_succeeded",
      source: "sse-reconnect",
      durationMs: 34,
      resumeSequence: 55,
    })

    expect(captured).toEqual([
      {
        prefix: "[recovery-diagnostics]",
        record: {
          event: "conversation-recovery.succeeded",
          channel: "sse-reconnect",
          reason: "sse stream reconnect",
          taskID: "tsk_succeeded",
          source: "sse-reconnect",
          durationMs: 34,
          resumeSequence: 55,
        },
      },
    ])
  })

  test("default sink writes the stable prefix with the structured record", () => {
    const calls: unknown[][] = []
    const originalInfo = console.info
    console.info = (...args: unknown[]) => {
      calls.push(args)
    }
    try {
      recordConversationRecoveryStarted({
        channel: "sse-reconnect",
        reason: "sse stream reconnect",
        taskID: "tsk_console",
        source: "sse-reconnect",
      })
    } finally {
      console.info = originalInfo
    }

    expect(calls).toEqual([
      [
        RECOVERY_DIAGNOSTICS_PREFIX,
        {
          event: "conversation-recovery.started",
          channel: "sse-reconnect",
          reason: "sse stream reconnect",
          taskID: "tsk_console",
          source: "sse-reconnect",
        },
      ],
    ])
  })
})
