import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { PNG } from "pngjs"
import z from "zod"
import { BrowserNodeSidecarError, runTaskBrowserNodeSidecar } from "@/browser/runtime/node-executor"
import { resolveBrowserNodeSidecarRuntime } from "@/browser/runtime/node-sidecar"
import { BrowserRuntime } from "@/browser/runtime"
import {
  normalizeRuntimeCaptureViewport,
  RUNTIME_CAPTURE_DEFAULTS,
  runtimeCaptureFailureSummary,
  runtimeCaptureFailedLayers,
  type RuntimeCaptureLayers,
  type RuntimeCaptureResult,
} from "@/runtime/capture-contract"
import { pngLuminanceVariance } from "@/runtime/png-metrics"
import { Identifier } from "@/id/id"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { findBrowserPreviewTargetByID } from "./persist"
import {
  browserPreviewRegionIdentityKey,
  type BrowserPreviewRegionBinding,
  BrowserPreviewRegionBox,
} from "./region-schema"
import { browserPreviewViewportByID, BrowserPreviewViewportID } from "./viewport"
import { readBrowserPreviewArtifactFile } from "./artifact-file"

export type BrowserEvidenceManifestSummary = {
  manifestPath: string
  jobID: string
  taskID: string
  targetID: string
  operations: Array<{
    kind: "preview-capture"
    status: "completed" | "failed"
    viewportIDs: BrowserPreviewViewportID[]
    artifactPaths: string[]
    diagnosticsPath: string
  }>
}

export type BrowserPreviewEvidenceRunnerResult = {
  manifest: BrowserEvidenceManifestSummary
  captures: Record<string, RuntimeCaptureResult>
}

type BrowserPreviewEvidenceRunnerInput = {
  projectRoot: string
  jobID: string
  taskID: string
  targetID: string
  outDir: string
  viewportIDs: BrowserPreviewViewportID[]
  signal?: AbortSignal
}

type BrowserPreviewRegionComparisonRunnerInput = {
  projectRoot: string
  taskID: string
  targetID: string
  jobID: string
  outDir: string
  bindings: BrowserPreviewRegionBinding[]
  signal?: AbortSignal
}

type SidecarViewportInput = {
  id: BrowserPreviewViewportID
  width: number
  height: number
  screenshotPath: string
}

const SidecarCaptureSize = z
  .object({ width: z.number().int().positive(), height: z.number().int().positive() })
  .strict()
const SidecarCaptureViewport = SidecarCaptureSize.extend({ capped: z.boolean() }).strict()
const SidecarCaptureLayers = z
  .object({
    http: z
      .object({
        passed: z.boolean(),
        status: z.number().int().nonnegative(),
        content_type: z.string(),
        body_length: z.number().int().nonnegative(),
        reason: z.string(),
      })
      .strict(),
    asset: z
      .object({
        passed: z.boolean(),
        total: z.number().int().nonnegative(),
        failed: z.array(
          z.object({ url: z.string(), status: z.number().int().nonnegative(), reason: z.string() }).strict(),
        ),
      })
      .strict(),
    dom: z
      .object({
        passed: z.boolean(),
        body_descendants: z.number().int().nonnegative(),
        required: z.number().int().nonnegative(),
      })
      .strict(),
    js: z
      .object({ passed: z.boolean(), console_errors: z.array(z.string()), page_errors: z.array(z.string()) })
      .strict(),
    glyph: z
      .object({
        passed: z.boolean(),
        checked: z.number().int().nonnegative(),
        failed: z.array(
          z
            .object({
              text: z.string(),
              font_family: z.string(),
              font_spec: z.string(),
              reason: z.string(),
              missing_chars: z.array(z.string()),
            })
            .strict(),
        ),
      })
      .strict(),
    pixel: z
      .object({
        passed: z.boolean(),
        variance: z.number().finite(),
        floor: z.number().finite(),
        screenshot_path: z.string(),
      })
      .strict(),
    expected: z
      .object({ passed: z.boolean(), missing_selectors: z.array(z.string()), missing_texts: z.array(z.string()) })
      .strict(),
  })
  .strict()
const SidecarCaptureDom = z
  .object({
    textLength: z.number().int().nonnegative(),
    nodeCount: z.number().int().nonnegative(),
    bodyDescendantCount: z.number().int().nonnegative(),
    hasBodyChildren: z.boolean(),
    isEmptyRootShell: z.boolean(),
  })
  .strict()
const SidecarCaptureIdentity = {
  id: BrowserPreviewViewportID,
  requested_viewport: SidecarCaptureSize,
  viewport: SidecarCaptureViewport,
  summary: z.string(),
}
const SidecarCaptureResultSchema = z.discriminatedUnion("captured", [
  z
    .object({
      ...SidecarCaptureIdentity,
      captured: z.literal(false),
      passed: z.literal(false),
      capture_error: z.object({ kind: z.literal("capture_failed"), message: z.string() }).strict(),
    })
    .strict(),
  z
    .object({
      ...SidecarCaptureIdentity,
      captured: z.literal(true),
      passed: z.boolean(),
      target_url: z.string(),
      size: SidecarCaptureSize,
      path: z.string().min(1),
      layers: SidecarCaptureLayers,
      dom: SidecarCaptureDom,
    })
    .strict(),
])
export type SidecarCaptureResult = z.infer<typeof SidecarCaptureResultSchema>
const BrowserPreviewEvidenceSidecarResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), captures: z.array(SidecarCaptureResultSchema) }).strict(),
  z.object({ ok: z.literal(false), message: z.string().min(1), stack: z.string().optional() }).strict(),
])

export type BrowserPreviewFinalizedSidecarCapture = {
  capture: RuntimeCaptureResult
  artifactPath?: string
  diagnostic: string
}

type BrowserPreviewRegionSidecarBinding = {
  regionID: string
  stateID: string
  viewportID: BrowserPreviewViewportID
  route: string
  expectedURL: string
  viewport: { width: number; height: number }
  locator: BrowserPreviewRegionBinding["implementation"]["locator"]
  screenshotPath: string
}

const BrowserPreviewRegionImageSize = z
  .object({ width: z.number().int().positive(), height: z.number().int().positive() })
  .strict()

export const BrowserPreviewRegionRouteDiagnosticsSchema = z
  .object({
    route: z.string(),
    url: z.string().min(1),
    final_url: z.string().min(1),
    status: z.number().int().nonnegative(),
    content_type: z.string(),
    body_length: z.number().int().nonnegative(),
    title: z.string(),
    dom: z
      .object({
        text_length: z.number().int().nonnegative(),
        node_count: z.number().int().nonnegative(),
        body_descendant_count: z.number().int().nonnegative(),
      })
      .strict(),
    page_size: BrowserPreviewRegionImageSize,
    navigation_error: z.string(),
    failed_requests: z.array(
      z.object({ url: z.string(), status: z.number().int().nonnegative(), reason: z.string() }).strict(),
    ),
    console_errors: z.array(z.string()),
    page_errors: z.array(z.string()),
    valid_app_page: z.boolean(),
    reason: z.string().optional(),
    screenshot_path: z.string().min(1),
  })
  .strict()
export type BrowserPreviewRegionRouteDiagnostics = z.infer<typeof BrowserPreviewRegionRouteDiagnosticsSchema>

const BrowserPreviewRegionSidecarIdentity = {
  regionID: z.string().min(1),
  stateID: z.string().min(1),
  viewportID: BrowserPreviewViewportID,
  screenshotPath: z.string().min(1),
  viewport: BrowserPreviewRegionImageSize,
  fullpageSize: BrowserPreviewRegionImageSize,
  routeDiagnostics: BrowserPreviewRegionRouteDiagnosticsSchema,
}

const BrowserPreviewRegionSidecarCapture = z.discriminatedUnion("status", [
  z
    .object({
      ...BrowserPreviewRegionSidecarIdentity,
      status: z.literal("completed"),
      bbox: BrowserPreviewRegionBox,
    })
    .strict(),
  z
    .object({
      ...BrowserPreviewRegionSidecarIdentity,
      status: z.literal("failed"),
      reason: z.string().min(1),
      bbox: BrowserPreviewRegionBox.optional(),
    })
    .strict(),
])

const BrowserPreviewRegionSidecarResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), regions: z.array(BrowserPreviewRegionSidecarCapture) }).strict(),
  z.object({ ok: z.literal(false), message: z.string().min(1), stack: z.string().optional() }).strict(),
])
export type BrowserPreviewRegionComparisonCaptureResult = {
  jobID: string
  outDir: string
  regions: Array<z.infer<typeof BrowserPreviewRegionSidecarCapture> & { screenshotBytes: Buffer }>
}

export class BrowserPreviewEvidenceTargetNotFoundError extends Error {
  constructor(readonly targetID: string) {
    super(`Browser preview target not found: ${targetID}`)
    this.name = "BrowserPreviewEvidenceTargetNotFoundError"
  }
}

export async function runBrowserPreviewEvidenceJob(
  input: BrowserPreviewEvidenceRunnerInput,
): Promise<BrowserPreviewEvidenceRunnerResult> {
  requireBrowserEvidenceIdentity(input)
  const target = findBrowserPreviewTargetByID({ taskID: input.taskID, targetID: input.targetID })
  if (!target) {
    throw new BrowserPreviewEvidenceTargetNotFoundError(input.targetID)
  }
  const projectRoot = path.resolve(input.projectRoot)
  const outDir = requireBrowserPreviewPreparationRoot({
    projectRoot,
    taskID: input.taskID,
    outDir: input.outDir,
    prefix: ".browser-preview-verification-preparing-",
  })
  const executablePath = await BrowserRuntime.findBrowserExecutable()
  const launchTimeoutMs = BrowserRuntime.resolveBrowserLaunchTimeoutMs(undefined)
  const navigationTimeoutMs = RUNTIME_CAPTURE_DEFAULTS.wait_timeout_ms
  const settleMs = RUNTIME_CAPTURE_DEFAULTS.settle_ms
  const runtime = await resolveBrowserNodeSidecarRuntime()
  await fs.mkdir(outDir, { recursive: true })

  const viewports: SidecarViewportInput[] = input.viewportIDs.map((id) => {
    const preset = browserPreviewViewportByID(target.viewports, id)
    const viewport = normalizeRuntimeCaptureViewport({ width: preset.width, height: preset.height })
    return {
      id,
      width: viewport.width,
      height: viewport.height,
      screenshotPath: path.join(outDir, `${id}.png`),
    }
  })

  const sidecar = await runTaskBrowserNodeSidecar<unknown>({ taskID: input.taskID, cwd: input.projectRoot }, {
    runtime,
    script: BROWSER_PREVIEW_BATCH_SCRIPT,
    payload: {
      url: target.url,
      executablePath,
      launchArgs: BrowserRuntime.defaultLaunchArgs(),
      launchTimeoutMs,
      navigationTimeoutMs,
      settleMs,
      minDomDescendants: RUNTIME_CAPTURE_DEFAULTS.min_dom_descendants,
      viewports,
    },
    inactivityTimeoutMs: launchTimeoutMs + viewports.length * (navigationTimeoutMs + settleMs + 15_000) + 30_000,
    label: "Browser preview evidence runner",
    signal: input.signal,
  }).catch((error) => {
    if (error instanceof BrowserNodeSidecarError) throw error
    throw new Error(error instanceof Error ? error.message : String(error), { cause: error })
  })

  const sidecarResult = BrowserPreviewEvidenceSidecarResultSchema.parse(sidecar.result)
  if (!sidecarResult.ok) {
    throw new Error(
      `Browser preview evidence runner failed: ${sidecarResult.message}${sidecarResult.stack ? `\n${sidecarResult.stack}` : ""}`,
    )
  }
  if (sidecar.exitCode !== 0) {
    throw new Error(
      `Browser preview evidence runner exited with ${sidecar.signal ?? sidecar.exitCode}. ${sidecar.stderr.trim()}`,
    )
  }

  const captures: Record<string, RuntimeCaptureResult> = {}
  const artifactPaths: string[] = []
  const diagnostics: string[] = []
  const sidecarCaptures = requireExactBrowserPreviewEvidenceCaptureSet({ viewports, captures: sidecarResult.captures })
  for (const capture of sidecarCaptures) {
    const expectedScreenshotPath = viewports.find((viewport) => viewport.id === capture.id)?.screenshotPath
    if (!expectedScreenshotPath) throw new Error(`Missing requested Browser Preview viewport: ${capture.id}`)
    const finalized = await finalizeBrowserPreviewSidecarCapture({
      capture,
      url: target.url,
      outDir,
      expectedScreenshotPath,
    })
    captures[capture.id] = finalized.capture
    if (finalized.artifactPath) artifactPaths.push(finalized.artifactPath)
    diagnostics.push(finalized.diagnostic)
  }

  const manifest = await writeBrowserEvidenceManifest({
    outDir,
    jobID: input.jobID,
    taskID: input.taskID,
    targetID: input.targetID,
    url: target.url,
    viewportIDs: input.viewportIDs,
    artifactPaths,
    captures,
    diagnostics,
  })
  return { manifest, captures }
}

export async function runBrowserPreviewRegionComparisonCapture(
  input: BrowserPreviewRegionComparisonRunnerInput,
): Promise<BrowserPreviewRegionComparisonCaptureResult> {
  requireBrowserEvidenceIdentity(input)
  const outDir = requireBrowserPreviewPreparationRoot({
    projectRoot: input.projectRoot,
    taskID: input.taskID,
    outDir: input.outDir,
    prefix: ".browser-preview-region-preparing-",
  })
  const target = findBrowserPreviewTargetByID({ taskID: input.taskID, targetID: input.targetID })
  if (!target) {
    throw new BrowserPreviewEvidenceTargetNotFoundError(input.targetID)
  }
  const sidecarBindings: BrowserPreviewRegionSidecarBinding[] = input.bindings.map((binding) => {
    const projectedViewport = browserPreviewViewportByID(target.viewports, binding.viewport_id)
    return {
      regionID: binding.region_id,
      stateID: binding.state_id,
      viewportID: binding.viewport_id,
      route: binding.implementation.route,
      expectedURL: new URL(binding.implementation.route, target.url).toString(),
      viewport: { width: projectedViewport.width, height: projectedViewport.height },
      locator: binding.implementation.locator,
      screenshotPath: browserPreviewRegionScreenshotPath(outDir, binding),
    }
  })
  requireUniqueBrowserPreviewRegionCaptureBindings(sidecarBindings)
  const jobID = input.jobID
  await fs.mkdir(outDir, { recursive: true })

  const executablePath = await BrowserRuntime.findBrowserExecutable()
  const launchTimeoutMs = BrowserRuntime.resolveBrowserLaunchTimeoutMs(undefined)
  const runtime = await resolveBrowserNodeSidecarRuntime()
  const viewportIDs = Array.from(new Set(sidecarBindings.map((binding) => binding.viewportID)))
  const sidecar = await runTaskBrowserNodeSidecar<unknown>({ taskID: input.taskID, cwd: input.projectRoot }, {
    runtime,
    script: BROWSER_PREVIEW_REGION_COMPARISON_SCRIPT,
    payload: {
      url: target.url,
      outDir,
      executablePath,
      launchArgs: BrowserRuntime.defaultLaunchArgs(),
      launchTimeoutMs,
      navigationTimeoutMs: RUNTIME_CAPTURE_DEFAULTS.wait_timeout_ms,
      settleMs: RUNTIME_CAPTURE_DEFAULTS.settle_ms,
      viewportIDs,
      bindings: sidecarBindings.map(({ expectedURL: _expectedURL, ...binding }) => binding),
    },
    inactivityTimeoutMs:
      launchTimeoutMs + input.bindings.length * (RUNTIME_CAPTURE_DEFAULTS.wait_timeout_ms + 15_000) + 30_000,
    label: "Browser preview region comparison runner",
    signal: input.signal,
  }).catch((error) => {
    if (error instanceof BrowserNodeSidecarError) throw error
    throw new Error(error instanceof Error ? error.message : String(error), { cause: error })
  })
  const sidecarResult = BrowserPreviewRegionSidecarResultSchema.parse(sidecar.result)
  if (!sidecarResult.ok) {
    throw new Error(
      `Browser preview region comparison runner failed: ${sidecarResult.message}${sidecarResult.stack ? `\n${sidecarResult.stack}` : ""}`,
    )
  }
  if (sidecar.exitCode !== 0) {
    throw new Error(
      `Browser preview region comparison runner exited with ${sidecar.signal ?? sidecar.exitCode}. ${sidecar.stderr.trim()}`,
    )
  }
  const regions = requireExactBrowserPreviewRegionCaptureSet({
    bindings: sidecarBindings,
    regions: sidecarResult.regions,
  })
  const verifiedRegions = await Promise.all(
    regions.map(async (region) => {
      const screenshotBytes = await readBrowserPreviewArtifactFile({
        filePath: region.screenshotPath,
        authorityRoot: input.outDir,
        scopedRoot: input.outDir,
      })
      const screenshot = PNG.sync.read(screenshotBytes)
      if (!isSameBrowserPreviewSize(region.fullpageSize, { width: screenshot.width, height: screenshot.height })) {
        throw new Error(`Browser preview region page size does not match its screenshot: ${regionCaptureKey(region)}`)
      }
      return { ...region, screenshotBytes }
    }),
  )
  return {
    jobID,
    outDir,
    regions: verifiedRegions,
  }
}

export function requireExactBrowserPreviewRegionCaptureSet(input: {
  bindings: BrowserPreviewRegionSidecarBinding[]
  regions: unknown
}): z.infer<typeof BrowserPreviewRegionSidecarCapture>[] {
  const expected = requireUniqueBrowserPreviewRegionCaptureBindings(input.bindings)
  const regions = z.array(BrowserPreviewRegionSidecarCapture).parse(input.regions)

  const actual = new Set<string>()
  for (const region of regions) {
    const key = regionCaptureKey(region)
    const binding = expected.get(key)
    if (!binding) {
      throw new Error(`Unknown browser preview region capture result: ${key}`)
    }
    if (actual.has(key)) {
      throw new Error(`Duplicate browser preview region capture result: ${key}`)
    }
    if (region.screenshotPath !== binding.screenshotPath) {
      throw new Error(`Browser preview region capture path does not match its binding: ${key}`)
    }
    if (region.routeDiagnostics.screenshot_path !== binding.screenshotPath) {
      throw new Error(`Browser preview region diagnostics path does not match its binding: ${key}`)
    }
    if (region.viewport.width !== binding.viewport.width || region.viewport.height !== binding.viewport.height) {
      throw new Error(`Browser preview region viewport does not match its binding: ${key}`)
    }
    if (region.routeDiagnostics.route !== binding.route || region.routeDiagnostics.url !== binding.expectedURL) {
      throw new Error(`Browser preview region route does not match its binding: ${key}`)
    }
    if (!isSameBrowserPreviewSize(region.fullpageSize, region.routeDiagnostics.page_size)) {
      throw new Error(`Browser preview region page size does not match its diagnostics: ${key}`)
    }
    if (!region.routeDiagnostics.valid_app_page && !region.routeDiagnostics.reason?.trim()) {
      throw new Error(`Invalid browser preview region route diagnostics have no reason: ${key}`)
    }
    const computedRouteHealth = isBrowserPreviewRegionRouteHealthy(region.routeDiagnostics)
    if (region.routeDiagnostics.valid_app_page !== computedRouteHealth) {
      throw new Error(`Browser preview region route health does not match its diagnostics: ${key}`)
    }
    if (region.routeDiagnostics.valid_app_page && region.routeDiagnostics.reason !== undefined) {
      throw new Error(`Valid browser preview region route diagnostics contain a failure reason: ${key}`)
    }
    if (region.status === "completed" && !region.routeDiagnostics.valid_app_page) {
      throw new Error(`Completed browser preview region capture has invalid route diagnostics: ${key}`)
    }
    actual.add(key)
  }
  for (const key of expected.keys()) {
    if (!actual.has(key)) {
      throw new Error(`Missing browser preview region capture result: ${key}`)
    }
  }
  return regions
}

function isSameBrowserPreviewSize(
  left: { width: number; height: number },
  right: { width: number; height: number },
): boolean {
  return left.width === right.width && left.height === right.height
}

function isBrowserPreviewRegionRouteHealthy(diagnostics: BrowserPreviewRegionRouteDiagnostics): boolean {
  return (
    !diagnostics.navigation_error &&
    diagnostics.status >= 200 &&
    diagnostics.status < 300 &&
    diagnostics.content_type.includes("text/html") &&
    diagnostics.body_length >= 200 &&
    diagnostics.dom.body_descendant_count > 0 &&
    diagnostics.failed_requests.length === 0 &&
    diagnostics.console_errors.length === 0 &&
    diagnostics.page_errors.length === 0
  )
}

function requireUniqueBrowserPreviewRegionCaptureBindings(
  bindings: BrowserPreviewRegionSidecarBinding[],
): Map<string, BrowserPreviewRegionSidecarBinding> {
  if (bindings.length === 0) {
    throw new Error("Browser preview region comparison runner requires at least one binding.")
  }
  const expected = new Map<string, BrowserPreviewRegionSidecarBinding>()
  const screenshotPaths = new Set<string>()
  for (const binding of bindings) {
    const key = regionCaptureKey(binding)
    if (expected.has(key)) {
      throw new Error(`Duplicate browser preview region capture binding: ${key}`)
    }
    if (screenshotPaths.has(binding.screenshotPath)) {
      throw new Error(`Duplicate browser preview region capture screenshot path: ${binding.screenshotPath}`)
    }
    expected.set(key, binding)
    screenshotPaths.add(binding.screenshotPath)
  }
  return expected
}

function browserPreviewRegionScreenshotPath(outDir: string, binding: BrowserPreviewRegionBinding): string {
  const identity = browserPreviewRegionIdentityKey(binding)
  const fileName = `${crypto.createHash("sha256").update(identity).digest("hex")}.png`
  return path.join(outDir, "implementation", binding.viewport_id, fileName)
}

function regionCaptureKey(input: { regionID: string; stateID: string; viewportID: BrowserPreviewViewportID }): string {
  return browserPreviewRegionIdentityKey({
    viewport_id: input.viewportID,
    state_id: input.stateID,
    region_id: input.regionID,
  })
}

export async function writeBrowserEvidenceManifest(input: {
  outDir: string
  jobID: string
  taskID: string
  targetID: string
  url: string
  viewportIDs: BrowserPreviewViewportID[]
  artifactPaths: string[]
  captures: Record<string, RuntimeCaptureResult>
  diagnostics: string[]
}): Promise<BrowserEvidenceManifestSummary> {
  requireBrowserEvidenceIdentity(input)
  await fs.mkdir(input.outDir, { recursive: true })
  const diagnosticsPath = path.join(input.outDir, "diagnostics.json")
  const requestedCaptureComplete =
    input.viewportIDs.length > 0 &&
    input.viewportIDs.every((viewportID) => {
      const capture = input.captures[viewportID]
      return Boolean(
        capture?.captured &&
          capture.passed &&
          typeof capture.path === "string" &&
          input.artifactPaths.includes(capture.path),
      )
    })
  const manifest: BrowserEvidenceManifestSummary = {
    manifestPath: path.join(input.outDir, "manifest.json"),
    jobID: input.jobID,
    taskID: input.taskID,
    targetID: input.targetID,
    operations: [
      {
        kind: "preview-capture",
        status: requestedCaptureComplete ? "completed" : "failed",
        viewportIDs: input.viewportIDs,
        artifactPaths: input.artifactPaths,
        diagnosticsPath,
      },
    ],
  }
  await fs.writeFile(
    diagnosticsPath,
    JSON.stringify(
      {
        jobID: input.jobID,
        taskID: input.taskID,
        targetID: input.targetID,
        url: input.url,
        viewportIDs: input.viewportIDs,
        diagnostics: input.diagnostics,
      },
      null,
      2,
    ),
  )
  await fs.writeFile(
    manifest.manifestPath,
    JSON.stringify(
      {
        ...manifest,
        url: input.url,
        captures: input.captures,
        diagnostics: input.diagnostics,
      },
      null,
      2,
    ),
  )
  return manifest
}

function requireBrowserEvidenceIdentity(input: {
  projectRoot?: string
  jobID?: string
  taskID: string
  targetID: string
}): void {
  const missing = [
    "projectRoot" in input && !input.projectRoot?.trim() ? "projectRoot" : undefined,
    "jobID" in input && !input.jobID?.trim() ? "jobID" : undefined,
    input.taskID.trim() ? undefined : "taskID",
    input.targetID.trim() ? undefined : "targetID",
  ].filter((item): item is string => Boolean(item))
  if (missing.length > 0) {
    throw new Error(`Browser preview evidence runner requires non-empty ${missing.join(", ")}.`)
  }
}

function requireBrowserPreviewPreparationRoot(input: {
  projectRoot: string
  taskID: string
  outDir: string
  prefix: ".browser-preview-verification-preparing-" | ".browser-preview-region-preparing-"
}): string {
  const taskRoot = path.resolve(ProjectRuntimePaths.taskRoot(input.projectRoot, input.taskID))
  const actual = path.resolve(input.outDir)
  if (path.dirname(actual) !== taskRoot || !path.basename(actual).startsWith(input.prefix)) {
    throw new Error(`Browser preview outDir must be a task runtime preparation directory under: ${taskRoot}`)
  }
  return actual
}

export async function finalizeBrowserPreviewSidecarCapture(input: {
  capture: unknown
  url: string
  outDir: string
  expectedScreenshotPath: string
}): Promise<BrowserPreviewFinalizedSidecarCapture> {
  const capture = SidecarCaptureResultSchema.parse(input.capture)
  if (!capture.captured) {
    return {
      capture: {
        captured: false,
        passed: false,
        url: input.url,
        requested_viewport: capture.requested_viewport,
        viewport: capture.viewport,
        capture_error: capture.capture_error,
        summary: capture.summary,
      },
      diagnostic: capture.summary,
    }
  }
  if (capture.target_url !== input.url) {
    throw new Error(`Browser Preview capture target URL does not match its request: ${capture.id}`)
  }
  if (capture.path !== input.expectedScreenshotPath) {
    throw new Error(`Browser Preview capture path does not match its requested viewport: ${capture.id}`)
  }
  const bytes = await readBrowserPreviewArtifactFile({
    filePath: capture.path,
    authorityRoot: input.outDir,
    scopedRoot: input.outDir,
  })
  const sha = crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 16)
  const finalPath = path.join(input.outDir, `${capture.id}-${sha}.png`)
  if (finalPath !== capture.path) {
    await fs.rename(capture.path, finalPath)
  }
  const png = PNG.sync.read(bytes)
  if (png.width !== capture.size.width || png.height !== capture.size.height) {
    throw new Error(`Browser Preview capture PNG dimensions do not match its observed page size: ${capture.id}`)
  }
  if (png.width < capture.viewport.width || png.height < capture.viewport.height) {
    throw new Error(`Browser Preview full-page capture does not cover its requested viewport: ${capture.id}`)
  }
  const variance = pngLuminanceVariance(png)
  capture.layers.pixel = {
    passed: variance >= 25,
    variance: Number(variance.toFixed(2)),
    floor: 25,
    screenshot_path: finalPath,
  }
  assertRuntimeCaptureLayerSemantics(capture.layers, capture.id)
  const failedLayers = runtimeCaptureFailedLayers(capture.layers)
  const passed = failedLayers.length === 0
  const summary = passed
    ? `all runtime capture layers passed on ${input.url}`
    : runtimeCaptureFailureSummary(capture.layers)
  return {
    capture: {
      captured: true,
      passed,
      url: input.url,
      target_url: capture.target_url,
      path: finalPath,
      sha,
      bytes: bytes.length,
      size: { width: png.width, height: png.height },
      requested_viewport: capture.requested_viewport,
      viewport: capture.viewport,
      layers: capture.layers,
      dom: capture.dom,
      summary,
    },
    artifactPath: finalPath,
    diagnostic: summary,
  }
}

function assertRuntimeCaptureLayerSemantics(layers: RuntimeCaptureLayers, captureID: string): void {
  const expected = {
    http:
      layers.http.status >= 200 &&
      layers.http.status < 300 &&
      layers.http.content_type.includes("text/html") &&
      layers.http.body_length >= 200,
    asset: layers.asset.failed.length === 0,
    dom: layers.dom.body_descendants >= layers.dom.required,
    js: layers.js.console_errors.length === 0 && layers.js.page_errors.length === 0,
    glyph: layers.glyph.failed.length === 0,
    pixel: layers.pixel.variance >= layers.pixel.floor,
    expected: layers.expected.missing_selectors.length === 0 && layers.expected.missing_texts.length === 0,
  } satisfies Record<keyof RuntimeCaptureLayers, boolean>
  for (const [name, passed] of Object.entries(expected) as Array<[keyof RuntimeCaptureLayers, boolean]>) {
    if (layers[name].passed !== passed) {
      throw new Error(`Browser Preview capture layer ${name} contradicts its diagnostics: ${captureID}`)
    }
  }
}

function requireExactBrowserPreviewEvidenceCaptureSet(input: {
  viewports: SidecarViewportInput[]
  captures: z.infer<typeof SidecarCaptureResultSchema>[]
}): z.infer<typeof SidecarCaptureResultSchema>[] {
  const expected = new Map(input.viewports.map((viewport) => [viewport.id, viewport]))
  const actual = new Map<BrowserPreviewViewportID, z.infer<typeof SidecarCaptureResultSchema>>()
  for (const capture of input.captures) {
    const viewport = expected.get(capture.id)
    if (!viewport) throw new Error(`Unknown Browser Preview viewport capture: ${capture.id}`)
    if (actual.has(capture.id)) throw new Error(`Duplicate Browser Preview viewport capture: ${capture.id}`)
    if (
      capture.requested_viewport.width !== viewport.width ||
      capture.requested_viewport.height !== viewport.height ||
      capture.viewport.width !== viewport.width ||
      capture.viewport.height !== viewport.height ||
      capture.viewport.capped
    ) {
      throw new Error(`Browser Preview viewport capture does not match its request: ${capture.id}`)
    }
    if (capture.captured && capture.path !== viewport.screenshotPath) {
      throw new Error(`Browser Preview capture path does not match its requested viewport: ${capture.id}`)
    }
    actual.set(capture.id, capture)
  }
  for (const viewportID of expected.keys()) {
    if (!actual.has(viewportID)) throw new Error(`Missing Browser Preview viewport capture: ${viewportID}`)
  }
  return input.viewports.map((viewport) => actual.get(viewport.id)!)
}

const BROWSER_PREVIEW_BATCH_SCRIPT = String.raw`
const playwrightRequirePath = process.env.OPENCORVUS_PLAYWRIGHT_REQUIRE_PATH;
if (!playwrightRequirePath) throw new Error("OPENCORVUS_PLAYWRIGHT_REQUIRE_PATH is required.");
const { chromium } = require(playwrightRequirePath);

function isBrowserImplicitAssetRequest(rawUrl) {
  try {
    return new URL(rawUrl).pathname === "/favicon.ico";
  } catch {
    return false;
  }
}

function isResourceLoadConsoleError(text) {
  return String(text || "").trimStart().startsWith("Failed to load resource:");
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
    rejectFailure(new Error(label + " browser failure before evidence capture: " + source));
  };
  const on = (event, handler) => {
    page.on(event, handler);
    listeners.push([event, handler]);
  };
  on("console", (payload) => reset(browserActivityLabel("console", payload)));
  on("response", (payload) => {
    const status = typeof payload.status === "function" ? payload.status() : 0;
    const url = typeof payload.url === "function" ? payload.url() : "";
    if (status >= 400 && status < 600 && !isBrowserImplicitAssetRequest(url)) {
      fail(browserActivityLabel("response", payload) + " HTTP " + status);
      return;
    }
    reset(browserActivityLabel("response", payload));
  });
  on("requestfailed", (payload) => {
    const url = typeof payload.url === "function" ? payload.url() : "";
    if (isBrowserImplicitAssetRequest(url)) return;
    fail(browserActivityLabel("requestfailed", payload));
  });
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

async function collectDom(page) {
  return page.evaluate(() => {
    const body = document.body;
    const text = body ? (body.innerText || "").trim() : "";
    const nodeCount = document.querySelectorAll("*").length;
    const bodyDescendantCount = body ? body.getElementsByTagName("*").length : 0;
    const hasBodyChildren = !!body && body.children.length > 0;
    const isEmptyRootShell = (() => {
      if (!body) return true;
      const elementChildren = Array.from(body.children).filter(
        (c) => c.tagName !== "SCRIPT" && c.tagName !== "STYLE" && c.tagName !== "NOSCRIPT",
      );
      if (elementChildren.length !== 1) return false;
      const sole = elementChildren[0];
      if (sole.id !== "root" && sole.id !== "app" && sole.id !== "__next") return false;
      return sole.querySelectorAll("*").length <= 1;
    })();
    return { textLength: text.length, nodeCount, bodyDescendantCount, hasBodyChildren, isEmptyRootShell };
  });
}

async function collectPageSize(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const width = Math.max(
      window.innerWidth,
      root ? root.scrollWidth : 0,
      body ? body.scrollWidth : 0,
      root ? root.offsetWidth : 0,
      body ? body.offsetWidth : 0,
    );
    const height = Math.max(
      window.innerHeight,
      root ? root.scrollHeight : 0,
      body ? body.scrollHeight : 0,
      root ? root.offsetHeight : 0,
      body ? body.offsetHeight : 0,
    );
    return { width, height };
  });
}

async function collectGlyphCoverage(page) {
  return page.evaluate(() => {
    // CJK means Chinese, Japanese, and Korean unified ideograph coverage.
    const cjkTextPattern = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u;
    const samples = [];
    const failed = [];
    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode()) && samples.length < 24) {
      const text = String(node.textContent || "").replace(/\s+/g, " ").trim();
      if (!cjkTextPattern.test(text)) continue;
      const parent = node.parentElement;
      if (!parent || !isVisible(parent)) continue;
      const style = getComputedStyle(parent);
      const sampleText = Array.from(text).filter((char) => cjkTextPattern.test(char)).slice(0, 8).join("");
      if (!sampleText) continue;
      const fontSpec = [style.fontStyle, style.fontVariant, style.fontWeight, style.fontSize, style.fontFamily]
        .filter(Boolean)
        .join(" ");
      samples.push({
        text: sampleText,
        font_family: style.fontFamily,
        font_spec: fontSpec,
        font_size: style.fontSize,
      });
    }

    for (const sample of samples) {
      const fontReady = typeof document.fonts?.check === "function" ? document.fonts.check(sample.font_spec, sample.text) : false;
      const missingChars = Array.from(new Set(Array.from(sample.text))).filter((char) =>
        glyphMatchesMissingGlyph(char, sample.font_spec, sample.font_size),
      );
      if (!fontReady || missingChars.length > 0) {
        failed.push({
          text: sample.text,
          font_family: sample.font_family,
          font_spec: sample.font_spec,
          reason: !fontReady ? "document.fonts.check failed" : "canvas glyph matched missing-glyph sentinel",
          missing_chars: missingChars,
        });
      }
    }

    return { passed: failed.length === 0, checked: samples.length, failed };

    function isVisible(element) {
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    function glyphMatchesMissingGlyph(char, fontSpec, fontSize) {
      const actual = glyphFingerprint(char, fontSpec, fontSize);
      const missing = glyphFingerprint(String.fromCodePoint(0x10ffff), fontSpec, fontSize);
      return (
        actual.ink > 0 &&
        missing.ink > 0 &&
        actual.hash === missing.hash &&
        actual.minX === missing.minX &&
        actual.minY === missing.minY &&
        actual.maxX === missing.maxX &&
        actual.maxY === missing.maxY
      );
    }

    function glyphFingerprint(char, fontSpec, fontSize) {
      const size = Number.parseFloat(fontSize) || 16;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(48, Math.min(192, Math.ceil(size * 5)));
      canvas.height = Math.max(48, Math.min(192, Math.ceil(size * 5)));
      const ctx = canvas.getContext("2d");
      if (!ctx) return { ink: 0, hash: "0", minX: 0, minY: 0, maxX: 0, maxY: 0 };
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#000";
      ctx.font = fontSpec;
      ctx.textBaseline = "top";
      ctx.fillText(char, 4, 4);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let ink = 0;
      let minX = canvas.width;
      let minY = canvas.height;
      let maxX = 0;
      let maxY = 0;
      let hash = 2166136261;
      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          const i = (y * canvas.width + x) * 4;
          const alpha = data[i + 3];
          if (alpha <= 8) continue;
          ink += 1;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
          hash ^= data[i] + (data[i + 1] << 8) + (data[i + 2] << 16) + (alpha << 24);
          hash = Math.imul(hash, 16777619) >>> 0;
        }
      }
      return {
        ink,
        hash: hash.toString(16),
        minX: ink ? minX : 0,
        minY: ink ? minY : 0,
        maxX: ink ? maxX : 0,
        maxY: ink ? maxY : 0,
      };
    }
  });
}

async function captureViewport(browser, input, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  });
  try {
    const page = await context.newPage();
    const failedRequests = [];
    let totalResponses = 0;
    page.on("response", (res) => {
      totalResponses += 1;
      const status = res.status();
      if (status >= 400 && status < 600 && !isBrowserImplicitAssetRequest(res.url())) {
        failedRequests.push({ url: res.url(), status, reason: res.statusText() || "HTTP " + status });
      }
    });
    page.on("requestfailed", (req) => {
      if (isBrowserImplicitAssetRequest(req.url())) return;
      failedRequests.push({ url: req.url(), status: 0, reason: req.failure()?.errorText || "request failed" });
    });
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text().slice(0, 400);
      if (isResourceLoadConsoleError(text)) return;
      consoleErrors.push(text);
    });
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push((err?.message || String(err)).slice(0, 400)));
    await page.exposeFunction("__opencorvusCaptureUnhandledRejection", (message) => {
      pageErrors.push(("unhandledrejection: " + message).slice(0, 400));
    });
    await page.addInitScript(() => {
      window.addEventListener("unhandledrejection", (event) => {
        const reason = event.reason;
        const message =
          reason instanceof Error ? reason.message : typeof reason === "string" ? reason : JSON.stringify(reason);
        window.__opencorvusCaptureUnhandledRejection?.(message);
      });
    });
    const response = await withBrowserInactivity(
      page,
      "navigate " + input.url,
      input.navigationTimeoutMs,
      () => page.goto(input.url, { waitUntil: "load", timeout: 0 }),
    );
    const status = response?.status() || 0;
    const contentType = String(response?.headers()["content-type"] || "").toLowerCase();
    const bodyBuf = response ? await response.body() : Buffer.alloc(0);
    let httpReason = "";
    if (status < 200 || status >= 300) httpReason = "status=" + status;
    else if (!contentType.includes("text/html")) httpReason = "content-type=" + (contentType || "(missing)") + " - app root must serve text/html";
    else if (bodyBuf.length < 200) httpReason = "body=" + bodyBuf.length + "B - too small to be an app shell";
    await new Promise((resolve) => setTimeout(resolve, input.settleMs));
    const dom = await collectDom(page);
    const pageSize = await collectPageSize(page);
    const glyph = await collectGlyphCoverage(page);
    await page.screenshot({
      path: viewport.screenshotPath,
      type: "png",
      fullPage: true,
    });
    const passed =
      status >= 200 &&
      status < 300 &&
      contentType.includes("text/html") &&
      bodyBuf.length >= 200 &&
      failedRequests.length === 0 &&
      consoleErrors.length === 0 &&
      pageErrors.length === 0 &&
      dom.bodyDescendantCount >= input.minDomDescendants &&
      glyph.passed;
    const failedLayers = [];
    if (status < 200 || status >= 300 || !contentType.includes("text/html") || bodyBuf.length < 200) failedLayers.push("http");
    if (failedRequests.length > 0) failedLayers.push("asset");
    if (consoleErrors.length > 0 || pageErrors.length > 0) failedLayers.push("js");
    if (dom.bodyDescendantCount < input.minDomDescendants) failedLayers.push("dom");
    if (!glyph.passed) failedLayers.push("glyph");
    return {
      id: viewport.id,
      captured: true,
      passed,
      target_url: input.url,
      path: viewport.screenshotPath,
      size: pageSize,
      requested_viewport: { width: viewport.width, height: viewport.height },
      viewport: { width: viewport.width, height: viewport.height, capped: false },
      layers: {
        http: { passed: !failedLayers.includes("http"), status, content_type: contentType, body_length: bodyBuf.length, reason: httpReason },
        asset: { passed: failedRequests.length === 0, total: totalResponses, failed: failedRequests },
        dom: { passed: dom.bodyDescendantCount >= input.minDomDescendants, body_descendants: dom.bodyDescendantCount, required: input.minDomDescendants },
        js: { passed: consoleErrors.length === 0 && pageErrors.length === 0, console_errors: consoleErrors, page_errors: pageErrors },
        glyph,
        pixel: { passed: false, variance: 0, floor: 25, screenshot_path: viewport.screenshotPath },
        expected: { passed: true, missing_selectors: [], missing_texts: [] },
      },
      dom,
      summary: passed ? "browser preview capture passed on " + input.url : "failed layers: " + failedLayers.join(", "),
    };
  } catch (error) {
    const message = error?.message || String(error);
    return {
      id: viewport.id,
      captured: false,
      passed: false,
      requested_viewport: { width: viewport.width, height: viewport.height },
      viewport: { width: viewport.width, height: viewport.height, capped: false },
      capture_error: { kind: "capture_failed", message },
      summary: "browser preview capture failed: " + message,
    };
  } finally {
    await context.close();
  }
}

async function main() {
  const input = JSON.parse(Buffer.from(process.env.OPENCORVUS_BROWSER_PREVIEW_EVIDENCE_INPUT || "", "base64").toString("utf8"));
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: input.executablePath,
      headless: true,
      timeout: input.launchTimeoutMs,
      args: input.launchArgs,
    });
    const captures = [];
    for (const viewport of input.viewports) {
      captures.push(await captureViewport(browser, input, viewport));
    }
    process.stdout.write(JSON.stringify({ ok: true, captures }));
  } catch (error) {
    process.stdout.write(JSON.stringify({
      ok: false,
      message: error?.message || String(error),
      stack: error?.stack,
    }));
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
  }
}

main();
`

const BROWSER_PREVIEW_REGION_COMPARISON_SCRIPT = String.raw`
const fs = require("node:fs/promises");
const path = require("node:path");
const playwrightRequirePath = process.env.OPENCORVUS_PLAYWRIGHT_REQUIRE_PATH;
if (!playwrightRequirePath) throw new Error("OPENCORVUS_PLAYWRIGHT_REQUIRE_PATH is required.");
const { chromium } = require(playwrightRequirePath);

function isBrowserImplicitAssetRequest(rawUrl) {
  try {
    return new URL(rawUrl).pathname === "/favicon.ico";
  } catch {
    return false;
  }
}

function routeUrl(base, route) {
  return new URL(route, base).toString();
}

function browserActivityLabel(event, payload) {
  if (payload && typeof payload.url === "function") return event + " " + payload.url();
  if (payload && typeof payload.message === "function") return event + " " + payload.message();
  if (payload && typeof payload.text === "function") return event + " " + payload.text();
  if (payload && typeof payload.errorText === "string") return event + " " + payload.errorText;
  return event;
}

function isResourceLoadConsoleError(text) {
  return String(text || "").trimStart().startsWith("Failed to load resource:");
}

async function withBrowserInactivity(page, label, inactivityTimeoutMs, action) {
  let settled = false;
  let lastActivity = "start";
  let timer;
  let rejectInactive;
  const listeners = [];
  const inactive = new Promise((_, reject) => {
    rejectInactive = reject;
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
  const on = (event, handler) => {
    page.on(event, handler);
    listeners.push([event, handler]);
  };
  on("console", (payload) => reset(browserActivityLabel("console", payload)));
  on("response", (payload) => {
    const status = typeof payload.status === "function" ? payload.status() : 0;
    const url = typeof payload.url === "function" ? payload.url() : "";
    if (status >= 400 && status < 600 && isBrowserImplicitAssetRequest(url)) return;
    reset(browserActivityLabel("response", payload));
  });
  reset("start");
  try {
    return await Promise.race([action(), inactive]);
  } finally {
    settled = true;
    clearTimer();
    for (const [event, handler] of listeners) page.off(event, handler);
  }
}

async function collectDom(page) {
  return page.evaluate(() => {
    const body = document.body;
    const text = body ? (body.innerText || "").trim() : "";
    return {
      text_length: text.length,
      node_count: document.querySelectorAll("*").length,
      body_descendant_count: body ? body.getElementsByTagName("*").length : 0,
    };
  });
}

async function collectPageSize(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const width = Math.max(
      window.innerWidth,
      root ? root.scrollWidth : 0,
      body ? body.scrollWidth : 0,
      root ? root.offsetWidth : 0,
      body ? body.offsetWidth : 0,
    );
    const height = Math.max(
      window.innerHeight,
      root ? root.scrollHeight : 0,
      body ? body.scrollHeight : 0,
      root ? root.offsetHeight : 0,
      body ? body.offsetHeight : 0,
    );
    return { width, height };
  });
}

function createRouteDiagnosticsRecorder(page) {
  let failedRequests = [];
  let consoleErrors = [];
  let pageErrors = [];
  page.on("response", (res) => {
    const status = res.status();
    if (status >= 400 && status < 600 && !isBrowserImplicitAssetRequest(res.url())) {
      failedRequests.push({ url: res.url(), status, reason: res.statusText() || "HTTP " + status });
    }
  });
  page.on("requestfailed", (req) => {
    if (isBrowserImplicitAssetRequest(req.url())) return;
    failedRequests.push({ url: req.url(), status: 0, reason: req.failure()?.errorText || "request failed" });
  });
  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error" && !isResourceLoadConsoleError(text)) consoleErrors.push(text.slice(0, 400));
  });
  page.on("pageerror", (err) => pageErrors.push((err?.message || String(err)).slice(0, 400)));
  return {
    reset() {
      failedRequests = [];
      consoleErrors = [];
      pageErrors = [];
    },
    snapshot() {
      return {
        failed_requests: failedRequests.slice(),
        console_errors: consoleErrors.slice(),
        page_errors: pageErrors.slice(),
      };
    },
  };
}

async function navigateAndDiagnose(page, recorder, input, route, screenshotPath) {
  recorder.reset();
  let response = null;
  let navigationError = "";
  const targetUrl = routeUrl(input.url, route);
  try {
    response = await withBrowserInactivity(
      page,
      "navigate " + targetUrl,
      input.navigationTimeoutMs,
      () => page.goto(targetUrl, { waitUntil: "load", timeout: 0 }),
    );
  } catch (error) {
    navigationError = error?.message || String(error);
  }
  await new Promise((resolve) => setTimeout(resolve, input.settleMs));
  const status = response ? response.status() : 0;
  const headers = response ? response.headers() : {};
  const contentType = String(headers["content-type"] || "").toLowerCase();
  const bodyLength = response ? (await response.body()).length : 0;
  const dom = await collectDom(page);
  const pageSize = await collectPageSize(page);
  const title = await page.title();
  await page.screenshot({ path: screenshotPath, type: "png", fullPage: true });
  const recorded = recorder.snapshot();
  const validAppPage =
    !navigationError &&
    status >= 200 &&
    status < 300 &&
    contentType.includes("text/html") &&
    bodyLength >= 200 &&
    dom.body_descendant_count > 0 &&
    recorded.failed_requests.length === 0 &&
    recorded.console_errors.length === 0 &&
    recorded.page_errors.length === 0;
  const reasons = [];
  if (navigationError) reasons.push("navigation=" + navigationError);
  if (status < 200 || status >= 300) reasons.push("status=" + status);
  if (!contentType.includes("text/html")) reasons.push("content-type=" + (contentType || "(missing)"));
  if (bodyLength < 200) reasons.push("body=" + bodyLength + "B");
  if (dom.body_descendant_count <= 0) reasons.push("dom_descendants=" + dom.body_descendant_count);
  if (recorded.failed_requests.length > 0) reasons.push("failed_requests=" + recorded.failed_requests.length);
  if (recorded.console_errors.length > 0) reasons.push("console_errors=" + recorded.console_errors.length);
  if (recorded.page_errors.length > 0) reasons.push("page_errors=" + recorded.page_errors.length);
  return {
    route,
    url: targetUrl,
    final_url: page.url(),
    status,
    content_type: contentType,
    body_length: bodyLength,
    title,
    dom,
    page_size: pageSize,
    navigation_error: navigationError,
    ...recorded,
    valid_app_page: validAppPage,
    reason: validAppPage ? undefined : reasons.join(", "),
    screenshot_path: screenshotPath,
  };
}

async function locate(page, locator) {
  const target = locatorFor(page, locator).first();
  const visible = await target.isVisible();
  if (!visible) return null;
  const box = await target.boundingBox();
  if (!box || box.width <= 0 || box.height <= 0) return null;
  const normalized = toBox(box);
  if (normalized.width <= 0 || normalized.height <= 0) return null;
  return normalized;
}

function locatorFor(page, locator) {
  if (locator.kind === "role") return page.getByRole(locator.role, { name: locator.name });
  return page.locator(selectorFor(locator));
}

function selectorFor(locator) {
  if (locator.kind === "selector") return locator.value;
  if (locator.kind === "test-id") return "[data-testid=" + JSON.stringify(locator.value) + "]";
  if (locator.kind === "data-oc-region") return "[data-oc-region=" + JSON.stringify(locator.value) + "]";
  throw new Error("Unsupported locator kind: " + locator.kind);
}

function toBox(rect) {
  return {
    x: Math.max(0, Math.round(rect.x)),
    y: Math.max(0, Math.round(rect.y)),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

async function main() {
  const input = JSON.parse(Buffer.from(process.env.OPENCORVUS_BROWSER_PREVIEW_REGION_COMPARISON_INPUT || "", "base64").toString("utf8"));
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: input.executablePath,
      headless: true,
      timeout: input.launchTimeoutMs,
      args: input.launchArgs,
    });
    const regions = [];
    for (const viewportID of input.viewportIDs) {
      const firstBinding = input.bindings.find((binding) => binding.viewportID === viewportID);
      if (!firstBinding) throw new Error("Region comparison viewport has no binding: " + viewportID);
      const viewport = firstBinding.viewport;
      const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
      try {
        const page = await context.newPage();
        const recorder = createRouteDiagnosticsRecorder(page);
        let currentRoute = firstBinding.route;
        const viewportDir = path.join(input.outDir, "implementation", viewportID);
        await fs.mkdir(viewportDir, { recursive: true });
        let currentRouteDiagnostics = await navigateAndDiagnose(page, recorder, input, currentRoute, firstBinding.screenshotPath);
        for (const binding of input.bindings.filter((item) => item.viewportID === viewportID)) {
          if (binding.route !== currentRoute) {
            currentRoute = binding.route;
            currentRouteDiagnostics = await navigateAndDiagnose(page, recorder, input, binding.route, binding.screenshotPath);
          } else if (binding !== firstBinding) {
            await page.screenshot({ path: binding.screenshotPath, type: "png", fullPage: true });
          }
          const regionScreenshotPath = binding.screenshotPath;
          const routeDiagnostics = { ...currentRouteDiagnostics, screenshot_path: regionScreenshotPath };
          if (!routeDiagnostics.valid_app_page) {
            const reason = "Implementation route did not render a valid app page: route=" + binding.route + " url=" + routeDiagnostics.url + " " + routeDiagnostics.reason;
            regions.push({
              regionID: binding.regionID,
              stateID: binding.stateID,
              viewportID,
              status: "failed",
              reason,
              screenshotPath: regionScreenshotPath,
              viewport,
              fullpageSize: routeDiagnostics.page_size,
              routeDiagnostics,
            });
            continue;
          }
          const bbox = await locate(page, binding.locator);
          if (!bbox) {
            regions.push({
              regionID: binding.regionID,
              stateID: binding.stateID,
              viewportID,
              status: "failed",
              reason: "Implementation locator did not match any visible element.",
              screenshotPath: regionScreenshotPath,
              viewport,
              fullpageSize: routeDiagnostics.page_size,
              routeDiagnostics,
            });
            continue;
          }
          regions.push({
            regionID: binding.regionID,
            stateID: binding.stateID,
            viewportID,
            status: "completed",
            bbox,
            screenshotPath: regionScreenshotPath,
            viewport,
            fullpageSize: routeDiagnostics.page_size,
            routeDiagnostics,
          });
        }
      } finally {
        await context.close();
      }
    }
    process.stdout.write(JSON.stringify({ ok: true, regions }));
  } catch (error) {
    process.stdout.write(JSON.stringify({ ok: false, message: error?.message || String(error), stack: error?.stack }));
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
  }
}

main();
`
