import { SQL } from "drizzle-orm"
import { getTableConfig, SQLiteSyncDialect, type AnySQLiteTable } from "drizzle-orm/sqlite-core"
import { ENGINE_ARTIFACT_CATALOG_LABEL_INDEX_CODE_POINTS } from "@/engine/artifact-catalog-constants"
import { ApplicationSchema } from "./schema"

type Column = ReturnType<typeof getTableConfig>["columns"][number]
type IndexColumn = ReturnType<typeof getTableConfig>["indexes"][number]["config"]["columns"][number]

const dialect = new SQLiteSyncDialect()

function quoteIdentifier(name: string) {
  return `"${name.replaceAll('"', '""')}"`
}

function quoteLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`
}

export function tableName(table: unknown) {
  return getTableConfig(table as never).name
}

function renderDefault(column: Column) {
  if (column.default === undefined) return undefined
  if (typeof column.default === "number") return String(column.default)
  if (typeof column.default === "boolean") return column.default ? "1" : "0"
  if (typeof column.default === "string") return quoteLiteral(column.default)
  return quoteLiteral(JSON.stringify(column.default))
}

function renderColumn(column: Column) {
  const pieces = [quoteIdentifier(column.name), column.getSQLType()]

  if (column.primary) pieces.push("PRIMARY KEY")
  if (column.notNull) pieces.push("NOT NULL")

  const defaultValue = renderDefault(column)
  if (defaultValue !== undefined) pieces.push(`DEFAULT ${defaultValue}`)

  return pieces.join(" ")
}

function renderForeignKey(foreignKey: ReturnType<typeof getTableConfig>["foreignKeys"][number]) {
  const reference = foreignKey.reference()
  const columns = reference.columns.map((column) => quoteIdentifier(column.name)).join(", ")
  const foreignColumns = reference.foreignColumns.map((column) => quoteIdentifier(column.name)).join(", ")
  const pieces = [
    `FOREIGN KEY (${columns}) REFERENCES ${quoteIdentifier(tableName(reference.foreignTable))}(${foreignColumns})`,
  ]

  if (foreignKey.onDelete) pieces.push(`ON DELETE ${foreignKey.onDelete.toUpperCase()}`)
  if (foreignKey.onUpdate) pieces.push(`ON UPDATE ${foreignKey.onUpdate.toUpperCase()}`)

  return pieces.join(" ")
}

function renderCheck(
  config: ReturnType<typeof getTableConfig>,
  check: ReturnType<typeof getTableConfig>["checks"][number],
) {
  return `CONSTRAINT ${quoteIdentifier(check.name)} CHECK (${renderIndexSql(check.value, config.name)})`
}

function renderSql(value: SQL) {
  const query = dialect.sqlToQuery(value)
  if (query.params.length > 0) {
    throw new Error(`Schema DDL SQL expressions must be static; received ${query.params.length} params`)
  }
  return query.sql
}

function renderIndexSql(value: SQL, currentTableName: string) {
  return renderSql(value).replaceAll(`${quoteIdentifier(currentTableName)}.`, "")
}

function isSql(value: unknown): value is SQL {
  return value instanceof SQL
}

function renderIndexColumn(column: IndexColumn, currentTableName: string) {
  if (isSql(column)) return renderIndexSql(column, currentTableName)
  return quoteIdentifier(column.name)
}

function renderIndex(
  config: ReturnType<typeof getTableConfig>,
  index: ReturnType<typeof getTableConfig>["indexes"][number],
) {
  const unique = index.config.unique ? "UNIQUE " : ""
  const columns = index.config.columns.map((column) => renderIndexColumn(column, config.name)).join(", ")
  const where = index.config.where ? ` WHERE ${renderIndexSql(index.config.where, config.name)}` : ""
  return `CREATE ${unique}INDEX IF NOT EXISTS ${quoteIdentifier(index.config.name)} ON ${quoteIdentifier(config.name)} (${columns})${where};`
}

function renderTable(table: unknown) {
  const config = getTableConfig(table as never)
  const definitions: string[] = config.columns.map(renderColumn)

  for (const primaryKey of config.primaryKeys) {
    definitions.push(`PRIMARY KEY (${primaryKey.columns.map((column) => quoteIdentifier(column.name)).join(", ")})`)
  }

  for (const uniqueConstraint of config.uniqueConstraints) {
    definitions.push(`UNIQUE (${uniqueConstraint.columns.map((column) => quoteIdentifier(column.name)).join(", ")})`)
  }

  for (const foreignKey of config.foreignKeys) {
    definitions.push(renderForeignKey(foreignKey))
  }

  for (const check of config.checks) {
    definitions.push(renderCheck(config, check))
  }

  const tableSql = [
    `CREATE TABLE IF NOT EXISTS ${quoteIdentifier(config.name)} (`,
    definitions.map((definition) => `  ${definition}`).join(",\n"),
    ");",
  ].join("\n")

  const indexSql = config.indexes.map((index) => renderIndex(config, index))

  return [tableSql, ...indexSql].join("\n")
}

export class ApplicationSchemaRegistryError extends Error {
  constructor(
    readonly kind: "invalid_table" | "duplicate_table_name",
    readonly registryKey: string,
    readonly tableName?: string,
    options?: ErrorOptions,
  ) {
    super(
      kind === "invalid_table"
        ? `Application schema entry is not a SQLite table: ${registryKey}`
        : `Application schema contains duplicate physical table name ${tableName}: ${registryKey}`,
      options,
    )
    this.name = "ApplicationSchemaRegistryError"
  }
}

/**
 * Module namespace exports were historically enumerated in code-unit key order.
 * Keep that stable order as part of the MySQL transfer fingerprint contract.
 */
export function collectTables(
  registry: Readonly<Record<string, AnySQLiteTable>> = ApplicationSchema,
): AnySQLiteTable[] {
  const tables: AnySQLiteTable[] = []
  const seen = new Set<string>()
  const entries = Object.entries(registry).sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))

  for (const [registryKey, table] of entries) {
    let name: string
    try {
      name = tableName(table)
    } catch (cause) {
      throw new ApplicationSchemaRegistryError("invalid_table", registryKey, undefined, { cause })
    }
    if (seen.has(name)) {
      throw new ApplicationSchemaRegistryError("duplicate_table_name", registryKey, name)
    }
    seen.add(name)
    tables.push(table)
  }

  return tables
}

function generatedSchemaDdl() {
  return collectTables().map(renderTable).join("\n\n")
}

// FTS is Full-Text Search. Drizzle table declarations do not model SQLite FTS5
// virtual tables, so this remains an explicit storage extension.
const STORAGE_EXTENSION_DDL = /* sql */ `
CREATE TRIGGER IF NOT EXISTS project_generation_required_insert
BEFORE INSERT ON project
FOR EACH ROW
WHEN length(NEW.generation) != 36
  OR length(replace(NEW.generation, '-', '')) != 32
  OR substr(NEW.generation, 9, 1) != '-'
  OR substr(NEW.generation, 14, 1) != '-'
  OR substr(NEW.generation, 19, 1) != '-'
  OR substr(NEW.generation, 24, 1) != '-'
  OR lower(replace(NEW.generation, '-', '')) GLOB '*[^0-9a-f]*'
  OR (
    NEW.generation NOT IN (
      '00000000-0000-0000-0000-000000000000',
      'ffffffff-ffff-ffff-ffff-ffffffffffff'
    )
    AND substr(lower(NEW.generation), 15, 1) NOT BETWEEN '1' AND '8'
  )
  OR (
    NEW.generation NOT IN (
      '00000000-0000-0000-0000-000000000000',
      'ffffffff-ffff-ffff-ffff-ffffffffffff'
    )
    AND instr('89ab', substr(lower(NEW.generation), 20, 1)) = 0
  )
BEGIN
  SELECT RAISE(ABORT, 'project: generation must be a UUID');
END;

CREATE TRIGGER IF NOT EXISTS project_generation_immutable_update
BEFORE UPDATE OF generation ON project
FOR EACH ROW
WHEN NEW.generation IS NOT OLD.generation
BEGIN
  SELECT RAISE(ABORT, 'project: generation is immutable');
END;

CREATE TRIGGER IF NOT EXISTS project_promotion_fence_update
BEFORE UPDATE ON project
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM project_maintenance_fence
  WHERE project_id = OLD.id AND kind = 'promotion'
)
BEGIN
  SELECT RAISE(ABORT, 'project_promotion_fenced');
END;

CREATE TRIGGER IF NOT EXISTS project_promotion_fence_delete
BEFORE DELETE ON project
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM project_maintenance_fence
  WHERE project_id = OLD.id AND kind = 'promotion'
)
BEGIN
  SELECT RAISE(ABORT, 'project_promotion_fenced');
END;

CREATE TRIGGER IF NOT EXISTS session_project_promotion_fence_insert
BEFORE INSERT ON session
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM project_maintenance_fence
  WHERE project_id = NEW.project_id AND kind = 'promotion'
)
BEGIN
  SELECT RAISE(ABORT, 'project_promotion_fenced');
END;

CREATE TRIGGER IF NOT EXISTS session_project_promotion_fence_update
BEFORE UPDATE ON session
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM project_maintenance_fence
  WHERE project_id IN (OLD.project_id, NEW.project_id) AND kind = 'promotion'
)
BEGIN
  SELECT RAISE(ABORT, 'project_promotion_fenced');
END;

CREATE TRIGGER IF NOT EXISTS session_project_promotion_fence_delete
BEFORE DELETE ON session
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM project_maintenance_fence
  WHERE project_id = OLD.project_id AND kind = 'promotion'
)
BEGIN
  SELECT RAISE(ABORT, 'project_promotion_fenced');
END;

-- A Mission Session is a complete durable domain identity at its first
-- observable commit. Mutable Mission state may be added later, but the launch
-- identity cannot be manufactured or rewritten afterward. cwd may move only
-- together with session.directory so Project relocation remains one atomic
-- identity-preserving operation.
CREATE TRIGGER IF NOT EXISTS session_mission_identity_required_insert
BEFORE INSERT ON session
FOR EACH ROW
WHEN NEW.kind = 'mission'
  AND (
    json_type(NEW.metadata, '$.mission') IS NOT 'object'
    OR json_type(NEW.metadata, '$.mission.id') IS NOT 'text'
    OR length(json_extract(NEW.metadata, '$.mission.id')) NOT BETWEEN 1 AND 64
    OR json_extract(NEW.metadata, '$.mission.id') GLOB '*[^a-z0-9-]*'
    OR json_type(NEW.metadata, '$.mission.channelKey') IS NOT 'text'
    OR json_extract(NEW.metadata, '$.mission.channelKey') IS NOT 'mission:' || json_extract(NEW.metadata, '$.mission.id')
    OR json_type(NEW.metadata, '$.mission.cwd') IS NOT 'text'
    OR length(json_extract(NEW.metadata, '$.mission.cwd')) < 1
    OR json_extract(NEW.metadata, '$.mission.cwd') IS NOT NEW.directory
    OR json_type(NEW.metadata, '$.mission.productPillar') IS NOT 'text'
    OR json_extract(NEW.metadata, '$.mission.productPillar') NOT IN ('code', 'work')
    OR json_type(NEW.metadata, '$.mission.visibleExpertSquadIDs') IS NOT 'array'
    OR json_array_length(NEW.metadata, '$.mission.visibleExpertSquadIDs') < 1
    OR EXISTS (
      SELECT 1 FROM json_each(NEW.metadata, '$.mission.visibleExpertSquadIDs') AS squad
      WHERE squad.type IS NOT 'text'
        OR length(squad.value) NOT BETWEEN 1 AND 64
        OR squad.value NOT GLOB '[a-z]*'
        OR squad.value GLOB '*[^a-z0-9-]*'
        OR squad.value GLOB '*--*'
        OR substr(squad.value, -1) = '-'
    )
    OR (
      SELECT count(*) FROM json_each(NEW.metadata, '$.mission.visibleExpertSquadIDs')
    ) IS NOT (
      SELECT count(DISTINCT value) FROM json_each(NEW.metadata, '$.mission.visibleExpertSquadIDs')
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'session: mission identity metadata is incomplete');
END;

CREATE TRIGGER IF NOT EXISTS session_mission_identity_required_update
BEFORE UPDATE ON session
FOR EACH ROW
WHEN NEW.kind = 'mission'
  AND (
    json_type(NEW.metadata, '$.mission') IS NOT 'object'
    OR json_type(NEW.metadata, '$.mission.id') IS NOT 'text'
    OR length(json_extract(NEW.metadata, '$.mission.id')) NOT BETWEEN 1 AND 64
    OR json_extract(NEW.metadata, '$.mission.id') GLOB '*[^a-z0-9-]*'
    OR json_type(NEW.metadata, '$.mission.channelKey') IS NOT 'text'
    OR json_extract(NEW.metadata, '$.mission.channelKey') IS NOT 'mission:' || json_extract(NEW.metadata, '$.mission.id')
    OR json_type(NEW.metadata, '$.mission.cwd') IS NOT 'text'
    OR length(json_extract(NEW.metadata, '$.mission.cwd')) < 1
    OR json_extract(NEW.metadata, '$.mission.cwd') IS NOT NEW.directory
    OR json_type(NEW.metadata, '$.mission.productPillar') IS NOT 'text'
    OR json_extract(NEW.metadata, '$.mission.productPillar') NOT IN ('code', 'work')
    OR json_type(NEW.metadata, '$.mission.visibleExpertSquadIDs') IS NOT 'array'
    OR json_array_length(NEW.metadata, '$.mission.visibleExpertSquadIDs') < 1
    OR EXISTS (
      SELECT 1 FROM json_each(NEW.metadata, '$.mission.visibleExpertSquadIDs') AS squad
      WHERE squad.type IS NOT 'text'
        OR length(squad.value) NOT BETWEEN 1 AND 64
        OR squad.value NOT GLOB '[a-z]*'
        OR squad.value GLOB '*[^a-z0-9-]*'
        OR squad.value GLOB '*--*'
        OR substr(squad.value, -1) = '-'
    )
    OR (
      SELECT count(*) FROM json_each(NEW.metadata, '$.mission.visibleExpertSquadIDs')
    ) IS NOT (
      SELECT count(DISTINCT value) FROM json_each(NEW.metadata, '$.mission.visibleExpertSquadIDs')
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'session: mission identity metadata is incomplete');
END;

CREATE TRIGGER IF NOT EXISTS session_mission_identity_immutable_update
BEFORE UPDATE ON session
FOR EACH ROW
WHEN (OLD.kind = 'mission' OR NEW.kind = 'mission')
  AND (
    NEW.kind IS NOT OLD.kind
    OR json_extract(NEW.metadata, '$.mission.id') IS NOT json_extract(OLD.metadata, '$.mission.id')
    OR json_extract(NEW.metadata, '$.mission.channelKey') IS NOT json_extract(OLD.metadata, '$.mission.channelKey')
    OR json_extract(NEW.metadata, '$.mission.productPillar') IS NOT json_extract(OLD.metadata, '$.mission.productPillar')
    OR json_extract(NEW.metadata, '$.mission.visibleExpertSquadIDs') IS NOT json_extract(OLD.metadata, '$.mission.visibleExpertSquadIDs')
    OR (
      json_extract(NEW.metadata, '$.mission.cwd') IS NOT json_extract(OLD.metadata, '$.mission.cwd')
      AND NEW.directory IS OLD.directory
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'session: mission identity metadata is immutable');
END;

CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
  content,
  chunk_id UNINDEXED,
  project_id UNINDEXED
);

-- Dispatch lineage is immutable physical-execution authority. Adapter input
-- and the exact delivery-owner disposition are required JSON (JavaScript
-- Object Notation) objects; changing this trigger is also the physical schema
-- breakpoint for any future breaking lineage-payload contract.
CREATE TRIGGER IF NOT EXISTS engine_dispatch_lineage_payload_insert
BEFORE INSERT ON engine_artifact
FOR EACH ROW
WHEN NEW.kind = 'dispatch_lineage'
  AND (
    json_type(NEW.payload, '$.adapter_input') IS NOT 'object'
    OR json_type(NEW.payload, '$.delivery_owner') IS NOT 'object'
    OR json_type(NEW.payload, '$.tool_part_id') IS NOT 'text'
    OR length(trim(json_extract(NEW.payload, '$.tool_part_id'))) = 0
    OR json_type(NEW.payload, '$.tool_call_id') IS NOT 'text'
    OR length(trim(json_extract(NEW.payload, '$.tool_call_id'))) = 0
    OR json_type(NEW.payload, '$.tool_name') IS NOT 'text'
    OR NOT (
      COALESCE((
        json_extract(NEW.payload, '$.tool_name') = 'dispatch_agent'
        AND json_type(NEW.payload, '$.collection_member_index') IS NULL
        AND json_type(NEW.payload, '$.collection_member_count') IS NULL
      ), 0)
      OR COALESCE((
        json_extract(NEW.payload, '$.tool_name') = 'dispatch_agents'
        AND json_type(NEW.payload, '$.collection_member_index') = 'integer'
        AND json_extract(NEW.payload, '$.collection_member_index') >= 0
        AND json_type(NEW.payload, '$.collection_member_count') = 'integer'
        AND json_extract(NEW.payload, '$.collection_member_count') > 0
        AND json_extract(NEW.payload, '$.collection_member_index') < json_extract(NEW.payload, '$.collection_member_count')
      ), 0)
    )
    OR NOT (
      (
        json_extract(NEW.payload, '$.delivery_owner.kind') = 'runtime_process'
        AND json_type(NEW.payload, '$.delivery_owner.process_occurrence_id') = 'text'
        AND length(trim(json_extract(NEW.payload, '$.delivery_owner.process_occurrence_id'))) > 0
        AND (SELECT count(*) FROM json_each(NEW.payload, '$.delivery_owner')) = 2
      )
      OR (
        json_extract(NEW.payload, '$.delivery_owner.kind') = 'historical_reconciliation'
        AND json_type(NEW.payload, '$.delivery_owner.source') = 'object'
        AND (SELECT count(*) FROM json_each(NEW.payload, '$.delivery_owner')) = 2
        AND (SELECT count(*) FROM json_each(NEW.payload, '$.delivery_owner.source')) = 2
        AND (
          (
            json_extract(NEW.payload, '$.delivery_owner.source.kind') = 'dispatch_settlement'
            AND json_type(NEW.payload, '$.delivery_owner.source.artifact_id') = 'text'
            AND length(trim(json_extract(NEW.payload, '$.delivery_owner.source.artifact_id'))) > 0
            AND json_type(NEW.payload, '$.delivery_owner.source.event_id') IS NULL
          )
          OR (
            json_extract(NEW.payload, '$.delivery_owner.source.kind') = 'agent_execution_lifecycle'
            AND json_type(NEW.payload, '$.delivery_owner.source.event_id') = 'text'
            AND length(trim(json_extract(NEW.payload, '$.delivery_owner.source.event_id'))) > 0
            AND json_type(NEW.payload, '$.delivery_owner.source.artifact_id') IS NULL
          )
        )
      )
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact: dispatch_lineage requires exact Tool occurrence, adapter_input and delivery_owner objects');
END;

CREATE TRIGGER IF NOT EXISTS engine_dispatch_lineage_immutable
BEFORE UPDATE ON engine_artifact
FOR EACH ROW
WHEN OLD.kind = 'dispatch_lineage' OR NEW.kind = 'dispatch_lineage'
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact: dispatch_lineage facts are immutable');
END;

-- Baseline metric definitions are immutable measurement facts. The SQL layer
-- protects comparability; it does not grant them scheduling authority.
CREATE TRIGGER IF NOT EXISTS engine_metric_spec_baseline_no_update
BEFORE UPDATE ON engine_metric_spec
FOR EACH ROW
WHEN OLD.source = 'baseline'
BEGIN
  SELECT RAISE(ABORT, 'engine_metric_spec: baseline row is frozen (no UPDATE)');
END;

-- SHA-256 means Secure Hash Algorithm 256-bit. SQLite has no built-in SHA-256
-- function and Bun's SQLite binding does not expose user-defined SQL
-- functions. The canonical Engine Artifact writer computes the digest. These
-- triggers enforce the part SQLite can prove independently: the byte count is
-- exact, digests have canonical shape, fixed-block coverage is complete, and
-- payload/index identities cannot be changed separately. Directory reads
-- verify only the bounded index digest. Exact reads verify covered blocks;
-- complete consumers additionally verify the locator's full payload digest.
CREATE TRIGGER IF NOT EXISTS engine_artifact_catalog_metadata_insert
BEFORE INSERT ON engine_artifact
FOR EACH ROW
WHEN
  typeof(NEW.catalog_revision) != 'integer'
  OR NEW.catalog_revision < 1
  OR NOT EXISTS (
    SELECT 1 FROM engine_artifact_catalog_revision
    WHERE revision = NEW.catalog_revision
  )
  OR EXISTS (
    SELECT 1 FROM engine_artifact
    WHERE catalog_revision = NEW.catalog_revision
  )
  OR EXISTS (
    SELECT 1 FROM engine_artifact_version
    WHERE catalog_revision = NEW.catalog_revision
  )
  OR typeof(NEW.payload) != 'text'
  OR json_valid(NEW.payload) != 1
  OR NEW.payload_bytes != octet_length(NEW.payload)
  OR typeof(NEW.payload_sha256) != 'text'
  OR octet_length(NEW.payload_sha256) != 64
  OR NEW.payload_sha256 GLOB '*[^0-9a-f]*'
  OR json_valid(NEW.payload_block_sha256s) != 1
  OR json_type(NEW.payload_block_sha256s) != 'array'
  OR json_array_length(NEW.payload_block_sha256s) != ((NEW.payload_bytes + 65535) / 65536)
  OR EXISTS (
    SELECT 1
    FROM json_each(NEW.payload_block_sha256s)
    WHERE type != 'text'
      OR octet_length(value) != 64
      OR value GLOB '*[^0-9a-f]*'
  )
  OR typeof(NEW.payload_block_index_sha256) != 'text'
  OR octet_length(NEW.payload_block_index_sha256) != 64
  OR NEW.payload_block_index_sha256 GLOB '*[^0-9a-f]*'
  OR (
    NEW.catalog_import_source_task_id IS NOT NULL
    AND (
      typeof(NEW.catalog_import_source_task_id) != 'text'
      OR octet_length(NEW.catalog_import_source_task_id) < 1
    )
  )
  OR typeof(NEW.catalog_metadata_sha256) != 'text'
  OR octet_length(NEW.catalog_metadata_sha256) != 64
  OR NEW.catalog_metadata_sha256 GLOB '*[^0-9a-f]*'
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact: payload catalog metadata is inconsistent');
END;

CREATE TRIGGER IF NOT EXISTS engine_artifact_catalog_metadata_update
BEFORE UPDATE OF
  payload,
  task_id,
  kind,
  label,
  time_created,
  time_updated,
  payload_sha256,
  payload_bytes,
  payload_block_sha256s,
  payload_block_index_sha256,
  catalog_artifact_type,
  catalog_schema_diagnostic,
  catalog_producer,
  catalog_import_source_task_id,
  catalog_resource_count,
  catalog_resource_media_types,
  catalog_search_text,
  catalog_search_text_truncated,
  catalog_metadata_sha256,
  catalog_revision
ON engine_artifact
FOR EACH ROW
WHEN
  typeof(NEW.catalog_revision) != 'integer'
  OR NEW.catalog_revision <= OLD.catalog_revision
  OR NEW.task_id IS NOT OLD.task_id
  OR NEW.kind IS NOT OLD.kind
  OR NEW.time_created IS NOT OLD.time_created
  OR NOT EXISTS (
    SELECT 1 FROM engine_artifact_catalog_revision
    WHERE revision = NEW.catalog_revision
  )
  OR EXISTS (
    SELECT 1 FROM engine_artifact
    WHERE catalog_revision = NEW.catalog_revision
      AND id != OLD.id
  )
  OR EXISTS (
    SELECT 1 FROM engine_artifact_version
    WHERE catalog_revision = NEW.catalog_revision
  )
  OR typeof(NEW.payload) != 'text'
  OR json_valid(NEW.payload) != 1
  OR NEW.payload_bytes != octet_length(NEW.payload)
  OR typeof(NEW.payload_sha256) != 'text'
  OR octet_length(NEW.payload_sha256) != 64
  OR NEW.payload_sha256 GLOB '*[^0-9a-f]*'
  OR json_valid(NEW.payload_block_sha256s) != 1
  OR json_type(NEW.payload_block_sha256s) != 'array'
  OR json_array_length(NEW.payload_block_sha256s) != ((NEW.payload_bytes + 65535) / 65536)
  OR EXISTS (
    SELECT 1
    FROM json_each(NEW.payload_block_sha256s)
    WHERE type != 'text'
      OR octet_length(value) != 64
      OR value GLOB '*[^0-9a-f]*'
  )
  OR typeof(NEW.payload_block_index_sha256) != 'text'
  OR octet_length(NEW.payload_block_index_sha256) != 64
  OR NEW.payload_block_index_sha256 GLOB '*[^0-9a-f]*'
  OR (
    NEW.catalog_import_source_task_id IS NOT NULL
    AND (
      typeof(NEW.catalog_import_source_task_id) != 'text'
      OR octet_length(NEW.catalog_import_source_task_id) < 1
    )
  )
  OR typeof(NEW.catalog_metadata_sha256) != 'text'
  OR octet_length(NEW.catalog_metadata_sha256) != 64
  OR NEW.catalog_metadata_sha256 GLOB '*[^0-9a-f]*'
  OR (
    CAST(COALESCE(NEW.payload, 'null') AS TEXT) IS NOT CAST(COALESCE(OLD.payload, 'null') AS TEXT)
    AND (
      NEW.payload_sha256 = OLD.payload_sha256
      OR NEW.payload_block_sha256s IS OLD.payload_block_sha256s
      OR NEW.payload_block_index_sha256 = OLD.payload_block_index_sha256
      OR NEW.catalog_metadata_sha256 = OLD.catalog_metadata_sha256
    )
  )
  OR (
    CAST(COALESCE(NEW.payload, 'null') AS TEXT) IS CAST(COALESCE(OLD.payload, 'null') AS TEXT)
    AND (
      NEW.payload_sha256 != OLD.payload_sha256
      OR NEW.payload_bytes != OLD.payload_bytes
      OR NEW.payload_block_sha256s IS NOT OLD.payload_block_sha256s
      OR NEW.payload_block_index_sha256 != OLD.payload_block_index_sha256
    )
  )
  OR (
    (
      NEW.payload_sha256 IS NOT OLD.payload_sha256
      OR NEW.payload_bytes IS NOT OLD.payload_bytes
      OR NEW.payload_block_index_sha256 IS NOT OLD.payload_block_index_sha256
      OR NEW.catalog_artifact_type IS NOT OLD.catalog_artifact_type
      OR NEW.catalog_schema_diagnostic IS NOT OLD.catalog_schema_diagnostic
      OR NEW.catalog_producer IS NOT OLD.catalog_producer
      OR NEW.catalog_import_source_task_id IS NOT OLD.catalog_import_source_task_id
      OR NEW.catalog_resource_count IS NOT OLD.catalog_resource_count
      OR NEW.catalog_resource_media_types IS NOT OLD.catalog_resource_media_types
      OR NEW.catalog_search_text IS NOT OLD.catalog_search_text
      OR NEW.catalog_search_text_truncated IS NOT OLD.catalog_search_text_truncated
    )
    AND NEW.catalog_metadata_sha256 = OLD.catalog_metadata_sha256
  )
  OR (
    NEW.task_id IS OLD.task_id
    AND NEW.kind IS OLD.kind
    AND substr(NEW.label, 1, ${ENGINE_ARTIFACT_CATALOG_LABEL_INDEX_CODE_POINTS})
      IS substr(OLD.label, 1, ${ENGINE_ARTIFACT_CATALOG_LABEL_INDEX_CODE_POINTS})
    AND NEW.time_created IS OLD.time_created
    AND NEW.time_updated IS OLD.time_updated
    AND NEW.payload_sha256 IS OLD.payload_sha256
    AND NEW.payload_bytes IS OLD.payload_bytes
    AND NEW.payload_block_index_sha256 IS OLD.payload_block_index_sha256
    AND NEW.catalog_artifact_type IS OLD.catalog_artifact_type
    AND NEW.catalog_schema_diagnostic IS OLD.catalog_schema_diagnostic
    AND NEW.catalog_producer IS OLD.catalog_producer
    AND NEW.catalog_import_source_task_id IS OLD.catalog_import_source_task_id
    AND NEW.catalog_resource_count IS OLD.catalog_resource_count
    AND NEW.catalog_resource_media_types IS OLD.catalog_resource_media_types
    AND NEW.catalog_search_text IS OLD.catalog_search_text
    AND NEW.catalog_search_text_truncated IS OLD.catalog_search_text_truncated
    AND NEW.catalog_metadata_sha256 != OLD.catalog_metadata_sha256
  )
  OR (
    (
      NEW.task_id IS NOT OLD.task_id
      OR NEW.kind IS NOT OLD.kind
      OR substr(NEW.label, 1, ${ENGINE_ARTIFACT_CATALOG_LABEL_INDEX_CODE_POINTS})
        IS NOT substr(OLD.label, 1, ${ENGINE_ARTIFACT_CATALOG_LABEL_INDEX_CODE_POINTS})
      OR NEW.time_created IS NOT OLD.time_created
      OR NEW.time_updated IS NOT OLD.time_updated
    )
    AND NEW.catalog_metadata_sha256 = OLD.catalog_metadata_sha256
  )
  OR NEW.catalog_import_source_task_id IS NOT OLD.catalog_import_source_task_id
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact: payload and bounded catalog identities must change atomically');
END;

CREATE TRIGGER IF NOT EXISTS engine_artifact_catalog_revision_no_update
BEFORE UPDATE ON engine_artifact_catalog_revision
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact_catalog_revision: revisions are append-only');
END;

CREATE TRIGGER IF NOT EXISTS engine_artifact_catalog_revision_no_delete
BEFORE DELETE ON engine_artifact_catalog_revision
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact_catalog_revision: revisions are append-only');
END;

CREATE TRIGGER IF NOT EXISTS engine_artifact_version_integrity_insert
BEFORE INSERT ON engine_artifact_version
FOR EACH ROW
WHEN
  typeof(NEW.catalog_revision) != 'integer'
  OR NEW.catalog_revision < 1
  OR NOT EXISTS (
    SELECT 1 FROM engine_artifact_catalog_revision
    WHERE revision = NEW.catalog_revision
  )
  OR EXISTS (
    SELECT 1 FROM engine_artifact
    WHERE catalog_revision = NEW.catalog_revision
  )
  OR EXISTS (
    SELECT 1 FROM engine_artifact_version
    WHERE catalog_revision = NEW.catalog_revision
  )
  OR NOT EXISTS (
    SELECT 1
    FROM engine_artifact AS current
    WHERE current.id = NEW.artifact_id
      AND current.task_id IS NEW.task_id
      AND current.kind IS NEW.kind
      AND NEW.catalog_revision < current.catalog_revision
  )
  OR typeof(NEW.payload) != 'text'
  OR json_valid(NEW.payload) != 1
  OR NEW.payload_bytes != octet_length(NEW.payload)
  OR typeof(NEW.payload_sha256) != 'text'
  OR octet_length(NEW.payload_sha256) != 64
  OR NEW.payload_sha256 GLOB '*[^0-9a-f]*'
  OR json_valid(NEW.payload_block_sha256s) != 1
  OR json_type(NEW.payload_block_sha256s) != 'array'
  OR json_array_length(NEW.payload_block_sha256s) != ((NEW.payload_bytes + 65535) / 65536)
  OR EXISTS (
    SELECT 1
    FROM json_each(NEW.payload_block_sha256s)
    WHERE type != 'text'
      OR octet_length(value) != 64
      OR value GLOB '*[^0-9a-f]*'
  )
  OR typeof(NEW.payload_block_index_sha256) != 'text'
  OR octet_length(NEW.payload_block_index_sha256) != 64
  OR NEW.payload_block_index_sha256 GLOB '*[^0-9a-f]*'
  OR typeof(NEW.catalog_metadata_sha256) != 'text'
  OR octet_length(NEW.catalog_metadata_sha256) != 64
  OR NEW.catalog_metadata_sha256 GLOB '*[^0-9a-f]*'
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact_version: prior catalog version is inconsistent');
END;

CREATE TRIGGER IF NOT EXISTS engine_artifact_archive_previous_version
AFTER UPDATE ON engine_artifact
FOR EACH ROW
BEGIN
  INSERT INTO engine_artifact_version (
    artifact_id, task_id, kind, label, payload,
    payload_sha256, payload_bytes, payload_block_sha256s, payload_block_index_sha256,
    catalog_artifact_type, catalog_schema_diagnostic, catalog_producer,
    catalog_import_source_task_id, catalog_resource_count, catalog_resource_media_types,
    catalog_search_text, catalog_search_text_truncated, catalog_metadata_sha256,
    catalog_revision, time_created, time_updated
  ) VALUES (
    OLD.id, OLD.task_id, OLD.kind, OLD.label, OLD.payload,
    OLD.payload_sha256, OLD.payload_bytes, OLD.payload_block_sha256s, OLD.payload_block_index_sha256,
    OLD.catalog_artifact_type, OLD.catalog_schema_diagnostic, OLD.catalog_producer,
    OLD.catalog_import_source_task_id, OLD.catalog_resource_count, OLD.catalog_resource_media_types,
    OLD.catalog_search_text, OLD.catalog_search_text_truncated, OLD.catalog_metadata_sha256,
    OLD.catalog_revision, OLD.time_created, OLD.time_updated
  );
END;

CREATE TRIGGER IF NOT EXISTS engine_artifact_version_no_update
BEFORE UPDATE ON engine_artifact_version
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact_version: prior versions are immutable');
END;

CREATE TRIGGER IF NOT EXISTS engine_artifact_version_no_delete
BEFORE DELETE ON engine_artifact_version
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM engine_artifact
  WHERE id = OLD.artifact_id
)
AND EXISTS (
  SELECT 1 FROM engine_task
  WHERE id = OLD.task_id
)
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact_version: prior versions are immutable');
END;

-- Architect ContractGraph and GoalGraphProjection rows are immutable
-- execution facts. Mutable coordination and ingress artifacts keep their dedicated
-- update protocols; these two kinds can only be superseded by appending a new
-- exact Artifact.
CREATE TRIGGER IF NOT EXISTS engine_goal_graph_artifact_immutable
BEFORE UPDATE ON engine_artifact
FOR EACH ROW
WHEN OLD.kind IN ('architect_contract_graph', 'goal_graph_projection', 'goal_workload')
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact: domain publication facts are immutable');
END;

CREATE TRIGGER IF NOT EXISTS engine_goal_exact_artifact_binding_insert
BEFORE INSERT ON engine_goal
FOR EACH ROW
WHEN
  (NEW.requirement_set_artifact_id IS NULL) != (NEW.requirement_set_artifact_sha256 IS NULL)
  OR (NEW.requirement_set_artifact_id IS NULL) != (NEW.requirement_set_artifact_revision IS NULL)
  OR (NEW.contract_graph_artifact_id IS NULL) != (NEW.contract_graph_artifact_sha256 IS NULL)
  OR (NEW.contract_graph_artifact_id IS NULL) != (NEW.contract_graph_artifact_revision IS NULL)
  OR (
    NEW.requirement_set_artifact_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM engine_artifact
      WHERE id = NEW.requirement_set_artifact_id
        AND task_id = NEW.task_id
        AND kind = 'requirement_set'
        AND catalog_revision = NEW.requirement_set_artifact_revision
        AND payload_sha256 = NEW.requirement_set_artifact_sha256
    )
    AND NOT EXISTS (
      SELECT 1 FROM engine_artifact_version
      WHERE artifact_id = NEW.requirement_set_artifact_id
        AND task_id = NEW.task_id
        AND kind = 'requirement_set'
        AND catalog_revision = NEW.requirement_set_artifact_revision
        AND payload_sha256 = NEW.requirement_set_artifact_sha256
    )
  )
  OR (
    NEW.contract_graph_artifact_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM engine_artifact
      WHERE id = NEW.contract_graph_artifact_id
        AND task_id = NEW.task_id
        AND kind = 'architect_contract_graph'
        AND catalog_revision = NEW.contract_graph_artifact_revision
        AND payload_sha256 = NEW.contract_graph_artifact_sha256
    )
    AND NOT EXISTS (
      SELECT 1 FROM engine_artifact_version
      WHERE artifact_id = NEW.contract_graph_artifact_id
        AND task_id = NEW.task_id
        AND kind = 'architect_contract_graph'
        AND catalog_revision = NEW.contract_graph_artifact_revision
        AND payload_sha256 = NEW.contract_graph_artifact_sha256
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'engine_goal: Artifact bindings must be exact same-Task locators');
END;

CREATE TRIGGER IF NOT EXISTS engine_goal_immutable
BEFORE UPDATE ON engine_goal
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'engine_goal: Goal revisions are immutable; append a new revision fact');
END;

CREATE TRIGGER IF NOT EXISTS engine_goal_supersede_same_task_insert
BEFORE INSERT ON engine_goal
FOR EACH ROW
WHEN
  NEW.supersede_of IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM engine_goal
    WHERE id = NEW.supersede_of
      AND task_id = NEW.task_id
  )
BEGIN
  SELECT RAISE(ABORT, 'engine_goal: supersede_of must reference an existing Goal in the same Task');
END;

CREATE TRIGGER IF NOT EXISTS automation_definition_revision_no_update
BEFORE UPDATE ON automation
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'automation: definition revisions are immutable; append a revision');
END;

CREATE TRIGGER IF NOT EXISTS automation_definition_revision_no_delete
BEFORE DELETE ON automation
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'automation: definition revisions are immutable; append a tombstone revision');
END;

CREATE TRIGGER IF NOT EXISTS automation_definition_tombstone_no_update
BEFORE UPDATE ON automation_definition_tombstone FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'automation_definition_tombstone: immutable deletion fact'); END;
CREATE TRIGGER IF NOT EXISTS automation_definition_tombstone_no_delete
BEFORE DELETE ON automation_definition_tombstone FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'automation_definition_tombstone: immutable deletion fact'); END;

CREATE TRIGGER IF NOT EXISTS automation_fire_no_update
BEFORE UPDATE ON automation_fire FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'automation_fire: immutable logical occurrence'); END;
CREATE TRIGGER IF NOT EXISTS automation_fire_no_delete
BEFORE DELETE ON automation_fire FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'automation_fire: immutable logical occurrence'); END;

CREATE TRIGGER IF NOT EXISTS automation_delay_settlement_no_update
BEFORE UPDATE ON automation_delay_settlement FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'automation_delay_settlement: immutable admission settlement'); END;
CREATE TRIGGER IF NOT EXISTS automation_delay_settlement_no_delete
BEFORE DELETE ON automation_delay_settlement FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'automation_delay_settlement: immutable admission settlement'); END;
CREATE TRIGGER IF NOT EXISTS automation_delay_settlement_lineage_insert
BEFORE INSERT ON automation_delay_settlement FOR EACH ROW
WHEN
  json_type(NEW.accepted_input_message_ids)<>'array'
  OR json_array_length(NEW.accepted_input_message_ids)=0
  OR NOT EXISTS (
    SELECT 1
    FROM automation AS definition
    JOIN message AS assistant
      ON assistant.id=NEW.assistant_message_id
      AND assistant.session_id=definition.session_id
      AND json_extract(assistant.data,'$.role')='assistant'
    WHERE definition.definition_id=NEW.definition_id
      AND definition.kind='delay'
      AND definition.session_id IS NOT NULL
      AND json_type(assistant.data,'$.acceptedInputMessageIDs')='array'
      AND json(json_extract(assistant.data,'$.acceptedInputMessageIDs'))=json(NEW.accepted_input_message_ids)
  )
  OR EXISTS (
    SELECT 1
    FROM json_each(NEW.accepted_input_message_ids) AS accepted
    LEFT JOIN message AS input ON input.id=accepted.value
    JOIN automation AS definition ON definition.definition_id=NEW.definition_id
    WHERE input.id IS NULL
      OR input.session_id<>definition.session_id
      OR json_extract(input.data,'$.role')<>'user'
  )
  OR (
    NEW.disposition='due_accepted'
    AND NOT EXISTS (
      SELECT 1
      FROM json_each(NEW.accepted_input_message_ids) AS accepted
      JOIN message AS wake
        ON wake.id=accepted.value
        AND json_extract(wake.data,'$.role')='user'
      JOIN automation_fire AS fire
        ON fire.id=NEW.fire_id
      JOIN automation AS definition
        ON definition.id=fire.automation_revision_id
      JOIN automation_run AS run
        ON run.fire_id=fire.id
        AND run.automation_revision_id=fire.automation_revision_id
      WHERE definition.definition_id=NEW.definition_id
        AND definition.kind='delay'
        AND wake.session_id=definition.session_id
        AND json_extract(wake.data,'$.extra.wake_reason.source')='scheduler.automation'
        AND json_extract(wake.data,'$.extra.wake_reason.jobID')=definition.definition_id
        AND json_extract(wake.data,'$.extra.wake_reason.fireID')=fire.id
        AND (
          SELECT count(*) FROM automation_run AS exact_run
          WHERE exact_run.fire_id=fire.id
            AND exact_run.automation_revision_id=fire.automation_revision_id
        )=1
    )
  )
BEGIN SELECT RAISE(ABORT, 'automation_delay_settlement: invalid Session delay admission lineage'); END;

CREATE TRIGGER IF NOT EXISTS automation_fire_attempt_no_update
BEFORE UPDATE ON automation_fire_attempt FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'automation_fire_attempt: immutable physical attempt'); END;
CREATE TRIGGER IF NOT EXISTS automation_fire_attempt_no_delete
BEFORE DELETE ON automation_fire_attempt FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'automation_fire_attempt: immutable physical attempt'); END;
CREATE TRIGGER IF NOT EXISTS automation_fire_attempt_admission_insert
BEFORE INSERT ON automation_fire_attempt FOR EACH ROW
WHEN
  NEW.ordinal<>(
    SELECT COALESCE(max(existing.ordinal),0)+1
    FROM automation_fire_attempt AS existing
    WHERE existing.fire_id=NEW.fire_id
  )
  OR NOT EXISTS (
    SELECT 1
    FROM automation_fire AS fire
    JOIN automation AS definition ON definition.id=fire.automation_revision_id
    JOIN engine_control_activation_lease AS lease
      ON lease.target='automation'
      AND lease.target_id=definition.definition_id
      AND lease.owner_occurrence_id=NEW.owner_occurrence_id
      AND lease.expires_at>NEW.time_created
    WHERE fire.id=NEW.fire_id
      AND lease.time_activated=(
        SELECT max(current.time_activated)
        FROM engine_control_activation_lease AS current
        WHERE current.target='automation'
          AND current.target_id=definition.definition_id
      )
  )
BEGIN SELECT RAISE(ABORT, 'automation_fire_attempt: invalid ordinal or owner admission'); END;
CREATE TRIGGER IF NOT EXISTS automation_fire_attempt_receipt_no_update
BEFORE UPDATE ON automation_fire_attempt_receipt FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'automation_fire_attempt_receipt: immutable attempt receipt'); END;
CREATE TRIGGER IF NOT EXISTS automation_fire_attempt_receipt_no_delete
BEFORE DELETE ON automation_fire_attempt_receipt FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'automation_fire_attempt_receipt: immutable attempt receipt'); END;

CREATE TRIGGER IF NOT EXISTS automation_run_no_update
BEFORE UPDATE ON automation_run
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'automation_run: execution input is immutable; append a receipt');
END;

CREATE TRIGGER IF NOT EXISTS automation_run_no_delete
BEFORE DELETE ON automation_run
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'automation_run: execution history is immutable');
END;

CREATE TRIGGER IF NOT EXISTS automation_run_fire_revision_insert
BEFORE INSERT ON automation_run
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM automation_fire
  WHERE id=NEW.fire_id AND automation_revision_id=NEW.automation_revision_id
)
BEGIN
  SELECT RAISE(ABORT, 'automation_run: logical fire belongs to another definition revision');
END;

CREATE TRIGGER IF NOT EXISTS automation_run_mission_reservation_insert
BEFORE INSERT ON automation_run
FOR EACH ROW
WHEN (
  EXISTS (
    SELECT 1 FROM automation AS definition
    JOIN session AS target ON target.id=definition.session_id
    WHERE definition.id=NEW.automation_revision_id AND target.kind='mission'
  )
  AND NEW.mission_opened_event_id IS NULL
  AND NEW.mission_disposition IS NULL
  AND NEW.mission_closure_event_id IS NULL
) OR (
  NOT EXISTS (
    SELECT 1 FROM automation AS definition
    JOIN session AS target ON target.id=definition.session_id
    WHERE definition.id=NEW.automation_revision_id AND target.kind='mission'
  )
  AND (
    NEW.mission_opened_event_id IS NOT NULL
    OR NEW.mission_disposition IS NOT NULL
    OR NEW.mission_closure_event_id IS NOT NULL
  )
)
BEGIN
  SELECT RAISE(ABORT, 'automation_run: Mission target requires one exact active or terminal reservation');
END;

-- An accepted Task-root Message is frozen in content, not in place. Delivery
-- moves it from the Task-root Session into the Orchestrator Session, which
-- rewrites only its Session, its timeline position, and the matching \`time\`
-- and \`orderKey\` inside \`data\` -- not one word of what was said. Freezing
-- the row outright made that move impossible, so a Message accepted before it
-- was delivered could never be delivered at all: every wake replayed the same
-- refused relocation and the Task died holding it. The exemption is therefore
-- exactly one shape -- a relocation that leaves the causal content identical --
-- and every other update, including a bare timestamp bump in place, still aborts.
CREATE TRIGGER IF NOT EXISTS task_root_source_message_no_update
BEFORE UPDATE ON message
FOR EACH ROW
WHEN (
    EXISTS (SELECT 1 FROM engine_task_root_ingress WHERE source='message' AND source_id=OLD.id)
    OR EXISTS (SELECT 1 FROM protocol_event WHERE json_extract(payload,'$.inputMessageID')=OLD.id)
  )
  AND NOT (
    NEW.id = OLD.id
    AND NEW.session_id <> OLD.session_id
    AND json_remove(NEW.data, '$.time', '$.orderKey') IS json_remove(OLD.data, '$.time', '$.orderKey')
  )
BEGIN
  SELECT RAISE(ABORT, 'message: accepted Task-root causal facts are immutable');
END;

CREATE TRIGGER IF NOT EXISTS deleted_task_no_update
BEFORE UPDATE ON engine_task FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM protocol_event WHERE aggregate_type='task' AND aggregate_id=OLD.id AND type='task.deleted')
BEGIN SELECT RAISE(ABORT, 'engine_task: deleted aggregate is immutable'); END;

CREATE TRIGGER IF NOT EXISTS deleted_task_protocol_no_insert
BEFORE INSERT ON protocol_event FOR EACH ROW
WHEN NEW.aggregate_type='task' AND NEW.type<>'task.deleted'
  AND EXISTS (SELECT 1 FROM protocol_event WHERE aggregate_type='task' AND aggregate_id=NEW.aggregate_id AND type='task.deleted')
BEGIN SELECT RAISE(ABORT, 'protocol_event: deleted Task rejects new lifecycle facts'); END;

CREATE TRIGGER IF NOT EXISTS deleted_task_ingress_no_insert
BEFORE INSERT ON engine_task_root_ingress FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM protocol_event WHERE aggregate_type='task' AND aggregate_id=NEW.task_id AND type='task.deleted')
BEGIN SELECT RAISE(ABORT, 'engine_task_root_ingress: deleted Task rejects new input'); END;

CREATE TRIGGER IF NOT EXISTS deleted_task_artifact_no_insert
BEFORE INSERT ON engine_artifact FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM protocol_event WHERE aggregate_type='task' AND aggregate_id=NEW.task_id AND type='task.deleted')
BEGIN SELECT RAISE(ABORT, 'engine_artifact: deleted Task rejects new facts'); END;

CREATE TRIGGER IF NOT EXISTS deleted_task_interaction_no_insert
BEFORE INSERT ON engine_interaction_request FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM protocol_event WHERE aggregate_type='task' AND aggregate_id=NEW.task_id AND type='task.deleted')
  OR (
    NEW.source_kind='permission_request' AND EXISTS (
      SELECT 1 FROM permission_ledger
      JOIN protocol_event ON protocol_event.aggregate_type='task'
        AND protocol_event.aggregate_id=permission_ledger.task_id
        AND protocol_event.type='task.deleted'
      WHERE permission_ledger.id=NEW.source_id
    )
  )
  OR (
    NEW.source_kind='bus_question' AND EXISTS (
      WITH RECURSIVE source_session(id,parent_id) AS (
        SELECT session.id,session.parent_id
        FROM bus_publication_outbox
        JOIN session ON session.id=json_extract(bus_publication_outbox.properties,'$.sessionID')
        WHERE bus_publication_outbox.occurrence_id=NEW.source_id
        UNION ALL
        SELECT session.id,session.parent_id FROM session
        JOIN source_session ON session.id=source_session.parent_id
      )
      SELECT 1 FROM source_session
      JOIN engine_task ON engine_task.session_id=source_session.id
      JOIN protocol_event ON protocol_event.aggregate_type='task'
        AND protocol_event.aggregate_id=engine_task.id
        AND protocol_event.type='task.deleted'
    )
  )
BEGIN SELECT RAISE(ABORT, 'engine_interaction_request: deleted Task rejects new facts'); END;

CREATE TRIGGER IF NOT EXISTS deleted_task_progress_no_insert
BEFORE INSERT ON engine_progress_snapshot FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM protocol_event WHERE aggregate_type='task' AND aggregate_id=NEW.task_id AND type='task.deleted')
BEGIN SELECT RAISE(ABORT, 'engine_progress_snapshot: deleted Task rejects new facts'); END;

CREATE TRIGGER IF NOT EXISTS deleted_task_workflow_no_insert
BEFORE INSERT ON engine_workflow_node_occurrence FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM protocol_event WHERE aggregate_type='task' AND aggregate_id=NEW.task_id AND type='task.deleted')
BEGIN SELECT RAISE(ABORT, 'engine_workflow_node_occurrence: deleted Task rejects new facts'); END;

CREATE TRIGGER IF NOT EXISTS deleted_task_goal_no_insert
BEFORE INSERT ON engine_goal FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM protocol_event WHERE aggregate_type='task' AND aggregate_id=NEW.task_id AND type='task.deleted')
BEGIN SELECT RAISE(ABORT, 'engine_goal: deleted Task rejects new facts'); END;

CREATE TRIGGER IF NOT EXISTS deleted_session_no_update
BEFORE UPDATE ON session FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM protocol_event WHERE aggregate_type='session' AND aggregate_id=OLD.id AND type='session.deleted')
BEGIN SELECT RAISE(ABORT, 'session: deleted aggregate is immutable'); END;

CREATE TRIGGER IF NOT EXISTS deleted_session_protocol_no_insert
BEFORE INSERT ON protocol_event FOR EACH ROW
WHEN NEW.aggregate_type='session' AND NEW.type<>'session.deleted'
  AND EXISTS (SELECT 1 FROM protocol_event WHERE aggregate_type='session' AND aggregate_id=NEW.aggregate_id AND type='session.deleted')
BEGIN SELECT RAISE(ABORT, 'protocol_event: deleted Session rejects new lifecycle facts'); END;

CREATE TRIGGER IF NOT EXISTS deleted_session_message_no_insert
BEFORE INSERT ON message FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM protocol_event WHERE aggregate_type='session' AND aggregate_id=NEW.session_id AND type='session.deleted')
BEGIN SELECT RAISE(ABORT, 'message: deleted Session rejects new facts'); END;

CREATE TRIGGER IF NOT EXISTS deleted_session_message_no_update
BEFORE UPDATE ON message FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM protocol_event WHERE aggregate_type='session' AND aggregate_id=OLD.session_id AND type='session.deleted')
BEGIN SELECT RAISE(ABORT, 'message: deleted Session facts are immutable'); END;

CREATE TRIGGER IF NOT EXISTS deleted_session_part_no_insert
BEFORE INSERT ON part FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM message JOIN protocol_event
    ON protocol_event.aggregate_type='session'
   AND protocol_event.aggregate_id=message.session_id
   AND protocol_event.type='session.deleted'
  WHERE message.id=NEW.message_id
)
BEGIN SELECT RAISE(ABORT, 'part: deleted Session rejects new facts'); END;

CREATE TRIGGER IF NOT EXISTS deleted_session_part_no_update
BEFORE UPDATE ON part FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM message JOIN protocol_event
    ON protocol_event.aggregate_type='session'
   AND protocol_event.aggregate_id=message.session_id
   AND protocol_event.type='session.deleted'
  WHERE message.id=OLD.message_id
)
BEGIN SELECT RAISE(ABORT, 'part: deleted Session facts are immutable'); END;

CREATE TRIGGER IF NOT EXISTS deleted_session_tool_request_no_insert
BEFORE INSERT ON tool_part_request FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM message JOIN protocol_event
    ON protocol_event.aggregate_type='session'
   AND protocol_event.aggregate_id=message.session_id
   AND protocol_event.type='session.deleted'
  WHERE message.id=NEW.message_id
)
BEGIN SELECT RAISE(ABORT, 'tool_part_request: deleted Session rejects new effects'); END;

CREATE TRIGGER IF NOT EXISTS deleted_session_provider_request_no_insert
BEFORE INSERT ON provider_activity_request FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM message JOIN protocol_event
    ON protocol_event.aggregate_type='session'
   AND protocol_event.aggregate_id=message.session_id
   AND protocol_event.type='session.deleted'
  WHERE message.id=NEW.assistant_message_id
)
BEGIN SELECT RAISE(ABORT, 'provider_activity_request: deleted Session rejects new effects'); END;

CREATE TRIGGER IF NOT EXISTS deleted_session_control_no_insert
BEFORE INSERT ON session_control_record FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM protocol_event WHERE aggregate_type='session' AND aggregate_id=NEW.session_id AND type='session.deleted')
BEGIN SELECT RAISE(ABORT, 'session_control_record: deleted Session rejects new controls'); END;

CREATE TRIGGER IF NOT EXISTS assistant_effect_identity_immutable
BEFORE UPDATE ON message
FOR EACH ROW
WHEN json_extract(OLD.data,'$.role')='assistant'
  AND (
    json_type(OLD.data,'$.activationID')='text'
    OR EXISTS (SELECT 1 FROM provider_activity_request WHERE assistant_message_id=OLD.id)
    OR EXISTS (SELECT 1 FROM tool_part_request WHERE message_id=OLD.id)
  )
  AND (
    OLD.session_id IS NOT NEW.session_id
    OR json_extract(OLD.data,'$.role') IS NOT json_extract(NEW.data,'$.role')
    OR json_extract(OLD.data,'$.author') IS NOT json_extract(NEW.data,'$.author')
    OR json_extract(OLD.data,'$.parentID') IS NOT json_extract(NEW.data,'$.parentID')
    OR json_extract(OLD.data,'$.activationID') IS NOT json_extract(NEW.data,'$.activationID')
    OR json_extract(OLD.data,'$.agent') IS NOT json_extract(NEW.data,'$.agent')
    OR json_extract(OLD.data,'$.modelID') IS NOT json_extract(NEW.data,'$.modelID')
    OR json_extract(OLD.data,'$.providerID') IS NOT json_extract(NEW.data,'$.providerID')
  )
BEGIN
  SELECT RAISE(ABORT, 'message: assistant effect causal/model identity is immutable');
END;

CREATE TRIGGER IF NOT EXISTS completed_assistant_message_immutable
BEFORE UPDATE ON message
FOR EACH ROW
WHEN json_extract(OLD.data,'$.role')='assistant'
  AND json_type(OLD.data,'$.time.completed') IN ('integer','real')
  AND OLD.data <> NEW.data
BEGIN
  SELECT RAISE(ABORT, 'message: completed assistant is immutable');
END;

CREATE TRIGGER IF NOT EXISTS task_root_source_message_no_delete
BEFORE DELETE ON message
FOR EACH ROW
WHEN (
  EXISTS (SELECT 1 FROM engine_task_root_ingress WHERE source='message' AND source_id=OLD.id)
  OR json_type(OLD.data, '$.activationID')='text'
  OR EXISTS (SELECT 1 FROM protocol_event WHERE json_extract(payload,'$.inputMessageID')=OLD.id)
  OR EXISTS (SELECT 1 FROM message child WHERE json_extract(child.data,'$.parentID')=OLD.id AND json_extract(child.data,'$.role')='assistant')
)
  AND EXISTS (SELECT 1 FROM session WHERE id=OLD.session_id)
BEGIN
  SELECT RAISE(ABORT, 'message: Task-root causal facts are immutable');
END;

CREATE TRIGGER IF NOT EXISTS task_root_source_part_no_insert
BEFORE INSERT ON part
FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM engine_task_root_ingress WHERE source='message' AND source_id=NEW.message_id)
  OR EXISTS (SELECT 1 FROM protocol_event WHERE json_extract(payload,'$.inputMessageID')=NEW.message_id)
BEGIN
  SELECT RAISE(ABORT, 'part: accepted Task-root input bundle is immutable');
END;

CREATE TRIGGER IF NOT EXISTS task_root_causal_part_no_delete
BEFORE DELETE ON part
FOR EACH ROW
WHEN (
  EXISTS (SELECT 1 FROM message WHERE id=OLD.message_id AND json_type(data,'$.activationID')='text')
  OR EXISTS (SELECT 1 FROM engine_task_root_ingress WHERE source='message' AND source_id=OLD.message_id)
  OR EXISTS (SELECT 1 FROM protocol_event WHERE json_extract(payload,'$.inputMessageID')=OLD.message_id)
)
  AND EXISTS (
    SELECT 1 FROM message JOIN session ON session.id=message.session_id WHERE message.id=OLD.message_id
  )
BEGIN
  SELECT RAISE(ABORT, 'part: Task-root causal facts are immutable');
END;

CREATE TRIGGER IF NOT EXISTS completed_assistant_part_no_insert
BEFORE INSERT ON part
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM message
  WHERE id=NEW.message_id
    AND json_extract(data,'$.role')='assistant'
    AND json_type(data,'$.time.completed') IN ('integer','real')
    AND NOT (
      json_extract(NEW.data,'$.type')='compaction'
      AND json_extract(data,'$.summary')=1
      AND json_extract(data,'$.author')='compaction'
    )
)
BEGIN
  SELECT RAISE(ABORT, 'part: completed assistant content is immutable');
END;

CREATE TRIGGER IF NOT EXISTS completed_assistant_part_no_update
BEFORE UPDATE ON part
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM message
  WHERE id=OLD.message_id
    AND json_extract(data,'$.role')='assistant'
    AND json_type(data,'$.time.completed') IN ('integer','real')
)
  AND OLD.data <> NEW.data
BEGIN
  SELECT RAISE(ABORT, 'part: completed assistant content is immutable');
END;

CREATE TRIGGER IF NOT EXISTS completed_assistant_tool_request_no_insert
BEFORE INSERT ON tool_part_request
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM message
  WHERE id=NEW.message_id
    AND json_extract(data,'$.role')='assistant'
    AND json_type(data,'$.time.completed') IN ('integer','real')
)
BEGIN
  SELECT RAISE(ABORT, 'tool_part_request: cannot append after assistant completion');
END;

CREATE TRIGGER IF NOT EXISTS task_root_source_artifact_no_update
BEFORE UPDATE ON engine_artifact
FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM engine_task_root_ingress WHERE source='engine_artifact' AND source_id=OLD.id)
  AND EXISTS (SELECT 1 FROM engine_task WHERE id=OLD.task_id)
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact: accepted Task-root source is immutable');
END;

CREATE TRIGGER IF NOT EXISTS task_root_source_artifact_no_delete
BEFORE DELETE ON engine_artifact
FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM engine_task_root_ingress WHERE source='engine_artifact' AND source_id=OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact: accepted Task-root source is immutable');
END;

CREATE TRIGGER IF NOT EXISTS tool_part_request_no_update
BEFORE UPDATE ON tool_part_request FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'tool_part_request: immutable request fact'); END;
CREATE TRIGGER IF NOT EXISTS tool_part_request_no_delete
BEFORE DELETE ON tool_part_request FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM message JOIN session ON session.id=message.session_id WHERE message.id=OLD.message_id
)
BEGIN SELECT RAISE(ABORT, 'tool_part_request: immutable request fact'); END;
CREATE TRIGGER IF NOT EXISTS tool_part_progress_running_insert
BEFORE INSERT ON tool_part_progress FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM tool_part_outcome WHERE request_part_id=NEW.request_part_id)
  OR EXISTS (
    SELECT 1 FROM tool_part_request
    JOIN message ON message.id=tool_part_request.message_id
    WHERE tool_part_request.id=NEW.request_part_id
      AND json_type(message.data,'$.time.completed') IN ('integer','real')
  )
  OR EXISTS (
    SELECT 1 FROM tool_part_request
    JOIN message ON message.id=tool_part_request.message_id
    JOIN protocol_event
      ON protocol_event.aggregate_type='session'
     AND protocol_event.aggregate_id=message.session_id
     AND protocol_event.type='session.deleted'
    WHERE tool_part_request.id=NEW.request_part_id
  )
BEGIN SELECT RAISE(ABORT, 'tool_part_progress: request is no longer running'); END;
CREATE TRIGGER IF NOT EXISTS tool_part_progress_no_update
BEFORE UPDATE ON tool_part_progress FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'tool_part_progress: immutable progress fact'); END;
CREATE TRIGGER IF NOT EXISTS tool_part_progress_no_delete
BEFORE DELETE ON tool_part_progress FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM tool_part_request
  JOIN message ON message.id=tool_part_request.message_id
  JOIN session ON session.id=message.session_id
  WHERE tool_part_request.id=OLD.request_part_id
)
BEGIN SELECT RAISE(ABORT, 'tool_part_progress: immutable progress fact'); END;
CREATE TRIGGER IF NOT EXISTS tool_part_outcome_no_update
BEFORE UPDATE ON tool_part_outcome FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'tool_part_outcome: immutable outcome fact'); END;
CREATE TRIGGER IF NOT EXISTS tool_part_outcome_no_delete
BEFORE DELETE ON tool_part_outcome FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM tool_part_request
  JOIN message ON message.id=tool_part_request.message_id
  JOIN session ON session.id=message.session_id
  WHERE tool_part_request.id=OLD.request_part_id
)
BEGIN SELECT RAISE(ABORT, 'tool_part_outcome: immutable outcome fact'); END;
CREATE TRIGGER IF NOT EXISTS provider_activity_request_no_update
BEFORE UPDATE ON provider_activity_request FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'provider_activity_request: immutable request fact'); END;
CREATE TRIGGER IF NOT EXISTS provider_activity_request_no_delete
BEFORE DELETE ON provider_activity_request FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM message JOIN session ON session.id=message.session_id WHERE message.id=OLD.assistant_message_id
)
BEGIN SELECT RAISE(ABORT, 'provider_activity_request: immutable request fact'); END;
CREATE TRIGGER IF NOT EXISTS provider_activity_outcome_no_update
BEFORE UPDATE ON provider_activity_outcome FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'provider_activity_outcome: immutable outcome fact'); END;
CREATE TRIGGER IF NOT EXISTS provider_activity_outcome_no_delete
BEFORE DELETE ON provider_activity_outcome FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM provider_activity_request
  JOIN message ON message.id=provider_activity_request.assistant_message_id
  JOIN session ON session.id=message.session_id
  WHERE provider_activity_request.id=OLD.request_id
)
BEGIN SELECT RAISE(ABORT, 'provider_activity_outcome: immutable outcome fact'); END;

-- Permission evidence is immutable for as long as the Project it describes
-- exists. Both tables cascade from project, so the delete guards must yield to
-- that cascade the way provider_activity_outcome does: without the parent
-- probe the trigger aborts Project deletion itself and the row becomes
-- undeletable evidence of an unreachable Project. Ledger rows carrying no
-- project_id are outcome facts that no cascade ever reaches, so they stay
-- unconditionally immutable.
CREATE TRIGGER IF NOT EXISTS permission_policy_no_update
BEFORE UPDATE ON permission_policy FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'permission_policy: immutable policy fact'); END;
CREATE TRIGGER IF NOT EXISTS permission_policy_no_delete
BEFORE DELETE ON permission_policy FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM project WHERE id=OLD.project_id)
BEGIN SELECT RAISE(ABORT, 'permission_policy: immutable policy fact'); END;
CREATE TRIGGER IF NOT EXISTS permission_ledger_no_update
BEFORE UPDATE ON permission_ledger FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'permission_ledger: immutable authorization fact'); END;
CREATE TRIGGER IF NOT EXISTS permission_ledger_no_delete
BEFORE DELETE ON permission_ledger FOR EACH ROW
WHEN OLD.project_id IS NULL OR EXISTS (SELECT 1 FROM project WHERE id=OLD.project_id)
BEGIN SELECT RAISE(ABORT, 'permission_ledger: immutable authorization fact'); END;
CREATE TRIGGER IF NOT EXISTS permission_execution_result_no_update
BEFORE UPDATE ON permission_execution_result FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'permission_execution_result: immutable effect receipt'); END;
CREATE TRIGGER IF NOT EXISTS permission_execution_result_no_delete
BEFORE DELETE ON permission_execution_result FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'permission_execution_result: immutable effect receipt'); END;

CREATE TRIGGER IF NOT EXISTS channel_ingress_accepted_no_update
BEFORE UPDATE ON channel_ingress_accepted FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'channel_ingress_accepted: immutable input fact'); END;
CREATE TRIGGER IF NOT EXISTS channel_ingress_accepted_no_delete
BEFORE DELETE ON channel_ingress_accepted FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'channel_ingress_accepted: immutable input fact'); END;
CREATE TRIGGER IF NOT EXISTS channel_ingress_outcome_no_update
BEFORE UPDATE ON channel_ingress_outcome FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'channel_ingress_outcome: immutable effect receipt'); END;
CREATE TRIGGER IF NOT EXISTS channel_ingress_outcome_no_delete
BEFORE DELETE ON channel_ingress_outcome FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'channel_ingress_outcome: immutable effect receipt'); END;

CREATE TRIGGER IF NOT EXISTS engine_git_checkpoint_request_no_update
BEFORE UPDATE ON engine_git_checkpoint_request FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'engine_git_checkpoint_request: immutable effect request'); END;
CREATE TRIGGER IF NOT EXISTS engine_git_checkpoint_request_no_delete
BEFORE DELETE ON engine_git_checkpoint_request FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM engine_task WHERE id=OLD.task_id)
BEGIN SELECT RAISE(ABORT, 'engine_git_checkpoint_request: immutable effect request'); END;
CREATE TRIGGER IF NOT EXISTS engine_git_checkpoint_outcome_no_update
BEFORE UPDATE ON engine_git_checkpoint_outcome FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'engine_git_checkpoint_outcome: immutable effect receipt'); END;
CREATE TRIGGER IF NOT EXISTS engine_git_checkpoint_outcome_no_delete
BEFORE DELETE ON engine_git_checkpoint_outcome FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM engine_git_checkpoint_request WHERE id=OLD.request_id)
BEGIN SELECT RAISE(ABORT, 'engine_git_checkpoint_outcome: immutable effect receipt'); END;

CREATE TRIGGER IF NOT EXISTS event_job_definition_revision_no_update
BEFORE UPDATE ON event_job FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'event_job: definition revisions are immutable; append a revision'); END;
CREATE TRIGGER IF NOT EXISTS event_job_definition_revision_no_delete
BEFORE DELETE ON event_job FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'event_job: definition revisions are immutable; append a tombstone revision'); END;
CREATE TRIGGER IF NOT EXISTS event_job_definition_tombstone_no_update
BEFORE UPDATE ON event_job_definition_tombstone FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'event_job_definition_tombstone: immutable deletion fact'); END;
CREATE TRIGGER IF NOT EXISTS event_job_definition_tombstone_no_delete
BEFORE DELETE ON event_job_definition_tombstone FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'event_job_definition_tombstone: immutable deletion fact'); END;
CREATE TRIGGER IF NOT EXISTS event_job_fire_no_update
BEFORE UPDATE ON event_job_fire FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'event_job_fire: occurrence input is immutable; append a receipt'); END;
CREATE TRIGGER IF NOT EXISTS event_job_fire_no_delete
BEFORE DELETE ON event_job_fire FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'event_job_fire: occurrence history is immutable'); END;
CREATE TRIGGER IF NOT EXISTS event_job_fire_mission_reservation_insert
BEFORE INSERT ON event_job_fire FOR EACH ROW
WHEN (
  EXISTS (
    SELECT 1 FROM event_job AS definition
    JOIN session AS target ON target.id=definition.session_id
    WHERE definition.id=NEW.event_job_revision_id AND target.kind='mission'
  )
  AND NEW.mission_opened_event_id IS NULL
  AND NEW.mission_disposition IS NULL
  AND NEW.mission_closure_event_id IS NULL
) OR (
  NOT EXISTS (
    SELECT 1 FROM event_job AS definition
    JOIN session AS target ON target.id=definition.session_id
    WHERE definition.id=NEW.event_job_revision_id AND target.kind='mission'
  )
  AND (
    NEW.mission_opened_event_id IS NOT NULL
    OR NEW.mission_disposition IS NOT NULL
    OR NEW.mission_closure_event_id IS NOT NULL
  )
)
BEGIN
  SELECT RAISE(ABORT, 'event_job_fire: Mission target requires one exact active or terminal reservation');
END;
CREATE TRIGGER IF NOT EXISTS event_occurrence_no_update
BEFORE UPDATE ON event_occurrence FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'event_occurrence: input fact is immutable'); END;
CREATE TRIGGER IF NOT EXISTS event_occurrence_no_delete
BEFORE DELETE ON event_occurrence FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'event_occurrence: input history is immutable'); END;

CREATE TRIGGER IF NOT EXISTS bus_publication_outbox_no_update
BEFORE UPDATE ON bus_publication_outbox FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'bus_publication_outbox: publication input is immutable'); END;
CREATE TRIGGER IF NOT EXISTS bus_publication_outbox_no_delete
BEFORE DELETE ON bus_publication_outbox FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'bus_publication_outbox: publication history is immutable'); END;
CREATE TRIGGER IF NOT EXISTS bus_publication_delivery_no_update
BEFORE UPDATE ON bus_publication_delivery FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'bus_publication_delivery: effect request is immutable'); END;
CREATE TRIGGER IF NOT EXISTS bus_publication_delivery_no_delete
BEFORE DELETE ON bus_publication_delivery FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'bus_publication_delivery: effect request history is immutable'); END;

CREATE TRIGGER IF NOT EXISTS protocol_event_no_update
BEFORE UPDATE ON protocol_event FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'protocol_event: immutable domain fact'); END;
CREATE TRIGGER IF NOT EXISTS protocol_event_no_delete
BEFORE DELETE ON protocol_event FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'protocol_event: immutable domain fact'); END;
CREATE TRIGGER IF NOT EXISTS protocol_inbox_no_update
BEFORE UPDATE ON protocol_inbox FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'protocol_inbox: immutable delivery request'); END;
CREATE TRIGGER IF NOT EXISTS protocol_inbox_no_delete
BEFORE DELETE ON protocol_inbox FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'protocol_inbox: immutable delivery request'); END;
CREATE TRIGGER IF NOT EXISTS protocol_delivery_receipt_no_update
BEFORE UPDATE ON protocol_delivery_receipt FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'protocol_delivery_receipt: immutable receipt'); END;
CREATE TRIGGER IF NOT EXISTS protocol_delivery_receipt_no_delete
BEFORE DELETE ON protocol_delivery_receipt FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'protocol_delivery_receipt: immutable receipt'); END;
CREATE TRIGGER IF NOT EXISTS automation_run_receipt_no_update
BEFORE UPDATE ON automation_run_receipt FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'automation_run_receipt: immutable receipt'); END;
CREATE TRIGGER IF NOT EXISTS automation_run_receipt_no_delete
BEFORE DELETE ON automation_run_receipt FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'automation_run_receipt: immutable receipt'); END;
CREATE TRIGGER IF NOT EXISTS event_job_fire_receipt_no_update
BEFORE UPDATE ON event_job_fire_receipt FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'event_job_fire_receipt: immutable receipt'); END;
CREATE TRIGGER IF NOT EXISTS event_job_fire_receipt_no_delete
BEFORE DELETE ON event_job_fire_receipt FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'event_job_fire_receipt: immutable receipt'); END;
CREATE TRIGGER IF NOT EXISTS engine_task_root_ingress_no_update
BEFORE UPDATE ON engine_task_root_ingress FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'engine_task_root_ingress: immutable input fact'); END;
CREATE TRIGGER IF NOT EXISTS engine_task_root_ingress_no_delete
BEFORE DELETE ON engine_task_root_ingress FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM engine_task WHERE id = OLD.task_id)
BEGIN SELECT RAISE(ABORT, 'engine_task_root_ingress: immutable input fact'); END;
CREATE TRIGGER IF NOT EXISTS engine_task_root_ingress_policy_no_update
BEFORE UPDATE ON engine_task_root_ingress_policy FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'engine_task_root_ingress_policy: immutable policy fact'); END;
CREATE TRIGGER IF NOT EXISTS engine_task_root_ingress_policy_no_delete
BEFORE DELETE ON engine_task_root_ingress_policy FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'engine_task_root_ingress_policy: immutable policy fact'); END;

CREATE TRIGGER IF NOT EXISTS engine_task_wait_registration_no_update
BEFORE UPDATE ON engine_task_wait_registration FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'engine_task_wait_registration: immutable wait intent'); END;
CREATE TRIGGER IF NOT EXISTS engine_task_wait_registration_no_delete
BEFORE DELETE ON engine_task_wait_registration FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM engine_task WHERE id=OLD.task_id)
BEGIN SELECT RAISE(ABORT, 'engine_task_wait_registration: immutable wait intent'); END;
CREATE TRIGGER IF NOT EXISTS engine_task_wait_registration_lineage_insert
BEFORE INSERT ON engine_task_wait_registration FOR EACH ROW
WHEN NEW.tool_part_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM tool_part_request AS request
    JOIN message AS creator
      ON creator.id=request.message_id
      AND json_extract(creator.data,'$.role')='assistant'
      AND json_extract(creator.data,'$.activationID')=NEW.creator_activation_id
    JOIN engine_control_activation_lease AS lease
      ON lease.id=NEW.creator_activation_id
      AND lease.target='task_root_ingress'
      AND lease.target_id=NEW.creator_ingress_id
      AND lease.expires_at>NEW.time_created
    JOIN engine_task_root_ingress AS ingress
      ON ingress.id=NEW.creator_ingress_id
      AND ingress.task_id=NEW.task_id
      AND ingress.execution_epoch=NEW.execution_epoch
    WHERE request.id=NEW.tool_part_id
      AND json_extract(request.data,'$.tool')='wait'
  )
BEGIN SELECT RAISE(ABORT, 'engine_task_wait_registration: invalid Tool creator lineage'); END;
CREATE TRIGGER IF NOT EXISTS engine_task_wait_settlement_no_update
BEFORE UPDATE ON engine_task_wait_settlement FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'engine_task_wait_settlement: immutable settlement'); END;
CREATE TRIGGER IF NOT EXISTS engine_task_wait_settlement_lineage_insert
BEFORE INSERT ON engine_task_wait_settlement FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM engine_task_wait_registration AS wait
  JOIN engine_task_root_ingress AS ingress ON ingress.id=NEW.ingress_id
  WHERE wait.id=NEW.wait_id
    AND wait.task_id=ingress.task_id
    AND wait.execution_epoch=ingress.execution_epoch
    AND (
      (
        NEW.disposition='superseded'
        AND ingress.time_accepted>=wait.time_created
        AND NOT (
          ingress.source='inline'
          AND ingress.source_id=wait.id
          AND json_extract(ingress.inline_payload,'$.taskWaitWake.jobID')=wait.id
        )
        AND (
          wait.creator_ingress_id IS NULL
          OR ingress.sequence>(
            SELECT creator.sequence
            FROM engine_task_root_ingress AS creator
            WHERE creator.id=wait.creator_ingress_id
          )
        )
      )
      OR (
        NEW.disposition='due_ingress_accepted'
        AND (
          (
            ingress.source='inline'
            AND ingress.source_id=wait.id
            AND json_type(ingress.inline_payload,'$.taskWaitWake')='object'
            AND json_extract(ingress.inline_payload,'$.taskWaitWake.jobID')=wait.id
            AND json_extract(ingress.inline_payload,'$.taskWaitWake.fireID')=wait.id
            AND json_extract(ingress.inline_payload,'$.taskWaitWake.dueAt')=wait.due_at
            AND ingress.time_accepted>=wait.due_at
            AND NEW.time_created>=ingress.time_accepted
          )
          OR (
            wait.tool_part_id IS NULL
            AND wait.legacy_automation_definition_id IS NOT NULL
            AND wait.id=wait.legacy_automation_definition_id
            AND ingress.source='automation_run'
            AND EXISTS (
              SELECT 1
              FROM automation AS legacy_definition
              JOIN automation_run AS legacy_run
                ON legacy_run.automation_revision_id=legacy_definition.id
                AND legacy_run.id=ingress.source_id
              WHERE legacy_definition.definition_id=wait.legacy_automation_definition_id
            )
          )
        )
      )
    )
)
BEGIN SELECT RAISE(ABORT, 'engine_task_wait_settlement: wait and ingress lineage must match'); END;
CREATE TRIGGER IF NOT EXISTS engine_task_wait_settlement_no_delete
BEFORE DELETE ON engine_task_wait_settlement FOR EACH ROW
WHEN EXISTS (
  SELECT 1
  FROM engine_task_wait_registration AS wait
  JOIN engine_task AS task ON task.id=wait.task_id
  WHERE wait.id=OLD.wait_id
)
BEGIN SELECT RAISE(ABORT, 'engine_task_wait_settlement: immutable settlement'); END;

CREATE TRIGGER IF NOT EXISTS automation_project_target_no_update
BEFORE UPDATE ON automation_project_target FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'automation_project_target: immutable definition input'); END;
CREATE TRIGGER IF NOT EXISTS automation_project_target_no_delete
BEFORE DELETE ON automation_project_target FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'automation_project_target: immutable definition input'); END;
CREATE TRIGGER IF NOT EXISTS bus_publication_delivery_receipt_no_update
BEFORE UPDATE ON bus_publication_delivery_receipt FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'bus_publication_delivery_receipt: immutable receipt'); END;
CREATE TRIGGER IF NOT EXISTS bus_publication_delivery_receipt_no_delete
BEFORE DELETE ON bus_publication_delivery_receipt FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'bus_publication_delivery_receipt: immutable receipt'); END;
CREATE TRIGGER IF NOT EXISTS bus_publication_phase_receipt_no_update
BEFORE UPDATE ON bus_publication_phase_receipt FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'bus_publication_phase_receipt: immutable receipt'); END;
CREATE TRIGGER IF NOT EXISTS bus_publication_phase_receipt_no_delete
BEFORE DELETE ON bus_publication_phase_receipt FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'bus_publication_phase_receipt: immutable receipt'); END;
CREATE TRIGGER IF NOT EXISTS bus_publication_attempt_receipt_no_update
BEFORE UPDATE ON bus_publication_attempt_receipt FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'bus_publication_attempt_receipt: immutable receipt'); END;
CREATE TRIGGER IF NOT EXISTS bus_publication_attempt_receipt_no_delete
BEFORE DELETE ON bus_publication_attempt_receipt FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'bus_publication_attempt_receipt: immutable receipt'); END;
CREATE TRIGGER IF NOT EXISTS engine_interaction_request_no_update
BEFORE UPDATE ON engine_interaction_request FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'engine_interaction_request: immutable input fact'); END;
CREATE TRIGGER IF NOT EXISTS engine_interaction_request_no_delete
BEFORE DELETE ON engine_interaction_request FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'engine_interaction_request: immutable input fact'); END;
CREATE TRIGGER IF NOT EXISTS engine_interaction_outcome_no_update
BEFORE UPDATE ON engine_interaction_outcome FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'engine_interaction_outcome: immutable receipt'); END;
CREATE TRIGGER IF NOT EXISTS engine_interaction_outcome_no_delete
BEFORE DELETE ON engine_interaction_outcome FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'engine_interaction_outcome: immutable receipt'); END;
CREATE TRIGGER IF NOT EXISTS engine_build_observation_cleanup_no_update
BEFORE UPDATE ON engine_build_observation_cleanup FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'engine_build_observation_cleanup: immutable request fact'); END;
CREATE TRIGGER IF NOT EXISTS engine_build_observation_cleanup_no_delete
BEFORE DELETE ON engine_build_observation_cleanup FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM engine_task WHERE id = OLD.task_id)
BEGIN SELECT RAISE(ABORT, 'engine_build_observation_cleanup: immutable request fact'); END;
CREATE TRIGGER IF NOT EXISTS engine_build_observation_cleanup_receipt_no_update
BEFORE UPDATE ON engine_build_observation_cleanup_receipt FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'engine_build_observation_cleanup_receipt: immutable receipt'); END;
CREATE TRIGGER IF NOT EXISTS engine_build_observation_cleanup_receipt_no_delete
BEFORE DELETE ON engine_build_observation_cleanup_receipt FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM engine_build_observation_cleanup WHERE observation_id = OLD.observation_id)
BEGIN SELECT RAISE(ABORT, 'engine_build_observation_cleanup_receipt: immutable receipt'); END;
CREATE TRIGGER IF NOT EXISTS session_control_record_no_update
BEFORE UPDATE ON session_control_record FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'session_control_record: immutable request fact'); END;
CREATE TRIGGER IF NOT EXISTS session_control_record_no_delete
BEFORE DELETE ON session_control_record FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM session WHERE id=OLD.session_id)
BEGIN SELECT RAISE(ABORT, 'session_control_record: immutable request fact'); END;
CREATE TRIGGER IF NOT EXISTS session_control_event_no_update
BEFORE UPDATE ON session_control_event FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'session_control_event: immutable receipt'); END;
CREATE TRIGGER IF NOT EXISTS session_control_event_no_delete
BEFORE DELETE ON session_control_event FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM session_control_record
  JOIN session ON session.id=session_control_record.session_id
  WHERE session_control_record.id=OLD.control_id
)
BEGIN SELECT RAISE(ABORT, 'session_control_event: immutable receipt'); END;
CREATE TRIGGER IF NOT EXISTS engine_workflow_node_occurrence_no_update
BEFORE UPDATE ON engine_workflow_node_occurrence FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'engine_workflow_node_occurrence: immutable causal fact'); END;
CREATE TRIGGER IF NOT EXISTS engine_workflow_node_occurrence_no_delete
BEFORE DELETE ON engine_workflow_node_occurrence FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM engine_task WHERE id=OLD.task_id)
BEGIN SELECT RAISE(ABORT, 'engine_workflow_node_occurrence: immutable causal fact'); END;
CREATE TRIGGER IF NOT EXISTS engine_progress_snapshot_no_update
BEFORE UPDATE ON engine_progress_snapshot FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'engine_progress_snapshot: immutable authored checkpoint'); END;
CREATE TRIGGER IF NOT EXISTS engine_progress_snapshot_no_delete
BEFORE DELETE ON engine_progress_snapshot FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM engine_task WHERE id=OLD.task_id)
BEGIN SELECT RAISE(ABORT, 'engine_progress_snapshot: immutable authored checkpoint'); END;
`

export const SCHEMA_DDL = `${generatedSchemaDdl()}\n\n${STORAGE_EXTENSION_DDL}`
