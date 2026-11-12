import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import { ConfigPaths } from "@/config/paths"
import { Server } from "@/server/server"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await resetMemoryDatabase()
})

test("project MCP creation and update use the exact authored name", async () => {
  await using project = await memoryProject()
  const app = Server.App()
  const headers = { "x-opencorvus-directory": project.path, "Content-Type": "application/json" }
  const definition = (command: string) => ({ type: "local", command: [command], enabled: false })
  const add = (name: string, command: string) => app.request("/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify({ name, config: definition(command) }),
  })

  const original = await add("review-tools", "original")
  expect(original.status).toBe(200)
  expect(await original.json()).toMatchObject({ "review-tools": { status: "disabled" } })

  const padded = await add(" review-tools ", "padded")
  expect(padded.status).toBe(200)
  expect(await padded.json()).toMatchObject({
    "review-tools": { status: "disabled" },
    " review-tools ": { status: "disabled" },
  })

  const updated = await add("review-tools", "updated")
  expect(updated.status).toBe(200)
  expect(await updated.json()).toMatchObject({
    "review-tools": { status: "disabled" },
    " review-tools ": { status: "disabled" },
  })

  for (const name of ["", " \t\u00a0 "]) {
    const blank = await add(name, "blank")
    expect(blank.status).toBe(400)
    expect(await blank.json()).toMatchObject({
      success: false,
      error: [{ code: "too_small", path: ["name"] }],
    })
  }

  const file = await fs.readFile(ConfigPaths.projectFile(project.path), "utf8")
  expect(JSON.parse(file).mcp).toEqual({
    "review-tools": definition("updated"),
    " review-tools ": definition("padded"),
  })
  const status = await app.request("/mcp/project", { headers })
  expect(status.status).toBe(200)
  expect(await status.json()).toEqual({
    "review-tools": { status: "disabled" },
    " review-tools ": { status: "disabled" },
  })
}, 30_000)
