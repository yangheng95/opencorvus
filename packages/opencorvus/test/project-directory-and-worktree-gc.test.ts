import { afterEach, describe, expect, spyOn, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Instance } from "@/project/instance"
import { Project } from "@/project/project"
import { Server } from "@/server/server"
import { Database } from "@/storage/db"
import { EngineService } from "@/task-api"
import { Worktree } from "@/worktree"
import { WorktreeGC } from "@/worktree/gc"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await resetMemoryDatabase()
})

describe("Project directory integrity", () => {
  test("binds an existing directory and returns typed missing and file-path errors through the HTTP boundary", async () => {
    await using project = await memoryProject()
    const bound = await Project.fromDirectory(project.path)
    expect(bound).toMatchObject({
      project: { id: expect.any(String), worktree: project.path },
      sandbox: project.path,
    })

    const missing = path.join(project.path, "missing-project")
    const missingResponse = await Server.App().request("/project/current", {
      headers: { "x-opencorvus-directory": missing },
    })
    expect(missingResponse.status).toBe(400)
    expect(await missingResponse.json()).toEqual({
      name: "ProjectDirectoryIntegrityError",
      data: {
        directory: missing,
        reason: "missing",
        message: `Project directory does not exist: ${missing}`,
      },
    })

    const file = path.join(project.path, "not-a-directory.txt")
    await fs.writeFile(file, "positive typed error fixture")
    const fileResponse = await Server.App().request("/project/current", {
      headers: { "x-opencorvus-directory": file },
    })
    expect(fileResponse.status).toBe(400)
    expect(await fileResponse.json()).toEqual({
      name: "ProjectDirectoryIntegrityError",
      data: {
        directory: file,
        reason: "not-directory",
        message: `Project directory is not a directory: ${file}`,
      },
    })

    await fs.mkdir(missing)
    await Project.initGit(missing)
    const recoveredResponse = await Server.App().request("/project/current", {
      headers: { "x-opencorvus-directory": missing },
    })
    expect(recoveredResponse.status).toBe(200)
    expect(await recoveredResponse.json()).toMatchObject({ worktree: missing })
  }, 90_000)

  test("creates a missing Task project only through the explicit init-git request", async () => {
    await using parent = await memoryProject()
    const directory = path.join(parent.path, "explicit-task-project")
    const createTask = spyOn(EngineService, "createTask").mockResolvedValue("tsk_directory_integrity_positive")
    try {
      const response = await Server.App().request("/task?init-git=true", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-opencorvus-directory": directory,
        },
        body: JSON.stringify({
          productPillar: "work",
          request: "Persist one queued positive directory-integrity contract Task.",
          model: "openai/gpt-5.6-luna",
          queue: true,
        }),
      })

      const body = await response.json()
      expect({ status: response.status, body }).toEqual({
        status: 202,
        body: {
          task_id: "tsk_directory_integrity_positive",
          project_id: expect.any(String),
          directory,
        },
      })
      expect(Project.isGitRepo(directory)).toBe(true)
      expect(createTask).toHaveBeenCalledTimes(1)
      await Database.awaitEffectIdle(5_000)
    } finally {
      createTask.mockRestore()
    }
  }, 90_000)

})

describe("Worktree GC uncertainty preservation", () => {
  test("preserves a project with an unavailable real Git registry while classifying a healthy project's real residue", async () => {
    await using healthy = await memoryProject()
    await Instance.provide({
      directory: healthy.path,
      fn: async () => {
        const invalidatedDirectory = path.join(healthy.path, "project-removed-after-registration")
        await fs.mkdir(invalidatedDirectory)
        const invalidated = await Project.fromDirectory(invalidatedDirectory)
        await fs.rm(invalidatedDirectory, { recursive: true })

        const zombie = path.join(Worktree.worktreesRoot(healthy.path), "legacy-zombie")
        await fs.mkdir(zombie, { recursive: true })
        const old = new Date(Date.now() - 5 * 24 * 60 * 60 * 1_000)
        await fs.utimes(zombie, old, old)

        const plan = await WorktreeGC.inspect({ retentionDays: 3 })

        expect(
          plan.preservations.map(({ projectID, primaryDir, reason }) => ({ projectID, primaryDir, reason })),
        ).toContainEqual({
          projectID: invalidated.project.id,
          primaryDir: invalidatedDirectory,
          reason: "registry-unavailable",
        })
        expect(
          plan.candidates.map(({ projectID, primaryDir, directory, reason }) => ({
            projectID,
            primaryDir,
            directory,
            reason,
          })),
        ).toContainEqual({
          projectID: Instance.project.id,
          primaryDir: healthy.path,
          directory: zombie,
          reason: "old-zombie",
        })
      },
    })
  }, 0)
})
