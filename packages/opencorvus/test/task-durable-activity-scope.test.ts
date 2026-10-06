import { afterAll, expect, test } from "bun:test"
import { readTaskDurableActivityScope } from "../src/engine/durable-activity"
import { EngineTaskTable } from "../src/engine/engine.sql"
import { projectTaskRowInTransaction } from "../src/engine/store"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { appendTaskReopenedInTransaction, taskLifecycleProjection } from "../src/engine/task-lifecycle"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { ProtocolStore } from "../src/protocol/store"
import { Session } from "../src/session"
import { MessageTable } from "../src/session/session.sql"
import { Database, eq } from "../src/storage/db"
import { persistEstablishedTask } from "./fixture/engine-task"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const packageRevision = {
  scope: "built_in" as const, projectID: null, namespace: "builtin", id: "base",
  version: "2026.08.28.1", packageDigest: "a".repeat(64),
}

afterAll(resetMemoryDatabase)

test("retains completed worker facts in the exact Project and Task root scope with full same-millisecond revisions", async () => {
  await using project = await memoryProject("selected-durable-scope")
  await using otherProject = await memoryProject("other-durable-scope")
  await Instance.provide({ directory: otherProject.path, fn: async () => {
    const root = await Session.create({ kind: "root", title: "Other Project history" })
    await Session.updateMessage({ id: Identifier.ascending("message"), sessionID: root.id,
      role: "user", author: "user", agent: "work", model: { providerID: "test", modelID: "test" },
      time: { created: Date.now() } })
  } })
  await Instance.provide({ directory: project.path, fn: async () => {
    const now = Date.now()
    const root = Session.prepareRootNext({ kind: "root", directory: Instance.directory, title: "Selected Task" })
    const taskID = Identifier.ascending("task")
    persistEstablishedTask({ taskID, rootSession: root, now, title: "Selected Task", request: "Retain worker facts",
      productPillar: "code", source: "test", priority: "normal", metadata: { actor: "user" },
      projectID: Instance.project.id, packageRevision,
      executionCapsuleBinding: await prepareTaskProcessBinding({ mode: "native", taskID,
        projectID: Instance.project.id, rootDirectory: Instance.directory,
        packageRevisionSHA256: packageRevision.packageDigest, timeCreated: now }) })
    const unrelated = await Session.create({ kind: "root", title: "Unrelated root" })
    await Session.updateMessage({ id: Identifier.ascending("message"), sessionID: unrelated.id,
      role: "user", author: "user", agent: "work", model: { providerID: "test", modelID: "test" },
      time: { created: now } })
    const worker = await Session.create({ kind: "assistant", parentID: root.id, title: "Completed worker" })
    const input = await Session.updateMessage({ id: Identifier.ascending("message"), sessionID: worker.id,
      role: "user", author: "user", agent: "coding", model: { providerID: "test", modelID: "test" },
      time: { created: now } })
    const message = await Session.updateMessage({ id: Identifier.ascending("message"), sessionID: worker.id,
      role: "assistant", parentID: input.id, author: "coding", agent: "coding", providerID: "test", modelID: "test",
      path: { cwd: project.path, root: project.path }, cost: 0,
      tokens: { total: 1, input: 1, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      time: { created: now + 1 } })
    if (message.role !== "assistant") throw new Error("Expected completed worker assistant")
    const tool = await Session.updatePart({ id: Identifier.ascending("part"), sessionID: worker.id,
      messageID: message.id, type: "tool", tool: "read", callID: "scope-completed-read",
      state: { status: "completed", input: { filePath: "hello.txt" }, output: "Hello\n", title: "Read hello.txt",
        metadata: {}, time: { start: now + 1, end: now + 2 } } })
    const scope = () => Database.transaction((db) => {
      const row = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, taskID)).get()
      if (!row) throw new Error("Established Task missing")
      return readTaskDurableActivityScope(db, projectTaskRowInTransaction(db, row))
    })
    const initial = scope()
    expect(initial.sessions.map((row) => row.id).sort()).toEqual([root.id, worker.id].sort())
    expect(initial.messages.map((row) => row.id)).toEqual([input.id, message.id])
    expect(initial.toolRequests.map((row) => row.id)).toEqual([tool.id])
    expect(initial.toolOutcomes.map((row) => ({ requestID: row.request_part_id, data: row.data }))).toEqual([
      { requestID: tool.id, data: expect.objectContaining({ outcome: "completed", output: "Hello\n" }) },
    ])
    const initialAssistant = initial.messages.find((row) => row.id === message.id)
    if (!initialAssistant) throw new Error("Completed assistant must remain in Task scope")
    const sameTime = initialAssistant.time_updated
    const inputTime = initial.messages.find((row) => row.id === input.id)!.time_updated
    const keys = [JSON.stringify(initial.activity)]
    for (const cost of [1, 2]) {
      const { orderKey: _orderKey, ...fields } = message
      await Session.updateMessage({ ...fields, cost })
      Database.use((db) => db.update(MessageTable).set({ time_updated: sameTime })
        .where(eq(MessageTable.id, message.id)).run())
      const current = scope()
      expect(current.messages.map((row) => ({ id: row.id, time: row.time_updated }))).toEqual([
        { id: input.id, time: inputTime },
        { id: message.id, time: sameTime },
      ])
      keys.push(JSON.stringify(current.activity))
    }
    expect(new Set(keys).size).toBe(3)
    const { orderKey: _initialOrderKey, ...workerFields } = message
    await Session.updateMessage({ ...workerFields, cost: 2,
      time: { created: now + 1, completed: now + 3 }, finish: "stop" })
    const retained = scope()
    expect(retained.sessions.map((row) => row.id).sort()).toEqual([root.id, worker.id].sort())
    expect(retained.messages.map((row) => row.id)).toEqual([input.id, message.id])
    expect(retained.messages.map((row) => row.data)).toEqual([
      expect.objectContaining({ role: "user", time: { created: now } }),
      expect.objectContaining({ role: "assistant", parentID: input.id, finish: "stop", time: { created: now + 1, completed: now + 3 } }),
    ])
    expect(retained.toolOutcomes.map((row) => ({ requestID: row.request_part_id, data: row.data }))).toEqual([
      { requestID: tool.id, data: expect.objectContaining({ outcome: "completed", output: "Hello\n" }) },
    ])
  } })
})

test("projects a genuine reopened Task epoch and its exact previous terminal occurrence", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    const now = Date.now()
    const root = Session.prepareRootNext({ kind: "root", directory: Instance.directory, title: "Reopened Task" })
    const taskID = Identifier.ascending("task")
    persistEstablishedTask({ taskID, rootSession: root, now, title: "Reopened Task", request: "Observe occurrence",
      productPillar: "code", source: "test", priority: "normal", metadata: { actor: "user" },
      projectID: Instance.project.id, packageRevision,
      executionCapsuleBinding: await prepareTaskProcessBinding({ mode: "native", taskID,
        projectID: Instance.project.id, rootDirectory: Instance.directory,
        packageRevisionSHA256: packageRevision.packageDigest, timeCreated: now }) })
    const opened = taskLifecycleProjection(taskID)
    const terminal = await ProtocolStore.appendEvent({ kind: "event", type: "task.completed", aggregate: "task",
      aggregate_id: taskID, task_id: null, session_id: root.id, source: "test.scope", emitted_at: now + 1,
      payload: { execution_epoch: opened.epoch } })
    expect(taskLifecycleProjection(taskID)).toMatchObject({ epoch: 1, openedEventID: opened.openedEventID,
      status: "completed", terminalEventID: terminal.id, terminalAt: now + 1 })
    const reopened = Database.immediateTransaction((db) => appendTaskReopenedInTransaction({ db, taskID,
      sessionID: root.id, now: now + 2, source: "test.scope" }))
    expect(reopened).toMatchObject({ taskID, epoch: 2, status: "active", openedAt: now + 2,
      previousTerminal: { epoch: 1, status: "completed", terminalEventID: terminal.id, terminalAt: now + 1 } })
    expect(new Set([opened.openedEventID, reopened.openedEventID]).size).toBe(2)
  } })
})
