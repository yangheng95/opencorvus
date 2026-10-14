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
import { MessageStore } from "@/session/message-store"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { Instance } from "@/project/instance"
import { Config } from "@/config/config"
import { Session } from "@/session"
import { SessionLoop } from "@/session/loop"
import { SessionControl } from "@/session/control"
import { Database } from "@/storage/db"
import { Token } from "@/util/token"
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
  const transcript = SessionCompaction.TestHooks.createCompactionTranscript(messages, {
    id: "msg_compactor_budget",
    sessionID: messages[0]!.info.sessionID,
  })
  return { messages: transcript.render(request), request, transcript }
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
  expect(result.messages.at(-1)).toMatchObject({
    role: "user",
    content: [
      { type: "text", text: result.request.promptText },
      { type: "text", text: expect.stringContaining("compaction_catalog_reference") },
    ],
  })
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

test.each([64, 256, 1024])("a %i-source catalog fits its configured helper request", async (count) => {
  const source = corpus().messages[0]!
  const messages: Message.WithParts[] = Array.from({ length: count }, (_, index) => {
    const messageID = `msg_catalog_${index}`
    return {
      info: { ...source.info, id: messageID, time: { created: index + 1 } },
      parts: [
        {
          id: `prt_catalog_${index}`,
          sessionID: source.info.sessionID,
          messageID,
          type: "text",
          text: `Original source ${index}: ${"authored observation ".repeat(50)} END-${index}`,
        },
      ],
    }
  })
  const started = performance.now()
  const result = projected(messages, 19_000)
  const estimate = RequestBudget.estimate({ ...result.request, messages: result.messages }).totalTokensEst
  console.log(
    JSON.stringify({
      scenario: "source-catalog-scale",
      sources: count,
      capacity: 19_000,
      estimatedTokens: estimate,
      milliseconds: performance.now() - started,
    }),
  )
  expect(estimate).toBeLessThanOrEqual(19_000)
  const reader = CompactionEvidenceReader.create(messages, undefined, result.transcript.catalog)
  let offset = 0,
    complete = ""
  for (;;) {
    const result = (await reader.execute!(
      { message_id: "msg_compactor_budget", field: "catalog", offset, limit: 4096 },
      { toolCallId: `catalog_${offset}`, messages: [], context: {}, abortSignal: new AbortController().signal },
    )) as { output: string }
    const page = JSON.parse(result.output)
    expect(page).toMatchObject({
      source: "compaction-catalog",
      originalRole: "assistant",
      originalAuthor: "compaction",
      offset,
    })
    complete += page.content
    if (page.nextOffset === null) break
    offset = page.nextOffset
  }
  const decoded = JSON.parse(complete) as ModelMessage[]
  expect(text(decoded).match(/<message id=/g)?.length).toBe(count)
  expect(decoded.map((entry) => entry.role)).toEqual(Array(count).fill("user"))
  for (let index = 0; index < count; index++)
    expect(text([decoded[index]!])).toContain(`part_id="prt_catalog_${index}"`)
  const last = (await reader.execute!(
    { part_id: `prt_catalog_${count - 1}`, field: "text", offset: 0, limit: 2000 },
    { toolCallId: "read_last", messages: [], context: {}, abortSignal: new AbortController().signal },
  )) as { output: string }
  expect(JSON.parse(last.output).content).toBe((messages.at(-1)!.parts[0] as Message.TextPart).text)
})

test("a single Message with 1024 Parts remains readable across narrow and wide renderings", async () => {
  const original = corpus().messages[0]!
  original.parts = Array.from({ length: 1024 }, (_, index) => ({
    type: "text" as const,
    id: `prt_many_${index}`,
    messageID: original.info.id,
    sessionID: original.info.sessionID,
    text: `Observation ${index}: ${"中文😀 evidence ".repeat(70)}`,
  }))
  const before = structuredClone(original)
  const narrow = projected([original], 19_000)
  const catalog = narrow.transcript.catalog.content
  expect(RequestBudget.estimate({ ...narrow.request, messages: narrow.messages }).totalTokensEst).toBeLessThanOrEqual(
    19_000,
  )
  expect(JSON.parse(text(narrow.messages).split("\n").at(-1)!)).toMatchObject({
    inlineMessages: 0,
    nextOffset: 1,
    messageCount: 1,
  })
  const wide = narrow.transcript.render(context(1_000_000))
  expect(text(wide)).toContain((original.parts[1023] as Message.TextPart).text)
  expect(narrow.transcript.render(context(19_000))).toEqual(narrow.messages)
  expect(narrow.transcript.catalog.content).toBe(catalog)
  const reader = CompactionEvidenceReader.create([original], undefined, narrow.transcript.catalog)
  const options = { toolCallId: "many_parts", messages: [], context: {}, abortSignal: new AbortController().signal }
  let decoded = "",
    offset = 0
  for (;;) {
    const read = (await reader.execute!(
      { message_id: narrow.transcript.catalog.messageID, field: "catalog", offset, limit: 1001 },
      options,
    )) as { output: string }
    const page = JSON.parse(read.output)
    decoded += page.content
    if (page.nextOffset === null) break
    offset = page.nextOffset
  }
  const contents = text(JSON.parse(decoded))
  for (const part of original.parts) expect(contents).toContain(`part_id="${part.id}"`)
  const last = (await reader.execute!(
    { part_id: original.parts[1023]!.id, field: "text", offset: 0, limit: 2000 },
    options,
  )) as { output: string }
  expect(JSON.parse(last.output)).toMatchObject({
    content: (original.parts[1023] as Message.TextPart).text,
    nextOffset: null,
    originalRole: "user",
  })
  expect(original).toEqual(before)
})

test("catalog requests bind the exact helper identity and return exact page ranges", async () => {
  const source = corpus().messages
  const transcript = projected(source, 1000).transcript
  const reader = CompactionEvidenceReader.create(source, undefined, transcript.catalog)
  const options = { toolCallId: "catalog_scope", messages: [], context: {}, abortSignal: new AbortController().signal }
  for (const input of [
    { message_id: "msg_other_helper", field: "catalog" },
    { message_id: transcript.catalog.messageID, part_id: "prt_input", field: "catalog" },
  ])
    await expect(reader.execute!(input, options)).rejects.toMatchObject({
      name: "CompactionEvidenceReadError",
      code: "COMPACTION_EVIDENCE_INVALID",
    })
  await expect(
    CompactionEvidenceReader.create(source).execute!(
      { message_id: transcript.catalog.messageID, field: "catalog" },
      options,
    ),
  ).rejects.toMatchObject({ name: "CompactionEvidenceReadError", code: "COMPACTION_EVIDENCE_INVALID" })
  const read = (await reader.execute!(
    { message_id: transcript.catalog.messageID, field: "catalog", offset: 0, limit: 73 },
    options,
  )) as { output: string }
  expect(JSON.parse(read.output)).toMatchObject({
    messageID: transcript.catalog.messageID,
    source: "compaction-catalog",
    originalRole: "assistant",
    originalAuthor: "compaction",
    offset: 0,
    end: 73,
    content: transcript.catalog.content.slice(0, 73),
    nextOffset: 73,
  })
})

test.each([
  { count: 256, steps: 20, status: "completed" },
  { count: 1024, steps: 20, status: "step_limit" },
  { count: 1024, steps: 80, status: "completed" },
])(
  "the persisted $count-source catalog with $steps steps reports $status",
  async ({ count, steps, status }) => {
    const target = { providerID: "catalog-local", modelID: "catalog-window" }
    const requests: any[] = []
    const pages: any[] = []
    let catalogText = "",
      cursor = 0,
      complete = false
    let sourceReference: any, sourcePage: any
    let catalogMessageIDs: string[] = []
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        const body = (await request.json()) as any
        requests.push(body)
        expect(body).toMatchObject({ model: target.modelID, stream: true })
        expect(Token.estimate(JSON.stringify({ messages: body.messages, tools: body.tools }))).toBeLessThanOrEqual(
          19_000,
        )
        const emit = (delta: unknown, finish: string | null) =>
          `data: ${JSON.stringify({ id: "catalog-check", object: "chat.completion.chunk", created: 1, model: target.modelID, choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`
        const call = (name: string, input: unknown) =>
          new Response(
            emit(
              {
                role: "assistant",
                tool_calls: [
                  {
                    index: 0,
                    id: `call_catalog_${requests.length}`,
                    type: "function",
                    function: { name, arguments: JSON.stringify(input) },
                  },
                ],
              },
              null,
            ) +
              emit({}, "tool_calls") +
              "data: [DONE]\n\n",
            { headers: { "content-type": "text/event-stream" } },
          )
        const userText = body.messages
          .filter((m: any) => m.role === "user")
          .map((m: any) =>
            typeof m.content === "string" ? m.content : m.content.map((p: any) => p.text ?? "").join("\n"),
          )
          .join("\n")
        const catalogNotices = [...userText.matchAll(/\{"kind":"compaction_catalog_reference"[^\n}]*\}/g)]
        expect(catalogNotices.length).toBe(1)
        const catalog = JSON.parse(catalogNotices[0]![0])
        const inlineIDs = [...userText.matchAll(/<message id="([^"]+)"/g)].map((match) => match[1])
        expect(inlineIDs).toEqual(catalogMessageIDs.slice(0, catalog.inlineMessages))
        const outputs = body.messages.filter((m: any) => m.role === "tool")
        const last = outputs.length ? JSON.parse(outputs.at(-1).content) : undefined
        if (last?.status === "saved") {
          expect(last.source_reads).toEqual([
            expect.objectContaining({
              messageID: catalog.messageID,
              field: "catalog",
              source: "compaction-catalog",
              originalRole: "assistant",
              originalAuthor: "compaction",
              ranges: [[0, cursor]],
              nextUnreadOffset: complete ? null : cursor,
              offsetUnit: "utf16_code_units",
              readerCalls: expect.any(Array),
            }),
          ])
          expect(last.source_reads[0].readerCalls.length).toBe(pages.length)
        }
        if (last?.field === "catalog") {
          expect(last.offset).toBe(cursor)
          pages.push(last)
          catalogText += last.content
          cursor = last.end
          complete = last.nextOffset === null
          if (complete) {
            const entries = JSON.parse(catalogText) as ModelMessage[]
            sourceReference = entries
              .filter((m) => m.role === "user")
              .flatMap((m) => {
                const value = field(text([m]), "text").trim()
                if (!value.startsWith("{")) return []
                const parsed = JSON.parse(value)
                return parsed.kind === "compaction_evidence_reference" ? [parsed] : []
              })
              .at(-1)
            expect(JSON.stringify(body.messages)).toContain(sourceReference.partID)
          }
          return call("SaveCompactionNotes", {
            notes: complete
              ? `The complete source catalog is read. Last original user text is Part ${sourceReference.partID}; read that exact source and retain it before the final summary.`
              : `Source catalog delivered through UTF-16 ${cursor}. Continue its exact next offset. Original sources remain unchanged.`,
          })
        }
        if (last?.field === "text") {
          sourcePage = last
          expect(last).toMatchObject({ originalRole: "user", originalAuthor: "user", nextOffset: null })
          return call("RetainCompactionUserText", { excerpts: [{ part_id: last.partID, text: last.content }] })
        }
        if (last?.status === "retained")
          return new Response(
            emit(
              {
                role: "assistant",
                content:
                  "Original large-catalog sources remain authoritative. The last original user source is retained with its exact role. Continue the unfinished investigation.",
              },
              null,
            ) +
              emit({}, "stop") +
              "data: [DONE]\n\n",
            { headers: { "content-type": "text/event-stream" } },
          )
        return complete
          ? call("ReadCompactionEvidence", { part_id: sourceReference.partID, field: "text", offset: 0, limit: 2000 })
          : call("ReadCompactionEvidence", {
              message_id: catalog.messageID,
              field: "catalog",
              offset: cursor,
              limit: 30_000,
            })
      },
    })
    try {
      await using project = await memoryProject("catalog-window")
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          await Config.updateProjectPatch({
            model: `${target.providerID}/${target.modelID}`,
            compaction: { tail_turns: 0, max_context_tokens: 19_000 },
            ...(steps === 20 ? {} : { agent: { compaction: { steps } } }),
            provider: {
              [target.providerID]: {
                name: "Local catalog transport",
                npm: "@ai-sdk/openai-compatible",
                api: `http://127.0.0.1:${server.port}/v1`,
                models: {
                  [target.modelID]: { name: "Catalog", tool_call: true, limit: { context: 256_000, output: 4_000 } },
                },
              },
            },
          })
          const session = await Session.create({ kind: "assistant", title: "Large original source catalog" })
          const authored = await CompactionPolicyCase.history({ target, project: project.path })
          await authored.user(session.id, "Retain original evidence and user authority.")
          for (let index = 0; index < count; index++)
            await authored.user(
              session.id,
              `Original source ${index}: ${"authored observation ".repeat(50)} END-${index}`,
            )
          const source = await authored.user(session.id, "Continue the unfinished investigation.")
          const original = await Session.messages({ sessionID: session.id })
          catalogMessageIDs = original.slice(1).map((message) => message.info.id)
          const control = await SessionCompaction.create({ sessionID: session.id, source, auto: true, model: target })
          let outcome: unknown, controlError: unknown
          try {
            await SessionLoop.TestHooks.executeCompactionControl({
              control,
              sessionID: session.id,
              run: async (abort) => {
                const result = await SessionCompaction.process(
                  { sessionID: session.id, parentID: source.id, messages: original, abort, auto: true, model: target },
                  { prepareProviderTool: SessionLoop.prepareProviderTool },
                )
                outcome = result
                return result
              },
            })
          } catch (error) {
            controlError = error
          }
          Database.close()
          const reopened = await Session.messages({ sessionID: session.id })
          expect(reopened.filter((message) => original.some((item) => item.info.id === message.info.id))).toEqual(
            original,
          )
          expect(requests[0]).toMatchObject({ model: target.modelID, stream: true })
          const replay = await Message.filterCompacted(MessageStore.stream(session.id))
          const helper = reopened.at(-1)!
          if (status === "completed") {
            expect(outcome).toMatchObject({ status: "completed" })
            expect(SessionControl.get(control.id)?.status).toBe("consumed")
            expect(replay.find((message) => message.info.id === sourcePage.messageID)).toMatchObject({
              info: { role: "user", author: "user" },
              parts: [{ id: sourcePage.partID, text: sourcePage.content }],
            })
            expect(sourcePage.content).toContain(`END-${count - 1}`)
            expect(pages.at(-1).nextOffset).toBe(null)
          } else {
            expect(outcome).toMatchObject({ status: "failed" })
            expect(controlError).toMatchObject({ name: "CompactionContinuationMissingError" })
            expect(helper.info).toMatchObject({
              summary: false,
              finish: "error",
              error: { name: "CompactionContinuationMissingError" },
            })
            expect(SessionControl.get(control.id)?.status).toBe("failed")
            expect(requests.length).toBe(steps)
            expect(replay.filter((message) => original.some((item) => item.info.id === message.info.id))).toEqual(
              original,
            )
          }
          const report = {
            scenario: "streamed-large-catalog",
            sources: count,
            steps,
            status,
            requests: requests.length,
            pages: pages.length,
            catalogChars: pages[0].totalChars,
            deliveredCatalogChars: catalogText.length,
            retainedMessageID: sourcePage?.messageID,
          }
          if (process.env.OPENCORVUS_CATALOG_EVIDENCE_DIR) {
            await fs.mkdir(process.env.OPENCORVUS_CATALOG_EVIDENCE_DIR, { recursive: true })
            await fs.writeFile(
              path.join(process.env.OPENCORVUS_CATALOG_EVIDENCE_DIR, `catalog-${count}-steps-${steps}.json`),
              JSON.stringify({
                ...report,
                remoteModelRequests: 0,
                target,
                capacity: 19_000,
                original,
                reopened,
                helper,
                control: SessionControl.get(control.id),
                replay,
                requests,
                pages,
                sourcePage,
              }),
            )
          }
          console.log(JSON.stringify(report))
        },
      })
    } finally {
      await server.stop(true)
    }
  },
  120_000,
)

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
  const rendered = field(text(JSON.parse(projected(retained, 0).transcript.catalog.content)), "text")
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
