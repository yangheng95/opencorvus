import fs from "node:fs/promises"
import path from "node:path"
import {
  EngineArtifactEnvelopeSchema,
  type ArtifactReadLocator,
  type EngineArtifactLocator,
} from "@opencorvus-ai/plugin/artifact-catalog"
import {
  artifactCatalogAuthority,
  exactEngineArtifactLocator,
  readTaskArtifact,
  requireEngineArtifactByLocator,
} from "@/artifact-catalog"
import { BROWSER_PREVIEW_EVIDENCE_ARTIFACT_TYPE } from "@/browser-preview/persist"
import { recordEngineArtifact } from "@/engine/artifact"
import { requireTask } from "@/engine/store"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { requireRuntimePackage } from "@/runtime/package-require"
import { discardEngineArtifactResources, publishEngineArtifactResources } from "@/task-artifact/store"
import type { VisualReview } from "./schema"
import { assertVisualQaEvidence, formatVisualQaArtifactLocator, visualQaArtifactLocatorKey } from "./evidence"

const sharp = requireRuntimePackage<typeof import("sharp")>("sharp")

type VisualQaProblemDomRegion = VisualReview["problem_dom_regions"][number]

interface ResolvedImageEvidence {
  sourceLocator: ArtifactReadLocator
  identity: string
  bytes: Buffer
  bboxOverride?: ImageBox
}

export interface VisualQaProblemDomAnnotationResult {
  annotatedEvidenceRefs: EngineArtifactLocator[]
  diagnostics: string[]
  error?: string
}

export async function annotateVisualQaProblemDomRegion(input: {
  taskID?: string
  projectRoot?: string
  projectID?: string
  region: VisualQaProblemDomRegion
}): Promise<VisualQaProblemDomAnnotationResult> {
  const taskID = input.taskID?.trim()
  const projectRoot = input.projectRoot?.trim()
  if (!taskID || !projectRoot) {
    return {
      annotatedEvidenceRefs: [],
      diagnostics: [],
      error: "Visual QA annotation cannot verify or publish evidence without current taskID and projectRoot context.",
    }
  }
  const bbox = input.region.bbox
  if (!bbox) {
    return {
      annotatedEvidenceRefs: [],
      diagnostics: [],
      error: `problem_dom_region ${input.region.id} requires bbox before a screenshot annotation can be materialized.`,
    }
  }
  if (input.region.evidence_refs.length === 0) {
    return {
      annotatedEvidenceRefs: [],
      diagnostics: [],
      error: `problem_dom_region ${input.region.id} requires screenshot evidence_refs before annotation.`,
    }
  }

  const diagnostics: string[] = []
  const resolved: ResolvedImageEvidence[] = []
  for (const ref of input.region.evidence_refs) {
    const candidate = await resolveImageEvidenceRef({ projectRoot, taskID, ref, region: input.region })
    if ("issue" in candidate) {
      diagnostics.push(candidate.issue)
      continue
    }
    resolved.push(candidate)
  }
  const unique = uniqueResolvedEvidence(resolved)
  if (unique.length === 0) {
    return {
      annotatedEvidenceRefs: [],
      diagnostics,
      error: `problem_dom_region ${input.region.id} has no resolvable screenshot evidence to annotate.`,
    }
  }

  const taskProjectID = requireTask(taskID).project_id
  if (input.projectID && input.projectID !== taskProjectID) {
    return {
      annotatedEvidenceRefs: [],
      diagnostics: [],
      error: `problem_dom_region ${input.region.id} projectID does not match current Task authority.`,
    }
  }
  const projectID = taskProjectID
  const annotatedEvidenceRefs: EngineArtifactLocator[] = []
  const outputDir = ProjectRuntimePaths.taskAbsolute(projectRoot, taskID, "visual-qa-annotations")
  await fs.mkdir(outputDir, { recursive: true })

  for (const [index, evidence] of unique.entries()) {
    const filename = `${safeFilename(input.region.id)}-${index + 1}.annotated.png`
    const outputPath = path.join(outputDir, filename)
    const render = await renderAnnotatedPng({
      inputBytes: evidence.bytes,
      outputPath,
      sourceRef: formatVisualQaArtifactLocator(evidence.sourceLocator),
      region: input.region,
      bboxOverride: evidence.bboxOverride,
    })
    diagnostics.push(...render.diagnostics)
    annotatedEvidenceRefs.push(
      await persistVisualQaDomAnnotation({
        projectID,
        projectRoot,
        taskID,
        outputPath,
        filename,
        sourceLocator: evidence.sourceLocator,
        region: input.region,
      }),
    )
  }

  return { annotatedEvidenceRefs, diagnostics }
}

async function persistVisualQaDomAnnotation(input: {
  projectID: string
  projectRoot: string
  taskID: string
  outputPath: string
  filename: string
  sourceLocator: ArtifactReadLocator
  region: VisualQaProblemDomRegion
}): Promise<EngineArtifactLocator> {
  const producer = {
    owner_kind: "core" as const,
    component_id: "visual-qa",
    operation_id: "annotate-dom-region",
  }
  const publication = await publishEngineArtifactResources({
    projectID: input.projectID,
    projectDirectory: input.projectRoot,
    taskID: input.taskID,
    producer,
    files: [
      {
        sourcePath: input.outputPath,
        resourcePath: input.filename,
        mediaType: "image/png",
      },
    ],
  })
  try {
    const envelope = EngineArtifactEnvelopeSchema.parse({
      artifact_type: "opencorvus/visual-qa-dom-annotation",
      schema_version: 1,
      producer,
      payload: {
        source_locator: input.sourceLocator,
        problem_dom_region_id: input.region.id,
        blocker_ids: input.region.blocker_ids,
        locator: input.region.locator,
        bbox: input.region.bbox,
        resource_roles: { annotation: 0 },
      },
      resources: publication.artifacts,
      observed_artifact_locators: [],
      source_artifact_locators: [],
    })
    const artifactID = recordEngineArtifact({
      taskID: input.taskID,
      kind: "expert_output",
      label: `Visual QA DOM annotation ${input.region.id}`,
      payload: envelope,
    })
    return exactEngineArtifactLocator({
      taskID: input.taskID,
      artifactID,
    })
  } catch (cause) {
    await discardEngineArtifactResources({
      projectID: input.projectID,
      projectDirectory: input.projectRoot,
      taskID: input.taskID,
      snapshot: publication.snapshot,
    })
    throw cause
  }
}

async function resolveImageEvidenceRef(input: {
  projectRoot: string
  taskID: string
  ref: ArtifactReadLocator
  region?: VisualQaProblemDomRegion
}): Promise<ResolvedImageEvidence | { issue: string }> {
  const ref = input.ref
  if (ref.source === "task_artifact_resource") {
    if (!ref.ref.media_type.startsWith("image/")) {
      return {
        issue: `Visual QA evidence locator is not an image resource: ${formatVisualQaArtifactLocator(ref)}`,
      }
    }
    try {
      const result = await readTaskArtifact({
        authority: artifactCatalogAuthority(input.taskID),
        read: { locator: ref },
      })
      const bytes = result.attachment?.bytes
      if (!bytes) {
        return {
          issue: `Visual QA image resource did not return binary bytes: ${formatVisualQaArtifactLocator(ref)}`,
        }
      }
      return {
        sourceLocator: ref,
        identity: visualQaArtifactLocatorKey(ref),
        bytes: Buffer.from(bytes),
      }
    } catch (cause) {
      return {
        issue: `Visual QA image resource is unreadable: ${formatVisualQaArtifactLocator(ref)}: ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
      }
    }
  }
  if (ref.source === "engine_artifact") {
    const resolved = await resolveBrowserPreviewEvidenceImage({
      taskID: input.taskID,
      sourceLocator: ref,
      region: input.region,
    })
    if ("issue" in resolved) return resolved
    return resolved
  }
  return {
    issue: `Visual QA snapshot locator does not identify one screenshot resource: ${formatVisualQaArtifactLocator(ref)}`,
  }
}

async function resolveBrowserPreviewEvidenceImage(input: {
  taskID: string
  sourceLocator: EngineArtifactLocator
  region?: VisualQaProblemDomRegion
}): Promise<ResolvedImageEvidence | { issue: string }> {
  let envelope
  try {
    const row = requireEngineArtifactByLocator({
      taskID: input.taskID,
      locator: input.sourceLocator,
    })
    envelope = EngineArtifactEnvelopeSchema.parse(row.payload)
  } catch (cause) {
    return {
      issue: `Visual QA evidence locator is unreadable: ${formatVisualQaArtifactLocator(input.sourceLocator)}: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    }
  }
  if (envelope.artifact_type !== BROWSER_PREVIEW_EVIDENCE_ARTIFACT_TYPE) {
    return {
      issue: `Visual QA evidence locator is not Browser Preview evidence: ${formatVisualQaArtifactLocator(input.sourceLocator)}`,
    }
  }
  const payload = asRecord(envelope.payload)
  const operationKind = payload.operation_kind
  const resourceRoles = asRecord(payload.resource_roles)
  if (
    operationKind !== "preview-capture" &&
    operationKind !== "reference-comparison" &&
    operationKind !== "scroll-slice-comparison"
  ) {
    return {
      issue: `Visual QA evidence locator operation ${String(operationKind)} is diagnostic data, not screenshot evidence: ${formatVisualQaArtifactLocator(input.sourceLocator)}`,
    }
  }
  try {
    await assertVisualQaEvidence({
      taskID: input.taskID,
      type:
        operationKind === "preview-capture"
          ? "screenshot"
          : operationKind === "reference-comparison"
            ? "reference_comparison"
            : "visual_diff",
      locator: input.sourceLocator,
      requirePassed: false,
    })
  } catch (cause) {
    return {
      issue: `Visual QA evidence locator failed Browser Preview validation: ${formatVisualQaArtifactLocator(input.sourceLocator)}: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    }
  }
  const role = operationKind === "preview-capture" ? "capture" : "implementation_crop"
  const index = resourceRoles[role]
  if (typeof index !== "number" || !Number.isInteger(index)) {
    return {
      issue: `Browser Preview ${operationKind} evidence has no ${role} image resource: ${formatVisualQaArtifactLocator(input.sourceLocator)}`,
    }
  }
  const imageResource = envelope.resources[index]
  if (!imageResource) {
    return {
      issue: `Browser Preview ${operationKind} evidence resource role ${role} is missing: ${formatVisualQaArtifactLocator(input.sourceLocator)}`,
    }
  }
  const image = await readTaskArtifact({
    authority: artifactCatalogAuthority(input.taskID),
    read: { locator: { source: "task_artifact_resource", ref: imageResource } },
  })
  const imageBytes = image.attachment?.bytes
  if (!imageBytes) {
    return {
      issue: `Browser Preview ${operationKind} evidence resource role ${role} is not binary image data: ${formatVisualQaArtifactLocator(input.sourceLocator)}`,
    }
  }
  let bboxOverride: ImageBox | undefined
  if (operationKind === "scroll-slice-comparison") {
    const manifestIndex = resourceRoles.manifest
    const manifestResource =
      typeof manifestIndex === "number" && Number.isInteger(manifestIndex)
        ? envelope.resources[manifestIndex]
        : undefined
    if (!manifestResource) {
      return {
        issue: `scroll-slice evidence has no manifest for coordinate mapping: ${formatVisualQaArtifactLocator(input.sourceLocator)}`,
      }
    }
    const manifest = await readTaskArtifact({
      authority: artifactCatalogAuthority(input.taskID),
      read: { locator: { source: "task_artifact_resource", ref: manifestResource } },
    })
    const offset = await readScrollSliceOffset({
      manifestBytes: manifest.chunk.text ? Buffer.from(manifest.chunk.text, "utf8") : undefined,
      sourceRef: formatVisualQaArtifactLocator(input.sourceLocator),
    })
    if ("issue" in offset) return offset
    const bbox = input.region?.bbox
    bboxOverride = bbox
      ? {
          x: bbox.x,
          y: bbox.y - offset.scrollY,
          width: bbox.width,
          height: bbox.height,
        }
      : undefined
  }
  return {
    sourceLocator: input.sourceLocator,
    identity: `${visualQaArtifactLocatorKey(input.sourceLocator)}:${role}`,
    bytes: Buffer.from(imageBytes),
    ...(bboxOverride ? { bboxOverride } : {}),
  }
}

async function readScrollSliceOffset(input: {
  manifestBytes?: Buffer
  sourceRef: string
}): Promise<{ scrollY: number } | { issue: string }> {
  if (!input.manifestBytes) {
    return { issue: `scroll-slice evidence has no manifest for coordinate mapping: ${input.sourceRef}` }
  }
  try {
    const manifest = JSON.parse(input.manifestBytes.toString("utf8")) as unknown
    const record = manifest && typeof manifest === "object" ? (manifest as Record<string, unknown>) : {}
    const scrollY = typeof record.scrollY === "number" ? record.scrollY : undefined
    if (scrollY === undefined) {
      return { issue: `scroll-slice manifest has no numeric scrollY for coordinate mapping: ${input.sourceRef}` }
    }
    return { scrollY }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return { issue: `scroll-slice manifest is unreadable for annotation: ${input.sourceRef}: ${detail}` }
  }
}

function parseImageBox(value: unknown): ImageBox | undefined {
  const record = asRecord(value)
  const x = record.x
  const y = record.y
  const width = record.width
  const height = record.height
  if (typeof x !== "number" || typeof y !== "number" || typeof width !== "number" || typeof height !== "number") {
    return undefined
  }
  return { x, y, width, height }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function uniqueResolvedEvidence(items: ResolvedImageEvidence[]): ResolvedImageEvidence[] {
  const seen = new Set<string>()
  const result: ResolvedImageEvidence[] = []
  for (const item of items) {
    const key = item.identity
    if (seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }
  return result
}

async function renderAnnotatedPng(input: {
  inputBytes: Buffer
  outputPath: string
  sourceRef: string
  region: VisualQaProblemDomRegion
  bboxOverride?: ImageBox
}): Promise<{ diagnostics: string[] }> {
  const image = sharp(input.inputBytes, { failOn: "error" })
  const metadata = await image.metadata()
  const width = metadata.width
  const height = metadata.height
  if (!width || !height) throw new Error(`screenshot evidence has no readable dimensions: ${input.sourceRef}`)

  const mapped = mapDomBoxToImage({
    bbox: input.bboxOverride ?? input.region.bbox!,
    viewport: input.region.viewport,
    imageWidth: width,
    imageHeight: height,
  })
  const labelLines = annotationLabelLines(input.region, input.sourceRef, mapped.mode)
  const overlay = annotationSvg({
    width,
    height,
    box: mapped.box,
    labelLines,
  })
  await sharp(input.inputBytes, { failOn: "error" })
    .composite([{ input: Buffer.from(overlay), top: 0, left: 0 }])
    .png()
    .toFile(input.outputPath)
  return { diagnostics: mapped.diagnostics }
}

interface ImageBox {
  x: number
  y: number
  width: number
  height: number
}

function mapDomBoxToImage(input: {
  bbox: NonNullable<VisualQaProblemDomRegion["bbox"]>
  viewport?: VisualQaProblemDomRegion["viewport"]
  imageWidth: number
  imageHeight: number
}): { box: ImageBox; mode: string; diagnostics: string[] } {
  const direct = normalizeBox(input.bbox)
  if (boxFitsImage(direct, input.imageWidth, input.imageHeight)) {
    return { box: direct, mode: "css-pixel", diagnostics: [] }
  }
  if (input.viewport) {
    const scaled = normalizeBox({
      x: input.bbox.x * (input.imageWidth / input.viewport.width),
      y: input.bbox.y * (input.imageHeight / input.viewport.height),
      width: input.bbox.width * (input.imageWidth / input.viewport.width),
      height: input.bbox.height * (input.imageHeight / input.viewport.height),
    })
    if (boxFitsImage(scaled, input.imageWidth, input.imageHeight)) {
      return { box: scaled, mode: "viewport-scaled", diagnostics: [] }
    }
  }
  return {
    box: clampBoxToImage(direct, input.imageWidth, input.imageHeight),
    mode: "clamped-css-pixel",
    diagnostics: [
      `DOM bbox exceeded screenshot bounds; annotation was clamped to image ${input.imageWidth}x${input.imageHeight}.`,
    ],
  }
}

function normalizeBox(box: ImageBox): ImageBox {
  return {
    x: finiteNonnegative(box.x),
    y: finiteNonnegative(box.y),
    width: Math.max(1, finiteNonnegative(box.width)),
    height: Math.max(1, finiteNonnegative(box.height)),
  }
}

function finiteNonnegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function boxFitsImage(box: ImageBox, width: number, height: number): boolean {
  return box.x < width && box.y < height && box.x + box.width <= width && box.y + box.height <= height
}

function clampBoxToImage(box: ImageBox, width: number, height: number): ImageBox {
  const x = Math.min(Math.max(0, box.x), Math.max(0, width - 1))
  const y = Math.min(Math.max(0, box.y), Math.max(0, height - 1))
  const maxWidth = Math.max(1, width - x)
  const maxHeight = Math.max(1, height - y)
  return {
    x,
    y,
    width: Math.min(Math.max(1, box.width), maxWidth),
    height: Math.min(Math.max(1, box.height), maxHeight),
  }
}

function annotationLabelLines(region: VisualQaProblemDomRegion, sourceRef: string, coordinateMode: string): string[] {
  const bbox = region.bbox
  const searchTerms = region.code_search_terms.join(", ")
  return [
    `DOM REGION: ${region.id}`,
    `blockers: ${region.blocker_ids.join(", ")}`,
    `locator: ${region.locator}`,
    bbox ? `bbox: x=${bbox.x} y=${bbox.y} w=${bbox.width} h=${bbox.height}` : "",
    `coords: ${coordinateMode}`,
    searchTerms ? `search: ${searchTerms}` : "",
    `source: ${sourceRef}`,
    `notes: ${region.notes}`,
  ].filter((line) => line.trim().length > 0)
}

function annotationSvg(input: { width: number; height: number; box: ImageBox; labelLines: string[] }): string {
  const stroke = Math.max(3, Math.round(Math.min(input.width, input.height) / 300))
  const padding = 10
  const fontSize = Math.max(13, Math.min(18, Math.round(input.width / 80)))
  const lineHeight = Math.round(fontSize * 1.35)
  const wrapped = input.labelLines.flatMap((line) => wrapText(line, 74)).slice(0, 10)
  const labelWidth = Math.min(input.width - padding * 2, 760)
  const labelHeight = Math.min(input.height - padding * 2, padding * 2 + wrapped.length * lineHeight)
  const labelX = clamp(input.box.x, padding, Math.max(padding, input.width - labelWidth - padding))
  const preferredAbove = input.box.y - labelHeight - padding
  const preferredBelow = input.box.y + input.box.height + padding
  const labelY =
    preferredAbove >= padding
      ? preferredAbove
      : clamp(preferredBelow, padding, Math.max(padding, input.height - labelHeight - padding))
  const textY = labelY + padding + fontSize
  const text = wrapped
    .map(
      (line, index) =>
        `<text x="${labelX + padding}" y="${textY + index * lineHeight}" fill="#ffffff">${escapeXml(line)}</text>`,
    )
    .join("")
  const centerX = input.box.x + input.box.width / 2
  const centerY = input.box.y + input.box.height / 2
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${input.width}" height="${input.height}" viewBox="0 0 ${input.width} ${input.height}">`,
    `<rect x="${input.box.x}" y="${input.box.y}" width="${input.box.width}" height="${input.box.height}" fill="rgba(255,23,68,0.12)" stroke="#ff1744" stroke-width="${stroke}"/>`,
    `<line x1="${centerX}" y1="${centerY}" x2="${labelX}" y2="${labelY + labelHeight / 2}" stroke="#ff1744" stroke-width="${stroke}" stroke-linecap="round"/>`,
    `<rect x="${labelX}" y="${labelY}" width="${labelWidth}" height="${labelHeight}" rx="4" ry="4" fill="rgba(15,23,42,0.94)" stroke="#ff1744" stroke-width="${stroke}"/>`,
    `<g font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="700">${text}</g>`,
    "</svg>",
  ].join("")
}

function wrapText(input: string, maxChars: number): string[] {
  if (input.length <= maxChars) return [input]
  const words = input.split(/\s+/)
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length <= maxChars) {
      current = next
      continue
    }
    if (current) lines.push(current)
    current = word.length > maxChars ? `${word.slice(0, maxChars - 3)}...` : word
  }
  if (current) lines.push(current)
  return lines
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function escapeXml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

function safeFilename(input: string): string {
  const safe = input.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "")
  return safe || "visual-qa-dom-region"
}
