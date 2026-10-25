import { expect, test } from "bun:test"
import {
  CONVERSATION_INLINE_TOOL_STATE_MAX_BYTES,
  conversationAttachmentWriteChange,
  conversationToolFileChanges,
} from "@opencorvus-ai/transport-protocol"
import { Message } from "../src/session/message"
import {
  projectConversationTransportPart,
  projectConversationTransportEventPayload,
} from "../src/conversation/transport"

const sha = "4102141fdaf47468b751e09241c0b9288e091a769f6e9bb33055aee849c941fa"
const metadata = {
  filepath: "C:/owned-project/交付/工时汇总.xlsx",
  exists: false,
  source: {
    url: `/attachment/prj_source/${sha}.xlsx`,
    sha,
    size: 4853,
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: "工时汇总.xlsx",
  },
  bytes: 4853,
}
const expected = {
  fileIndex: 0,
  filePath: metadata.filepath,
  status: "added",
  isText: false,
  additions: null,
  deletions: null,
}

test("a verified create-only attachment save projects its actual file observation with opaque-byte statistics", () => {
  expect(conversationAttachmentWriteChange(metadata)).toEqual(expected)
})

test("history, updated and moved transport projections retain the same created attachment observation", () => {
  const part = Message.VisiblePart.parse({
    id: "prt_saved_attachment",
    sessionID: "ses_saved_attachment",
    messageID: "msg_saved_attachment",
    type: "tool",
    orderKey: "saved-attachment",
    tool: "write",
    callID: "call_saved_attachment",
    state: {
      status: "completed",
      input: { filePath: metadata.filepath, attachmentUrl: metadata.source.url },
      output: "Wrote attachment file successfully.",
      title: "交付/工时汇总.xlsx",
      metadata: { ...metadata, diagnostic: "Actual large native Tool evidence. ".repeat(300) },
      time: { start: 10, end: 20 },
    },
  })
  const projections = [
    projectConversationTransportPart(part),
    (projectConversationTransportEventPayload(Message.Event.PartUpdated.type, { part }) as any).part,
    (projectConversationTransportEventPayload(Message.Event.Moved.type, { parts: [part] }) as any).parts[0],
  ] as Message.ToolPart[]
  for (const projected of projections) {
    expect(conversationToolFileChanges(projected.state.metadata)).toEqual([expected])
    expect(Buffer.byteLength(JSON.stringify(projected.state))).toBeLessThanOrEqual(
      CONVERSATION_INLINE_TOOL_STATE_MAX_BYTES,
    )
  }
})

test("text write comparisons retain actual added and modified status through all bounded transport views", () => {
  for (const status of ["added", "modified"] as const) {
    const before = status === "added" ? "" : "Original text\n",
      after = "Actual text\n".repeat(500)
    const part = Message.VisiblePart.parse({
      id: "prt_text_write_" + status,
      sessionID: "ses_text_write",
      messageID: "msg_text_write_" + status,
      type: "tool",
      orderKey: "text-write-" + status,
      tool: "write",
      callID: "call_text_write_" + status,
      state: {
        status: "completed",
        input: { filePath: "C:/owned-project/实际正文.txt", content: after },
        output: "Wrote file successfully.",
        title: "实际正文.txt",
        metadata: {
          filepath: "C:/owned-project/实际正文.txt",
          exists: status === "modified",
          filediff: {
            file: "C:/owned-project/实际正文.txt",
            before,
            after,
            status,
            additions: 500,
            deletions: status === "added" ? 0 : 1,
          },
        },
        time: { start: 10, end: 20 },
      },
    })
    const projections = [
      projectConversationTransportPart(part),
      (projectConversationTransportEventPayload(Message.Event.PartUpdated.type, { part }) as any).part,
      (projectConversationTransportEventPayload(Message.Event.Moved.type, { parts: [part] }) as any).parts[0],
    ] as Message.ToolPart[]
    for (const projected of projections) {
      expect(conversationToolFileChanges(projected.state.metadata)).toEqual([
        {
          fileIndex: 0,
          filePath: "C:/owned-project/实际正文.txt",
          status,
          additions: 500,
          deletions: status === "added" ? 0 : 1,
        },
      ])
      expect(Buffer.byteLength(JSON.stringify(projected.state))).toBeLessThanOrEqual(
        CONVERSATION_INLINE_TOOL_STATE_MAX_BYTES,
      )
    }
  }
})
