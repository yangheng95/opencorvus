import { expect, test } from "bun:test"
import { appendConversationLiveEvent } from "../../opencorvus/src/protocol/conversation-live-buffer"
import {
  createSubagentConversationLiveProjection,
  observeSubagentConversationLiveEvent,
  projectSubagentConversationLive,
  type SubagentConversationTranscript,
} from "../src/services/subagent-conversation"

const sessionID = "child-session"
const messageID = "child-message"
const key = (time: number, domain: string, id: string) =>
  `v1:${String(time).padStart(16, "0")}:0000000000000031:0000000000000000:${domain}:${id}`
const info = {
  id: messageID, sessionID, agentID: "build-agent", role: "assistant",
  author: "build-agent", channel: "build", originSource: "", time: { created: 100 },
  orderKey: key(100, "message", messageID),
}
const part = (id: string, time: number, text: string) => ({
  id, sessionID, messageID, type: "text", text, orderKey: key(time, "part", id),
})
const earlier = part("earlier", 101, "First paragraph")
const later = part("later", 102, "Second paragraph")
const revised = { ...earlier, text: "First paragraph, revised" }
const base = (): SubagentConversationTranscript => ({
  targetKey: sessionID, sessionID, messages: [], lastLiveSequence: 0,
  liveEpoch: 0, transcriptMode: "snapshot", removedMessageIDs: [],
})

function replay() {
  const events: { type: string; payload: Record<string, unknown> }[] = []
  appendConversationLiveEvent(events, { type: "message.updated", payload: { info } })
  for (const snapshot of [earlier, later, revised]) {
    appendConversationLiveEvent(events, { type: "message.part.updated", payload: { part: snapshot } })
  }
  let live = createSubagentConversationLiveProjection(sessionID)
  for (const event of events) live = observeSubagentConversationLiveEvent(live, event)
  return live
}

test("compacted live replay projects new message Parts in canonical order with their latest values", () => {
  const result = projectSubagentConversationLive(base(), replay())
  expect(result.messages.map(message => ({ id: message.messageID, parts: message.parts })))
    .toEqual([{ id: messageID, parts: [revised, later] }])
})

test("partial persisted read and earlier live snapshot converge to canonical Part order", () => {
  const persisted = projectSubagentConversationLive(base(), replay())
  persisted.messages[0].parts = [later]
  const live = observeSubagentConversationLiveEvent(createSubagentConversationLiveProjection(sessionID), {
    type: "message.part.updated", payload: { part: revised },
  })
  expect(projectSubagentConversationLive(persisted, live).messages[0].parts).toEqual([revised, later])
})

test("completed canonical message retains its final values during retained replay", () => {
  const persisted = projectSubagentConversationLive(base(), replay())
  const final = { ...earlier, text: "Final first paragraph" }
  persisted.messages[0].info = { ...info, time: { created: 100, completed: 200 } }
  persisted.messages[0].parts = [final, later]
  expect(projectSubagentConversationLive(persisted, replay()).messages[0].parts).toEqual([final, later])
})

test("source snapshot keeps its tool binding between the surrounding canonical text Parts", () => {
  const source = {
    id: "source", sessionID, messageID, type: "source-url", sourceId: "source-fact",
    url: "https://example.com/reference", title: "Reference", toolPartID: "tool-part",
    orderKey: key(102, "part", "source"),
  }
  const after = part("after-source", 103, "Explanation after the source")
  const events: { type: string; payload: Record<string, unknown> }[] = []
  appendConversationLiveEvent(events, { type: "message.updated", payload: { info } })
  for (const snapshot of [earlier, source, after, revised]) {
    appendConversationLiveEvent(events, { type: "message.part.updated", payload: { part: snapshot } })
  }
  let live = createSubagentConversationLiveProjection(sessionID)
  for (const event of events) live = observeSubagentConversationLiveEvent(live, event)
  expect(projectSubagentConversationLive(base(), live).messages[0].parts).toEqual([revised, source, after])
})
