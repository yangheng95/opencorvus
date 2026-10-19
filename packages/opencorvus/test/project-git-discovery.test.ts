import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Project } from "@/project/project"
import { hostGit } from "@/util/git"
import { tmpdir } from "./fixture/fixture"
import { resetMemoryDatabase } from "./fixture/memory"
import { namedErrorStatus } from "@/server/error-handler"

afterEach(resetMemoryDatabase)

test("Git availability selects the explicit repository error and the ordinary directory identity", async () => {
  await using repository = await tmpdir({ git: true })
  await using directory = await tmpdir()
  const priorPath = process.env.PATH
  process.env.PATH = path.join(directory.path, "missing-bin")
  try {
    const error = await Project.fromDirectory(repository.path).then(
      () => undefined,
      (error) => error,
    )
    expect({
      name: error?.name,
      reason: error?.data?.reason,
      status: error ? namedErrorStatus(error) : undefined,
    }).toEqual({ name: "ProjectGitDiscoveryError", reason: "command-unavailable", status: 400 })
    const found = await Project.fromDirectory(directory.path)
    expect({ worktree: found.project.worktree, sandbox: found.sandbox }).toEqual({
      worktree: directory.path,
      sandbox: directory.path,
    })
  } finally {
    if (priorPath === undefined) delete process.env.PATH
    else process.env.PATH = priorPath
  }
})

test("an existing damaged Git directory returns its explicit discovery error", async () => {
  await using root = await tmpdir()
  await fs.mkdir(path.join(root.path, ".git"))
  const error = await Project.fromDirectory(root.path).then(
    () => undefined,
    (error) => error,
  )
  expect({
    name: error?.name,
    reason: error?.data?.reason,
    directory: error?.data?.directory,
    status: error ? namedErrorStatus(error) : undefined,
  }).toEqual({
    name: "ProjectGitDiscoveryError",
    reason: "command-failed",
    directory: root.path,
    status: 400,
  })
})

test("a damaged local Git directory inside a valid parent repository returns its own discovery error", async () => {
  await using root = await tmpdir({ git: true })
  const directory = path.join(root.path, "damaged child")
  await fs.mkdir(path.join(directory, ".git"), { recursive: true })
  const error = await Project.fromDirectory(directory).then(
    () => undefined,
    (error) => error,
  )
  expect({
    name: error?.name,
    reason: error?.data?.reason,
    directory: error?.data?.directory,
    status: error ? namedErrorStatus(error) : undefined,
  }).toEqual({
    name: "ProjectGitDiscoveryError",
    reason: "command-failed",
    directory,
    status: 400,
  })
})

test("Git discovery resolves an unborn worktree with a separate metadata directory", async () => {
  await using root = await tmpdir()
  const source = path.join(root.path, "unborn '目标' with spaces")
  await fs.mkdir(source)
  const initialized = await hostGit(["init", "--separate-git-dir", path.join(source, "metadata store")], {
    cwd: source,
  })
  expect(initialized.exitCode).toBe(0)
  const first = await Project.fromDirectory(source)
  const second = await Project.fromDirectory(source)
  expect({
    worktree: first.project.worktree,
    sandbox: first.sandbox,
    id: second.project.id,
    generation: second.generation,
  }).toEqual({ worktree: source, sandbox: source, id: first.project.id, generation: first.generation })
})

test.skipIf(process.platform === "win32")(
  "POSIX Git discovery preserves newline and trailing whitespace in repository paths",
  async () => {
    await using root = await tmpdir({ git: true })
    const source = path.join(root.path, "repo\n '目标' \n")
    await fs.mkdir(source)
    await fs.cp(path.join(root.path, ".git"), path.join(source, ".git"), { recursive: true })
    const found = await Project.fromDirectory(source)
    expect({ worktree: found.project.worktree, sandbox: found.sandbox }).toEqual({ worktree: source, sandbox: source })
  },
)

test("Git discovery preserves the exact main, linked and aliased Project occurrence", async () => {
  await using root = await tmpdir({ git: true })
  const source = path.join(root.path, "repo '目标' with spaces")
  const linked = path.join(root.path, "linked '目标' with spaces")
  const alias = path.join(root.path, "alias '目标' with spaces")
  await fs.mkdir(source)
  await fs.cp(path.join(root.path, ".git"), path.join(source, ".git"), { recursive: true })
  const main = await Project.fromDirectory(source)
  expect({ worktree: main.project.worktree, sandbox: main.sandbox }).toEqual({ worktree: source, sandbox: source })
  const repeated = await Project.fromDirectory(source)
  expect({ id: repeated.project.id, generation: repeated.generation }).toEqual({
    id: main.project.id,
    generation: main.generation,
  })

  const added = await hostGit(["worktree", "add", "--detach", linked], { cwd: source })
  expect(added.exitCode).toBe(0)
  const child = await Project.fromDirectory(linked)
  expect({
    id: child.project.id,
    generation: child.generation,
    worktree: child.project.worktree,
    sandbox: child.sandbox,
  }).toEqual({
    id: main.project.id,
    generation: main.generation,
    worktree: source,
    sandbox: linked,
  })
  expect(child.project.sandboxes).toEqual([linked])

  await fs.symlink(source, alias, process.platform === "win32" ? "junction" : "dir")
  const aliased = await Project.fromDirectory(alias)
  expect({ id: aliased.project.id, generation: aliased.generation, sandbox: aliased.sandbox }).toEqual({
    id: main.project.id,
    generation: main.generation,
    sandbox: alias,
  })
  expect(await Project.sameFilesystemLocation(aliased.project.worktree, source)).toBe(true)
  expect(Project.occurrence(main.project.id)?.generation).toBe(main.generation)
})
