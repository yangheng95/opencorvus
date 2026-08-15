import {
  CrossTaskArtifactImportListSchema,
  CrossTaskArtifactSourceListSchema,
  ArtifactConsumptionProvenanceSchema,
  ArtifactJSONValueSchema,
  EngineArtifactEnvelopeSchema,
  type ArtifactProducer,
  type ArtifactConsumptionProvenance,
  type ArtifactJSONValue,
  type ArtifactReadLocator,
  type CrossTaskArtifactImport,
  type CrossTaskArtifactSource,
  type CrossTaskArtifactImportMapping,
  type EngineArtifactLocator,
} from "@opencorvus-ai/plugin/artifact-catalog"
import type { TaskArtifactRef } from "@opencorvus-ai/plugin/task-artifact"
import { createHash } from "node:crypto"
import { requireEngineArtifactByLocator } from "@/artifact-catalog"
import { Identifier } from "@/id/id"
import { taskPrimaryProjectRoot } from "@/project/task-runtime-root"
import { Database, and, eq, sql } from "@/storage/db"
import {
  publishImportedTaskArtifactResources,
  readTaskArtifactSnapshotManifest,
  taskArtifactSnapshotResourceRefs,
  type TaskArtifactReadAuthority,
} from "@/task-artifact/store"
import { insertEngineArtifact } from "./artifact"
import { deriveEngineArtifactCatalogMetadata, serializeEngineArtifactPayload } from "./artifact-catalog-metadata"
import { EngineArtifactTable, EngineTaskTable, type EngineArtifactKind, type EngineMetadata } from "./engine.sql"
import { isTaskTerminal } from "./task-status"
import { projectTaskRowInTransaction, requireTask } from "./store"
import { deriveTaskStatus } from "./task-status"
import {
  findTaskCompletionDecisionForTerminalTime,
  findTaskCompletionDecisionForTerminalTimeInTransaction,
} from "./completion-decision"
import {
  requireCurrentTerminalLifecycleReference,
  sameTerminalLifecycleReference,
  terminalLifecycleReferenceMatchesTaskRow,
  type TerminalLifecycleReference,
} from "./terminal-lifecycle-reference"

export const CROSS_TASK_PLAIN_ENGINE_ARTIFACT_TYPE = "opencorvus/imported-engine-artifact"
export const CROSS_TASK_TASK_ARTIFACT_SNAPSHOT_TYPE = "opencorvus/imported-task-artifact-snapshot"
export const CROSS_TASK_TASK_ARTIFACT_RESOURCE_TYPE = "opencorvus/imported-task-artifact-resource"

export type CrossTaskArtifactImporter = Readonly<{
  missionID: string
  sessionID: string
  messageID: string
  toolCallID: string
}>

export type PreparedCrossTaskArtifactImport = Readonly<{
  importedArtifactID: string
  importedEnvelope: EngineMetadata
  sourceTaskID: string
  sourceLocator: CrossTaskArtifactImport["locator"]
  sourceAuthority: CrossTaskArtifactSourceAuthority
}>

type CrossTaskArtifactSourceAuthority =
  | Readonly<{
      kind: "completion_decision"
      timeCompleted: number
      completionDecisionArtifactID: string
    }>
  | Readonly<{
      kind: "terminal_lifecycle"
      reference: TerminalLifecycleReference
    }>

export type ResolvedCrossTaskArtifactImport = CrossTaskArtifactImport &
  Readonly<{ sourceAuthority: CrossTaskArtifactSourceAuthority }>

export type CrossTaskArtifactSourceAuthorityReceipt = Readonly<{
  sourceTaskID: string
  sourceAuthority: CrossTaskArtifactSourceAuthority
}>

export type ResolvedCrossTaskArtifactSourceSet = Readonly<{
  imports: readonly ResolvedCrossTaskArtifactImport[]
  authorities: readonly CrossTaskArtifactSourceAuthorityReceipt[]
}>

export type PreparedCrossTaskArtifactSourceSet = Readonly<{
  imports: readonly PreparedCrossTaskArtifactImport[]
  authorities: readonly CrossTaskArtifactSourceAuthorityReceipt[]
}>

export class CrossTaskArtifactDeliveryAuthorityError extends Error {
  override readonly name = "CrossTaskArtifactDeliveryAuthorityError"
  readonly code = "CROSS_TASK_ARTIFACT_DELIVERY_AUTHORITY_REQUIRED"

  constructor(
    readonly sourceTaskID: string,
    readonly requestedLocator: ArtifactReadLocator | null,
    readonly allowedLocators: readonly ArtifactReadLocator[],
  ) {
    super(
      `Cross-Task Artifact source ${sourceTaskID} is not the exact completion decision or one of its declared deliverables`,
    )
  }
}

export class CrossTaskArtifactSourceAuthorityError extends Error {
  override readonly name = "CrossTaskArtifactSourceAuthorityError"
  readonly code = "CROSS_TASK_ARTIFACT_SOURCE_AUTHORITY_INVALID"

  constructor(
    readonly sourceTaskID: string,
    readonly requestedAuthority: CrossTaskArtifactSource["authority"],
    readonly taskStatus: string,
  ) {
    super(
      `Cross-Task Artifact source ${sourceTaskID} is ${taskStatus}; authority ${requestedAuthority} does not match its terminal lifecycle`,
    )
  }
}

type ExactSourceArtifact = Readonly<{
  sourceKind: string
  artifactType: string
  schemaVersion: number
  producer: ArtifactProducer | null
  sourceProvenance: ArtifactConsumptionProvenance
  payload: ArtifactJSONValue
  resources: readonly TaskArtifactRef[]
}>

function sourceArtifactProvenance(payload: unknown): ArtifactConsumptionProvenance {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return ArtifactConsumptionProvenanceSchema.parse({})
  }
  const record = payload as Record<string, unknown>
  return ArtifactConsumptionProvenanceSchema.parse({
    observed_artifact_locators: record.observed_artifact_locators,
    source_artifact_locators: record.source_artifact_locators,
  })
}

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex")
}

function stableJSON(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJSON).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJSON(child)}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

function normalizedImportSet(imports: readonly CrossTaskArtifactImport[]): CrossTaskArtifactImport[] {
  return CrossTaskArtifactImportListSchema.parse(imports).toSorted(
    (left, right) =>
      left.source_task_id.localeCompare(right.source_task_id) ||
      stableJSON(left.locator).localeCompare(stableJSON(right.locator)),
  )
}

export function sameCrossTaskArtifactImportSet(
  left: readonly CrossTaskArtifactImport[],
  right: readonly CrossTaskArtifactImport[],
): boolean {
  const normalizedLeft = normalizedImportSet(left)
  const normalizedRight = normalizedImportSet(right)
  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every(
      (item, index) =>
        item.source_task_id === normalizedRight[index]!.source_task_id &&
        stableJSON(item.locator) === stableJSON(normalizedRight[index]!.locator),
    )
  )
}

export function requireMissionTaskLineageAuthority(input: {
  sourceTaskID: string
  projectID: string
  importer: Pick<CrossTaskArtifactImporter, "missionID" | "sessionID">
}) {
  const sourceTask = requireTask(input.sourceTaskID)
  if (sourceTask.project_id !== input.projectID) {
    throw new Error(`Cross-Task Artifact source ${input.sourceTaskID} belongs to another project`)
  }
  const metadata = sourceTask.metadata as
    | { actor?: unknown; mission?: { id?: unknown; session_id?: unknown } }
    | undefined
  if (
    metadata?.actor !== "mission" ||
    metadata.mission?.id !== input.importer.missionID ||
    metadata.mission?.session_id !== input.importer.sessionID
  ) {
    throw new Error(
      `Cross-Task Artifact source ${input.sourceTaskID} is outside Mission ${input.importer.missionID} lineage`,
    )
  }
  return sourceTask
}

export function requireMissionArtifactSourceAuthority(input: {
  sourceTaskID: string
  projectID: string
  importer: Pick<CrossTaskArtifactImporter, "missionID" | "sessionID">
}): void {
  const sourceTask = requireMissionTaskLineageAuthority(input)
  if (!isTaskTerminal(sourceTask)) {
    throw new Error(`Cross-Task Artifact source ${input.sourceTaskID} is not terminal`)
  }
}

export function resolveCrossTaskArtifactSources(input: {
  sources: readonly CrossTaskArtifactSource[]
  projectID: string
  importer: Pick<CrossTaskArtifactImporter, "missionID" | "sessionID">
}): ResolvedCrossTaskArtifactSourceSet {
  const sources = CrossTaskArtifactSourceListSchema.parse(input.sources)
  const imports: ResolvedCrossTaskArtifactImport[] = []
  const authorities: CrossTaskArtifactSourceAuthorityReceipt[] = []
  for (const source of sources) {
    const task = requireMissionTaskLineageAuthority({
      sourceTaskID: source.source_task_id,
      projectID: input.projectID,
      importer: input.importer,
    })
    const status = deriveTaskStatus(task)
    if (source.authority === "completion_decision") {
      if (status !== "completed" || task.time_completed === null) {
        throw new CrossTaskArtifactSourceAuthorityError(source.source_task_id, source.authority, status)
      }
      const decision = findTaskCompletionDecisionForTerminalTime({
        taskID: source.source_task_id,
        timeCompleted: task.time_completed,
      })
      if (!decision) {
        throw new CrossTaskArtifactSourceAuthorityError(source.source_task_id, source.authority, status)
      }
      const sourceAuthority: CrossTaskArtifactSourceAuthority = {
        kind: "completion_decision",
        timeCompleted: task.time_completed,
        completionDecisionArtifactID: decision.id,
      }
      authorities.push({ sourceTaskID: source.source_task_id, sourceAuthority })
      imports.push(
        ...decision.payload.deliverable_artifact_locators.map((locator) => ({
          source_task_id: source.source_task_id,
          locator,
          sourceAuthority,
        })),
      )
      continue
    }
    if (status !== "failed" && status !== "cancelled") {
      throw new CrossTaskArtifactSourceAuthorityError(source.source_task_id, source.authority, status)
    }
    const sourceAuthority: CrossTaskArtifactSourceAuthority = {
      kind: "terminal_lifecycle",
      reference: requireCurrentTerminalLifecycleReference(source.source_task_id),
    }
    authorities.push({ sourceTaskID: source.source_task_id, sourceAuthority })
    imports.push({
      source_task_id: source.source_task_id,
      locator: source.locator,
      sourceAuthority,
    })
  }
  CrossTaskArtifactImportListSchema.parse(
    imports.map(({ source_task_id, locator }) => ({ source_task_id, locator })),
  )
  return Object.freeze({
    imports: Object.freeze(
      imports.toSorted(
        (left, right) =>
          left.source_task_id.localeCompare(right.source_task_id) ||
          stableJSON(left.locator).localeCompare(stableJSON(right.locator)),
      ),
    ),
    authorities: Object.freeze(authorities),
  })
}

export function assertCrossTaskArtifactDeliveryAuthority(input: {
  sourceTaskID: string
  locator: ArtifactReadLocator
}): CrossTaskArtifactSourceAuthority {
  const sourceTask = requireTask(input.sourceTaskID)
  const status = deriveTaskStatus(sourceTask)
  if (status !== "completed") {
    // Failed and cancelled Tasks intentionally have no CompletionDecision.
    // Their current terminal lifecycle event plus the caller's exact immutable
    // locator remain the recovery authority; the exact source read below still
    // rejects missing, mutable, or mismatched revisions.
    return {
      kind: "terminal_lifecycle",
      reference: requireCurrentTerminalLifecycleReference(input.sourceTaskID),
    }
  }
  if (sourceTask.time_completed === null) {
    throw new CrossTaskArtifactDeliveryAuthorityError(input.sourceTaskID, input.locator, [])
  }
  const decision = findTaskCompletionDecisionForTerminalTime({
    taskID: input.sourceTaskID,
    timeCompleted: sourceTask.time_completed,
  })
  if (!decision) {
    throw new CrossTaskArtifactDeliveryAuthorityError(input.sourceTaskID, input.locator, [])
  }
  const allowedLocators: ArtifactReadLocator[] = [decision.locator, ...decision.payload.deliverable_artifact_locators]
  if (!allowedLocators.some((locator) => stableJSON(locator) === stableJSON(input.locator))) {
    throw new CrossTaskArtifactDeliveryAuthorityError(input.sourceTaskID, input.locator, allowedLocators)
  }
  return {
    kind: "completion_decision",
    timeCompleted: sourceTask.time_completed,
    completionDecisionArtifactID: decision.id,
  }
}

function assertCrossTaskArtifactSourceAuthorityCurrent(
  db: Database.TxOrDb,
  item: Readonly<{
    sourceTaskID: string
    sourceLocator: ArtifactReadLocator | null
    sourceAuthority: CrossTaskArtifactSourceAuthority
  }>,
): void {
  const persistedTask = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, item.sourceTaskID)).get()
  if (!persistedTask) {
    throw new CrossTaskArtifactDeliveryAuthorityError(item.sourceTaskID, item.sourceLocator, [])
  }
  const task = projectTaskRowInTransaction(db, persistedTask)
  if (item.sourceAuthority.kind === "completion_decision") {
    const decision =
      deriveTaskStatus(task) === "completed" && task.time_completed === item.sourceAuthority.timeCompleted
        ? findTaskCompletionDecisionForTerminalTimeInTransaction(db, {
            taskID: item.sourceTaskID,
            timeCompleted: item.sourceAuthority.timeCompleted,
          })
        : undefined
    if (decision?.id !== item.sourceAuthority.completionDecisionArtifactID) {
      throw new CrossTaskArtifactDeliveryAuthorityError(item.sourceTaskID, item.sourceLocator, [])
    }
    return
  }
  const currentReference = terminalLifecycleReferenceMatchesTaskRow(item.sourceAuthority.reference, task)
    ? requireCurrentTerminalLifecycleReference(item.sourceTaskID)
    : undefined
  if (!currentReference || !sameTerminalLifecycleReference(currentReference, item.sourceAuthority.reference)) {
    throw new CrossTaskArtifactDeliveryAuthorityError(item.sourceTaskID, item.sourceLocator, [])
  }
}

export function importsFromResolvedCrossTaskArtifactSources(
  resolved: ResolvedCrossTaskArtifactSourceSet,
): CrossTaskArtifactImport[] {
  return resolved.imports.map(({ source_task_id, locator }) => ({ source_task_id, locator }))
}

function readExactEngineSourceArtifact(input: { sourceTaskID: string; locator: EngineArtifactLocator }): Readonly<{
  kind: EngineArtifactKind
  payload: unknown
}> {
  const row = requireEngineArtifactByLocator({
    taskID: input.sourceTaskID,
    locator: input.locator,
  })
  const payloadText = serializeEngineArtifactPayload(row.payload)
  const derived = deriveEngineArtifactCatalogMetadata({ kind: row.kind, payloadText })
  const catalogMismatches = [
    derived.catalog_artifact_type === row.catalog_artifact_type ? undefined : "catalog_artifact_type",
    derived.catalog_schema_diagnostic === row.catalog_schema_diagnostic ? undefined : "catalog_schema_diagnostic",
    stableJSON(derived.catalog_producer) === stableJSON(row.catalog_producer) ? undefined : "catalog_producer",
    derived.catalog_import_source_task_id === row.catalog_import_source_task_id
      ? undefined
      : "catalog_import_source_task_id",
    derived.catalog_resource_count === row.catalog_resource_count ? undefined : "catalog_resource_count",
    stableJSON(derived.catalog_resource_media_types) === stableJSON(row.catalog_resource_media_types)
      ? undefined
      : "catalog_resource_media_types",
    derived.catalog_search_text === row.catalog_search_text ? undefined : "catalog_search_text",
    derived.catalog_search_text_truncated === row.catalog_search_text_truncated
      ? undefined
      : "catalog_search_text_truncated",
  ].filter((value): value is string => value !== undefined)
  if (catalogMismatches.length > 0) {
    throw new Error(`Cross-Task Artifact ${row.id} catalog metadata is corrupt: ${catalogMismatches.join(", ")}`)
  }
  return { kind: row.kind, payload: row.payload }
}

async function readExactSourceArtifact(input: {
  projectID: string
  sourceTaskID: string
  locator: ArtifactReadLocator
}): Promise<ExactSourceArtifact> {
  if (input.locator.source === "engine_artifact") {
    const source = readExactEngineSourceArtifact({
      sourceTaskID: input.sourceTaskID,
      locator: input.locator,
    })
    const envelope = EngineArtifactEnvelopeSchema.safeParse(source.payload)
    if (envelope.success) {
      return {
        sourceKind: source.kind,
        artifactType: envelope.data.artifact_type,
        schemaVersion: envelope.data.schema_version,
        producer: envelope.data.producer,
        sourceProvenance: {
          observed_artifact_locators: envelope.data.observed_artifact_locators,
          source_artifact_locators: envelope.data.source_artifact_locators,
        },
        payload: envelope.data.payload,
        resources: envelope.data.resources,
      }
    }
    return {
      sourceKind: source.kind,
      artifactType: CROSS_TASK_PLAIN_ENGINE_ARTIFACT_TYPE,
      schemaVersion: 1,
      producer: null,
      sourceProvenance: sourceArtifactProvenance(source.payload),
      payload: {
        source_kind: source.kind,
        source_payload: ArtifactJSONValueSchema.parse(source.payload),
      },
      resources: [],
    }
  }

  const sourceAuthority: TaskArtifactReadAuthority = {
    projectID: input.projectID,
    projectDirectory: taskPrimaryProjectRoot(input.sourceTaskID, { activeProjectID: input.projectID }),
    taskID: input.sourceTaskID,
  }
  if (input.locator.source === "task_artifact_snapshot") {
    if (input.locator.snapshot.task_id !== input.sourceTaskID) {
      throw new Error("Cross-Task Artifact snapshot locator belongs to another source Task")
    }
    const snapshot = await readTaskArtifactSnapshotManifest({
      ...sourceAuthority,
      snapshot: input.locator.snapshot,
    })
    if (snapshot.manifest.snapshot_kind !== "catalog") {
      throw new Error("Cross-Task Artifact snapshot import requires a catalog-visible snapshot")
    }
    return {
      sourceKind: "task_artifact_snapshot",
      artifactType: CROSS_TASK_TASK_ARTIFACT_SNAPSHOT_TYPE,
      schemaVersion: 1,
      producer: snapshot.manifest.producer,
      sourceProvenance: ArtifactConsumptionProvenanceSchema.parse({}),
      payload: {
        source_snapshot_kind: snapshot.manifest.snapshot_kind,
        source_publication_sequence: snapshot.manifest.publication_sequence,
        source_created_at_ms: snapshot.manifest.created_at_ms,
      },
      resources: taskArtifactSnapshotResourceRefs(snapshot),
    }
  }

  if (input.locator.ref.snapshot.task_id !== input.sourceTaskID) {
    throw new Error("Cross-Task Artifact resource locator belongs to another source Task")
  }
  const snapshot = await readTaskArtifactSnapshotManifest({
    ...sourceAuthority,
    snapshot: input.locator.ref.snapshot,
  })
  return {
    sourceKind: "task_artifact_resource",
    artifactType: CROSS_TASK_TASK_ARTIFACT_RESOURCE_TYPE,
    schemaVersion: 1,
    producer: snapshot.manifest.producer,
    sourceProvenance: ArtifactConsumptionProvenanceSchema.parse({}),
    payload: {
      source_media_type: input.locator.ref.media_type,
      source_bytes: input.locator.ref.bytes,
      source_sha256: input.locator.ref.sha256,
    },
    resources: [input.locator.ref],
  }
}

function missionProducer(importer: CrossTaskArtifactImporter): ArtifactProducer {
  return {
    owner_kind: "mission",
    mission_id: importer.missionID,
    session_id: importer.sessionID,
    message_id: importer.messageID,
    tool_call_id: importer.toolCallID,
  }
}

async function prepareResolvedCrossTaskArtifactImports(input: {
  imports: readonly ResolvedCrossTaskArtifactImport[]
  projectID: string
  targetProjectDirectory: string
  targetTaskID: string
  importer: CrossTaskArtifactImporter
}): Promise<readonly PreparedCrossTaskArtifactImport[]> {
  const imports = input.imports.toSorted(
    (left, right) =>
      left.source_task_id.localeCompare(right.source_task_id) ||
      stableJSON(left.locator).localeCompare(stableJSON(right.locator)),
  )
  const prepared: PreparedCrossTaskArtifactImport[] = []
  for (const item of imports) {
    requireMissionArtifactSourceAuthority({
      sourceTaskID: item.source_task_id,
      projectID: input.projectID,
      importer: input.importer,
    })
    const sourceAuthority = item.sourceAuthority
    Database.use((db) =>
      assertCrossTaskArtifactSourceAuthorityCurrent(db, {
        sourceTaskID: item.source_task_id,
        sourceLocator: item.locator,
        sourceAuthority,
      }),
    )
    const source = await readExactSourceArtifact({
      projectID: input.projectID,
      sourceTaskID: item.source_task_id,
      locator: item.locator,
    })
    const sourceReadAuthority: TaskArtifactReadAuthority = {
      projectID: input.projectID,
      projectDirectory: taskPrimaryProjectRoot(item.source_task_id, { activeProjectID: input.projectID }),
      taskID: item.source_task_id,
    }
    const publication =
      source.resources.length > 0
        ? await publishImportedTaskArtifactResources({
            sourceAuthority: sourceReadAuthority,
            targetProjectID: input.projectID,
            targetProjectDirectory: input.targetProjectDirectory,
            targetTaskID: input.targetTaskID,
            producer: missionProducer(input.importer),
            resources: source.resources,
          })
        : undefined
    const importedArtifactID = Identifier.ascending("artifact")
    const importedEnvelope = EngineArtifactEnvelopeSchema.parse({
      artifact_type: source.artifactType,
      schema_version: source.schemaVersion,
      producer: missionProducer(input.importer),
      payload: source.payload,
      resources: publication?.artifacts ?? [],
      observed_artifact_locators: [],
      source_artifact_locators: [],
      import_lineage: {
        source_task_id: item.source_task_id,
        source_locator: item.locator,
        source_kind: source.sourceKind,
        source_producer: source.producer,
        source_provenance: source.sourceProvenance,
      },
    })
    prepared.push(
      Object.freeze({
        importedArtifactID,
        importedEnvelope,
        sourceTaskID: item.source_task_id,
        sourceLocator: item.locator,
        sourceAuthority,
      }),
    )
  }
  return Object.freeze(prepared)
}

export async function prepareCrossTaskArtifactImports(input: {
  imports: readonly CrossTaskArtifactImport[]
  projectID: string
  targetProjectDirectory: string
  targetTaskID: string
  importer: CrossTaskArtifactImporter
}): Promise<readonly PreparedCrossTaskArtifactImport[]> {
  const imports = normalizedImportSet(input.imports).map((item) => ({
    ...item,
    sourceAuthority: assertCrossTaskArtifactDeliveryAuthority({
      sourceTaskID: item.source_task_id,
      locator: item.locator,
    }),
  }))
  return prepareResolvedCrossTaskArtifactImports({ ...input, imports })
}

export async function prepareCrossTaskArtifactSourceImports(input: {
  resolved: ResolvedCrossTaskArtifactSourceSet
  projectID: string
  targetProjectDirectory: string
  targetTaskID: string
  importer: CrossTaskArtifactImporter
}): Promise<PreparedCrossTaskArtifactSourceSet> {
  Database.use((db) => {
    for (const authority of input.resolved.authorities) {
      assertCrossTaskArtifactSourceAuthorityCurrent(db, {
        sourceTaskID: authority.sourceTaskID,
        sourceLocator: null,
        sourceAuthority: authority.sourceAuthority,
      })
    }
  })
  const imports = await prepareResolvedCrossTaskArtifactImports({ ...input, imports: input.resolved.imports })
  return Object.freeze({ imports, authorities: input.resolved.authorities })
}

export function persistPreparedCrossTaskArtifactImports(
  db: Database.TxOrDb,
  input: {
    targetTaskID: string
    prepared: readonly PreparedCrossTaskArtifactImport[]
    authorities?: readonly CrossTaskArtifactSourceAuthorityReceipt[]
    timeCreated: number
  },
): void {
  for (const authority of input.authorities ?? []) {
    assertCrossTaskArtifactSourceAuthorityCurrent(db, {
      sourceTaskID: authority.sourceTaskID,
      sourceLocator: null,
      sourceAuthority: authority.sourceAuthority,
    })
  }
  for (const item of input.prepared) {
    assertCrossTaskArtifactSourceAuthorityCurrent(db, item)
    const id = insertEngineArtifact(db, {
      id: item.importedArtifactID,
      taskID: input.targetTaskID,
      kind: "expert_output",
      label: "Imported cross-Task Artifact",
      payload: item.importedEnvelope,
      timeCreated: input.timeCreated,
      timeUpdated: input.timeCreated,
    })
    if (id !== item.importedArtifactID) {
      throw new Error(`Cross-Task Artifact import identity changed during persistence`)
    }
  }
}

export function listCrossTaskArtifactImportMappings(taskID: string): CrossTaskArtifactImportMapping[] {
  const rows = Database.use((db) =>
    db
      .select({
        id: EngineArtifactTable.id,
        kind: EngineArtifactTable.kind,
        rawPayload: sql<Uint8Array>`CAST(COALESCE(${EngineArtifactTable.payload}, 'null') AS BLOB)`,
        payloadSHA256: EngineArtifactTable.payload_sha256,
        catalogRevision: EngineArtifactTable.catalog_revision,
        payloadBytes: EngineArtifactTable.payload_bytes,
        artifactType: EngineArtifactTable.catalog_artifact_type,
        schemaDiagnostic: EngineArtifactTable.catalog_schema_diagnostic,
        producer: EngineArtifactTable.catalog_producer,
        importSourceTaskID: EngineArtifactTable.catalog_import_source_task_id,
        resourceCount: EngineArtifactTable.catalog_resource_count,
        resourceMediaTypes: EngineArtifactTable.catalog_resource_media_types,
        catalogSearchText: EngineArtifactTable.catalog_search_text,
        catalogSearchTextTruncated: EngineArtifactTable.catalog_search_text_truncated,
      })
      .from(EngineArtifactTable)
      .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "expert_output")))
      .all(),
  )
  const mappings: CrossTaskArtifactImportMapping[] = []
  for (const row of rows) {
    // The canonical import writer is the only expert_output producer owned by a
    // Mission. This durable discriminator lets corruption stay visible even
    // when the payload can no longer be decoded; labels and titles are not
    // identity evidence.
    const catalogSignalsImport =
      row.producer !== null &&
      typeof row.producer === "object" &&
      !Array.isArray(row.producer) &&
      row.producer.owner_kind === "mission"
    let payloadText: string
    try {
      payloadText = new TextDecoder("utf-8", { fatal: true }).decode(row.rawPayload)
    } catch (cause) {
      if (!catalogSignalsImport) continue
      throw new Error(`Imported cross-Task Artifact ${row.id} payload is not valid UTF-8`, {
        cause,
      })
    }
    let rawPayload: unknown
    try {
      rawPayload = JSON.parse(payloadText)
    } catch (cause) {
      if (!catalogSignalsImport) continue
      throw new Error(`Imported cross-Task Artifact ${row.id} payload is not valid JSON`, {
        cause,
      })
    }
    const payloadSignalsImport =
      rawPayload !== null &&
      typeof rawPayload === "object" &&
      !Array.isArray(rawPayload) &&
      Object.hasOwn(rawPayload, "import_lineage")
    if (!catalogSignalsImport && !payloadSignalsImport) continue

    const identityMismatches = [
      row.rawPayload.byteLength === row.payloadBytes ? undefined : "payload_bytes",
      sha256(row.rawPayload) === row.payloadSHA256 ? undefined : "payload_sha256",
    ].filter((value): value is string => value !== undefined)
    if (identityMismatches.length > 0) {
      throw new Error(
        `Imported cross-Task Artifact ${row.id} exact payload identity is corrupt: ${identityMismatches.join(", ")}`,
      )
    }

    const envelopeResult = EngineArtifactEnvelopeSchema.safeParse(rawPayload)
    if (!envelopeResult.success) {
      throw new Error(
        `Imported cross-Task Artifact ${row.id} transport envelope is corrupt: ${envelopeResult.error.message}`,
      )
    }
    const envelope = envelopeResult.data
    if (!envelope.import_lineage) {
      throw new Error(`Imported cross-Task Artifact ${row.id} is missing its immutable import_lineage`)
    }
    if (envelope.producer.owner_kind !== "mission") {
      throw new Error(`Imported cross-Task Artifact ${row.id} producer is not its Mission importer`)
    }

    const derived = deriveEngineArtifactCatalogMetadata({ kind: row.kind, payloadText })
    const catalogMismatches = [
      derived.catalog_artifact_type === row.artifactType ? undefined : "catalog_artifact_type",
      derived.catalog_schema_diagnostic === row.schemaDiagnostic ? undefined : "catalog_schema_diagnostic",
      stableJSON(derived.catalog_producer) === stableJSON(row.producer) ? undefined : "catalog_producer",
      derived.catalog_import_source_task_id === row.importSourceTaskID ? undefined : "catalog_import_source_task_id",
      derived.catalog_resource_count === row.resourceCount ? undefined : "catalog_resource_count",
      stableJSON(derived.catalog_resource_media_types) === stableJSON(row.resourceMediaTypes)
        ? undefined
        : "catalog_resource_media_types",
      derived.catalog_search_text === row.catalogSearchText ? undefined : "catalog_search_text",
      derived.catalog_search_text_truncated === row.catalogSearchTextTruncated
        ? undefined
        : "catalog_search_text_truncated",
    ].filter((value): value is string => value !== undefined)
    if (catalogMismatches.length > 0) {
      throw new Error(
        `Imported cross-Task Artifact ${row.id} catalog metadata is corrupt: ${catalogMismatches.join(", ")}`,
      )
    }

    mappings.push({
      source_task_id: envelope.import_lineage.source_task_id,
      source_locator: envelope.import_lineage.source_locator,
      imported_locator: {
        source: "engine_artifact",
        artifact_id: row.id,
        catalog_revision: row.catalogRevision,
        expected_sha256: row.payloadSHA256,
      },
    })
  }
  return mappings.sort(
    (left, right) =>
      left.source_task_id.localeCompare(right.source_task_id) ||
      stableJSON(left.source_locator).localeCompare(stableJSON(right.source_locator)),
  )
}

export function importsFromMappings(mappings: readonly CrossTaskArtifactImportMapping[]): CrossTaskArtifactImport[] {
  return mappings.map((mapping) => ({
    source_task_id: mapping.source_task_id,
    locator: mapping.source_locator,
  }))
}
