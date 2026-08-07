import { afterEach, expect, mock, spyOn, test } from "bun:test"
import { configure } from "../src/services/api"
import { HOST_CAPABILITIES } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type {
  HostTransport,
  StreamHandlers,
  StreamOpenRequest,
  TransportRequest,
  TransportResponse,
} from "../src/services/host-transport"
import { boardStore, clearBoard, loadBoard, setBoardStore, setTasksData } from "../src/store/board"
import { setChatRequest } from "../src/store/messages"
import { registerConversationSourceDirectory } from "../src/services/conversation"
import { panelMessage, promptSessionMessage, stopChatRequest } from "../src/services/chat"
import { selectTask } from "../src/services/task"
import { taskOwningDirectory } from "../src/services/task-directory"
import { currentTraceDirectory } from "../src/services/trace-directory"
import { stopSSE } from "../src/services/sse"
import { AppLog } from "../src/utils/log"
import { setLocale } from "../src/utils/i18n"
import { installRealOverlayI18n } from "./fixtures/i18n"
import { setSettingsStore } from "../src/store/settings"
import { setAppStore } from "../src/store/app"
import { testTaskOrderKey } from "./fixtures/timeline-order"

installRealOverlayI18n()
await setLocale("en-US")

globalThis.requestAnimationFrame = (callback) => {
  callback(performance.now())
  return 0
}

const SETTINGS_DIRECTORY = "D:/repo/from-settings"
const TASK_DIRECTORY = "D:/repo/from-task-row"
const SESSION_DIRECTORY = "D:/repo/from-session-row"

function fakeTransport(
  responder: (req: TransportRequest) => Promise<TransportResponse<unknown>> | TransportResponse<unknown>,
): HostTransport {
  return {
    kind: "tauri",
    capabilities: HOST_CAPABILITIES.tauri,
    async request<T>(req: TransportRequest): Promise<TransportResponse<T>> {
      return responder(req) as Promise<TransportResponse<T>> | TransportResponse<T>
    },
    openStream(_input: StreamOpenRequest, _handlers: StreamHandlers) {
      throw new Error("openStream not used")
    },
    async native() {
      throw new Error("native not used")
    },
  }
}

function ok(body: unknown = {}): TransportResponse<unknown> {
  return { status: 200, ok: true, headers: {}, body }
}

afterEach(() => {
  mock.restore()
  stopSSE()
  clearBoard()
  __setHostTransportForTest(undefined)
  configure({ directory: "" })
  setBoardStore("selectedSource", null)
  setBoardStore("board", null)
  setBoardStore("path", null)
  setBoardStore("vcs", null)
  setTasksData([])
  setChatRequest(null)
  setAppStore("connected", false)
})

function taskListItem(id: string, directory: string, updated = 1): unknown {
  return {
    task: {
      id,
      orderKey: testTaskOrderKey(id, updated),
      title: id,
      directory,
      status: "active",
      time: { created: updated, updated },
    },
    updated_at: updated,
  }
}

test("task-scoped board clearing preserves project path and VCS metadata", () => {
  const path = { directory: SETTINGS_DIRECTORY }
  const vcs = { initialized: true, branch: "main", clean: true, dirty: false }
  setBoardStore("path", path)
  setBoardStore("vcs", vcs)
  setBoardStore("board", { snapshotVersion: "board:clear", task: null })

  clearBoard()

  expect(boardStore.board).toBeNull()
  expect(boardStore.path).toEqual(path)
  expect(boardStore.vcs).toEqual(vcs)
})

function conversationPayload(taskID: string, directory: string): unknown {
  return {
    board: {
      snapshotVersion: `board:${taskID}`,
      task: {
        id: taskID,
        sessionID: `ses_${taskID}`,
        orderKey: testTaskOrderKey(taskID, 1),
        title: taskID,
        directory,
        status: "active",
        time: { created: 1, updated: 1 },
      },
    },
    transcript: [],
    timeline: [],
    events: [],
    turnArtifacts: [],
    view: {},
    agentView: { topLevelExecutionIDs: [], sessions: [], messages: [] },
    eventReplay: { cursor: 0, latestSequence: 0, complete: true, limit: 100, sinceTimestamp: null },
    history: { oldestTimestamp: null, oldestOrderKey: null, oldestMessageID: null, hasMore: false, limit: 100 },
    messageWatermark: 0,
    lastSequence: 0,
  }
}

function userMessage(sessionID: string): unknown {
  return {
    info: {
      id: `msg_${sessionID}`,
      role: "user",
      author: "user",
      originSource: "",
      resolvedRole: "user",
      channel: "main",
      agentID: "user",
      sessionAgentID: "user",
      sessionID,
      time: { created: 1 },
      orderKey: `v1:0000000000000001:0000000000000030:0000000000000000:message:msg_${sessionID}`,
    },
    parts: [
      {
        id: `part_${sessionID}`,
        type: "text",
        text: "operator input",
        role: "user",
        author: "user",
        originSource: "",
        channel: "main",
        resolvedRole: "user",
        messageID: `msg_${sessionID}`,
        sessionID,
        orderKey: `v1:0000000000000001:0000000000000031:0000000000000000:part:part_${sessionID}`,
      },
    ],
  }
}

test("taskOwningDirectory rejects task IDs without a frozen row or board directory", () => {
  configure({ directory: SETTINGS_DIRECTORY })

  expect(() => taskOwningDirectory("tsk_missing")).toThrow("owning project directory")
})

test("taskOwningDirectory keeps the selected task source directory through project-scope reloads", () => {
  configure({ directory: SETTINGS_DIRECTORY })
  setBoardStore("selectedSource", { kind: "task", id: "tsk_selected", directory: TASK_DIRECTORY })

  expect(taskOwningDirectory("tsk_selected")).toBe(TASK_DIRECTORY)
})

test("taskOwningDirectory rejects inconsistent selected source and task row directories", () => {
  configure({ directory: SETTINGS_DIRECTORY })
  setTasksData([
    {
      task: {
        id: "tsk_inconsistent",
        directory: TASK_DIRECTORY,
        status: "active",
        time: { created: 1, updated: 1 },
      },
      updated_at: 1,
    },
  ])
  setBoardStore("selectedSource", {
    kind: "task",
    id: "tsk_inconsistent",
    directory: "D:/repo/other-task-row",
  })

  expect(() => taskOwningDirectory("tsk_inconsistent")).toThrow("inconsistent project directories")
})

test("selectTask refreshes same-directory explicit notification targets before ownership validation", async () => {
  const taskID = "tsk_notification_open"
  const captures: TransportRequest[] = []
  const streams: StreamOpenRequest[] = []
  configure({ directory: TASK_DIRECTORY })
  setAppStore("connected", true)
  setSettingsStore("directory", TASK_DIRECTORY)
  setTasksData([taskListItem(taskID, SESSION_DIRECTORY)])

  __setHostTransportForTest({
    kind: "tauri",
    capabilities: HOST_CAPABILITIES.tauri,
    async request(req) {
      captures.push(req)
      if (req.path === "global/tasks") {
        return ok({ tasks: [taskListItem(taskID, TASK_DIRECTORY)] })
      }
      if (req.path === `task/${taskID}/conversation`) {
        expect(req.query?.directory).toBe(TASK_DIRECTORY)
        return ok(conversationPayload(taskID, TASK_DIRECTORY))
      }
      if (req.path === `session/ses_${taskID}/config`) return ok({ config: { model: "" } })
      throw new Error(`unexpected request: ${req.path}`)
    },
    openStream(req) {
      streams.push(req)
      return { close() {} }
    },
    async native(command) {
      if (command.kind === "settings.save") return true
      throw new Error(`unexpected native command: ${command.kind}`)
    },
  } satisfies HostTransport)

  await selectTask(taskID, { directory: TASK_DIRECTORY })

  expect(captures.map((req) => req.path)).toEqual([
    "global/tasks",
    `task/${taskID}/conversation`,
    `session/ses_${taskID}/config`,
  ])
  expect(streams[0]?.path).toBe(`task/${taskID}/events`)
  expect(streams[0]?.query?.directory).toBe(TASK_DIRECTORY)
  expect(taskOwningDirectory(taskID)).toBe(TASK_DIRECTORY)
})

test("panelMessage sends task messages with the task row directory", async () => {
  const captures: TransportRequest[] = []
  configure({ directory: SETTINGS_DIRECTORY })
  setTasksData([
    {
      task: {
        id: "tsk_chat",
        directory: TASK_DIRECTORY,
        status: "active",
        time: { created: 1, updated: 1 },
      },
      updated_at: 1,
    },
  ])
  setBoardStore("selectedSource", { kind: "task", id: "tsk_chat" })
  setBoardStore("board", {
    snapshotVersion: "board:chat",
    task: {
      id: "tsk_chat",
      directory: TASK_DIRECTORY,
      status: "active",
      sessionID: "ses_task",
      time: { created: 1, updated: 1 },
    },
  })

  __setHostTransportForTest(
    fakeTransport((req) => {
      captures.push(req)
      if (req.path === "task/tsk_chat/board") return { status: 304, ok: true, headers: {}, body: {} }
      return ok({ user_message: userMessage("ses_task") })
    }),
  )

  await panelMessage("continue")

  expect(captures[0]?.path).toBe("task/tsk_chat/message")
  expect(captures[0]?.query?.directory).toBe(TASK_DIRECTORY)
})

test("loadBoard refreshes the selected task with its row directory", async () => {
  let captured: TransportRequest | undefined
  configure({ directory: SETTINGS_DIRECTORY })
  setTasksData([
    {
      task: {
        id: "tsk_board",
        directory: TASK_DIRECTORY,
        status: "active",
        time: { created: 1, updated: 1 },
      },
      updated_at: 1,
    },
  ])
  setBoardStore("selectedSource", { kind: "task", id: "tsk_board" })

  __setHostTransportForTest(
    fakeTransport((req) => {
      captured = req
      return ok({
        snapshotVersion: "board:test",
        task: {
          id: "tsk_board",
          orderKey: testTaskOrderKey("tsk_board", 1),
          directory: TASK_DIRECTORY,
          status: "active",
          time: { created: 1, updated: 1 },
        },
        lastSequence: 0,
      })
    }),
  )

  await loadBoard({ sync: true })

  expect(captured?.path).toBe("task/tsk_board/board")
  expect(captured?.query?.sync).toBe("1")
  expect(captured?.query?.directory).toBe(TASK_DIRECTORY)
})

test("loadBoard requireFresh rejects selected-task board reload failures", async () => {
  let captured: TransportRequest | undefined
  configure({ directory: SETTINGS_DIRECTORY })
  setTasksData([
    {
      task: {
        id: "tsk_board_fail",
        directory: TASK_DIRECTORY,
        status: "active",
        time: { created: 1, updated: 1 },
      },
      updated_at: 1,
    },
  ])
  setBoardStore("selectedSource", { kind: "task", id: "tsk_board_fail" })

  __setHostTransportForTest(
    fakeTransport((req) => {
      captured = req
      return { status: 500, ok: false, headers: {}, body: { error: "board reload failed" } }
    }),
  )

  const originalConsoleError = console.error
  try {
    console.error = () => undefined
    await expect(loadBoard({ sync: true, requireFresh: true })).rejects.toThrow(/board reload failed/)
  } finally {
    console.error = originalConsoleError
  }

  expect(captured?.path).toBe("task/tsk_board_fail/board")
  expect(captured?.query?.sync).toBe("1")
  expect(captured?.query?.directory).toBe(TASK_DIRECTORY)
  expect(boardStore.boardRetryCount).toBe(0)
})

test("loadBoard requireFresh starts after an older in-flight board refresh settles", async () => {
  let releaseFirst!: () => void
  const firstPending = new Promise<void>((resolve) => {
    releaseFirst = resolve
  })
  const captures: TransportRequest[] = []
  let requestIndex = 0
  configure({ directory: SETTINGS_DIRECTORY })
  setTasksData([
    {
      task: {
        id: "tsk_board_fresh",
        directory: TASK_DIRECTORY,
        status: "active",
        time: { created: 1, updated: 1 },
      },
      updated_at: 1,
    },
  ])
  setBoardStore("selectedSource", { kind: "task", id: "tsk_board_fresh" })

  __setHostTransportForTest(
    fakeTransport(async (req) => {
      captures.push(req)
      requestIndex += 1
      const current = requestIndex
      if (current === 1) await firstPending
      return ok({
        snapshotVersion: current === 1 ? "board:stale" : "board:fresh",
        task: {
          id: "tsk_board_fresh",
          orderKey: testTaskOrderKey("tsk_board_fresh", 1),
          directory: TASK_DIRECTORY,
          status: "active",
          time: { created: 1, updated: current },
        },
        lastSequence: current,
      })
    }),
  )

  const stale = loadBoard({ sync: true })
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(captures).toHaveLength(1)

  const requiredFresh = loadBoard({ sync: true, requireFresh: true })
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(captures).toHaveLength(1)

  releaseFirst()
  await Promise.all([stale, requiredFresh])

  expect(captures.map((req) => req.path)).toEqual(["task/tsk_board_fresh/board", "task/tsk_board_fresh/board"])
  expect(captures.map((req) => req.query?.sync)).toEqual(["1", "1"])
  expect(boardStore.snapshotVersion).toBe("board:fresh")
})

test("loadBoard requireFresh rechecks selected task after stale in-flight board refresh settles", async () => {
  let releaseFirst!: () => void
  const firstPending = new Promise<void>((resolve) => {
    releaseFirst = resolve
  })
  const captures: TransportRequest[] = []
  let requestIndex = 0
  configure({ directory: SETTINGS_DIRECTORY })
  setTasksData([
    {
      task: {
        id: "tsk_board_initial",
        directory: TASK_DIRECTORY,
        status: "active",
        time: { created: 1, updated: 1 },
      },
      updated_at: 1,
    },
    {
      task: {
        id: "tsk_board_current",
        directory: SESSION_DIRECTORY,
        status: "active",
        time: { created: 2, updated: 2 },
      },
      updated_at: 2,
    },
  ])
  setBoardStore("selectedSource", { kind: "task", id: "tsk_board_initial" })

  __setHostTransportForTest(
    fakeTransport(async (req) => {
      captures.push(req)
      requestIndex += 1
      const current = requestIndex
      if (current === 1) await firstPending
      const taskID = current === 1 ? "tsk_board_initial" : "tsk_board_current"
      const directory = current === 1 ? TASK_DIRECTORY : SESSION_DIRECTORY
      return ok({
        snapshotVersion: `board:${taskID}`,
        task: {
          id: taskID,
          orderKey: testTaskOrderKey(taskID, current),
          directory,
          status: "active",
          time: { created: current, updated: current },
        },
        lastSequence: current,
      })
    }),
  )

  const stale = loadBoard({ sync: true })
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(captures).toHaveLength(1)

  const requiredFresh = loadBoard({ sync: true, requireFresh: true })
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(captures).toHaveLength(1)
  setBoardStore("selectedSource", { kind: "task", id: "tsk_board_current" })

  releaseFirst()
  await Promise.all([stale, requiredFresh])

  expect(captures.map((req) => req.path)).toEqual(["task/tsk_board_initial/board", "task/tsk_board_current/board"])
  expect(captures.map((req) => req.query?.directory)).toEqual([TASK_DIRECTORY, SESSION_DIRECTORY])
  expect(boardStore.snapshotVersion).toBe("board:tsk_board_current")
})

test("loadBoard reports non-required selected-task board refresh failures visibly and retries", async () => {
  configure({ directory: SETTINGS_DIRECTORY })
  setTasksData([
    {
      task: {
        id: "tsk_board_visible_fail",
        directory: TASK_DIRECTORY,
        status: "active",
        time: { created: 1, updated: 1 },
      },
      updated_at: 1,
    },
  ])
  setBoardStore("selectedSource", { kind: "task", id: "tsk_board_visible_fail" })

  __setHostTransportForTest(
    fakeTransport((req) => {
      if (req.path === "task/tsk_board_visible_fail/board") {
        return { status: 500, ok: false, headers: {}, body: { error: "board refresh failed" } }
      }
      return ok()
    }),
  )
  const logError = spyOn(AppLog, "error").mockImplementation(() => undefined)

  await loadBoard({ sync: true })

  expect(logError).toHaveBeenCalledTimes(1)
  expect(logError.mock.calls[0]?.[0]).toBe("board")
  expect(logError.mock.calls[0]?.[1]).toBe("Selected task board refresh failed")
  expect(logError.mock.calls[0]?.[2]).toMatchObject({
    taskID: "tsk_board_visible_fail",
    diagnosticID: "board:refresh-failed:tsk_board_visible_fail",
    diagnosticTitle: "Task board refresh failed",
  })
  expect(boardStore.boardRetryCount).toBeGreaterThan(0)
})

test("currentTraceDirectory uses selected task and session owning directories", () => {
  configure({ directory: SETTINGS_DIRECTORY })
  setBoardStore("selectedSource", { kind: "task", id: "tsk_trace" })
  setBoardStore("board", {
    snapshotVersion: "board:trace",
    task: {
      id: "tsk_trace",
      directory: TASK_DIRECTORY,
      status: "active",
      time: { created: 1, updated: 1 },
    },
  })
  expect(currentTraceDirectory()).toBe(TASK_DIRECTORY)

  setBoardStore("selectedSource", { kind: "session", id: "ses_trace" })
  setBoardStore("board", null)
  registerConversationSourceDirectory({ kind: "session", id: "ses_trace" }, SESSION_DIRECTORY)
  expect(currentTraceDirectory()).toBe(SESSION_DIRECTORY)
})

test("panelMessage sends session prompts with the registered session directory", async () => {
  let captured: TransportRequest | undefined
  configure({ directory: SETTINGS_DIRECTORY })
  setBoardStore("selectedSource", { kind: "session", id: "ses_mission" })
  registerConversationSourceDirectory({ kind: "session", id: "ses_mission" }, SESSION_DIRECTORY)

  __setHostTransportForTest(
    fakeTransport((req) => {
      captured = req
      return ok({ user_message: userMessage("ses_mission") })
    }),
  )

  await panelMessage("continue mission")

  expect(captured?.path).toBe("session/ses_mission/prompt_async")
  expect(captured?.query?.directory).toBe(SESSION_DIRECTORY)
})

test("promptSessionMessage sends an artifact-owned prompt to its exact session instead of the active selection", async () => {
  let captured: TransportRequest | undefined
  configure({ directory: SETTINGS_DIRECTORY })
  setBoardStore("selectedSource", { kind: "session", id: "ses_other" })
  registerConversationSourceDirectory({ kind: "session", id: "ses_other" }, SETTINGS_DIRECTORY)

  __setHostTransportForTest(
    fakeTransport((req) => {
      captured = req
      return ok({ user_message: userMessage("ses_artifact") })
    }),
  )

  await promptSessionMessage({
    sessionID: "ses_artifact",
    directory: SESSION_DIRECTORY,
    text: "message from bound artifact",
    metadata: { source: "mcp-app", artifactID: "art_1" },
  })

  expect(captured?.path).toBe("session/ses_artifact/prompt_async")
  expect(captured?.query?.directory).toBe(SESSION_DIRECTORY)
  expect(captured?.body?.kind).toBe("json")
  expect(captured?.body?.value).toMatchObject({
    parts: [
      {
        type: "text",
        text: "message from bound artifact",
        metadata: { source: "mcp-app", artifactID: "art_1" },
      },
    ],
  })
})

test("stopChatRequest sends aborts with the request target directory", async () => {
  let captured: TransportRequest | undefined
  configure({ directory: SETTINGS_DIRECTORY })
  setBoardStore("selectedSource", { kind: "task", id: "tsk_other" })
  setBoardStore("board", {
    snapshotVersion: "board:abort",
    task: {
      id: "tsk_other",
      directory: TASK_DIRECTORY,
      status: "active",
      sessionID: "ses_other",
      time: { created: 1, updated: 1 },
    },
  })

  __setHostTransportForTest(
    fakeTransport((req) => {
      captured = req
      return ok()
    }),
  )

  setChatRequest({
    requestID: "req_abort",
    controller: new AbortController(),
    target: { kind: "task", taskID: "tsk_abort", directory: TASK_DIRECTORY },
  })

  await stopChatRequest()

  expect(captured?.path).toBe("task/tsk_abort/cancel")
  expect(captured?.query?.directory).toBe(TASK_DIRECTORY)
  expect(captured?.body).toEqual({
    kind: "json",
    value: {
      surface: "overlay.chat_request_stop",
      reason: "Operator stopped the active task chat request",
    },
  })
})

test("stopChatRequest exposes exact-target failure without trying current board identities", async () => {
  const captures: TransportRequest[] = []
  setBoardStore("selectedSource", { kind: "task", id: "tsk_other" })
  setBoardStore("board", {
    snapshotVersion: "board:abort-failure",
    task: {
      id: "tsk_other",
      directory: TASK_DIRECTORY,
      status: "active",
      sessionID: "ses_other",
      time: { created: 1, updated: 1 },
    },
  })
  __setHostTransportForTest(
    fakeTransport((req) => {
      captures.push(req)
      throw new Error("exact cancellation failed")
    }),
  )
  setChatRequest({
    requestID: "req_abort_failure",
    controller: new AbortController(),
    target: { kind: "session", sessionID: "ses_exact", directory: SESSION_DIRECTORY },
  })

  await expect(stopChatRequest()).rejects.toThrow("exact cancellation failed")

  expect(captures).toHaveLength(1)
  expect(captures[0]?.path).toBe("session/ses_exact/abort")
  expect(captures[0]?.query?.directory).toBe(SESSION_DIRECTORY)
})
