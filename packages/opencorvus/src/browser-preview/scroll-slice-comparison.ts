import fs from "node:fs/promises"
import path from "node:path"
import z from "zod"
import { BrowserNodeSidecarError, runTaskBrowserNodeSidecar } from "@/browser/runtime/node-executor"
import { resolveBrowserNodeSidecarRuntime } from "@/browser/runtime/node-sidecar"
import { BrowserRuntime } from "@/browser/runtime"
import { Identifier } from "@/id/id"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { requireRuntimePackage } from "@/runtime/package-require"
import { readTaskArtifactRef } from "@/task-artifact/store"
import {
  isEvaluationReportPassing,
  WEBPAGE_REFERENCE_COMPARISON_SSIM_PASS_THRESHOLD,
} from "@/browser-preview/visual/evaluate"
import {
  findBrowserPreviewTargetByID,
  normalizeRuntimePathRefs,
  persistBrowserPreviewEvidenceBatch,
  type PersistBrowserPreviewEvidenceInput,
} from "./persist"
import { throwAfterBrowserPreviewPublicationCleanup } from "./publication-cleanup"
import { BrowserPreviewSourceImageArtifactRef } from "./region-schema"
import { BrowserPreviewViewportID } from "./viewport"
import { BrowserPreviewComparisonGuidance, BrowserPreviewComparisonGuidanceSchema } from "./comparison-guidance"
import { readBrowserPreviewArtifactFile } from "./artifact-file"

const sharp = requireRuntimePackage<typeof import("sharp")>("sharp")
const SCROLL_SLICE_CAPTURE_EXTRA_TIMEOUT_MS = 45_000
const SCROLL_SLICE_ROUTE_NAVIGATION_INACTIVITY_MS = 30_000
const SCROLL_SLICE_NETWORK_IDLE_INACTIVITY_MS = 5_000
const SCROLL_SLICE_SETTLE_AFTER_SCROLL_MS = 250
const SIDE_BY_SIDE_TITLE_HEIGHT_PX = 44
const SIDE_BY_SIDE_LABEL_HEIGHT_PX = 32
const SIDE_BY_SIDE_GAP_PX = 16
// SSIM means Structural Similarity Index Measure. Low structural similarity usually means the
// compared slices are not the same page area, or the whole page layout drifted before this slice.
const LOW_SSIM_LAYOUT_WARNING_THRESHOLD = 0.8

const BrowserPreviewScrollSliceRoute = z
  .string()
  .min(1)
  .refine((value) => value.startsWith("/") && !value.startsWith("//"), {
    message: "route must be a target-local path beginning with a single '/'.",
  })

export const BrowserPreviewScrollSliceComparisonRequest = z
  .object({
    targetID: z.string().min(1),
    viewportID: BrowserPreviewViewportID.default("desktop"),
    sourceArtifact: BrowserPreviewSourceImageArtifactRef,
    route: BrowserPreviewScrollSliceRoute.default("/"),
    scrollY: z.number().int().nonnegative(),
    sliceHeight: z.number().int().positive(),
  })
  .strict()
export type BrowserPreviewScrollSliceComparisonRequest = z.infer<typeof BrowserPreviewScrollSliceComparisonRequest>

export const BrowserPreviewScrollSliceComparisonResult = z
  .object({
    status: z.enum(["passed", "failed"]),
    operation: z.literal("scroll-slice-comparison"),
    manifestPath: z.string(),
    evidenceID: z.string(),
    jobID: z.string(),
    taskID: z.string(),
    targetID: z.string(),
    viewportID: BrowserPreviewViewportID,
    route: z.string(),
    scrollY: z.number().int().nonnegative(),
    sliceHeight: z.number().int().positive(),
    sourceArtifact: BrowserPreviewSourceImageArtifactRef,
    url: z.string(),
    sourceImageSize: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }),
    implementation: z.object({
      url: z.string(),
      actualScrollY: z.number(),
      maxScrollY: z.number(),
      viewport: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }),
      pageSize: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }),
      title: z.string(),
    }),
    visual: z.object({
      overall_score: z.number(),
      ssim_score: z.number(),
      pixel_diff_percent: z.number(),
      mismatched_pixels: z.number(),
      total_pixels: z.number(),
      dimensions_match: z.boolean(),
    }),
    artifacts: z.object({
      source_crop: z.string(),
      implementation_crop: z.string(),
      side_by_side: z.string(),
      diff: z.string().optional(),
    }),
    comparison_guidance: BrowserPreviewComparisonGuidanceSchema,
    diagnostics: z.array(z.string()),
  })
  .strict()
export type BrowserPreviewScrollSliceComparisonResult = z.infer<typeof BrowserPreviewScrollSliceComparisonResult>

type CompareScrollSliceInput = BrowserPreviewScrollSliceComparisonRequest & {
  projectID: string
  projectRoot: string
  taskID: string
  includeDiff?: boolean
  signal?: AbortSignal
}

const ScrollSliceSidecarSize = z
  .object({ width: z.number().int().positive(), height: z.number().int().positive() })
  .strict()
const ScrollSliceSidecarResultSchema = z.discriminatedUnion("ok", [
  z
    .object({
      ok: z.literal(true),
      screenshotPath: z.string().min(1),
      url: z.string().min(1),
      actualScrollY: z.number().int().nonnegative(),
      maxScrollY: z.number().int().nonnegative(),
      viewport: ScrollSliceSidecarSize,
      pageSize: ScrollSliceSidecarSize,
      title: z.string(),
    })
    .strict(),
  z.object({ ok: z.literal(false), message: z.string().min(1), stack: z.string().optional() }).strict(),
])

export async function compareBrowserPreviewScrollSlice(
  input: CompareScrollSliceInput,
): Promise<BrowserPreviewScrollSliceComparisonResult> {
  if (!input.taskID.trim() || !input.targetID.trim()) {
    throw new Error("Browser preview scroll-slice comparison requires taskID and targetID.")
  }
  const target = findBrowserPreviewTargetByID({ taskID: input.taskID, targetID: input.targetID })
  if (!target) {
    throw new Error(`Browser preview target not found: ${input.targetID}`)
  }

  const projectRoot = path.resolve(input.projectRoot)
  const sourceBytes = await readTaskArtifactRef({
    projectID: input.projectID,
    projectDirectory: projectRoot,
    taskID: input.taskID,
    ref: input.sourceArtifact,
  })
  const sourceImageSize = await readPngSize(sourceBytes)
  assertSliceWithinSource({
    sourceImagePath: input.sourceArtifact.path,
    sourceImageSize,
    scrollY: input.scrollY,
    sliceHeight: input.sliceHeight,
  })

  const jobID = Identifier.ascending("artifact")
  const outDir = ProjectRuntimePaths.browserPreviewJobRoot(projectRoot, input.taskID, jobID)
  const jobParent = path.dirname(outDir)
  const preparedDir = await fs.mkdtemp(
    path.join(ProjectRuntimePaths.taskRoot(projectRoot, input.taskID), ".browser-preview-scroll-preparing-"),
  )
  let published = false
  try {
    const preparedSourceImage = path.join(preparedDir, "source-reference.png")
    const preparedSourceCrop = path.join(preparedDir, "source-slice.png")
    const preparedImplementationCapture = path.join(preparedDir, "implementation-capture.png")
    const preparedImplementationCrop = path.join(preparedDir, "implementation-slice.png")
    const preparedSideBySide = path.join(preparedDir, "side-by-side.png")
    await fs.writeFile(preparedSourceImage, sourceBytes)
    const sourceCropBytes = await sharp(sourceBytes)
      .extract({ left: 0, top: input.scrollY, width: sourceImageSize.width, height: input.sliceHeight })
      .png()
      .toBuffer()
    await fs.writeFile(preparedSourceCrop, sourceCropBytes)

    const implementation = await captureImplementationSlice({
      taskID: input.taskID,
      projectRoot,
      targetUrl: target.url,
      route: input.route,
      outDir: preparedDir,
      screenshotPath: preparedImplementationCapture,
      viewport: { width: sourceImageSize.width, height: input.sliceHeight },
      scrollY: input.scrollY,
      signal: input.signal,
    })
    if (
      implementation.viewport.width !== sourceImageSize.width ||
      implementation.viewport.height !== input.sliceHeight
    ) {
      throw new Error(
        `Implementation viewport mismatch: expected ${sourceImageSize.width}x${input.sliceHeight}, got ` +
          `${implementation.viewport.width}x${implementation.viewport.height}.`,
      )
    }

    const implementationCropBytes = await sharp(implementation.screenshotBytes).png().toBuffer()
    await fs.writeFile(preparedImplementationCrop, implementationCropBytes)
    const visual = await evaluateSliceVisual(sourceCropBytes, implementationCropBytes)
    const ssimPassed = isEvaluationReportPassing({ ssimScore: visual.ssimScore })
    const lowSsimWarning = buildLowSsimLayoutWarning(visual.ssimScore)
    await makeScrollSliceSideBySide({
      leftBytes: sourceCropBytes,
      rightBytes: implementationCropBytes,
      outputPath: preparedSideBySide,
      title: `${input.viewportID} scrollY=${input.scrollY} height=${input.sliceHeight}`,
      warning: lowSsimWarning ? "Low SSIM: screenshots may not match; calibrate whole page layout first." : undefined,
    })
    if (input.includeDiff === true) {
      await writeDataUrlPng(visual.diffImageDataUrl, path.join(preparedDir, "diff.png"))
    }
    await fs.unlink(preparedImplementationCapture)
    await fs.mkdir(jobParent, { recursive: true })
    await fs.rename(preparedDir, outDir)
    published = true

    const sourceCrop = path.join(outDir, "source-slice.png")
    const implementationCrop = path.join(outDir, "implementation-slice.png")
    const sideBySide = path.join(outDir, "side-by-side.png")
    const artifacts: BrowserPreviewScrollSliceComparisonResult["artifacts"] = {
      source_crop: sourceCrop,
      implementation_crop: implementationCrop,
      side_by_side: sideBySide,
    }
    if (input.includeDiff === true) {
      const diff = path.join(outDir, "diff.png")
      artifacts.diff = diff
    }

    const manifestPath = path.join(outDir, "manifest.json")
    const evidenceID = Identifier.ascending("artifact")
    const evidenceInput: PersistBrowserPreviewEvidenceInput = {
      projectRoot,
      taskID: input.taskID,
      targetID: input.targetID,
      viewportID: input.viewportID,
      operationKind: "scroll-slice-comparison",
      manifestPath,
      artifactPaths: artifacts,
      status: ssimPassed ? "passed" : "failed",
      summary: ssimPassed
        ? `Scroll-slice comparison passed for ${input.viewportID} scrollY=${input.scrollY}.`
        : `Scroll-slice comparison failed for ${input.viewportID} scrollY=${input.scrollY}.`,
      diagnostics: [
        "Scroll-slice comparison is supporting Visual QA evidence only.",
        "It is not reference-comparison proof.",
        ssimPassed
          ? `Scroll-slice SSIM ${visual.ssimScore.toFixed(3)} is greater than ${WEBPAGE_REFERENCE_COMPARISON_SSIM_PASS_THRESHOLD.toFixed(2)}.`
          : `Scroll-slice SSIM ${visual.ssimScore.toFixed(3)} is not greater than ${WEBPAGE_REFERENCE_COMPARISON_SSIM_PASS_THRESHOLD.toFixed(2)}.`,
        ...(lowSsimWarning ? [lowSsimWarning] : []),
      ],
      capture: {
        operation: "scroll-slice-comparison",
        source_artifact: input.sourceArtifact,
      },
    }
    const { screenshotBytes: _screenshotBytes, ...implementationEvidence } = implementation
    const result: BrowserPreviewScrollSliceComparisonResult = {
      status: ssimPassed ? "passed" : "failed",
      operation: "scroll-slice-comparison",
      manifestPath,
      evidenceID,
      jobID,
      taskID: input.taskID,
      targetID: input.targetID,
      viewportID: input.viewportID,
      route: input.route,
      scrollY: input.scrollY,
      sliceHeight: input.sliceHeight,
      sourceArtifact: input.sourceArtifact,
      url: target.url,
      sourceImageSize,
      implementation: implementationEvidence,
      visual: {
        overall_score: visual.overallScore,
        ssim_score: visual.ssimScore,
        pixel_diff_percent: visual.pixelDiffPercent,
        mismatched_pixels: visual.mismatchedPixels,
        total_pixels: visual.totalPixels,
        dimensions_match: visual.dimensionsMatch,
      },
      artifacts,
      comparison_guidance: BrowserPreviewComparisonGuidance,
      diagnostics: [
        "Scroll-slice comparison is supporting Visual QA evidence only.",
        "It is not reference-comparison proof.",
        ssimPassed
          ? `Scroll-slice SSIM ${visual.ssimScore.toFixed(3)} is greater than ${WEBPAGE_REFERENCE_COMPARISON_SSIM_PASS_THRESHOLD.toFixed(2)}.`
          : `Scroll-slice SSIM ${visual.ssimScore.toFixed(3)} is not greater than ${WEBPAGE_REFERENCE_COMPARISON_SSIM_PASS_THRESHOLD.toFixed(2)}.`,
        ...(lowSsimWarning ? [lowSsimWarning] : []),
      ],
    }
    const publicResult = normalizeRuntimePathRefs(projectRoot, result) as BrowserPreviewScrollSliceComparisonResult
    await fs.writeFile(result.manifestPath, JSON.stringify(publicResult, null, 2), "utf8")
    await persistBrowserPreviewEvidenceBatch([{ id: evidenceID, input: evidenceInput }])
    return publicResult
  } catch (error) {
    return await throwAfterBrowserPreviewPublicationCleanup({
      primaryFailure: error,
      residualPath: published ? outDir : preparedDir,
    })
  }
}

async function captureImplementationSlice(input: {
  taskID: string
  projectRoot: string
  targetUrl: string
  route: string
  outDir: string
  screenshotPath: string
  viewport: { width: number; height: number }
  scrollY: number
  signal?: AbortSignal
}): Promise<BrowserPreviewScrollSliceComparisonResult["implementation"] & { screenshotBytes: Buffer }> {
  const executablePath = await BrowserRuntime.findBrowserExecutable()
  const launchTimeoutMs = BrowserRuntime.resolveBrowserLaunchTimeoutMs(undefined)
  const runtime = await resolveBrowserNodeSidecarRuntime()
  const sidecar = await runTaskBrowserNodeSidecar<unknown>({ taskID: input.taskID, cwd: input.projectRoot }, {
    runtime,
    script: BROWSER_PREVIEW_SCROLL_SLICE_SCRIPT,
    payload: {
      targetUrl: input.targetUrl,
      route: input.route,
      outDir: input.outDir,
      screenshotPath: input.screenshotPath,
      viewport: input.viewport,
      scrollY: input.scrollY,
      executablePath,
      launchArgs: BrowserRuntime.defaultLaunchArgs(),
      launchTimeoutMs,
    },
    inactivityTimeoutMs: launchTimeoutMs + SCROLL_SLICE_CAPTURE_EXTRA_TIMEOUT_MS,
    label: "Browser preview scroll-slice comparison runner",
    signal: input.signal,
  }).catch((error) => {
    if (error instanceof BrowserNodeSidecarError) throw error
    throw new Error(error instanceof Error ? error.message : String(error), { cause: error })
  })
  const sidecarResult = ScrollSliceSidecarResultSchema.parse(sidecar.result)
  if (!sidecarResult.ok) {
    throw new Error(
      `Browser preview scroll-slice comparison runner failed: ${sidecarResult.message}${
        sidecarResult.stack ? `\n${sidecarResult.stack}` : ""
      }`,
    )
  }
  if (sidecar.exitCode !== 0) {
    throw new Error(
      `Browser preview scroll-slice comparison runner exited with ${sidecar.signal ?? sidecar.exitCode}. ${sidecar.stderr.trim()}`,
    )
  }
  if (sidecarResult.screenshotPath !== input.screenshotPath) {
    throw new Error("Browser preview scroll-slice screenshot path does not match the host request.")
  }
  if (
    sidecarResult.viewport.width !== input.viewport.width ||
    sidecarResult.viewport.height !== input.viewport.height
  ) {
    throw new Error("Browser preview scroll-slice viewport does not match the host request.")
  }
  if (sidecarResult.actualScrollY !== input.scrollY) {
    throw new Error("Browser preview scroll-slice position does not match the host request.")
  }
  if (sidecarResult.url !== new URL(input.route, input.targetUrl).toString()) {
    throw new Error("Browser preview scroll-slice URL does not match the host request.")
  }
  const screenshotBytes = await readBrowserPreviewArtifactFile({
    filePath: sidecarResult.screenshotPath,
    authorityRoot: input.outDir,
    scopedRoot: input.outDir,
  })
  const screenshotSize = await readPngSize(screenshotBytes)
  if (screenshotSize.width !== input.viewport.width || screenshotSize.height !== input.viewport.height) {
    throw new Error("Browser preview scroll-slice screenshot dimensions do not match the host request.")
  }
  return {
    url: sidecarResult.url,
    actualScrollY: sidecarResult.actualScrollY,
    maxScrollY: sidecarResult.maxScrollY,
    viewport: sidecarResult.viewport,
    pageSize: sidecarResult.pageSize,
    title: sidecarResult.title,
    screenshotBytes,
  }
}

async function readPngSize(bytes: Uint8Array): Promise<{ width: number; height: number }> {
  const metadata = await sharp(bytes).metadata()
  if (!metadata.width || !metadata.height) throw new Error("Cannot read PNG dimensions from verified bytes.")
  return { width: metadata.width, height: metadata.height }
}

function assertSliceWithinSource(input: {
  sourceImagePath: string
  sourceImageSize: { width: number; height: number }
  scrollY: number
  sliceHeight: number
}): void {
  if (input.scrollY + input.sliceHeight > input.sourceImageSize.height) {
    throw new Error(
      `Requested scroll slice exceeds reference image bounds: scrollY=${input.scrollY} ` +
        `sliceHeight=${input.sliceHeight} image=${input.sourceImageSize.width}x${input.sourceImageSize.height} ` +
        `path=${input.sourceImagePath}`,
    )
  }
}

async function evaluateSliceVisual(originalImage: Uint8Array, renderedImage: Uint8Array) {
  const { evaluateVisual } = await import("@/browser-preview/visual/evaluate")
  return evaluateVisual({ originalImage: pngDataUrl(originalImage), renderedImage: pngDataUrl(renderedImage) })
}

async function makeScrollSliceSideBySide(input: {
  leftBytes: Buffer
  rightBytes: Buffer
  outputPath: string
  title: string
  warning?: string
}): Promise<void> {
  const [leftMeta, rightMeta] = await Promise.all([sharp(input.leftBytes).metadata(), sharp(input.rightBytes).metadata()])
  if (!leftMeta.width || !leftMeta.height || !rightMeta.width || !rightMeta.height) {
    throw new Error("Cannot compose scroll-slice comparison without image dimensions.")
  }
  const titleHeight = SIDE_BY_SIDE_TITLE_HEIGHT_PX
  const warningHeight = input.warning ? 32 : 0
  const labelHeight = SIDE_BY_SIDE_LABEL_HEIGHT_PX
  const gap = SIDE_BY_SIDE_GAP_PX
  const width = leftMeta.width + rightMeta.width + gap
  const headerHeight = titleHeight + warningHeight + labelHeight
  const height = headerHeight + Math.max(leftMeta.height, rightMeta.height)
  const labels = Buffer.from(`
    <svg width="${width}" height="${headerHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f6f7f9"/>
      <text x="12" y="28" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#111827">${escapeXml(input.title)}</text>
      ${
        input.warning
          ? `<text x="12" y="${titleHeight + 20}" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#b45309">${escapeXml(input.warning)}</text>`
          : ""
      }
      <text x="12" y="${titleHeight + warningHeight + 22}" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#374151">LEFT: Source reference slice</text>
      <text x="${leftMeta.width + gap + 12}" y="${titleHeight + warningHeight + 22}" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#374151">RIGHT: Local implementation slice</text>
    </svg>
  `)
  const output = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: "#f6f7f9",
    },
  })
    .composite([
      { input: labels, left: 0, top: 0 },
      { input: input.leftBytes, left: 0, top: headerHeight },
      { input: input.rightBytes, left: leftMeta.width + gap, top: headerHeight },
    ])
    .png()
    .toBuffer()
  await fs.writeFile(input.outputPath, output)
}

function pngDataUrl(bytes: Uint8Array): string {
  return `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`
}

function buildLowSsimLayoutWarning(ssimScore: number): string | undefined {
  if (ssimScore >= LOW_SSIM_LAYOUT_WARNING_THRESHOLD) return undefined
  return (
    `Low SSIM precheck (${ssimScore.toFixed(3)} < ${LOW_SSIM_LAYOUT_WARNING_THRESHOLD.toFixed(2)}): ` +
    "screenshots may not match, the page's overall layout may be misaligned, and the page should be calibrated as a whole before local component tuning."
  )
}

async function writeDataUrlPng(input: string, outputPath: string): Promise<void> {
  const prefix = "data:image/png;base64,"
  if (!input.startsWith(prefix)) {
    throw new Error("Scroll-slice visual diff must be a PNG data URL.")
  }
  await fs.writeFile(outputPath, Buffer.from(input.slice(prefix.length), "base64"))
}

function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

const BROWSER_PREVIEW_SCROLL_SLICE_SCRIPT = `
const fs = require("node:fs/promises");
const path = require("node:path");
const playwrightRequirePath = process.argv[3];
if (!playwrightRequirePath) throw new Error("Browser Node sidecar argv[3] Playwright module path is required.");
const { chromium } = require(playwrightRequirePath);

const input = JSON.parse(Buffer.from(process.argv[2], "base64").toString("utf8"));

function browserActivityLabel(event, payload) {
  if (payload && typeof payload.url === "function") return event + " " + payload.url();
  if (payload && typeof payload.message === "function") return event + " " + payload.message();
  if (payload && typeof payload.message === "string") return event + " " + payload.message;
  if (payload && typeof payload.text === "function") return event + " " + payload.text();
  if (payload && typeof payload.text === "string") return event + " " + payload.text;
  if (payload && typeof payload.errorText === "string") return event + " " + payload.errorText;
  return event;
}

function isBrowserImplicitAssetRequest(rawUrl) {
  try {
    return new URL(rawUrl).pathname === "/favicon.ico";
  } catch {
    return false;
  }
}

function taggedBrowserInactivityError(message) {
  const error = new Error(message);
  error.opencorvusBrowserInactivity = true;
  return error;
}

function installBrowserFailureTracker(page, label) {
  const failures = [];
  const listeners = [];
  const record = (source) => {
    if (!failures.includes(source)) failures.push(source);
  };
  const on = (event, handler) => {
    page.on(event, handler);
    listeners.push([event, handler]);
  };
  on("response", (payload) => {
    const status = typeof payload.status === "function" ? payload.status() : 0;
    const url = typeof payload.url === "function" ? payload.url() : "";
    if (status >= 400 && status < 600 && !isBrowserImplicitAssetRequest(url)) {
      record(browserActivityLabel("response", payload) + " HTTP " + status);
    }
  });
  on("requestfailed", (payload) => {
    const url = typeof payload.url === "function" ? payload.url() : "";
    if (isBrowserImplicitAssetRequest(url)) return;
    record(browserActivityLabel("requestfailed", payload));
  });
  on("pageerror", (payload) => record(browserActivityLabel("pageerror", payload)));
  return {
    assertNoFailures(stage) {
      if (failures.length > 0) throw new Error(label + " browser failure before " + stage + ": " + failures.join("; "));
    },
    dispose() {
      for (const [event, handler] of listeners) page.off(event, handler);
    },
  };
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
      rejectInactive(taggedBrowserInactivityError(label + " browser inactive for " + inactivityTimeoutMs + "ms after " + lastActivity));
    }, inactivityTimeoutMs);
  };
  const fail = (source) => {
    if (settled) return;
    rejectFailure(new Error(label + " browser failure before scroll-slice capture: " + source));
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

(async () => {
  let browser;
  try {
    await fs.mkdir(input.outDir, { recursive: true });
    browser = await chromium.launch({
      executablePath: input.executablePath,
      args: input.launchArgs,
      timeout: input.launchTimeoutMs,
    });
    const page = await browser.newPage({
      viewport: { width: input.viewport.width, height: input.viewport.height },
      deviceScaleFactor: 1,
    });
    const routeUrl = new URL(input.route, input.targetUrl).toString();
    const browserFailures = installBrowserFailureTracker(page, "scroll-slice comparison");
    let result;
    try {
      const response = await withBrowserInactivity(
        page,
        "navigate " + routeUrl,
        ${SCROLL_SLICE_ROUTE_NAVIGATION_INACTIVITY_MS},
        () => page.goto(routeUrl, { waitUntil: "domcontentloaded", timeout: 0 }),
      );
      await withBrowserInactivity(
        page,
        "networkidle " + routeUrl,
        ${SCROLL_SLICE_NETWORK_IDLE_INACTIVITY_MS},
        () => page.waitForLoadState("networkidle", { timeout: 0 }),
      );
      browserFailures.assertNoFailures("scroll-slice capture");
      const status = response ? response.status() : undefined;
      if (typeof status === "number" && status >= 400) {
        throw new Error("Implementation route returned HTTP " + status + ": " + routeUrl);
      }
      const metricsBeforeScroll = await page.evaluate(() => ({
        scrollHeight: Math.ceil(document.documentElement.scrollHeight || document.body.scrollHeight || 0),
        clientHeight: Math.ceil(document.documentElement.clientHeight || window.innerHeight || 0),
      }));
      const maxScrollY = Math.max(0, metricsBeforeScroll.scrollHeight - metricsBeforeScroll.clientHeight);
      if (input.scrollY > maxScrollY) {
        throw new Error(
          "Requested scrollY exceeds implementation scroll range: scrollY=" +
            input.scrollY +
            " maxScrollY=" +
            maxScrollY +
            " url=" +
            routeUrl
        );
      }
      await page.evaluate(async (scrollY) => {
        const html = document.documentElement;
        const body = document.body;
        const previousHtmlScrollBehavior = html.style.scrollBehavior;
        const previousBodyScrollBehavior = body ? body.style.scrollBehavior : "";
        html.style.scrollBehavior = "auto";
        if (body) body.style.scrollBehavior = "auto";
        window.scrollTo({ left: 0, top: scrollY, behavior: "instant" });
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        html.style.scrollBehavior = previousHtmlScrollBehavior;
        if (body) body.style.scrollBehavior = previousBodyScrollBehavior;
      }, input.scrollY);
      await page.waitForTimeout(${SCROLL_SLICE_SETTLE_AFTER_SCROLL_MS});
      browserFailures.assertNoFailures("scroll-slice capture");
      const capture = await page.evaluate(() => ({
        actualScrollY: Math.round(window.scrollY),
        scrollHeight: Math.ceil(document.documentElement.scrollHeight || document.body.scrollHeight || 0),
        clientHeight: Math.ceil(document.documentElement.clientHeight || window.innerHeight || 0),
        pageWidth: Math.ceil(document.documentElement.scrollWidth || document.body.scrollWidth || window.innerWidth || 0),
        pageHeight: Math.ceil(document.documentElement.scrollHeight || document.body.scrollHeight || window.innerHeight || 0),
        title: document.title || "",
      }));
      if (capture.actualScrollY !== input.scrollY) {
        throw new Error(
          "Implementation did not reach requested scrollY: requested=" +
            input.scrollY +
            " actual=" +
            capture.actualScrollY +
            " url=" +
            routeUrl
        );
      }
      await page.screenshot({ path: input.screenshotPath, type: "png", fullPage: false });
      browserFailures.assertNoFailures("scroll-slice capture");
      result = {
        ok: true,
        screenshotPath: input.screenshotPath,
        url: routeUrl,
        actualScrollY: capture.actualScrollY,
        maxScrollY,
        viewport: { width: input.viewport.width, height: input.viewport.height },
        pageSize: { width: capture.pageWidth, height: capture.pageHeight },
        title: capture.title,
      };
    } finally {
      browserFailures.dispose();
    }
    process.stdout.write(JSON.stringify(result));
  } catch (error) {
    process.stdout.write(
      JSON.stringify({
        ok: false,
        message: error && error.message ? error.message : String(error),
        stack: error && error.stack ? error.stack : undefined,
      })
    );
  } finally {
    if (browser) await browser.close();
  }
})();
`
