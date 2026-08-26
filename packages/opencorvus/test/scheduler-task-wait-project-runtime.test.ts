import { afterAll, describe, expect, test } from "bun:test"
import { Config } from "../src/config/config"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { requireTask } from "../src/engine/store"
import { PromptProfileResolver } from "../src/expert-squad/prompt-profile-resolver"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { AutomationService } from "../src/scheduler/automation-service"
import { Session } from "../src/session"
import { persistEstablishedTask } from "./fixture/engine-task"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(resetMemoryDatabase)

describe("scheduled Task wait project runtime", () => {
  test("assigns Task-wait authority only to the direct scheduler Session", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const capability = await PromptProfileResolver.resolveSchedulerCapability({
        projectDirectory: project.path,
        config: Config.Info.parse({ prompt_profile: { active: "base" } }),
      })
      const taskID = Identifier.ascending("task")
      const root = Session.prepareRootNext({
        kind: "root",
        directory: Instance.directory,
        title: "Task wait authority",
        metadata: { configOverlay: { prompt_profile: { active: capability.packageRevision.id } } },
      })
      const now = Date.now()
      persistEstablishedTask({
        taskID, rootSession: root, now, title: "Task wait authority", request: "Resume once",
        productPillar: "code", source: "test", priority: "normal", metadata: { actor: "user" },
        projectID: Instance.project.id, packageRevision: capability.packageRevision,
        executionCapsuleBinding: await prepareTaskProcessBinding({
          mode: "native", taskID, projectID: Instance.project.id, rootDirectory: Instance.directory,
          packageRevisionSHA256: capability.packageRevision.packageDigest, timeCreated: now,
        }),
      })
      const rootSessionID = requireTask(taskID).session_id!
      const scheduler = await Session.create({ kind: "orchestrator", parentID: rootSessionID, title: "Direct scheduler" })
      const worker = await Session.create({ kind: "build", parentID: scheduler.id, title: "Worker" })
      expect(await Promise.all([scheduler, worker].map(async (session) => ({
        sessionID: session.id,
        taskID: await AutomationService.taskIDForDirectSchedulerActivity(session.id),
      })))).toEqual([
        { sessionID: scheduler.id, taskID },
        { sessionID: worker.id, taskID: undefined },
      ])
    } })
  }, 90_000)
})
