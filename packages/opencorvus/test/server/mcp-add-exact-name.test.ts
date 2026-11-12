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

test("MCP creation reports a literal projection error before changing effective connection settings", async () => {
  await using project = await memoryProject()
  const env = "OPENCORVUS_TEST_MCP_PROJECTION_NAME"
  const previous = process.env[env]
  process.env[env] = "isolated"
  try {
    const configFile = ConfigPaths.projectFile(project.path)
    const projectConfigDir = path.dirname(configFile)
    const local = (command: string) => ({ type: "local", command: [command], enabled: false })
    const authored = {
      "review-isolated": local("original"),
      [`authored-{env:${env}}`]: local("authored"),
    }
    await fs.mkdir(projectConfigDir, { recursive: true })
    await fs.writeFile(path.join(projectConfigDir, "mode.txt"), "isolated\n")
    await fs.writeFile(configFile, JSON.stringify({ mcp: authored }))
    const app = Server.App()
    const headers = { "x-opencorvus-directory": project.path, "Content-Type": "application/json" }
    const add = (name: string, command: string) => app.request("/mcp", {
      method: "POST",
      headers,
      body: JSON.stringify({ name, config: local(command) }),
    })

    for (const [name, command] of [
      [`review-{env:${env}}`, "replacement"],
      ["review-{file:mode.txt}", "replacement"],
      ["review-isolated", "{file:mode.txt}"],
      ["review-{file:missing.txt}", "replacement"],
    ]) {
      const result = await add(name, command)
      expect(result.status).toBe(400)
      expect(await result.json()).toMatchObject({
        success: false,
        error: [{ code: "mcp_configuration_projection_changed" }],
      })
    }

    const saved = await add("fresh-review", "fresh")
    expect(saved.status).toBe(200)
    expect(await saved.json()).toMatchObject({
      "review-isolated": { status: "disabled" },
      "authored-isolated": { status: "disabled" },
      "fresh-review": { status: "disabled" },
    })
    expect(JSON.parse(await fs.readFile(configFile, "utf8")).mcp).toEqual({ ...authored, "fresh-review": local("fresh") })
    const effective = await app.request("/config", { headers })
    expect(effective.status).toBe(200)
    expect(await effective.json()).toMatchObject({ mcp: {
      "review-isolated": local("original"),
      "authored-isolated": local("authored"),
      "fresh-review": local("fresh"),
    } })
  } finally {
    if (previous === undefined) delete process.env[env]
    else process.env[env] = previous
  }
}, 30_000)
