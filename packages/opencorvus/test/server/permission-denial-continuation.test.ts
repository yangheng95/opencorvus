import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Config } from "@/config/config"
import { Identifier } from "@/id/id"
import { PermissionAuthority } from "@/permission/authority"
import { Instance } from "@/project/instance"
import { Server } from "@/server/server"
import { Session } from "@/session"
import { completedReplyToUserMessage } from "@/session/completed-reply"
import { Message } from "@/session/message"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import { startControlledStreamingProvider } from "../fixture/controlled-streaming-provider"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

type Scope = {
  project: Awaited<ReturnType<typeof memoryProject>>
  file: string
  provider: ReturnType<typeof startControlledStreamingProvider>
  model: { providerID: string; modelID: string }
  session?: Session.Info
  headers: Record<string, string>
}

type Reply = { status: number; body: any }

async function withPublicScope(
  count: number,
  run: (input: {
    scopes: Scope[]
    request(scope: Scope, route: string, body?: unknown): Promise<Reply>
    prompt(scope: Scope, body: ReturnType<typeof promptBody>): Promise<Reply>
  }) => Promise<void>,
) {
  const scopes: Scope[] = []
  const prompts: Promise<Reply>[] = []
  const sender = new AbortController()
  let server: ReturnType<typeof Server.listen> | undefined
  let release: ReturnType<typeof setInterval> | undefined
  try {
    for (let index = 0; index < count; index++) {
      const project = await memoryProject(`denial-continuation-${index}`)
      const file = path.join(path.dirname(project.path), `public-denial-${Identifier.ascending("part")}.csv`)
      await fs.writeFile(file, "item,quantity\nMaple,3\nIris,4\n")
      scopes.push({
        project,
        file,
        provider: startControlledStreamingProvider({
          firstPromptToolCall: { name: "read", arguments: { filePath: file } },
        }),
        model: { providerID: `denial-contract-${index}`, modelID: "session-prompt-owner-model" },
        headers: { "content-type": "application/json", "x-opencorvus-directory": project.path },
      })
    }
    release = setInterval(() => {
      for (const scope of scopes) for (const request of scope.provider.requests) request.release()
    }, 5)
    await Config.updateGlobalPatch({
      model: `${scopes[0]!.model.providerID}/${scopes[0]!.model.modelID}`,
      small_model: `${scopes[0]!.model.providerID}/${scopes[0]!.model.modelID}`,
      permission_mode: "ask",
      prompt_profile: { active: "base" },
      enabled_providers: scopes.map((scope) => scope.model.providerID),
      provider: Object.fromEntries(
        scopes.map(({ model, provider }) => [
          model.providerID,
          {
            npm: "@ai-sdk/openai-compatible",
            api: provider.apiURL,
            options: { apiKey: "local-controlled-provider" },
            models: {
              [model.modelID]: {
                name: "Public denial continuation contract",
                tool_call: true,
                modalities: { input: ["text"], output: ["text"] },
                limit: { context: 1_000_000, output: 4096 },
              },
            },
          },
        ]),
      ),
    })
    for (const scope of scopes) {
      await Instance.provide({
        directory: scope.project.path,
        fn: () =>
          Config.updateProjectPatch({
            model: `${scope.model.providerID}/${scope.model.modelID}`,
            small_model: `${scope.model.providerID}/${scope.model.modelID}`,
            mcp: { browser: { enabled: false }, computer: { enabled: false } },
          }),
      })
    }
    // The real listener is owned outside all Instance.provide callbacks so
    // shutdown can join their actual execution leases.
    server = Server.listen({ hostname: "127.0.0.1", port: 0, randomPort: true })
    const request = async (scope: Scope, route: string, body?: unknown): Promise<Reply> => {
      const response = await fetch(new URL(route, server!.url), {
        method: body === undefined ? "GET" : "POST",
        headers: scope.headers,
        signal: AbortSignal.any([sender.signal, AbortSignal.timeout(30_000)]),
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
      return { status: response.status, body: await response.json() }
    }
    for (const scope of scopes) {
      const created = await request(scope, "/session", { kind: "assistant", title: "Public denied read" })
      expect(created.status).toBe(200)
      scope.session = Session.Info.parse(created.body)
    }
    const prompt = (scope: Scope, body: ReturnType<typeof promptBody>) => {
      const pending = request(scope, `/session/${scope.session!.id}/message`, body)
      prompts.push(pending)
      void pending.catch(() => undefined)
      return pending
    }
    await run({ scopes, request, prompt })
  } finally {
    sender.abort()
    await server?.stop(true)
    await Promise.allSettled(prompts)
    clearInterval(release)
    for (const scope of scopes) {
      for (const request of scope.provider.requests) request.release()
      await Promise.all(scope.provider.requests.map((request) => request.responded))
      await scope.provider.server.stop(true)
      await fs.rm(scope.file)
      await scope.project[Symbol.asyncDispose]()
    }
  }
}

function promptBody(scope: Scope, text = `Read the public CSV at ${scope.file}.`) {
  return {
    messageID: Identifier.ascending("message"),
    agent: "chat",
    model: scope.model,
    parts: [{ type: "text" as const, text }],
  }
}

async function waitForRequest(scope: Scope, request: Parameters<Parameters<typeof withPublicScope>[1]>[0]["request"]) {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    const hydrated = await request(scope, `/session/${scope.session!.id}/conversation`)
    if (hydrated.status !== 200)
      throw new Error(`Conversation HTTP ${hydrated.status}: ${JSON.stringify(hydrated.body)}`)
    const pending = hydrated.body.pendingPermissions.find(
      (item: PermissionAuthority.Request) => item.sessionID === scope.session!.id,
    )
    if (pending) return PermissionAuthority.Request.parse(pending)
    await Bun.sleep(25)
  }
  throw new Error("The actual streamed read did not publish its Permission within 20000ms")
}

function expectFinal(response: Reply, inputMessageID: string) {
  const message = Message.WithParts.parse(response.body)
  expect(structuredClone(response)).toMatchObject({
    status: 200,
    body: {
      info: {
        role: "assistant",
        parentID: inputMessageID,
        acceptedInputMessageIDs: [inputMessageID],
        finish: "stop",
        time: { completed: expect.any(Number) },
      },
      parts: expect.arrayContaining([
        expect.objectContaining({ type: "text", text: expect.stringMatching(/^provider reply /) }),
      ]),
    },
  })
  return message
}

test("public denial reaches the next actual stream and a durable reply, then exact replay and a subsequent input converge", async () => {
  await withPublicScope(1, async ({ scopes: [scope], request, prompt }) => {
    const current = scope!
    const input = promptBody(current)
    const first = prompt(current, input)
    const pending = await waitForRequest(current, request)
    expect(pending).toMatchObject({
      projectID: current.session!.projectID,
      sessionID: current.session!.id,
      toolName: "read",
    })
    expect(
      await request(current, `/permission/${pending.id}/reply`, {
        decision: "deny",
        message: "Keep this public file unread.",
      }),
    ).toMatchObject({ status: 200, body: { request: { id: pending.id }, decision: "deny" } })
    const final = expectFinal(await first, input.messageID)
    const followup = current.provider.promptRequests()[1]?.body
    expect(structuredClone(followup)).toMatchObject({
      model: current.model.modelID,
      stream: true,
      messages: expect.arrayContaining([
        expect.objectContaining({
          role: "tool",
          tool_call_id: "call_controlled_recovery_next",
          content: expect.stringContaining("The operator denied this Tool call: Keep this public file unread."),
        }),
      ]),
    })
    const history = await request(current, `/session/${current.session!.id}/message`)
    const messages = Message.WithParts.array().parse(history.body)
    expect(
      messages
        .flatMap((message) => message.parts)
        .find((part) => part.type === "tool" && part.callID === pending.toolCallID),
    ).toMatchObject({
      type: "tool",
      state: {
        status: "error",
        input: { filePath: current.file },
        failure: { message: "The operator denied this Tool call: Keep this public file unread." },
      },
    })
    const canonical = await Instance.provide({
      directory: current.project.path,
      fn: () => completedReplyToUserMessage(current.session!.id, input.messageID, true),
    })
    expect(canonical?.info.id).toBe(final.info.id)
    const replay = expectFinal(await prompt(current, input), input.messageID)
    expect({ replyID: replay.info.id, streamedRequests: current.provider.promptRequests().length }).toEqual({
      replyID: final.info.id,
      streamedRequests: 2,
    })
    const next = promptBody(current, "Acknowledge that the public read was declined.")
    expectFinal(await prompt(current, next), next.messageID)
    expect(current.provider.promptRequests().length).toBe(3)
    const ledger = await request(current, "/permission/history")
    expect(
      ledger.body
        .filter((row: any) => row.request_id === pending.id)
        .map((row: any) => row.event_type)
        .sort(),
    ).toEqual(["denied", "requested"])
  })
}, 60_000)

test("two Projects complete their concurrent denied and approved reads with their own canonical replies", async () => {
  await withPublicScope(2, async ({ scopes, request, prompt }) => {
    const inputs = scopes.map((scope) => promptBody(scope))
    const replies = scopes.map((scope, index) => prompt(scope, inputs[index]!))
    const pending = await Promise.all(scopes.map((scope) => waitForRequest(scope, request)))
    expect(pending.map((item) => item.projectID)).toEqual(scopes.map((scope) => scope.session!.projectID))
    const decisions = ["deny", "allow_once"] as const
    await Promise.all(
      scopes.map(async (scope, index) => {
        const decision = decisions[index]!
        expect(await request(scope, `/permission/${pending[index]!.id}/reply`, { decision })).toMatchObject({
          status: 200,
          body: { request: { id: pending[index]!.id, projectID: scope.session!.projectID }, decision },
        })
      }),
    )
    const results = await Promise.all(replies)
    for (let index = 0; index < scopes.length; index++) {
      const scope = scopes[index]!
      const final = expectFinal(results[index]!, inputs[index]!.messageID)
      const canonical = await Instance.provide({
        directory: scope.project.path,
        fn: () => completedReplyToUserMessage(scope.session!.id, inputs[index]!.messageID, true),
      })
      expect({ sessionID: canonical?.info.sessionID, messageID: canonical?.info.id }).toEqual({
        sessionID: scope.session!.id,
        messageID: final.info.id,
      })
      const history = await request(scope, `/session/${scope.session!.id}/message`)
      const messages = Message.WithParts.array().parse(history.body)
      const read = messages
        .flatMap((message) => message.parts)
        .find((part) => part.type === "tool" && part.tool === "read")
      expect(read).toMatchObject(
        index === 0
          ? { state: { status: "error", failure: { message: "The operator denied this Tool call." } } }
          : { state: { status: "completed", output: expect.stringContaining("Maple,3") } },
      )
      expect(scope.provider.promptRequests()[1]?.body).toMatchObject({ model: scope.model.modelID, stream: true })
    }
  })
}, 60_000)

test("public abort during an actual pending read preserves the exact cancelled Prompt outcome", async () => {
  await withPublicScope(1, async ({ scopes: [scope], request, prompt }) => {
    const current = scope!
    const input = promptBody(current)
    const reply = prompt(current, input)
    await waitForRequest(current, request)
    expect(await request(current, `/session/${current.session!.id}/abort`, {})).toEqual({ status: 200, body: true })
    const result = await reply
    expect(result).toMatchObject({
      status: 200,
      body: {
        info: {
          sessionID: current.session!.id,
          parentID: input.messageID,
          finish: "error",
          error: { name: "MessageAbortedError" },
          time: { completed: expect.any(Number) },
        },
      },
    })
    const canonical = await Instance.provide({
      directory: current.project.path,
      fn: () => completedReplyToUserMessage(current.session!.id, input.messageID, true),
    })
    expect(canonical?.info).toMatchObject({
      id: result.body.info.id,
      acceptedInputMessageIDs: [input.messageID],
      error: { name: "MessageAbortedError" },
    })
    expect(structuredClone(canonical?.parts.find((part) => part.type === "tool"))).toMatchObject({
      state: { status: "error", time: { end: expect.any(Number) } },
    })
  })
}, 60_000)
