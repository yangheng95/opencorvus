import { afterEach, expect, spyOn, test } from "bun:test"
import { Config } from "../../src/config/config"
import { Instance } from "../../src/project/instance"
import { Provider } from "../../src/provider/provider"
import type { Provider as ProviderType } from "../../src/provider/provider"
import { Session } from "../../src/session"
import { LLM } from "../../src/session/llm"
import { SessionPrompt } from "../../src/session/prompt"
import { normalizedProviderToolDefinition } from "../../src/capability/reveal-owner"
import {
  CAPABILITY_REVEAL_MAX_ACTIVE_CHARS,
  capabilityRevealBaseDefinitions,
} from "../../src/capability/reveal-receipt"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

const model: ProviderType.Model = {
  id: "structured-base-budget",
  providerID: "structured-base-budget",
  name: "Structured base budget",
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
  api: { id: "structured-base-budget", npm: "@ai-sdk/anthropic" },
  options: {},
} as ProviderType.Model

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test("a real structured turn admits StructuredOutput into the immutable revision-zero budget", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      await Config.get()
      const session = await Session.create({ kind: "assistant", title: "Structured base budget" })
      const provider = spyOn(Provider, "getModel").mockResolvedValue(model)
      let observedBaseChars = 0
      const stream = spyOn(LLM, "stream").mockImplementation(async (input) => {
        const names = Object.keys(input.tools).sort()
        if (!names.includes("StructuredOutput")) {
          return {
            fullStream: (async function* () {
              yield { type: "start" }
              yield {
                type: "finish-step",
                finishReason: "stop",
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              }
              yield {
                type: "finish",
                finishReason: "stop",
                totalUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              }
            })(),
          } as Awaited<ReturnType<typeof LLM.stream>>
        }
        expect(names).toEqual(["StructuredOutput", "capability_search"])
        const structured = input.tools.StructuredOutput!
        const search = input.tools.capability_search!
        observedBaseChars = capabilityRevealBaseDefinitions([
          normalizedProviderToolDefinition("capability_search", search),
          normalizedProviderToolDefinition("StructuredOutput", structured),
        ]).payloadChars
        if (!structured.execute) throw new Error("StructuredOutput is not executable.")
        const args = { answer: "ok" }
        return {
          fullStream: (async function* () {
            yield { type: "start" }
            yield { type: "tool-call", toolCallId: "call_structured_output", toolName: "StructuredOutput", input: args }
            const output = await structured.execute!(args, {
              toolCallId: "call_structured_output",
              messages: input.messages,
              abortSignal: input.abort,
            })
            yield {
              type: "tool-result",
              toolCallId: "call_structured_output",
              toolName: "StructuredOutput",
              input: args,
              output,
            }
            yield {
              type: "finish-step",
              finishReason: "stop",
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            }
            yield {
              type: "finish",
              finishReason: "stop",
              totalUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            }
          })(),
        } as Awaited<ReturnType<typeof LLM.stream>>
      })
      try {
        const assistant = await SessionPrompt.prompt({
          sessionID: session.id,
          author: "user",
          agent: "coding",
          model: { providerID: model.providerID, modelID: model.id },
          format: {
            type: "json_schema",
            schema: {
              type: "object",
              properties: { answer: { type: "string" } },
              required: ["answer"],
              additionalProperties: false,
            },
            retryCount: 0,
          },
          parts: [{ type: "text", text: "Return a structured answer." }],
        })
        await SessionPrompt.waitForFinish(session.id, project.path)
        expect(assistant.info.structured).toEqual({ answer: "ok" })
        expect(observedBaseChars).toBeGreaterThan(0)
        expect(observedBaseChars).toBeLessThanOrEqual(CAPABILITY_REVEAL_MAX_ACTIVE_CHARS)
      } finally {
        stream.mockRestore()
        provider.mockRestore()
      }
    },
  })
}, 30_000)
