import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import z from "zod"
import { Identifier } from "@/id/id"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { requireRuntimePackage } from "@/runtime/package-require"
import { readTaskArtifactRef } from "@/task-artifact/store"
import { contentPixelRatio, decodePNGBuffer, uniqueColorBucketCount } from "@/util/pixel-stats"
import {
  evaluateVisual,
  isEvaluationReportPassing,
  WEBPAGE_REFERENCE_COMPARISON_SSIM_PASS_THRESHOLD,
} from "@/browser-preview/visual/evaluate"
import { BrowserPreviewRegionRouteDiagnosticsSchema, runBrowserPreviewRegionComparisonCapture } from "./evidence-runner"
import { BrowserPreviewViewportID } from "./viewport"
import {
  findBrowserPreviewTargetByID,
  normalizeRuntimePathRefs,
  persistBrowserPreviewEvidenceBatch,
  type PersistBrowserPreviewEvidenceInput,
} from "./persist"
import {
  BrowserPreviewCropIntent,
  BrowserPreviewRegionBinding,
  BrowserPreviewRegionBox,
  BrowserPreviewSourceImageArtifactRef,
  browserPreviewRegionIdentityKey,
} from "./region-schema"
import { throwAfterBrowserPreviewPublicationCleanup } from "./publication-cleanup"
import { BrowserPreviewComparisonGuidance, BrowserPreviewComparisonGuidanceSchema } from "./comparison-guidance"

const sharp = requireRuntimePackage<typeof import("sharp")>("sharp")

class BrowserPreviewRegionGeometryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BrowserPreviewRegionGeometryError"
  }
}

export {
  BrowserPreviewRegionBinding,
  BrowserPreviewRegionBox,
  BrowserPreviewCropIntent,
  BrowserPreviewRegionLocator,
  BrowserPreviewSourceImageArtifactRef,
  browserPreviewRegionIdentityKey,
} from "./region-schema"

const BrowserPreviewImageSize = z
  .object({
    width: z.number().finite().positive(),
    height: z.number().finite().positive(),
  })
  .strict()
type BrowserPreviewImageSizeValue = z.infer<typeof BrowserPreviewImageSize>

export const BrowserPreviewRegionComparisonRequest = z
  .object({
    targetID: z.string().min(1),
    inlineBindings: BrowserPreviewRegionBinding.array().min(1),
    output: z
      .object({
        include_diff: z.boolean().default(false),
      })
      .strict()
      .default({
        include_diff: false,
      }),
  })
  .strict()
  .superRefine((request, context) => {
    const seen = new Set<string>()
    request.inlineBindings.forEach((binding, index) => {
      const key = bindingKey(binding)
      if (seen.has(key)) {
        context.addIssue({
          code: "custom",
          path: ["inlineBindings", index],
          message: `Duplicate browser preview region comparison binding identity: ${key}`,
        })
      }
      seen.add(key)
    })
  })
export type BrowserPreviewRegionComparisonRequest = z.infer<typeof BrowserPreviewRegionComparisonRequest>

export const BrowserPreviewRegionComparisonResult = z.object({
  status: z.enum(["passed", "failed"]),
  manifestPath: z.string(),
  jobID: z.string(),
  taskID: z.string(),
  targetID: z.string(),
  operation: z.literal("reference-comparison"),
  comparison_mode: z.literal("true-size"),
  artifact_note: z.string(),
  comparison_guidance: BrowserPreviewComparisonGuidanceSchema,
  evidenceIDs: z.record(z.string(), z.string()),
  regions: z.array(
    z.object({
      region_id: z.string(),
      viewport_id: BrowserPreviewViewportID,
      state_id: z.string().optional(),
      crop_intent: BrowserPreviewCropIntent.optional(),
      source_artifact: BrowserPreviewSourceImageArtifactRef,
      status: z.enum(["completed", "failed"]),
      reason: z.string().optional(),
      source_bbox: BrowserPreviewRegionBox.optional(),
      implementation_bbox: BrowserPreviewRegionBox.optional(),
      source_image_size: BrowserPreviewImageSize.optional(),
      implementation_viewport: BrowserPreviewImageSize.optional(),
      implementation_fullpage_size: BrowserPreviewImageSize.optional(),
      implementation_screenshot_path: z.string().optional(),
      route_diagnostics: BrowserPreviewRegionRouteDiagnosticsSchema.optional(),
      artifact_note: z.string().optional(),
      visual: z
        .object({
          overall_score: z.number(),
          ssim_score: z.number(),
          pixel_diff_percent: z.number(),
          mismatched_pixels: z.number(),
          total_pixels: z.number(),
          dimensions_match: z.boolean(),
        })
        .optional(),
      coverage: z
        .object({
          source_width: z.number(),
          source_height: z.number(),
          implementation_width: z.number(),
          implementation_height: z.number(),
          implementation_covers_source: z.boolean(),
          implementation_matches_source_size: z.boolean(),
        })
        .optional(),
      content: z
        .object({
          source: z
            .object({
              content_pixel_ratio: z.number(),
              unique_color_count: z.number().int().nonnegative(),
            })
            .strict(),
          implementation: z
            .object({
              content_pixel_ratio: z.number(),
              unique_color_count: z.number().int().nonnegative(),
            })
            .strict(),
        })
        .strict()
        .optional(),
      artifacts: z
        .object({
          source_crop: z.string(),
          implementation_crop: z.string(),
          side_by_side: z.string(),
          diff: z.string().optional(),
        })
        .optional(),
      diagnostics: z.array(z.string()),
    }),
  ),
  diagnostics: z.array(z.string()),
})
export type BrowserPreviewRegionComparisonResult = z.infer<typeof BrowserPreviewRegionComparisonResult>

const TRUE_SIZE_COMPARISON_ARTIFACT_NOTE =
  "True-size comparison: source and local implementation crops are stitched from their real screenshot dimensions without runner-side resizing; exact crop size matching is required, and crop size mismatch is evaluated as a parity failure."

type TrueSizeRegionVisualReport = {
  overallScore: number
  ssimScore: number
  pixelDiffPercent: number
  dimensionsMatch: boolean
  mismatchedPixels: number
  totalPixels: number
  diffImageDataUrl?: string
  sourceSize: BrowserPreviewImageSizeValue
  implementationSize: BrowserPreviewImageSizeValue
}

type RegionContentMetrics = {
  content_pixel_ratio: number
  unique_color_count: number
}

type BrowserPreviewRegionComparisonInput = {
  projectID: string
  projectRoot: string
  taskID: string
  targetID: string
  bindings: BrowserPreviewRegionBinding[]
  includeDiff?: boolean
  signal?: AbortSignal
}

export async function compareBrowserPreviewRegions(
  input: BrowserPreviewRegionComparisonInput,
): Promise<BrowserPreviewRegionComparisonResult> {
  if (!input.taskID.trim() || !input.targetID.trim()) {
    throw new Error("Browser preview region comparison requires taskID and targetID.")
  }
  const bindings = BrowserPreviewRegionBinding.array().parse(input.bindings)
  if (!findBrowserPreviewTargetByID({ taskID: input.taskID, targetID: input.targetID })) {
    throw new Error(`Browser preview target not found: ${input.targetID}`)
  }
  const projectRoot = path.resolve(input.projectRoot)
  const jobID = Identifier.ascending("artifact")
  const outDir = ProjectRuntimePaths.browserPreviewJobRoot(projectRoot, input.taskID, jobID)

  const selectedBindings = bindings
  assertUniqueBindingKeys(selectedBindings)
  const sourceRefs = new Map<
    string,
    {
      bytes: Uint8Array
      bbox: BrowserPreviewRegionBox
      imageSize: BrowserPreviewImageSizeValue
    }
  >()
  for (const binding of selectedBindings) {
    const sourceBytes = await readTaskArtifactRef({
      projectID: input.projectID,
      projectDirectory: projectRoot,
      taskID: input.taskID,
      ref: binding.source.reference_artifact,
    })
    sourceRefs.set(bindingKey(binding), {
      bytes: sourceBytes,
      bbox: binding.source.bbox,
      imageSize: await readPngSize(sourceBytes),
    })
  }
  const preparedDir = await fs.mkdtemp(
    path.join(ProjectRuntimePaths.taskRoot(projectRoot, input.taskID), ".browser-preview-region-preparing-"),
  )
  let published = false
  try {
    const sidecar = await runBrowserPreviewRegionComparisonCapture({
      projectRoot,
      taskID: input.taskID,
      targetID: input.targetID,
      jobID,
      outDir: preparedDir,
      bindings: selectedBindings,
      signal: input.signal,
    })
    const captureByBindingKey = new Map(sidecar.regions.map((region) => [captureRegionKey(region), region]))

    let regions: BrowserPreviewRegionComparisonResult["regions"] = []
    for (const binding of selectedBindings) {
      const key = bindingKey(binding)
      const region = captureByBindingKey.get(key)
      if (!region) throw new Error(`Missing validated browser preview region capture: ${key}`)
      const source = sourceRefs.get(key)
      if (!source) throw new Error(`Missing validated browser preview region source: ${key}`)
      if (region.status === "failed") {
        const reason = region.reason
        if (!reason) throw new Error(`Failed browser preview region capture has no reason: ${key}`)
        regions.push({
          region_id: binding.region_id,
          viewport_id: binding.viewport_id,
          state_id: binding.state_id,
          crop_intent: binding.crop_intent,
          source_artifact: binding.source.reference_artifact,
          status: "failed",
          reason,
          source_bbox: binding.source.bbox,
          source_image_size: source.imageSize,
          implementation_viewport: region.viewport,
          implementation_fullpage_size: region.fullpageSize,
          implementation_screenshot_path: region.screenshotPath,
          route_diagnostics: region.routeDiagnostics,
          diagnostics: [reason],
        })
        continue
      }
      if (!region.bbox || !region.screenshotPath) {
        throw new Error(`Completed browser preview region capture is incomplete: ${key}`)
      }
      try {
        regions.push(
          await materializeRegionComparison({
            outDir: preparedDir,
            binding,
            sourceImageBytes: source.bytes,
            sourceBox: source.bbox,
            sourceImageSize: source.imageSize,
            implementationImageBytes: region.screenshotBytes,
            implementationBox: region.bbox,
            implementationViewport: region.viewport,
            implementationFullpageSize: region.fullpageSize,
            implementationScreenshotPath: region.screenshotPath,
            routeDiagnostics: region.routeDiagnostics,
            includeDiff: input.includeDiff === true,
          }),
        )
      } catch (error) {
        if (!(error instanceof BrowserPreviewRegionGeometryError)) throw error
        regions.push({
          region_id: binding.region_id,
          viewport_id: binding.viewport_id,
          state_id: binding.state_id,
          crop_intent: binding.crop_intent,
          source_artifact: binding.source.reference_artifact,
          status: "failed",
          reason: error.message,
          source_bbox: binding.source.bbox,
          implementation_bbox: region.bbox,
          source_image_size: source.imageSize,
          implementation_viewport: region.viewport,
          implementation_fullpage_size: region.fullpageSize,
          implementation_screenshot_path: region.screenshotPath,
          route_diagnostics: region.routeDiagnostics,
          diagnostics: [error.message],
        })
      }
    }

    await fs.mkdir(path.dirname(outDir), { recursive: true })
    await fs.rename(preparedDir, outDir)
    published = true
    regions = regions.map((region) => rebaseRegionComparisonPaths(region, preparedDir, outDir))

    const manifestPath = path.join(outDir, "manifest.json")
    const diagnostics = regions.flatMap((region) => region.diagnostics)
    const evidenceEntries = regions.map<{
      id: string
      key: string
      input: PersistBrowserPreviewEvidenceInput
    }>((region) => {
      const id = Identifier.ascending("artifact")
      return {
        id,
        key: regionKey(region),
        input: {
          projectRoot,
          taskID: input.taskID,
          targetID: input.targetID,
          viewportID: region.viewport_id,
          operationKind: "reference-comparison",
          regionID: region.region_id,
          stateID: region.state_id,
          cropIntent: region.crop_intent,
          manifestPath,
          artifactPaths: region.artifacts,
          status: region.status === "completed" ? "passed" : "failed",
          summary:
            region.status === "completed"
              ? `reference comparison completed for ${region.region_id} (${region.state_id ?? "default"}, ${region.viewport_id})`
              : `reference comparison failed for ${region.region_id} (${region.state_id ?? "default"}, ${region.viewport_id}): ${region.reason}`,
          capture: {
            operation: "reference-comparison",
            manifest_path: manifestPath,
            region,
          },
          diagnostics: region.diagnostics,
        },
      }
    })
    const evidenceIDs = Object.fromEntries(evidenceEntries.map((entry) => [entry.key, entry.id]))
    const result: BrowserPreviewRegionComparisonResult = {
      status: regions.length > 0 && regions.every((region) => region.status === "completed") ? "passed" : "failed",
      manifestPath,
      jobID,
      taskID: input.taskID,
      targetID: input.targetID,
      operation: "reference-comparison",
      comparison_mode: "true-size",
      artifact_note: TRUE_SIZE_COMPARISON_ARTIFACT_NOTE,
      comparison_guidance: BrowserPreviewComparisonGuidance,
      evidenceIDs,
      regions,
      diagnostics: [TRUE_SIZE_COMPARISON_ARTIFACT_NOTE, ...diagnostics],
    }
    const publicResult = normalizeRuntimePathRefs(projectRoot, result) as BrowserPreviewRegionComparisonResult
    await fs.writeFile(manifestPath, JSON.stringify(publicResult, null, 2), "utf8")
    await persistBrowserPreviewEvidenceBatch(
      evidenceEntries.map(({ id, input: evidenceInput }) => ({ id, input: evidenceInput })),
    )
    return publicResult
  } catch (error) {
    return await throwAfterBrowserPreviewPublicationCleanup({
      primaryFailure: error,
      residualPath: published ? outDir : preparedDir,
    })
  }
}

function rebaseRegionComparisonPaths(
  region: BrowserPreviewRegionComparisonResult["regions"][number],
  preparedDir: string,
  outDir: string,
): BrowserPreviewRegionComparisonResult["regions"][number] {
  const rebase = (value: string | undefined) => (value ? rebaseJobPath(value, preparedDir, outDir) : undefined)
  return {
    ...region,
    implementation_screenshot_path: rebase(region.implementation_screenshot_path),
    route_diagnostics: region.route_diagnostics
      ? {
          ...region.route_diagnostics,
          screenshot_path: rebaseJobPath(region.route_diagnostics.screenshot_path, preparedDir, outDir),
        }
      : undefined,
    artifacts: region.artifacts
      ? {
          source_crop: rebaseJobPath(region.artifacts.source_crop, preparedDir, outDir),
          implementation_crop: rebaseJobPath(region.artifacts.implementation_crop, preparedDir, outDir),
          side_by_side: rebaseJobPath(region.artifacts.side_by_side, preparedDir, outDir),
          diff: rebase(region.artifacts.diff),
        }
      : undefined,
  }
}

function rebaseJobPath(value: string, preparedDir: string, outDir: string): string {
  const relative = path.relative(preparedDir, path.resolve(value))
  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Browser preview region runner returned a path outside its preparation directory: ${value}`)
  }
  return path.join(outDir, relative)
}

async function materializeRegionComparison(input: {
  outDir: string
  binding: BrowserPreviewRegionBinding
  sourceImageBytes: Uint8Array
  sourceBox: BrowserPreviewRegionBox
  sourceImageSize: BrowserPreviewImageSizeValue
  implementationImageBytes: Uint8Array
  implementationBox: BrowserPreviewRegionBox
  implementationViewport: BrowserPreviewImageSizeValue
  implementationFullpageSize?: BrowserPreviewImageSizeValue
  implementationScreenshotPath: string
  routeDiagnostics?: z.infer<typeof BrowserPreviewRegionRouteDiagnosticsSchema>
  includeDiff: boolean
}): Promise<BrowserPreviewRegionComparisonResult["regions"][number]> {
  const dir = path.join(input.outDir, "regions", input.binding.viewport_id, regionDirectoryKey(input.binding))
  await fs.mkdir(dir, { recursive: true })
  const sourceCrop = path.join(dir, "source.png")
  const implementationCrop = path.join(dir, "implementation.png")
  const sourceCropBytes = await cropPng(input.sourceImageBytes, sourceCrop, input.sourceBox, "source")
  const implementationCropBytes = await cropPng(
    input.implementationImageBytes,
    implementationCrop,
    input.implementationBox,
    "implementation",
  )
  const sideBySide = path.join(dir, "side-by-side.png")
  await makeSideBySide({
    leftBytes: sourceCropBytes,
    rightBytes: implementationCropBytes,
    outputPath: sideBySide,
    title: `${input.binding.region_id} [${input.binding.state_id}] (${input.binding.viewport_id})`,
  })
  const artifacts: NonNullable<BrowserPreviewRegionComparisonResult["regions"][number]["artifacts"]> = {
    source_crop: sourceCrop,
    implementation_crop: implementationCrop,
    side_by_side: sideBySide,
  }
  const visualReport = await evaluateTrueSizeRegionVisual({
    sourceCrop: sourceCropBytes,
    implementationCrop: implementationCropBytes,
  })
  if (input.includeDiff && visualReport.diffImageDataUrl) {
    const diff = path.join(dir, "diff.png")
    await writeDataUrlPng(visualReport.diffImageDataUrl, diff)
    artifacts.diff = diff
  }
  const visual = {
    overall_score: visualReport.overallScore,
    ssim_score: visualReport.ssimScore,
    pixel_diff_percent: visualReport.pixelDiffPercent,
    mismatched_pixels: visualReport.mismatchedPixels,
    total_pixels: visualReport.totalPixels,
    dimensions_match: visualReport.dimensionsMatch,
  }
  const coverage = {
    source_width: visualReport.sourceSize.width,
    source_height: visualReport.sourceSize.height,
    implementation_width: visualReport.implementationSize.width,
    implementation_height: visualReport.implementationSize.height,
    implementation_covers_source:
      visualReport.implementationSize.width >= visualReport.sourceSize.width &&
      visualReport.implementationSize.height >= visualReport.sourceSize.height,
    implementation_matches_source_size:
      visualReport.implementationSize.width === visualReport.sourceSize.width &&
      visualReport.implementationSize.height === visualReport.sourceSize.height,
  }
  const content = {
    source: await measureRegionContent(sourceCropBytes),
    implementation: await measureRegionContent(implementationCropBytes),
  }
  const visualPassed = isEvaluationReportPassing({ ssimScore: visualReport.ssimScore })
  const completed = coverage.implementation_matches_source_size && visualPassed
  const reason = coverage.implementation_matches_source_size
    ? visualPassed
      ? undefined
      : `Reference comparison SSIM ${visualReport.ssimScore.toFixed(3)} is not greater than ${WEBPAGE_REFERENCE_COMPARISON_SSIM_PASS_THRESHOLD.toFixed(2)}. Overall score ${visualReport.overallScore}/100 is diagnostic only.`
    : `Implementation crop size does not match source region: source=${coverage.source_width}x${coverage.source_height} implementation=${coverage.implementation_width}x${coverage.implementation_height}.`
  return {
    region_id: input.binding.region_id,
    viewport_id: input.binding.viewport_id,
    state_id: input.binding.state_id,
    crop_intent: input.binding.crop_intent,
    source_artifact: input.binding.source.reference_artifact,
    status: completed ? "completed" : "failed",
    reason,
    source_bbox: input.sourceBox,
    implementation_bbox: input.implementationBox,
    source_image_size: input.sourceImageSize,
    implementation_viewport: input.implementationViewport,
    implementation_fullpage_size: input.implementationFullpageSize,
    implementation_screenshot_path: input.implementationScreenshotPath,
    route_diagnostics: input.routeDiagnostics,
    artifact_note: TRUE_SIZE_COMPARISON_ARTIFACT_NOTE,
    visual,
    coverage,
    content,
    artifacts,
    diagnostics: [
      TRUE_SIZE_COMPARISON_ARTIFACT_NOTE,
      completed
        ? `reference comparison passed for ${input.binding.region_id}: implementation crop size matches source region and SSIM ${visualReport.ssimScore.toFixed(3)} is greater than ${WEBPAGE_REFERENCE_COMPARISON_SSIM_PASS_THRESHOLD.toFixed(2)}`
        : `reference comparison failed for ${input.binding.region_id}: ${reason}`,
    ],
  }
}

async function measureRegionContent(bytes: Buffer): Promise<RegionContentMetrics> {
  const png = await decodePNGBuffer(bytes)
  return {
    content_pixel_ratio: contentPixelRatio(png),
    unique_color_count: uniqueColorBucketCount(png),
  }
}

async function evaluateTrueSizeRegionVisual(input: {
  sourceCrop: Buffer
  implementationCrop: Buffer
}): Promise<TrueSizeRegionVisualReport> {
  const [sourceSize, implementationSize] = await Promise.all([
    readPngSize(input.sourceCrop),
    readPngSize(input.implementationCrop),
  ])
  if (sourceSize.width === implementationSize.width && sourceSize.height === implementationSize.height) {
    const report = await evaluateVisual({
      originalImage: pngDataUrl(input.sourceCrop),
      renderedImage: pngDataUrl(input.implementationCrop),
    })
    return {
      overallScore: report.overallScore,
      ssimScore: report.ssimScore,
      pixelDiffPercent: report.pixelDiffPercent,
      dimensionsMatch: report.dimensionsMatch,
      mismatchedPixels: report.mismatchedPixels,
      totalPixels: report.totalPixels,
      diffImageDataUrl: report.diffImageDataUrl,
      sourceSize,
      implementationSize,
    }
  }
  const totalPixels =
    Math.max(sourceSize.width, implementationSize.width) * Math.max(sourceSize.height, implementationSize.height)
  return {
    overallScore: 0,
    ssimScore: 0,
    pixelDiffPercent: 100,
    dimensionsMatch: false,
    mismatchedPixels: totalPixels,
    totalPixels,
    sourceSize,
    implementationSize,
  }
}

async function readPngSize(inputPath: string | Uint8Array): Promise<BrowserPreviewImageSizeValue> {
  const metadata = await sharp(inputPath).metadata()
  if (!metadata.width || !metadata.height) throw new Error("Cannot read PNG dimensions.")
  return { width: metadata.width, height: metadata.height }
}

async function cropPng(
  inputBytes: Uint8Array,
  outputPath: string,
  box: BrowserPreviewRegionBox,
  boxRole: "source" | "implementation",
): Promise<Buffer> {
  const metadata = await sharp(inputBytes).metadata()
  if (!metadata.width || !metadata.height) throw new Error(`Cannot read ${boxRole} PNG dimensions.`)
  const left = Math.floor(box.x)
  const top = Math.floor(box.y)
  const width = Math.ceil(box.width)
  const height = Math.ceil(box.height)
  assertCropBoxInsideImage({
    inputPath: `${boxRole} verified bytes`,
    box,
    boxRole,
    left,
    top,
    width,
    height,
    imageWidth: metadata.width,
    imageHeight: metadata.height,
  })
  const output = await sharp(inputBytes).extract({ left, top, width, height }).png().toBuffer()
  await fs.writeFile(outputPath, output)
  return output
}

function assertCropBoxInsideImage(input: {
  inputPath: string
  box: BrowserPreviewRegionBox
  boxRole: "source" | "implementation"
  left: number
  top: number
  width: number
  height: number
  imageWidth: number
  imageHeight: number
}): void {
  if (
    input.left < 0 ||
    input.top < 0 ||
    input.width < 1 ||
    input.height < 1 ||
    input.left + input.width > input.imageWidth ||
    input.top + input.height > input.imageHeight
  ) {
    throw new BrowserPreviewRegionGeometryError(
      `Browser preview ${input.boxRole} bbox exceeds ${input.boxRole} image bounds: ` +
        `box=${input.box.x},${input.box.y},${input.box.width},${input.box.height} ` +
        `image=${input.imageWidth}x${input.imageHeight} path=${input.inputPath}`,
    )
  }
}

async function makeSideBySide(input: {
  leftBytes: Buffer
  rightBytes: Buffer
  outputPath: string
  title: string
}): Promise<void> {
  const [leftMeta, rightMeta] = await Promise.all([sharp(input.leftBytes).metadata(), sharp(input.rightBytes).metadata()])
  if (!leftMeta.width || !leftMeta.height || !rightMeta.width || !rightMeta.height) {
    throw new Error("Cannot compose side-by-side comparison without image dimensions.")
  }
  const titleHeight = 62
  const labelHeight = 32
  const gap = 16
  const width = leftMeta.width + rightMeta.width + gap
  const height = titleHeight + labelHeight + Math.max(leftMeta.height, rightMeta.height)
  const labels = Buffer.from(`
    <svg width="${width}" height="${titleHeight + labelHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f6f7f9"/>
      <text x="12" y="28" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#111827">${escapeXml(input.title)}</text>
      <text x="12" y="50" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#4b5563">TRUE-SIZE: no runner-side crop scaling; dimensions are part of parity.</text>
      <text x="12" y="${titleHeight + 22}" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#374151">LEFT: Source reference (true size)</text>
      <text x="${leftMeta.width + gap + 12}" y="${titleHeight + 22}" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#374151">RIGHT: Local implementation (true size)</text>
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
      { input: input.leftBytes, left: 0, top: titleHeight + labelHeight },
      { input: input.rightBytes, left: leftMeta.width + gap, top: titleHeight + labelHeight },
    ])
    .png()
    .toBuffer()
  await fs.writeFile(input.outputPath, output)
}

function pngDataUrl(bytes: Uint8Array): string {
  return `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`
}

async function writeDataUrlPng(input: string, outputPath: string): Promise<void> {
  const prefix = "data:image/png;base64,"
  if (!input.startsWith(prefix)) {
    throw new Error("Visual comparison diff must be a PNG data URL.")
  }
  await fs.writeFile(outputPath, Buffer.from(input.slice(prefix.length), "base64"))
}

function bindingKey(binding: BrowserPreviewRegionBinding): string {
  return browserPreviewRegionIdentityKey(binding)
}

function captureRegionKey(region: { viewportID: BrowserPreviewViewportID; stateID: string; regionID: string }): string {
  return browserPreviewRegionIdentityKey({
    viewport_id: region.viewportID,
    state_id: region.stateID,
    region_id: region.regionID,
  })
}

function regionKey(region: { viewport_id: BrowserPreviewViewportID; state_id?: string; region_id: string }): string {
  return browserPreviewRegionIdentityKey({
    viewport_id: region.viewport_id,
    state_id: region.state_id ?? "default",
    region_id: region.region_id,
  })
}

function regionDirectoryKey(binding: BrowserPreviewRegionBinding): string {
  return crypto.createHash("sha256").update(browserPreviewRegionIdentityKey(binding)).digest("hex")
}

function assertUniqueBindingKeys(bindings: BrowserPreviewRegionBinding[]): void {
  const seen = new Set<string>()
  for (const binding of bindings) {
    const key = bindingKey(binding)
    if (seen.has(key)) {
      throw new Error(`Duplicate browser preview region comparison binding identity: ${key}`)
    }
    seen.add(key)
  }
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (char) => {
    const entities: Record<string, string> = { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }
    return entities[char] ?? char
  })
}
