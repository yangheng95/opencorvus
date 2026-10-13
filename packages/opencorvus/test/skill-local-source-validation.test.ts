import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, symlink, writeFile } from "node:fs/promises"
import path from "node:path"
import { Hono } from "hono"
import { Config } from "@/config/config"
import { Instance } from "@/project/instance"
import { serverErrorResponse } from "@/server/error-handler"
import { SkillRoutes } from "@/server/routes/skill"
import { SkillManager } from "@/skill/manager"
import { memoryProject } from "./fixture/memory"

const app = new Hono().route("/skill", SkillRoutes()).onError(serverErrorResponse)
let project: Awaited<ReturnType<typeof memoryProject>>

beforeAll(async () => {
  project = await memoryProject()
})

afterAll(async () => {
  await project[Symbol.asyncDispose]()
})

function install(value: string) {
  return app.request("/skill/install", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "path", value, policy: "allow" }),
  })
}

describe.serial("Local Skill source validation", () => {
  test.each([
    ["missing", "missing_directory", "Skill directory not found:"],
    ["file", "not_directory", "Skill source is not a directory:"],
    [
      "file/child",
      process.platform === "win32" ? "missing_directory" : "not_directory",
      process.platform === "win32" ? "Skill directory not found:" : "Skill source is not a directory:",
    ],
    ["empty", "empty_directory", "No SKILL.md files found in"],
  ] as const)("%s publishes its exact input error", async (entry, reason, message) => {
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await writeFile(path.join(project.path, "file"), "An ordinary source file.\n")
        await mkdir(path.join(project.path, "empty"), { recursive: true })
        const resolved = path.resolve(project.path, entry)
        const response = await install(entry)
        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({
          name: "SkillLocalSourceError",
          data: { path: resolved, reason, message: `${message} ${resolved}` },
        })
        expect(response.headers.get("x-opencorvus-request-id")).toMatch(/^[0-9a-f-]{36}$/)
      },
    })
  })

  test.each(["directory", "directory-link"] as const)("%s installs and projects its real Skill", async (kind) => {
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const directory = path.join(project.path, `${kind}-source`)
        const name = `local-source-${crypto.randomUUID()}`
        await mkdir(directory)
        await writeFile(
          path.join(directory, "SKILL.md"),
          `---\nname: ${name}\ndescription: Real local source validation input.\n---\n\n# Local source\n`,
        )
        const source = kind === "directory" ? directory : path.join(project.path, "source-link")
        if (kind === "directory-link")
          await symlink(directory, source, process.platform === "win32" ? "junction" : "dir")
        const response = await install(source)
        expect({ status: response.status, body: await response.json() }).toEqual({
          status: 200,
          body: { source, kind: "path" },
        })
        expect((await Config.getGlobal()).skills?.paths).toContain(source)
        expect((await SkillManager.installed()).find((skill) => skill.name === name)).toMatchObject({
          name,
          source_type: "config_path",
          description: "Real local source validation input.",
          policy: "allow",
        })
      },
    })
  })
})
