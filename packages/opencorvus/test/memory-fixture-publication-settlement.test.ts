import { afterEach, expect, test } from "bun:test"
import z from "zod"
import { Bus } from "@/bus"
import { BusEvent } from "@/bus/bus-event"
import { BusPublicationOutboxTable } from "@/bus/bus.sql"
import { Instance } from "@/project/instance"
import { Database, eq } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const Source = BusEvent.define("test.memory-fixture.publication", z.object({ value: z.string() }))

afterEach(resetMemoryDatabase)

test("fixture retirement retains original durable input and admits the next Project's exact publication", async () => {
  let original!: { occurrenceID: string; projectID: string; directory: string }
  const attempted: string[] = []
  {
    await using first = await memoryProject("publication-retirement-first")
    await Instance.provideProjectIdentity({
      directory: first.path,
      fn: async () => {
        Bus.subscribe(
          Source,
          ({ properties }) => {
            attempted.push(properties.value)
            throw new Error("Original subscriber unavailable")
          },
          {
            durableID: "test.memory-fixture.original",
            effect: "idempotent_by_occurrence",
          },
        )
        const publication = Bus.publishOwned(Source, { value: "original durable input" })
        original = { occurrenceID: publication.occurrenceID, projectID: Instance.project.id, directory: first.path }
        await expect(publication.retry()).rejects.toThrow(`Durable Bus publication failed for ${Source.type}`)
        expect(attempted[0]).toBe("original durable input")
      },
    })
  }
  expect(
    Database.use((db) =>
      db
        .select()
        .from(BusPublicationOutboxTable)
        .where(eq(BusPublicationOutboxTable.occurrence_id, original.occurrenceID))
        .get(),
    ),
  ).toMatchObject({
    occurrence_id: original.occurrenceID,
    project_id: original.projectID,
    directory: original.directory,
    event_type: Source.type,
    properties: { value: "original durable input" },
  })
  await using second = await memoryProject("publication-retirement-second")
  const received: string[] = []
  await Instance.provideProjectIdentity({
    directory: second.path,
    fn: async () => {
      Bus.subscribe(
        Source,
        ({ properties }) => {
          received.push(properties.value)
        },
        {
          durableID: "test.memory-fixture.next",
          effect: "idempotent_by_occurrence",
        },
      )
      const publication = Bus.publishOwned(Source, { value: "next Project input" })
      await publication.retry()
    },
  })
  expect(received).toEqual(["next Project input"])
}, 60_000)
