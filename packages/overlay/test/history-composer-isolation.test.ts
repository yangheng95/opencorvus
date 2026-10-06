import { afterEach, beforeEach, expect, test } from "bun:test"
import { ApiError, configure } from "../src/services/api"
import { selectTask } from "../src/services/task"
import { beginWorkspaceSelection } from "../src/services/workspace"
import { stopSSE } from "../src/services/sse"
import { resetConversationProjection, retireConversationSource } from "../src/services/conversation"
import { clearComposerModelProjection } from "../src/services/composer-model"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import {
  HOST_CAPABILITIES,
  type HostTransport,
  type StreamHandlers,
  type StreamOpenRequest,
  type TransportRequest,
  type TransportResponse,
} from "../src/services/host-transport"
import { appStore, setAppStore } from "../src/store/app"
import { boardStore, clearBoard, setBoardStore } from "../src/store/board"
import { cardTreeStore } from "../src/store/card-tree"
import { messageStore } from "../src/store/messages"
import { DEFAULT_SETTINGS, applySettings } from "../src/store/settings"
import { testMessageOrderKey, testPartOrderKey, testTaskOrderKey } from "./fixtures/timeline-order"
import { getLocale, setLocaleData } from "../src/utils/i18n"
import english from "../src/i18n/en-US.json"
import chinese from "../src/i18n/zh-CN.json"

// Actual store/service scheduling only: no DOM, components or module mocks.
const frames = new Map<number, FrameRequestCallback>()
let frameID = 0
const originalFrame = globalThis.requestAnimationFrame
const originalCancelFrame = globalThis.cancelAnimationFrame
const directory = "D:/owned/history-composer"
const taskID = "tsk_history_composer"
const sessionID = "ses_history_root"
const messageID = "msg_history_answer"
const body = "Persisted historical answer"
const configFailure = {
  name: "ProviderModelNotFoundError",
  data: { providerID: "openai", modelID: "gpt-6.1-sol", suggestions: [] },
}
const historyFailure = { name: "ConversationHistoryError", data: { message: "Owned history unavailable" } }

function settleFrames() {
  while (frames.size) {
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach((callback) => callback(0))
  }
}

function history() {
  const orderKey = testMessageOrderKey(messageID, 1100)
  return {
    board: {
      snapshotVersion: "owned-history-version",
      rewindCursor: null,
      task: {
        id: taskID,
        directory,
        sessionID,
        title: "Owned history",
        status: "completed",
        orderKey: testTaskOrderKey(taskID, 1000),
        time: { created: 1000 },
      },
      interactions: [],
      goals: [],
    },
    transcript: [
      {
        info: {
          id: messageID,
          sessionID,
          parentID: "msg_history_input",
          role: "assistant",
          author: "assistant",
          agentID: "assistant",
          sessionAgentID: "assistant",
          resolvedRole: "assistant",
          channel: "assistant",
          originSource: "",
          parentSessionID: "",
          orderKey,
          time: { created: 1100, completed: 1200 },
          finish: "stop",
        },
        parts: [
          {
            id: "prt_history_text",
            type: "text",
            messageID,
            sessionID,
            orderKey: testPartOrderKey("prt_history_text", 1101),
            text: body,
          },
        ],
      },
    ],
    view: {
      sessions: [{ sessionID, agentID: "assistant", messageIDs: [messageID] }],
      messages: [
        {
          messageID,
          inputMessageID: "msg_history_input",
          sessionID,
          sessionAgentID: "assistant",
          agentID: "assistant",
          stage: "assistant",
          time: 1100,
          orderKey,
        },
      ],
    },
    agentView: { sessions: [], messages: [], topLevelExecutionIDs: [] },
    turnArtifacts: [],
    events: [],
    lastSequence: 7,
    eventReplay: { cursor: 7, latestSequence: 7, complete: true, limit: 8, sinceTimestamp: null },
    history: { oldestTimestamp: 1100, oldestOrderKey: orderKey, oldestMessageID: messageID, hasMore: false, limit: 8 },
  }
}

beforeEach(() => {
  setLocaleData(getLocale(), getLocale() === "zh-CN" ? chinese : english)
  globalThis.requestAnimationFrame = (callback) => {
    frames.set(++frameID, callback)
    return frameID
  }
  globalThis.cancelAnimationFrame = (id) => {
    frames.delete(id)
  }
  configure({ serverUrl: "http://history-fixture.invalid", directory, password: "" })
  applySettings({ ...DEFAULT_SETTINGS, directory })
  setAppStore({ connected: true, composerModel: "previous/model", composerModelIssue: null })
  setBoardStore({
    selectedSource: null,
    selectEpoch: 0,
    taskSwitching: false,
    taskSelectionError: null,
    tasks: [{ task: history().board.task }],
  })
  clearBoard()
  resetConversationProjection({ cause: "history-composer-service-test" })
  settleFrames()
})

afterEach(() => {
  stopSSE()
  retireConversationSource()
  clearComposerModelProjection()
  clearBoard()
  resetConversationProjection({ cause: "history-composer-service-test-cleanup" })
  settleFrames()
  setBoardStore({ selectedSource: null, tasks: [], taskSwitching: false, taskSelectionError: null })
  __setHostTransportForTest(undefined)
  applySettings({ ...DEFAULT_SETTINGS })
  configure({ serverUrl: "http://127.0.0.1:7878", directory: "" })
  if (originalFrame) globalThis.requestAnimationFrame = originalFrame
  else Reflect.deleteProperty(globalThis, "requestAnimationFrame")
  if (originalCancelFrame) globalThis.cancelAnimationFrame = originalCancelFrame
  else Reflect.deleteProperty(globalThis, "cancelAnimationFrame")
})

function installTransport(failHistory: boolean) {
  const requests: TransportRequest[] = []
  const opens: Array<{ request: StreamOpenRequest; handlers: StreamHandlers; closed: boolean }> = []
  const transport: HostTransport = {
    kind: "browser",
    capabilities: HOST_CAPABILITIES.browser,
    async request<T>(request: TransportRequest): Promise<TransportResponse<T>> {
      requests.push(request)
      if (request.path === `task/${taskID}/conversation`)
        return {
          ok: !failHistory,
          status: failHistory ? 409 : 200,
          headers: { "x-opencorvus-request-id": "history-request" },
          body: (failHistory ? historyFailure : history()) as T,
        }
      if (request.path === `session/${sessionID}/config`)
        return {
          ok: false,
          status: 400,
          headers: { "x-opencorvus-request-id": "config-request" },
          body: configFailure as T,
        }
      throw new Error(`Unexpected service request ${request.path}`)
    },
    openStream(request, handlers) {
      const entry = { request, handlers, closed: false }
      opens.push(entry)
      return {
        close() {
          entry.closed = true
        },
      }
    },
    async native(command) {
      if (command.kind === "settings.save") return true
      throw new Error(`Unexpected native service ${command.kind}`)
    },
  }
  __setHostTransportForTest(transport)
  return { requests, opens }
}

test("actual Task selection retains successful persisted history and SSE when current Composer config returns typed400", async () => {
  const transport = installTransport(false)
  await selectTask(taskID, { selectionEpoch: beginWorkspaceSelection() })
  for (let index = 0; index < 100 && !appStore.composerModelIssue; index++) await Promise.resolve()
  settleFrames()
  expect(boardStore.selectedSource).toEqual({ kind: "task", id: taskID, directory })
  expect(boardStore.board.task).toMatchObject({ id: taskID, sessionID, status: "completed" })
  expect(
    Object.values(cardTreeStore.cards)
      .flatMap((card) => card.parts)
      .filter((part) => part.type === "text")
      .map((part) => part.text),
  ).toEqual([body])
  expect(
    transport.opens.map((entry) => ({
      path: entry.request.path,
      directory: entry.request.query?.directory,
      closed: entry.closed,
    })),
  ).toEqual([{ path: `task/${taskID}/events`, directory, closed: false }])
  transport.opens[0]!.handlers.onOpen?.()
  expect(messageStore.sseStatus).toBe("connected")
  expect(appStore.composerModel).toBe("")
  expect(appStore.composerModelIssue?.error).toBeInstanceOf(ApiError)
  expect(appStore.composerModelIssue).toMatchObject({
    retrying: false,
    error: { status: 400, body: configFailure, requestID: "config-request" },
  })
  expect({
    switching: boardStore.taskSwitching,
    selectionError: boardStore.taskSelectionError,
    persisted: boardStore.board.task.id,
  }).toEqual({ switching: false, selectionError: null, persisted: taskID })
})

test("a typed historical load failure retains the original Task selection error contract", async () => {
  installTransport(true)
  const error = await selectTask(taskID, { selectionEpoch: beginWorkspaceSelection() }).catch(
    (failure: unknown) => failure,
  )
  expect(error).toBeInstanceOf(ApiError)
  expect(error).toMatchObject({ status: 409, body: historyFailure, requestID: "history-request" })
  expect(boardStore.taskSelectionError).toMatchObject({ taskID, directory, title: "Owned history" })
  expect(boardStore.taskSwitching).toBe(false)
})
