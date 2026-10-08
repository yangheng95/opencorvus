import { afterEach, describe, expect, test } from "bun:test"
import { stepCountIs, tool } from "ai"
import z from "zod"
import { Config } from "@/config/config"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Provider } from "@/provider/provider"
import { Session } from "@/session"
import { SessionCompaction } from "@/session/compaction"
import { CompactionToolResultReader } from "@/session/compaction-tool-result-reader"
import { ContextBudget } from "@/session/context-budget"
import { RequestBudget } from "@/session/request-budget"
import { SessionControl } from "@/session/control"
import { SessionLoop } from "@/session/loop"
import { Message } from "@/session/message"
import { MessageStore } from "@/session/message-store"
import { SessionMemory } from "@/memory/session-memory"
import { LLM } from "@/session/llm"
import { PrimaryAssistantRegistry } from "@/agent/primary-assistant-registry"
import { sessionRuntimeFromNativeAgent } from "@/agent/session-agent-runtime"
import { Database } from "@/storage/db"
import path from "node:path"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const target = { providerID: "compaction-local", modelID: "checkpoint-model" }
const limitModel = (limit: { context: number; input?: number; output: number }) => ({ limit }) as Provider.Model

afterEach(resetMemoryDatabase)

describe("compaction request and continuation contracts", () => {
  test("intersects input capacity with the actual combined-window output reservation", () => {
    const model = limitModel({ context: 400_000, input: 272_000, output: 128_000 })
    expect(ContextBudget.capacity({ config: {}, model })).toEqual({ status: "known", tokens: 256_000 })
    expect(
      ContextBudget.capacity({
        config: {},
        model: limitModel({ context: 200_000, input: 190_000, output: 40_000 }),
        effectiveOutputTokens: 30_000,
      }),
    ).toEqual({ status: "known", tokens: 170_000 })
    expect(
      ContextBudget.capacity({ config: {}, model: limitModel({ context: 0, input: 80_000, output: 8_000 }) }),
    ).toEqual({ status: "known", tokens: 80_000 })
    expect(ContextBudget.capacity({ config: {}, model: limitModel({ context: 0, output: 8_000 }) })).toEqual({
      status: "known",
      tokens: 256_000,
    })
    expect(ContextBudget.capacity({ config: {}, model: limitModel({ context: 8_000, output: 8_000 }) })).toEqual({
      status: "known",
      tokens: 0,
    })
    expect(ContextBudget.preserveRecent({ config: {}, model })).toBe(64_000)
    expect(ContextBudget.preserveRecent({ config: { compaction: { preserve_recent_tokens: 4_000 } }, model })).toBe(
      4_000,
    )
  })

  test.each(["before-source", "after-source", "at-source"] as const)(
    "preserves the initial anchor with a retained tail %s and repeated continuation compaction",
    async (placement) => {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const session = await Session.create({ kind: "assistant", title: "Stable incremental compaction anchor" })
          const initial = await user(session.id, "Original Task authority")
          await assistant(session.id, initial.id, "Earlier evidence ".repeat(1_000), true)
          let next: Message.User
          let tail: Message.Assistant | Message.User
          if (placement === "before-source") {
            tail = await assistant(session.id, initial.id, "Verified tool result", true)
            next = await user(session.id, "Incremental guidance")
          } else {
            next = await user(session.id, "Incremental guidance")
            tail = placement === "at-source" ? next : await assistant(session.id, next.id, "Verified tool result", true)
          }
          const summary = await assistant(session.id, next.id, "Verified prior work", false, true)
          await Session.publishCompactionCheckpoint({
            info: summary,
            part: {
              id: Identifier.ascending("part"),
              sessionID: session.id,
              messageID: summary.id,
              type: "compaction",
              auto: true,
              anchor_id: initial.id,
              tail_start_id: tail.id,
            },
          })
          const projected = await Message.filterCompacted(MessageStore.stream(session.id))
          expect(projected.map((message) => message.info.id)).toEqual([
            initial.id,
            summary.id,
            ...(placement === "before-source"
              ? [tail.id, next.id]
              : placement === "at-source"
                ? [next.id]
                : [next.id, tail.id]),
          ])
          expect(projected[0]?.parts).toEqual(
            expect.arrayContaining([expect.objectContaining({ type: "text", text: "Original Task authority" })]),
          )
          const repeated = SessionCompaction.TestHooks.repeatedCompactionInput(projected, next.id)
          expect(repeated).toMatchObject({ anchor_id: initial.id })
          expect(repeated?.head[0]?.info.id).toBe(summary.id)
          Database.close()
          Database.Client()
          expect(
            (await Message.filterCompacted(MessageStore.stream(session.id))).map((message) => message.info.id),
          ).toEqual(projected.map((message) => message.info.id))
        },
      })
    },
  )

  test("prices compaction system, tools and binary images in the same request envelope", () => {
    const request = {
      messages: [
        {
          role: "user" as const,
          content: [{ type: "image" as const, image: new Uint8Array(200_000), mediaType: "image/png" }],
        },
      ],
      system: ["summary instructions ".repeat(100)],
      tools: { reader: tool({ description: "Read the persisted result", inputSchema: z.object({ id: z.string() }) }) },
    }
    const estimate = RequestBudget.estimate(request)
    const measured = SessionCompaction.requestBudget({
      ...request,
      config: {},
      model: limitModel({ context: 2_000, output: 500 }),
    })
    expect(estimate.mediaCounts).toEqual({ image: 1, pdf: 0, audio: 0, video: 0 })
    expect(estimate.messagePayloadChars).toBeLessThan(500)
    expect(measured).toMatchObject({
      ...estimate,
      estimatedTokens: estimate.totalTokensEst,
      usableBudget: 1_500,
      exceeds: true,
    })
    expect(estimate.totalTokensEst).toBe(
      estimate.systemTokensEst +
        estimate.toolSchemaTokensEst +
        estimate.messagePayloadTokensEst +
        estimate.mediaTokensEst,
    )
    expect(
      Message.fromError(new Message.ContextOverflowError({ message: "declared capacity exceeded" }), {
        providerID: target.providerID,
      }),
    ).toEqual({ name: "ContextOverflowError", data: { message: "declared capacity exceeded" } })
  })

  test("retains a completed assistant tool step and reconstructs the same tail", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Compaction closed-step tail" })
        const source = await user(session.id, "Keep the task contract")
        const oldOutput = "earlier tool evidence ".repeat(25_000)
        await assistant(session.id, source.id, "earlier evidence ".repeat(3_000), true, false, oldOutput)
        const recent = await assistant(session.id, source.id, "Latest verified result and next action", true)
        const history = await Session.messages({ sessionID: session.id })
        const model = modelDefinition()
        const selected = await SessionCompaction.TestHooks.selectCompactionInput({
          messages: history,
          config: { compaction: { tail_turns: 1 } },
          model,
          overflow: false,
        })
        expect(selected).toMatchObject({ anchor_id: source.id, tail_start_id: recent.id })
        expect(selected.head.map((message) => message.info.id)).toEqual([history[1]!.info.id])
        const summary = await assistant(session.id, source.id, "Earlier investigation completed.", false, true)
        await Session.publishCompactionCheckpoint({
          info: { ...summary, summary: true },
          part: {
            id: Identifier.ascending("part"),
            sessionID: session.id,
            messageID: summary.id,
            type: "compaction",
            auto: true,
            anchor_id: source.id,
            tail_start_id: recent.id,
          },
        })
        const fullHistory = await Session.messages({ sessionID: session.id })
        for (const prune of [false, true]) {
          const projection = await SessionLoop.TestHooks.providerInputProjection({
            system: [],
            systemLabels: [],
            dynamicContextText: "",
            msgs: fullHistory,
            model,
            prune,
          })
          const result = projection.modelMessages.flatMap((message) =>
            message.role === "tool" ? message.content : [],
          )[0]
          expect(result).toMatchObject({
            type: "tool-result",
            output: { type: "text", value: prune ? "[Old tool result content cleared]" : oldOutput },
          })
        }
        const projected = await Message.filterCompacted(MessageStore.stream(session.id))
        expect(projected.map((message) => message.info.id)).toEqual([source.id, summary.id, recent.id])
        expect(projected.at(-1)?.parts.find((part) => part.type === "text")).toMatchObject({
          text: "Latest verified result and next action",
        })
        expect(projected.at(-1)?.parts.find((part) => part.type === "tool")).toMatchObject({
          state: { status: "completed", output: "Verified result" },
        })
      },
    })
  })

  test("bounded summary input keeps an exact readable result and attachment locator", async () => {
    const part = {
      id: "prt_large_result",
      messageID: "msg_result",
      sessionID: "ses_result",
      type: "tool",
      tool: "report",
      callID: "call_result",
      state: {
        status: "completed",
        input: {},
        title: "large result",
        metadata: {},
        output: `${"prefix ".repeat(10_000)}NEXT_OFFSET=87654${" tail".repeat(10_000)}`,
        time: { start: 1, end: 2 },
        attachments: [
          {
            id: "file_evidence",
            sessionID: "ses_result",
            messageID: "msg_result",
            type: "file",
            mime: "image/png",
            filename: "evidence.png",
            url: "opencorvus-attachment://project/evidence.png",
          },
        ],
      },
    } as Message.ToolPart
    const history = [
      { info: { id: "msg_result", role: "assistant", agent: "work" }, parts: [part] },
    ] as Message.WithParts[]
    const transcript = JSON.stringify(SessionCompaction.TestHooks.compactionTranscriptMessages(history))
    expect(transcript.length).toBeLessThan(5_000)
    expect(transcript).toContain("compaction_tool_result_reference")
    expect(transcript).toContain("opencorvus-attachment://project/evidence.png")
    const reader = CompactionToolResultReader.create(history)
    const output = (await reader.execute!(
      { part_id: part.id, offset: 70_000, limit: 30 },
      { toolCallId: "read_exact", messages: [], abortSignal: AbortSignal.timeout(1_000) },
    )) as { output: string }
    expect(JSON.parse(output.output)).toMatchObject({
      partID: part.id,
      offset: 70_000,
      end: 70_030,
      nextOffset: 70_030,
      content: "NEXT_OFFSET=87654 tail tail ta",
    })
  })
})

function modelDefinition(): Provider.Model {
  return {
    id: target.modelID,
    providerID: target.providerID,
    name: "Local checkpoint transport",
    api: { id: target.modelID, url: "http://127.0.0.1", npm: "@ai-sdk/openai-compatible" },
    limit: { context: 1_000_000, input: 900_000, output: 16_000 },
    capabilities: {
      toolcall: true,
      attachment: false,
      reasoning: false,
      temperature: true,
      interleaved: false,
      input: { text: true, image: false, audio: false, video: false, pdf: false },
      output: { text: true, image: false, audio: false, video: false, pdf: false },
    },
    cost: { available: true, input: 0, output: 0, cache: { read: 0, write: 0 } },
    options: {},
    headers: {},
    status: "active",
    release_date: "2026-09-30",
  } as Provider.Model
}

async function user(sessionID: string, text: string) {
  const info = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID,
    role: "user",
    author: "user",
    time: { created: Date.now() },
    agent: "chat",
    model: target,
  })
  await Session.updatePart({ id: Identifier.ascending("part"), sessionID, messageID: info.id, type: "text", text })
  return info
}

async function assistant(
  sessionID: string,
  parentID: string,
  text: string,
  step = false,
  summary = false,
  toolOutput = "Verified result",
) {
  const info = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID,
    role: "assistant",
    summary,
    author: summary ? "compaction" : "chat",
    parentID,
    agent: summary ? "compaction" : "chat",
    time: { created: Date.now() },
    finish: "stop",
    path: { cwd: Instance.directory, root: Instance.worktree },
    providerID: target.providerID,
    modelID: target.modelID,
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
  })
  if (step)
    await Session.updatePart({ id: Identifier.ascending("part"), sessionID, messageID: info.id, type: "step-start" })
  if (step)
    await Session.updatePart({
      id: Identifier.ascending("part"),
      sessionID,
      messageID: info.id,
      type: "tool",
      tool: "read",
      callID: `call_${info.id}`,
      state: {
        status: "completed",
        input: { filePath: "result.txt" },
        output: toolOutput,
        title: "Read evidence",
        metadata: {},
        time: { start: Date.now(), end: Date.now() + 1 },
      },
    })
  await Session.updatePart({ id: Identifier.ascending("part"), sessionID, messageID: info.id, type: "text", text })
  return Session.updateMessage({ ...info, time: { ...info.time, completed: Date.now() } })
}

describe("real local streaming compaction transport", () => {
  test.each(["tool-result", "step-system"] as const)(
    "checks the final continuation envelope after %s growth",
    async (growth) => {
      const server = Bun.serve({
        hostname: "127.0.0.1",
        port: 0,
        fetch() {
          const chunk = (delta: Record<string, unknown>, finish: string | null) =>
            `data: ${JSON.stringify({
              id: "chatcmpl-read-step",
              object: "chat.completion.chunk",
              created: 1,
              model: target.modelID,
              choices: [{ index: 0, delta, finish_reason: finish }],
            })}\n\n`
          return new Response(
            chunk(
              {
                role: "assistant",
                tool_calls: [
                  { index: 0, id: "call_read", type: "function", function: { name: "Read", arguments: "{}" } },
                ],
              },
              null,
            ) +
              chunk({}, "tool_calls") +
              "data: [DONE]\n\n",
            { headers: { "content-type": "text/event-stream" } },
          )
        },
      })
      try {
        await using project = await memoryProject()
        await Instance.provide({
          directory: project.path,
          fn: async () => {
            await Config.updateGlobalPatch({
              compaction: { max_context_tokens: 19_000 },
              provider: {
                [target.providerID]: {
                  name: "Local continuation transport",
                  npm: "@ai-sdk/openai-compatible",
                  api: `http://127.0.0.1:${server.port}/v1`,
                  models: {
                    [target.modelID]: {
                      name: "Checkpoint",
                      tool_call: true,
                      limit: { context: 1_000_000, output: 1_000 },
                    },
                  },
                },
              },
            })
            const session = await Session.create({ kind: "assistant", title: "Final continuation budget" })
            const source = await user(session.id, "Read the exact source result")
            const executed: string[] = []
            const stream = await LLM.stream({
              user: source,
              sessionID: session.id,
              model: await Provider.getModel(target.providerID, target.modelID),
              agentID: "chat",
              agent: sessionRuntimeFromNativeAgent(await PrimaryAssistantRegistry.get("chat")),
              runtimeSystemMode: "complete",
              system: ["Read the source before continuing."],
              messages: [{ role: "user", content: "Read the exact result." }],
              tools: {
                Read: tool({
                  inputSchema: z.object({}),
                  execute: async () => {
                    executed.push("Read")
                    return growth === "tool-result" ? "exact source evidence ".repeat(20_000) : "Exact source result"
                  },
                }),
              },
              prepareStep: ({ stepNumber }) =>
                stepNumber > 0 && growth === "step-system"
                  ? { system: [{ role: "system", content: "expanded step instructions ".repeat(20_000) }] }
                  : undefined,
              stopWhen: stepCountIs(3),
              abort: AbortSignal.timeout(10_000),
            })
            const errors: unknown[] = []
            for await (const part of stream.fullStream) {
              if (part.type === "error") errors.push(Message.fromError(part.error, { providerID: target.providerID }))
            }
            expect(executed).toEqual(["Read"])
            expect(errors).toEqual([
              {
                name: "ContextOverflowError",
                data: { message: expect.stringContaining("capacity 19000") },
              },
            ])
          },
        })
      } finally {
        await server.stop(true)
      }
    },
    30_000,
  )

  test.each([
    { finish: "stop", text: "Verified implementation; next inspect the final result.", expected: "completed" },
    { finish: "length", text: "Partial requirements before output was truncated", expected: "incomplete" },
    { finish: "content_filter", text: "Partial continuation", expected: "incomplete" },
    { finish: "stop", text: "Unhelpful repetition ".repeat(10_000), expected: "not_smaller" },
  ])(
    "publishes the $expected contract through HTTP stream, processor and durable control",
    async ({ finish, text, expected }) => {
      const requests: Record<string, unknown>[] = []
      const server = Bun.serve({
        hostname: "127.0.0.1",
        port: 0,
        async fetch(request) {
          const body = (await request.json()) as Record<string, unknown>
          requests.push(body)
          const chunk = (delta: Record<string, unknown>, reason: string | null) => ({
            id: "chatcmpl-compaction",
            object: "chat.completion.chunk",
            created: 1,
            model: target.modelID,
            choices: [{ index: 0, delta, finish_reason: reason }],
          })
          const encoder = new TextEncoder()
          return new Response(
            new ReadableStream({
              start(controller) {
                for (const item of [
                  chunk({ role: "assistant" }, null),
                  chunk({ content: text }, null),
                  chunk({}, finish),
                ])
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(item)}\n\n`))
                controller.enqueue(encoder.encode("data: [DONE]\n\n"))
                controller.close()
              },
            }),
            { headers: { "content-type": "text/event-stream" } },
          )
        },
      })
      try {
        await using project = await memoryProject()
        await Instance.provide({
          directory: project.path,
          fn: async () => {
            await Config.updateGlobalPatch({
              compaction: { tail_turns: 0, max_context_tokens: 256_000 },
              provider: {
                [target.providerID]: {
                  name: "Local compaction transport",
                  npm: "@ai-sdk/openai-compatible",
                  api: `http://127.0.0.1:${server.port}/v1`,
                  models: {
                    [target.modelID]: {
                      name: "Checkpoint",
                      tool_call: true,
                      modalities: { input: ["text"], output: ["text"] },
                      limit: { context: 1_000_000, output: 16_000 },
                    },
                  },
                },
              },
            })
            const session = await Session.create({ kind: "assistant", title: `Compaction ${expected}` })
            const source = await user(session.id, "Preserve verified work and the pending visual check.")
            const stable = await assistant(session.id, source.id, "Existing valid checkpoint.", false, true)
            await Session.publishCompactionCheckpoint({
              info: { ...stable, summary: true },
              part: {
                id: Identifier.ascending("part"),
                sessionID: session.id,
                messageID: stable.id,
                type: "compaction",
                auto: true,
                anchor_id: source.id,
              },
            })
            await assistant(session.id, source.id, "Verified execution evidence ".repeat(1_000))
            const next = await user(session.id, "Continue the same task after compaction.")
            const control = await SessionCompaction.create({ sessionID: session.id, source: next, auto: true })
            let outcome: unknown
            try {
              outcome = await SessionLoop.TestHooks.executeCompactionControl({
                control,
                sessionID: session.id,
                run: () =>
                  Session.messages({ sessionID: session.id }).then((messages) =>
                    SessionCompaction.process(
                      {
                        sessionID: session.id,
                        parentID: next.id,
                        messages,
                        abort: AbortSignal.timeout(30_000),
                        auto: true,
                        model: target,
                      },
                      { prepareProviderTool: ({ tool }) => tool },
                    ),
                  ),
              })
            } catch (error) {
              outcome = error
            }
            expect(requests).toHaveLength(1)
            expect(requests[0]).toMatchObject({
              stream: true,
              model: target.modelID,
              tools: [
                expect.objectContaining({
                  function: expect.objectContaining({ name: CompactionToolResultReader.TOOL_NAME }),
                }),
              ],
            })
            const history = await Session.messages({ sessionID: session.id })
            const summary = history.find(
              (message) => message.info.role === "assistant" && message.info.parentID === next.id,
            )
            if (!summary || summary.info.role !== "assistant") throw new Error("Compaction assistant missing")
            if (expected === "completed") {
              expect(outcome).toBe("continue")
              expect(summary.info).toMatchObject({ finish: "stop", summary: true })
              expect(SessionControl.get(control.id)?.status).toBe("consumed")
              const checker = Bun.spawn(
                [process.execPath, path.resolve(import.meta.dir, "../script/replay-compaction-errors-validator.ts")],
                {
                  cwd: path.resolve(import.meta.dir, ".."),
                  env: {
                    ...process.env,
                    OPENCORVUS_DB: Database.Path(),
                    SESSION_ID: session.id,
                    COMPACTION_MESSAGE_ID: summary.info.id,
                  },
                  stdout: "pipe",
                  stderr: "pipe",
                },
              )
              const [exitCode, stdout, stderr] = await Promise.all([
                checker.exited,
                new Response(checker.stdout).text(),
                new Response(checker.stderr).text(),
              ])
              expect(exitCode, stderr).toBe(0)
              expect(JSON.parse(stdout)).toMatchObject({
                status: "valid_checkpoint",
                summaryID: summary.info.id,
                finish: "stop",
              })
              expect(await SessionMemory.read(session.id)).toMatchObject({
                sourceMessageID: summary.info.id,
                content: text,
              })
              const projected = await Message.filterCompacted(MessageStore.stream(session.id))
              expect(projected.map((message) => message.info.id)).toEqual([source.id, summary.info.id, next.id])
              expect(
                await Message.toModelMessages(projected, await Provider.getModel(target.providerID, target.modelID)),
              ).toEqual(
                expect.arrayContaining([
                  expect.objectContaining({ role: "assistant", content: [{ type: "text", text }] }),
                ]),
              )
              const resumedModel = await Provider.getModel(target.providerID, target.modelID)
              const stream = await LLM.stream({
                user: next,
                sessionID: session.id,
                model: resumedModel,
                agentID: "chat",
                agent: sessionRuntimeFromNativeAgent(await PrimaryAssistantRegistry.get("chat")),
                system: [],
                messages: await Message.toModelMessages(projected, resumedModel),
                tools: {},
                abort: AbortSignal.timeout(10_000),
              })
              for await (const _part of stream.fullStream) {
                /* Consume the real continuation response. */
              }
              expect(requests).toHaveLength(2)
              expect(requests[1]?.messages).toEqual(
                expect.arrayContaining([
                  expect.objectContaining({ role: "assistant", content: text }),
                  expect.objectContaining({ role: "user", content: "Continue the same task after compaction." }),
                ]),
              )
              await assistant(session.id, next.id, "New verified evidence ".repeat(1_000))
              const repeatedControl = await SessionCompaction.create({
                sessionID: session.id,
                source: next,
                auto: true,
              })
              const repeatedOutcome = await SessionLoop.TestHooks.executeCompactionControl({
                control: repeatedControl,
                sessionID: session.id,
                run: async () =>
                  SessionCompaction.process(
                    {
                      sessionID: session.id,
                      parentID: next.id,
                      messages: await Message.filterCompacted(MessageStore.stream(session.id)),
                      abort: AbortSignal.timeout(30_000),
                      auto: true,
                      model: target,
                    },
                    { prepareProviderTool: ({ tool }) => tool },
                  ),
              })
              expect(repeatedOutcome).toBe("continue")
              expect(SessionControl.get(repeatedControl.id)?.status).toBe("consumed")
              const repeatedHistory = await Message.filterCompacted(MessageStore.stream(session.id))
              const repeatedSummary = repeatedHistory.find(
                (message) => message.info.role === "assistant" && message.info.summary,
              )
              expect(repeatedSummary?.parts.find((part) => part.type === "compaction")).toMatchObject({
                anchor_id: source.id,
              })
              expect(repeatedHistory.map((message) => message.info.id)).toEqual([
                source.id,
                repeatedSummary!.info.id,
                next.id,
              ])
              expect(requests).toHaveLength(3)
            } else {
              expect(outcome).toMatchObject({
                name: "CompactionSummaryInvalidError",
                cause: { name: "CompactionSummaryInvalidError", data: { reason: expected } },
              })
              expect(summary.info).toMatchObject({
                summary: false,
                finish: "error",
                error: { name: "CompactionSummaryInvalidError", data: { reason: expected } },
              })
              expect(SessionControl.get(control.id)?.status).toBe("failed")
              expect(await SessionMemory.read(session.id)).toMatchObject({
                sourceMessageID: stable.id,
                content: "Existing valid checkpoint.",
              })
            }
          },
        })
      } finally {
        await server.stop(true)
      }
    },
    60_000,
  )
})
