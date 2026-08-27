import { expect, test } from "bun:test"
import {
  CONVERSATION_DEFERRED_TOOL_STATE_METADATA_KEY,
  CONVERSATION_INLINE_TOOL_STATE_MAX_BYTES,
} from "@opencorvus-ai/transport-protocol"
import {
  conversationTransportEventDisposition,
  projectConversationTransportEventPayload,
  projectConversationTransportMessage,
} from "@/conversation/transport"
import { Message } from "@/session/message"

function completedTool(input: { id: string; output: string; metadata?: Record<string, unknown> }): Message.ToolPart {
  return Message.ToolPart.parse({
    id: input.id,
    sessionID: "ses_transport_projection",
    messageID: "msg_transport_projection",
    type: "tool",
    callID: `call_${input.id}`,
    tool: "read",
    state: {
      status: "completed",
      input: { filePath: "README.md" },
      output: input.output,
      title: "Read README.md",
      metadata: input.metadata ?? { source: "test" },
      time: { start: 10, end: 20 },
    },
  })
}

test("projects one bounded first-paint transcript while retaining exact persisted identity", () => {
  const largeOutput = "测".repeat(CONVERSATION_INLINE_TOOL_STATE_MAX_BYTES)
  const smallOutput = "small exact output"
  const message = Message.VisibleWithParts.parse({
    info: {
      id: "msg_transport_projection",
      sessionID: "ses_transport_projection",
      role: "assistant",
      author: "tester",
      time: { created: 1, completed: 30 },
      parentID: "msg_parent",
      modelID: "test-model",
      providerID: "test-provider",
      mode: "test",
      agent: "tester",
      path: { cwd: "C:/project", root: "C:/project" },
      cost: 0,
      tokens: { total: 3, input: 1, output: 1, reasoning: 1, cache: { read: 0, write: 0 } },
      finish: "stop",
      orderKey: "v1:0000000000000001:0000000000000000:0000000000000000:message:msg_transport_projection",
    },
    parts: [
      {
        id: "prt_text",
        sessionID: "ses_transport_projection",
        messageID: "msg_transport_projection",
        orderKey: "v1:0000000000000002:0000000000000000:0000000000000000:part:prt_text",
        type: "text",
        text: "Visible answer",
      },
      {
        id: "prt_reasoning",
        sessionID: "ses_transport_projection",
        messageID: "msg_transport_projection",
        orderKey: "v1:0000000000000003:0000000000000000:0000000000000000:part:prt_reasoning",
        type: "reasoning",
        text: "Runtime-only reasoning",
        time: { start: 2, end: 3 },
      },
      { ...completedTool({ id: "prt_large", output: largeOutput }), orderKey: "part-large-order" },
      { ...completedTool({ id: "prt_small", output: smallOutput }), orderKey: "part-small-order" },
    ],
  })

  const projected = projectConversationTransportMessage(message)
  expect(projected).toMatchObject({
    info: { id: message.info.id, sessionID: message.info.sessionID },
    parts: [
      { id: "prt_text", type: "text", text: "Visible answer" },
      {
        id: "prt_large",
        type: "tool",
        state: {
          status: "completed",
          output: "",
          metadata: {
            source: "test",
            [CONVERSATION_DEFERRED_TOOL_STATE_METADATA_KEY]: {
              kind: "deferred",
              outputBytes: Buffer.byteLength(largeOutput, "utf8"),
              stateBytes: expect.any(Number),
              stateSha256: expect.any(String),
            },
          },
        },
      },
      { id: "prt_small", type: "tool", state: { status: "completed", output: smallOutput } },
    ],
  })
})

test("projects the same bounded Tool Part through the exact live event envelope", () => {
  const largeOutput = "live-output\n".repeat(600)
  const part = Message.VisiblePart.parse({
    ...completedTool({ id: "prt_live", output: largeOutput, metadata: { live: true } }),
    orderKey: "part-live-order",
  })
  const projected = projectConversationTransportEventPayload(Message.Event.PartUpdated.type, {
    orderKey: "message-owner-order",
    part,
  }) as { part: Message.ToolPart }

  expect(projected).toMatchObject({
    orderKey: "message-owner-order",
    part: {
      id: "prt_live",
      sessionID: "ses_transport_projection",
      messageID: "msg_transport_projection",
      state: {
        status: "completed",
        output: "",
        metadata: {
          live: true,
          [CONVERSATION_DEFERRED_TOOL_STATE_METADATA_KEY]: {
            kind: "deferred",
            outputBytes: Buffer.byteLength(largeOutput, "utf8"),
            stateBytes: expect.any(Number),
            stateSha256: expect.any(String),
          },
        },
      },
    },
  })
})

test("defers a large Tool input while preserving its compact display identity", () => {
  const part = completedTool({ id: "prt_large_input", output: "written" })
  part.state.input = {
    filePath: "D:/project/report.md",
    content: "large-input".repeat(CONVERSATION_INLINE_TOOL_STATE_MAX_BYTES),
  }

  const projected = projectConversationTransportMessage(
    Message.VisibleWithParts.parse({
      info: {
        id: "msg_transport_projection",
        sessionID: "ses_transport_projection",
        role: "assistant",
        author: "tester",
        time: { created: 1, completed: 30 },
        parentID: "msg_parent",
        modelID: "test-model",
        providerID: "test-provider",
        mode: "test",
        agent: "tester",
        path: { cwd: "C:/project", root: "C:/project" },
        cost: 0,
        tokens: { total: 3, input: 1, output: 1, reasoning: 1, cache: { read: 0, write: 0 } },
        finish: "stop",
        orderKey: "message-large-input-order",
      },
      parts: [{ ...part, orderKey: "part-large-input-order" }],
    }),
  )

  expect(projected.parts[0]).toMatchObject({
    id: "prt_large_input",
    state: {
      input: { filePath: "D:/project/report.md" },
      output: "",
      metadata: {
        [CONVERSATION_DEFERRED_TOOL_STATE_METADATA_KEY]: {
          kind: "deferred",
          outputBytes: Buffer.byteLength("written", "utf8"),
          stateBytes: expect.any(Number),
          stateSha256: expect.any(String),
        },
      },
    },
  })
})

test("classifies the complete live Reasoning Part sequence as omitted display transport", () => {
  const dispositions = [
    conversationTransportEventDisposition(Message.Event.PartUpdated.type, {
      part: {
        id: "prt_reasoning_live",
        sessionID: "ses_transport_projection",
        messageID: "msg_transport_projection",
        type: "reasoning",
        text: "",
        time: { start: 10 },
        orderKey: "part-reasoning-live-order",
      },
    }),
    conversationTransportEventDisposition(Message.Event.PartDelta.type, {
      sessionID: "ses_transport_projection",
      messageID: "msg_transport_projection",
      partID: "prt_reasoning_live",
      partType: "reasoning",
      field: "text",
      delta: "runtime-only reasoning",
    }),
    conversationTransportEventDisposition(Message.Event.PartUpdated.type, {
      part: {
        id: "prt_reasoning_live",
        sessionID: "ses_transport_projection",
        messageID: "msg_transport_projection",
        type: "reasoning",
        text: "runtime-only reasoning",
        time: { start: 10, end: 20 },
        orderKey: "part-reasoning-live-order",
      },
    }),
    conversationTransportEventDisposition(Message.Event.PartRemoved.type, {
      sessionID: "ses_transport_projection",
      messageID: "msg_transport_projection",
      partID: "prt_reasoning_live",
      partType: "reasoning",
    }),
  ]

  expect(dispositions).toEqual(["omit", "omit", "omit", "omit"])
})

test("retains the exact live Text delta classification", () => {
  const disposition = conversationTransportEventDisposition(Message.Event.PartDelta.type, {
    sessionID: "ses_transport_projection",
    messageID: "msg_transport_projection",
    partID: "prt_text_live",
    partType: "text",
    field: "text",
    delta: "visible answer",
  })

  expect(disposition).toBe("project")
})

test("projects a large completed Tool into one explicitly bounded state shape", () => {
  const part = completedTool({ id: "prt_large_attachment", output: "small" })
  part.state.title = "large-title".repeat(CONVERSATION_INLINE_TOOL_STATE_MAX_BYTES)
  part.state.attachments = [
    {
      id: "prt_attachment",
      sessionID: "ses_transport_projection",
      messageID: "msg_transport_projection",
      type: "file",
      mime: "text/plain",
      filename: "evidence.txt",
      url: `/attachment/${"x".repeat(CONVERSATION_INLINE_TOOL_STATE_MAX_BYTES)}`,
    },
  ]

  const projected = projectConversationTransportMessage(
    Message.VisibleWithParts.parse({
      info: {
        id: "msg_transport_projection",
        sessionID: "ses_transport_projection",
        role: "assistant",
        author: "tester",
        time: { created: 1, completed: 30 },
        parentID: "msg_parent",
        modelID: "test-model",
        providerID: "test-provider",
        mode: "test",
        agent: "tester",
        path: { cwd: "C:/project", root: "C:/project" },
        cost: 0,
        tokens: { total: 3, input: 1, output: 1, reasoning: 1, cache: { read: 0, write: 0 } },
        finish: "stop",
        orderKey: "message-large-attachment-order",
      },
      parts: [{ ...part, orderKey: "part-large-attachment-order" }],
    }),
  )
  const state = (projected.parts[0] as Message.ToolPart).state

  expect(Object.keys(state).sort()).toEqual(["input", "metadata", "output", "status", "time", "title"])
  expect(state).toMatchObject({
    status: "completed",
    input: { filePath: "README.md" },
    output: "",
    title: "",
    metadata: {
      source: "test",
      [CONVERSATION_DEFERRED_TOOL_STATE_METADATA_KEY]: {
        kind: "deferred",
        outputBytes: Buffer.byteLength("small", "utf8"),
        stateBytes: expect.any(Number),
        stateSha256: expect.any(String),
      },
    },
    time: { start: 10, end: 20 },
  })
  expect(Buffer.byteLength(JSON.stringify(state), "utf8")).toBeLessThanOrEqual(
    CONVERSATION_INLINE_TOOL_STATE_MAX_BYTES,
  )
})
