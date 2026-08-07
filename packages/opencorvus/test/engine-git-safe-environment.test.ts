import { afterAll, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { EngineGit } from "../src/engine/git"
import { recordTaskInfrastructureErrorInTransaction } from "../src/engine/persist"
import { persistQueuedTask } from "../src/engine/pipeline"
import { terminalTask } from "../src/engine/state"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { listTaskInfrastructureErrorArtifacts, requireTask } from "../src/engine/store"
import { deriveTaskStatus } from "../src/engine/task-status"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { Session } from "../src/session"
import { hostGit } from "../src/util/git"
import { Process } from "../src/util/process"
import { ProtocolStore } from "../src/protocol/store"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

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
        persistQueuedTask({
          taskID,
          sessionID: session.id,
          now: Date.now(),
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
            timeCreated: Date.now(),
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
  })

  test("terminates a Task whose immutable creation source changed before first execution", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await fs.writeFile(path.join(project.path, "source.txt"), "creation bytes\n")
        const session = await Session.create({ kind: "root", title: "Immutable creation source" })
        const taskID = Identifier.ascending("task")
        persistQueuedTask({
          taskID,
          sessionID: session.id,
          now: Date.now(),
          title: "Immutable creation source",
          request: "Fail with exact infrastructure evidence when creation bytes change",
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
            timeCreated: Date.now(),
          }),
        })
        await fs.writeFile(path.join(project.path, "source.txt"), "execution bytes\n")
        const prepared = await EngineGit.prepare(requireTask(taskID))
        const terminalFailure = prepared.terminalFailure!
        const terminal = await terminalTask(
          prepared.task,
          { status: "failed", error: prepared.error! },
          "Task creation workspace identity no longer matches its first execution source",
          {
            preExecutionInfrastructureFailure: terminalFailure,
            transactionEffect(db) {
              recordTaskInfrastructureErrorInTransaction(db, {
                taskID,
                component: "engine-git",
                operation: "prepare-baseline",
                reason: prepared.error!,
                context: {
                  code: terminalFailure.code,
                  initial_tree_sha256: terminalFailure.initialTreeSHA256,
                  execution_tree_sha256: terminalFailure.executionTreeSHA256,
                },
              })
            },
          },
        )
        const infrastructure = listTaskInfrastructureErrorArtifacts(taskID, 0, 10)
        const terminalEvents = ProtocolStore.listTaskEvents(taskID).filter((event) =>
          ["task.infrastructure.failed", "task.failed"].includes(event.type),
        )
        expect({
          status: deriveTaskStatus(terminal),
          error: terminal.error,
          failure: terminalFailure,
          infrastructure: infrastructure.map((artifact) => artifact.payload),
          terminalEvents: terminalEvents.map((event) => ({ type: event.type, payload: event.payload })),
        }).toEqual({
          status: "failed",
          error: `Task ${taskID} workspace changed between creation and first execution`,
          failure: {
            code: "IMMUTABLE_CREATION_WORKSPACE_MISMATCH",
            initialTreeSHA256: terminalFailure.initialTreeSHA256,
            executionTreeSHA256: terminalFailure.executionTreeSHA256,
          },
          infrastructure: [
            {
              component: "engine-git",
              operation: "prepare-baseline",
              reason: `Task ${taskID} workspace changed between creation and first execution`,
              context: {
                code: "IMMUTABLE_CREATION_WORKSPACE_MISMATCH",
                initial_tree_sha256: terminalFailure.initialTreeSHA256,
                execution_tree_sha256: terminalFailure.executionTreeSHA256,
              },
            },
          ],
          terminalEvents: [
            {
              type: "task.infrastructure.failed",
              payload: expect.objectContaining({
                taskID,
                component: "engine-git",
                operation: "prepare-baseline",
                evidenceLocators: [expect.objectContaining({ source: "engine_artifact" })],
              }),
            },
            {
              type: "task.failed",
              payload: expect.objectContaining({
                taskID,
                status: "failed",
                error: `Task ${taskID} workspace changed between creation and first execution`,
              }),
            },
          ],
        })
      },
    })
  })
})
