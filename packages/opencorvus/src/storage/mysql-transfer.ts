import { Database as BunDatabase } from "bun:sqlite"
import { SQL } from "drizzle-orm"
import { getTableConfig } from "drizzle-orm/sqlite-core"
import { Buffer } from "node:buffer"
import z from "zod"
import { NamedError } from "@opencorvus-ai/util/error"
import {
  deriveEngineArtifactCatalogMetadata,
  engineArtifactCatalogMetadataSHA256,
} from "@/engine/artifact-catalog-metadata"
import { engineArtifactCatalogLabelIndex } from "@/engine/artifact-catalog-constants"
import { Recurrence } from "@/scheduler/recurrence"
import { HOST_OWNED_MEMORY_KINDS } from "@/memory/types"
import type { EngineArtifactKind } from "@/engine/engine.sql"
import { collectTables, SCHEMA_DDL, tableName } from "./ddl"
import { Database, queryAllFinalized } from "./db"
import { validateTaskCreationIdentitySnapshot } from "./task-creation-identity-validation"
import { currentSchemaFingerprint, restoreCurrentTransferTriggers } from "./schema-contract"
import { decodeCanonicalBase64Payload } from "@/util/base64"
import { canonicalJSONValue } from "@/util/canonical-digest"

export const MYSQL_TRANSFER_FORMAT = "opencorvus.mysql-transfer.v2" as const

const BlobCell = z
  .object({
    opencorvusType: z.literal("blobBase64"),
    base64: z.string(),
  })
  .strict()

export const MysqlTransferTableSnapshot = z
  .object({
    name: z.string(),
    columns: z.array(z.string()),
    rows: z.array(z.record(z.string(), z.unknown())),
  })
  .strict()

export const MysqlTransferSnapshot = z
  .object({
    format: z.literal(MYSQL_TRANSFER_FORMAT),
    schemaFingerprint: z.string(),
    tables: z.array(MysqlTransferTableSnapshot),
  })
  .strict()

export type MysqlTransferSnapshot = z.infer<typeof MysqlTransferSnapshot>

export const MysqlTransferSchemaExport = z
  .object({
    format: z.literal(MYSQL_TRANSFER_FORMAT),
    schemaFingerprint: z.string(),
    mysqlDDL: z.string(),
    tables: z.array(z.object({ name: z.string(), columns: z.array(z.string()) }).strict()),
    derivedTables: z.array(z.string()),
    skippedIndexes: z.array(z.object({ table: z.string(), index: z.string(), reason: z.string() }).strict()),
  })
  .strict()

export type MysqlTransferSchemaExport = z.infer<typeof MysqlTransferSchemaExport>

export const MysqlTransferFullExport = z
  .object({
    schema: MysqlTransferSchemaExport,
    snapshot: MysqlTransferSnapshot,
  })
  .strict()

export type MysqlTransferFullExport = z.infer<typeof MysqlTransferFullExport>

export const MysqlTransferImportResult = z
  .object({
    ok: z.boolean(),
    schemaFingerprint: z.string(),
    tables: z.array(z.object({ name: z.string(), rows: z.number() }).strict()),
  })
  .strict()

export type MysqlTransferImportResult = z.infer<typeof MysqlTransferImportResult>

export const MysqlTransferValidationError = NamedError.create(
  "MysqlTransferValidationError",
  z.object({ message: z.string() }),
)

export const MysqlTransferApplyError = NamedError.create(
  "MysqlTransferApplyError",
  z.object({
    message: z.string(),
    databasePath: z.string(),
    databaseOpen: z.boolean(),
  }),
)

export type MysqlTransferImportPlan = Readonly<{
  snapshot: MysqlTransferSnapshot
  schemaFingerprint: string
}>

type TableConfig = ReturnType<typeof getTableConfig>
type Column = TableConfig["columns"][number]
type Index = TableConfig["indexes"][number]

type ColumnShape = {
  name: string
  sqliteType: string
  columnType: string
  dataType: string
  primary: boolean
  notNull: boolean
  autoIncrement: boolean
}

type TableShape = {
  name: string
  columns: ColumnShape[]
}

// Local physical-database ownership must never move with portable business
// data. The destination database creates its own durable instance identity
// after import.
const MYSQL_TRANSFER_LOCAL_TABLE_NAMES = new Set(["database_authority"])

function mysqlIdentifier(name: string) {
  return `\`${name.replaceAll("`", "``")}\``
}

function sqliteIdentifier(name: string) {
  return `"${name.replaceAll('"', '""')}"`
}

function mysqlLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`
}

function tableConfigs() {
  return collectTables()
    .map((table) => getTableConfig(table as never))
    .filter((config) => !MYSQL_TRANSFER_LOCAL_TABLE_NAMES.has(config.name))
}

function columnDataType(column: Column) {
  return String((column as Column & { config?: { dataType?: unknown } }).config?.dataType ?? "")
}

function columnType(column: Column) {
  return String((column as Column & { config?: { columnType?: unknown } }).config?.columnType ?? "")
}

function isSql(value: unknown): value is SQL {
  return value instanceof SQL
}

function indexColumnNames(index: Index) {
  const names: string[] = []
  for (const column of index.config.columns) {
    if (isSql(column)) return undefined
    names.push(column.name)
  }
  return names
}

function indexedTextColumns(config: TableConfig) {
  const names = new Set<string>()
  for (const index of config.indexes) {
    const columns = indexColumnNames(index)
    if (!columns) continue
    for (const column of columns) names.add(column)
  }
  for (const primaryKey of config.primaryKeys) {
    for (const column of primaryKey.columns) names.add(column.name)
  }
  for (const unique of config.uniqueConstraints) {
    for (const column of unique.columns) names.add(column.name)
  }
  for (const foreignKey of config.foreignKeys) {
    for (const column of foreignKey.reference().columns) names.add(column.name)
  }
  for (const column of config.columns) {
    if (column.primary) names.add(column.name)
  }
  return names
}

function mysqlColumnType(config: TableConfig, column: Column) {
  const type = columnType(column)
  const dataType = columnDataType(column)
  if (type === "SQLiteBoolean") return "TINYINT(1)"
  if (type === "SQLiteInteger") return "BIGINT"
  if (type === "SQLiteReal") return "DOUBLE"
  if (type === "SQLiteBlobBuffer") return "LONGBLOB"
  if (type === "SQLiteTextJson") return "LONGTEXT"
  if (type === "SQLiteText") {
    const indexed = indexedTextColumns(config)
    if (column.primary || indexed.has(column.name) || column.default !== undefined || dataType !== "string")
      return "VARCHAR(255)"
    return "LONGTEXT"
  }
  return column.getSQLType().toUpperCase()
}

function mysqlDefault(column: Column, mysqlType: string) {
  if (column.default === undefined) return undefined
  if (mysqlType === "LONGTEXT" || mysqlType === "LONGBLOB") return undefined
  if (typeof column.default === "number") return String(column.default)
  if (typeof column.default === "boolean") return column.default ? "1" : "0"
  if (typeof column.default === "string") return mysqlLiteral(column.default)
  return undefined
}

function renderMysqlColumn(config: TableConfig, column: Column) {
  const mysqlType = mysqlColumnType(config, column)
  const pieces = [mysqlIdentifier(column.name), mysqlType]
  if (column.notNull || column.primary) pieces.push("NOT NULL")
  if ((column as Column & { autoIncrement?: boolean }).autoIncrement) pieces.push("AUTO_INCREMENT")
  const defaultValue = mysqlDefault(column, mysqlType)
  if (defaultValue !== undefined) pieces.push(`DEFAULT ${defaultValue}`)
  return pieces.join(" ")
}

function renderMysqlForeignKey(foreignKey: TableConfig["foreignKeys"][number]) {
  const reference = foreignKey.reference()
  const columns = reference.columns.map((column) => mysqlIdentifier(column.name)).join(", ")
  const foreignColumns = reference.foreignColumns.map((column) => mysqlIdentifier(column.name)).join(", ")
  const pieces = [
    `FOREIGN KEY (${columns}) REFERENCES ${mysqlIdentifier(tableName(reference.foreignTable))} (${foreignColumns})`,
  ]
  if (foreignKey.onDelete) pieces.push(`ON DELETE ${foreignKey.onDelete.toUpperCase()}`)
  if (foreignKey.onUpdate) pieces.push(`ON UPDATE ${foreignKey.onUpdate.toUpperCase()}`)
  return pieces.join(" ")
}

function renderMysqlIndex(config: TableConfig, index: Index) {
  if (index.config.where) {
    return {
      sql: undefined,
      skipped: {
        table: config.name,
        index: index.config.name,
        reason: "SQLite partial indexes have no direct MySQL staging equivalent.",
      },
    }
  }
  const columns = indexColumnNames(index)
  if (!columns) {
    return {
      sql: undefined,
      skipped: {
        table: config.name,
        index: index.config.name,
        reason: "SQLite expression indexes require generated columns before MySQL staging can index them.",
      },
    }
  }
  const unique = index.config.unique ? "UNIQUE " : ""
  return {
    sql: `CREATE ${unique}INDEX ${mysqlIdentifier(index.config.name)} ON ${mysqlIdentifier(config.name)} (${columns
      .map(mysqlIdentifier)
      .join(", ")});`,
    skipped: undefined,
  }
}

function tableShape(config: TableConfig): TableShape {
  return {
    name: config.name,
    columns: config.columns.map((column) => ({
      name: column.name,
      sqliteType: column.getSQLType(),
      columnType: columnType(column),
      dataType: columnDataType(column),
      primary: column.primary,
      notNull: column.notNull,
      autoIncrement: Boolean((column as Column & { autoIncrement?: boolean }).autoIncrement),
    })),
  }
}

function schemaShapes() {
  return tableConfigs().map(tableShape)
}

export function mysqlSchemaFingerprint() {
  return currentSchemaFingerprint()
}

export function mysqlSchemaExport(): MysqlTransferSchemaExport {
  const tables = tableConfigs()
  const skippedIndexes: MysqlTransferSchemaExport["skippedIndexes"] = []
  const statements: string[] = ["SET NAMES utf8mb4;", "SET FOREIGN_KEY_CHECKS = 0;"]

  for (const config of tables) {
    const definitions = config.columns.map((column) => `  ${renderMysqlColumn(config, column)}`)
    const inlineConstraints: string[] = []
    const inlinePrimary = config.columns.filter((column) => column.primary)
    if (inlinePrimary.length > 0) {
      inlineConstraints.push(`PRIMARY KEY (${inlinePrimary.map((column) => mysqlIdentifier(column.name)).join(", ")})`)
    }
    for (const primaryKey of config.primaryKeys) {
      inlineConstraints.push(
        `PRIMARY KEY (${primaryKey.columns.map((column) => mysqlIdentifier(column.name)).join(", ")})`,
      )
    }
    for (const unique of config.uniqueConstraints) {
      inlineConstraints.push(`UNIQUE (${unique.columns.map((column) => mysqlIdentifier(column.name)).join(", ")})`)
    }
    for (const foreignKey of config.foreignKeys) {
      inlineConstraints.push(renderMysqlForeignKey(foreignKey))
    }
    const tableSql = [
      `CREATE TABLE IF NOT EXISTS ${mysqlIdentifier(config.name)} (`,
      [...definitions, ...inlineConstraints.map((constraint) => `  ${constraint}`)].join(",\n"),
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;",
    ].join("\n")
    statements.push(tableSql)
  }

  for (const config of tables) {
    for (const index of config.indexes) {
      const rendered = renderMysqlIndex(config, index)
      if (rendered.skipped) skippedIndexes.push(rendered.skipped)
      if (rendered.sql) statements.push(rendered.sql)
    }
  }
  statements.push("SET FOREIGN_KEY_CHECKS = 1;")

  return {
    format: MYSQL_TRANSFER_FORMAT,
    schemaFingerprint: mysqlSchemaFingerprint(),
    mysqlDDL: statements.join("\n\n"),
    tables: schemaShapes().map((table) => ({ name: table.name, columns: table.columns.map((column) => column.name) })),
    derivedTables: ["memory_fts"],
    skippedIndexes,
  }
}

function encodeSnapshotCell(value: unknown) {
  if (value instanceof Uint8Array) {
    return { opencorvusType: "blobBase64", base64: Buffer.from(value).toString("base64") }
  }
  if (Buffer.isBuffer(value)) {
    return { opencorvusType: "blobBase64", base64: value.toString("base64") }
  }
  return value
}

export function exportMysqlTransferSnapshot(): MysqlTransferSnapshot {
  try {
    const tables = schemaShapes().map((table) => {
      const rows = Database.allFinalized<Record<string, unknown>>(`SELECT * FROM ${sqliteIdentifier(table.name)}`).map(
        (row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, encodeSnapshotCell(value)])),
      )
      return { name: table.name, columns: table.columns.map((column) => column.name), rows }
    })
    return { format: MYSQL_TRANSFER_FORMAT, schemaFingerprint: mysqlSchemaFingerprint(), tables }
  } finally {
    Database.close()
  }
}

export function exportMysqlTransferPackage(): MysqlTransferFullExport {
  return {
    schema: mysqlSchemaExport(),
    snapshot: exportMysqlTransferSnapshot(),
  }
}

function assertExactTableSet(snapshot: MysqlTransferSnapshot, expected: TableShape[]) {
  if (new Set(snapshot.tables.map((table) => table.name)).size !== snapshot.tables.length) {
    throw new Error("Duplicate table in MySQL transfer snapshot")
  }
  const actualNames = new Set(snapshot.tables.map((table) => table.name))
  const expectedNames = new Set(expected.map((table) => table.name))
  for (const name of actualNames) {
    if (!expectedNames.has(name)) throw new Error(`Unexpected table in MySQL transfer snapshot: ${name}`)
  }
  for (const name of expectedNames) {
    if (!actualNames.has(name)) throw new Error(`Missing table in MySQL transfer snapshot: ${name}`)
  }
}

function assertExactColumns(table: z.infer<typeof MysqlTransferTableSnapshot>, expected: TableShape) {
  const actual = table.columns.join(",")
  const canonical = expected.columns.map((column) => column.name).join(",")
  if (actual !== canonical) {
    throw new Error(`Column mismatch for table ${table.name}: expected [${canonical}], received [${actual}]`)
  }
  const allowed = new Set(table.columns)
  for (const [rowIndex, row] of table.rows.entries()) {
    for (const key of Object.keys(row)) {
      if (!allowed.has(key)) throw new Error(`Unexpected column ${table.name}.${key} at row ${rowIndex}`)
    }
  }
}

function parsedJsonCell(value: unknown, table: string, column: string): unknown {
  if (value === null || value === undefined) return undefined
  if (typeof value !== "string") return value
  try {
    return JSON.parse(value)
  } catch (cause) {
    throw new Error(`Expected canonical JSON cell for ${table}.${column}`, { cause })
  }
}

function canonicalComparable(value: unknown): string {
  return canonicalJSONValue(value, "MySQL transfer metadata")
}

function assertEngineArtifactCatalogRows(table: z.infer<typeof MysqlTransferTableSnapshot>): void {
  if (table.name !== "engine_artifact" && table.name !== "engine_artifact_version") return
  for (const [rowIndex, row] of table.rows.entries()) {
    if (typeof row.kind !== "string") {
      throw new Error(`Expected scalar text cell for ${table.name}.kind at row ${rowIndex}`)
    }
    const artifactID = table.name === "engine_artifact" ? row.id : row.artifact_id
    const catalogRevision = normalizeNumber(row.catalog_revision, table.name, "catalog_revision")
    if (!Number.isSafeInteger(catalogRevision) || catalogRevision <= 0) {
      throw new Error(`Expected positive safe catalog revision for ${table.name} at row ${rowIndex}`)
    }
    const payloadCell = row.payload
    const payloadText =
      typeof payloadCell === "string"
        ? payloadCell
        : JSON.stringify(parsedJsonCell(payloadCell, table.name, "payload") ?? null)
    parsedJsonCell(payloadText, table.name, "payload")
    const derived = deriveEngineArtifactCatalogMetadata({
      kind: row.kind as EngineArtifactKind,
      payloadText,
    })
    const expected = {
      ...derived,
      catalog_metadata_sha256: engineArtifactCatalogMetadataSHA256({
        artifact_id: String(artifactID),
        task_id: String(row.task_id),
        kind: row.kind as EngineArtifactKind,
        label_index: engineArtifactCatalogLabelIndex(String(row.label)),
        time_created: normalizeNumber(row.time_created, table.name, "time_created"),
        time_updated: normalizeNumber(row.time_updated, table.name, "time_updated"),
        ...derived,
      }),
    }
    const actual = {
      payload_sha256: row.payload_sha256,
      payload_bytes: normalizeNumber(row.payload_bytes, table.name, "payload_bytes"),
      payload_block_sha256s: parsedJsonCell(row.payload_block_sha256s, table.name, "payload_block_sha256s") ?? [],
      payload_block_index_sha256: row.payload_block_index_sha256,
      catalog_artifact_type: row.catalog_artifact_type ?? null,
      catalog_schema_diagnostic: row.catalog_schema_diagnostic ?? null,
      catalog_producer: parsedJsonCell(row.catalog_producer, table.name, "catalog_producer") ?? null,
      catalog_import_source_task_id: row.catalog_import_source_task_id ?? null,
      catalog_resource_count: normalizeNumber(row.catalog_resource_count, table.name, "catalog_resource_count"),
      catalog_resource_media_types:
        parsedJsonCell(row.catalog_resource_media_types, table.name, "catalog_resource_media_types") ?? [],
      catalog_search_text: row.catalog_search_text,
      catalog_search_text_truncated:
        typeof row.catalog_search_text_truncated === "boolean"
          ? row.catalog_search_text_truncated
          : normalizeNumber(row.catalog_search_text_truncated, table.name, "catalog_search_text_truncated") !== 0,
      catalog_metadata_sha256: row.catalog_metadata_sha256,
    }
    if (canonicalComparable(actual) !== canonicalComparable(expected)) {
      throw new Error(
        `${table.name === "engine_artifact" ? "Engine Artifact" : "Engine Artifact version"} catalog metadata mismatch at transfer row ${rowIndex}; reset or regenerate the snapshot from the canonical writer`,
      )
    }
  }
}

function assertEngineArtifactVersionPartition(snapshot: MysqlTransferSnapshot): void {
  const revisions = new Set(
    snapshot.tables
      .find((table) => table.name === "engine_artifact_catalog_revision")
      ?.rows.map((row) => normalizeNumber(row.revision, "engine_artifact_catalog_revision", "revision")) ?? [],
  )
  const observedRevisions = new Map<number, string>()
  const currentRows = new Map<string, Record<string, unknown>>()
  const currentTable = snapshot.tables.find((table) => table.name === "engine_artifact")
  for (const row of currentTable?.rows ?? []) currentRows.set(String(row.id), row)
  for (const tableName of ["engine_artifact", "engine_artifact_version"] as const) {
    const table = snapshot.tables.find((candidate) => candidate.name === tableName)
    if (!table) continue
    for (const [rowIndex, row] of table.rows.entries()) {
      const artifactID = String(tableName === "engine_artifact" ? row.id : row.artifact_id)
      const revision = normalizeNumber(row.catalog_revision, tableName, "catalog_revision")
      if (!revisions.has(revision)) {
        throw new Error(`${tableName} row ${rowIndex} references unallocated catalog revision ${revision}`)
      }
      const identity = `${artifactID}@${revision}`
      const previousIdentity = observedRevisions.get(revision)
      if (previousIdentity) {
        throw new Error(`Engine Artifact catalog revision ${revision} is shared by ${previousIdentity} and ${identity}`)
      }
      observedRevisions.set(revision, identity)
      if (tableName === "engine_artifact_version") {
        const current = currentRows.get(artifactID)
        if (!current) {
          throw new Error(`Engine Artifact history ${identity} has no current partition row`)
        }
        const currentRevision = normalizeNumber(current.catalog_revision, "engine_artifact", "catalog_revision")
        if (revision >= currentRevision) {
          throw new Error(`Engine Artifact history ${identity} must precede current revision ${currentRevision}`)
        }
        for (const column of ["task_id", "kind", "time_created"] as const) {
          if ((row[column] ?? null) !== (current[column] ?? null)) {
            throw new Error(`Engine Artifact history ${identity} changes immutable partition authority ${column}`)
          }
        }
      }
    }
  }
}

function decodeBlob(value: unknown, table: string, column: string) {
  const parsed = BlobCell.safeParse(value)
  if (!parsed.success) {
    throw new Error(`Invalid blobBase64 cell for ${table}.${column}: ${parsed.error.message}`)
  }
  return new Uint8Array(decodeCanonicalBase64Payload(parsed.data.base64, `MySQL transfer ${table}.${column}`))
}

function normalizeNumber(value: unknown, table: string, column: string) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value)
  throw new Error(`Expected numeric cell for ${table}.${column}`)
}

function sqliteValue(value: unknown, table: string, column: ColumnShape) {
  if (value === null || value === undefined) return null
  if (column.columnType === "SQLiteBlobBuffer") return decodeBlob(value, table, column.name)
  if (column.columnType === "SQLiteBoolean") {
    if (typeof value === "boolean") return value ? 1 : 0
    return normalizeNumber(value, table, column.name) ? 1 : 0
  }
  if (column.columnType === "SQLiteInteger" || column.columnType === "SQLiteReal") {
    return normalizeNumber(value, table, column.name)
  }
  if (column.columnType === "SQLiteTextJson") {
    if (typeof value === "string") return value
    return JSON.stringify(value)
  }
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  throw new Error(`Expected scalar text cell for ${table}.${column.name}`)
}

function insertRows(sqlite: BunDatabase, table: TableShape, rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return
  const columnNames = table.columns.map((column) => column.name)
  const sql = `INSERT INTO ${sqliteIdentifier(table.name)} (${columnNames.map(sqliteIdentifier).join(", ")}) VALUES (${columnNames
    .map(() => "?")
    .join(", ")})`
  const statement = sqlite.query(sql)
  let operationFailure: unknown
  let operationFailed = false
  try {
    for (const row of rows) {
      const values = table.columns.map((column) => sqliteValue(row[column.name], table.name, column))
      statement.run(...values)
    }
  } catch (error) {
    operationFailed = true
    operationFailure = error
  }
  try {
    statement.finalize()
  } catch (finalizeFailure) {
    if (operationFailed) {
      throw new AggregateError(
        [operationFailure, finalizeFailure],
        `Importing rows into ${table.name} and finalizing its SQLite statement both failed`,
        { cause: operationFailure },
      )
    }
    throw finalizeFailure
  }
  if (operationFailed) throw operationFailure
}

function rebuildMemoryFts(sqlite: BunDatabase) {
  // FTS means Full-Text Search. The SQLite virtual table is derived from
  // memory_chunk rows, so transfer snapshots carry only the source rows.
  // Host-owned kinds are never indexed while running — their chunk content is
  // a JSON envelope, not prose — so the rebuild has to exclude them too or a
  // transferred database answers searches the source database could not.
  const excluded = HOST_OWNED_MEMORY_KINDS.map((kind) => `'${kind}'`).join(", ")
  sqlite.run("DELETE FROM memory_fts")
  sqlite.run(
    `INSERT INTO memory_fts (content, chunk_id, project_id)
     SELECT mc.content, mc.id, mc.project_id
     FROM memory_chunk mc
     JOIN memory_file mf ON mf.id = mc.file_id
     WHERE mf.kind NOT IN (${excluded})`,
  )
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
  return Object.freeze(value)
}

function insertPreparedRows(
  sqlite: BunDatabase,
  expectedTables: TableShape[],
  tableByName: Map<string, z.infer<typeof MysqlTransferTableSnapshot>>,
) {
  const ordered = [
    ...expectedTables.filter(
      (expected) => !["protocol_event", "engine_artifact", "engine_task_creation_contract"].includes(expected.name),
    ),
    ...expectedTables.filter((expected) => expected.name === "protocol_event"),
    ...expectedTables.filter((expected) => expected.name === "engine_artifact"),
    ...expectedTables.filter((expected) => expected.name === "engine_task_creation_contract"),
  ]
  for (const expected of ordered) {
    const table = tableByName.get(expected.name)
    if (!table) throw new Error(`Missing table in MySQL transfer snapshot: ${expected.name}`)
    insertRows(sqlite, expected, table.rows)
  }
  rebuildMemoryFts(sqlite)
}

const TRANSFER_DEFERRED_CREATION_TRIGGERS = [
  // Current snapshots insert parent Message rows before their immutable Part
  // children. These two guards enforce live append order, not snapshot
  // validity; the complete current-fact validator runs before they are
  // restored in the same transaction.
  "completed_assistant_part_no_insert",
  "completed_assistant_tool_request_no_insert",
  "global_creation_allocation_acceptance_target_insert",
  "global_creation_allocation_project_insert",
  "global_creation_allocation_project_retention_insert",
  "session_panel_creation_lineage_insert",
  "protocol_event_task_project_insert",
  "worker_turn_descriptor_task_project_insert",
  "engine_task_root_ingress_project_insert",
  "automation_fire_frontier_authority_insert",
  "automation_fire_frontier_authority_update",
  "engine_control_activation_lease_grant_insert",
  "automation_fire_attempt_admission_insert",
  "automation_run_mission_reservation_insert",
  "event_job_fire_definition_insert",
  "event_job_fire_mission_reservation_insert",
  "event_job_fire_receipt_frontier_insert",
  "event_job_fire_terminal_fifo_insert",
  "event_job_fire_terminal_mission_reservation_insert",
] as const

function beginValidatedCreationFactRestore(sqlite: BunDatabase): void {
  for (const trigger of TRANSFER_DEFERRED_CREATION_TRIGGERS) sqlite.run(`DROP TRIGGER ${trigger}`)
}

function finishValidatedCreationFactRestore(sqlite: BunDatabase): void {
  assertNoForeignKeyViolations(sqlite)
  assertTaskControlProjectAuthority(sqlite)
  assertAutomationFireFrontierAuthority(sqlite)
  assertAutomationRunMissionReservationAuthority(sqlite)
  assertEventFireSnapshotAuthority(sqlite)
  validateTaskCreationIdentitySnapshot(sqlite)
  const restored = new Set(restoreCurrentTransferTriggers(sqlite))
  for (const trigger of TRANSFER_DEFERRED_CREATION_TRIGGERS) {
    if (!restored.has(trigger)) throw new Error(`MySQL transfer did not restore current trigger ${trigger}`)
  }
}

function assertAutomationFireFrontierAuthority(sqlite: BunDatabase): void {
  const invalidGrant = queryAllFinalized<{ lease_id: string; ordinal: number }>(
    sqlite,
    `WITH ordered_grant AS (
       SELECT grant_authority.lease_id,grant_authority.ordinal,grant_authority.expires_at,
         grant_authority.time_created,
         row_number() OVER (
           PARTITION BY grant_authority.lease_id
           ORDER BY grant_authority.ordinal
         ) AS expected_ordinal,
         lag(grant_authority.time_created) OVER (
           PARTITION BY grant_authority.lease_id
           ORDER BY grant_authority.ordinal
         ) AS prior_time_created
       FROM engine_control_activation_lease_grant AS grant_authority
     )
     SELECT grant_authority.lease_id,grant_authority.ordinal
     FROM ordered_grant AS grant_authority
     LEFT JOIN engine_control_activation_lease AS lease ON lease.id=grant_authority.lease_id
     WHERE lease.id IS NULL
        OR grant_authority.ordinal<>grant_authority.expected_ordinal
        OR grant_authority.expires_at<=grant_authority.time_created
        OR grant_authority.time_created<lease.time_activated
        OR (
          grant_authority.prior_time_created IS NOT NULL
          AND grant_authority.time_created<grant_authority.prior_time_created
        )
        OR (
          NOT EXISTS (
            SELECT 1 FROM engine_control_activation_lease_grant AS later_grant
            WHERE later_grant.lease_id=grant_authority.lease_id
              AND later_grant.ordinal>grant_authority.ordinal
          )
          AND lease.expires_at>grant_authority.expires_at
        )
     ORDER BY grant_authority.lease_id,grant_authority.ordinal
     LIMIT 1`,
  )[0]
  if (invalidGrant) {
    throw new Error(
      `Control lease ${invalidGrant.lease_id} grant ${invalidGrant.ordinal} has invalid immutable authority`,
    )
  }

  const invalidAttempt = queryAllFinalized<{ id: string }>(
    sqlite,
    `WITH ordered_attempt AS (
       SELECT attempt.id,attempt.fire_id,attempt.ordinal,attempt.owner_occurrence_id,
         attempt.lease_id,attempt.lease_grant_ordinal,attempt.lease_expires_at,attempt.time_created,
         row_number() OVER (PARTITION BY attempt.fire_id ORDER BY attempt.ordinal,attempt.id) AS expected_ordinal
       FROM automation_fire_attempt AS attempt
     )
     SELECT attempt.id
     FROM ordered_attempt AS attempt
     JOIN automation_fire AS fire ON fire.id=attempt.fire_id
     JOIN automation AS definition ON definition.id=fire.automation_revision_id
      WHERE attempt.ordinal<>attempt.expected_ordinal
        OR attempt.lease_grant_ordinal<=0
        OR attempt.lease_expires_at<=attempt.time_created
        OR NOT EXISTS (
          SELECT 1
          FROM engine_control_activation_lease AS lease
           WHERE lease.id=attempt.lease_id
             AND lease.target='automation'
             AND lease.target_id=definition.definition_id
             AND lease.owner_occurrence_id=attempt.owner_occurrence_id
             AND lease.time_activated<=attempt.time_created
             AND lease.expires_at>=attempt.time_created
             AND EXISTS (
               SELECT 1
                FROM engine_control_activation_lease_grant AS grant_authority
                WHERE grant_authority.lease_id=lease.id
                  AND grant_authority.ordinal=attempt.lease_grant_ordinal
                  AND grant_authority.expires_at=attempt.lease_expires_at
                  AND grant_authority.time_created<=attempt.time_created
                  AND NOT EXISTS (
                    SELECT 1
                    FROM engine_control_activation_lease_grant AS later_grant
                    WHERE later_grant.lease_id=grant_authority.lease_id
                      AND later_grant.ordinal>grant_authority.ordinal
                      AND later_grant.time_created<attempt.time_created
                  )
              )
        )
     ORDER BY attempt.id
     LIMIT 1`,
  )[0]
  if (invalidAttempt) {
    throw new Error(`Automation Fire attempt ${invalidAttempt.id} has invalid admission authority`)
  }

  const invalid = queryAllFinalized<{ definition_id: string }>(
    sqlite,
    `SELECT frontier.definition_id
     FROM automation_fire_frontier AS frontier
     LEFT JOIN automation AS revision ON revision.id=frontier.automation_revision_id
     LEFT JOIN automation_fire AS fire ON fire.id=frontier.fire_id
     WHERE revision.id IS NULL
       OR fire.id IS NULL
       OR revision.definition_id<>frontier.definition_id
       OR (revision.status<>'active' AND fire.origin='scheduled')
       OR fire.automation_revision_id<>revision.id
       OR frontier.available_at<fire.scheduled_due_at
       OR EXISTS (
         SELECT 1 FROM automation AS later
         WHERE later.definition_id=frontier.definition_id
           AND (
             later.revision>revision.revision
             OR (later.revision=revision.revision AND later.id>revision.id)
           )
       )
       OR EXISTS (
         SELECT 1 FROM automation_definition_tombstone AS tombstone
         WHERE tombstone.definition_id=frontier.definition_id
           AND tombstone.revision>=revision.revision
       )
       OR (
         EXISTS (SELECT 1 FROM automation_run AS run WHERE run.fire_id=fire.id)
         AND NOT EXISTS (
           SELECT 1
           FROM automation_run AS run
           LEFT JOIN automation_run_receipt AS receipt ON receipt.id=(
             SELECT latest.id
             FROM automation_run_receipt AS latest
             WHERE latest.run_id=run.id
             ORDER BY latest.time_created DESC,latest.id DESC
             LIMIT 1
           )
           WHERE run.fire_id=fire.id
             AND (receipt.id IS NULL OR receipt.outcome='retry_wait')
         )
       )
       OR (
         NOT EXISTS (SELECT 1 FROM automation_run AS run WHERE run.fire_id=fire.id)
         AND EXISTS (
           SELECT 1
           FROM automation_fire_attempt AS attempt
           JOIN automation_fire_attempt_receipt AS receipt ON receipt.attempt_id=attempt.id
           WHERE attempt.fire_id=fire.id
             AND receipt.outcome='failed'
             AND NOT EXISTS (
               SELECT 1 FROM automation_fire_attempt AS later
               WHERE later.fire_id=fire.id
                 AND (
                   later.ordinal>attempt.ordinal
                   OR (later.ordinal=attempt.ordinal AND later.id>attempt.id)
                 )
             )
         )
       )
     ORDER BY frontier.definition_id
     LIMIT 1`,
  )[0]
  if (invalid) {
    throw new Error(`Automation ${invalid.definition_id} has an invalid Fire delivery frontier`)
  }

  const missing = queryAllFinalized<{
    definition_id: string
    status: string
    kind: string
    recurrence: string | null
    boundary: number
  }>(
    sqlite,
    `WITH current_definition AS (
       SELECT revision.definition_id,revision.id,revision.status,revision.kind,revision.recurrence,revision.time_created
       FROM automation AS revision
       WHERE NOT EXISTS (
         SELECT 1 FROM automation AS later
         WHERE later.definition_id=revision.definition_id
           AND (
             later.revision>revision.revision
             OR (later.revision=revision.revision AND later.id>revision.id)
           )
       )
         AND NOT EXISTS (
           SELECT 1 FROM automation_definition_tombstone AS tombstone
           WHERE tombstone.definition_id=revision.definition_id
             AND tombstone.revision>=revision.revision
         )
     )
     SELECT current_definition.definition_id,current_definition.status,current_definition.kind,current_definition.recurrence,
       MAX(current_definition.time_created,
         COALESCE((SELECT MAX(receipt.time_created) FROM automation_run_receipt AS receipt
           JOIN automation_run AS run ON run.id=receipt.run_id
           WHERE run.automation_revision_id=current_definition.id),0),
         COALESCE((SELECT MAX(receipt.time_created) FROM automation_fire_attempt_receipt AS receipt
           JOIN automation_fire_attempt AS attempt ON attempt.id=receipt.attempt_id
           JOIN automation_fire AS fire ON fire.id=attempt.fire_id
           WHERE fire.automation_revision_id=current_definition.id AND receipt.outcome='failed'),0)) AS boundary
     FROM current_definition
     LEFT JOIN automation_fire_frontier AS frontier
       ON frontier.definition_id=current_definition.definition_id
     WHERE current_definition.status='active' AND frontier.definition_id IS NULL
     ORDER BY current_definition.definition_id`,
  ).find(
    (row) => row.kind !== "recurring" || !row.recurrence || Recurrence.nextRun(row.recurrence, row.boundary) !== null,
  )
  if (missing) {
    throw new Error(
      `Automation ${missing.definition_id} ${missing.status} revision has an invalid Fire frontier presence`,
    )
  }
}

function assertAutomationRunMissionReservationAuthority(sqlite: BunDatabase): void {
  const invalid = queryAllFinalized<{ id: string }>(
    sqlite,
    `SELECT run.id
     FROM automation_run AS run
     JOIN automation AS definition ON definition.id=run.automation_revision_id
     LEFT JOIN session AS target ON target.id=definition.session_id
     LEFT JOIN protocol_event AS opened ON opened.id=run.mission_opened_event_id
     LEFT JOIN protocol_event AS closure ON closure.id=run.mission_closure_event_id
     WHERE (
        target.kind='mission'
        AND NOT (
          (
            run.mission_opened_event_id IS NOT NULL
            AND run.mission_disposition IS NULL
            AND run.mission_closure_event_id IS NULL
            AND opened.aggregate_type='session'
            AND opened.aggregate_id=definition.session_id
            AND opened.type='mission.execution.opened'
          )
          OR (
            run.mission_opened_event_id IS NULL
            AND run.mission_disposition='mission_closed'
            AND run.mission_closure_event_id IS NOT NULL
            AND closure.aggregate_type='session'
            AND closure.aggregate_id=definition.session_id
            AND closure.type IN ('mission.execution.closing','mission.execution.closed')
          )
        )
      ) OR (
       (target.kind IS NULL OR target.kind<>'mission')
       AND (
         run.mission_opened_event_id IS NOT NULL
         OR run.mission_disposition IS NOT NULL
         OR run.mission_closure_event_id IS NOT NULL
       )
     )
     ORDER BY run.id
     LIMIT 1`,
  )[0]
  if (invalid) {
    throw new Error(`Automation run ${invalid.id} has invalid Mission reservation authority`)
  }

  const invalidTerminalReceipt = queryAllFinalized<{ id: string }>(
    sqlite,
    `SELECT run.id
     FROM automation_run AS run
     WHERE run.mission_disposition='mission_closed'
       AND (
         (SELECT count(*) FROM automation_run_receipt AS receipt WHERE receipt.run_id=run.id)<>1
         OR NOT EXISTS (
           SELECT 1
           FROM automation_run_receipt AS receipt
           WHERE receipt.run_id=run.id
             AND receipt.outcome='disposition'
             AND receipt.disposition='mission_closed'
             AND receipt.closure_event_id IS run.mission_closure_event_id
             AND receipt.error IS NULL
         )
       )
     ORDER BY run.id
     LIMIT 1`,
  )[0]
  if (invalidTerminalReceipt) {
    throw new Error(`Automation run ${invalidTerminalReceipt.id} has invalid terminal Mission receipt authority`)
  }
}

function assertEventFireSnapshotAuthority(sqlite: BunDatabase): void {
  const invalidDefinition = queryAllFinalized<{ id: string }>(
    sqlite,
    `SELECT fire.id
     FROM event_job_fire AS fire
     LEFT JOIN event_job AS definition ON definition.id=fire.event_job_revision_id
     WHERE definition.id IS NULL OR definition.definition_id<>fire.definition_id
     ORDER BY fire.id
     LIMIT 1`,
  )[0]
  if (invalidDefinition) {
    throw new Error(`Event fire ${invalidDefinition.id} has invalid definition queue authority`)
  }

  const invalidMissionReservation = queryAllFinalized<{ id: string }>(
    sqlite,
    `SELECT fire.id
     FROM event_job_fire AS fire
     JOIN event_job AS definition ON definition.id=fire.event_job_revision_id
     LEFT JOIN session AS target ON target.id=definition.session_id
     LEFT JOIN protocol_event AS opened ON opened.id=fire.mission_opened_event_id
     LEFT JOIN protocol_event AS closure ON closure.id=fire.mission_closure_event_id
     WHERE (
       target.kind='mission'
       AND NOT (
         (
           fire.mission_opened_event_id IS NOT NULL
           AND fire.mission_disposition IS NULL
           AND fire.mission_closure_event_id IS NULL
           AND opened.aggregate_type='session'
           AND opened.aggregate_id=definition.session_id
           AND opened.type='mission.execution.opened'
         )
         OR (
           fire.mission_opened_event_id IS NULL
           AND fire.mission_disposition='mission_closed'
           AND fire.mission_closure_event_id IS NOT NULL
           AND closure.aggregate_type='session'
           AND closure.aggregate_id=definition.session_id
           AND closure.type IN ('mission.execution.closing','mission.execution.closed')
         )
       )
     ) OR (
       COALESCE(target.kind,'')<>'mission'
       AND (
         fire.mission_opened_event_id IS NOT NULL
         OR fire.mission_disposition IS NOT NULL
         OR fire.mission_closure_event_id IS NOT NULL
       )
     )
     ORDER BY fire.id
     LIMIT 1`,
  )[0]
  if (invalidMissionReservation) {
    throw new Error(`Event fire ${invalidMissionReservation.id} has invalid Mission reservation authority`)
  }

  const invalidReceipt = queryAllFinalized<{ id: string }>(
    sqlite,
    `SELECT receipt.id
     FROM event_job_fire_receipt AS receipt
     LEFT JOIN event_job_fire AS fire ON fire.id=receipt.fire_id
     WHERE fire.id IS NULL
       OR fire.definition_id<>receipt.definition_id
       OR fire.queue_position<>receipt.queue_position
       OR (
         fire.mission_disposition='mission_closed'
         AND (
           receipt.outcome<>'disposition'
           OR receipt.disposition<>'mission_closed'
           OR receipt.closure_event_id IS NOT fire.mission_closure_event_id
           OR receipt.error IS NOT NULL
         )
       )
     ORDER BY receipt.id
     LIMIT 1`,
  )[0]
  if (invalidReceipt) {
    throw new Error(`Event receipt ${invalidReceipt.id} has invalid Fire frontier or Mission authority`)
  }

  const invalidTerminalFrontier = queryAllFinalized<{ id: string }>(
    sqlite,
    `WITH terminal AS (
       SELECT receipt.id, receipt.queue_position,
         row_number() OVER (
           PARTITION BY receipt.definition_id
           ORDER BY receipt.queue_position,receipt.id
         ) AS expected_position
       FROM event_job_fire_receipt AS receipt
       WHERE receipt.outcome<>'retry_wait'
     )
     SELECT id
     FROM terminal
     WHERE queue_position<>expected_position
     ORDER BY id
     LIMIT 1`,
  )[0]
  if (invalidTerminalFrontier) {
    throw new Error(`Event receipt ${invalidTerminalFrontier.id} breaks its definition terminal FIFO frontier`)
  }
}

function restorePreparedRows(
  sqlite: BunDatabase,
  expectedTables: TableShape[],
  tableByName: Map<string, z.infer<typeof MysqlTransferTableSnapshot>>,
) {
  beginValidatedCreationFactRestore(sqlite)
  insertPreparedRows(sqlite, expectedTables, tableByName)
}

function assertNoForeignKeyViolations(sqlite: BunDatabase) {
  const violations = queryAllFinalized<{
    table: string
    rowid: number | null
    parent: string
    fkid: number
  }>(sqlite, "PRAGMA foreign_key_check")
  if (violations.length === 0) return
  const sample = violations
    .slice(0, 8)
    .map(
      (violation) =>
        `${violation.table}[rowid=${violation.rowid ?? "without-rowid"}] -> ` +
        `${violation.parent}[constraint=${violation.fkid}]`,
    )
    .join(", ")
  throw new Error(`MySQL transfer foreign key check found ${violations.length} violation(s): ${sample}`)
}

function assertTaskControlProjectAuthority(sqlite: BunDatabase): void {
  const invalid = queryAllFinalized<{ kind: string; id: string }>(
    sqlite,
    `SELECT 'ingress' AS kind, ingress.id AS id
     FROM engine_task_root_ingress ingress
     LEFT JOIN engine_task task ON task.id=ingress.task_id
     WHERE task.id IS NULL OR ingress.project_id<>task.project_id
     UNION ALL
     SELECT 'protocol_event' AS kind, event.id AS id
     FROM protocol_event event
     LEFT JOIN engine_task task ON task.id=event.aggregate_id
     WHERE event.aggregate_type='task'
       AND (event.project_id IS NULL OR (task.id IS NOT NULL AND event.project_id<>task.project_id))
     UNION ALL
     SELECT 'worker_turn_descriptor' AS kind, descriptor.id AS id
     FROM worker_turn_descriptor descriptor
     LEFT JOIN engine_task task ON task.id=descriptor.task_id
     LEFT JOIN session ON session.id=descriptor.session_id
     WHERE task.id IS NULL OR session.id IS NULL
       OR descriptor.project_id<>task.project_id
       OR descriptor.project_id<>session.project_id
       OR json_extract(descriptor.payload,'$.lifecycle.taskID') IS NOT descriptor.task_id
       OR NOT EXISTS (
         SELECT 1 FROM engine_artifact lineage
         WHERE lineage.kind='dispatch_lineage'
           AND lineage.task_id=descriptor.task_id
           AND json_extract(lineage.payload,'$.child_session_id')=descriptor.session_id
           AND json_extract(lineage.payload,'$.dispatch_id')
             = json_extract(descriptor.payload,'$.dispatchTurn.current_dispatch_id')
       )
     ORDER BY kind,id
     LIMIT 1`,
  )[0]
  if (invalid) throw new Error(`${invalid.kind} ${invalid.id} has invalid Task Project or dispatch lineage authority`)
}

function validatePreparedRows(
  expectedTables: TableShape[],
  tableByName: Map<string, z.infer<typeof MysqlTransferTableSnapshot>>,
) {
  const sqlite = new BunDatabase(":memory:")
  try {
    sqlite.run("PRAGMA foreign_keys = OFF")
    sqlite.exec(SCHEMA_DDL)
    sqlite.run("BEGIN")
    restorePreparedRows(sqlite, expectedTables, tableByName)
    finishValidatedCreationFactRestore(sqlite)
    sqlite.run("ROLLBACK")
  } finally {
    sqlite.close()
  }
}

export function preflightMysqlTransferSnapshot(rawSnapshot: unknown): MysqlTransferImportPlan {
  try {
    const snapshot = MysqlTransferSnapshot.parse(structuredClone(rawSnapshot))
    const fingerprint = mysqlSchemaFingerprint()
    if (snapshot.schemaFingerprint !== fingerprint) {
      throw new Error(
        `MySQL transfer schema fingerprint mismatch: expected ${fingerprint}, received ${snapshot.schemaFingerprint}`,
      )
    }

    const expectedTables = schemaShapes()
    assertExactTableSet(snapshot, expectedTables)
    const tableByName = new Map(snapshot.tables.map((table) => [table.name, table]))
    for (const expected of expectedTables) {
      const table = tableByName.get(expected.name)
      if (!table) throw new Error(`Missing table in MySQL transfer snapshot: ${expected.name}`)
      assertExactColumns(table, expected)
      assertEngineArtifactCatalogRows(table)
    }
    assertEngineArtifactVersionPartition(snapshot)
    validatePreparedRows(expectedTables, tableByName)
    return deepFreeze({ snapshot, schemaFingerprint: fingerprint })
  } catch (cause) {
    if (MysqlTransferValidationError.isInstance(cause)) throw cause
    throw new MysqlTransferValidationError(
      { message: cause instanceof Error ? cause.message : String(cause) },
      { cause },
    )
  }
}

export function applyMysqlTransferPlan(plan: MysqlTransferImportPlan): MysqlTransferImportResult {
  const expectedTables = schemaShapes()
  const tableByName = new Map(plan.snapshot.tables.map((table) => [table.name, table]))
  const imported = expectedTables.map((table) => ({
    name: table.name,
    rows: tableByName.get(table.name)?.rows.length ?? 0,
  }))
  try {
    Database.rebuildSqlite((sqlite) => {
      restorePreparedRows(sqlite, expectedTables, tableByName)
      finishValidatedCreationFactRestore(sqlite)
    })
  } catch (cause) {
    throw new MysqlTransferApplyError(
      {
        message: cause instanceof Error ? cause.message : String(cause),
        databasePath: Database.Path(),
        databaseOpen: Database.hasOpenConnection(),
      },
      { cause },
    )
  }
  return { ok: true, schemaFingerprint: plan.schemaFingerprint, tables: imported }
}

export function importMysqlTransferSnapshot(rawSnapshot: unknown): MysqlTransferImportResult {
  return applyMysqlTransferPlan(preflightMysqlTransferSnapshot(rawSnapshot))
}
