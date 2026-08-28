import {
  ArtifactProducerSchema,
  type ArtifactReadInput,
} from "@opencorvus-ai/plugin/artifact-catalog"
import { createHash } from "node:crypto"
import { Database } from "@/storage/db"
import { and, desc, eq, sql } from "drizzle-orm"
import type { EngineArtifactRow } from "./artifact"
import { engineArtifactCatalogLabelIndex } from "./artifact-catalog-constants"
import {
  assertEngineArtifactCatalogIndexIdentity,
  deriveEngineArtifactCatalogMetadata,
} from "./artifact-catalog-metadata"
import { EngineArtifactTable, EngineArtifactVersionTable } from "./engine.sql"

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex")
}

type ExactEngineArtifactVersion = Readonly<{
  row: EngineArtifactRow
  bytes: Uint8Array
}>

function exactEngineArtifactVersion(input: {
  taskID: string
  artifactID: string
  catalogRevision: number
  expectedSHA256: string
  db?: Database.TxOrDb
}): ExactEngineArtifactVersion {
  const query = (db: Database.TxOrDb) => {
    const current = db
      .select({
        id: EngineArtifactTable.id,
        task_id: EngineArtifactTable.task_id,
        kind: EngineArtifactTable.kind,
        label: EngineArtifactTable.label,
        payloadRaw: sql<Uint8Array>`CAST(${EngineArtifactTable.payload} AS BLOB)`,
        payload_sha256: EngineArtifactTable.payload_sha256,
        payload_bytes: EngineArtifactTable.payload_bytes,
        payloadBlockSHA256sRaw: sql<Uint8Array>`CAST(${EngineArtifactTable.payload_block_sha256s} AS BLOB)`,
        payload_block_index_sha256: EngineArtifactTable.payload_block_index_sha256,
        catalog_artifact_type: EngineArtifactTable.catalog_artifact_type,
        catalog_schema_diagnostic: EngineArtifactTable.catalog_schema_diagnostic,
        catalogProducerRaw: sql<Uint8Array | null>`CAST(${EngineArtifactTable.catalog_producer} AS BLOB)`,
        catalog_import_source_task_id: EngineArtifactTable.catalog_import_source_task_id,
        catalog_resource_count: EngineArtifactTable.catalog_resource_count,
        catalogResourceMediaTypesRaw: sql<Uint8Array>`CAST(${EngineArtifactTable.catalog_resource_media_types} AS BLOB)`,
        catalog_search_text: EngineArtifactTable.catalog_search_text,
        catalog_search_text_truncated: EngineArtifactTable.catalog_search_text_truncated,
        catalog_metadata_sha256: EngineArtifactTable.catalog_metadata_sha256,
        catalog_revision: EngineArtifactTable.catalog_revision,
        time_created: EngineArtifactTable.time_created,
        time_updated: EngineArtifactTable.time_updated,
      })
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.id, input.artifactID),
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.catalog_revision, input.catalogRevision),
          eq(EngineArtifactTable.payload_sha256, input.expectedSHA256),
        ),
      )
      .get()
    if (current) return current
    return db
      .select({
        id: EngineArtifactVersionTable.artifact_id,
        task_id: EngineArtifactVersionTable.task_id,
        kind: EngineArtifactVersionTable.kind,
        label: EngineArtifactVersionTable.label,
        payloadRaw: sql<Uint8Array>`CAST(${EngineArtifactVersionTable.payload} AS BLOB)`,
        payload_sha256: EngineArtifactVersionTable.payload_sha256,
        payload_bytes: EngineArtifactVersionTable.payload_bytes,
        payloadBlockSHA256sRaw: sql<Uint8Array>`CAST(${EngineArtifactVersionTable.payload_block_sha256s} AS BLOB)`,
        payload_block_index_sha256: EngineArtifactVersionTable.payload_block_index_sha256,
        catalog_artifact_type: EngineArtifactVersionTable.catalog_artifact_type,
        catalog_schema_diagnostic: EngineArtifactVersionTable.catalog_schema_diagnostic,
        catalogProducerRaw: sql<Uint8Array | null>`CAST(${EngineArtifactVersionTable.catalog_producer} AS BLOB)`,
        catalog_import_source_task_id: EngineArtifactVersionTable.catalog_import_source_task_id,
        catalog_resource_count: EngineArtifactVersionTable.catalog_resource_count,
        catalogResourceMediaTypesRaw: sql<Uint8Array>`CAST(${EngineArtifactVersionTable.catalog_resource_media_types} AS BLOB)`,
        catalog_search_text: EngineArtifactVersionTable.catalog_search_text,
        catalog_search_text_truncated: EngineArtifactVersionTable.catalog_search_text_truncated,
        catalog_metadata_sha256: EngineArtifactVersionTable.catalog_metadata_sha256,
        catalog_revision: EngineArtifactVersionTable.catalog_revision,
        time_created: EngineArtifactVersionTable.time_created,
        time_updated: EngineArtifactVersionTable.time_updated,
      })
      .from(EngineArtifactVersionTable)
      .where(
        and(
          eq(EngineArtifactVersionTable.artifact_id, input.artifactID),
          eq(EngineArtifactVersionTable.task_id, input.taskID),
          eq(EngineArtifactVersionTable.catalog_revision, input.catalogRevision),
          eq(EngineArtifactVersionTable.payload_sha256, input.expectedSHA256),
        ),
      )
      .orderBy(desc(EngineArtifactVersionTable.catalog_revision))
      .limit(1)
      .get()
  }
  const resolve = (db: Database.TxOrDb) => {
    const selected = query(db)
    const existingTaskID = selected
      ? undefined
      : db
          .select({ taskID: EngineArtifactTable.task_id })
          .from(EngineArtifactTable)
          .where(eq(EngineArtifactTable.id, input.artifactID))
          .get()?.taskID
    return { selected, existingTaskID }
  }
  const { selected, existingTaskID } = input.db ? resolve(input.db) : Database.transaction(resolve)
  if (!selected) {
    if (existingTaskID && existingTaskID !== input.taskID) {
      throw new Error(`Exact Engine Artifact ${input.artifactID} belongs to another Task`)
    }
    throw new Error(
      `Exact Engine Artifact ${input.artifactID}@revision=${input.catalogRevision}@${input.expectedSHA256} does not exist`,
    )
  }
  const decodeJSON = (raw: Uint8Array, field: string): unknown => {
    try {
      return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw))
    } catch (cause) {
      throw new Error(`Engine Artifact ${selected.id} ${field} is not valid UTF-8 canonical JSON`, { cause })
    }
  }
  const bytes = Buffer.from(selected.payloadRaw)
  if (bytes.byteLength !== selected.payload_bytes || sha256(bytes) !== selected.payload_sha256) {
    throw new Error(`Engine Artifact ${selected.id} payload bytes do not match its canonical catalog metadata`)
  }
  const row = {
    id: selected.id,
    task_id: selected.task_id,
    kind: selected.kind,
    label: selected.label,
    payload: decodeJSON(bytes, "payload") as EngineArtifactRow["payload"],
    payload_sha256: selected.payload_sha256,
    payload_bytes: selected.payload_bytes,
    payload_block_sha256s: decodeJSON(selected.payloadBlockSHA256sRaw, "payload_block_sha256s") as string[],
    payload_block_index_sha256: selected.payload_block_index_sha256,
    catalog_artifact_type: selected.catalog_artifact_type,
    catalog_schema_diagnostic: selected.catalog_schema_diagnostic,
    catalog_producer: selected.catalogProducerRaw
      ? (decodeJSON(selected.catalogProducerRaw, "catalog_producer") as EngineArtifactRow["catalog_producer"])
      : null,
    catalog_import_source_task_id: selected.catalog_import_source_task_id,
    catalog_resource_count: selected.catalog_resource_count,
    catalog_resource_media_types: decodeJSON(
      selected.catalogResourceMediaTypesRaw,
      "catalog_resource_media_types",
    ) as string[],
    catalog_search_text: selected.catalog_search_text,
    catalog_search_text_truncated: selected.catalog_search_text_truncated,
    catalog_metadata_sha256: selected.catalog_metadata_sha256,
    catalog_revision: selected.catalog_revision,
    time_created: selected.time_created,
    time_updated: selected.time_updated,
  } satisfies EngineArtifactRow
  const producer = ArtifactProducerSchema.nullable().parse(row.catalog_producer)
  assertEngineArtifactCatalogIndexIdentity({
    id: row.id,
    artifact_id: row.id,
    task_id: row.task_id,
    kind: row.kind,
    label_index: engineArtifactCatalogLabelIndex(row.label),
    time_created: row.time_created,
    time_updated: row.time_updated,
    payload_sha256: row.payload_sha256,
    payload_bytes: row.payload_bytes,
    payload_block_index_sha256: row.payload_block_index_sha256,
    catalog_artifact_type: row.catalog_artifact_type,
    catalog_schema_diagnostic: row.catalog_schema_diagnostic,
    catalog_producer: producer,
    catalog_import_source_task_id: row.catalog_import_source_task_id,
    catalog_resource_count: row.catalog_resource_count,
    catalog_resource_media_types: row.catalog_resource_media_types,
    catalog_search_text: row.catalog_search_text,
    catalog_search_text_truncated: row.catalog_search_text_truncated,
    catalog_metadata_sha256: row.catalog_metadata_sha256,
  })
  const derivedPayload = deriveEngineArtifactCatalogMetadata({
    kind: row.kind,
    payloadText: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
  })
  if (row.payload_block_index_sha256 !== derivedPayload.payload_block_index_sha256) {
    throw new Error(
      `artifact_read: Engine Artifact ${row.id} payload block index does not match its canonical catalog metadata`,
    )
  }
  return { row: row as EngineArtifactRow, bytes }
}

export function requireEngineArtifactByLocator(input: {
  db?: Database.TxOrDb
  taskID: string
  locator: Extract<ArtifactReadInput["locator"], { source: "engine_artifact" }>
}): EngineArtifactRow {
  const selected = exactEngineArtifactVersion({
    taskID: input.taskID,
    artifactID: input.locator.artifact_id,
    catalogRevision: input.locator.catalog_revision,
    expectedSHA256: input.locator.expected_sha256,
    db: input.db,
  })
  const row = selected.row
  if (row.task_id !== input.taskID) {
    throw new Error(`Exact Engine Artifact ${row.id} belongs to another Task`)
  }
  return row
}
