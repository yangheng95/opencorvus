import { expect, test } from "bun:test"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { executionCapsuleSourceTreeDigest, executionCapsuleSourceTreeSnapshot } from "../src/execution-capsule/tree-digest"

test("Task source snapshot remains stable across Host runtime publications", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-task-source-tree-"))
  try {
    await writeFile(path.join(root, "README.md"), "source revision one\n")
    const initial = await executionCapsuleSourceTreeDigest(root)
    await mkdir(path.join(root, ".opencorvus", ".r", "t", "task-a"), { recursive: true })
    await writeFile(path.join(root, ".opencorvus", ".r", "t", "task-a", "events.ndjson"), "runtime fact\n")
    expect({
      digest: await executionCapsuleSourceTreeDigest(root),
      files: (await executionCapsuleSourceTreeSnapshot(root)).files.map((file) => file.path),
    }).toEqual({
      digest: initial,
      files: ["README.md"],
    })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
