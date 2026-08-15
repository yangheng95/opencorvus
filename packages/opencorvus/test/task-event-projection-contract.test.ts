import { afterEach, expect, test } from "bun:test"
import { EngineTaskTable } from "@/engine/engine.sql"
import { taskMessageWatermarkCursor } from "@/orchestrator/task-event"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { ProtocolStore } from "@/protocol/store"
import { protocolTaskEvent } from "@/server/routes/orchestrator"
import { protocolSessionEvent } from "@/server/routes/session"
import { Session } from "@/session"
import { Database } from "@/storage/db"
import { timelineOrderKey } from "@/timeline/order"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test("projects normalized Part ownership and Protocol envelope identity into conversation transport", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const now = Date.now()
      const taskID = Identifier.ascending("task")
      const root = await Session.create({ kind: "root", title: "Envelope projection root" })
      const child = await Session.create({
        kind: "orchestrator",
        parentID: root.id,
        title: "Envelope projection child",
      })
      Database.transaction((db) => db.insert(EngineTaskTable).values({
        id: taskID,
        project_id: Instance.project.id,
        session_id: root.id,
        source: "test",
        product_pillar: "code",
        title: "Envelope projection",
        request: "Project one normalized conversation",
        metadata: { actor: "user" },
        time_created: now,
      }).run())
      const message = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: child.id,
        role: "user",
        author: "orchestrator",
        time: { created: now + 1 },
        agent: "orchestrator",
        model: { providerID: "test", modelID: "projection" },
      })
      const part = await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: child.id,
        messageID: message.id,
        type: "text",
        text: "Normalized Part is reached through its Message owner.",
      })
      const cursor = taskMessageWatermarkCursor(taskID)

      const event = Database.transaction((db) => ProtocolStore.appendEventInTransaction({
        kind: "event",
        type: "agent.execution.lifecycle",
        aggregate: "task",
        aggregate_id: taskID,
        task_id: null,
        session_id: child.id,
        source: "test.envelope-projection",
        emitted_at: now + 10,
        order_key: timelineOrderKey({ domain: "session", time: message.time.created, id: message.id }),
        payload: {
          inputMessageID: message.id,
          status: { type: "terminal", reason: "completed" },
        },
      }))
      const durable = ProtocolStore.listTaskEvents(taskID).find((candidate) => candidate.id === event.id)!

      expect({
        watermark: cursor.watermark,
        signature: cursor.signature,
        taskEvent: protocolTaskEvent(durable),
        sessionEvent: protocolSessionEvent(durable),
      }).toMatchObject({
        watermark: expect.any(Number),
        signature: expect.stringContaining(`part:${part.id}:`),
        taskEvent: {
          event_id: event.id,
          task_id: taskID,
          session_id: child.id,
          payload: {
            inputMessageID: message.id,
            status: { type: "terminal", reason: "completed" },
          },
        },
        sessionEvent: {
          event_id: event.id,
          session_id: child.id,
          payload: {
            inputMessageID: message.id,
            status: { type: "terminal", reason: "completed" },
          },
        },
      })
      expect(cursor.watermark).toBeGreaterThan(0)
    },
  })
})
