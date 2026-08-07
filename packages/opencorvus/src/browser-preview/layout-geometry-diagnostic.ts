import fs from "node:fs/promises"
import path from "node:path"
import { isDeepStrictEqual } from "node:util"
import z from "zod"
import { BrowserRuntime } from "@/browser/runtime"
import { BrowserNodeSidecarError, runTaskBrowserNodeSidecar } from "@/browser/runtime/node-executor"
import { resolveBrowserNodeSidecarRuntime } from "@/browser/runtime/node-sidecar"
import { Identifier } from "@/id/id"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { RUNTIME_CAPTURE_DEFAULTS } from "@/runtime/capture-contract"
import {
  findBrowserPreviewTargetByID,
  persistBrowserPreviewEvidenceBatch,
  type PersistBrowserPreviewEvidenceInput,
} from "./persist"
import { throwAfterBrowserPreviewPublicationCleanup } from "./publication-cleanup"
import { BrowserPreviewRegionBox, BrowserPreviewRegionLocator } from "./region-schema"
import { browserPreviewViewportByID, BrowserPreviewViewportID } from "./viewport"

export const BrowserPreviewLayoutGeometryWidthSample = z
  .object({
    id: z.string().min(1),
    width: z.number().int().positive(),
    height: z.number().int().positive().optional(),
  })
  .strict()
export type BrowserPreviewLayoutGeometryWidthSample = z.infer<typeof BrowserPreviewLayoutGeometryWidthSample>

export const BrowserPreviewLayoutGeometryRegion = z
  .object({
    regionID: z.string().min(1),
    locator: BrowserPreviewRegionLocator,
    sourceBBox: BrowserPreviewRegionBox.optional(),
    sourceRefs: z.array(z.string().min(1)).default([]),
  })
  .strict()
export type BrowserPreviewLayoutGeometryRegion = z.infer<typeof BrowserPreviewLayoutGeometryRegion>

export const BrowserPreviewLayoutGeometryAlignmentEdge = z.enum([
  "left",
  "right",
  "top",
  "bottom",
  "center-x",
  "center-y",
  "width",
  "height",
])
export type BrowserPreviewLayoutGeometryAlignmentEdge = z.infer<typeof BrowserPreviewLayoutGeometryAlignmentEdge>

export const BrowserPreviewLayoutGeometryAlignmentGroup = z
  .object({
    id: z.string().min(1),
    regionIDs: z.array(z.string().min(1)).min(2),
    edges: z.array(BrowserPreviewLayoutGeometryAlignmentEdge).min(1),
  })
  .strict()
export type BrowserPreviewLayoutGeometryAlignmentGroup = z.infer<typeof BrowserPreviewLayoutGeometryAlignmentGroup>

export const BrowserPreviewLayoutGeometryDiagnosticRequest = z
  .object({
    targetID: z.string().min(1),
    viewportID: BrowserPreviewViewportID,
    route: z.string().min(1).default("/"),
    regions: BrowserPreviewLayoutGeometryRegion.array().min(1),
    alignmentGroups: BrowserPreviewLayoutGeometryAlignmentGroup.array()
      .default([])
      .describe(
        "Explicit groups of implementation regions that should share page rails, edges, centers, or dimensions. Produces numeric diagnostics only.",
      ),
    widthSamples: BrowserPreviewLayoutGeometryWidthSample.array()
      .default([])
      .describe(
        "Explicit additional desktop width samples for same-component scaling diagnostics. The selected viewport is always captured first.",
      ),
  })
  .strict()
export type BrowserPreviewLayoutGeometryDiagnosticRequest = z.infer<
  typeof BrowserPreviewLayoutGeometryDiagnosticRequest
>

type CssSpacingBox = {
  top: number
  right: number
  bottom: number
  left: number
}

type BrowserPreviewLayoutGeometryPage = {
  url: string
  title: string
  viewport: { width: number; height: number }
  scroll: { x: number; y: number }
  root: {
    clientWidth: number
    scrollWidth: number
    offsetWidth: number
    clientHeight: number
    scrollHeight: number
    offsetHeight: number
  }
  body: {
    clientWidth: number
    scrollWidth: number
    offsetWidth: number
    clientHeight: number
    scrollHeight: number
    offsetHeight: number
    margin: CssSpacingBox
  }
  overflow: {
    horizontal: boolean
    vertical: boolean
    overflowX: number
    overflowY: number
  }
}

type BrowserPreviewLayoutGeometryRegionDescriptor = {
  regionID: string
  locator: BrowserPreviewRegionLocator
  sourceBBox?: BrowserPreviewRegionBox
  sourceRefs: string[]
}

export type BrowserPreviewLayoutGeometryRegionSample = BrowserPreviewLayoutGeometryRegionDescriptor &
  (
    | {
        status: "failed"
        reason: string
        borderBox?: never
        viewportBox?: never
        margin?: never
        padding?: never
        gap?: never
        edgeOffsets?: never
        computed?: never
      }
    | {
        status: "captured"
        reason?: never
        borderBox: BrowserPreviewRegionBox
        viewportBox: BrowserPreviewRegionBox
        margin: CssSpacingBox
        padding: CssSpacingBox
        gap: { row: string; column: string }
        edgeOffsets: {
          viewportLeft: number
          viewportRight: number
          viewportTop: number
          viewportBottom: number
          pageLeft: number
          pageRight: number
          pageTop: number
          pageBottom: number
        }
        computed: {
          display: string
          position: string
          boxSizing: string
          width: string
          minWidth: string
          maxWidth: string
          height: string
          minHeight: string
          maxHeight: string
          overflowX: string
          overflowY: string
          transform: string
        }
      }
  ) & { sourceDelta?: BrowserPreviewLayoutGeometrySourceDelta }

export type BrowserPreviewLayoutGeometrySourceDelta = {
  sizeDelta: { width: number; height: number }
  edgeDelta: { left: number; right: number; top: number; bottom: number }
  scale: { x: number; y: number; uniformDelta: number }
  centerDelta: { x: number; y: number }
}

export type BrowserPreviewLayoutGeometryWidthBehavior = {
  regionID: string
  fromSampleID: string
  toSampleID: string
  viewportWidthDelta: number
  borderBoxWidthDelta: number
  viewportWidthRatio: number
  borderBoxWidthRatio?: number
  leftEdgeDelta?: number
  rightEdgeDelta?: number
}

export type BrowserPreviewLayoutGeometryAlignmentSummary = {
  sampleID: string
  groupID: string
  edge: BrowserPreviewLayoutGeometryAlignmentEdge
  status: "captured" | "incomplete"
  regionIDs: string[]
  missingRegionIDs: string[]
  values: Array<{ regionID: string; value: number }>
  min?: number
  max?: number
  spread?: number
}

export type BrowserPreviewLayoutGeometrySample = {
  sampleID: string
  primary: boolean
  viewport: { width: number; height: number }
  page: BrowserPreviewLayoutGeometryPage
  regions: BrowserPreviewLayoutGeometryRegionSample[]
}

export type BrowserPreviewLayoutGeometryResult = {
  operation: "layout-geometry"
  status: "passed" | "failed"
  taskID: string
  targetID: string
  viewportID: BrowserPreviewViewportID
  route: string
  jobID: string
  manifestPath: string
  evidenceID: string
  samples: BrowserPreviewLayoutGeometrySample[]
  widthBehavior: BrowserPreviewLayoutGeometryWidthBehavior[]
  alignmentGroups: BrowserPreviewLayoutGeometryAlignmentSummary[]
  diagnostics: string[]
}

const LayoutGeometryFinite = z.number().finite()
const LayoutGeometrySize = z
  .object({ width: z.number().int().positive(), height: z.number().int().positive() })
  .strict()
const LayoutGeometrySpacing = z
  .object({
    top: LayoutGeometryFinite,
    right: LayoutGeometryFinite,
    bottom: LayoutGeometryFinite,
    left: LayoutGeometryFinite,
  })
  .strict()
const LayoutGeometryPage = z
  .object({
    url: z.string(),
    title: z.string(),
    viewport: LayoutGeometrySize,
    scroll: z.object({ x: LayoutGeometryFinite, y: LayoutGeometryFinite }).strict(),
    root: z
      .object({
        clientWidth: LayoutGeometryFinite,
        scrollWidth: LayoutGeometryFinite,
        offsetWidth: LayoutGeometryFinite,
        clientHeight: LayoutGeometryFinite,
        scrollHeight: LayoutGeometryFinite,
        offsetHeight: LayoutGeometryFinite,
      })
      .strict(),
    body: z
      .object({
        clientWidth: LayoutGeometryFinite,
        scrollWidth: LayoutGeometryFinite,
        offsetWidth: LayoutGeometryFinite,
        clientHeight: LayoutGeometryFinite,
        scrollHeight: LayoutGeometryFinite,
        offsetHeight: LayoutGeometryFinite,
        margin: LayoutGeometrySpacing,
      })
      .strict(),
    overflow: z
      .object({
        horizontal: z.boolean(),
        vertical: z.boolean(),
        overflowX: LayoutGeometryFinite,
        overflowY: LayoutGeometryFinite,
      })
      .strict(),
  })
  .strict()
const LayoutGeometryRegionDescriptor = {
  regionID: z.string().min(1),
  locator: BrowserPreviewRegionLocator,
  sourceBBox: BrowserPreviewRegionBox.optional(),
  sourceRefs: z.array(z.string()),
}
const LayoutGeometryRegionSample = z.discriminatedUnion("status", [
  z.object({ ...LayoutGeometryRegionDescriptor, status: z.literal("failed"), reason: z.string().min(1) }).strict(),
  z
    .object({
      ...LayoutGeometryRegionDescriptor,
      status: z.literal("captured"),
      borderBox: BrowserPreviewRegionBox,
      viewportBox: BrowserPreviewRegionBox,
      margin: LayoutGeometrySpacing,
      padding: LayoutGeometrySpacing,
      gap: z.object({ row: z.string(), column: z.string() }).strict(),
      edgeOffsets: z
        .object({
          viewportLeft: LayoutGeometryFinite,
          viewportRight: LayoutGeometryFinite,
          viewportTop: LayoutGeometryFinite,
          viewportBottom: LayoutGeometryFinite,
          pageLeft: LayoutGeometryFinite,
          pageRight: LayoutGeometryFinite,
          pageTop: LayoutGeometryFinite,
          pageBottom: LayoutGeometryFinite,
        })
        .strict(),
      computed: z
        .object({
          display: z.string(),
          position: z.string(),
          boxSizing: z.string(),
          width: z.string(),
          minWidth: z.string(),
          maxWidth: z.string(),
          height: z.string(),
          minHeight: z.string(),
          maxHeight: z.string(),
          overflowX: z.string(),
          overflowY: z.string(),
          transform: z.string(),
        })
        .strict(),
    })
    .strict(),
])
const LayoutGeometrySidecarResultSchema = z.discriminatedUnion("ok", [
  z
    .object({
      ok: z.literal(true),
      samples: z.array(
        z
          .object({
            sampleID: z.string().min(1),
            primary: z.boolean(),
            viewport: LayoutGeometrySize,
            page: LayoutGeometryPage,
            regions: z.array(LayoutGeometryRegionSample),
          })
          .strict(),
      ),
      diagnostics: z.array(z.string()),
    })
    .strict(),
  z.object({ ok: z.literal(false), message: z.string().min(1), stack: z.string().optional() }).strict(),
])
type LayoutGeometrySidecarSuccess = Extract<z.infer<typeof LayoutGeometrySidecarResultSchema>, { ok: true }>

type CaptureLayoutGeometryInput = {
  projectRoot: string
  taskID: string
  targetID: string
  viewportID: BrowserPreviewViewportID
  route: string
  regions: BrowserPreviewLayoutGeometryRegion[]
  alignmentGroups: BrowserPreviewLayoutGeometryAlignmentGroup[]
  widthSamples: BrowserPreviewLayoutGeometryWidthSample[]
  signal?: AbortSignal
}

type CaptureLayoutGeometry = (input: CaptureLayoutGeometryInput) => Promise<{
  samples: BrowserPreviewLayoutGeometrySample[]
  diagnostics: string[]
}>

export async function diagnoseBrowserPreviewLayoutGeometry(
  input: CaptureLayoutGeometryInput & { captureForTest?: CaptureLayoutGeometry },
): Promise<BrowserPreviewLayoutGeometryResult> {
  requireUniqueBrowserPreviewLayoutRequest(input)
  const capture = input.captureForTest ?? captureBrowserPreviewLayoutGeometryWithSidecar
  const jobID = Identifier.ascending("artifact")
  const projectRoot = path.resolve(input.projectRoot)
  const outDir = ProjectRuntimePaths.browserPreviewJobRoot(projectRoot, input.taskID, jobID)
  const captured = await capture(input)
  const samples = captured.samples.map((sample) => ({
    ...sample,
    regions: sample.regions.map((region) => attachSourceDelta(region)),
  }))
  const widthBehavior = summarizeWidthBehavior(samples)
  const alignmentGroups = summarizeAlignmentGroups(samples, input.alignmentGroups)
  const diagnostics = [
    ...captured.diagnostics,
    ...samples.flatMap((sample) =>
      sample.regions
        .filter((region) => region.status === "failed")
        .map((region) => `${sample.sampleID}:${region.regionID}: ${region.reason ?? "capture failed"}`),
    ),
  ]
  const status: BrowserPreviewLayoutGeometryResult["status"] = samples.every((sample) =>
    sample.regions.every((region) => region.status === "captured"),
  )
    ? "passed"
    : "failed"
  const manifest = {
    operation: "layout-geometry" as const,
    status,
    taskID: input.taskID,
    targetID: input.targetID,
    viewportID: input.viewportID,
    route: input.route,
    jobID,
    samples,
    widthBehavior,
    alignmentGroups,
    diagnostics,
  }
  const evidenceID = Identifier.ascending("artifact")
  const manifestPath = path.join(outDir, "layout-geometry.json")
  const evidenceInput: PersistBrowserPreviewEvidenceInput = {
    projectRoot,
    taskID: input.taskID,
    targetID: input.targetID,
    viewportID: input.viewportID,
    operationKind: "layout-geometry",
    manifestPath,
    artifactPaths: { manifest: manifestPath },
    status,
    summary:
      status === "passed"
        ? `layout geometry captured for ${samples.length} viewport sample(s)`
        : `layout geometry captured with ${diagnostics.length} diagnostic issue(s)`,
    capture: manifest,
    diagnostics,
  }
  await fs.mkdir(ProjectRuntimePaths.taskRoot(projectRoot, input.taskID), { recursive: true })
  const preparedDir = await fs.mkdtemp(
    path.join(ProjectRuntimePaths.taskRoot(projectRoot, input.taskID), ".browser-preview-layout-preparing-"),
  )
  let published = false
  try {
    await fs.writeFile(path.join(preparedDir, "layout-geometry.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8")
    await fs.mkdir(path.dirname(outDir), { recursive: true })
    await fs.rename(preparedDir, outDir)
    published = true
    await persistBrowserPreviewEvidenceBatch([{ id: evidenceID, input: evidenceInput }])
    return { ...manifest, evidenceID, manifestPath }
  } catch (error) {
    return await throwAfterBrowserPreviewPublicationCleanup({
      primaryFailure: error,
      residualPath: published ? outDir : preparedDir,
    })
  }
}

function requireUniqueBrowserPreviewLayoutRequest(input: CaptureLayoutGeometryInput): void {
  const sampleIDs = [input.viewportID, ...input.widthSamples.map((sample) => sample.id)]
  if (new Set(sampleIDs).size !== sampleIDs.length) {
    throw new Error("Browser Preview layout diagnostic sample IDs must be unique.")
  }
  const regionIDs = input.regions.map((region) => region.regionID)
  if (new Set(regionIDs).size !== regionIDs.length) {
    throw new Error("Browser Preview layout diagnostic region IDs must be unique.")
  }
}

export function attachSourceDelta(
  region: BrowserPreviewLayoutGeometryRegionSample,
): BrowserPreviewLayoutGeometryRegionSample {
  if (region.status !== "captured" || !region.borderBox || !region.sourceBBox) return region
  return {
    ...region,
    sourceDelta: computeSourceDelta(region.sourceBBox, region.borderBox),
  }
}

export function computeSourceDelta(
  source: BrowserPreviewRegionBox,
  implementation: BrowserPreviewRegionBox,
): BrowserPreviewLayoutGeometrySourceDelta {
  const sourceRight = source.x + source.width
  const sourceBottom = source.y + source.height
  const implementationRight = implementation.x + implementation.width
  const implementationBottom = implementation.y + implementation.height
  const scaleX = implementation.width / source.width
  const scaleY = implementation.height / source.height
  return {
    sizeDelta: {
      width: round(implementation.width - source.width),
      height: round(implementation.height - source.height),
    },
    edgeDelta: {
      left: round(implementation.x - source.x),
      right: round(implementationRight - sourceRight),
      top: round(implementation.y - source.y),
      bottom: round(implementationBottom - sourceBottom),
    },
    scale: {
      x: round(scaleX),
      y: round(scaleY),
      uniformDelta: round(Math.abs(scaleX - scaleY)),
    },
    centerDelta: {
      x: round(implementation.x + implementation.width / 2 - (source.x + source.width / 2)),
      y: round(implementation.y + implementation.height / 2 - (source.y + source.height / 2)),
    },
  }
}

export function summarizeWidthBehavior(
  samples: BrowserPreviewLayoutGeometrySample[],
): BrowserPreviewLayoutGeometryWidthBehavior[] {
  const primary = samples.find((sample) => sample.primary)
  if (!primary) return []
  const byRegion = new Map(primary.regions.map((region) => [region.regionID, region]))
  const out: BrowserPreviewLayoutGeometryWidthBehavior[] = []
  for (const sample of samples) {
    if (sample.sampleID === primary.sampleID) continue
    for (const region of sample.regions) {
      const base = byRegion.get(region.regionID)
      if (!base?.borderBox || !region.borderBox) continue
      out.push({
        regionID: region.regionID,
        fromSampleID: primary.sampleID,
        toSampleID: sample.sampleID,
        viewportWidthDelta: sample.viewport.width - primary.viewport.width,
        borderBoxWidthDelta: round(region.borderBox.width - base.borderBox.width),
        viewportWidthRatio: round(sample.viewport.width / primary.viewport.width),
        borderBoxWidthRatio: round(region.borderBox.width / base.borderBox.width),
        leftEdgeDelta: round(region.borderBox.x - base.borderBox.x),
        rightEdgeDelta: round((region.edgeOffsets?.viewportRight ?? 0) - (base.edgeOffsets?.viewportRight ?? 0)),
      })
    }
  }
  return out
}

export function summarizeAlignmentGroups(
  samples: BrowserPreviewLayoutGeometrySample[],
  groups: readonly BrowserPreviewLayoutGeometryAlignmentGroup[],
): BrowserPreviewLayoutGeometryAlignmentSummary[] {
  const out: BrowserPreviewLayoutGeometryAlignmentSummary[] = []
  for (const sample of samples) {
    const regions = new Map(sample.regions.map((region) => [region.regionID, region]))
    for (const group of groups) {
      for (const edge of group.edges) {
        const values = group.regionIDs
          .map((regionID) => {
            const value = regionValue(regions.get(regionID), edge)
            return value === undefined ? undefined : { regionID, value }
          })
          .filter((item): item is { regionID: string; value: number } => Boolean(item))
        const missingRegionIDs = group.regionIDs.filter(
          (regionID) => !values.some((value) => value.regionID === regionID),
        )
        if (missingRegionIDs.length > 0) {
          out.push({
            sampleID: sample.sampleID,
            groupID: group.id,
            edge,
            status: "incomplete",
            regionIDs: group.regionIDs,
            missingRegionIDs,
            values,
          })
          continue
        }
        const numeric = values.map((value) => value.value)
        const min = round(Math.min(...numeric))
        const max = round(Math.max(...numeric))
        out.push({
          sampleID: sample.sampleID,
          groupID: group.id,
          edge,
          status: "captured",
          regionIDs: group.regionIDs,
          missingRegionIDs: [],
          values,
          min,
          max,
          spread: round(max - min),
        })
      }
    }
  }
  return out
}

function regionValue(
  region: BrowserPreviewLayoutGeometryRegionSample | undefined,
  edge: BrowserPreviewLayoutGeometryAlignmentEdge,
): number | undefined {
  if (!region || region.status !== "captured" || !region.borderBox) return undefined
  const box = region.borderBox
  switch (edge) {
    case "left":
      return round(box.x)
    case "right":
      return round(box.x + box.width)
    case "top":
      return round(box.y)
    case "bottom":
      return round(box.y + box.height)
    case "center-x":
      return round(box.x + box.width / 2)
    case "center-y":
      return round(box.y + box.height / 2)
    case "width":
      return round(box.width)
    case "height":
      return round(box.height)
  }
}

async function captureBrowserPreviewLayoutGeometryWithSidecar(
  input: CaptureLayoutGeometryInput,
): Promise<{ samples: BrowserPreviewLayoutGeometrySample[]; diagnostics: string[] }> {
  const target = findBrowserPreviewTargetByID({ taskID: input.taskID, targetID: input.targetID })
  if (!target) throw new Error(`Browser preview target not found: ${input.targetID}`)
  const primaryViewport = browserPreviewViewportByID(target.viewports, input.viewportID)
  const executablePath = await BrowserRuntime.findBrowserExecutable()
  const launchTimeoutMs = BrowserRuntime.resolveBrowserLaunchTimeoutMs(undefined)
  const navigationTimeoutMs = RUNTIME_CAPTURE_DEFAULTS.wait_timeout_ms
  const runtime = await resolveBrowserNodeSidecarRuntime()
  const primarySample = {
    id: input.viewportID,
    width: primaryViewport.width,
    height: primaryViewport.height,
    primary: true,
  }
  const additionalSamples = input.widthSamples.map((sample) => ({
    id: sample.id,
    width: sample.width,
    height: sample.height ?? primaryViewport.height,
    primary: false,
  }))
  const sidecar = await runTaskBrowserNodeSidecar<unknown>({ taskID: input.taskID, cwd: input.projectRoot }, {
    runtime,
    script: BROWSER_PREVIEW_LAYOUT_GEOMETRY_SCRIPT,
    payload: {
      url: target.url,
      route: input.route,
      executablePath,
      launchArgs: BrowserRuntime.defaultLaunchArgs(),
      launchTimeoutMs,
      navigationTimeoutMs,
      settleMs: RUNTIME_CAPTURE_DEFAULTS.settle_ms,
      samples: [primarySample, ...additionalSamples],
      regions: input.regions,
    },
    inactivityTimeoutMs:
      launchTimeoutMs +
      (1 + input.widthSamples.length) * (navigationTimeoutMs + RUNTIME_CAPTURE_DEFAULTS.settle_ms + 10_000) +
      30_000,
    label: "Browser preview layout geometry diagnostic",
    signal: input.signal,
  }).catch((error) => {
    if (error instanceof BrowserNodeSidecarError) throw error
    throw new Error(error instanceof Error ? error.message : String(error), { cause: error })
  })
  const sidecarResult = LayoutGeometrySidecarResultSchema.parse(sidecar.result)
  if (!sidecarResult.ok) {
    throw new Error(
      `Browser preview layout geometry diagnostic failed: ${sidecarResult.message}${
        sidecarResult.stack ? `\n${sidecarResult.stack}` : ""
      }`,
    )
  }
  if (sidecar.exitCode !== 0) {
    throw new Error(
      `Browser preview layout geometry diagnostic exited with ${sidecar.signal ?? sidecar.exitCode}. ${sidecar.stderr.trim()}`,
    )
  }
  const samples = requireExactLayoutGeometrySidecarSet({
    requestedSamples: [primarySample, ...additionalSamples],
    requestedRegions: input.regions,
    expectedPageURL: new URL(input.route, target.url).toString(),
    samples: sidecarResult.samples,
  })
  return { samples, diagnostics: sidecarResult.diagnostics }
}

function requireExactLayoutGeometrySidecarSet(input: {
  requestedSamples: Array<{ id: string; width: number; height: number; primary: boolean }>
  requestedRegions: BrowserPreviewLayoutGeometryRegion[]
  expectedPageURL: string
  samples: LayoutGeometrySidecarSuccess["samples"]
}): BrowserPreviewLayoutGeometrySample[] {
  const expectedSamples = new Map(input.requestedSamples.map((sample) => [sample.id, sample]))
  const actualSamples = new Set<string>()
  const expectedRegions = new Map(input.requestedRegions.map((region) => [region.regionID, region]))
  for (const sample of input.samples) {
    const expected = expectedSamples.get(sample.sampleID)
    if (!expected) throw new Error(`Unknown Browser Preview layout sample: ${sample.sampleID}`)
    if (actualSamples.has(sample.sampleID))
      throw new Error(`Duplicate Browser Preview layout sample: ${sample.sampleID}`)
    if (
      sample.primary !== expected.primary ||
      sample.viewport.width !== expected.width ||
      sample.viewport.height !== expected.height ||
      sample.page.viewport.width !== expected.width ||
      sample.page.viewport.height !== expected.height
    ) {
      throw new Error(`Browser Preview layout sample does not match its request: ${sample.sampleID}`)
    }
    if (sample.page.url !== input.expectedPageURL) {
      throw new Error(`Browser Preview layout page URL does not match its request: ${sample.sampleID}`)
    }
    const actualRegions = new Set<string>()
    for (const region of sample.regions) {
      const expectedRegion = expectedRegions.get(region.regionID)
      if (!expectedRegion) {
        throw new Error(`Unknown Browser Preview layout region: ${sample.sampleID}/${region.regionID}`)
      }
      if (actualRegions.has(region.regionID)) {
        throw new Error(`Duplicate Browser Preview layout region: ${sample.sampleID}/${region.regionID}`)
      }
      if (
        !isDeepStrictEqual(region.locator, expectedRegion.locator) ||
        !isDeepStrictEqual(region.sourceBBox, expectedRegion.sourceBBox) ||
        !isDeepStrictEqual(region.sourceRefs, expectedRegion.sourceRefs)
      ) {
        throw new Error(
          `Browser Preview layout region does not match its request: ${sample.sampleID}/${region.regionID}`,
        )
      }
      actualRegions.add(region.regionID)
    }
    for (const regionID of expectedRegions.keys()) {
      if (!actualRegions.has(regionID))
        throw new Error(`Missing Browser Preview layout region: ${sample.sampleID}/${regionID}`)
    }
    actualSamples.add(sample.sampleID)
  }
  for (const sampleID of expectedSamples.keys()) {
    if (!actualSamples.has(sampleID)) throw new Error(`Missing Browser Preview layout sample: ${sampleID}`)
  }
  return input.samples
}

function round(value: number): number {
  return Number(value.toFixed(3))
}

const BROWSER_PREVIEW_LAYOUT_GEOMETRY_SCRIPT = String.raw`
const playwrightRequirePath = process.env.OPENCORVUS_PLAYWRIGHT_REQUIRE_PATH;
if (!playwrightRequirePath) throw new Error("OPENCORVUS_PLAYWRIGHT_REQUIRE_PATH is required.");
const { chromium } = require(playwrightRequirePath);

function decodePayload() {
  return JSON.parse(Buffer.from(process.env.OPENCORVUS_BROWSER_PREVIEW_LAYOUT_GEOMETRY_INPUT || "", "base64").toString("utf8"));
}

function routeUrl(baseUrl, route) {
  const base = new URL(baseUrl);
  return new URL(route, base).toString();
}

function locatorSelector(locator) {
  if (locator.kind === "selector") return locator.value;
  if (locator.kind === "test-id") return "[data-testid=" + JSON.stringify(locator.value) + "]";
  if (locator.kind === "data-oc-region") return "[data-oc-region=" + JSON.stringify(locator.value) + "]";
  throw new Error("Role locators do not have a selector string.");
}

function findLocator(page, locator) {
  if (locator.kind === "role") return page.getByRole(locator.role, { name: locator.name }).first();
  return page.locator(locatorSelector(locator)).first();
}

function browserActivityLabel(event, payload) {
  if (payload && typeof payload.url === "function") return event + " " + payload.url();
  if (payload && typeof payload.message === "function") return event + " " + payload.message();
  if (payload && typeof payload.text === "function") return event + " " + payload.text();
  if (payload && typeof payload.errorText === "string") return event + " " + payload.errorText;
  return event;
}

async function withBrowserInactivity(page, label, inactivityTimeoutMs, action) {
  let settled = false;
  let lastActivity = "start";
  let timer;
  let rejectInactive;
  let rejectFailure;
  const listeners = [];
  const inactive = new Promise((_, reject) => {
    rejectInactive = reject;
  });
  const browserFailure = new Promise((_, reject) => {
    rejectFailure = reject;
  });
  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };
  const reset = (source) => {
    if (settled) return;
    lastActivity = source;
    clearTimer();
    timer = setTimeout(() => {
      rejectInactive(new Error(label + " browser inactive for " + inactivityTimeoutMs + "ms after " + lastActivity));
    }, inactivityTimeoutMs);
  };
  const fail = (source) => {
    if (settled) return;
    rejectFailure(new Error(label + " browser failure before layout geometry capture: " + source));
  };
  const on = (event, handler) => {
    page.on(event, handler);
    listeners.push([event, handler]);
  };
  on("console", (payload) => reset(browserActivityLabel("console", payload)));
  on("response", (payload) => reset(browserActivityLabel("response", payload)));
  on("requestfailed", (payload) => fail(browserActivityLabel("requestfailed", payload)));
  on("pageerror", (payload) => fail(browserActivityLabel("pageerror", payload)));
  reset("start");
  try {
    return await Promise.race([action(), inactive, browserFailure]);
  } finally {
    settled = true;
    clearTimer();
    for (const [event, handler] of listeners) page.off(event, handler);
  }
}

function round(value) {
  return Number(Number(value).toFixed(3));
}

function px(value) {
  const parsed = Number.parseFloat(String(value || "0"));
  return Number.isFinite(parsed) ? round(parsed) : 0;
}

async function collectPage(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const bodyStyle = body ? getComputedStyle(body) : undefined;
    const box = (el) => ({
      clientWidth: el ? el.clientWidth : 0,
      scrollWidth: el ? el.scrollWidth : 0,
      offsetWidth: el ? el.offsetWidth : 0,
      clientHeight: el ? el.clientHeight : 0,
      scrollHeight: el ? el.scrollHeight : 0,
      offsetHeight: el ? el.offsetHeight : 0,
    });
    const rootBox = box(root);
    const bodyBox = box(body);
    const scrollWidth = Math.max(rootBox.scrollWidth, bodyBox.scrollWidth);
    const scrollHeight = Math.max(rootBox.scrollHeight, bodyBox.scrollHeight);
    return {
      url: window.location.href,
      title: document.title || "",
      viewport: { width: window.innerWidth, height: window.innerHeight },
      scroll: { x: Math.round(window.scrollX), y: Math.round(window.scrollY) },
      root: rootBox,
      body: {
        ...bodyBox,
        margin: {
          top: Number.parseFloat(bodyStyle?.marginTop || "0") || 0,
          right: Number.parseFloat(bodyStyle?.marginRight || "0") || 0,
          bottom: Number.parseFloat(bodyStyle?.marginBottom || "0") || 0,
          left: Number.parseFloat(bodyStyle?.marginLeft || "0") || 0,
        },
      },
      overflow: {
        horizontal: scrollWidth > window.innerWidth + 1,
        vertical: scrollHeight > window.innerHeight + 1,
        overflowX: Math.max(0, scrollWidth - window.innerWidth),
        overflowY: Math.max(0, scrollHeight - window.innerHeight),
      },
    };
  });
}

async function collectRegion(page, region) {
  const locator = findLocator(page, region.locator);
  const visible = await locator.isVisible();
  if (!visible) {
    return {
      regionID: region.regionID,
      status: "failed",
      reason: "locator did not match a visible element",
      locator: region.locator,
      sourceBBox: region.sourceBBox,
      sourceRefs: region.sourceRefs,
    };
  }
  await locator.scrollIntoViewIfNeeded({ timeout: 5000 });
  const box = await locator.boundingBox();
  if (!box || box.width <= 0 || box.height <= 0) {
    return {
      regionID: region.regionID,
      status: "failed",
      reason: "locator matched a zero-size element",
      locator: region.locator,
      sourceBBox: region.sourceBBox,
      sourceRefs: region.sourceRefs,
    };
  }
  return locator.evaluate((node, input) => {
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    const root = document.documentElement;
    const body = document.body;
    const pageWidth = Math.max(root.scrollWidth, body ? body.scrollWidth : 0, window.innerWidth);
    const pageHeight = Math.max(root.scrollHeight, body ? body.scrollHeight : 0, window.innerHeight);
    const round = (value) => Number(Number(value).toFixed(3));
    const px = (value) => {
      const parsed = Number.parseFloat(String(value || "0"));
      return Number.isFinite(parsed) ? round(parsed) : 0;
    };
    const borderBox = {
      x: round(rect.x + window.scrollX),
      y: round(rect.y + window.scrollY),
      width: round(rect.width),
      height: round(rect.height),
    };
    const viewportBox = {
      x: round(rect.x),
      y: round(rect.y),
      width: round(rect.width),
      height: round(rect.height),
    };
    return {
      regionID: input.regionID,
      status: "captured",
      locator: input.locator,
      sourceBBox: input.sourceBBox,
      sourceRefs: input.sourceRefs,
      borderBox,
      viewportBox,
      margin: {
        top: px(style.marginTop),
        right: px(style.marginRight),
        bottom: px(style.marginBottom),
        left: px(style.marginLeft),
      },
      padding: {
        top: px(style.paddingTop),
        right: px(style.paddingRight),
        bottom: px(style.paddingBottom),
        left: px(style.paddingLeft),
      },
      gap: {
        row: style.rowGap,
        column: style.columnGap,
      },
      edgeOffsets: {
        viewportLeft: round(rect.left),
        viewportRight: round(window.innerWidth - rect.right),
        viewportTop: round(rect.top),
        viewportBottom: round(window.innerHeight - rect.bottom),
        pageLeft: borderBox.x,
        pageRight: round(pageWidth - (borderBox.x + borderBox.width)),
        pageTop: borderBox.y,
        pageBottom: round(pageHeight - (borderBox.y + borderBox.height)),
      },
      computed: {
        display: style.display,
        position: style.position,
        boxSizing: style.boxSizing,
        width: style.width,
        minWidth: style.minWidth,
        maxWidth: style.maxWidth,
        height: style.height,
        minHeight: style.minHeight,
        maxHeight: style.maxHeight,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        transform: style.transform,
      },
    };
  }, region);
}

async function captureSample(browser, payload, sample) {
  const context = await browser.newContext({ viewport: { width: sample.width, height: sample.height } });
  const page = await context.newPage();
  try {
    await withBrowserInactivity(page, "layout geometry navigate", payload.navigationTimeoutMs, () =>
      page.goto(routeUrl(payload.url, payload.route), { waitUntil: "load", timeout: 0 })
    );
    if (payload.settleMs > 0) await page.waitForTimeout(payload.settleMs);
    const pageGeometry = await collectPage(page);
    const regions = [];
    for (const region of payload.regions) {
      regions.push(await collectRegion(page, region));
    }
    return {
      sampleID: sample.id,
      primary: sample.primary,
      viewport: { width: sample.width, height: sample.height },
      page: pageGeometry,
      regions,
    };
  } finally {
    await context.close();
  }
}

(async () => {
  let browser;
  try {
    const payload = decodePayload();
    browser = await chromium.launch({
      executablePath: payload.executablePath,
      headless: true,
      args: payload.launchArgs,
      timeout: payload.launchTimeoutMs,
    });
    const samples = [];
    for (const sample of payload.samples) {
      samples.push(await captureSample(browser, payload, sample));
    }
    process.stdout.write(JSON.stringify({ ok: true, samples, diagnostics: [] }));
  } catch (error) {
    process.stdout.write(JSON.stringify({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }));
  } finally {
    if (browser) await browser.close();
  }
})();
`
