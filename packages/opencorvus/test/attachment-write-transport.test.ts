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
