import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { ConfigPaths } from "@/config/paths"
import { Instance, runOutsideInstanceContext } from "@/project/instance"
import { Server } from "@/server/server"
import { hostGit } from "@/util/git"
import { Worktree } from "@/worktree"
import { tmpdir } from "../fixture/fixture"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function git(directory: string, args: string[]) {
  const result = await hostGit(args, { cwd: directory, timeoutProfile: "default" })
  expect(result.exitCode).toBe(0)
}

async function configure(directory: string, branch: string) {
  await git(directory, ["branch", "-m", branch])
  const file = ConfigPaths.projectFile(directory)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify({ model: "missing-worktree-reader/model", small_model: "missing-worktree-reader/model" }))
}

async function read(directory: string) {
  const response = await runOutsideInstanceContext(() => Server.App().request("/project/current/worktrees", {
    headers: { "x-opencorvus-directory": directory },
  }))
  return { status: response.status, body: await response.json() }
}

const gitPath = (directory: string) => directory.replaceAll("\\", "/")

test("cold worktree reader returns actual primary and managed Git facts with unavailable models", async () => {
  await using project = await memoryProject("worktree-reader-primary-managed")
  await configure(project.path, "primary-reader-226")
  const managed = path.join(Worktree.worktreesRoot(project.path), "managed-reader-226")
  await git(project.path, ["worktree", "add", "-b", "managed-reader-226", managed])
  const physicalManaged = await fs.realpath(managed)
  const primary = { name: path.basename(project.path), branch: "primary-reader-226", directory: gitPath(project.path), status: "primary", removable: false }
  const child = { name: "managed-reader-226", branch: "managed-reader-226", directory: gitPath(physicalManaged), status: "managed", removable: true }
  await Instance.disposeAll()
  const initial = await read(project.path)
  console.log("worktree226 primary and managed", JSON.stringify(initial))
  expect(initial).toEqual({ status: 200, body: [primary, child] })
  expect(await read(physicalManaged)).toEqual({ status: 200, body: [primary, child] })

  await git(project.path, ["worktree", "lock", managed])
  expect(await read(project.path)).toEqual({ status: 200, body: [primary, { ...child, removable: false }] })
  await git(project.path, ["worktree", "unlock", managed])
  await git(project.path, ["branch", "-m", "primary-renamed-226"])
  expect(await read(project.path)).toEqual({ status: 200, body: [{ ...primary, branch: "primary-renamed-226" }, child] })
}, 60_000)

test("parallel worktree reads preserve exact independent Project directories and branches", async () => {
  await using first = await memoryProject("worktree-reader-first")
  await using second = await memoryProject("worktree-reader-second")
  await configure(first.path, "worktree-first-226")
  await configure(second.path, "worktree-second-226")
  await Instance.disposeAll()
  expect(await Promise.all([read(first.path), read(second.path)])).toEqual([
    { status: 200, body: [{ name: path.basename(first.path), branch: "worktree-first-226", directory: gitPath(first.path), status: "primary", removable: false }] },
    { status: 200, body: [{ name: path.basename(second.path), branch: "worktree-second-226", directory: gitPath(second.path), status: "primary", removable: false }] },
  ])
}, 60_000)

test("worktree reader reports explicit non-Git and missing-directory admission errors", async () => {
  await using directory = await tmpdir()
  expect(await read(directory.path)).toEqual({ status: 412, body: {
    name: "WorktreeNotGitError", data: { message: "Worktrees are only supported for git projects" },
  } })
  const response = await runOutsideInstanceContext(() => Server.App().request("/project/current/worktrees"))
  expect({ status: response.status, body: await response.json() }).toMatchObject({ status: 400, body: {
    name: "DirectoryRequiredError", data: { message: expect.any(String) },
  } })
}, 30_000)

test("worktree deletion retains the current execution model error", async () => {
  await using project = await memoryProject("worktree-reader-delete-runtime")
  await configure(project.path, "delete-runtime-226")
  await Instance.disposeAll()
  const response = await runOutsideInstanceContext(() => Server.App().request("/project/current/worktrees", {
    method: "DELETE", headers: { "x-opencorvus-directory": project.path, "content-type": "application/json" },
    body: JSON.stringify({ directory: project.path }),
  }))
  expect({ status: response.status, body: await response.json() }).toEqual({ status: 400, body: {
    name: "ProviderModelNotFoundError", data: { providerID: "missing-worktree-reader", modelID: "model", suggestions: [] },
  } })
}, 30_000)

test("public worktree metadata describes the current list and Git prerequisite response", async () => {
  const spec = await Server.openapi()
  const responses = spec.paths?.["/project/current/worktrees"]?.get?.responses
  expect(responses?.["200"]).toMatchObject({ content: { "application/json": {
    schema: { type: "array", items: { $ref: "#/components/schemas/ProjectWorktree" } },
  } } })
  expect(responses?.["412"]).toMatchObject({ content: { "application/json": { schema: {
    type: "object", required: ["name", "data"], properties: { name: { type: "string", const: "WorktreeNotGitError" } },
  } } } })
})
