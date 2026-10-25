import { expect, test } from "bun:test"
import { CONVERSATION_INLINE_TOOL_STATE_MAX_BYTES } from "@opencorvus-ai/transport-protocol"
import { projectConversationTransportEventPayload, projectConversationTransportPart } from "@/conversation/transport"
import { Message } from "@/session/message"

test.each([0, 1, 7, null])("retains the actual command exit %j through bounded history and live projections", (exit) => {
  const output = "中文诊断输出\n".repeat(CONVERSATION_INLINE_TOOL_STATE_MAX_BYTES)
  const part = Message.VisiblePart.parse({
    id: "prt_command_exit",
    sessionID: "ses_command_exit",
    messageID: "msg_command_exit",
    orderKey: "command-exit-order",
    type: "tool",
    callID: "call_command_exit",
    tool: "bash",
    state: {
      status: "completed",
      input: { command: "diagnostic", description: "Command exit contract" },
      title: "Command exit contract",
      output,
      metadata: { output, exit, background: exit === null },
      time: { start: 10, end: 20 },
    },
  }) as Message.ToolPart
  const projections = [
    projectConversationTransportPart(part),
    (projectConversationTransportEventPayload(Message.Event.PartUpdated.type, { part }) as any).part,
    (projectConversationTransportEventPayload(Message.Event.Moved.type, { parts: [part] }) as any).parts[0],
  ] as Message.ToolPart[]
  for (const projected of projections) {
    expect(projected.state).toMatchObject({ status: "completed", metadata: { exit } })
    expect(Buffer.byteLength(JSON.stringify(projected.state))).toBeLessThanOrEqual(CONVERSATION_INLINE_TOOL_STATE_MAX_BYTES)
  }
  expect(part.state).toMatchObject({ status: "completed", output, metadata: { output, exit } })
})
