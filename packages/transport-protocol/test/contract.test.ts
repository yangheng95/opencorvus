import { describe, expect, test } from "bun:test"
import {
  CONVERSATION_AGENT_ACTIVITY_LIMIT,
  STREAM_FAILURE_PROVENANCE,
  STREAM_INSTANCE_QUERY_KEY,
  STREAM_LIFECYCLE_EVENT_NAME,
  STREAM_LIFECYCLE_PROTOCOL,
  STREAM_SUPERSESSION_INITIATOR,
  MailboxChangeStreamEvent,
  ProjectWorktreeDeleteReceipt,
  ProjectWorktreeList,
  PtyOutputStreamEvent,
  WorkLedgerActionEvent,
  WorkLedgerEvent,
  WorkLedgerList,
  base64ToUint8,
  conversationMessageDisplayStage,
  projectConversationAgentActivityPart,
  isConversationDisplayMessagePartType,
  isDelegatedContextMessage,
  isConversationRenderableMessagePartType,
  parseConversationInteractiveArtifactMessagePart,
  isNativeCommand,
  isOverlayPersistedSettings,
  routeRequiresProjectDirectory,
  uint8ToBase64,
  type NativeCommand,
  type OverlayPersistedSettings,
} from "../src/index"

describe("canonical Server-Sent Events payload contracts", () => {
  test("parses each canonical Pseudo Terminal event branch", () => {
    expect(PtyOutputStreamEvent.parse({ type: "data", data: "hello" })).toEqual({ type: "data", data: "hello" })
    expect(PtyOutputStreamEvent.parse({ type: "cursor", cursor: 17 })).toEqual({ type: "cursor", cursor: 17 })
    expect(PtyOutputStreamEvent.parse({ type: "exit", code: 0, reason: "done" })).toEqual({
      type: "exit",
      code: 0,
      reason: "done",
    })
  })

  test("parses the canonical mailbox notification branch", () => {
    expect(
      MailboxChangeStreamEvent.parse({
        type: "mailbox.changed",
        sourceType: "task.failed",
        messageID: "message-1",
        taskID: "task-1",
        sequence: 17,
      }),
    ).toEqual({
      type: "mailbox.changed",
      sourceType: "task.failed",
      messageID: "message-1",
      taskID: "task-1",
      sequence: 17,
    })
  })

  test("keeps Work Ledger producer and actionable consumer acceptance on one schema", () => {
    const changed = {
      type: "work-ledger.changed",
      sourceType: "task.updated",
      taskID: "task-1",
      sequence: 17,
    }
    const handoff = {
      type: "work-ledger.mission-handoff",
      sourceType: "mission.handoff",
      projectID: "project-1",
      directory: "/repo",
      missionID: "mission-1",
      sessionID: "session-mission",
      callerSessionID: "session-caller",
      callerExperience: "chat",
      callerMessageID: "message-caller",
      sequence: 18,
    }
    const conversationHandoff = {
      type: "work-ledger.conversation-handoff",
      sourceType: "conversation.handoff",
      projectID: "project-1",
      directory: "/repo",
      sessionID: "session-work",
      experience: "work",
      callerSessionID: "session-caller",
      callerExperience: "chat",
      callerMessageID: "message-caller",
      sequence: 19,
    }
    for (const event of [changed, handoff, conversationHandoff]) {
      expect(WorkLedgerEvent.parse(event)).toEqual(event)
      expect(WorkLedgerActionEvent.parse(event)).toEqual(event)
    }
    expect(
      WorkLedgerEvent.parse({
        type: "work-ledger.heartbeat",
        sourceType: "work-ledger.heartbeat",
        sequence: 0,
      }),
    ).toEqual({ type: "work-ledger.heartbeat", sourceType: "work-ledger.heartbeat", sequence: 0 })
    expect(
      WorkLedgerEvent.parse({
        type: "mailbox.changed",
        sourceType: "task.completed",
        messageID: "message-1",
        taskID: "task-1",
        sequence: 20,
      }),
    ).toEqual({
      type: "mailbox.changed",
      sourceType: "task.completed",
      messageID: "message-1",
      taskID: "task-1",
      sequence: 20,
    })
  })
})

describe("canonical Work Ledger and Project Worktree response contracts", () => {
  test("parses the complete Mission-owned Work Ledger hierarchy", () => {
    const task = {
      kind: "task",
      id: "task-1",
      title: "Task",
      description: "Description",
      directory: "/repo",
      created: 1,
      started: 1,
      updated: 2,
      pinned: false,
      lifecycleStatus: "active",
      activityStatus: "running",
      cancellationStatus: "none",
      priority: "normal",
      source: "operator",
      productPillar: "code",
      pendingInteractions: 0,
      missionID: "mission-1",
      missionSessionID: "session-1",
    }
    const mission = {
      kind: "mission",
      id: "mission-1",
      missionID: "mission-1",
      sessionID: "session-1",
      title: "Mission",
      directory: "/repo",
      created: 1,
      started: 1,
      updated: 2,
      pinned: true,
      interruptible: true,
      productPillar: "code",
      taskStats: { total: 1, running: 1, inactive: 0 },
      pendingInteractions: 0,
      tasks: [task],
    }
    const value = { rows: [mission], nextCursor: { pinned: false, updated: 2, rowKey: "mission:mission-1" } }
    expect(WorkLedgerList.parse(value)).toEqual(value)
  })

  test("accepts the Task-and-Session-owned worktree list and deletion receipt", () => {
    const worktree = {
      name: "session-1",
      branch: "opencorvus/s/session-1",
      directory: "/repo/.opencorvus/.r/tasks/tsk_1/sessions/ses_1/worktree",
      status: "managed",
      removable: true,
    }
    expect(ProjectWorktreeList.parse([worktree])).toEqual([worktree])
    expect(ProjectWorktreeDeleteReceipt.parse({ ok: true, status: "removed" })).toEqual({
      ok: true,
      status: "removed",
    })
  })
})

describe("stream lifecycle evidence identity", () => {
  test("publishes one canonical browser event and request identity key", () => {
    expect(STREAM_INSTANCE_QUERY_KEY).toBe("opencorvus_stream_instance")
    expect(STREAM_LIFECYCLE_EVENT_NAME).toBe("opencorvus:stream-lifecycle")
    expect(STREAM_LIFECYCLE_PROTOCOL).toBe("opencorvus.stream-lifecycle.v1")
    expect(STREAM_SUPERSESSION_INITIATOR).toBe("superseded")
    expect(STREAM_FAILURE_PROVENANCE).toBe("transport")
  })
})

describe("conversation message display ownership", () => {
  test("assigns delegated provider user prompts to the receiving agent channel", () => {
    const origin = { role: "user", author: "orchestrator", channel: "architect", source: "" }
    expect(isDelegatedContextMessage(origin)).toBe(true)
    expect(conversationMessageDisplayStage(origin)).toBe("architect")
  })

  test("keeps main and explicit standalone human input user-owned", () => {
    expect(conversationMessageDisplayStage({ role: "user", author: "user", channel: "main", source: "" })).toBe("user")
    expect(
      conversationMessageDisplayStage({
        role: "user",
        author: "user",
        channel: "assistant",
        source: "right-sidebar-conversation",
      }),
    ).toBe("user")
    expect(
      conversationMessageDisplayStage({
        role: "user",
        author: "user",
        channel: "mission",
        source: "mission.operator",
      }),
    ).toBe("user")
  })

  test("rejects the retired hidden conversation channel", () => {
    expect(() =>
      conversationMessageDisplayStage({
        role: "assistant",
        author: "orchestrator",
        channel: "filtered",
        source: "legacy-hidden-message",
      }),
    ).toThrow("retired hidden channel")
  })

  test("rejects incomplete origin instead of guessing display ownership", () => {
    expect(() => conversationMessageDisplayStage({ role: "", author: "user", channel: "main", source: "" })).toThrow(
      "missing role",
    )
    expect(() => conversationMessageDisplayStage({ role: "user", author: "user", channel: "", source: "" })).toThrow(
      "missing channel",
    )
  })
})

describe("native command validation", () => {
  const persistedSettings: OverlayPersistedSettings = {
    serverUrl: "https://example.com",
    autoServer: false,
    password: "",
    username: "opencorvus",
    projectEditor: "vscode",
    initGit: true,
    sidebarCollapsed: false,
    workLedgerOrganization: "by-project",
    workLedgerSort: "updated",
    zoom: 1,
    theme: "light",
    locale: "en-US",
    preferredProjectEditor: "vscode",
    desktopNotifications: true,
  }

  test("accepts an explicit empty username for a server without Basic Auth", () => {
    expect(isOverlayPersistedSettings({ ...persistedSettings, username: "" })).toBe(true)
  })

  test("accepts every canonical native command payload", () => {
    const valid = [
      { kind: "open-url", url: "https://example.com" },
      {
        kind: "browserPreview.sync",
        surfaceID: "browser-tab-1",
        scopeKey: "right-dock-browser",
        mountUrl: "https://example.com/",
        bounds: { x: 1, y: 2, width: 640, height: 480 },
      },
      {
        kind: "browserPreview.navigateUrl",
        surfaceID: "browser-tab-1",
        scopeKey: "right-dock-browser",
        url: "https://example.com/",
      },
      {
        kind: "browserPreview.selection.setEnabled",
        surfaceID: "browser-tab-1",
        scopeKey: "right-dock-browser",
        enabled: false,
        presentation: {
          labels: {
            page: "Page",
            target: "Target",
            source: "Source",
            color: "Color",
            font: "Font",
            placeholder: "Comment on this node",
            cancel: "Cancel",
            send: "Use in composer",
            label: "Comment",
            annotate: "Annotate node",
            contextHint: "Right-click to annotate node",
          },
          palette: {
            surface: "rgb(255, 255, 255)",
            surfaceInset: "rgb(244, 244, 245)",
            surfaceHover: "rgb(240, 240, 240)",
            text: "rgb(24, 27, 29)",
            textMuted: "rgb(89, 97, 100)",
            border: "rgba(32, 38, 40, 0.14)",
            accent: "rgb(9, 105, 218)",
            accentDim: "color-mix(in srgb, rgb(9, 105, 218) 7%, transparent)",
            accentRing: "color-mix(in srgb, rgb(9, 105, 218) 20%, transparent)",
            shadow: "0 12px 32px rgba(32, 38, 40, 0.1)",
          },
        },
      },
      { kind: "clipboard.readText" },
      { kind: "settings.save", payload: persistedSettings },
      { kind: "workspace.openProjectEditor", editor: "vscode", path: "D:/workspace" },
    ] satisfies NativeCommand[]
    for (const command of valid) expect(isNativeCommand(command)).toBe(true)
  })
})

describe("base64 codec (audit F4)", () => {
  test("round-trips empty Uint8Array", () => {
    const out = base64ToUint8(uint8ToBase64(new Uint8Array(0)))
    expect(out.length).toBe(0)
  })

  test("round-trips a 1 KiB sample byte-for-byte", () => {
    const input = new Uint8Array(1024)
    for (let i = 0; i < input.length; i++) input[i] = (i * 37 + 7) & 0xff
    const decoded = base64ToUint8(uint8ToBase64(input))
    expect(decoded.length).toBe(input.length)
    for (let i = 0; i < input.length; i++) expect(decoded[i]).toBe(input[i]!)
  })

  test("handles 1 MiB without 'too many arguments' / stack overflow", () => {
    const input = new Uint8Array(1024 * 1024)
    for (let i = 0; i < input.length; i++) input[i] = i & 0xff
    const encoded = uint8ToBase64(input)
    const decoded = base64ToUint8(encoded)
    expect(decoded.length).toBe(input.length)
    // Spot-check a handful of bytes (full equality on 1MB is slow).
    expect(decoded[0]).toBe(0)
    expect(decoded[255]).toBe(255)
    expect(decoded[input.length - 1]).toBe((input.length - 1) & 0xff)
  })

  test("malformed base64 throws a typed Error, not engine-specific InvalidCharacterError", () => {
    expect(() => base64ToUint8("definitely!!!not-base64@@@")).toThrow(/invalid base64/i)
  })
})

describe("route directory policy", () => {
  test("project routes require directory regardless of leading slash or query", () => {
    for (const path of [
      "tasks",
      "/task/abc/message",
      "/path",
      "/vcs",
      "/config/providers",
      "/config/proxy/test",
      "/config/prompt-profile",
      "/expert-squad/import-folder",
      "/expert-squad/validate-folder",
      "/expert-squad/import-file",
      "/expert-squad/export",
      "/expert-squad/multica/squads",
      "/expert-squad/multica/preview",
      "/expert-squad/multica/import",
      "/file/upload",
      "/project/current",
      "/session/session_123/conversation",
      "/mission/wake",
      "/task/abc/browser-preview?targetID=art_1",
    ]) {
      expect(routeRequiresProjectDirectory(path)).toBe(true)
    }
    expect(routeRequiresProjectDirectory("/project/current", "DELETE")).toBe(true)
    expect(routeRequiresProjectDirectory("/task/abc", "DELETE")).toBe(true)
    expect(routeRequiresProjectDirectory("/project/current", "PATCH")).toBe(true)
    expect(routeRequiresProjectDirectory("/task/abc/project-archive", "GET")).toBe(true)
    expect(routeRequiresProjectDirectory("/task/abc/browser-preview", "GET")).toBe(true)
    expect(routeRequiresProjectDirectory("/task/abc/conversation", "POST")).toBe(true)
  })
})

describe("conversation message part projection", () => {
  test("projects every rendered body part and canonical interactive artifact identity", () => {
    for (const type of [
      "text",
      "part-error",
      "reasoning",
      "tool",
      "patch",
      "file",
      "interactive-artifact",
      "interaction-question",
      "interaction-permission",
      "subtask",
    ]) {
      expect(isConversationDisplayMessagePartType(type)).toBe(true)
      expect(isConversationRenderableMessagePartType(type)).toBe(true)
    }

    expect(
      parseConversationInteractiveArtifactMessagePart({
        type: "interactive-artifact",
        artifactID: "artifact_demo",
      }),
    ).toEqual({
      type: "interactive-artifact",
      artifactID: "artifact_demo",
    })
    expect(() =>
      parseConversationInteractiveArtifactMessagePart({
        type: "interactive-artifact",
        artifactID: "",
      }),
    ).toThrow("artifactID is required")
    expect(() =>
      parseConversationInteractiveArtifactMessagePart({
        type: "interactive-artifact",
        artifactID: "artifact_unsafe",
        url: "https://example.com",
      }),
    ).toThrow("must not contain url")
    expect(() =>
      parseConversationInteractiveArtifactMessagePart({
        type: "interactive-artifact",
        artifactID: "artifact_unsafe",
        payload: { renderer: "document@1" },
      }),
    ).toThrow("must not contain payload")

    expect(isConversationRenderableMessagePartType("boundary")).toBe(true)
  })

  test("agent progress activity normalizes text and bounds tool payloads", () => {
    expect(CONVERSATION_AGENT_ACTIVITY_LIMIT).toBe(24)
    expect(
      projectConversationAgentActivityPart({
        id: "part_text",
        orderKey: "v1:0000000000000100:0000000000000030:0000000000000000:part:part_text",
        type: "text",
        text: "  Inspecting\n\n the current layout  ",
      }),
    ).toEqual({
      id: "part_text",
      orderKey: "v1:0000000000000100:0000000000000030:0000000000000000:part:part_text",
      type: "text",
      text: "Inspecting the current layout",
    })
    const tool = projectConversationAgentActivityPart({
      id: "part_tool",
      orderKey: "v1:0000000000000102:0000000000000030:0000000000000000:part:part_tool",
      type: "tool",
      tool: "read_file",
      state: {
        status: "completed",
        input: { file_path: "/repo/src/App.tsx" },
        output: "x".repeat(4_000),
      },
    })
    expect(tool).toMatchObject({
      id: "part_tool",
      type: "tool",
      tool: "read_file",
      state: {
        status: "completed",
        input: { file_path: "/repo/src/App.tsx" },
      },
    })
    expect(JSON.stringify(tool).length).toBeLessThan(1_200)
  })
})
