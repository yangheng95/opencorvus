import { createHash } from "node:crypto"
import { afterAll, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { EngineGit } from "../src/engine/git"
import { EngineGitProcess } from "../src/engine/git-process"
import { requireTask } from "../src/engine/store"
import { Instance } from "../src/project/instance"
import { hostGit } from "../src/util/git"
import { Worktree } from "../src/worktree"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { createEngineGitCheckpointTask } from "./fixture/engine-git"

const TEST_TIMEOUT_MILLISECONDS = 60_000

afterAll(async () => {
  await resetMemoryDatabase()
})

async function requireSuccess(result: Awaited<ReturnType<typeof hostGit>>) {
  expect(result.exitCode).toBe(0)
  return result
}

async function head(directory: string) {
  return (await requireSuccess(await hostGit(["rev-parse", "HEAD"], { cwd: directory }))).text().trim()
}

async function refValue(directory: string, ref: string) {
  return (await requireSuccess(await hostGit(["rev-parse", "--verify", ref], { cwd: directory }))).text().trim()
}

async function symbolicHead(directory: string) {
  return (await requireSuccess(await hostGit(["symbolic-ref", "HEAD"], { cwd: directory }))).text().trim()
}

async function digest(file: string) {
  return createHash("sha256")
    .update(await fs.readFile(file))
    .digest("hex")
}

async function optionalBytes(file: string) {
  return fs.readFile(file).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined
    throw error
  })
}

describe("Engine Git batched repository transaction", () => {
  test(
    "restores the published checkpoint when final project-lease verification fails",
    async () => {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const gitignorePath = path.join(project.path, ".gitignore")
          const gitattributesPath = path.join(project.path, ".gitattributes")
          await fs.writeFile(gitignorePath, Buffer.from("user-cache/\r\n", "utf8"))
          await fs.writeFile(gitattributesPath, Buffer.from("*.json text eol=lf\r\n", "utf8"))
          const taskID = await createEngineGitCheckpointTask({
            projectPath: project.path,
            title: "Engine Git final lease recovery",
            packageDigestCharacter: "c",
          })
          const indexPath = (
            await requireSuccess(
              await hostGit(["rev-parse", "--path-format=absolute", "--git-path", "index"], {
                cwd: project.path,
              }),
            )
          )
            .text()
            .trim()
          const predecessor = {
            head: await head(project.path),
            index: await digest(indexPath),
            gitignore: await optionalBytes(gitignorePath),
            gitattributes: await optionalBytes(gitattributesPath),
          }

          const originalWithGitLock = Worktree.withGitLock
          let injected = false
          ;(Worktree as any).withGitLock = async (fn: Parameters<typeof Worktree.withGitLock>[0]) =>
            originalWithGitLock(async (lease) => {
              await fn(lease)
              injected = true
              throw new Error("project Git lease final verification failed")
            })
          let prepared: Awaited<ReturnType<typeof EngineGit.prepare>>
          try {
            prepared = await EngineGit.prepare(requireTask(taskID))
          } finally {
            ;(Worktree as any).withGitLock = originalWithGitLock
          }

          expect({ injected, error: "error" in prepared ? prepared.error : undefined }).toEqual({
            injected: true,
            error: expect.stringContaining("project Git lease final verification failed"),
          })
          expect({
            head: await head(project.path),
            index: await digest(indexPath),
            gitignore: await optionalBytes(gitignorePath),
            gitattributes: await optionalBytes(gitattributesPath),
          }).toEqual(predecessor)
        },
      })
    },
    TEST_TIMEOUT_MILLISECONDS,
  )

  test(
    "restores a child ref and index after post-CAS index installation failure, then records nested gitlinks",
    async () => {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const child = path.join(project.path, "child")
          await fs.mkdir(child)
          await requireSuccess(await hostGit(["init"], { cwd: child }))
          await requireSuccess(await hostGit(["config", "user.name", "OpenCorvus Test"], { cwd: child }))
          await requireSuccess(
            await hostGit(["config", "user.email", "opencorvus-test@example.invalid"], { cwd: child }),
          )
          await fs.writeFile(path.join(child, "child.txt"), "child predecessor\n")
          await requireSuccess(await hostGit(["add", "child.txt"], { cwd: child }))
          await requireSuccess(await hostGit(["commit", "--no-verify", "-m", "child predecessor"], { cwd: child }))
          const uninitializedCommit = await head(child)
          await fs.mkdir(path.join(project.path, "uninitialized"))
          await fs.mkdir(path.join(project.path, "uninitialized-deleted"))
          await fs.writeFile(path.join(project.path, "root.txt"), "root predecessor\n")
          await requireSuccess(await hostGit(["add", "root.txt", "child"], { cwd: project.path }))
          await requireSuccess(
            await hostGit(["update-index", "--add", "--cacheinfo", `160000,${uninitializedCommit},uninitialized`], {
              cwd: project.path,
            }),
          )
          await requireSuccess(
            await hostGit(
              ["update-index", "--add", "--cacheinfo", `160000,${uninitializedCommit},uninitialized-deleted`],
              { cwd: project.path },
            ),
          )
          await requireSuccess(
            await hostGit(["commit", "--no-verify", "-m", "root predecessor"], { cwd: project.path }),
          )

          const taskID = await createEngineGitCheckpointTask({
            projectPath: project.path,
            title: "Engine Git nested transaction",
            packageDigestCharacter: "b",
          })

          const prepared = await EngineGit.prepare(requireTask(taskID))
          expect((prepared.task.metadata as any).git.baseline.checkpoint_receipt).toMatchObject({
            repository_count: 4,
            blob_import_process_count: 2,
            index_import_process_count: 2,
            outcome: "success",
          })
          const baselineRepositories = (prepared.task.metadata as any).git.baseline.repositories as Array<any>
          const childAuthority = baselineRepositories.find((repository) => repository.path === "child").authority
          const rootAuthority = baselineRepositories.find((repository) => repository.path === ".").authority
          const updatedUninitializedCommit = await head(child)
          await requireSuccess(
            await hostGit(
              ["update-index", "--add", "--cacheinfo", `160000,${updatedUninitializedCommit},uninitialized`],
              { cwd: project.path },
            ),
          )
          const predecessor = {
            childHead: await head(child),
            rootHead: await head(project.path),
            childIndex: await digest(childAuthority.index_path),
            rootIndex: await digest(rootAuthority.index_path),
          }

          await fs.writeFile(path.join(child, "child.txt"), "child result\n")
          await fs.writeFile(path.join(project.path, "root.txt"), "root result\n")
          await fs.rm(path.join(project.path, "uninitialized-deleted"), { recursive: true })

          const originalCompareAndSwap = EngineGitProcess.compareAndSwapRef
          let injected = false
          EngineGitProcess.compareAndSwapRef = async (repository, ref, next, previous) => {
            const result = await originalCompareAndSwap(repository, ref, next, previous)
            if (!injected && result.exitCode === 0 && path.resolve(repository.workTree) === path.resolve(child)) {
              injected = true
              await fs.rm(`${childAuthority.index_path}.lock`, { force: true })
            }
            return result
          }
          let failed: Awaited<ReturnType<typeof EngineGit.complete>>
          try {
            failed = await EngineGit.complete(requireTask(taskID))
          } finally {
            EngineGitProcess.compareAndSwapRef = originalCompareAndSwap
          }

          expect({ injected, error: "error" in failed ? failed.error : undefined }).toEqual({
            injected: true,
            error: expect.stringContaining("Repository-tree checkpoint failed"),
          })
          expect({
            childHead: await head(child),
            rootHead: await head(project.path),
            childIndex: await digest(childAuthority.index_path),
            rootIndex: await digest(rootAuthority.index_path),
          }).toEqual(predecessor)

          const completed = await EngineGit.complete(requireTask(taskID))
          expect("error" in completed ? completed.error : undefined).toBeUndefined()
          const resultMetadata = (completed.task.metadata as any).git.result
          expect(resultMetadata.checkpoint_receipt).toMatchObject({
            repository_count: 3,
            blob_import_process_count: 2,
            index_import_process_count: 2,
            outcome: "success",
          })
          const resultRepositories = resultMetadata.repositories as Array<any>
          const childCheckpoint = resultRepositories.find((repository) => repository.path === "child")
          const rootCheckpoint = resultRepositories.find((repository) => repository.path === ".")
          const uninitializedCheckpoint = resultRepositories.find((repository) => repository.path === "uninitialized")
          const rootGitlink = await requireSuccess(
            await hostGit(["ls-tree", rootCheckpoint.commit, "child"], { cwd: project.path }),
          )
          const uninitializedGitlink = await requireSuccess(
            await hostGit(["ls-tree", rootCheckpoint.commit, "uninitialized"], { cwd: project.path }),
          )
          const rootProjection = await requireSuccess(
            await hostGit(["ls-tree", "-rz", "--full-tree", rootCheckpoint.commit], { cwd: project.path }),
          )
          expect({
            childHead: await head(child),
            rootHead: await head(project.path),
            rootGitlink: rootGitlink.text().trim(),
            uninitializedGitlink: uninitializedGitlink.text().trim(),
            uninitializedCheckpoint,
            rootProjection: rootProjection.stdout
              .toString()
              .slice(0, -1)
              .split("\0")
              .map((entry) => {
                const match = /^(\d{6}) (?:blob|commit) [0-9a-f]+\t([\s\S]+)$/.exec(entry)
                if (!match) throw new Error(`Unexpected root tree entry: ${entry}`)
                return { mode: match[1], path: match[2] }
              }),
          }).toEqual({
            childHead: childCheckpoint.commit,
            rootHead: rootCheckpoint.commit,
            rootGitlink: `160000 commit ${childCheckpoint.commit}\tchild`,
            uninitializedGitlink: `160000 commit ${updatedUninitializedCommit}\tuninitialized`,
            uninitializedCheckpoint: expect.objectContaining({
              path: "uninitialized",
              mode: "uninitialized",
              commit: updatedUninitializedCommit,
            }),
            rootProjection: [
              { mode: "100644", path: ".gitattributes" },
              { mode: "100644", path: ".gitignore" },
              { mode: "160000", path: "child" },
              { mode: "100644", path: "root.txt" },
              { mode: "160000", path: "uninitialized" },
            ],
          })
        },
      })
    },
    TEST_TIMEOUT_MILLISECONDS,
  )

  test(
    "restores the frozen owning ref when symbolic HEAD moves to another predecessor branch",
    async () => {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const taskID = await createEngineGitCheckpointTask({
            projectPath: project.path,
            title: "Engine Git frozen owning ref recovery",
            packageDigestCharacter: "f",
          })
          const prepared = await EngineGit.prepare(requireTask(taskID))
          expect("error" in prepared ? prepared.error : undefined).toBeUndefined()
          const rootAuthority = (prepared.task.metadata as any).git.baseline.repositories.find(
            (repository: any) => repository.path === ".",
          ).authority
          const owningRef = await symbolicHead(project.path)
          const predecessor = {
            owningRef,
            commit: await refValue(project.path, owningRef),
            index: await digest(rootAuthority.index_path),
          }
          const alternateRef = "refs/heads/recovery-predecessor"
          await requireSuccess(
            await hostGit(["branch", alternateRef.slice("refs/heads/".length), predecessor.commit], {
              cwd: project.path,
            }),
          )
          await fs.writeFile(path.join(project.path, "result.txt"), "checkpoint result\n")

          const originalCompareAndSwap = EngineGitProcess.compareAndSwapRef
          const originalWithGitLock = Worktree.withGitLock
          let appliedCommit: string | undefined
          EngineGitProcess.compareAndSwapRef = async (repository, ref, next, previous, options) => {
            const result = await originalCompareAndSwap(repository, ref, next, previous, options)
            if (!appliedCommit && result.exitCode === 0 && ref === owningRef) {
              appliedCommit = next
              await requireSuccess(await hostGit(["symbolic-ref", "HEAD", alternateRef], { cwd: project.path }))
            }
            return result
          }
          ;(Worktree as any).withGitLock = async (fn: Parameters<typeof Worktree.withGitLock>[0]) =>
            originalWithGitLock(async (lease) => {
              await fn(lease)
              throw new Error("project Git lease final verification failed after symbolic HEAD move")
            })
          let completed: Awaited<ReturnType<typeof EngineGit.complete>>
          try {
            completed = await EngineGit.complete(requireTask(taskID))
          } finally {
            EngineGitProcess.compareAndSwapRef = originalCompareAndSwap
            ;(Worktree as any).withGitLock = originalWithGitLock
          }

          expect({ appliedCommit, error: "error" in completed ? completed.error : undefined }).toEqual({
            appliedCommit: expect.any(String),
            error: expect.any(String),
          })
          expect({
            symbolicHead: await symbolicHead(project.path),
            owningRef: await refValue(project.path, owningRef),
            head: await head(project.path),
            index: await digest(rootAuthority.index_path),
          }).toEqual({
            symbolicHead: alternateRef,
            owningRef: predecessor.commit,
            head: predecessor.commit,
            index: predecessor.index,
          })
        },
      })
    },
    TEST_TIMEOUT_MILLISECONDS,
  )

  test(
    "preserves an external winner ref and index when rollback loses its compare-and-swap authority",
    async () => {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          await fs.writeFile(path.join(project.path, "root.txt"), "predecessor\n")
          await requireSuccess(await hostGit(["add", "root.txt"], { cwd: project.path }))
          await requireSuccess(await hostGit(["commit", "--no-verify", "-m", "predecessor"], { cwd: project.path }))
          const taskID = await createEngineGitCheckpointTask({
            projectPath: project.path,
            title: "Engine Git external rollback winner",
            packageDigestCharacter: "d",
          })
          const prepared = await EngineGit.prepare(requireTask(taskID))
          expect("error" in prepared ? prepared.error : undefined).toBeUndefined()
          const rootAuthority = (prepared.task.metadata as any).git.baseline.repositories.find(
            (repository: any) => repository.path === ".",
          ).authority
          const predecessorHead = await head(project.path)
          const externalIndexPath = path.join(project.path, ".git", "external-winner.index")
          await fs.copyFile(rootAuthority.index_path, externalIndexPath)
          await fs.writeFile(path.join(project.path, "external-winner.txt"), "external winner\n")
          await requireSuccess(
            await hostGit(["add", "external-winner.txt"], {
              cwd: project.path,
              env: { GIT_INDEX_FILE: externalIndexPath },
            }),
          )
          const externalTree = (
            await requireSuccess(
              await hostGit(["write-tree"], { cwd: project.path, env: { GIT_INDEX_FILE: externalIndexPath } }),
            )
          )
            .text()
            .trim()
          const externalCommit = (
            await requireSuccess(
              await hostGit(["commit-tree", externalTree, "-p", predecessorHead, "-m", "external winner"], {
                cwd: project.path,
              }),
            )
          )
            .text()
            .trim()
          const externalIndexDigest = await digest(externalIndexPath)
          await fs.rm(path.join(project.path, "external-winner.txt"))
          await fs.writeFile(path.join(project.path, "root.txt"), "checkpoint result\n")

          const originalCompareAndSwap = EngineGitProcess.compareAndSwapRef
          let appliedCommit: string | undefined
          let externalInstalled = false
          EngineGitProcess.compareAndSwapRef = async (repository, ref, next, previous) => {
            if (!appliedCommit) {
              const result = await originalCompareAndSwap(repository, ref, next, previous)
              if (result.exitCode === 0) {
                appliedCommit = next
                await fs.rm(`${rootAuthority.index_path}.lock`, { force: true })
              }
              return result
            }
            if (!externalInstalled && previous === appliedCommit && next === predecessorHead) {
              await requireSuccess(
                await hostGit(["update-ref", ref, externalCommit, appliedCommit], { cwd: project.path }),
              )
              await fs.copyFile(externalIndexPath, rootAuthority.index_path)
              externalInstalled = true
            }
            return originalCompareAndSwap(repository, ref, next, previous)
          }
          let completed: Awaited<ReturnType<typeof EngineGit.complete>>
          try {
            completed = await EngineGit.complete(requireTask(taskID))
          } finally {
            EngineGitProcess.compareAndSwapRef = originalCompareAndSwap
          }

          expect({ externalInstalled, error: "error" in completed ? completed.error : undefined }).toEqual({
            externalInstalled: true,
            error: expect.stringContaining("recovery conflict: owning ref restore failed"),
          })
          expect({ head: await head(project.path), index: await digest(rootAuthority.index_path) }).toEqual({
            head: externalCommit,
            index: externalIndexDigest,
          })
        },
      })
    },
    TEST_TIMEOUT_MILLISECONDS,
  )

  test(
    "preserves the published unborn-ref checkpoint when recovery ref inspection fails",
    async () => {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const owningRef = await symbolicHead(project.path)
          await requireSuccess(await hostGit(["update-ref", "-d", owningRef], { cwd: project.path }))
          const taskID = await createEngineGitCheckpointTask({
            projectPath: project.path,
            title: "Engine Git unborn ref inspection recovery",
            packageDigestCharacter: "7",
          })
          const indexPath = (
            await requireSuccess(
              await hostGit(["rev-parse", "--path-format=absolute", "--git-path", "index"], { cwd: project.path }),
            )
          )
            .text()
            .trim()

          const originalWithGitLock = Worktree.withGitLock
          const originalResolveRef = EngineGitProcess.resolveRef
          let published: { ref: string; index: string } | undefined
          ;(Worktree as any).withGitLock = async (fn: Parameters<typeof Worktree.withGitLock>[0]) =>
            originalWithGitLock(async (lease) => {
              await fn(lease)
              published = {
                ref: await refValue(project.path, owningRef),
                index: await digest(indexPath),
              }
              throw new Error("project Git lease final verification failed after unborn ref publication")
            })
          EngineGitProcess.resolveRef = async () =>
            hostGit(["show-ref", "--verify", "--hash", "not-a-valid-ref"], { cwd: project.path })
          let prepared: Awaited<ReturnType<typeof EngineGit.prepare>>
          try {
            prepared = await EngineGit.prepare(requireTask(taskID))
          } finally {
            EngineGitProcess.resolveRef = originalResolveRef
            ;(Worktree as any).withGitLock = originalWithGitLock
          }

          expect({ published, error: "error" in prepared ? prepared.error : undefined }).toEqual({
            published: { ref: expect.any(String), index: expect.any(String) },
            error: expect.stringContaining("recovery conflict: owning ref inspection failed"),
          })
          expect({ ref: await refValue(project.path, owningRef), index: await digest(indexPath) }).toEqual(published)
        },
      })
    },
    TEST_TIMEOUT_MILLISECONDS,
  )

  test(
    "preserves an external staged index when recovery no longer owns the canonical index",
    async () => {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          await fs.writeFile(path.join(project.path, "root.txt"), "predecessor\n")
          await requireSuccess(await hostGit(["add", "root.txt"], { cwd: project.path }))
          await requireSuccess(await hostGit(["commit", "--no-verify", "-m", "predecessor"], { cwd: project.path }))
          const taskID = await createEngineGitCheckpointTask({
            projectPath: project.path,
            title: "Engine Git external index winner",
            packageDigestCharacter: "e",
          })
          const prepared = await EngineGit.prepare(requireTask(taskID))
          expect("error" in prepared ? prepared.error : undefined).toBeUndefined()
          const rootAuthority = (prepared.task.metadata as any).git.baseline.repositories.find(
            (repository: any) => repository.path === ".",
          ).authority
          const externalIndexPath = path.join(project.path, ".git", "external-staged.index")
          await fs.copyFile(rootAuthority.index_path, externalIndexPath)
          await fs.writeFile(path.join(project.path, "external-staged.txt"), "external staged bytes\n")
          await requireSuccess(
            await hostGit(["add", "external-staged.txt"], {
              cwd: project.path,
              env: { GIT_INDEX_FILE: externalIndexPath },
            }),
          )
          const externalIndexDigest = await digest(externalIndexPath)
          await fs.rm(path.join(project.path, "external-staged.txt"))
          await fs.writeFile(path.join(project.path, "root.txt"), "checkpoint result\n")

          const originalCompareAndSwap = EngineGitProcess.compareAndSwapRef
          let appliedCommit: string | undefined
          EngineGitProcess.compareAndSwapRef = async (repository, ref, next, previous) => {
            const result = await originalCompareAndSwap(repository, ref, next, previous)
            if (!appliedCommit && result.exitCode === 0) {
              appliedCommit = next
              await fs.rm(`${rootAuthority.index_path}.lock`, { force: true })
              await fs.copyFile(externalIndexPath, rootAuthority.index_path)
            }
            return result
          }
          let completed: Awaited<ReturnType<typeof EngineGit.complete>>
          try {
            completed = await EngineGit.complete(requireTask(taskID))
          } finally {
            EngineGitProcess.compareAndSwapRef = originalCompareAndSwap
          }

          expect({ appliedCommit, error: "error" in completed ? completed.error : undefined }).toEqual({
            appliedCommit: expect.any(String),
            error: expect.stringContaining("recovery conflict: canonical Git index changed"),
          })
          expect({ head: await head(project.path), index: await digest(rootAuthority.index_path) }).toEqual({
            head: appliedCommit,
            index: externalIndexDigest,
          })
        },
      })
    },
    TEST_TIMEOUT_MILLISECONDS,
  )
})
