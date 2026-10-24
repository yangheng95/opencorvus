import { afterEach, expect, test } from "bun:test"
import z from "zod"
import { Bus } from "@/bus"
import { BusEvent } from "@/bus/bus-event"
import { Instance } from "@/project/instance"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { PublicationRead } from "@/bus/publication-read"
import { BusPublicationDeliveryReceiptTable, BusPublicationOwnerTable } from "@/bus/bus.sql"
import { Database, eq } from "@/storage/db"
import { Project } from "@/project/project"
import { deleteProject } from "@/project/delete"

const Source = BusEvent.define("test.bus.original-owner", z.object({ value: z.string() }))

afterEach(async () => {
  await Instance.disposeAll()
  await Bus.TestHooks.disposeOwnedState()
  await resetMemoryDatabase()
})

test("ordinary exact publication reuses only the complete immutable Project and directory owner", async () => {
  await using first = await memoryProject()
  await using second = await memoryProject()
  await Instance.provide({
    directory: first.path,
    fn: () => {
      Bus.publishOwnedExact(Source, { value: "original" }, "one-owned-original-source")
    },
  })
  await Instance.provide({
    directory: second.path,
    fn: () => {
      expect(() => Bus.publishOwnedExact(Source, { value: "original" }, "one-owned-original-source")).toThrow(
        "conflicting immutable input",
      )
    },
  })
}, 60_000)

test("retired original generation receives an actual host disposition and retains complete paged source bytes", async () => {
  await using fixture = await memoryProject()
  const registered = await Project.fromDirectory(fixture.path)
  const value = "原始来源🪶".repeat(2400)
  let publication!: Bus.Publication
  await Instance.provide({
    directory: fixture.path,
    fn: () => {
      publication = Bus.publishOwnedExact(Source, { value }, "retired-source-with-no-delivery-registration")
    },
  })
  const original = Database.use((db) =>
    db
      .select()
      .from(BusPublicationOwnerTable)
      .where(eq(BusPublicationOwnerTable.occurrence_id, publication.occurrenceID))
      .get(),
  )!
  const receipt = await deleteProject(registered.project, {
    actor: "user",
    source: "project.delete",
    surface: "api",
    requestID: "owner-test-delete",
    reason: "Isolated original owner lifecycle test",
  })
  expect(receipt.status).toBe("committed")
  const recreated = await Project.fromDirectory(fixture.path)
  expect(recreated.project.id).toBe(registered.project.id)
  expect(new Set([original.project_generation, recreated.generation]).size).toBe(2)
  await publication.retry()
  expect(
    Database.use((db) =>
      db
        .select({
          subscriber: BusPublicationDeliveryReceiptTable.subscriber_id,
          outcome: BusPublicationDeliveryReceiptTable.outcome,
          error: BusPublicationDeliveryReceiptTable.error,
        })
        .from(BusPublicationDeliveryReceiptTable)
        .where(eq(BusPublicationDeliveryReceiptTable.occurrence_id, publication.occurrenceID))
        .all(),
    ),
  ).toEqual([
    {
      subscriber: "host:bus-publication-owner",
      outcome: "ignored",
      error: "BUS_PUBLICATION_OWNER_RETIRED: original source retained for review",
    },
  ])
  const bytes: Buffer[] = []
  let offset = 0
  for (;;) {
    const page = PublicationRead.read({
      projectID: registered.project.id,
      occurrenceID: publication.occurrenceID,
      byteOffset: offset,
    })
    bytes.push(Buffer.from(page.body.data, "base64"))
    if (page.body.nextByteOffset === null) break
    offset = page.body.nextByteOffset
  }
  expect(JSON.parse(Buffer.concat(bytes).toString("utf8"))).toEqual({ value })
  expect(
    PublicationRead.list({ projectID: registered.project.id }).sources.find(
      (row) => row.occurrenceID === publication.occurrenceID,
    )?.generation,
  ).toBe(original.project_generation)
  expect(
    PublicationRead.read({
      projectID: registered.project.id,
      occurrenceID: publication.occurrenceID,
      section: "phases",
    }).facts.map((row) => row.phase),
  ).toEqual(["exact", "global", "wildcard"])
}, 60_000)
