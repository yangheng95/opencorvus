import { describe, expect, test } from "bun:test"
import { summarizePersistedChatMessages } from "../src/services/session-debug"
import { buildChatDebugBlob } from "../src/utils/debug-info"

describe("persisted chat debug statistics", () => {
  test("counts persisted message roles and every Tool Part state independently from rendered cards", () => {
    const stats = summarizePersistedChatMessages([
      {
        info: { role: "user" },
        parts: [{ type: "text", text: "start" }],
      },
      {
        info: { role: "assistant" },
        parts: [
          { type: "tool", state: { status: "completed" } },
          { type: "tool", state: { status: "running" } },
          { type: "tool", state: { status: "pending" } },
        ],
      },
      {
        info: { role: "assistant" },
        parts: [
          { type: "tool", state: { status: "error" } },
          { type: "tool", state: { status: "future-state" } },
        ],
      },
    ])

    expect(stats).toEqual({
      messages: { total: 3, user: 1, assistant: 2, other: 0 },
      tools: { total: 5, pending: 1, running: 1, completed: 1, error: 1, other: 1 },
    })
  })

  test("rejects malformed responses instead of reporting a false persisted zero", () => {
    expect(() => summarizePersistedChatMessages(undefined)).toThrow("Session message response must be an array")
  })

  test("labels persisted facts separately from rendered card counts", () => {
    const blob = buildChatDebugBlob(
      { sessionID: "session-debug", title: "Debug", status: "idle", directory: "C:/project" },
      { kind: "session", id: "session-debug" },
      {
        cards: {
          rendered: { kind: "message" },
        },
        order: ["rendered"],
      } as any,
      {
        status: "available",
        sessionID: "session-debug",
        stats: {
          messages: { total: 2, user: 1, assistant: 1, other: 0 },
          tools: { total: 3, pending: 0, running: 1, completed: 2, error: 0, other: 0 },
        },
      },
    )
    expect(blob).toContain("Persisted Session:\n  messages.total:     2")
    expect(blob).toContain("tools.running:      1")
    expect(blob).toContain("Rendered cards:\n  top.level: 1\n  total:     1")
  })

  test("keeps the selected source canonical and rejects persisted statistics from another Session", () => {
    const blob = buildChatDebugBlob(
      { sessionID: "other-session", title: "Other", status: "idle", directory: "C:/other" },
      { kind: "session", id: "selected-session" },
      { cards: {}, order: [] } as any,
      {
        status: "available",
        sessionID: "other-session",
        stats: {
          messages: { total: 9, user: 4, assistant: 5, other: 0 },
          tools: { total: 7, pending: 0, running: 7, completed: 0, error: 0, other: 0 },
        },
      },
    )
    expect(blob).toContain("chat.session:   selected-session")
    expect(blob).toContain("chat.board.session: other-session")
    expect(blob).toContain("unavailable: statistics belong to other-session, expected selected-session")
    expect(blob).not.toContain("messages.total:     9")
  })
})
