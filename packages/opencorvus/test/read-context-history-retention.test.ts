import { expect, test } from "bun:test"
import type { Provider } from "@/provider/provider"
import { Message } from "@/session/message"

const model = {
  id: "read-context-retention",
  providerID: "test",
  name: "Read Context Retention",
  limit: { context: 1_000_000, input: 900_000, output: 4_096 },
  cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
  capabilities: {
    toolcall: true,
    attachment: false,
    reasoning: false,
    temperature: true,
    interleaved: false,
    input: { text: true, image: false, audio: false, video: false, pdf: false },
    output: { text: true, image: false, audio: false, video: false, pdf: false },
  },
  api: { id: "read-context-retention", url: "https://test.invalid", npm: "@ai-sdk/anthropic" },
  options: {},
  headers: {},
  status: "active",
  release_date: "2026-08-11",
} as Provider.Model

function turn(index: number, output: string): Message.WithParts[] {
  const sessionID = "ses_read_context_history"
  const userMessageID = `msg_read_context_user_${index}`
  const assistantMessageID = `msg_read_context_assistant_${index}`
  const created = 1_000 + index * 10
  return [
    {
      info: {
        id: userMessageID,
        sessionID,
        role: "user",
        author: "orchestrator",
        time: { created },
        agent: "orchestrator",
        model: { providerID: model.providerID, modelID: model.id },
      },
      parts: [
        {
          id: `prt_read_context_user_${index}`,
          sessionID,
          messageID: userMessageID,
          type: "text",
          text: `Inspect decision-log page ${index}.`,
        },
      ],
    },
    {
      info: {
        id: assistantMessageID,
        sessionID,
        role: "assistant",
        author: "orchestrator",
        parentID: userMessageID,
        time: { created: created + 1, completed: created + 2 },
        agent: "orchestrator",
        path: { cwd: "D:\\project", root: "D:\\project" },
        cost: 0,
        tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
        modelID: model.id,
        providerID: model.providerID,
        finish: "stop",
      },
      parts: [
        {
          id: `prt_read_context_tool_${index}`,
          sessionID,
          messageID: assistantMessageID,
          type: "tool",
          callID: `call_read_context_${index}`,
          tool: "read_context",
          state: {
            status: "completed",
            input: { scope: "decisions" },
            output,
            title: "Decision Log",
            metadata: {},
            time: { start: created + 1, end: created + 2 },
          },
        },
      ],
    },
  ] as Message.WithParts[]
}

test("Decision Log reads retain every previously visible page in model context", async () => {
  const earlyDecision = "decision-001: preserve the exact ingress identity"
  const laterDecision = "decision-021: settle the exact runtime owner"
  const projected = await Message.toModelMessages(
    [...turn(1, earlyDecision), ...turn(2, laterDecision)],
    model,
  )
  const visible = JSON.stringify(projected)

  expect(visible).toContain(earlyDecision)
  expect(visible).toContain(laterDecision)
})
