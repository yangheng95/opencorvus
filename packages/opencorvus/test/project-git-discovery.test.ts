import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Project } from "@/project/project"
import { hostGit } from "@/util/git"
import { tmpdir } from "./fixture/fixture"
import { resetMemoryDatabase } from "./fixture/memory"
import { namedErrorStatus } from "@/server/error-handler"
import { ProjectDirectoryAdmission } from "@/project/directory-admission"
import { randomUUID } from "node:crypto"
import { Database, eq } from "@/storage/db"
import { ProjectTable } from "@/project/project.sql"
import { Identifier } from "@/id/id"

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

test("a registered worktree reports damaged Git metadata and recovers its original owner", async () => {
  await using repository = await tmpdir({ git: true })
  const original = await Project.fromDirectory(repository.path)
  const metadata = path.join(repository.path, ".git")
  const parked = path.join(repository.path, "original-metadata")
  for (const target of [metadata, parked]) {
    if (path.dirname(path.resolve(target)) !== path.resolve(repository.path)) throw new Error("Owned metadata path required")
  }
  await fs.rename(metadata, parked)
  await fs.mkdir(metadata)
  try {
    const error = await Project.fromDirectory(repository.path).then(() => undefined, error => error)
    expect({ name: error?.name, reason: error?.data?.reason, status: error && namedErrorStatus(error) }).toEqual({
      name: "ProjectGitDiscoveryError", reason: "command-failed", status: 400,
    })
  } finally {
    await fs.rmdir(metadata)
    await fs.rename(parked, metadata)
  }
  const recovered = await Project.fromDirectory(repository.path)
  expect({ id: recovered.project.id, generation: recovered.generation, worktree: recovered.project.worktree }).toEqual({
    id: original.project.id, generation: original.generation, worktree: repository.path,
  })
})

test("a registered worktree reports unavailable Git and admits its owner after PATH restoration", async () => {
  await using repository = await tmpdir({ git: true })
  const original = await Project.fromDirectory(repository.path)
  const priorPath = process.env.PATH
  process.env.PATH = path.join(repository.path, "missing-bin")
  try {
    const error = await Project.fromDirectory(repository.path).then(() => undefined, error => error)
    expect({ name: error?.name, reason: error?.data?.reason, status: error && namedErrorStatus(error) }).toEqual({
      name: "ProjectGitDiscoveryError", reason: "command-unavailable", status: 400,
    })
  } finally {
    if (priorPath === undefined) delete process.env.PATH
    else process.env.PATH = priorPath
  }
  const recovered = await Project.fromDirectory(repository.path)
  expect({ id: recovered.project.id, generation: recovered.generation }).toEqual({
    id: original.project.id, generation: original.generation,
  })
})

test("replacement after a registered candidate returns the physical occurrence error then admits a fresh observation", async () => {
  await using parent = await tmpdir()
  const directory = path.join(parent.path, "repository")
  const parked = path.join(parent.path, "original-repository")
  for (const target of [directory, parked]) {
    if (path.dirname(path.resolve(target)) !== path.resolve(parent.path)) throw new Error("Owned repository path required")
  }
  await fs.mkdir(directory)
  expect((await hostGit(["init"], { cwd: directory })).exitCode).toBe(0)
  const original = await Project.fromDirectory(directory)
  let error: any
  {
    using hook = Project.TestHooks.installBeforeDiscoveryCommit(async input => {
      if (input.directory !== directory) return
      await fs.rename(directory, parked)
      await fs.mkdir(directory)
      expect((await hostGit(["init"], { cwd: directory })).exitCode).toBe(0)
    })
    error = await Project.fromDirectory(directory).then(() => undefined, error => error)
  }
  expect({ name: error?.name, directory: error?.data?.directory }).toEqual({
    name: "ProjectDirectoryOccurrenceChangedError", directory,
  })
  const current = await Project.fromDirectory(directory)
  expect({ id: current.project.id, generation: current.generation, sandbox: current.sandbox }).toEqual({
    id: original.project.id, generation: original.generation, sandbox: directory,
  })
})

test("a registered ordinary directory initializes Git under its inherited physical admission", async () => {
  await using repository = await tmpdir()
  const original = await Project.fromDirectory(repository.path)
  const initialized = await ProjectDirectoryAdmission.run(async () => {
    const occurrence = await ProjectDirectoryAdmission.observeDirectory(repository.path)
    const acquired = await ProjectDirectoryAdmission.acquire({
      directory: repository.path, operationID: randomUUID(), kind: "registration", occurrence,
    })
    if (acquired.outcome !== "acquired") throw new Error("Owned registration admission required")
    try {
      return await ProjectDirectoryAdmission.provide(acquired.token, () => Project.initGit(repository.path))
    } finally {
      ProjectDirectoryAdmission.settle(acquired.token, () => undefined)
    }
  })
  expect({ created: initialized.created, id: initialized.project.id, worktree: initialized.project.worktree }).toEqual({
    created: true, id: original.project.id, worktree: repository.path,
  })
  const current = await Project.fromDirectory(repository.path)
  expect({ id: current.project.id, generation: current.generation }).toEqual({
    id: original.project.id, generation: original.generation,
  })
})

test("a registered worktree with a physical peer returns the duplicate owner error and preserves its marker", async () => {
  await using parent = await tmpdir()
  const directory = path.join(parent.path, "repository")
  const alias = path.join(parent.path, "alias")
  await fs.mkdir(directory)
  expect((await hostGit(["init"], { cwd: directory })).exitCode).toBe(0)
  const original = await Project.fromDirectory(directory)
  await fs.symlink(directory, alias, process.platform === "win32" ? "junction" : "dir")
  const peerID = Identifier.ascending("project")
  Database.use(db => {
    const row = db.select().from(ProjectTable).where(eq(ProjectTable.id, original.project.id)).get()
    if (!row) throw new Error("Original registered owner required")
    db.insert(ProjectTable).values({ ...row, id: peerID, generation: randomUUID(), worktree: alias, sandboxes: [] }).run()
  })
  const error = await Project.fromDirectory(directory).then(() => undefined, error => error)
  expect({ name: error?.name, projectIDs: error?.data?.projectIDs, status: error && namedErrorStatus(error) }).toEqual({
    name: "ProjectDuplicateWorktreeIdentityError", projectIDs: [original.project.id, peerID].sort(), status: 409,
  })
  expect(await fs.readFile(path.join(directory, ".git", "opencorvus"), "utf8")).toBe(original.project.id)
  expect(Project.occurrence(original.project.id)?.generation).toBe(original.generation)
})
