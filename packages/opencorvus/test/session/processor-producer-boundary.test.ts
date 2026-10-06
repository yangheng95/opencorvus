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
import { EngineTaskTable } from "@/engine/engine.sql"
import { AgentTrace } from "@/trace"
import { appendTaskOpenedInTransaction } from "@/engine/task-lifecycle"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test("real idle retry scopes pending JSON observations to each actual attempt before external cancellation", async () => {
  await processorFixture(async ({ controller, processor, process, taskID, sessionID }) => {
    if (!taskID) throw new Error("Expected actual Task binding")
    const entered = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const recorded: Parameters<typeof AgentTrace.recordLLMStreamObservation>[0][] = []
    const original = AgentTrace.recordLLMStreamObservation
    using recorder = spyOn(AgentTrace, "recordLLMStreamObservation").mockImplementation((input) => {
      recorded.push(structuredClone(input))
      original(input)
    })
    using engine = spyOn(EngineConfig, "get").mockResolvedValue({
      ...EngineConfig.defaults,
      activity: { ...EngineConfig.defaults.activity, session_llm_idle_ms: 150 },
    })
    using backoff = spyOn(DefaultLLMActivityPolicy, "backoffMs").mockReturnValue(0)
    using stream = spyOn(LLM, "stream").mockImplementation(async (input) => ({
      fullStream: (async function* () {
        const attempt = input.activity?.attempt
        if (attempt !== 0 && attempt !== 1) throw new Error("Expected actual initial or retry attempt")
        const id = attempt === 0 ? "first-draft" : "retry-draft"
        yield { type: "start" }
        yield { type: "tool-input-start", id, toolName: "echo" }
        yield { type: "tool-input-delta", id, delta: attempt === 0 ? '{"a":1,"b":2}' : '{"n":null}' }
        if (attempt === 0) {
          await new Promise<never>((_, reject) => {
            if (input.abort.aborted) reject(input.abort.reason)
            else input.abort.addEventListener("abort", () => reject(input.abort.reason), { once: true })
          })
        } else yield { type: "tool-input-end", id }
      })(),
    }) as Awaited<ReturnType<typeof LLM.stream>>)
    const running = process({}, { onChunk: async ({ chunk }: { chunk: { type: string } }) => {
      if (chunk.type === "tool-input-end") { entered.resolve(); await release.promise }
    } })
    try {
      await entered.promise
      controller.abort(new DOMException("Close the owned retry input observation", "AbortError"))
      const aborted = recorded.filter((entry) => entry.phase === "aborted")
      const activityID = aborted[0]!.activity.id
      expect(aborted.map((entry) => ({ taskID: entry.taskID, sessionID: entry.sessionID, activity: entry.activity }))).toEqual(
        [0, 1].map((attempt) => ({ taskID, sessionID, activity: { id: activityID, attempt, assistantMessageID: processor.message.id } })),
      )
      expect(aborted.map((entry) => entry.pendingToolInputs)).toEqual([
        {
          pendingCount: 1, totalUTF16Length: 13, observedUTF16Length: 13, trimmedUTF16Length: 13,
          nonWhitespaceUTF16Length: 13, trailingWhitespaceUTF16Length: 0, rootFieldCount: 2,
          states: { complete_json: 1, syntax_error: 0, non_object: 0, empty: 0, unobserved_size_limit: 0 },
          valueTypes: { null: 0, array: 0, object: 0, string: 0, number: 2, boolean: 0 },
          bookkeepingFailures: 0, sourceUTF16Budget: Math.floor(AgentTrace.eventByteBudget() / 2),
        },
        {
          pendingCount: 1, totalUTF16Length: 10, observedUTF16Length: 10, trimmedUTF16Length: 10,
          nonWhitespaceUTF16Length: 10, trailingWhitespaceUTF16Length: 0, rootFieldCount: 1,
          states: { complete_json: 1, syntax_error: 0, non_object: 0, empty: 0, unobserved_size_limit: 0 },
          valueTypes: { null: 1, array: 0, object: 0, string: 0, number: 0, boolean: 0 },
          bookkeepingFailures: 0, sourceUTF16Budget: Math.floor(AgentTrace.eventByteBudget() / 2),
        },
      ])
      release.resolve()
      expect(await running).toBe("stop")
      expect(processor.message.error).toMatchObject({ name: "MessageAbortedError" })
      expect(AgentTrace.readTaskEvents(taskID).filter((event) => event.kind === "llm_stream_observation")
        .map((event) => event.payload)).toEqual(recorded.map(({ taskID: _task, sessionID: _session, ...entry }) => entry))
    } finally {
      controller.abort(new DOMException("Release owned retry fixture", "AbortError"))
      release.resolve()
      await running
    }
  }, { bindTask: true })
}, 30_000)

async function processorFixture(
  run: (input: {
    directory: string
    sessionID: string
    taskID?: string
    controller: AbortController
    processor: ReturnType<typeof SessionProcessor.create>
    process: (tools: any, stream?: any) => ReturnType<ReturnType<typeof SessionProcessor.create>["process"]>
  }) => Promise<void>,
  options: { bindTask?: boolean } = {},
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
      const taskID = options.bindTask ? Identifier.ascending("task") : undefined
      if (taskID) Database.immediateTransaction((db) => {
        const now = Date.now()
        db.insert(EngineTaskTable).values({ id: taskID, project_id: Instance.project.id, session_id: session.id,
          source: "test", product_pillar: "code", title: "Processor observation", request: "Qualify processor observation", time_created: now }).run()
        appendTaskOpenedInTransaction({ db, taskID, sessionID: session.id, now, source: "test.processor-observation" })
      })
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
        taskID,
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

test("processor observation records accepted and rejected current event identities in the canonical Task trace", async () => {
  await processorFixture(async ({ processor, process, taskID, sessionID }) => {
    if (!taskID) throw new Error("Expected actual Task binding")
    const recorded: Parameters<typeof AgentTrace.recordLLMStreamObservation>[0][] = []
    const originalRecord = AgentTrace.recordLLMStreamObservation
    const recorder = spyOn(AgentTrace, "recordLLMStreamObservation").mockImplementation((input) => {
      recorded.push(structuredClone(input)); originalRecord(input)
    })
    const stream = spyOn(LLM, "stream").mockImplementation(async () => ({ fullStream: (async function* () {
      yield { type: "start" }
      yield { type: "reasoning-start", id: "reasoning-one" }
      yield { type: "reasoning-start", id: "reasoning-one" }
      yield { type: "reasoning-end", id: "reasoning-one" }
      yield { type: "text-start", id: "text-one" }
      yield { type: "text-delta", id: "different-text", text: "ignored identity" }
      yield { type: "text-delta", id: "text-one", text: "actual answer" }
      yield { type: "text-delta", id: "text-one", text: " " }
      yield { type: "text-end", id: "text-one" }
      yield { type: "tool-input-start", id: "known-call", toolName: "echo" }
      yield { type: "tool-input-delta", id: "known-call", delta: "{}" }
      yield { type: "tool-input-delta", id: "known-call", delta: " " }
      yield { type: "tool-input-delta", id: "unknown-call", delta: "{}" }
      yield { type: "tool-input-delta", delta: "{}" }
      yield { type: "tool-call", toolCallId: "known-call", toolName: "echo", input: {} }
      yield { type: "tool-input-delta", id: "known-call", delta: "late" }
      yield { type: "tool-result", toolCallId: "known-call", toolName: "echo", input: {}, output: { title: "Echo", output: "actual result", metadata: {} } }
      yield { type: "finish", finishReason: "stop", totalUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } }
    })() }) as Awaited<ReturnType<typeof LLM.stream>>)
    try {
      await process({})
      const settled = recorded.find((entry) => entry.phase === "settled")
      expect(settled).toMatchObject({ taskID, sessionID, activity: { assistantMessageID: processor.message.id, attempt: 0 },
        observation: { phase: "awaiting_event", received: 18, finished: 18,
          types: { "tool-input-delta": 5, "text-delta": 3, "reasoning-start": 2 },
          acceptedTypes: { "tool-input-delta": 2, "text-delta": 2, "reasoning-start": 1 },
          heartbeatTypes: { "tool-input-delta": 1, "text-delta": 1, "text-start": 1, "text-end": 1 },
          reasons: { missing_id: 1, unknown_tool: 1, not_pending: 1, stream_mismatch: 1, duplicate_start: 1, nonsemantic: 2 } } })
      expect(await MessageStore.parts(processor.message.id)).toContainEqual(expect.objectContaining({ type: "text", text: "actual answer" }))
      expect(AgentTrace.readTaskEvents(taskID)).toContainEqual(expect.objectContaining({ kind: "llm_stream_observation",
        taskID, sessionID, payload: expect.objectContaining({ phase: "settled", observation: settled!.observation }) }))
    } finally { stream.mockRestore(); recorder.mockRestore() }
  }, { bindTask: true })
}, 30_000)

test("abort during an awaited caller hook publishes its immediate hook phase and a separately settled observation", async () => {
  await processorFixture(async ({ controller, processor, process, taskID }) => {
    if (!taskID) throw new Error("Expected actual Task binding")
    const hookEntered = Promise.withResolvers<void>()
    const hookRelease = Promise.withResolvers<void>()
    const abortRecorded = Promise.withResolvers<void>()
    const recorded: Parameters<typeof AgentTrace.recordLLMStreamObservation>[0][] = []
    const originalRecord = AgentTrace.recordLLMStreamObservation
    const recorder = spyOn(AgentTrace, "recordLLMStreamObservation").mockImplementation((input) => {
      recorded.push(structuredClone(input)); originalRecord(input)
      if (input.phase === "aborted") abortRecorded.resolve()
    })
    const stream = spyOn(LLM, "stream").mockImplementation(async () => ({ fullStream: (async function* () {
      yield { type: "start" }
    })() }) as Awaited<ReturnType<typeof LLM.stream>>)
    const running = process({}, { onChunk: async () => { hookEntered.resolve(); await hookRelease.promise } })
    try {
      await hookEntered.promise
      controller.abort(new DOMException("Cancel the held caller hook", "AbortError"))
      await abortRecorded.promise
      expect(recorded.find((entry) => entry.phase === "aborted")).toMatchObject({ taskID,
        observation: { phase: "hook", received: 1, finished: 0 } })
      hookRelease.resolve()
      expect(await running).toBe("stop")
      expect(processor.message.error).toMatchObject({ name: "MessageAbortedError" })
      expect(recorded.find((entry) => entry.phase === "settled")).toMatchObject({ taskID,
        observation: { phase: "aborted", received: 1, finished: 1, failures: { abort: 1 } } })
      expect(AgentTrace.readTaskEvents(taskID).filter((entry) => entry.kind === "llm_stream_observation").map((entry) => entry.payload.phase))
        .toEqual(["aborted", "settled"])
    } finally { hookRelease.resolve(); await running; stream.mockRestore(); recorder.mockRestore() }
  }, { bindTask: true })
}, 30_000)

test("an aborted current attempt records its exact pending JSON structure through the canonical Trace owner", async () => {
  await processorFixture(async ({ controller, processor, process, taskID }) => {
    if (!taskID) throw new Error("Expected actual Task binding")
    const entered = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const recorded: Parameters<typeof AgentTrace.recordLLMStreamObservation>[0][] = []
    const original = AgentTrace.recordLLMStreamObservation
    const recorder = spyOn(AgentTrace, "recordLLMStreamObservation").mockImplementation((input) => {
      recorded.push(structuredClone(input))
      original(input)
    })
    const stream = spyOn(LLM, "stream").mockImplementation(async () => ({ fullStream: (async function* () {
      yield { type: "start" }
      yield { type: "tool-input-start", id: "complete-input", toolName: "echo" }
      yield { type: "tool-input-delta", id: "complete-input", delta: '{"n":null} \n' }
      yield { type: "tool-input-start", id: "partial-input", toolName: "echo" }
      yield { type: "tool-input-delta", id: "partial-input", delta: '{"x":' }
      yield { type: "finish", finishReason: "stop", totalUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } }
    })() }) as Awaited<ReturnType<typeof LLM.stream>>)
    const running = process({}, { onChunk: async ({ chunk }: any) => {
      if (chunk.type === "finish") { entered.resolve(); await release.promise }
    } })
    try {
      await entered.promise
      controller.abort(new DOMException("Close the owned pending input observation", "AbortError"))
      const aborted = recorded.find((entry) => entry.phase === "aborted")
      expect(aborted).toMatchObject({ taskID, activity: { assistantMessageID: processor.message.id, attempt: 0 },
        observation: { phase: "hook" }, pendingToolInputs: { pendingCount: 2, totalUTF16Length: 17,
          observedUTF16Length: 17, trimmedUTF16Length: 15, nonWhitespaceUTF16Length: 15,
          trailingWhitespaceUTF16Length: 2, rootFieldCount: 1, valueTypes: { null: 1 },
          states: { complete_json: 1, syntax_error: 1 }, bookkeepingFailures: 0,
          sourceUTF16Budget: Math.floor(AgentTrace.eventByteBudget() / 2) } })
      release.resolve()
      expect(await running).toBe("stop")
      expect(processor.message.error).toMatchObject({ name: "MessageAbortedError" })
      expect(recorded.find((entry) => entry.phase === "settled")).toMatchObject({ pendingToolInputs: aborted!.pendingToolInputs })
      expect(AgentTrace.readTaskEvents(taskID)).toContainEqual(expect.objectContaining({ kind: "llm_stream_observation",
        payload: expect.objectContaining({ phase: "aborted", pendingToolInputs: aborted!.pendingToolInputs }) }))
    } finally { release.resolve(); await running; stream.mockRestore(); recorder.mockRestore() }
  }, { bindTask: true })
}, 30_000)

test("a throwing diagnostic trace recorder preserves the original successful processor output", async () => {
  await processorFixture(async ({ process, processor }) => {
    const recorder = spyOn(AgentTrace, "recordLLMStreamObservation").mockImplementation(() => { throw new Error("Owned diagnostic writer failed") })
    const stream = spyOn(LLM, "stream").mockImplementation(async () => ({ fullStream: (async function* () {
      yield { type: "start" }
      yield { type: "text-start", id: "answer" }
      yield { type: "text-delta", id: "answer", text: "Original successful output" }
      yield { type: "text-end", id: "answer" }
      yield { type: "finish", finishReason: "stop", totalUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } }
    })() }) as Awaited<ReturnType<typeof LLM.stream>>)
    try {
      expect(await process({})).toBe("continue")
      expect(recorder.mock.calls.length).toBeGreaterThanOrEqual(1)
      expect(await MessageStore.parts(processor.message.id)).toContainEqual(expect.objectContaining({ type: "text", text: "Original successful output" }))
    } finally { stream.mockRestore(); recorder.mockRestore() }
  }, { bindTask: true })
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
