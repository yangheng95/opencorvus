import { expect, test } from "bun:test"
import { Database as BunDatabase } from "bun:sqlite"
import { ApplicationSchemaRegistryError, collectTables, SCHEMA_DDL, tableName } from "../../src/storage/ddl"
import { ApplicationSchema, ProjectTable } from "../../src/storage/schema"
import { PermissionExecutionResultTable } from "../../src/permission/permission.sql"
import {
  currentSchemaFingerprint,
  findSchemaDrift,
  hasApplicationSchema,
  reconcileSchemaTriggers,
  schemaObjectFingerprint,
} from "../../src/storage/schema-contract"
import { rebuildTestDatabase } from "../fixture/db"
import {
  exportMysqlTransferSnapshot,
  importMysqlTransferSnapshot,
  mysqlSchemaFingerprint,
  preflightMysqlTransferSnapshot,
} from "../../src/storage/mysql-transfer"

test("creates the complete pre-0.1.0 schema directly from the canonical DDL", () => {
  const sqlite = new BunDatabase(":memory:")
  try {
    sqlite.exec(SCHEMA_DDL)
    expect(hasApplicationSchema(sqlite)).toBe(true)
    expect(findSchemaDrift(sqlite)).toBeUndefined()
    expect(schemaObjectFingerprint(sqlite)).toBe(currentSchemaFingerprint())
    const requiredObjects = [
      "bus_publication_delivery",
      "bus_publication_outbox",
      "engine_browser_preview_target_identity",
      "engine_control_activation_lease",
      "engine_task_root_ingress",
      "engine_workflow_node_occurrence",
      "event_job_fire",
      "permission_execution_result",
      "protocol_delivery_receipt",
      "project_generation_idx",
      "project_generation_immutable_update",
      "project_generation_required_insert",
      "provider_usage_event",
      "provider_activity_request",
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

test("reconciles a stale immutable-evidence trigger before Project deletion", () => {
  const sqlite = new BunDatabase(":memory:")
  try {
    sqlite.exec(SCHEMA_DDL)
    sqlite.exec(`
      PRAGMA foreign_keys=ON;
      DROP TRIGGER permission_policy_no_delete;
      CREATE TRIGGER permission_policy_no_delete
      BEFORE DELETE ON permission_policy FOR EACH ROW
      BEGIN SELECT RAISE(ABORT, 'permission_policy: immutable policy fact'); END;
      INSERT INTO project
        (id,worktree,name,icon_url,icon_color,time_created,time_updated,time_pinned,time_initialized,sandboxes,commands,generation)
      VALUES ('project:trigger-upgrade','D:/trigger-upgrade','trigger upgrade',NULL,NULL,1,1,NULL,NULL,'[]',NULL,'6d68d8c3-d9d2-40fb-bef1-a41d6fd58e7e');
      INSERT INTO permission_policy(session_id,project_id,mode,revision,time_created)
      VALUES ('session:trigger-upgrade','project:trigger-upgrade','ask','revision:trigger-upgrade',2);
    `)

    const reconciled = reconcileSchemaTriggers(sqlite)
    sqlite.run(`DELETE FROM project WHERE id='project:trigger-upgrade'`)
    expect({
      reconciled,
      drift: findSchemaDrift(sqlite),
      remaining: sqlite
        .query<{ projects: number; policies: number }, []>(
          `
          SELECT
            (SELECT count(*) FROM project) AS projects,
            (SELECT count(*) FROM permission_policy) AS policies
        `,
        )
        .get(),
    }).toEqual({
      reconciled: ["permission_policy_no_delete"],
      drift: undefined,
      remaining: { projects: 0, policies: 0 },
    })
  } finally {
    sqlite.close(true)
  }
})

test("keeps a partial structural schema on the reset-required path before trigger reconciliation", () => {
  const sqlite = new BunDatabase(":memory:")
  try {
    sqlite.exec(`CREATE TABLE project(id TEXT PRIMARY KEY)`)
    expect({
      reconciled: reconcileSchemaTriggers(sqlite),
      drift: findSchemaDrift(sqlite),
    }).toEqual({
      reconciled: [],
      drift: expect.stringMatching(/^missing schema object (index|table):/),
    })
  } finally {
    sqlite.close(true)
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
    expect(mysqlSchemaFingerprint()).toBe("e64133cdf27574a8f59f81c8f0b3c0d1df239dcb4eb47387164eac0d9ad7bac3")
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

test("restores a missing canonical fact table before opening the database", async () => {
  const { Database } = await import("../../src/storage/db")
  try {
    rebuildTestDatabase()
    Database.rebuildSqlite((sqlite) => sqlite.run('DROP TABLE "permission_execution_result"'))
    Database.Client()
    expect(Database.use((db) => db.select().from(PermissionExecutionResultTable).all())).toEqual([])
  } finally {
    rebuildTestDatabase()
  }
})

test("adds the Project maintenance fence to an existing current database", async () => {
  const { Database } = await import("../../src/storage/db")
  const { ProjectMaintenanceFenceTable } = await import("../../src/project/project.sql")
  try {
    rebuildTestDatabase()
    Database.rebuildSqlite((sqlite) => sqlite.run('DROP TABLE "project_maintenance_fence"'))
    Database.Client()
    expect(Database.use((db) => db.select().from(ProjectMaintenanceFenceTable).all())).toEqual([])
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

test("round-trips the current pre-release schema through the strict transfer contract", () => {
  try {
    rebuildTestDatabase()
    const snapshot = exportMysqlTransferSnapshot()
    const plan = preflightMysqlTransferSnapshot(snapshot)
    expect(plan.schemaFingerprint).toBe(snapshot.schemaFingerprint)
    const result = importMysqlTransferSnapshot(snapshot)
    expect(result.ok).toBe(true)
    expect(result.schemaFingerprint).toBe(snapshot.schemaFingerprint)
    expect(result.tables.every((table) => table.rows === 0)).toBe(true)
  } finally {
    rebuildTestDatabase()
  }
})
