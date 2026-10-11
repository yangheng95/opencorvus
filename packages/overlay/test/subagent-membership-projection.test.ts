import { expect, test } from "bun:test"
import {
  createSubagentConversationLiveProjection,
  mergeSubagentConversation,
  observeSubagentConversationLiveEvent,
  projectSubagentConversationLive,
  reconcileSubagentConversationLive,
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

const partOwner = message("part-owner", 400)
const keptSource = partOwner.parts[0]
const withdrawnSource = { ...keptSource, id: "withdrawn-source", sourceId: "withdrawn", url: "https://example.com/withdrawn" }
const newSource = { ...keptSource, id: "new-source", sourceId: "new", url: "https://example.com/new" }
const textPart = { id: "active-text", messageID: partOwner.messageID, sessionID: partOwner.sessionID, type: "text", text: "Current answer" }
const withParts = (parts: any[]) => ({ ...partOwner, parts })

test.each([
  { transcriptMode: "delta" as const, lastLiveSequence: 11 },
  { transcriptMode: "snapshot" as const, lastLiveSequence: 11 },
  { liveEpoch: 2, lastLiveSequence: 3 },
])("current Part membership preserves surviving sources and fresh live additions: %j", (fields) => {
  const before = transcript([withParts([keptSource, withdrawnSource, textPart])])
  const next = mergeSubagentConversation(before, transcript([withParts([keptSource, textPart])], fields))
  const live = retainedLive([withParts([keptSource, withdrawnSource, textPart, newSource])])
  const projected = projectSubagentConversationLive(next, live)
  expect(projected.messages[0]!.parts).toEqual([keptSource, textPart, newSource])
  expect(projected.removedPartIDs).toEqual({ "part-owner": ["withdrawn-source"] })
})

test("Part exclusions survive empty deltas while active text keeps its unpersisted live value", () => {
  const before = transcript([withParts([keptSource, withdrawnSource, textPart])])
  const next = mergeSubagentConversation(before, transcript([withParts([keptSource, textPart])], { lastLiveSequence: 11 }))
  const refreshed = mergeSubagentConversation(next, transcript([], { lastLiveSequence: 12 }))
  const live = observeSubagentConversationLiveEvent(retainedLive([withParts([keptSource, withdrawnSource, textPart])]), {
    type: "message.part.delta", payload: { sessionID: partOwner.sessionID, messageID: partOwner.messageID, partID: textPart.id, field: "text", value: "Current answer and live tail" },
  })
  expect(projectSubagentConversationLive(refreshed, live).messages[0]!.parts).toEqual([
    keptSource, { ...textPart, text: "Current answer and live tail" },
  ])
})

test("an authoritative restored Part rejoins its surviving source", () => {
  const before = transcript([withParts([keptSource, withdrawnSource])])
  const removed = mergeSubagentConversation(before, transcript([withParts([keptSource])], { lastLiveSequence: 11 }))
  const restored = mergeSubagentConversation(removed, transcript([withParts([keptSource, withdrawnSource])], { lastLiveSequence: 12 }))
  expect(projectSubagentConversationLive(restored, retainedLive([withParts([keptSource])])).messages[0]!.parts).toEqual([
    keptSource, withdrawnSource,
  ])
})

test.each(["delta", "snapshot"] as const)("a restored Message owns its current Parts after whole-message %s removal", (transcriptMode) => {
  const before = transcript([withParts([keptSource, withdrawnSource]), survivor])
  const removed = mergeSubagentConversation(before, transcript([survivor], {
    transcriptMode, lastLiveSequence: 11,
    removedMessageIDs: transcriptMode === "delta" ? [partOwner.messageID] : [],
  }))
  const restored = mergeSubagentConversation(removed, transcript([withParts([keptSource])], { lastLiveSequence: 12 }))
  const projected = projectSubagentConversationLive(restored, retainedLive([withParts([keptSource, withdrawnSource])]))
  expect(projected.messages.find((message) => message.messageID === partOwner.messageID)!.parts).toEqual([keptSource])
  expect(projected.removedPartIDs).toEqual({ "part-owner": ["withdrawn-source"] })
})

test("a different target owns independently restored Part identities", () => {
  const before = transcript([withParts([keptSource])], { removedPartIDs: { "part-owner": ["withdrawn-source"] } })
  const next = transcript([withParts([keptSource, withdrawnSource])], { targetKey: "new-target" })
  const merged = mergeSubagentConversation(before, next)
  expect(merged).toBe(next)
  expect(projectSubagentConversationLive(merged, retainedLive([withParts([keptSource])])).messages[0]!.parts).toEqual([
    keptSource, withdrawnSource,
  ])
})

function afterRead(incoming: SubagentConversationTranscript, observed: ReturnType<typeof retainedLive>, current = observed) {
  return projectSubagentConversationLive(incoming, reconcileSubagentConversationLive(incoming, observed, current))
}

test("a first complete read owns a replacement source and retires prior withdrawn sources", () => {
  const currentSource = { ...newSource, title: "Current title", url: "https://example.com/current" }
  const live = retainedLive([withParts([keptSource, withdrawnSource])])
  const incoming = transcript([withParts([currentSource])], { transcriptMode: "snapshot" })
  expect(afterRead(incoming, live).messages[0]!.parts).toEqual([currentSource])
})

test("a source received during a read retains its new live identity", () => {
  const observed = retainedLive([withParts([keptSource])])
  const changed = { ...newSource, title: "Received during the read" }
  const current = observeSubagentConversationLiveEvent(observed, { type: "message.part.updated", payload: { part: changed } })
  expect(afterRead(transcript([partOwner]), observed, current).messages[0]!.parts).toEqual([keptSource, changed])
})

test("a partial read preserves an uncovered message's live sources", () => {
  const observed = retainedLive([withParts([keptSource, newSource])])
  const read = transcript([survivor])
  const live = reconcileSubagentConversationLive(read, observed, observed)
  expect(live).toBe(observed)
  expect(projectSubagentConversationLive(transcript([partOwner, survivor]), live).messages.find((m) => m.messageID === partOwner.messageID)!.parts).toEqual([keptSource, newSource])
})

test("a read receives committed Info while an Info event during the request remains current", () => {
  const observed = retainedLive([partOwner])
  const canonical = { ...partOwner, info: { ...partOwner.info, cost: 2 } }
  expect(afterRead(transcript([canonical]), observed).messages[0]!.info).toEqual(canonical.info)
  const newer = { ...canonical.info, cost: 3 }
  const current = observeSubagentConversationLiveEvent(observed, { type: "message.updated", payload: { info: newer } })
  expect(afterRead(transcript([canonical]), observed, current).messages[0]!.info).toEqual(newer)
})

test("read reconciliation retains accepted unpersisted text over its new persisted checkpoint", () => {
  const observed = observeSubagentConversationLiveEvent(retainedLive([withParts([textPart])]), {
    type: "message.part.delta", payload: { sessionID: partOwner.sessionID, messageID: partOwner.messageID, partID: textPart.id, field: "text", value: "Current answer with accepted live tail" },
  })
  expect(afterRead(transcript([withParts([{ ...textPart, text: "Current answer with" }])]), observed).messages[0]!.parts).toEqual([
    { ...textPart, text: "Current answer with accepted live tail" },
  ])
})

test("an omitted reasoning scaffold accepts a later live field", () => {
  const scaffold = { ...textPart, type: "reasoning", text: "" }
  const observed = retainedLive([withParts([keptSource, scaffold])])
  const read = transcript([partOwner])
  const reconciled = reconcileSubagentConversationLive(read, observed, observed)
  const current = observeSubagentConversationLiveEvent(reconciled, {
    type: "message.part.delta", payload: { sessionID: partOwner.sessionID, messageID: partOwner.messageID, partID: textPart.id, field: "text", value: "Accepted after hydration" },
  })
  expect(projectSubagentConversationLive(read, current).messages[0]!.parts).toEqual([
    keptSource, { ...scaffold, text: "Accepted after hydration" },
  ])
})

test("a returned empty text Part accepts its subsequent unpersisted field", () => {
  const empty = { ...textPart, text: "" }
  const observed = retainedLive([withParts([keptSource, empty])])
  const incoming = transcript([withParts([keptSource, empty])])
  const reconciled = reconcileSubagentConversationLive(incoming, observed, observed)
  const current = observeSubagentConversationLiveEvent(reconciled, {
    type: "message.part.delta", payload: { sessionID: partOwner.sessionID, messageID: partOwner.messageID, partID: textPart.id, field: "text", value: "Accepted after the read" },
  })
  expect(projectSubagentConversationLive(incoming, current).messages[0]!.parts).toEqual([
    keptSource, { ...empty, text: "Accepted after the read" },
  ])
})

test("a withdrawn text Part yields to the current source even with a retained unpersisted field", () => {
  const observed = observeSubagentConversationLiveEvent(retainedLive([withParts([keptSource, textPart])]), {
    type: "message.part.delta", payload: { sessionID: partOwner.sessionID, messageID: partOwner.messageID, partID: textPart.id, field: "text", value: "Withdrawn live text" },
  })
  expect(afterRead(transcript([partOwner]), observed).messages[0]!.parts).toEqual([keptSource])
})

test("pending Tool input survives a read until its canonical committed request is returned", () => {
  const draft = { ...textPart, id: "draft-tool", type: "tool", tool: "read", state: { status: "pending", input: {} } }
  const observed = retainedLive([withParts([keptSource, draft])])
  expect(afterRead(transcript([partOwner]), observed).messages[0]!.parts).toEqual([keptSource, draft])
  const running = { ...draft, state: { status: "running", input: { filePath: "README.md" } } }
  expect(afterRead(transcript([withParts([keptSource, running])]), observed).messages[0]!.parts).toEqual([keptSource, running])
})

test("a current read restores a source after its earlier observed removal", () => {
  const observed = observeSubagentConversationLiveEvent(retainedLive([partOwner]), {
    type: "message.part.removed", payload: { sessionID: partOwner.sessionID, messageID: partOwner.messageID, partID: keptSource.id },
  })
  expect(afterRead(transcript([partOwner]), observed).messages[0]!.parts).toEqual([keptSource])
})

test("a Part removal received during the read remains authoritative to live projection", () => {
  const observed = retainedLive([withParts([keptSource, withdrawnSource])])
  const current = observeSubagentConversationLiveEvent(observed, {
    type: "message.part.removed", payload: { sessionID: partOwner.sessionID, messageID: partOwner.messageID, partID: withdrawnSource.id },
  })
  expect(afterRead(transcript([withParts([keptSource, withdrawnSource])]), observed, current).messages[0]!.parts).toEqual([keptSource])
})

test("a full read owns known prior live-only message membership", () => {
  const observed = retainedLive([retired, survivor])
  expect(afterRead(transcript([survivor], { transcriptMode: "snapshot" }), observed).messages.map((message) => message.messageID)).toEqual(["survivor"])
})

test("independent Message removals retain later original events while the read restores earlier ones", () => {
  const removal = (messageID: string) => ({ type: "message.removed", payload: { sessionID: "child-session", messageID } })
  let observed = retainedLive([retired, survivor, incoming])
  observed = observeSubagentConversationLiveEvent(observed, removal(retired.messageID))
  observed = observeSubagentConversationLiveEvent(observed, removal(survivor.messageID))
  const current = observeSubagentConversationLiveEvent(observed, removal(survivor.messageID))
  expect(afterRead(transcript([retired, survivor, incoming], { transcriptMode: "snapshot" }), observed, current).messages.map((message) => message.messageID)).toEqual(["retired", "incoming"])
})

test("a read from another Session preserves current live ownership", () => {
  const observed = retainedLive([partOwner])
  const read = transcript([survivor], { sessionID: "another-session" })
  expect(reconcileSubagentConversationLive(read, observed, observed)).toBe(observed)
})
