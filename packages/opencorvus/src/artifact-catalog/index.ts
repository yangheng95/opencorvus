import {
  ArtifactReadInputSchema,
  ArtifactSearchInputSchema,
  EngineArtifactEnvelopeSchema,
  EngineArtifactPublishInputSchema,
  ArtifactProducerSchema,
  type ArtifactCatalogEntry,
  type ArtifactReadChunk,
  type ArtifactReadInput,
  type ArtifactReadRequest,
  type ArtifactSearchInput,
  type ArtifactSearchRequest,
  type ArtifactSearchPage,
  type EngineArtifactPublishRequest,
  type EngineArtifactPublishResult,
} from "@opencorvus-ai/plugin/artifact-catalog"
import type { TaskArtifactRef } from "@opencorvus-ai/plugin/task-artifact"
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import fuzzysort from "fuzzysort"
import { insertEngineArtifact, type EngineArtifactRow } from "@/engine/artifact"
import {
  ENGINE_ARTIFACT_CATALOG_LABEL_INDEX_CODE_POINTS,
  engineArtifactCatalogLabelIndex,
} from "@/engine/artifact-catalog-constants"
import {
  assertEngineArtifactCatalogIndexIdentity,
  deriveEngineArtifactCatalogMetadata,
  engineArtifactPayloadBlockIndexSHA256,
  ENGINE_ARTIFACT_PAYLOAD_BLOCK_BYTES,
} from "@/engine/artifact-catalog-metadata"
import {
  EngineArtifactCatalogRevisionTable,
  EngineArtifactTable,
  EngineArtifactVersionTable,
  EngineTaskTable,
  type EngineArtifactKind,
} from "@/engine/engine.sql"
import { requireTask } from "@/engine/store"
import { taskPrimaryProjectRoot } from "@/project/task-runtime-root"
import { isDecodableText } from "@/session/text-mime"
import { Database, and, desc, eq, lte, sql } from "@/storage/db"
import { artifactPackageRevision } from "@/session/runtime-contract"
import {
  listTaskArtifactSnapshots,
  readTaskArtifactRef,
  readTaskArtifactSnapshotManifest,
  taskArtifactSnapshotResourceRefs,
  type TaskArtifactReadAuthority,
  type TaskArtifactSnapshotRecord,
} from "@/task-artifact/store"
import type { TaskToolExecutionScope } from "@/tool/task-tool-execution-scope"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { Identifier } from "@/id/id"

type EngineCatalogRow = Readonly<{
  id: string
  taskID: string
  goalSubject: string | null
  kind: EngineArtifactKind
  label: string
  labelIndex: string
  payloadSHA256: string
  payloadBytes: number
  payloadBlockIndexSHA256: string
  artifactType: string | null
  schemaDiagnostic: string | null
  producer: unknown
  importSourceTaskID: string | null
  resourceCount: number
  resourceMediaTypes: string[]
  catalogSearchText: string
  catalogSearchTextTruncated: boolean
  catalogMetadataSHA256: string
  catalogRevision: number
  timeCreated: number
  timeUpdated: number
  versionState?: "current" | "historical"
}>

type ExactEngineRow = Readonly<{
  id: string
  taskID: string
  payloadSHA256: string
  payloadBytes: number
  kind: EngineArtifactKind
  label: string
  payloadBlockIndexSHA256: string
  artifactType: string | null
  schemaDiagnostic: string | null
  producer: unknown
  importSourceTaskID: string | null
  resourceCount: number
  resourceMediaTypes: string[]
  catalogSearchText: string
  catalogSearchTextTruncated: boolean
  catalogMetadataSHA256: string
  catalogRevision: number
  timeCreated: number
  timeUpdated: number
}>

const CATALOG_LABEL_PREVIEW_CHARS = 512
const CATALOG_DIAGNOSTIC_PREVIEW_CHARS = 2_048
const CATALOG_ENTRY_MEDIA_TYPE_LIMIT = 64
const CATALOG_FACET_VALUE_LIMIT = 100
const ARTIFACT_SEARCH_ABI_VERSION = 2
const ARTIFACT_CURSOR_AUTHORITY_KEY = randomBytes(32)
const ARTIFACT_FUZZY_SCORE_MINIMUM = 0.1
const CATALOG_SOURCE_ORDER: Record<ArtifactCatalogEntry["source"], number> = {
  engine_artifact: 0,
  task_artifact: 1,
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

type CatalogCandidate = Readonly<{
  entry: ArtifactCatalogEntry
  exactLabel: string
  stableID: string
  identitySearchText: string
  labelSearchText: string
  searchText: string
  resourceMediaTypes: readonly string[]
  engineCatalogRevision: number | null
  snapshotSequence: number | null
  searchMetadataTruncated: boolean
  match?: NonNullable<ArtifactCatalogEntry["match"]>
}>

type CatalogSourceSnapshot = Readonly<{
  source: ArtifactCatalogEntry["source"]
  membershipSHA256: string
  catalogTotal: number
}>

type CatalogCursor = Readonly<{
  version: 9
  searchABIVersion: number
  authoritySHA256: string
  filtersSHA256: string
  engineCatalogRevisionUpper: number
  snapshotSequenceUpper: number
  catalogTotal: number
  filteredTotal: number
  sourceSnapshots: readonly CatalogSourceSnapshot[]
  availableSources: readonly ArtifactCatalogEntry["source"][]
  providerErrors: ArtifactSearchPage["provider_errors"]
  afterSortTuple: readonly (string | number)[]
}>

type CatalogSourceCode = 0 | 1

type CatalogCursorPayloadWire = readonly [
  version: 9,
  searchABIVersion: number,
  authoritySHA256: string,
  filtersSHA256: string,
  engineCatalogRevisionUpper: number,
  snapshotSequenceUpper: number,
  catalogTotal: number,
  filteredTotal: number,
  sourceSnapshots: readonly (readonly [CatalogSourceCode, string, number])[],
  availableSourceMask: number,
  providerErrors: readonly (readonly [CatalogSourceCode, string])[],
  afterSortTuple: readonly (string | number)[],
]

type CatalogCursorWire = readonly [...CatalogCursorPayloadWire, authenticityHMACSHA256: string]

export type ArtifactReadResult = Readonly<{
  chunk: ArtifactReadChunk
  attachment?: Readonly<{
    bytes: Uint8Array
    filename: string
  }>
}>

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex")
}

function stableJSON(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJSON).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJSON(child)}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

function normalizedStrings(values: readonly string[] | undefined): string[] | undefined {
  if (!values) return undefined
  return [...new Set(values)].sort(compareCodeUnits)
}

function normalizedSearchInput(input: ArtifactSearchInput): ArtifactSearchInput {
  return {
    ...(input.query
      ? {
          query: {
            text: input.query.text.normalize("NFKC"),
            mode: input.query.mode,
          },
        }
      : {}),
    ...(input.labels ? { labels: normalizedStrings(input.labels) } : {}),
    ...(input.sources ? { sources: normalizedStrings(input.sources) as ArtifactSearchInput["sources"] } : {}),
    ...(input.kinds ? { kinds: normalizedStrings(input.kinds) } : {}),
    ...(input.artifact_types ? { artifact_types: normalizedStrings(input.artifact_types) } : {}),
    ...(input.import_source_task_ids
      ? { import_source_task_ids: normalizedStrings(input.import_source_task_ids) }
      : {}),
    ...(input.media_types ? { media_types: normalizedStrings(input.media_types) } : {}),
    ...(input.producer_agent_ids ? { producer_agent_ids: normalizedStrings(input.producer_agent_ids) } : {}),
    ...(input.producer_squad_ids ? { producer_squad_ids: normalizedStrings(input.producer_squad_ids) } : {}),
    ...(input.producer_session_ids ? { producer_session_ids: normalizedStrings(input.producer_session_ids) } : {}),
    ...(input.goal_ids ? { goal_ids: normalizedStrings(input.goal_ids) } : {}),
    ...(input.created_at_or_after_ms !== undefined ? { created_at_or_after_ms: input.created_at_or_after_ms } : {}),
    ...(input.created_before_ms !== undefined ? { created_before_ms: input.created_before_ms } : {}),
    version_scope: input.version_scope,
    sort: input.sort ?? (input.query ? "relevance" : "newest"),
    limit: input.limit,
    ...(input.cursor ? { cursor: input.cursor } : {}),
  }
}

function filterDigest(input: ArtifactSearchInput): string {
  // Page size controls transport only; it does not change catalog membership.
  // Excluding it lets bounded callers lower the next page size without
  // invalidating the frozen catalog cursor.
  const { cursor: _cursor, limit: _limit, ...filters } = input
  return sha256(stableJSON(filters))
}

function authorityDigest(authority: TaskArtifactReadAuthority): string {
  return sha256(
    stableJSON({
      project_id: authority.projectID,
      task_id: authority.taskID,
    }),
  )
}

function catalogSourceCode(source: ArtifactCatalogEntry["source"]): CatalogSourceCode {
  return source === "engine_artifact" ? 0 : 1
}

function catalogSourceFromCode(code: CatalogSourceCode): ArtifactCatalogEntry["source"] {
  return code === 0 ? "engine_artifact" : "task_artifact"
}

function compactCursorDigest(digest: string): string {
  return Buffer.from(digest, "hex").toString("base64url")
}

function expandCursorDigest(digest: string): string | undefined {
  if (!/^[A-Za-z0-9_-]{43}$/.test(digest)) return undefined
  const bytes = Buffer.from(digest, "base64url")
  if (bytes.byteLength !== 32 || bytes.toString("base64url") !== digest) return undefined
  return bytes.toString("hex")
}

function cursorAuthenticity(payload: CatalogCursorPayloadWire): Buffer {
  return createHmac("sha256", ARTIFACT_CURSOR_AUTHORITY_KEY).update(stableJSON(payload)).digest()
}

function encodeCursor(cursor: CatalogCursor): string {
  const availableSourceMask = cursor.availableSources.reduce(
    (mask, source) => mask | (source === "engine_artifact" ? 1 : 2),
    0,
  )
  const payload: CatalogCursorPayloadWire = [
    9,
    cursor.searchABIVersion,
    compactCursorDigest(cursor.authoritySHA256),
    compactCursorDigest(cursor.filtersSHA256),
    cursor.engineCatalogRevisionUpper,
    cursor.snapshotSequenceUpper,
    cursor.catalogTotal,
    cursor.filteredTotal,
    cursor.sourceSnapshots.map((snapshot) => [
      catalogSourceCode(snapshot.source),
      compactCursorDigest(snapshot.membershipSHA256),
      snapshot.catalogTotal,
    ]),
    availableSourceMask,
    cursor.providerErrors.map((error) => [catalogSourceCode(error.source), error.message]),
    cursor.afterSortTuple,
  ]
  const wire: CatalogCursorWire = [...payload, cursorAuthenticity(payload).toString("base64url")]
  return Buffer.from(stableJSON(wire), "utf8").toString("base64url")
}

function decodeCursor(input: string): CatalogCursor {
  let decoded: unknown
  try {
    decoded = JSON.parse(Buffer.from(input, "base64url").toString("utf8"))
  } catch (cause) {
    throw new Error("artifact_search cursor is not valid canonical base64url JSON", { cause })
  }
  if (!Array.isArray(decoded)) throw new Error("artifact_search cursor must be a compact tuple")
  const value = decoded as unknown as Partial<CatalogCursorWire>
  const suppliedAuthenticity =
    typeof value[12] === "string" && /^[A-Za-z0-9_-]{43}$/.test(value[12])
      ? Buffer.from(value[12], "base64url")
      : undefined
  if (
    value.length !== 13 ||
    value[0] !== 9 ||
    !suppliedAuthenticity ||
    suppliedAuthenticity.byteLength !== 32 ||
    suppliedAuthenticity.toString("base64url") !== value[12]
  ) {
    throw new Error("artifact_search cursor has an invalid shape")
  }
  const payload = value.slice(0, 12) as unknown as CatalogCursorPayloadWire
  const expectedAuthenticity = cursorAuthenticity(payload)
  if (!timingSafeEqual(suppliedAuthenticity, expectedAuthenticity)) {
    throw new Error("artifact_search cursor authenticity check failed")
  }
  const sourceSnapshots = value[8]
  const availableSourceMask = value[9]
  const providerErrors = value[10]
  const afterSortTuple = value[11]
  const authoritySHA256 = typeof value[2] === "string" ? expandCursorDigest(value[2]) : undefined
  const filtersSHA256 = typeof value[3] === "string" ? expandCursorDigest(value[3]) : undefined
  if (
    value[1] !== ARTIFACT_SEARCH_ABI_VERSION ||
    !authoritySHA256 ||
    !filtersSHA256 ||
    typeof value[4] !== "number" ||
    !Number.isInteger(value[4]) ||
    value[4] < 0 ||
    typeof value[5] !== "number" ||
    !Number.isInteger(value[5]) ||
    value[5] < 0 ||
    typeof value[6] !== "number" ||
    !Number.isInteger(value[6]) ||
    value[6] < 0 ||
    typeof value[7] !== "number" ||
    !Number.isInteger(value[7]) ||
    value[7] < 0 ||
    !Array.isArray(sourceSnapshots) ||
    sourceSnapshots.some(
      (snapshot) =>
        !Array.isArray(snapshot) ||
        snapshot.length !== 3 ||
        (snapshot[0] !== 0 && snapshot[0] !== 1) ||
        typeof snapshot[1] !== "string" ||
        !expandCursorDigest(snapshot[1]) ||
        typeof snapshot[2] !== "number" ||
        !Number.isInteger(snapshot[2]) ||
        snapshot[2] < 0,
    ) ||
    new Set(sourceSnapshots.map((snapshot) => snapshot[0])).size !== sourceSnapshots.length ||
    typeof availableSourceMask !== "number" ||
    !Number.isInteger(availableSourceMask) ||
    availableSourceMask < 0 ||
    availableSourceMask > 3 ||
    !Array.isArray(providerErrors) ||
    providerErrors.some(
      (error) =>
        !Array.isArray(error) ||
        error.length !== 2 ||
        (error[0] !== 0 && error[0] !== 1) ||
        typeof error[1] !== "string" ||
        error[1].length === 0,
    ) ||
    new Set(providerErrors.map((error) => error[0])).size !== providerErrors.length ||
    !Array.isArray(afterSortTuple) ||
    afterSortTuple.length === 0 ||
    afterSortTuple.some((item) => typeof item !== "string" && typeof item !== "number")
  ) {
    throw new Error("artifact_search cursor has an invalid shape")
  }
  const cursor: CatalogCursor = {
    version: 9,
    searchABIVersion: value[1],
    authoritySHA256,
    filtersSHA256,
    engineCatalogRevisionUpper: value[4],
    snapshotSequenceUpper: value[5],
    catalogTotal: value[6],
    filteredTotal: value[7],
    sourceSnapshots: sourceSnapshots.map((snapshot) => ({
      source: catalogSourceFromCode(snapshot[0]),
      membershipSHA256: expandCursorDigest(snapshot[1])!,
      catalogTotal: snapshot[2],
    })),
    availableSources: ([0, 1] as const)
      .filter((code) => (availableSourceMask & (code === 0 ? 1 : 2)) !== 0)
      .map(catalogSourceFromCode),
    providerErrors: providerErrors.map((error) => ({
      source: catalogSourceFromCode(error[0]),
      message: error[1],
    })),
    afterSortTuple,
  }
  const canonical = encodeCursor(cursor)
  if (canonical !== input) throw new Error("artifact_search cursor is not canonical")
  return cursor
}

function assertEngineCatalogRowIntegrity(row: EngineCatalogRow): void {
  const producer = ArtifactProducerSchema.nullable().safeParse(row.producer)
  if (!producer.success) {
    throw new Error(`Engine Artifact ${row.id} catalog producer metadata is invalid`)
  }
  assertEngineArtifactCatalogIndexIdentity({
    id: row.id,
    artifact_id: row.id,
    task_id: row.taskID,
    kind: row.kind,
    label_index: row.labelIndex,
    time_created: row.timeCreated,
    time_updated: row.timeUpdated,
    payload_sha256: row.payloadSHA256,
    payload_bytes: row.payloadBytes,
    payload_block_index_sha256: row.payloadBlockIndexSHA256,
    catalog_artifact_type: row.artifactType,
    catalog_schema_diagnostic: row.schemaDiagnostic,
    catalog_producer: producer.data,
    catalog_import_source_task_id: row.importSourceTaskID,
    catalog_resource_count: row.resourceCount,
    catalog_resource_media_types: row.resourceMediaTypes,
    catalog_search_text: row.catalogSearchText,
    catalog_search_text_truncated: row.catalogSearchTextTruncated,
    catalog_metadata_sha256: row.catalogMetadataSHA256,
  })
}

const currentEngineCatalogSelection = {
  id: EngineArtifactTable.id,
  taskID: EngineArtifactTable.task_id,
  goalSubject: sql<string | null>`CASE
    WHEN json_valid(${EngineArtifactTable.payload})
    THEN json_extract(${EngineArtifactTable.payload}, '$.goal_id')
    ELSE NULL
  END`,
  kind: EngineArtifactTable.kind,
  label: EngineArtifactTable.label,
  labelIndex: sql<string>`substr(${EngineArtifactTable.label}, 1, ${ENGINE_ARTIFACT_CATALOG_LABEL_INDEX_CODE_POINTS})`,
  payloadSHA256: EngineArtifactTable.payload_sha256,
  payloadBytes: EngineArtifactTable.payload_bytes,
  payloadBlockIndexSHA256: EngineArtifactTable.payload_block_index_sha256,
  artifactType: EngineArtifactTable.catalog_artifact_type,
  schemaDiagnostic: EngineArtifactTable.catalog_schema_diagnostic,
  producer: EngineArtifactTable.catalog_producer,
  importSourceTaskID: EngineArtifactTable.catalog_import_source_task_id,
  resourceCount: EngineArtifactTable.catalog_resource_count,
  resourceMediaTypes: EngineArtifactTable.catalog_resource_media_types,
  catalogSearchText: EngineArtifactTable.catalog_search_text,
  catalogSearchTextTruncated: EngineArtifactTable.catalog_search_text_truncated,
  catalogMetadataSHA256: EngineArtifactTable.catalog_metadata_sha256,
  catalogRevision: EngineArtifactTable.catalog_revision,
  timeCreated: EngineArtifactTable.time_created,
  timeUpdated: EngineArtifactTable.time_updated,
} as const

const priorEngineCatalogSelection = {
  id: EngineArtifactVersionTable.artifact_id,
  taskID: EngineArtifactVersionTable.task_id,
  goalSubject: sql<string | null>`CASE
    WHEN json_valid(${EngineArtifactVersionTable.payload})
    THEN json_extract(${EngineArtifactVersionTable.payload}, '$.goal_id')
    ELSE NULL
  END`,
  kind: EngineArtifactVersionTable.kind,
  label: EngineArtifactVersionTable.label,
  labelIndex: sql<string>`substr(${EngineArtifactVersionTable.label}, 1, ${ENGINE_ARTIFACT_CATALOG_LABEL_INDEX_CODE_POINTS})`,
  payloadSHA256: EngineArtifactVersionTable.payload_sha256,
  payloadBytes: EngineArtifactVersionTable.payload_bytes,
  payloadBlockIndexSHA256: EngineArtifactVersionTable.payload_block_index_sha256,
  artifactType: EngineArtifactVersionTable.catalog_artifact_type,
  schemaDiagnostic: EngineArtifactVersionTable.catalog_schema_diagnostic,
  producer: EngineArtifactVersionTable.catalog_producer,
  importSourceTaskID: EngineArtifactVersionTable.catalog_import_source_task_id,
  resourceCount: EngineArtifactVersionTable.catalog_resource_count,
  resourceMediaTypes: EngineArtifactVersionTable.catalog_resource_media_types,
  catalogSearchText: EngineArtifactVersionTable.catalog_search_text,
  catalogSearchTextTruncated: EngineArtifactVersionTable.catalog_search_text_truncated,
  catalogMetadataSHA256: EngineArtifactVersionTable.catalog_metadata_sha256,
  catalogRevision: EngineArtifactVersionTable.catalog_revision,
  timeCreated: EngineArtifactVersionTable.time_created,
  timeUpdated: EngineArtifactVersionTable.time_updated,
} as const

function latestEngineCatalogRevision(): number {
  return Database.use(
    (db) =>
      db
        .select({ revision: EngineArtifactCatalogRevisionTable.revision })
        .from(EngineArtifactCatalogRevisionTable)
        .orderBy(desc(EngineArtifactCatalogRevisionTable.revision))
        .limit(1)
        .get()?.revision ?? 0,
  )
}

function engineRows(
  taskID: string,
  revisionUpper: number,
  versionScope: ArtifactSearchInput["version_scope"],
): EngineCatalogRow[] {
  const rows = Database.transaction((db) => {
    const current = db
      .select(currentEngineCatalogSelection)
      .from(EngineArtifactTable)
      .where(and(eq(EngineArtifactTable.task_id, taskID), lte(EngineArtifactTable.catalog_revision, revisionUpper)))
      .all()
    const prior = db
      .select(priorEngineCatalogSelection)
      .from(EngineArtifactVersionTable)
      .where(
        and(
          eq(EngineArtifactVersionTable.task_id, taskID),
          lte(EngineArtifactVersionTable.catalog_revision, revisionUpper),
        ),
      )
      .all()
    const all = [...current, ...prior] as EngineCatalogRow[]
    const partitionIdentities = new Set<string>()
    for (const row of all) {
      const identity = `${row.id}\u0000${row.catalogRevision}`
      if (partitionIdentities.has(identity)) {
        throw new Error(
          `Engine Artifact ${row.id} revision ${row.catalogRevision} exists in both current/history catalog partitions`,
        )
      }
      partitionIdentities.add(identity)
    }
    const currentRevisionByArtifact = new Map<string, number>()
    for (const row of all) {
      const selected = currentRevisionByArtifact.get(row.id)
      if (selected === undefined || selected < row.catalogRevision) {
        currentRevisionByArtifact.set(row.id, row.catalogRevision)
      }
    }
    return all.flatMap((row) => {
      const versionState =
        row.catalogRevision === currentRevisionByArtifact.get(row.id) ? ("current" as const) : ("historical" as const)
      if (versionScope === "current" && versionState !== "current") return []
      if (versionScope === "historical" && versionState !== "historical") return []
      return [{ ...row, versionState }]
    })
  })
  for (const row of rows) assertEngineCatalogRowIntegrity(row)
  return rows
}

function engineCandidate(row: EngineCatalogRow): CatalogCandidate {
  const producer = ArtifactProducerSchema.safeParse(row.producer)
  const exactProducer = producer.success ? producer.data : null
  const label = boundedCatalogText(row.label, CATALOG_LABEL_PREVIEW_CHARS)
  const diagnostic = row.schemaDiagnostic
    ? boundedCatalogText(row.schemaDiagnostic, CATALOG_DIAGNOSTIC_PREVIEW_CHARS)
    : undefined
  const resourceMediaTypes = row.resourceMediaTypes.slice(0, CATALOG_ENTRY_MEDIA_TYPE_LIMIT)
  const entry: ArtifactCatalogEntry = {
    source: "engine_artifact",
    locator: {
      source: "engine_artifact",
      artifact_id: row.id,
      catalog_revision: row.catalogRevision,
      expected_sha256: row.payloadSHA256,
    },
    kind: row.kind,
    ...(row.artifactType ? { artifact_type: row.artifactType } : {}),
    ...(diagnostic ? { schema_diagnostic: diagnostic.value } : {}),
    schema_diagnostic_truncated: diagnostic?.truncated ?? false,
    label: label.value,
    label_truncated: label.truncated,
    goal_id: row.goalSubject,
    import_source_task_id: row.importSourceTaskID,
    producer: exactProducer,
    created_at_ms: row.timeCreated,
    updated_at_ms: row.timeUpdated,
    bytes: row.payloadBytes,
    sha256: row.payloadSHA256,
    resource_count: row.resourceCount,
    resource_media_types: resourceMediaTypes,
    resource_media_types_truncated: resourceMediaTypes.length < row.resourceMediaTypes.length,
    version: {
      state: row.versionState ?? "current",
      catalog_revision: row.catalogRevision,
    },
  }
  const searchable = [row.id, row.kind, row.label, row.catalogSearchText]
    .filter((value): value is string => typeof value === "string")
    .join("\n")
    .normalize("NFKC")
    .toLowerCase()
  return {
    entry,
    exactLabel: row.label,
    stableID: `${row.id}\u0000${row.catalogRevision}\u0000${row.payloadSHA256}`,
    identitySearchText: `${row.id}\n${row.payloadSHA256}`.normalize("NFKC").toLowerCase(),
    labelSearchText: row.label.normalize("NFKC").toLowerCase(),
    searchText: searchable,
    resourceMediaTypes: row.resourceMediaTypes,
    engineCatalogRevision: row.catalogRevision,
    snapshotSequence: null,
    searchMetadataTruncated: row.catalogSearchTextTruncated,
  }
}

function boundedCatalogText(value: string, maxChars: number): { value: string; truncated: boolean } {
  if (value.length <= maxChars) return { value, truncated: false }
  return { value: value.slice(0, maxChars), truncated: true }
}

function sortedMediaTypes(resources: readonly TaskArtifactRef[]): string[] {
  return [...new Set(resources.map((resource) => resource.media_type))].sort(compareCodeUnits)
}

function snapshotCandidate(record: TaskArtifactSnapshotRecord): CatalogCandidate {
  const resources = taskArtifactSnapshotResourceRefs(record)
  const mediaTypes = sortedMediaTypes(resources)
  const label = boundedCatalogText(`Task Artifact snapshot ${record.identity.snapshot_id}`, CATALOG_LABEL_PREVIEW_CHARS)
  const entry: ArtifactCatalogEntry = {
    source: "task_artifact",
    locator: { source: "task_artifact_snapshot", snapshot: record.identity },
    kind: "task_artifact_snapshot",
    schema_diagnostic_truncated: false,
    label: label.value,
    label_truncated: label.truncated,
    goal_id: null,
    import_source_task_id: null,
    producer: record.manifest.producer,
    created_at_ms: record.manifest.created_at_ms,
    bytes: record.manifestBytes.byteLength,
    sha256: record.identity.manifest_sha256,
    resource_count: resources.length,
    resource_media_types: mediaTypes.slice(0, CATALOG_ENTRY_MEDIA_TYPE_LIMIT),
    resource_media_types_truncated: mediaTypes.length > CATALOG_ENTRY_MEDIA_TYPE_LIMIT,
    version: {
      state: "immutable",
      publication_sequence: record.manifest.publication_sequence,
    },
  }
  const fullSearchable = [
    record.identity.snapshot_id,
    entry.kind,
    entry.label,
    ...(record.manifest.producer.owner_kind === "mission"
      ? [record.manifest.producer.mission_id, record.manifest.producer.session_id]
      : record.manifest.producer.owner_kind === "core"
        ? [record.manifest.producer.component_id, record.manifest.producer.operation_id]
        : [
            record.manifest.producer.agent_id,
            record.manifest.producer.expert_squad_id,
            record.manifest.producer.session_id,
          ]),
    ...resources.flatMap((resource) => [resource.tree, resource.path, resource.media_type]),
  ]
    .join("\n")
    .normalize("NFKC")
    .toLowerCase()
  const searchable = boundedCatalogText(fullSearchable, 32 * 1024)
  return {
    entry,
    exactLabel: label.value,
    stableID: `${record.identity.snapshot_id}\u0000${record.manifest.publication_sequence}\u0000${record.identity.manifest_sha256}`,
    identitySearchText: `${record.identity.snapshot_id}\n${record.identity.manifest_sha256}`
      .normalize("NFKC")
      .toLowerCase(),
    labelSearchText: entry.label.normalize("NFKC").toLowerCase(),
    searchText: searchable.value,
    resourceMediaTypes: mediaTypes,
    engineCatalogRevision: null,
    snapshotSequence: record.manifest.publication_sequence,
    searchMetadataTruncated: searchable.truncated,
  }
}

function resourceCandidate(record: TaskArtifactSnapshotRecord, resource: TaskArtifactRef): CatalogCandidate {
  const label = boundedCatalogText(resource.path, CATALOG_LABEL_PREVIEW_CHARS)
  const entry: ArtifactCatalogEntry = {
    source: "task_artifact",
    locator: { source: "task_artifact_resource", ref: resource },
    kind: "task_artifact_resource",
    schema_diagnostic_truncated: false,
    label: label.value,
    label_truncated: label.truncated,
    goal_id: null,
    import_source_task_id: null,
    producer: record.manifest.producer,
    created_at_ms: record.manifest.created_at_ms,
    bytes: resource.bytes,
    sha256: resource.sha256,
    resource_count: 1,
    resource_media_types: [resource.media_type],
    resource_media_types_truncated: false,
    version: {
      state: "immutable",
      publication_sequence: record.manifest.publication_sequence,
    },
  }
  const fullIdentity = [
    record.identity.snapshot_id,
    record.identity.manifest_sha256,
    resource.tree,
    resource.path,
    resource.media_type,
    resource.bytes,
    resource.sha256,
  ]
  const identitySearchText = fullIdentity.join("\n").normalize("NFKC").toLowerCase()
  return {
    entry,
    exactLabel: resource.path,
    stableID: `${record.manifest.publication_sequence}\u0000${fullIdentity.join("\u0000")}`,
    identitySearchText,
    labelSearchText: entry.label.normalize("NFKC").toLowerCase(),
    searchText: [entry.kind, resource.tree, resource.path, resource.media_type, resource.sha256]
      .join("\n")
      .normalize("NFKC")
      .toLowerCase(),
    resourceMediaTypes: [resource.media_type],
    engineCatalogRevision: null,
    snapshotSequence: record.manifest.publication_sequence,
    searchMetadataTruncated: false,
  }
}

function snapshotCandidates(record: TaskArtifactSnapshotRecord): CatalogCandidate[] {
  return [
    snapshotCandidate(record),
    ...taskArtifactSnapshotResourceRefs(record).map((resource) => resourceCandidate(record, resource)),
  ]
}

const MATCH_MODE_RANK: Record<NonNullable<ArtifactCatalogEntry["match"]>["tier"], number> = {
  exact_identity: 0,
  exact_label: 1,
  exact_metadata_value: 2,
  label_prefix: 3,
  label_substring: 4,
  metadata_substring: 5,
  fuzzy_label: 6,
  fuzzy_metadata: 7,
}

function candidateMatch(
  candidate: CatalogCandidate,
  query: NonNullable<ArtifactSearchInput["query"]>,
): NonNullable<ArtifactCatalogEntry["match"]> | undefined {
  const needle = query.text.normalize("NFKC").toLowerCase()
  if (candidate.identitySearchText.split("\n").includes(needle)) {
    return { tier: "exact_identity", matched_fields: ["identity"] }
  }
  if (candidate.labelSearchText === needle) {
    return { tier: "exact_label", matched_fields: ["label"] }
  }
  if (candidate.searchText.split("\n").includes(needle)) {
    return { tier: "exact_metadata_value", matched_fields: ["metadata"] }
  }
  if (candidate.labelSearchText.startsWith(needle)) {
    return { tier: "label_prefix", matched_fields: ["label"] }
  }
  if (candidate.labelSearchText.includes(needle)) {
    return { tier: "label_substring", matched_fields: ["label"] }
  }
  if (candidate.searchText.includes(needle)) {
    return { tier: "metadata_substring", matched_fields: ["metadata"] }
  }
  if (query.mode !== "fuzzy") return undefined
  const label = fuzzysort.single(needle, candidate.labelSearchText)
  if (label && label.score >= ARTIFACT_FUZZY_SCORE_MINIMUM) {
    return { tier: "fuzzy_label", score: label.score, matched_fields: ["label"] }
  }
  const metadata = fuzzysort.single(needle, candidate.searchText)
  if (metadata && metadata.score >= ARTIFACT_FUZZY_SCORE_MINIMUM) {
    return { tier: "fuzzy_metadata", score: metadata.score, matched_fields: ["metadata"] }
  }
  return undefined
}

function candidateTime(candidate: CatalogCandidate): number {
  return candidate.entry.updated_at_ms ?? candidate.entry.created_at_ms
}

function compareStableIdentity(left: CatalogCandidate, right: CatalogCandidate): number {
  return (
    CATALOG_SOURCE_ORDER[left.entry.source] - CATALOG_SOURCE_ORDER[right.entry.source] ||
    compareCodeUnits(left.stableID, right.stableID)
  )
}

function compareCandidates(
  left: CatalogCandidate,
  right: CatalogCandidate,
  sort: NonNullable<ArtifactSearchInput["sort"]>,
): number {
  if (sort === "relevance") {
    const leftMatch = left.match
    const rightMatch = right.match
    return (
      (leftMatch ? MATCH_MODE_RANK[leftMatch.tier] : Number.MAX_SAFE_INTEGER) -
        (rightMatch ? MATCH_MODE_RANK[rightMatch.tier] : Number.MAX_SAFE_INTEGER) ||
      (rightMatch?.score ?? 0) - (leftMatch?.score ?? 0) ||
      candidateTime(right) - candidateTime(left) ||
      compareStableIdentity(left, right)
    )
  }
  if (sort === "name") {
    return (
      compareCodeUnits(
        left.exactLabel.normalize("NFKC").toLowerCase(),
        right.exactLabel.normalize("NFKC").toLowerCase(),
      ) ||
      compareCodeUnits(left.exactLabel, right.exactLabel) ||
      candidateTime(right) - candidateTime(left) ||
      compareStableIdentity(left, right)
    )
  }
  return (
    (sort === "oldest" ? candidateTime(left) - candidateTime(right) : candidateTime(right) - candidateTime(left)) ||
    compareStableIdentity(left, right)
  )
}

function candidateSortTuple(
  candidate: CatalogCandidate,
  sort: NonNullable<ArtifactSearchInput["sort"]>,
): readonly (string | number)[] {
  const stableTail = [CATALOG_SOURCE_ORDER[candidate.entry.source], candidate.stableID] as const
  if (sort === "relevance") {
    return [
      candidate.match ? MATCH_MODE_RANK[candidate.match.tier] : Number.MAX_SAFE_INTEGER,
      -(candidate.match?.score ?? 0),
      -candidateTime(candidate),
      ...stableTail,
    ]
  }
  if (sort === "name") {
    return [
      candidate.exactLabel.normalize("NFKC").toLowerCase(),
      candidate.exactLabel,
      -candidateTime(candidate),
      ...stableTail,
    ]
  }
  return [sort === "oldest" ? candidateTime(candidate) : -candidateTime(candidate), ...stableTail]
}

function sourceSnapshot(
  source: ArtifactCatalogEntry["source"],
  candidates: readonly CatalogCandidate[],
): CatalogSourceSnapshot {
  const membership = candidates
    .filter((candidate) => candidate.entry.source === source)
    .sort((left, right) => compareCodeUnits(left.stableID, right.stableID))
    .map((candidate) => ({
      entry: candidate.entry,
      engine_catalog_revision: candidate.engineCatalogRevision,
      snapshot_sequence: candidate.snapshotSequence,
      search_text: candidate.searchText,
      resource_media_types: candidate.resourceMediaTypes,
      search_metadata_truncated: candidate.searchMetadataTruncated,
    }))
  return {
    source,
    membershipSHA256: sha256(stableJSON(membership)),
    catalogTotal: membership.length,
  }
}

function matchesFilters(candidate: CatalogCandidate, input: ArtifactSearchInput): boolean {
  const entry = candidate.entry
  if (input.sources && !input.sources.includes(entry.source)) return false
  if (input.kinds && !input.kinds.includes(entry.kind)) return false
  if (input.labels && !input.labels.includes(candidate.exactLabel)) return false
  if (input.artifact_types && (!entry.artifact_type || !input.artifact_types.includes(entry.artifact_type))) {
    return false
  }
  if (
    input.import_source_task_ids &&
    (!entry.import_source_task_id || !input.import_source_task_ids.includes(entry.import_source_task_id))
  ) {
    return false
  }
  if (input.media_types && !input.media_types.some((mediaType) => candidate.resourceMediaTypes.includes(mediaType))) {
    return false
  }
  if (input.goal_ids && (!entry.goal_id || !input.goal_ids.includes(entry.goal_id))) return false
  if (
    input.producer_agent_ids &&
    (!entry.producer ||
      (entry.producer.owner_kind !== "projected-scheduler" && entry.producer.owner_kind !== "projected-worker") ||
      !input.producer_agent_ids.includes(entry.producer.agent_id))
  ) {
    return false
  }
  if (
    input.producer_squad_ids &&
    (!entry.producer ||
      (entry.producer.owner_kind !== "projected-scheduler" && entry.producer.owner_kind !== "projected-worker") ||
      !input.producer_squad_ids.includes(entry.producer.expert_squad_id))
  ) {
    return false
  }
  if (
    input.producer_session_ids &&
    (!entry.producer ||
      entry.producer.owner_kind === "core" ||
      !input.producer_session_ids.includes(entry.producer.session_id))
  ) {
    return false
  }
  if (input.created_at_or_after_ms !== undefined && entry.created_at_ms < input.created_at_or_after_ms) {
    return false
  }
  if (input.created_before_ms !== undefined && entry.created_at_ms >= input.created_before_ms) return false
  return true
}

function sortedUnique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort(compareCodeUnits)
}

function facets(candidates: readonly CatalogCandidate[]): ArtifactSearchPage["facets"] {
  const times = candidates.map((candidate) => candidate.entry.created_at_ms)
  const sources = sortedUnique(candidates.map((candidate) => candidate.entry.source))
  const kinds = sortedUnique(candidates.map((candidate) => candidate.entry.kind))
  const artifactTypes = sortedUnique(
    candidates.flatMap((candidate) => (candidate.entry.artifact_type ? [candidate.entry.artifact_type] : [])),
  )
  const producerAgentIDs = sortedUnique(
    candidates.flatMap((candidate) =>
      candidate.entry.producer &&
      (candidate.entry.producer.owner_kind === "projected-scheduler" ||
        candidate.entry.producer.owner_kind === "projected-worker")
        ? [candidate.entry.producer.agent_id]
        : [],
    ),
  )
  const producerSquadIDs = sortedUnique(
    candidates.flatMap((candidate) =>
      candidate.entry.producer &&
      (candidate.entry.producer.owner_kind === "projected-scheduler" ||
        candidate.entry.producer.owner_kind === "projected-worker")
        ? [candidate.entry.producer.expert_squad_id]
        : [],
    ),
  )
  const producerSessionIDs = sortedUnique(
    candidates.flatMap((candidate) =>
      candidate.entry.producer && candidate.entry.producer.owner_kind !== "core"
        ? [candidate.entry.producer.session_id]
        : [],
    ),
  )
  const goalIDs = sortedUnique(
    candidates.flatMap((candidate) => (candidate.entry.goal_id ? [candidate.entry.goal_id] : [])),
  )
  const importSourceTaskIDs = sortedUnique(
    candidates.flatMap((candidate) =>
      candidate.entry.import_source_task_id ? [candidate.entry.import_source_task_id] : [],
    ),
  )
  const mediaTypes = sortedUnique(candidates.flatMap((candidate) => candidate.resourceMediaTypes))
  const lists = [
    sources,
    kinds,
    artifactTypes,
    producerAgentIDs,
    producerSquadIDs,
    producerSessionIDs,
    goalIDs,
    importSourceTaskIDs,
    mediaTypes,
  ]
  return {
    sources: sources.slice(0, CATALOG_FACET_VALUE_LIMIT) as ArtifactSearchPage["facets"]["sources"],
    kinds: kinds.slice(0, CATALOG_FACET_VALUE_LIMIT),
    artifact_types: artifactTypes.slice(0, CATALOG_FACET_VALUE_LIMIT),
    producer_agent_ids: producerAgentIDs.slice(0, CATALOG_FACET_VALUE_LIMIT),
    producer_squad_ids: producerSquadIDs.slice(0, CATALOG_FACET_VALUE_LIMIT),
    producer_session_ids: producerSessionIDs.slice(0, CATALOG_FACET_VALUE_LIMIT),
    goal_ids: goalIDs.slice(0, CATALOG_FACET_VALUE_LIMIT),
    import_source_task_ids: importSourceTaskIDs.slice(0, CATALOG_FACET_VALUE_LIMIT),
    media_types: mediaTypes.slice(0, CATALOG_FACET_VALUE_LIMIT) as ArtifactSearchPage["facets"]["media_types"],
    created_at_min_ms: times.length > 0 ? Math.min(...times) : null,
    created_at_max_ms: times.length > 0 ? Math.max(...times) : null,
    truncated:
      lists.some((values) => values.length > CATALOG_FACET_VALUE_LIMIT) ||
      candidates.some((candidate) => candidate.entry.resource_media_types_truncated),
  }
}

function unmatchedValues(requested: readonly string[] | undefined, available: readonly string[]): string[] {
  if (!requested) return []
  const values = new Set(available)
  return requested.filter((value) => !values.has(value))
}

function searchResolution(input: {
  parsed: ArtifactSearchInput
  candidates: readonly CatalogCandidate[]
  queryCandidates: readonly CatalogCandidate[]
  filteredTotal: number
  providerErrors: ArtifactSearchPage["provider_errors"]
}): ArtifactSearchPage["resolution"] {
  const available = {
    sources: sortedUnique(input.candidates.map((candidate) => candidate.entry.source)),
    kinds: sortedUnique(input.candidates.map((candidate) => candidate.entry.kind)),
    artifact_types: sortedUnique(
      input.candidates.flatMap((candidate) => (candidate.entry.artifact_type ? [candidate.entry.artifact_type] : [])),
    ),
    labels: sortedUnique(input.candidates.map((candidate) => candidate.exactLabel)),
    producer_agent_ids: sortedUnique(
      input.candidates.flatMap((candidate) =>
        candidate.entry.producer &&
        (candidate.entry.producer.owner_kind === "projected-scheduler" ||
          candidate.entry.producer.owner_kind === "projected-worker")
          ? [candidate.entry.producer.agent_id]
          : [],
      ),
    ),
    producer_squad_ids: sortedUnique(
      input.candidates.flatMap((candidate) =>
        candidate.entry.producer &&
        (candidate.entry.producer.owner_kind === "projected-scheduler" ||
          candidate.entry.producer.owner_kind === "projected-worker")
          ? [candidate.entry.producer.expert_squad_id]
          : [],
      ),
    ),
    producer_session_ids: sortedUnique(
      input.candidates.flatMap((candidate) =>
        candidate.entry.producer && candidate.entry.producer.owner_kind !== "core"
          ? [candidate.entry.producer.session_id]
          : [],
      ),
    ),
    goal_ids: sortedUnique(
      input.candidates.flatMap((candidate) => (candidate.entry.goal_id ? [candidate.entry.goal_id] : [])),
    ),
    import_source_task_ids: sortedUnique(
      input.candidates.flatMap((candidate) =>
        candidate.entry.import_source_task_id ? [candidate.entry.import_source_task_id] : [],
      ),
    ),
    media_types: sortedUnique(input.candidates.flatMap((candidate) => candidate.resourceMediaTypes)),
  }
  const limitations: ArtifactSearchPage["resolution"]["limitations"] = [
    ...(input.providerErrors.length > 0 ? ["provider_error" as const] : []),
    ...(input.parsed.query && input.queryCandidates.some((candidate) => candidate.searchMetadataTruncated)
      ? ["metadata_truncated" as const]
      : []),
  ]
  const unmatchedFilters = {
    sources: unmatchedValues(
      input.parsed.sources,
      available.sources,
    ) as ArtifactSearchPage["resolution"]["unmatched_filters"]["sources"],
    kinds: unmatchedValues(input.parsed.kinds, available.kinds),
    artifact_types: unmatchedValues(
      input.parsed.artifact_types,
      available.artifact_types,
    ) as ArtifactSearchPage["resolution"]["unmatched_filters"]["artifact_types"],
    labels: unmatchedValues(input.parsed.labels, available.labels),
    producer_agent_ids: unmatchedValues(input.parsed.producer_agent_ids, available.producer_agent_ids),
    producer_squad_ids: unmatchedValues(input.parsed.producer_squad_ids, available.producer_squad_ids),
    producer_session_ids: unmatchedValues(input.parsed.producer_session_ids, available.producer_session_ids),
    goal_ids: unmatchedValues(input.parsed.goal_ids, available.goal_ids),
    import_source_task_ids: unmatchedValues(input.parsed.import_source_task_ids, available.import_source_task_ids),
    media_types: unmatchedValues(
      input.parsed.media_types,
      available.media_types,
    ) as ArtifactSearchPage["resolution"]["unmatched_filters"]["media_types"],
  }
  const anyUnmatched = Object.values(unmatchedFilters).some((values) => values.length > 0)
  return {
    status:
      input.filteredTotal >= 2
        ? "ambiguous_candidates"
        : limitations.length > 0
          ? "incomplete_catalog"
          : input.filteredTotal === 0
            ? "no_match"
            : "unique_candidate",
    candidate_count: input.filteredTotal,
    unmatched_filters: unmatchedFilters,
    filter_intersection_empty: input.filteredTotal === 0 && !anyUnmatched,
    limitations,
  }
}

export function artifactCatalogAuthority(taskID: string): TaskArtifactReadAuthority {
  const task = requireTask(taskID)
  return {
    projectID: task.project_id,
    projectDirectory: taskPrimaryProjectRoot(taskID, { activeProjectID: task.project_id }),
    taskID,
  }
}

export async function searchTaskArtifacts(input: {
  authority: TaskArtifactReadAuthority
  search: ArtifactSearchRequest
}): Promise<ArtifactSearchPage> {
  const parsed = normalizedSearchInput(ArtifactSearchInputSchema.parse(input.search))
  const filterSHA256 = filterDigest(parsed)
  const scopeSHA256 = authorityDigest(input.authority)
  const requestedSources: ArtifactCatalogEntry["source"][] = [
    ...(parsed.sources ?? ["engine_artifact", "task_artifact"]),
  ].sort(compareCodeUnits)
  const cursor = parsed.cursor ? decodeCursor(parsed.cursor) : undefined
  if (cursor && cursor.authoritySHA256 !== scopeSHA256) {
    throw new Error("artifact_search cursor belongs to another Task authority")
  }
  if (cursor && cursor.filtersSHA256 !== filterSHA256) {
    throw new Error("artifact_search cursor does not belong to the supplied filters")
  }
  if (cursor) {
    const cursorSources = [...cursor.availableSources, ...cursor.providerErrors.map((error) => error.source)].sort(
      compareCodeUnits,
    )
    if (
      cursorSources.length !== requestedSources.length ||
      cursorSources.some((source, index) => source !== requestedSources[index])
    ) {
      throw new Error("artifact_search cursor provider state does not belong to the supplied filters")
    }
  }
  const previousProviderErrors = cursor?.providerErrors ?? []
  const activeSources = cursor?.availableSources ?? requestedSources
  const engineCatalogRevisionUpper = cursor?.engineCatalogRevisionUpper ?? latestEngineCatalogRevision()
  const providerResults = await Promise.all(
    activeSources.map(async (source) => {
      try {
        return source === "engine_artifact"
          ? ({
              source,
              engine: engineRows(input.authority.taskID, engineCatalogRevisionUpper, parsed.version_scope),
              snapshots: [],
            } as const)
          : ({
              source,
              engine: [],
              snapshots: parsed.version_scope === "historical" ? [] : await listTaskArtifactSnapshots(input.authority),
            } as const)
      } catch (cause) {
        const rawMessage = cause instanceof Error ? cause.message : String(cause)
        const message = rawMessage.length > 2_048 ? `${rawMessage.slice(0, 2_045)}...` : rawMessage
        return { source, error: message || "Unknown Artifact catalog provider error" } as const
      }
    }),
  )
  const providerReadErrors: ArtifactSearchPage["provider_errors"] = providerResults.flatMap((result) => {
    if (!("error" in result)) return []
    return [{ source: result.source, message: result.error ?? "Unknown Artifact catalog provider error" }]
  })
  const engine: EngineCatalogRow[] = []
  const snapshots: TaskArtifactSnapshotRecord[] = []
  for (const result of providerResults) {
    if ("error" in result) continue
    engine.push(...result.engine)
    snapshots.push(...result.snapshots.filter((record) => record.manifest.snapshot_kind === "catalog"))
  }
  const allCandidates = [...engine.map(engineCandidate), ...snapshots.flatMap(snapshotCandidates)]
  const snapshotSequenceUpper =
    cursor?.snapshotSequenceUpper ?? Math.max(0, ...snapshots.map((record) => record.manifest.publication_sequence))
  const frozenCandidates = allCandidates.filter(
    (candidate) => candidate.snapshotSequence === null || candidate.snapshotSequence <= snapshotSequenceUpper,
  )
  const initialSourceSnapshots = requestedSources
    .filter((source) => !providerReadErrors.some((error) => error.source === source))
    .map((source) => sourceSnapshot(source, frozenCandidates))
  const expectedSourceSnapshots = cursor?.sourceSnapshots ?? initialSourceSnapshots
  const membershipDriftErrors: ArtifactSearchPage["provider_errors"] = cursor
    ? providerResults.flatMap((result) => {
        if ("error" in result) return []
        const expected = expectedSourceSnapshots.find((snapshot) => snapshot.source === result.source)
        const current = sourceSnapshot(result.source, frozenCandidates)
        if (
          expected &&
          expected.catalogTotal === current.catalogTotal &&
          expected.membershipSHA256 === current.membershipSHA256
        ) {
          return []
        }
        return [
          {
            source: result.source,
            message:
              "Stable Artifact catalog membership changed during cursor pagination; start a new artifact_search.",
          },
        ]
      })
    : []
  const currentProviderErrors = [...providerReadErrors, ...membershipDriftErrors]
  const providerErrors = [...previousProviderErrors, ...currentProviderErrors].sort(
    (left, right) => CATALOG_SOURCE_ORDER[left.source] - CATALOG_SOURCE_ORDER[right.source],
  )
  const availableSources = providerResults
    .filter((result) => !("error" in result) && !membershipDriftErrors.some((error) => error.source === result.source))
    .map((result) => result.source)
    .sort((left, right) => CATALOG_SOURCE_ORDER[left] - CATALOG_SOURCE_ORDER[right])
  const stableCandidates = frozenCandidates.filter((candidate) => availableSources.includes(candidate.entry.source))
  const structuredFiltered = stableCandidates.filter((candidate) => matchesFilters(candidate, parsed))
  const filtered = structuredFiltered
    .flatMap((candidate) => {
      if (!parsed.query) return [candidate]
      const match = candidateMatch(candidate, parsed.query)
      return match ? [{ ...candidate, match }] : []
    })
    .sort((left, right) => compareCandidates(left, right, parsed.sort!))
  const catalogTotal = cursor?.catalogTotal ?? frozenCandidates.length
  const filteredTotal = cursor?.filteredTotal ?? filtered.length
  const afterIndex = cursor
    ? filtered.findIndex(
        (candidate) => stableJSON(candidateSortTuple(candidate, parsed.sort!)) === stableJSON(cursor.afterSortTuple),
      )
    : -1
  if (cursor && afterIndex < 0 && membershipDriftErrors.length === 0) {
    throw new Error("artifact_search cursor candidate is absent from the frozen filtered catalog")
  }
  const afterFiltered =
    cursor && membershipDriftErrors.length > 0 ? [] : cursor ? filtered.slice(afterIndex + 1) : filtered
  const pageCandidates = afterFiltered.slice(0, parsed.limit)
  const hasMore = afterFiltered.length > pageCandidates.length
  const last = pageCandidates.at(-1)
  const { cursor: _cursor, ...appliedFilters } = parsed
  const facetValues = facets(stableCandidates)
  const metadataTruncated =
    facetValues.truncated ||
    stableCandidates.some(
      (candidate) =>
        candidate.entry.label_truncated ||
        candidate.entry.schema_diagnostic_truncated ||
        candidate.entry.resource_media_types_truncated ||
        candidate.searchMetadataTruncated,
    )
  return {
    entries: pageCandidates.map((candidate) => ({
      ...candidate.entry,
      ...(candidate.match ? { match: candidate.match } : {}),
    })),
    next_cursor:
      hasMore && last
        ? encodeCursor({
            version: 9,
            searchABIVersion: ARTIFACT_SEARCH_ABI_VERSION,
            authoritySHA256: scopeSHA256,
            filtersSHA256: filterSHA256,
            engineCatalogRevisionUpper,
            snapshotSequenceUpper,
            catalogTotal,
            filteredTotal,
            sourceSnapshots: expectedSourceSnapshots,
            availableSources,
            providerErrors,
            afterSortTuple: candidateSortTuple(last, parsed.sort!),
          })
        : null,
    catalog_total: catalogTotal,
    filtered_total: filteredTotal,
    catalog_complete: providerErrors.length === 0,
    metadata_truncated: metadataTruncated,
    provider_errors: providerErrors,
    applied_filters: appliedFilters,
    facets: facetValues,
    resolution: searchResolution({
      parsed,
      candidates: stableCandidates,
      queryCandidates: structuredFiltered,
      filteredTotal,
      providerErrors,
    }),
  }
}

function utf8Chunk(input: { bytes: Uint8Array; offset: number; maxBytes: number; context: string }): {
  text: string
  byteEnd: number
} {
  if (input.offset > input.bytes.byteLength) {
    throw new Error(`${input.context}: byte_offset ${input.offset} exceeds ${input.bytes.byteLength}`)
  }
  const fatalDecoder = new TextDecoder("utf-8", { fatal: true })
  if (input.offset === input.bytes.byteLength) {
    return { text: "", byteEnd: input.offset }
  }
  try {
    fatalDecoder.decode(input.bytes.subarray(0, input.offset))
  } catch (cause) {
    throw new Error(`${input.context}: byte_offset ${input.offset} is not a UTF-8 boundary`, { cause })
  }
  let end = Math.min(input.bytes.byteLength, input.offset + input.maxBytes)
  while (end > input.offset) {
    try {
      return {
        text: fatalDecoder.decode(input.bytes.subarray(input.offset, end)),
        byteEnd: end,
      }
    } catch {
      end--
    }
  }
  throw new Error(
    `${input.context}: max_bytes ${input.maxBytes} cannot contain the complete UTF-8 code point at byte_offset ${input.offset}`,
  )
}

function textReadResult(input: {
  locator: ArtifactReadInput["locator"]
  bytes: Uint8Array
  mediaType: string
  byteOffset: number
  maxBytes: number
  context: string
}): ArtifactReadResult {
  const page = utf8Chunk({
    bytes: input.bytes,
    offset: input.byteOffset,
    maxBytes: input.maxBytes,
    context: input.context,
  })
  const complete = page.byteEnd === input.bytes.byteLength
  return {
    chunk: {
      locator: input.locator,
      media_type: input.mediaType,
      byte_start: input.byteOffset,
      byte_end: page.byteEnd,
      next_offset: complete ? null : page.byteEnd,
      total_bytes: input.bytes.byteLength,
      complete,
      sha256: sha256(input.bytes),
      text: page.text,
      attachment: false,
    },
  }
}

function exactEngineRow(artifactID: string): ExactEngineRow {
  const row = Database.use((db) =>
    db
      .select({
        id: EngineArtifactTable.id,
        taskID: EngineArtifactTable.task_id,
        kind: EngineArtifactTable.kind,
        label: sql<string>`substr(${EngineArtifactTable.label}, 1, ${ENGINE_ARTIFACT_CATALOG_LABEL_INDEX_CODE_POINTS})`,
        payloadSHA256: EngineArtifactTable.payload_sha256,
        payloadBytes: EngineArtifactTable.payload_bytes,
        payloadBlockIndexSHA256: EngineArtifactTable.payload_block_index_sha256,
        artifactType: EngineArtifactTable.catalog_artifact_type,
        schemaDiagnostic: EngineArtifactTable.catalog_schema_diagnostic,
        producer: EngineArtifactTable.catalog_producer,
        importSourceTaskID: EngineArtifactTable.catalog_import_source_task_id,
        resourceCount: EngineArtifactTable.catalog_resource_count,
        resourceMediaTypes: EngineArtifactTable.catalog_resource_media_types,
        catalogSearchText: EngineArtifactTable.catalog_search_text,
        catalogSearchTextTruncated: EngineArtifactTable.catalog_search_text_truncated,
        catalogMetadataSHA256: EngineArtifactTable.catalog_metadata_sha256,
        catalogRevision: EngineArtifactTable.catalog_revision,
        timeCreated: EngineArtifactTable.time_created,
        timeUpdated: EngineArtifactTable.time_updated,
      })
      .from(EngineArtifactTable)
      .where(eq(EngineArtifactTable.id, artifactID))
      .get(),
  )
  if (!row) throw new Error(`artifact_read: Engine Artifact ${artifactID} does not exist`)
  assertExactEngineIndex(row)
  return row
}

function assertExactEngineIndex(row: ExactEngineRow): void {
  const producer = ArtifactProducerSchema.nullable().safeParse(row.producer)
  if (!producer.success) {
    throw new Error(`Engine Artifact ${row.id} catalog producer metadata is invalid`)
  }
  assertEngineArtifactCatalogIndexIdentity({
    id: row.id,
    artifact_id: row.id,
    task_id: row.taskID,
    kind: row.kind,
    label_index: row.label,
    time_created: row.timeCreated,
    time_updated: row.timeUpdated,
    payload_sha256: row.payloadSHA256,
    payload_bytes: row.payloadBytes,
    payload_block_index_sha256: row.payloadBlockIndexSHA256,
    catalog_artifact_type: row.artifactType,
    catalog_schema_diagnostic: row.schemaDiagnostic,
    catalog_producer: producer.data,
    catalog_import_source_task_id: row.importSourceTaskID,
    catalog_resource_count: row.resourceCount,
    catalog_resource_media_types: row.resourceMediaTypes,
    catalog_search_text: row.catalogSearchText,
    catalog_search_text_truncated: row.catalogSearchTextTruncated,
    catalog_metadata_sha256: row.catalogMetadataSHA256,
  })
}

export function exactEngineArtifactLocator(input: {
  taskID: string
  artifactID: string
}): Extract<ArtifactReadInput["locator"], { source: "engine_artifact" }> {
  const row = exactEngineRow(input.artifactID)
  if (row.taskID !== input.taskID) {
    throw new Error(`artifact locator: Engine Artifact ${row.id} belongs to another Task`)
  }
  return {
    source: "engine_artifact",
    artifact_id: row.id,
    catalog_revision: row.catalogRevision,
    expected_sha256: row.payloadSHA256,
  }
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
    const prior = db
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
    return prior
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

type ExactEngineArtifactReadIndex = Readonly<{
  id: string
  taskID: string
  kind: EngineArtifactKind
  label: string
  payloadSHA256: string
  payloadBytes: number
  payloadBlockIndexSHA256: string
  artifactType: string | null
  schemaDiagnostic: string | null
  producer: unknown
  importSourceTaskID: string | null
  resourceCount: number
  resourceMediaTypes: string[]
  catalogSearchText: string
  catalogSearchTextTruncated: boolean
  catalogMetadataSHA256: string
  catalogRevision: number
  timeCreated: number
  timeUpdated: number
  partition: "current" | "history"
}>

function exactEngineArtifactReadIndex(input: {
  db: Database.TxOrDb
  taskID: string
  artifactID: string
  catalogRevision: number
  expectedSHA256: string
}): ExactEngineArtifactReadIndex {
  const current = input.db
    .select({
      id: EngineArtifactTable.id,
      taskID: EngineArtifactTable.task_id,
      kind: EngineArtifactTable.kind,
      label: EngineArtifactTable.label,
      payloadSHA256: EngineArtifactTable.payload_sha256,
      payloadBytes: EngineArtifactTable.payload_bytes,
      payloadBlockIndexSHA256: EngineArtifactTable.payload_block_index_sha256,
      artifactType: EngineArtifactTable.catalog_artifact_type,
      schemaDiagnostic: EngineArtifactTable.catalog_schema_diagnostic,
      producer: EngineArtifactTable.catalog_producer,
      importSourceTaskID: EngineArtifactTable.catalog_import_source_task_id,
      resourceCount: EngineArtifactTable.catalog_resource_count,
      resourceMediaTypes: EngineArtifactTable.catalog_resource_media_types,
      catalogSearchText: EngineArtifactTable.catalog_search_text,
      catalogSearchTextTruncated: EngineArtifactTable.catalog_search_text_truncated,
      catalogMetadataSHA256: EngineArtifactTable.catalog_metadata_sha256,
      catalogRevision: EngineArtifactTable.catalog_revision,
      timeCreated: EngineArtifactTable.time_created,
      timeUpdated: EngineArtifactTable.time_updated,
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
  const selected = current
    ? ({ ...current, partition: "current" } as const)
    : (() => {
        const history = input.db
          .select({
            id: EngineArtifactVersionTable.artifact_id,
            taskID: EngineArtifactVersionTable.task_id,
            kind: EngineArtifactVersionTable.kind,
            label: EngineArtifactVersionTable.label,
            payloadSHA256: EngineArtifactVersionTable.payload_sha256,
            payloadBytes: EngineArtifactVersionTable.payload_bytes,
            payloadBlockIndexSHA256: EngineArtifactVersionTable.payload_block_index_sha256,
            artifactType: EngineArtifactVersionTable.catalog_artifact_type,
            schemaDiagnostic: EngineArtifactVersionTable.catalog_schema_diagnostic,
            producer: EngineArtifactVersionTable.catalog_producer,
            importSourceTaskID: EngineArtifactVersionTable.catalog_import_source_task_id,
            resourceCount: EngineArtifactVersionTable.catalog_resource_count,
            resourceMediaTypes: EngineArtifactVersionTable.catalog_resource_media_types,
            catalogSearchText: EngineArtifactVersionTable.catalog_search_text,
            catalogSearchTextTruncated: EngineArtifactVersionTable.catalog_search_text_truncated,
            catalogMetadataSHA256: EngineArtifactVersionTable.catalog_metadata_sha256,
            catalogRevision: EngineArtifactVersionTable.catalog_revision,
            timeCreated: EngineArtifactVersionTable.time_created,
            timeUpdated: EngineArtifactVersionTable.time_updated,
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
        return history ? ({ ...history, partition: "history" } as const) : undefined
      })()
  if (!selected) {
    const existing = input.db
      .select({ taskID: EngineArtifactTable.task_id })
      .from(EngineArtifactTable)
      .where(eq(EngineArtifactTable.id, input.artifactID))
      .get()
    if (existing && existing.taskID !== input.taskID) {
      throw new Error(`artifact_read: Engine Artifact ${input.artifactID} belongs to another Task`)
    }
    throw new Error(
      `Exact Engine Artifact ${input.artifactID}@revision=${input.catalogRevision}@${input.expectedSHA256} does not exist`,
    )
  }
  const producer = ArtifactProducerSchema.nullable().parse(selected.producer)
  assertEngineArtifactCatalogIndexIdentity({
    id: selected.id,
    artifact_id: selected.id,
    task_id: selected.taskID,
    kind: selected.kind,
    label_index: engineArtifactCatalogLabelIndex(selected.label),
    time_created: selected.timeCreated,
    time_updated: selected.timeUpdated,
    payload_sha256: selected.payloadSHA256,
    payload_bytes: selected.payloadBytes,
    payload_block_index_sha256: selected.payloadBlockIndexSHA256,
    catalog_artifact_type: selected.artifactType,
    catalog_schema_diagnostic: selected.schemaDiagnostic,
    catalog_producer: producer,
    catalog_import_source_task_id: selected.importSourceTaskID,
    catalog_resource_count: selected.resourceCount,
    catalog_resource_media_types: selected.resourceMediaTypes,
    catalog_search_text: selected.catalogSearchText,
    catalog_search_text_truncated: selected.catalogSearchTextTruncated,
    catalog_metadata_sha256: selected.catalogMetadataSHA256,
  })
  return selected
}

function exactEngineArtifactReadWindow(input: {
  db: Database.TxOrDb
  index: ExactEngineArtifactReadIndex
  byteOffset: number
  maxBytes: number
}): { bytes: Uint8Array; windowStart: number } {
  if (input.byteOffset > input.index.payloadBytes) {
    throw new Error(
      `artifact_read ${input.index.id}: byte_offset ${input.byteOffset} exceeds ${input.index.payloadBytes} bytes`,
    )
  }
  const firstBlock = Math.floor(input.byteOffset / ENGINE_ARTIFACT_PAYLOAD_BLOCK_BYTES)
  const requestedEnd = Math.min(input.index.payloadBytes, input.byteOffset + input.maxBytes + 3)
  const lastBlockExclusive = Math.ceil(requestedEnd / ENGINE_ARTIFACT_PAYLOAD_BLOCK_BYTES)
  const windowStart = firstBlock * ENGINE_ARTIFACT_PAYLOAD_BLOCK_BYTES
  const windowEnd = Math.min(input.index.payloadBytes, lastBlockExclusive * ENGINE_ARTIFACT_PAYLOAD_BLOCK_BYTES)
  const length = windowEnd - windowStart
  const hashPaths = [0, 1, 2].map((offset) => `$[${firstBlock + offset}]`)
  const selectedWindow =
    input.index.partition === "current"
      ? input.db
          .select({
            bytes: sql<Uint8Array>`CAST(substr(CAST(${EngineArtifactTable.payload} AS BLOB), ${windowStart + 1}, ${length}) AS BLOB)`,
            firstHash: sql<string | null>`json_extract(${EngineArtifactTable.payload_block_sha256s}, ${hashPaths[0]})`,
            secondHash: sql<string | null>`json_extract(${EngineArtifactTable.payload_block_sha256s}, ${hashPaths[1]})`,
            thirdHash: sql<string | null>`json_extract(${EngineArtifactTable.payload_block_sha256s}, ${hashPaths[2]})`,
            allHashes: EngineArtifactTable.payload_block_sha256s,
          })
          .from(EngineArtifactTable)
          .where(
            and(
              eq(EngineArtifactTable.id, input.index.id),
              eq(EngineArtifactTable.task_id, input.index.taskID),
              eq(EngineArtifactTable.catalog_revision, input.index.catalogRevision),
            ),
          )
          .get()
      : input.db
          .select({
            bytes: sql<Uint8Array>`CAST(substr(CAST(${EngineArtifactVersionTable.payload} AS BLOB), ${windowStart + 1}, ${length}) AS BLOB)`,
            firstHash: sql<
              string | null
            >`json_extract(${EngineArtifactVersionTable.payload_block_sha256s}, ${hashPaths[0]})`,
            secondHash: sql<
              string | null
            >`json_extract(${EngineArtifactVersionTable.payload_block_sha256s}, ${hashPaths[1]})`,
            thirdHash: sql<
              string | null
            >`json_extract(${EngineArtifactVersionTable.payload_block_sha256s}, ${hashPaths[2]})`,
            allHashes: EngineArtifactVersionTable.payload_block_sha256s,
          })
          .from(EngineArtifactVersionTable)
          .where(
            and(
              eq(EngineArtifactVersionTable.artifact_id, input.index.id),
              eq(EngineArtifactVersionTable.task_id, input.index.taskID),
              eq(EngineArtifactVersionTable.catalog_revision, input.index.catalogRevision),
            ),
          )
          .get()
  if (!selectedWindow) {
    throw new Error(`artifact_read: Engine Artifact ${input.index.id} changed during its exact read`)
  }
  if (selectedWindow.bytes.byteLength !== length) {
    throw new Error(
      `artifact_read: Engine Artifact ${input.index.id} payload bytes do not match its canonical catalog metadata`,
    )
  }
  const bytes = Buffer.from(selectedWindow.bytes)
  const allHashes = selectedWindow.allHashes
  if (!Array.isArray(allHashes) || allHashes.some((hash) => typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash))) {
    throw new Error(`artifact_read: Engine Artifact ${input.index.id} payload block index is malformed`)
  }
  if (
    engineArtifactPayloadBlockIndexSHA256({
      payloadSHA256: input.index.payloadSHA256,
      payloadBytes: input.index.payloadBytes,
      blockSHA256s: allHashes,
    }) !== input.index.payloadBlockIndexSHA256
  ) {
    throw new Error(
      `artifact_read: Engine Artifact ${input.index.id} payload block index does not match its canonical catalog metadata`,
    )
  }
  const coveredHashes = [selectedWindow.firstHash, selectedWindow.secondHash, selectedWindow.thirdHash]
  for (let block = firstBlock; block < lastBlockExclusive; block += 1) {
    const relativeStart = block * ENGINE_ARTIFACT_PAYLOAD_BLOCK_BYTES - windowStart
    const blockBytes = bytes.subarray(relativeStart, relativeStart + ENGINE_ARTIFACT_PAYLOAD_BLOCK_BYTES)
    if (coveredHashes[block - firstBlock] !== sha256(blockBytes)) {
      throw new Error(
        `artifact_read: Engine Artifact ${input.index.id} payload bytes do not match its canonical catalog metadata; payload block ${block} does not match its canonical catalog metadata`,
      )
    }
  }
  return { bytes, windowStart }
}

function boundedEngineArtifactTextReadResult(input: {
  locator: Extract<ArtifactReadInput["locator"], { source: "engine_artifact" }>
  index: ExactEngineArtifactReadIndex
  bytes: Uint8Array
  windowStart: number
  byteOffset: number
  maxBytes: number
}): ArtifactReadResult {
  const relativeOffset = input.byteOffset - input.windowStart
  if (relativeOffset < input.bytes.byteLength && (input.bytes[relativeOffset]! & 0xc0) === 0x80) {
    throw new Error(`artifact_read ${input.index.id}: byte_offset ${input.byteOffset} is not a UTF-8 boundary`)
  }
  let relativeEnd = Math.min(input.bytes.byteLength, relativeOffset + input.maxBytes)
  let text = ""
  while (relativeEnd >= relativeOffset) {
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(input.bytes.subarray(relativeOffset, relativeEnd))
      break
    } catch {
      relativeEnd -= 1
    }
  }
  if (relativeEnd < relativeOffset || (relativeEnd === relativeOffset && input.byteOffset < input.index.payloadBytes)) {
    throw new Error(
      `artifact_read ${input.index.id}: max_bytes ${input.maxBytes} cannot contain the complete UTF-8 code point at byte_offset ${input.byteOffset}`,
    )
  }
  const byteEnd = input.windowStart + relativeEnd
  const complete = byteEnd === input.index.payloadBytes
  return {
    chunk: {
      locator: input.locator,
      media_type: "application/json",
      byte_start: input.byteOffset,
      byte_end: byteEnd,
      next_offset: complete ? null : byteEnd,
      total_bytes: input.index.payloadBytes,
      complete,
      sha256: input.index.payloadSHA256,
      text,
      attachment: false,
    },
  }
}

/**
 * Resolve one exact Engine Artifact for Host-side domain validation without
 * falling back to an ID-only second read. The returned row, digest metadata,
 * and payload belong to one SQLite statement snapshot.
 */
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

export async function readTaskArtifact(input: {
  authority: TaskArtifactReadAuthority
  read: ArtifactReadRequest
}): Promise<ArtifactReadResult> {
  const read = ArtifactReadInputSchema.parse(input.read)
  if (read.delivery === "materialized_file") {
    if (read.locator.source !== "task_artifact_resource") {
      throw new Error("artifact_read materialized_file requires one exact task_artifact_resource locator")
    }
    const bytes = await readTaskArtifactRef({ ...input.authority, ref: read.locator.ref })
    const digest = sha256(bytes)
    if (digest !== read.locator.ref.sha256 || bytes.byteLength !== read.locator.ref.bytes) {
      throw new Error("artifact_read materialized resource bytes do not match the immutable locator")
    }
    const name = path.basename(read.locator.ref.path).replaceAll(/[^A-Za-z0-9._-]/g, "_") || "artifact"
    const directory = ProjectRuntimePaths.taskArtifactReadMaterializationRoot(
      input.authority.projectDirectory,
      input.authority.taskID,
    )
    const target = path.join(directory, `${digest}-${name}`)
    await fs.mkdir(directory, { recursive: true })
    const stage = path.join(directory, `.${digest}-${randomUUID()}.tmp`)
    try {
      await fs.writeFile(stage, bytes, { flag: "wx" })
      try {
        await fs.rename(stage, target)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
      }
      const materialized = await fs.readFile(target)
      if (materialized.byteLength !== bytes.byteLength || sha256(materialized) !== digest) {
        throw new Error("artifact_read materialized cache path does not match the immutable locator")
      }
      await fs.chmod(target, 0o444)
    } finally {
      await fs.rm(stage, { force: true })
    }
    return {
      chunk: {
        locator: read.locator,
        media_type: read.locator.ref.media_type,
        byte_start: 0,
        byte_end: bytes.byteLength,
        next_offset: null,
        total_bytes: bytes.byteLength,
        complete: true,
        sha256: digest,
        materialized_path: target,
        attachment: false,
      },
    }
  }
  if (read.locator.source === "engine_artifact") {
    const locator = read.locator
    return Database.transaction((db) => {
      const index = exactEngineArtifactReadIndex({
        db,
        taskID: input.authority.taskID,
        artifactID: locator.artifact_id,
        catalogRevision: locator.catalog_revision,
        expectedSHA256: locator.expected_sha256,
      })
      const window = exactEngineArtifactReadWindow({
        db,
        index,
        byteOffset: read.byte_offset,
        maxBytes: read.max_bytes,
      })
      return boundedEngineArtifactTextReadResult({
        locator,
        index,
        ...window,
        byteOffset: read.byte_offset,
        maxBytes: read.max_bytes,
      })
    })
  }
  if (read.locator.source === "task_artifact_snapshot") {
    if (read.locator.snapshot.task_id !== input.authority.taskID) {
      throw new Error(`artifact_read: Task Artifact snapshot belongs to another Task`)
    }
    const record = await readTaskArtifactSnapshotManifest({
      ...input.authority,
      snapshot: read.locator.snapshot,
    })
    return textReadResult({
      locator: read.locator,
      bytes: record.manifestBytes,
      mediaType: "application/json",
      byteOffset: read.byte_offset,
      maxBytes: read.max_bytes,
      context: `artifact_read snapshot ${record.identity.snapshot_id}`,
    })
  }
  if (read.locator.ref.snapshot.task_id !== input.authority.taskID) {
    throw new Error(`artifact_read: Task Artifact resource belongs to another Task`)
  }
  const bytes = await readTaskArtifactRef({ ...input.authority, ref: read.locator.ref })
  if (isDecodableText(read.locator.ref.media_type, read.locator.ref.path)) {
    return textReadResult({
      locator: read.locator,
      bytes,
      mediaType: read.locator.ref.media_type,
      byteOffset: read.byte_offset,
      maxBytes: read.max_bytes,
      context: `artifact_read resource ${read.locator.ref.tree}/${read.locator.ref.path}`,
    })
  }
  if (read.byte_offset !== 0) {
    throw new Error(
      "artifact_read binary resource: byte_offset must be 0 because binary media is returned as one complete attachment",
    )
  }
  return {
    chunk: {
      locator: read.locator,
      media_type: read.locator.ref.media_type,
      byte_start: 0,
      byte_end: bytes.byteLength,
      next_offset: null,
      total_bytes: bytes.byteLength,
      complete: true,
      sha256: sha256(bytes),
      attachment: true,
    },
    attachment: {
      bytes,
      filename: read.locator.ref.path.split("/").at(-1) ?? "artifact",
    },
  }
}

function compareResource(left: TaskArtifactRef, right: TaskArtifactRef): number {
  return (
    compareCodeUnits(left.snapshot.snapshot_id, right.snapshot.snapshot_id) ||
    compareCodeUnits(left.tree, right.tree) ||
    compareCodeUnits(left.path, right.path)
  )
}

function idempotentExpertPublicationIdentity(input: {
  taskID: string
  label: string
  envelope: import("@opencorvus-ai/plugin/artifact-catalog").EngineArtifactEnvelope
}) {
  const producer = input.envelope.producer
  if (producer.owner_kind !== "projected-scheduler" && producer.owner_kind !== "projected-worker") {
    throw new Error("idempotent package publication requires a projected scheduler or worker producer")
  }
  const semantic = {
    task_id: input.taskID,
    label: input.label,
    artifact_type: input.envelope.artifact_type,
    schema_version: input.envelope.schema_version,
    owner: {
      owner_kind: producer.owner_kind,
      expert_squad_id: producer.expert_squad_id,
      agent_id: producer.agent_id,
      projection_hash: producer.projection_hash,
    },
    payload: input.envelope.payload,
    resources: input.envelope.resources
      .map((resource) => ({
        tree: resource.tree,
        path: resource.path,
        media_type: resource.media_type,
        bytes: resource.bytes,
        sha256: resource.sha256,
      }))
      .sort((left, right) => compareCodeUnits(stableJSON(left), stableJSON(right))),
    source_artifact_locators: input.envelope.source_artifact_locators,
  }
  const canonical = stableJSON(semantic)
  return {
    artifactID: `art_idempotent_${sha256(canonical)}`,
    canonical,
  }
}

export class TaskArtifactPublicationClosedError extends Error {
  override readonly name = "TaskArtifactPublicationClosedError"
  readonly code = "TASK_ARTIFACT_PUBLICATION_CLOSED"

  constructor(
    readonly taskID: string,
    readonly timeCompleted: number,
  ) {
    super(`Task ${taskID} completed at ${timeCompleted}; new expert Artifact publication is closed`)
  }
}

function assertExpertArtifactPublicationOpenInTransaction(db: Database.TxOrDb, taskID: string): void {
  const task = db
    .select({ id: EngineTaskTable.id, timeCompleted: EngineTaskTable.time_completed })
    .from(EngineTaskTable)
    .where(eq(EngineTaskTable.id, taskID))
    .get()
  if (!task) throw new Error(`engineArtifacts.publish Task ${taskID} does not exist`)
  if (task.timeCompleted !== null) {
    throw new TaskArtifactPublicationClosedError(taskID, task.timeCompleted)
  }
}

export async function publishExpertArtifact(input: {
  scope: TaskToolExecutionScope
  artifact: EngineArtifactPublishRequest
  observedArtifactLocators?: readonly import("@opencorvus-ai/plugin/artifact-catalog").ArtifactReadLocator[]
  selectedArtifactLocators?: readonly import("@opencorvus-ai/plugin/artifact-catalog").ArtifactReadLocator[]
}): Promise<EngineArtifactPublishResult> {
  const artifact = EngineArtifactPublishInputSchema.parse(input.artifact)
  if (!artifact.artifact_type.startsWith(`${input.scope.owner.expertSquadID}/`)) {
    throw new Error(`engineArtifacts.publish artifact_type must be namespaced by ${input.scope.owner.expertSquadID}/`)
  }
  const resources = [...artifact.resources].sort(compareResource)
  const observedArtifactLocators = [...(input.observedArtifactLocators ?? [])].sort((left, right) =>
    compareCodeUnits(stableJSON(left), stableJSON(right)),
  )
  const observedKeys = new Set(observedArtifactLocators.map(stableJSON))
  const selectedKeys = new Set((input.selectedArtifactLocators ?? []).map(stableJSON))
  const sourceArtifactLocators = [...artifact.source_artifact_locators].sort((left, right) =>
    compareCodeUnits(stableJSON(left), stableJSON(right)),
  )
  for (const source of sourceArtifactLocators) {
    if (!observedKeys.has(stableJSON(source))) {
      throw new Error(
        `engineArtifacts.publish source locator was not completely read before this publication: ${stableJSON(source)}`,
      )
    }
    if (!selectedKeys.has(stableJSON(source))) {
      throw new Error(
        `engineArtifacts.publish source locator was not selected before this publication: ${stableJSON(source)}`,
      )
    }
  }
  for (const [index, resource] of resources.entries()) {
    if (resource.snapshot.task_id !== input.scope.taskID) {
      throw new Error(`engineArtifacts.publish resource ${resource.path} belongs to another Task`)
    }
    if (index > 0 && compareResource(resources[index - 1]!, resource) === 0) {
      throw new Error(`engineArtifacts.publish resource ${resource.tree}/${resource.path} is duplicated`)
    }
    await readTaskArtifactRef({
      projectID: input.scope.projectID,
      projectDirectory: input.scope.projectDirectory,
      taskID: input.scope.taskID,
      ref: resource,
    })
  }
  const packageRevision = artifactPackageRevision(input.scope.owner.packageRevision)
  const envelope = EngineArtifactEnvelopeSchema.parse({
    artifact_type: artifact.artifact_type,
    schema_version: artifact.schema_version,
    producer: {
      owner_kind: input.scope.owner.kind,
      expert_squad_id: input.scope.owner.expertSquadID,
      package_revision: packageRevision,
      agent_id: input.scope.owner.agentID,
      projection_hash: input.scope.owner.projectionHash,
      session_id: input.scope.sessionID,
      message_id: input.scope.messageID,
      tool_call_id: input.scope.toolCallID,
    },
    payload: artifact.payload,
    resources,
    observed_artifact_locators: observedArtifactLocators,
    source_artifact_locators: sourceArtifactLocators,
  })
  const artifactID = Database.transaction((db) => {
    if (artifact.idempotent) {
      const identity = idempotentExpertPublicationIdentity({
        taskID: input.scope.taskID,
        label: artifact.label,
        envelope,
      })
      const existing = db
        .select()
        .from(EngineArtifactTable)
        .where(eq(EngineArtifactTable.id, identity.artifactID))
        .get()
      if (existing) {
        if (existing.task_id !== input.scope.taskID || existing.kind !== "expert_output") {
          throw new Error("idempotent Engine Artifact identity resolved to a foreign partition")
        }
        const existingEnvelope = EngineArtifactEnvelopeSchema.parse(existing.payload)
        const existingIdentity = idempotentExpertPublicationIdentity({
          taskID: existing.task_id,
          label: existing.label,
          envelope: existingEnvelope,
        })
        if (existingIdentity.canonical !== identity.canonical) {
          throw new Error("idempotent Engine Artifact identity collision")
        }
        return existing.id
      }
      assertExpertArtifactPublicationOpenInTransaction(db, input.scope.taskID)
      return insertEngineArtifact(db, {
        id: identity.artifactID,
        taskID: input.scope.taskID,
        kind: "expert_output",
        label: artifact.label,
        payload: envelope,
      })
    }
    assertExpertArtifactPublicationOpenInTransaction(db, input.scope.taskID)
    return insertEngineArtifact(db, {
      id: Identifier.ascending("artifact"),
      taskID: input.scope.taskID,
      kind: "expert_output",
      label: artifact.label,
      payload: envelope,
    })
  })
  const locator = exactEngineArtifactLocator({ taskID: input.scope.taskID, artifactID })
  return {
    locator,
    sha256: locator.expected_sha256,
  }
}
