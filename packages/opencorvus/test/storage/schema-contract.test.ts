import { expect, test } from "bun:test"
import { Database as BunDatabase } from "bun:sqlite"
import fs from "node:fs"
import { ApplicationSchemaRegistryError, collectTables, SCHEMA_DDL, tableName } from "../../src/storage/ddl"
import { ApplicationSchema, ProjectTable } from "../../src/storage/schema"
import {
  deriveEngineArtifactCatalogMetadata,
  engineArtifactCatalogMetadataSHA256,
} from "../../src/engine/artifact-catalog-metadata"
import { engineArtifactCatalogLabelIndex } from "../../src/engine/artifact-catalog-constants"
import { readSchemaObjectShape } from "../../src/storage/schema-contract"
import { DATABASE_MIGRATIONS } from "../../src/storage/migrations"
import { createTestDatabase, editTestDatabase } from "../fixture/db"
import { canonicalTaskCreationContract, taskCreationContractFingerprint } from "../../src/engine/task-creation-contract"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { prepareTaskProcessBinding } from "../../src/engine/task-execution-capsule-binding"
import {
  TASK_EXECUTION_CAPSULE_BINDING_PROTOCOL,
  TaskExecutionCapsuleBindingPayloadSchema,
} from "../../src/engine/task-creation-facts"
import {
  TASK_PROCESS_BINDING_INVALID_INDEX,
  TASK_PROCESS_BINDING_INVALID_SQL,
} from "../../src/engine/task-process-binding-contract"
import { persistEstablishedTask } from "../fixture/engine-task"
import { memoryProject } from "../fixture/memory"

test("creates the complete current schema directly from the canonical DDL", () => {
  const sqlite = new BunDatabase(":memory:")
  try {
    sqlite.exec(SCHEMA_DDL)
    sqlite.run("PRAGMA foreign_keys=ON")
    const requiredObjects = [
      "bus_publication_delivery",
      "bus_publication_outbox",
      "engine_browser_preview_target_identity",
      "engine_control_activation_lease",
      "engine_task_root_ingress",
      TASK_PROCESS_BINDING_INVALID_INDEX,
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
    sqlite
      .query(
        `INSERT INTO engine_task_creation_contract(task_id,fingerprint,contract,time_created)
       VALUES(?,?,?,?)`,
      )
      .run("claim-task", taskCreationContractFingerprint(request), JSON.stringify(contract), 1)
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
      sqlite
        .query<{ payload: string }, []>("SELECT payload FROM engine_channel_binding WHERE id='claim-channel'")
        .get(),
    ).toEqual({ payload: '{"revision":1}' })

    const beforeDelete = sqlite.query<{ changes: number }, []>("SELECT total_changes() AS changes").get()!.changes
    expect(sqlite.query("DELETE FROM project WHERE id='claim-project' RETURNING id").all()).toEqual([
      { id: "claim-project" },
    ])
    expect(sqlite.query<{ changes: number }, []>("SELECT total_changes() AS changes").get()!.changes - beforeDelete).toBe(4)
  } finally {
    sqlite.close()
  }
})

test("uses one explicit application table registry for the canonical SQLite schema", () => {
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

test("reports the required migration for a current-version database missing a canonical fact table", async () => {
  const { Database, DatabaseUnavailableError } = await import("../../src/storage/db")
  try {
    await createTestDatabase()
    editTestDatabase((sqlite) => sqlite.run('DROP TABLE "permission_execution_result"'))
    expect(() => Database.Client()).toThrow(
      expect.objectContaining<InstanceType<typeof DatabaseUnavailableError>>({
        name: "DatabaseUnavailableError",
        data: expect.objectContaining({ code: "SCHEMA_MIGRATION_REQUIRED" }),
      }),
    )
  } finally {
    await createTestDatabase()
  }
})

test("reports the required migration for a current-version database missing its Project fence", async () => {
  const { Database, DatabaseUnavailableError } = await import("../../src/storage/db")
  try {
    await createTestDatabase()
    editTestDatabase((sqlite) => sqlite.run('DROP TABLE "project_maintenance_fence"'))
    expect(() => Database.Client()).toThrow(
      expect.objectContaining<InstanceType<typeof DatabaseUnavailableError>>({
        name: "DatabaseUnavailableError",
        data: expect.objectContaining({ code: "SCHEMA_MIGRATION_REQUIRED" }),
      }),
    )
  } finally {
    await createTestDatabase()
  }
})

test("preserves an unknown application table with an explicit migration-required error", async () => {
  const { Database, DatabaseUnavailableError } = await import("../../src/storage/db")
  try {
    await createTestDatabase()
    editTestDatabase((sqlite) => sqlite.run('CREATE TABLE "a2a_task_queue" ("id" text PRIMARY KEY NOT NULL)'))
    let captured: unknown
    try {
      Database.Client()
    } catch (error) {
      captured = error
    }
    expect(DatabaseUnavailableError.isInstance(captured)).toBe(true)
    if (!DatabaseUnavailableError.isInstance(captured)) return
    expect(captured.data).toMatchObject({
      operation: "Database.Client.schemaMigration",
      code: "SCHEMA_MIGRATION_REQUIRED",
    })
    expect(captured.data.message).toContain("unexpected schema object table:a2a_task_queue")
  } finally {
    await createTestDatabase()
  }
})

test("preserves the exact current-version database when its schema needs an undeclared migration", async () => {
  const { Database, DatabaseUnavailableError } = await import("../../src/storage/db")
  try {
    await createTestDatabase()
    editTestDatabase((sqlite) => {
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
      .query<{ id: string; worktree: string }, []>(`SELECT id,worktree FROM project WHERE id='reset-boundary-project'`)
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
      operation: "Database.Client.schemaMigration",
      code: "SCHEMA_MIGRATION_REQUIRED",
    })
    expect(captured.data.message).toContain("project_maintenance_fence")
    expect(captured.data.message).toContain("versioned migration is required")
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
          .query<
            { id: string; worktree: string },
            []
          >(`SELECT id,worktree FROM project WHERE id='reset-boundary-project'`)
          .get(),
      }).toEqual({ shape: beforeShape, project: beforeProject })
    } finally {
      after.close(true)
    }
  } finally {
    await createTestDatabase()
  }
})

test("reports the migration-required contract for an undeclared WAL-backed table", async () => {
  const { Database, DatabaseUnavailableError } = await import("../../src/storage/db")
  let writer: BunDatabase | undefined
  try {
    await createTestDatabase()
    Database.close()
    writer = new BunDatabase(Database.Path())
    writer.run("PRAGMA journal_mode=WAL")
    writer.run("PRAGMA wal_autocheckpoint=0")
    writer.run('CREATE TABLE "stale_epoch_fact" ("id" text PRIMARY KEY NOT NULL)')
    writer.run("INSERT INTO stale_epoch_fact(id) VALUES('stale')")
    const walPath = `${Database.Path()}-wal`
    expect(fs.existsSync(walPath)).toBe(true)
    expect(() => Database.Client()).toThrow(
      expect.objectContaining<InstanceType<typeof DatabaseUnavailableError>>({
        name: "DatabaseUnavailableError",
        data: expect.objectContaining({ code: "SCHEMA_MIGRATION_REQUIRED" }),
      }),
    )
  } finally {
    writer?.close(false)
    await createTestDatabase()
  }
})

test("reopens a freshly reset database with the exact current schema", async () => {
  const { Database } = await import("../../src/storage/db")
  try {
    await createTestDatabase()
    editTestDatabase((sqlite) => sqlite.run('DROP TABLE "permission_execution_result"'))
    await Database.resetFiles(Database.Path())
    Database.Client()
    Database.close()
    const sqlite = new BunDatabase(Database.Path(), { readonly: true })
    const reference = new BunDatabase(":memory:")
    try {
      reference.exec(DATABASE_MIGRATIONS.at(-1)!.ddl)
      expect([...readSchemaObjectShape(sqlite)]).toEqual([...readSchemaObjectShape(reference)])
    } finally {
      reference.close(true)
      sqlite.close(true)
    }
  } finally {
    await createTestDatabase()
  }
})

async function persistProcessBindingEpochTask(mode: "native" | "capsule") {
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
  const native = await prepareTaskProcessBinding({
    mode: "native",
    taskID,
    projectID: Instance.project.id,
    rootDirectory: Instance.directory,
    packageRevisionSHA256: packageRevision.packageDigest,
    timeCreated: now,
  })
  if (native.protocol !== "task-native-process-binding-v2") throw new Error("Expected native binding fixture")
  const executionCapsuleBinding =
    mode === "native"
      ? native
      : TaskExecutionCapsuleBindingPayloadSchema.parse({
          protocol: TASK_EXECUTION_CAPSULE_BINDING_PROTOCOL,
          task_id: taskID,
          project_id: Instance.project.id,
          package_revision_sha256: packageRevision.packageDigest,
          runtime_descriptor_sha256: "b".repeat(64),
          runtime_identity_sha256: "c".repeat(64),
          logical_workspace_root: native.logical_workspace_root,
          workspace: {
            root: native.workspace_root,
            initial_tree_sha256: native.initial_tree_sha256,
            access: "read_write",
          },
          network: "none",
          resources: {
            memory_max_bytes: 1_073_741_824,
            tasks_max: 128,
            nofile_max: 1024,
            tmpfs_max_bytes: 268_435_456,
            cpu_quota_percent: 100,
          },
          time_created: now,
        })
  persistEstablishedTask({
    taskID,
    rootSession: Session.prepareRootNext({
      kind: "root",
      directory: Instance.directory,
      title: `Task process-binding ${mode} epoch`,
    }),
    now,
    title: `Task process-binding ${mode} epoch`,
    request: `Prove the current ${mode} process-binding database epoch`,
    productPillar: "code",
    source: "test",
    metadata: { actor: "user" },
    projectID: Instance.project.id,
    packageRevision,
    executionCapsuleBinding,
  })
  return taskID
}

function rewriteProcessBindingPayload(input: {
  databasePath: string
  taskID: string
  mutate: (payload: Record<string, unknown>) => void
}) {
  const sqlite = new BunDatabase(input.databasePath)
  try {
    const row = sqlite
      .query<
        {
          id: string
          task_id: string
          kind: string
          label: string
          payload: string
          time_created: number
          time_updated: number
        },
        [string]
      >(
        `SELECT id,task_id,kind,label,payload,time_created,time_updated
         FROM engine_artifact
         WHERE task_id=? AND kind='task_execution_capsule_binding'`,
      )
      .get(input.taskID)
    if (!row) throw new Error(`Task ${input.taskID} process binding was not persisted`)
    const triggers = sqlite
      .query<{ name: string; sql: string }, []>(
        `SELECT name,sql FROM sqlite_schema
         WHERE type='trigger' AND tbl_name IN ('engine_artifact','engine_artifact_version')
         ORDER BY name`,
      )
      .all()
    for (const trigger of triggers) sqlite.run(`DROP TRIGGER "${trigger.name}"`)
    const payload = JSON.parse(row.payload) as Record<string, unknown>
    input.mutate(payload)
    const payloadText = JSON.stringify(payload)
    const derived = deriveEngineArtifactCatalogMetadata({ kind: row.kind, payloadText })
    const metadataSHA256 = engineArtifactCatalogMetadataSHA256({
      artifact_id: row.id,
      task_id: row.task_id,
      kind: row.kind,
      label_index: engineArtifactCatalogLabelIndex(row.label),
      time_created: row.time_created,
      time_updated: row.time_updated,
      ...derived,
    })
    sqlite
      .query(
        `UPDATE engine_artifact SET
           payload=?,payload_sha256=?,payload_bytes=?,payload_block_sha256s=?,payload_block_index_sha256=?,
           catalog_artifact_type=?,catalog_schema_diagnostic=?,catalog_producer=?,catalog_import_source_task_id=?,
           catalog_resource_count=?,catalog_resource_media_types=?,catalog_search_text=?,
           catalog_search_text_truncated=?,catalog_metadata_sha256=?
         WHERE id=?`,
      )
      .run(
        payloadText,
        derived.payload_sha256,
        derived.payload_bytes,
        JSON.stringify(derived.payload_block_sha256s),
        derived.payload_block_index_sha256,
        derived.catalog_artifact_type,
        derived.catalog_schema_diagnostic,
        derived.catalog_producer ? JSON.stringify(derived.catalog_producer) : null,
        derived.catalog_import_source_task_id,
        derived.catalog_resource_count,
        JSON.stringify(derived.catalog_resource_media_types),
        derived.catalog_search_text,
        Number(derived.catalog_search_text_truncated),
        metadataSHA256,
        row.id,
      )
    for (const trigger of triggers) sqlite.run(trigger.sql)
  } finally {
    sqlite.close(true)
  }
}

test("reopens production Native and Capsule v2 bindings through the indexed current epoch", async () => {
  const { Database } = await import("../../src/storage/db")
  try {
    await createTestDatabase()
    await using project = await memoryProject("task-process-binding-current-epoch")
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await persistProcessBindingEpochTask("native")
        await persistProcessBindingEpochTask("capsule")
        await Database.awaitEffectIdle(10_000)

        const databaseIdentity = Database.Identity()
        Database.close()
        expect(Database.Identity()).toBe(databaseIdentity)
        Database.close()
        expect(Database.Identity()).toBe(databaseIdentity)
        Database.close()

        const sqlite = new BunDatabase(Database.Path(), { readonly: true })
        try {
          const plan = sqlite
            .query<{ detail: string }, []>(
              `EXPLAIN QUERY PLAN
               SELECT id
               FROM engine_artifact INDEXED BY ${TASK_PROCESS_BINDING_INVALID_INDEX}
               WHERE ${TASK_PROCESS_BINDING_INVALID_SQL}
               ORDER BY id
               LIMIT 1`,
            )
            .all()
          expect(plan.map((row) => row.detail).join("\n")).toContain(TASK_PROCESS_BINDING_INVALID_INDEX)
          expect(
            sqlite
              .query<
                { count: number },
                []
              >(`SELECT count(*) AS count FROM engine_artifact WHERE kind='task_execution_capsule_binding'`)
              .get()?.count,
          ).toBe(2)
        } finally {
          sqlite.close(true)
        }
      },
    })
  } finally {
    await createTestDatabase()
  }
})

test("reports a data-migration contract for a v1 Task process binding", async () => {
  const { Database, DatabaseUnavailableError } = await import("../../src/storage/db")
  try {
    await createTestDatabase()
    await using project = await memoryProject("task-process-binding-epoch")
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const taskID = await persistProcessBindingEpochTask("native")
        await Database.awaitEffectIdle(10_000)
        Database.close()
        rewriteProcessBindingPayload({
          databasePath: Database.Path(),
          taskID,
          mutate(payload) {
            payload.protocol = "task-native-process-binding-v1"
            delete payload.logical_workspace_root
          },
        })

        let observed: unknown
        try {
          Database.Client()
        } catch (error) {
          observed = error
        }
        expect(DatabaseUnavailableError.isInstance(observed) ? observed.data : undefined).toMatchObject({
          code: "DATA_MIGRATION_REQUIRED",
          operation: "Database.Client.dataIntegrity.taskProcessBindingEpoch",
          message: expect.stringContaining("task-native-process-binding-v1"),
        })
      },
    })
  } finally {
    await createTestDatabase()
  }
})

test(
  "reports data-integrity errors for structurally invalid recognized v2 Native and Capsule bindings",
  { timeout: 15_000 },
  async () => {
    const { Database, DatabaseUnavailableError } = await import("../../src/storage/db")
    for (const mode of ["native", "capsule"] as const) {
      try {
        await createTestDatabase()
        await using project = await memoryProject(`invalid-${mode}-process-binding`)
        await Instance.provide({
          directory: project.path,
          fn: async () => {
            const taskID = await persistProcessBindingEpochTask(mode)
            await Database.awaitEffectIdle(10_000)
            Database.close()
            rewriteProcessBindingPayload({
              databasePath: Database.Path(),
              taskID,
              mutate(payload) {
                if (mode === "native") delete payload.project_id
                else delete payload.resources
              },
            })

            let observed: unknown
            try {
              Database.Client()
            } catch (error) {
              observed = error
            }
            expect(DatabaseUnavailableError.isInstance(observed) ? observed.data : undefined).toMatchObject({
              code: "DATA_INTEGRITY_ERROR",
              operation: "Database.Client.dataIntegrity.taskProcessBindingEpoch",
              message: expect.stringContaining(
                mode === "native" ? "task-native-process-binding-v2" : TASK_EXECUTION_CAPSULE_BINDING_PROTOCOL,
              ),
            })
          },
        })
      } finally {
        await createTestDatabase()
      }
    }
  },
)

test("gracefully retires a settled connection with a retained completed prepared query", async () => {
  const { Database } = await import("../../src/storage/db")
  await createTestDatabase()
  const project = {
    id: "prj_retained_query", worktree: "D:/retained-query", generation: crypto.randomUUID(),
    sandboxes: ["已提交的项目"], time_created: 1, time_updated: 1,
  }
  Database.use((db) => db.insert(ProjectTable).values(project).run())
  const retainedQuery = Database.Client().select().from(ProjectTable).prepare()
  try {
    const committed = retainedQuery.all()
    expect(committed).toEqual([expect.objectContaining(project)])
    Database.close()
    expect(Database.use((db) => db.select().from(ProjectTable).all())).toEqual(committed)
    Database.close()
  } finally {
    retainedQuery.finalize()
    await createTestDatabase()
  }
})
