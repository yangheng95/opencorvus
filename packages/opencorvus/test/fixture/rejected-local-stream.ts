import { expect, spyOn } from "bun:test"
import { createOpenAI } from "@ai-sdk/openai"
import { Auth } from "@/auth"
import { Bus } from "@/bus"
import { Config } from "@/config/config"
import { HelperAgentRegistry } from "@/agent/helper-agent-registry"
import { HostAgentRegistry } from "@/agent/host-agent-registry"
import { PrimaryAssistantRegistry } from "@/agent/primary-assistant-registry"
import { sessionRuntimeFromNativeAgent } from "@/agent/session-agent-runtime"
import { Provider } from "@/provider/provider"
import { LLM } from "@/session/llm"
import { Session } from "@/session"

export async function rejectLocalStream(input: {
  sessionID: string
  agentID: string
  requestID: string
  model: Provider.Model
}) {
  let requests = 0
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      await request.json()
      requests += 1
      return Response.json(
        { error: { message: `${input.agentID} local rejection`, type: "invalid_request_error" } },
        { status: 400 },
      )
    },
  })
  const delivered = Promise.withResolvers<void>()
  const unsubscribe = Bus.subscribe(Session.Event.Error, (event) => {
    if (
      event.properties.sessionID === input.sessionID &&
      event.properties.error?.data?.message === `${input.agentID} local rejection`
    )
      delivered.resolve()
  })
  const timer = setTimeout(() => delivered.reject(new Error("Local stream error delivery timed out")), 15000)
  try {
    const config = await Config.get()
    const agent =
      input.agentID === "orchestrator"
        ? await HostAgentRegistry.get("orchestrator", { config })
        : input.agentID === "coding"
          ? await PrimaryAssistantRegistry.get("coding", { config })
          : await HelperAgentRegistry.get(input.agentID as "memory" | "title", { config })
    const model = {
      ...input.model,
      api: { id: "local-wire-model", npm: "@ai-sdk/openai", url: `http://127.0.0.1:${server.port}/v1` },
    }
    const client = createOpenAI({ apiKey: "local-fixture-only", baseURL: model.api.url })
    using language = spyOn(Provider, "getLanguage").mockResolvedValue(client.chat(model.api.id))
    using provider = spyOn(Provider, "getProvider").mockResolvedValue({
      id: model.providerID,
      name: "Local",
      source: "custom",
      env: [],
      options: {},
      models: { [model.id]: model },
    } as never)
    using auth = spyOn(Auth, "get").mockResolvedValue({ type: "api", key: "local-fixture-only" })
    const result = await LLM.stream({
      requestID: input.requestID,
      sessionID: input.sessionID,
      config,
      model,
      agentID: input.agentID,
      agent: sessionRuntimeFromNativeAgent(agent),
      system: [],
      abort: new AbortController().signal,
      messages: [{ role: "user", content: "Local request attribution check" }],
      small: true,
      tools: {},
      retries: 0,
    })
    for await (const chunk of result.fullStream) {
      /* Consume the actual rejected stream. */
    }
    await delivered.promise
    expect(requests).toBe(1)
  } finally {
    clearTimeout(timer)
    unsubscribe()
    server.stop(true)
  }
}
