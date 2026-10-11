import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { ConfigPaths } from "../../src/config/paths"
import { Identifier } from "../../src/id/id"
import { publishInteractiveArtifact } from "../../src/interactive-artifact/persist"
import { Instance, runOutsideInstanceContext } from "../../src/project/instance"
import { Server } from "../../src/server/server"
import { Session } from "../../src/session"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function publish(directory: string, title: string) {
  const record = await Instance.provide({
    directory,
    fn: async () => {
      const session = await Session.create({ kind: "assistant", title })
      const user = await Session.updateMessage({
        id: Identifier.ascending("message"), sessionID: session.id, role: "user", author: "user",
        agent: "test-agent", time: { created: 1 }, model: { providerID: "historical", modelID: "historical" },
      })
      const message = await Session.updateMessage({
        id: Identifier.ascending("message"), sessionID: session.id, role: "assistant", author: "test-agent",
        time: { created: 1, completed: 2 }, parentID: user.id, modelID: "historical", providerID: "historical",
        mode: "test", agent: "test-agent", path: { cwd: directory, root: directory }, cost: 0,
        tokens: { total: 3, input: 1, output: 1, reasoning: 1, cache: { read: 0, write: 0 } },
      })
      return publishInteractiveArtifact({
        sessionID: session.id, messageID: message.id,
        payload: {
          renderer: "diff@1", schemaVersion: "1", title, language: "typescript",
          original: `// ${title}\nconst value = 1\n`, modified: `// ${title}\nconst value = 2\n`,
        },
      })
    },
  })
  const config = ConfigPaths.projectFile(directory)
  await fs.mkdir(path.dirname(config), { recursive: true })
  await fs.writeFile(config, JSON.stringify({ model: "historical-unavailable/model", small_model: "historical-unavailable/model" }))
  return record
}

async function read(directory: string, sessionID: string, artifactID: string) {
  await Instance.disposeAll()
  const response = await runOutsideInstanceContext(() => Server.App().request(
    `/session/${sessionID}/interactive-artifact/${artifactID}`,
    { headers: { "x-opencorvus-directory": directory } },
  ))
  return { status: response.status, cache: response.headers.get("cache-control"), body: await response.json() }
}

test("cold artifact reads return each Project's complete persisted record with unavailable execution models", async () => {
  await using first = await memoryProject("interactive-artifact-first")
  await using second = await memoryProject("interactive-artifact-second")
  const records = [
    { directory: first.path, record: await publish(first.path, "First review") },
    { directory: second.path, record: await publish(second.path, "Second review") },
  ]
  for (const { directory, record } of records) {
    expect(await read(directory, record.sessionID, record.id)).toEqual({ status: 200, cache: "no-store", body: record })
  }
}, 30_000)

test("artifact reads enforce the exact Project and producing Session with explicit not-found responses", async () => {
  await using owner = await memoryProject("interactive-artifact-owner")
  await using foreign = await memoryProject("interactive-artifact-foreign")
  const record = await publish(owner.path, "Owned review")
  const expected = {
    status: 404,
    body: { name: "NotFoundError", data: { message: `Interactive artifact not found: ${record.id}` } },
  }
  expect(await read(foreign.path, record.sessionID, record.id)).toMatchObject(expected)
  expect(await read(owner.path, Identifier.ascending("session"), record.id)).toMatchObject(expected)
}, 30_000)
