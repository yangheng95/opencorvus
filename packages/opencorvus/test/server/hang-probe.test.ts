import { expect, test, spyOn } from "bun:test"
import { Hono } from "hono"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import { Provider, type Provider as ProviderType } from "../../src/provider/provider"
import { serverErrorResponse } from "../../src/server/error-handler"
import { SessionRoutes } from "../../src/server/routes/session"
import { Session } from "../../src/session"
import { SessionProcessor } from "../../src/session/processor"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

const model = { providerID: "test", modelID: "direct-session-prompt" }

function providerModel(): ProviderType.Model {
  return {
    id: model.modelID,
    providerID: model.providerID,
    name: "Direct Session Prompt Test",
    limit: { context: 1_000_000, input: 900_000, output: 4_096 },
    cost: { available: true, input: 0, output: 0, cache: { read: 0, write: 0 } },
    capabilities: {
      toolcall: true,
      attachment: false,
      reasoning: false,
      temperature: true,
      interleaved: false,
      input: { text: true, image: false, audio: false, video: false, pdf: false },
      output: { text: true, image: false, audio: false, video: false, pdf: false },
    },
    api: { id: model.modelID, url: "https://direct-session-prompt.test.invalid", npm: "@ai-sdk/anthropic" },
    options: {},
    headers: {},
    status: "active",
    release_date: "2026-08-14",
  } as ProviderType.Model
}

test("probe overlapping second response", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "assistant", title: "probe overlap" })
      const started = [Promise.withResolvers<void>(), Promise.withResolvers<void>()]
      const releases = [Promise.withResolvers<void>(), Promise.withResolvers<void>()]
      const provider = spyOn(Provider, "getModel").mockResolvedValue(providerModel())
      const processor = spyOn(SessionProcessor, "create").mockImplementation((input: any) => {
        const assistant = input.assistantMessage
        const turnIndex = Math.min(started.length - 1, (processor.mock?.calls?.length ?? 1) - 1)
        return {
          message: assistant,
          partFromToolCall() {
            return undefined
          },
          async process() {
            started[turnIndex]!.resolve()
            await releases[turnIndex]!.promise
            assistant.finish = "stop"
            assistant.time.completed = Date.now()
            await Session.updateMessage(assistant)
            return "stop"
          },
        } as any
      })
      try {
        const app = new Hono().route("/session", SessionRoutes())
        app.onError((error, c) => { console.log("ROUTE ERROR:", error && (error.stack || error.message || String(error))); return serverErrorResponse(error as never, c as never) })
        const send = (text: string) =>
          app.fetch(
            new Request(`http://opencorvus.test/session/${session.id}/message`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                messageID: Identifier.ascending("message"),
                model,
                agent: "chat",
                parts: [{ type: "text", text }],
              }),
            }),
          )

        const firstResponse = send("first overlapping input")
        await started[0].promise
        console.log("turn one started")
        const secondResponse = send("second overlapping input")
        const winner = await Promise.race([
          secondResponse.then(async (r) => ({ kind: "response", status: r.status, body: await r.text() })),
          Bun.sleep(8000).then(() => ({ kind: "timeout" }) as any),
        ])
        console.log("SECOND:", JSON.stringify(winner).slice(0, 600))
        const users = (await Session.messages({ sessionID: session.id })).filter((m) => m.info.role === "user").length
        console.log("persisted users:", users)
        releases[0].resolve()
        releases[1].resolve()
        await firstResponse
        await secondResponse.catch(() => undefined)
        expect(true).toBe(true)
      } finally {
        processor.mockRestore()
        provider.mockRestore()
      }
    },
  })
  await Instance.disposeAll()
  await resetMemoryDatabase()
}, 30_000)
