import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { Project } from "@/project/project"
import { removeUnreferencedTaskArtifactRoots } from "@/task-artifact/recovery"
import { Ownership } from "@/engine/ownership"
import { memoryProject } from "./fixture/memory"

describe("per-Task runtime directory ownership", () => {
  test("places every Task Session surface beneath its readable Task ID root", () => {
    const project = path.resolve("runtime-layout-project")
    const firstTask = Identifier.ascending("task")
    const secondTask = Identifier.ascending("task")
    const firstSession = Identifier.ascending("session")
    const secondSession = Identifier.ascending("session")
    const firstRoot = ProjectRuntimePaths.taskRoot(project, firstTask)
    const secondRoot = ProjectRuntimePaths.taskRoot(project, secondTask)

    expect(path.relative(ProjectRuntimePaths.projectRuntimeRoot(project), firstRoot)).toBe(
      path.join("tasks", firstTask),
    )
    expect(path.relative(ProjectRuntimePaths.projectRuntimeRoot(project), secondRoot)).toBe(
      path.join("tasks", secondTask),
    )
    const firstOwned = {
      session: ProjectRuntimePaths.sessionRoot(project, firstTask, firstSession),
      toolOutput: ProjectRuntimePaths.toolOutputDir(project, firstTask, firstSession),
      worktree: ProjectRuntimePaths.worktreeDir(project, firstTask, firstSession),
      ownership: ProjectRuntimePaths.ownershipPaths(project, firstTask, firstSession).worktreeMarkerDir,
      artifacts: ProjectRuntimePaths.taskArtifactRoot(project, firstTask),
      acceptance: ProjectRuntimePaths.acceptancePaths(project, firstTask).root,
      documents: ProjectRuntimePaths.docsRoot(project, firstTask),
    }
    expect(Object.fromEntries(Object.entries(firstOwned).map(([key, target]) => [key, path.relative(firstRoot, target)])))
      .toEqual({
        session: path.join("sessions", firstSession),
        toolOutput: path.join("sessions", firstSession, "tool-output"),
        worktree: path.join("sessions", firstSession, "worktree"),
        ownership: path.join("sessions", firstSession, "ownership", "worktrees"),
        artifacts: "artifacts",
        acceptance: "acceptance",
        documents: "documents",
      })
    expect(ProjectRuntimePaths.sessionRoot(project, firstTask, firstSession)).toBe(
      path.join(firstRoot, "sessions", firstSession),
    )
    expect(ProjectRuntimePaths.sessionRoot(project, secondTask, secondSession)).toBe(
      path.join(secondRoot, "sessions", secondSession),
    )
    expect(ProjectRuntimePaths.isManagedWorktreePath(project, firstOwned.worktree)).toBe(true)

    expect(ProjectRuntimePaths.missionRoot(project, "b60140ce84aa60d6")).toBe(
      path.join(ProjectRuntimePaths.projectRuntimeRoot(project), "missions", "b60140ce84aa60d6"),
    )
    expect(ProjectRuntimePaths.rootSessionToolOutputDir(project, firstSession)).toBe(
      path.join(ProjectRuntimePaths.projectRuntimeRoot(project), "conversations", firstSession, "tool-output"),
    )
    expect(ProjectRuntimePaths.attachmentBlobRoot(project)).toBe(
      path.join(ProjectRuntimePaths.projectRuntimeRoot(project), "project", "attachments"),
    )
    expect(() => ProjectRuntimePaths.taskRoot(project, "..")).toThrow(
      "ProjectRuntimePaths: invalid identity segment ..",
    )
    expect(() => ProjectRuntimePaths.taskRoot(project, "not-a-task")).toThrow(
      "ProjectRuntimePaths: invalid task identity not-a-task",
    )
    expect(() => ProjectRuntimePaths.taskRoot(project, "tsk_fake.")).toThrow(
      "ProjectRuntimePaths: invalid identity segment tsk_fake.",
    )
    expect(Identifier.schema("task").safeParse(firstTask).success).toBe(true)
    expect(Identifier.schema("session").safeParse(firstSession).success).toBe(true)
    expect(Identifier.schema("task").safeParse("tsk").error?.issues[0]?.message).toBe(
      "Invalid canonical task identifier",
    )
    expect(Identifier.schema("session").safeParse("ses").error?.issues[0]?.message).toBe(
      "Invalid canonical session identifier",
    )
    expect(() => Identifier.ascending("message", "bad")).toThrow("ID bad does not start with msg")
    expect(() => ProjectRuntimePaths.deepResearchPaths(project, firstTask, "not-a-session")).toThrow(
      "ProjectRuntimePaths: invalid session identity not-a-session",
    )
    expect(() => ProjectRuntimePaths.frontendResearchPaths(project, firstTask, "ses_fake.")).toThrow(
      "ProjectRuntimePaths: invalid identity segment ses_fake.",
    )
  })

  test("recovers only an unreferenced Task artifact subtree from the canonical Task collection", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const orphanTaskID = Identifier.ascending("task")
        const orphanArtifacts = ProjectRuntimePaths.taskArtifactRoot(project.path, orphanTaskID)
        const orphanSessionState = ProjectRuntimePaths.sessionRoot(
          project.path,
          orphanTaskID,
          Identifier.ascending("session"),
        )
        await fs.mkdir(orphanArtifacts, { recursive: true })
        await fs.mkdir(orphanSessionState, { recursive: true })
        await fs.writeFile(path.join(orphanArtifacts, "publication.json"), "{}")
        await fs.writeFile(path.join(orphanSessionState, "trace.jsonl"), '{"kind":"session_open"}\n')

        const removed = await removeUnreferencedTaskArtifactRoots({
          projectID: Instance.project.id,
          projectDirectory: project.path,
        })

        expect(removed).toEqual([orphanArtifacts])
        expect(await fs.readFile(path.join(orphanSessionState, "trace.jsonl"), "utf8")).toBe(
          '{"kind":"session_open"}\n',
        )
      },
    })
  })

  test("discovers the exact ownership marker inside its Task Session root", async () => {
    await using project = await memoryProject()
    const taskID = Identifier.ascending("task")
    const sessionID = Identifier.ascending("session")
    const worktree = ProjectRuntimePaths.worktreeDir(project.path, taskID, sessionID)
    await fs.mkdir(ProjectRuntimePaths.taskArtifactRoot(project.path, taskID), { recursive: true })
    await fs.writeFile(path.join(ProjectRuntimePaths.taskArtifactRoot(project.path, taskID), "manifest.json"), "{}")
    await Ownership.Worktree.record({
      primaryWorktreeDir: project.path,
      worktreeDir: worktree,
      taskID,
      sessionID,
    })

    expect(
      (await Ownership.Worktree.list(project.path)).map(({ marker, markerPath }) => ({
        taskID: marker.taskID,
        sessionID: marker.sessionID,
        markerPath,
      })),
    ).toEqual([
      {
        taskID,
        sessionID,
        markerPath: expect.stringContaining(
          path.join("tasks", taskID, "sessions", sessionID, "ownership", "worktrees"),
        ),
      },
    ])
  })

  test("rejects an old type-first runtime root at project initialization", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-old-runtime-"))
    try {
      await Project.initGit(directory)
      await fs.mkdir(path.join(directory, ".opencorvus", ".r", "t", "legacy-task"), { recursive: true })
      await expect(
        Instance.provide({
          directory,
          fn: () => "initialized",
        }),
      ).rejects.toThrow(
        `Legacy OpenCorvus runtime paths exist under ${directory}: .opencorvus/.r/t. ` +
          "Move or delete these runtime directories before starting; new task/session state lives under .opencorvus/.r.",
      )
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })
})
