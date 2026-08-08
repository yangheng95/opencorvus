import { afterAll, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { EngineGitProcess, type EngineGitFileFingerprint } from "../src/engine/git-process"
import { hostGit } from "../src/util/git"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(async () => {
  await resetMemoryDatabase()
})

async function repository(directory: string) {
  const result = await hostGit(["rev-parse", "--absolute-git-dir"], { cwd: directory })
  expect(result.exitCode).toBe(0)
  return { workTree: directory, gitDir: result.text().trim() }
}

function fingerprint(stat: Awaited<ReturnType<typeof fs.stat>>): EngineGitFileFingerprint {
  return {
    device: stat.dev,
    inode: stat.ino,
    mode: stat.mode,
    size: stat.size,
    modifiedMilliseconds: stat.mtimeMs,
    changedMilliseconds: stat.ctimeMs,
  }
}

describe("Engine Git batched raw import", () => {
  test("projects complete marks independently of export record order", async () => {
    await using project = await memoryProject()
    const target = await repository(project.path)
    const marksFile = path.join(project.path, ".git", "reordered-export.marks")
    const sources = [
      { mark: 1, content: { kind: "bytes" as const, bytes: Buffer.from("first") } },
      { mark: 2, content: { kind: "bytes" as const, bytes: Buffer.from("second has a different size") } },
    ]
    const originalReadFile = fs.readFile
    ;(fs as any).readFile = async (...args: Parameters<typeof fs.readFile>) => {
      const value = await originalReadFile(...args)
      if (path.resolve(String(args[0])) !== path.resolve(marksFile) || typeof value !== "string") return value
      return `${value.trimEnd().split(/\r?\n/).toReversed().join("\n")}\n`
    }
    try {
      const imported = await EngineGitProcess.importRawBlobs(target, sources, marksFile, "sha1")
      expect(imported.result.exitCode).toBe(0)
      const contents = await Promise.all(
        sources.map(async (source) => {
          const objectID = imported.objectIDs.get(source.mark)!
          const result = await hostGit(["cat-file", "blob", objectID], { cwd: project.path })
          expect(result.exitCode).toBe(0)
          return { mark: source.mark, bytes: result.stdout.toString() }
        }),
      )
      expect(contents).toEqual([
        { mark: 1, bytes: "first" },
        { mark: 2, bytes: "second has a different size" },
      ])
    } finally {
      ;(fs as any).readFile = originalReadFile
    }
  })

  test("returns the snapshot identity error when the pathname no longer names the opened file", async () => {
    await using project = await memoryProject()
    const target = await repository(project.path)
    const sourcePath = path.join(project.path, "source.bin")
    const replacementPath = path.join(project.path, "replacement.bin")
    const marksFile = path.join(project.path, ".git", "pathname-identity.marks")
    await fs.writeFile(sourcePath, Buffer.alloc(1024, 1))
    await fs.writeFile(replacementPath, Buffer.alloc(2048, 2))
    const sourceFingerprint = fingerprint(await fs.stat(sourcePath))
    const originalLstat = fs.lstat
    ;(fs as any).lstat = async (...args: Parameters<typeof fs.lstat>) =>
      path.resolve(String(args[0])) === path.resolve(sourcePath)
        ? originalLstat(replacementPath)
        : originalLstat(...args)
    try {
      await expect(
        EngineGitProcess.importRawBlobs(
          target,
          [{ mark: 1, content: { kind: "file", absolutePath: sourcePath, fingerprint: sourceFingerprint } }],
          marksFile,
          "sha1",
        ),
      ).rejects.toThrow(`Engine Git snapshot source changed during import: ${sourcePath}`)
    } finally {
      ;(fs as any).lstat = originalLstat
    }
  })
})
