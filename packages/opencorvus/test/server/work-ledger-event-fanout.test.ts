import { afterEach, expect, test } from "bun:test"
import { EngineTaskTable } from "@/engine/engine.sql"
import { appendTaskOpenedInTransaction } from "@/engine/task-lifecycle"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { ProtocolStore } from "@/protocol/store"
import { Server } from "@/server/server"
import { Session } from "@/session"
import { Database, eq } from "@/storage/db"
import { EngineService } from "@/task-api"
import { WorkLedgerEvent } from "@opencorvus-ai/transport-protocol"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await resetMemoryDatabase()
})

test("global ledger stream fans out durable Task events to every affected projection across projects", async () => {
  await using first = await memoryProject("ledger-first")
  await using second = await memoryProject("ledger-second")
  const abort = new AbortController()
  const response = await Server.App().request("/work-ledger/events", { signal: abort.signal })
  expect(response.status).toBe(200)
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffered = ""
  const pending: Array<ReturnType<typeof WorkLedgerEvent.parse>> = []
  async function next(type: string, sourceType?: string, taskID?: string) {
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Ledger event delivery timed out: ${type} ${sourceType ?? ""}`)), 5_000)
    })
    try {
      while (true) {
        const frames = buffered.split("\n\n")
        buffered = frames.pop() ?? ""
        for (const frame of frames) {
          const data = frame
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trimStart())
            .join("\n")
          if (data) pending.push(WorkLedgerEvent.parse(JSON.parse(data)))
        }
        const index = pending.findIndex(
          (event) =>
            event.type === type &&
            (sourceType === undefined || event.sourceType === sourceType) &&
            (taskID === undefined || ("taskID" in event && event.taskID === taskID)),
        )
        if (index >= 0) return pending.splice(index, 1)[0]!
        const chunk = await Promise.race([reader.read(), timeout])
        if (chunk.done) throw new Error("Ledger stream closed before expected event")
        buffered += decoder.decode(chunk.value, { stream: true })
      }
    } finally {
      clearTimeout(timer)
    }
  }
  try {
    expect((await next("work-ledger.connected")).type).toBe("work-ledger.connected")
    const affected: Array<{ project: typeof first; taskID: string }> = []
    for (const [index, type] of [
      "task.completed",
      "task.failed",
      "interaction.requested",
      "task.cancelled",
    ].entries()) {
      const project = index % 2 === 0 ? first : second
      const event = await Instance.provide({
        directory: project.path,
        fn: async () => {
          const root = await Session.create({ kind: "root", title: type })
          const taskID = Identifier.ascending("task")
          Database.transaction((db) => {
            db
              .insert(EngineTaskTable)
              .values({
                id: taskID,
                project_id: Instance.project.id,
                session_id: root.id,
                source: "test",
                product_pillar: "code",
                title: type,
                request: "Verify durable notification fan-out",
                time_created: Date.now(),
              })
              .run()
            appendTaskOpenedInTransaction({ db, taskID, sessionID: root.id, now: Date.now(), source: "test.work-ledger-fanout" })
          })
          return ProtocolStore.appendEvent({
            kind: "event",
            type,
            aggregate: "task",
            aggregate_id: taskID,
            source: "test.work-ledger-fanout",
            payload: { execution_epoch: 1 },
          })
        },
      })
      await Database.awaitEffectIdle(5_000)
      affected.push({ project, taskID: event.taskID! })
      if (type !== "task.cancelled") {
        expect(await next("mailbox.changed", type, event.taskID)).toEqual({
          type: "mailbox.changed",
          sourceType: type,
          messageID: event.id,
          taskID: event.taskID,
          sequence: event.sequence,
        })
      }
      expect(await next("work-ledger.changed", type, event.taskID)).toEqual({
        type: "work-ledger.changed",
        sourceType: type,
        taskID: event.taskID,
        sequence: event.sequence,
      })
      expect(ProtocolStore.requireEvent(event.id)).toMatchObject({
        type,
        taskID: event.taskID,
        sequence: event.sequence,
      })
    }
    const renamed = affected[0]!
    const pinned = affected[1]!
    await Promise.all([
      Instance.provide({ directory: renamed.project.path, fn: () => EngineService.updateTaskTitle(renamed.taskID, "Restorable ledger task") }),
      Instance.provide({ directory: pinned.project.path, fn: () => EngineService.setTaskPinned(pinned.taskID, true) }),
    ])
    for (const target of [renamed, pinned]) {
      expect(await next("work-ledger.changed", "task.updated", target.taskID)).toEqual({
        type: "work-ledger.changed",
        sourceType: "task.updated",
        taskID: target.taskID,
        directory: target.project.path,
        sequence: 0,
      })
    }
    expect(Database.use(db => db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, renamed.taskID)).get())?.title)
      .toBe("Restorable ledger task")
    expect(Database.use(db => db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, pinned.taskID)).get())?.time_pinned)
      .toBeGreaterThan(0)
    for (const archived of [true, false] as const) {
      await Instance.provide({ directory: renamed.project.path, fn: () => EngineService.setTaskArchived(renamed.taskID, archived) })
      expect(await next("work-ledger.changed", "task.updated", renamed.taskID)).toEqual({
        type: "work-ledger.changed",
        sourceType: "task.updated",
        taskID: renamed.taskID,
        directory: renamed.project.path,
        sequence: 0,
      })
      const record = Database.use(db => db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, renamed.taskID)).get())!
      if (archived) expect(record.time_archived).toBeGreaterThan(0)
      else expect(record.time_archived).toBeNull()
    }
  } finally {
    abort.abort()
    await reader.cancel()
  }
}, 30_000)
