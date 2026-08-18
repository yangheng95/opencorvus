import { and, desc, eq } from "drizzle-orm"
import fs from "node:fs/promises"
import path from "node:path"
import z from "zod"
import { EngineArtifactTable, EngineBrowserPreviewTargetIdentityTable } from "@/engine/engine.sql"
import {
  insertEngineArtifact,
  patchEngineArtifact,
  recordEngineArtifact,
  updateEngineArtifact,
  type EngineArtifactRow,
} from "@/engine/artifact"
import { BROWSER_PREVIEW_EVIDENCE_ARTIFACT_TYPE } from "@/engine/artifact-catalog-constants"
import { Event } from "@/engine/model"
import { EngineProtocol } from "@/engine/protocol"
import { requireTask } from "@/engine/store"
import { Identifier } from "@/id/id"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { Database } from "@/storage/db"
import {
  discardEngineArtifactResources,
  publishEngineArtifactResources,
  readTaskArtifactRef,
} from "@/task-artifact/store"
import {
  BrowserPreviewCropIntent,
  BrowserPreviewSourceImageArtifactRef,
  type BrowserPreviewCropIntent as BrowserPreviewCropIntentValue,
} from "./region-schema"
import { BrowserPreviewViewportList, normalizeBrowserPreviewViewports, type BrowserPreviewViewport } from "./viewport"
import { canonicalBrowserPreviewUrl } from "./url-identity"
import { NamedError } from "@opencorvus-ai/util/error"
import { TaskArtifactRefSchema, type TaskArtifactRef } from "@opencorvus-ai/plugin/task-artifact"
import { EngineArtifactEnvelopeSchema } from "@opencorvus-ai/plugin/artifact-catalog"

export const BROWSER_PREVIEW_TARGET_KIND = "browser_preview_target" as const
export const BROWSER_PREVIEW_EVIDENCE_KIND = "browser_preview_evidence" as const
export { BROWSER_PREVIEW_EVIDENCE_ARTIFACT_TYPE }
const BrowserPreviewEvidenceOperationKind = z.enum([
  "preview-capture",
  "reference-comparison",
  "scroll-slice-comparison",
  "layout-geometry",
])
const BrowserPreviewEvidenceStatus = z.enum(["passed", "failed"])
const REQUIRED_REFERENCE_COMPARISON_ARTIFACTS = ["source_crop", "implementation_crop", "side_by_side"] as const
const REQUIRED_SCROLL_SLICE_COMPARISON_ARTIFACTS = ["source_crop", "implementation_crop", "side_by_side"] as const

const BrowserPreviewReferenceComparisonCapture = z
  .object({
    operation: z.literal("reference-comparison"),
    manifest_path: z.string(),
    region: z.object({ source_artifact: BrowserPreviewSourceImageArtifactRef }).passthrough(),
  })
  .strict()
const BrowserPreviewScrollSliceComparisonCapture = z
  .object({
    operation: z.literal("scroll-slice-comparison"),
    source_artifact: BrowserPreviewSourceImageArtifactRef,
  })
  .strict()
const BrowserPreviewCaptureFailure = z
  .object({
    captured: z.literal(false),
    passed: z.literal(false),
    url: z.string().optional(),
    requested_viewport: z.object({ width: z.number(), height: z.number() }).strict().optional(),
    viewport: z.object({ width: z.number(), height: z.number(), capped: z.boolean() }).strict().optional(),
    capture_error: z
      .object({ kind: z.literal("capture_failed"), message: z.string() })
      .strict()
      .optional(),
    summary: z.string().optional(),
  })
  .strict()
const BrowserPreviewCaptureSuccess = z
  .object({
    captured: z.literal(true),
    passed: z.boolean(),
    path: z.string().min(1),
    sha: z.string().regex(/^[a-f0-9]{16}$/),
    url: z.string().optional(),
    target_url: z.string().optional(),
    bytes: z.number().int().nonnegative().optional(),
    size: z.object({ width: z.number(), height: z.number() }).strict().optional(),
    requested_viewport: z.object({ width: z.number(), height: z.number() }).strict().optional(),
    viewport: z.object({ width: z.number(), height: z.number(), capped: z.boolean() }).strict().optional(),
    layers: z.unknown().optional(),
    dom: z.unknown().optional(),
    interaction: z.unknown().optional(),
    summary: z.string().optional(),
  })
  .strict()
const BrowserPreviewCapture = z.discriminatedUnion("captured", [
  BrowserPreviewCaptureFailure,
  BrowserPreviewCaptureSuccess,
])
const BrowserPreviewPassedCapture = BrowserPreviewCaptureSuccess.extend({ passed: z.literal(true) })
const BrowserPreviewFailedCaptured = BrowserPreviewCaptureSuccess.extend({ passed: z.literal(false) })
const BrowserPreviewLayoutGeometryCapture = z
  .object({
    operation: z.literal("layout-geometry"),
    status: BrowserPreviewEvidenceStatus,
    taskID: z.string(),
    targetID: z.string(),
    viewportID: z.string(),
    route: z.string(),
    jobID: z.string(),
    samples: z.array(z.unknown()),
    widthBehavior: z.array(z.unknown()),
    alignmentGroups: z.array(z.unknown()),
    diagnostics: z.array(z.string()),
  })
  .strict()
const BrowserPreviewPassedLayoutGeometryCapture = BrowserPreviewLayoutGeometryCapture.extend({
  status: z.literal("passed"),
})
const BrowserPreviewFailedLayoutGeometryCapture = BrowserPreviewLayoutGeometryCapture.extend({
  status: z.literal("failed"),
})

const BrowserPreviewOperationEvidence = z.union([
  z
    .object({
      operation_kind: z.literal("preview-capture"),
      status: z.literal("passed"),
      capture: BrowserPreviewPassedCapture,
    })
    .strict(),
  z
    .object({
      operation_kind: z.literal("preview-capture"),
      status: z.literal("failed"),
      capture: z.union([BrowserPreviewCaptureFailure, BrowserPreviewFailedCaptured]),
    })
    .strict(),
  z
    .object({
      operation_kind: z.literal("reference-comparison"),
      status: BrowserPreviewEvidenceStatus,
      capture: BrowserPreviewReferenceComparisonCapture,
    })
    .strict(),
  z
    .object({
      operation_kind: z.literal("scroll-slice-comparison"),
      status: BrowserPreviewEvidenceStatus,
      capture: BrowserPreviewScrollSliceComparisonCapture,
    })
    .strict(),
  z
    .object({
      operation_kind: z.literal("layout-geometry"),
      status: z.literal("passed"),
      capture: BrowserPreviewPassedLayoutGeometryCapture,
    })
    .strict(),
  z
    .object({
      operation_kind: z.literal("layout-geometry"),
      status: z.literal("failed"),
      capture: BrowserPreviewFailedLayoutGeometryCapture,
    })
    .strict(),
])

function storedCaptureWithoutPath<T extends z.ZodType>(schema: T) {
  return schema.superRefine((capture, context) => {
    if (capture && typeof capture === "object" && "path" in capture) {
      context.addIssue({ code: "custom", path: ["path"], message: "stored capture must use resource roles" })
    }
  })
}
const StoredBrowserPreviewPassedCapture = storedCaptureWithoutPath(
  z.object({ captured: z.literal(true), passed: z.literal(true) }).passthrough(),
)
const StoredBrowserPreviewFailedCaptured = storedCaptureWithoutPath(
  z.object({ captured: z.literal(true), passed: z.literal(false) }).passthrough(),
)
const StoredBrowserPreviewReferenceComparisonCapture = z
  .object({
    operation: z.literal("reference-comparison"),
    region: z.object({}).passthrough(),
  })
  .strict()
const StoredBrowserPreviewScrollSliceComparisonCapture = z
  .object({
    operation: z.literal("scroll-slice-comparison"),
  })
  .passthrough()
const StoredBrowserPreviewOperationEvidence = z.union([
  z
    .object({
      operation_kind: z.literal("preview-capture"),
      status: z.literal("passed"),
      capture: StoredBrowserPreviewPassedCapture,
    })
    .strict(),
  z
    .object({
      operation_kind: z.literal("preview-capture"),
      status: z.literal("failed"),
      capture: z.union([BrowserPreviewCaptureFailure, StoredBrowserPreviewFailedCaptured]),
    })
    .strict(),
  z
    .object({
      operation_kind: z.literal("reference-comparison"),
      status: BrowserPreviewEvidenceStatus,
      capture: StoredBrowserPreviewReferenceComparisonCapture,
    })
    .strict(),
  z
    .object({
      operation_kind: z.literal("scroll-slice-comparison"),
      status: BrowserPreviewEvidenceStatus,
      capture: StoredBrowserPreviewScrollSliceComparisonCapture,
    })
    .strict(),
  z
    .object({
      operation_kind: z.literal("layout-geometry"),
      status: z.literal("passed"),
      capture: BrowserPreviewPassedLayoutGeometryCapture,
    })
    .strict(),
  z
    .object({
      operation_kind: z.literal("layout-geometry"),
      status: z.literal("failed"),
      capture: BrowserPreviewFailedLayoutGeometryCapture,
    })
    .strict(),
])

export const BrowserPreviewEvidenceCorruptionError = NamedError.create(
  "BrowserPreviewEvidenceCorruptionError",
  z.object({
    message: z.string(),
    taskID: z.string(),
    evidenceID: z.string(),
    reason: z.string(),
    artifactPath: z.string().optional(),
    expectedSha: z.string().optional(),
    actualSha: z.string().optional(),
  }),
)

export const BrowserPreviewTargetCorruptionError = NamedError.create(
  "BrowserPreviewTargetCorruptionError",
  z.object({
    message: z.string(),
    taskID: z.string(),
    targetID: z.string(),
    reason: z.string(),
  }),
)

export function browserPreviewEvidenceIDFromRef(ref: string): string | undefined {
  const trimmed = ref.trim()
  const withoutPrefix = trimmed.startsWith("browser_preview_evidence:")
    ? trimmed.slice("browser_preview_evidence:".length).trim()
    : trimmed
  return withoutPrefix.startsWith("art_") ? withoutPrefix : undefined
}

export const PersistedBrowserPreviewTarget = z.object({
  id: z.string(),
  taskID: z.string(),
  url: z.string(),
  source: z.literal("engine-artifact"),
  viewports: BrowserPreviewViewportList,
  timeCreated: z.number(),
  timeUpdated: z.number(),
})
export type PersistedBrowserPreviewTarget = z.infer<typeof PersistedBrowserPreviewTarget>

const PersistedBrowserPreviewEvidenceFields = {
  id: z.string(),
  taskID: z.string(),
  targetID: z.string(),
  viewportID: z.string(),
  regionID: z.string().optional(),
  stateID: z.string().optional(),
  cropIntent: BrowserPreviewCropIntent.optional(),
  resourceRefs: z.record(z.string(), TaskArtifactRefSchema),
  summary: z.string(),
  diagnostics: z.string().array(),
  timeCompleted: z.number(),
  timeCreated: z.number(),
}
export const PersistedBrowserPreviewEvidence = z.union([
  z
    .object({
      ...PersistedBrowserPreviewEvidenceFields,
      operationKind: z.literal("preview-capture"),
      status: z.literal("passed"),
      capture: StoredBrowserPreviewPassedCapture,
    })
    .strict(),
  z
    .object({
      ...PersistedBrowserPreviewEvidenceFields,
      operationKind: z.literal("preview-capture"),
      status: z.literal("failed"),
      capture: z.union([BrowserPreviewCaptureFailure, StoredBrowserPreviewFailedCaptured]),
    })
    .strict(),
  z
    .object({
      ...PersistedBrowserPreviewEvidenceFields,
      operationKind: z.literal("reference-comparison"),
      status: BrowserPreviewEvidenceStatus,
      capture: StoredBrowserPreviewReferenceComparisonCapture,
    })
    .strict(),
  z
    .object({
      ...PersistedBrowserPreviewEvidenceFields,
      operationKind: z.literal("scroll-slice-comparison"),
      status: BrowserPreviewEvidenceStatus,
      capture: StoredBrowserPreviewScrollSliceComparisonCapture,
    })
    .strict(),
  z
    .object({
      ...PersistedBrowserPreviewEvidenceFields,
      operationKind: z.literal("layout-geometry"),
      status: z.literal("passed"),
      capture: BrowserPreviewPassedLayoutGeometryCapture,
    })
    .strict(),
  z
    .object({
      ...PersistedBrowserPreviewEvidenceFields,
      operationKind: z.literal("layout-geometry"),
      status: z.literal("failed"),
      capture: BrowserPreviewFailedLayoutGeometryCapture,
    })
    .strict(),
])
export type PersistedBrowserPreviewEvidence = z.infer<typeof PersistedBrowserPreviewEvidence>

export const PublicBrowserPreviewEvidence = z
  .object({
    id: z.string(),
    taskID: z.string(),
    targetID: z.string(),
    viewportID: z.string(),
    operationKind: BrowserPreviewEvidenceOperationKind,
    regionID: z.string().optional(),
    stateID: z.string().optional(),
    cropIntent: BrowserPreviewCropIntent.optional(),
    status: BrowserPreviewEvidenceStatus,
    captureAvailable: z.boolean(),
    summary: z.string(),
    diagnostics: z.string().array(),
    timeCompleted: z.number(),
    timeCreated: z.number(),
  })
  .strict()
export type PublicBrowserPreviewEvidence = z.infer<typeof PublicBrowserPreviewEvidence>

const PersistedBrowserPreviewTargetPayload = z
  .object({
    url: z.string(),
    source: z.literal("engine-artifact"),
    viewports: BrowserPreviewViewportList,
  })
  .strict()

function parseBrowserPreviewTargetPayload(row: typeof EngineArtifactTable.$inferSelect) {
  const parsed = PersistedBrowserPreviewTargetPayload.safeParse(row.payload)
  if (parsed.success) return parsed.data
  const reason = parsed.error.issues.map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`).join("; ")
  throw new BrowserPreviewTargetCorruptionError({
    taskID: row.task_id,
    targetID: row.id,
    reason,
    message: `Browser preview target corrupt: ${row.id} (${reason})`,
  })
}

const PersistedBrowserPreviewEvidencePayload = z
  .object({
    target_id: z.string().min(1),
    viewport_id: z.string().min(1),
    operation_kind: BrowserPreviewEvidenceOperationKind,
    region_id: z.string().optional(),
    state_id: z.string().optional(),
    crop_intent: BrowserPreviewCropIntent.optional(),
    resource_roles: z.record(z.string().regex(/^[a-z][a-z0-9_]*$/), z.number().int().nonnegative()),
    status: BrowserPreviewEvidenceStatus,
    summary: z.string().min(1),
    capture: z.unknown(),
    diagnostics: z.string().array(),
    time_completed: z.number(),
  })
  .strict()

export function persistBrowserPreviewTarget(input: {
  taskID: string
  url: string
  viewports: readonly BrowserPreviewViewport[]
  now?: number
}): Promise<PersistedBrowserPreviewTarget> {
  const canonicalUrl = canonicalBrowserPreviewUrl(input.url)
  if (!canonicalUrl) throw new Error(`Invalid Browser Preview URL: ${input.url}`)
  const viewports = normalizeBrowserPreviewViewports(input.viewports)
  const persisted = Database.transaction((db) => {
    const existing = db
      .select({ artifact: EngineArtifactTable })
      .from(EngineBrowserPreviewTargetIdentityTable)
      .innerJoin(EngineArtifactTable, eq(EngineBrowserPreviewTargetIdentityTable.artifact_id, EngineArtifactTable.id))
      .where(
        and(
          eq(EngineBrowserPreviewTargetIdentityTable.task_id, input.taskID),
          eq(EngineBrowserPreviewTargetIdentityTable.canonical_url, canonicalUrl),
        ),
      )
      .get()?.artifact
    const now = Math.max(input.now ?? Date.now(), existing ? existing.time_updated + 1 : 0)
    const payload = { url: canonicalUrl, source: "engine-artifact" as const, viewports }
    if (existing) {
      patchEngineArtifact(db, { id: existing.id, label: "BrowserPreviewTarget", payload, timeUpdated: now })
      return {
        id: existing.id,
        taskID: existing.task_id,
        url: canonicalUrl,
        source: "engine-artifact" as const,
        viewports,
        timeCreated: existing.time_created,
        timeUpdated: now,
      }
    }
    const id = Identifier.ascending("artifact")
    insertEngineArtifact(db, {
      id,
      taskID: input.taskID,
      kind: BROWSER_PREVIEW_TARGET_KIND,
      label: "BrowserPreviewTarget",
      payload,
      timeCreated: now,
    })
    db.insert(EngineBrowserPreviewTargetIdentityTable)
      .values({ task_id: input.taskID, canonical_url: canonicalUrl, artifact_id: id })
      .run()
    return {
      id,
      taskID: input.taskID,
      url: canonicalUrl,
      source: "engine-artifact" as const,
      viewports,
      timeCreated: now,
      timeUpdated: now,
    }
  })
  return EngineProtocol.emit(
    Event.TaskUpdated,
    {
      taskID: input.taskID,
      summary: "Browser preview target updated",
    },
    { source: "browser-preview.target" },
  ).then(() => persisted)
}

export function promoteBrowserPreviewTarget(input: {
  taskID: string
  targetID: string
  now?: number
}): Promise<PersistedBrowserPreviewTarget | undefined> {
  const existing = findBrowserPreviewTargetByID(input)
  if (!existing) return Promise.resolve(undefined)
  const now = Math.max(input.now ?? Date.now(), existing.timeUpdated + 1)
  updateEngineArtifact({
    id: existing.id,
    label: "BrowserPreviewTarget",
    timeUpdated: now,
  })
  const persisted: PersistedBrowserPreviewTarget = {
    ...existing,
    timeUpdated: now,
  }
  return EngineProtocol.emit(
    Event.TaskUpdated,
    {
      taskID: input.taskID,
      summary: "Browser preview target updated",
    },
    { source: "browser-preview.target" },
  ).then(() => persisted)
}

export function findRecentBrowserPreviewTargets(taskID: string, limit = 12): PersistedBrowserPreviewTarget[] {
  const rows = Database.use((db) =>
    db
      .select({ artifact: EngineArtifactTable })
      .from(EngineBrowserPreviewTargetIdentityTable)
      .innerJoin(EngineArtifactTable, eq(EngineBrowserPreviewTargetIdentityTable.artifact_id, EngineArtifactTable.id))
      .where(eq(EngineBrowserPreviewTargetIdentityTable.task_id, taskID))
      .orderBy(
        desc(EngineArtifactTable.time_updated),
        desc(EngineArtifactTable.time_created),
        desc(EngineArtifactTable.id),
      )
      .limit(limit)
      .all(),
  )
  return rows.map(({ artifact: row }) => {
    const payload = parseBrowserPreviewTargetPayload(row)
    return {
      id: row.id,
      taskID: row.task_id,
      url: payload.url,
      source: payload.source,
      viewports: payload.viewports,
      timeCreated: row.time_created,
      timeUpdated: row.time_updated,
    }
  })
}

export function findBrowserPreviewTargetByID(input: {
  taskID: string
  targetID: string
}): PersistedBrowserPreviewTarget | undefined {
  const row = Database.use((db) =>
    db
      .select()
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.id, input.targetID),
          eq(EngineArtifactTable.kind, BROWSER_PREVIEW_TARGET_KIND),
        ),
      )
      .limit(1)
      .get(),
  )
  if (!row) return undefined
  const payload = parseBrowserPreviewTargetPayload(row)
  return {
    id: row.id,
    taskID: row.task_id,
    url: payload.url,
    source: payload.source,
    viewports: payload.viewports,
    timeCreated: row.time_created,
    timeUpdated: row.time_updated,
  }
}

function browserPreviewEvidenceCorruption(
  input: { taskID: string; evidenceID?: string; id?: string },
  detail: {
    reason: string
    artifactPath?: string
    expectedSha?: string
    actualSha?: string
  },
): InstanceType<typeof BrowserPreviewEvidenceCorruptionError> {
  const evidenceID = input.evidenceID ?? input.id
  if (!evidenceID) throw new Error("browserPreviewEvidenceCorruption requires evidenceID or id")
  return new BrowserPreviewEvidenceCorruptionError({
    taskID: input.taskID,
    evidenceID,
    reason: detail.reason,
    message: `Browser preview evidence corrupt: ${evidenceID} (${detail.reason})`,
    ...(detail.artifactPath ? { artifactPath: detail.artifactPath } : {}),
    ...(detail.expectedSha ? { expectedSha: detail.expectedSha } : {}),
    ...(detail.actualSha ? { actualSha: detail.actualSha } : {}),
  })
}

type ParsedBrowserPreviewEvidenceRow = Readonly<{
  evidence: PersistedBrowserPreviewEvidence
  envelope: z.infer<typeof EngineArtifactEnvelopeSchema>
}>

function parseBrowserPreviewEvidenceRow(row: EngineArtifactRow): ParsedBrowserPreviewEvidenceRow {
  const input = { taskID: row.task_id, evidenceID: row.id }
  if (row.kind !== BROWSER_PREVIEW_EVIDENCE_KIND) {
    throw browserPreviewEvidenceCorruption(input, {
      reason: `unexpected Engine Artifact kind ${row.kind}`,
    })
  }
  const envelope = EngineArtifactEnvelopeSchema.safeParse(row.payload)
  if (!envelope.success || envelope.data.artifact_type !== BROWSER_PREVIEW_EVIDENCE_ARTIFACT_TYPE) {
    throw browserPreviewEvidenceCorruption(input, {
      reason: `transport envelope invalid: ${
        envelope.success ? `unexpected artifact_type ${envelope.data.artifact_type}` : envelope.error.message
      }`,
    })
  }
  const parsed = PersistedBrowserPreviewEvidencePayload.safeParse(envelope.data.payload)
  if (!parsed.success) {
    throw browserPreviewEvidenceCorruption(input, {
      reason: `payload schema invalid: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "payload"} ${issue.message}`)
        .join("; ")}`,
    })
  }
  const payload = parsed.data
  const operationCapture = StoredBrowserPreviewOperationEvidence.safeParse({
    operation_kind: payload.operation_kind,
    status: payload.status,
    capture: payload.capture,
  })
  if (!operationCapture.success) {
    throw browserPreviewEvidenceCorruption(input, {
      reason: `capture schema invalid: ${operationCapture.error.issues
        .map((issue) => `${issue.path.join(".") || "capture"} ${issue.message}`)
        .join("; ")}`,
    })
  }
  if (payload.operation_kind === "reference-comparison" && payload.status === "passed" && !payload.crop_intent) {
    throw browserPreviewEvidenceCorruption(input, {
      reason: "passed reference-comparison missing crop_intent",
    })
  }
  const roleEntries = Object.entries(payload.resource_roles)
  const referencedIndexes = new Set<number>()
  const resourceRefs: Record<string, TaskArtifactRef> = {}
  for (const [role, index] of roleEntries) {
    const resource = envelope.data.resources[index]
    if (!resource) {
      throw browserPreviewEvidenceCorruption(input, {
        reason: `resource role ${role} references missing envelope resource ${index}`,
      })
    }
    referencedIndexes.add(index)
    resourceRefs[role] = resource
  }
  if (referencedIndexes.size !== envelope.data.resources.length) {
    throw browserPreviewEvidenceCorruption(input, {
      reason: "transport envelope contains an unregistered resource",
    })
  }
  if (!resourceRefs.manifest) {
    throw browserPreviewEvidenceCorruption(input, {
      reason: "transport envelope is missing manifest resource role",
    })
  }
  return {
    envelope: envelope.data,
    evidence: PersistedBrowserPreviewEvidence.parse({
      id: row.id,
      taskID: row.task_id,
      targetID: payload.target_id,
      viewportID: payload.viewport_id,
      operationKind: payload.operation_kind,
      regionID: payload.region_id,
      stateID: payload.state_id,
      cropIntent: payload.crop_intent,
      resourceRefs,
      status: payload.status,
      summary: payload.summary,
      capture: operationCapture.data.capture,
      diagnostics: payload.diagnostics,
      timeCompleted: payload.time_completed,
      timeCreated: row.time_created,
    }),
  }
}

function findBrowserPreviewEvidenceRowByID(input: {
  taskID: string
  evidenceID: string
}): EngineArtifactRow | undefined {
  return Database.use((db) =>
    db
      .select()
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.id, input.evidenceID),
          eq(EngineArtifactTable.kind, BROWSER_PREVIEW_EVIDENCE_KIND),
        ),
      )
      .limit(1)
      .get(),
  )
}

export async function findReadableBrowserPreviewEvidenceByID(input: {
  projectRoot: string
  taskID: string
  evidenceID: string
}): Promise<PersistedBrowserPreviewEvidence | undefined> {
  return (await readBrowserPreviewEvidenceByID(input))?.evidence
}

export type ReadableBrowserPreviewEvidence = {
  evidence: PersistedBrowserPreviewEvidence
  envelope: z.infer<typeof EngineArtifactEnvelopeSchema>
  bytesByRole: ReadonlyMap<string, Buffer>
  captureRole?: string
}

/**
 * Loads Browser Preview evidence from one already-resolved exact Engine
 * Artifact version. Callers that hold a digest locator must resolve it once
 * and pass that row here; this function never performs an ID-only current-row
 * lookup.
 */
export async function readBrowserPreviewEvidenceByRow(input: {
  projectRoot: string
  row: EngineArtifactRow
}): Promise<ReadableBrowserPreviewEvidence> {
  const { evidence, envelope } = parseBrowserPreviewEvidenceRow(input.row)
  const bytesByRole = await readBrowserPreviewEvidenceResources(input.projectRoot, evidence)
  const captureRole =
    evidence.operationKind === "preview-capture" && evidence.resourceRefs.capture
      ? "capture"
      : undefined
  return { evidence, envelope, bytesByRole, captureRole }
}

export async function readBrowserPreviewEvidenceByID(input: {
  projectRoot: string
  taskID: string
  evidenceID: string
}): Promise<ReadableBrowserPreviewEvidence | undefined> {
  const row = findBrowserPreviewEvidenceRowByID(input)
  if (!row) return undefined
  return readBrowserPreviewEvidenceByRow({ projectRoot: input.projectRoot, row })
}

export async function readBrowserPreviewEvidenceCapture(input: {
  projectRoot: string
  taskID: string
  evidenceID: string
}): Promise<Buffer | undefined> {
  const loaded = await readBrowserPreviewEvidenceByID(input)
  if (!loaded || loaded.evidence.operationKind !== "preview-capture") return undefined
  return loaded.captureRole ? loaded.bytesByRole.get(loaded.captureRole) : undefined
}

export async function readBrowserPreviewEvidenceArtifact(input: {
  projectRoot: string
  taskID: string
  evidenceID: string
  artifactName: "source" | "implementation" | "side-by-side" | "diff"
}): Promise<Buffer | undefined> {
  const loaded = await readBrowserPreviewEvidenceByID(input)
  if (!loaded || loaded.evidence.operationKind !== "reference-comparison") return undefined
  const keyByName: Record<typeof input.artifactName, string> = {
    source: "source_crop",
    implementation: "implementation_crop",
    "side-by-side": "side_by_side",
    diff: "diff",
  }
  const role = keyByName[input.artifactName]
  return loaded.bytesByRole.get(role)
}

export type PersistBrowserPreviewEvidenceInput = {
  projectRoot: string
  taskID: string
  targetID: string
  viewportID: string
  operationKind: "preview-capture" | "reference-comparison" | "scroll-slice-comparison" | "layout-geometry"
  regionID?: string
  stateID?: string
  cropIntent?: BrowserPreviewCropIntentValue
  manifestPath: string
  artifactPaths?: Record<string, string | undefined>
  status: "passed" | "failed"
  summary: string
  capture?: unknown
  diagnostics: string[]
  now?: number
}

type PreparedBrowserPreviewEvidence = Readonly<{
  id: string
  input: PersistBrowserPreviewEvidenceInput
  now: number
  envelope: z.infer<typeof EngineArtifactEnvelopeSchema>
  resourceSnapshot: Awaited<ReturnType<typeof publishEngineArtifactResources>>
}>

export async function persistBrowserPreviewEvidence(input: PersistBrowserPreviewEvidenceInput): Promise<string> {
  const id = Identifier.ascending("artifact")
  await persistBrowserPreviewEvidenceBatch([{ id, input }])
  return id
}

export async function persistBrowserPreviewEvidenceBatch(
  entries: readonly { id: string; input: PersistBrowserPreviewEvidenceInput }[],
): Promise<void> {
  const prepared: PreparedBrowserPreviewEvidence[] = []
  try {
    for (const entry of entries) prepared.push(await prepareBrowserPreviewEvidence(entry.id, entry.input))
    Database.transaction((db) => {
      const taskIDs = new Set<string>()
      for (const item of prepared) {
        const insertedID = insertEngineArtifact(db, {
          id: item.id,
          taskID: item.input.taskID,
          kind: BROWSER_PREVIEW_EVIDENCE_KIND,
          label: "capture",
          payload: item.envelope,
          timeCreated: item.now,
        })
        if (insertedID !== item.id) throw new Error("Browser preview evidence identity changed during persistence")
        taskIDs.add(item.input.taskID)
      }
      for (const taskID of taskIDs) {
        EngineProtocol.emitInTransaction(
          Event.TaskUpdated,
          {
            taskID,
            summary: "Browser preview evidence updated",
          },
          { source: "browser-preview.evidence" },
        )
      }
    })
  } catch (cause) {
    const cleanupFailures: unknown[] = []
    for (const item of prepared.toReversed()) {
      try {
        await discardEngineArtifactResources({
          projectID: requireTask(item.input.taskID).project_id,
          projectDirectory: item.input.projectRoot,
          taskID: item.input.taskID,
          snapshot: item.resourceSnapshot.snapshot,
        })
      } catch (cleanupCause) {
        cleanupFailures.push(cleanupCause)
      }
    }
    if (cleanupFailures.length > 0) {
      throw new AggregateError(
        [cause, ...cleanupFailures],
        "Browser preview evidence persistence and resource cleanup both failed",
      )
    }
    throw cause
  }
}

async function prepareBrowserPreviewEvidence(
  id: string,
  input: PersistBrowserPreviewEvidenceInput,
): Promise<PreparedBrowserPreviewEvidence> {
  const now = input.now ?? Date.now()
  const projectRoot = input.projectRoot
  const operationKind = BrowserPreviewEvidenceOperationKind.parse(input.operationKind)
  const status = BrowserPreviewEvidenceStatus.parse(input.status)
  const operationCapture = BrowserPreviewOperationEvidence.parse({
    operation_kind: operationKind,
    status,
    capture: input.capture,
  })
  const artifactPaths = input.artifactPaths
    ? Object.fromEntries(
        Object.entries(input.artifactPaths)
          .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0)
          .map(([key, value]) => [
            z.string().regex(/^[a-z][a-z0-9_]*$/).parse(key),
            toBrowserPreviewRuntimeRelativePath(projectRoot, input.taskID, value),
          ]),
      )
    : undefined
  if (operationKind === "reference-comparison" && status === "passed") {
    if (!input.cropIntent) {
      throw new Error("passed reference-comparison evidence requires cropIntent")
    }
    const missing = REQUIRED_REFERENCE_COMPARISON_ARTIFACTS.filter((key) => !artifactPaths?.[key])
    if (missing.length > 0) {
      throw new Error(`passed reference-comparison evidence requires artifact path(s): ${missing.join(", ")}`)
    }
  }
  if (operationKind === "scroll-slice-comparison" && status === "passed") {
    const missing = REQUIRED_SCROLL_SLICE_COMPARISON_ARTIFACTS.filter((key) => !artifactPaths?.[key])
    if (missing.length > 0) {
      throw new Error(`passed scroll-slice-comparison evidence requires artifact path(s): ${missing.join(", ")}`)
    }
  }
  if (!input.manifestPath?.trim()) {
    throw new Error("Browser preview evidence requires manifestPath")
  }
  const manifestPath = toBrowserPreviewRuntimeRelativePath(projectRoot, input.taskID, input.manifestPath)
  const rolePaths = new Map<string, string>([["manifest", manifestPath]])
  for (const [role, artifactPath] of Object.entries(artifactPaths ?? {}).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    rolePaths.set(role, artifactPath)
  }
  const capturePaths = collectRuntimePathRefs(operationCapture.capture).map((artifactPath) =>
    toBrowserPreviewRuntimeRelativePath(projectRoot, input.taskID, artifactPath),
  )
  const previewCapturePath =
    operationCapture.operation_kind === "preview-capture" && operationCapture.capture.captured
      ? toBrowserPreviewRuntimeRelativePath(projectRoot, input.taskID, operationCapture.capture.path)
      : undefined
  if (previewCapturePath) rolePaths.set("capture", previewCapturePath)
  let auxiliaryIndex = 0
  for (const capturePath of capturePaths) {
    if ([...rolePaths.values()].includes(capturePath)) continue
    rolePaths.set(`capture_aux_${String(auxiliaryIndex++).padStart(4, "0")}`, capturePath)
  }
  const uniquePaths: string[] = []
  const pathIndex = new Map<string, number>()
  for (const artifactPath of rolePaths.values()) {
    if (pathIndex.has(artifactPath)) continue
    pathIndex.set(artifactPath, uniquePaths.length)
    uniquePaths.push(artifactPath)
  }
  const producer = {
    owner_kind: "core" as const,
    component_id: "browser-preview",
    operation_id: operationKind,
  }
  const resourceSnapshot = await publishEngineArtifactResources({
    projectID: requireTask(input.taskID).project_id,
    projectDirectory: projectRoot,
    taskID: input.taskID,
    producer,
    files: uniquePaths.map((artifactPath, index) => ({
      sourcePath: resolveBrowserPreviewRuntimeRelativePath(projectRoot, input.taskID, artifactPath),
      resourcePath: `${String(index).padStart(4, "0")}-${path.basename(artifactPath)}`,
      mediaType: browserPreviewResourceMediaType(artifactPath),
    })),
  })
  const resources = [...resourceSnapshot.artifacts]
  const resourceRoles = Object.fromEntries(
    [...rolePaths].map(([role, artifactPath]) => [role, pathIndex.get(artifactPath)!]),
  )
  const sourceArtifact = comparisonSourceArtifact(operationKind, operationCapture.capture)
  if (sourceArtifact) {
    const existingIndex = resources.findIndex((resource) => sameTaskArtifactRef(resource, sourceArtifact))
    resourceRoles.source_artifact = existingIndex >= 0 ? existingIndex : resources.push(sourceArtifact) - 1
  }
  const envelope = EngineArtifactEnvelopeSchema.parse({
    artifact_type: BROWSER_PREVIEW_EVIDENCE_ARTIFACT_TYPE,
    schema_version: 1,
    producer,
    payload: {
      target_id: input.targetID,
      viewport_id: input.viewportID,
      operation_kind: operationKind,
      ...(input.regionID ? { region_id: input.regionID } : {}),
      ...(input.stateID ? { state_id: input.stateID } : {}),
      ...(input.cropIntent ? { crop_intent: input.cropIntent } : {}),
      resource_roles: resourceRoles,
      status,
      summary: input.summary,
      capture: stripBrowserPreviewCaptureTransport(operationCapture.capture),
      diagnostics: input.diagnostics,
      time_completed: now,
    },
    resources,
    observed_artifact_locators: [],
    source_artifact_locators: [],
  })
  return { id, input, now, envelope, resourceSnapshot }
}

async function readBrowserPreviewEvidenceResources(
  projectRoot: string,
  evidence: PersistedBrowserPreviewEvidence,
): Promise<ReadonlyMap<string, Buffer>> {
  const bytesByRole = new Map<string, Buffer>()
  for (const [role, resource] of Object.entries(evidence.resourceRefs)) {
    try {
      const bytes = await readTaskArtifactRef({
        projectID: requireTask(evidence.taskID).project_id,
        projectDirectory: projectRoot,
        taskID: evidence.taskID,
        ref: resource,
      })
      bytesByRole.set(role, Buffer.from(bytes))
    } catch (error) {
      throw browserPreviewEvidenceCorruption(evidence, {
        reason: `resource role ${role} unreadable: ${error instanceof Error ? error.message : String(error)}`,
        artifactPath: `${resource.tree}/${resource.path}`,
      })
    }
  }
  if (evidence.status === "passed" && evidence.operationKind === "reference-comparison") {
    for (const key of REQUIRED_REFERENCE_COMPARISON_ARTIFACTS) {
      if (!bytesByRole.has(key)) {
        throw browserPreviewEvidenceCorruption(evidence, {
          reason: `passed reference-comparison missing required resource role: ${key}`,
        })
      }
    }
  }
  if (evidence.status === "passed" && evidence.operationKind === "scroll-slice-comparison") {
    for (const key of REQUIRED_SCROLL_SLICE_COMPARISON_ARTIFACTS) {
      if (!bytesByRole.has(key)) {
        throw browserPreviewEvidenceCorruption(evidence, {
          reason: `passed scroll-slice-comparison missing required resource role: ${key}`,
        })
      }
    }
  }
  if (evidence.status === "passed" && bytesByRole.size === 0) {
    throw browserPreviewEvidenceCorruption(evidence, {
      reason: "passed evidence has no resources",
    })
  }
  return bytesByRole
}

function browserPreviewResourceMediaType(artifactPath: string): string {
  const extension = path.extname(artifactPath).toLowerCase()
  if (extension === ".png") return "image/png"
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg"
  if (extension === ".webp") return "image/webp"
  if (extension === ".json") return "application/json"
  if (extension === ".html") return "text/html"
  if (extension === ".css") return "text/css"
  if (extension === ".svg") return "image/svg+xml"
  if (extension === ".txt" || extension === ".log") return "text/plain"
  return "application/octet-stream"
}

function sameTaskArtifactRef(left: TaskArtifactRef, right: TaskArtifactRef): boolean {
  return (
    left.snapshot.snapshot_id === right.snapshot.snapshot_id &&
    left.snapshot.manifest_sha256 === right.snapshot.manifest_sha256 &&
    left.tree === right.tree &&
    left.path === right.path &&
    left.sha256 === right.sha256
  )
}

function stripBrowserPreviewCaptureTransport(input: unknown): unknown {
  if (Array.isArray(input)) return input.map((item) => stripBrowserPreviewCaptureTransport(item))
  if (!input || typeof input !== "object") return input
  if (isTaskArtifactRef(input)) return undefined
  const output: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (key === "source_artifact" || isPathRefKey(key) || key === "artifactPaths" || key === "artifact_paths") {
      continue
    }
    const child = stripBrowserPreviewCaptureTransport(value)
    if (child !== undefined) output[key] = child
  }
  return output
}

export function toRuntimeRelativePath(projectRoot: string, input: string): string {
  const normalized = input.replaceAll("\\", "/")
  if (
    normalized === ProjectRuntimePaths.relativeRuntimeRoot() ||
    normalized.startsWith(`${ProjectRuntimePaths.relativeRuntimeRoot()}/`)
  ) {
    return normalized
  }
  if (!path.isAbsolute(input)) {
    throw new Error(`Browser preview artifact path must be runtime-relative or absolute: ${input}`)
  }
  const absolute = path.resolve(input)
  const runtimeRoot = path.resolve(ProjectRuntimePaths.projectRuntimeRoot(projectRoot))
  if (absolute !== runtimeRoot && !absolute.startsWith(runtimeRoot + path.sep)) {
    throw new Error(`Browser preview artifact path is outside task runtime: ${input}`)
  }
  return path.relative(path.resolve(projectRoot), absolute).replaceAll(path.sep, "/")
}

function toBrowserPreviewRuntimeRelativePath(projectRoot: string, taskID: string, input: string): string {
  const normalized = input.replaceAll("\\", "/")
  const browserPreviewRoot = ProjectRuntimePaths.taskRelative(taskID, "browser-preview").replaceAll("\\", "/")
  if (normalized === browserPreviewRoot || normalized.startsWith(`${browserPreviewRoot}/`)) {
    return normalized
  }
  if (
    normalized === ProjectRuntimePaths.relativeRuntimeRoot() ||
    normalized.startsWith(`${ProjectRuntimePaths.relativeRuntimeRoot()}/`)
  ) {
    throw new Error(`Browser preview artifact path must be under task browser-preview job root: ${input}`)
  }
  if (!path.isAbsolute(input)) {
    throw new Error(`Browser preview artifact path must be runtime-relative or absolute: ${input}`)
  }
  const absolute = path.resolve(input)
  const absoluteBrowserPreviewRoot = path.resolve(
    ProjectRuntimePaths.taskAbsolute(projectRoot, taskID, "browser-preview"),
  )
  if (absolute !== absoluteBrowserPreviewRoot && !absolute.startsWith(absoluteBrowserPreviewRoot + path.sep)) {
    throw new Error(`Browser preview artifact path must be under task browser-preview job root: ${input}`)
  }
  return path.relative(path.resolve(projectRoot), absolute).replaceAll(path.sep, "/")
}

export function resolveRuntimeRelativePath(projectRoot: string, input: string): string {
  const normalized = input.replaceAll("\\", "/")
  if (
    !(
      normalized === ProjectRuntimePaths.relativeRuntimeRoot() ||
      normalized.startsWith(`${ProjectRuntimePaths.relativeRuntimeRoot()}/`)
    )
  ) {
    throw new Error(`Browser preview artifact path is not a runtime-relative path: ${input}`)
  }
  if (normalized.split("/").includes("..")) {
    throw new Error(`Browser preview artifact path escapes runtime root: ${input}`)
  }
  return path.resolve(projectRoot, ...normalized.split("/"))
}

function resolveBrowserPreviewRuntimeRelativePath(projectRoot: string, taskID: string, input: string): string {
  const normalized = input.replaceAll("\\", "/")
  const browserPreviewRoot = ProjectRuntimePaths.taskRelative(taskID, "browser-preview").replaceAll("\\", "/")
  if (!(normalized === browserPreviewRoot || normalized.startsWith(`${browserPreviewRoot}/`))) {
    throw new Error(`Browser preview artifact path is outside task browser-preview job root: ${input}`)
  }
  if (normalized.split("/").includes("..")) {
    throw new Error(`Browser preview artifact path escapes runtime root: ${input}`)
  }
  return path.resolve(projectRoot, ...normalized.split("/"))
}

export function normalizeRuntimePathRefs(projectRoot: string, input: unknown): unknown {
  if (Array.isArray(input)) return input.map((item) => normalizeRuntimePathRefs(projectRoot, item))
  if (!input || typeof input !== "object") return input
  if (isTaskArtifactRef(input)) return input
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (key === "artifactPaths" && Array.isArray(value)) {
      out[key] = value.map((item) => (typeof item === "string" ? toRuntimeRelativePath(projectRoot, item) : item))
    } else if (typeof value === "string" && isPathRefKey(key)) {
      out[key] = toRuntimeRelativePath(projectRoot, value)
    } else {
      out[key] = normalizeRuntimePathRefs(projectRoot, value)
    }
  }
  return out
}

function normalizeBrowserPreviewRuntimePathRefs(projectRoot: string, taskID: string, input: unknown): unknown {
  if (Array.isArray(input))
    return input.map((item) => normalizeBrowserPreviewRuntimePathRefs(projectRoot, taskID, item))
  if (!input || typeof input !== "object") return input
  if (isTaskArtifactRef(input)) return input
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (key === "artifactPaths" && Array.isArray(value)) {
      out[key] = value.map((item) =>
        typeof item === "string" ? toBrowserPreviewRuntimeRelativePath(projectRoot, taskID, item) : item,
      )
    } else if (typeof value === "string" && isPathRefKey(key)) {
      out[key] = toBrowserPreviewRuntimeRelativePath(projectRoot, taskID, value)
    } else {
      out[key] = normalizeBrowserPreviewRuntimePathRefs(projectRoot, taskID, value)
    }
  }
  return out
}

export function stripRuntimePathRefs(input: unknown): unknown {
  if (Array.isArray(input)) return input.map((item) => stripRuntimePathRefs(item))
  if (!input || typeof input !== "object") return input
  if (isTaskArtifactRef(input)) return input
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (isPathRefKey(key) || key === "artifactPaths" || key === "artifact_paths") continue
    out[key] = stripRuntimePathRefs(value)
  }
  return out
}

export function publicBrowserPreviewEvidence(
  evidence: PersistedBrowserPreviewEvidence,
  captureAvailable: boolean,
): PublicBrowserPreviewEvidence {
  return PublicBrowserPreviewEvidence.parse({
    id: evidence.id,
    taskID: evidence.taskID,
    targetID: evidence.targetID,
    viewportID: evidence.viewportID,
    operationKind: evidence.operationKind,
    regionID: evidence.regionID,
    stateID: evidence.stateID,
    cropIntent: evidence.cropIntent,
    status: evidence.status,
    captureAvailable,
    summary: evidence.summary,
    diagnostics: evidence.diagnostics,
    timeCompleted: evidence.timeCompleted,
    timeCreated: evidence.timeCreated,
  })
}

export function collectRuntimePathRefs(input: unknown): string[] {
  const refs: string[] = []
  const seen = new Set<object>()
  const push = (value: string) => {
    const trimmed = value.trim()
    if (trimmed && !refs.includes(trimmed)) refs.push(trimmed)
  }
  const visit = (value: unknown, depth: number) => {
    if (!value || depth > 8) return
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1)
      return
    }
    if (typeof value !== "object") return
    if (isTaskArtifactRef(value)) return
    if (seen.has(value)) return
    seen.add(value)
    for (const [key, child] of Object.entries(value)) {
      if (typeof child === "string" && isPathRefKey(key)) push(child)
      if ((key === "artifactPaths" || key === "artifact_paths") && Array.isArray(child)) {
        for (const item of child) {
          if (typeof item === "string") push(item)
        }
      }
      visit(child, depth + 1)
    }
  }
  visit(input, 0)
  return refs
}

function isTaskArtifactRef(input: unknown): boolean {
  return TaskArtifactRefSchema.safeParse(input).success
}

function comparisonSourceArtifact(
  operationKind: z.infer<typeof BrowserPreviewEvidenceOperationKind>,
  capture: unknown,
) {
  if (operationKind === "reference-comparison") {
    return BrowserPreviewReferenceComparisonCapture.parse(capture).region.source_artifact
  }
  if (operationKind === "scroll-slice-comparison") {
    return BrowserPreviewScrollSliceComparisonCapture.parse(capture).source_artifact
  }
  return undefined
}

function isPathRefKey(key: string): boolean {
  return (
    key === "path" ||
    key === "screenshotPath" ||
    key === "screenshot_path" ||
    key === "implementationScreenshotPath" ||
    key === "implementation_screenshot_path" ||
    key === "manifestPath" ||
    key === "manifest_path" ||
    key === "diagnosticsPath" ||
    key === "source_crop" ||
    key === "implementation_crop" ||
    key === "module_comparison" ||
    key === "side_by_side" ||
    key === "diff"
  )
}

export async function latestBrowserPreviewEvidenceIDs(input: {
  projectRoot: string
  taskID: string
  targetID: string
}): Promise<Partial<Record<string, string>>> {
  const rows = Database.use((db) =>
    db
      .select({ id: EngineArtifactTable.id, payload: EngineArtifactTable.payload })
      .from(EngineArtifactTable)
      .where(
        and(eq(EngineArtifactTable.task_id, input.taskID), eq(EngineArtifactTable.kind, BROWSER_PREVIEW_EVIDENCE_KIND)),
      )
      .orderBy(desc(EngineArtifactTable.time_created), desc(EngineArtifactTable.id))
      .all(),
  )
  const latest: Partial<Record<string, string>> = {}
  for (const row of rows) {
    const meta = sqlEvidenceMeta(row.payload)
    if (meta?.targetID !== input.targetID) continue
    if (latest[meta.viewportID]) continue
    const readable = await findReadableBrowserPreviewEvidenceByID({
      projectRoot: input.projectRoot,
      taskID: input.taskID,
      evidenceID: row.id,
    })
    if (!readable) continue
    latest[meta.viewportID] = row.id
  }
  return latest
}

function sqlEvidenceMeta(payload: unknown): { targetID: string; viewportID: string } | undefined {
  const envelope = EngineArtifactEnvelopeSchema.safeParse(payload)
  if (!envelope.success || envelope.data.artifact_type !== BROWSER_PREVIEW_EVIDENCE_ARTIFACT_TYPE) return undefined
  const record = envelope.data.payload as Record<string, unknown>
  if (record.operation_kind !== "preview-capture") return undefined
  const targetID = typeof record.target_id === "string" ? record.target_id : undefined
  const viewportID = typeof record.viewport_id === "string" ? record.viewport_id : undefined
  if (!targetID || !viewportID) return undefined
  return { targetID, viewportID }
}
