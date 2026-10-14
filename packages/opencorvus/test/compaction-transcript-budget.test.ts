import { afterEach, expect, test } from "bun:test"
import { tool, type ModelMessage } from "ai"
import z from "zod"
import fs from "node:fs/promises"
import path from "node:path"
import { SessionCompaction } from "@/session/compaction"
import { CompactionEvidenceReader } from "@/session/compaction-evidence-reader"
import { CompactionUserText } from "@/session/compaction-user-text"
import { AssistantDiagnostics } from "@/session/assistant-diagnostics"
import { RequestBudget } from "@/session/request-budget"
import { Message } from "@/session/message"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { Instance } from "@/project/instance"
import { Config } from "@/config/config"
import { Session } from "@/session"
import { SessionLoop } from "@/session/loop"
import { SessionControl } from "@/session/control"
import { Database } from "@/storage/db"
import { CompactionPolicyCase } from "../script/compaction-policy-case"

afterEach(resetMemoryDatabase)

test("mandatory context overflow persists a typed failure and the original source through reopening", async () => {
  await using project = await memoryProject("transcript-required-overflow")
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const target = { providerID: "budget-local", modelID: "required-context" }
      await Config.updateProjectPatch({
        model: `${target.providerID}/${target.modelID}`,
        compaction: { tail_turns: 0, max_context_tokens: 100 },
        provider: {
          [target.providerID]: {
            name: "Required context contract",
            npm: "@ai-sdk/openai-compatible",
            api: "http://127.0.0.1:1/v1",
            models: {
              [target.modelID]: {
                name: "Required context",
                tool_call: true,
                limit: { context: 256_000, output: 4_000 },
              },
            },
          },
        },
      })
      const session = await Session.create({ kind: "assistant", title: "Required compaction context" })
      const authored = await CompactionPolicyCase.history({ target, project: project.path })
      const anchor = await authored.user(session.id, "Preserve original authority.")
      await authored.assistant(session.id, anchor.id, "Original execution evidence. ".repeat(100))
      const source = await authored.user(session.id, "Continue with original evidence intact.")
      const original = await Session.messages({ sessionID: session.id })
      const control = await SessionCompaction.create({ sessionID: session.id, source, auto: true })
      let failure: unknown
      try {
        await SessionLoop.TestHooks.executeCompactionControl({
          control,
          sessionID: session.id,
          run: (abort) =>
            SessionCompaction.process(
              { sessionID: session.id, parentID: source.id, messages: original, abort, auto: true, model: target },
              { prepareProviderTool: ({ tool }) => tool },
            ),
        })
      } catch (error) {
        failure = error
      }
      expect(failure instanceof Error).toBe(true)
      expect((failure as Error).name).toBe("ContextOverflowError")
      Database.close()
      const reopened = await Session.messages({ sessionID: session.id })
      expect(Message.fromError(failure, { providerID: target.providerID })).toEqual(
        (reopened.at(-1)?.info as Message.Assistant).error!,
      )
      expect(reopened.filter((message) => original.some((item) => item.info.id === message.info.id))).toEqual(original)
      expect(reopened.at(-1)?.info).toMatchObject({
        role: "assistant",
        finish: "error",
        time: { completed: expect.any(Number) },
        error: { name: "ContextOverflowError", data: { message: expect.stringContaining("capacity 100") } },
      })
      expect(SessionControl.get(control.id)).toMatchObject({
        status: "failed",
        payload: { error: expect.stringContaining("capacity 100") },
      })
    },
  })
}, 30_000)

const context = (maxTokens: number) => ({
  maxTokens,
  system: ["Real summarizer context. ".repeat(300)],
  tools: { Evidence: tool({ description: "Exact source reader", inputSchema: z.object({ source: z.string() }) }) },
  promptText: "Produce the continuation checkpoint.",
})

function projected(messages: Message.WithParts[], maxTokens: number) {
  const request = context(maxTokens)
  return { messages: SessionCompaction.TestHooks.compactionTranscriptMessages(messages, request), request }
}

function text(messages: ModelMessage[]) {
  return messages
    .flatMap((message) =>
      Array.isArray(message.content)
        ? message.content.filter((part) => part.type === "text").map((part) => part.text)
        : [message.content],
    )
    .join("\n")
}

function decode(value: string) {
  return value.replaceAll("&quot;", '"').replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&")
}

function field(transcript: string, tag: string) {
  return decode(transcript.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))![1]!)
}

function corpus() {
  const sessionID = "ses_transcript_budget"
  const user = {
    id: "msg_input",
    sessionID,
    role: "user",
    author: "user",
    agent: "chat",
    model: { providerID: "local", modelID: "budget" },
    time: { created: 1 },
  } as Message.User
  const info = {
    id: "msg_work",
    sessionID,
    role: "assistant",
    author: "chat",
    agent: "chat",
    parentID: user.id,
    providerID: "local",
    modelID: "budget",
    path: { cwd: ".", root: "." },
    time: { created: 2, completed: 3 },
    finish: "stop",
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  } as Message.Assistant
  const exactText =
    "First authored evidence. ".repeat(1700) +
    "Current authorization: draft only 中文😀 <user> & trace 731." +
    "Later evidence. ".repeat(2300)
  const input = {
    command: 'x<"&'.repeat(7000),
    values: Array.from({ length: 100 }, (_, index) => ({ index, value: `source-${index}` })),
  }
  const output = "Before trace. ".repeat(1700) + "TRACE-MIDDLE-731 next_offset=17031" + " After trace. ".repeat(1700)
  const metadata = { trace: "TRACE-MIDDLE-731", raw: "证据😀".repeat(9000) }
  const completed = {
    id: "prt_result",
    messageID: info.id,
    sessionID,
    type: "tool",
    tool: "read",
    callID: "call_result",
    state: { status: "completed", input, output, title: "Evidence", metadata, time: { start: 2, end: 3 } },
  } as Message.ToolPart
  const failure = {
    name: "EvidenceFailure",
    kind: "EvidenceFailure",
    message: "failure details ".repeat(2500),
    originSite: "read",
    classification: "tool-execution",
  }
  const failed = {
    id: "prt_failure",
    messageID: info.id,
    sessionID,
    type: "tool",
    tool: "read",
    callID: "call_failure",
    state: { status: "error", input: { filePath: "evidence" }, failure, time: { start: 2, end: 3 } },
  } as Message.ToolPart
  const error = {
    ...info,
    id: "msg_failure",
    finish: "error",
    error: {
      name: "APIError",
      data: {
        message: "Source interrupted",
        isRetryable: false,
        statusCode: 502,
        responseBody: "body 中文😀 ".repeat(4500),
      },
    },
  } as Message.Assistant
  const messages: Message.WithParts[] = [
    { info: user, parts: [{ id: "prt_input", sessionID, messageID: user.id, type: "text", text: exactText }] },
    { info, parts: [completed, failed] },
    { info: error, parts: [] },
  ]
  return { messages, exactText, input, output, metadata, failure, error, completed }
}

test("request space preserves complete long user and Tool fields with their source identities", () => {
  const source = corpus(),
    original = structuredClone(source.messages)
  const result = projected(source.messages, 200_000)
  const transcript = text(result.messages)
  const userText = field(transcript, "text").slice(1, -1)
  expect(userText.length).toBe(source.exactText.length)
  expect(userText).toBe(source.exactText)
  expect(JSON.parse(field(transcript, "input"))).toEqual(source.input)
  expect(field(transcript, "output")).toBe(source.output)
  expect(JSON.parse(field(transcript, "metadata"))).toEqual({ part: {}, state: source.metadata })
  expect(JSON.parse(field(transcript, "error"))).toEqual(source.failure)
  const diagnostics = transcript.match(/<assistant-diagnostics>([\s\S]*?)<\/assistant-diagnostics>/g)!.at(-1)!
  expect(JSON.parse(field(diagnostics, "assistant-diagnostics"))).toEqual(AssistantDiagnostics.project(source.error))
  expect(RequestBudget.estimate({ ...result.request, messages: result.messages }).totalTokensEst).toBeLessThanOrEqual(
    200_000,
  )
  expect(result.messages.at(-1)).toEqual({ role: "user", content: [{ type: "text", text: result.request.promptText }] })
  expect(source.messages).toEqual(original)
})

test("a constrained whole request retains exact readable locators and source pagination", async () => {
  const source = corpus(),
    result = projected(source.messages, 12_000)
  expect(RequestBudget.estimate({ ...result.request, messages: result.messages }).totalTokensEst).toBeLessThanOrEqual(
    12_000,
  )
  const reference = JSON.parse(field(text(result.messages), "text"))
  expect(reference).toMatchObject({
    kind: "compaction_evidence_reference",
    partID: "prt_input",
    messageID: "msg_input",
    field: "text",
  })
  const reader = CompactionEvidenceReader.create(source.messages)
  const page = (await reader.execute!(
    { part_id: reference.partID, field: reference.field, offset: 30_000, limit: 1000 },
    { toolCallId: "call_page", context: {}, messages: [], abortSignal: new AbortController().signal },
  )) as { output: string }
  expect(JSON.parse(page.output)).toMatchObject({
    content: source.exactText.slice(30_000, 31_000),
    nextOffset: 31_000,
    originalRole: "user",
    originalAuthor: "user",
  })
})

test("packing many individually short fields respects the whole request budget", () => {
  const source = corpus().messages[0]!
  source.parts = Array.from({ length: 64 }, (_, index) => ({
    id: `prt_scale_${index}`,
    messageID: source.info.id,
    sessionID: source.info.sessionID,
    type: "text" as const,
    text: `Source ${index}: ${"exact observation ".repeat(1000)}`,
  }))
  const original = structuredClone(source)
  const started = performance.now(),
    result = projected([source], 12_000)
  const estimate = RequestBudget.estimate({ ...result.request, messages: result.messages })
  expect(estimate.totalTokensEst).toBeLessThanOrEqual(12_000)
  expect(text(result.messages).match(/<text part_id=/g)?.length).toBe(64)
  expect(source).toEqual(original)
  console.log(
    JSON.stringify({
      scenario: "transcript-packing-scale",
      fields: 64,
      sourceCharacters: original.parts.reduce((n, part) => n + (part.type === "text" ? part.text.length : 0), 0),
      estimatedTokens: estimate.totalTokensEst,
      milliseconds: performance.now() - started,
    }),
  )
})

test("bounded retained-user references recover their exact selected range through the canonical reader", async () => {
  const source = corpus()
  const original = source.messages[0]!
  const part = original.parts.find((part): part is Message.TextPart => part.type === "text")!
  const offset = part.text.indexOf("Current authorization:") - 2000
  const quote = part.text.slice(offset, offset + 4400)
  const before = structuredClone(original)
  const options = { toolCallId: "select_range", messages: [], context: {}, abortSignal: new AbortController().signal }
  const result = (await CompactionUserText.create([original], () => {}).execute!(
    { excerpts: [{ part_id: part.id, text: quote }] },
    options,
  )) as { output: string }
  const retained = CompactionUserText.project(CompactionUserText.Receipt.parse(JSON.parse(result.output)), [original])
  const rendered = field(text(projected(retained, 0).messages), "text")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line))
  const reference = rendered.find((value) => value.kind === "compaction_evidence_reference")
  expect(reference).toMatchObject({
    scope: "retained_user_excerpt",
    partID: part.id,
    field: "text",
    offset,
    limit: 4400,
    end: offset + 4400,
  })
  const page = (await CompactionEvidenceReader.create([original]).execute!(
    { part_id: reference.partID, field: reference.field, offset: reference.offset, limit: reference.limit },
    { ...options, toolCallId: "read_retained_range" },
  )) as { output: string }
  expect(JSON.parse(page.output)).toMatchObject({
    content: quote,
    offset,
    end: offset + 4400,
    nextOffset: offset + 4400,
    totalChars: part.text.length,
    originalRole: "user",
    originalAuthor: "user",
  })
  expect(original).toEqual(before)
})

test("file-backed output keeps its authoritative file and exact reader content", async () => {
  await using project = await memoryProject("transcript-file-reference")
  const source = corpus(),
    full = "Full stored result 中文😀 ".repeat(2000)
  const outputPath = path.join(project.path, "full-output.txt")
  await fs.writeFile(outputPath, full)
  if (source.completed.state.status !== "completed") throw new Error("Completed fixture")
  source.completed.state.output = "Short display preview"
  source.completed.state.metadata = { truncated: true, outputPath }
  const result = projected(source.messages, 200_000)
  expect(JSON.parse(field(text(result.messages), "output"))).toMatchObject({
    kind: "compaction_evidence_reference",
    partID: source.completed.id,
    field: "output",
  })
  const reader = CompactionEvidenceReader.create(source.messages)
  const page = (await reader.execute!(
    { part_id: source.completed.id, field: "output", offset: 0, limit: 1000 },
    { toolCallId: "file_page", context: {}, messages: [], abortSignal: new AbortController().signal },
  )) as { output: string }
  expect(JSON.parse(page.output)).toMatchObject({
    source: "truncation-file",
    content: full.slice(0, 1000),
    totalChars: full.length,
  })
})
