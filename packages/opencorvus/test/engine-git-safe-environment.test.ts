import { afterAll, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { EngineGit } from "../src/engine/git"
import { requireTask } from "../src/engine/store"
import { Instance } from "../src/project/instance"
import { hostGit } from "../src/util/git"
import { Process } from "../src/util/process"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { createEngineGitCheckpointTask } from "./fixture/engine-git"

const GIT_CHECKPOINT_TEST_TIMEOUT_MILLISECONDS = 30_000

afterAll(async () => {
  await resetMemoryDatabase()
})

async function requireSuccess(result: Awaited<ReturnType<typeof hostGit>>) {
  expect(result.exitCode).toBe(0)
  return result
}

describe("Engine Git closed execution environment", () => {
  test(
    "checkpoints exact workspace bytes under a repository-declared clean filter",
    async () => {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          await requireSuccess(await hostGit(["config", "filter.mutate.clean", "false"], { cwd: project.path }))
          await fs.writeFile(
            path.join(project.path, ".gitattributes"),
            "sample.txt filter=mutate text eol=crlf\nbinary.bin -text\n",
          )
          await fs.writeFile(path.join(project.path, ".gitignore"), "declared.log\n")
          await fs.writeFile(path.join(project.path, "sample.txt"), "baseline raw bytes\n")
          const binaryBytes = Buffer.from([0, 10, 13, 255, 65, 0, 66])
          await fs.writeFile(path.join(project.path, "binary.bin"), binaryBytes)
          const specialPaths = [
            "-leading-dash.txt",
            "space name.txt",
            ...(process.platform === "win32" ? [] : ["tab\tname.txt", "line\nbreak.txt", 'quote"name.txt']),
            "unicode-机器学习.txt",
          ]
          await Promise.all(
            specialPaths.map((relativePath) =>
              fs.writeFile(path.join(project.path, relativePath), `bytes:${relativePath}`),
            ),
          )
          await fs.writeFile(path.join(project.path, "executable.sh"), "#!/bin/sh\nexit 0\n")
          await requireSuccess(await hostGit(["add", "executable.sh"], { cwd: project.path }))
          await requireSuccess(await hostGit(["update-index", "--chmod=+x", "executable.sh"], { cwd: project.path }))
          if (process.platform !== "win32") {
            await fs.symlink("sample.txt", path.join(project.path, "sample-link"))
          }

          const taskID = await createEngineGitCheckpointTask({
            projectPath: project.path,
            title: "Engine Git exact bytes",
          })

          const nativeTaskProcess = await Process.runTask(
            { taskID, cwd: project.path },
            [process.execPath, "-e", "process.stdout.write(process.cwd())"],
            { inactivityTimeoutMs: 10_000 },
          )
          expect({ code: nativeTaskProcess.code, cwd: nativeTaskProcess.stdout.toString() }).toEqual({
            code: 0,
            cwd: project.path,
          })

          const prepared = await EngineGit.prepare(requireTask(taskID))
          expect((prepared.task.metadata as any).git.baseline.mode).toBe("created_commit")
          await fs.writeFile(path.join(project.path, "declared.log"), "declared raw bytes\n")
          const acceptance = await EngineGit.commitAcceptanceRound({
            task: requireTask(taskID),
            iteration: 1,
            verdict: { verdict: "accepted", summary: "Declared-file projection", rejection_count: 0 },
            declaredChangedFiles: ["declared.log"],
          })
          expect(acceptance).toEqual({
            mode: "created_commit",
            commit: expect.stringMatching(/^[0-9a-f]{40}$/),
          })
          await fs.writeFile(path.join(project.path, "sample.txt"), "result raw bytes\n")
          await fs.rm(path.join(project.path, "-leading-dash.txt"))
          await fs.rm(path.join(project.path, "space name.txt"))
          await fs.mkdir(path.join(project.path, "space name.txt"))
          await fs.writeFile(path.join(project.path, "space name.txt", "nested.txt"), "replacement bytes")
          const completed = await EngineGit.complete(requireTask(taskID))
          expect((completed.task.metadata as any).git.result.mode).toBe("created_commit")

          const blob = await requireSuccess(await hostGit(["show", "HEAD:sample.txt"], { cwd: project.path }))
          expect(blob.text()).toBe("result raw bytes\n")
          const binaryBlob = await requireSuccess(await hostGit(["show", "HEAD:binary.bin"], { cwd: project.path }))
          expect(binaryBlob.stdout).toEqual(binaryBytes)
          const receipt = (completed.task.metadata as any).git.result.checkpoint_receipt
          expect(receipt).toMatchObject({
            checkpoint_stage: "result",
            repository_count: 1,
            blob_import_process_count: 1,
            index_import_process_count: 1,
            outcome: "success",
            command_counts: expect.objectContaining({
              "fast-import": 1,
              "update-index": 1,
            }),
          })
          expect(receipt.checkpoint_git_process_launch_count).toBeLessThanOrEqual(32)
          const tree = await requireSuccess(
            await hostGit(["ls-tree", "-rz", "--full-tree", "HEAD"], { cwd: project.path }),
          )
          const projected = tree.stdout
            .toString()
            .slice(0, -1)
            .split("\0")
            .map((entry) => {
              const match = /^(\d{6}) blob [0-9a-f]+\t([\s\S]+)$/.exec(entry)
              if (!match) throw new Error(`Unexpected tree entry: ${entry}`)
              return { mode: match[1], path: match[2] }
            })
            .toSorted((left, right) => left.path.localeCompare(right.path))
          expect(projected).toEqual(
            [
              ...[
                ".gitattributes",
                ".gitignore",
                "binary.bin",
                "declared.log",
                "sample.txt",
                "space name.txt/nested.txt",
                ...specialPaths.filter(
                  (relativePath) => !["-leading-dash.txt", "space name.txt"].includes(relativePath),
                ),
              ].map((relativePath) => ({ mode: "100644", path: relativePath })),
              { mode: "100755", path: "executable.sh" },
              ...(process.platform === "win32" ? [] : [{ mode: "120000", path: "sample-link" }]),
            ].toSorted((left, right) => left.path.localeCompare(right.path)),
          )
          if (process.platform !== "win32") {
            const linkBlob = await requireSuccess(await hostGit(["show", "HEAD:sample-link"], { cwd: project.path }))
            expect(linkBlob.stdout).toEqual(Buffer.from("sample.txt"))
          }
          const repositories = (completed.task.metadata as any).git.result.repositories
          const repositoryReceipt = repositories[0].receipt
          expect({
            snapshotPaths: repositoryReceipt.snapshot_path_count,
            classifiedPaths:
              repositoryReceipt.regular_file_count +
              repositoryReceipt.symlink_count +
              repositoryReceipt.gitlink_count +
              repositoryReceipt.missing_path_count +
              repositoryReceipt.directory_path_count,
            rawBlobs: repositoryReceipt.raw_blob_count,
            byteSources: repositoryReceipt.regular_file_count + repositoryReceipt.symlink_count,
          }).toEqual({
            snapshotPaths: repositoryReceipt.snapshot_path_count,
            classifiedPaths: repositoryReceipt.snapshot_path_count,
            rawBlobs: repositoryReceipt.raw_blob_count,
            byteSources: repositoryReceipt.raw_blob_count,
          })
          expect(repositories).toEqual([
            expect.objectContaining({
              path: ".",
              mode: "created_commit",
              authority: expect.objectContaining({
                workspace: await fs.realpath(project.path),
                git_marker_kind: "directory",
                git_dir: await fs.realpath(path.join(project.path, ".git")),
                common_dir: await fs.realpath(path.join(project.path, ".git")),
                object_format: "sha1",
                ref: expect.stringMatching(/^refs\/heads\//),
              }),
            }),
          ])
        },
      })
    },
    GIT_CHECKPOINT_TEST_TIMEOUT_MILLISECONDS,
  )

  test(
    "checkpoints native SHA-256 object identifiers and raw bytes",
    async () => {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          await fs.rm(path.join(project.path, ".git"), { recursive: true, force: true })
          await requireSuccess(await hostGit(["init", "--object-format=sha256"], { cwd: project.path }))
          await requireSuccess(await hostGit(["config", "user.name", "OpenCorvus Test"], { cwd: project.path }))
          await requireSuccess(
            await hostGit(["config", "user.email", "opencorvus-test@example.invalid"], { cwd: project.path }),
          )
          await requireSuccess(
            await hostGit(["commit", "--allow-empty", "--no-verify", "-m", "sha256 root"], { cwd: project.path }),
          )
          const source = Buffer.from([0, 1, 2, 10, 13, 254, 255])
          await fs.writeFile(path.join(project.path, "sha256.bin"), source)
          const taskID = await createEngineGitCheckpointTask({
            projectPath: project.path,
            title: "Engine Git SHA-256",
          })

          const prepared = await EngineGit.prepare(requireTask(taskID))
          expect((prepared.task.metadata as any).git.baseline.repositories).toEqual([
            expect.objectContaining({
              path: ".",
              commit: expect.stringMatching(/^[0-9a-f]{64}$/),
              tree: expect.stringMatching(/^[0-9a-f]{64}$/),
              authority: expect.objectContaining({ object_format: "sha256" }),
            }),
          ])

          const resultBytes = Buffer.from([...source, 42])
          await fs.writeFile(path.join(project.path, "sha256.bin"), resultBytes)
          const completed = await EngineGit.complete(requireTask(taskID))
          const metadata = (completed.task.metadata as any).git.result
          const blob = await requireSuccess(await hostGit(["show", "HEAD:sha256.bin"], { cwd: project.path }))
          expect({
            bytes: blob.stdout,
            commit: metadata.commit,
            tree: metadata.repositories[0].tree,
            receipt: metadata.checkpoint_receipt,
          }).toEqual({
            bytes: resultBytes,
            commit: expect.stringMatching(/^[0-9a-f]{64}$/),
            tree: expect.stringMatching(/^[0-9a-f]{64}$/),
            receipt: expect.objectContaining({
              blob_import_process_count: 1,
              index_import_process_count: 1,
              outcome: "success",
            }),
          })
        },
      })
    },
    GIT_CHECKPOINT_TEST_TIMEOUT_MILLISECONDS,
  )
})
