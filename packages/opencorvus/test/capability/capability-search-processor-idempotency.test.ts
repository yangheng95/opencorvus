import { afterEach, describe, expect, spyOn, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Bus } from "../../src/bus"
import { Config } from "../../src/config/config"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import type { Provider } from "../../src/provider/provider"
import { Message, Session } from "../../src/session"
import { LLM } from "../../src/session/llm"
import { SessionProcessor } from "../../src/session/processor"
import { PrimaryAssistantRegistry } from "../../src/agent/primary-assistant-registry"
import { sessionRuntimeFromNativeAgent } from "../../src/agent/session-agent-runtime"
import { CAPABILITY_REVEAL_RECEIPT_METADATA_KEY } from "../../src/capability/reveal-receipt"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import { resolveTestCapabilityTools } from "../fixture/capability-occurrence"

const model: Provider.Model = {
  id: "capability-search-processor",
  providerID: "capability-search-test",
  name: "Capability search processor",
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
  api: { id: "capability-search-processor", npm: "@ai-sdk/anthropic" },
  options: {},
} as Provider.Model

function assistant(sessionID: string, parentID: string): Message.Assistant {
  return Message.Assistant.parse({
    id: Identifier.ascending("message"),
    parentID,
    sessionID,
    role: "assistant",
    author: "coding",
    agent: "coding",
    path: { cwd: Instance.directory, root: Instance.worktree },
    cost: 0,
    tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    modelID: model.id,
    providerID: model.providerID,
    time: { created: Date.now() },
  })
}

async function processSearch(input: {
  processor: SessionProcessor.Info
  user: Message.User
  agent: ReturnType<typeof sessionRuntimeFromNativeAgent>
  sessionID: string
  tools: Record<string, import("ai").Tool>
  calls: readonly { callID: string; params: Record<string, unknown> }[]
}) {
  const stream = spyOn(LLM, "stream").mockImplementation(async (streamInput) => {
    const search = streamInput.tools.capability_search
    if (!search?.execute) throw new Error("Processor test has no capability_search Tool.")
    return {
      fullStream: (async function* () {
        yield { type: "start" }
        for (const call of input.calls) {
          yield { type: "tool-call", toolCallId: call.callID, toolName: "capability_search", input: call.params }
          const output = await search.execute(call.params, {
            toolCallId: call.callID,
            messages: streamInput.messages,
            abortSignal: streamInput.abort,
          })
          yield {
            type: "tool-result",
            toolCallId: call.callID,
            toolName: "capability_search",
            input: call.params,
            output,
          }
        }
        yield {
          type: "finish-step",
          finishReason: "tool-calls",
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        }
        yield {
          type: "finish",
          finishReason: "tool-calls",
          totalUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        }
      })(),
    } as Awaited<ReturnType<typeof LLM.stream>>
  })
  try {
    await input.processor.process({
      user: input.user,
      agentID: "coding",
      agent: input.agent,
      abort: new AbortController().signal,
      sessionID: input.sessionID,
      system: [],
      messages: [],
      tools: input.tools,
      model,
    })
  } finally {
    stream.mockRestore()
  }
}

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("capability_search Processor completion ownership", () => {
  test("keeps CAS completion append-only when revision one is replayed after revision two", async () => {
    await using project = await memoryProject()
    const statePath = path.join(project.path, "capability-search-processor-replay.json")
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const config = await Config.get()
        const runtime = sessionRuntimeFromNativeAgent(await PrimaryAssistantRegistry.get("coding", { config }))
        const session = await Session.create({ kind: "assistant", title: "Capability search processor replay" })
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "user",
          agent: "coding",
          time: { created: Date.now() },
          model: { providerID: model.providerID, modelID: model.id },
        })
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: session.id,
          messageID: user.id,
          type: "text",
          text: "Reveal and then deactivate read.",
          kind: "user_content",
        })
        const firstAssistant = assistant(session.id, user.id)
        const firstProcessor = SessionProcessor.create({
          assistantMessage: firstAssistant,
          sessionID: session.id,
          model,
          abort: new AbortController().signal,
          retainAssistantOnToolContinuation: true,
          retainAssistantForNextProviderStep: () => true,
        })
        const firstResolved = await resolveTestCapabilityTools({
          config,
          model,
          session,
          assistant: firstAssistant,
          processor: firstProcessor,
          agent: runtime,
          agentID: "coding",
          messages: await Session.messages({ sessionID: session.id }),
        })
        const readRef = firstResolved.occurrence.ref("read")
        const firstParams = { queries: ["read"], exact_refs: [readRef], deactivate_refs: [], limit: 5 }
        const callID = "call_processor_reveal_revision_one"
        const states: string[] = []
        const stop = Bus.subscribe(Message.Event.PartUpdated, (event) => {
          const part = event.properties.part
          if (part.type === "tool" && part.callID === callID) states.push(part.state.status)
        })
        await processSearch({
          processor: firstProcessor,
          user,
          agent: runtime,
          sessionID: session.id,
          tools: firstResolved.tools,
          calls: [{ callID, params: firstParams }],
        })
        expect(states).toEqual(["running", "completed"])
        expect(firstProcessor.message.time.completed).toBeUndefined()
        await processSearch({
          processor: firstProcessor,
          user,
          agent: runtime,
          sessionID: session.id,
          tools: firstResolved.tools,
          calls: [
            {
              callID: "call_processor_reveal_revision_two",
              params: { queries: [""], exact_refs: [], deactivate_refs: [readRef], limit: 5 },
            },
          ],
        })
        await processSearch({
          processor: firstProcessor,
          user,
          agent: runtime,
          sessionID: session.id,
          tools: firstResolved.tools,
          calls: [{ callID, params: firstParams }],
        })
        expect(states).toEqual(["running", "completed"])
        stop()
        const parts = (await Session.messages({ sessionID: session.id })).flatMap((message) => message.parts)
        const receipts = parts.flatMap((part) =>
          part.type === "tool" &&
          part.tool === "capability_search" &&
          part.state.status === "completed" &&
          part.state.metadata[CAPABILITY_REVEAL_RECEIPT_METADATA_KEY]
            ? [part.state.metadata[CAPABILITY_REVEAL_RECEIPT_METADATA_KEY] as { revision: number }]
            : [],
        )
        expect(receipts.map((receipt) => receipt.revision).sort()).toEqual([1, 2])
        await fs.writeFile(
          statePath,
          JSON.stringify({
            sessionID: session.id,
            assistantID: firstAssistant.id,
            userID: user.id,
            callID,
            params: firstParams,
            model,
          }),
        )
      },
    })
    await Instance.disposeAll()
    const child = Bun.spawn(
      [process.execPath, "test/fixture/capability-search-processor-replay-worker.ts", project.path, statePath],
      {
        cwd: path.resolve(import.meta.dir, "../.."),
        env: { ...process.env },
        stdout: "pipe",
        stderr: "pipe",
      },
    )
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    expect(exitCode, stderr).toBe(0)
    const marker = stdout.split(/\r?\n/).find((line) => line.startsWith("CAPABILITY_SEARCH_REPLAY="))
    if (!marker) throw new Error(`Cross-process replay returned no marker: ${stdout}`)
    expect(JSON.parse(marker.slice("CAPABILITY_SEARCH_REPLAY=".length))).toEqual({ updates: 0 })
  }, 60_000)
})
