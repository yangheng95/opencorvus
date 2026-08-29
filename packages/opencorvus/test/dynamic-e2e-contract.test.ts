import { describe, expect, test } from "bun:test"
import {
  requireAuthoritativeCompletedWorkerFinalMessage,
  requireCrossSessionProviderExecutionOverlap,
  requireSingleAttemptProviderActivities,
} from "../script/dynamic-e2e-contract"

describe("Dynamic real-provider evidence contract", () => {
  test("selects the lifecycle-authoritative completed reply even when a later assistant Message is adjacent", () => {
    const final = {
      info: {
        id: "msg-final",
        sessionID: "session-a",
        role: "assistant",
        time: { completed: 20 },
        finish: "stop",
      },
      parts: [{ type: "text", text: "authoritative result" }],
    }
    const adjacent = {
      info: {
        id: "msg-adjacent",
        sessionID: "session-a",
        role: "assistant",
        time: { completed: 30 },
        finish: "stop",
      },
      parts: [{ type: "text", text: "later but not this occurrence's final reply" }],
    }
    const lifecycle = {
      payload: {
        inputMessageID: "msg-input",
        status: { type: "terminal", reason: "completed", final_message_id: "msg-final" },
      },
    }
    expect(
      requireAuthoritativeCompletedWorkerFinalMessage({
        sessionID: "session-a",
        inputMessageID: "msg-input",
        lifecycle,
        canonicalFinalMessageID: "msg-final",
        messages: [final, adjacent],
      }),
    ).toEqual(final)
    expect(() =>
      requireAuthoritativeCompletedWorkerFinalMessage({
        sessionID: "session-a",
        inputMessageID: "msg-input",
        lifecycle: { payload: { inputMessageID: "msg-input", status: { type: "terminal", reason: "completed" } } },
        canonicalFinalMessageID: "msg-final",
        messages: [final],
      }),
    ).toThrow("completed lifecycle receipt has no final_message_id")
    expect(() =>
      requireAuthoritativeCompletedWorkerFinalMessage({
        sessionID: "session-a",
        inputMessageID: "msg-input",
        lifecycle,
        canonicalFinalMessageID: "msg-final",
        messages: [{ ...final, info: { ...final.info, sessionID: "session-b" } }],
      }),
    ).toThrow("lifecycle final Message msg-final belongs to Session session-b")
    expect(() =>
      requireAuthoritativeCompletedWorkerFinalMessage({
        sessionID: "session-a",
        inputMessageID: "msg-input",
        lifecycle: {
          payload: {
            inputMessageID: "msg-input",
            status: { type: "terminal", reason: "error", final_message_id: "msg-final" },
          },
        },
        canonicalFinalMessageID: "msg-final",
        messages: [final],
      }),
    ).toThrow("did not settle as completed")
  })

  test("accepts only one-attempt Provider activities", () => {
    const request = { id: "act-1", assistant_message_id: "msg-1", time_created: 10 }
    expect(() =>
      requireSingleAttemptProviderActivities({
        requests: [request],
        outcomes: [{ request_id: "act-1", time_created: 20, data: { outcome: "done", attempt_count: 1 } }],
      }),
    ).not.toThrow()
    expect(() =>
      requireSingleAttemptProviderActivities({
        requests: [request],
        outcomes: [{ request_id: "act-1", time_created: 20, data: { outcome: "done", attempt_count: 2 } }],
      }),
    ).toThrow("Provider activity act-1 used 2 attempts; exactly one is required.")
  })

  test("requires strict overlap between real Provider execution intervals", () => {
    const messages = [
      { id: "msg-a", sessionID: "session-a" },
      { id: "msg-b", sessionID: "session-b" },
    ]
    const outcomes = [
      { request_id: "act-a", time_created: 40, data: { outcome: "done", attempt_count: 1 } },
      { request_id: "act-b", time_created: 50, data: { outcome: "done", attempt_count: 1 } },
    ]
    expect(
      requireCrossSessionProviderExecutionOverlap({
        sessionIDs: ["session-a", "session-b"],
        messages,
        requests: [
          { id: "act-a", assistant_message_id: "msg-a", time_created: 10 },
          { id: "act-b", assistant_message_id: "msg-b", time_created: 20 },
        ],
        outcomes,
      }),
    ).toMatchObject({ overlapMs: 20 })
    expect(() =>
      requireCrossSessionProviderExecutionOverlap({
        sessionIDs: ["session-a", "session-b"],
        messages,
        requests: [
          { id: "act-a", assistant_message_id: "msg-a", time_created: 10 },
          { id: "act-b", assistant_message_id: "msg-b", time_created: 40 },
        ],
        outcomes,
      }),
    ).toThrow("Worker Provider executions did not overlap")
  })
})
