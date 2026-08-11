import { afterEach, describe, expect, spyOn, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { PrimaryAssistantRegistry } from "../src/agent/primary-assistant-registry"
import { sessionRuntimeFromNativeAgent } from "../src/agent/session-agent-runtime"
import { Config } from "../src/config/config"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import type { Provider } from "../src/provider/provider"
import { Session } from "../src/session"
import { LLM } from "../src/session/llm"
import { SessionLoop } from "../src/session/loop"
import { MessageStore } from "../src/session/message-store"
import { SessionProcessor } from "../src/session/processor"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

function providerModel(): Provider.Model {
  return {
    id: "authority-integration-model",
    providerID: "authority-integration-provider",
    name: "Authority Integration Model",
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
    api: { id: "authority-integration", npm: "@ai-sdk/anthropic" },
    options: {},
  } as Provider.Model
}

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("SessionLoop Tool execution authority integration", () => {
  test("persists a provider-driven standalone write result through the real SessionLoop Tool wrapper", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const model = providerModel()
        const config = await Config.get()
        const nativeAgent = await PrimaryAssistantRegistry.get("coding", { config })
        const agent = sessionRuntimeFromNativeAgent(nativeAgent)
        const session = await Session.create({ kind: "assistant", title: "SessionLoop authority integration" })
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "coding",
          time: { created: Date.now() },
          agent: "coding",
          model: { providerID: model.providerID, modelID: model.id },
        })
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: session.id,
          messageID: user.id,
          type: "text",
          text: "Write the provider-owned authority evidence file.",
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
        const tools = await SessionLoop.resolveTools({
          agent,
          agentID: "coding",
          model,
          session,
          processor,
          messages: await Session.messages({ sessionID: session.id }),
          config,
        })
        const evidencePath = path.join(project.path, "session-loop-authority-evidence.txt")
        const toolCallID = "call_session_loop_authority"
        const toolInput = { filePath: evidencePath, content: "session-loop-conversation-authority\n" }
        const streamSpy = spyOn(LLM, "stream").mockImplementation(async (streamInput) => {
          const write = streamInput.tools.write
          if (!write?.execute) throw new Error("SessionLoop did not project the write Tool")
          return {
            fullStream: (async function* () {
              yield { type: "start" }
              yield { type: "tool-call", toolCallId: toolCallID, toolName: "write", input: toolInput }
              const output = await write.execute(toolInput, {
                toolCallId: toolCallID,
                messages: streamInput.messages,
                abortSignal: streamInput.abort,
              })
              yield { type: "tool-result", toolCallId: toolCallID, toolName: "write", input: toolInput, output }
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
          await processor.process({
            user,
            agentID: "coding",
            agent,
            abort,
            sessionID: session.id,
            system: [],
            messages: [],
            tools,
            model,
          })
        } finally {
          streamSpy.mockRestore()
        }

        const persisted = await MessageStore.get({ sessionID: session.id, messageID: assistant.id })
        const toolPart = persisted.parts.find((part) => part.type === "tool" && part.callID === toolCallID)
        expect({
          file: await fs.readFile(evidencePath, "utf8"),
          tool: toolPart,
          assistant: persisted.info,
        }).toMatchObject({
          file: "session-loop-conversation-authority\n",
          tool: {
            type: "tool",
            tool: "write",
            callID: toolCallID,
            state: {
              status: "completed",
              input: toolInput,
              output: expect.stringContaining("Wrote file successfully"),
            },
          },
          assistant: {
            finish: "stop",
            tokens: { total: 2, input: 1, output: 1 },
          },
        })
      },
    })
  }, 30_000)
})
