import { afterEach, expect, test } from "bun:test"
import { hostGit } from "@/util/git"
import { Instance, runOutsideInstanceContext } from "@/project/instance"
import { Vcs } from "@/project/vcs"
import path from "node:path"
import fs from "node:fs/promises"
import { ConfigPaths } from "@/config/paths"
import { Server } from "@/server/server"
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
  return result.stdout.toString().trim()
}

test("physical branch facts follow a real branch rename in the same identity context", async () => {
  await using project = await memoryProject("vcs-current-physical-branch")
  await Instance.provideProjectIdentity({ directory: project.path, fn: async () => {
    const initial = await git(project.path, ["branch", "--show-current"])
    expect((await Vcs.info()).branch).toBe(initial)
    await git(project.path, ["branch", "-m", "current-reader-225"])
    const info = await Vcs.info()
    const branches = await Vcs.branches()
    console.log("vcs225 physical", JSON.stringify({ initial, info, branches }))
    expect({ branch: info.branch, branches }).toEqual({
      branch: "current-reader-225",
      branches: [{ name: "current-reader-225", current: true }],
    })
  } })
}, 30_000)

async function configure(directory: string, marker: string, branch: string) {
  await git(directory, ["branch", "-m", branch])
  await fs.appendFile(path.join(directory, ".git/info/exclude"), "\n.opencorvus/\n")
  const config = ConfigPaths.projectFile(directory)
  await fs.mkdir(path.dirname(config), { recursive: true })
  await fs.writeFile(config, JSON.stringify({ model: "missing-vcs-reader/model", small_model: "missing-vcs-reader/model" }))
  await fs.writeFile(path.join(directory, "README.md"), marker + "\n")
}

async function read(directory: string, route: string) {
  await Instance.disposeAll()
  const response = await runOutsideInstanceContext(() => Server.App().request(route, {
    headers: { "x-opencorvus-directory": directory },
  }))
  return { status: response.status, body: await response.json() }
}

test("cold VCS readers return exact independent Git facts with unavailable execution models", async () => {
  await using first = await memoryProject("vcs-reader-first")
  await using second = await memoryProject("vcs-reader-second")
  await configure(first.path, "VcsReader-First", "reader-first")
  await configure(second.path, "VcsReader-Second", "reader-second")
  for (const [directory, marker, branch] of [[first.path, "VcsReader-First", "reader-first"], [second.path, "VcsReader-Second", "reader-second"]]) {
    const info = await read(directory!, "/vcs")
    expect(info).toMatchObject({ status: 200, body: {
      initialized: true, branch, commit: expect.any(String), clean: false, dirty: true,
      staged: 0, modified: 0, untracked: 1, conflicts: 0, ahead: 0, behind: 0, hasRemote: false,
    } })
    expect(await read(directory!, "/vcs/branches")).toEqual({ status: 200, body: [{ name: branch, current: true }] })
    const diff = await read(directory!, "/vcs/diff?mode=git&context=0")
    expect(diff).toMatchObject({ status: 200, body: [{ file: "README.md", status: "added", additions: 1, deletions: 0, patch: expect.stringContaining("+" + marker) }] })
  }
}, 60_000)

test("parallel Project VCS readers keep each exact repository branch", async () => {
  await using first = await memoryProject("vcs-reader-parallel-first")
  await using second = await memoryProject("vcs-reader-parallel-second")
  await configure(first.path, "ParallelFirst", "parallel-first")
  await configure(second.path, "ParallelSecond", "parallel-second")
  await Instance.disposeAll()
  const results = await runOutsideInstanceContext(() => Promise.all([first.path, second.path].map(async (directory) => {
    const response = await Server.App().request("/vcs", { headers: { "x-opencorvus-directory": directory } })
    return { status: response.status, body: await response.json() }
  })))
  expect(results).toMatchObject([
    { status: 200, body: { branch: "parallel-first", untracked: 1 } },
    { status: 200, body: { branch: "parallel-second", untracked: 1 } },
  ])
}, 60_000)

test("plain directories return explicit VCS state and branch/diff prerequisite errors", async () => {
  await using directory = await tmpdir()
  expect(await read(directory.path, "/vcs")).toEqual({ status: 200, body: {
    initialized: false, clean: true, dirty: false, staged: 0, modified: 0, untracked: 0,
    conflicts: 0, ahead: 0, behind: 0, hasRemote: false,
  } })
  expect(await read(directory.path, "/vcs/branches")).toMatchObject({ status: 412, body: { name: "VcsPrerequisiteError", data: { reason: "not_git" } } })
  expect(await read(directory.path, "/vcs/diff?mode=git")).toMatchObject({ status: 412, body: { name: "VcsPrerequisiteError", data: { reason: "not_git" } } })
}, 30_000)

test("Git writes and commit-message streaming retain their execution model error", async () => {
  await using project = await memoryProject("vcs-reader-runtime-write")
  await configure(project.path, "VcsRuntimeMarker", "runtime-current")
  for (const [route, body] of [["/vcs/branch", { name: "runtime-current" }], ["/vcs/commit", { message: "Owned reader contract" }], ["/vcs/push", {}], ["/vcs/commit-message/stream", {}]] as const) {
    await Instance.disposeAll()
    const response = await runOutsideInstanceContext(() => Server.App().request(route, {
      method: "POST", headers: { "x-opencorvus-directory": project.path, "content-type": "application/json" }, body: JSON.stringify(body),
    }))
    expect({ status: response.status, body: await response.json() }).toMatchObject({
      status: 400, body: { name: "ProviderModelNotFoundError", data: { providerID: "missing-vcs-reader", modelID: "model" } },
    })
  }
}, 60_000)

test("branch switching retains the live branch owner before returning current information", async () => {
  await using project = await memoryProject("vcs-reader-live-owner")
  await git(project.path, ["branch", "next-current-225"])
  await Instance.provideProjectIdentity({ directory: project.path, fn: async () => {
    await Vcs.init()
    expect((await Vcs.switchBranch("next-current-225")).branch).toBe("next-current-225")
    expect(await Vcs.branch()).toBe("next-current-225")
    expect((await Vcs.branches()).find((branch) => branch.current)).toEqual({ name: "next-current-225", current: true })
  } })
}, 30_000)

test("physical branch facts belong to the selected linked checkout", async () => {
  await using project = await memoryProject("vcs-current-linked-checkout")
  const checkout = path.join(project.path, "linked-checkout")
  await git(project.path, ["worktree", "add", "-b", "linked-reader-225", checkout])
  await Instance.provideProjectIdentity({ directory: checkout, fn: async () => {
    const info = await Vcs.info()
    const branches = await Vcs.branches()
    console.log("vcs225 linked", JSON.stringify({ directory: Instance.directory, worktree: Instance.worktree, info, branches }))
    expect(info.branch).toBe("linked-reader-225")
    expect(branches.find((branch) => branch.current)).toEqual({ name: "linked-reader-225", current: true })
  } })
}, 30_000)
