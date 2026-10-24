import { Identifier } from "@/id/id"
import { ArtifactProducerSchema, ArtifactSchemaLimits } from "@opencorvus-ai/plugin/artifact-catalog"
import { Database, and, eq, sql, type SQL } from "@/storage/db"
import {
  EngineArtifactCatalogRevisionTable,
  EngineArtifactTable,
  type EngineArtifactKind,
  type EngineMetadata,
} from "./engine.sql"
import {
  deriveEngineArtifactCatalogMetadata,
  engineArtifactCatalogMetadataSHA256,
  serializeEngineArtifactPayload,
} from "./artifact-catalog-metadata"
import { engineArtifactCatalogLabelIndex } from "./artifact-catalog-constants"
import { Event } from "./model"
import { EngineProtocol } from "./protocol"
import {
  appendExpertSquadMutationReceipt,
  assertExpertSquadMutationReceiptProjection,
} from "./expert-squad-mutation-receipt"

export type EngineArtifactRow = typeof EngineArtifactTable.$inferSelect

export interface EngineArtifactInput {
  id?: string
  taskID: string
  kind: EngineArtifactKind
  label: string
  payload: EngineMetadata
  timeCreated?: number
  timeUpdated?: number
}

export interface EngineArtifactUpdateInput {
  id: string
  label?: string
  payload?: EngineMetadata
  timeUpdated?: number
}

export interface EngineArtifactWhereUpdateInput {
  where: SQL
  /** Required when payload changes so same-row catalog metadata is updated in
   *  the same statement. The WHERE clause must constrain the same kind. */
  kind?: EngineArtifactKind
  label?: string
  payload?: EngineMetadata
  timeUpdated?: number
}

function exactArtifactLabel(label: string): string {
  if (label.length === 0 || label.length > ArtifactSchemaLimits.storedLabelLength) {
    throw new Error(`Engine Artifact label must contain 1-${ArtifactSchemaLimits.storedLabelLength} characters`)
  }
  return label
}

/**
 * A SAVEPOINT is a nested SQLite transaction boundary. It makes the canonical
 * multi-statement Artifact writer atomic both when called with the base
 * database and when composed inside a larger caller-owned transaction.
 */
function artifactWriteTransaction<T>(
  db: Database.TxOrDb,
  callback: () => T,
  ...synchronousOnly: T extends PromiseLike<unknown> ? [never] : []
): T {
  return Database.savepoint<T>(db, callback, ...synchronousOnly)
}

function allocateCatalogRevision(db: Database.TxOrDb): number {
  const allocated = db
    .insert(EngineArtifactCatalogRevisionTable)
    .values({})
    .returning({ revision: EngineArtifactCatalogRevisionTable.revision })
    .get()
  if (!allocated || !Number.isSafeInteger(allocated.revision) || allocated.revision <= 0) {
    throw new Error("Engine Artifact catalog revision allocation did not return a positive safe integer")
  }
  return allocated.revision
}

function artifactValues(input: EngineArtifactInput, catalogRevision: number) {
  const id = input.id ?? Identifier.ascending("artifact")
  const timeCreated = input.timeCreated ?? Date.now()
  const timeUpdated = input.timeUpdated ?? timeCreated
  const label = exactArtifactLabel(input.label)
  const payloadText = serializeEngineArtifactPayload(input.payload)
  const metadata = deriveEngineArtifactCatalogMetadata({ kind: input.kind, payloadText })
  return {
    payloadText,
    values: {
      id,
      task_id: input.taskID,
      kind: input.kind,
      label,
      payload: sql`${payloadText}`,
      ...metadata,
      catalog_metadata_sha256: engineArtifactCatalogMetadataSHA256({
        artifact_id: id,
        task_id: input.taskID,
        kind: input.kind,
        label_index: engineArtifactCatalogLabelIndex(label),
        time_created: timeCreated,
        time_updated: timeUpdated,
        ...metadata,
      }),
      catalog_revision: catalogRevision,
      time_created: timeCreated,
      time_updated: timeUpdated,
    },
  }
}

function artifactPatchValues(
  db: Database.TxOrDb,
  row: EngineArtifactRow,
  input: {
    label?: string
    payload?: EngineMetadata
    timeUpdated?: number
  },
) {
  const payloadText =
    input.payload !== undefined
      ? serializeEngineArtifactPayload(input.payload)
      : db
          .select({ value: sql<string>`CAST(${EngineArtifactTable.payload} AS TEXT)` })
          .from(EngineArtifactTable)
          .where(eq(EngineArtifactTable.id, row.id))
          .get()!.value
  assertExpertSquadMutationReceiptProjection(db, {
    artifactID: row.id,
    taskID: row.task_id,
    kind: row.kind,
    payload: input.payload ?? row.payload,
    payloadText,
  })
  const timeUpdated = input.timeUpdated ?? Date.now()
  const set: Partial<typeof EngineArtifactTable.$inferInsert> = {
    time_updated: timeUpdated,
  }
  const label = exactArtifactLabel(input.label ?? row.label)
  if (input.label !== undefined) set.label = label
  let metadata = {
    payload_sha256: row.payload_sha256,
    payload_bytes: row.payload_bytes,
    payload_block_sha256s: row.payload_block_sha256s,
    payload_block_index_sha256: row.payload_block_index_sha256,
    catalog_artifact_type: row.catalog_artifact_type,
    catalog_schema_diagnostic: row.catalog_schema_diagnostic,
    catalog_producer: ArtifactProducerSchema.nullable().parse(row.catalog_producer),
    catalog_import_source_task_id: row.catalog_import_source_task_id,
    catalog_resource_count: row.catalog_resource_count,
    catalog_resource_media_types: row.catalog_resource_media_types,
    catalog_search_text: row.catalog_search_text,
    catalog_search_text_truncated: row.catalog_search_text_truncated,
  }
  if (input.payload !== undefined) {
    set.payload = sql`${payloadText}` as never
    metadata = deriveEngineArtifactCatalogMetadata({ kind: row.kind, payloadText })
    Object.assign(set, metadata)
  }
  set.catalog_metadata_sha256 = engineArtifactCatalogMetadataSHA256({
    artifact_id: row.id,
    task_id: row.task_id,
    kind: row.kind,
    label_index: engineArtifactCatalogLabelIndex(label),
    time_created: row.time_created,
    time_updated: timeUpdated,
    ...metadata,
  })
  return { values: set, payloadText, payload: input.payload ?? row.payload }
}

function appendPatchedMutationReceipt(
  db: Database.TxOrDb,
  row: EngineArtifactRow,
  patch: ReturnType<typeof artifactPatchValues>,
) {
  appendExpertSquadMutationReceipt(db, {
    artifactID: row.id,
    taskID: row.task_id,
    kind: row.kind,
    payload: patch.payload,
    payloadText: patch.payloadText,
    timeCreated: row.time_created,
  })
}

export function insertEngineArtifact(db: Database.TxOrDb, input: EngineArtifactInput): string {
  return artifactWriteTransaction(db, () => {
    const { values, payloadText } = artifactValues(input, allocateCatalogRevision(db))
    assertExpertSquadMutationReceiptProjection(db, {
      artifactID: values.id,
      taskID: input.taskID,
      kind: input.kind,
      payload: input.payload,
      payloadText,
    })
    db.insert(EngineArtifactTable).values(values).run()
    appendExpertSquadMutationReceipt(db, {
      artifactID: values.id,
      taskID: input.taskID,
      kind: input.kind,
      payload: input.payload,
      payloadText,
      timeCreated: values.time_created,
    })
    EngineProtocol.emitInTransaction(
      Event.ArtifactPersisted,
      {
        taskID: input.taskID,
        artifactID: values.id,
        kind: input.kind,
        catalogRevision: values.catalog_revision,
      },
      { source: "engine.artifact" },
    )
    return values.id
  })
}

export function recordEngineArtifact(input: EngineArtifactInput): string {
  return Database.transaction((db) => insertEngineArtifact(db, input))
}

export function patchEngineArtifact(db: Database.TxOrDb, input: EngineArtifactUpdateInput): void {
  artifactWriteTransaction(db, () => {
    const row = db.select().from(EngineArtifactTable).where(eq(EngineArtifactTable.id, input.id)).get()
    if (!row) throw new Error(`Engine Artifact ${input.id} does not exist`)
    const catalogRevision = allocateCatalogRevision(db)
    const patch = artifactPatchValues(db, row, input)
    const updated = db
      .update(EngineArtifactTable)
      .set({ ...patch.values, catalog_revision: catalogRevision })
      .where(eq(EngineArtifactTable.id, input.id))
      .returning()
      .get()
    if (!updated) return
    appendPatchedMutationReceipt(db, updated, patch)
    EngineProtocol.emitInTransaction(
      Event.ArtifactPersisted,
      {
        taskID: row.task_id,
        artifactID: row.id,
        kind: row.kind,
        catalogRevision,
      },
      { source: "engine.artifact" },
    )
  })
}

export function updateEngineArtifact(input: EngineArtifactUpdateInput): void {
  Database.immediateTransaction((db) => patchEngineArtifact(db, input))
}

export function updateEngineArtifactsWhere(db: Database.TxOrDb, input: EngineArtifactWhereUpdateInput): void {
  artifactWriteTransaction(db, () => {
    const rows = db.select().from(EngineArtifactTable).where(input.where).all()
    const normalized = { ...input, timeUpdated: input.timeUpdated ?? Date.now() }
    for (const row of rows) {
      if (input.kind && row.kind !== input.kind) {
        throw new Error(`Conditional Engine Artifact update selected ${row.kind}; expected ${input.kind}`)
      }
      const catalogRevision = allocateCatalogRevision(db)
      const patch = artifactPatchValues(db, row, normalized)
      const updated = db
        .update(EngineArtifactTable)
        .set({ ...patch.values, catalog_revision: catalogRevision })
        .where(and(input.where, eq(EngineArtifactTable.id, row.id)))
        .returning()
        .get()
      if (!updated) continue
      appendPatchedMutationReceipt(db, updated, patch)
      EngineProtocol.emitInTransaction(
        Event.ArtifactPersisted,
        {
          taskID: row.task_id,
          artifactID: row.id,
          kind: row.kind,
          catalogRevision,
        },
        { source: "engine.artifact" },
      )
    }
  })
}

export function updateEngineArtifactWhereReturning(
  db: Database.TxOrDb,
  input: EngineArtifactWhereUpdateInput,
): EngineArtifactRow | undefined {
  return artifactWriteTransaction(db, () => {
    const rows = db.select().from(EngineArtifactTable).where(input.where).all()
    const normalized = { ...input, timeUpdated: input.timeUpdated ?? Date.now() }
    let first: EngineArtifactRow | undefined
    for (const row of rows) {
      if (input.kind && row.kind !== input.kind) {
        throw new Error(`Conditional Engine Artifact update selected ${row.kind}; expected ${input.kind}`)
      }
      const catalogRevision = allocateCatalogRevision(db)
      const patch = artifactPatchValues(db, row, normalized)
      const updated = db
        .update(EngineArtifactTable)
        .set({ ...patch.values, catalog_revision: catalogRevision })
        .where(and(input.where, eq(EngineArtifactTable.id, row.id)))
        .returning()
        .get()
      if (!updated) continue
      appendPatchedMutationReceipt(db, updated, patch)
      EngineProtocol.emitInTransaction(
        Event.ArtifactPersisted,
        {
          taskID: row.task_id,
          artifactID: row.id,
          kind: row.kind,
          catalogRevision,
        },
        { source: "engine.artifact" },
      )
      first ??= updated
    }
    return first
  })
}
