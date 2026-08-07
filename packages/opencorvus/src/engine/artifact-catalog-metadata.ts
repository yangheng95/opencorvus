import {
  ArtifactJSONValueSchema,
  EngineArtifactEnvelopeSchema,
  type ArtifactProducer,
  type EngineArtifactEnvelope,
} from "@opencorvus-ai/plugin/artifact-catalog"
import { createHash } from "node:crypto"
import {
  BROWSER_PREVIEW_EVIDENCE_ARTIFACT_TYPE,
  FRONTEND_RESEARCH_BRIEF_ARTIFACT_TYPE,
  FRONTEND_RESEARCH_BRIEF_PRODUCER,
} from "./artifact-catalog-constants"
import type { EngineArtifactKind, EngineMetadata } from "./engine.sql"

const CATALOG_SEARCH_TEXT_MAX_CHARS = 32 * 1024
/** Fixed payload block size used by exact reads. A block digest verifies the
 * returned byte window without selecting and hashing the complete JSON value
 * for every transport page. Complete consumers still verify payload_sha256. */
export const ENGINE_ARTIFACT_PAYLOAD_BLOCK_BYTES = 64 * 1024

export type EngineArtifactDerivedCatalogIndex = Readonly<{
  payload_sha256: string
  payload_bytes: number
  payload_block_sha256s: string[]
  payload_block_index_sha256: string
  catalog_artifact_type: string | null
  catalog_schema_diagnostic: string | null
  catalog_producer: ArtifactProducer | null
  catalog_import_source_task_id: string | null
  catalog_resource_count: number
  catalog_resource_media_types: string[]
  catalog_search_text: string
  catalog_search_text_truncated: boolean
}>

export type EngineArtifactCatalogRecordIndex = Readonly<{
  artifact_id: string
  task_id: string
  kind: EngineArtifactKind
  label_index: string
  time_created: number
  time_updated: number
}> &
  Omit<EngineArtifactDerivedCatalogIndex, "payload_block_sha256s">

function stableJSON(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJSON).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJSON(child)}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

function payloadBlockSHA256s(bytes: Uint8Array): string[] {
  const hashes: string[] = []
  for (let offset = 0; offset < bytes.byteLength; offset += ENGINE_ARTIFACT_PAYLOAD_BLOCK_BYTES) {
    hashes.push(
      createHash("sha256")
        .update(bytes.subarray(offset, offset + ENGINE_ARTIFACT_PAYLOAD_BLOCK_BYTES))
        .digest("hex"),
    )
  }
  return hashes
}

export function engineArtifactPayloadBlockIndexSHA256(input: {
  payloadSHA256: string
  payloadBytes: number
  blockSHA256s: readonly string[]
}): string {
  return createHash("sha256")
    .update(
      stableJSON({
        version: 2,
        payload_sha256: input.payloadSHA256,
        payload_bytes: input.payloadBytes,
        payload_block_bytes: ENGINE_ARTIFACT_PAYLOAD_BLOCK_BYTES,
        payload_block_sha256s: input.blockSHA256s,
      }),
    )
    .digest("hex")
}

export function engineArtifactCatalogMetadataSHA256(index: EngineArtifactCatalogRecordIndex): string {
  return createHash("sha256")
    .update(
      stableJSON({
        version: 2,
        artifact_id: index.artifact_id,
        task_id: index.task_id,
        kind: index.kind,
        label_index: index.label_index,
        time_created: index.time_created,
        time_updated: index.time_updated,
        payload_sha256: index.payload_sha256,
        payload_bytes: index.payload_bytes,
        payload_block_index_sha256: index.payload_block_index_sha256,
        catalog_artifact_type: index.catalog_artifact_type,
        catalog_schema_diagnostic: index.catalog_schema_diagnostic,
        catalog_producer: index.catalog_producer,
        catalog_import_source_task_id: index.catalog_import_source_task_id,
        catalog_resource_count: index.catalog_resource_count,
        catalog_resource_media_types: index.catalog_resource_media_types,
        catalog_search_text: index.catalog_search_text,
        catalog_search_text_truncated: index.catalog_search_text_truncated,
      }),
    )
    .digest("hex")
}

function boundedCatalogSearchText(value: string): { value: string; truncated: boolean } {
  return value.length <= CATALOG_SEARCH_TEXT_MAX_CHARS
    ? { value, truncated: false }
    : { value: value.slice(0, CATALOG_SEARCH_TEXT_MAX_CHARS), truncated: true }
}

function deriveEnvelopeCatalogIndex(input: {
  envelope: EngineArtifactEnvelope
  payloadSHA256: string
  payloadBytes: number
  blockSHA256s: string[]
}): EngineArtifactDerivedCatalogIndex {
  const mediaTypes = [...new Set(input.envelope.resources.map((resource) => resource.media_type))].sort((left, right) =>
    left.localeCompare(right),
  )
  const producerSearchFields =
    input.envelope.producer.owner_kind === "mission"
      ? [input.envelope.producer.mission_id, input.envelope.producer.session_id]
      : input.envelope.producer.owner_kind === "core"
        ? [input.envelope.producer.component_id, input.envelope.producer.operation_id]
        : [
            input.envelope.producer.agent_id,
            input.envelope.producer.expert_squad_id,
            input.envelope.producer.session_id,
          ]
  const searchText = boundedCatalogSearchText(
    [
      input.envelope.artifact_type,
      ...(input.envelope.import_lineage ? [input.envelope.import_lineage.source_task_id] : []),
      ...producerSearchFields,
      ...input.envelope.resources.flatMap((resource) => [resource.tree, resource.path, resource.media_type]),
    ]
      .join("\n")
      .normalize("NFKC")
      .toLowerCase(),
  )
  return {
    payload_sha256: input.payloadSHA256,
    payload_bytes: input.payloadBytes,
    payload_block_sha256s: input.blockSHA256s,
    payload_block_index_sha256: engineArtifactPayloadBlockIndexSHA256({
      payloadSHA256: input.payloadSHA256,
      payloadBytes: input.payloadBytes,
      blockSHA256s: input.blockSHA256s,
    }),
    catalog_artifact_type: input.envelope.artifact_type,
    catalog_schema_diagnostic: null,
    catalog_producer: input.envelope.producer as ArtifactProducer,
    catalog_import_source_task_id: input.envelope.import_lineage?.source_task_id ?? null,
    catalog_resource_count: input.envelope.resources.length,
    catalog_resource_media_types: mediaTypes,
    catalog_search_text: searchText.value,
    catalog_search_text_truncated: searchText.truncated,
  }
}

export function deriveEngineArtifactCatalogMetadata(input: { kind: EngineArtifactKind; payloadText: string }) {
  const payloadBytes = Buffer.from(input.payloadText, "utf8")
  const bytes = payloadBytes.byteLength
  const payloadSHA256 = createHash("sha256").update(payloadBytes).digest("hex")
  const blockSHA256s = payloadBlockSHA256s(payloadBytes)
  let rawPayload: unknown
  try {
    rawPayload = JSON.parse(input.payloadText)
  } catch {
    rawPayload = undefined
  }
  const parsed = EngineArtifactEnvelopeSchema.safeParse(rawPayload)
  if (input.kind === "browser_preview_evidence") {
    // The one dedicated Host-owned typed envelope. Its exact artifact_type and
    // Core `browser-preview` producer are the identity; no other Core kind and
    // no package payload can project this provenance.
    const candidate =
      parsed.success && parsed.data.artifact_type === BROWSER_PREVIEW_EVIDENCE_ARTIFACT_TYPE ? parsed.data : undefined
    const coreProducer =
      candidate?.producer.owner_kind === "core" && candidate.producer.component_id === "browser-preview"
        ? candidate.producer
        : undefined
    const envelope = coreProducer ? candidate : undefined
    if (!envelope || !coreProducer) {
      const rawDiagnostic =
        `Invalid browser_preview_evidence transport envelope: expected artifact_type=${BROWSER_PREVIEW_EVIDENCE_ARTIFACT_TYPE} ` +
        "and core producer component_id=browser-preview"
      return {
        payload_sha256: payloadSHA256,
        payload_bytes: bytes,
        payload_block_sha256s: blockSHA256s,
        payload_block_index_sha256: engineArtifactPayloadBlockIndexSHA256({
          payloadSHA256,
          payloadBytes: bytes,
          blockSHA256s,
        }),
        catalog_artifact_type: null,
        catalog_schema_diagnostic: rawDiagnostic,
        catalog_producer: null,
        catalog_import_source_task_id: null,
        catalog_resource_count: 0,
        catalog_resource_media_types: [],
        catalog_search_text: "",
        catalog_search_text_truncated: false,
      }
    }
    return deriveEnvelopeCatalogIndex({
      envelope,
      payloadSHA256,
      payloadBytes: bytes,
      blockSHA256s,
    })
  }
  if (input.kind === "frontend_research_brief") {
    const candidate =
      parsed.success && parsed.data.artifact_type === FRONTEND_RESEARCH_BRIEF_ARTIFACT_TYPE ? parsed.data : undefined
    const coreProducer =
      candidate?.producer.owner_kind === "core" &&
      candidate.producer.component_id === FRONTEND_RESEARCH_BRIEF_PRODUCER.component_id &&
      candidate.producer.operation_id === FRONTEND_RESEARCH_BRIEF_PRODUCER.operation_id
        ? candidate.producer
        : undefined
    const envelope = coreProducer ? candidate : undefined
    if (!envelope) {
      const rawDiagnostic =
        `Invalid frontend_research_brief transport envelope: expected artifact_type=${FRONTEND_RESEARCH_BRIEF_ARTIFACT_TYPE} ` +
        "and core producer frontend-research/persist-research-brief"
      return {
        payload_sha256: payloadSHA256,
        payload_bytes: bytes,
        payload_block_sha256s: blockSHA256s,
        payload_block_index_sha256: engineArtifactPayloadBlockIndexSHA256({
          payloadSHA256,
          payloadBytes: bytes,
          blockSHA256s,
        }),
        catalog_artifact_type: null,
        catalog_schema_diagnostic: rawDiagnostic,
        catalog_producer: null,
        catalog_import_source_task_id: null,
        catalog_resource_count: 0,
        catalog_resource_media_types: [],
        catalog_search_text: "",
        catalog_search_text_truncated: false,
      }
    }
    return deriveEnvelopeCatalogIndex({
      envelope,
      payloadSHA256,
      payloadBytes: bytes,
      blockSHA256s,
    })
  }
  if (input.kind !== "expert_output") {
    const artifactType = `opencorvus/core/${input.kind}`
    const producer: ArtifactProducer = {
      owner_kind: "core",
      component_id: "engine-artifact",
      operation_id: input.kind,
    }
    const searchText = boundedCatalogSearchText(
      [artifactType, producer.component_id, producer.operation_id].join("\n").normalize("NFKC").toLowerCase(),
    )
    const index: EngineArtifactDerivedCatalogIndex = {
      payload_sha256: payloadSHA256,
      payload_bytes: bytes,
      payload_block_sha256s: blockSHA256s,
      payload_block_index_sha256: engineArtifactPayloadBlockIndexSHA256({
        payloadSHA256,
        payloadBytes: bytes,
        blockSHA256s,
      }),
      catalog_artifact_type: artifactType,
      catalog_schema_diagnostic: null,
      catalog_producer: producer,
      catalog_import_source_task_id: null,
      catalog_resource_count: 0,
      catalog_resource_media_types: [],
      catalog_search_text: searchText.value,
      catalog_search_text_truncated: searchText.truncated,
    }
    return index
  }
  if (!parsed.success) {
    const rawDiagnostic = `Invalid expert_output transport envelope: ${parsed.error.message}`
    const index: EngineArtifactDerivedCatalogIndex = {
      payload_sha256: payloadSHA256,
      payload_bytes: bytes,
      payload_block_sha256s: blockSHA256s,
      payload_block_index_sha256: engineArtifactPayloadBlockIndexSHA256({
        payloadSHA256,
        payloadBytes: bytes,
        blockSHA256s,
      }),
      catalog_artifact_type: null,
      catalog_schema_diagnostic: rawDiagnostic.length > 2_048 ? `${rawDiagnostic.slice(0, 2_045)}...` : rawDiagnostic,
      catalog_producer: null,
      catalog_import_source_task_id: null,
      catalog_resource_count: 0,
      catalog_resource_media_types: [],
      catalog_search_text: "",
      catalog_search_text_truncated: false,
    }
    return index
  }
  return deriveEnvelopeCatalogIndex({
    envelope: parsed.data,
    payloadSHA256,
    payloadBytes: bytes,
    blockSHA256s,
  })
}

export function assertEngineArtifactCatalogIndexIdentity(
  input: EngineArtifactCatalogRecordIndex & Readonly<{ id: string; catalog_metadata_sha256: string }>,
): void {
  const expected = engineArtifactCatalogMetadataSHA256(input)
  if (input.catalog_metadata_sha256 !== expected) {
    throw new Error(`Engine Artifact ${input.id} catalog index digest does not match its bounded metadata`)
  }
}

/**
 * Canonical here means the exact, single Host serialization whose UTF-8 bytes
 * are bound to SQLite and hashed. It is not a second semantic JSON
 * normalization format.
 */
export function serializeEngineArtifactPayload(payload: EngineMetadata | null): string {
  const canonical = ArtifactJSONValueSchema.parse(payload)
  return JSON.stringify(canonical)
}

/**
 * Recompute the canonical payload identity before an Engine Artifact is used
 * as an execution authority. Database metadata is an index, not proof that
 * the current bytes still match the recorded digest.
 */
export function assertEngineArtifactPayloadIdentity(input: {
  id: string
  kind: EngineArtifactKind
  payload: EngineMetadata | null
  payloadSHA256: string
  payloadBytes: number
}): void {
  const payloadText = serializeEngineArtifactPayload(input.payload)
  const derived = deriveEngineArtifactCatalogMetadata({
    kind: input.kind,
    payloadText,
  })
  const mismatches: string[] = []
  if (derived.payload_sha256 !== input.payloadSHA256) mismatches.push("payload_sha256")
  if (derived.payload_bytes !== input.payloadBytes) mismatches.push("payload_bytes")
  if (mismatches.length > 0) {
    throw new Error(`Engine Artifact ${input.id} canonical payload identity mismatch: ${mismatches.join(", ")}`)
  }
}
