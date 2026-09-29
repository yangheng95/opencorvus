import { afterEach, expect, test } from "bun:test"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type { HostTransport, StreamHandlers, TransportRequest } from "../src/services/host-transport"
import { replyInteraction, rejectInteraction } from "../src/services/interaction-reply"
import { connectSideChat } from "../src/services/side-chat"
import type { InteractionData } from "../src/components/InteractionCard"

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
        payload: {
          id: "perm_side",
          sessionID: "ses_side",
          toolName: "read",
          summary: "Read project context",
          scope: { path: "README.md" },
          choices: ["allow_once", "deny"],
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
              options: [{ value: "history", label: "History" }],
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
        payload: { requestID: "perm_side", decision: "allow_once" },
      }),
    )
    expect(interactions.map((item) => item.id)).toEqual(["qst_side"])
  } finally {
    close()
  }
})
