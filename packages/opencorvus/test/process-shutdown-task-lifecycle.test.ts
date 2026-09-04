import { afterEach, expect, test } from "bun:test"
import { EngineTaskRootIngressTable, EngineTaskTable } from "@/engine/engine.sql"
import { persistProcessShutdownRecoveryHandoffs } from "@/engine/task-root-ingress-delivery"
import { appendTaskOpenedInTransaction, taskLifecycleProjection } from "@/engine/task-lifecycle"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { ProtocolStore } from "@/protocol/store"
import { Server } from "@/server/server"
import { Session } from "@/session"
import { SessionPromptState } from "@/session/prompt/state"
import { Database } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

type Status = "active" | "cancelling" | "completed" | "failed" | "cancelled"

async function seedTask(status: Status) {
  const root = await Session.create({ kind: "root", title: `Shutdown ${status}` })
  const taskID = Identifier.ascending("task")
  const now = Date.now()
  Database.immediateTransaction((db) => {
    db.insert(EngineTaskTable).values({
      id: taskID, project_id: Instance.project.id, session_id: root.id, source: "test",
      product_pillar: "work", title: root.title, request: "Settle exact physical ownership", time_created: now,
    }).run()
    appendTaskOpenedInTransaction({ db, taskID, sessionID: root.id, now, source: "test.shutdown" })
    if (status !== "active") {
      ProtocolStore.appendEventInTransaction({
        kind: status === "cancelling" ? "command" : "event",
        type: status === "cancelling" ? "task.cancellation.requested" : `task.${status}`,
        aggregate: "task", aggregate_id: taskID, task_id: null, session_id: root.id,
        source: "test.shutdown", emitted_at: now + 1,
        payload: { execution_epoch: 1, reason: "exact lifecycle fixture" },
      })
    }
  })
  return { taskID, root, status }
}

afterEach(resetMemoryDatabase)

test("hands off active occurrences in a mixed lifecycle batch across two Projects", async () => {
  await using first = await memoryProject("shutdown-first")
  await using second = await memoryProject("shutdown-second")
  const tasks = [] as Awaited<ReturnType<typeof seedTask>>[]
  for (const [directory, statuses] of [
    [first.path, ["completed", "active", "cancelling"]],
    [second.path, ["failed", "active", "cancelled"]],
  ] as const) {
    await Instance.provide({ directory, fn: async () => {
      for (const status of statuses) tasks.push(await seedTask(status))
    } })
  }
  const before = tasks.map(({ taskID }) => taskLifecycleProjection(taskID))
  const handoffs = persistProcessShutdownRecoveryHandoffs({
    tasks: tasks.map(({ taskID, root }) => ({ taskID, ownedSessionIDs: [root.id] })),
    reason: "mixed lifecycle shutdown",
  })
  expect(handoffs.map(({ taskID }) => taskID)).toEqual(tasks.filter((task) => task.status === "active").map((task) => task.taskID))
  expect(Database.use((db) => db.select({
    taskID: EngineTaskRootIngressTable.task_id,
    id: EngineTaskRootIngressTable.id,
    source: EngineTaskRootIngressTable.source,
    sourceID: EngineTaskRootIngressTable.source_id,
    epoch: EngineTaskRootIngressTable.execution_epoch,
  }).from(EngineTaskRootIngressTable).orderBy(EngineTaskRootIngressTable.task_id).all())).toEqual(
    handoffs.map((handoff) => ({
      taskID: handoff.taskID, id: handoff.wakeID, source: "engine_artifact" as const,
      sourceID: handoff.recoveryFactID, epoch: 1,
    })).sort((a, b) => a.taskID < b.taskID ? -1 : a.taskID > b.taskID ? 1 : 0),
  )
  expect(tasks.map(({ taskID }) => taskLifecycleProjection(taskID))).toEqual(before)
})

test("real listener shutdown settles a terminal Task Prompt tail and retains its completed occurrence", async () => {
  await using project = await memoryProject("terminal-shutdown")
  const task = await Instance.provide({ directory: project.path, fn: () => seedTask("completed") })
  const before = taskLifecycleProjection(task.taskID)
  const server = Server.listen({ hostname: "127.0.0.1", port: 0, randomPort: true })
  const events: string[] = []
  let finish: Promise<void> | undefined
  try {
    await Instance.provide({ directory: project.path, fn: async () => {
      const signal = SessionPromptState.start(task.root.id, task.root.directory)
      if (!signal) throw new Error("Expected an owned terminal Prompt tail")
      events.push("prompt:owned")
      signal.addEventListener("abort", () => {
        events.push("prompt:cancelled")
        finish = SessionPromptState.finish(task.root.id, signal, task.root.directory).then(() => {
          events.push("prompt:finished")
        })
      }, { once: true })
    } })
    await server.stop(true)
    await finish
    events.push("listener:stopped")
    expect(events).toEqual(["prompt:owned", "prompt:cancelled", "prompt:finished", "listener:stopped"])
    expect(taskLifecycleProjection(task.taskID)).toEqual(before)
  } finally {
    await SessionPromptState.release(task.root.id, task.root.directory)
    await server.stop(true)
  }
}, 60_000)
