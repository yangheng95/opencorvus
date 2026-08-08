import { afterAll, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { EngineGit } from "../src/engine/git"
import { requireTask } from "../src/engine/store"
import { Instance } from "../src/project/instance"
import { createEngineGitCheckpointTask } from "./fixture/engine-git"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(async () => {
  await resetMemoryDatabase()
})

describe("Engine Git fixed process topology", () => {
  test("projects 2300 source files through one blob import and one index import", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        for (let directoryIndex = 0; directoryIndex < 23; directoryIndex += 1) {
          const directory = path.join(project.path, `batch-${directoryIndex.toString().padStart(2, "0")}`)
          await fs.mkdir(directory)
          await Promise.all(
            Array.from({ length: 100 }, (_, fileIndex) => {
              const relativeIdentity = `${directoryIndex}:${fileIndex}`
              return fs.writeFile(
                path.join(directory, `source-${fileIndex.toString().padStart(3, "0")}.txt`),
                `raw source ${relativeIdentity}\n`,
              )
            }),
          )
        }
        const taskID = await createEngineGitCheckpointTask({
          projectPath: project.path,
          title: "Engine Git 2300-file topology",
          packageDigestCharacter: "c",
        })

        const prepared = await EngineGit.prepare(requireTask(taskID))
        const baseline = (prepared.task.metadata as any).git.baseline
        expect({
          receipt: baseline.checkpoint_receipt,
          repositoryReceipt: baseline.repositories[0].receipt,
        }).toEqual({
          receipt: expect.objectContaining({
            checkpoint_stage: "baseline",
            repository_count: 1,
            snapshot_path_count: 2301,
            raw_blob_count: 2301,
            blob_import_process_count: 1,
            index_import_process_count: 1,
            outcome: "success",
            command_counts: expect.objectContaining({
              "fast-import": 1,
              "update-index": 1,
            }),
          }),
          repositoryReceipt: expect.objectContaining({
            snapshot_path_count: 2301,
            index_entry_count: 2301,
            regular_file_count: 2301,
            raw_blob_count: 2301,
            blob_import_process_count: 1,
            index_import_process_count: 1,
          }),
        })
        expect(baseline.checkpoint_receipt.checkpoint_git_process_launch_count).toBeLessThanOrEqual(32)
      },
    })
  }, 120_000)
})
