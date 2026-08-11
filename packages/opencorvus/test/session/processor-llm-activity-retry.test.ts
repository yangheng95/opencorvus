import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { Bus } from "../../src/bus"
import { GlobalBus } from "../../src/bus/global"
import { sessionRuntimeFromNativeAgent } from "../../src/agent/session-agent-runtime"
import { PrimaryAssistantRegistry } from "../../src/agent/primary-assistant-registry"
import { Config } from "../../src/config/config"
import { EngineConfig } from "../../src/engine/config"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import type { Provider } from "../../src/provider/provider"
import { Session } from "../../src/session"
import { LLM } from "../../src/session/llm"
import { MessageStore } from "../../src/session/message-store"
import { Message } from "../../src/session/message"
import { SessionProcessor } from "../../src/session/processor"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

function providerModel(): Provider.Model {
  return {
    id: "processor-activity-model",
    providerID: "processor-activity-provider",
    name: "Processor Activity Model",
    limit: { context: 1_000_000, input: 900_000, output: 4_096 },
    cost: { available: true, input: 0, output: 0, cache: { read: 0, write: 0 } },
    capabilities: {
      toolcall: true,
      attachment: false,
      reasoning: false,
      temperature: true,
      input: { text: true, image: false, audio: false, video: false },
      output: { text: true, image: false, audio: false, video: false },
    },
    api: { id: "processor-activity", npm: "@ai-sdk/anthropic" },
    options: {},
  } as Provider.Model
}

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("SessionProcessor semantic LLM activity retry", () => {
  test("removes an abandoned tool-input draft before the recovered attempt is persisted", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const model = providerModel()
        const config = await Config.get()
        const nativeAgent = await PrimaryAssistantRegistry.get("coding", { config })
        const agent = sessionRuntimeFromNativeAgent(nativeAgent)
        const session = await Session.create({ kind: "assistant", title: "Processor semantic retry" })
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "coding",
          time: { created: Date.now() },
          agent: "coding",
          model: { providerID: model.providerID, modelID: model.id },
        })
        const assistant = await Session.updateMessage({
          id: Identifier.ascending("message"),
          parentID: user.id,
          sessionID: session.id,
          role: "assistant",
          author: "coding",
          agent: "coding",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          modelID: model.id,
          providerID: model.providerID,
          time: { created: Date.now() },
        })
        const abort = new AbortController().signal
        const processor = SessionProcessor.create({ assistantMessage: assistant, sessionID: session.id, model, abort })
        const idleSpy = spyOn(EngineConfig, "get").mockResolvedValue({
          ...EngineConfig.defaults,
          activity: { ...EngineConfig.defaults.activity, session_llm_idle_ms: 250 },
        })
        let attempts = 0
        const streamSpy = spyOn(LLM, "stream").mockImplementation(async (streamInput) => {
          attempts += 1
          if (attempts === 1) {
            return {
              fullStream: (async function* () {
                yield { type: "start" }
                yield { type: "tool-input-start", id: "call_abandoned", toolName: "write" }
                while (!streamInput.abort.aborted) {
                  await new Promise((resolve) => setTimeout(resolve, 5))
                  yield { type: "tool-input-delta", id: "call_abandoned", delta: "" }
                }
              })(),
            } as Awaited<ReturnType<typeof LLM.stream>>
          }
          return {
            fullStream: (async function* () {
              yield { type: "start" }
              yield { type: "text-start", id: "recovered" }
              yield { type: "text-delta", id: "recovered", text: "Recovered after semantic idle." }
              yield { type: "text-end", id: "recovered" }
              yield {
                type: "finish-step",
                finishReason: "stop",
                usage: { inputTokens: 1, outputTokens: 5, totalTokens: 6 },
              }
              yield {
                type: "finish",
                finishReason: "stop",
                totalUsage: { inputTokens: 1, outputTokens: 5, totalTokens: 6 },
              }
            })(),
          } as Awaited<ReturnType<typeof LLM.stream>>
        })

        try {
          await processor.process({
            user,
            agentID: "coding",
            agent,
            abort,
            sessionID: session.id,
            system: [],
            messages: [],
            tools: {},
            model,
          })
        } finally {
          streamSpy.mockRestore()
          idleSpy.mockRestore()
        }

        const persisted = await MessageStore.get({ sessionID: session.id, messageID: assistant.id })
        expect({
          attempts,
          info: persisted.info,
          parts: persisted.parts.map((part) =>
            part.type === "text"
              ? { type: part.type, text: part.text }
              : part.type === "step-finish"
                ? { type: part.type, reason: part.reason, tokens: part.tokens }
                : { type: part.type },
          ),
        }).toMatchObject({
          attempts: 2,
          info: { finish: "stop", tokens: { total: 6, input: 1, output: 5 } },
          parts: [
            { type: "text", text: "Recovered after semantic idle." },
            { type: "step-finish", reason: "stop", tokens: { total: 6, input: 1, output: 5 } },
          ],
        })
      },
    })
  }, 30_000)

  test("an aborted reasoning stream settles its delayed delta publication and durable reasoning part", async () => {
    await using project = await memoryProject()
    const globalEvents: Array<{ directory?: string; payload: { type?: string; properties?: unknown } }> = []
    const onGlobalEvent = (event: { directory?: string; payload: { type?: string; properties?: unknown } }) =>
      globalEvents.push(event)
    GlobalBus.on("event", onGlobalEvent)
    let unsubscribe = () => undefined
    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const model = providerModel()
          const config = await Config.get()
          const nativeAgent = await PrimaryAssistantRegistry.get("coding", { config })
          const agent = sessionRuntimeFromNativeAgent(nativeAgent)
          const session = await Session.create({ kind: "assistant", title: "Processor reasoning abort" })
          const user = await Session.updateMessage({
            id: Identifier.ascending("message"),
            sessionID: session.id,
            role: "user",
            author: "coding",
            time: { created: Date.now() },
            agent: "coding",
            model: { providerID: model.providerID, modelID: model.id },
          })
          const assistant = await Session.updateMessage({
            id: Identifier.ascending("message"),
            parentID: user.id,
            sessionID: session.id,
            role: "assistant",
            author: "coding",
            agent: "coding",
            path: { cwd: project.path, root: project.path },
            cost: 0,
            tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
            modelID: model.id,
            providerID: model.providerID,
            time: { created: Date.now() },
          })
          const abortController = new AbortController()
          const processor = SessionProcessor.create({
            assistantMessage: assistant,
            sessionID: session.id,
            model,
            abort: abortController.signal,
          })
          const observedDeltas: Array<{
            sessionID: string
            messageID: string
            partID: string
            field: string
            delta: string
          }> = []
          unsubscribe = Bus.subscribe(Message.Event.PartDelta, async (event) => {
            await new Promise((resolve) => setTimeout(resolve, 25))
            await Session.get(event.properties.sessionID)
            observedDeltas.push(event.properties)
          })
          const streamSpy = spyOn(LLM, "stream").mockImplementation(
            async () =>
              ({
                fullStream: (async function* () {
                  yield { type: "start" }
                  yield { type: "reasoning-start", id: "reasoning-abort" }
                  setTimeout(
                    () => abortController.abort(new DOMException("controlled reasoning abort", "AbortError")),
                    20,
                  )
                  yield {
                    type: "reasoning-delta",
                    id: "reasoning-abort",
                    text: "Bounded reasoning before abort.",
                  }
                  await new Promise((resolve) => setTimeout(resolve, 1_000))
                })(),
              }) as Awaited<ReturnType<typeof LLM.stream>>,
          )

          let processResult: string
          try {
            processResult = await processor.process({
              user,
              agentID: "coding",
              agent,
              abort: abortController.signal,
              sessionID: session.id,
              system: [],
              messages: [],
              tools: {},
              model,
            })
          } finally {
            streamSpy.mockRestore()
          }

          const persisted = await MessageStore.get({ sessionID: session.id, messageID: assistant.id })
          const reasoning = persisted.parts.find((part) => part.type === "reasoning")
          expect(processResult).toBe("stop")
          expect(persisted.info).toMatchObject({ finish: "error", error: { name: "MessageAbortedError" } })
          expect(reasoning).toMatchObject({
            type: "reasoning",
            text: "Bounded reasoning before abort.",
            time: { start: expect.any(Number), end: expect.any(Number) },
          })
          expect(observedDeltas).toEqual([
            {
              sessionID: session.id,
              messageID: assistant.id,
              partID: reasoning?.id,
              field: "text",
              delta: "Bounded reasoning before abort.",
            },
          ])
          expect(
            globalEvents
              .filter((event) => event.payload.type === Message.Event.PartDelta.type)
              .map((event) => event.directory),
          ).toEqual([project.path])
        },
      })
    } finally {
      unsubscribe()
      GlobalBus.off("event", onGlobalEvent)
    }
  }, 30_000)
})
