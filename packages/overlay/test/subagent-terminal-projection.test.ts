import { expect, test } from "bun:test"
import {
  createSubagentConversationLiveProjection,
  observeSubagentConversationLiveEvent,
  projectSubagentConversationLive,
  type SubagentConversationTranscript,
} from "../src/services/subagent-conversation"

const identity = { sessionID: "child-session", messageID: "assistant-message" }
const text = { ...identity, id: "text-part", type: "text", text: "Canonical finished answer" }
const source = { ...identity, id: "source-part", type: "source-url", sourceId: "published-source", url: "https://example.com/source" }
const tool = { ...identity, id: "tool-part", type: "tool", tool: "read", state: { status: "running", input: { filePath: "README.md" }, time: { start: 150 } } }

function transcript(completed = true): SubagentConversationTranscript {
  return {
    targetKey: "current-task-child",
    sessionID: identity.sessionID,
    lastLiveSequence: 12,
    liveEpoch: 1,
    transcriptMode: "snapshot",
    removedMessageIDs: [],
    messages: [{
      ...identity, agentID: "researcher", stage: "research", time: 100,
      orderKey: "v1:0000000000000100:0000000000000030:0000000000000000:message:assistant-message",
      info: { id: identity.messageID, sessionID: identity.sessionID, role: "assistant", time: { created: 100, ...(completed ? { completed: 200 } : {}) }, ...(completed ? { finish: "tool-calls" } : {}) },
      parts: [text, source, tool],
    }],
  }
}

function live(events: unknown[]) {
  return events.reduce<ReturnType<typeof createSubagentConversationLiveProjection>>(
    observeSubagentConversationLiveEvent, createSubagentConversationLiveProjection(identity.sessionID),
  )
}
const delta = (value: string) => ({ type: "message.part.delta", payload: { ...identity, partID: text.id, field: "text", value } })
const updated = (part: unknown) => ({ type: "message.part.updated", payload: { part } })

test("completed assistant retains canonical final text, metadata and source against retained live drafts", () => {
  const base = transcript()
  const result = projectSubagentConversationLive(base, live([
    { type: "message.updated", payload: { info: { ...base.messages[0]!.info, time: { created: 100 } } } },
    updated({ ...text, text: "Earlier checkpoint" }),
    delta("Earlier checkpoint plus live tail\n"),
  ]))
  expect(result.messages[0]!.info).toEqual(base.messages[0]!.info)
  expect(result.messages[0]!.parts).toEqual([text, source, tool])
})

test.each(["MessageAbortedError", "ProviderError"])("completed %s retains exact failure and accepted partial text", (name) => {
  const base = transcript()
  base.messages[0]!.info.error = { name, data: { message: "Actual terminal reason" } }
  const result = projectSubagentConversationLive(base, live([delta("Obsolete partial")]))
  expect(result.messages[0]!.info).toEqual(base.messages[0]!.info)
  expect(result.messages[0]!.parts[0]).toEqual(text)
})

test("completed hydration retires uncommitted text and tool input drafts", () => {
  const result = projectSubagentConversationLive(transcript(), live([
    updated({ ...text, id: "retired-text", text: "Attempt draft" }),
    updated({ ...tool, id: "pending-input", state: { status: "pending", input: {} } }),
  ]))
  expect(result.messages[0]!.parts).toEqual([text, source, tool])
})

test("an existing request accepts its actual outcome after assistant completion", () => {
  const completed = { ...tool, state: { ...tool.state, status: "completed", output: "Actual file body", time: { start: 150, end: 230 } } }
  const result = projectSubagentConversationLive(transcript(), live([updated(completed)]))
  expect(result.messages[0]!.parts).toEqual([text, source, completed])
})

test.each(["completed", "error"])("canonical %s tool outcome retains its accepted result", (status) => {
  const base = transcript(false)
  const settled = { ...tool, state: status === "completed"
    ? { status, input: tool.state.input, output: "Retained result", time: { start: 150, end: 230 } }
    : { status, input: tool.state.input, error: "Actual error", time: { start: 150, end: 230 } } }
  base.messages[0]!.parts = [text, source, settled]
  expect(projectSubagentConversationLive(base, live([updated(tool)])).messages[0]!.parts).toEqual([text, source, settled])
})

test("completed-message checkpoint append and actual Part removal remain visible", () => {
  const checkpoint = { ...identity, id: "checkpoint", type: "compaction", auto: true }
  const result = projectSubagentConversationLive(transcript(), live([
    updated(checkpoint),
    { type: "message.part.removed", payload: { ...identity, partID: text.id } },
  ]))
  expect(result.messages[0]!.parts).toEqual([source, tool, checkpoint])
})

test("an active assistant keeps its live field over a lagging persisted checkpoint", () => {
  expect(projectSubagentConversationLive(transcript(false), live([delta("Current accepted live answer")])).messages[0]!.parts[0]).toEqual({
    ...text, text: "Current accepted live answer",
  })
})

test("another Session retains its own independent transcript", () => {
  const base = transcript(false)
  base.sessionID = "other-session"
  expect(projectSubagentConversationLive(base, live([delta("Current child field")]))).toEqual(base)
})
