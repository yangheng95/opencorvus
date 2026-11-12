import { afterEach, expect, spyOn, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { Config } from "@/config/config"
import { ConfigPaths } from "@/config/paths"
import { MCP } from "@/mcp"
import { Instance } from "@/project/instance"
import { Server } from "@/server/server"
import { withTimeout } from "@/util/await-with-timeout"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  Config.TestHooks.beforeGlobalPersist = undefined
  Config.TestHooks.beforeProjectRuntimeSettlement = undefined
  Config.TestHooks.beforePeerRuntimePreparation = undefined
  Server.resetProjectRoutesAppForTest()
  await resetMemoryDatabase()
})

for (const scope of ["project", "global"] as const) {
  test(`${scope} writer and a first concurrent MCP status read settle with the committed generation`, async () => {
    await using project = await memoryProject()
    const file = path.join(project.path, ".opencorvus", "opencorvus.jsonc")
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, JSON.stringify({ mcp: { "qa-disabled": { enabled: false } } }))
    await Instance.provide({ directory: project.path, fn: () => Config.get() })
    const entered = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const pauseWriter = async () => {
      entered.resolve()
      await release.promise
    }
    if (scope === "global") Config.TestHooks.beforeGlobalPersist = pauseWriter
    else Config.TestHooks.beforeProjectRuntimeSettlement = pauseWriter

    // Bound the original source read so the broken ownership cycle reports
    // its actual error and drains during this regression check.
    const readProject = Config.getProject.bind(Config)
    const sourceRead = spyOn(Config, "getProject").mockImplementation(() =>
      withTimeout(readProject(), 2000, "MCP initialization source generation"),
    )
    const writer = Instance.provide({
      directory: project.path,
      fn: () =>
        scope === "global"
          ? Config.updateGlobalPatch({ username: `mcp-${scope}` })
          : Config.updateProjectPatch({ username: `mcp-${scope}` }),
    })
    const writerResult = writer.then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    )
    await entered.promise
    const reader = Instance.provide({ directory: project.path, fn: () => MCP.status() })
    const readerResult = reader.then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    )
    await Bun.sleep(50)
    release.resolve()
    try {
      const [saved, observed] = await Promise.all([writerResult, readerResult])
      expect(saved).toMatchObject({ value: { username: `mcp-${scope}` } })
      expect(observed).toMatchObject({ value: { "qa-disabled": { status: "disabled" } } })
      const current = await Instance.provide({ directory: project.path, fn: () => Config.get() })
      expect(current.username).toBe(`mcp-${scope}`)
    } finally {
      sourceRead.mockRestore()
    }
  }, 15000)
}

test("the first project MCP action uses the committed peer configuration", async () => {
  await using project = await memoryProject()
  const peers = new Set<McpServer>()
  const transportServer = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const revision = new URL(request.url).pathname.slice(1)
      const server = new McpServer({ name: `peer-${revision}`, version: "1.0.0" })
      peers.add(server)
      server.registerTool("identify", {}, async () => ({ content: [{ type: "text", text: revision }] }))
      const uri = `mcp://peer/${revision}`
      server.registerResource("report", uri, {}, async () => ({ contents: [{ uri, text: revision }] }))
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      })
      await server.connect(transport)
      return transport.handleRequest(request)
    },
  })
  const name = "peer-review"
  const target = ConfigPaths.projectFile(project.path)
  const writeSource = async (revision: string) => fs.writeFile(target, JSON.stringify({
    mcp: { [name]: { type: "remote", url: new URL(revision, transportServer.url).href, transport: "streamable-http", oauth: false } },
  }))
  const headers = { "x-opencorvus-directory": project.path, "Content-Type": "application/json" }
  const app = Server.App()
  const control = (kind: "connect" | "disconnect") => app.request(`/mcp/${kind}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name }),
  })
  const afterPeerWrite = async (revision: string, action: () => Promise<Response> | Response) => {
    const preparing = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    Config.TestHooks.beforePeerRuntimePreparation = async (input) => {
      const definition = input.config.mcp?.[name]
      if (input.directory !== project.path || !definition || !("url" in definition) || !definition.url.endsWith(`/${revision}`)) return
      preparing.resolve()
      await release.promise
    }
    await writeSource(revision)
    const request = action()
    try {
      await withTimeout(preparing.promise, 5000, "peer MCP runtime preparation")
      await Bun.sleep(30)
    } finally {
      release.resolve()
      Config.TestHooks.beforePeerRuntimePreparation = undefined
    }
    return request
  }
  try {
    await fs.mkdir(path.dirname(target), { recursive: true })
    await writeSource("initial")
    const initial = await control("connect")
    expect(await initial.json()).toBe(true)

    const connected = await afterPeerWrite("new", () => control("connect"))
    expect([connected.status, await connected.json()]).toEqual([200, true])
    const disconnected = await afterPeerWrite("next", () => control("disconnect"))
    expect([disconnected.status, await disconnected.json()]).toEqual([200, true])
    const state = await app.request("/mcp/project", { headers })
    expect(await state.json()).toMatchObject({ [name]: { status: "disabled", reason: "manual_disconnect" } })

    const inventory = await afterPeerWrite("resource", () => app.request("/experimental/resource", { headers }))
    expect(inventory.status).toBe(200)
    expect(Object.values(await inventory.json())).toEqual(expect.arrayContaining([
      expect.objectContaining({ client: name, uri: "mcp://peer/resource" }),
    ]))
  } finally {
    await Promise.all([...peers].map((server) => server.close()))
    await transportServer.stop(true)
  }
}, 30_000)
