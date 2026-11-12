import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { Hono } from "hono"
import path from "node:path"
import { writeFile } from "node:fs/promises"
import { Config } from "../../src/config/config"
import { Identifier } from "../../src/id/id"
import { ComputerMCPBuiltin } from "../../src/mcp/computer/builtin"
import { Plugin } from "../../src/plugin"
import { Instance } from "../../src/project/instance"
import { Provider, type Provider as ProviderType } from "../../src/provider/provider"
import { serverErrorResponse } from "../../src/server/error-handler"
import { SessionRoutes } from "../../src/server/routes/session"
import { Session } from "../../src/session"
import { SessionProcessor } from "../../src/session/processor"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

const model = { providerID: "test", modelID: "direct-session-command" }

function providerModel(): ProviderType.Model {
  return {
    id: model.modelID,
    providerID: model.providerID,
    name: "Direct Session Command Test",
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
    api: { id: model.modelID, url: "https://direct-session-command.test.invalid", npm: "@ai-sdk/anthropic" },
    options: {},
    headers: {},
    status: "active",
    release_date: "2026-08-14",
  } as ProviderType.Model
}

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("public Session command identity", () => {
  test("a replayed command keeps one expanded input with literal arguments and its declared file", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Config.updateProjectPatch({
          mcp: { [ComputerMCPBuiltin.ServerName]: { ...ComputerMCPBuiltin.localConfig(), enabled: false } },
        })
        const filename = "declared source.txt"
        await writeFile(path.join(project.path, filename), "Contents of the declared command file.\n")
        await Config.updateProjectPatch({
          command: {
            "replay-probe": {
              template: "Read @$1 now. Details <$2>. Entire <$ARGUMENTS>.",
              agent: "chat",
            },
          },
        })
        const session = await Session.create({ kind: "assistant", title: "Command replay identity" })
        const messageID = Identifier.ascending("message")
        const details = "Keep $$ and $& with $ARGUMENTS"
        const argumentsText = `"${filename}" ${details}`
        let physicalTurns = 0
        const hooks = spyOn(Plugin, "trigger")
        const preparations = () => hooks.mock.calls.filter(([hook]) => hook === "command.execute.before").length
        const provider = spyOn(Provider, "getModel").mockResolvedValue(providerModel())
        const processor = spyOn(SessionProcessor, "create").mockImplementation((input: any) => {
          const assistant = input.assistantMessage
          return {
            message: assistant,
            partFromToolCall() {
              return undefined
            },
            async process() {
              physicalTurns += 1
              await Session.updatePart({
                id: Identifier.ascending("part"),
                sessionID: assistant.sessionID,
                messageID: assistant.id,
                type: "text",
                text: "one durable command reply",
              })
              assistant.finish = "stop"
              assistant.time.completed = Date.now()
              await Session.updateMessage(assistant)
              return "stop"
            },
          } as any
        })
        try {
          const app = new Hono().route("/session", SessionRoutes())
          app.onError(serverErrorResponse)
          const body = {
            messageID,
            command: "replay-probe",
            arguments: argumentsText,
            model: `${model.providerID}/${model.modelID}`,
          }
          const send = () =>
            app.fetch(
              new Request(`http://opencorvus.test/session/${session.id}/command`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
              }),
            )

          const firstResponse = await send()
          const first = (await firstResponse.json()) as any
          expect({
            status: firstResponse.status,
            parentID: first.info.parentID,
            role: first.info.role,
            physicalTurns,
            preparations: preparations(),
          }).toEqual({
            status: 200,
            parentID: messageID,
            role: "assistant",
            physicalTurns: 1,
            preparations: 1,
          })

          const retryResponse = await send()
          const retry = (await retryResponse.json()) as any
          expect({
            status: retryResponse.status,
            sameAssistant: retry.info.id === first.info.id,
            physicalTurns,
            preparations: preparations(),
          }).toEqual({
            status: 200,
            sameAssistant: true,
            physicalTurns: 1,
            preparations: 1,
          })
          const messages = await Session.messages({ sessionID: session.id })
          const input = messages.find(({ info }) => info.id === messageID)
          expect(input?.parts).toMatchObject([
            { type: "text", text: `Read @${filename} now. Details <${details}>. Entire <${argumentsText}>.` },
            { type: "text" },
            { type: "text", text: expect.stringContaining("Contents of the declared command file.") },
            { type: "file", filename, mime: "text/plain" },
          ])
        } finally {
          hooks.mockRestore()
          processor.mockRestore()
          provider.mockRestore()
        }
      },
    })
  }, 60_000)

  test("a replayed init converges on the first occurrence's Turn", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Config.updateProjectPatch({
          mcp: { [ComputerMCPBuiltin.ServerName]: { ...ComputerMCPBuiltin.localConfig(), enabled: false } },
        })
        const session = await Session.create({ kind: "assistant", title: "Init replay identity" })
        const messageID = Identifier.ascending("message")
        let physicalTurns = 0
        const provider = spyOn(Provider, "getModel").mockResolvedValue(providerModel())
        const processor = spyOn(SessionProcessor, "create").mockImplementation((input: any) => {
          const assistant = input.assistantMessage
          return {
            message: assistant,
            partFromToolCall() {
              return undefined
            },
            async process() {
              physicalTurns += 1
              await Session.updatePart({
                id: Identifier.ascending("part"),
                sessionID: assistant.sessionID,
                messageID: assistant.id,
                type: "text",
                text: "one durable init reply",
              })
              assistant.finish = "stop"
              assistant.time.completed = Date.now()
              await Session.updateMessage(assistant)
              return "stop"
            },
          } as any
        })
        try {
          const app = new Hono().route("/session", SessionRoutes())
          app.onError(serverErrorResponse)
          const body = { messageID, providerID: model.providerID, modelID: model.modelID }
          const send = () =>
            app.fetch(
              new Request(`http://opencorvus.test/session/${session.id}/init`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
              }),
            )

          const first = await send()
          expect({ status: first.status, physicalTurns }).toEqual({ status: 200, physicalTurns: 1 })

          const retry = await send()
          expect({ status: retry.status, physicalTurns }).toEqual({ status: 200, physicalTurns: 1 })
        } finally {
          processor.mockRestore()
          provider.mockRestore()
        }
      },
    })
  }, 60_000)
})
