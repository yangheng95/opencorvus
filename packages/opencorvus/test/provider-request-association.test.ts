import { afterEach, expect, test } from "bun:test"
import { streamText, stepCountIs, tool, jsonSchema } from "ai"
import { Config } from "@/config/config"
import { Provider } from "@/provider/provider"
import { Instance } from "@/project/instance"
import { RealProviderAudit } from "../script/real-provider-audit"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Provider.resetAll()
  await resetMemoryDatabase()
})

const providerID = "request-association"
const modelID = "local-stream-model"
function context(agentID: string, requestID: string) {
  return { sessionID: "session-concurrent", streamRequest: {
    requestID, agentID, providerID, modelID, apiModelID: modelID,
  } }
}

// Real production Provider and bundled SDK, served by controlled local HTTP.
// This proves transport/caller contracts, never actual Provider or UI acceptance.
async function withLocalProvider(run: (fixture: {
  config: Config.Info
  model: Provider.Model
  audit: RealProviderAudit
  accepted: string[]
}) => Promise<void>) {
  const accepted: string[] = []
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
    const body = await request.json() as { model: string; stream: boolean; messages: Array<{ content: string }> }
    expect({ model: body.model, stream: body.stream }).toEqual({ model: modelID, stream: true })
    const prompt = body.messages.at(-1)!.content
    accepted.push(prompt)
    const delta = { id: "local-response", object: "chat.completion.chunk", created: 1, model: modelID,
      choices: [{ index: 0, delta: { content: `reply:${prompt}` }, finish_reason: null }] }
    const stop = { ...delta, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] }
    return new Response(`data: ${JSON.stringify(delta)}\n\ndata: ${JSON.stringify(stop)}\n\ndata: [DONE]\n\n`,
      { headers: { "Content-Type": "text/event-stream" } })
  } })
  try {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const config = Config.Info.parse({ enabled_providers: [providerID], provider: {
        [providerID]: { name: "Request association local HTTP", npm: "@ai-sdk/openai-compatible",
          api: new URL("v1", server.url).href, options: { apiKey: "owned-local-fixture", timeout: false },
          models: { [modelID]: { name: "Local stream", limit: { context: 10000, output: 1000 } } } },
      } })
      const model = await Provider.getModel(providerID, modelID, { config })
      using audit = new RealProviderAudit(modelID, 20)
      await run({ config, model, audit, accepted })
    } })
  } finally { await server.stop(true) }
}

test("concurrent same-model callers retain the actual Session and distinct agent identities", async () => {
  await withLocalProvider(async ({ config, model, audit, accepted }) => {
    const callers = [
      { ...context("worker-a", "request-a"), activity: { id: "activity-a", attempt: 0, assistantMessageID: "assistant-a" } },
      { ...context("worker-b", "request-b"), activity: { id: "activity-b", attempt: 1, assistantMessageID: "assistant-b" } },
    ]
    const languages = await Promise.all(callers.map((requestContext) => Provider.getLanguage(model, { config, requestContext })))
    const values = await Promise.all(languages.map((language, index) => streamText({ model: language,
      prompt: callers[index]!.streamRequest.requestID, maxRetries: 0 }).text))
    expect(values).toEqual(["reply:request-a", "reply:request-b"])
    expect(accepted.toSorted()).toEqual(["request-a", "request-b"])
    expect(audit.requests.map((request) => request.response_reader.requestContext).sort((a, b) =>
      a!.streamRequest.requestID.localeCompare(b!.streamRequest.requestID))).toEqual(callers)
    expect(audit.requests.map((request) => request.response_reader.terminal?.kind)).toEqual(["eof", "eof"])
  })
}, 60_000)

test("delayed SDK use and successive physical responses retain the original copied caller", async () => {
  await withLocalProvider(async ({ config, model, audit, accepted }) => {
    const original = { ...context("delayed-worker", "original-request"),
      activity: { id: "activity-original", attempt: 0, assistantMessageID: "assistant-original" } }
    const expected = structuredClone(original)
    const pendingLanguage = Provider.getLanguage(model, { config, requestContext: original })
    original.sessionID = "mutated-session"
    original.streamRequest.agentID = "mutated-worker"
    original.streamRequest.requestID = "mutated-request"
    original.activity.id = "mutated-activity"
    original.activity.attempt = 9
    original.activity.assistantMessageID = "mutated-assistant"
    const language = await pendingLanguage
    const other = await Provider.getLanguage(model, { config, requestContext: context("other-worker", "other-request") })
    expect(await streamText({ model: other, prompt: "other-first", maxRetries: 0 }).text).toBe("reply:other-first")
    for (const prompt of ["delayed-first", "delayed-second"]) {
      expect(await streamText({ model: language, prompt, maxRetries: 0 }).text).toBe(`reply:${prompt}`)
    }
    expect(accepted).toEqual(["other-first", "delayed-first", "delayed-second"])
    expect(audit.requests.map((request) => request.response_reader.requestContext)).toEqual([
      context("other-worker", "other-request"), expected, expected,
    ])
    expect(audit.requests.map((request) => request.response_reader.terminal?.kind)).toEqual(["eof", "eof", "eof"])
  })
}, 60_000)

test("context-free consumers preserve the production model cache and real streamed output", async () => {
  await withLocalProvider(async ({ config, model, audit }) => {
    const first = await Provider.getLanguage(model, { config })
    const second = await Provider.getLanguage(model, { config })
    expect(second).toBe(first)
    expect(await streamText({ model: first, prompt: "unassociated", maxRetries: 0 }).text).toBe("reply:unassociated")
    expect(audit.requests.map((request) => ({ state: request.response_reader.identityState,
      terminal: request.response_reader.terminal?.kind }))).toEqual([{ state: "unknown", terminal: "eof" }])
  })
}, 60_000)

test("one real SDK multi-step stream binds both HTTP responses to its original caller", async () => {
  const requests: Array<{ messages: Array<{ role: string; content: unknown }> }> = []
  const executions: string[] = []
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
    const body = await request.json() as typeof requests[number]
    requests.push(body)
    const choices = requests.length === 1
      ? [{ index: 0, delta: { tool_calls: [{ index: 0, id: "call-local-lookup", type: "function",
          function: { name: "lookup", arguments: '{"value":"actual-input"}' } }] }, finish_reason: null }]
      : [{ index: 0, delta: { content: "final:actual-tool-result" }, finish_reason: null }]
    const chunk = { id: "local-step", object: "chat.completion.chunk", created: 1, model: modelID, choices }
    const finish = { ...chunk, choices: [{ index: 0, delta: {}, finish_reason: requests.length === 1 ? "tool_calls" : "stop" }] }
    return new Response(`data: ${JSON.stringify(chunk)}\n\ndata: ${JSON.stringify(finish)}\n\ndata: [DONE]\n\n`,
      { headers: { "Content-Type": "text/event-stream" } })
  } })
  try {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const config = Config.Info.parse({ enabled_providers: [providerID], provider: {
        [providerID]: { npm: "@ai-sdk/openai-compatible", api: new URL("v1", server.url).href,
          options: { apiKey: "owned-local-fixture", timeout: false }, models: { [modelID]: { tool_call: true } } },
      } })
      const model = await Provider.getModel(providerID, modelID, { config })
      const caller = { ...context("multi-step-worker", "multi-step-request"),
        activity: { id: "activity-multi-step", attempt: 2, assistantMessageID: "assistant-multi-step" } }
      const language = await Provider.getLanguage(model, { config, requestContext: caller })
      using audit = new RealProviderAudit(modelID, 2)
      const result = streamText({ model: language, prompt: "Perform the actual lookup", maxRetries: 0,
        stopWhen: stepCountIs(2), tools: { lookup: tool({
          inputSchema: jsonSchema<{ value: string }>({ type: "object", properties: { value: { type: "string" } },
            required: ["value"], additionalProperties: false }),
          execute: async ({ value }) => { executions.push(value); return "actual-tool-result" },
        }) } })
      expect(await result.text).toBe("final:actual-tool-result")
      expect(executions).toEqual(["actual-input"])
      expect(requests.map((request) => request.messages.map((message) => message.role))).toEqual([
        ["user"], ["user", "assistant", "tool"],
      ])
      expect(requests[1]!.messages.at(-1)).toMatchObject({ role: "tool", content: "actual-tool-result" })
      const steps = await result.steps
      expect(steps.map((step) => step.finishReason)).toEqual(["tool-calls", "stop"])
      expect(steps[0]!.toolResults[0]).toMatchObject({ toolName: "lookup", output: "actual-tool-result" })
      expect(audit.requests.map((request) => ({ context: request.response_reader.requestContext,
        terminal: request.response_reader.terminal?.kind }))).toEqual([
        { context: caller, terminal: "eof" }, { context: caller, terminal: "eof" },
      ])
    } })
  } finally { await server.stop(true) }
}, 60_000)
