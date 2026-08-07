import { afterEach, describe, expect, test } from "bun:test"
import { Database as BunDatabase } from "bun:sqlite"
import fs from "node:fs/promises"
import path from "node:path"
import { SCHEMA_DDL } from "../../src/storage/ddl"
import {
  SchemaMigrationError,
  createSchemaMigrationBackup,
  currentSchemaFingerprint,
  migrateDatabaseFile,
  planSchemaMigration,
  schemaObjectFingerprint,
} from "../../src/storage/schema-migration"

const PREDECESSOR_FINGERPRINT = "05480e3d530365e768b00218f24c4a8d7bb281538315b600dd70827c90e33212"
const CURRENT_FINGERPRINT = "b8d6df10b9f174560b1ee2c90b10b87e039ef375c61b0ccdc8463d9d6c7ed9fd"

const legacyMemoryFileDDL = /* sql */ `CREATE TABLE "memory_file" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "session_id" text,
  "scope" text NOT NULL DEFAULT 'global',
  "title" text NOT NULL,
  "source" text NOT NULL,
  "kind" text NOT NULL DEFAULT 'note',
  "key" text,
  "importance" integer NOT NULL DEFAULT 60,
  "confidence" integer NOT NULL DEFAULT 75,
  "time_created" integer NOT NULL,
  "time_updated" integer NOT NULL,
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE
)`

const legacyScratchpadDDL = /* sql */ `CREATE TABLE "scratchpad" (
  "session_id" text PRIMARY KEY NOT NULL,
  "content" text NOT NULL DEFAULT '',
  "time_created" integer NOT NULL,
  "time_updated" integer NOT NULL,
  FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE CASCADE
)`

const cleanupRoots: string[] = []

afterEach(async () => {
  await Promise.all(cleanupRoots.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })))
})

async function temporaryDatabasePath() {
  const processRoot = process.env.OPENCORVUS_TEST_PROCESS_ROOT
  if (!processRoot) throw new Error("Schema migration tests require the repository test preload")
  const directory = await fs.mkdtemp(path.join(processRoot, "schema-migration-"))
  cleanupRoots.push(directory)
  return path.join(directory, "opencorvus.db")
}

function requiredSchemaSQL(sqlite: BunDatabase, type: "table" | "index", name: string) {
  const row = sqlite
    .query<{ sql: string | null }, [string, string]>("SELECT sql FROM sqlite_schema WHERE type = ? AND name = ?")
    .get(type, name)
  if (!row?.sql) throw new Error(`Missing current schema object ${type}:${name}`)
  return row.sql
}

function createPredecessorDatabase(databasePath: string, input: { scratchpadContent?: string } = {}) {
  const sqlite = new BunDatabase(databasePath, { create: true })
  sqlite.exec(SCHEMA_DDL)
  const memoryChunkTable = requiredSchemaSQL(sqlite, "table", "memory_chunk")
  const memoryEmbeddingTable = requiredSchemaSQL(sqlite, "table", "memory_embedding")
  const memoryChunkFileIndex = requiredSchemaSQL(sqlite, "index", "memory_chunk_file_idx")
  const memoryChunkProjectIndex = requiredSchemaSQL(sqlite, "index", "memory_chunk_project_idx")

  sqlite.run("PRAGMA foreign_keys = OFF")
  sqlite.run('DROP TABLE "memory_embedding"')
  sqlite.run('DROP TABLE "memory_chunk"')
  sqlite.run('DROP TABLE "memory_file"')
  sqlite.exec(legacyMemoryFileDDL)
  sqlite.exec('CREATE INDEX "memory_file_project_idx" ON "memory_file" ("project_id")')
  sqlite.exec('CREATE INDEX "memory_file_scope_idx" ON "memory_file" ("scope")')
  sqlite.exec('CREATE INDEX "memory_file_session_idx" ON "memory_file" ("session_id")')
  sqlite.exec('CREATE INDEX "memory_file_kind_idx" ON "memory_file" ("kind")')
  sqlite.exec('CREATE INDEX "memory_file_key_idx" ON "memory_file" ("key")')
  sqlite.exec(memoryChunkTable)
  sqlite.exec(memoryChunkFileIndex)
  sqlite.exec(memoryChunkProjectIndex)
  sqlite.exec(memoryEmbeddingTable)
  sqlite.exec(legacyScratchpadDDL)

  sqlite.run(
    `INSERT INTO project (id, worktree, name, time_created, time_updated, sandboxes)
     VALUES ('project-a', 'C:/project-a', 'Project A', 1, 1, '[]')`,
  )
  sqlite.run(
    `INSERT INTO database_authority (key, instance_id, time_created)
     VALUES ('primary', '00000000-0000-4000-8000-000000000001', 1)`,
  )
  sqlite.run(
    `INSERT INTO memory_file (
       id, project_id, session_id, scope, title, source, kind, key,
       importance, confidence, time_created, time_updated
     ) VALUES (
       'memory-a', 'project-a', 'session-a', 'session', 'Preserved memory',
       'agent', 'fact', 'preserved', 80, 90, 1, 2
     )`,
  )
  sqlite.run(
    `INSERT INTO memory_chunk (id, file_id, project_id, content, token_count, time_created, time_updated)
     VALUES ('chunk-a', 'memory-a', 'project-a', 'preserved content', 2, 1, 2)`,
  )
  if (input.scratchpadContent !== undefined) {
    sqlite.run(
      `INSERT INTO scratchpad (session_id, content, time_created, time_updated)
       VALUES ('session-a', ?, 1, 2)`,
      [input.scratchpadContent],
    )
  }
  expect(schemaObjectFingerprint(sqlite)).toBe(PREDECESSOR_FINGERPRINT)
  sqlite.close(true)
}

describe("transactional schema migration", () => {
  test("upgrades the exact 0.0.32 schema while preserving rows and database authority", async () => {
    const databasePath = await temporaryDatabasePath()
    createPredecessorDatabase(databasePath)

    const predecessor = new BunDatabase(databasePath)
    predecessor.run("PRAGMA journal_mode = WAL")
    predecessor.run("PRAGMA wal_autocheckpoint = 0")
    predecessor.run(
      `INSERT INTO quick_note (id, project_id, content, summary, time_created, time_updated)
       VALUES ('note-a', 'project-a', 'preserved WAL content', 'Preserved WAL note', 1, 1)`,
    )
    const plan = planSchemaMigration(predecessor)
    const preparedBackup = createSchemaMigrationBackup(databasePath, plan!)
    expect(preparedBackup.files.map((file) => file.name)).toEqual([
      "opencorvus.db",
      "opencorvus.db-wal",
      "opencorvus.db-shm",
    ])
    predecessor.close(true)
    expect(plan?.migrations.map((migration) => migration.id)).toEqual(["2026-08-06-project-memory-single-scope"])

    const result = migrateDatabaseFile(databasePath, plan!, preparedBackup)
    expect(result).toMatchObject({
      fromFingerprint: PREDECESSOR_FINGERPRINT,
      toFingerprint: CURRENT_FINGERPRINT,
      migrationIDs: ["2026-08-06-project-memory-single-scope"],
    })

    const migrated = new BunDatabase(databasePath, { readonly: true })
    expect(schemaObjectFingerprint(migrated)).toBe(currentSchemaFingerprint())
    expect(currentSchemaFingerprint()).toBe(CURRENT_FINGERPRINT)
    expect(migrated.query("SELECT * FROM memory_file").all()).toEqual([
      {
        id: "memory-a",
        project_id: "project-a",
        title: "Preserved memory",
        source: "agent",
        kind: "fact",
        key: "preserved",
        importance: 80,
        confidence: 90,
        time_created: 1,
        time_updated: 2,
      },
    ])
    expect(migrated.query("SELECT content FROM memory_chunk").all()).toEqual([{ content: "preserved content" }])
    expect(migrated.query("SELECT content FROM quick_note").all()).toEqual([{ content: "preserved WAL content" }])
    expect(migrated.query("SELECT instance_id FROM database_authority").all()).toEqual([
      { instance_id: "00000000-0000-4000-8000-000000000001" },
    ])
    expect(migrated.query("PRAGMA foreign_key_check").all()).toEqual([])
    expect(migrated.query("PRAGMA integrity_check").all()).toEqual([{ integrity_check: "ok" }])
    migrated.close(true)

    const manifest = JSON.parse(await fs.readFile(path.join(result.backupDirectory, "manifest.json"), "utf8"))
    expect(manifest).toMatchObject({
      format: "opencorvus.schema-migration-backup.v1",
      fromFingerprint: PREDECESSOR_FINGERPRINT,
      toFingerprint: CURRENT_FINGERPRINT,
      migrationIDs: ["2026-08-06-project-memory-single-scope"],
    })
    expect(result.backupFiles.map((file) => file.name)).toEqual([
      "opencorvus.db",
      "opencorvus.db-wal",
      "opencorvus.db-shm",
    ])
    const backupDatabase = new BunDatabase(path.join(result.backupDirectory, "opencorvus.db"), { readonly: true })
    expect(schemaObjectFingerprint(backupDatabase)).toBe(PREDECESSOR_FINGERPRINT)
    expect(backupDatabase.query("SELECT content FROM memory_chunk").all()).toEqual([{ content: "preserved content" }])
    expect(backupDatabase.query("SELECT content FROM quick_note").all()).toEqual([{ content: "preserved WAL content" }])
    backupDatabase.close(true)
  })

  test("returns a typed failure and retains the predecessor transaction when removed data is not empty", async () => {
    const databasePath = await temporaryDatabasePath()
    createPredecessorDatabase(databasePath, { scratchpadContent: "must be explicitly transformed" })
    const predecessor = new BunDatabase(databasePath, { readonly: true })
    const plan = planSchemaMigration(predecessor)
    const preparedBackup = createSchemaMigrationBackup(databasePath, plan!)
    predecessor.close(true)

    let captured: unknown
    try {
      migrateDatabaseFile(databasePath, plan!, preparedBackup)
    } catch (error) {
      captured = error
    }
    expect(captured).toBeInstanceOf(SchemaMigrationError)
    expect((captured as SchemaMigrationError).code).toBe("SCHEMA_MIGRATION_FAILED")

    const retained = new BunDatabase(databasePath, { readonly: true })
    expect(schemaObjectFingerprint(retained)).toBe(PREDECESSOR_FINGERPRINT)
    expect(retained.query("SELECT content FROM scratchpad").all()).toEqual([
      { content: "must be explicitly transformed" },
    ])
    expect(retained.query("SELECT content FROM memory_chunk").all()).toEqual([{ content: "preserved content" }])
    retained.close(true)
  })
})
