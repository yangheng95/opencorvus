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
      const rows = Database.allFinalized<Record<string, unknown>>(
        `SELECT * FROM ${sqliteIdentifier(table.name)}`,
      ).map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, encodeSnapshotCell(value)])))
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
      payload_block_sha256s:
        parsedJsonCell(row.payload_block_sha256s, table.name, "payload_block_sha256s") ?? [],
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
      ?.rows.map((row) =>
        normalizeNumber(row.revision, "engine_artifact_catalog_revision", "revision"),
      ) ?? [],
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
        throw new Error(
          `Engine Artifact catalog revision ${revision} is shared by ${previousIdentity} and ${identity}`,
        )
      }
      observedRevisions.set(revision, identity)
      if (tableName === "engine_artifact_version") {
        const current = currentRows.get(artifactID)
        if (!current) {
          throw new Error(`Engine Artifact history ${identity} has no current partition row`)
        }
        const currentRevision = normalizeNumber(
          current.catalog_revision,
          "engine_artifact",
          "catalog_revision",
        )
        if (revision >= currentRevision) {
          throw new Error(
            `Engine Artifact history ${identity} must precede current revision ${currentRevision}`,
          )
        }
        for (const column of ["task_id", "kind", "time_created"] as const) {
          if ((row[column] ?? null) !== (current[column] ?? null)) {
            throw new Error(
              `Engine Artifact history ${identity} changes immutable partition authority ${column}`,
            )
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
    ...expectedTables.filter((expected) => expected.name !== "engine_task_creation_contract"),
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
] as const

function beginValidatedCreationFactRestore(sqlite: BunDatabase): void {
  for (const trigger of TRANSFER_DEFERRED_CREATION_TRIGGERS) sqlite.run(`DROP TRIGGER ${trigger}`)
}

function finishValidatedCreationFactRestore(sqlite: BunDatabase): void {
  assertNoForeignKeyViolations(sqlite)
  validateTaskCreationIdentitySnapshot(sqlite)
  const restored = new Set(restoreCurrentTransferTriggers(sqlite))
  for (const trigger of TRANSFER_DEFERRED_CREATION_TRIGGERS) {
    if (!restored.has(trigger)) throw new Error(`MySQL transfer did not restore current trigger ${trigger}`)
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
