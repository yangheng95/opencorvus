import { afterEach, expect, test } from "bun:test"

import type { HostTransport, TransportRequest, TransportResponse } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import enUS from "../src/i18n/en-US.json"
import {
  loadSubagentConversation,
  mergeSubagentConversation,
  projectSubagentConversationCard,
  subagentConversationTranscriptRevision,
} from "../src/services/subagent-conversation"
import { setLocaleData } from "../src/utils/i18n"

setLocaleData("en-US", enUS)

function orderKey(time: number, id: string): string {
  return `v1:${String(time).padStart(16, "0")}:0000000000000030:0000000000000000:message:${id}`
}

function transport(requests: TransportRequest[], response: Record<string, unknown>): HostTransport {
  return {
    kind: "tauri",
    async request<T>(request: TransportRequest): Promise<TransportResponse<T>> {
      requests.push(request)
      return { status: 200, ok: true, headers: {}, body: response as T }
    },
    openStream() {
      throw new Error("openStream not used in subagent conversation tests")
    },
    async native() {
      throw new Error("native not used in subagent conversation tests")
    },
    onUiCommand() {
      return { unsubscribe() {} }
    },
  } as unknown as HostTransport
}

function payload() {
  return {
    lastLiveSequence: 12,
    liveEpoch: 1779000000000,
    transcriptMode: "snapshot",
    removedMessageIDs: [],
    transcript: [
      {
        info: {
          id: "message-late",
          sessionID: "child-session",
          role: "assistant",
          author: "build-agent",
          channel: "build",
        },
        parts: [{ id: "late-text", type: "text", text: "Done" }],
      },
      {
        info: {
          id: "message-early",
          sessionID: "child-session",
          role: "user",
          author: "orchestrator",
          channel: "build",
          originSource: "delegate_agent",
        },
        parts: [{ id: "early-text", type: "text", text: "Starting" }],
      },
    ],
    view: {
      messages: [
        {
          messageID: "message-late",
          sessionID: "child-session",
          agentID: "build-agent",
          stage: "build",
          time: 200,
          orderKey: orderKey(200, "message-late"),
        },
        {
          messageID: "message-early",
          sessionID: "child-session",
          agentID: "build-agent",
          stage: "build",
          time: 100,
          orderKey: orderKey(100, "message-early"),
        },
      ],
    },
  }
}

afterEach(() => __setHostTransportForTest(undefined))

test("task child transcript uses the exact task/session route and canonical order", async () => {
  const requests: TransportRequest[] = []
  __setHostTransportForTest(transport(requests, payload()))

  const result = await loadSubagentConversation({
    source: { kind: "task", id: "task one" },
    sessionID: "child/session",
    directory: "D:/repo",
  })

  expect(requests).toHaveLength(1)
  expect(requests[0]?.path).toBe("task/task%20one/conversation/session/child%2Fsession")
  expect(requests[0]?.query?.directory).toBe("D:/repo")
  expect(result.messages.map((message) => message.messageID)).toEqual(["message-early", "message-late"])
  expect(result.messages[0]?.parts[0]?.text).toBe("Starting")

  const card = projectSubagentConversationCard(result, "running")
  expect(card).toMatchObject({
    id: "subagent-transcript:child/session",
    kind: "agent",
    sessionID: "child/session",
    status: "running",
  })
  expect(card?.collapsedContextMessageIDs).toEqual(["message-early"])
  expect(card?.parts.map((part) => part.type)).toEqual(["text", "boundary", "text"])
  expect(card?.parts.filter((part) => part.type === "text").map((part) => part.messageID)).toEqual([
    "message-early",
    "message-late",
  ])
})

test("standalone child transcript is rooted at the selected session", async () => {
  const requests: TransportRequest[] = []
  __setHostTransportForTest(transport(requests, payload()))

  await loadSubagentConversation({
    source: { kind: "session", id: "parent-session" },
    sessionID: "child-session",
    directory: "/repo",
  })

  expect(requests[0]?.path).toBe("session/child-session/conversation")
  expect(requests[0]?.query).toMatchObject({ directory: "/repo", tail_limit: "2000" })
})

test("transcript identity drift is rejected instead of silently merging sessions", async () => {
  const response = payload()
  response.transcript[0]!.info.sessionID = "another-session"
  __setHostTransportForTest(transport([], response))

  await expect(
    loadSubagentConversation({
      source: { kind: "task", id: "task-one" },
      sessionID: "child-session",
      directory: "/repo",
    }),
  ).rejects.toThrow("session identity drift")
})

test("transcript revision follows only exact selected-session transcript facts", () => {
  const base = {
    sessionID: "child-session",
    transcriptSequence: 200,
  }
  expect(subagentConversationTranscriptRevision(base)).toBe('["child-session",200]')
  expect(
    subagentConversationTranscriptRevision({
      ...base,
      transcriptSequence: 201,
    }),
  ).toBe('["child-session",201]')
})

test("task transcript delta replaces changed messages and removes deleted messages", () => {
  const current = {
    sessionID: "child-session",
    lastLiveSequence: 12,
    liveEpoch: 1779000000000,
    transcriptMode: "delta",
    removedMessageIDs: [],
    messages: [
      { messageID: "message-early", orderKey: orderKey(100, "message-early") },
      { messageID: "message-late", orderKey: orderKey(200, "message-late"), info: { error: "old" } },
    ],
  } as any
  const delta = {
    sessionID: "child-session",
    lastLiveSequence: 15,
    liveEpoch: 1779000000000,
    transcriptMode: "delta",
    removedMessageIDs: ["message-early", "message-late"],
    messages: [
      { messageID: "message-late", orderKey: orderKey(200, "message-late"), info: { error: "updated" } },
    ],
  } as any

  expect(mergeSubagentConversation(current, delta)).toMatchObject({
    lastLiveSequence: 15,
    liveEpoch: 1779000000000,
    transcriptMode: "delta",
    removedMessageIDs: [],
    messages: [{ messageID: "message-late", info: { error: "updated" } }],
  })
})

test("task transcript snapshot replaces the prior live epoch", () => {
  const current = {
    sessionID: "child-session",
    lastLiveSequence: 91,
    liveEpoch: 1779000000000,
    transcriptMode: "delta",
    removedMessageIDs: [],
    messages: [{ messageID: "stale-message", orderKey: orderKey(100, "stale-message") }],
  } as any
  const snapshot = {
    sessionID: "child-session",
    lastLiveSequence: 0,
    liveEpoch: 1779000001000,
    transcriptMode: "snapshot",
    removedMessageIDs: [],
    messages: [{ messageID: "current-message", orderKey: orderKey(200, "current-message") }],
  } as any

  expect(mergeSubagentConversation(current, snapshot)).toMatchObject({
    lastLiveSequence: 0,
    liveEpoch: 1779000001000,
    transcriptMode: "snapshot",
    removedMessageIDs: [],
    messages: [{ messageID: "current-message" }],
  })
})
