import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { Hono } from "hono"
import path from "node:path"
import { readFile } from "node:fs/promises"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import { Provider, type Provider as ProviderType } from "../../src/provider/provider"
import { serverErrorResponse } from "../../src/server/error-handler"
import { SessionRoutes } from "../../src/server/routes/session"
import { Session } from "../../src/session"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

const model = { providerID: "test", modelID: "direct-session-shell" }

function providerModel(): ProviderType.Model {
  return {
    id: model.modelID,
    providerID: model.providerID,
    name: "Direct Session Shell Test",
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
    api: { id: model.modelID, url: "https://direct-session-shell.test.invalid", npm: "@ai-sdk/anthropic" },
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

describe("public Session shell identity", () => {
  test("a replayed shell request returns the durable occurrence without running the command again", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Shell replay identity" })
        const messageID = Identifier.ascending("message")
        const effectFile = path.join(project.path, "shell-replay-effect.txt").replaceAll("\\", "/")
        const provider = spyOn(Provider, "getModel").mockResolvedValue(providerModel())
        try {
          const app = new Hono().route("/session", SessionRoutes())
          app.onError(serverErrorResponse)
          const body = {
            messageID,
            agent: "chat",
            model,
            command: `bun -e "require('fs').appendFileSync('${effectFile}','ran;')"`,
          }
          const send = () =>
            app.fetch(
              new Request(`http://opencorvus.test/session/${session.id}/shell`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
              }),
            )

          const commandRuns = async () =>
            ((await readFile(effectFile, "utf8").catch(() => "")).match(/ran;/g) ?? []).length

          const firstResponse = await send()
          const first = (await firstResponse.json()) as any
          expect({
            status: firstResponse.status,
            role: first.info.role,
            parentID: first.info.parentID,
            toolPart: first.parts[0]?.tool,
            commandRuns: await commandRuns(),
          }).toEqual({
            status: 200,
            role: "assistant",
            parentID: messageID,
            toolPart: "bash",
            commandRuns: 1,
          })

          const retryResponse = await send()
          const retry = (await retryResponse.json()) as any
          expect({
            status: retryResponse.status,
            sameAssistant: retry.info.id === first.info.id,
            commandRuns: await commandRuns(),
          }).toEqual({
            status: 200,
            sameAssistant: true,
            commandRuns: 1,
          })
        } finally {
          provider.mockRestore()
        }
      },
    })
  }, 60_000)
})
