import { afterEach, expect, spyOn, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Config } from "../../src/config/config"
import { Instance } from "../../src/project/instance"
import { Provider } from "../../src/provider/provider"
import type { Provider as ProviderType } from "../../src/provider/provider"
import { Session } from "../../src/session"
import { LLM } from "../../src/session/llm"
import { SessionPrompt } from "../../src/session/prompt"
import { normalizedProviderToolDefinition } from "../../src/capability/reveal-owner"
import { capabilityRevealBaseDefinitions } from "../../src/capability/reveal-receipt"
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
            stream: (async function* () {
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
        expect(names).toEqual(expect.arrayContaining(["StructuredOutput", "capability_search", "read", "bash"]))
        expect(input.system.join("\n")).toContain("- read: Read project files and exact file ranges.")
        const structured = input.tools.StructuredOutput!
        observedBaseChars = capabilityRevealBaseDefinitions(
          Object.entries(input.tools).map(([name, tool]) => normalizedProviderToolDefinition(name, tool)),
        ).payloadChars
        if (!structured.execute) throw new Error("StructuredOutput is not executable.")
        const args = { answer: "ok" }
        return {
          stream: (async function* () {
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
              $id: "https://schemas.example.test/structured-answer.json",
              $defs: { answer: { type: "string" } },
              type: "object",
              properties: { answer: { $ref: "#/$defs/answer" } },
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
      } finally {
        stream.mockRestore()
        provider.mockRestore()
      }
    },
  })
}, 30_000)

test("a streamed Conversation reads its project file directly on the first model step", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      await Config.get()
      const filePath = path.join(project.path, "routine.txt")
      await fs.writeFile(filePath, "routine-first-step-evidence\n")
      const session = await Session.create({ kind: "assistant", title: "Routine first step" })
      const provider = spyOn(Provider, "getModel").mockResolvedValue(model)
      const observed: string[] = []
      const stream = spyOn(LLM, "stream").mockImplementation(async (input) => {
        const read = input.tools.read
        const executeRead = observed.length === 0 && read?.execute
        if (executeRead)
          expect(input.system.join("\n")).toContain("Use them directly; do not search for or reveal them first.")
        return {
          stream: (async function* () {
            yield { type: "start" }
            if (executeRead) {
              const args = { filePath }
              yield { type: "tool-call", toolCallId: "call_routine_read", toolName: "read", input: args }
              const output = await read.execute!(args, {
                toolCallId: "call_routine_read",
                messages: [],
                abortSignal: new AbortController().signal,
              })
              observed.push(JSON.stringify(output))
              yield { type: "tool-result", toolCallId: "call_routine_read", toolName: "read", input: args, output }
            } else {
              yield { type: "text-start", id: "routine-final" }
              yield { type: "text-delta", id: "routine-final", text: "Project file inspected." }
              yield { type: "text-end", id: "routine-final" }
            }
            const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 }
            const finishReason = executeRead ? "tool-calls" : "stop"
            yield { type: "finish-step", finishReason, usage }
            yield { type: "finish", finishReason, totalUsage: usage }
          })(),
        } as Awaited<ReturnType<typeof LLM.stream>>
      })
      try {
        const reply = await SessionPrompt.prompt({
          sessionID: session.id,
          author: "user",
          agent: "coding",
          model: { providerID: model.providerID, modelID: model.id },
          parts: [{ type: "text", text: "Read routine.txt and report what it contains." }],
        })
        expect(reply.info.role === "assistant" ? reply.info.finish : undefined).toBe("stop")
        expect(observed).toHaveLength(1)
        expect(observed[0]).toContain("routine-first-step-evidence")
        const parts = (await Session.messages({ sessionID: session.id })).flatMap((message) => message.parts)
        expect(
          parts.filter((part) => part.type === "tool").map((part) => ({ tool: part.tool, status: part.state.status })),
        ).toEqual([{ tool: "read", status: "completed" }])
      } finally {
        stream.mockRestore()
        provider.mockRestore()
      }
    },
  })
}, 30_000)
