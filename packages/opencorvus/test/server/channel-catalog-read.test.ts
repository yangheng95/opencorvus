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

function request(directory: string, route: string, init?: RequestInit) {
  return runOutsideInstanceContext(() => Server.App().request(route, {
    ...init,
    headers: { "x-opencorvus-directory": directory, "content-type": "application/json" },
  }))
}

async function readCatalog(directory: string) {
  const response = await request(directory, "/channel")
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

function startMatrixPeer() {
  const handshakes = new Map<string, number>()
  const firstSync = Promise.withResolvers<void>()
  const peer = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const match = /^(?:\/(west|alternate|unavailable))?\/_matrix\/client\/v3\/(account\/whoami|sync)$/.exec(
        new URL(request.url).pathname,
      )
      if (!match) return new Response("Unexpected local protocol path", { status: 404 })
      const [, scope = "primary", operation] = match
      if (operation === "account/whoami") {
        handshakes.set(scope, (handshakes.get(scope) ?? 0) + 1)
        await Bun.sleep(50)
        if (scope === "unavailable") return new Response("Local handshake unavailable", { status: 503 })
        return Response.json({ user_id: `@owned-${scope}:local` })
      }
      firstSync.resolve()
      await Bun.sleep(50)
      return Response.json({ next_batch: "polled", rooms: { join: {} } })
    },
  })
  return { peer, handshakes, firstSync: firstSync.promise }
}

test("a cold protected catalog publishes the existing managed runtime after one real startup handshake", async () => {
  await using project = await memoryProject("channel-catalog-real-adapter")
  await using unavailable = await memoryProject("channel-catalog-failed-adapter")
  await fs.mkdir(path.join(project.path, ".gitignore"))
  await fs.mkdir(path.join(unavailable.path, ".gitignore"))
  const { peer, handshakes, firstSync } = startMatrixPeer()
  try {
    setServerUrl(peer.url)
    await writeChannelConfig(project.path, {
      matrix: { enabled: true, homeserver: peer.url.origin, token: crypto.randomUUID() },
    })
    const first = await Promise.all([readCatalog(project.path), readCatalog(project.path)])
    await firstSync
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
    expect({ runningAttempts: handshakes.get("primary"), declinedAttempts: handshakes.get("unavailable") }).toEqual({
      runningAttempts: 1,
      declinedAttempts: 1,
    })
  } finally {
    await Instance.disposeAll()
    await peer.stop()
  }
}, 60_000)

test("managed restart reopens the selected project's accepted adapter without changing another project's connection", async () => {
  await using east = await memoryProject("channel-managed-restart-east")
  await using west = await memoryProject("channel-managed-restart-west")
  const { peer, handshakes } = startMatrixPeer()
  try {
    setServerUrl(peer.url)
    await writeChannelConfig(east.path, {
      matrix: { enabled: true, homeserver: peer.url.origin, token: crypto.randomUUID() },
    })
    await writeChannelConfig(west.path, {
      matrix: { enabled: true, homeserver: new URL("/west", peer.url).href, token: crypto.randomUUID() },
    })
    const running = { status: "running", channels: ["matrix"], running: true }
    for (const project of [east, west]) {
      const before = await request(project.path, "/channel/runtime")
      expect({ status: before.status, body: await before.json() }).toMatchObject({ status: 200, body: running })
    }
    const initial = { east: handshakes.get("primary")!, west: handshakes.get("west")! }

    const restarted = await request(east.path, "/channel/runtime/restart", { method: "POST" })
    expect({ status: restarted.status, body: await restarted.json() }).toMatchObject({ status: 200, body: running })
    expect({ east: handshakes.get("primary"), west: handshakes.get("west") }).toEqual({
      east: initial.east + 1,
      west: initial.west,
    })

    const alternate = new URL("/alternate", peer.url).href
    const saved = await request(east.path, "/config", {
      method: "PATCH",
      body: JSON.stringify({ channel: { matrix: { homeserver: alternate } } }),
    })
    expect(saved.status).toBe(200)
    const secondStart = handshakes.get("alternate")!
    expect(secondStart).toBe(1)
    const latest = await request(east.path, "/channel/runtime/restart", { method: "POST" })
    expect({ status: latest.status, body: await latest.json() }).toMatchObject({ status: 200, body: running })
    expect({ original: handshakes.get("primary"), latest: handshakes.get("alternate"), west: handshakes.get("west") })
      .toEqual({ original: initial.east + 1, latest: secondStart + 1, west: initial.west })

    const other = await request(west.path, "/channel/runtime")
    expect({ status: other.status, body: await other.json() }).toMatchObject({ status: 200, body: running })
  } finally {
    await Instance.disposeAll()
    await peer.stop()
  }
}, 60_000)
