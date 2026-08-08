import { afterAll, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { EngineGit } from "../src/engine/git"
import { persistQueuedTask } from "../src/engine/pipeline"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { requireTask } from "../src/engine/store"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { Session } from "../src/session"
import { hostGit } from "../src/util/git"
import { Process } from "../src/util/process"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const GIT_CHECKPOINT_TEST_TIMEOUT_MILLISECONDS = 30_000

const packageRevision = {
  scope: "built_in" as const,
  projectID: null,
  namespace: "builtin",
  id: "base",
  version: "2026.08.06.1",
  packageDigest: "a".repeat(64),
}

afterAll(async () => {
  await resetMemoryDatabase()
})

async function requireSuccess(result: Awaited<ReturnType<typeof hostGit>>) {
  expect(result.exitCode).toBe(0)
  return result
}

describe("Engine Git closed execution environment", () => {
  test("checkpoints exact workspace bytes under a repository-declared clean filter", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await requireSuccess(await hostGit(["config", "filter.mutate.clean", "false"], { cwd: project.path }))
        await fs.writeFile(path.join(project.path, ".gitattributes"), "sample.txt filter=mutate\n")
        await fs.writeFile(path.join(project.path, "sample.txt"), "baseline raw bytes\n")

        const session = await Session.create({ kind: "root", title: "Engine Git exact bytes" })
        const taskID = Identifier.ascending("task")
        const now = Date.now()
        persistQueuedTask({
          taskID,
          sessionID: session.id,
          now,
          title: "Engine Git exact bytes",
          request: "Checkpoint exact raw bytes",
          productPillar: "code",
          metadata: {},
          projectID: Instance.project.id,
          queue: false,
          packageRevision,
          executionCapsuleBinding: await prepareTaskProcessBinding({
            mode: "native",
            taskID,
            projectID: Instance.project.id,
            rootDirectory: project.path,
            packageRevisionSHA256: packageRevision.packageDigest,
            timeCreated: now,
          }),
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
        await fs.writeFile(path.join(project.path, "sample.txt"), "result raw bytes\n")
        const completed = await EngineGit.complete(requireTask(taskID))
        expect((completed.task.metadata as any).git.result.mode).toBe("created_commit")

        const blob = await requireSuccess(await hostGit(["show", "HEAD:sample.txt"], { cwd: project.path }))
        expect(blob.text()).toBe("result raw bytes\n")
        const repositories = (completed.task.metadata as any).git.result.repositories
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
  }, GIT_CHECKPOINT_TEST_TIMEOUT_MILLISECONDS)
})
