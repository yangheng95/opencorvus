import { afterEach, describe, expect, test } from "bun:test"
import { EngineTaskTable } from "@/engine/engine.sql"
import { appendTaskOpenedInTransaction } from "@/engine/task-lifecycle"
import { clearRewindCursor, rewindTask, taskRewindCursor } from "@/engine/rewind"
import { Event } from "@/engine/model"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { ProtocolEventTable } from "@/protocol/protocol.sql"
import { Session } from "@/session"
import { Database, asc, eq } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("Task rewind fact projection", () => {
  test("projects rewind and clear from the append-only protocol facts", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const taskID = Identifier.ascending("task")
        const session = await Session.create({ kind: "root", title: "Rewind fact" })
        const now = Date.now()
        Database.transaction((db) => {
          db.insert(EngineTaskTable).values({
            id: taskID,
            project_id: Instance.project.id,
            session_id: session.id,
            source: "test",
            product_pillar: "code",
            title: "Rewind fact",
            request: "Project one cursor",
            time_created: now,
          }).run()
          appendTaskOpenedInTransaction({ db, taskID, sessionID: session.id, now, source: "test.task-rewind" })
        })

        expect(await rewindTask({ taskID, anchor: { kind: "cursorTime", cursorTime: now + 10 } })).toMatchObject({
          taskID,
          cursorTime: now + 10,
          rewindCount: 1,
        })
        expect(taskRewindCursor(taskID)).toBe(now + 10)
        await clearRewindCursor(taskID)

        const facts = Database.use((db) => db.select({ payload: ProtocolEventTable.payload })
          .from(ProtocolEventTable)
          .where(eq(ProtocolEventTable.type, Event.TaskRewound.type))
          .orderBy(asc(ProtocolEventTable.seq)).all())
        expect({ cursor: taskRewindCursor(taskID), facts: facts.map((row) => row.payload) }).toEqual({
          cursor: null,
          facts: [
            { cursorTime: now + 10, anchorKind: "cursorTime" },
            { cursorTime: 0, anchorKind: "cursorTime", reason: "cursor cleared" },
          ],
        })
      },
    })
  })
})
