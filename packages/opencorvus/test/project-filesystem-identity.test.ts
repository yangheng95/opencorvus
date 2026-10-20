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

test("a real directory alias resolves its physical identity when inode metadata is unknown", async () => {
  await using directory = await tmpdir()
  const target = path.join(directory.path, "target")
  const alias = path.join(directory.path, "alias")
  await fs.mkdir(target)
  await fs.symlink(target, alias, process.platform === "win32" ? "junction" : "dir")
  const original = fs.stat
  using _stat = spyOn(fs, "stat").mockImplementation((async (file, options) => {
    const info = await original(file, options)
    if (file === alias) Object.defineProperty(info, "ino", { value: typeof info.ino === "bigint" ? 0n : 0 })
    return info
  }) as typeof fs.stat)
  expect(await Project.sameFilesystemLocation(target, alias)).toBe(true)
})

test("a required metadata read returns its original filesystem error", async () => {
  await using directory = await tmpdir()
  const source = path.join(directory.path, "source.txt")
  const alias = path.join(directory.path, "alias.txt")
  await fs.writeFile(source, "actual metadata error contract")
  await fs.link(source, alias)
  const failure = Object.assign(new Error("actual declared filesystem access failure"), { code: "EACCES" })
  const original = fs.stat
  using _stat = spyOn(fs, "stat").mockImplementation((async (file, options) => {
    if (file === source) throw failure
    return original(file, options)
  }) as typeof fs.stat)
  expect(await Project.sameFilesystemLocation(source, alias).catch((error) => error)).toBe(failure)
})

test("unknown metadata preserves the original required physical-path error", async () => {
  await using directory = await tmpdir()
  const source = path.join(directory.path, "source.txt")
  const alias = path.join(directory.path, "alias.txt")
  await fs.writeFile(source, "actual physical path error contract")
  await fs.link(source, alias)
  const originalStat = fs.stat
  using _stat = spyOn(fs, "stat").mockImplementation((async (file, options) => {
    const info = await originalStat(file, options)
    Object.defineProperty(info, "ino", { value: typeof info.ino === "bigint" ? 0n : 0 })
    return info
  }) as typeof fs.stat)
  const originalRealpath = fs.realpath
  const failure = Object.assign(new Error("actual declared physical path access failure"), { code: "EACCES" })
  using _realpath = spyOn(fs, "realpath").mockImplementation((async (file, options) => {
    if (file === source) throw failure
    return originalRealpath(file, options)
  }) as typeof fs.realpath)
  expect(await Project.sameFilesystemLocation(source, alias).catch((error) => error)).toBe(failure)
})
