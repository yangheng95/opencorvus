import { expect, test } from "bun:test"
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { executionCapsuleSourceTreeDigest, executionCapsuleSourceTreeSnapshot } from "../src/execution-capsule/tree-digest"

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
    await Promise.all([
      rm(root, { recursive: true, force: true }),
      rm(dependency, { recursive: true, force: true }),
    ])
  }
})
