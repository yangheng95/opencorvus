import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Bus } from "@/bus"
import { BusPublicationOutboxTable } from "@/bus/bus.sql"
import { Config } from "@/config/config"
import { Identifier } from "@/id/id"
import { PermissionAuthority } from "@/permission/authority"
import { Instance } from "@/project/instance"
import { ensureSessionProtocolBridge, pendingPermissionSessionEvent } from "@/protocol/session-mirror"
import { Server } from "@/server/server"
import { SessionEventStreamTestHooks } from "@/server/routes/session"
import { Session } from "@/session"
import { Database, eq } from "@/storage/db"
import { timelineOrderKey } from "@/timeline/order"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import { startControlledStreamingProvider } from "../fixture/controlled-streaming-provider"

afterEach(async () => {
  SessionEventStreamTestHooks.afterConversationSnapshotRead = undefined
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function pending(sessionID: string, invocation?: Parameters<typeof PermissionAuthority.authorizeAndExecute>[0]) {
  let stop = () => {}
  const asked = new Promise<PermissionAuthority.Request>((resolve) => {
    stop = Bus.subscribe(PermissionAuthority.Event.Asked, ({ properties }) => {
      if (properties.sessionID === sessionID) {
        stop()
        resolve(properties)
      }
    })
  })
  const execution = PermissionAuthority.authorizeAndExecute(
    invocation ?? {
      projectID: Instance.project.id,
      sessionID,
      messageID: Identifier.ascending("message"),
      toolCallID: Identifier.ascending("part"),
      providerKind: "builtin",
      providerID: "builtin",
      toolName: "write",
      args: { filePath: `${Instance.directory}/public.txt`, content: "public contract" },
    },
    async () => "public execution completed",
  ).catch((error) => error)
  return { request: await asked, execution }
}

function events(response: Response) {
  const reader = response.body!.getReader(),
    decoder = new TextDecoder()
  let buffer = ""
  const queued: any[] = []
  const receivedTypes: string[] = []
  return {
    receivedTypes,
    async next(type: string) {
      const until = Date.now() + 5000
      for (;;) {
        const frames = buffer.split("\n\n")
        buffer = frames.pop()!
        for (const frame of frames) {
          const data = frame
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trimStart())
            .join("\n")
          if (data) {
            const event = JSON.parse(data)
            queued.push(event)
            receivedTypes.push(event.type)
          }
        }
        const index = queued.findIndex((event) => event.type === type)
        if (index >= 0) return queued.splice(index, 1)[0]
        let timer: ReturnType<typeof setTimeout> | undefined
        try {
          const chunk = await Promise.race([
            reader.read(),
            new Promise<never>((_, reject) => {
              timer = setTimeout(
                () => reject(new Error(`Waiting for ${type} exceeded 5000ms`)),
                Math.max(1, until - Date.now()),
              )
            }),
          ])
          if (chunk.done) throw new Error(`Stream ended before ${type}`)
          buffer += decoder.decode(chunk.value, { stream: true })
        } finally {
          clearTimeout(timer)
        }
      }
    },
    close: () => reader.cancel(),
  }
}

test("cold hydrate and connected expose the same ordered pending root and child Permission facts", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      await Config.updateProjectPatch({ permission_mode: "ask" })
      const root = await Session.create({ kind: "assistant", title: "Permission root" })
      const child = await Session.create({ kind: "assistant", parentID: root.id, title: "Permission child" })
      const sibling = await Session.create({ kind: "assistant", title: "Other conversation" })
      const rootPending = await pending(root.id),
        childPending = await pending(child.id),
        siblingPending = await pending(sibling.id)
      const headers = { "x-opencorvus-directory": project.path },
        abort = new AbortController()
      let stream: ReturnType<typeof events> | undefined
      try {
        const response = await Server.App().request(`/session/${root.id}/conversation`, { headers })
        expect(response.status).toBe(200)
        const hydration = (await response.json()) as any
        const expected = JSON.parse(
          JSON.stringify(
            [rootPending.request, childPending.request].map((request) => ({
              ...request,
              orderKey: timelineOrderKey({ domain: "interaction", time: request.timeCreated, id: request.id }),
            })),
          ),
        )
        expect(hydration.pendingPermissions).toEqual(expected)
        const connectedResponse = await Server.App().request(`/session/${root.id}/events`, {
          headers,
          signal: abort.signal,
        })
        stream = events(connectedResponse)
        expect((await stream.next("session.connected")).payload.conversationSnapshot.pendingPermissions).toEqual(
          expected,
        )
        expect(pendingPermissionSessionEvent(childPending.request).payload?.orderKey).toBe(expected[1]!.orderKey)
      } finally {
        abort.abort()
        await stream?.close()
        await PermissionAuthority.cancelPendingForSessions([root.id, child.id, sibling.id], "contract finished")
        await Promise.all([rootPending.execution, childPending.execution, siblingPending.execution])
      }
    },
  })
})

test("same pending invocation reuses its immutable Request in each Asked and cold snapshot", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      await Config.updateProjectPatch({ permission_mode: "ask" })
      const session = await Session.create({ kind: "assistant", title: "Repeated pending input" })
      const invocation = {
        projectID: Instance.project.id,
        sessionID: session.id,
        messageID: Identifier.ascending("message"),
        toolCallID: Identifier.ascending("part"),
        providerKind: "builtin" as const,
        providerID: "builtin",
        toolName: "write",
        args: { filePath: `${project.path}/public-repeated.txt`, content: "repeat" },
      }
      const first = await pending(session.id, invocation)
      await Bun.sleep(5)
      const second = await pending(session.id, invocation)
      try {
        expect(second.request).toEqual(first.request)
        expect(await PermissionAuthority.list()).toEqual([first.request])
        await PermissionAuthority.reply({ requestID: first.request.id, decision: "deny", actorID: "test-operator" })
        expect(await first.execution).toBeInstanceOf(PermissionAuthority.RejectedError)
        expect(await second.execution).toBeInstanceOf(PermissionAuthority.RejectedError)
        const requested = (await PermissionAuthority.history()).filter((item) => item.event_type === "requested")
        expect(requested.map((item) => ({ id: item.request_id, created: item.time_created }))).toEqual([
          { id: first.request.id, created: first.request.timeCreated },
        ])
      } finally {
        await PermissionAuthority.cancelPendingForSession(session.id, "contract finished")
        await Promise.all([first.execution, second.execution])
      }
    },
  })
})

test("completed invocation replay returns the original result with its original Request authority", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      await Config.updateProjectPatch({ permission_mode: "ask" })
      const session = await Session.create({ kind: "assistant", title: "Completed replay" })
      const invocation = {
        projectID: Instance.project.id,
        sessionID: session.id,
        messageID: Identifier.ascending("message"),
        toolCallID: Identifier.ascending("part"),
        providerKind: "builtin" as const,
        providerID: "builtin",
        toolName: "write",
        args: { filePath: `${project.path}/public-completed.txt`, content: "public" },
      }
      const first = await pending(session.id, invocation)
      try {
        await PermissionAuthority.reply({
          requestID: first.request.id,
          decision: "allow_once",
          actorID: "test-operator",
        })
        expect(await first.execution).toBe("public execution completed")
        const repeated = await PermissionAuthority.authorizeAndExecute(invocation, async () => "a different effect")
        expect(repeated).toBe("public execution completed")
        expect(
          (await PermissionAuthority.history())
            .filter((item) => item.event_type === "requested")
            .map((item) => ({ id: item.request_id, created: item.time_created })),
        ).toEqual([{ id: first.request.id, created: first.request.timeCreated }])
      } finally {
        await PermissionAuthority.cancelPendingForSession(session.id, "contract finished")
        await first.execution
      }
    },
  })
})

test("two registered Projects hydrate each conversation's actual Permission owner", async () => {
  await using firstProject = await memoryProject("permission-project-first")
  await using secondProject = await memoryProject("permission-project-second")
  const create = (directory: string) =>
    Instance.provide({
      directory,
      fn: async () => {
        await Config.updateProjectPatch({ permission_mode: "ask" })
        const session = await Session.create({ kind: "assistant", title: "Project permission owner" })
        return { session, current: await pending(session.id) }
      },
    })
  const first = await create(firstProject.path),
    second = await create(secondProject.path)
  try {
    for (const [project, owner] of [
      [firstProject, first],
      [secondProject, second],
    ] as const) {
      const response = await Server.App().request(`/session/${owner.session.id}/conversation`, {
        headers: { "x-opencorvus-directory": project.path },
      })
      expect(response.status).toBe(200)
      expect(
        ((await response.json()) as any).pendingPermissions.map((request: any) => ({
          id: request.id,
          projectID: request.projectID,
          sessionID: request.sessionID,
        })),
      ).toEqual([{ id: owner.current.request.id, projectID: owner.session.projectID, sessionID: owner.session.id }])
    }
  } finally {
    for (const [project, owner] of [
      [firstProject, first],
      [secondProject, second],
    ] as const) {
      await Instance.provide({
        directory: project.path,
        fn: () => PermissionAuthority.cancelPendingForSession(owner.session.id, "contract finished"),
      })
      await owner.current.execution
    }
  }
})

test("live Asked and durable stale winner expose exact request ordering and terminal identity", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      await Config.updateProjectPatch({ permission_mode: "ask" })
      const session = await Session.create({ kind: "assistant", title: "Live permission" })
      ensureSessionProtocolBridge()
      const headers = { "x-opencorvus-directory": project.path }
      const abort = new AbortController()
      const stream = events(
        await Server.App().request(`/session/${session.id}/events`, {
          headers,
          signal: abort.signal,
        }),
      )
      let execution: Promise<unknown> | undefined
      try {
        const connected = await stream.next("session.connected")
        expect(connected.payload.conversationSnapshot.pendingPermissions).toEqual([])
        const current = await pending(session.id)
        execution = current.execution
        const asked = await stream.next("permission.asked")
        expect({ request: asked.payload.id, orderKey: asked.orderKey }).toEqual({
          request: current.request.id,
          orderKey: timelineOrderKey({
            domain: "interaction",
            time: current.request.timeCreated,
            id: current.request.id,
          }),
        })
        const coldResponse = await Server.App().request(`/session/${session.id}/conversation`, { headers })
        expect(coldResponse.status).toBe(200)
        const cold = (await coldResponse.json()) as any
        const snapshotAbort = new AbortController()
        const snapshotStream = events(
          await Server.App().request(`/session/${session.id}/events`, { headers, signal: snapshotAbort.signal }),
        )
        try {
          const snapshot = (await snapshotStream.next("session.connected")).payload.conversationSnapshot
          const canonicalRequest = JSON.parse(JSON.stringify(current.request))
          expect({
            warm: PermissionAuthority.Request.parse(asked.payload),
            cold: cold.pendingPermissions.map((request: unknown) => PermissionAuthority.Request.parse(request)),
            connected: snapshot.pendingPermissions.map((request: unknown) => PermissionAuthority.Request.parse(request)),
          }).toEqual({ warm: canonicalRequest, cold: [canonicalRequest], connected: [canonicalRequest] })
          expect({
            envelope: asked.summary,
            warm: asked.payload.summary,
            cold: cold.pendingPermissions[0].summary,
            connected: snapshot.pendingPermissions[0].summary,
          }).toEqual({
            envelope: canonicalRequest.summary,
            warm: canonicalRequest.summary,
            cold: canonicalRequest.summary,
            connected: canonicalRequest.summary,
          })
        } finally {
          snapshotAbort.abort()
          await snapshotStream.close()
        }
        const terminal = await PermissionAuthority.settleStale(current.request.id, "public input changed")
        const event = await stream.next("permission.terminated")
        expect(event.payload).toMatchObject({
          projectID: session.projectID,
          sessionID: session.id,
          requestID: current.request.id,
          ledgerEventID: terminal.eventID,
          status: "stale",
        })
        expect(await execution).toBeInstanceOf(PermissionAuthority.RejectedError)
        const rows = Database.use((db) =>
          db
            .select()
            .from(BusPublicationOutboxTable)
            .where(eq(BusPublicationOutboxTable.event_type, "permission.terminated"))
            .all(),
        )
        expect(rows.map((row) => row.properties)).toEqual([
          expect.objectContaining({ ledgerEventID: terminal.eventID, requestID: current.request.id, status: "stale" }),
        ])
      } finally {
        abort.abort()
        await stream.close()
        await PermissionAuthority.cancelPendingForSession(session.id, "contract finished")
        await execution
      }
    },
  })
})

test("connection cutover includes an admitted new child and reconnect reads the later durable decision", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      await Config.updateProjectPatch({ permission_mode: "ask" })
      ensureSessionProtocolBridge()
      const root = await Session.create({ kind: "assistant", title: "Cutover root" })
      let child: Session.Info | undefined, current: Awaited<ReturnType<typeof pending>> | undefined
      SessionEventStreamTestHooks.afterConversationSnapshotRead = async ({ sessionID }) => {
        if (sessionID !== root.id) return
        SessionEventStreamTestHooks.afterConversationSnapshotRead = undefined
        await Instance.provide({
          directory: project.path,
          fn: async () => {
            child = await Session.create({ kind: "assistant", parentID: root.id, title: "Child admitted at cutover" })
            current = await pending(child.id)
          },
        })
      }
      const headers = { "x-opencorvus-directory": project.path }
      const abort = new AbortController()
      const stream = events(await Server.App().request(`/session/${root.id}/events`, { headers, signal: abort.signal }))
      try {
        const connected = await stream.next("session.connected"),
          asked = await stream.next("permission.asked")
        expect(connected.payload.conversationSnapshot.pendingPermissions.map((item: any) => item.id)).toEqual([
          current!.request.id,
        ])
        expect({ id: asked.payload.id, sessionID: asked.session_id, orderKey: asked.orderKey }).toEqual({
          id: current!.request.id,
          sessionID: child!.id,
          orderKey: timelineOrderKey({
            domain: "interaction",
            time: current!.request.timeCreated,
            id: current!.request.id,
          }),
        })
        expect(stream.receivedTypes.slice(0, 2)).toEqual(["session.connected", "permission.asked"])
        abort.abort()
        await stream.close()
        await PermissionAuthority.reply({
          requestID: current!.request.id,
          decision: "deny",
          actorID: "offline-operator",
        })
        expect(await current!.execution).toBeInstanceOf(PermissionAuthority.RejectedError)
        const reconnectAbort = new AbortController()
        const reconnect = events(
          await Server.App().request(`/session/${root.id}/events`, { headers, signal: reconnectAbort.signal }),
        )
        try {
          expect((await reconnect.next("session.connected")).payload.conversationSnapshot.pendingPermissions).toEqual(
            [],
          )
        } finally {
          reconnectAbort.abort()
          await reconnect.close()
        }
      } finally {
        abort.abort()
        await stream.close()
        if (child) await PermissionAuthority.cancelPendingForSession(child.id, "contract finished")
        await current?.execution
      }
    },
  })
})

test("cancelled decision and replay preserve one immutable terminal publication", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      await Config.updateProjectPatch({ permission_mode: "ask" })
      const session = await Session.create({ kind: "assistant", title: "Cancelled permission" })
      const current = await pending(session.id)
      try {
        expect(await PermissionAuthority.cancelPendingForSession(session.id, "owner removed")).toBe(1)
        const replay = await PermissionAuthority.settleStale(current.request.id, "later retry")
        expect(await current.execution).toBeInstanceOf(PermissionAuthority.RejectedError)
        const rows = Database.use((db) =>
          db
            .select()
            .from(BusPublicationOutboxTable)
            .where(eq(BusPublicationOutboxTable.event_type, "permission.terminated"))
            .all(),
        )
        expect(rows.map((row) => row.properties)).toEqual([
          expect.objectContaining({
            projectID: session.projectID,
            sessionID: session.id,
            requestID: current.request.id,
            ledgerEventID: replay.eventID,
            status: "cancelled",
          }),
        ])
      } finally {
        await PermissionAuthority.cancelPendingForSession(session.id, "contract finished")
        await current.execution
      }
    },
  })
})

test("public TCP Session Prompt streams an actual read, accepts public approval and persists its completed output", async () => {
  await using project = await memoryProject()
  const file = path.join(path.dirname(project.path), `public-permission-${Identifier.ascending("part")}.csv`)
  await fs.writeFile(file, "item,quantity\nMaple,3\nIris,4\n")
  const provider = startControlledStreamingProvider({
    firstPromptToolCall: { name: "read", arguments: { filePath: file } },
  })
  const release = setInterval(() => {
    for (const request of provider.requests) request.release()
  }, 5)
  const model = { providerID: "permission-contract", modelID: "session-prompt-owner-model" }
  let server: ReturnType<typeof Server.listen> | undefined
  let prompt: Promise<Response> | undefined, sessionID: string | undefined
  const sender = new AbortController()
  try {
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Config.updateGlobalPatch({
          model: `${model.providerID}/${model.modelID}`,
          small_model: `${model.providerID}/${model.modelID}`,
          permission_mode: "ask",
          prompt_profile: { active: "base" },
          enabled_providers: [model.providerID],
          provider: {
            [model.providerID]: {
              npm: "@ai-sdk/openai-compatible",
              api: provider.apiURL,
              options: { apiKey: "local-controlled-provider" },
              models: {
                [model.modelID]: {
                  name: "Local permission contract",
                  tool_call: true,
                  modalities: { input: ["text"], output: ["text"] },
                  limit: { context: 1_000_000, output: 4096 },
                },
              },
            },
          },
        })
        await Config.updateProjectPatch({ mcp: { browser: { enabled: false }, computer: { enabled: false } } })
      },
    })
    server = Server.listen({ hostname: "127.0.0.1", port: 0, randomPort: true })
    const headers = { "content-type": "application/json", "x-opencorvus-directory": project.path }
    const created = await fetch(new URL("/session", server.url), {
      method: "POST",
      headers,
      body: JSON.stringify({ kind: "assistant", title: "Public permission protocol" }),
    })
    expect(created.status).toBe(200)
    const session = (await created.json()) as any
    sessionID = session.id
    prompt = fetch(new URL(`/session/${sessionID}/message`, server.url), {
      method: "POST",
      headers,
      signal: sender.signal,
      body: JSON.stringify({
        messageID: Identifier.ascending("message"),
        agent: "chat",
        model,
        parts: [{ type: "text", text: `Read the public CSV at ${file}.` }],
      }),
    })
    void prompt.catch(() => undefined)
    let requested: any
    const deadline = Date.now() + 20_000
    while (!requested && Date.now() < deadline) {
      const response = await fetch(new URL(`/session/${sessionID}/conversation`, server.url), { headers })
      const hydration = (await response.json()) as any
      requested = hydration.pendingPermissions?.find((item: any) => item.sessionID === sessionID)
      if (!requested) await Bun.sleep(50)
    }
    if (!requested) throw new Error("Actual read did not expose pending Permission within 20000ms")
    expect(requested).toMatchObject({
      projectID: session.projectID,
      toolName: "read",
      scope: { resource: { paths: [expect.stringContaining("public-permission-")] } },
    })
    const reply = await fetch(new URL(`/permission/${requested.id}/reply`, server.url), {
      method: "POST",
      headers,
      body: JSON.stringify({ decision: "allow_once", message: "Approve this public CSV read" }),
    })
    expect({ status: reply.status, body: await reply.json() }).toMatchObject({
      status: 200,
      body: { request: { id: requested.id }, decision: "allow_once" },
    })
    const response = await prompt,
      result = (await response.json()) as any
    expect({ status: response.status, info: result.info, parts: result.parts }).toMatchObject({
      status: 200,
      info: { role: "assistant", finish: "stop", time: { completed: expect.any(Number) } },
      parts: expect.arrayContaining([
        expect.objectContaining({ type: "text", text: expect.stringMatching(/^provider reply /) }),
      ]),
    })
    const history = await fetch(new URL(`/session/${sessionID}/message`, server.url), { headers })
    const messages = (await history.json()) as any[]
    const read = messages.flatMap((item) => item.parts).find((part) => part.type === "tool" && part.tool === "read")
    expect(read).toMatchObject({ state: { status: "completed", output: expect.stringContaining("Maple,3") } })
    expect(provider.promptRequests().map((request) => request.body)).toEqual(
      expect.arrayContaining([expect.objectContaining({ model: model.modelID, stream: true })]),
    )
    const current = await fetch(new URL(`/session/${sessionID}/conversation`, server.url), { headers })
    expect(((await current.json()) as any).pendingPermissions).toEqual([])
  } finally {
    if (sessionID)
      await Instance.provide({
        directory: project.path,
        fn: () => PermissionAuthority.cancelPendingForSession(sessionID!, "contract finished"),
      })
    sender.abort()
    await prompt?.catch(() => undefined)
    await server?.stop(true)
    clearInterval(release)
    for (const request of provider.requests) request.release()
    await Promise.all(provider.requests.map((request) => request.responded))
    await provider.server.stop(true)
    await fs.rm(file)
  }
}, 60_000)
