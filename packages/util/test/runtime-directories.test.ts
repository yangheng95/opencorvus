import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {
  createManagedTemporaryDirectory,
  removeManagedDirectoryTree,
  removeManagedDirectoryTreeSync,
} from "../src/runtime-directories"

test("managed removal settles concurrent read-only trees and preserves directory-link targets", async () => {
  const root = await createManagedTemporaryDirectory(os.tmpdir(), "opencorvus-remove-test-")
  expect(path.dirname(await fs.realpath(root)).toLowerCase()).toBe((await fs.realpath(os.tmpdir())).toLowerCase())
  try {
    const retained = path.join(root, "retained")
    await fs.mkdir(retained)
    await fs.writeFile(path.join(retained, "receipt"), "retained target")
    let settled = 0
    for (let round = 0; round < 150; round++) {
      const target = await createManagedTemporaryDirectory(root, "tree-")
      await fs.mkdir(path.join(target, ".git", "objects"), { recursive: true })
      const readonly = path.join(target, ".git", "objects", "receipt")
      await fs.writeFile(readonly, "owned file")
      await fs.chmod(readonly, 0o444)
      await fs.symlink(retained, path.join(target, "linked-target"), process.platform === "win32" ? "junction" : "dir")
      const removals = await Promise.allSettled(
        Array.from({ length: 8 }, async () => {
          await removeManagedDirectoryTree(target)
          settled++
        }),
      )
      expect(removals.map(({ status }) => status)).toEqual(Array(8).fill("fulfilled"))
      // A successful new exclusive directory creation is the cleanup contract.
      await fs.mkdir(target)
      await fs.writeFile(path.join(target, "replacement"), "new occurrence")
      expect(await fs.readFile(path.join(target, "replacement"), "utf8")).toBe("new occurrence")
      removeManagedDirectoryTreeSync(target)
      await removeManagedDirectoryTree(target)
    }
    expect(settled).toBe(1200)
    expect(await fs.readFile(path.join(retained, "receipt"), "utf8")).toBe("retained target")
    expect(await fs.readdir(root)).toEqual(["retained"])
  } finally {
    await removeManagedDirectoryTree(root)
  }
}, 60_000)

test("managed synchronous removal clears nested read-only files for a new occurrence", async () => {
  const root = await createManagedTemporaryDirectory(os.tmpdir(), "opencorvus-remove-sync-")
  expect(path.dirname(await fs.realpath(root)).toLowerCase()).toBe((await fs.realpath(os.tmpdir())).toLowerCase())
  try {
    const target = path.join(root, "literal[tree]")
    await fs.mkdir(path.join(target, "nested"), { recursive: true })
    const file = path.join(target, "nested", "receipt")
    await fs.writeFile(file, "first occurrence")
    await fs.chmod(file, 0o444)
    removeManagedDirectoryTreeSync(target)
    await fs.mkdir(target)
    await fs.writeFile(path.join(target, "receipt"), "replacement occurrence")
    expect(await fs.readFile(path.join(target, "receipt"), "utf8")).toBe("replacement occurrence")
  } finally {
    await removeManagedDirectoryTree(root)
  }
})
