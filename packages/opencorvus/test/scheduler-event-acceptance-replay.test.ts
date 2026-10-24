import { afterEach, expect, test } from "bun:test"
import z from "zod"
import { Bus } from "@/bus"
import { BusEvent } from "@/bus/bus-event"
import { BusPublicationDeliveryReceiptTable } from "@/bus/bus.sql"
import { Instance } from "@/project/instance"
import { EventService } from "@/scheduler/event-service"
import { EventJobFireTable, EventOccurrenceTable } from "@/scheduler/event.sql"
import { SessionWake } from "@/session/wake"
import { Database, eq } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const Source = BusEvent.define("test.event.acceptance-replay", z.object({ value: z.string() }))

afterEach(async () => {
  await Instance.disposeAll()
  await Bus.TestHooks.disposeOwnedState()
  await resetMemoryDatabase()
})

test("a recovered Event publication keeps its original accepted Fire set after new definitions are created", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const original = await EventService.create({
        name: "Original registered consumer",
        eventType: Source.type,
        prompt: "Original event",
        projectId: Instance.project.id,
      })
      EventService.init({ sessionWake: SessionWake })
      const publication = Bus.publishOwnedExact(Source, { value: "original" }, "event-accepted-before-receipt")
      {
        using cut = EventService.TestHooks.installFireAcceptedHook(() => {
          throw new Error("ACCEPTED_FIRE_BEFORE_BUS_RECEIPT")
        })
        const failure = await publication.retry().catch((error: unknown) => error)
        expect(failure).toBeInstanceOf(Error)
      }
      expect(
        Database.use((db) =>
          db
            .select({
              phase: BusPublicationDeliveryReceiptTable.phase,
              subscriberID: BusPublicationDeliveryReceiptTable.subscriber_id,
              outcome: BusPublicationDeliveryReceiptTable.outcome,
              error: BusPublicationDeliveryReceiptTable.error,
            })
            .from(BusPublicationDeliveryReceiptTable)
            .where(eq(BusPublicationDeliveryReceiptTable.occurrence_id, publication.occurrenceID))
            .all(),
        ).filter((row) => row.subscriberID === "scheduler.event-service"),
      ).toEqual([
        {
          phase: "wildcard",
          subscriberID: "scheduler.event-service",
          outcome: "failed",
          error: "ACCEPTED_FIRE_BEFORE_BUS_RECEIPT",
        },
      ])
      const accepted = Database.use((db) =>
        db
          .select()
          .from(EventJobFireTable)
          .where(eq(EventJobFireTable.event_occurrence_id, publication.occurrenceID))
          .all(),
      )
      expect(accepted.map((row) => row.definition_id)).toEqual([original.id])
      await EventService.create({
        name: "Later registered consumer",
        eventType: Source.type,
        prompt: "Only new events belong to this definition",
        projectId: Instance.project.id,
      })
      await publication.retry()
      const replayed = Database.use((db) =>
        db
          .select()
          .from(EventJobFireTable)
          .where(eq(EventJobFireTable.event_occurrence_id, publication.occurrenceID))
          .all(),
      )
      expect(replayed).toEqual(accepted)
      expect(
        Database.use((db) =>
          db
            .select({ outcome: BusPublicationDeliveryReceiptTable.outcome })
            .from(BusPublicationDeliveryReceiptTable)
            .where(eq(BusPublicationDeliveryReceiptTable.occurrence_id, publication.occurrenceID))
            .all(),
        ).map((row) => row.outcome),
      ).toContain("succeeded")
    },
  })
}, 60_000)

test("durable empty acceptance freezes its original set across a receipt gap and admits a later independent source", async () => {
  await using fixture = await memoryProject()
  await Instance.provide({
    directory: fixture.path,
    fn: async () => {
      EventService.init({ sessionWake: SessionWake })
      const original = Bus.publishOwnedExact(
        Source,
        { value: "before registration" },
        "durable-empty-before-registration",
      )
      {
        using cut = EventService.TestHooks.installOccurrenceAcceptedHook((input) => {
          if (input.occurrenceID === original.occurrenceID) throw new Error("EMPTY_ACCEPTANCE_BEFORE_RECEIPT")
        })
        const failure = await original.retry().catch((error: unknown) => error)
        expect(failure).toBeInstanceOf(Error)
      }
      const accepted = Database.use((db) =>
        db.select().from(EventOccurrenceTable).where(eq(EventOccurrenceTable.id, original.occurrenceID)).get(),
      )!
      expect({ source: accepted.bus_outbox_id, identity: accepted.id }).toEqual({
        source: original.occurrenceID,
        identity: original.occurrenceID,
      })
      const job = await EventService.create({
        name: "New consumer",
        eventType: Source.type,
        prompt: "Only fresh source",
        projectId: Instance.project.id,
      })
      await original.retry()
      const next = Bus.publishOwnedExact(Source, { value: "new independent source" }, "durable-new-after-registration")
      {
        using stopAfterAccept = EventService.TestHooks.installFireAcceptedHook(() => {
          EventService.remove(job.id, Instance.project.id)
        })
        await next.retry()
      }
      await EventService.TestHooks.waitForIdle()
      const fires = Database.use((db) =>
        db
          .select({
            source: EventJobFireTable.event_occurrence_id,
            definition: EventJobFireTable.definition_id,
            generation: EventJobFireTable.project_generation,
          })
          .from(EventJobFireTable)
          .all(),
      )
      expect(fires).toEqual([{ source: next.occurrenceID, definition: job.id, generation: Instance.projectGeneration }])
      expect(
        Database.use((db) =>
          db.select().from(EventOccurrenceTable).where(eq(EventOccurrenceTable.id, original.occurrenceID)).get(),
        ),
      ).toEqual(accepted)
    },
  })
}, 60_000)
