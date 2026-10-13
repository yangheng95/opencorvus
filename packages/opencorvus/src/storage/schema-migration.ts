import { Database as SQLite } from "bun:sqlite"
import fs from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { queryAllFinalized } from "./sqlite-statement"
import { findSchemaObjectDrift, readSchemaObjects, readSchemaObjectShape } from "./schema-contract"

export type SchemaMigration = {
  version: number
  name: string
  /** Immutable historical target, bundled with the application. */
  ddl: string
  /** Explicit semantic changes run with the old tables and suspended triggers. */
  migrate?: (sqlite: SQLite) => void
}

export class SchemaMigrationError extends Error {
  override readonly name = "SchemaMigrationError"
  constructor(
    readonly code:
      | "SCHEMA_VERSION_AHEAD"
      | "SCHEMA_BASELINE_REQUIRED"
      | "SCHEMA_MIGRATION_REQUIRED"
      | "SCHEMA_MIGRATION_FAILED",
    message: string,
    readonly backupPath?: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
  }
}

type Column = { name: string; type: string; hidden: number }
type Table = { name: string; type: "table" | "virtual" | "shadow" | "view"; wr: number }

const quote = (value: string) => `"${value.replaceAll('"', '""')}"`
const columns = (sqlite: SQLite, name: string) =>
  queryAllFinalized<Column>(sqlite, `PRAGMA table_xinfo(${quote(name)})`)
const tables = (sqlite: SQLite) =>
  new Map(
    queryAllFinalized<Table & { schema: string }>(sqlite, "PRAGMA table_list")
      .filter((table) => table.schema === "main" && !table.name.startsWith("sqlite_"))
      .map((table) => [table.name, table]),
  )

function required(message: string): never {
  throw new SchemaMigrationError("SCHEMA_MIGRATION_REQUIRED", message)
}

/** Keep every existing field and row identity. Semantic changes belong to the versioned migration. */
function synchronizeTables(sqlite: SQLite, target: SQLite): void {
  const before = tables(sqlite)
  const after = tables(target)
  const expected = readSchemaObjects(target)
  const existing = new Map(readSchemaObjects(sqlite).map((object) => [`${object.type}:${object.name}`, object]))
  for (const table of before.values()) {
    if (table.type !== "shadow" && !after.has(table.name)) {
      required(`Table ${table.name} needs an explicit data migration; its records have been retained.`)
    }
  }
  for (const table of after.values()) {
    if (table.type === "shadow" || table.type === "view") continue
    const definition = expected.find((object) => object.type === "table" && object.name === table.name)?.sql
    if (!definition) required(`The target schema has no table definition for ${table.name}.`)
    const old = existing.get(`table:${table.name}`)
    if (!old) {
      sqlite.exec(definition)
      continue
    }
    if (old.sql?.trim() === definition.trim()) continue
    const sourceTable = before.get(table.name)!
    if (table.type !== "table" || sourceTable.type !== "table" || sourceTable.wr !== table.wr) {
      required(`Table ${table.name} requires an explicit virtual-table or row-identity migration.`)
    }
    const sourceColumns = columns(sqlite, table.name)
    const targetColumns = new Map(columns(target, table.name).map((column) => [column.name, column]))
    for (const column of sourceColumns) {
      const next = targetColumns.get(column.name)
      if (!next || next.type.toUpperCase() !== column.type.toUpperCase() || next.hidden !== column.hidden) {
        required(`Column ${table.name}.${column.name} needs an explicit migration; its values have been retained.`)
      }
    }
    const tempName = `opencorvus_migration_${randomUUID().replaceAll("-", "")}`
    // The canonical definition comes from SQLite itself, not user-supplied SQL fragments.
    const prefix = /^CREATE TABLE(?: IF NOT EXISTS)?\s+(?:"(?:[^"]|"")+"|`[^`]+`|\[[^\]]+\]|[^\s(]+)/i
    if (!prefix.test(definition)) required(`Unsupported table declaration for ${table.name}.`)
    sqlite.exec(definition.replace(prefix, `CREATE TABLE ${quote(tempName)}`))
    const retained = sourceColumns.filter((column) => column.hidden === 0).map((column) => column.name)
    if (table.wr === 0) {
      const rowid = ["rowid", "_rowid_", "oid"].find(
        (name) => !targetColumns.has(name) && !sourceColumns.some((column) => column.name === name),
      )
      if (!rowid) required(`Table ${table.name} requires an explicit rowid migration.`)
      retained.unshift(rowid)
    }
    const names = retained.map(quote).join(", ")
    sqlite.exec(`INSERT INTO ${quote(tempName)} (${names}) SELECT ${names} FROM ${quote(table.name)}`)
    sqlite.exec(`DROP TABLE ${quote(table.name)}`)
    sqlite.exec(`ALTER TABLE ${quote(tempName)} RENAME TO ${quote(table.name)}`)
  }
}

function applyMigration(sqlite: SQLite, migration: SchemaMigration): void {
  const target = new SQLite(":memory:")
  try {
    target.exec(migration.ddl)
    // The transaction's writer lock excludes other writes throughout the complete upgrade.
    for (const object of readSchemaObjects(sqlite)) {
      if (object.type === "trigger" || object.type === "view" || object.type === "index") {
        sqlite.exec(`DROP ${object.type.toUpperCase()} ${quote(object.name)}`)
      }
    }
    const result: unknown = migration.migrate?.(sqlite)
    if (result && typeof (result as PromiseLike<unknown>).then === "function") {
      throw new Error(`Migration ${migration.version} must complete synchronously inside its SQLite transaction.`)
    }
    synchronizeTables(sqlite, target)
    for (const object of readSchemaObjects(target)) {
      if (object.type !== "table" && object.sql) sqlite.exec(object.sql)
    }
    const drift = findSchemaObjectDrift(readSchemaObjectShape(target), readSchemaObjectShape(sqlite))
    if (drift) required(`Migration ${migration.version} did not reach its declared target: ${drift}`)
  } finally {
    target.close(true)
  }
}

function saveBackup(sqlite: SQLite, databasePath: string, from: number, to: number): string {
  const directory = path.join(path.dirname(databasePath), "migration-backups")
  fs.mkdirSync(directory, { recursive: true })
  const name = `${path.basename(databasePath)}.v${from}-to-v${to}.${Date.now()}.${randomUUID()}.sqlite`
  const destination = path.join(directory, name)
  const pending = `${destination}.partial`
  let descriptor: number | undefined
  try {
    descriptor = fs.openSync(pending, "wx", 0o600)
    fs.writeFileSync(descriptor, sqlite.serialize())
    fs.fsyncSync(descriptor)
    fs.closeSync(descriptor)
    descriptor = undefined
    fs.renameSync(pending, destination)
    return destination
  } catch (cause) {
    if (descriptor !== undefined) fs.closeSync(descriptor)
    fs.rmSync(pending, { force: true })
    throw cause
  }
}

export function schemaVersion(sqlite: SQLite): number {
  return queryAllFinalized<{ user_version: number }>(sqlite, "PRAGMA user_version")[0].user_version
}

/** Check the actual SQLite objects represented by the published migration target. */
export function validateMigrationRegistry(migrations: readonly SchemaMigration[], currentDDL: string): number {
  if (migrations.length === 0 || migrations.some((step, index) => step.version !== index + 1)) {
    throw new Error("Database migrations must declare a contiguous sequence beginning at version 1.")
  }
  const version = migrations.at(-1)!.version
  const expected = new SQLite(":memory:")
  const declared = new SQLite(":memory:")
  try {
    expected.exec(currentDDL)
    declared.exec(migrations.at(-1)!.ddl)
    const drift = findSchemaObjectDrift(readSchemaObjectShape(expected), readSchemaObjectShape(declared))
    if (drift) required(`The application schema requires a new versioned migration: ${drift}`)
  } finally {
    expected.close(true)
    declared.close(true)
  }
  return version
}

/** Upgrade before exposing the connection to any reader, writer, or recovery entry. */
export function migrateSchema(input: {
  sqlite: SQLite
  databasePath: string
  migrations: readonly SchemaMigration[]
  currentDDL: string
  validate: () => void
}): { from: number; to: number; backupPath?: string } {
  const { sqlite, migrations } = input
  const version = validateMigrationRegistry(migrations, input.currentDDL)
  const foreignKeys = queryAllFinalized<{ foreign_keys: number }>(sqlite, "PRAGMA foreign_keys")[0].foreign_keys
  sqlite.exec("PRAGMA foreign_keys = OFF")
  let transaction = false
  let backupPath: string | undefined
  let from = schemaVersion(sqlite)
  try {
    sqlite.exec("BEGIN IMMEDIATE")
    transaction = true
    from = schemaVersion(sqlite)
    if (from < 0) required(`Database version ${from} is invalid; its metadata requires recovery.`)
    if (from > version) {
      throw new SchemaMigrationError(
        "SCHEMA_VERSION_AHEAD",
        `Database version ${from} requires a newer application (this build supports ${version}).`,
      )
    }
    const fresh = readSchemaObjects(sqlite).length === 0 && from === 0
    if (!fresh && from === 0) {
      throw new SchemaMigrationError(
        "SCHEMA_BASELINE_REQUIRED",
        "This unversioned database predates the supported migration baseline. Establish the current baseline through explicitly authorized database maintenance.",
      )
    }
    if (fresh) {
      sqlite.exec(input.currentDDL)
      sqlite.exec(`PRAGMA user_version = ${version}`)
    } else if (from < version) {
      backupPath = saveBackup(sqlite, input.databasePath, from, version)
      for (const migration of migrations) {
        if (migration.version <= from) continue
        applyMigration(sqlite, migration)
        sqlite.exec(`PRAGMA user_version = ${migration.version}`)
      }
    }
    const target = new SQLite(":memory:")
    try {
      target.exec(input.currentDDL)
      const drift = findSchemaObjectDrift(readSchemaObjectShape(target), readSchemaObjectShape(sqlite))
      if (drift)
        required(
          `Database version ${version} differs from its declared schema: ${drift}. A versioned migration is required.`,
        )
    } finally {
      target.close(true)
    }
    const violations = queryAllFinalized<{ table: string; rowid: number | null; parent: string; fkid: number }>(
      sqlite,
      "PRAGMA foreign_key_check",
    )
    if (violations.length) throw new Error(`Foreign-key integrity failed: ${JSON.stringify(violations.slice(0, 8))}`)
    const validation: unknown = input.validate()
    if (validation && typeof (validation as PromiseLike<unknown>).then === "function") {
      throw new Error("Database migration validation must complete synchronously before commit.")
    }
    sqlite.exec("COMMIT")
    transaction = false
    return { from, to: version, ...(backupPath ? { backupPath } : {}) }
  } catch (cause) {
    if (
      !transaction &&
      !backupPath &&
      typeof cause === "object" &&
      cause !== null &&
      "code" in cause &&
      String(cause.code).startsWith("SQLITE_BUSY")
    ) {
      throw cause
    }
    if (transaction) {
      try {
        sqlite.exec("ROLLBACK")
        transaction = false
      } catch (rollback) {
        throw new SchemaMigrationError(
          "SCHEMA_MIGRATION_FAILED",
          "Database migration and transaction rollback failed; retain the database and its backup for recovery.",
          backupPath,
          { cause: new AggregateError([cause, rollback]) },
        )
      }
    }
    if (
      typeof cause === "object" &&
      cause !== null &&
      "code" in cause &&
      /^(SQLITE_BUSY|SQLITE_LOCKED)(_|$)/.test(String(cause.code))
    )
      throw cause
    if (cause instanceof SchemaMigrationError) {
      throw new SchemaMigrationError(cause.code, cause.message, backupPath ?? cause.backupPath, { cause })
    }
    // Ordinary current-version data errors retain their public domain contract.
    if (from === version && !backupPath) throw cause
    throw new SchemaMigrationError(
      "SCHEMA_MIGRATION_FAILED",
      `Database migration from ${from} to ${version} failed and was rolled back: ${cause instanceof Error ? cause.message : String(cause)}`,
      backupPath,
      { cause },
    )
  } finally {
    if (!transaction) sqlite.exec(`PRAGMA foreign_keys = ${foreignKeys ? "ON" : "OFF"}`)
  }
}
