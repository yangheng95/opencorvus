import { afterEach, expect, test } from "bun:test"
import path from "node:path"
import { commitDeliveryTransaction } from "../src/bus/delivery-transaction"
import { Identifier } from "../src/id/id"
import { ProjectTable } from "../src/project/project.sql"
import { Database, eq, inArray } from "../src/storage/db"
import { resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => { await resetMemoryDatabase() })

function row(label: string) {
  return {
    id: Identifier.ascending("project"),
    worktree: path.join(process.env.OPENCORVUS_TEST_PROCESS_ROOT!, label),
    generation: crypto.randomUUID(), sandboxes: [], time_created: 1, time_updated: 1,
  }
}

test("queued delivery writes return their exact committed rows across bounded batches", async () => {
  const rows = Array.from({ length: 600 }, (_, index) => row(`delivery-${index}`))
  const results = await Promise.all(rows.map((value) => commitDeliveryTransaction((db) => {
    db.insert(ProjectTable).values(value).run()
    return { id: value.id, worktree: value.worktree }
  }).then((result) => ({ result, stored: Database.use(db => db.select({ id: ProjectTable.id, worktree: ProjectTable.worktree })
    .from(ProjectTable).where(eq(ProjectTable.id, result.id)).get()) }))))
  expect(results).toEqual(rows.map(({ id, worktree }) => ({ result: { id, worktree }, stored: { id, worktree } })))
})

test("a rejected delivery rolls back its savepoint while adjacent deliveries commit", async () => {
  const [first, rejected, last] = [row("first"), row("rejected"), row("last")]
  const error = new Error("delivery input identity conflict")
  const results = await Promise.allSettled([first!, rejected!, last!].map(value => commitDeliveryTransaction(db => {
    db.insert(ProjectTable).values(value).run()
    if (value.id === rejected!.id) throw error
    return value.id
  })))
  expect(results).toEqual([
    { status: "fulfilled", value: first!.id },
    { status: "rejected", reason: error },
    { status: "fulfilled", value: last!.id },
  ])
  expect(Database.use(db => db.select({ id: ProjectTable.id }).from(ProjectTable)
    .where(inArray(ProjectTable.id, [first!.id, rejected!.id, last!.id])).orderBy(ProjectTable.id).all()))
    .toEqual([first!.id, last!.id].sort().map(id => ({ id })))
})

test("a source transaction receives the explicit retired-context admission error", () => {
  expect(() => Database.immediateTransaction(() => commitDeliveryTransaction(() => 1)))
    .toThrow("Bus delivery writes require the source database context to be retired")
})
