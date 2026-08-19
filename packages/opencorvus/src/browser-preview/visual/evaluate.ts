/**
 * Visual evaluation — quantitative similarity between a design reference and
 * a rendered screenshot.
 *
 * This module is an atomic tool: it takes two images (data URL or file path),
 * produces a score and a diff-image data URL. No chaining, no context, no side
 * effects beyond reading the input files when paths are supplied.
 *
 * Scoring:
 *   overallScore = round(ssim * 50 + (100 - pixelDiff%) * 0.5)
 *   – SSIM on ITU-R BT.709 grayscale
 *   – pixelmatch with threshold 0.1
 *   – dimension mismatch penalty proportional to area-ratio (min 5)
 *
 * The rendered image is always resized to the design's dimensions so that
 * missing or extra rendered area is penalised, not silently cropped.
 */

import { readFileSync, existsSync } from "node:fs"
import { PNG } from "pngjs"
import pixelmatch from "pixelmatch"
import { ssim } from "ssim.js"
import z from "zod"

import { EvaluateError } from "./errors"

// ─── Boundary schemas ────────────────────────────────────────────────────

export const EvaluateInputSchema = z.object({
  /** Design reference — data URL or file path. */
  originalImage: z.string(),
  /** Rendered screenshot — data URL or file path. */
  renderedImage: z.string(),
})
export type EvaluateInput = z.infer<typeof EvaluateInputSchema>

export const EvaluationReportSchema = z.object({
  overallScore: z.number(),
  ssimScore: z.number(),
  pixelDiffPercent: z.number(),
  dimensionsMatch: z.boolean(),
  comparisonDimensions: z.object({ width: z.number(), height: z.number() }),
  diffImageDataUrl: z.string(),
  mismatchedPixels: z.number(),
  totalPixels: z.number(),
})
export type EvaluationReport = z.infer<typeof EvaluationReportSchema>

// SSIM means Structural Similarity Index Measure. Frontend replica visual
// comparison tool results pass only above this threshold; equality is failure.
export const WEBPAGE_REFERENCE_COMPARISON_SSIM_PASS_THRESHOLD = 0.95

export function isEvaluationReportPassing(
  report: Pick<EvaluationReport, "ssimScore">,
  threshold = WEBPAGE_REFERENCE_COMPARISON_SSIM_PASS_THRESHOLD,
): boolean {
  return report.ssimScore > threshold
}

// ─── Internal helpers ────────────────────────────────────────────────────

/** Decode a PNG from data URL or file path. */
function decodePng(input: string): PNG {
  let buffer: Buffer

  if (input.startsWith("data:image/png;base64,")) {
    buffer = Buffer.from(input.slice("data:image/png;base64,".length), "base64")
  } else if (input.startsWith("data:image/")) {
    const commaIdx = input.indexOf(",")
    if (commaIdx === -1) throw new EvaluateError({ reason: "invalid data URL format" })
    buffer = Buffer.from(input.slice(commaIdx + 1), "base64")
  } else if (existsSync(input)) {
    buffer = readFileSync(input) as Buffer
  } else {
    throw new EvaluateError({
      reason: `cannot decode image: not a data URL or valid file path (${input.slice(0, 60)}…)`,
    })
  }

  return PNG.sync.read(buffer)
}

/** Bilinear interpolation — avoids aliasing on text and fine UI details. */
function resizePng(src: PNG, targetWidth: number, targetHeight: number): PNG {
  const dst = new PNG({ width: targetWidth, height: targetHeight })
  const xRatio = src.width / targetWidth
  const yRatio = src.height / targetHeight

  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const sx = x * xRatio
      const sy = y * yRatio
      const x0 = Math.min(Math.floor(sx), src.width - 1)
      const y0 = Math.min(Math.floor(sy), src.height - 1)
      const x1 = Math.min(x0 + 1, src.width - 1)
      const y1 = Math.min(y0 + 1, src.height - 1)
      const fx = sx - x0
      const fy = sy - y0

      const si00 = (y0 * src.width + x0) * 4
      const si10 = (y0 * src.width + x1) * 4
      const si01 = (y1 * src.width + x0) * 4
      const si11 = (y1 * src.width + x1) * 4
      const di = (y * targetWidth + x) * 4

      for (let c = 0; c < 4; c++) {
        const top = src.data[si00 + c] * (1 - fx) + src.data[si10 + c] * fx
        const bottom = src.data[si01 + c] * (1 - fx) + src.data[si11 + c] * fx
        dst.data[di + c] = Math.round(top * (1 - fy) + bottom * fy)
      }
    }
  }

  return dst
}

/** ITU-R BT.709 luminance. */
function toGrayscale(png: PNG): { data: number[]; width: number; height: number } {
  const data: number[] = []
  for (let i = 0; i < png.data.length; i += 4) {
    const gray = 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2]
    data.push(Math.round(gray))
  }
  return { data, width: png.width, height: png.height }
}

// ─── Public API ──────────────────────────────────────────────────────────

/** Compare a design screenshot to a rendered screenshot — returns an `EvaluationReport`. */
export async function evaluateVisual(input: EvaluateInput): Promise<EvaluationReport> {
  const parsed = EvaluateInputSchema.parse(input)

  const original = decodePng(parsed.originalImage)
  let rendered = decodePng(parsed.renderedImage)

  const dimensionsMatch = original.width === rendered.width && original.height === rendered.height
  const originalRenderedArea = rendered.width * rendered.height
  const compWidth = original.width
  const compHeight = original.height

  if (!dimensionsMatch) {
    rendered = resizePng(rendered, compWidth, compHeight)
  }

  const totalPixels = compWidth * compHeight
  const diffPng = new PNG({ width: compWidth, height: compHeight })
  const mismatchedPixels = pixelmatch(
    original.data as unknown as Uint8Array,
    rendered.data as unknown as Uint8Array,
    diffPng.data as unknown as Uint8Array,
    compWidth,
    compHeight,
    { threshold: 0.1 },
  )
  const pixelDiffPercent = totalPixels > 0 ? (mismatchedPixels / totalPixels) * 100 : 100

  const diffBuffer = PNG.sync.write(diffPng)
  const diffImageDataUrl = `data:image/png;base64,${diffBuffer.toString("base64")}`

  const grayOriginal = toGrayscale(original)
  const grayRendered = toGrayscale(rendered)
  const ssimResult = ssim(
    {
      data: Uint8ClampedArray.from(grayOriginal.data),
      width: grayOriginal.width,
      height: grayOriginal.height,
    },
    {
      data: Uint8ClampedArray.from(grayRendered.data),
      width: grayRendered.width,
      height: grayRendered.height,
    },
  )
  const ssimScore = ssimResult.mssim

  let overallScore = Math.round(ssimScore * 50 + (100 - pixelDiffPercent) * 0.5)

  if (!dimensionsMatch) {
    const designArea = compWidth * compHeight
    const areaRatio = Math.min(designArea, originalRenderedArea) / Math.max(designArea, originalRenderedArea)
    const penalty = Math.round((1 - areaRatio) * 20)
    overallScore = Math.max(0, overallScore - Math.max(penalty, 5))
  }

  overallScore = Math.max(0, Math.min(100, overallScore))

  return {
    overallScore,
    ssimScore,
    pixelDiffPercent,
    dimensionsMatch,
    comparisonDimensions: { width: compWidth, height: compHeight },
    diffImageDataUrl,
    mismatchedPixels,
    totalPixels,
  }
}
