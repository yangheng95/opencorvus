import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import {
  AgentSideConnection,
  ClientSideConnection,
  ndJsonStream,
  PROTOCOL_VERSION,
  type Client,
  type SessionNotification,
} from "@agentclientprotocol/sdk"
import { createOpenCorvusClient } from "@opencorvus-ai/sdk"
import { ACP } from "@/acp/agent"
import { ConfigPaths } from "@/config/paths"
import { Identifier } from "@/id/id"
import { BrowserMCPBuiltin } from "@/mcp/browser/builtin"
import { ComputerMCPBuiltin } from "@/mcp/computer/builtin"
import { Provider } from "@/provider/provider"
import { Server } from "@/server/server"
import { SessionControl } from "@/session/control"
import { PermissionAuthority } from "@/permission/authority"
import { Instance } from "@/project/instance"
import { withTimeout } from "@/util/await-with-timeout"
import { Bus } from "@/bus"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Provider.resetAll()
  await resetMemoryDatabase()
})

// Actual ACP JSON-RPC, product HTTP routes and Session/Provider processing.
// The local streamed participant controls finish/error facts; this is not external-model or UI acceptance.
async function environment(options: { requestPermission?: Client["requestPermission"]; permissionMode?: "ask" } = {}) {
  const project = await memoryProject()
  const requests: Array<{ model: string; stream: boolean }> = []
  const updates: SessionNotification[] = []
  const cancelStarted = Promise.withResolvers<void>()
  const cancelClosed = Promise.withResolvers<void>()
  const provider = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const body = (await request.json()) as { model: string; stream: boolean }
      requests.push({ model: body.model, stream: body.stream })
      const chunk = {
        id: "acp-owned-stream",
        object: "chat.completion.chunk",
        created: 1,
        model: body.model,
        choices: [{ index: 0, delta: { content: "Actual partial output" }, finish_reason: null }],
      }
      const encode = (data: unknown) => new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
      if (body.model === "cancel") {
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(encode(chunk))
              cancelStarted.resolve()
            },
            cancel() {
              cancelClosed.resolve()
            },
          }),
          { headers: { "Content-Type": "text/event-stream" } },
        )
      }
      const ending =
        body.model === "error"
          ? {
              error: {
                message: "Owned ACP stream failed after partial output",
                type: "invalid_request_error",
                code: "owned_failure",
              },
            }
          : {
              ...chunk,
              choices: [{ index: 0, delta: {}, finish_reason: body.model === "normal" ? "stop" : body.model }],
              usage: {
                prompt_tokens: 12,
                completion_tokens: 5,
                total_tokens: 17,
                completion_tokens_details: { reasoning_tokens: 2 },
              },
            }
      return new Response(new Blob([encode(chunk), encode(ending), "data: [DONE]\n\n"]), {
        headers: { "Content-Type": "text/event-stream" },
      })
    },
  })
  await fs.mkdir(path.join(project.path, ".opencorvus"), { recursive: true })
  await fs.writeFile(
    ConfigPaths.projectFile(project.path),
    JSON.stringify({
      ...(options.permissionMode ? { permission_mode: options.permissionMode, prompt_profile: { active: "base" } } : {}),
      mcp: {
        computer: { ...ComputerMCPBuiltin.localConfig(), enabled: false },
        browser: { ...BrowserMCPBuiltin.localConfig(), enabled: false },
      },
      model: "acp-terminal/normal",
      small_model: "acp-terminal/normal",
      enabled_providers: ["acp-terminal"],
      command: { inspect: { template: "$ARGUMENTS", description: "Owned ACP command" } },
      provider: {
        "acp-terminal": {
          npm: "@ai-sdk/openai-compatible",
          api: new URL("v1", provider.url).href,
          options: { apiKey: "owned-local-participant", timeout: false },
          models: Object.fromEntries(
            ["normal", "error", "length", "content_filter", "cancel"].map((id) => [
              id,
              {
                name: id,
                limit: { context: 100000, output: 1000 },
              },
            ]),
          ),
        },
      },
    }),
  )
  const server = Server.listen({ hostname: "127.0.0.1", port: 0, randomPort: true })
  const sdk = createOpenCorvusClient({ baseUrl: `http://${server.hostname}:${server.port}`, directory: project.path })
  let agentInput!: ReadableStreamDefaultController<Uint8Array>
  let clientInput!: ReadableStreamDefaultController<Uint8Array>
  const agentReadable = new ReadableStream<Uint8Array>({
    start(controller) {
      agentInput = controller
    },
  })
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
        async sessionUpdate(update) {
          updates.push(update)
        },
        requestPermission: options.requestPermission ?? (async () => ({ outcome: { outcome: "cancelled" } })),
      }) as Client,
    ndJsonStream(new WritableStream<Uint8Array>({ write: (chunk) => agentInput.enqueue(chunk) }), clientReadable),
  )
  await client.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} })
  return {
    project,
    sdk,
    client,
    requests,
    updates,
    cancelStarted: cancelStarted.promise,
    cancelClosed: cancelClosed.promise,
    async create(model: string, directory = project.path) {
      const session = await client.newSession({ cwd: directory, mcpServers: [] })
      await client.setSessionConfigOption({
        sessionId: session.sessionId,
        configId: "model",
        value: `acp-terminal/${model}`,
      })
      return session.sessionId
    },
    async messages(sessionID: string, directory = project.path) {
      return (await sdk.session.messages({ sessionID, directory }, { throwOnError: true })).data!
    },
    async [Symbol.asyncDispose]() {
      agentInput.close()
      clientInput.close()
      await Promise.all([agent.closed, client.closed])
      await server.stop(true)
      await provider.stop(true)
      await project[Symbol.asyncDispose]()
    },
  }
}

test("ACP Permission queue presents the current complete pending set through official JSON-RPC and product HTTP", async () => {
  const presented: Array<Parameters<Client["requestPermission"]>[0]> = []
  const firstShown = Promise.withResolvers<void>()
  const releaseFirst = Promise.withResolvers<Awaited<ReturnType<Client["requestPermission"]>>>()
  await using env = await environment({ permissionMode: "ask", async requestPermission(request) {
    presented.push(request)
    if (presented.length === 1) { firstShown.resolve(); return releaseFirst.promise }
    return { outcome: { outcome: "selected", optionId: "allow_once" } }
  } })
  const sessionID = await env.create("normal")
  const operations: Promise<unknown>[] = []
  try {
    await Instance.provide({ directory: env.project.path, fn: async () => {
      const requests = new Map<string, PermissionAuthority.Request>()
      const allAsked = Promise.withResolvers<void>()
      const stop = Bus.subscribe(PermissionAuthority.Event.Asked, ({ properties }) => {
        requests.set(properties.toolCallID, properties)
        if (requests.size === 3) allAsked.resolve()
      })
      const run = (name: string) => {
        const operation = PermissionAuthority.authorizeAndExecute({ projectID: Instance.project.id, sessionID,
          messageID: Identifier.ascending("message"), toolCallID: name, providerKind: "builtin", providerID: "builtin",
          toolName: "write", args: { filePath: path.join(env.project.path, `${name}.txt`), content: name },
        }, async () => `${name} actual callback result`)
        void operation.catch(() => undefined)
        operations.push(operation)
        return operation
      }
      try {
        const first = run("queue-first")
        await withTimeout(firstShown.promise, 10000, "official ACP first Permission request")
        const second = run("queue-settled"), third = run("queue-current")
        await withTimeout(allAsked.promise, 10000, "three original Asked facts")
        const settled = requests.get("queue-settled")!
        const resolution = await PermissionAuthority.reply({ requestID: settled.id, decision: "deny", actorID: "another-operator", autoReply: false })
        releaseFirst.resolve({ outcome: { outcome: "selected", optionId: "allow_once" } })
        const completed = await withTimeout(Promise.all([first, second.catch(error => error), third]), 15000, "original queued Permission executions")
        expect(completed).toEqual(["queue-first actual callback result", expect.any(PermissionAuthority.RejectedError), "queue-current actual callback result"])
        expect(presented.map(request => ({ sessionID: request.sessionId, callID: request.toolCall.toolCallId, rawInput: request.toolCall.rawInput })))
          .toEqual(["queue-first", "queue-current"].map(name => ({ sessionID, callID: name, rawInput: requests.get(name)!.scope })))
        expect(resolution).toMatchObject({ decision: "deny", request: settled })
        expect((await env.sdk.permission.list({ directory: env.project.path }, { throwOnError: true })).data).toEqual([])
      } finally { stop() }
    } })
  } finally {
    releaseFirst.resolve({ outcome: { outcome: "cancelled" } })
    await Instance.provide({ directory: env.project.path, fn: () => PermissionAuthority.cancelPendingForSession(sessionID, "ACP queue contract cleanup") })
    await withTimeout(Promise.allSettled(operations), 10000, "original ACP execution settlement")
  }
}, 60000)

for (const entry of ["prompt", "command"] as const) {
  for (const [model, stopReason, finish] of [
    ["normal", "end_turn", "stop"],
    ["length", "max_tokens", "length"],
    ["content_filter", "refusal", "content-filter"],
  ] as const) {
    test(`ACP ${entry} maps actual ${finish} and canonical usage`, async () => {
      await using env = await environment()
      const sessionId = await env.create(model)
      const response = await env.client.prompt({
        sessionId,
        prompt: [{ type: "text", text: entry === "command" ? "/inspect owned input" : "owned input" }],
      })
      const messages = await env.messages(sessionId)
      const last = messages.filter((m) => m.info.role === "assistant").at(-1)!
      if (last.info.role !== "assistant") throw Error("Expected actual assistant reply")
      expect(last.info).toMatchObject({ role: "assistant", finish })
      expect(response).toMatchObject({ stopReason, usage: { totalTokens: last.info.tokens.total } })
      expect(messages.filter((m) => m.info.role === "user").map((m) => m.info.id)).toContain(last.info.parentID)
      expect(env.requests).toContainEqual({ model, stream: true })
      expect(env.requests.every((request) => request.stream === true)).toBe(true)
      expect(
        last.parts
          .filter((p) => p.type === "text")
          .map((p) => p.text)
          .join(""),
      ).toBe("Actual partial output")
      console.log(JSON.stringify({ entry, model, response, messages, requests: env.requests, updates: env.updates }))
    }, 60_000)
  }

  test(`ACP ${entry} exposes its persisted Provider error and accepts a later independent turn`, async () => {
    await using env = await environment()
    const sessionId = await env.create("error")
    const response = await env.client
      .prompt({
        sessionId,
        prompt: [{ type: "text", text: entry === "command" ? "/inspect fail this input" : "fail this input" }],
      })
      .catch((error) => error)
    const failed = (await env.messages(sessionId)).filter((m) => m.info.role === "assistant").at(-1)!
    if (failed.info.role !== "assistant") throw Error("Expected actual failed reply")
    expect(failed.info).toMatchObject({
      finish: "error",
      error: {
        name: "UnknownError",
        data: { message: "AI_StreamProviderError: Owned ACP stream failed after partial output" },
      },
    })
    expect(response).toMatchObject({
      code: -32603,
      data: {
        sessionID: sessionId,
        inputMessageID: failed.info.parentID,
        finalMessageID: failed.info.id,
        error: failed.info.error,
      },
    })
    expect(
      failed.parts
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join(""),
    ).toBe("Actual partial output")
    await env.client.setSessionConfigOption({ sessionId, configId: "model", value: "acp-terminal/normal" })
    expect(
      await env.client.prompt({ sessionId, prompt: [{ type: "text", text: "independent next input" }] }),
    ).toMatchObject({ stopReason: "end_turn" })
    const persisted = (await env.messages(sessionId)).find((m) => m.info.id === failed.info.id)
    expect(persisted).toEqual(failed)
    console.log(
      JSON.stringify({
        entry,
        model: "error",
        response,
        messages: await env.messages(sessionId),
        requests: env.requests,
      }),
    )
  }, 60_000)

  test(`ACP ${entry} cancellation closes the actual stream and returns cancelled`, async () => {
    await using env = await environment()
    const sessionId = await env.create("cancel")
    const response = env.client
      .prompt({
        sessionId,
        prompt: [{ type: "text", text: entry === "command" ? "/inspect cancellable input" : "cancellable input" }],
      })
      .catch((error) => error)
    await env.cancelStarted
    await env.client.cancel({ sessionId })
    const result = await response
    console.log(JSON.stringify({ entry, cancellationResult: result, messages: await env.messages(sessionId) }))
    expect(result).toMatchObject({ stopReason: "cancelled" })
    await env.cancelClosed
    const failed = (await env.messages(sessionId)).filter((m) => m.info.role === "assistant").at(-1)!
    expect(failed.info).toMatchObject({ finish: "error", error: { name: "MessageAbortedError" } })
    expect(typeof failed.info.time.completed).toBe("number")
    await env.client.setSessionConfigOption({ sessionId, configId: "model", value: "acp-terminal/normal" })
    expect(
      await env.client.prompt({ sessionId, prompt: [{ type: "text", text: "independent turn after cancellation" }] }),
    ).toMatchObject({ stopReason: "end_turn" })
    expect((await env.messages(sessionId)).find((m) => m.info.id === failed.info.id)).toEqual(failed)
  }, 60_000)
}

test("ACP preserves separate outcomes in parallel Sessions across Projects", async () => {
  await using peer = await memoryProject("acp-second-project")
  await using env = await environment()
  await fs.mkdir(path.join(peer.path, ".opencorvus"), { recursive: true })
  await fs.copyFile(ConfigPaths.projectFile(env.project.path), ConfigPaths.projectFile(peer.path))
  const failedID = await env.create("error")
  const localID = await env.create("normal")
  const peerID = await env.create("normal", peer.path)
  const results = await Promise.allSettled(
    [failedID, localID, peerID].map((sessionId) =>
      env.client.prompt({
        sessionId,
        prompt: [{ type: "text", text: `Independent input for ${sessionId}` }],
      }),
    ),
  )
  expect(results[0]).toMatchObject({ status: "rejected", reason: { code: -32603, data: { sessionID: failedID } } })
  expect(results.slice(1)).toMatchObject([
    { status: "fulfilled", value: { stopReason: "end_turn" } },
    { status: "fulfilled", value: { stopReason: "end_turn" } },
  ])
  const all = []
  for (const [sessionID, directory, finish] of [
    [failedID, env.project.path, "error"],
    [localID, env.project.path, "stop"],
    [peerID, peer.path, "stop"],
  ]) {
    const messages = await env.messages(sessionID, directory)
    const user = messages.find((m) => m.info.role === "user")!
    const final = messages.filter((m) => m.info.role === "assistant").at(-1)!
    expect(final.info).toMatchObject({ sessionID, parentID: user.info.id, finish, path: { cwd: directory } })
    all.push({ sessionID, directory, messages })
  }
  console.log(JSON.stringify({ parallelResults: results, projects: all }))
}, 60_000)

test("ACP exposes a real HTTP missing-session error and an invalid command", async () => {
  await using env = await environment()
  const sessionId = await env.create("normal")
  await expect(
    env.client.prompt({ sessionId, prompt: [{ type: "text", text: "/undefined_command" }] }),
  ).rejects.toMatchObject({ code: -32602, data: { command: "undefined_command" } })
  await env.sdk.session.delete({ sessionID: sessionId, directory: env.project.path }, { throwOnError: true })
  await expect(
    env.client.prompt({ sessionId, prompt: [{ type: "text", text: "This Session was deleted" }] }),
  ).rejects.toMatchObject({ code: -32603, data: { sessionID: sessionId, error: { name: "NotFoundError" } } })
}, 60_000)

test("public initialization projects a cancelled actual reply as false", async () => {
  await using env = await environment()
  const sessionID = await env.create("normal")
  const messageID = Identifier.ascending("message")
  const result = env.sdk.session.init(
    { sessionID, messageID, providerID: "acp-terminal", modelID: "cancel", directory: env.project.path },
    { throwOnError: true },
  )
  await env.cancelStarted
  const aborted = await env.sdk.session.abort({ sessionID, directory: env.project.path }, { throwOnError: true })
  expect(aborted.data).toBe(true)
  expect((await result).data).toBe(false)
  await env.cancelClosed
  const final = (await env.messages(sessionID)).filter((m) => m.info.role === "assistant").at(-1)!
  expect(final.info).toMatchObject({ parentID: messageID, finish: "error", error: { name: "MessageAbortedError" } })
  console.log(JSON.stringify({ initializationCancellation: { sessionID, messageID, final } }))
}, 60_000)

test("ACP compaction reports the actual no-material maintenance failure", async () => {
  await using env = await environment()
  const sessionId = await env.create("normal")
  await env.client.prompt({
    sessionId,
    prompt: [{ type: "text", text: "Retain this actual user input for compaction." }],
  })
  const result = await env.client
    .prompt({ sessionId, prompt: [{ type: "text", text: "/compact" }] })
    .catch((error) => error)
  const controls = SessionControl.list(sessionId)
  expect(controls).toEqual([
    expect.objectContaining({
      sessionID: sessionId,
      kind: "manual_summarize",
      status: "failed",
      payload: expect.objectContaining({ error: expect.stringContaining("SessionCompactionMaterialUnavailableError") }),
    }),
  ])
  console.log(JSON.stringify({ compactionResult: result, controls, messages: await env.messages(sessionId) }))
  expect(result).toMatchObject({
    code: -32603,
    data: { sessionID: sessionId, error: expect.any(Object) },
    message: expect.stringContaining("compaction request failed"),
  })
}, 60_000)
