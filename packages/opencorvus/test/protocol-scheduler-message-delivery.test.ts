import { afterEach, describe, expect, test } from "bun:test"
import { EngineTaskTable } from "@/engine/engine.sql"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { ProtocolEventTable } from "@/protocol/protocol.sql"
import { ProtocolStore } from "@/protocol/store"
import { Session } from "@/session"
import { MessageTable } from "@/session/session.sql"
import { Database, eq } from "@/storage/db"
import { timelineOrderKey } from "@/timeline/order"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("Protocol immutable lifecycle delivery fact", () => {
  test("derives the public timeline key and typed identities from one durable lifecycle envelope", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const taskID = Identifier.ascending("task")
      const root = await Session.create({ kind: "root", title: "Protocol lifecycle" })
      const inputMessageID = Identifier.ascending("message")
      const created = Date.now()
      await Session.updateMessage({
        id: inputMessageID, sessionID: root.id, role: "user", author: "user", time: { created },
        agent: "orchestrator", model: { providerID: "openai", modelID: "gpt-5.6-terra" },
      })
      Database.use((db) => db.insert(EngineTaskTable).values({
        id: taskID, project_id: Instance.project.id, session_id: root.id, source: "test", product_pillar: "code",
        title: "Protocol lifecycle", request: "Persist exact lifecycle", time_created: created,
      }).run())
      const orderKey = timelineOrderKey({ domain: "session", time: created, id: inputMessageID })
      const event = await ProtocolStore.appendEvent({
        kind: "event", type: "agent.execution.lifecycle", aggregate: "task", aggregate_id: taskID,
        task_id: null, session_id: root.id, source: "session.bridge", emitted_at: created + 1,
        order_key: orderKey, payload: { inputMessageID, status: "completed" },
      })
      expect(event).toMatchObject({ taskID, sessionID: root.id, orderKey, payload: { inputMessageID, status: "completed" } })
      const raw = Database.use((db) => db.select().from(ProtocolEventTable).where(eq(ProtocolEventTable.id, event.id)).get())
      expect(raw).toMatchObject({ aggregate_type: "task", aggregate_id: taskID, task_id: null, session_id: root.id, payload: { inputMessageID, status: "completed" } })
      expect(() => Database.use((db) => db.update(ProtocolEventTable).set({ emitted_at: created + 2 }).where(eq(ProtocolEventTable.id, event.id)).run()))
        .toThrow("immutable domain fact")
      expect(Database.use((db) => db.select({ id: MessageTable.id }).from(MessageTable).where(eq(MessageTable.id, inputMessageID)).get()))
        .toEqual({ id: inputMessageID })
    } })
  })
})
