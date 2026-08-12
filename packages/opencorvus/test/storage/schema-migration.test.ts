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
const CURRENT_FINGERPRINT = "e95f145c39fc59ca739807847193c4b3460b51df7308b8239d8ea0bc98933b2d"

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

function requiredSchemaSQL(sqlite: BunDatabase, type: "table" | "index" | "trigger", name: string) {
  const row = sqlite
    .query<{ sql: string | null }, [string, string]>("SELECT sql FROM sqlite_schema WHERE type = ? AND name = ?")
    .get(type, name)
  if (!row?.sql) throw new Error(`Missing current schema object ${type}:${name}`)
  return row.sql
}

function dropBusPublicationOutbox(sqlite: BunDatabase) {
  sqlite.run('DROP TABLE "bus_publication_delivery"')
  sqlite.run('DROP TABLE "bus_publication_outbox"')
}

function dropSchedulerMessageDelivery(sqlite: BunDatabase) {
  sqlite.run('DROP INDEX "protocol_event_scheduler_reply_idx"')
  sqlite.run('DROP TABLE "protocol_aggregate_sequence"')
  sqlite.run('DROP INDEX "protocol_inbox_visible_idx"')
  sqlite.run('ALTER TABLE "protocol_inbox" DROP COLUMN "time_completed"')
  sqlite.run('ALTER TABLE "protocol_inbox" DROP COLUMN "delivery_result"')
  sqlite.run(
    'CREATE INDEX "protocol_inbox_visible_idx" ON "protocol_inbox" ("actor", "status", "visible_at")',
  )
}

function restoreLegacyPermissionSchema(sqlite: BunDatabase) {
  sqlite.run('DROP TABLE "permission_execution_result"')
  sqlite.run('DROP TABLE "permission_ledger"')
  sqlite.run('DROP TABLE "permission_policy"')
  sqlite.exec(`CREATE TABLE "permission" (
  "project_id" text PRIMARY KEY NOT NULL,
  "time_created" integer NOT NULL,
  "time_updated" integer NOT NULL,
  "data" text NOT NULL,
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE
)`)
}

function restoreLegacyProjectSchema(sqlite: BunDatabase) {
  sqlite.run("PRAGMA foreign_keys = OFF")
  sqlite.run('DROP INDEX "project_generation_idx"')
  sqlite.run('DROP TRIGGER "project_generation_required_insert"')
  sqlite.run('DROP TRIGGER "project_generation_immutable_update"')
  sqlite.run('DROP TABLE "project"')
  sqlite.exec(`CREATE TABLE "project" (
  "id" text PRIMARY KEY NOT NULL,
  "worktree" text NOT NULL,
  "name" text,
  "icon_url" text,
  "icon_color" text,
  "time_created" integer NOT NULL,
  "time_updated" integer NOT NULL,
  "time_pinned" integer,
  "time_initialized" integer,
  "sandboxes" text NOT NULL,
  "commands" text
)`)
  sqlite.run("PRAGMA foreign_keys = ON")
}

function createPredecessorDatabase(databasePath: string, input: { scratchpadContent?: string } = {}) {
  const sqlite = new BunDatabase(databasePath, { create: true })
  sqlite.exec(SCHEMA_DDL)
  dropSchedulerMessageDelivery(sqlite)
  restoreLegacyProjectSchema(sqlite)
  restoreLegacyPermissionSchema(sqlite)
  dropBusPublicationOutbox(sqlite)
  sqlite.run('DROP TABLE "event_job_fire"')
  sqlite.run('DROP TABLE "provider_usage_event"')
  sqlite.run('DROP TABLE "engine_task_cancellation_authority"')
  const memoryChunkTable = requiredSchemaSQL(sqlite, "table", "memory_chunk")
  const memoryEmbeddingTable = requiredSchemaSQL(sqlite, "table", "memory_embedding")
  const memoryChunkFileIndex = requiredSchemaSQL(sqlite, "index", "memory_chunk_file_idx")
  const memoryChunkProjectIndex = requiredSchemaSQL(sqlite, "index", "memory_chunk_project_idx")

  sqlite.run("PRAGMA foreign_keys = OFF")
  sqlite.run('DROP TABLE "engine_workflow_node_occurrence"')
  sqlite.run('DROP TABLE "engine_browser_preview_target_identity"')
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
    `INSERT INTO project (id, worktree, name, time_created, time_updated, sandboxes)
     VALUES ('project-b', 'C:/project-b', 'Project B', 1, 1, '[]')`,
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
    expect(plan?.migrations.map((migration) => migration.id)).toEqual([
      "2026-08-06-project-memory-single-scope",
      "2026-08-08-browser-preview-target-identity",
      "2026-08-09-workflow-node-occurrence-authority",
      "2026-08-10-task-cancellation-authority",
      "2026-08-11-event-job-fire-authority",
      "2026-08-11-bus-publication-outbox-authority",
      "2026-08-11-bus-publication-durable-retry-backoff",
      "2026-08-11-provider-usage-ledger",
      "2026-08-12-permission-two-mode-authority",
      "2026-08-12-project-generation-authority",
      "2026-08-12-scheduler-message-delivery",
    ])

    const result = migrateDatabaseFile(databasePath, plan!, preparedBackup)
    expect(result).toMatchObject({
      fromFingerprint: PREDECESSOR_FINGERPRINT,
      toFingerprint: CURRENT_FINGERPRINT,
      migrationIDs: [
        "2026-08-06-project-memory-single-scope",
        "2026-08-08-browser-preview-target-identity",
        "2026-08-09-workflow-node-occurrence-authority",
        "2026-08-10-task-cancellation-authority",
        "2026-08-11-event-job-fire-authority",
        "2026-08-11-bus-publication-outbox-authority",
        "2026-08-11-bus-publication-durable-retry-backoff",
        "2026-08-11-provider-usage-ledger",
        "2026-08-12-permission-two-mode-authority",
        "2026-08-12-project-generation-authority",
        "2026-08-12-scheduler-message-delivery",
      ],
    })

    const migrated = new BunDatabase(databasePath, { readonly: true })
    expect(schemaObjectFingerprint(migrated)).toBe(currentSchemaFingerprint())
    expect(currentSchemaFingerprint()).toBe(CURRENT_FINGERPRINT)
    const generations = migrated.query<{ generation: string }, []>("SELECT generation FROM project ORDER BY id").all()
    expect({ count: generations.length, unique: new Set(generations.map((row) => row.generation)).size }).toEqual({
      count: 2,
      unique: 2,
    })
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
      migrationIDs: [
        "2026-08-06-project-memory-single-scope",
        "2026-08-08-browser-preview-target-identity",
        "2026-08-09-workflow-node-occurrence-authority",
        "2026-08-10-task-cancellation-authority",
        "2026-08-11-event-job-fire-authority",
        "2026-08-11-bus-publication-outbox-authority",
        "2026-08-11-bus-publication-durable-retry-backoff",
        "2026-08-11-provider-usage-ledger",
        "2026-08-12-permission-two-mode-authority",
        "2026-08-12-project-generation-authority",
        "2026-08-12-scheduler-message-delivery",
      ],
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

  test("projects the latest persisted Browser Preview target into its canonical identity authority", async () => {
    const databasePath = await temporaryDatabasePath()
    const predecessor = new BunDatabase(databasePath, { create: true })
    predecessor.exec(SCHEMA_DDL)
    dropSchedulerMessageDelivery(predecessor)
    restoreLegacyProjectSchema(predecessor)
    restoreLegacyPermissionSchema(predecessor)
    dropBusPublicationOutbox(predecessor)
    predecessor.run('DROP TABLE "event_job_fire"')
    predecessor.run('DROP TABLE "provider_usage_event"')
    predecessor.run('DROP TABLE "engine_task_cancellation_authority"')
    predecessor.run('DROP TABLE "engine_workflow_node_occurrence"')
    predecessor.run('DROP TABLE "engine_browser_preview_target_identity"')
    const artifactInsertGuard = requiredSchemaSQL(predecessor, "trigger", "engine_artifact_catalog_metadata_insert")
    predecessor.run('DROP TRIGGER "engine_artifact_catalog_metadata_insert"')
    predecessor.run(
      `INSERT INTO project (id, worktree, name, time_created, time_updated, sandboxes)
       VALUES ('project-browser', 'C:/project-browser', 'Browser project', 1, 1, '[]')`,
    )
    predecessor.run(
      `INSERT INTO engine_task (
         id, project_id, product_pillar, title, request, time_created, time_updated
       ) VALUES ('task-browser', 'project-browser', 'code', 'Browser task', 'Browser task', 1, 1)`,
    )
    predecessor.run(`INSERT INTO engine_artifact_catalog_revision (revision) VALUES (1)`)
    predecessor.run(
      `INSERT INTO engine_artifact (
         id, task_id, kind, label, payload, payload_block_sha256s,
         payload_block_index_sha256, catalog_metadata_sha256, catalog_revision,
         time_created, time_updated
       ) VALUES (
         'artifact-browser', 'task-browser', 'browser_preview_target', 'BrowserPreviewTarget',
         '{"url":"http://localhost:3000/App?Mode=Dev#Top","source":"engine-artifact","viewports":[{"id":"desktop","labelKey":"desktop","width":1280,"height":720}]}',
         '[]', 'block-index', 'catalog-metadata', 1, 1, 2
       )`,
    )
    predecessor.exec(artifactInsertGuard)
    expect(schemaObjectFingerprint(predecessor)).toBe(
      "b8d6df10b9f174560b1ee2c90b10b87e039ef375c61b0ccdc8463d9d6c7ed9fd",
    )
    const plan = planSchemaMigration(predecessor)
    const preparedBackup = createSchemaMigrationBackup(databasePath, plan!)
    predecessor.close(true)

    const result = migrateDatabaseFile(databasePath, plan!, preparedBackup)
    const migrated = new BunDatabase(databasePath, { readonly: true })
    expect(migrated.query("SELECT * FROM engine_browser_preview_target_identity").all()).toEqual([
      {
        task_id: "task-browser",
        canonical_url: "http://localhost:3000/App?Mode=Dev#Top",
        artifact_id: "artifact-browser",
      },
    ])
    expect(migrated.query("PRAGMA foreign_key_check").all()).toEqual([])
    expect(migrated.query("PRAGMA integrity_check").all()).toEqual([{ integrity_check: "ok" }])
    migrated.close(true)
    const backup = new BunDatabase(path.join(result.backupDirectory, "opencorvus.db"), { readonly: true })
    expect(backup.query("SELECT id, payload FROM engine_artifact").all()).toEqual([
      {
        id: "artifact-browser",
        payload:
          '{"url":"http://localhost:3000/App?Mode=Dev#Top","source":"engine-artifact","viewports":[{"id":"desktop","labelKey":"desktop","width":1280,"height":720}]}',
      },
    ])
    backup.close(true)
  })

  test("migrates one logical workflow occurrence as bound and preserves duplicate initials as conflicted", async () => {
    const databasePath = await temporaryDatabasePath()
    const predecessor = new BunDatabase(databasePath, { create: true })
    predecessor.exec(SCHEMA_DDL)
    dropSchedulerMessageDelivery(predecessor)
    restoreLegacyProjectSchema(predecessor)
    restoreLegacyPermissionSchema(predecessor)
    dropBusPublicationOutbox(predecessor)
    predecessor.run('DROP TABLE "event_job_fire"')
    predecessor.run('DROP TABLE "provider_usage_event"')
    predecessor.run('DROP TABLE "engine_task_cancellation_authority"')
    predecessor.run('DROP TABLE "engine_workflow_node_occurrence"')
    const artifactInsertGuard = requiredSchemaSQL(predecessor, "trigger", "engine_artifact_catalog_metadata_insert")
    predecessor.run('DROP TRIGGER "engine_artifact_catalog_metadata_insert"')
    predecessor.run(
      `INSERT INTO project (id, worktree, name, time_created, time_updated, sandboxes)
       VALUES ('project-workflow', 'C:/project-workflow', 'Workflow project', 1, 1, '[]')`,
    )
    for (const sessionID of ["session-root", "session-research", "session-valuation-a", "session-valuation-b"]) {
      predecessor.run(
        `INSERT INTO session (
           id, project_id, slug, directory, title, version, kind, time_created, time_updated
         ) VALUES (?, 'project-workflow', ?, 'C:/project-workflow', ?, 'test', 'delegated-worker', 1, 1)`,
        [sessionID, sessionID, sessionID],
      )
    }
    predecessor.run(
      `INSERT INTO engine_task (
         id, project_id, session_id, product_pillar, title, request, time_created, time_updated
       ) VALUES (
         'task-workflow', 'project-workflow', 'session-root', 'work',
         'Workflow task', 'Test workflow migration', 1, 1
       )`,
    )
    const workflowBinding = {
      kind: "virtual_workflow",
      workflow_id: "research-workflow",
      package_revision: {
        scope: "built_in",
        project_id: null,
        namespace: "builtin",
        id: "research",
        version: "2026.08.09.1",
        package_digest: "d".repeat(64),
      },
      nodes: [
        { node_id: "research", agent_id: "researcher", depends_on: [] },
        { node_id: "valuation", agent_id: "analyst", depends_on: [] },
      ],
    }
    const lineages = [
      {
        id: "lineage-research-initial",
        dispatchID: "dispatch-research",
        occurrenceID: "dispatch-research",
        childSessionID: "session-research",
        nodeID: "research",
        time: 10,
      },
      {
        id: "lineage-research-continuation",
        dispatchID: "dispatch-research-followup",
        occurrenceID: "dispatch-research",
        childSessionID: "session-research",
        nodeID: "research",
        time: 11,
      },
      {
        id: "lineage-valuation-a",
        dispatchID: "dispatch-valuation-a",
        occurrenceID: "dispatch-valuation-a",
        childSessionID: "session-valuation-a",
        nodeID: "valuation",
        time: 12,
      },
      {
        id: "lineage-valuation-b",
        dispatchID: "dispatch-valuation-b",
        occurrenceID: "dispatch-valuation-b",
        childSessionID: "session-valuation-b",
        nodeID: "valuation",
        time: 13,
      },
    ]
    for (const [index, lineage] of lineages.entries()) {
      predecessor.run(`INSERT INTO engine_artifact_catalog_revision (revision) VALUES (?)`, [index + 1])
      predecessor.run(
        `INSERT INTO engine_artifact (
           id, task_id, kind, label, payload, payload_block_sha256s,
           payload_block_index_sha256, catalog_metadata_sha256, catalog_revision,
           time_created, time_updated
         ) VALUES (?, 'task-workflow', 'dispatch_lineage', 'DispatchLineage', ?, '[]', ?, ?, ?, ?, ?)`,
        [
          lineage.id,
          JSON.stringify({
            dispatch_id: lineage.dispatchID,
            workflow_occurrence_id: lineage.occurrenceID,
            child_session_id: lineage.childSessionID,
            workflow_binding: workflowBinding,
            workflow_node_id: lineage.nodeID,
            adapter_input: {},
          }),
          `block-${index}`,
          `metadata-${index}`,
          index + 1,
          lineage.time,
          lineage.time,
        ],
      )
    }
    predecessor.exec(artifactInsertGuard)
    expect(schemaObjectFingerprint(predecessor)).toBe(
      "43fb9964d9a3b2bc3d5b17af539bf441d31d0aba1d7eab2a4b8e8c67a88150ea",
    )
    const plan = planSchemaMigration(predecessor)
    const preparedBackup = createSchemaMigrationBackup(databasePath, plan!)
    predecessor.close(true)

    migrateDatabaseFile(databasePath, plan!, preparedBackup)
    const migrated = new BunDatabase(databasePath, { readonly: true })
    const rows = migrated
      .query(
        `SELECT workflow_node_id, state, workflow_occurrence_id, initial_dispatch_id,
                child_session_id, dispatch_lineage_artifact_id, conflict_lineage_ids
         FROM engine_workflow_node_occurrence
         ORDER BY workflow_node_id`,
      )
      .all() as Array<Record<string, unknown>>
    expect(rows).toEqual([
      {
        workflow_node_id: "research",
        state: "bound",
        workflow_occurrence_id: "dispatch-research",
        initial_dispatch_id: "dispatch-research",
        child_session_id: "session-research",
        dispatch_lineage_artifact_id: "lineage-research-initial",
        conflict_lineage_ids: "[]",
      },
      {
        workflow_node_id: "valuation",
        state: "conflicted",
        workflow_occurrence_id: null,
        initial_dispatch_id: null,
        child_session_id: null,
        dispatch_lineage_artifact_id: null,
        conflict_lineage_ids: '["lineage-valuation-a","lineage-valuation-b"]',
      },
    ])
    expect(migrated.query("PRAGMA foreign_key_check").all()).toEqual([])
    expect(migrated.query("PRAGMA integrity_check").all()).toEqual([{ integrity_check: "ok" }])
    migrated.close(true)
  })

  test("backfills one canonical cancellation authority from repeated durable requests", async () => {
    const databasePath = await temporaryDatabasePath()
    const predecessor = new BunDatabase(databasePath, { create: true })
    predecessor.exec(SCHEMA_DDL)
    dropSchedulerMessageDelivery(predecessor)
    restoreLegacyProjectSchema(predecessor)
    restoreLegacyPermissionSchema(predecessor)
    dropBusPublicationOutbox(predecessor)
    predecessor.run('DROP TABLE "event_job_fire"')
    predecessor.run('DROP TABLE "provider_usage_event"')
    predecessor.run('DROP TABLE "engine_task_cancellation_authority"')
    predecessor.run(
      `INSERT INTO project (id, worktree, name, time_created, time_updated, sandboxes)
       VALUES ('project-cancel', 'C:/project-cancel', 'Cancellation project', 1, 1, '[]')`,
    )
    predecessor.run(
      `INSERT INTO engine_task (id, project_id, product_pillar, title, request, time_created, time_updated)
       VALUES ('task-cancel', 'project-cancel', 'code', 'Cancellation task', 'Cancel safely', 1, 1)`,
    )
    for (const [index, eventID] of ["protocol-event-first", "protocol-event-second"].entries()) {
      predecessor.run(
        `INSERT INTO protocol_event (
           id, kind, type, aggregate_type, aggregate_id, task_id, source, seq, order_key,
           emitted_at, payload, time_created, time_updated
         ) VALUES (?, 'event', 'task.cancellation.requested', 'task', 'task-cancel', 'task-cancel',
                   'task.cancel', ?, ?, ?, '{}', ?, ?)`,
        [eventID, index + 1, `order-${index}`, index + 1, index + 1, index + 1],
      )
    }
    expect(schemaObjectFingerprint(predecessor)).toBe(
      "3bb5a088946bab5912f8e640b4d6b14069b4380b07a42aedadfdd54686b329fa",
    )
    const plan = planSchemaMigration(predecessor)!
    const preparedBackup = createSchemaMigrationBackup(databasePath, plan)
    predecessor.close(true)
    migrateDatabaseFile(databasePath, plan, preparedBackup)

    const migrated = new BunDatabase(databasePath, { readonly: true })
    expect(migrated.query("SELECT task_id, request_event_id FROM engine_task_cancellation_authority").all()).toEqual([
      { task_id: "task-cancel", request_event_id: "protocol-event-first" },
    ])
    migrated.close(true)
  })

  test("reopens legacy failed settlement Artifacts as canonical pending resumable work", async () => {
    const databasePath = await temporaryDatabasePath()
    const predecessor = new BunDatabase(databasePath, { create: true })
    predecessor.exec(SCHEMA_DDL)
    dropSchedulerMessageDelivery(predecessor)
    restoreLegacyProjectSchema(predecessor)
    restoreLegacyPermissionSchema(predecessor)
    dropBusPublicationOutbox(predecessor)
    predecessor.run('DROP TABLE "event_job_fire"')
    predecessor.run('DROP TABLE "provider_usage_event"')
    predecessor.run(
      `INSERT INTO project (id, worktree, name, time_created, time_updated, sandboxes)
       VALUES ('project-settlement', 'C:/project-settlement', 'Settlement project', 1, 1, '[]')`,
    )
    predecessor.run(
      `INSERT INTO engine_task (id, project_id, product_pillar, title, request, time_created, time_updated)
       VALUES ('task-settlement', 'project-settlement', 'code', 'Settlement task', 'Settle durably', 1, 1)`,
    )
    predecessor.run(`INSERT INTO engine_artifact_catalog_revision (revision) VALUES (1)`)
    const failure = [{ stage: "checkpoint", error: "injected legacy failure" }]
    const legacyPayload = JSON.stringify({
      task_id: "task-settlement",
      status: "failed",
      attempt: 2,
      failures: failure,
      owner_id: "legacy-owner",
      owner_process_id: 77,
      owner_started_at: 100,
      lease_expires_at: 200,
      time_completed: 300,
      time_requested: 50,
    })
    const zeroDigest = "0".repeat(64)
    predecessor.run(
      `INSERT INTO engine_artifact (
         id, task_id, kind, label, payload, payload_sha256, payload_bytes,
         payload_block_sha256s, payload_block_index_sha256, catalog_metadata_sha256,
         catalog_revision, time_created, time_updated
       ) VALUES (?, 'task-settlement', 'task_checkpoint_settlement', 'failed', ?, ?, ?, ?, ?, ?, 1, 10, 20)`,
      [
        "artifact-settlement",
        legacyPayload,
        zeroDigest,
        Buffer.byteLength(legacyPayload),
        JSON.stringify([zeroDigest]),
        zeroDigest,
        zeroDigest,
      ],
    )
    expect(schemaObjectFingerprint(predecessor)).toBe(
      "10db39feae477909581d186d7eb561feddefcf667f8d6471b4907e71a9a5e515",
    )
    const plan = planSchemaMigration(predecessor)!
    expect(plan.migrations.map((migration) => migration.id)).toEqual([
      "2026-08-11-event-job-fire-authority",
      "2026-08-11-bus-publication-outbox-authority",
      "2026-08-11-bus-publication-durable-retry-backoff",
      "2026-08-11-provider-usage-ledger",
      "2026-08-12-permission-two-mode-authority",
      "2026-08-12-project-generation-authority",
      "2026-08-12-scheduler-message-delivery",
    ])
    const preparedBackup = createSchemaMigrationBackup(databasePath, plan)
    predecessor.close(true)
    migrateDatabaseFile(databasePath, plan, preparedBackup)

    const migrated = new BunDatabase(databasePath, { readonly: true })
    const row = migrated
      .query<
        {
          label: string
          payload: string
          payload_sha256: string
          payload_bytes: number
          catalog_revision: number
        },
        []
      >(
        `SELECT label, payload, payload_sha256, payload_bytes, catalog_revision
         FROM engine_artifact WHERE id = 'artifact-settlement'`,
      )
      .get()!
    expect({ label: row.label, payload: JSON.parse(row.payload), catalogRevision: row.catalog_revision }).toEqual({
      label: "pending",
      payload: {
        task_id: "task-settlement",
        status: "pending",
        attempt: 3,
        time_requested: 50,
        last_failure: failure,
      },
      catalogRevision: 2,
    })
    expect({ bytes: row.payload_bytes, sha256: row.payload_sha256 }).toEqual({
      bytes: Buffer.byteLength(row.payload),
      sha256: new Bun.CryptoHasher("sha256").update(row.payload).digest("hex"),
    })
    expect(
      migrated
        .query(
          "SELECT label, payload, catalog_revision FROM engine_artifact_version WHERE artifact_id = 'artifact-settlement'",
        )
        .all(),
    ).toEqual([{ label: "failed", payload: legacyPayload, catalog_revision: 1 }])
    expect(migrated.query("PRAGMA foreign_key_check").all()).toEqual([])
    expect(migrated.query("PRAGMA integrity_check").all()).toEqual([{ integrity_check: "ok" }])
    migrated.close(true)
  })

  test("preserves pending Bus outbox and every delivery receipt while adding durable retry authority", async () => {
    const databasePath = await temporaryDatabasePath()
    const predecessor = new BunDatabase(databasePath, { create: true })
    predecessor.exec(SCHEMA_DDL)
    dropSchedulerMessageDelivery(predecessor)
    restoreLegacyProjectSchema(predecessor)
    restoreLegacyPermissionSchema(predecessor)
    dropBusPublicationOutbox(predecessor)
    predecessor.run('DROP TABLE "provider_usage_event"')
    predecessor.exec(`CREATE TABLE "bus_publication_outbox" (
  "occurrence_id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "directory" text NOT NULL,
  "event_type" text NOT NULL,
  "properties" text NOT NULL,
  "causation" text,
  "exact_settled" integer NOT NULL DEFAULT 0,
  "wildcard_settled" integer NOT NULL DEFAULT 0,
  "global_settled" integer NOT NULL DEFAULT 0,
  "time_created" integer NOT NULL,
  "time_updated" integer NOT NULL,
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE
);
CREATE INDEX "bus_publication_outbox_project_idx" ON "bus_publication_outbox" ("project_id", "time_created");
CREATE INDEX "bus_publication_outbox_pending_idx" ON "bus_publication_outbox" ("exact_settled", "wildcard_settled", "global_settled");
CREATE TABLE "bus_publication_delivery" (
  "occurrence_id" text NOT NULL,
  "phase" text NOT NULL,
  "subscriber_id" text NOT NULL,
  "durable" integer NOT NULL,
  "settled" integer NOT NULL DEFAULT 0,
  "time_created" integer NOT NULL,
  "time_updated" integer NOT NULL,
  PRIMARY KEY ("occurrence_id", "phase", "subscriber_id"),
  FOREIGN KEY ("occurrence_id") REFERENCES "bus_publication_outbox"("occurrence_id") ON DELETE CASCADE
);
CREATE INDEX "bus_publication_delivery_pending_idx" ON "bus_publication_delivery" ("occurrence_id", "phase", "settled");`)
    predecessor.run(
      `INSERT INTO project (id, worktree, name, time_created, time_updated, sandboxes)
       VALUES ('project-bus-retry', 'C:/project-bus-retry', 'Bus Retry', 1, 1, '[]')`,
    )
    const properties = JSON.stringify({ info: { id: "pending-bus-occurrence" }, nested: [1, 2, 3] })
    const causation = JSON.stringify({
      source: "test.predecessor",
      occurrenceID: "cause-1",
      ancestry: [{ occurrenceID: "root-1", sourceID: "source-1" }],
    })
    predecessor.run(
      `INSERT INTO bus_publication_outbox (
         occurrence_id, project_id, directory, event_type, properties, causation,
         exact_settled, wildcard_settled, global_settled, time_created, time_updated
       ) VALUES (?, 'project-bus-retry', 'C:/project-bus-retry', 'test.bus.pending', ?, ?, 0, 0, 0, 10, 20)`,
      ["bus-occurrence:pending-migration", properties, causation],
    )
    for (const [phase, subscriberID, durable, settled] of [
      ["exact", "exact-settled", 1, 1],
      ["exact", "exact-pending", 1, 0],
      ["wildcard", "wildcard-settled", 0, 1],
      ["wildcard", "wildcard-pending", 1, 0],
      ["global", "global-settled", 1, 1],
      ["global", "global-pending", 1, 0],
    ] as const) {
      predecessor.run(
        `INSERT INTO bus_publication_delivery (
           occurrence_id, phase, subscriber_id, durable, settled, time_created, time_updated
         ) VALUES ('bus-occurrence:pending-migration', ?, ?, ?, ?, 11, 21)`,
        [phase, subscriberID, durable, settled],
      )
    }
    expect(schemaObjectFingerprint(predecessor)).toBe(
      "93cc480799a9788751c55fe87700ee99ef782a3f906693b612632ea67390c765",
    )
    const plan = planSchemaMigration(predecessor)!
    expect(plan.migrations.map((migration) => migration.id)).toEqual([
      "2026-08-11-bus-publication-durable-retry-backoff",
      "2026-08-11-provider-usage-ledger",
      "2026-08-12-permission-two-mode-authority",
      "2026-08-12-project-generation-authority",
      "2026-08-12-scheduler-message-delivery",
    ])
    const preparedBackup = createSchemaMigrationBackup(databasePath, plan)
    predecessor.close(true)
    migrateDatabaseFile(databasePath, plan, preparedBackup)

    const migrated = new BunDatabase(databasePath, { readonly: true })
    expect(
      migrated
        .query(
          `SELECT occurrence_id, project_id, directory, event_type, properties, causation,
                  exact_settled, wildcard_settled, global_settled,
                  time_created, time_updated, attempt_count, next_attempt_at, last_error
           FROM bus_publication_outbox`,
        )
        .all(),
    ).toEqual([
      {
        occurrence_id: "bus-occurrence:pending-migration",
        project_id: "project-bus-retry",
        directory: "C:/project-bus-retry",
        event_type: "test.bus.pending",
        properties,
        causation,
        exact_settled: 0,
        wildcard_settled: 0,
        global_settled: 0,
        time_created: 10,
        time_updated: 20,
        attempt_count: 0,
        next_attempt_at: 0,
        last_error: null,
      },
    ])
    expect(
      migrated
        .query(
          `SELECT occurrence_id, phase, subscriber_id, durable, settled, time_created, time_updated
           FROM bus_publication_delivery ORDER BY phase, subscriber_id`,
        )
        .all(),
    ).toEqual([
      {
        occurrence_id: "bus-occurrence:pending-migration",
        phase: "exact",
        subscriber_id: "exact-pending",
        durable: 1,
        settled: 0,
        time_created: 11,
        time_updated: 21,
      },
      {
        occurrence_id: "bus-occurrence:pending-migration",
        phase: "exact",
        subscriber_id: "exact-settled",
        durable: 1,
        settled: 1,
        time_created: 11,
        time_updated: 21,
      },
      {
        occurrence_id: "bus-occurrence:pending-migration",
        phase: "global",
        subscriber_id: "global-pending",
        durable: 1,
        settled: 0,
        time_created: 11,
        time_updated: 21,
      },
      {
        occurrence_id: "bus-occurrence:pending-migration",
        phase: "global",
        subscriber_id: "global-settled",
        durable: 1,
        settled: 1,
        time_created: 11,
        time_updated: 21,
      },
      {
        occurrence_id: "bus-occurrence:pending-migration",
        phase: "wildcard",
        subscriber_id: "wildcard-pending",
        durable: 1,
        settled: 0,
        time_created: 11,
        time_updated: 21,
      },
      {
        occurrence_id: "bus-occurrence:pending-migration",
        phase: "wildcard",
        subscriber_id: "wildcard-settled",
        durable: 0,
        settled: 1,
        time_created: 11,
        time_updated: 21,
      },
    ])
    expect(migrated.query("PRAGMA foreign_key_check").all()).toEqual([])
    expect(migrated.query("PRAGMA integrity_check").all()).toEqual([{ integrity_check: "ok" }])
    migrated.close(true)
  })

  test("backfills historical Session step usage into the canonical Provider ledger", async () => {
    const databasePath = await temporaryDatabasePath()
    const predecessor = new BunDatabase(databasePath, { create: true })
    predecessor.exec(SCHEMA_DDL)
    dropSchedulerMessageDelivery(predecessor)
    restoreLegacyProjectSchema(predecessor)
    restoreLegacyPermissionSchema(predecessor)
    predecessor.run('DROP TABLE "provider_usage_event"')
    predecessor.run(
      `INSERT INTO project (id, worktree, name, time_created, time_updated, sandboxes)
       VALUES ('project-usage', 'C:/project-usage', 'Usage project', 1, 1, '[]')`,
    )
    predecessor.run(
      `INSERT INTO session (
         id, project_id, slug, directory, title, version, kind, time_created, time_updated
       ) VALUES (
         'ses_usage', 'project-usage', 'usage', 'C:/project-usage', 'Usage', '0.0.38-beta', 'assistant', 1, 1
       )`,
    )
    predecessor.run(
      `INSERT INTO message (id, session_id, time_created, time_updated, data)
       VALUES (
         'msg_usage', 'ses_usage', 100, 100,
         '{"role":"assistant","providerID":"openai","modelID":"gpt-5"}'
       )`,
    )
    predecessor.run(
      `INSERT INTO part (id, message_id, session_id, time_created, time_updated, data)
       VALUES (
         'prt_usage', 'msg_usage', 'ses_usage', 101, 101,
         '{"type":"step-finish","tokens":{"input":100,"output":30,"reasoning":5,"cache":{"read":20,"write":2},"total":157},"cost":0.0123,"billing":{"status":"priced"}}'
       )`,
    )
    expect(schemaObjectFingerprint(predecessor)).toBe(
      "84af4e18ec989a211a7ee4dc574b535fce8cfbb7237eb73feb549a82ace1b058",
    )
    const plan = planSchemaMigration(predecessor)
    predecessor.close(true)
    expect(plan?.migrations.map((migration) => migration.id)).toEqual([
      "2026-08-11-provider-usage-ledger",
      "2026-08-12-permission-two-mode-authority",
      "2026-08-12-project-generation-authority",
      "2026-08-12-scheduler-message-delivery",
    ])

    const preparedBackup = createSchemaMigrationBackup(databasePath, plan!)
    const result = migrateDatabaseFile(databasePath, plan!, preparedBackup)
    const migrated = new BunDatabase(databasePath, { readonly: true })
    expect(migrated.query("SELECT * FROM provider_usage_event").all()).toEqual([
      {
        id: "pvu_legacy_prt_usage",
        occurred_at: 101,
        provider_id: "openai",
        model_id: "gpt-5",
        purpose: "session",
        input_tokens: 100,
        output_tokens: 30,
        reasoning_tokens: 5,
        cache_read_tokens: 20,
        cache_write_tokens: 2,
        total_tokens: 157,
        cost_usd: 0.0123,
        billing_status: "priced",
        source_ref: "prt_usage",
      },
    ])
    expect(result.toFingerprint).toBe(CURRENT_FINGERPRINT)
    migrated.close(true)
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
