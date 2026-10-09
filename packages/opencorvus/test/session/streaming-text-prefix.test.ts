import { afterEach, expect, test } from "bun:test"
import http from "node:http"
import { once } from "node:events"
import { PrimaryAssistantRegistry } from "@/agent/primary-assistant-registry"
import { sessionRuntimeFromNativeAgent } from "@/agent/session-agent-runtime"
import { Bus } from "@/bus"
import { Config } from "@/config/config"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Provider } from "@/provider/provider"
import { Server } from "@/server/server"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { MessageStore } from "@/session/message-store"
import { SessionProcessor } from "@/session/processor"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

/** A real TCP Provider holds its HTTP response after the first text chunk.
 * The production SDK, stream reader, processor and canonical writers run. */
async function prefixProvider(prefix: string, suffix: string, failFirst = false) {
  const release = Promise.withResolvers<void>()
  const prefixSent = Promise.withResolvers<void>()
  let phase = "awaiting-request"
  const requests: any[] = []
  const sockets = new Set<import("node:net").Socket>()
  const closed: Promise<void>[] = []
  const server = http.createServer(async (request, response) => {
    let source = ""
    for await (const chunk of request) source += String(chunk)
    const body = JSON.parse(source)
    requests.push(body)
    const first = requests.length === 1
    response.on("close", () => {
      if (!response.writableEnded) {
        phase = "cancelled"
        release.resolve()
      }
    })
    response.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      "transfer-encoding": "chunked",
    })
    const chunk = (delta: Record<string, unknown>, finish: string | null = null) => {
      response.write(
        `data: ${JSON.stringify({
          id: "chatcmpl-prefix-checker",
          object: "chat.completion.chunk",
          created: 1,
          model: "prefix-checker",
          choices: [{ index: 0, delta, finish_reason: finish }],
        })}\n\n`,
      )
    }
    chunk({ role: "assistant" })
    chunk({ content: prefix })
    phase = "prefix-held"
    prefixSent.resolve()
    await release.promise
    if (response.destroyed) return
    try {
      if (failFirst && first) {
        phase = "network-failed"
        response.destroy()
        return
      }
      chunk({ content: suffix })
      chunk({}, "stop")
      response.end("data: [DONE]\n\n")
      phase = "completed"
    } catch {
      phase = "cancelled"
    }
  })
  server.on("connection", (socket) => {
    sockets.add(socket)
    closed.push(
      new Promise<void>((resolve) =>
        socket.once("close", () => {
          sockets.delete(socket)
          resolve()
        }),
      ),
    )
  })
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("Owned prefix HTTP bind failed")
  return {
    requests,
    release: release.resolve,
    prefixSent: prefixSent.promise,
    phase: () => phase,
    api: `http://127.0.0.1:${address.port}/v1`,
    stop: async () => {
      release.resolve()
      const stopped = new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      )
      server.closeAllConnections()
      for (const socket of sockets) socket.destroy()
      await Promise.all([stopped, ...closed])
    },
  }
}

function inactivityReceipt<T>(label: string) {
  const result = Promise.withResolvers<T>()
  let timer: ReturnType<typeof setTimeout> | undefined
  const progress = () => {
    clearTimeout(timer)
    timer = setTimeout(() => result.reject(new Error(`${label}: no accepted progress for 1500ms`)), 1500)
  }
  return { promise: result.promise, progress, resolve: result.resolve, dispose: () => clearTimeout(timer) }
}

async function connectedFrame(response: Response) {
  if (!response.body) throw new Error("Actual Session SSE has no body")
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let text = ""
  try {
    while (true) {
      const result = await reader.read()
      if (result.done) throw new Error("Actual Session SSE ended before connection frame")
      text += decoder.decode(result.value, { stream: true })
      const frames = text.split("\n\n")
      text = frames.pop() ?? ""
      for (const frame of frames) {
        const data = frame
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n")
        if (!data) continue
        const event = JSON.parse(data)
        if (event.type === "session.connected") return event
      }
    }
  } finally {
    await reader.cancel()
    reader.releaseLock()
  }
}

type PrefixFixture = {
  provider: Awaited<ReturnType<typeof prefixProvider>>
  directory: string
  projectID: string
  sessionID: string
  assistantID: string
  controller: AbortController
  start: () => ReturnType<ReturnType<typeof SessionProcessor.create>["process"]>
}

async function withPrefixProcessor<T>(
  prefix: string,
  suffix: string,
  run: (fixture: PrefixFixture) => Promise<T>,
  failFirst = false,
): Promise<T> {
  const provider = await prefixProvider(prefix, suffix, failFirst)
  await using project = await memoryProject()
  try {
    return await Instance.provide({
      directory: project.path,
      fn: async () => {
        const ref = { providerID: "prefix-checker", modelID: "prefix-checker" }
        await Config.updateProjectPatch({
          model: `${ref.providerID}/${ref.modelID}`,
          provider: {
            [ref.providerID]: {
              name: "Local prefix checker",
              npm: "@ai-sdk/openai-compatible",
              api: provider.api,
              options: { apiKey: "local-controlled-provider" },
              models: {
                [ref.modelID]: {
                  name: "Local prefix checker",
                  tool_call: true,
                  modalities: { input: ["text"], output: ["text"] },
                  limit: { context: 32000, output: 4096 },
                },
              },
            },
          },
        })
        const model = await Provider.getModel(ref.providerID, ref.modelID)
        const agent = sessionRuntimeFromNativeAgent(
          await PrimaryAssistantRegistry.get("coding", { config: await Config.get() }),
        )
        const session = await Session.create({ kind: "assistant", title: "Running text prefix" })
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "user",
          agent: "coding",
          time: { created: Date.now() },
          model: ref,
        })
        const assistant = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          parentID: user.id,
          role: "assistant",
          author: "coding",
          agent: "coding",
          providerID: ref.providerID,
          modelID: ref.modelID,
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          time: { created: Date.now() },
        })
        if (assistant.role !== "assistant" || user.role !== "user") throw new Error("Actual participant roles required")
        const controller = new AbortController()
        const processor = SessionProcessor.create({
          assistantMessage: assistant,
          sessionID: session.id,
          model,
          abort: controller.signal,
        })
        let running: ReturnType<typeof processor.process> | undefined
        try {
          return await run({
            provider,
            directory: project.path,
            projectID: Instance.project.id,
            sessionID: session.id,
            assistantID: assistant.id,
            controller,
            start: () => {
              if (running) throw new Error("Each owned processor starts once")
              running = processor.process({
                user,
                agentID: "coding",
                agent,
                abort: controller.signal,
                sessionID: session.id,
                system: [],
                messages: [{ role: "user", content: "Stream the supplied prefix and suffix." }],
                tools: {},
                model,
              })
              return running
            },
          })
        } finally {
          provider.release()
          controller.abort(new DOMException("Owned prefix checker complete", "AbortError"))
          if (running) await running
        }
      },
    })
  } finally {
    await provider.stop()
  }
}

function observePrefix(fixture: PrefixFixture, prefix: string) {
  const checkpoint = inactivityReceipt<Message.TextPart>(`Canonical prefix ${fixture.sessionID}`)
  const deltas: string[] = []
  const starts = new Map<string, number>()
  const completed: { id: string; time: { start: number; end: number } }[] = []
  const stopDelta = Bus.subscribe(Message.Event.PartDelta, (event) => {
    if (event.properties.sessionID !== fixture.sessionID || event.properties.messageID !== fixture.assistantID) return
    checkpoint.progress()
    if (event.properties.partType === "text") deltas.push(event.properties.delta)
  })
  const stopPart = Bus.subscribe(Message.Event.PartUpdated, (event) => {
    const part = event.properties.part
    if (part.sessionID !== fixture.sessionID || part.messageID !== fixture.assistantID || part.type !== "text") return
    checkpoint.progress()
    if (part.time) {
      if (!starts.has(part.id)) starts.set(part.id, part.time.start)
      if (typeof part.time.end === "number")
        completed.push({ id: part.id, time: { start: part.time.start, end: part.time.end } })
    }
    if (part.text === prefix) checkpoint.resolve(part)
  })
  return {
    promise: checkpoint.promise,
    deltas,
    starts,
    completed,
    dispose: () => {
      checkpoint.dispose()
      stopPart()
      stopDelta()
    },
  }
}

test("a running HTTP Provider persists its exact prefix for a late Session subscriber and completes the same Part", async () => {
  const prefix = "First paragraph 🌐.\n\nSecond paragraph 中文."
  const suffix = "\n\nNatural completed suffix."
  await withPrefixProcessor(prefix, suffix, async (fixture) => {
    const observed = observePrefix(fixture, prefix)
    const running = fixture.start()
    try {
      const published = await observed.promise
      expect(published.time?.start).toEqual(expect.any(Number))
      const startedAt = published.time!.start
      const persisted = await MessageStore.get({ sessionID: fixture.sessionID, messageID: fixture.assistantID })
      expect({
        phase: fixture.provider.phase(),
        published,
        text: persisted.parts.find((part) => part.id === published.id),
      }).toMatchObject({
        phase: "prefix-held",
        published: { sessionID: fixture.sessionID, messageID: fixture.assistantID, type: "text", text: prefix },
        text: {
          id: published.id,
          sessionID: fixture.sessionID,
          messageID: fixture.assistantID,
          type: "text",
          text: prefix,
        },
      })
      const abort = new AbortController()
      try {
        const response = await Server.App().request(`/session/${fixture.sessionID}/events`, {
          headers: { "x-opencorvus-directory": fixture.directory },
          signal: abort.signal,
        })
        expect(response.status).toBe(200)
        const connected = await connectedFrame(response)
        const restored = connected.payload.conversationSnapshot.transcript.find(
          (entry: any) => entry.info.id === fixture.assistantID,
        )
        expect(restored.parts.find((part: any) => part.id === published.id)).toMatchObject({
          id: published.id,
          text: prefix,
          time: { start: startedAt },
        })
      } finally {
        abort.abort()
      }
      fixture.provider.release()
      expect(await running).toBe("continue")
      const complete = await MessageStore.get({ sessionID: fixture.sessionID, messageID: fixture.assistantID })
      const finishedPart = complete.parts.find(
        (part): part is Message.TextPart => part.id === published.id && part.type === "text",
      )!
      const finishedTime = { ...finishedPart.time! }
      expect(finishedTime.start).toBe(startedAt)
      expect(finishedTime.end).toBeGreaterThan(startedAt)
      expect(observed.completed).toContainEqual({ id: published.id, time: finishedTime })
      expect({
        phase: fixture.provider.phase(),
        finish: complete.info.role === "assistant" ? complete.info.finish : "invalid-role",
        text: complete.parts.find((part) => part.id === published.id),
        deltaText: observed.deltas.join(""),
      }).toMatchObject({
        phase: "completed",
        finish: "stop",
        text: {
          id: published.id,
          type: "text",
          text: prefix + suffix,
          time: { start: startedAt, end: expect.any(Number) },
        },
        deltaText: prefix + suffix,
      })
      expect(fixture.provider.requests[0]).toMatchObject({ model: "prefix-checker", stream: true })
    } finally {
      observed.dispose()
    }
  })
}, 30_000)

test("natural short completion commits its complete text and stream deltas", async () => {
  await withPrefixProcessor("Short 🌐", " completed.", async (fixture) => {
    const observed = observePrefix(fixture, "Short 🌐")
    try {
      const running = fixture.start()
      await fixture.provider.prefixSent
      fixture.provider.release()
      expect(await running).toBe("continue")
      const complete = await MessageStore.get({ sessionID: fixture.sessionID, messageID: fixture.assistantID })
      const finishedPart = complete.parts.find((part): part is Message.TextPart => part.type === "text")!
      expect(observed.starts.get(finishedPart.id)).toEqual(expect.any(Number))
      const finishedTime = { ...finishedPart.time! }
      expect(finishedTime.start).toBe(observed.starts.get(finishedPart.id)!)
      expect(finishedTime.end).toBeGreaterThanOrEqual(observed.starts.get(finishedPart.id)!)
      expect(observed.completed).toContainEqual({ id: finishedPart.id, time: finishedTime })
      expect({
        parts: complete.parts.filter((part) => part.type === "text"),
        deltas: observed.deltas.join(""),
      }).toMatchObject({
        parts: [
          {
            type: "text",
            text: "Short 🌐 completed.",
            time: { start: observed.starts.get(finishedPart.id), end: expect.any(Number) },
          },
        ],
        deltas: "Short 🌐 completed.",
      })
    } finally {
      observed.dispose()
    }
  })
}, 30_000)

test("external cancellation finalizes the exact accepted partial text under the existing error contract", async () => {
  const prefix = "Accepted partial 中文 🌐."
  await withPrefixProcessor(prefix, " Later suffix.", async (fixture) => {
    const observed = observePrefix(fixture, prefix)
    try {
      const running = fixture.start()
      const published = await observed.promise
      expect(published.time?.start).toEqual(expect.any(Number))
      const startedAt = published.time!.start
      fixture.controller.abort(new DOMException("Owned external cancellation", "AbortError"))
      expect(await running).toBe("stop")
      const complete = await MessageStore.get({ sessionID: fixture.sessionID, messageID: fixture.assistantID })
      const finishedPart = complete.parts.find(
        (part): part is Message.TextPart => part.id === published.id && part.type === "text",
      )!
      const finishedTime = { ...finishedPart.time! }
      expect(finishedTime.start).toBe(startedAt)
      expect(finishedTime.end).toBeGreaterThan(startedAt)
      expect(observed.completed).toContainEqual({ id: published.id, time: finishedTime })
      expect({ info: complete.info, text: complete.parts.find((part) => part.id === published.id) }).toMatchObject({
        info: { finish: "error", error: { name: "MessageAbortedError" }, time: { completed: expect.any(Number) } },
        text: { id: published.id, type: "text", text: prefix, time: { start: startedAt, end: expect.any(Number) } },
      })
    } finally {
      observed.dispose()
    }
  })
}, 30_000)

test("a real interrupted HTTP attempt recovers to one complete accepted answer", async () => {
  const prefix = "Network attempt prefix."
  await withPrefixProcessor(
    prefix,
    " Recovered suffix.",
    async (fixture) => {
      const observed = observePrefix(fixture, prefix)
      try {
        const running = fixture.start()
        await observed.promise
        fixture.provider.release()
        expect(await running).toBe("continue")
        const complete = await MessageStore.get({ sessionID: fixture.sessionID, messageID: fixture.assistantID })
        const finishedPart = complete.parts.find((part): part is Message.TextPart => part.type === "text")!
        expect(observed.starts.get(finishedPart.id)).toEqual(expect.any(Number))
        const finishedTime = { ...finishedPart.time! }
        expect(finishedTime.start).toBe(observed.starts.get(finishedPart.id)!)
        expect(finishedTime.end).toBeGreaterThanOrEqual(observed.starts.get(finishedPart.id)!)
        expect(observed.completed).toContainEqual({ id: finishedPart.id, time: finishedTime })
        expect({
          finish: complete.info.role === "assistant" ? complete.info.finish : "invalid-role",
          parts: complete.parts.filter((part) => part.type === "text"),
          requests: fixture.provider.requests.length,
        }).toMatchObject({
          finish: "stop",
          parts: [
            {
              type: "text",
              text: prefix + " Recovered suffix.",
              time: { start: observed.starts.get(finishedPart.id), end: expect.any(Number) },
            },
          ],
          requests: 2,
        })
      } finally {
        observed.dispose()
      }
    },
    true,
  )
}, 30_000)

test("two concurrent Projects retain their own exact running prefix and final text", async () => {
  const ready = Promise.withResolvers<void>()
  const finished = Promise.withResolvers<void>()
  let readyCount = 0
  let finishedCount = 0
  const results = await Promise.all(
    ["Project A 🌐", "Project B 中文"].map((prefix) =>
      withPrefixProcessor(prefix, " complete.", async (fixture) => {
        const observed = observePrefix(fixture, prefix)
        let running: ReturnType<PrefixFixture["start"]> | undefined
        try {
          running = fixture.start()
          const published = await observed.promise
          expect(published.time?.start).toEqual(expect.any(Number))
          const startedAt = published.time!.start
          readyCount++
          if (readyCount === 2) ready.resolve()
          await ready.promise
          const persisted = await MessageStore.get({ sessionID: fixture.sessionID, messageID: fixture.assistantID })
          expect({
            phase: fixture.provider.phase(),
            part: persisted.parts.find((part) => part.id === published.id),
          }).toMatchObject({
            phase: "prefix-held",
            part: { sessionID: fixture.sessionID, messageID: fixture.assistantID, text: prefix },
          })
          fixture.provider.release()
          const outcome = await running
          const complete = await MessageStore.get({ sessionID: fixture.sessionID, messageID: fixture.assistantID })
          if (outcome !== "continue")
            console.info(
              "Concurrent original processor result",
              JSON.stringify({
                outcome,
                projectID: fixture.projectID,
                sessionID: fixture.sessionID,
                info: complete.info,
              }),
            )
          expect(outcome).toBe("continue")
          const finishedPart = complete.parts.find(
            (part): part is Message.TextPart => part.id === published.id && part.type === "text",
          )!
          const finishedTime = { ...finishedPart.time! }
          expect(finishedTime.start).toBe(startedAt)
          expect(finishedTime.end).toBeGreaterThan(startedAt)
          expect(observed.completed).toContainEqual({ id: published.id, time: finishedTime })
          expect(complete.parts.filter((part) => part.type === "text")).toMatchObject([
            { type: "text", text: prefix + " complete.", time: { start: startedAt, end: expect.any(Number) } },
          ])
          return { projectID: fixture.projectID, sessionID: fixture.sessionID }
        } finally {
          // Join both processors before either memoryProject can dispose the
          // shared instance registry, including when an assertion fails.
          fixture.provider.release()
          fixture.controller.abort(new DOMException("Owned concurrent checker complete", "AbortError"))
          try {
            if (running) await running
          } finally {
            finishedCount++
            if (finishedCount === 2) finished.resolve()
            ready.resolve()
            await finished.promise
            observed.dispose()
          }
        }
      }),
    ),
  )
  expect({
    projects: new Set(results.map((result) => result.projectID)).size,
    sessions: new Set(results.map((result) => result.sessionID)).size,
  }).toEqual({ projects: 2, sessions: 2 })
}, 30_000)
