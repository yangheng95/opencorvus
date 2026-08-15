import { afterEach, describe, expect, test } from "bun:test"
import { EngineTaskTable } from "@/engine/engine.sql"
import { acceptTaskRootIngressInTransaction } from "@/engine/task-root-fact-store"
import { appendTaskOpenedInTransaction, taskLifecycleProjection } from "@/engine/task-lifecycle"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { ProtocolStore } from "@/protocol/store"
import { Session } from "@/session"
import { MessageTable, PartTable } from "@/session/session.sql"
import { Database, eq } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("active operator immutable ingress", () => {
  test("freezes the exact accepted root Message bundle as the recoverable input fact", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const taskID = Identifier.ascending("task")
      const root = await Session.create({ kind: "root", title: "Operator input" })
      const now = Date.now()
      Database.immediateTransaction((db) => {
        db.insert(EngineTaskTable).values({
          id: taskID, project_id: Instance.project.id, session_id: root.id, source: "test",
          product_pillar: "code", title: "Operator input", request: "Keep this exact input", time_created: now,
        }).run()
        appendTaskOpenedInTransaction({ db, taskID, sessionID: root.id, now, source: "test.operator" })
      })
      const messageID = Identifier.ascending("message")
      const partID = Identifier.ascending("part")
      await Session.persistMessage({
        info: {
          id: messageID, sessionID: root.id, role: "user", author: "user", time: { created: now + 1 },
          agent: "orchestrator", model: { providerID: "openai", modelID: "gpt-5.6-terra" },
        },
        parts: [{ id: partID, sessionID: root.id, messageID, type: "text", text: "Canonical operator input" }],
      })
      const ingress = Database.immediateTransaction((db) => acceptTaskRootIngressInTransaction(db, {
        taskID, executionEpoch: 1, source: "message", sourceID: messageID,
        semanticTurnLimit: 3, activationLimit: 4, now: now + 2,
      }))
      expect(ingress).toMatchObject({ source: "message", source_id: messageID, inline_payload: null })
      expect(() => Database.use((db) => db.update(MessageTable).set({ time_updated: now + 9 }).where(eq(MessageTable.id, messageID)).run()))
        .toThrow("accepted Task-root causal facts are immutable")
      expect(() => Database.use((db) => db.delete(PartTable).where(eq(PartTable.id, partID)).run()))
        .toThrow("Task-root causal facts are immutable")
      expect(Database.use((db) => ({
        message: db.select({ id: MessageTable.id }).from(MessageTable).where(eq(MessageTable.id, messageID)).get(),
        part: db.select({ id: PartTable.id, data: PartTable.data }).from(PartTable).where(eq(PartTable.id, partID)).get(),
      }))).toEqual({ message: { id: messageID }, part: { id: partID, data: { type: "text", text: "Canonical operator input" } } })
    } })
  })

  test("reduces cancellation request and terminal outcome from one epoch fact stream", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const taskID = Identifier.ascending("task")
      const root = await Session.create({ kind: "root", title: "Cancellation facts" })
      const now = Date.now()
      Database.immediateTransaction((db) => {
        db.insert(EngineTaskTable).values({ id: taskID, project_id: Instance.project.id, session_id: root.id, source: "test", product_pillar: "code", title: "Cancellation facts", request: "Cancel once", time_created: now }).run()
        appendTaskOpenedInTransaction({ db, taskID, sessionID: root.id, now, source: "test.cancel" })
        ProtocolStore.appendEventInTransaction({ kind: "command", type: "task.cancellation.requested", aggregate: "task", aggregate_id: taskID, task_id: null, session_id: root.id, source: "operator", emitted_at: now + 1, payload: { execution_epoch: 1, reason: "operator requested" } })
      })
      expect(taskLifecycleProjection(taskID)).toMatchObject({ epoch: 1, status: "cancelling" })
      Database.immediateTransaction((db) => ProtocolStore.appendEventInTransaction({ kind: "event", type: "task.cancelled", aggregate: "task", aggregate_id: taskID, task_id: null, session_id: root.id, source: "host", emitted_at: now + 2, payload: { execution_epoch: 1, reason: "operator requested" } }))
      expect(taskLifecycleProjection(taskID)).toMatchObject({ epoch: 1, status: "cancelled", terminalAt: now + 2 })
    } })
  })
})
