import { afterEach, beforeEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Config } from "@/config/config"
import { ConfigPaths } from "@/config/paths"
import { Global } from "@/global"
import { Instance } from "@/project/instance"
import { namedErrorStatus } from "@/server/error-handler"
import { hostGit } from "@/util/git"
import { tmpdir } from "./fixture/fixture"
import { resetMemoryDatabase } from "./fixture/memory"

const globalFile = path.join(Global.Path.config, ConfigPaths.CANONICAL_FILE_NAME)
beforeEach(async () => {
  await fs.mkdir(Global.Path.config, { recursive: true })
  await fs.writeFile(globalFile, JSON.stringify({ permission_mode: "ask", prompt_profile: { active: "base" } }))
  Config.global.reset()
})
afterEach(async () => {
  Config.TestHooks.beforeGlobalRuntimeSettlement = undefined
  await resetMemoryDatabase()
  await fs.rm(globalFile, { force: true })
  Config.global.reset()
})
async function source(directory: string, value: unknown) {
  const file = ConfigPaths.projectFile(directory)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify(value))
}
function selected(config: Config.Info) {
  return { profile: config.prompt_profile.active, mode: config.permission_mode }
}
function failure(error: any) {
  return { name: error?.name, reason: error?.data?.reason, status: error ? namedErrorStatus(error) : undefined }
}

test("a standalone snapshot and its ordinary child Project use the same independent boundary", async () => {
  await using parent = await tmpdir({ git: true })
  await source(parent.path, { permission_mode: "full_access", prompt_profile: { active: "dynamic" } })
  const child = path.join(parent.path, "ordinary child")
  await fs.mkdir(child)
  expect(selected(await Config.snapshotForProject(child))).toEqual({ profile: "base", mode: "ask" })
  const admitted = await Instance.provideProjectIdentity({
    directory: child,
    fn: async () => ({ worktree: Instance.worktree, config: selected(await Config.get()) }),
  })
  expect(admitted).toEqual({ worktree: child, config: { profile: "base", mode: "ask" } })
})

test("a global candidate projects its admitted child boundary into both runtime transition snapshots", async () => {
  await using parent = await tmpdir({ git: true })
  await source(parent.path, { permission_mode: "full_access", prompt_profile: { active: "dynamic" } })
  const child = path.join(parent.path, "registered ordinary child")
  await fs.mkdir(child)
  await Instance.provideProjectIdentity({ directory: child, fn: () => undefined })
  const observed: unknown[] = []
  Config.TestHooks.beforeGlobalRuntimeSettlement = async ({ transitions }) => {
    observed.push(
      ...transitions.map((t) => ({ directory: t.directory, before: selected(t.before), after: selected(t.after) })),
    )
  }
  const saved = await Config.updateGlobalPatch({ username: "admitted-boundary" })
  expect(saved.username).toBe("admitted-boundary")
  expect(observed).toEqual([
    { directory: child, before: { profile: "base", mode: "ask" }, after: { profile: "base", mode: "ask" } },
  ])
})

test("a snapshot of a damaged local Git directory reports its own typed discovery failure", async () => {
  await using parent = await tmpdir({ git: true })
  const child = path.join(parent.path, "damaged child")
  await fs.mkdir(path.join(child, ".git"), { recursive: true })
  const error = await Config.snapshotForProject(child).then(
    () => undefined,
    (error) => error,
  )
  expect(failure(error)).toEqual({ name: "ProjectGitDiscoveryError", reason: "command-failed", status: 400 })
})

test("snapshot discovery maps Git availability to the repository error and the valid ordinary configuration", async () => {
  await using repository = await tmpdir({ git: true })
  await using ordinary = await tmpdir()
  const priorPath = process.env.PATH
  process.env.PATH = path.join(ordinary.path, "missing-bin")
  try {
    const error = await Config.snapshotForProject(repository.path).then(
      () => undefined,
      (error) => error,
    )
    expect(failure(error)).toEqual({ name: "ProjectGitDiscoveryError", reason: "command-unavailable", status: 400 })
    expect(selected(await Config.snapshotForProject(ordinary.path))).toEqual({ profile: "base", mode: "ask" })
  } finally {
    if (priorPath === undefined) delete process.env.PATH
    else process.env.PATH = priorPath
  }
})

test("main, linked and aliased snapshots read the selected sandbox's own source", async () => {
  await using root = await tmpdir({ git: true })
  const main = path.join(root.path, "main '目标'"),
    linked = path.join(root.path, "linked '目标'"),
    alias = path.join(root.path, "alias")
  await fs.mkdir(main)
  await fs.cp(path.join(root.path, ".git"), path.join(main, ".git"), { recursive: true })
  const added = await hostGit(["worktree", "add", "--detach", linked], { cwd: main })
  expect(added.exitCode).toBe(0)
  await source(main, { username: "main-owned", permission_mode: "full_access" })
  await source(linked, { username: "linked-owned" })
  await fs.symlink(linked, alias, process.platform === "win32" ? "junction" : "dir")
  const actual = await Promise.all(
    [main, linked, alias].map(async (directory) => {
      const config = await Config.snapshotForProject(directory)
      return { username: config.username, ...selected(config) }
    }),
  )
  expect(actual).toEqual([
    { username: "main-owned", profile: "base", mode: "full_access" },
    { username: "linked-owned", profile: "base", mode: "ask" },
    { username: "linked-owned", profile: "base", mode: "ask" },
  ])
})

test.skipIf(process.platform === "win32")(
  "POSIX snapshots preserve the repository's exact newline and whitespace boundary",
  async () => {
    await using parent = await tmpdir({ git: true })
    await source(parent.path, { permission_mode: "full_access" })
    const child = path.join(parent.path, "repo\n '目标' \n")
    await fs.mkdir(child)
    await fs.cp(path.join(parent.path, ".git"), path.join(child, ".git"), { recursive: true })
    await source(child, { username: "exact-path" })
    const config = await Config.snapshotForProject(child)
    expect({ username: config.username, ...selected(config) }).toEqual({
      username: "exact-path",
      profile: "base",
      mode: "ask",
    })
  },
)
