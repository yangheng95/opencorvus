import { expect, test } from "bun:test"
import {
  CONVERSATION_DEFERRED_TOOL_STATE_METADATA_KEY,
  CONVERSATION_INLINE_TOOL_STATE_MAX_BYTES,
  CONVERSATION_TOOL_FILE_CHANGES_METADATA_KEY,
  conversationToolFileChanges,
} from "@opencorvus-ai/transport-protocol"
import {
  conversationTransportEventDisposition,
  projectConversationTransportEventPayload,
  projectConversationTransportMessage,
  projectConversationTransportPart,
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

test("retains bounded exact file observations in historical, updated and moved Tool projections", () => {
  const part = completedTool({
    id: "prt_actual_patch",
    output: "Two documents written",
    metadata: {
      files: [
        {
          filePath: "C:/project/docs/goal.md",
          type: "add",
          before: "",
          after: "正文\n".repeat(400),
          additions: 400,
          deletions: 0,
        },
        {
          filePath: "C:/project/old.md",
          movePath: "C:/project/docs/result.md",
          type: "move",
          before: "old\n",
          after: "new\n",
          additions: 1,
          deletions: 1,
        },
      ],
      diff: "large diff".repeat(1000),
      source: "actual-tool",
    },
  })
  part.tool = "apply_patch"
  const visible = Message.VisiblePart.parse({ ...part, orderKey: "patch-order" })
  const projections = [
    projectConversationTransportPart(visible),
    (projectConversationTransportEventPayload(Message.Event.PartUpdated.type, { part: visible }) as any).part,
    (projectConversationTransportEventPayload(Message.Event.Moved.type, { parts: [visible] }) as any).parts[0],
  ] as Message.ToolPart[]
  const expected = [
    { fileIndex: 0, filePath: "C:/project/docs/goal.md", status: "added", additions: 400, deletions: 0 },
    {
      fileIndex: 1,
      filePath: "C:/project/old.md",
      movePath: "C:/project/docs/result.md",
      status: "modified",
      additions: 1,
      deletions: 1,
    },
  ]
  for (const projected of projections) {
    expect(conversationToolFileChanges(projected.state.metadata)).toEqual(expected)
    expect(projected.state).toMatchObject({
      status: "completed",
      metadata: {
        source: "actual-tool",
        [CONVERSATION_DEFERRED_TOOL_STATE_METADATA_KEY]: { kind: "deferred" },
      },
    })
    expect(Buffer.byteLength(JSON.stringify(projected.state))).toBeLessThanOrEqual(
      CONVERSATION_INLINE_TOOL_STATE_MAX_BYTES,
    )
  }
})

test("bounds a complete file observation within the shared metadata budget", () => {
  const part = completedTool({
    id: "prt_metadata_budget",
    output: "x".repeat(5000),
    metadata: {
      filediff: { file: "C:/project/result.md", before: "before\n", after: "after\n", additions: 1, deletions: 1 },
      source: "s".repeat(500),
      title: "t".repeat(500),
    },
  })
  part.tool = "edit"
  const projected = projectConversationTransportPart(part) as Message.ToolPart
  const { [CONVERSATION_DEFERRED_TOOL_STATE_METADATA_KEY]: marker, ...retained } = projected.state.metadata
  expect(marker).toMatchObject({ kind: "deferred" })
  expect(retained[CONVERSATION_TOOL_FILE_CHANGES_METADATA_KEY]).toEqual([
    { fileIndex: 0, filePath: "C:/project/result.md", additions: 1, deletions: 1 },
  ])
  expect(Buffer.byteLength(JSON.stringify(retained))).toBeLessThanOrEqual(1024)
})

test.each([
  { readType: "text", offset: 24, lines: 2, totalLines: 30 },
  { readType: "directory", offset: 2, lines: 2, totalLines: 3 },
  { readType: "binary", lines: 0, totalLines: 0 },
])("preserves actual read result facts through bounded transport: %j", (facts) => {
  const part = completedTool({
    id: "prt_read_facts",
    output: "x".repeat(CONVERSATION_INLINE_TOOL_STATE_MAX_BYTES),
    metadata: { ...facts, preview: "large preview".repeat(1024) },
  })
  const projected = projectConversationTransportPart(part) as Message.ToolPart
  expect(projected.state).toMatchObject({ status: "completed", metadata: facts })
  expect(projected.state.metadata[CONVERSATION_DEFERRED_TOOL_STATE_METADATA_KEY]).toMatchObject({
    kind: "deferred",
    outputBytes: CONVERSATION_INLINE_TOOL_STATE_MAX_BYTES,
  })
})

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
      value: "runtime-only reasoning",
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
    value: "visible answer",
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
    title: `${"large-title".repeat(22)}large-tit…`,
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
  expect(Buffer.byteLength(JSON.stringify(state), "utf8")).toBeLessThanOrEqual(CONVERSATION_INLINE_TOOL_STATE_MAX_BYTES)
})

test.each([
  ["exact byte boundary", "a".repeat(254), "a".repeat(254)],
  ["ASCII prefix", "a".repeat(255), `${"a".repeat(251)}…`],
  ["Chinese code points", "测".repeat(100), `${"测".repeat(83)}…`],
  ["emoji code points", "😀".repeat(100), `${"😀".repeat(62)}…`],
  ["escaped quotes", '"'.repeat(128), `${'"'.repeat(125)}…`],
  ["escaped newlines", "\n".repeat(128), `${"\n".repeat(125)}…`],
  ["mixed-width boundary", `${"a".repeat(250)}😀z`, `${"a".repeat(250)}…`],
])("retains a bounded deferred Tool title with %s", (_case, title, expected) => {
  const part = completedTool({ id: "prt_title_budget", output: "x".repeat(CONVERSATION_INLINE_TOOL_STATE_MAX_BYTES) })
  part.state.title = title

  const projected = projectConversationTransportPart(part) as Message.ToolPart

  expect(projected.state).toMatchObject({ status: "completed", title: expected })
  expect(Buffer.byteLength(JSON.stringify(projected.state.title), "utf8")).toBeLessThanOrEqual(256)
  expect(Buffer.byteLength(JSON.stringify(projected.state), "utf8")).toBeLessThanOrEqual(
    CONVERSATION_INLINE_TOOL_STATE_MAX_BYTES,
  )
  expect(part.state.title).toBe(title)
})
