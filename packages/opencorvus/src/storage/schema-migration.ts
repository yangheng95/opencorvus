import { Database as BunDatabase } from "bun:sqlite"
import { createHash, randomUUID } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { SCHEMA_DDL } from "./ddl"

type SchemaObjectShape = Map<string, string>

export type SchemaMigration = Readonly<{
  id: string
  fromFingerprint: string
  toFingerprint: string
  requiredEmptyTables: readonly string[]
  statements: readonly string[]
}>

export type SchemaMigrationPlan = Readonly<{
  fromFingerprint: string
  toFingerprint: string
  migrations: readonly SchemaMigration[]
}>

export type SchemaMigrationBackupFile = Readonly<{
  name: string
  bytes: number
  sha256: string
}>

export type SchemaMigrationResult = Readonly<{
  fromFingerprint: string
  toFingerprint: string
  migrationIDs: readonly string[]
  backupDirectory: string
  backupFiles: readonly SchemaMigrationBackupFile[]
}>

export type SchemaMigrationBackup = Readonly<{
  backupDirectory: string
  files: readonly SchemaMigrationBackupFile[]
}>

export class SchemaMigrationError extends Error {
  override readonly name = "SchemaMigrationError"

  constructor(
    readonly code: "SCHEMA_MIGRATION_REQUIRED" | "SCHEMA_MIGRATION_BACKUP_FAILED" | "SCHEMA_MIGRATION_FAILED",
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
  }
}

function queryAllFinalized<TResult>(sqlite: BunDatabase, sql: string): TResult[] {
  const statement = sqlite.query<TResult, []>(sql)
  let rows: TResult[] | undefined
  let operationFailure: unknown
  try {
    rows = statement.all()
  } catch (error) {
    operationFailure = error
  }
  try {
    statement.finalize()
  } catch (finalizeFailure) {
    if (operationFailure !== undefined) {
      throw new AggregateError(
        [operationFailure, finalizeFailure],
        "SQLite schema query and statement finalization both failed",
        { cause: operationFailure },
      )
    }
    throw finalizeFailure
  }
  if (operationFailure !== undefined) throw operationFailure
  return rows as TResult[]
}

function canonicalSchemaSql(value: string): string {
  return value.trim()
}

export function readSchemaObjectShape(sqlite: BunDatabase): SchemaObjectShape {
  return new Map(
    queryAllFinalized<{ type: string; name: string; table_name: string; sql: string | null }>(
      sqlite,
      `SELECT type, name, tbl_name AS table_name, sql
       FROM sqlite_schema
       WHERE name NOT LIKE 'sqlite_%'
       ORDER BY type, name`,
    ).map((row) => [
      `${row.type}:${row.name}`,
      `${row.table_name}:${row.sql === null ? "<implicit>" : canonicalSchemaSql(row.sql)}`,
    ]),
  )
}

export function schemaObjectFingerprint(sqlite: BunDatabase): string {
  const entries = [...readSchemaObjectShape(sqlite)]
  // SHA-256 means Secure Hash Algorithm with a 256-bit digest. It identifies
  // one complete SQLite schema contract; it is not used as a security token.
  return createHash("sha256").update(JSON.stringify(entries)).digest("hex")
}

function expectedSchemaObjectShape(): SchemaObjectShape {
  const sqlite = new BunDatabase(":memory:")
  try {
    sqlite.exec(SCHEMA_DDL)
    return readSchemaObjectShape(sqlite)
  } finally {
    sqlite.close(true)
  }
}

export function currentSchemaFingerprint(): string {
  const sqlite = new BunDatabase(":memory:")
  try {
    sqlite.exec(SCHEMA_DDL)
    return schemaObjectFingerprint(sqlite)
  } finally {
    sqlite.close(true)
  }
}

export function findSchemaDrift(sqlite: BunDatabase): string | undefined {
  const expected = expectedSchemaObjectShape()
  const actual = readSchemaObjectShape(sqlite)

  for (const objectKey of actual.keys()) {
    if (!expected.has(objectKey)) return `unexpected schema object ${objectKey}`
  }
  for (const [objectKey, expectedSql] of expected) {
    const actualSql = actual.get(objectKey)
    if (actualSql === undefined) return `missing schema object ${objectKey}`
    if (actualSql !== expectedSql) return `schema object ${objectKey} differs from current DDL`
  }
}

export function hasApplicationSchema(sqlite: BunDatabase): boolean {
  return readSchemaObjectShape(sqlite).size > 0
}

const SCHEMA_MIGRATIONS: readonly SchemaMigration[] = Object.freeze([
  Object.freeze({
    id: "2026-08-06-project-memory-single-scope",
    fromFingerprint: "05480e3d530365e768b00218f24c4a8d7bb281538315b600dd70827c90e33212",
    toFingerprint: "b8d6df10b9f174560b1ee2c90b10b87e039ef375c61b0ccdc8463d9d6c7ed9fd",
    requiredEmptyTables: Object.freeze(["scratchpad"]),
    statements: Object.freeze([
      `DROP INDEX "memory_file_scope_idx"`,
      `DROP INDEX "memory_file_session_idx"`,
      `DROP TABLE "scratchpad"`,
      `ALTER TABLE "memory_file" DROP COLUMN "session_id"`,
      `ALTER TABLE "memory_file" DROP COLUMN "scope"`,
    ]),
  }),
])

function migrationBySourceFingerprint(): ReadonlyMap<string, SchemaMigration> {
  const result = new Map<string, SchemaMigration>()
  for (const migration of SCHEMA_MIGRATIONS) {
    if (result.has(migration.fromFingerprint)) {
      throw new Error(`Duplicate schema migration source fingerprint: ${migration.fromFingerprint}`)
    }
    result.set(migration.fromFingerprint, migration)
  }
  return result
}

export function planSchemaMigration(sqlite: BunDatabase): SchemaMigrationPlan | undefined {
  const fromFingerprint = schemaObjectFingerprint(sqlite)
  const toFingerprint = currentSchemaFingerprint()
  if (fromFingerprint === toFingerprint) {
    return { fromFingerprint, toFingerprint, migrations: Object.freeze([]) }
  }

  const bySource = migrationBySourceFingerprint()
  const migrations: SchemaMigration[] = []
  const visited = new Set<string>()
  let cursor = fromFingerprint
  while (cursor !== toFingerprint) {
    if (visited.has(cursor)) throw new Error(`Schema migration cycle begins at fingerprint ${cursor}`)
    visited.add(cursor)
    const migration = bySource.get(cursor)
    if (!migration) return undefined
    migrations.push(migration)
    cursor = migration.toFingerprint
  }
  return {
    fromFingerprint,
    toFingerprint,
    migrations: Object.freeze(migrations),
  }
}

function backupFileTargets(databasePath: string) {
  return [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]
}

function fileSHA256(filePath: string): string {
  const hash = createHash("sha256")
  const descriptor = fs.openSync(filePath, "r")
  const buffer = Buffer.allocUnsafe(1024 * 1024)
  try {
    while (true) {
      const bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null)
      if (bytesRead === 0) break
      hash.update(buffer.subarray(0, bytesRead))
    }
  } finally {
    fs.closeSync(descriptor)
  }
  return hash.digest("hex").toUpperCase()
}

function backupTimestamp(date: Date) {
  return date
    .toISOString()
    .replaceAll(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
}

export function createSchemaMigrationBackup(databasePath: string, plan: SchemaMigrationPlan): SchemaMigrationBackup {
  const backupDirectory = path.join(
    path.dirname(databasePath),
    "maintenance-backups",
    `schema-migration-${backupTimestamp(new Date())}-${randomUUID()}`,
  )
  try {
    fs.mkdirSync(backupDirectory, { recursive: true })
    const files: SchemaMigrationBackupFile[] = []
    for (const source of backupFileTargets(databasePath)) {
      if (!fs.existsSync(source)) continue
      const name = path.basename(source)
      const destination = path.join(backupDirectory, name)
      fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL)
      const stat = fs.statSync(destination)
      files.push({ name, bytes: stat.size, sha256: fileSHA256(destination) })
    }
    if (!files.some((file) => file.name === path.basename(databasePath))) {
      throw new Error(`Database file disappeared before migration backup: ${databasePath}`)
    }
    const manifest = {
      format: "opencorvus.schema-migration-backup.v1",
      databasePath,
      createdAt: new Date().toISOString(),
      fromFingerprint: plan.fromFingerprint,
      toFingerprint: plan.toFingerprint,
      migrationIDs: plan.migrations.map((migration) => migration.id),
      files,
    }
    fs.writeFileSync(path.join(backupDirectory, "manifest.json"), JSON.stringify(manifest, null, 2), {
      encoding: "utf8",
      flag: "wx",
    })
    return { backupDirectory, files: Object.freeze(files) }
  } catch (cause) {
    throw new SchemaMigrationError(
      "SCHEMA_MIGRATION_BACKUP_FAILED",
      `OpenCorvus could not create the required pre-migration backup for ${databasePath}`,
      { cause },
    )
  }
}

function assertForeignKeys(sqlite: BunDatabase) {
  const violations = queryAllFinalized<{ table: string; rowid: number | null; parent: string; fkid: number }>(
    sqlite,
    "PRAGMA foreign_key_check",
  )
  if (violations.length === 0) return
  const sample = violations
    .slice(0, 8)
    .map((violation) => `${violation.table}[rowid=${violation.rowid ?? "without-rowid"}] -> ${violation.parent}`)
    .join(", ")
  throw new Error(`Schema migration found ${violations.length} foreign-key violation(s): ${sample}`)
}

function assertIntegrity(sqlite: BunDatabase) {
  const rows = queryAllFinalized<Record<string, string>>(sqlite, "PRAGMA integrity_check")
  const messages = rows.flatMap((row) => Object.values(row))
  if (messages.length === 1 && messages[0] === "ok") return
  throw new Error(`Schema migration integrity check failed: ${messages.join(", ") || "no result"}`)
}

function quoteIdentifier(name: string) {
  return `"${name.replaceAll('"', '""')}"`
}

function assertMigrationPreconditions(sqlite: BunDatabase, migration: SchemaMigration) {
  for (const table of migration.requiredEmptyTables) {
    const row = queryAllFinalized<{ count: number }>(
      sqlite,
      `SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)}`,
    )[0]
    if (row?.count === 0) continue
    throw new Error(
      `Migration ${migration.id} requires empty table ${table}, received ${row?.count ?? "unknown"} row(s)`,
    )
  }
}

export function migrateDatabaseFile(
  databasePath: string,
  plan: SchemaMigrationPlan,
  preparedBackup: SchemaMigrationBackup,
): SchemaMigrationResult {
  if (plan.migrations.length === 0) {
    throw new Error("migrateDatabaseFile requires at least one schema migration")
  }
  const backup = preparedBackup
  let sqlite: BunDatabase
  try {
    sqlite = new BunDatabase(databasePath)
  } catch (cause) {
    throw new SchemaMigrationError(
      "SCHEMA_MIGRATION_FAILED",
      `OpenCorvus could not reopen ${databasePath} for schema migration; backup: ${backup.backupDirectory}`,
      { cause },
    )
  }
  let transactionActive = false
  try {
    const actualStart = schemaObjectFingerprint(sqlite)
    if (actualStart !== plan.fromFingerprint) {
      throw new Error(
        `Database schema changed before migration: expected ${plan.fromFingerprint}, received ${actualStart}`,
      )
    }
    sqlite.run("PRAGMA foreign_keys = ON")
    sqlite.run("BEGIN IMMEDIATE")
    transactionActive = true
    let cursor = actualStart
    for (const migration of plan.migrations) {
      if (cursor !== migration.fromFingerprint) {
        throw new Error(`Migration ${migration.id} expected ${migration.fromFingerprint}, received ${cursor}`)
      }
      assertMigrationPreconditions(sqlite, migration)
      for (const statement of migration.statements) sqlite.run(statement)
      cursor = schemaObjectFingerprint(sqlite)
      if (cursor !== migration.toFingerprint) {
        throw new Error(`Migration ${migration.id} produced ${cursor}, expected ${migration.toFingerprint}`)
      }
    }
    if (cursor !== plan.toFingerprint) {
      throw new Error(`Schema migration chain ended at ${cursor}, expected ${plan.toFingerprint}`)
    }
    const drift = findSchemaDrift(sqlite)
    if (drift) throw new Error(`Schema migration did not reach the current DDL: ${drift}`)
    assertForeignKeys(sqlite)
    assertIntegrity(sqlite)
    sqlite.run("COMMIT")
    transactionActive = false
    return {
      fromFingerprint: plan.fromFingerprint,
      toFingerprint: plan.toFingerprint,
      migrationIDs: Object.freeze(plan.migrations.map((migration) => migration.id)),
      backupDirectory: backup.backupDirectory,
      backupFiles: backup.files,
    }
  } catch (cause) {
    if (transactionActive) {
      try {
        sqlite.run("ROLLBACK")
        transactionActive = false
      } catch (rollbackFailure) {
        throw new SchemaMigrationError(
          "SCHEMA_MIGRATION_FAILED",
          `OpenCorvus schema migration and rollback both failed for ${databasePath}; backup: ${backup.backupDirectory}`,
          { cause: new AggregateError([cause, rollbackFailure], "Schema migration rollback failed", { cause }) },
        )
      }
    }
    throw new SchemaMigrationError(
      "SCHEMA_MIGRATION_FAILED",
      `OpenCorvus schema migration failed for ${databasePath}; the transaction was rolled back; backup: ${backup.backupDirectory}`,
      { cause },
    )
  } finally {
    sqlite.close(true)
  }
}
