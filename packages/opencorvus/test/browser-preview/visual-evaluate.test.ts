/**
 * `evaluateVisual` and `isEvaluationReportPassing` decide whether a rendered
 * page matches its design reference — the judgment behind
 * `webpage_reference_comparison`. Nothing asserted either of them directly
 * before: the pass threshold, the strict `>` at the boundary, the mismatched
 * dimension penalty, and the grayscale conversion were only ever exercised by
 * running a real browser capture end to end.
 */
import { describe, expect, test } from "bun:test"
import { PNG } from "pngjs"
import {
  WEBPAGE_REFERENCE_COMPARISON_SSIM_PASS_THRESHOLD,
  evaluateVisual,
  isEvaluationReportPassing,
} from "../../src/browser-preview/visual/evaluate"

/** A solid-color PNG as the data URL the evaluator accepts. */
function solidPng(width: number, height: number, rgb: [number, number, number]): string {
  const png = new PNG({ width, height })
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4
    png.data[offset] = rgb[0]
    png.data[offset + 1] = rgb[1]
    png.data[offset + 2] = rgb[2]
    png.data[offset + 3] = 255
  }
  return `data:image/png;base64,${PNG.sync.write(png).toString("base64")}`
}

describe("visual evaluation pass rule", () => {
  test("requires strictly more than the threshold, so equality is failure", () => {
    // The comment on the constant says equality is failure; that is a decision
    // about borderline replicas, not a rounding detail.
    expect(isEvaluationReportPassing({ ssimScore: WEBPAGE_REFERENCE_COMPARISON_SSIM_PASS_THRESHOLD })).toBe(false)
    expect(
      isEvaluationReportPassing({ ssimScore: WEBPAGE_REFERENCE_COMPARISON_SSIM_PASS_THRESHOLD + 1e-9 }),
    ).toBe(true)
  })

  test("honors an explicit threshold over the default", () => {
    expect(isEvaluationReportPassing({ ssimScore: 0.5 }, 0.4)).toBe(true)
    expect(isEvaluationReportPassing({ ssimScore: 0.5 }, 0.6)).toBe(false)
  })
})

describe("visual evaluation report", () => {
  test("scores an identical pair as a perfect match that passes", async () => {
    const image = solidPng(24, 24, [10, 120, 200])
    const report = await evaluateVisual({ originalImage: image, renderedImage: image })

    expect(report.dimensionsMatch).toBe(true)
    expect(report.mismatchedPixels).toBe(0)
    expect(report.pixelDiffPercent).toBe(0)
    expect(report.totalPixels).toBe(24 * 24)
    expect(report.comparisonDimensions).toEqual({ width: 24, height: 24 })
    expect(report.ssimScore).toBeCloseTo(1, 5)
    expect(isEvaluationReportPassing(report)).toBe(true)
    expect(report.overallScore).toBe(100)
  })

  test("scores a fully different pair as a failure", async () => {
    const report = await evaluateVisual({
      originalImage: solidPng(24, 24, [0, 0, 0]),
      renderedImage: solidPng(24, 24, [255, 255, 255]),
    })

    expect(report.mismatchedPixels).toBe(24 * 24)
    expect(report.pixelDiffPercent).toBe(100)
    expect(isEvaluationReportPassing(report)).toBe(false)
  })

  test("compares at the reference's dimensions and penalizes a size mismatch", async () => {
    const color: [number, number, number] = [10, 120, 200]
    const report = await evaluateVisual({
      originalImage: solidPng(24, 24, color),
      renderedImage: solidPng(48, 48, color),
    })

    // The rendered image is resized into the reference's frame, so the content
    // still matches; only the dimension penalty separates this from a perfect
    // score. Comparison happens at the reference's size, not the capture's.
    expect(report.dimensionsMatch).toBe(false)
    expect(report.comparisonDimensions).toEqual({ width: 24, height: 24 })
    expect(report.totalPixels).toBe(24 * 24)
    expect(report.overallScore).toBeLessThan(100)
  })

  test("rejects an input that is not a decodable image", async () => {
    await expect(
      evaluateVisual({ originalImage: "data:image/png;base64", renderedImage: solidPng(8, 8, [0, 0, 0]) }),
    ).rejects.toThrow()
  })
})
