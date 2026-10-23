import { afterEach, expect, test } from "bun:test"
import { Database as SQLite } from "bun:sqlite"
import fs from "node:fs"
import path from "node:path"
import {
  migrateSchema,
  schemaVersion,
  SchemaMigrationError,
  type SchemaMigration,
} from "../../src/storage/schema-migration"
import { readSchemaObjectShape } from "../../src/storage/schema-contract"
import { Database, DatabaseUnavailableError } from "../../src/storage/db"
import { SCHEMA_DDL } from "../../src/storage/ddl"
import { DATABASE_MIGRATIONS } from "../../src/storage/migrations"
import { resetDatabase, createTestDatabase, editTestDatabase } from "../fixture/db"

afterEach(resetDatabase)

const first = 'CREATE TABLE "note" ("id" TEXT PRIMARY KEY, "body" TEXT NOT NULL, "bytes" BLOB);'
const second =
  'CREATE TABLE "note" ("id" TEXT PRIMARY KEY, "body" TEXT NOT NULL, "bytes" BLOB, "priority" INTEGER NOT NULL DEFAULT 3); CREATE INDEX "note_body" ON "note"("body");'

function read<T = any>(sqlite: SQLite, sql: string): T[] {
  const statement = sqlite.query(sql)
  try {
    return statement.all() as T[]
  } finally {
    statement.finalize()
  }
}

function fixture(ddl = first, version = 1) {
  const root = process.env.OPENCORVUS_TEST_PROCESS_ROOT
  if (!root) throw new Error("Migration tests require the isolated test runtime")
  const directory = fs.mkdtempSync(path.join(root, "sqlite-migration-"))
  const databasePath = path.join(directory, "history.db")
  const sqlite = new SQLite(databasePath)
  sqlite.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000")
  sqlite.exec(ddl)
  sqlite.exec(`PRAGMA user_version = ${version}`)
  return {
    sqlite,
    databasePath,
    directory,
    [Symbol.dispose]() {
      this.sqlite.close(true)
      fs.rmSync(directory, { recursive: true, force: true })
    },
  }
}

function run(value: ReturnType<typeof fixture>, migrations: SchemaMigration[], validate = () => {}) {
  return migrateSchema({ ...value, migrations, currentDDL: migrations.at(-1)!.ddl, validate })
}

test("the immutable migration target constructs the current application schema", () => {
  using value = fixture(SCHEMA_DDL)
  const reference = new SQLite(":memory:")
  try {
    reference.exec(DATABASE_MIGRATIONS.at(-1)!.ddl)
    expect([...readSchemaObjectShape(reference)]).toEqual([...readSchemaObjectShape(value.sqlite)])
  } finally {
    reference.close(true)
  }
})

test("version four preserves exact historical Move facts and indexes the ownership seek", () => {
  using value = fixture(DATABASE_MIGRATIONS[2]!.ddl, 3)
  const properties = JSON.stringify({
    sourceSessionID: "source",
    info: { id: "message", sessionID: "target" },
    parts: [],
  })
  value.sqlite.run(
    "INSERT INTO bus_publication_outbox(occurrence_id,project_id,directory,event_type,properties,time_created) VALUES(?,?,?,?,?,?)",
    ["move", "project", "directory", "message.moved", properties, 123],
  )
  const removed = JSON.stringify({ sessionID: "source", messageID: "message", partID: "part", partType: "text" })
  value.sqlite.run(
    "INSERT INTO bus_publication_outbox(occurrence_id,project_id,directory,event_type,properties,time_created) VALUES(?,?,?,?,?,?)",
    ["remove", "project", "directory", "message.part.removed", removed, 122],
  )
  const result = run(value, [...DATABASE_MIGRATIONS])
  const query = `SELECT occurrence_id,properties FROM bus_publication_outbox WHERE project_id='project' AND event_type='message.moved' AND json_extract(properties,'$.info.id')='message' AND json_extract(properties,'$.sourceSessionID')='source' AND json_extract(properties,'$.info.sessionID')='target'`
  expect({
    from: result.from,
    to: result.to,
    version: schemaVersion(value.sqlite),
    facts: read(value.sqlite, query),
  }).toEqual({
    from: 3,
    to: 4,
    version: 4,
    facts: [{ occurrence_id: "move", properties }],
  })
  expect(read(value.sqlite, `EXPLAIN QUERY PLAN ${query}`)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ detail: expect.stringContaining("bus_publication_outbox_message_move_idx") }),
    ]),
  )
  const removalQuery = `SELECT occurrence_id,properties FROM bus_publication_outbox WHERE project_id='project' AND event_type='message.part.removed' AND json_extract(properties,'$.messageID')='message' AND json_extract(properties,'$.sessionID')='source' AND json_extract(properties,'$.partID')='part' AND json_extract(properties,'$.partType')='text'`
  expect(read(value.sqlite, removalQuery)).toEqual([{ occurrence_id: "remove", properties: removed }])
  expect(read(value.sqlite, `EXPLAIN QUERY PLAN ${removalQuery}`)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ detail: expect.stringContaining("bus_publication_outbox_part_removal_idx") }),
    ]),
  )
})

test("the production opener creates and reopens the current database version and identity", async () => {
  await createTestDatabase()
  const identity = Database.Identity()
  expect(Database.allFinalized("PRAGMA user_version")).toEqual([{ user_version: DATABASE_MIGRATIONS.at(-1)!.version }])
  Database.close()
  expect(Database.Identity()).toBe(identity)
})

test("a cached WAL reader keeps the original version until its real close permits the upgrade", () => {
  using value = fixture()
  value.sqlite.exec("INSERT INTO note(id,body) VALUES('owner','original')")
  const reader = new SQLite(value.databasePath, { readonly: true })
  try {
    expect({ version: schemaVersion(reader), rows: read(reader, "SELECT id,body FROM note") }).toEqual({
      version: 1,
      rows: [{ id: "owner", body: "original" }],
    })
    value.sqlite.exec("PRAGMA busy_timeout=20")
    expect(() =>
      run(value, [
        { version: 1, name: "baseline", ddl: first },
        { version: 2, name: "priority", ddl: second },
      ]),
    ).toThrow(expect.objectContaining({ code: "SQLITE_BUSY" }))
    expect({
      version: schemaVersion(value.sqlite),
      mode: read(value.sqlite, "PRAGMA main.locking_mode"),
      rows: read(reader, "SELECT id,body FROM note"),
    }).toEqual({
      version: 1,
      mode: [{ locking_mode: "normal" }],
      rows: [{ id: "owner", body: "original" }],
    })
  } finally {
    reader.close(true)
  }
  const result = run(value, [
    { version: 1, name: "baseline", ddl: first },
    { version: 2, name: "priority", ddl: second },
  ])
  const reopened = new SQLite(value.databasePath, { readonly: true })
  try {
    expect({
      from: result.from,
      to: result.to,
      version: schemaVersion(reopened),
      rows: read(reopened, "SELECT id,body,priority FROM note"),
    }).toEqual({
      from: 1,
      to: 2,
      version: 2,
      rows: [{ id: "owner", body: "original", priority: 3 }],
    })
    expect(read(value.sqlite, "PRAGMA main.locking_mode")).toEqual([{ locking_mode: "normal" }])
  } finally {
    reopened.close(true)
  }
})

test("a file in rollback journal mode returns the precise migration maintenance contract", () => {
  using value = fixture()
  value.sqlite.exec("PRAGMA journal_mode=DELETE; INSERT INTO note(id,body) VALUES('rollback','retained')")
  expect(() =>
    run(value, [
      { version: 1, name: "baseline", ddl: first },
      { version: 2, name: "priority", ddl: second },
    ]),
  ).toThrow(expect.objectContaining({ code: "SCHEMA_MIGRATION_REQUIRED" }))
  expect({
    version: schemaVersion(value.sqlite),
    journal: read(value.sqlite, "PRAGMA journal_mode"),
    rows: read(value.sqlite, "SELECT id,body FROM note"),
  }).toEqual({
    version: 1,
    journal: [{ journal_mode: "delete" }],
    rows: [{ id: "rollback", body: "retained" }],
  })
})

test("the production opener diagnoses a pre-baseline database and retains its physical identity", async () => {
  await createTestDatabase()
  const identity = Database.Identity()
  editTestDatabase((sqlite) => sqlite.exec("PRAGMA user_version=0"))
  let error: unknown
  try {
    Database.Client()
  } catch (caught) {
    error = caught
  }
  expect(DatabaseUnavailableError.isInstance(error) ? error.data : undefined).toMatchObject({
    code: "SCHEMA_BASELINE_REQUIRED",
    operation: "Database.Client.schemaMigration",
  })
  editTestDatabase((sqlite) => {
    expect(schemaVersion(sqlite)).toBe(0)
    sqlite.exec(`PRAGMA user_version=${DATABASE_MIGRATIONS.at(-1)!.version}`)
  })
  expect(Database.Identity()).toBe(identity)
})

test("sequential revisions retain rowid, Unicode text and binary values while adding a required default", () => {
  using value = fixture()
  value.sqlite.run('INSERT INTO "note" (rowid,id,body,bytes) VALUES (41,?,?,?)', [
    "n1",
    "来源与历史",
    Buffer.from([0, 127, 255]),
  ])
  const receipt = run(value, [
    { version: 1, name: "initial", ddl: first },
    { version: 2, name: "priority", ddl: second },
  ])
  expect({ from: receipt.from, to: receipt.to, version: schemaVersion(value.sqlite) }).toEqual({
    from: 1,
    to: 2,
    version: 2,
  })
  expect(read(value.sqlite, 'SELECT rowid,id,body,bytes,priority FROM "note"')).toEqual([
    { rowid: 41, id: "n1", body: "来源与历史", bytes: Buffer.from([0, 127, 255]), priority: 3 },
  ])
  expect(read(value.sqlite, "SELECT name FROM sqlite_schema WHERE type='index' AND name='note_body'")).toEqual([
    { name: "note_body" },
  ])
  const backup = new SQLite(receipt.backupPath!, { readonly: true })
  try {
    expect(read(backup, 'SELECT rowid,id,body,bytes FROM "note"')).toEqual([
      { rowid: 41, id: "n1", body: "来源与历史", bytes: Buffer.from([0, 127, 255]) },
    ])
    expect(schemaVersion(backup)).toBe(1)
  } finally {
    backup.close(true)
  }
  expect(
    run(value, [
      { version: 1, name: "initial", ddl: first },
      { version: 2, name: "priority", ddl: second },
    ]),
  ).toEqual({ from: 2, to: 2 })
})

test("an explicit version migration renames the original field before reaching the new canonical table", () => {
  using value = fixture(first, 1)
  value.sqlite.run('INSERT INTO "note" (id,body) VALUES (?,?)', ["rename", "原始正文"])
  const target = first.replace('"body"', '"content"')
  run(value, [
    { version: 1, name: "initial", ddl: first },
    {
      version: 2,
      name: "rename-body",
      ddl: target,
      migrate: (sqlite) => {
        sqlite.exec('ALTER TABLE "note" RENAME COLUMN "body" TO "content"')
      },
    },
  ])
  expect(read(value.sqlite, 'SELECT id,content FROM "note"')).toEqual([{ id: "rename", content: "原始正文" }])
  expect(schemaVersion(value.sqlite)).toBe(2)
})

test("the complete current baseline advances to a declared revision with its real objects and identity retained", async () => {
  await createTestDatabase()
  const identity = Database.Identity()
  const databasePath = Database.Path()
  Database.close()
  const sqlite = new SQLite(databasePath)
  const addition = 'CREATE TABLE "migration_receipt" ("id" TEXT PRIMARY KEY, "body" TEXT NOT NULL);'
  const target = SCHEMA_DDL + addition
  const fromVersion = DATABASE_MIGRATIONS.at(-1)!.version
  const nextVersion = fromVersion + 1
  try {
    const result = migrateSchema({
      sqlite,
      databasePath,
      currentDDL: target,
      migrations: [
        ...DATABASE_MIGRATIONS,
        {
          version: nextVersion,
          name: "future-receipt",
          ddl: target,
          migrate(db) {
            db.exec(addition)
            db.exec("INSERT INTO migration_receipt(id,body) VALUES('future','retained authority')")
          },
        },
      ],
      validate() {
        expect(read(sqlite, "SELECT id,body FROM migration_receipt")).toEqual([
          { id: "future", body: "retained authority" },
        ])
      },
    })
    expect({ from: result.from, to: result.to, version: schemaVersion(sqlite) }).toEqual({
      from: fromVersion,
      to: nextVersion,
      version: nextVersion,
    })
    const backup = new SQLite(result.backupPath!, { readonly: true })
    try {
      expect(read(sqlite, "SELECT * FROM database_authority")).toEqual(read(backup, "SELECT * FROM database_authority"))
      expect(read(backup, "SELECT instance_id FROM database_authority")).toEqual([{ instance_id: identity }])
      expect([...readSchemaObjectShape(backup)]).toEqual(
        [...readSchemaObjectShape(sqlite)].filter(([key]) => key !== "table:migration_receipt"),
      )
    } finally {
      backup.close(true)
    }
  } finally {
    sqlite.close(true)
  }
})

test("table reconstruction preserves foreign-key relationships and composite identities", () => {
  const parent = 'CREATE TABLE "parent" ("id" TEXT PRIMARY KEY, "body" TEXT NOT NULL);'
  const child =
    'CREATE TABLE "child" ("parent_id" TEXT REFERENCES "parent"("id") ON DELETE CASCADE, "seq" INTEGER, "body" TEXT, PRIMARY KEY("parent_id","seq")) WITHOUT ROWID;'
  using value = fixture(parent + child)
  value.sqlite.exec(
    "PRAGMA foreign_keys=ON; INSERT INTO parent(id,body) VALUES('p','original'); INSERT INTO child VALUES('p',2,'linked')",
  )
  const target = parent.replace('"body" TEXT NOT NULL', '"body" TEXT NOT NULL, "priority" INTEGER DEFAULT 3') + child
  run(value, [
    { version: 1, name: "relations", ddl: parent + child },
    { version: 2, name: "priority", ddl: target },
  ])
  expect(
    read(
      value.sqlite,
      "SELECT parent.id,parent.priority,child.seq,child.body FROM parent JOIN child ON child.parent_id=parent.id",
    ),
  ).toEqual([{ id: "p", priority: 3, seq: 2, body: "linked" }])
  expect(read(value.sqlite, "PRAGMA foreign_keys")).toEqual([{ foreign_keys: 1 }])
})

test("a new trigger enforces its declared current write contract after upgrading existing rows", () => {
  using value = fixture()
  value.sqlite.run('INSERT INTO "note" (id,body) VALUES (?,?)', ["retained", "original"])
  const target =
    first +
    `CREATE TRIGGER "note_body_required" BEFORE INSERT ON "note" WHEN length(NEW.body)=0 BEGIN SELECT RAISE(ABORT,'note body is required'); END;`
  run(value, [
    { version: 1, name: "baseline", ddl: first },
    { version: 2, name: "body-rule", ddl: target },
  ])
  expect(read(value.sqlite, 'SELECT id,body FROM "note"')).toEqual([{ id: "retained", body: "original" }])
  expect(() => value.sqlite.run('INSERT INTO "note" (id,body) VALUES (?,?)', ["empty", ""])).toThrow(
    "note body is required",
  )
})

test("an unsupported field removal returns a migration contract and retains the exact original schema and values", () => {
  using value = fixture()
  value.sqlite.run('INSERT INTO "note" (id,body) VALUES (?,?)', ["retained", "Keep this history"])
  const before = [...readSchemaObjectShape(value.sqlite)]
  let error: unknown
  try {
    run(value, [
      { version: 1, name: "baseline", ddl: first },
      { version: 2, name: "lossy", ddl: 'CREATE TABLE "note" ("id" TEXT PRIMARY KEY);' },
    ])
  } catch (caught) {
    error = caught
  }
  expect(error).toMatchObject({
    name: "SchemaMigrationError",
    code: "SCHEMA_MIGRATION_REQUIRED",
    backupPath: expect.any(String),
  })
  expect([...readSchemaObjectShape(value.sqlite)]).toEqual(before)
  expect(read(value.sqlite, 'SELECT id,body FROM "note"')).toEqual([{ id: "retained", body: "Keep this history" }])
  expect(schemaVersion(value.sqlite)).toBe(1)
})

test("a failed new uniqueness constraint rolls back every pending revision and leaves a usable backup", () => {
  using value = fixture()
  value.sqlite.exec(`INSERT INTO "note" (id,body) VALUES ('a','same'),('b','same')`)
  const before = [...readSchemaObjectShape(value.sqlite)]
  let error: unknown
  try {
    run(value, [
      { version: 1, name: "baseline", ddl: first },
      { version: 2, name: "priority", ddl: second },
      { version: 3, name: "unique", ddl: second + 'CREATE UNIQUE INDEX "note_unique" ON "note"("body");' },
    ])
  } catch (caught) {
    error = caught
  }
  const backupPath = (error as SchemaMigrationError).backupPath
  expect({ code: (error as SchemaMigrationError).code, backupPath }).toMatchObject({
    code: "SCHEMA_MIGRATION_FAILED",
    backupPath: expect.any(String),
  })
  expect([...readSchemaObjectShape(value.sqlite)]).toEqual(before)
  expect(read(value.sqlite, 'SELECT id,body FROM "note" ORDER BY id')).toEqual([
    { id: "a", body: "same" },
    { id: "b", body: "same" },
  ])
  expect(schemaVersion(value.sqlite)).toBe(1)
  const backup = new SQLite(backupPath!, { readonly: true })
  try {
    expect(read(backup, 'SELECT id,body FROM "note" ORDER BY id')).toEqual(
      read(value.sqlite, 'SELECT id,body FROM "note" ORDER BY id'),
    )
  } finally {
    backup.close(true)
  }
})

test("a final data validation error rolls back structure, data and version together", () => {
  using value = fixture()
  value.sqlite.exec(`INSERT INTO "note" (id,body) VALUES ('a','original')`)
  expect(() =>
    run(
      value,
      [
        { version: 1, name: "baseline", ddl: first },
        {
          version: 2,
          name: "priority",
          ddl: second,
          migrate: (sqlite) => {
            sqlite.exec(`UPDATE note SET body='changed'`)
          },
        },
      ],
      () => {
        throw new Error("invalid application fact")
      },
    ),
  ).toThrow("invalid application fact")
  expect({ version: schemaVersion(value.sqlite), rows: read(value.sqlite, 'SELECT id,body FROM "note"') }).toEqual({
    version: 1,
    rows: [{ id: "a", body: "original" }],
  })
})

test("a newer database returns an exact version error with its committed data retained", () => {
  using value = fixture(first, 7)
  value.sqlite.exec(`INSERT INTO "note" (id,body) VALUES ('newer','history')`)
  expect(() => run(value, [{ version: 1, name: "initial", ddl: first }])).toThrow(
    expect.objectContaining({ code: "SCHEMA_VERSION_AHEAD" }),
  )
  expect({ version: schemaVersion(value.sqlite), rows: read(value.sqlite, 'SELECT id,body FROM "note"') }).toEqual({
    version: 7,
    rows: [{ id: "newer", body: "history" }],
  })
})

test("the pre-upgrade backup includes committed records still resident in the write-ahead log", () => {
  using value = fixture()
  value.sqlite.exec("PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0")
  value.sqlite.exec(`INSERT INTO "note" (id,body) VALUES ('wal','durable input')`)
  expect(fs.statSync(value.databasePath + "-wal").size).toBeGreaterThan(0)
  const result = run(value, [
    { version: 1, name: "baseline", ddl: first },
    { version: 2, name: "priority", ddl: second },
  ])
  const backup = new SQLite(result.backupPath!, { readonly: true })
  try {
    expect(read(backup, 'SELECT id,body FROM "note"')).toEqual([{ id: "wal", body: "durable input" }])
    expect(schemaVersion(backup)).toBe(1)
  } finally {
    backup.close(true)
  }
})

test("independent database files keep their own history, identities and upgrade backups", () => {
  using a = fixture()
  using b = fixture()
  a.sqlite.exec(`INSERT INTO note(id,body) VALUES('first','A')`)
  b.sqlite.exec(`INSERT INTO note(id,body) VALUES('second','B')`)
  const ma = run(a, [
    { version: 1, name: "baseline", ddl: first },
    { version: 2, name: "priority", ddl: second },
  ])
  const mb = run(b, [
    { version: 1, name: "baseline", ddl: first },
    { version: 2, name: "priority", ddl: second },
  ])
  expect([read(a.sqlite, "SELECT id,body FROM note"), read(b.sqlite, "SELECT id,body FROM note")]).toEqual([
    [{ id: "first", body: "A" }],
    [{ id: "second", body: "B" }],
  ])
  expect([path.dirname(ma.backupPath!), path.dirname(mb.backupPath!)]).toEqual([
    path.join(a.directory, "migration-backups"),
    path.join(b.directory, "migration-backups"),
  ])
})

function worker(mode: string, databasePath: string, ready: string, start: string) {
  const child = Bun.spawn(
    [
      process.execPath,
      `--config=${path.resolve(import.meta.dir, "../empty-bunfig.toml")}`,
      path.resolve(import.meta.dir, "../fixture/schema-migration-process-worker.ts"),
      mode,
      databasePath,
      ready,
      start,
    ],
    { cwd: path.resolve(import.meta.dir, "../.."), env: { ...process.env }, stdout: "pipe", stderr: "pipe" },
  )
  const output = Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  return {
    child,
    output,
    async [Symbol.asyncDispose]() {
      if (child.exitCode === null) child.kill()
      await output
    },
  }
}

async function readyFile(file: string, child: ReturnType<typeof worker>["child"]) {
  const deadline = Date.now() + 30_000
  while (!fs.existsSync(file)) {
    if (child.exitCode !== null) throw new Error(`Migration worker exited before its barrier (${child.exitCode})`)
    if (Date.now() > deadline) throw new Error("Migration worker did not reach its barrier")
    await Bun.sleep(10)
  }
}

test("two production processes reopen the same current baseline and the original database identity", async () => {
  await createTestDatabase()
  const identity = Database.Identity()
  Database.close()
  using barrier = fixture()
  const start = path.join(barrier.directory, "start")
  const readyA = path.join(barrier.directory, "a.ready")
  const readyB = path.join(barrier.directory, "b.ready")
  await using a = worker("production", Database.Path(), readyA, start)
  await using b = worker("production", Database.Path(), readyB, start)
  await Promise.all([readyFile(readyA, a.child), readyFile(readyB, b.child)])
  fs.writeFileSync(start, "start", { flag: "wx" })
  const results = await Promise.all([a.output, b.output])
  for (const [stdout, stderr, code] of results) {
    expect(code, stderr).toBe(0)
    const row = stdout.split(/\r?\n/).findLast((line) => line.startsWith("{"))!
    expect(JSON.parse(row)).toEqual({ identity, version: DATABASE_MIGRATIONS.at(-1)!.version })
  }
  expect(Database.Identity()).toBe(identity)
}, 60_000)

test("a killed migration writer recovers its original committed rows and upgrades on the next open", async () => {
  using value = fixture()
  value.sqlite.exec(`INSERT INTO note(id,body) VALUES('recover','committed')`)
  const ready = path.join(value.directory, "crash.ready")
  value.sqlite.close(true)
  await using owner = worker("crash", value.databasePath, ready, path.join(value.directory, "unused-start"))
  await readyFile(ready, owner.child)
  owner.child.kill()
  await owner.output
  value.sqlite = new SQLite(value.databasePath)
  expect({ version: schemaVersion(value.sqlite), rows: read(value.sqlite, "SELECT id,body FROM note") }).toEqual({
    version: 1,
    rows: [{ id: "recover", body: "committed" }],
  })
  const result = run(value, [
    { version: 1, name: "baseline", ddl: first },
    { version: 2, name: "recovered", ddl: first },
  ])
  expect({ from: result.from, to: result.to, rows: read(value.sqlite, "SELECT id,body FROM note") }).toEqual({
    from: 1,
    to: 2,
    rows: [{ id: "recover", body: "committed" }],
  })
}, 60_000)

test("a backup filesystem failure retains the old database and a later retry completes the same upgrade", () => {
  using value = fixture()
  value.sqlite.exec(`INSERT INTO note(id,body) VALUES('backup','retained')`)
  const blocker = path.join(value.directory, "migration-backups")
  fs.writeFileSync(blocker, "owned test barrier", { flag: "wx" })
  expect(() =>
    run(value, [
      { version: 1, name: "baseline", ddl: first },
      { version: 2, name: "priority", ddl: second },
    ]),
  ).toThrow(expect.objectContaining({ code: "SCHEMA_MIGRATION_FAILED" }))
  expect({ version: schemaVersion(value.sqlite), rows: read(value.sqlite, "SELECT id,body FROM note") }).toEqual({
    version: 1,
    rows: [{ id: "backup", body: "retained" }],
  })
  fs.unlinkSync(blocker)
  expect(
    run(value, [
      { version: 1, name: "baseline", ddl: first },
      { version: 2, name: "priority", ddl: second },
    ]),
  ).toMatchObject({
    from: 1,
    to: 2,
    backupPath: expect.any(String),
  })
  expect(read(value.sqlite, "SELECT id,body,priority FROM note")).toEqual([
    { id: "backup", body: "retained", priority: 3 },
  ])
})

test("a migration with broken references returns an integrity failure and restores the original database", () => {
  using value = fixture()
  value.sqlite.exec(`INSERT INTO note(id,body) VALUES('parent','retained')`)
  const before = [...readSchemaObjectShape(value.sqlite)]
  const child = 'CREATE TABLE "child" ("id" TEXT PRIMARY KEY, "note_id" TEXT REFERENCES "note"("id"));'
  expect(() =>
    run(value, [
      { version: 1, name: "baseline", ddl: first },
      {
        version: 2,
        name: "broken-reference",
        ddl: first + child,
        migrate: (sqlite) => {
          sqlite.exec(child)
          sqlite.exec(`INSERT INTO child(id,note_id) VALUES('c','missing')`)
        },
      },
    ]),
  ).toThrow("Foreign-key integrity failed")
  expect([...readSchemaObjectShape(value.sqlite)]).toEqual(before)
  expect({ version: schemaVersion(value.sqlite), rows: read(value.sqlite, "SELECT id,body FROM note") }).toEqual({
    version: 1,
    rows: [{ id: "parent", body: "retained" }],
  })
})

test("two first-start processes create one current database and converge on its physical identity", async () => {
  await resetDatabase()
  using barrier = fixture()
  const start = path.join(barrier.directory, "fresh.start"),
    readyA = path.join(barrier.directory, "fresh.a"),
    readyB = path.join(barrier.directory, "fresh.b")
  await using a = worker("production", Database.Path(), readyA, start)
  await using b = worker("production", Database.Path(), readyB, start)
  await Promise.all([readyFile(readyA, a.child), readyFile(readyB, b.child)])
  fs.writeFileSync(start, "start", { flag: "wx" })
  const results = await Promise.all([a.output, b.output])
  const identities = []
  for (const [stdout, stderr, code] of results) {
    expect(code, stderr).toBe(0)
    identities.push(JSON.parse(stdout.split(/\r?\n/).findLast((line) => line.startsWith("{"))!))
  }
  expect(identities).toEqual([
    { identity: Database.Identity(), version: DATABASE_MIGRATIONS.at(-1)!.version },
    { identity: Database.Identity(), version: DATABASE_MIGRATIONS.at(-1)!.version },
  ])
}, 60_000)

test("two independent writer processes upgrade a versioned database once and preserve its rows", async () => {
  using value = fixture()
  value.sqlite.exec("INSERT INTO note(rowid,id,body) VALUES(29,'concurrent','retained')")
  const start = path.join(value.directory, "upgrade.start")
  const readyA = path.join(value.directory, "upgrade.a")
  const readyB = path.join(value.directory, "upgrade.b")
  value.sqlite.close(true)
  await using a = worker("upgrade", value.databasePath, readyA, start)
  await using b = worker("upgrade", value.databasePath, readyB, start)
  await Promise.all([readyFile(readyA, a.child), readyFile(readyB, b.child)])
  fs.writeFileSync(start, "start", { flag: "wx" })
  const receipts = []
  for (const [stdout, stderr, code] of await Promise.all([a.output, b.output])) {
    expect(code, stderr).toBe(0)
    receipts.push(JSON.parse(stdout.trim()))
  }
  const signature = receipts
    .map(({ outcome }) => outcome)
    .sort()
    .join("+")
  expect(["busy+busy", "busy+upgraded", "current+upgraded"]).toContain(signature)
  value.sqlite = new SQLite(value.databasePath)
  const reopened = run(value, [
    { version: 1, name: "baseline", ddl: first },
    { version: 2, name: "priority", ddl: second },
  ])
  expect({ from: reopened.from, to: reopened.to, version: schemaVersion(value.sqlite) }).toEqual({
    from: signature === "busy+busy" ? 1 : 2,
    to: 2,
    version: 2,
  })
  const applied = signature === "busy+busy" ? reopened : receipts.find((receipt) => receipt.outcome === "upgraded")!
  const backup = new SQLite(applied.backupPath!, { readonly: true })
  try {
    expect({ version: schemaVersion(backup), rows: read(backup, "SELECT rowid,id,body FROM note") }).toEqual({
      version: 1,
      rows: [{ rowid: 29, id: "concurrent", body: "retained" }],
    })
  } finally {
    backup.close(true)
  }
  expect(read(value.sqlite, "SELECT rowid,id,body,priority FROM note")).toEqual([
    { rowid: 29, id: "concurrent", body: "retained", priority: 3 },
  ])
}, 60_000)
