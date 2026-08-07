import {
  ArtifactReadLocatorSchema,
  type ArtifactReadLocator,
} from "@opencorvus-ai/plugin/artifact-catalog"
import { z } from "zod"
import { artifactCatalogAuthority, readTaskArtifact, requireEngineArtifactByLocator } from "@/artifact-catalog"
import {
  BROWSER_PREVIEW_EVIDENCE_ARTIFACT_TYPE,
  BROWSER_PREVIEW_EVIDENCE_KIND,
  readBrowserPreviewEvidenceByRow,
} from "@/browser-preview/persist"
import type { VisualReview } from "./schema"

type VisualQaEvidenceType = VisualReview["evidence"][number]["type"]

const ScreenshotBearingEvidenceType = z.enum(["screenshot", "reference_comparison", "visual_diff"])

type ScreenshotBearingEvidenceType = z.infer<typeof ScreenshotBearingEvidenceType>

const BrowserPreviewEvidencePayload = z
  .object({
    operation_kind: z.enum(["preview-capture", "reference-comparison", "scroll-slice-comparison", "layout-geometry"]),
    status: z.enum(["passed", "failed"]),
    resource_roles: z.record(z.string().min(1), z.number().int().nonnegative()),
    region_id: z.string().min(1).optional(),
    viewport_id: z.string().min(1),
  })
  .passthrough()

const ExpectedOperations: Record<
  ScreenshotBearingEvidenceType,
  readonly z.infer<typeof BrowserPreviewEvidencePayload>["operation_kind"][]
> = {
  screenshot: ["preview-capture"],
  reference_comparison: ["reference-comparison"],
  visual_diff: ["reference-comparison", "scroll-slice-comparison"],
}

const RequiredImageRoles: Record<z.infer<typeof BrowserPreviewEvidencePayload>["operation_kind"], readonly string[]> = {
  "preview-capture": ["capture"],
  "reference-comparison": ["source_crop", "implementation_crop", "side_by_side"],
  "scroll-slice-comparison": ["source_crop", "implementation_crop", "side_by_side"],
  "layout-geometry": [],
}

export function visualQaArtifactLocatorKey(locator: ArtifactReadLocator): string {
  return JSON.stringify(ArtifactReadLocatorSchema.parse(locator))
}

export function formatVisualQaArtifactLocator(locator: ArtifactReadLocator): string {
  return visualQaArtifactLocatorKey(locator)
}

/**
 * Prove that one locator resolves to the exact bytes owned by the current
 * Task. The catalog reader checks Task authority, locator freshness, snapshot
 * identity, resource digest, and complete underlying bytes.
 */
export async function assertVisualQaArtifactReadable(input: {
  taskID?: string
  locator: ArtifactReadLocator
  label: string
}): Promise<void> {
  const taskID = input.taskID?.trim()
  if (!taskID) {
    throw new Error(`${input.label} cannot be verified without current Task context`)
  }
  const locator = ArtifactReadLocatorSchema.parse(input.locator)
  await readTaskArtifact({
    authority: artifactCatalogAuthority(taskID),
    read: {
      locator,
      byte_offset: 0,
      max_bytes: 1,
    },
  })
}

/**
 * Validate screenshot-bearing evidence as one exact Browser Preview envelope,
 * including the producer, operation, status, complete role mapping, and every
 * referenced resource digest. Other evidence types still require exact Task
 * readability but do not pretend to be Browser Preview visual proof.
 */
export async function assertVisualQaEvidence(input: {
  taskID?: string
  type: VisualQaEvidenceType
  locator: ArtifactReadLocator
  requirePassed: boolean
}): Promise<
  | {
      operationKind: z.infer<typeof BrowserPreviewEvidencePayload>["operation_kind"]
      status: z.infer<typeof BrowserPreviewEvidencePayload>["status"]
      regionID?: string
      viewportID: string
    }
  | undefined
> {
  const screenshotType = ScreenshotBearingEvidenceType.safeParse(input.type)
  if (!screenshotType.success) {
    await assertVisualQaArtifactReadable({
      taskID: input.taskID,
      locator: input.locator,
      label: `visual QA ${input.type} evidence`,
    })
    return undefined
  }
  if (input.locator.source !== "engine_artifact") {
    throw new Error(`visual QA ${input.type} evidence must cite the exact Browser Preview Engine Artifact envelope`)
  }
  const taskID = input.taskID?.trim()
  if (!taskID) {
    throw new Error(`visual QA ${input.type} evidence cannot be verified without current Task context`)
  }
  const row = requireEngineArtifactByLocator({
    taskID,
    locator: input.locator,
  })
  if (row.kind !== BROWSER_PREVIEW_EVIDENCE_KIND) {
    throw new Error(
      `visual QA ${input.type} evidence resolved to Engine Artifact kind=${row.kind}; expected ${BROWSER_PREVIEW_EVIDENCE_KIND}`,
    )
  }
  const loaded = await readBrowserPreviewEvidenceByRow({
    projectRoot: artifactCatalogAuthority(taskID).projectDirectory,
    row,
  })
  const envelope = loaded.envelope
  if (envelope.artifact_type !== BROWSER_PREVIEW_EVIDENCE_ARTIFACT_TYPE) {
    throw new Error(
      `visual QA ${input.type} evidence resolved to artifact_type=${envelope.artifact_type}; expected ${BROWSER_PREVIEW_EVIDENCE_ARTIFACT_TYPE}`,
    )
  }
  const payload = BrowserPreviewEvidencePayload.parse(envelope.payload)
  const expectedOperations = ExpectedOperations[screenshotType.data]
  if (!expectedOperations.includes(payload.operation_kind)) {
    throw new Error(
      `visual QA ${input.type} evidence resolved to operation_kind=${payload.operation_kind}; expected ${expectedOperations.join(" or ")}`,
    )
  }
  if (
    envelope.producer.owner_kind !== "core" ||
    envelope.producer.component_id !== "browser-preview" ||
    envelope.producer.operation_id !== payload.operation_kind
  ) {
    throw new Error(
      `visual QA ${input.type} evidence producer does not match Browser Preview operation ${payload.operation_kind}`,
    )
  }
  if (input.requirePassed && payload.status !== "passed") {
    throw new Error(
      `visual QA ${input.type} evidence status=${payload.status}; accepted visual proof requires status=passed`,
    )
  }
  const roleEntries = Object.entries(payload.resource_roles)
  const roleIndexes = new Set<number>()
  for (const [role, index] of roleEntries) {
    if (!envelope.resources[index]) {
      throw new Error(
        `visual QA ${input.type} evidence resource role ${role} points to missing resource index ${index}`,
      )
    }
    if (roleIndexes.has(index)) {
      throw new Error(`visual QA ${input.type} evidence aliases multiple resource roles to index ${index}`)
    }
    roleIndexes.add(index)
  }
  if (roleIndexes.size !== envelope.resources.length) {
    throw new Error(`visual QA ${input.type} evidence contains resources without an explicit resource role`)
  }
  if (!Object.hasOwn(payload.resource_roles, "manifest")) {
    throw new Error(`visual QA ${input.type} evidence is missing required resource role manifest`)
  }
  for (const role of RequiredImageRoles[payload.operation_kind]) {
    const index = payload.resource_roles[role]
    if (index === undefined) {
      throw new Error(`visual QA ${input.type} evidence is missing required image resource role ${role}`)
    }
    const resource = envelope.resources[index]
    if (!resource || !resource.media_type.startsWith("image/")) {
      throw new Error(`visual QA ${input.type} evidence resource role ${role} must reference an image resource`)
    }
  }
  return {
    operationKind: payload.operation_kind,
    status: payload.status,
    ...(payload.region_id ? { regionID: payload.region_id } : {}),
    viewportID: payload.viewport_id,
  }
}
