import { afterEach, expect, test } from "bun:test"

import type { HostTransport, TransportRequest, TransportResponse } from "../src/services/host-transport"
import { HOST_CAPABILITIES } from "../src/services/host-transport"
import { ApiAuthorityChangedError, captureApiAuthority, configure, renewApiAuthority } from "../src/services/api"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import enUS from "../src/i18n/en-US.json"
import {
  createSubagentConversationLiveProjection,
  createSubagentTranscriptRefreshController,
  loadSubagentConversation,
  mergeSubagentConversation,
  observeSubagentConversationLiveEvent,
  projectSubagentConversationLive,
  projectSubagentConversationCard,
  subagentConversationTargetKey,
  subagentConversationTranscriptRevision,
  parseSubagentConversation,
  type SubagentConversationTarget,
} from "../src/services/subagent-conversation"
import { setLocaleData } from "../src/utils/i18n"
import { connectSideChat } from "../src/services/side-chat"
import type { StreamHandlers, StreamOpenRequest } from "../src/services/host-transport"

setLocaleData("en-US", enUS)

test("actual control-only owner accepts pending Part without message replay", () => {
  const target: SubagentConversationTarget = {
    source: { kind: "task", id: "task-one" },
    sessionID: "child-session",
    directory: "/repo",
    authority: captureApiAuthority(),
  }
  const info = (id: string, time: number) => ({
    id,
    sessionID: target.sessionID,
    agentID: "build-agent",
    sessionAgentID: "build-agent",
    role: "assistant",
    author: "build-agent",
    channel: "build",
    originSource: "",
    resolvedRole: "build",
    orderKey: orderKey(time, id),
    time: { created: time },
  })
  const visible = info("visible-message", 100),
    control = info("control-message", 200)
  const body = {
    id: "body-part",
    messageID: visible.id,
    sessionID: target.sessionID,
    type: "text",
    text: "Previous visible answer",
    orderKey: "v1:0000000000000101:0000000000000031:0000000000000000:part:body-part",
  }
  const step = {
    id: "step-part",
    messageID: control.id,
    sessionID: target.sessionID,
    type: "step-start",
    orderKey: "v1:0000000000000201:0000000000000031:0000000000000000:part:step-part",
  }
  const base = parseSubagentConversation(target, {
    lastLiveSequence: 1,
    liveEpoch: 1,
    transcriptMode: "snapshot",
    removedMessageIDs: [],
    transcript: [
      { info: visible, parts: [body] },
      { info: control, parts: [step] },
    ],
    view: {
      messages: [
        {
          messageID: visible.id,
          sessionID: target.sessionID,
          agentID: "build-agent",
          stage: "build",
          time: 100,
          orderKey: visible.orderKey,
        },
      ],
      sessions: [{ sessionID: target.sessionID, agentID: "build-agent", messageIDs: [visible.id, control.id] }],
    },
  })
  expect(base.messages.map((message) => message.messageID)).toEqual([visible.id, control.id])
  expect(projectSubagentConversationCard(base)?.parts).toEqual([body])
  const pending = {
    id: "pending-tool",
    messageID: control.id,
    sessionID: target.sessionID,
    type: "tool",
    callID: "current-call",
    tool: "apply_patch",
    state: { status: "pending", input: {}, time: { start: 202 } },
    orderKey: "v1:0000000000000202:0000000000000031:0000000000000000:part:pending-tool",
  }
  const live = observeSubagentConversationLiveEvent(createSubagentConversationLiveProjection(target.sessionID), {
    type: "message.part.updated",
    payload: { part: pending },
  })
  const promoted = projectSubagentConversationLive(base, live)
  expect(promoted.messages[1]).toMatchObject({ messageID: control.id, info: control, parts: [step, pending] })
  expect(
    projectSubagentConversationCard(promoted, "running")?.parts.map((part) => ({
      type: part.type,
      messageID: part.messageID,
    })),
  ).toEqual([
    { type: "text", messageID: visible.id },
    { type: "boundary", messageID: control.id },
    { type: "tool", messageID: control.id },
  ])
  const running = {
    ...pending,
    state: { status: "running", input: { patch: "Current actual input" }, time: { start: 202 } },
  }
  const active = observeSubagentConversationLiveEvent(live, {
    type: "message.part.updated",
    payload: { part: running },
  })
  expect(
    projectSubagentConversationCard(projectSubagentConversationLive(base, active), "running")?.parts.at(-1),
  ).toMatchObject(running)
  const completed = {
    ...pending,
    state: {
      status: "completed",
      input: { patch: "Current actual input" },
      output: "Applied patch",
      time: { start: 202, end: 203 },
    },
  }
  const done = observeSubagentConversationLiveEvent(active, {
    type: "message.part.updated",
    payload: { part: completed },
  })
  expect(
    projectSubagentConversationCard(projectSubagentConversationLive(base, done), "completed")?.parts.at(-1),
  ).toMatchObject(completed)
  const error = {
    ...pending,
    state: { status: "error", input: {}, error: "Actual operation failed", time: { start: 202, end: 204 } },
  }
  expect(
    projectSubagentConversationCard(
      projectSubagentConversationLive(
        base,
        observeSubagentConversationLiveEvent(done, { type: "message.part.updated", payload: { part: error } }),
      ),
      "error",
    )?.parts.at(-1),
  ).toMatchObject(error)
  const retired = observeSubagentConversationLiveEvent(done, {
    type: "message.part.removed",
    payload: { sessionID: target.sessionID, messageID: control.id, partID: pending.id, partType: "tool" },
  })
  expect(projectSubagentConversationCard(projectSubagentConversationLive(base, retired))?.parts).toEqual([body])
  const errored = {
    ...base,
    messages: [
      base.messages[0]!,
      {
        ...base.messages[1]!,
        info: { ...control, error: { name: "OperationError", data: { message: "Actual Message failure" } } },
      },
    ],
  }
  expect(projectSubagentConversationCard(errored)).toMatchObject({
    status: "error",
    errorReason: "Actual Message failure",
    messageID: visible.id,
  })
  const missingActor = structuredClone(base.messages[1]!.info)
  delete missingActor.sessionAgentID
  expect(() =>
    parseSubagentConversation(target, {
      lastLiveSequence: 1,
      liveEpoch: 1,
      transcriptMode: "snapshot",
      removedMessageIDs: [],
      transcript: [{ info: missingActor, parts: [step] }],
      view: {
        messages: [],
        sessions: [{ sessionID: target.sessionID, agentID: "build-agent", messageIDs: [control.id] }],
      },
    }),
  ).toThrow(`subagent conversation child-session message control-message session actor drift`)
})

function orderKey(time: number, id: string): string {
  return `v1:${String(time).padStart(16, "0")}:0000000000000030:0000000000000000:message:${id}`
}

function transport(requests: TransportRequest[], response: Record<string, unknown>): HostTransport {
  return {
    kind: "tauri",
    capabilities: HOST_CAPABILITIES.tauri,
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
  }
}

function payload() {
  const result = {
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
          agentID: "build-agent",
          sessionAgentID: "build-agent",
          originSource: "",
          time: { created: 200 },
          orderKey: orderKey(200, "message-late"),
        },
        parts: [{ id: "late-text", messageID: "message-late", sessionID: "child-session", type: "text", text: "Done", orderKey: "v1:0000000000000201:0000000000000031:0000000000000000:part:late-text" }],
      },
      {
        info: {
          id: "message-early",
          sessionID: "child-session",
          role: "user",
          author: "orchestrator",
          channel: "build",
          originSource: "delegate_agent",
          agentID: "build-agent",
          sessionAgentID: "build-agent",
          time: { created: 100 },
          orderKey: orderKey(100, "message-early"),
        },
        parts: [{ id: "early-text", messageID: "message-early", sessionID: "child-session", type: "text", text: "Starting", orderKey: "v1:0000000000000101:0000000000000031:0000000000000000:part:early-text" }],
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
  return {
    ...result,
    view: {
      ...result.view,
      sessions: [
        { sessionID: "child-session", agentID: "build-agent", messageIDs: result.transcript.map((row) => row.info.id) },
      ],
    },
  }
}
afterEach(() => {
  __setHostTransportForTest(undefined)
  configure({ serverUrl: "http://127.0.0.1:7878", password: "" })
})

test("canonical child metadata and Part ownership retain precise admission errors", () => {
  const target: SubagentConversationTarget = { source: { kind: "task", id: "task-one" }, sessionID: "child-session", directory: "/repo", authority: captureApiAuthority() }
  const badPart = payload()
  Object.assign(badPart.transcript[0]!.parts[0]!, { messageID: "another-message" })
  expect(() => parseSubagentConversation(target, badPart)).toThrow("subagent conversation child-session message message-late Part owner drift")
  const badView = payload()
  badView.view.messages[0]!.agentID = "another-agent"
  expect(() => parseSubagentConversation(target, badView)).toThrow("subagent conversation child-session message message-late view identity drift")
  const badMembership = payload()
  badMembership.view.sessions[0]!.messageIDs.push("missing-real-payload")
  expect(() => parseSubagentConversation(target, badMembership)).toThrow("subagent conversation child-session missing transcript message missing-real-payload")
})

test("task child transcript uses the exact task/session route and canonical order", async () => {
  const requests: TransportRequest[] = []
  __setHostTransportForTest(transport(requests, payload()))

  const result = await loadSubagentConversation({
    source: { kind: "task", id: "task one" },
    sessionID: "child-session",
    directory: "D:/repo",
  })

  expect(requests).toHaveLength(1)
  expect(requests[0]?.path).toBe("task/task%20one/conversation/session/child-session")
  expect(requests[0]?.query?.directory).toBe("D:/repo")
  expect(result.messages.map((message) => message.messageID)).toEqual(["message-early", "message-late"])
  expect(result.messages[0]?.parts[0]?.text).toBe("Starting")

  const card = projectSubagentConversationCard(result, "running")
  expect(card).toMatchObject({
    id: "subagent-transcript:child-session",
    kind: "agent",
    sessionID: "child-session",
    status: "running",
  })
  expect(card?.collapsedContextMessageIDs).toEqual(["message-early"])
  expect(card?.parts.map((part) => part.type)).toEqual(["text", "boundary", "text"])
  expect(card?.parts.filter((part) => part.type === "text").map((part) => part.messageID)).toEqual([
    "message-early",
    "message-late",
  ])
})

test("persisted child transcript projects exact live Part snapshots and later deltas", async () => {
  __setHostTransportForTest(transport([], payload()))
  const persisted = await loadSubagentConversation({
    source: { kind: "task", id: "task-one" },
    sessionID: "child-session",
    directory: "D:/repo",
  })
  let live = createSubagentConversationLiveProjection("child-session")
  live = observeSubagentConversationLiveEvent(
    live,
    {
      type: "message.part.delta",
      payload: {
        sessionID: "child-session",
        messageID: "message-late",
        partID: "late-text",
        field: "text",
        delta: " live",
      },
    },
    persisted,
  )
  expect(projectSubagentConversationLive(persisted, live).messages.at(-1)?.parts[0]?.text).toBe("Done live")

  const refreshed = structuredClone(persisted)
  refreshed.messages.at(-1)!.parts[0]!.text = "Done live"
  expect(projectSubagentConversationLive(refreshed, live).messages.at(-1)?.parts[0]?.text).toBe("Done live")

  live = observeSubagentConversationLiveEvent(live, {
    type: "message.part.updated",
    payload: {
      sessionID: "child-session",
      messageID: "message-late",
      part: {
        id: "late-text",
        sessionID: "child-session",
        messageID: "message-late",
        type: "text",
        text: "Done persisted",
      },
    },
  })
  live = observeSubagentConversationLiveEvent(live, {
    type: "message.part.delta",
    payload: {
      sessionID: "child-session",
      messageID: "message-late",
      partID: "late-text",
      field: "text",
      delta: " again",
    },
  })

  const projected = projectSubagentConversationLive(persisted, live)
  expect(projected.messages.at(-1)?.parts[0]?.text).toBe("Done persisted again")
  expect(projectSubagentConversationCard(projected, "running")?.parts.at(-1)?.text).toBe("Done persisted again")
})

test("a new live child message projects before the persisted transcript refreshes", () => {
  const response = payload()
  const base = {
    targetKey: "task/task-one/session/child-session",
    sessionID: "child-session",
    messages: [],
    lastLiveSequence: 0,
    liveEpoch: response.liveEpoch,
    transcriptMode: "snapshot" as const,
    removedMessageIDs: [],
  }
  let live = createSubagentConversationLiveProjection("child-session")
  live = observeSubagentConversationLiveEvent(live, {
    type: "message.updated",
    orderKey: orderKey(300, "message-new"),
    payload: {
      info: {
        id: "message-new",
        sessionID: "child-session",
        agentID: "build-agent",
        sessionAgentID: "build-agent",
        role: "assistant",
        author: "build-agent",
        channel: "build",
        originSource: "agent",
        orderKey: orderKey(300, "message-new"),
        time: { created: 300 },
      },
    },
  })
  live = observeSubagentConversationLiveEvent(live, {
    type: "message.part.updated",
    payload: {
      part: {
        id: "new-text",
        sessionID: "child-session",
        messageID: "message-new",
        type: "text",
        text: "Working",
      },
    },
  })
  live = observeSubagentConversationLiveEvent(live, {
    type: "message.part.delta",
    payload: {
      sessionID: "child-session",
      messageID: "message-new",
      partID: "new-text",
      field: "text",
      delta: " now",
    },
  })

  const projected = projectSubagentConversationLive(base, live)
  expect(projected.messages.map((message) => message.messageID)).toEqual(["message-new"])
  expect(projected.messages[0]).toMatchObject({ agentID: "build-agent", stage: "build", time: 300 })
  expect(projected.messages[0]?.parts[0]?.text).toBe("Working now")
})

test("a live child message with an empty origin source projects the selected transcript", () => {
  const base = {
    targetKey: "task/task-one/session/child-session",
    sessionID: "child-session",
    messages: [],
    lastLiveSequence: 0,
    liveEpoch: 1,
    transcriptMode: "snapshot" as const,
    removedMessageIDs: [],
  }
  const live = observeSubagentConversationLiveEvent(createSubagentConversationLiveProjection("child-session"), {
    type: "message.updated",
    payload: {
      info: {
        id: "message-without-origin-marker",
        sessionID: "child-session",
        agentID: "interface-designer",
        role: "assistant",
        author: "interface-designer",
        channel: "frontend-design",
        originSource: "",
        orderKey: orderKey(301, "message-without-origin-marker"),
        time: { created: 301 },
      },
    },
  })

  const projected = projectSubagentConversationLive(base, live)
  expect(projected.messages[0]).toMatchObject({
    messageID: "message-without-origin-marker",
    sessionID: "child-session",
    agentID: "interface-designer",
    stage: "frontend-design",
  })
  projected.messages[0]!.parts.push({ id: "actual-empty-origin-text", type: "text", text: "Current interface evidence" })
  expect(projectSubagentConversationCard(projected, "running")).toMatchObject({
    sessionID: "child-session",
    agentID: "interface-designer",
  })
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

test("bursty transcript revisions coalesce into one refresh", async () => {
  let refreshes = 0
  const controller = createSubagentTranscriptRefreshController(() => {
    refreshes += 1
  }, 10)

  controller.observe("task/one/session/child", "1")
  controller.observe("task/one/session/child", "2")
  controller.observe("task/one/session/child", "3")
  controller.observe("task/one/session/child", "4")
  await new Promise((resolve) => setTimeout(resolve, 25))

  expect(refreshes).toBe(1)
  controller.dispose()
})

test("a revision received during refresh schedules one trailing refresh", async () => {
  let refreshes = 0
  let releaseFirst: (() => void) | undefined
  const controller = createSubagentTranscriptRefreshController(async () => {
    refreshes += 1
    if (refreshes === 1) await new Promise<void>((resolve) => (releaseFirst = resolve))
  }, 5)

  controller.observe("task/one/session/child", "1")
  controller.observe("task/one/session/child", "2")
  await new Promise((resolve) => setTimeout(resolve, 15))
  controller.observe("task/one/session/child", "3")
  controller.observe("task/one/session/child", "4")
  releaseFirst?.()
  await new Promise((resolve) => setTimeout(resolve, 15))

  expect(refreshes).toBe(2)
  controller.dispose()
})

test("queued revisions refresh once when the immediate target load settles", async () => {
  let refreshes = 0
  const controller = createSubagentTranscriptRefreshController(() => {
    refreshes += 1
  }, 5)

  controller.observe("task/one/session/child", "1", false)
  controller.observe("task/one/session/child", "2", false)
  controller.observe("task/one/session/child", "3", false)
  await new Promise((resolve) => setTimeout(resolve, 15))

  controller.observe("task/one/session/child", "3", true)
  await new Promise((resolve) => setTimeout(resolve, 15))
  expect(refreshes).toBe(1)
  controller.dispose()
})

test("a new transcript target owns a fresh initial observation and refresh cadence", async () => {
  let refreshes = 0
  const controller = createSubagentTranscriptRefreshController(() => {
    refreshes += 1
  }, 5)

  controller.observe("task/one/session/child-a", "1")
  controller.observe("task/one/session/child-a", "2")
  controller.observe("task/one/session/child-b", "8")
  controller.observe("task/one/session/child-b", "9")
  await new Promise((resolve) => setTimeout(resolve, 15))

  expect(refreshes).toBe(1)
  controller.dispose()
})

test("task transcript delta replaces changed messages and removes deleted messages", () => {
  const current = {
    targetKey: subagentConversationTargetKey({
      authority: captureApiAuthority(),
      source: { kind: "task", id: "task-one" },
      sessionID: "child-session",
      directory: "/repo-one",
    }),
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
    targetKey: subagentConversationTargetKey({
      authority: captureApiAuthority(),
      source: { kind: "task", id: "task-one" },
      sessionID: "child-session",
      directory: "/repo-one",
    }),
    sessionID: "child-session",
    lastLiveSequence: 15,
    liveEpoch: 1779000000000,
    transcriptMode: "delta",
    removedMessageIDs: ["message-early", "message-late"],
    messages: [{ messageID: "message-late", orderKey: orderKey(200, "message-late"), info: { error: "updated" } }],
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
    targetKey: subagentConversationTargetKey({
      authority: captureApiAuthority(),
      source: { kind: "task", id: "task-one" },
      sessionID: "child-session",
      directory: "/repo-one",
    }),
    sessionID: "child-session",
    lastLiveSequence: 91,
    liveEpoch: 1779000000000,
    transcriptMode: "delta",
    removedMessageIDs: [],
    messages: [{ messageID: "stale-message", orderKey: orderKey(100, "stale-message") }],
  } as any
  const snapshot = {
    targetKey: subagentConversationTargetKey({
      authority: captureApiAuthority(),
      source: { kind: "task", id: "task-one" },
      sessionID: "child-session",
      directory: "/repo-one",
    }),
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

test("a same-named session in another project replaces the prior target transcript", () => {
  const current = {
    targetKey: subagentConversationTargetKey({
      authority: captureApiAuthority(),
      source: { kind: "task", id: "task-one" },
      sessionID: "child-session",
      directory: "/repo-one",
    }),
    sessionID: "child-session",
    lastLiveSequence: 40,
    liveEpoch: 100,
    transcriptMode: "delta",
    removedMessageIDs: [],
    messages: [{ messageID: "project-one-message", orderKey: orderKey(100, "project-one-message") }],
  } as any
  const nextProject = {
    targetKey: subagentConversationTargetKey({
      authority: captureApiAuthority(),
      source: { kind: "task", id: "task-two" },
      sessionID: "child-session",
      directory: "/repo-two",
    }),
    sessionID: "child-session",
    lastLiveSequence: 2,
    liveEpoch: 200,
    transcriptMode: "delta",
    removedMessageIDs: [],
    messages: [{ messageID: "project-two-message", orderKey: orderKey(200, "project-two-message") }],
  } as any

  expect(mergeSubagentConversation(current, nextProject)).toMatchObject({
    targetKey: nextProject.targetKey,
    messages: [{ messageID: "project-two-message" }],
  })
})

test("current Task and Mission/Chat child reads retain the supplied authority and exact public routes", async () => {
  const authority = captureApiAuthority()
  const requests: TransportRequest[] = []
  __setHostTransportForTest(transport(requests, payload()))
  const targets: SubagentConversationTarget[] = [
    { source: { kind: "task", id: "task one" }, sessionID: "child-session", directory: "D:/owned", authority },
    { source: { kind: "session", id: "mission-root", sessionKind: "mission" }, sessionID: "child-session", directory: "D:/owned", authority },
    { source: { kind: "session", id: "chat-root", sessionKind: "conversation", experience: "chat" }, sessionID: "child-session", directory: "D:/owned", authority },
  ]
  const transcripts = await Promise.all(targets.map((target) => loadSubagentConversation(target)))
  expect(requests.map(({ path, query, authority }) => ({ path, query, authority }))).toEqual([
    { path: "task/task%20one/conversation/session/child-session", query: { directory: "D:/owned" }, authority },
    { path: "session/child-session/conversation", query: { directory: "D:/owned", tail_limit: "2000" }, authority },
    { path: "session/child-session/conversation", query: { directory: "D:/owned", tail_limit: "2000" }, authority },
  ])
  expect(transcripts.map((value) => value.targetKey)).toEqual(targets.map(subagentConversationTargetKey))
  expect(transcripts.map((value) => value.messages.map((message) => message.messageID))).toEqual([
    ["message-early", "message-late"], ["message-early", "message-late"], ["message-early", "message-late"],
  ])
})

test("a supplied retired child target produces the exact local admission error after credential ABA", async () => {
  const authority = captureApiAuthority()
  configure({ password: "dummy-local-credential-marker" })
  configure({ password: "" })
  await expect(loadSubagentConversation({ source: { kind: "task", id: "task-one" }, sessionID: "child-session", directory: "D:/owned", authority })).rejects.toMatchObject({
    name: "ApiAuthorityChangedError", phase: "before_dispatch", expectedRevision: authority.revision,
    currentRevision: captureApiAuthority().revision,
  })
})

test("Side Chat's ordered snapshot parser retains the connection's captured authority", () => {
  const authority = captureApiAuthority()
  let handlers: StreamHandlers | undefined
  let request: StreamOpenRequest | undefined
  const values: string[] = []
  __setHostTransportForTest({
    ...transport([], {}),
    openStream(input, nextHandlers) {
      request = input
      handlers = nextHandlers
      return { close() {} }
    },
  })
  const close = connectSideChat({ sessionID: "child-session", directory: "D:/owned", authority }, {
    transcript(value) { values.push(value.targetKey) },
    connection() {}, activity() {}, interactions() {},
    error(error) { throw error },
  })
  try {
    if (!handlers) throw new Error("Expected actual local stream handlers")
    handlers.onEvent(JSON.stringify({ type: "session.connected", payload: { conversationSnapshot: payload() } }))
    expect(request).toMatchObject({ authority, path: "session/child-session/events", query: { directory: "D:/owned" } })
    expect(values.map((value) => JSON.parse(value))).toEqual([{
      source: { kind: "session", id: "child-session" }, sessionID: "child-session", directory: "D:/owned", authority,
    }])
  } finally { close() }
})

test("held A read retains its exact response while B returns its own child transcript", async () => {
  const a = captureApiAuthority()
  const target = { source: { kind: "task" as const, id: "task-one" }, sessionID: "child-session", directory: "D:/owned" }
  const held = Promise.withResolvers<TransportResponse>()
  const aResponse: TransportResponse = { status: 200, ok: true, headers: {}, body: payload() }
  const bPayload = payload()
  bPayload.transcript[0]!.parts[0]!.text = "B child result"
  const fixture = transport([], bPayload)
  __setHostTransportForTest({
    ...fixture,
    async request<T>(request: TransportRequest): Promise<TransportResponse<T>> {
      if (request.authority?.revision === a.revision) return await held.promise as TransportResponse<T>
      return fixture.request<T>(request)
    },
  })
  const old = loadSubagentConversation({ ...target, authority: a }).catch((error: unknown) => error)
  renewApiAuthority()
  const b = captureApiAuthority()
  const current = await loadSubagentConversation({ ...target, authority: b })
  held.resolve(aResponse)
  const error = await old
  expect(error).toBeInstanceOf(ApiAuthorityChangedError)
  if (!(error instanceof ApiAuthorityChangedError)) throw new Error("Expected original authority outcome")
  expect(error.phase).toBe("response")
  if (error.outcome.phase !== "response") throw new Error("Expected actual response outcome")
  expect(error.outcome.response).toBe(aResponse)
  expect(current.messages.at(-1)?.parts[0]?.text).toBe("B child result")
  expect(JSON.parse(current.targetKey)).toEqual({ ...target, authority: b })
})

test("same child identifiers under a new authority replace the prior delta base", () => {
  const target = { source: { kind: "task" as const, id: "task-one" }, sessionID: "child-session", directory: "D:/owned" }
  const a = captureApiAuthority()
  const before = parseSubagentConversation({ ...target, authority: a }, payload())
  renewApiAuthority()
  const b = captureApiAuthority()
  const nextPayload = payload()
  nextPayload.transcriptMode = "delta"
  nextPayload.transcript[0]!.parts[0]!.text = "New source"
  const next = parseSubagentConversation({ ...target, authority: b }, nextPayload)
  expect([JSON.parse(before.targetKey), JSON.parse(next.targetKey)]).toEqual([{ ...target, authority: a }, { ...target, authority: b }])
  expect(mergeSubagentConversation(before, next)).toBe(next)
  expect(next.messages.at(-1)?.parts[0]?.text).toBe("New source")
})

test("a new authority owns refresh cadence while the retired in-flight request settles", async () => {
  const target = { source: { kind: "task" as const, id: "task-one" }, sessionID: "child-session", directory: "D:/owned" }
  const aKey = subagentConversationTargetKey({ ...target, authority: captureApiAuthority() })
  const firstStarted = Promise.withResolvers<void>()
  const releaseFirst = Promise.withResolvers<void>()
  const secondStarted = Promise.withResolvers<void>()
  const releaseSecond = Promise.withResolvers<void>()
  const trailing = Promise.withResolvers<void>()
  const completed: string[] = []
  let key = aKey
  let index = 0
  const controller = createSubagentTranscriptRefreshController(async () => {
    const indexAtStart = ++index
    const ownedKey = key
    if (indexAtStart === 1) { firstStarted.resolve(); await releaseFirst.promise }
    if (indexAtStart === 2) { secondStarted.resolve(); await releaseSecond.promise }
    completed.push(ownedKey)
    if (indexAtStart === 3) trailing.resolve()
  }, 1)
  try {
    controller.observe(aKey, "1")
    controller.observe(aKey, "2")
    await firstStarted.promise
    renewApiAuthority()
    key = subagentConversationTargetKey({ ...target, authority: captureApiAuthority() })
    controller.observe(key, "1")
    controller.observe(key, "2")
    await secondStarted.promise
    controller.observe(key, "3")
    releaseFirst.resolve()
    await Promise.resolve()
    releaseSecond.resolve()
    await trailing.promise
    expect(completed).toEqual([aKey, key, key])
  } finally {
    releaseFirst.resolve()
    releaseSecond.resolve()
    controller.dispose()
  }
})
