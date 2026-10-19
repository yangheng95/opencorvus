import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Project } from "@/project/project"
import { hostGit } from "@/util/git"
import { tmpdir } from "./fixture/fixture"
import { resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)

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
