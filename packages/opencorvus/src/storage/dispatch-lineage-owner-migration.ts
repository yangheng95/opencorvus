import type { Database as BunDatabase } from "bun:sqlite"
import { Identifier } from "@/id/id"
import {
  deriveEngineArtifactCatalogMetadata,
  engineArtifactCatalogMetadataSHA256,
  serializeEngineArtifactPayload,
} from "@/engine/artifact-catalog-metadata"
import { engineArtifactCatalogLabelIndex } from "@/engine/artifact-catalog-constants"
import type { EngineArtifactKind, EngineMetadata } from "@/engine/engine.sql"

type ArtifactRow = {
  id: string
  task_id: string
  kind: EngineArtifactKind
  label: string
  payload: string
  time_created: number
  time_updated: number
  catalog_revision: number
}

function rows<T>(db: BunDatabase, statement: string, ...parameters: unknown[]): T[] {
  const query = db.query<T, []>(statement)
  try {
    return query.all(...(parameters as []))
  } finally {
    query.finalize()
  }
}

function run(db: BunDatabase, statement: string, ...parameters: unknown[]): void {
  const query = db.query(statement)
  try {
    query.run(...(parameters as []))
  } finally {
    query.finalize()
  }
}

function parseObject(text: string, subject: string): Record<string, unknown> {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (error) {
    throw new Error(`${subject} payload is not valid JSON`, { cause: error })
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${subject} payload is not an object`)
  }
  return value as Record<string, unknown>
}

function derivedArtifactValues(input: {
  id: string
  taskID: string
  kind: EngineArtifactKind
  label: string
  payload: EngineMetadata
  timeCreated: number
  timeUpdated: number
}) {
  const payloadText = serializeEngineArtifactPayload(input.payload)
  const metadata = deriveEngineArtifactCatalogMetadata({ kind: input.kind, payloadText })
  return {
    payloadText,
    metadata,
    catalogMetadataSHA256: engineArtifactCatalogMetadataSHA256({
      artifact_id: input.id,
      task_id: input.taskID,
      kind: input.kind,
      label_index: engineArtifactCatalogLabelIndex(input.label),
      time_created: input.timeCreated,
      time_updated: input.timeUpdated,
      payload_sha256: metadata.payload_sha256,
      payload_bytes: metadata.payload_bytes,
      payload_block_index_sha256: metadata.payload_block_index_sha256,
      catalog_artifact_type: metadata.catalog_artifact_type,
      catalog_schema_diagnostic: metadata.catalog_schema_diagnostic,
      catalog_producer: metadata.catalog_producer,
      catalog_import_source_task_id: metadata.catalog_import_source_task_id,
      catalog_resource_count: metadata.catalog_resource_count,
      catalog_resource_media_types: metadata.catalog_resource_media_types,
      catalog_search_text: metadata.catalog_search_text,
      catalog_search_text_truncated: metadata.catalog_search_text_truncated,
    }),
  }
}

function allocateCatalogRevision(db: BunDatabase): number {
  const revision = rows<{ revision: number }>(
    db,
    "INSERT INTO engine_artifact_catalog_revision DEFAULT VALUES RETURNING revision",
  )[0]?.revision
  if (!Number.isSafeInteger(revision) || revision! <= 0) {
    throw new Error("Dispatch lineage owner migration could not allocate an Artifact catalog revision")
  }
  return revision!
}

function insertArtifact(
  db: BunDatabase,
  input: {
    id: string
    taskID: string
    kind: EngineArtifactKind
    label: string
    payload: EngineMetadata
    timeCreated: number
  },
) {
  const catalogRevision = allocateCatalogRevision(db)
  const derived = derivedArtifactValues({ ...input, timeUpdated: input.timeCreated })
  const metadata = derived.metadata
  run(
    db,
    `INSERT INTO engine_artifact(
      id,task_id,kind,label,payload,payload_sha256,payload_bytes,payload_block_sha256s,
      payload_block_index_sha256,catalog_artifact_type,catalog_schema_diagnostic,catalog_producer,
      catalog_import_source_task_id,catalog_resource_count,catalog_resource_media_types,
      catalog_search_text,catalog_search_text_truncated,catalog_metadata_sha256,catalog_revision,
      time_created,time_updated
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    input.id,
    input.taskID,
    input.kind,
    input.label,
    derived.payloadText,
    metadata.payload_sha256,
    metadata.payload_bytes,
    JSON.stringify(metadata.payload_block_sha256s),
    metadata.payload_block_index_sha256,
    metadata.catalog_artifact_type,
    metadata.catalog_schema_diagnostic,
    metadata.catalog_producer === null ? null : JSON.stringify(metadata.catalog_producer),
    metadata.catalog_import_source_task_id,
    metadata.catalog_resource_count,
    JSON.stringify(metadata.catalog_resource_media_types),
    metadata.catalog_search_text,
    metadata.catalog_search_text_truncated ? 1 : 0,
    derived.catalogMetadataSHA256,
    catalogRevision,
    input.timeCreated,
    input.timeCreated,
  )
  return {
    id: input.id,
    catalogRevision,
    payloadSHA256: metadata.payload_sha256,
  }
}

function updateLineagePayload(db: BunDatabase, row: ArtifactRow, payload: Record<string, unknown>): void {
  const derived = derivedArtifactValues({
    id: row.id,
    taskID: row.task_id,
    kind: "dispatch_lineage",
    label: row.label,
    payload,
    timeCreated: row.time_created,
    timeUpdated: row.time_updated,
  })
  const metadata = derived.metadata
  run(
    db,
    `UPDATE engine_artifact SET
      payload=?,payload_sha256=?,payload_bytes=?,payload_block_sha256s=?,payload_block_index_sha256=?,
      catalog_artifact_type=?,catalog_schema_diagnostic=?,catalog_producer=?,catalog_import_source_task_id=?,
      catalog_resource_count=?,catalog_resource_media_types=?,catalog_search_text=?,
      catalog_search_text_truncated=?,catalog_metadata_sha256=? WHERE id=?`,
    derived.payloadText,
    metadata.payload_sha256,
    metadata.payload_bytes,
    JSON.stringify(metadata.payload_block_sha256s),
    metadata.payload_block_index_sha256,
    metadata.catalog_artifact_type,
    metadata.catalog_schema_diagnostic,
    metadata.catalog_producer === null ? null : JSON.stringify(metadata.catalog_producer),
    metadata.catalog_import_source_task_id,
    metadata.catalog_resource_count,
    JSON.stringify(metadata.catalog_resource_media_types),
    metadata.catalog_search_text,
    metadata.catalog_search_text_truncated ? 1 : 0,
    derived.catalogMetadataSHA256,
    row.id,
  )
}

function settlementSource(
  db: BunDatabase,
  input: { taskID: string; lineageID: string; dispatchID: string; childSessionID: string },
) {
  const settlements = rows<{ id: string; payload: string }>(
    db,
    `SELECT id,payload FROM engine_artifact
     WHERE task_id=? AND kind='dispatch_settlement' AND json_extract(payload,'$.dispatch_id')=?
     ORDER BY time_created,id`,
    input.taskID,
    input.dispatchID,
  )
  if (settlements.length > 1) {
    throw new Error(`Dispatch ${input.dispatchID} has ${settlements.length} historical settlements`)
  }
  const settlement = settlements[0]
  if (!settlement) return undefined
  const payload = parseObject(settlement.payload, `Dispatch settlement ${settlement.id}`)
  if (
    payload.task_id !== input.taskID ||
    payload.dispatch_lineage_id !== input.lineageID ||
    payload.dispatch_id !== input.dispatchID ||
    payload.session_id !== input.childSessionID
  ) {
    throw new Error(`Dispatch settlement ${settlement.id} historical identity drift`)
  }
  return { kind: "dispatch_settlement" as const, artifact_id: settlement.id }
}

function terminalLifecycleSource(db: BunDatabase, taskID: string, childSessionID: string, dispatchID: string) {
  const descriptors = rows<{ payload: string }>(
    db,
    `SELECT payload FROM worker_turn_descriptor
     WHERE session_id=? AND json_extract(payload,'$.dispatchTurn.current_dispatch_id')=?`,
    childSessionID,
    dispatchID,
  )
  if (descriptors.length > 1) {
    throw new Error(`Dispatch ${dispatchID} has ${descriptors.length} historical Worker Turn descriptors`)
  }
  const descriptor = descriptors[0]
    ? parseObject(descriptors[0].payload, `Dispatch ${dispatchID} descriptor`)
    : undefined
  const messageAuthority = descriptor?.messageAuthority
  const inputMessageID =
    messageAuthority && typeof messageAuthority === "object" && !Array.isArray(messageAuthority)
      ? (messageAuthority as Record<string, unknown>).user_message_id
      : undefined
  if (typeof inputMessageID !== "string" || !inputMessageID) return undefined
  const lifecycle = rows<{ id: string; payload: string }>(
    db,
    `SELECT id,payload FROM protocol_event
     WHERE type='agent.execution.lifecycle'
       AND (session_id=? OR (aggregate_type='session' AND aggregate_id=?))
       AND ((aggregate_type='task' AND aggregate_id=?) OR task_id=?)
       AND json_extract(payload,'$.inputMessageID')=?
       AND json_extract(payload,'$.status.type')='terminal'
     ORDER BY emitted_at DESC,id DESC LIMIT 1`,
    childSessionID,
    childSessionID,
    taskID,
    taskID,
    inputMessageID,
  )[0]
  if (!lifecycle) return undefined
  const lifecyclePayload = parseObject(lifecycle.payload, `Lifecycle ${lifecycle.id}`)
  const status = lifecyclePayload.status
  if (!status || typeof status !== "object" || Array.isArray(status)) return undefined
  const terminal = status as Record<string, unknown>
  if (terminal.type !== "terminal") return undefined
  if (terminal.reason === "error" || terminal.reason === "aborted") {
    return { kind: "agent_execution_lifecycle" as const, event_id: lifecycle.id }
  }
  if (terminal.reason !== "completed" && terminal.reason !== "coordinated") return undefined
  const finalMessageID = terminal.final_message_id
  if (typeof finalMessageID !== "string" || !finalMessageID) return undefined
  const finalMessage = rows<{ data: string }>(
    db,
    "SELECT data FROM message WHERE id=? AND session_id=?",
    finalMessageID,
    childSessionID,
  )[0]
  if (!finalMessage) return undefined
  const finalData = parseObject(finalMessage.data, `Final Message ${finalMessageID}`)
  const finalTime = finalData.time
  const acceptedInputMessageIDs = Array.isArray(finalData.acceptedInputMessageIDs)
    ? finalData.acceptedInputMessageIDs
    : [finalData.parentID]
  if (
    finalData.role !== "assistant" ||
    !finalTime ||
    typeof finalTime !== "object" ||
    Array.isArray(finalTime) ||
    typeof (finalTime as Record<string, unknown>).completed !== "number" ||
    typeof finalData.finish !== "string" ||
    !finalData.finish ||
    !acceptedInputMessageIDs.includes(inputMessageID)
  ) {
    return undefined
  }
  return { kind: "agent_execution_lifecycle" as const, event_id: lifecycle.id }
}

function createHistoricalInfrastructureSettlement(
  db: BunDatabase,
  input: { lineageID: string; taskID: string; dispatchID: string; childSessionID: string; now: number },
) {
  const infrastructureArtifactID = Identifier.deterministic(
    "artifact",
    `dispatch-owner-migration-infrastructure\0${input.lineageID}`,
  )
  const reason =
    `Historical dispatch ${input.dispatchID} has no process occurrence, exact replayable terminal lifecycle, or settlement; ` +
    "the current runtime cannot prove a live delivery owner"
  const infrastructure = insertArtifact(db, {
    id: infrastructureArtifactID,
    taskID: input.taskID,
    kind: "task-infrastructure-error",
    label: "dispatch-agent",
    payload: {
      component: "dispatch-agent",
      operation: "migrate-unattributed-dispatch-owner",
      reason,
      errorName: "HistoricalDispatchOwnerUnavailableError",
      sessionID: input.childSessionID,
      context: { dispatchID: input.dispatchID, dispatchLineageID: input.lineageID },
    },
    timeCreated: input.now,
  })
  const settlementArtifactID = Identifier.deterministic(
    "artifact",
    `dispatch-owner-migration-settlement\0${input.lineageID}`,
  )
  insertArtifact(db, {
    id: settlementArtifactID,
    taskID: input.taskID,
    kind: "dispatch_settlement",
    label: "dispatch-settlement",
    payload: {
      task_id: input.taskID,
      dispatch_lineage_id: input.lineageID,
      dispatch_id: input.dispatchID,
      session_id: input.childSessionID,
      outcome: {
        kind: "infrastructure_failure",
        operation: "migrate-unattributed-dispatch-owner",
        message: reason,
        recovery_authority: {
          occurrence_status: "occurrence_committed",
          dispatch_lineage_id: input.lineageID,
          dispatch_id: input.dispatchID,
        },
        session_id: input.childSessionID,
        error_name: "HistoricalDispatchOwnerUnavailableError",
        infrastructure_error: {
          source: "engine_artifact",
          artifact_id: infrastructure.id,
          catalog_revision: infrastructure.catalogRevision,
          expected_sha256: infrastructure.payloadSHA256,
        },
      },
      time_created: input.now,
    },
    timeCreated: input.now,
  })
  return { kind: "dispatch_settlement" as const, artifact_id: settlementArtifactID }
}

/**
 * Upgrade every legacy dispatch lineage to the one required delivery-owner
 * fact before strict trigger and payload validation run. The immutable trigger
 * is removed and restored inside the same transaction; rollback restores both
 * data and trigger if any row cannot be classified.
 */
let afterAdmissionForTest: (() => void) | undefined

export function migrateDispatchLineageDeliveryOwners(sqlite: BunDatabase): boolean {
  sqlite.exec("BEGIN IMMEDIATE")
  try {
    afterAdmissionForTest?.()
    const immutableTrigger = rows<{ sql: string | null }>(
      sqlite,
      "SELECT sql FROM sqlite_schema WHERE type='trigger' AND name='engine_dispatch_lineage_immutable'",
    )[0]?.sql
    if (!immutableTrigger) throw new Error("Dispatch lineage owner migration requires the immutable lineage trigger")
    const lineages = rows<ArtifactRow>(
      sqlite,
      `SELECT id,task_id,kind,label,payload,time_created,time_updated,catalog_revision
       FROM engine_artifact WHERE kind='dispatch_lineage' ORDER BY time_created,id`,
    )
    const legacy = lineages.filter(
      (row) => parseObject(row.payload, `Dispatch lineage ${row.id}`).delivery_owner === undefined,
    )
    if (legacy.length === 0) {
      sqlite.exec("COMMIT")
      return false
    }
    sqlite.exec("DROP TRIGGER engine_dispatch_lineage_immutable")
    for (const row of legacy) {
      const payload = parseObject(row.payload, `Dispatch lineage ${row.id}`)
      const dispatchID = payload.dispatch_id
      const childSessionID = payload.child_session_id
      if (typeof dispatchID !== "string" || !dispatchID || typeof childSessionID !== "string" || !childSessionID) {
        throw new Error(`Dispatch lineage ${row.id} has no exact migration identity`)
      }
      const oldOwner = payload.owner_process_occurrence_id
      let deliveryOwner: Record<string, unknown>
      if (typeof oldOwner === "string" && oldOwner.length > 0) {
        deliveryOwner = { kind: "runtime_process", process_occurrence_id: oldOwner }
      } else if (oldOwner !== undefined) {
        throw new Error(`Dispatch lineage ${row.id} has an invalid legacy process owner`)
      } else {
        const source =
          settlementSource(sqlite, {
            taskID: row.task_id,
            lineageID: row.id,
            dispatchID,
            childSessionID,
          }) ??
          terminalLifecycleSource(sqlite, row.task_id, childSessionID, dispatchID) ??
          createHistoricalInfrastructureSettlement(sqlite, {
            lineageID: row.id,
            taskID: row.task_id,
            dispatchID,
            childSessionID,
            now: Math.max(Date.now(), row.time_created),
          })
        deliveryOwner = { kind: "historical_reconciliation", source }
      }
      delete payload.owner_process_occurrence_id
      payload.delivery_owner = deliveryOwner
      updateLineagePayload(sqlite, row, payload)
    }
    sqlite.exec(immutableTrigger)
    sqlite.exec("COMMIT")
    return true
  } catch (error) {
    sqlite.exec("ROLLBACK")
    throw error
  }
}

export const DispatchLineageOwnerMigrationTestHooks = {
  replaceAfterAdmission(callback: (() => void) | undefined): Disposable {
    const prior = afterAdmissionForTest
    afterAdmissionForTest = callback
    return {
      [Symbol.dispose]() {
        afterAdmissionForTest = prior
      },
    }
  },
}
