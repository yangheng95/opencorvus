import { SQL } from "drizzle-orm"
import { getTableConfig, SQLiteSyncDialect } from "drizzle-orm/sqlite-core"
import { ENGINE_ARTIFACT_CATALOG_LABEL_INDEX_CODE_POINTS } from "@/engine/artifact-catalog-constants"
import * as schema from "./schema"

type Column = ReturnType<typeof getTableConfig>["columns"][number]
type IndexColumn = ReturnType<typeof getTableConfig>["indexes"][number]["config"]["columns"][number]

const dialect = new SQLiteSyncDialect()
const deferredIndexNames = new Set(["engine_channel_binding_thread_idx"])

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

  const tableSql = [
    `CREATE TABLE IF NOT EXISTS ${quoteIdentifier(config.name)} (`,
    definitions.map((definition) => `  ${definition}`).join(",\n"),
    ");",
  ].join("\n")

  const indexSql = config.indexes
    .filter((index) => !deferredIndexNames.has(index.config.name))
    .map((index) => renderIndex(config, index))

  return [tableSql, ...indexSql].join("\n")
}

export function collectTables() {
  const tables: unknown[] = []
  const seen = new Set<string>()

  for (const value of Object.values(schema)) {
    try {
      const name = tableName(value)
      if (seen.has(name)) continue
      seen.add(name)
      tables.push(value)
    } catch {}
  }

  return tables
}

function generatedSchemaDdl() {
  return collectTables().map(renderTable).join("\n\n")
}

function generatedDeferredIndexDdl() {
  const indexSql: string[] = []
  for (const table of collectTables()) {
    const config = getTableConfig(table as never)
    for (const index of config.indexes) {
      if (deferredIndexNames.has(index.config.name)) indexSql.push(renderIndex(config, index))
    }
  }
  return indexSql.join("\n")
}

// FTS is Full-Text Search. Drizzle table declarations do not model SQLite FTS5
// virtual tables, so this remains an explicit storage extension.
const STORAGE_EXTENSION_DDL = /* sql */ `
CREATE UNIQUE INDEX IF NOT EXISTS project_generation_idx ON project(generation);

CREATE TRIGGER IF NOT EXISTS project_generation_required_insert
BEFORE INSERT ON project
FOR EACH ROW
WHEN NEW.generation = '00000000-0000-0000-0000-000000000000'
BEGIN
  SELECT RAISE(ABORT, 'project: generation is required');
END;

CREATE TRIGGER IF NOT EXISTS project_generation_immutable_update
BEFORE UPDATE OF generation ON project
FOR EACH ROW
WHEN OLD.generation != '00000000-0000-0000-0000-000000000000'
  AND NEW.generation IS NOT OLD.generation
BEGIN
  SELECT RAISE(ABORT, 'project: generation is immutable');
END;

CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
  content,
  chunk_id UNINDEXED,
  project_id UNINDEXED
);

DELETE FROM engine_channel_binding
WHERE rowid NOT IN (
  SELECT MIN(rowid)
  FROM engine_channel_binding
  GROUP BY platform, channel, thread
);
${generatedDeferredIndexDdl()}

-- Dispatch lineage is immutable physical-execution authority. Adapter input
-- must be present as an exact JSON (JavaScript Object Notation) object because
-- continuation reuses it unchanged; changing this trigger is also the physical
-- schema breakpoint for any future breaking lineage-payload contract.
CREATE TRIGGER IF NOT EXISTS engine_dispatch_lineage_payload_insert
BEFORE INSERT ON engine_artifact
FOR EACH ROW
WHEN NEW.kind = 'dispatch_lineage'
  AND json_type(NEW.payload, '$.adapter_input') IS NOT 'object'
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact: dispatch_lineage adapter_input must be an exact object');
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
-- execution facts. Mutable coordination/queue artifacts keep their dedicated
-- update protocols; these two kinds can only be superseded by appending a new
-- exact Artifact.
CREATE TRIGGER IF NOT EXISTS engine_goal_graph_artifact_immutable
BEFORE UPDATE ON engine_artifact
FOR EACH ROW
WHEN OLD.kind IN ('architect_contract_graph', 'goal_graph_projection')
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact: Architect ContractGraph and GoalGraphProjection facts are immutable');
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
`

export const SCHEMA_DDL = `${generatedSchemaDdl()}\n\n${STORAGE_EXTENSION_DDL}`
