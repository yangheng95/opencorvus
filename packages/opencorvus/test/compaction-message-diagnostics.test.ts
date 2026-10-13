import { afterEach, expect, test } from "bun:test"
import { asSchema } from "ai"
import type { Provider } from "@/provider/provider"
import { CompactionEvidenceReader } from "@/session/compaction-evidence-reader"
import { SessionCompaction } from "@/session/compaction"
import { Message } from "@/session/message"
import { Session } from "@/session"
import { MessageStore } from "@/session/message-store"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Database } from "@/storage/db"
import { Config } from "@/config/config"
import { SessionLoop } from "@/session/loop"
import { SessionMemory } from "@/memory/session-memory"
import { SessionControl } from "@/session/control"
import { installDefaultControlPlaneToolLoaders } from "@/tool/control-plane-tool-composition"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)

function failedInfo(sessionID = "ses_diagnostic", parentID = "msg_input"): Message.Assistant {
  const id = Identifier.ascending("message")
  const failureOccurrence = { session_id: sessionID, assistant_message_id: id, error_name: "APIError" }
  return {
    id,
    sessionID,
    parentID,
    acceptedInputMessageIDs: [parentID],
    role: "assistant",
    author: "chat",
    agent: "chat",
    providerID: "local",
    modelID: "diagnostics",
    path: { cwd: ".", root: "." },
    time: { created: Date.now(), completed: Date.now() + 1 },
    finish: "error",
    cost: 0,
    tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    error: new Message.APIError({
      message: "Stream failed after reading the evidence",
      statusCode: 502,
      isRetryable: true,
      responseBody: JSON.stringify({
        prefix: "来源😀".repeat(9_000),
        trace: "TRACE-MIDDLE-731",
        next_offset: 81371,
        suffix: "证据🦉".repeat(9_000),
        authorization: "example-diagnostic-credential", // secret-scan: ignore
      }),
    }).toObject(),
    failureOccurrence,
    convergenceFailure: {
      failure_occurrence: failureOccurrence,
      unconverged_part_ids: ["prt_unpersisted_731"],
      write_errors: [{ part_id: "prt_unpersisted_731", message: "Original Part commit failed at WRITE-731" }],
      inspection_error: "Inspection interrupted at INSPECT-319",
    },
    observationFailures: [{ phase: "snapshot_patch", message: "Snapshot observation OBS-718 remains unresolved" }],
  }
}

async function read(reader: ReturnType<typeof CompactionEvidenceReader.create>, input: Record<string, unknown>) {
  const result = (await reader.execute!(
    { offset: 0, limit: 30_000, ...input },
    {
      toolCallId: "call_diagnostics",
      messages: [],
      abortSignal: new AbortController().signal,
      context: {},
    },
  )) as { output: string }
  return JSON.parse(result.output)
}

async function recover(reader: ReturnType<typeof CompactionEvidenceReader.create>, messageID: string) {
  let offset = 0
  let text = ""
  const pages: Array<Awaited<ReturnType<typeof read>>> = []
  while (true) {
    const page = await read(reader, { message_id: messageID, field: "diagnostics", offset })
    expect(page.content.isWellFormed()).toBe(true)
    expect(page).toMatchObject({ field: "diagnostics", originalRole: "assistant", originalAuthor: "chat", offset })
    text += page.content
    pages.push(page)
    if (page.nextOffset === null) return { data: JSON.parse(text), pages }
    offset = page.nextOffset
  }
}

function expectExactFailure(data: any, info: Message.Assistant) {
  expect(data).toMatchObject({
    messageID: info.id,
    sessionID: info.sessionID,
    parentID: info.parentID,
    acceptedInputMessageIDs: info.acceptedInputMessageIDs,
    time: info.time,
    error: { name: "APIError", data: { message: "Stream failed after reading the evidence", statusCode: 502 } },
    failureOccurrence: info.failureOccurrence,
    convergenceFailure: info.convergenceFailure,
    observationFailures: info.observationFailures,
  })
  expect(JSON.parse(data.error.data.responseBody)).toEqual({
    prefix: "来源😀".repeat(9_000),
    trace: "TRACE-MIDDLE-731",
    next_offset: 81371,
    suffix: "证据🦉".repeat(9_000),
    authorization: "<redacted>",
  })
}

test("long error-only diagnostics publish an exact Message evidence locator", () => {
  const info = failedInfo()
  const projected = SessionCompaction.TestHooks.compactionTranscriptMessages([{ info, parts: [] }], {
    system: [],
    tools: {},
    promptText: "Summarize the diagnostics.",
    maxTokens: 2_000,
  })
  const text = (projected[0]!.content as Array<{ type: string; text: string }>)[0]!.text
  const encoded = text.match(/<assistant-diagnostics>([\s\S]*?)<\/assistant-diagnostics>/)?.[1]
  const value = JSON.parse(
    encoded!.replaceAll("&quot;", '"').replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&"),
  )
  expect(value).toMatchObject({
    kind: "compaction_evidence_reference",
    retrievalTool: "ReadCompactionEvidence",
    messageID: info.id,
    field: "diagnostics",
  })
  expect(value.preview.chars).toBeGreaterThan(70_000)
})

test("Message evidence paging reconstructs Unicode diagnostics, exact trace and redacted credentials", async () => {
  const info = failedInfo()
  const original = structuredClone(info)
  const reader = CompactionEvidenceReader.create([{ info, parts: [] }])
  const { data, pages } = await recover(reader, info.id)
  expectExactFailure(data, info)
  expect(pages.length).toBeGreaterThan(2)
  const last = pages.at(-1)!
  expect(await read(reader, { message_id: info.id, field: "diagnostics", offset: last.end })).toMatchObject({
    content: "",
    nextOffset: null,
    end: last.end,
    source: "message-diagnostics",
  })
  expect(info).toEqual(original)
})

test("Message diagnostics preserve Unicode endpoints and validate their exclusive locator", async () => {
  const info = failedInfo()
  const reader = CompactionEvidenceReader.create([{ info, parts: [] }])
  const first = await read(reader, { message_id: info.id, field: "diagnostics" })
  const start = first.content.indexOf("😀")
  expect(start).toBeGreaterThan(0)
  expect(await read(reader, { message_id: info.id, field: "diagnostics", offset: start, limit: 1 })).toMatchObject({
    content: "😀",
    nextOffset: start + 2,
    end: start + 2,
  })
  for (const input of [
    { message_id: info.id, field: "diagnostics", offset: start + 1 },
    { message_id: info.id, field: "diagnostics", offset: first.totalChars + 1 },
    { message_id: info.id, part_id: "prt_wrong", field: "diagnostics" },
    { message_id: info.id, field: "text" },
  ])
    await expect(read(reader, input)).rejects.toMatchObject({ code: "COMPACTION_EVIDENCE_INVALID" })
})

test("OpenAI strict Tool arguments materialize Message and Part locators through the production adapter", async () => {
  const info = failedInfo()
  const reader = CompactionEvidenceReader.create([
    {
      info,
      parts: [
        {
          id: "prt_strict_diagnostic",
          messageID: info.id,
          sessionID: info.sessionID,
          type: "text",
          text: "Exact committed partial response",
        },
      ],
    },
  ])
  const model = {
    id: "gpt-6.1-sol",
    providerID: "openai",
    api: { id: "gpt-6.1-sol", npm: "@ai-sdk/openai", url: "https://example.invalid/v1" },
  } as Provider.Model
  const prepared = SessionLoop.prepareProviderTool({
    name: CompactionEvidenceReader.TOOL_NAME,
    source: "extra",
    model,
    tool: reader,
  })
  const schema = asSchema(prepared.inputSchema).jsonSchema as { required: string[] }
  expect(schema.required.toSorted()).toEqual(["field", "limit", "message_id", "offset", "part_id"])
  expect(
    await read(prepared, { message_id: info.id, part_id: null, field: "diagnostics", offset: null, limit: null }),
  ).toMatchObject({
    messageID: info.id,
    field: "diagnostics",
    offset: 0,
    end: 30_000,
    source: "message-diagnostics",
  })
  expect(
    await read(prepared, {
      message_id: null,
      part_id: "prt_strict_diagnostic",
      field: "text",
      offset: null,
      limit: null,
    }),
  ).toMatchObject({
    partID: "prt_strict_diagnostic",
    field: "text",
    content: "Exact committed partial response",
    nextOffset: null,
  })
})

test("a failed Message remains a valid attributed record after atomic history copying", async () => {
  await using project = await memoryProject("diagnostic-copy-contract")
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const source = await Session.create({ kind: "assistant", title: "Failed source" })
      const input = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: source.id,
        role: "user",
        author: "user",
        agent: "chat",
        model: { providerID: "local", modelID: "diagnostics" },
        time: { created: Date.now() },
      })
      const info = failedInfo(source.id, input.id)
      await Session.persistMessage({ info, parts: [] })
      const copy = await Session.fork({ sessionID: source.id, purpose: "side-chat" })
      const copied = (await Session.messages({ sessionID: copy.id })).find((m) => m.info.role === "assistant")!
      expect(Message.Info.parse(copied.info)).toMatchObject({
        id: copied.info.id,
        sessionID: copy.id,
        role: "assistant",
        failureOccurrence: { session_id: copy.id, assistant_message_id: copied.info.id, error_name: "APIError" },
        convergenceFailure: {
          failure_occurrence: { session_id: copy.id, assistant_message_id: copied.info.id, error_name: "APIError" },
          unconverged_part_ids: ["prt_unpersisted_731"],
          write_errors: [{ part_id: "prt_unpersisted_731", message: "Original Part commit failed at WRITE-731" }],
        },
      })
      expect(await MessageStore.get({ sessionID: source.id, messageID: info.id })).toMatchObject({ info })
    },
  })
})

test("reopened copy generations recover exact original Message diagnostics and fence stale or foreign evidence", async () => {
  await using project = await memoryProject("diagnostic-ancestry")
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const source = await Session.create({ kind: "assistant", title: "Diagnostic ancestry" })
      const input = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: source.id,
        role: "user",
        author: "user",
        agent: "chat",
        model: { providerID: "local", modelID: "diagnostics" },
        time: { created: Date.now() },
      })
      const info = failedInfo(source.id, input.id)
      await Session.persistMessage({ info, parts: [] })
      let copy = await Session.fork({ sessionID: source.id, purpose: "side-chat" })
      copy = await Session.fork({ sessionID: copy.id })
      Database.close()
      const messages = await Session.messages({ sessionID: copy.id })
      const copied = messages.find((m) => m.info.role === "assistant")!
      const reader = CompactionEvidenceReader.create(messages)
      const { data, pages } = await recover(reader, info.id)
      expectExactFailure(data, info)
      expect(pages[0]).toMatchObject({
        messageID: copied.info.id,
        sessionID: copy.id,
        requestedSource: { sessionID: source.id, messageID: info.id },
      })
      const local = await recover(reader, copied.info.id)
      expect(local.data).toMatchObject({ messageID: copied.info.id, sessionID: copy.id })
      expect(local.data.copiedFrom).toContainEqual({ sessionID: source.id, messageID: info.id, field: "diagnostics" })
      await expect(
        read(CompactionEvidenceReader.create([]), { message_id: info.id, field: "diagnostics" }),
      ).rejects.toMatchObject({ code: "COMPACTION_EVIDENCE_INVALID" })
      const edited = structuredClone(messages)
      const changed = edited.find((m) => m.info.id === copied.info.id)!.info as Message.Assistant
      changed.observationFailures = [{ phase: "snapshot_patch", message: "Explicitly changed observation" }]
      await expect(
        read(CompactionEvidenceReader.create(edited), { message_id: info.id, field: "diagnostics" }),
      ).rejects.toMatchObject({ code: "COMPACTION_EVIDENCE_STALE" })
      expect((await recover(CompactionEvidenceReader.create(edited), copied.info.id)).data.observationFailures).toEqual(
        changed.observationFailures,
      )
    },
  })
})

test.each([
  { message_id: "msg_foreign", field: "diagnostics" },
  { message_id: "msg_input", field: "diagnostics" },
  { part_id: "prt_invalid", field: "diagnostics" },
])("invalid Message locators return the exact evidence error contract: $message_id/$part_id", async (input) => {
  const info = failedInfo()
  await expect(read(CompactionEvidenceReader.create([{ info, parts: [] }]), input)).rejects.toMatchObject({
    name: "CompactionEvidenceReadError",
    code: "COMPACTION_EVIDENCE_INVALID",
  })
})

test("streamed compaction retrieves full Message diagnostics across repeated checkpoints and a copied history", async () => {
  const target = { providerID: "diagnostic-stream-local", modelID: "diagnostics" }
  const observed: Array<{ round: number; messageID: string; pages: any[]; data: any; requests: number }> = []
  let round = 0
  let requests = 0
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const body = (await request.json()) as any
      requests++
      expect(body).toMatchObject({ model: target.modelID, stream: true })
      expect(body.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            function: expect.objectContaining({ name: CompactionEvidenceReader.TOOL_NAME }),
          }),
        ]),
      )
      const text = body.messages
        .map((m: any) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content)))
        .join("\n")
      const encoded = text.match(/<assistant-diagnostics>([\s\S]*?)<\/assistant-diagnostics>/)?.[1]
      const reference =
        encoded &&
        JSON.parse(
          encoded.replaceAll("&quot;", '"').replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&"),
        )
      const messageID = reference?.messageID ?? text.match(/message_id=(msg_[A-Za-z0-9_-]+)/)?.[1]
      expect(typeof messageID).toBe("string")
      const pages = body.messages
        .filter((m: any) => m.role === "tool")
        .map((m: any) => {
          const result = JSON.parse(m.content)
          expect(result.field).toBe("diagnostics")
          return result
        })
      const last = pages.at(-1)
      const chunk = (delta: unknown, finish: string | null) =>
        `data: ${JSON.stringify({
          id: `diagnostics-${round}-${requests}`,
          object: "chat.completion.chunk",
          created: 1,
          model: target.modelID,
          choices: [{ index: 0, delta, finish_reason: finish }],
        })}\n\n`
      let response: string
      if (!last || last.nextOffset !== null) {
        response =
          chunk(
            {
              role: "assistant",
              tool_calls: [
                {
                  index: 0,
                  id: `call_diagnostics_${round}_${requests}`,
                  type: "function",
                  function: {
                    name: CompactionEvidenceReader.TOOL_NAME,
                    arguments: JSON.stringify({
                      message_id: messageID,
                      field: "diagnostics",
                      offset: last?.nextOffset ?? 0,
                      limit: 30_000,
                    }),
                  },
                },
              ],
            },
            null,
          ) + chunk({}, "tool_calls")
      } else {
        const data = JSON.parse(pages.map((page: any) => page.content).join(""))
        const errorBody = JSON.parse(data.error.data.responseBody)
        observed.push({ round, messageID, pages, data, requests })
        const summary =
          `Original diagnostics: ReadCompactionEvidence message_id=${messageID} field=diagnostics. ` +
          `Failed ${data.error.name}; trace=${errorBody.trace}; source cursor=${errorBody.next_offset}. Validation remains pending; deployment remains denied.`
        response = chunk({ role: "assistant", content: summary }, null) + chunk({}, "stop")
      }
      return new Response(response + "data: [DONE]\n\n", { headers: { "content-type": "text/event-stream" } })
    },
  })
  installDefaultControlPlaneToolLoaders()
  try {
    await using project = await memoryProject("diagnostic-wire")
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Config.updateProjectPatch({
          model: `${target.providerID}/${target.modelID}`,
          small_model: `${target.providerID}/${target.modelID}`,
          enabled_providers: [target.providerID],
          compaction: { tail_turns: 0, max_context_tokens: 256_000 },
          provider: {
            [target.providerID]: {
              name: "Isolated diagnostic evidence",
              npm: "@ai-sdk/openai-compatible",
              api: `http://127.0.0.1:${server.port}/v1`,
              models: {
                [target.modelID]: {
                  name: "Diagnostics",
                  tool_call: true,
                  modalities: { input: ["text"], output: ["text"] },
                  limit: { context: 1_000_000, output: 16_000 },
                },
              },
            },
          },
        })
        let session = await Session.create({ kind: "assistant", title: "Large diagnostics" })
        const user = async (text: string) => {
          const info = await Session.updateMessage({
            id: Identifier.ascending("message"),
            sessionID: session.id,
            role: "user",
            author: "user",
            agent: "chat",
            model: target,
            time: { created: Date.now() },
          })
          if (info.role !== "user") throw new Error("Expected input")
          await Session.updatePart({
            id: Identifier.ascending("part"),
            sessionID: session.id,
            messageID: info.id,
            type: "text",
            text,
          })
          return info
        }
        const input = await user("Preserve exact failure trace and unfinished work. Deployment is denied.")
        const failed = failedInfo(session.id, input.id)
        await Session.persistMessage({ info: failed, parts: [] })
        for (round = 1; round <= 3; round++) {
          if (round === 3) session = await Session.fork({ sessionID: session.id, purpose: "side-chat" })
          const source = await user(`Retain the diagnostic evidence. Round ${round}.`)
          Database.close()
          const control = await SessionCompaction.create({ sessionID: session.id, source, auto: false, model: target })
          const summary = await SessionLoop.loop({
            sessionID: session.id,
            result_mode: "summary",
            summary_source_message_id: source.id,
            summary_control_id: control.id,
          })
          expect(summary.info).toMatchObject({ role: "assistant", author: "compaction", summary: true, finish: "stop" })
          expect(SessionControl.get(control.id)).toMatchObject({
            status: "consumed",
            payload: { result_summary_message_id: summary.info.id },
          })
          const seen = observed.at(-1)!
          expect(seen.round).toBe(round)
          expect(seen.messageID).toBe(failed.id)
          expectExactFailure(seen.data, failed)
          expect(seen.pages.length).toBeGreaterThan(2)
          const content = SessionMemory.continuationText(summary.parts)
          expect(await SessionMemory.read(session.id)).toMatchObject({ sourceMessageID: summary.info.id, content })
          expect(content).toContain("trace=TRACE-MIDDLE-731; source cursor=81371")
          console.log(
            JSON.stringify({
              scenario: "diagnostics-stream",
              round,
              sessionID: session.id,
              originalMessageID: failed.id,
              summaryID: summary.info.id,
              cumulativeRequests: requests,
              pages: seen.pages.map(({ offset, end, nextOffset, requestedSource, messageID }: any) => ({
                offset,
                end,
                nextOffset,
                requestedSource,
                messageID,
              })),
              trace: JSON.parse(seen.data.error.data.responseBody).trace,
            }),
          )
        }
        expect(observed.map((item) => item.round)).toEqual([1, 2, 3])
      },
    })
  } finally {
    await Instance.disposeAll()
    await server.stop(true)
  }
})
