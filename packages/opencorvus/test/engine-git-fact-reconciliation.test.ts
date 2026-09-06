import fs from "node:fs/promises"
import path from "node:path"
import { EngineGitCheckpointOutcomeTable, EngineGitCheckpointRequestTable } from "@/engine/engine.sql"
import { EngineGit } from "@/engine/git"
import { requireTask } from "@/engine/store"
import { Instance } from "@/project/instance"
import { Database } from "@/storage/db"
import { Identifier } from "@/id/id"
import { hostGit } from "@/util/git"
import { createEngineGitCheckpointTask } from "./fixture/engine-git"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(async () => {
  await resetMemoryDatabase()
})

describe("Engine Git immutable checkpoint facts", () => {
  test("an effect completed before its receipt is never replayed and converges through an exact outcome", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await fs.writeFile(path.join(project.path, "checkpoint.txt"), "immutable git effect\n")
        const taskID = await createEngineGitCheckpointTask({
          projectPath: project.path,
          title: "Git crash convergence",
        })

        let interrupted: { requestID: string; result: Record<string, unknown> } | undefined
        {
          using _interruption = EngineGit.setCheckpointOutcomePersistenceHookForTest((input) => {
            interrupted = structuredClone(input)
            throw new Error("simulated crash after Git effect")
          })
          await expect(EngineGit.prepare(requireTask(taskID))).rejects.toThrow("simulated crash after Git effect")
        }

        expect(interrupted).toBeDefined()
        const publishedHead = (await hostGit(["rev-parse", "HEAD"], { cwd: project.path })).text().trim()
        const replay = await EngineGit.prepare(requireTask(taskID))
        expect(replay.error).toContain("unknown outcome")
        expect((await hostGit(["rev-parse", "HEAD"], { cwd: project.path })).text().trim()).toBe(publishedHead)

        EngineGit.reconcileCheckpoint(interrupted!)
        const recovered = await EngineGit.prepare(requireTask(taskID))
        expect(recovered.error).toBeUndefined()
        expect((recovered.task.metadata as any).git.baseline.commit).toBe(publishedHead)

        expect(Database.use((db) => ({
          requests: db.select().from(EngineGitCheckpointRequestTable).all(),
          outcomes: db.select().from(EngineGitCheckpointOutcomeTable).all(),
        }))).toMatchObject({
          requests: [{ task_id: taskID, stage: "baseline" }],
          outcomes: [{ request_id: interrupted!.requestID }],
        })
      },
    })
  }, 60_000)

  test("a migrated acceptance-round outcome absorbs replay without requiring unavailable legacy input", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const taskID = await createEngineGitCheckpointTask({
          projectPath: project.path,
          title: "Migrated acceptance receipt",
        })
        const operationKey = "acceptance_round:1:1"
        const requestID = Identifier.deterministic("artifact", `git-checkpoint\0${taskID}\0${operationKey}`)
        Database.transaction((db) => {
          db.insert(EngineGitCheckpointRequestTable).values({
            id: requestID,
            task_id: taskID,
            stage: "acceptance_round",
            operation_key: operationKey,
            input: {},
            time_created: 1,
          }).run()
          db.insert(EngineGitCheckpointOutcomeTable).values({
            request_id: requestID,
            result: { error: "legacy acceptance checkpoint failed" },
            time_created: 2,
          }).run()
        })
        const head = (await hostGit(["rev-parse", "HEAD"], { cwd: project.path })).text().trim()
        await expect(EngineGit.commitAcceptanceRound({
          task: requireTask(taskID),
          iteration: 1,
          verdict: { verdict: "rejected", summary: "new input cannot rewrite the migrated occurrence", rejection_count: 1 },
          declaredChangedFiles: ["checkpoint.txt"],
        })).resolves.toEqual({ mode: "skipped", error: "legacy acceptance checkpoint failed" })
        expect((await hostGit(["rev-parse", "HEAD"], { cwd: project.path })).text().trim()).toBe(head)
      },
    })
  }, 60_000)

  test("a settled baseline failure replays its exact error instead of projecting success", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const taskID = await createEngineGitCheckpointTask({
          projectPath: project.path,
          title: "Settled baseline failure",
        })
        const operationKey = "baseline:1"
        const requestID = Identifier.deterministic("artifact", `git-checkpoint\0${taskID}\0${operationKey}`)
        Database.transaction((db) => {
          db.insert(EngineGitCheckpointRequestTable).values({
            id: requestID,
            task_id: taskID,
            stage: "baseline",
            operation_key: operationKey,
            input: {},
            time_created: 1,
          }).run()
          db.insert(EngineGitCheckpointOutcomeTable).values({
            request_id: requestID,
            result: { error: "baseline checkpoint failed" },
            time_created: 2,
          }).run()
        })

        const replay = await EngineGit.prepare(requireTask(taskID))
        expect(replay.error).toBe("baseline checkpoint failed")
        expect((replay.task.metadata as any).git.baseline).toBeUndefined()
      },
    })
  }, 60_000)
})
