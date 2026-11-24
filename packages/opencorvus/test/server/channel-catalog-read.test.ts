import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { ChannelRegistry } from "../../src/channel/registry"
import type { Config } from "../../src/config/config"
import { ConfigPaths } from "../../src/config/paths"
import { Instance, runOutsideInstanceContext } from "../../src/project/instance"
import { setServerUrl } from "../../src/server/runtime-url"
import { Server } from "../../src/server/server"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await resetMemoryDatabase()
})

async function writeChannelConfig(directory: string, channel: Config.Info["channel"]) {
  const file = ConfigPaths.projectFile(directory)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify({ channel }))
}

async function readCatalog(directory: string) {
  const response = await runOutsideInstanceContext(() => Server.App().request("/channel", {
    headers: { "x-opencorvus-directory": directory },
  }))
  expect(response.status).toBe(200)
  return ChannelRegistry.Info.array().parse(await response.json())
}

test("cold protected projects expose the current channel catalog and exact scoped configuration", async () => {
  await using first = await memoryProject("channel-catalog-configured")
  await using second = await memoryProject("channel-catalog-disabled")
  for (const project of [first, second]) await fs.mkdir(path.join(project.path, ".gitignore"))
  await writeChannelConfig(first.path, { irc: { enabled: true, host: "127.0.0.1", nick: "owned-test" } })
  await writeChannelConfig(second.path, { irc: { enabled: false } })

  const catalogs = [await readCatalog(first.path), await readCatalog(second.path)]
  expect(catalogs.map((catalog) => catalog.length)).toEqual([27, 27])
  expect(catalogs.map((catalog) => catalog.find((entry) => entry.id === "irc"))).toMatchObject([
    { name: "IRC", status: "configured", runtime_status: "unavailable" },
    { name: "IRC", status: "disabled", runtime_status: "unavailable" },
  ])
}, 60_000)

test("a cold protected catalog publishes the existing managed runtime after one real startup handshake", async () => {
  await using project = await memoryProject("channel-catalog-real-adapter")
  await using unavailable = await memoryProject("channel-catalog-failed-adapter")
  await fs.mkdir(path.join(project.path, ".gitignore"))
  await fs.mkdir(path.join(unavailable.path, ".gitignore"))
  const requests = { whoami: 0, sync: 0, declined: 0 }
  const firstSync = Promise.withResolvers<void>()
  const peer = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      switch (new URL(request.url).pathname) {
        case "/_matrix/client/v3/account/whoami":
          requests.whoami++
          await Bun.sleep(50)
          return Response.json({ user_id: "@owned-test:local" })
        case "/_matrix/client/v3/sync":
          requests.sync++
          firstSync.resolve()
          await Bun.sleep(50)
          return Response.json({ next_batch: String(requests.sync), rooms: { join: {} } })
        case "/unavailable/_matrix/client/v3/account/whoami":
          requests.declined++
          return new Response("Local handshake unavailable", { status: 503 })
        default:
          return new Response("Unexpected local protocol path", { status: 404 })
      }
    },
  })
  try {
    setServerUrl(peer.url)
    await writeChannelConfig(project.path, {
      matrix: { enabled: true, homeserver: peer.url.origin, token: crypto.randomUUID() },
    })
    const first = await Promise.all([readCatalog(project.path), readCatalog(project.path)])
    await firstSync.promise
    const repeated = await readCatalog(project.path)

    const running = { id: "matrix", status: "configured", runtime_status: "running" }
    expect([...first, repeated].map((catalog) => catalog.find((entry) => entry.id === "matrix"))).toMatchObject([
      running, running, running,
    ])

    await writeChannelConfig(unavailable.path, {
      matrix: { enabled: true, homeserver: new URL("/unavailable", peer.url).href, token: crypto.randomUUID() },
    })
    const failed = await readCatalog(unavailable.path)
    const repeatedFailure = await readCatalog(unavailable.path)
    const refused = {
      id: "matrix",
      status: "configured",
      runtime_status: "disabled",
      runtime_detail: expect.stringContaining("Channel runtime failed:"),
    }
    expect([failed, repeatedFailure].map((catalog) => catalog.find((entry) => entry.id === "matrix"))).toMatchObject([
      refused, refused,
    ])
    const stillRunning = await readCatalog(project.path)
    expect(stillRunning.find((entry) => entry.id === "matrix")).toMatchObject(running)
    expect({ runningAttempts: requests.whoami, declinedAttempts: requests.declined }).toEqual({
      runningAttempts: 1,
      declinedAttempts: 1,
    })
  } finally {
    await Instance.disposeAll()
    await peer.stop()
  }
}, 60_000)
