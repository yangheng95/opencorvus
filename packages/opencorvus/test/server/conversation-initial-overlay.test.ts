import { afterEach, describe, expect, test } from "bun:test"
import { Server } from "../../src/server/server"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import { Instance } from "../../src/project/instance"
import { Config } from "../../src/config/config"
import { Session } from "../../src/session"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

const MODEL = "overlay-test-provider/overlay-test-model"

async function registerModel(directory: string) {
  await Instance.provide({
    directory,
    fn: async () => {
      await Config.updateProjectPatch({
        provider: {
          "overlay-test-provider": {
            name: "Overlay test provider",
            npm: "@ai-sdk/openai-compatible",
            api: "http://127.0.0.1:9/overlay-test-model",
            models: {
              "overlay-test-model": {
                name: "Overlay test model",
                tool_call: true,
                modalities: { input: ["text"], output: ["text"] },
                limit: { context: 1_000_000, output: 4_096 },
              },
            },
          },
        },
      })
    },
  })
}

describe("conversation creation commits its model overlay in the Session insert", () => {
  test("a Chat created with an explicit model publishes the Session already carrying the overlay", async () => {
    await using project = await memoryProject()
    await registerModel(project.path)

    const response = await Server.App().request("/coding/chat/session", {
      method: "POST",
      headers: { "x-opencorvus-directory": project.path, "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL }),
    })
    expect(response.status).toBe(201)
    const { session } = (await response.json()) as { session: { id: string; metadata?: Record<string, unknown> } }

    // The response Session — the first published fact — already carries the
    // validated overlay; there is no post-create patch to lose.
    expect((session.metadata as any)?.configOverlay?.model).toBe(MODEL)

    // The durable row is the same fact.
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const stored = await Session.get(session.id)
        expect((stored.metadata as any)?.configOverlay?.model).toBe(MODEL)
      },
    })
  }, 60_000)
})
