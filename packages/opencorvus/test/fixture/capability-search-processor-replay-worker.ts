import fs from "node:fs/promises"
import { Bus } from "@/bus"
import { Config } from "@/config/config"
import { Instance } from "@/project/instance"
import { Message, Session } from "@/session"
import { LLM } from "@/session/llm"
import { MessageStore } from "@/session/message-store"
import { SessionProcessor } from "@/session/processor"
import { PrimaryAssistantRegistry } from "@/agent/primary-assistant-registry"
import { sessionRuntimeFromNativeAgent } from "@/agent/session-agent-runtime"
import { resolveTestCapabilityTools } from "./capability-occurrence"
import { installDefaultControlPlaneToolLoaders } from "@/tool/control-plane-tool-composition"

const [projectPath, statePath] = process.argv.slice(2)
if (!projectPath || !statePath) throw new Error("usage: worker <project> <state>")
const state = JSON.parse(await fs.readFile(statePath, "utf8")) as {
  sessionID: string
  assistantID: string
  userID: string
  callID: string
  params: Record<string, unknown>
  model: any
}

installDefaultControlPlaneToolLoaders()

await Instance.provide({
  directory: projectPath,
  fn: async () => {
    const config = await Config.get()
    const session = await Session.get(state.sessionID)
    const persistedAssistant = await MessageStore.get({ sessionID: state.sessionID, messageID: state.assistantID })
    const persistedUser = await MessageStore.get({ sessionID: state.sessionID, messageID: state.userID })
    if (persistedUser.info.role !== "user") throw new Error("Replay input is not a user Message.")
    const assistant = Message.Assistant.parse(persistedAssistant.info)
    const runtime = sessionRuntimeFromNativeAgent(await PrimaryAssistantRegistry.get("coding", { config }))
    const processor = SessionProcessor.create({
      assistantMessage: assistant,
      sessionID: session.id,
      model: state.model,
      abort: new AbortController().signal,
      retainAssistantForNextProviderStep: () => true,
    })
    const resolved = await resolveTestCapabilityTools({
      config,
      model: state.model,
      session,
      assistant,
      processor,
      agent: runtime,
      agentID: "coding",
      messages: await Session.messages({ sessionID: session.id }),
    })
    let updates = 0
    const stop = Bus.subscribe(Message.Event.PartUpdated, (event) => {
      const part = event.properties.part
      if (part.type === "tool" && part.callID === state.callID) updates += 1
    })
    const original = LLM.stream
    LLM.stream = (async (input: any) => {
      const search = input.tools.capability_search
      return {
        fullStream: (async function* () {
          yield { type: "start" }
          yield { type: "tool-call", toolCallId: state.callID, toolName: "capability_search", input: state.params }
          const output = await search.execute(state.params, {
            toolCallId: state.callID,
            messages: input.messages,
            abortSignal: input.abort,
          })
          yield { type: "tool-result", toolCallId: state.callID, toolName: "capability_search", input: state.params, output }
          yield { type: "finish-step", finishReason: "tool-calls", usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } }
          yield { type: "finish", finishReason: "tool-calls", totalUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } }
        })(),
      }
    }) as typeof LLM.stream
    try {
      await processor.process({
        user: persistedUser.info,
        agentID: "coding",
        agent: runtime,
        abort: new AbortController().signal,
        sessionID: session.id,
        system: [],
        messages: [],
        tools: resolved.tools,
        model: state.model,
      })
    } finally {
      LLM.stream = original
      stop()
    }
    process.stdout.write(`CAPABILITY_SEARCH_REPLAY=${JSON.stringify({ updates })}\n`)
  },
})
