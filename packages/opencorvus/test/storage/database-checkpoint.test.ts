import { afterEach, expect, test } from "bun:test"
import { Database as SQLite } from "bun:sqlite"
import fs from "node:fs"
import path from "node:path"
import { Database, DatabaseUnavailableError, eq } from "../../src/storage/db"
import { startCheckpoint } from "../../src/storage/checkpoint-worker"
import { RuntimeExecutionSettlement } from "../../src/runtime/execution-settlement"
import { ProjectTable } from "../../src/project/project.sql"
import { resetDatabase } from "../fixture/db"

afterEach(resetDatabase)

function project(label: string, large = false) {
  return {
    id: `prj_checkpoint_${label}`,
    worktree: path.join(process.env.OPENCORVUS_TEST_PROCESS_ROOT!, label),
    generation: crypto.randomUUID(),
    sandboxes: large
      ? Array.from({ length: 1024 }, (_, index) => `来源-${index}-${"字".repeat(1500)}`)
      : [`来源-${label}`],
    time_created: 1, time_updated: 1,
  }
}

function store(value: ReturnType<typeof project>) {
  Database.immediateTransaction(db => db.insert(ProjectTable).values(value).run())
}

function mainFileRows() {
  // Read only the main file, so this still proves the checkpoint copied its WAL pages.
  const snapshot = fs.readFileSync(Database.Path())
  snapshot[18] = 1
  snapshot[19] = 1
  const reader = SQLite.deserialize(snapshot, { readonly: true })
  try {
    const statement = reader.prepare("SELECT id, worktree, generation, sandboxes FROM project ORDER BY id")
    try {
      return (statement.all() as Array<{ id: string; worktree: string; generation: string; sandboxes: string }>)
        .map(row => ({ ...row, sandboxes: JSON.parse(row.sandboxes) }))
    } finally { statement.finalize() }
  } finally {
    reader.close(true)
  }
}

function expected(values: ReturnType<typeof project>[]) {
  return values.map(({ id, worktree, generation, sandboxes }) => ({ id, worktree, generation, sandboxes }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

async function waitFor(observe: () => boolean) {
  const deadline = Date.now() + 10_000
  while (!observe()) {
    if (Date.now() > deadline) throw new Error("Checkpoint observation made no progress for 10000ms")
    await Bun.sleep(25)
  }
}

function mainFileBackfilled() {
  // SQLite's native-endian WAL-index header exposes the committed frame count
  // at byte 16 and the completed backfill at byte 96. These tests have one
  // writer and stop writing before waiting, so a complete backfill is stable.
  const bytes = new Uint32Array(25)
  const fd = fs.openSync(`${Database.Path()}-shm`, "r")
  try {
    // Read only the header, outside Windows' SQLite byte-lock region.
    fs.readSync(fd, bytes, 0, 100, 0)
    return bytes[4] > 0 && bytes[24] === bytes[4]
  } finally { fs.closeSync(fd) }
}

test("the production checkpoint owner writes exact committed rows into the main database file", async () => {
  Database.Client()
  expect(Database.allFinalized("PRAGMA wal_autocheckpoint")).toEqual([{ wal_autocheckpoint: 0 }])
  expect(Database.allFinalized("PRAGMA synchronous")).toEqual([{ synchronous: 1 }])
  const value = project("periodic", true)
  store(value)
  await waitFor(mainFileBackfilled)
  expect(mainFileRows()).toEqual(expected([value]))
}, 30_000)

test("a held reader keeps its original snapshot and the owner checkpoints the complete new value after release", async () => {
  const before = project("reader")
  store(before)
  Database.checkpointTruncate()
  const reader = new SQLite(Database.Path(), { readonly: true })
  const query = reader.prepare("SELECT sandboxes FROM project WHERE id=?")
  const after = { ...before, sandboxes: project("updated", true).sandboxes }
  try {
    reader.exec("BEGIN")
    expect(query.get(before.id)).toEqual({ sandboxes: JSON.stringify(before.sandboxes) })
    Database.immediateTransaction(db => db.update(ProjectTable).set({ sandboxes: after.sandboxes })
      .where(eq(ProjectTable.id, before.id)).run())
    await Bun.sleep(1250)
    expect(query.get(before.id)).toEqual({ sandboxes: JSON.stringify(before.sandboxes) })
    reader.exec("COMMIT")
  } finally { query.finalize(); reader.close(true) }
  await waitFor(mainFileBackfilled)
  expect(mainFileRows()).toEqual(expected([after]))
}, 30_000)

test("close, reopen and reset each retain the exact data of their physical connection", async () => {
  const first = project("first")
  store(first)
  Database.close()
  expect(mainFileRows()).toEqual(expected([first]))
  Database.Client()
  const second = project("second", true)
  store(second)
  await waitFor(mainFileBackfilled)
  expect(mainFileRows()).toEqual(expected([first, second]))

  await Database.resetFiles(Database.Path())
  Database.Client()
  const third = project("third", true)
  store(third)
  await waitFor(mainFileBackfilled)
  expect(mainFileRows()).toEqual(expected([third]))
}, 30_000)

test("a worker releases its SQLite connection before synchronous handback and reports its actual exit result", async () => {
  const value = project("handback", true)
  store(value)
  const job = startCheckpoint(Database.Path())
  job.release()
  const result = await job.exited
  expect(result).toMatchObject({ busy: 0, checkpointed: result.log })
  expect(result.log).toBeGreaterThan(1000)
  expect(mainFileRows()).toEqual(expected([value]))
  Database.close()
  expect(Database.use(db => db.select({ id: ProjectTable.id }).from(ProjectTable).all())).toEqual([{ id: value.id }])
}, 30_000)

test("a worker preserves the actual invalid database code and releases the file for replacement", async () => {
  const filename = path.join(process.env.OPENCORVUS_TEST_PROCESS_ROOT!, "invalid-checkpoint.db")
  fs.writeFileSync(filename, "invalid SQLite bytes".repeat(1024))
  const job = startCheckpoint(filename)
  expect(job.release()).toMatchObject({ code: "SQLITE_NOTADB" })
  await expect(job.exited).rejects.toMatchObject({ code: "SQLITE_NOTADB" })
  fs.unlinkSync(filename)
  const restored = new SQLite(filename, { create: true })
  try {
    restored.exec("CREATE TABLE restored (value TEXT); INSERT INTO restored VALUES ('恢复成功')")
    const query = restored.prepare("SELECT value FROM restored")
    try { expect(query.all()).toEqual([{ value: "恢复成功" }]) } finally { query.finalize() }
  } finally { restored.close(true); fs.unlinkSync(filename) }
}, 30_000)

test("the production owner exposes the actual checkpoint failure and formal reset restores exact writes", async () => {
  store(project("before-corruption"))
  Database.checkpointTruncate()
  const relative = path.relative(process.env.OPENCORVUS_TEST_PROCESS_ROOT!, Database.Path())
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Isolated test database required")
  const fd = fs.openSync(Database.Path(), "r+")
  try { fs.writeSync(fd, Buffer.from("invalid header!!"), 0, 16, 0) } finally { fs.closeSync(fd) }
  await waitFor(() => Database.unavailable() !== undefined)
  expect(Database.unavailable()).toMatchObject({ code: "SQLITE_NOTADB", operation: "Database.checkpoint" })
  let failure: unknown
  try { Database.Client() } catch (error) { failure = error }
  expect(DatabaseUnavailableError.isInstance(failure) ? failure.data : undefined)
    .toMatchObject({ code: "SQLITE_NOTADB", operation: "Database.checkpoint" })
  await resetDatabase()
  const value = project("after-reset")
  store(value)
  expect(Database.use(db => db.select({ id: ProjectTable.id, sandboxes: ProjectTable.sandboxes }).from(ProjectTable).all()))
    .toEqual([{ id: value.id, sandboxes: value.sandboxes }])
}, 30_000)

test("server settlement joins a real checkpoint exit and rollback resumes the production cadence", async () => {
  const { Server } = await import("../../src/server/server")
  const first = project("runtime-first", true)
  store(first)
  const events: string[] = []
  const owner = RuntimeExecutionSettlement.reserve("database_checkpoint", "actual-worker-at-runtime-shutdown")
  const job = startCheckpoint(Database.Path())
  owner.settleWith(job.exited.then(() => { events.push("worker-exited") }))
  let admission: unknown
  const settled = await Server.settleCurrentProcessExecution("checkpoint shutdown contract", {
    disposeInstances: async () => {},
    onRuntimeCancellationRequested() {
      try {
        const late = RuntimeExecutionSettlement.reserve("database_checkpoint", "late-checkpoint")
        late.settle()
        admission = "accepted"
      } catch (error) { admission = error }
    },
  })
  try {
    events.push("server-settled")
    expect(events).toEqual(["worker-exited", "server-settled"])
    expect(admission).toMatchObject({ name: "RuntimeExecutionAdmissionClosedError", kind: "database_checkpoint" })
    expect(mainFileRows()).toEqual(expected([first]))
  } finally { await settled.releaseHandoff(false) }
  const second = project("runtime-restored")
  store(second)
  await waitFor(mainFileBackfilled)
  expect(mainFileRows()).toEqual(expected([first, second]))
  const completed = await Server.settleCurrentProcessExecution("checkpoint committed handoff", {
    disposeInstances: async () => {},
  })
  await completed.releaseHandoff()
  const third = project("runtime-successor")
  store(third)
  await waitFor(mainFileBackfilled)
  expect(mainFileRows()).toEqual(expected([first, second, third]))
}, 30_000)
