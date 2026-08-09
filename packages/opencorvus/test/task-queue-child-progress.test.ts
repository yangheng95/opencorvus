import { afterEach, describe, expect, test } from "bun:test"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { TaskQueueTable } from "@/scheduler/task-queue.sql"
import { TaskQueueService } from "@/scheduler/task-queue-service"
import { Session } from "@/session"
import { Database } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

async function waitForQueueUpdate(taskID: string, after: number) {
  const deadline = Date.now() + 2_000
  while (Date.now() < deadline) {
    const current = TaskQueueService.getStatusByID(taskID)
    if (current && current.updatedAt > after) return current.updatedAt
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`Queue ${taskID} did not record child Session progress after ${after}`)
}

afterEach(async () => {
  await resetMemoryDatabase()
})

describe("Task Queue child Session progress", () => {
  test("extends live membership from Created and touches the running row on a real child Part update", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const root = await Session.createNext({
          directory: Instance.directory,
          kind: "assistant",
          title: "Task Queue progress root",
        })
        await Database.awaitEffectIdle(2_000)

        const queueTaskID = Identifier.ascending("task")
        const startedAt = Date.now()
        Database.use((db) =>
          db
            .insert(TaskQueueTable)
            .values({
              id: queueTaskID,
              session_id: root.id,
              prompt: "child progress positive contract",
              priority: "normal",
              status: "running",
              source: "task-queue-child-progress-positive-contract",
              metadata: { kind: "session_prompt", input: {} },
              time_created: startedAt,
              time_started: startedAt,
              time_updated: startedAt,
            })
            .run(),
        )

        const stopTracking = TaskQueueService.TestHooks.trackChildSessionProgress({
          taskID: queueTaskID,
          rootSessionID: root.id,
          directory: Instance.directory,
          projectID: Instance.project.id,
        })
        try {
          const child = await Session.createNext({
            directory: Instance.directory,
            kind: "assistant",
            parentID: root.id,
            title: "Delegated child progress",
          })
          await Database.awaitEffectIdle(2_000)
          await new Promise((resolve) => setTimeout(resolve, 10))

          const childMessage = await Session.updateMessage({
            id: Identifier.ascending("message"),
            sessionID: child.id,
            role: "user",
            author: "user",
            agent: "chat",
            model: { providerID: "test", modelID: "task-queue-child-progress" },
            time: { created: Date.now() },
          })
          await Session.updatePart({
            id: Identifier.ascending("part"),
            sessionID: child.id,
            messageID: childMessage.id,
            type: "text",
            text: "real child progress",
          })
          await Database.awaitEffectIdle(2_000)
          const touchedAt = await waitForQueueUpdate(queueTaskID, startedAt)

          expect({ childSessionID: child.id, queue: TaskQueueService.getStatusByID(queueTaskID), touchedAt }).toMatchObject({
            childSessionID: expect.stringMatching(/^ses_/),
            queue: { taskID: queueTaskID, sessionID: root.id, status: "running", updatedAt: touchedAt },
            touchedAt: expect.any(Number),
          })
          expect(touchedAt).toBeGreaterThan(startedAt)
        } finally {
          stopTracking()
        }
      },
    })
  }, 30_000)
})
