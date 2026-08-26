import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from "bun:test"
import {
  canLoadOlderConversationHistory,
  loadOlderConversationHistory,
  mergeSessionConnectionSnapshot,
  registerConversationSourceDirectory,
} from "../src/services/conversation"
import { HOST_CAPABILITIES, type HostTransport, type TransportResponse } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { resetWriter } from "../src/services/tree-writer"
import { setBoardStore } from "../src/store/board"
import { cardTreeStore } from "../src/store/card-tree"

const sessionID = "ses_work_connection_snapshot"
const messageID = "msg_work_connection_snapshot"
const partID = "prt_work_connection_snapshot"
const created = 1_750_000_000_000
const messageOrderKey = `v1:${String(created).padStart(16, "0")}:${String(30).padStart(16, "0")}:${String(0).padStart(16, "0")}:message:${messageID}`
const partOrderKey = `v1:${String(created).padStart(16, "0")}:${String(31).padStart(16, "0")}:${String(0).padStart(16, "0")}:part:${partID}`
const originalRequestAnimationFrame = globalThis.requestAnimationFrame
const originalCancelAnimationFrame = globalThis.cancelAnimationFrame

beforeAll(() => {
  globalThis.requestAnimationFrame = (() => 1) as typeof requestAnimationFrame
  globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame
})

afterAll(() => {
  if (originalRequestAnimationFrame) globalThis.requestAnimationFrame = originalRequestAnimationFrame
  else Reflect.deleteProperty(globalThis, "requestAnimationFrame")
  if (originalCancelAnimationFrame) globalThis.cancelAnimationFrame = originalCancelAnimationFrame
  else Reflect.deleteProperty(globalThis, "cancelAnimationFrame")
})

const payload = {
  sessionID,
  conversationSnapshot: {
    transcript: [
      {
        info: {
          id: messageID,
          sessionID,
          role: "user",
          author: "user",
          agent: "work",
          agentID: "work",
          sessionAgentID: "work",
          resolvedRole: "user",
          channel: "assistant",
          originSource: "right-sidebar-conversation",
          extra: { source: "right-sidebar-conversation" },
          orderKey: messageOrderKey,
          time: { created },
        },
        parts: [
          {
            id: partID,
            sessionID,
            messageID,
            type: "text",
            text: "The first Work prompt is projected from the connection snapshot.",
            orderKey: partOrderKey,
          },
        ],
      },
    ],
    view: {
      topLevelSessionIDs: [sessionID],
      sessions: [
        {
          sessionID,
          agentID: "work",
          orderKey: messageOrderKey,
          stage: "user",
          messageIDs: [messageID],
          lastDisplayMessageID: messageID,
          firstMessageTime: created,
          lastMessageTime: created,
          activity: [],
          todos: [],
          todoUpdatedAt: 0,
          placement: "top_level",
        },
      ],
      messages: [
        {
          messageID,
          inputMessageID: messageID,
          orderKey: messageOrderKey,
          sessionID,
          sessionAgentID: "work",
          agentID: "work",
          stage: "user",
          time: created,
          placement: "top_level",
        },
      ],
    },
    history: {
      oldestTimestamp: created,
      oldestOrderKey: messageOrderKey,
      oldestMessageID: messageID,
      hasMore: true,
      limit: 80,
    },
  },
}

beforeEach(() => {
  resetWriter({ scrollIntent: "preserve", cause: "session-connection-snapshot-test" })
})

afterEach(() => {
  setBoardStore("selectedSource", null)
  __setHostTransportForTest(undefined)
})

test("a repeated Session connection snapshot converges to one visible Work user card", () => {
  const source = { kind: "session" as const, id: sessionID }
  mergeSessionConnectionSnapshot(source, payload)
  mergeSessionConnectionSnapshot(source, payload)

  expect(
    cardTreeStore.order.map((cardID) => {
      const card = cardTreeStore.cards[cardID]!
      return {
        cardID,
        kind: card.kind,
        stage: card.stage,
        sessionID: card.sessionID,
        parts: card.parts.map((part) => ({ type: part.type, text: "text" in part ? part.text : undefined })),
      }
    }),
  ).toEqual([
    {
      cardID: `user:session:${sessionID}:message:${messageID}`,
      kind: "message",
      stage: "user",
      sessionID,
      parts: [{ type: "text", text: "The first Work prompt is projected from the connection snapshot." }],
    },
  ])
  expect(canLoadOlderConversationHistory(source)).toBe(true)
})

test("a Session connection snapshot supersedes an older in-flight history cursor", async () => {
  const source = { kind: "session" as const, id: sessionID }
  setBoardStore("selectedSource", source)
  registerConversationSourceDirectory(source, "C:/session-connection-snapshot-test")
  mergeSessionConnectionSnapshot(source, payload)

  let resolveHistory!: (value: TransportResponse<unknown>) => void
  const pendingHistory = new Promise<TransportResponse<unknown>>((resolve) => {
    resolveHistory = resolve
  })
  const transport: HostTransport = {
    kind: "browser",
    capabilities: HOST_CAPABILITIES.browser,
    request: async () => pendingHistory,
    openStream() {
      throw new Error("not used")
    },
    async native() {
      throw new Error("not used")
    },
  }
  __setHostTransportForTest(transport)

  const olderLoad = loadOlderConversationHistory(source)
  mergeSessionConnectionSnapshot(source, {
    ...payload,
    conversationSnapshot: {
      ...payload.conversationSnapshot,
      history: { ...payload.conversationSnapshot.history, hasMore: false },
    },
  })
  resolveHistory({
    status: 200,
    ok: true,
    headers: {},
    body: {
      transcript: [],
      events: [],
      view: { sessions: [], messages: [] },
      history: payload.conversationSnapshot.history,
    },
  })

  await expect(olderLoad).rejects.toMatchObject({ name: "AbortError" })
  expect(canLoadOlderConversationHistory(source)).toBe(false)
})
