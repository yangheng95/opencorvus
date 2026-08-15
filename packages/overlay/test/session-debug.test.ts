import { describe, expect, test } from "bun:test"
import { summarizePersistedChatMessages, type PersistedChatDebugProjection } from "../src/services/session-debug"
import {
  buildChatDebugBlob,
  buildTaskDebugBlob,
  buildTaskSelectionErrorDebugBlob,
  debugCopyFailureMessage,
  DebugProjectDirectoryUnavailableError,
  formatDebugTime,
  requireDebugProjectDirectory,
} from "../src/utils/debug-info"
import { boundedDebugText, normalizeDebugDirectory } from "../src/utils/debug-text"

function message(input: {
  id: string
  sessionID?: string
  role: "user" | "assistant"
  created: number
  completed?: number
  finish?: string
  errorName?: string
  userInput?: string
  parts?: Array<Record<string, unknown>>
}) {
  const sessionID = input.sessionID ?? "session-debug"
  return {
    info: {
      id: input.id,
      sessionID,
      role: input.role,
      time: { created: input.created, ...(input.completed ? { completed: input.completed } : {}) },
      ...(input.finish ? { finish: input.finish } : {}),
      ...(input.errorName ? { error: { name: input.errorName } } : {}),
      ...(input.userInput !== undefined
        ? {
            extra: {
              project_memory_user_input: {
                version: 1,
                surface: "session.prompt",
                literalText: input.userInput,
              },
            },
          }
        : {}),
    },
    parts: (input.parts ?? []).map((part, index) => ({
      id: `${input.id}-part-${index}`,
      sessionID,
      messageID: input.id,
      ...part,
    })),
  }
}

function projection(input: {
  root: ReturnType<typeof summarizePersistedChatMessages>
  tree?: ReturnType<typeof summarizePersistedChatMessages>
  rootUnavailable?: string
}): PersistedChatDebugProjection {
  return {
    schema: "opencorvus.chat-debug.v2",
    sessionID: "session-debug",
    directory: "C:/project",
    startedAt: 1_700_000_000_000,
    completedAt: 1_700_000_000_100,
    root: input.rootUnavailable
      ? {
          status: "unavailable",
          endpoint: "session/session-debug/message",
          collectedAt: 1_700_000_000_050,
          error: input.rootUnavailable,
        }
      : {
          status: "available",
          endpoint: "session/session-debug/message",
          collectedAt: 1_700_000_000_050,
          summary: input.root,
        },
    tree: {
      status: "available",
      endpoint: "session/session-debug/conversation",
      collectedAt: 1_700_000_000_090,
      summary: input.tree ?? input.root,
      board: { sessionID: "session-debug", title: "Debug", status: "idle", directory: "C:/project" },
    },
  }
}

describe("persisted chat debug bundle", () => {
  test("accepts named and anonymous persisted project directories for diagnostic collection", () => {
    const message = "Debug information requires a persisted project directory."
    expect(requireDebugProjectDirectory(" C:/work/opencorvus ", message)).toBe("C:/work/opencorvus")
    expect(
      requireDebugProjectDirectory(
        "C:/Users/test/AppData/Local/opencorvus/data/projects/2026/08/11/123e4567-e89b-42d3-a456-426614174000",
        message,
      ),
    ).toBe("C:/Users/test/AppData/Local/opencorvus/data/projects/2026/08/11/123e4567-e89b-42d3-a456-426614174000")
    const missingDirectory = () => requireDebugProjectDirectory("", message)
    expect(missingDirectory).toThrow(message)
    expect(missingDirectory).toThrow(DebugProjectDirectoryUnavailableError)
    try {
      missingDirectory()
    } catch (error) {
      expect(debugCopyFailureMessage(error, "Copy failed")).toBe(message)
    }
    expect(debugCopyFailureMessage(new Error("identity mismatch"), "Copy failed")).toBe("Copy failed")
  })

  test("counts validated lifecycle facts and keeps bounded Tool identities", () => {
    const stats = summarizePersistedChatMessages([
      message({
        id: "user-1",
        role: "user",
        created: 1,
        userInput: "Build a Sokoban game",
        parts: [
          { type: "text", text: "Build a Sokoban game", source: "user" },
          { type: "text", text: "private MCP resource body" },
        ],
      }),
      message({
        id: "assistant-running",
        role: "assistant",
        created: 2,
        parts: [
          { type: "tool", tool: "glob", callID: "call-glob", state: { status: "running", time: { start: 3 } } },
          { type: "tool", tool: "read", callID: "call-read", state: { status: "pending", time: { start: 3 } } },
        ],
      }),
      message({
        id: "assistant-error",
        role: "assistant",
        created: 4,
        completed: 5,
        finish: "error",
        errorName: "UnknownError",
        parts: [
          {
            type: "tool",
            tool: "bash",
            callID: "call-bash",
            state: {
              status: "error",
              time: { start: 4, end: 5 },
              failure: { kind: "process-execution-interrupted", message: "token=private diagnostic" },
            },
          },
          {
            type: "tool",
            tool: "write",
            callID: "call-write",
            state: { status: "completed", time: { start: 4, end: 5 } },
          },
        ],
      }),
    ])

    expect(stats.stats).toEqual({
      messages: {
        total: 3,
        user: 1,
        assistant: 2,
        other: 0,
        assistantIncomplete: 1,
        assistantCompleted: 1,
        assistantError: 1,
      },
      tools: { total: 4, pending: 1, running: 1, completed: 1, error: 1, other: 0 },
    })
    expect(stats.sessionIDs).toEqual(["session-debug"])
    expect(stats.recentMessages[0]).toMatchObject({
      messageID: "user-1",
      role: "user",
      userTextPreview: "Build a Sokoban game",
    })
    expect(stats.recentTools[0]).toMatchObject({
      messageID: "assistant-running",
      tool: "glob",
      status: "running",
    })
    expect(stats.recentTools[2]).toMatchObject({
      tool: "bash",
      failureKind: "process-execution-interrupted",
      failure: "token=[redacted] diagnostic",
    })
  })

  test("keeps an attachment-only user marker available without copying Host context", () => {
    const summary = summarizePersistedChatMessages([
      message({
        id: "attachment-only-user",
        role: "user",
        created: 1,
        userInput: "",
        parts: [{ type: "text", text: "Host-injected attachment contents" }],
      }),
    ])

    expect(summary.recentMessages).toEqual([
      expect.objectContaining({
        messageID: "attachment-only-user",
        role: "user",
        userTextPreview: null,
      }),
    ])
  })

  test("maps malformed and cross-Session records to explicit contract errors", () => {
    expect(() => summarizePersistedChatMessages([{}])).toThrow("Session message response[0].info must be an object")
    expect(() =>
      summarizePersistedChatMessages([
        message({ id: "missing-type", role: "assistant", created: 1, parts: [{ tool: "glob", callID: "call" }] }),
      ]),
    ).toThrow("part missing-type-part-0.type must be a non-empty string")
    expect(() =>
      summarizePersistedChatMessages([
        message({
          id: "duplicate-parts",
          role: "user",
          created: 1,
          parts: [
            { id: "duplicate-part", type: "text", text: "first" },
            { id: "duplicate-part", type: "text", text: "second" },
          ],
        }),
      ]),
    ).toThrow("contains duplicate part duplicate-part")
    expect(() =>
      summarizePersistedChatMessages([
        message({
          id: "missing-tool-time",
          role: "assistant",
          created: 1,
          parts: [{ type: "tool", tool: "glob", callID: "call", state: { status: "running" } }],
        }),
      ]),
    ).toThrow("state.time must be an object")
    expect(() =>
      summarizePersistedChatMessages([
        message({
          id: "future-tool-state",
          role: "assistant",
          created: 1,
          parts: [
            { type: "tool", tool: "glob", callID: "call", state: { status: "future-state", time: { start: 2 } } },
          ],
        }),
      ]),
    ).toThrow("has unsupported status future-state")
    expect(() =>
      summarizePersistedChatMessages([message({ id: "other", sessionID: "other-session", role: "user", created: 1 })], {
        expectedSessionID: "session-debug",
      }),
    ).toThrow("Session message other belongs to other-session, expected session-debug")
  })

  test("separates root, Session-tree, and rendered scopes and embeds the AI handoff", () => {
    const root = summarizePersistedChatMessages([
      message({
        id: "root-user",
        role: "user",
        created: 1,
        userInput: "Ship the repair",
        parts: [{ type: "text", text: "Host-injected file contents" }],
      }),
      message({
        id: "root-assistant",
        role: "assistant",
        created: 2,
        parts: [{ type: "tool", tool: "glob", callID: "root-glob", state: { status: "running", time: { start: 3 } } }],
      }),
    ])
    const tree = summarizePersistedChatMessages([
      message({ id: "root-user", role: "user", created: 1 }),
      message({
        id: "root-assistant",
        role: "assistant",
        created: 2,
        parts: [{ type: "tool", tool: "glob", callID: "child-glob", state: { status: "running", time: { start: 3 } } }],
      }),
      message({ id: "child-assistant", sessionID: "child-session", role: "assistant", created: 4 }),
    ])
    expect(root.recentMessages[0]?.userTextPreview).toBe("Ship the repair")
    const blob = buildChatDebugBlob(
      { sessionID: "session-debug", title: "Debug", status: "idle", directory: "C:/project" },
      { kind: "session", id: "session-debug", directory: "C:/project" },
      { cards: { rendered: { kind: "message" } }, order: ["rendered"] } as any,
      projection({ root, tree }),
    )

    expect(blob).toContain("Paste this entire bundle into an AI assistant")
    expect(blob).toContain("Persisted root Session (raw messages only):")
    expect(blob).toContain("Persisted Session tree (visible conversation transcript):")
    expect(blob).toContain("sessions:              child-session, session-debug")
    expect(blob).toContain("user.text: Ship the repair")
    expect(blob).toContain("tool=glob; status=running")
    expect(blob).toContain("Rendered Overlay snapshot (local, non-atomic with persisted reads):")
  })

  test("preserves a successful tree read when the root plane is unavailable", () => {
    const tree = summarizePersistedChatMessages([
      message({ id: "tree-user", role: "user", created: 1 }),
      message({ id: "tree-assistant", role: "assistant", created: 2 }),
    ])
    const blob = buildChatDebugBlob(
      { sessionID: "session-debug", title: "Debug", status: "idle", directory: "C:/project" },
      { kind: "session", id: "session-debug", directory: "C:/project" },
      { cards: {}, order: [] } as any,
      projection({ root: tree, tree, rootUnavailable: "root read failed" }),
    )

    expect(blob).toContain("status: unavailable\n  error: root read failed")
    expect(blob).toContain("interpretation: unknown; do not treat this plane as zero")
    expect(blob).toContain("Persisted Session tree (visible conversation transcript):")
    expect(blob).toContain("messages.total:        2")
  })

  test("rejects a persisted projection owned by another Session", () => {
    const empty = summarizePersistedChatMessages([])
    const other = { ...projection({ root: empty }), sessionID: "other-session" } as PersistedChatDebugProjection
    expect(() =>
      buildChatDebugBlob(
        { sessionID: "session-debug", title: "Debug", status: "idle", directory: "C:/project" },
        { kind: "session", id: "session-debug", directory: "C:/project" },
        { cards: {}, order: [] } as any,
        other,
      ),
    ).toThrow("Chat debug persistence belongs to other-session, expected session-debug")
  })

  test("derives Task activity time from topology and persisted artifacts", () => {
    const artifactUpdated = 1_700_000_004_000
    const blob = buildTaskDebugBlob(
      {
        task: {
          id: "task-debug",
          title: "Debug Task",
          status: "running",
          directory: "C:/project",
          time: { created: 1_700_000_000_000, updated: 1_700_000_001_000 },
        },
        project: { worktree: "C:/project" },
        goals: [],
        sessionInvocationTopology: {
          nodes: [{ time: { created: 1_700_000_001_000, updated: 1_700_000_002_000 } }],
        },
        executionProjection: {
          occurrences: [{ latest: { status: { type: "running" }, emittedAt: 1_700_000_003_000 } }],
        },
        artifacts: [{ time: { updated: artifactUpdated } }],
        processIncidents: [],
      },
      { kind: "task", id: "task-debug", directory: "C:/project" },
    )

    expect(blob).toContain("Paste this entire bundle into an AI assistant")
    expect(blob).toContain(`task.activity.updated: ${formatDebugTime(artifactUpdated)}`)
    expect(blob).toContain(`topology=${formatDebugTime(1_700_000_002_000)}`)
    expect(blob).toContain(`artifact=${formatDebugTime(artifactUpdated)}`)
  })

  test("redacts and bounds every free-form clipboard failure plane", () => {
    const rawSecret = "sk-proj-abcdefghijklmnop"
    const githubSecret = "ghp_abcdefghijklmnopqrstuvwxyz123456" // secret-scan: ignore -- deliberate redaction fixture
    const root = summarizePersistedChatMessages([
      message({
        id: "secret-user",
        role: "user",
        created: 1,
        userInput: `Please use ${rawSecret}`,
        parts: [{ type: "text", text: `Please use ${rawSecret}` }],
      }),
    ])
    const chatBlob = buildChatDebugBlob(
      { sessionID: "session-debug", title: rawSecret, status: "idle", directory: "C:/project" },
      { kind: "session", id: "session-debug", directory: "C:/project" },
      { cards: {}, order: [] },
      projection({
        root,
        rootUnavailable: `request https://alice:password@example.test failed with ${rawSecret} and ${githubSecret}`,
      }),
    )
    const taskBlob = buildTaskSelectionErrorDebugBlob({
      taskID: "task-debug",
      directory: "C:/project",
      title: rawSecret,
      details: `${githubSecret} token=plain-secret ${"x".repeat(2_000)}`,
    })

    expect(chatBlob).not.toContain(rawSecret)
    expect(chatBlob).not.toContain(githubSecret)
    expect(chatBlob).not.toContain("alice:password")
    expect(taskBlob).not.toContain(rawSecret)
    expect(taskBlob).not.toContain(githubSecret)
    expect(taskBlob).not.toContain("plain-secret")
    expect(taskBlob.length).toBeLessThan(3_000)
  })

  test("redacts authentication edge cases and preserves platform path identity", () => {
    const text = boundedDebugText(
      "Authorization: Basic dXNlcjpwYXNz AccountKey=azure-secret -----BEGIN PRIVATE KEY----- truncated-secret",
      500,
    )

    expect(text).not.toContain("dXNlcjpwYXNz")
    expect(text).not.toContain("azure-secret")
    expect(text).not.toContain("truncated-secret")
    expect(normalizeDebugDirectory("C:\\Project\\")).toBe(normalizeDebugDirectory("c:/project"))
    expect(normalizeDebugDirectory("/Project/")).not.toBe(normalizeDebugDirectory("/project"))
  })
})
