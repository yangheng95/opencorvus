import { expect, test } from "bun:test"
import {
  createSubagentConversationLiveProjection,
  mergeSubagentConversation,
  observeSubagentConversationLiveEvent,
  projectSubagentConversationLive,
  type SubagentConversationTranscript,
  type SubagentTranscriptMessage,
} from "../src/services/subagent-conversation"

function message(id: string, time: number): SubagentTranscriptMessage {
  const sessionID = "child-session"
  const orderKey = `v1:${String(time).padStart(16, "0")}:0000000000000030:0000000000000000:message:${id}`
  return {
    messageID: id, sessionID, agentID: "researcher", stage: "research", time, orderKey,
    info: { id, sessionID, agentID: "researcher", role: "assistant", author: "researcher", channel: "research", originSource: "", orderKey, time: { created: time } },
    parts: [{ id: `${id}-source`, messageID: id, sessionID, type: "source-url", sourceId: id, url: `https://example.com/${id}` }],
  }
}

const retired = message("retired", 100)
const survivor = message("survivor", 200)
const incoming = message("incoming", 300)

function transcript(messages: SubagentTranscriptMessage[], fields: Partial<SubagentConversationTranscript> = {}): SubagentConversationTranscript {
  return { targetKey: "current-task-child", sessionID: "child-session", messages, lastLiveSequence: 10, liveEpoch: 1, transcriptMode: "delta", removedMessageIDs: [], ...fields }
}

function retainedLive(messages: SubagentTranscriptMessage[]) {
  return messages.flatMap((message) => [
    { type: "message.updated", payload: { info: message.info } },
    ...message.parts.map((part) => ({ type: "message.part.updated", payload: { part } })),
  ]).reduce(observeSubagentConversationLiveEvent, createSubagentConversationLiveProjection("child-session"))
}

const sources = (value: SubagentConversationTranscript) => value.messages.map((message) => ({ id: message.messageID, sources: message.parts.map((part) => part.url) }))

test("authoritative removal preserves the surviving sources across repeated reads and retained live Info", () => {
  const before = transcript([retired, survivor])
  const removed = mergeSubagentConversation(before, transcript([], { lastLiveSequence: 11, removedMessageIDs: [retired.messageID] }))
  const refreshed = mergeSubagentConversation(removed, transcript([], { lastLiveSequence: 12 }))
  const result = projectSubagentConversationLive(refreshed, retainedLive([retired, survivor]))
  expect({ retired: result.removedMessageIDs, sources: sources(result) }).toEqual({
    retired: ["retired"], sources: [{ id: "survivor", sources: ["https://example.com/survivor"] }],
  })
})

test.each([
  { transcriptMode: "snapshot" as const, lastLiveSequence: 11 },
  { liveEpoch: 2, lastLiveSequence: 11 },
  { lastLiveSequence: 3 },
])("replacement membership retains its survivor and genuinely new live message: %j", (fields) => {
  const result = projectSubagentConversationLive(
    mergeSubagentConversation(transcript([retired, survivor]), transcript([survivor], fields)),
    retainedLive([retired, survivor, incoming]),
  )
  expect({ retired: result.removedMessageIDs, sources: sources(result) }).toEqual({
    retired: ["retired"], sources: [
      { id: "survivor", sources: ["https://example.com/survivor"] },
      { id: "incoming", sources: ["https://example.com/incoming"] },
    ],
  })
})

test("a later authoritative message restores its membership and sources", () => {
  const removed = transcript([survivor], { removedMessageIDs: ["retired", "earlier"] })
  const restored = mergeSubagentConversation(removed, transcript([retired], { lastLiveSequence: 11 }))
  const result = projectSubagentConversationLive(restored, retainedLive([survivor]))
  expect({ retired: result.removedMessageIDs, sources: sources(result) }).toEqual({
    retired: ["earlier"], sources: [
      { id: "retired", sources: ["https://example.com/retired"] },
      { id: "survivor", sources: ["https://example.com/survivor"] },
    ],
  })
})

test("a target change accepts the new target's membership and exclusion facts", () => {
  const before = transcript([survivor], { removedMessageIDs: ["retired"] })
  const next = transcript([retired], { targetKey: "another-project-and-authority", removedMessageIDs: ["other-retired"] })
  const result = mergeSubagentConversation(before, next)
  expect(result).toBe(next)
  expect({ retired: result.removedMessageIDs, sources: sources(result) }).toEqual({
    retired: ["other-retired"], sources: [{ id: "retired", sources: ["https://example.com/retired"] }],
  })
})

test("current live removal and canonical exclusion both preserve the current incoming source", () => {
  const live = observeSubagentConversationLiveEvent(retainedLive([retired, survivor, incoming]), {
    type: "message.removed", payload: { sessionID: "child-session", messageID: "survivor" },
  })
  const result = projectSubagentConversationLive(transcript([survivor], { removedMessageIDs: ["retired"] }), live)
  expect(sources(result)).toEqual([{ id: "incoming", sources: ["https://example.com/incoming"] }])
})
