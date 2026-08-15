import { afterEach, describe, expect, test } from "bun:test"
import { EngineTaskTable } from "@/engine/engine.sql"
import { BusPublicationOutboxTable } from "@/bus/bus.sql"
import { EngineInteractionOutcomeTable, EngineInteractionRequestTable } from "@/engine/engine.sql"
import { projectInteractionRowInTransaction } from "@/engine/store"
import { writeTaskUpdateInTransaction } from "@/engine/state"
import {
  acceptTaskRootIngressInTransaction,
  acquireTaskRootIngressLease,
  assertTaskRootActivationFenceInTransaction,
  projectTaskRootIngress,
} from "@/engine/task-root-fact-store"
import { Identifier } from "@/id/id"
import { ProtocolStore } from "@/protocol/store"
import { ProtocolEventTable } from "@/protocol/protocol.sql"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Database, eq } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("Task-root fact persistence", () => {
  test("keeps Task identity in the lifecycle envelope while projecting it into the durable delivery request", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const taskID = Identifier.ascending("task")
        const root = await Session.create({ kind: "root", title: "Terminal fact root" })
        const now = Date.now()
        const facts = Database.transaction((db) => {
          db.insert(EngineTaskTable).values({
            id: taskID,
            project_id: Instance.project.id,
            session_id: root.id,
            source: "test",
            product_pillar: "code",
            title: "Terminal fact root",
            request: "Complete once",
            metadata: { actor: "user" },
            time_created: now,
          }).run()
          ProtocolStore.appendEventInTransaction({
            kind: "event",
            type: "task.execution.opened",
            aggregate: "task",
            aggregate_id: taskID,
            task_id: null,
            session_id: root.id,
            source: "test",
            emitted_at: now,
            payload: { execution_epoch: 1 },
          })
          writeTaskUpdateInTransaction({
            db,
            taskID,
            values: { status: "completed" },
            summary: "Completed from one lifecycle fact",
            now: now + 1,
          })
          const lifecycle = db.select().from(ProtocolEventTable).where(eq(ProtocolEventTable.type, "task.completed")).get()!
          const delivery = db.select().from(BusPublicationOutboxTable).where(eq(BusPublicationOutboxTable.event_type, "task.completed")).get()!
          return { lifecycle, delivery }
        })

        expect(facts.lifecycle).toMatchObject({
          aggregate_type: "task",
          aggregate_id: taskID,
          task_id: null,
          payload: { execution_epoch: 1, summary: "Completed from one lifecycle fact" },
        })
        expect(facts.delivery.properties).toEqual({
          taskID,
          execution_epoch: 1,
          summary: "Completed from one lifecycle fact",
        })
      },
    })
  })

  test("projects one immutable Interaction request and outcome", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const taskID = Identifier.ascending("task")
        const interactionID = Identifier.ascending("interaction")
        const root = await Session.create({ kind: "root", title: "Interaction root" })
        const now = Date.now()
        Database.transaction((db) => {
          db.insert(EngineTaskTable).values({
            id: taskID,
            project_id: Instance.project.id,
            session_id: root.id,
            source: "test",
            product_pillar: "code",
            title: "Interaction root",
            request: "Answer exactly once",
            time_created: now,
          }).run()
          db.insert(EngineInteractionRequestTable).values({
            id: interactionID,
            task_id: taskID,
            session_id: root.id,
            external_id: "question-1",
            request_type: "question",
            title: "Question",
            body: "Choose",
            payload: {},
            time_created: now + 1,
          }).run()
        })

        expect(Database.use((db) => projectInteractionRowInTransaction(db, db.select().from(EngineInteractionRequestTable).get()!))).toMatchObject({
          id: interactionID,
          status: "pending",
          response: null,
          time_resolved: null,
          time_updated: now + 1,
        })

        Database.transaction((db) => db.insert(EngineInteractionOutcomeTable).values({
          id: Identifier.deterministic("interaction", `interaction-outcome\0${interactionID}`),
          interaction_id: interactionID,
          outcome: "answered",
          response: { answer: "yes" },
          time_created: now + 2,
        }).run())
        expect(Database.use((db) => projectInteractionRowInTransaction(db, db.select().from(EngineInteractionRequestTable).get()!))).toMatchObject({
          status: "answered",
          response: { answer: "yes" },
          time_resolved: now + 2,
          time_updated: now + 2,
        })
      },
    })
  })

  test("accepts one source across epochs and fences stale activations", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const taskID = Identifier.ascending("task")
        const root = await Session.create({ kind: "root", title: "Fact root" })
        const now = Date.now()
        Database.transaction((db) => {
          db.insert(EngineTaskTable)
            .values({
              id: taskID,
              project_id: Instance.project.id,
              session_id: root.id,
              source: "test",
              product_pillar: "code",
              title: "Fact root",
              request: "Prove facts",
              time_created: now,
            })
            .run()
          ProtocolStore.appendEventInTransaction({
            kind: "event",
            type: "task.execution.opened",
            aggregate: "task",
            aggregate_id: taskID,
            task_id: taskID,
            session_id: root.id,
            source: "test",
            emitted_at: now,
            payload: { execution_epoch: 1 },
          })
        })

        const first = Database.immediateTransaction((db) =>
          acceptTaskRootIngressInTransaction(db, {
            taskID,
            executionEpoch: 1,
            source: "inline",
            sourceID: "source-1",
            inlinePayload: { command: "continue" },
            semanticTurnLimit: 3,
            activationLimit: 2,
            now: now + 1,
          }),
        )
        const replay = Database.immediateTransaction((db) =>
          acceptTaskRootIngressInTransaction(db, {
            taskID,
            executionEpoch: 1,
            source: "inline",
            sourceID: "source-1",
            inlinePayload: { command: "continue" },
            semanticTurnLimit: 3,
            activationLimit: 2,
            now: now + 2,
          }),
        )
        expect({ id: replay.id, sequence: replay.sequence }).toEqual({ id: first.id, sequence: 1 })

        const lease = acquireTaskRootIngressLease({
          ingressID: first.id,
          ownerOccurrenceID: "owner-1",
          now: now + 3,
          leaseMilliseconds: 100,
        })
        expect(lease).toMatchObject({ acquired: true })
        if (!lease.acquired) throw new Error("Expected Task-root lease")
        expect(projectTaskRootIngress(first.id, now + 4)).toMatchObject({
          state: "leased",
          activationID: lease.activationID,
        })
        const second = Database.immediateTransaction((db) =>
          acceptTaskRootIngressInTransaction(db, {
            taskID,
            executionEpoch: 1,
            source: "inline",
            sourceID: "source-2",
            inlinePayload: { command: "follow-up" },
            semanticTurnLimit: 3,
            activationLimit: 2,
            now: now + 4,
          }),
        )
        expect(
          acquireTaskRootIngressLease({
            ingressID: second.id,
            ownerOccurrenceID: "owner-2",
            now: now + 5,
            leaseMilliseconds: 100,
          }),
        ).toEqual({
          acquired: false,
          projection: { state: "ready" },
          blockedByIngressID: first.id,
        })
        expect(() =>
          Database.immediateTransaction((db) =>
            assertTaskRootActivationFenceInTransaction(db, {
              ingressID: first.id,
              activationID: lease.activationID,
              now: now + 4,
            }),
          ),
        ).not.toThrow()
        expect(() =>
          Database.immediateTransaction((db) =>
            acceptTaskRootIngressInTransaction(db, {
              taskID,
              executionEpoch: 2,
              source: "inline",
              sourceID: "source-1",
              inlinePayload: { command: "continue" },
              semanticTurnLimit: 3,
              activationLimit: 2,
              now: now + 6,
            }),
          ),
        ).toThrow("already accepted in epoch 1")
      },
    })
  })
})
