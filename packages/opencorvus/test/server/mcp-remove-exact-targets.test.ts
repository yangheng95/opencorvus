import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { ConfigPaths } from "@/config/paths"
import { Server } from "@/server/server"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await resetMemoryDatabase()
})

test("project MCP deletion preserves exact authored names through the public route", async () => {
  await using project = await memoryProject()
  const configFile = ConfigPaths.projectFile(project.path)
  const disabled = { enabled: false }
  const initial = { tools: disabled, " tools ": disabled, "": disabled, "  ": disabled }
  await fs.mkdir(path.dirname(configFile), { recursive: true })
  await fs.writeFile(configFile, JSON.stringify({ mcp: initial }))
  const app = Server.App()
  const headers = { "x-opencorvus-directory": project.path, "Content-Type": "application/json" }
  const remove = (names: string[]) => app.request("/mcp", {
    method: "DELETE",
    headers,
    body: JSON.stringify({ names }),
  })

  const padded = await remove([" tools "])
  expect(padded.status).toBe(200)
  expect(await padded.json()).toMatchObject({ mcp: { tools: disabled, "": disabled, "  ": disabled } })

  const blank = await remove(["", "  "])
  expect(blank.status).toBe(200)
  expect(await blank.json()).toMatchObject({ mcp: { tools: disabled } })
  expect(JSON.parse(await fs.readFile(configFile, "utf8")).mcp).toEqual({ tools: disabled })

  const status = await app.request("/mcp/project", { headers })
  expect(status.status).toBe(200)
  expect(await status.json()).toEqual({ tools: { status: "disabled" } })

  const unknown = await remove(["toString"])
  expect(unknown.status).toBe(404)
  expect(await unknown.json()).toMatchObject({
    name: "NotFoundError",
    data: { message: "MCP server not found: toString" },
  })
})
