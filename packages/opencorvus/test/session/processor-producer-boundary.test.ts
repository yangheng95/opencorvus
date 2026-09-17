import { afterEach, expect, spyOn, test } from "bun:test"
import { MockLanguageModelV3, simulateReadableStream } from "ai/test"
import { tool } from "ai"
import z from "zod"
import fs from "node:fs/promises"
import path from "node:path"
import { PrimaryAssistantRegistry } from "@/agent/primary-assistant-registry"
import { sessionRuntimeFromNativeAgent } from "@/agent/session-agent-runtime"
import { Config } from "@/config/config"
import { EngineConfig } from "@/engine/config"
import { Identifier } from "@/id/id"
import { DefaultLLMActivityPolicy } from "@/llm/activity"
import { Provider } from "@/provider/provider"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { SessionProcessor } from "@/session/processor"
import { ExecutionCancellationError, createExecutionCancellationOrigin } from "@/session/prompt/cancellation"
import { ProviderActivityOutcomeTable } from "@/session/session.sql"
import { Database } from "@/storage/db"
import { Snapshot } from "@/snapshot"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import { Bus } from "@/bus"
import { Message } from "@/session/message"
import { MessageStore } from "@/session/message-store"
import { LLM } from "@/session/llm"
import { ensureTaskMessageProtocolBridge } from "@/orchestrator/protocol/message-bridge"
import { ProtocolStore } from "@/protocol/store"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function processorFixture(
  run: (input: {
    directory: string
    sessionID: string
    controller: AbortController
    processor: ReturnType<typeof SessionProcessor.create>
    process: (tools: any, stream?: any) => ReturnType<ReturnType<typeof SessionProcessor.create>["process"]>
  }) => Promise<void>,
) {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const ref = { providerID: "producer-boundary", modelID: "deterministic" }
      await Config.updateProjectPatch({
        model: `${ref.providerID}/${ref.modelID}`,
        provider: {
          [ref.providerID]: {
            name: "Producer boundary",
            npm: "@ai-sdk/openai-compatible",
            api: "http://127.0.0.1:1/v1",
            models: {
              [ref.modelID]: {
                name: "Producer boundary",
                tool_call: true,
                modalities: { input: ["text"], output: ["text"] },
                limit: { context: 32000, output: 4096 },
              },
            },
          },
        },
      })
      const model = await Provider.getModel(ref.providerID, ref.modelID)
      const agent = sessionRuntimeFromNativeAgent(
        await PrimaryAssistantRegistry.get("coding", { config: await Config.get() }),
      )
      const session = await Session.create({ kind: "assistant", title: "Producer boundary" })
      const user = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: session.id,
        role: "user",
        author: "user",
        agent: "coding",
        time: { created: Date.now() },
        model: ref,
      })
      const assistant = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: session.id,
        parentID: user.id,
        role: "assistant",
        author: "coding",
        agent: "coding",
        path: { cwd: project.path, root: project.path },
        cost: 0,
        tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
        providerID: ref.providerID,
        modelID: ref.modelID,
        time: { created: Date.now() },
      })
      const controller = new AbortController()
      if (user.role !== "user" || assistant.role !== "assistant")
        throw new Error("Processor fixture participant roles are invalid")
      const processor = SessionProcessor.create({
        assistantMessage: assistant,
        sessionID: session.id,
        model,
        abort: controller.signal,
      })
      await run({
        directory: project.path,
        sessionID: session.id,
        controller,
        processor,
        process: (tools, stream) =>
          processor.process({
            user,
            agentID: "coding",
            agent,
            abort: controller.signal,
            sessionID: session.id,
            system: [],
            messages: [{ role: "user", content: "Commit the requested operation." }],
            tools,
            model,
            stream,
          }),
      })
    },
  })
}

test("a producer-side committed operation yields unsafe retry when its consumer stalls before tool-call", async () => {
  await processorFixture(async ({ directory, processor, process }) => {
    const effect = Promise.withResolvers<void>()
    const file = path.join(directory, "effect.txt")
    const language = new MockLanguageModelV3({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: [
            { type: "stream-start", warnings: [] },
            { type: "tool-call", toolCallId: "commit-once", toolName: "commit", input: "{}" },
          ],
        }),
      }),
    })
    const provider = spyOn(Provider, "getLanguage").mockResolvedValue(language)
    const engine = spyOn(EngineConfig, "get").mockResolvedValue({
      ...EngineConfig.defaults,
      activity: { ...EngineConfig.defaults.activity, session_llm_idle_ms: 150 },
    })
    const backoff = spyOn(DefaultLLMActivityPolicy, "backoffMs").mockReturnValue(0)
    try {
      const result = await process(
        {
          commit: tool({
            inputSchema: z.object({}),
            execute: async () => {
              await fs.appendFile(file, "committed\n")
              effect.resolve()
              return { title: "Committed", output: "Persisted one operation", metadata: {} }
            },
          }),
        },
        {
          onChunk: async ({ chunk }: any) => {
            if (chunk.type === "start-step") {
              await effect.promise
              await Bun.sleep(250)
            }
          },
        },
      )
      expect({ result, bytes: await fs.readFile(file, "utf8"), error: processor.message.error }).toMatchObject({
        result: "stop",
        bytes: "committed\n",
        error: { name: "UnknownError", data: { message: expect.stringContaining("ProcessorUnsafeRetryError") } },
      })
    } finally {
      provider.mockRestore()
      engine.mockRestore()
      backoff.mockRestore()
    }
  })
}, 30_000)

for (const boundary of ["complete", "cancel"] as const) {
  test(`pending Tool input publishes its real partial snapshot before ${boundary}`, async () => {
    await processorFixture(async ({ controller, processor, process, sessionID }) => {
      const entered = Promise.withResolvers<void>()
      const release = Promise.withResolvers<void>()
      const events: Array<{ type: string; part?: Message.ToolPart; partID?: string }> = []
      ensureTaskMessageProtocolBridge()
      const visible: unknown[] = []
      const stopProtocol = ProtocolStore.subscribeEvents((event) => {
        visible.push(event.payload)
      }, { sessionID })
      const stopUpdated = Bus.subscribe(Message.Event.PartUpdated, ({ properties }) => {
        if (properties.part.sessionID === sessionID && properties.part.type === "tool") {
          events.push({ type: "updated", part: structuredClone(properties.part) })
        }
      })
      const stopRemoved = Bus.subscribe(Message.Event.PartRemoved, ({ properties }) => {
        if (properties.sessionID === sessionID) events.push({ type: "removed", partID: properties.partID })
      })
      const stream = spyOn(LLM, "stream").mockImplementation(async (input) => ({
        fullStream: (async function* () {
          yield { type: "start" }
          yield { type: "tool-input-start", id: "partial-input", toolName: "echo" }
          yield { type: "tool-input-delta", id: "partial-input", delta: '{"value":"visible' }
          yield { type: "tool-input-start", id: "parallel-input", toolName: "echo" }
          yield { type: "tool-input-delta", id: "parallel-input", delta: '{"value":"second' }
          entered.resolve()
          await release.promise
          input.abort.throwIfAborted()
          yield { type: "tool-input-delta", id: "partial-input", delta: '"}' }
          yield { type: "tool-input-end", id: "partial-input" }
          // The SDK execution callback may admit input before fullStream's
          // consumer receives tool-call; both paths share one per-call lock.
          await processor.ensureToolPart("partial-input", "echo", { value: "visible" })
          yield { type: "tool-call", toolCallId: "partial-input", toolName: "echo", input: { value: "visible" } }
          yield {
            type: "tool-result", toolCallId: "partial-input", toolName: "echo", input: { value: "visible" },
            output: { title: "Echo", output: "visible", metadata: {} },
          }
          yield { type: "tool-input-delta", id: "parallel-input", delta: '"}' }
          yield { type: "tool-call", toolCallId: "parallel-input", toolName: "echo", input: { value: "second" } }
          yield {
            type: "tool-result", toolCallId: "parallel-input", toolName: "echo", input: { value: "second" },
            output: { title: "Echo", output: "second", metadata: {} },
          }
          yield { type: "finish", finishReason: "tool-calls", totalUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } }
        })(),
      }) as Awaited<ReturnType<typeof LLM.stream>>)
      const running = process({})
      try {
        await entered.promise
        await Bun.sleep(350)
        expect(events).toContainEqual({
          type: "updated",
          part: expect.objectContaining({
            sessionID, messageID: processor.message.id, tool: "echo", callID: "partial-input",
            orderKey: expect.any(String), state: expect.objectContaining({ status: "pending", raw: '{"value":"visible' }),
          }),
        })
        expect(visible).toContainEqual(expect.objectContaining({
          part: expect.objectContaining({ tool: "echo", state: expect.objectContaining({ status: "pending", raw: '{"value":"visible' }) }),
        }))
        expect(events).toContainEqual({ type: "updated", part: expect.objectContaining({
          callID: "parallel-input", state: expect.objectContaining({ status: "pending", raw: '{"value":"second' }),
        }) })
        if (boundary === "cancel") controller.abort(new DOMException("Cancel partial Tool input", "AbortError"))
        release.resolve()
        await running
        const pending = events.find((event) => event.part?.state.status === "pending")!.part!
        expect(events).toContainEqual({ type: "removed", partID: pending.id })
        const parallel = events.find((event) => event.part?.callID === "parallel-input")!.part!
        expect(events).toContainEqual({ type: "removed", partID: parallel.id })
        if (boundary === "complete") {
          const completed = (await MessageStore.parts(processor.message.id)).find((part) => part.type === "tool")
          expect(completed).toMatchObject({ id: pending.id, type: "tool", state: { status: "completed", input: { value: "visible" }, output: "visible" } })
          expect(await MessageStore.parts(processor.message.id)).toContainEqual(expect.objectContaining({
            id: parallel.id, state: expect.objectContaining({ status: "completed", input: { value: "second" }, output: "second" }),
          }))
          expect(events.findIndex((event) => event.type === "removed")).toBeLessThan(
            events.findIndex((event) => event.part?.state.status === "running"),
          )
        } else {
          expect(processor.message.error).toMatchObject({ name: "MessageAbortedError" })
        }
      } finally {
        release.resolve()
        controller.abort()
        await running
        stopUpdated()
        stopRemoved()
        stopProtocol()
        stream.mockRestore()
      }
    })
  }, 30_000)
}

test("a delta received during slow draft publication produces a complete latest snapshot", async () => {
  await processorFixture(async ({ controller, process, sessionID }) => {
    const publishing = Promise.withResolvers<void>()
    const subscriberRelease = Promise.withResolvers<void>()
    const lastDelta = Promise.withResolvers<void>()
    const providerRelease = Promise.withResolvers<void>()
    const latest = Promise.withResolvers<void>()
    const rawValues: string[] = []
    const stop = Bus.subscribe(Message.Event.PartUpdated, async ({ properties: { part } }) => {
      if (part.sessionID !== sessionID || part.type !== "tool" || part.state.status !== "pending") return
      rawValues.push(part.state.raw)
      if (part.state.raw === '{"value":"first') {
        publishing.resolve()
        await subscriberRelease.promise
      }
      if (part.state.raw === '{"value":"first-last') latest.resolve()
    })
    const stream = spyOn(LLM, "stream").mockImplementation(async (input) => ({
      fullStream: (async function* () {
        yield { type: "start" }
        yield { type: "tool-input-start", id: "slow-publication", toolName: "echo" }
        yield { type: "tool-input-delta", id: "slow-publication", delta: '{"value":"first' }
        await publishing.promise
        yield { type: "tool-input-delta", id: "slow-publication", delta: "-last" }
        lastDelta.resolve()
        await providerRelease.promise
        input.abort.throwIfAborted()
      })(),
    }) as Awaited<ReturnType<typeof LLM.stream>>)
    const running = process({})
    try {
      await lastDelta.promise
      subscriberRelease.resolve()
      await Promise.race([latest.promise, Bun.sleep(1_000)])
      expect(rawValues).toContain('{"value":"first-last')
    } finally {
      subscriberRelease.resolve()
      publishing.resolve()
      controller.abort(new DOMException("End partial input test", "AbortError"))
      providerRelease.resolve()
      await running
      stop()
      stream.mockRestore()
    }
  })
}, 30_000)

test("cancelling paused step preparation settles its activity only after the producer relinquishes it", async () => {
  await processorFixture(async ({ controller, processor, process, sessionID }) => {
    const entered = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    let releasedAt = 0
    const snapshot = spyOn(Snapshot, "track").mockImplementation(async () => {
      entered.resolve()
      await release.promise
      releasedAt = Date.now()
      return undefined
    })
    const provider = spyOn(Provider, "getLanguage").mockResolvedValue(
      new MockLanguageModelV3({ doStream: async () => ({ stream: simulateReadableStream({ chunks: [] }) }) }),
    )
    try {
      const running = process({})
      await entered.promise
      controller.abort(
        new ExecutionCancellationError({
          source: "session_prompt",
          sessionID,
          message: "Cancel the paused preparation",
          origin: createExecutionCancellationOrigin({
            actor: "runtime",
            source: "process.shutdown",
            surface: "producer-test",
            reason: "Cancel the paused preparation",
            targetSessionID: sessionID,
          }),
        }),
      )
      await Bun.sleep(20)
      release.resolve()
      const result = await running
      const outcomes = Database.use((db) => db.select().from(ProviderActivityOutcomeTable).all())
      expect(outcomes[0]!.time_created).toBeGreaterThanOrEqual(releasedAt)
      expect({ result, error: processor.message.error, outcomes }).toMatchObject({
        result: "stop",
        error: { name: "MessageAbortedError" },
        outcomes: [
          expect.objectContaining({
            data: expect.objectContaining({ outcome: "aborted", error_class: "external_abort", attempt_count: 1 }),
          }),
        ],
      })
    } finally {
      release.resolve()
      snapshot.mockRestore()
      provider.mockRestore()
    }
  })
}, 30_000)
