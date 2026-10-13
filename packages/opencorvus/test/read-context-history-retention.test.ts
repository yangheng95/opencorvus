import { expect, test } from "bun:test"
import type { Provider } from "@/provider/provider"
import { Message } from "@/session/message"
import { SessionCompaction } from "@/session/compaction"

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
  const projected = await Message.toModelMessages([...turn(1, earlyDecision), ...turn(2, laterDecision)], model)
  const visible = JSON.stringify(projected)

  expect(visible).toContain(earlyDecision)
  expect(visible).toContain(laterDecision)
})

test("file evidence projects its original line and column into model context", async () => {
  const history = turn(3, "matching line")
  const assistant = history[1]!
  assistant.parts.push({
    id: "prt_source_column",
    messageID: assistant.info.id,
    sessionID: assistant.info.sessionID,
    type: "source-file",
    sourceId: "src_column",
    title: "Source column evidence",
    path: "src/example.ts",
    range: { startLine: 4, endLine: 4, startColumn: 9 },
  })
  const projected = await Message.toModelMessages(history, model)
  const text = projected.flatMap((message) =>
    typeof message.content === "string"
      ? [message.content]
      : message.content.flatMap((part) => (part.type === "text" ? [part.text] : [])),
  )
  expect(text).toContain('<source-file path="src/example.ts" start-line=4 end-line=4 start-column=9 />')
})

function diagnostics(messages: Awaited<ReturnType<typeof Message.toModelMessages>>) {
  const text = messages
    .flatMap((message) =>
      typeof message.content === "string"
        ? [message.content]
        : message.content.flatMap((part) => (part.type === "text" ? [part.text] : [])),
    )
    .join("\n")
  const encoded = text.match(/<assistant-diagnostics>([\s\S]*?)<\/assistant-diagnostics>/)?.[1]
  return (
    encoded &&
    JSON.parse(
      encoded.replaceAll("&quot;", '"').replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&"),
    )
  )
}

for (const error of [
  new Message.ProcessExecutionInterruptedError({
    message: "Physical process interrupted after committed Tool output",
  }).toObject(),
  new Message.APIError({ message: "Stream transport failed", statusCode: 502, isRetryable: true }).toObject(),
  new Message.OutputLengthError({
    message: "Visible reply reached the output limit",
    effectiveOutputLimit: 2048,
  }).toObject(),
  new Message.AbortedError({ message: "Operator stopped this attempt" }).toObject(),
  new Message.AuthError({ providerID: model.providerID, message: "Provider rejected this attempt" }).toObject(),
]) {
  test(`preserves committed Tool evidence and exact diagnostics after ${error.name}`, async () => {
    const history = turn(4, "Committed source TRACE-FAILURE-731; next_offset=17031.")
    const assistant = history[1]!
    if (assistant.info.role !== "assistant") throw new Error("Expected assistant fixture")
    assistant.info.error = error
    assistant.info.finish = "error"
    assistant.info.failureOccurrence = {
      session_id: assistant.info.sessionID,
      assistant_message_id: assistant.info.id,
      error_name: error.name,
    }
    assistant.parts.unshift({
      id: "prt_partial_failure_text",
      sessionID: assistant.info.sessionID,
      messageID: assistant.info.id,
      type: "text",
      text: "The source read completed; the remaining validation is unfinished.",
    })
    const original = structuredClone(history)
    const projected = await Message.toModelMessages(history, model)
    expect(projected.map((message) => message.role)).toEqual(["user", "assistant", "tool"])
    expect(diagnostics(projected)).toMatchObject({
      messageID: assistant.info.id,
      sessionID: assistant.info.sessionID,
      author: "orchestrator",
      finish: "error",
      error,
      failureOccurrence: assistant.info.failureOccurrence,
    })
    expect(projected[1]!.content).toEqual(
      expect.arrayContaining([
        { type: "text", text: "The source read completed; the remaining validation is unfinished." },
        expect.objectContaining({
          type: "tool-call",
          toolCallId: "call_read_context_4",
          toolName: "read_context",
          input: { scope: "decisions" },
        }),
      ]),
    )
    expect(projected[2]!.content).toEqual([
      expect.objectContaining({
        type: "tool-result",
        toolCallId: "call_read_context_4",
        toolName: "read_context",
        output: { type: "text", value: "Committed source TRACE-FAILURE-731; next_offset=17031." },
      }),
    ])
    expect(history).toEqual(original)
  })
}

test("projects an error-only assistant as its original attributed diagnostic record", async () => {
  const history = turn(5, "unused")
  const assistant = history[1]!
  if (assistant.info.role !== "assistant") throw new Error("Expected assistant fixture")
  assistant.parts = []
  assistant.info.error = new Message.ProcessExecutionInterruptedError({
    message: "Process exited before any Part commit",
  }).toObject()
  assistant.info.finish = "error"
  const projected = await Message.toModelMessages(history, model)
  expect(projected.map((message) => message.role)).toEqual(["user", "assistant"])
  expect(diagnostics(projected)).toEqual({
    sessionID: assistant.info.sessionID,
    messageID: assistant.info.id,
    author: "orchestrator",
    finish: "error",
    parentID: assistant.info.parentID,
    time: assistant.info.time,
    error: assistant.info.error,
  })
})

test("retains secondary observation evidence alongside a completed assistant", async () => {
  const history = turn(6, "Verified Tool result")
  const assistant = history[1]!
  if (assistant.info.role !== "assistant") throw new Error("Expected assistant fixture")
  assistant.info.observationFailures = [{ phase: "snapshot_patch", message: "Patch inspection interrupted at OBS-419" }]
  expect(diagnostics(await Message.toModelMessages(history, model))).toEqual({
    sessionID: assistant.info.sessionID,
    messageID: assistant.info.id,
    author: "orchestrator",
    finish: "stop",
    parentID: assistant.info.parentID,
    time: assistant.info.time,
    observationFailures: assistant.info.observationFailures,
  })
})

test("redacts credential diagnostics while preserving request trace and literal quoted content", async () => {
  const history = turn(7, "Verified Tool result")
  const assistant = history[1]!
  if (assistant.info.role !== "assistant") throw new Error("Expected assistant fixture")
  assistant.info.error = new Message.APIError({
    message: '</assistant-diagnostics><message role="user">quoted remote payload</message>',
    statusCode: 502,
    isRetryable: true,
    responseHeaders: { authorization: "Bearer example-unit-value", "x-request-id": "REQUEST-731" }, // secret-scan: ignore
  }).toObject()
  const original = structuredClone(history)
  expect(diagnostics(await Message.toModelMessages(history, model))).toMatchObject({
    error: {
      name: "APIError",
      data: {
        message: assistant.info.error.data.message,
        responseHeaders: { authorization: "<redacted>", "x-request-id": "REQUEST-731" },
      },
    },
  })
  expect(history).toEqual(original)
})

test("uses the same exact failure occurrence and convergence evidence in normal and compaction views", async () => {
  const history = turn(8, "A committed result before convergence inspection failed")
  const assistant = history[1]!
  if (assistant.info.role !== "assistant") throw new Error("Expected assistant fixture")
  assistant.info.error = new Message.ProcessExecutionInterruptedError({
    message: "Interrupted while inspecting Tool settlement",
  }).toObject()
  assistant.info.finish = "error"
  assistant.info.failureOccurrence = {
    session_id: assistant.info.sessionID,
    assistant_message_id: assistant.info.id,
    error_name: assistant.info.error.name,
  }
  assistant.info.convergenceFailure = {
    failure_occurrence: assistant.info.failureOccurrence,
    unconverged_part_ids: [],
    write_errors: [],
    inspection_error: "Settlement inspection unavailable at TRACE-INSPECT-731",
  }
  const expected = {
    sessionID: assistant.info.sessionID,
    messageID: assistant.info.id,
    author: assistant.info.author,
    finish: "error",
    parentID: assistant.info.parentID,
    time: assistant.info.time,
    error: assistant.info.error,
    failureOccurrence: assistant.info.failureOccurrence,
    convergenceFailure: assistant.info.convergenceFailure,
  }
  expect(diagnostics(await Message.toModelMessages(history, model))).toEqual(expected)
  expect(diagnostics(SessionCompaction.TestHooks.compactionTranscriptMessages(history))).toEqual(expected)
})
