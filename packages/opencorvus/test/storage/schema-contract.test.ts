import { expect, test } from "bun:test"
import { Database as BunDatabase } from "bun:sqlite"
import fs from "node:fs"
import { eq } from "drizzle-orm"
import { ApplicationSchemaRegistryError, collectTables, SCHEMA_DDL, tableName } from "../../src/storage/ddl"
import { ApplicationSchema, ProjectTable } from "../../src/storage/schema"
import {
  deriveEngineArtifactCatalogMetadata,
  engineArtifactCatalogMetadataSHA256,
} from "../../src/engine/artifact-catalog-metadata"
import { engineArtifactCatalogLabelIndex } from "../../src/engine/artifact-catalog-constants"
import {
  currentSchemaFingerprint,
  findSchemaDrift,
  hasApplicationSchema,
  schemaObjectFingerprint,
} from "../../src/storage/schema-contract"
import { rebuildTestDatabase } from "../fixture/db"
import {
  exportMysqlTransferSnapshot,
  importMysqlTransferSnapshot,
  MysqlTransferValidationError,
  mysqlSchemaFingerprint,
  preflightMysqlTransferSnapshot,
} from "../../src/storage/mysql-transfer"
import {
  canonicalTaskCreationContract,
  taskCreationContractFingerprint,
} from "../../src/engine/task-creation-contract"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { prepareTaskProcessBinding } from "../../src/engine/task-execution-capsule-binding"
import { persistEstablishedTask } from "../fixture/engine-task"
import { memoryProject } from "../fixture/memory"
import { MemoryChunkTable, MemoryEmbeddingTable, MemoryFileTable } from "../../src/memory/memory.sql"
import { Server } from "../../src/server/server"
import { TestHooks as TaskControlTestHooks } from "../../src/engine/task-root-ingress-delivery"
import { restartTaskControlProjectFrontier } from "../../src/engine/task-root-ingress-disposition"

test("creates the complete pre-0.1.0 schema directly from the canonical DDL", () => {
  const sqlite = new BunDatabase(":memory:")
  try {
    sqlite.exec(SCHEMA_DDL)
    sqlite.run("PRAGMA foreign_keys=ON")
    expect(hasApplicationSchema(sqlite)).toBe(true)
    expect(findSchemaDrift(sqlite)).toBeUndefined()
    expect(schemaObjectFingerprint(sqlite)).toBe(currentSchemaFingerprint())
    const requiredObjects = [
      "bus_publication_delivery",
      "bus_publication_outbox",
      "engine_browser_preview_target_identity",
      "engine_control_activation_lease",
      "engine_task_root_ingress",
      "event_job_fire",
      "permission_execution_result",
      "protocol_delivery_receipt",
      "project_generation_idx",
      "project_generation_immutable_update",
      "project_generation_required_insert",
      "provider_usage_event",
      "provider_activity_request",
      "runtime_execution_capacity_lease",
      "tool_part_request",
      "tool_part_progress",
    ]
    expect(
      sqlite
        .query<{ name: string }, [string]>(
          `SELECT name FROM sqlite_schema WHERE name IN (${requiredObjects.map(() => "?").join(",")}) ORDER BY name`,
        )
        .all(...requiredObjects)
        .map((row) => row.name),
    ).toEqual([...requiredObjects].sort())
    const projectSql = sqlite
      .query<{ sql: string }, []>(`SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = 'project'`)
      .get()?.sql
    const usageSql = sqlite
      .query<
        { sql: string },
        []
      >(`SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = 'provider_usage_event'`)
      .get()?.sql
    expect(projectSql).toContain('"generation" text NOT NULL')
    expect(usageSql).toContain('"billing_status" text NOT NULL')
    expect(
      sqlite
        .query<{ name: string }, []>(`PRAGMA table_info("memory_file")`)
        .all()
        .map((column) => column.name),
    ).toEqual([
      "id",
      "project_id",
      "title",
      "source",
      "kind",
      "key",
      "importance",
      "confidence",
      "time_created",
      "time_updated",
    ])
    sqlite.run(
      `INSERT INTO project (id, worktree, sandboxes, generation, time_created, time_updated)
       VALUES ('project-schema-contract', 'D:/schema-contract', '[]', '6d68d8c3-d9d2-40fb-bef1-a41d6fd58e7e', 1, 1)`,
    )
    expect(
      sqlite
        .query<{ generation: string }, []>(`SELECT generation FROM project WHERE id = 'project-schema-contract'`)
        .get()?.generation,
    ).toBe("6d68d8c3-d9d2-40fb-bef1-a41d6fd58e7e")
    let invalidGeneration: unknown
    try {
      sqlite.run(
        `INSERT INTO project (id, worktree, sandboxes, generation, time_created, time_updated)
         VALUES ('project-invalid-generation', 'D:/schema-contract-invalid', '[]', 'zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz', 1, 1)`,
      )
    } catch (error) {
      invalidGeneration = error
    }
    expect(invalidGeneration).toBeInstanceOf(Error)
    expect(String((invalidGeneration as Error).message)).toContain("project: generation must be a UUID")
    let extraSeparatorGeneration: unknown
    try {
      sqlite.run(
        `INSERT INTO project (id, worktree, sandboxes, generation, time_created, time_updated)
         VALUES ('project-extra-separator-generation', 'D:/schema-contract-extra-separator', '[]', '6-68d8c3-d9d2-40fb-bef1-a41d6fd58e7e', 1, 1)`,
      )
    } catch (error) {
      extraSeparatorGeneration = error
    }
    expect(extraSeparatorGeneration).toBeInstanceOf(Error)
    expect(String((extraSeparatorGeneration as Error).message)).toContain("project: generation must be a UUID")
    let invalidVariantGeneration: unknown
    try {
      sqlite.run(
        `INSERT INTO project (id, worktree, sandboxes, generation, time_created, time_updated)
         VALUES ('project-invalid-variant-generation', 'D:/schema-contract-invalid-variant', '[]', '11111111-1111-1111-1111-111111111111', 1, 1)`,
      )
    } catch (error) {
      invalidVariantGeneration = error
    }
    expect(invalidVariantGeneration).toBeInstanceOf(Error)
    expect(String((invalidVariantGeneration as Error).message)).toContain("project: generation must be a UUID")
    let uppercaseMaxGeneration: unknown
    try {
      sqlite.run(
        `INSERT INTO project (id, worktree, sandboxes, generation, time_created, time_updated)
         VALUES ('project-uppercase-max-generation', 'D:/schema-contract-uppercase-max', '[]', 'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF', 1, 1)`,
      )
    } catch (error) {
      uppercaseMaxGeneration = error
    }
    expect(uppercaseMaxGeneration).toBeInstanceOf(Error)
    expect(String((uppercaseMaxGeneration as Error).message)).toContain("project: generation must be a UUID")
  } finally {
    sqlite.close(true)
  }
})

test("accepted Task request, channel, and creation-contract claims are immutable until owner retention", () => {
  const sqlite = new BunDatabase(":memory:")
  try {
    sqlite.exec(SCHEMA_DDL)
    sqlite.run("PRAGMA foreign_keys=ON")
    sqlite.run(
      `INSERT INTO project(id,worktree,sandboxes,generation,time_created,time_updated)
       VALUES('claim-project','C:/claim-project','[]','22222222-2222-4222-8222-222222222222',1,1)`,
    )
    sqlite.run(
      `INSERT INTO engine_task(
         id,project_id,request_id,source,product_pillar,title,request,priority,time_created
       ) VALUES('claim-task','claim-project','claim-request','api','code','Claim','Claim','normal',1)`,
    )
    const request = canonicalTaskCreationContract({
      protocol: "task-create-request-v1",
      input: { request: "Claim", creator: { actor: "user" } },
    })
    const contract = canonicalTaskCreationContract({
      protocol: "task-creation-contract-v2",
      request,
      resolved: {},
    })
    sqlite.query(
      `INSERT INTO engine_task_creation_contract(task_id,fingerprint,contract,time_created)
       VALUES(?,?,?,?)`,
    ).run("claim-task", taskCreationContractFingerprint(request), JSON.stringify(contract), 1)
    sqlite.run(
      `INSERT INTO engine_channel_binding(
         id,task_id,platform,channel,thread,payload,time_created,time_updated
       ) VALUES('claim-channel','claim-task','slack','channel','thread','{"revision":1}',1,1)`,
    )

    expect(() => sqlite.run("UPDATE engine_task SET request_id='other' WHERE id='claim-task'")).toThrow(
      "engine_task: accepted request identity is append-only",
    )
    expect(() => sqlite.run("UPDATE engine_task SET request_id=NULL WHERE id='claim-task'")).toThrow(
      "engine_task: accepted request identity is append-only",
    )
    expect(() => sqlite.run("UPDATE engine_channel_binding SET payload='{}' WHERE id='claim-channel'")).toThrow(
      "engine_channel_binding: immutable accepted channel claim",
    )
    expect(() => sqlite.run("DELETE FROM engine_channel_binding WHERE id='claim-channel'")).toThrow(
      "engine_channel_binding: immutable accepted channel claim",
    )
    expect(() => sqlite.run("DELETE FROM engine_task_creation_contract WHERE task_id='claim-task'")).toThrow(
      "engine_task_creation_contract: immutable accepted contract",
    )
    expect(
      sqlite.query<{ request_id: string }, []>("SELECT request_id FROM engine_task WHERE id='claim-task'").get(),
    ).toEqual({ request_id: "claim-request" })
    expect(
      sqlite.query<{ payload: string }, []>("SELECT payload FROM engine_channel_binding WHERE id='claim-channel'").get(),
    ).toEqual({ payload: '{"revision":1}' })

    sqlite.run("DELETE FROM project WHERE id='claim-project'")
    expect(sqlite.query("SELECT id FROM engine_task WHERE id='claim-task'").get()).toBeNull()
    expect(sqlite.query("SELECT task_id FROM engine_task_creation_contract WHERE task_id='claim-task'").get()).toBeNull()
    expect(sqlite.query("SELECT id FROM engine_channel_binding WHERE id='claim-channel'").get()).toBeNull()
  } finally {
    sqlite.close()
  }
})

test("uses one explicit application table registry for SQLite and transfer shapes", () => {
  const registeredNames = Object.entries(ApplicationSchema)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, table]) => ({ key, name: tableName(table) }))
  expect(new Set(registeredNames.map((entry) => entry.key)).size).toBe(registeredNames.length)
  expect(new Set(registeredNames.map((entry) => entry.name)).size).toBe(registeredNames.length)
  expect(collectTables().map(tableName)).toEqual(registeredNames.map((entry) => entry.name))

  const sqlite = new BunDatabase(":memory:")
  try {
    sqlite.exec(SCHEMA_DDL)
    const physicalTableNames = sqlite
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'memory_fts%' ORDER BY name",
      )
      .all()
      .map((row) => row.name)
    expect(physicalTableNames).toEqual(registeredNames.map((entry) => entry.name).sort())
  } finally {
    sqlite.close(true)
  }

  try {
    rebuildTestDatabase()
    const snapshot = exportMysqlTransferSnapshot()
    expect(mysqlSchemaFingerprint()).toBe(currentSchemaFingerprint())
    expect(snapshot.tables.map((table) => table.name)).toEqual(
      registeredNames.map((entry) => entry.name).filter((name) => name !== "database_authority"),
    )
    expect(snapshot.tables.map((table) => table.name).sort()).toEqual(
      registeredNames
        .map((entry) => entry.name)
        .filter((name) => name !== "database_authority")
        .sort(),
    )
  } finally {
    rebuildTestDatabase()
  }
})

test("reports invalid and duplicate application schema declarations", () => {
  expect(() => collectTables({ BrokenTable: {} as never })).toThrow(
    expect.objectContaining<ApplicationSchemaRegistryError>({
      name: "ApplicationSchemaRegistryError",
      kind: "invalid_table",
      registryKey: "BrokenTable",
    }),
  )
  expect(() => collectTables({ ProjectAliasTable: ProjectTable, ProjectTable })).toThrow(
    expect.objectContaining<ApplicationSchemaRegistryError>({
      name: "ApplicationSchemaRegistryError",
      kind: "duplicate_table_name",
      registryKey: "ProjectTable",
      tableName: "project",
    }),
  )
})

test("requires an explicit reset when any canonical fact table is missing", async () => {
  const { Database, DatabaseUnavailableError } = await import("../../src/storage/db")
  try {
    rebuildTestDatabase()
    Database.rebuildSqlite((sqlite) => sqlite.run('DROP TABLE "permission_execution_result"'))
    expect(() => Database.Client()).toThrow(expect.objectContaining<InstanceType<typeof DatabaseUnavailableError>>({
      name: "DatabaseUnavailableError",
      data: expect.objectContaining({ code: "SCHEMA_RESET_REQUIRED" }),
    }))
  } finally {
    rebuildTestDatabase()
  }
})

test("requires an explicit reset instead of adding a missing Project fence", async () => {
  const { Database, DatabaseUnavailableError } = await import("../../src/storage/db")
  try {
    rebuildTestDatabase()
    Database.rebuildSqlite((sqlite) => sqlite.run('DROP TABLE "project_maintenance_fence"'))
    expect(() => Database.Client()).toThrow(expect.objectContaining<InstanceType<typeof DatabaseUnavailableError>>({
      name: "DatabaseUnavailableError",
      data: expect.objectContaining({ code: "SCHEMA_RESET_REQUIRED" }),
    }))
  } finally {
    rebuildTestDatabase()
  }
})

test("returns the reset-required contract for an unexpected legacy application table", async () => {
  const { Database, DatabaseUnavailableError } = await import("../../src/storage/db")
  try {
    rebuildTestDatabase()
    Database.rebuildSqlite((sqlite) => sqlite.run('CREATE TABLE "a2a_task_queue" ("id" text PRIMARY KEY NOT NULL)'))
    let captured: unknown
    try {
      Database.Client()
    } catch (error) {
      captured = error
    }
    expect(DatabaseUnavailableError.isInstance(captured)).toBe(true)
    if (!DatabaseUnavailableError.isInstance(captured)) return
    expect(captured.data).toMatchObject({
      operation: "Database.Client.schemaValidation",
      code: "SCHEMA_RESET_REQUIRED",
    })
    expect(captured.data.message).toContain("unexpected schema object table:a2a_task_queue")
  } finally {
    rebuildTestDatabase()
  }
})

test("rejects cross-owned creation and unrelated schema drift before any mutation", async () => {
  const { Database, DatabaseUnavailableError } = await import("../../src/storage/db")
  try {
    rebuildTestDatabase()
    Database.rebuildSqlite((sqlite) => {
      sqlite.run(
        `INSERT INTO project(id,worktree,sandboxes,generation,time_created,time_updated)
         VALUES('reset-boundary-project','C:/reset-boundary','[]','33333333-3333-4333-8333-333333333333',1,1)`,
      )
      sqlite.run('DROP TRIGGER "session_panel_creation_lineage_insert"')
      sqlite.run('DROP TABLE "project_maintenance_fence"')
    })
    const before = new BunDatabase(Database.Path(), { readonly: true })
    const beforeShape = before
      .query<{ type: string; name: string; tbl_name: string; sql: string | null }, []>(
        `SELECT type,name,tbl_name,sql FROM sqlite_schema
         WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name`,
      )
      .all()
    const beforeProject = before
      .query<{ id: string; worktree: string }, []>(
        `SELECT id,worktree FROM project WHERE id='reset-boundary-project'`,
      )
      .get()
    before.close(false)
    let captured: unknown
    try {
      Database.Client()
    } catch (error) {
      captured = error
    }
    expect(DatabaseUnavailableError.isInstance(captured)).toBe(true)
    if (!DatabaseUnavailableError.isInstance(captured)) return
    expect(captured.data).toMatchObject({
      operation: "Database.Client.schemaValidation",
      code: "SCHEMA_RESET_REQUIRED",
    })
    expect(captured.data.message).toContain("project_maintenance_fence")
    expect(captured.data.message).toContain("reset it")
    const after = new BunDatabase(Database.Path(), { readonly: true })
    try {
      expect({
        shape: after
          .query<{ type: string; name: string; tbl_name: string; sql: string | null }, []>(
            `SELECT type,name,tbl_name,sql FROM sqlite_schema
             WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name`,
          )
          .all(),
        project: after
          .query<{ id: string; worktree: string }, []>(
            `SELECT id,worktree FROM project WHERE id='reset-boundary-project'`,
          )
          .get(),
      }).toEqual({ shape: beforeShape, project: beforeProject })
    } finally {
      after.close(true)
    }
  } finally {
    rebuildTestDatabase()
  }
})

test("probes a stale WAL-backed schema without changing the database or WAL bytes", async () => {
  const { Database, DatabaseUnavailableError } = await import("../../src/storage/db")
  let writer: BunDatabase | undefined
  try {
    rebuildTestDatabase()
    Database.close()
    writer = new BunDatabase(Database.Path())
    writer.run("PRAGMA journal_mode=WAL")
    writer.run("PRAGMA wal_autocheckpoint=0")
    writer.run('CREATE TABLE "stale_epoch_fact" ("id" text PRIMARY KEY NOT NULL)')
    writer.run("INSERT INTO stale_epoch_fact(id) VALUES('stale')")
    const walPath = `${Database.Path()}-wal`
    expect(fs.existsSync(walPath)).toBe(true)
    const before = {
      database: fs.readFileSync(Database.Path()),
      wal: fs.readFileSync(walPath),
    }
    expect(() => Database.Client()).toThrow(
      expect.objectContaining<InstanceType<typeof DatabaseUnavailableError>>({
        name: "DatabaseUnavailableError",
        data: expect.objectContaining({ code: "SCHEMA_RESET_REQUIRED" }),
      }),
    )
    expect({
      database: fs.readFileSync(Database.Path()),
      wal: fs.readFileSync(walPath),
    }).toEqual(before)
  } finally {
    writer?.close(false)
    rebuildTestDatabase()
  }
})

test("reopens a freshly reset database with the exact current schema", async () => {
  const { Database } = await import("../../src/storage/db")
  try {
    rebuildTestDatabase()
    Database.rebuildSqlite((sqlite) => sqlite.run('DROP TABLE "permission_execution_result"'))
    await Database.resetFiles(Database.Path())
    Database.Client()
    Database.close()
    const sqlite = new BunDatabase(Database.Path(), { readonly: true })
    try {
      expect(hasApplicationSchema(sqlite)).toBe(true)
      expect(findSchemaDrift(sqlite)).toBeUndefined()
      expect(schemaObjectFingerprint(sqlite)).toBe(currentSchemaFingerprint())
    } finally {
      sqlite.close(true)
    }
  } finally {
    rebuildTestDatabase()
  }
})

test("round-trips one production-written current Task through the strict transfer contract", async () => {
  const { Database } = await import("../../src/storage/db")
  try {
    rebuildTestDatabase()
    await using project = await memoryProject("current-transfer-contract")
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const taskID = Identifier.ascending("task")
        const now = Date.now()
        const packageRevision = {
          scope: "built_in" as const,
          projectID: null,
          namespace: "builtin",
          id: "base",
          version: "2026.08.31.1",
          packageDigest: "a".repeat(64),
        }
        const rootSession = Session.prepareRootNext({
          kind: "root",
          directory: Instance.directory,
          title: "Current transfer contract",
        })
        persistEstablishedTask({
          taskID,
          rootSession,
          now,
          title: "Current transfer contract",
          request: "Transfer one complete current Task aggregate",
          productPillar: "code",
          source: "test",
          metadata: { actor: "user" },
          projectID: Instance.project.id,
          packageRevision,
          executionCapsuleBinding: await prepareTaskProcessBinding({
            mode: "native",
            taskID,
            projectID: Instance.project.id,
            rootDirectory: Instance.directory,
            packageRevisionSHA256: packageRevision.packageDigest,
            timeCreated: now,
          }),
        })
        await Database.awaitEffectIdle(10_000)
        Database.use((db) => {
          db.insert(MemoryFileTable).values({
            id: "memfile_transfer_blob",
            project_id: Instance.project.id,
            title: "Transfer blob",
            source: "agent",
            kind: "note",
            importance: 60,
            confidence: 75,
            time_created: now,
            time_updated: now,
          }).run()
          db.insert(MemoryChunkTable).values({
            id: "memchunk_transfer_blob",
            file_id: "memfile_transfer_blob",
            project_id: Instance.project.id,
            content: "canonical base64",
            token_count: 2,
            time_created: now,
            time_updated: now,
          }).run()
          db.insert(MemoryEmbeddingTable).values({
            chunk_id: "memchunk_transfer_blob",
            embedding: Buffer.from([0, 1, 2, 253, 254, 255]),
            model: "test-embedding",
            time_created: now,
            time_updated: now,
          }).run()
          db.insert(MemoryChunkTable).values({
            id: "memchunk_transfer_empty_blob",
            file_id: "memfile_transfer_blob",
            project_id: Instance.project.id,
            content: "empty canonical base64",
            token_count: 3,
            time_created: now,
            time_updated: now,
          }).run()
          db.insert(MemoryEmbeddingTable).values({
            chunk_id: "memchunk_transfer_empty_blob",
            embedding: Buffer.alloc(0),
            model: "test-embedding",
            time_created: now,
            time_updated: now,
          }).run()
        })

        const frontierBeforeImport = TaskControlTestHooks.currentProjectFrontierSlice()
        expect(frontierBeforeImport.taskIDs).toContain(taskID)
        const preImportCursor = restartTaskControlProjectFrontier(frontierBeforeImport.checkpoint)
        const snapshot = exportMysqlTransferSnapshot()
        const plan = preflightMysqlTransferSnapshot(snapshot)
        expect(plan.schemaFingerprint).toBe(snapshot.schemaFingerprint)
        const rejectedOuterEnvelope = await Server.App().request("/global/db/mysql/import", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ snapshot, alternateRequestContract: true }),
        })
        expect({ status: rejectedOuterEnvelope.status, body: await rejectedOuterEnvelope.json() }).toMatchObject({
          status: 400,
          body: {
            success: false,
            error: [{ code: "unrecognized_keys", keys: ["alternateRequestContract"], path: [] }],
          },
        })
        expect(exportMysqlTransferSnapshot()).toEqual(snapshot)
        const emptyEmbedding = snapshot.tables
          .find((table) => table.name === "memory_embedding")
          ?.rows.find((row) => row.chunk_id === "memchunk_transfer_empty_blob")
        expect(emptyEmbedding?.embedding).toEqual({ opencorvusType: "blobBase64", base64: "" })

        const staleEpoch = structuredClone(snapshot)
        const staleSchema = new BunDatabase(":memory:")
        try {
          staleSchema.exec(SCHEMA_DDL)
          staleSchema.run('DROP TRIGGER "global_creation_allocation_acceptance_write_once"')
          staleEpoch.schemaFingerprint = schemaObjectFingerprint(staleSchema)
        } finally {
          staleSchema.close(false)
        }
        expect(() => preflightMysqlTransferSnapshot(staleEpoch)).toThrow(
          expect.objectContaining<MysqlTransferValidationError>({
            name: "MysqlTransferValidationError",
            data: expect.objectContaining({ message: expect.stringContaining("schema fingerprint mismatch") }),
          }),
        )

        const duplicateTable = structuredClone(snapshot)
        duplicateTable.tables.push(structuredClone(duplicateTable.tables[0]!))
        expect(() => preflightMysqlTransferSnapshot(duplicateTable)).toThrow(
          expect.objectContaining<MysqlTransferValidationError>({
            name: "MysqlTransferValidationError",
            data: expect.objectContaining({ message: "Duplicate table in MySQL transfer snapshot" }),
          }),
        )

        const unknownTopLevel = structuredClone(snapshot)
        ;(unknownTopLevel as unknown as Record<string, unknown>).alternateContract = true
        expect(() => preflightMysqlTransferSnapshot(unknownTopLevel)).toThrow(
          expect.objectContaining<MysqlTransferValidationError>({
            name: "MysqlTransferValidationError",
            data: expect.objectContaining({ message: expect.stringContaining("alternateContract") }),
          }),
        )

        const unknownTableField = structuredClone(snapshot)
        ;(unknownTableField.tables[0] as unknown as Record<string, unknown>).alternateTableContract = true
        expect(() => preflightMysqlTransferSnapshot(unknownTableField)).toThrow(
          expect.objectContaining<MysqlTransferValidationError>({
            name: "MysqlTransferValidationError",
            data: expect.objectContaining({ message: expect.stringContaining("alternateTableContract") }),
          }),
        )

        const malformedBlobValues = ["!!!=", "AAE", "AAECA/3+/w===", "AAECA_3-_w=="]
        for (const malformed of malformedBlobValues) {
          const malformedBlob = structuredClone(snapshot)
          const embedding = malformedBlob.tables
            .find((table) => table.name === "memory_embedding")
            ?.rows.find((row) => row.chunk_id === "memchunk_transfer_blob")
          if (!embedding) throw new Error("Transfer snapshot omitted the canonical BLOB fixture")
          embedding.embedding = { opencorvusType: "blobBase64", base64: malformed }
          expect(() => preflightMysqlTransferSnapshot(malformedBlob)).toThrow(
            expect.objectContaining<MysqlTransferValidationError>({
              name: "MysqlTransferValidationError",
              data: expect.objectContaining({
                message: expect.stringContaining("expected canonical padded base64 payload"),
              }),
            }),
          )
        }

        const unknownBlobField = structuredClone(snapshot)
        const unknownBlob = unknownBlobField.tables
          .find((table) => table.name === "memory_embedding")
          ?.rows.find((row) => row.chunk_id === "memchunk_transfer_blob")
        if (!unknownBlob) throw new Error("Transfer snapshot omitted the canonical BLOB fixture")
        unknownBlob.embedding = {
          ...(unknownBlob.embedding as Record<string, unknown>),
          alternateBlobContract: true,
        }
        expect(() => preflightMysqlTransferSnapshot(unknownBlobField)).toThrow(
          expect.objectContaining<MysqlTransferValidationError>({
            name: "MysqlTransferValidationError",
            data: expect.objectContaining({ message: expect.stringContaining("alternateBlobContract") }),
          }),
        )

        const incomplete = structuredClone(snapshot)
        const incompleteContracts = incomplete.tables.find(
          (table) => table.name === "engine_task_creation_contract",
        )
        if (!incompleteContracts) throw new Error("Transfer snapshot omitted the Task creation contract table")
        incompleteContracts.rows = []
        expect(() => preflightMysqlTransferSnapshot(incomplete)).toThrow(
          expect.objectContaining<MysqlTransferValidationError>({
            name: "MysqlTransferValidationError",
            data: expect.objectContaining({
              message: `Task ${taskID} is missing its current creation contract`,
            }),
          }),
        )

        const divergent = structuredClone(snapshot)
        const divergentContract = divergent.tables
          .find((table) => table.name === "engine_task_creation_contract")
          ?.rows.find((row) => row.task_id === taskID)
        if (!divergentContract) throw new Error("Transfer snapshot omitted the exact Task creation contract row")
        divergentContract.time_created = now + 1
        expect(() => preflightMysqlTransferSnapshot(divergent)).toThrow(
          expect.objectContaining<MysqlTransferValidationError>({
            name: "MysqlTransferValidationError",
            data: expect.objectContaining({
              message: `Task ${taskID} creation contract has a divergent acceptance time`,
            }),
          }),
        )

        const malformedProcess = structuredClone(snapshot)
        const processArtifact = malformedProcess.tables
          .find((table) => table.name === "engine_artifact")
          ?.rows.find((row) => row.task_id === taskID && row.kind === "task_execution_capsule_binding")
        if (!processArtifact) throw new Error("Transfer snapshot omitted the exact Task process binding")
        const processPayload = JSON.parse(String(processArtifact.payload)) as Record<string, unknown>
        processPayload.project_id = "prj_wrong_transfer_owner"
        const serializedProcess = JSON.stringify(processPayload)
        const derived = deriveEngineArtifactCatalogMetadata({
          kind: "task_execution_capsule_binding",
          payloadText: serializedProcess,
        })
        Object.assign(processArtifact, {
          payload: serializedProcess,
          payload_sha256: derived.payload_sha256,
          payload_bytes: derived.payload_bytes,
          payload_block_sha256s: JSON.stringify(derived.payload_block_sha256s),
          payload_block_index_sha256: derived.payload_block_index_sha256,
          catalog_artifact_type: derived.catalog_artifact_type,
          catalog_schema_diagnostic: derived.catalog_schema_diagnostic,
          catalog_resource_count: derived.catalog_resource_count,
          catalog_resource_media_types: JSON.stringify(derived.catalog_resource_media_types),
          catalog_search_text: derived.catalog_search_text,
          catalog_search_text_truncated: Number(derived.catalog_search_text_truncated),
          catalog_producer: derived.catalog_producer ? JSON.stringify(derived.catalog_producer) : null,
          catalog_import_source_task_id: derived.catalog_import_source_task_id,
        })
        processArtifact.catalog_metadata_sha256 = engineArtifactCatalogMetadataSHA256({
          artifact_id: String(processArtifact.id),
          task_id: String(processArtifact.task_id),
          kind: "task_execution_capsule_binding",
          label_index: engineArtifactCatalogLabelIndex(String(processArtifact.label)),
          time_created: Number(processArtifact.time_created),
          time_updated: Number(processArtifact.time_updated),
          ...derived,
        })
        expect(() => preflightMysqlTransferSnapshot(malformedProcess)).toThrow(
          expect.objectContaining<MysqlTransferValidationError>({
            name: "MysqlTransferValidationError",
            data: expect.objectContaining({
              message: expect.stringContaining(
                `Task ${taskID} package/process binding diverges from its accepted aggregate`,
              ),
            }),
          }),
        )

        const partialCreator = structuredClone(snapshot)
        const partialContractRow = partialCreator.tables
          .find((table) => table.name === "engine_task_creation_contract")
          ?.rows.find((row) => row.task_id === taskID)
        if (!partialContractRow) throw new Error("Transfer snapshot omitted the exact Task creation contract row")
        const partialContract = JSON.parse(String(partialContractRow.contract)) as Record<string, any>
        const partialAuthority = {
          actor: "control_agent",
          session_id: "ses_missing_creator",
          message_id: "msg_partial_creator",
        }
        partialContract.request.input.creator = partialAuthority
        partialContract.resolved.creator = partialAuthority
        partialContractRow.contract = JSON.stringify(partialContract)
        partialContractRow.fingerprint = taskCreationContractFingerprint(partialContract.request)
        expect(() => preflightMysqlTransferSnapshot(partialCreator)).toThrow(
          expect.objectContaining<MysqlTransferValidationError>({
            name: "MysqlTransferValidationError",
            data: expect.objectContaining({
              message: expect.stringContaining("Persisted Task creator Tool authority requires"),
            }),
          }),
        )

        const missingCreatorSession = structuredClone(snapshot)
        const missingCreatorContractRow = missingCreatorSession.tables
          .find((table) => table.name === "engine_task_creation_contract")
          ?.rows.find((row) => row.task_id === taskID)
        const missingCreatorTaskRow = missingCreatorSession.tables
          .find((table) => table.name === "engine_task")
          ?.rows.find((row) => row.id === taskID)
        if (!missingCreatorContractRow || !missingCreatorTaskRow) {
          throw new Error("Transfer snapshot omitted the Task creator aggregate")
        }
        const missingCreatorContract = JSON.parse(String(missingCreatorContractRow.contract)) as Record<string, any>
        const missingAuthority = { actor: "control_agent", session_id: "ses_missing_creator" }
        missingCreatorContract.request.input.creator = missingAuthority
        missingCreatorContract.resolved.creator = missingAuthority
        missingCreatorContractRow.contract = JSON.stringify(missingCreatorContract)
        missingCreatorContractRow.fingerprint = taskCreationContractFingerprint(missingCreatorContract.request)
        missingCreatorTaskRow.metadata = JSON.stringify({ actor: "control_agent", actor_session_id: "ses_missing_creator" })
        expect(() => preflightMysqlTransferSnapshot(missingCreatorSession)).toThrow(
          expect.objectContaining<MysqlTransferValidationError>({
            name: "MysqlTransferValidationError",
            data: expect.objectContaining({ message: `Task ${taskID} creator Session authority is not current` }),
          }),
        )

        const changedIngress = structuredClone(snapshot)
        const initialIngress = changedIngress.tables
          .find((table) => table.name === "engine_task_root_ingress")
          ?.rows.find((row) => row.task_id === taskID && row.execution_epoch === 1 && row.sequence === 1)
        if (!initialIngress) throw new Error("Transfer snapshot omitted the initial Task ingress")
        initialIngress.inline_payload = JSON.stringify({ changed: true })
        expect(() => preflightMysqlTransferSnapshot(changedIngress)).toThrow(
          expect.objectContaining<MysqlTransferValidationError>({
            name: "MysqlTransferValidationError",
            data: expect.objectContaining({ message: `Task ${taskID} has no exact initial root ingress` }),
          }),
        )

        const changedIngressPolicy = structuredClone(snapshot)
        const policyID = changedIngressPolicy.tables
          .find((table) => table.name === "engine_task_root_ingress")
          ?.rows.find((row) => row.task_id === taskID && row.execution_epoch === 1 && row.sequence === 1)?.policy_id
        const policy = changedIngressPolicy.tables
          .find((table) => table.name === "engine_task_root_ingress_policy")
          ?.rows.find((row) => row.id === policyID)
        if (!policy) throw new Error("Transfer snapshot omitted the initial Task ingress policy")
        policy.activation_limit = 5
        expect(() => preflightMysqlTransferSnapshot(changedIngressPolicy)).toThrow(
          expect.objectContaining<MysqlTransferValidationError>({
            name: "MysqlTransferValidationError",
            data: expect.objectContaining({ message: `Task ${taskID} has no exact initial root ingress` }),
          }),
        )

        const missingAllocation = structuredClone(snapshot)
        const markedTask = missingAllocation.tables
          .find((table) => table.name === "engine_task")
          ?.rows.find((row) => row.id === taskID)
        if (!markedTask) throw new Error("Transfer snapshot omitted the exact Task row")
        markedTask.global_creation_allocation_id = "gca_missing_current_allocation"
        expect(() => preflightMysqlTransferSnapshot(missingAllocation)).toThrow(
          expect.objectContaining<MysqlTransferValidationError>({
            name: "MysqlTransferValidationError",
            data: expect.objectContaining({
              message: `Global Task ${taskID} is missing its accepted allocation`,
            }),
          }),
        )

        const result = importMysqlTransferSnapshot(snapshot)
        expect(result).toMatchObject({
          ok: true,
          schemaFingerprint: snapshot.schemaFingerprint,
          tables: expect.arrayContaining([
            { name: "engine_task_creation_contract", rows: 1 },
            { name: "engine_task_root_ingress", rows: 1 },
          ]),
        })
        expect(TaskControlTestHooks.currentProjectFrontierSlice(preImportCursor).taskIDs).toContain(
          taskID,
        )
        expect(
          Database.use((db) =>
            db
              .select({ embedding: MemoryEmbeddingTable.embedding })
              .from(MemoryEmbeddingTable)
              .where(eq(MemoryEmbeddingTable.chunk_id, "memchunk_transfer_empty_blob"))
              .get()?.embedding,
          ),
        ).toEqual(Buffer.alloc(0))
      },
    })
  } finally {
    rebuildTestDatabase()
  }
}, 30_000)
