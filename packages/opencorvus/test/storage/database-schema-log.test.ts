import { afterEach, expect, test } from "bun:test"
import { Database as SQLite } from "bun:sqlite"
import fs from "node:fs/promises"
import path from "node:path"
import { Database } from "../../src/storage/db"
import { DATABASE_MIGRATIONS } from "../../src/storage/migrations"
import { Log } from "../../src/util/log"
import { createTestDatabase, resetDatabase } from "../fixture/db"

afterEach(async () => {
  await Log.close()
  await resetDatabase()
})

const version = DATABASE_MIGRATIONS.at(-1)!.version

async function completion() {
  await Log.flush()
  const records = (await fs.readFile(Log.file(), "utf8"))
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
  return records.find((record) => record.service === "db" && record.message === "database schema ready")
}

test("the production opener records initialization of a fresh database", async () => {
  await resetDatabase()
  await Log.init({ print: false })

  Database.Client()

  expect(await completion()).toMatchObject({
    level: "info",
    service: "db",
    message: "database schema ready",
    data: { path: Database.Path(), action: "initialized", from: 0, to: version },
  })
  expect(Database.allFinalized("PRAGMA user_version")).toEqual([{ user_version: version }])
})

test("the production opener records current-version validation and retains database identity", async () => {
  await createTestDatabase()
  const identity = Database.Identity()
  Database.close()
  await Log.init({ print: false })

  Database.Client()

  expect(await completion()).toMatchObject({
    level: "info",
    service: "db",
    message: "database schema ready",
    data: { path: Database.Path(), action: "validated", from: version, to: version },
  })
  expect(Database.Identity()).toBe(identity)
})

test("the production opener records the real upgrade and its readable pre-upgrade backup", async () => {
  await resetDatabase()
  const prior = DATABASE_MIGRATIONS.at(-2)!
  const databasePath = Database.Path()
  await fs.mkdir(path.dirname(databasePath), { recursive: true })
  const previous = new SQLite(databasePath)
  try {
    previous.exec("PRAGMA journal_mode=WAL")
    previous.exec(prior.ddl)
    previous.exec(`PRAGMA user_version=${prior.version}`)
  } finally {
    previous.close(true)
  }
  await Log.init({ print: false })

  Database.Client()

  const record = await completion()
  expect(record).toMatchObject({
    level: "info",
    service: "db",
    message: "database schema ready",
    data: {
      path: databasePath,
      action: "migrated",
      from: prior.version,
      to: version,
    },
  })
  expect(typeof record.data.backupPath).toBe("string")
  const backup = new SQLite(record.data.backupPath, { readonly: true })
  try {
    const statement = backup.query("PRAGMA user_version")
    try {
      expect(statement.all()).toEqual([{ user_version: prior.version }])
    } finally {
      statement.finalize()
    }
  } finally {
    backup.close(true)
  }
  expect(Database.allFinalized("PRAGMA user_version")).toEqual([{ user_version: version }])
})
