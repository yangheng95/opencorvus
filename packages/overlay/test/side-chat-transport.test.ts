import { afterEach, expect, test } from "bun:test"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type { HostTransport, StreamHandlers, StreamOpenRequest, TransportRequest, TransportResponse } from "../src/services/host-transport"
import { replyInteraction, rejectInteraction } from "../src/services/interaction-reply"
import { connectSideChat } from "../src/services/side-chat"
import type { InteractionData } from "../src/components/InteractionCard"
import { questionInteraction, resolveQuestionInteraction, reuseQuestionInteraction } from "../src/utils/question-interaction"
import { AppLog } from "../src/utils/log"

afterEach(() => __setHostTransportForTest(undefined))

test("side permission decisions target the exact project-scoped Permission request", async () => {
  const requests: TransportRequest[] = []
  __setHostTransportForTest({
    request: async (request: TransportRequest) => {
      requests.push(request)
      return { status: 200, ok: true, headers: {}, body: {} }
    },
  } as unknown as HostTransport)
  const target = { id: "perm_side", directory: "D:/project-side" }
  await replyInteraction(target, "allow_once", false, {}, "permission")
  await rejectInteraction(target, false, "permission")
  expect(requests.map(({ path, query, body }) => ({ path, directory: query?.directory, body }))).toEqual([
    {
      path: "permission/perm_side/reply",
      directory: target.directory,
      body: { kind: "json", value: { decision: "allow_once" } },
    },
    {
      path: "permission/perm_side/reply",
      directory: target.directory,
      body: { kind: "json", value: { decision: "deny" } },
    },
  ])
})

test("the side stream projects actionable questions and permission requests into their canonical reply contracts", () => {
  let stream!: StreamHandlers
  let interactions: InteractionData[] = []
  __setHostTransportForTest({
    request: async () => ({ status: 200, ok: true, headers: {}, body: {} }),
    openStream: (_request: unknown, handlers: StreamHandlers) => {
      stream = handlers
      return { close() {} }
    },
  } as unknown as HostTransport)
  const close = connectSideChat(
    { sessionID: "ses_side", directory: "D:/project-side" },
    {
      transcript() {},
      connection() {},
      activity() {},
      error(error) {
        throw error
      },
      interactions(value) {
        interactions = value
      },
    },
  )
  try {
    stream.onEvent(
      JSON.stringify({
        type: "permission.asked",
        session_id: "ses_side",
        orderKey: "v1:0000000000001:0:0:interaction:perm_side",
        payload: {
          id: "perm_side",
          projectID: "project-side",
          sessionID: "ses_side",
          messageID: "message-side",
          toolCallID: "tool-side",
          mode: "ask",
          policyRevision: "policy-side",
          providerKind: "builtin",
          providerID: "read",
          providerDigest: "builtin-read",
          toolName: "read",
          effectClass: "read_local",
          scopeVersion: "1",
          summary: "Read project context",
          scope: { path: "README.md" },
          fingerprint: "read-project-context",
          projectGrantEligible: false,
          choices: ["allow_once", "deny"],
          timeCreated: 1,
        },
      }),
    )
    stream.onEvent(
      JSON.stringify({
        type: "question.asked",
        session_id: "ses_side",
        orderKey: "v1:0000000000001:0:0:interaction:qst_side",
        payload: {
          id: "qst_side",
          sessionID: "ses_side",
          timeCreated: 1,
          questions: [
            {
              header: "Focus",
              question: "Which part should I explain?",
              options: [{ value: "history", label: "History", description: "Explain the history" }],
            },
          ],
        },
      }),
    )
    expect(
      interactions.map(({ id, type, replyEndpoint, directory }) => ({ id, type, replyEndpoint, directory })),
    ).toEqual([
      { id: "perm_side", type: "permission", replyEndpoint: "permission", directory: "D:/project-side" },
      { id: "qst_side", type: "question", replyEndpoint: "question", directory: "D:/project-side" },
    ])
    stream.onEvent(
      JSON.stringify({
        type: "permission.replied",
        session_id: "ses_side",
        payload: { requestID: "perm_side", sessionID: "ses_side", decision: "allow_once" },
      }),
    )
    expect(interactions.map((item) => item.id)).toEqual(["qst_side"])
  } finally {
    close()
  }
})

function publicQuestion(id = "que_side") {
  return {
    id, sessionID: "ses_side", timeCreated: 1,
    orderKey: `v1:0000000000001:0:0:interaction:${id}`,
    questions: [{ header: "Focus", question: "Which public example?", options: [{ value: "cedar", label: "Cedar", description: "Use Cedar" }], multiple: true, custom: true }],
    tool: { messageID: "msg_side", callID: "call_side" },
    expiry: { origin: "deadline", timeoutMs: 300000, timeExpires: 300001 },
  }
}

function connectionSnapshot(pendingQuestions: unknown[], pendingPermissions: unknown[] = []) {
  return { type: "session.connected", payload: { sessionID: "ses_side", conversationSnapshot: {
    transcript: [], view: { topLevelSessionIDs: [], messages: [], sessions: [] },
    agentView: { topLevelExecutionIDs: [], messages: [], sessions: [] },
    history: { oldestTimestamp: null, oldestOrderKey: null, oldestMessageID: null, hasMore: false, limit: 80 }, pendingQuestions, pendingPermissions,
  } } }
}

function sideStream() {
  let stream!: StreamHandlers
  const updates: InteractionData[][] = []
  const errors: unknown[] = []
  __setHostTransportForTest({
    request: async () => ({ status: 200, ok: true, headers: {}, body: {} }),
    openStream: (_request: unknown, handlers: StreamHandlers) => { stream = handlers; return { close() {} } },
  } as unknown as HostTransport)
  const close = connectSideChat({ sessionID: "ses_side", directory: "D:/project-side" }, {
    transcript() {}, connection() {}, activity() {}, error(error) { errors.push(error) },
    interactions(value) { updates.push(value) },
  })
  return { updates, errors, close, send(event: unknown) { stream.onEvent(JSON.stringify(event)) } }
}

test("side transport recovery preserves its exact Question owner and reports current business outcomes", async () => {
  const streams: StreamHandlers[] = []
  const opened: StreamOpenRequest[] = []
  const reconnected = Promise.withResolvers<void>()
  const activityObserved = Promise.withResolvers<void>()
  const oldStatus = Promise.withResolvers<TransportResponse>()
  const currentStatus = Promise.withResolvers<TransportResponse>()
  const connections: boolean[] = []
  const activity: boolean[] = []
  const errors: unknown[] = []
  const updates: InteractionData[][] = []
  let statusReads = 0
  __setHostTransportForTest({
    request: async (request: TransportRequest) => request.path === "session/status"
      ? await (++statusReads === 1 ? oldStatus.promise : currentStatus.promise)
      : { status: 200, ok: true, headers: {}, body: {} },
    openStream(request: StreamOpenRequest, handlers: StreamHandlers) {
      opened.push(request)
      streams.push(handlers)
      if (streams.length === 2) reconnected.resolve()
      return { close(reason: string) { handlers.onClose?.(reason) } }
    },
  } as unknown as HostTransport)
  const close = connectSideChat({ sessionID: "ses_side", directory: "D:/project-side" }, {
    transcript() {},
    connection(value) { connections.push(value) },
    activity(value) { activity.push(value); activityObserved.resolve() },
    error(error) { errors.push(error) },
    interactions(value) { updates.push(value) },
  })
  const question = publicQuestion()
  const interrupted = new Error("Owned stream interrupted")
  const businessError = { name: "PublicSessionError", data: { message: "Current provider request failed" } }
  try {
    streams[0]!.onEvent(JSON.stringify(connectionSnapshot([question])))
    const original = updates[0]![0]
    streams[0]!.onError?.(interrupted)
    await reconnected.promise
    streams[1]!.onEvent(JSON.stringify(connectionSnapshot([JSON.parse(JSON.stringify(question))])))
    oldStatus.reject(new Error("Retired status observation failed"))
    await new Promise(resolve => setTimeout(resolve, 0))
    currentStatus.resolve({ status: 200, ok: true, headers: {}, body: { ses_side: { type: "streaming" } } })
    await activityObserved.promise
    streams[1]!.onEvent(JSON.stringify({
      type: "session.error", event_id: "evt_current_error", session_id: "ses_side", emittedAt: 2, timestamp: 2,
      sequence: 1, orderKey: "v1:0000000000002:0:0:session:ses_side",
      payload: { sessionID: "ses_side", error: businessError },
    }))
    expect(connections).toEqual([true, false, true])
    expect(opened.map(({ path, query }) => ({ path, directory: query?.directory }))).toEqual([
      { path: "session/ses_side/events", directory: "D:/project-side" },
      { path: "session/ses_side/events", directory: "D:/project-side" },
    ])
    expect(updates[1]![0]).toBe(original)
    expect(activity).toEqual([true])
    expect(errors).toEqual([businessError])
    expect(AppLog.entries.at(-1)).toMatchObject({
      level: "warn", service: "side-chat",
      extra: { sessionID: "ses_side", directory: "D:/project-side", connectionGeneration: 1, error: interrupted.stack },
    })
  } finally {
    oldStatus.resolve({ status: 200, ok: true, headers: {}, body: {} })
    currentStatus.resolve({ status: 200, ok: true, headers: {}, body: {} })
    close()
  }
}, 10000)

test("a current Side activity observation delivers its original failure contract", async () => {
  let stream!: StreamHandlers
  const failure = new Error("Current status observation failed")
  const reported = Promise.withResolvers<unknown>()
  __setHostTransportForTest({
    request: async () => { throw failure },
    openStream(_request: StreamOpenRequest, handlers: StreamHandlers) { stream = handlers; return { close() {} } },
  } as unknown as HostTransport)
  const close = connectSideChat({ sessionID: "ses_side", directory: "D:/project-side" }, {
    transcript() {}, connection() {}, activity() {}, interactions() {},
    error(error) { reported.resolve(error) },
  })
  try {
    stream.onEvent(JSON.stringify(connectionSnapshot([publicQuestion()])))
    expect(await reported.promise).toBe(failure)
  } finally { close() }
})

test("a side connection snapshot retains the same full Question owner and converges the canonical pending set", () => {
  const connection = sideStream()
  const question = publicQuestion()
  const retired = publicQuestion("que_retired")
  const added = publicQuestion("que_added")
  try {
    connection.send(connectionSnapshot([question, retired]))
    const original = connection.updates[0]![0]!
    connection.send({ type: "question.asked", session_id: question.sessionID, orderKey: question.orderKey, payload: question })
    expect(connection.updates[1]![0]).toBe(original)
    connection.send(connectionSnapshot([JSON.parse(JSON.stringify(question)), added]))
    expect(connection.updates.map((value) => value.map((item) => item.id))).toEqual([
      [question.id, retired.id], [question.id, retired.id], [question.id, added.id],
    ])
    expect(connection.updates[2]![0]).toBe(original)
    expect(original).toMatchObject({ sessionID: question.sessionID, directory: "D:/project-side", payload: { expiry: question.expiry, tool: question.tool, questions: question.questions } })
    connection.send(connectionSnapshot([]))
    expect(connection.updates.at(-1)).toEqual([])
  } finally { connection.close() }
})

test("the side snapshot selects its exact Session from the canonical legal conversation tree", () => {
  const connection = sideStream()
  const own = publicQuestion()
  try {
    connection.send(connectionSnapshot([own, { ...publicQuestion("que_child"), sessionID: "ses_child" }]))
    expect(connection.updates.at(-1)?.map((question) => ({ id: question.id, directory: question.directory }))).toEqual([
      { id: own.id, directory: "D:/project-side" },
    ])
  } finally { connection.close() }
})

for (const [type, properties, status, response] of [
  ["question.replied", { answers: [["cedar"]], automatic: true }, "answered", { answers: [["cedar"]], auto_reply: true }],
  ["question.rejected", { origin: "operator" }, "rejected", { origin: "operator" }],
  ["question.expired", { origin: "deadline", timeExpires: 2 }, "expired", { origin: "deadline", time_expires: 2 }],
  ["question.abandoned", { origin: "infrastructure" }, "expired", { origin: "infrastructure" }],
] as const) {
  test(`${type} preserves its actual terminal provenance and leaves the other side Question pending`, () => {
    const connection = sideStream()
    const question = publicQuestion()
    const remaining = publicQuestion("que_remaining")
    const payload = { requestID: question.id, sessionID: question.sessionID, timeResolved: 2, ...properties }
    const orderKey = `v1:0000000000002:0:0:interaction:${question.id}_response`
    try {
      connection.send(connectionSnapshot([question, remaining]))
      const original = connection.updates[0]![0]
      const resolved = resolveQuestionInteraction(original, type, payload, orderKey)
      expect(resolved).toMatchObject({ id: question.id, status, response, time: { created: 1, resolved: 2 }, responseOrderKey: orderKey })
      expect(resolveQuestionInteraction(resolved, type, payload, orderKey)).toBe(resolved)
      connection.send({ type, session_id: question.sessionID, orderKey, payload })
      expect(connection.updates.at(-1)?.map((item) => item.id)).toEqual([remaining.id])
    } finally { connection.close() }
  })
}

test("a changed immutable Question expiry reports an explicit contract error with its original owner intact", () => {
  const connection = sideStream()
  const question = publicQuestion()
  try {
    connection.send(connectionSnapshot([question]))
    const original = connection.updates[0]![0]
    connection.send(connectionSnapshot([{ ...question, expiry: { ...question.expiry, timeExpires: 300002 } }]))
    expect(connection.errors[0]).toBeInstanceOf(Error)
    expect((connection.errors[0] as Error).message).toBe(`question ${question.id} immutable Request changed`)
    expect(connection.updates.at(-1)?.[0]).toBe(original)
  } finally { connection.close() }
})

test("a connection response missing mandatory pendingQuestions produces the current protocol error", () => {
  const connection = sideStream()
  try {
    connection.send({ type: "session.connected", payload: { sessionID: "ses_side", conversationSnapshot: {
      transcript: [], view: { topLevelSessionIDs: [], messages: [], sessions: [] },
      agentView: { topLevelExecutionIDs: [], messages: [], sessions: [] },
      history: { oldestTimestamp: null, oldestOrderKey: null, oldestMessageID: null, hasMore: false, limit: 80 }, pendingPermissions: [],
    } } })
    expect(connection.errors[0]).toBeInstanceOf(Error)
    expect((connection.errors[0] as Error).message).toBe("pendingQuestions must be an array")
  } finally { connection.close() }
})

test("a pending replay against a real terminal reports identity corruption instead of rewriting its status", () => {
  const question = publicQuestion()
  const original = questionInteraction(question, "D:/project-side")
  const resolved = resolveQuestionInteraction(original, "question.replied", {
    requestID: question.id, sessionID: question.sessionID, timeResolved: 2, answers: [["cedar"]],
  }, `v1:0000000000002:0:0:interaction:${question.id}_response`)
  expect(() => reuseQuestionInteraction(resolved, original)).toThrow(`question ${question.id} pending Request conflicts with its answered terminal`)
})
