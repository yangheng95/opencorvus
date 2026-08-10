import { afterAll, describe, expect, test } from "bun:test"
import { Bus } from "../src/bus"
import { createRightSidebarConversationSession } from "../src/chat/session"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { Session } from "../src/session"
import { TaskQueueTable } from "../src/scheduler/task-queue.sql"
import { TaskQueueEvent, TaskQueueService } from "../src/scheduler/task-queue-service"
import { Database } from "../src/storage/db"
import { WorkLedgerRouteTestHooks } from "../src/server/routes/work-ledger"
import { listWorkLedger } from "../src/work-ledger/projection"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(async () => {
  await resetMemoryDatabase()
})

describe("Work Ledger interruption activity", () => {
  test("projects queued Work as active and publishes its queued-to-failed refresh contract", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.mergeMetadata({
          sessionID: (await createRightSidebarConversationSession("work")).id,
          patch: { configOverlay: { model: "openai/gpt-5.6-sol" } },
        })
        const now = Date.now()
        Database.use((db) =>
          db
            .insert(TaskQueueTable)
            .values({
              id: Identifier.ascending("task"),
              session_id: session.id,
              prompt: "queued Work fixture",
              priority: "normal",
              status: "queued",
              source: "session.prompt_async",
              metadata: { kind: "session_wake", messageID: Identifier.ascending("message"), input: {} },
              time_created: now,
              time_updated: now,
            })
            .run(),
        )
        const ledger = await listWorkLedger()
        expect(ledger.rows.find((row) => row.kind === "chat" && row.sessionID === session.id)).toMatchObject({
          kind: "chat",
          experience: "work",
          sessionID: session.id,
          status: "active",
        })

        const queueEvents: Array<{
          queueTaskID: string
          sessionID: string
          status: "queued" | "failed"
          sequence: number
        }> = []
        let resolveQueued!: () => void
        let resolveFailed!: () => void
        let queueTaskID = ""
        const queued = new Promise<void>((resolve) => (resolveQueued = resolve))
        const failed = new Promise<void>((resolve) => (resolveFailed = resolve))
        const unsubscribe = Bus.subscribe(TaskQueueEvent.Changed, (event) => {
          queueEvents.push(event.properties)
          if (event.properties.status === "queued") {
            queueTaskID = event.properties.queueTaskID
            resolveQueued()
          }
          if (event.properties.queueTaskID === queueTaskID && event.properties.status === "failed") resolveFailed()
        })
        const { taskID: enqueuedTaskID } = await TaskQueueService.enqueuePromptAfterPersistingUserMessage({
          sessionID: session.id,
          source: "session.prompt_async",
          prompt: {
            agent: "work",
            author: "work",
            parts: [{ type: "text", text: "queued Work event evidence" }],
          },
        })
        await queued
        expect(queueTaskID).toBe(enqueuedTaskID)
        TaskQueueService.cancelSessionPrompts({
          sessionIDs: [session.id],
          source: "session.prompt_async",
          reason: "event contract settled",
          origin: {
            actor: "user",
            source: "work-ledger-interruption-activity.test",
            surface: "chat",
            reason: "event contract settled",
          },
        })
        await failed
        unsubscribe()
        expect(queueEvents.filter((event) => event.queueTaskID === queueTaskID).map((event) => event.status)).toEqual([
          "queued",
          "failed",
        ])
        const queueEnvelope = WorkLedgerRouteTestHooks.workLedgerGlobalBusQueueEvent({
          payload: { type: TaskQueueEvent.Changed.type, properties: queueEvents[0] },
        })!
        expect(WorkLedgerRouteTestHooks.workLedgerSessionChangedEvent(
          queueEnvelope.sourceType,
          await Session.get(queueEnvelope.sessionID),
          queueEnvelope.sequence,
        )).toEqual({
          type: "work-ledger.changed",
          sourceType: TaskQueueEvent.Changed.type,
          sessionID: session.id,
          sequence: queueEvents[0]!.sequence,
        })
      },
    })
  })
})
