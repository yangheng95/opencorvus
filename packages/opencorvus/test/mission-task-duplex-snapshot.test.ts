import { afterEach, describe, expect, test } from "bun:test"
import { EngineTaskTable } from "@/engine/engine.sql"
import { appendTaskOpenedInTransaction } from "@/engine/task-lifecycle"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { ProtocolDeliveryReceiptTable, ProtocolInboxTable } from "@/protocol/protocol.sql"
import { ProtocolStore } from "@/protocol/store"
import { Session } from "@/session"
import { Database } from "@/storage/db"
import {
  missionTaskDuplexProgressKey,
  projectMissionTaskDuplexControlStateInTransaction,
} from "../script/mission-task-duplex-snapshot"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("Mission Task duplex snapshot", () => {
  test("projects terminal Task and delivery facts into one semantic acceptance frontier", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const now = Date.now()
        const taskID = Identifier.ascending("task")
        const root = await Session.create({ kind: "root", title: "Duplex snapshot" })
        const inboxID = Identifier.ascending("protocol_inbox")
        const messageID = Identifier.ascending("message")
        const snapshot = Database.immediateTransaction((db) => {
          db.insert(EngineTaskTable).values({
            id: taskID,
            project_id: Instance.project.id,
            session_id: root.id,
            source: "test",
            product_pillar: "code",
            title: "Duplex snapshot",
            request: "Project current control facts",
            time_created: now,
          }).run()
          appendTaskOpenedInTransaction({ db, taskID, sessionID: root.id, now, source: "test.duplex" })
          ProtocolStore.appendEventInTransaction({
            kind: "event",
            type: "task.completed",
            aggregate: "task",
            aggregate_id: taskID,
            task_id: null,
            session_id: root.id,
            source: "test.duplex",
            emitted_at: now + 1,
            payload: { execution_epoch: 1 },
          })
          const deliveryEvent = ProtocolStore.appendEventInTransaction({
            kind: "event",
            type: "test.duplex.delivery",
            aggregate: "stream",
            aggregate_id: "stream:duplex-snapshot",
            source: "test.duplex",
            emitted_at: now + 2,
            payload: {},
          })
          db.insert(ProtocolInboxTable).values({
            id: inboxID,
            envelope_id: deliveryEvent.id,
            actor: "session",
            actor_id: root.id,
            visible_at: now + 2,
            time_created: now + 2,
          }).run()
          db.insert(ProtocolDeliveryReceiptTable).values({
            id: Identifier.ascending("protocol_inbox"),
            inbox_id: inboxID,
            receipt: { kind: "session_wake", message_id: messageID },
            time_created: now + 3,
          }).run()
          return projectMissionTaskDuplexControlStateInTransaction(db, {
            tasks: db.select().from(EngineTaskTable).all(),
            inboxes: db.select().from(ProtocolInboxTable).all(),
          }, now + 4)
        })

        expect(snapshot.tasks).toMatchObject([
          { id: taskID, lifecycle_status: "completed", time_completed: now + 1 },
        ])
        expect(snapshot.inboxes).toMatchObject([
          {
            id: inboxID,
            status: "delivered",
            delivery_result: { kind: "session_wake", message_id: messageID },
          },
        ])
        expect(missionTaskDuplexProgressKey({
          ...snapshot,
          schedulerEventCount: 1,
          missionCompleted: false,
        })).toBe("1:1:1:1:0")
        expect(missionTaskDuplexProgressKey({
          ...snapshot,
          schedulerEventCount: 1,
          missionCompleted: true,
        })).toBe("1:1:1:1:1")
      },
    })
  })
})
