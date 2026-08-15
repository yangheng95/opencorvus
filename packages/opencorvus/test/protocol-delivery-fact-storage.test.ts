import { afterAll, describe, expect, test } from "bun:test"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { ProtocolDeliveryReceiptTable, ProtocolInboxTable } from "../src/protocol/protocol.sql"
import { projectProtocolDeliveryInTransaction } from "../src/protocol/delivery-projection"
import { ProtocolStore } from "../src/protocol/store"
import { Database, eq } from "../src/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(async () => {
  await resetMemoryDatabase()
})

describe("Protocol delivery fact storage", () => {
  test("projects retry and terminal delivery from one discriminated receipt field", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const now = Date.now()
        const event = await ProtocolStore.appendEvent({
          kind: "event",
          type: "test.protocol.delivery",
          aggregate: "stream",
          aggregate_id: "stream:protocol-delivery",
          source: "test",
          emitted_at: now,
          payload: {},
        })
        const inboxID = Identifier.ascending("protocol_inbox")
        Database.transaction((db) => {
          db.insert(ProtocolInboxTable).values({
            id: inboxID,
            envelope_id: event.id,
            actor: "session",
            actor_id: "session:protocol-delivery",
            visible_at: now,
            time_created: now,
          }).run()
          db.insert(ProtocolDeliveryReceiptTable).values({
            id: Identifier.ascending("protocol_inbox"),
            inbox_id: inboxID,
            receipt: { kind: "retry_wait", visible_at: now + 1_000, error: "temporary" },
            time_created: now + 1,
          }).run()
        })
        expect(Database.use((db) => projectProtocolDeliveryInTransaction(
          db,
          db.select().from(ProtocolInboxTable).where(eq(ProtocolInboxTable.id, inboxID)).get()!,
          now + 2,
        ))).toMatchObject({ status: "pending", visible_at: now + 1_000, last_error: "temporary" })

        Database.use((db) => db.insert(ProtocolDeliveryReceiptTable).values({
          id: Identifier.ascending("protocol_inbox"),
          inbox_id: inboxID,
          receipt: { kind: "dead_letter", error_name: "PermanentError", message: "not deliverable" },
          time_created: now + 3,
        }).run())
        expect(Database.use((db) => ({
          projection: projectProtocolDeliveryInTransaction(
            db,
            db.select().from(ProtocolInboxTable).where(eq(ProtocolInboxTable.id, inboxID)).get()!,
            now + 4,
          ),
          receipts: db.select().from(ProtocolDeliveryReceiptTable)
            .where(eq(ProtocolDeliveryReceiptTable.inbox_id, inboxID)).all(),
        }))).toMatchObject({
          projection: {
            status: "dead_letter",
            last_error: "not deliverable",
            delivery_result: { kind: "dead_letter", error_name: "PermanentError", message: "not deliverable" },
          },
          receipts: [
            { receipt: { kind: "retry_wait", visible_at: now + 1_000, error: "temporary" } },
            { receipt: { kind: "dead_letter", error_name: "PermanentError", message: "not deliverable" } },
          ],
        })
      },
    })
  })
})
