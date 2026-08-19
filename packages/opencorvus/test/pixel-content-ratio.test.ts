/**
 * Blank-crop detection reads `contentPixelRatio`, which used to be
 * `nonWhiteDensity`: a pixel counted as content whenever `max(r,g,b) < 250`.
 * That hard-codes white as the only background, so a dark-themed page scored
 * 1.0 whether it rendered correctly or rendered as a solid black failure — the
 * metric carried no information exactly where this repository's own artifacts
 * are theme-aware. The ratio is now measured against each crop's own modal
 * colour, so it means the same thing on any background.
 */
import { describe, expect, test } from "bun:test"
import { PNG } from "pngjs"
import { contentPixelRatio, uniqueColorBucketCount } from "../src/util/pixel-stats"

type Rgba = [number, number, number, number]

function image(width: number, height: number, paint: (x: number, y: number) => Rgba) {
  const png = new PNG({ width, height })
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = paint(x, y)
      const index = (y * width + x) * 4
      png.data[index] = r
      png.data[index + 1] = g
      png.data[index + 2] = b
      png.data[index + 3] = a
    }
  }
  return { width: png.width, height: png.height, data: png.data }
}

const WHITE: Rgba = [255, 255, 255, 255]
const NEAR_BLACK: Rgba = [16, 18, 20, 255]
const INK: Rgba = [20, 22, 24, 255]
const PALE_INK: Rgba = [235, 236, 238, 255]

/** A solid field with a text-like band across its middle third. */
function withBand(background: Rgba, foreground: Rgba) {
  return image(40, 30, (_x, y) => (y >= 10 && y < 20 ? foreground : background))
}

describe("content pixel ratio", () => {
  test("reports zero for a solid crop on any background", () => {
    expect(contentPixelRatio(image(20, 20, () => WHITE))).toBe(0)
    expect(contentPixelRatio(image(20, 20, () => NEAR_BLACK))).toBe(0)
  })

  test("reports the same content share for a light and a dark rendering of one layout", () => {
    const light = contentPixelRatio(withBand(WHITE, INK))
    const dark = contentPixelRatio(withBand(NEAR_BLACK, PALE_INK))

    expect(light).toBeCloseTo(1 / 3, 5)
    expect(dark).toBeCloseTo(1 / 3, 5)
  })

  test("separates a dark page that rendered from a dark page that came back blank", () => {
    const rendered = contentPixelRatio(withBand(NEAR_BLACK, PALE_INK))
    const blank = contentPixelRatio(image(40, 30, () => NEAR_BLACK))

    // The blank-crop rule in acceptance compares source >= 0.002 against
    // implementation <= 0.0001; the old white-relative metric returned 1.0 for
    // both of these and could never separate them.
    expect(rendered).toBeGreaterThan(0.002)
    expect(blank).toBeLessThanOrEqual(0.0001)
  })

  test("absorbs quantization noise rather than counting it as content", () => {
    const dithered = image(40, 30, (x, y) => {
      const jitter = ((x + y) % 3) - 1 // -1, 0, +1 per channel
      return [250 + jitter, 250 + jitter, 250 + jitter, 255]
    })
    expect(contentPixelRatio(dithered)).toBe(0)
    // The colour-bucket count still sees the crop as effectively one colour.
    expect(uniqueColorBucketCount(dithered)).toBeLessThanOrEqual(2)
  })

  test("treats fully transparent pixels as background and an empty crop as no content", () => {
    expect(contentPixelRatio(image(10, 10, () => [0, 0, 0, 0]))).toBe(0)
    expect(contentPixelRatio(image(10, 10, () => WHITE), { x: 0, y: 0, width: 0, height: 0 })).toBe(0)
  })

  test("honours the region window", () => {
    const banded = withBand(WHITE, INK)
    expect(contentPixelRatio(banded, { x: 0, y: 0, width: 40, height: 10 })).toBe(0)
    expect(contentPixelRatio(banded, { x: 0, y: 10, width: 40, height: 10 })).toBe(0)
  })
})
