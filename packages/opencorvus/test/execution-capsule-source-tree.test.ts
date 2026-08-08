import { expect, test } from "bun:test"
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {
  ExecutionCapsuleTreeInspectionConflictError,
  assertExecutionCapsuleDirectoryEntriesStable,
  assertExecutionCapsuleSourceEnumerationStable,
  executionCapsuleSourceTreeDigest,
  executionCapsuleSourceTreeSnapshot,
  executionCapsuleTreeDigest,
  executionCapsuleTreeSnapshot,
} from "../src/execution-capsule/tree-digest"

const posixTest = process.platform === "win32" ? test.skip : test

async function git(root: string, ...args: string[]) {
  const child = Bun.spawn(["git", ...args], { cwd: root, stdout: "pipe", stderr: "pipe" })
  const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()])
  if (exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${stderr.trim()}`)
}

test("Task source snapshot remains stable across Host runtime publications", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-task-source-tree-"))
  try {
    await git(root, "init", "--quiet")
    await writeFile(path.join(root, "README.md"), "source revision one\n")
    await git(root, "add", "README.md")
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

test("Task source snapshot equals the complete Git source selection", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-task-git-source-"))
  const dependency = await mkdtemp(path.join(os.tmpdir(), "opencorvus-task-dependency-"))
  try {
    await git(root, "init", "--quiet")
    await writeFile(path.join(root, ".gitignore"), "node_modules/\n")
    await writeFile(path.join(root, "README.md"), "tracked source\n")
    await mkdir(path.join(root, "src"))
    await writeFile(path.join(root, "src", "app.ts"), "export const ready = true\n")
    await mkdir(path.join(root, "node_modules", ".bun", "dependency", "node_modules"), { recursive: true })
    await writeFile(path.join(dependency, "package.json"), "{}\n")
    await symlink(
      dependency,
      path.join(root, "node_modules", ".bun", "dependency", "node_modules", "dependency"),
      process.platform === "win32" ? "junction" : "dir",
    )
    await git(root, "add", ".gitignore", "README.md")

    const first = await executionCapsuleSourceTreeSnapshot(root)
    const firstDigest = await executionCapsuleSourceTreeDigest(root)
    const second = await executionCapsuleSourceTreeSnapshot(root)

    expect({
      files: first.files.map((file) => file.path),
      digest: await executionCapsuleSourceTreeDigest(root),
      repeated: second,
    }).toEqual({
      files: [".gitignore", "README.md", "src/app.ts"],
      digest: firstDigest,
      repeated: first,
    })
  } finally {
    await Promise.all([rm(root, { recursive: true, force: true }), rm(dependency, { recursive: true, force: true })])
  }
})

test("runtime tree and Task source tree each produce their complete canonical snapshot", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-capsule-tree-contract-"))
  try {
    await git(root, "init", "--quiet")
    await writeFile(path.join(root, ".gitignore"), "runtime/\n")
    await writeFile(path.join(root, "README.md"), "tracked source\n")
    await mkdir(path.join(root, "src"))
    await writeFile(path.join(root, "src", "app.ts"), "export const ready = true\n")
    const runtime = path.join(root, "runtime")
    await mkdir(path.join(runtime, "nested"), { recursive: true })
    await writeFile(path.join(runtime, "z-last.txt"), "last\n")
    await writeFile(path.join(runtime, "A-first.txt"), "first\n")
    await writeFile(path.join(runtime, "nested", "mid.txt"), "middle\n")
    await git(root, "add", ".gitignore", "README.md")

    const runtimeSnapshot = await executionCapsuleTreeSnapshot(runtime)
    const runtimeDigest = await executionCapsuleTreeDigest(runtime)
    const sourceSnapshot = await executionCapsuleSourceTreeSnapshot(root)

    expect({
      runtimeFiles: runtimeSnapshot.files.map((file) => file.path),
      repeatedRuntime: await executionCapsuleTreeSnapshot(runtime),
      runtimeDigests: [runtimeDigest, await executionCapsuleTreeDigest(runtime)],
      sourceFiles: sourceSnapshot.files.map((file) => file.path),
    }).toEqual({
      runtimeFiles: ["A-first.txt", "nested/mid.txt", "z-last.txt"],
      repeatedRuntime: runtimeSnapshot,
      runtimeDigests: [runtimeDigest, runtimeDigest],
      sourceFiles: [".gitignore", "README.md", "src/app.ts"],
    })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("symlinked root authority maps to the exact tree inspection conflict", async () => {
  const container = await mkdtemp(path.join(os.tmpdir(), "opencorvus-capsule-root-authority-"))
  try {
    const source = path.join(container, "source")
    const linkedRoot = path.join(container, "linked-root")
    await mkdir(source)
    await writeFile(path.join(source, "runtime.txt"), "runtime\n")
    await symlink(source, linkedRoot, process.platform === "win32" ? "junction" : "dir")

    try {
      await executionCapsuleTreeSnapshot(linkedRoot)
      throw new Error("Expected the exact Execution Capsule tree inspection conflict")
    } catch (error) {
      expect({
        instance: error instanceof ExecutionCapsuleTreeInspectionConflictError,
        value: ExecutionCapsuleTreeInspectionConflictError.isInstance(error) ? error.toObject() : null,
      }).toEqual({
        instance: true,
        value: {
          name: "ExecutionCapsuleTreeInspectionConflictError",
          data: {
            message: `Execution Capsule tree identity changed while reading ${linkedRoot}.`,
            path: linkedRoot,
            reason: "root_identity_changed",
          },
        },
      })
    }
  } finally {
    await rm(container, { recursive: true, force: true })
  }
})

test("tree membership changes map to exact typed inspection conflicts", () => {
  const directory = "runtime-directory"
  const source = "task-source"
  const inspect = (run: () => void) => {
    try {
      run()
      throw new Error("Expected the exact Execution Capsule tree inspection conflict")
    } catch (error) {
      return ExecutionCapsuleTreeInspectionConflictError.isInstance(error) ? error.toObject() : null
    }
  }

  expect([
    inspect(() =>
      assertExecutionCapsuleDirectoryEntriesStable(
        directory,
        [{ name: "runtime.js", type: "file" }],
        [
          { name: "runtime.js", type: "file" },
          { name: "worker.js", type: "file" },
        ],
      ),
    ),
    inspect(() => assertExecutionCapsuleSourceEnumerationStable(source, ["README.md"], ["README.md", "src/app.ts"])),
  ]).toEqual([
    {
      name: "ExecutionCapsuleTreeInspectionConflictError",
      data: {
        message: `Execution Capsule tree identity changed while reading ${directory}.`,
        path: directory,
        reason: "directory_entries_changed",
      },
    },
    {
      name: "ExecutionCapsuleTreeInspectionConflictError",
      data: {
        message: `Execution Capsule tree identity changed while reading ${source}.`,
        path: source,
        reason: "source_enumeration_changed",
      },
    },
  ])
})

posixTest("Task source snapshot preserves the exact raw symlink target bytes", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-task-raw-symlink-"))
  try {
    await git(root, "init", "--quiet")
    const rawTarget = Buffer.from([0x74, 0x61, 0x72, 0x67, 0x65, 0x74, 0x2d, 0x80])
    await symlink(rawTarget, path.join(root, "raw-link"))
    await git(root, "add", "raw-link")

    const snapshot = await executionCapsuleSourceTreeSnapshot(root)
    expect({
      files: snapshot.files.map((file) => file.path),
      target: Buffer.from(snapshot.files[0]!.bytes_base64, "base64"),
    }).toEqual({
      files: ["raw-link"],
      target: rawTarget,
    })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("Task source snapshot projects initialized nested repository source bytes", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-task-nested-source-"))
  try {
    await git(root, "init", "--quiet")
    await git(root, "config", "user.name", "OpenCorvus Test")
    await git(root, "config", "user.email", "opencorvus-test@example.invalid")
    await writeFile(path.join(root, "root.txt"), "root source\n")
    const child = path.join(root, "child")
    await mkdir(child)
    await git(child, "init", "--quiet")
    await git(child, "config", "user.name", "OpenCorvus Test")
    await git(child, "config", "user.email", "opencorvus-test@example.invalid")
    await writeFile(path.join(child, "child.txt"), "child source one\n")
    await git(child, "add", "child.txt")
    await git(child, "commit", "--quiet", "-m", "child source")
    await git(root, "add", "root.txt", "child")

    const first = await executionCapsuleSourceTreeSnapshot(root)
    const firstDigest = await executionCapsuleSourceTreeDigest(root)
    await writeFile(path.join(child, "child.txt"), "child source two\n")
    const second = await executionCapsuleSourceTreeSnapshot(root)

    expect({
      firstFiles: first.files.map((file) => file.path),
      firstChildBytes: Buffer.from(first.files[0]!.bytes_base64, "base64").toString(),
      secondFiles: second.files.map((file) => file.path),
      secondChildBytes: Buffer.from(second.files[0]!.bytes_base64, "base64").toString(),
      digests: [firstDigest, await executionCapsuleSourceTreeDigest(root)],
    }).toEqual({
      firstFiles: ["child/child.txt", "root.txt"],
      firstChildBytes: "child source one\n",
      secondFiles: ["child/child.txt", "root.txt"],
      secondChildBytes: "child source two\n",
      digests: [firstDigest, expect.stringMatching(/^[0-9a-f]{64}$/)],
    })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
