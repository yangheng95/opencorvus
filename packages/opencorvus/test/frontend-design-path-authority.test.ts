import { afterEach, expect, test } from "bun:test"
import path from "node:path"
import { EngineTaskTable } from "@/engine/engine.sql"
import { appendTaskOpenedInTransaction } from "@/engine/task-lifecycle"
import { projectFrontendDesignInput } from "@/frontend-design/input-projection"
import { FrontendDesignTestHooks } from "@/frontend-design/agent"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Project } from "@/project/project"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { Session } from "@/session"
import { Database } from "@/storage/db"
import { hostGit } from "@/util/git"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)

test("designer file authoring and capture share the primary Task root from an isolated worker worktree", async () => {
  await using primary = await memoryProject("design-primary")
  await using other = await memoryProject("design-other")
  const taskID = Identifier.ascending("task")
  const workerID = Identifier.ascending("session")
  const workerDirectory = ProjectRuntimePaths.worktreeDir(primary.path, taskID, workerID)
  const projectID = await Instance.provide({
    directory: primary.path,
    fn: async () => {
      const root = await Session.create({ kind: "root", title: "Canonical designer path" })
      Database.immediateTransaction((db) => {
        db
          .insert(EngineTaskTable)
          .values({
            id: taskID,
            project_id: Instance.project.id,
            session_id: root.id,
            source: "test",
            product_pillar: "code",
            title: "Canonical designer path",
            request: "Produce Task-owned design evidence",
            time_created: Date.now(),
          })
          .run()
        appendTaskOpenedInTransaction({ db, taskID, sessionID: root.id, now: Date.now(), source: "test" })
      })
      const result = await hostGit(["worktree", "add", "--detach", workerDirectory, "HEAD"], {
        cwd: primary.path,
        timeoutProfile: "default",
      })
      expect(result.exitCode, result.stderr.toString()).toBe(0)
      await Project.addSandbox(Instance.project.id, workerDirectory)
      return Instance.project.id
    },
  })
  const input = {
    instruction: "Author the skeleton and capture it",
    taskID,
    workScope: { kind: "task" as const },
    attachments: [],
  }
  await Instance.provide({
    directory: workerDirectory,
    fn: async () => {
      expect({ projectID: Instance.project.id, directory: Instance.directory }).toEqual({
        projectID,
        directory: workerDirectory,
      })
      for (const mode of ["greenfield_original", "reference_parity"] as const) {
        const projection = projectFrontendDesignInput({ ...input, mode })
        expect(projection.artifactPaths).toEqual(ProjectRuntimePaths.frontendDesignPaths(primary.path, taskID))
        const prompt = FrontendDesignTestHooks.buildUserPrompt({ ...projection, agentID: "interface-designer" })
        const skeleton = path.join(projection.artifactPaths.absoluteDir, "visual-html-skeleton").replaceAll("\\", "/")
        expect(prompt).toContain(`Physical authoring directory: \`${skeleton}\``)
        expect(prompt).toContain("rendered_entrypoint=`visual-html-skeleton/index.html`")
        expect(await FrontendDesignTestHooks.buildPromptParts(projection, "interface-designer")).toEqual([
          { type: "text", text: prompt },
        ])
      }
    },
  })
  await Instance.provide({
    directory: other.path,
    fn: () => {
      expect(() => projectFrontendDesignInput({ ...input, mode: "greenfield_original" })).toThrow(
        `Task not found in current project: ${taskID}`,
      )
    },
  })
}, 30_000)
