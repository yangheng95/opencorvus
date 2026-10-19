import { afterEach, expect, spyOn, test } from "bun:test"
import * as fs from "fs/promises"
import path from "node:path"
import { Project } from "@/project/project"
import { Instance } from "@/project/instance"
import { closeProjectDeletionRegistryAdmission } from "@/project/deletion-registry"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { tmpdir } from "./fixture/fixture"

afterEach(resetMemoryDatabase)

test("discovers the exact independent Project while a wide-inode peer is closed for deletion", async () => {
  await using target = await memoryProject()
  await using independent = await memoryProject()
  const inodes = new Map([
    [target.path, 14636698791557095n],
    [independent.path, 14636698791557096n],
  ])
  expect(Number(inodes.get(target.path))).toBe(Number(inodes.get(independent.path)))
  const original = fs.stat
  const observe = spyOn(fs, "stat").mockImplementation((async (file, options) => {
    const info = await original(file, options)
    const inode = typeof file === "string" ? inodes.get(file) : undefined
    if (inode !== undefined) {
      Object.defineProperty(info, "ino", { value: typeof info.ino === "bigint" ? inode : Number(inode) })
    }
    return info
  }) as typeof fs.stat)
  try {
    const registered = await Project.fromDirectory(target.path)
    await Instance.provideProjectIdentity({ directory: target.path, fn: () => Instance.project.id })
    using _registry = closeProjectDeletionRegistryAdmission(registered.project.id)
    using _instances = await Instance.closeProjectAdmission({
      projectID: registered.project.id,
      directories: [target.path],
    })
    await Instance.disposeProjectEntries(registered.project.id, 1_000)
    const independentID = await Instance.provideProjectIdentity({
      directory: independent.path,
      fn: () => Instance.project.id,
    })
    expect({ targetID: registered.project.id, independentID }).toEqual({
      targetID: Project.directoryProjectID(target.path),
      independentID: Project.directoryProjectID(independent.path),
    })
  } finally {
    observe.mockRestore()
  }
}, 90_000)

test("recognizes two real hard-link paths as the same filesystem identity", async () => {
  await using project = await memoryProject()
  const source = path.join(project.path, "source.txt")
  const alias = path.join(project.path, "alias.txt")
  await fs.writeFile(source, "exact identity")
  await fs.link(source, alias)
  expect(await Project.sameFilesystemLocation(source, alias)).toBe(true)
})

test("a later physical comparison observes the current replacement and its new hard link", async () => {
  await using directory = await tmpdir()
  const source = path.join(directory.path, "source.txt")
  const replacement = path.join(directory.path, "replacement.txt")
  const currentAlias = path.join(directory.path, "current-alias.txt")
  await fs.writeFile(source, "original identity")
  await fs.link(source, replacement)
  expect(await Project.sameFilesystemLocation(source, replacement)).toBe(true)
  await fs.unlink(replacement)
  await fs.writeFile(replacement, "current replacement identity")
  await fs.link(replacement, currentAlias)
  expect(await Project.sameFilesystemLocation(replacement, currentAlias)).toBe(true)
})
