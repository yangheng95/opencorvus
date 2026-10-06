import { afterAll, expect, test } from "bun:test"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { listOwnedPromptSessionsForTask } from "../src/engine/runtime"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { Session } from "../src/session"
import { SessionPromptState } from "../src/session/prompt/state"
import { persistEstablishedTask } from "./fixture/engine-task"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const packageRevision = {
  scope: "built_in" as const,
  projectID: null,
  namespace: "builtin",
  id: "base",
  version: "2026.08.28.1",
  packageDigest: "a".repeat(64),
}

afterAll(async () => {
  await resetMemoryDatabase()
})

test("projects exact process-owned prompt Sessions through the Engine runtime owner", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const root = Session.prepareRootNext({
        kind: "root",
        directory: Instance.directory,
        title: "Runtime prompt ownership projection",
      })
      const taskID = Identifier.ascending("task")
      const now = Date.now()
      persistEstablishedTask({
        taskID,
        rootSession: root,
        now,
        title: "Runtime prompt ownership projection",
        request: "Project the exact physical prompt owner",
        productPillar: "work",
        source: "test",
        priority: "normal",
        metadata: { actor: "user" },
        projectID: Instance.project.id,
        packageRevision,
        executionCapsuleBinding: await prepareTaskProcessBinding({
          mode: "native",
          taskID,
          projectID: Instance.project.id,
          rootDirectory: Instance.directory,
          packageRevisionSHA256: packageRevision.packageDigest,
          timeCreated: now,
        }),
      })
      const unrelated = await Session.create({ kind: "assistant", title: "Unrelated prompt owner" })
      let rootOwner: AbortSignal | undefined
      let unrelatedOwner: AbortSignal | undefined
      let primaryFailure: unknown
      try {
        rootOwner = SessionPromptState.start(root.id, root.directory)
        if (!rootOwner) throw new Error("Expected a fresh Task root prompt owner")
        unrelatedOwner = SessionPromptState.start(unrelated.id, unrelated.directory)
        if (!unrelatedOwner) throw new Error("Expected a fresh unrelated prompt owner")
        SessionPromptState.touch(root.id, root.directory)
        const projected = listOwnedPromptSessionsForTask(taskID)
        expect(projected).toEqual([
          {
            sessionID: root.id,
            kind: "root",
            lastActivityMs: expect.any(Number),
          },
        ])
        expect(projected[0]!.lastActivityMs).toBeGreaterThanOrEqual(now)
      } catch (error) {
        primaryFailure = error
      }

      const cleanupFailures: unknown[] = []
      if (rootOwner) {
        try {
          await SessionPromptState.release(root.id, root.directory)
        } catch (error) {
          cleanupFailures.push(error)
        }
      }
      if (unrelatedOwner) {
        try {
          await SessionPromptState.release(unrelated.id, unrelated.directory)
        } catch (error) {
          cleanupFailures.push(error)
        }
      }
      if (primaryFailure && cleanupFailures.length > 0) {
        throw new AggregateError([primaryFailure, ...cleanupFailures], "Prompt projection and owner cleanup both failed")
      }
      if (primaryFailure) throw primaryFailure
      if (cleanupFailures.length === 1) throw cleanupFailures[0]
      if (cleanupFailures.length > 1) throw new AggregateError(cleanupFailures, "Prompt owner cleanup failed")
    },
  })
})
