import { afterEach, expect, spyOn, test } from "bun:test"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { LLM } from "@/session/llm"
import { Message } from "@/session/message"
import { MessageStore } from "@/session/message-store"
import { SessionProcessor } from "@/session/processor"
import { Identifier } from "@/id/id"
import type { Provider } from "@/provider/provider"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

const model = {
  id: "task-root-multistep",
  providerID: "test",
  name: "Task-root multi-step assistant",
  limit: { context: 100_000, input: 90_000, output: 4_096 },
  cost: { available: true, input: 0, output: 0, cache: { read: 0, write: 0 } },
  capabilities: {
    toolcall: true,
    attachment: false,
    reasoning: false,
    temperature: true,
    interleaved: false,
    input: { text: true, image: false, audio: false, video: false, pdf: false },
    output: { text: true, image: false, audio: false, video: false, pdf: false },
  },
  api: { id: "task-root-multistep", url: "https://task-root-multistep.test.invalid", npm: "@ai-sdk/openai" },
  options: {},
  headers: {},
  status: "active",
  release_date: "2026-08-15",
} as Provider.Model

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test("one activation completes one assistant Turn containing every streamed Provider step", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "assistant", title: "Task-root multi-step assistant" })
      const user = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: session.id,
        role: "user",
        author: "orchestrator",
        time: { created: Date.now() },
        agent: "orchestrator",
        model: { providerID: model.providerID, modelID: model.id },
      })
      const assistant = await Session.updateMessage({
        id: Identifier.ascending("message"),
        parentID: user.id,
        sessionID: session.id,
        role: "assistant",
        author: "orchestrator",
        agent: "orchestrator",
        path: { cwd: project.path, root: project.path },
        cost: 0,
        tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
        modelID: model.id,
        providerID: model.providerID,
        time: { created: Date.now() },
      })
      let providerStep = 0
      const stream = spyOn(LLM, "stream").mockImplementation(async () => {
        providerStep += 1
        if (providerStep === 1) {
          return {
            fullStream: (async function* () {
              yield { type: "start" }
              yield { type: "tool-call", toolCallId: "call_catalog", toolName: "artifact_search", input: {} }
              yield {
                type: "tool-result",
                toolCallId: "call_catalog",
                toolName: "artifact_search",
                input: {},
                output: { output: "catalog ready", title: "Artifact catalog", metadata: {} },
              }
              yield {
                type: "finish-step",
                finishReason: "tool-calls",
                usage: { inputTokens: 2, outputTokens: 1, totalTokens: 3 },
              }
              yield {
                type: "finish",
                finishReason: "tool-calls",
                totalUsage: { inputTokens: 2, outputTokens: 1, totalTokens: 3 },
              }
            })(),
          } as Awaited<ReturnType<typeof LLM.stream>>
        }
        return {
          fullStream: (async function* () {
            yield { type: "start" }
            yield { type: "text-start", id: "final" }
            yield { type: "text-delta", id: "final", text: "Ready for the scheduling decision." }
            yield { type: "text-end", id: "final" }
            yield {
              type: "finish-step",
              finishReason: "stop",
              usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
            }
            yield {
              type: "finish",
              finishReason: "stop",
              totalUsage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
            }
          })(),
        } as Awaited<ReturnType<typeof LLM.stream>>
      })
      const abort = new AbortController().signal
      const process = async (message: Message.Assistant) =>
        await SessionProcessor.create({
          assistantMessage: message,
          sessionID: session.id,
          model,
          abort,
          retainAssistantOnToolContinuation: true,
        }).process({
          user,
          agentID: "orchestrator",
          agent: { name: "orchestrator", mode: "primary", permission: [], options: {} } as any,
          abort,
          sessionID: session.id,
          system: [],
          messages: [],
          tools: {},
          model,
        })
      try {
        expect(await process(assistant)).toBe("continue")
        const continuing = await MessageStore.get({ sessionID: session.id, messageID: assistant.id })
        if (continuing.info.role !== "assistant") throw new Error("Expected the activation-owned assistant Message")
        expect(await process(continuing.info)).toBe("continue")
      } finally {
        stream.mockRestore()
      }

      const persisted = await MessageStore.get({ sessionID: session.id, messageID: assistant.id })
      expect({
        providerSteps: providerStep,
        assistant: persisted.info,
        parts: persisted.parts.map((part) =>
          part.type === "tool"
            ? { type: part.type, callID: part.callID, status: part.state.status, output: part.state.output }
            : part.type === "text"
              ? { type: part.type, text: part.text }
              : part.type === "step-finish"
                ? { type: part.type, reason: part.reason, total: part.tokens.total }
                : { type: part.type },
        ),
      }).toMatchObject({
        providerSteps: 2,
        assistant: {
          id: assistant.id,
          finish: "stop",
          time: { completed: expect.any(Number) },
          tokens: { input: 5, output: 3, total: 8 },
        },
        parts: [
          { type: "tool", callID: "call_catalog", status: "completed", output: "catalog ready" },
          { type: "step-finish", reason: "tool-calls", total: 3 },
          { type: "text", text: "Ready for the scheduling decision." },
          { type: "step-finish", reason: "stop", total: 5 },
        ],
      })
    },
  })
})
