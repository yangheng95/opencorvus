import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test"
import { applyEvent, resetWriter } from "../src/services/tree-writer"
import { cardTreeStore } from "../src/store/card-tree"

const rootSessionID = "ses_incremental_projection_root"

const originalRequestAnimationFrame = globalThis.requestAnimationFrame
const originalCancelAnimationFrame = globalThis.cancelAnimationFrame
let nextFrameID = 1
let frames: Map<number, FrameRequestCallback>

beforeAll(() => {
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    const frameID = nextFrameID++
    frames.set(frameID, callback)
    return frameID
  }) as typeof requestAnimationFrame
  globalThis.cancelAnimationFrame = ((frameID: number) => {
    frames.delete(frameID)
  }) as typeof cancelAnimationFrame
})

afterAll(() => {
  if (originalRequestAnimationFrame) globalThis.requestAnimationFrame = originalRequestAnimationFrame
  else Reflect.deleteProperty(globalThis, "requestAnimationFrame")
  if (originalCancelAnimationFrame) globalThis.cancelAnimationFrame = originalCancelAnimationFrame
  else Reflect.deleteProperty(globalThis, "cancelAnimationFrame")
})

beforeEach(() => {
  nextFrameID = 1
  frames = new Map()
  resetWriter({ scrollIntent: "preserve", cause: "incremental-projection-test" })
})

/** Run every pending animation frame, the way the browser does before it paints. */
function paint(): void {
  const callbacks = [...frames.values()]
  frames.clear()
  for (const callback of callbacks) callback(0)
}

function pad(value: number): string {
  return String(value).padStart(16, "0")
}

function messageInfo(input: { sessionID: string; messageID: string; time: number }) {
  return {
    id: input.messageID,
    sessionID: input.sessionID,
    parentSessionID: rootSessionID,
    role: "assistant",
    author: "orchestrator",
    agent: "orchestrator",
    agentID: "orchestrator",
    sessionAgentID: "orchestrator",
    resolvedRole: "orchestrator",
    channel: "orchestrator",
    originSource: "",
    orderKey: `v1:${pad(input.time)}:${pad(30)}:${pad(0)}:message:${input.messageID}`,
    time: { created: input.time },
  }
}

function messageUpdated(input: { sessionID: string; messageID: string; time: number }) {
  const info = messageInfo(input)
  return { type: "message.updated", orderKey: info.orderKey, properties: { info } }
}

/** The backend bridge stamps origin metadata at the top level of every part
 *  event so a part that outruns its `message.updated` can still be routed. */
function partUpdated(input: {
  sessionID: string
  messageID: string
  partID: string
  time: number
  messageTime: number
  text: string
}) {
  const info = messageInfo({ sessionID: input.sessionID, messageID: input.messageID, time: input.messageTime })
  return {
    type: "message.part.updated",
    orderKey: info.orderKey,
    properties: {
      part: {
        id: input.partID,
        sessionID: input.sessionID,
        messageID: input.messageID,
        type: "text",
        text: input.text,
        orderKey: `v1:${pad(input.time)}:${pad(31)}:${pad(0)}:part:${input.partID}`,
      },
      orderKey: info.orderKey,
      channel: info.channel,
      agentID: info.agentID,
      sessionAgentID: info.sessionAgentID,
      resolvedRole: info.resolvedRole,
      role: info.role,
      author: info.author,
      originSource: info.originSource,
      parentSessionID: info.parentSessionID,
      parentMessageID: "",
    },
  }
}

function projectedCards(): Array<[string, any]> {
  return Object.entries(cardTreeStore.cards)
    .filter(([, card]: [string, any]) => String(card.sessionID || "").startsWith("ses_incremental_projection_s"))
    .sort(([a], [b]) => (a < b ? -1 : 1))
}

function partSignature(card: any): string[] {
  return (card.parts || []).map((part: any) => `${part.type}:${part.id ?? part.messageID ?? ""}`)
}

function cardSnapshot(): unknown {
  return projectedCards().map(([id, card]: [string, any]) => ({
    id,
    status: card.status,
    stage: card.stage,
    orderKey: card.orderKey,
    parts: partSignature(card),
    subtreeCounts: card.subtreeCounts ? { ...card.subtreeCounts } : null,
  }))
}

/**
 * A part that lands in a message turn the writer already projected is placed by
 * `upsertPart` alone: inside its own message's run, ahead of the next message's
 * boundary. Segmentation is derived from the message timeline, so nothing else
 * may be re-derived — every other card must keep the very `parts` array it
 * already had, which is what stops mounted cards from reconciling on every
 * streamed event.
 */
test("a part on an already-projected message rewrites one card and leaves the others untouched", () => {
  const sessionA = "ses_incremental_projection_sA"
  const sessionB = "ses_incremental_projection_sB"
  applyEvent(messageUpdated({ sessionID: sessionA, messageID: "msg_a1", time: 1_000 }))
  applyEvent(
    partUpdated({ sessionID: sessionA, messageID: "msg_a1", partID: "prt_a1", time: 1_001, messageTime: 1_000, text: "a1" }),
  )
  applyEvent(messageUpdated({ sessionID: sessionA, messageID: "msg_a2", time: 2_000 }))
  applyEvent(
    partUpdated({ sessionID: sessionA, messageID: "msg_a2", partID: "prt_a2", time: 2_001, messageTime: 2_000, text: "a2" }),
  )
  applyEvent(messageUpdated({ sessionID: sessionB, messageID: "msg_b1", time: 3_000 }))
  applyEvent(
    partUpdated({ sessionID: sessionB, messageID: "msg_b1", partID: "prt_b1", time: 3_001, messageTime: 3_000, text: "b1" }),
  )
  paint()

  const partsArraysBefore = new Map(projectedCards().map(([id, card]: [string, any]) => [id, card.parts]))
  expect(partsArraysBefore.size).toBe(2)

  applyEvent(
    partUpdated({ sessionID: sessionA, messageID: "msg_a1", partID: "prt_a3", time: 1_002, messageTime: 1_000, text: "a3" }),
  )
  paint()

  const after = projectedCards()
  const rewritten = after.filter(([id, card]: [string, any]) => partsArraysBefore.get(id) !== card.parts)
  const untouched = after.filter(([id, card]: [string, any]) => partsArraysBefore.get(id) === card.parts)

  expect({
    rewrittenCount: rewritten.length,
    rewrittenParts: rewritten.map(([, card]) => partSignature(card)),
    untouchedCount: untouched.length,
    untouchedParts: untouched.map(([, card]) => partSignature(card)),
  }).toEqual({
    rewrittenCount: 1,
    rewrittenParts: [["text:prt_a1", "text:prt_a3", "boundary:msg_a2", "text:prt_a2"]],
    untouchedCount: 1,
    untouchedParts: [["text:prt_b1"]],
  })
})

/**
 * A part that arrives before its `message.updated` has to create the message
 * turn itself. That is the one part-driven way segmentation can change, so the
 * regroup still runs and the turn is projected and then settled by its message.
 */
test("a part that outruns its message still creates and settles its turn", () => {
  const session = "ses_incremental_projection_sC"
  applyEvent(
    partUpdated({ sessionID: session, messageID: "msg_c1", partID: "prt_c1", time: 5_001, messageTime: 5_000, text: "c1" }),
  )
  paint()

  expect(projectedCards().map(([, card]) => partSignature(card))).toEqual([["text:prt_c1"]])

  applyEvent(messageUpdated({ sessionID: session, messageID: "msg_c1", time: 5_000 }))
  applyEvent(
    partUpdated({ sessionID: session, messageID: "msg_c1", partID: "prt_c2", time: 5_002, messageTime: 5_000, text: "c2" }),
  )
  paint()

  expect(projectedCards().map(([, card]) => partSignature(card))).toEqual([["text:prt_c1", "text:prt_c2"]])
})

/**
 * Subtree aggregates are a display cache, so they settle on the frame that
 * paints instead of on every event. The projection a viewer sees must not
 * depend on how many events happened to land in one frame.
 */
test("the projection is identical however events are divided into frames", () => {
  const session = "ses_incremental_projection_sD"
  const stream = [
    messageUpdated({ sessionID: session, messageID: "msg_d1", time: 30_000 }),
    partUpdated({ sessionID: session, messageID: "msg_d1", partID: "prt_d1", time: 30_001, messageTime: 30_000, text: "d1" }),
    partUpdated({ sessionID: session, messageID: "msg_d1", partID: "prt_d2", time: 30_002, messageTime: 30_000, text: "d2" }),
    messageUpdated({ sessionID: session, messageID: "msg_d2", time: 31_000 }),
    partUpdated({ sessionID: session, messageID: "msg_d2", partID: "prt_d3", time: 31_001, messageTime: 31_000, text: "d3" }),
    partUpdated({ sessionID: session, messageID: "msg_d1", partID: "prt_d4", time: 30_003, messageTime: 30_000, text: "d4" }),
  ]

  for (const event of stream) {
    applyEvent(structuredClone(event))
    paint()
  }
  const paintedEveryEvent = cardSnapshot()

  resetWriter({ scrollIntent: "preserve", cause: "incremental-projection-test" })
  for (const event of stream) applyEvent(structuredClone(event))
  paint()
  const paintedOnce = cardSnapshot()

  expect(paintedOnce).toEqual(paintedEveryEvent)
  expect(paintedOnce).toEqual([
    {
      id: expect.any(String),
      status: "running",
      stage: "orchestrator",
      orderKey: `v1:${pad(30_000)}:${pad(30)}:${pad(0)}:message:msg_d1`,
      parts: ["text:prt_d1", "text:prt_d2", "text:prt_d4", "boundary:msg_d2", "text:prt_d3"],
      subtreeCounts: expect.anything(),
    },
  ])
})
