import { afterAll, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { EngineTaskTable } from "../../src/engine/engine.sql"
import {
  insertTaskProcessBinding,
  prepareTaskProcessBinding,
} from "../../src/engine/task-execution-capsule-binding"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import { ProjectRuntimePaths } from "../../src/project/runtime-paths"
import { Database } from "../../src/storage/db"
import { Process } from "../../src/util/process"
import {
  assertZeroWorkArtifactRuntimeIssueCount,
  workArtifactWorkspaceRoot,
} from "../../src/work-artifact/presentation"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterAll(async () => {
  await resetMemoryDatabase()
})

test("Task and conversation Work Artifact workspaces map to their project-scoped runtime roots", () => {
  const projectRoot = path.resolve("work-artifact-authority-project")
  const taskID = Identifier.ascending("task")
  const taskSessionID = Identifier.ascending("session")
  const conversationSessionID = Identifier.ascending("session")
  const taskRoot = workArtifactWorkspaceRoot({
    projectRoot,
    executionAuthority: {
      kind: "task",
      taskID,
      sessionID: taskSessionID,
      projectID: "project-work-artifact-authority",
      directory: projectRoot,
    },
  })
  const conversationRoot = workArtifactWorkspaceRoot({
    projectRoot,
    executionAuthority: {
      kind: "conversation",
      sessionID: conversationSessionID,
      projectID: "project-work-artifact-authority",
      directory: projectRoot,
    },
  })

  expect({
    taskRoot,
    taskRelative: path.relative(projectRoot, taskRoot),
    conversationRoot,
    conversationRelative: path.relative(projectRoot, conversationRoot),
  }).toEqual({
    taskRoot: ProjectRuntimePaths.taskWorkArtifactRuntimeRoot(projectRoot, taskID),
    taskRelative: path.join(
      ".opencorvus",
      ".r",
      "tasks",
      taskID,
      "work-artifacts",
    ),
    conversationRoot: ProjectRuntimePaths.rootSessionWorkArtifactRuntimeRoot(projectRoot, conversationSessionID),
    conversationRelative: path.join(
      ".opencorvus",
      ".r",
      "conversations",
      conversationSessionID,
      "work-artifacts",
    ),
  })
})

test("Task Work Artifact runtime workspace is admitted by the immutable native process authority", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const taskID = Identifier.ascending("task")
      const sessionID = Identifier.ascending("session")
      const now = Date.now()
      const packageDigest = "a".repeat(64)
      const binding = await prepareTaskProcessBinding({
        mode: "native",
        taskID,
        projectID: Instance.project.id,
        rootDirectory: project.path,
        packageRevisionSHA256: packageDigest,
        timeCreated: now,
      })
      Database.transaction((db) => {
        db.insert(EngineTaskTable)
          .values({
            id: taskID,
            project_id: Instance.project.id,
            source: "test",
            product_pillar: "work",
            title: "Work Artifact process authority",
            request: "Run the Office runtime inside the Task-owned workspace",
            priority: "normal",
            time_created: now,
            time_updated: now,
          })
          .run()
        insertTaskProcessBinding({ db, payload: binding })
      })
      const workspace = workArtifactWorkspaceRoot({
        projectRoot: project.path,
        executionAuthority: {
          kind: "task",
          taskID,
          sessionID,
          projectID: Instance.project.id,
          directory: project.path,
        },
      })
      await fs.mkdir(workspace, { recursive: true })
      const result = await Process.runTask(
        { taskID, cwd: workspace },
        [process.execPath, "-e", "console.log(process.cwd())"],
        { timeoutMs: 30_000, maxOutputBytes: 16 * 1024 },
      )
      expect(path.resolve(result.stdout.toString("utf8").trim())).toBe(path.resolve(workspace))
    },
  })
})

test("Work Artifact issue failures preserve bounded OfficeCLI repair evidence", () => {
  expect(() =>
    assertZeroWorkArtifactRuntimeIssueCount(
      { data: { count: 1, issues: [{ slide: 1, code: "content-overflow", message: "Chart exceeds slide bounds" }] } },
      "OfficeCLI issue inspection",
    ),
  ).toThrow(
    'OfficeCLI issue inspection reported presentation issues: {"count":1,"issues":[{"slide":1,"code":"content-overflow","message":"Chart exceeds slide bounds"}]}',
  )
})

test("qualified presentation authoring schema declares centimeter coordinates", async () => {
  const { AuthorWorkArtifactInput } = await import("../../src/work-artifact/presentation")
  const schema = (await import("zod")).default.toJSONSchema(AuthorWorkArtifactInput) as {
    $defs?: Record<string, unknown>
  }
  expect(JSON.stringify(schema)).toContain("Horizontal position in centimeters")
  expect(JSON.stringify(schema)).toContain("33.867cm slide")
})
