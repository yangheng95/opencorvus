import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import {
  AgentSideConnection,
  ClientSideConnection,
  ndJsonStream,
  PROTOCOL_VERSION,
  type Client,
} from "@agentclientprotocol/sdk"
import { createOpenCorvusClient } from "@opencorvus-ai/sdk"
import { createFireworks } from "ai-gateway-provider/providers/fireworks"
import { Config } from "@/config/config"
import { ACP } from "@/acp/agent"
import { ComputerMCPBuiltin } from "@/mcp/computer/builtin"
import { BrowserMCPBuiltin } from "@/mcp/browser/builtin"
import { ConfigPaths } from "@/config/paths"
import { Provider } from "@/provider/provider"
import { ProviderLLM } from "@/provider/llm"
import { streamText } from "@/llm/api"
import { Server } from "@/server/server"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Provider.resetAll()
  await resetMemoryDatabase()
})

// Production loaders, Gateway SDK helper and HTTP/ACP transports against owned local participants.
// This contract does not claim external Provider credentials or UI acceptance.
test.each([
  { npm: "@ai-sdk/togetherai", modelID: "exact-upgraded-model", apiModelID: "exact-upgraded-model" },
  { npm: "@ai-sdk/github-copilot", modelID: "exact-upgraded-model", apiModelID: "exact-upgraded-model" },
  { npm: "venice-ai-sdk-provider", modelID: "exact-upgraded-model", apiModelID: "exact-upgraded-model" },
  { npm: "gitlab-ai-provider", modelID: "duo-chat-gpt-5-1", apiModelID: "gpt-5.1-2025-11-13" },
  {
    npm: "ai-gateway-provider/providers/fireworks",
    modelID: "exact-upgraded-model",
    apiModelID: "exact-upgraded-model",
  },
])(
  "$npm streams the configured model and its declared input contract",
  async ({ npm, modelID, apiModelID }) => {
    // Both GitLab 6.9.3 and 6.20.1 serialize this route as text-only.
    const media = npm !== "gitlab-ai-provider"
    const userText = media ? "Inspect this image" : "Inspect this upgrade"
    const requests: Record<string, any>[] = []
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        if (new URL(request.url).pathname.endsWith("/direct_access")) {
          return Response.json({ headers: {}, token: "owned-local-participant" })
        }
        const body = (await request.json()) as Record<string, any>
        requests.push(body)
        const delta = {
          id: "dependabot-stream",
          object: "chat.completion.chunk",
          created: 1,
          model: body.model,
          choices: [{ index: 0, delta: { content: "upgraded stream" }, finish_reason: null }],
        }
        const stop = {
          ...delta,
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
          usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
        }
        return new Response(`data: ${JSON.stringify(delta)}\n\ndata: ${JSON.stringify(stop)}\n\ndata: [DONE]\n\n`, {
          headers: { "Content-Type": "text/event-stream" },
        })
      },
    })
    try {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const config = Config.Info.parse({
            enabled_providers: ["dependabot-local"],
            provider: {
              "dependabot-local": {
                npm,
                api: new URL("v1", server.url).href,
                options: {
                  apiKey: "owned-local-participant",
                  timeout: false,
                  ...(npm === "gitlab-ai-provider"
                    ? { instanceUrl: server.url.origin, aiGatewayUrl: server.url.origin }
                    : {}),
                },
                models: {
                  [modelID]: {
                    name: "Owned local model",
                    modalities: { input: media ? ["text", "image"] : ["text"], output: ["text"] },
                    limit: { context: 10000, output: 1000 },
                  },
                },
              },
            },
          })
          const model = await Provider.getModel("dependabot-local", modelID, { config })
          const language =
            npm === "ai-gateway-provider/providers/fireworks"
              ? createFireworks({
                  baseURL: new URL("v1", server.url).href,
                  apiKey: "owned-local-participant",
                }).languageModel(modelID)
              : await Provider.getLanguage(model, { config })
          const result = streamText({
            model: ProviderLLM.wrapModel(language, model, {}),
            timeoutMs: false,
            instructions: "Preserve this instruction",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: userText },
                  ...(media
                    ? [
                        {
                          type: "file" as const,
                          mediaType: "image/png",
                          data: { type: "data" as const, data: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]) },
                        },
                      ]
                    : []),
                ],
              },
            ],
          })
          expect(await result.text).toBe("upgraded stream")
          expect(requests).toHaveLength(1)
          expect(requests[0]).toMatchObject({
            model: apiModelID,
            stream: true,
            messages: [
              { role: "system", content: "Preserve this instruction" },
              {
                role: "user",
                content: media
                  ? [
                      { type: "text", text: userText },
                      { type: "image_url", image_url: { url: "data:image/png;base64,iVBORw0KGgo=" } },
                    ]
                  : userText,
              },
            ],
          })
          expect(Session.getUsage({ model, usage: await result.usage }).tokens).toMatchObject({
            total: 12,
            input: 10,
            output: 2,
          })
        },
      })
    } finally {
      await server.stop(true)
    }
  },
  30000,
)

test("ACP 1.4 routes session configuration, listing, fork and resume in a declared MCP-free project", async () => {
  await using project = await memoryProject()
  await fs.mkdir(path.join(project.path, ".opencorvus"), { recursive: true })
  await fs.writeFile(
    ConfigPaths.projectFile(project.path),
    JSON.stringify({
      mcp: {
        computer: { ...ComputerMCPBuiltin.localConfig(), enabled: false },
        browser: { ...BrowserMCPBuiltin.localConfig(), enabled: false },
      },
      model: "dependabot-local/first",
      enabled_providers: ["dependabot-local"],
      provider: {
        "dependabot-local": {
          npm: "@ai-sdk/openai-compatible",
          options: { apiKey: "owned-local-participant" },
          models: {
            first: { name: "First", limit: { context: 10000, output: 1000 } },
            second: { name: "Second", limit: { context: 10000, output: 1000 }, variants: { precise: {} } },
          },
        },
      },
    }),
  )
  const server = Server.listen({ hostname: "127.0.0.1", port: 0, randomPort: true })
  const sdk = createOpenCorvusClient({ baseUrl: `http://${server.hostname}:${server.port}`, directory: project.path })
  let agentInput!: ReadableStreamDefaultController<Uint8Array>
  const agentReadable = new ReadableStream<Uint8Array>({
    start(controller) {
      agentInput = controller
    },
  })
  let clientInput!: ReadableStreamDefaultController<Uint8Array>
  const clientReadable = new ReadableStream<Uint8Array>({
    start(controller) {
      clientInput = controller
    },
  })
  const runtime = await ACP.init({ sdk })
  const agent = new AgentSideConnection(
    (connection) => runtime.create(connection, { sdk }),
    ndJsonStream(new WritableStream<Uint8Array>({ write: (chunk) => clientInput.enqueue(chunk) }), agentReadable),
  )
  const client = new ClientSideConnection(
    () =>
      ({
        async sessionUpdate() {},
        async requestPermission() {
          return { outcome: { outcome: "cancelled" } }
        },
      }) as Client,
    ndJsonStream(new WritableStream<Uint8Array>({ write: (chunk) => agentInput.enqueue(chunk) }), clientReadable),
  )
  try {
    const initialized = await client.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} })
    expect(initialized.agentCapabilities?.sessionCapabilities).toMatchObject({ list: {}, fork: {}, resume: {} })
    const created = await client.newSession({ cwd: project.path, mcpServers: [] })
    expect(created.configOptions).toEqual([
      expect.objectContaining({
        id: "model",
        category: "model",
        type: "select",
        currentValue: "dependabot-local/first",
        options: expect.arrayContaining([
          { value: "dependabot-local/second/precise", name: "dependabot-local/Second (precise)" },
        ]),
      }),
    ])
    const selected = await client.setSessionConfigOption({
      sessionId: created.sessionId,
      configId: "model",
      value: "dependabot-local/second/precise",
    })
    expect(selected.configOptions?.[0]).toMatchObject({ id: "model", currentValue: "dependabot-local/second/precise" })
    await expect(
      client.setSessionConfigOption({ sessionId: created.sessionId, configId: "model", value: "unknown/model" }),
    ).rejects.toMatchObject({ code: -32602, data: { configId: "model", value: "unknown/model" } })
    await expect(
      client.loadSession({
        sessionId: created.sessionId,
        cwd: project.path,
        mcpServers: [{ type: "acp", name: "owned-acp-transport", serverId: "owned-acp-server" }],
      }),
    ).rejects.toMatchObject({ code: -32602, data: { name: "owned-acp-transport", type: "acp" } })
    const listed = await client.listSessions({ cwd: project.path })
    expect(listed.sessions).toEqual(
      expect.arrayContaining([expect.objectContaining({ sessionId: created.sessionId, cwd: project.path })]),
    )
    const forked = await client.unstable_forkSession({ sessionId: created.sessionId, cwd: project.path })
    expect(typeof forked.sessionId).toBe("string")
    expect(Array.isArray(forked.configOptions)).toBe(true)
    const resumed = await client.resumeSession({ sessionId: forked.sessionId, cwd: project.path })
    expect(resumed.configOptions?.[0]).toMatchObject({ id: "model", currentValue: "dependabot-local/first" })
    const persisted = await sdk.session.get(
      { sessionID: forked.sessionId, directory: project.path },
      { throwOnError: true },
    )
    expect(persisted.data).toMatchObject({ id: forked.sessionId, parentID: created.sessionId })
  } finally {
    agentInput.close()
    clientInput.close()
    await Promise.all([agent.closed, client.closed])
    await server.stop(true)
  }
}, 30000)
