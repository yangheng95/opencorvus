import { afterAll, describe, expect, test } from "bun:test"
import { Identifier } from "../src/id/id"
import { acquireControlLease } from "../src/engine/control-lease"
import { Instance } from "../src/project/instance"
import { ProtocolDeliveryReceiptTable, ProtocolInboxTable } from "../src/protocol/protocol.sql"
import { projectProtocolDeliveryInTransaction } from "../src/protocol/delivery-projection"
import { auditSchedulerSessionDeliverySettlement } from "../src/protocol/delivery"
import { ProtocolStore } from "../src/protocol/store"
import { Database, eq } from "../src/storage/db"
import { ensureMissionSession } from "../src/mission/session"
import { openMissionExecution } from "../src/mission/execution-closure"
import { Session } from "../src/session"
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
        expect(auditSchedulerSessionDeliverySettlement("session:protocol-delivery")).toEqual({
          passed: false,
          evidenceComplete: true,
          pendingInboxIDs: [inboxID],
          leasedInboxIDs: [],
          unansweredInboxIDs: [],
          integrityBoundaryInboxIDs: [],
          deadLetterInboxIDs: [],
          invalidTerminalInboxIDs: [],
        })

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
        expect(auditSchedulerSessionDeliverySettlement("session:protocol-delivery")).toEqual({
          passed: false,
          evidenceComplete: true,
          pendingInboxIDs: [],
          leasedInboxIDs: [],
          unansweredInboxIDs: [],
          integrityBoundaryInboxIDs: [],
          deadLetterInboxIDs: [inboxID],
          invalidTerminalInboxIDs: [],
        })
        expect(auditSchedulerSessionDeliverySettlement("session:settled-empty")).toEqual({
          passed: true,
          evidenceComplete: true,
          pendingInboxIDs: [],
          leasedInboxIDs: [],
          unansweredInboxIDs: [],
          integrityBoundaryInboxIDs: [],
          deadLetterInboxIDs: [],
          invalidTerminalInboxIDs: [],
        })

        const leasedInboxID = Identifier.ascending("protocol_inbox")
        Database.use((db) => db.insert(ProtocolInboxTable).values({
          id: leasedInboxID,
          envelope_id: event.id,
          actor: "session",
          actor_id: "session:leased",
          visible_at: now,
          time_created: now,
        }).run())
        expect(acquireControlLease({
          target: "protocol_delivery",
          targetID: leasedInboxID,
          ownerOccurrenceID: "owner:delivery-test",
          now: Date.now(),
          leaseMilliseconds: 30_000,
        }).acquired).toBe(true)
        expect(auditSchedulerSessionDeliverySettlement("session:leased")).toMatchObject({
          passed: false,
          leasedInboxIDs: [leasedInboxID],
        })

        const unansweredMissionID = `mission-${Identifier.uuid4First8()}`
        const unansweredSession = await ensureMissionSession({
          missionID: unansweredMissionID,
          defaultCwd: project.path,
          productPillar: "code",
          heldExpertSquadIDs: ["base"],
        })
        const unansweredOpened = await openMissionExecution({
          missionID: unansweredMissionID,
          sessionID: unansweredSession.id,
          source: "mission.dispatch",
          requestID: "protocol-delivery-unanswered",
        })
        const unansweredEvent = await ProtocolStore.appendEvent({
          kind: "event",
          type: "scheduler.message",
          aggregate: "stream",
          aggregate_id: `stream:${Identifier.uuid4First8()}`,
          source: "test",
          emitted_at: now + 5,
          payload: {},
        })
        const unansweredInboxID = Identifier.ascending("protocol_inbox")
        const unansweredMessageID = Identifier.ascending("message")
        await Session.updateMessage({
          id: unansweredMessageID,
          sessionID: unansweredSession.id,
          role: "user",
          author: "orchestrator",
          time: { created: now + 5 },
          agent: "mission",
          model: { providerID: "test", modelID: "test" },
          extra: {
            wake_reason: {
              source: "scheduler.message",
              eventID: unansweredEvent.id,
              inboxID: unansweredInboxID,
              threadID: `thread:${Identifier.uuid4First8()}`,
              messageKind: "notification",
              sourceEndpoint: {
                kind: "task_scheduler",
                project_id: Instance.project.id,
                task_id: Identifier.ascending("task"),
                root_session_id: Identifier.ascending("session"),
              },
              targetEndpoint: {
                kind: "mission_scheduler",
                project_id: Instance.project.id,
                mission_id: unansweredMissionID,
                session_id: unansweredSession.id,
              },
              missionOccurrence: {
                openedEventID: unansweredOpened.eventID,
                openedOperationID: unansweredOpened.operationID,
              },
            },
          },
        })
        Database.transaction((db) => {
          db.insert(ProtocolInboxTable).values({
            id: unansweredInboxID,
            envelope_id: unansweredEvent.id,
            actor: "session",
            actor_id: unansweredSession.id,
            visible_at: now,
            time_created: now,
          }).run()
          db.insert(ProtocolDeliveryReceiptTable).values({
            id: Identifier.ascending("protocol_inbox"),
            inbox_id: unansweredInboxID,
            receipt: { kind: "session_wake", message_id: unansweredMessageID },
            time_created: now + 5,
          }).run()
        })
        expect(auditSchedulerSessionDeliverySettlement(unansweredSession.id)).toMatchObject({
          passed: false,
          unansweredInboxIDs: [unansweredInboxID],
        })

        const closedInboxID = Identifier.ascending("protocol_inbox")
        Database.transaction((db) => {
          db.insert(ProtocolInboxTable).values({
            id: closedInboxID,
            envelope_id: event.id,
            actor: "session",
            actor_id: "session:closed",
            visible_at: now,
            time_created: now,
          }).run()
          db.insert(ProtocolDeliveryReceiptTable).values({
            id: Identifier.ascending("protocol_inbox"),
            inbox_id: closedInboxID,
            receipt: { kind: "mission_closed", closure_event_id: Identifier.ascending("protocol_event") },
            time_created: now + 6,
          }).run()
        })
        expect(auditSchedulerSessionDeliverySettlement("session:closed")).toMatchObject({
          passed: true,
          invalidTerminalInboxIDs: [],
        })
      },
    })
  })
})
