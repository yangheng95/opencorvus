import { afterEach, describe, expect, test } from "bun:test"
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { EngineGit } from "@/engine/git"
import { requireTask } from "@/engine/store"
import { appendTaskReopenedInTransaction, taskLifecycleProjection } from "@/engine/task-lifecycle"
import { Instance } from "@/project/instance"
import { ProtocolStore } from "@/protocol/store"
import { Database } from "@/storage/db"
import { createEngineGitCheckpointTask } from "./fixture/engine-git"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

function failEpoch(taskID: string, sessionID: string, epoch: number) {
  Database.immediateTransaction((db) => {
    ProtocolStore.appendEventInTransaction({
      kind: "event",
      type: "task.failed",
      aggregate: "task",
      aggregate_id: taskID,
      task_id: null,
      session_id: sessionID,
      source: "test.reopen",
      emitted_at: Date.now(),
      payload: { execution_epoch: epoch },
    })
  })
}

/**
 * Reopening is the operator's escape hatch after a failed epoch. Git checkpoints
 * are keyed per epoch, so a reopened Task finds no baseline for its new epoch and
 * reaches the immutable-creation-workspace comparison — where its own prior
 * output is guaranteed to differ from the creation digest. Enforcing that guard
 * there terminally failed every reopen of a Task that had produced anything,
 * which made the escape hatch a dead end.
 */
describe("reopened Task workspace recovery", () => {
  test("does not terminally fail a reopened epoch whose workspace holds its own prior output", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const taskID = await createEngineGitCheckpointTask({ projectPath: project.path, title: "Reopen recovery" })
        const task = requireTask(taskID)

        // Epoch 1 runs and produces work, which is exactly what changes the
        // workspace away from its creation digest.
        writeFileSync(join(project.path, "epoch-one-output.txt"), "tetris\n")
        failEpoch(taskID, task.session_id!, 1)
        Database.immediateTransaction((db) =>
          appendTaskReopenedInTransaction({
            db,
            taskID,
            sessionID: task.session_id!,
            now: Date.now(),
            source: "test.reopen",
          }),
        )

        const lifecycle = taskLifecycleProjection(taskID)
        const prepared = await EngineGit.prepare(requireTask(taskID))

        expect({
          epoch: lifecycle.epoch,
          status: lifecycle.status,
          terminalFailure: prepared.terminalFailure?.code,
        }).toEqual({ epoch: 2, status: "active", terminalFailure: undefined })
      },
    })
  })

  test("still refuses a first execution whose workspace was swapped after creation", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const taskID = await createEngineGitCheckpointTask({ projectPath: project.path, title: "Swapped workspace" })
        // No epoch ever ran, so a differing tree means the workspace was
        // changed under the Task — the case the guard exists for.
        writeFileSync(join(project.path, "foreign-change.txt"), "not this Task's work\n")

        const prepared = await EngineGit.prepare(requireTask(taskID))

        expect(prepared.terminalFailure?.code).toBe("IMMUTABLE_CREATION_WORKSPACE_MISMATCH")
      },
    })
  })
})
