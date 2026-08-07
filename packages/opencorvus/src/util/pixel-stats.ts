/**
 * Shared pixel statistics for current reference capture, region comparison,
 * and source-project materialization. White thresholds, bucket width, and
 * transparent-pixel handling have one implementation here.
 */
import { PNG } from "pngjs"
import fs from "node:fs/promises"

export interface DecodedPNG {
  width: number
  height: number
  /** RGBA 连续字节，长度 = width * height * 4。 */
  data: Buffer
}

export async function decodePNG(filePath: string): Promise<DecodedPNG> {
  const buf = await fs.readFile(filePath)
  return decodePNGBuffer(buf)
}

export function decodePNGBuffer(buf: Buffer): Promise<DecodedPNG> {
  return new Promise<DecodedPNG>((resolve, reject) => {
    const png = new PNG()
    png.parse(buf, (err, parsed) => {
      if (err) reject(err)
      else resolve({ width: parsed.width, height: parsed.height, data: parsed.data })
    })
  })
}

/**
 * 非白像素密度：一个像素只要 max(r,g,b) < 250 就记为"有内容"。
 * α<16 视为背景（否则 dist/ 截图的边缘 alpha 会被错当作内容）。
 */
export function nonWhiteDensity(
  img: DecodedPNG,
  region?: { x: number; y: number; width: number; height: number },
): number {
  const x0 = region ? Math.max(0, Math.min(img.width, region.x)) : 0
  const y0 = region ? Math.max(0, Math.min(img.height, region.y)) : 0
  const x1 = region ? Math.max(0, Math.min(img.width, region.x + region.width)) : img.width
  const y1 = region ? Math.max(0, Math.min(img.height, region.y + region.height)) : img.height
  if (x1 <= x0 || y1 <= y0) return 0
  let nonWhite = 0
  let total = 0
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const idx = (y * img.width + x) * 4
      const r = img.data[idx]
      const g = img.data[idx + 1]
      const b = img.data[idx + 2]
      const a = img.data[idx + 3]
      if (a < 16) {
        total++
        continue
      }
      const maxCh = r > g ? (r > b ? r : b) : g > b ? g : b
      if (maxCh < 250) nonWhite++
      total++
    }
  }
  return total === 0 ? 0 : nonWhite / total
}

/**
 * 4 bit/channel 桶装唯一色；总桶数上限 4096。
 * 用 bucket 而非原始 RGB 是为了抵抗 JPEG/PNG 量化噪声——否则截图普遍"过于独特"。
 */
export function uniqueColorBucketCount(img: DecodedPNG): number {
  const buckets = new Set<number>()
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] < 16) continue
    const r = img.data[i] >> 4
    const g = img.data[i + 1] >> 4
    const b = img.data[i + 2] >> 4
    buckets.add((r << 8) | (g << 4) | b)
  }
  return buckets.size
}

/**
 * Top-K 主色调色板（十六进制，4bit/ch bucket 代表色）。
 * 取桶中心的 8bit 表示：`(r*16+8, g*16+8, b*16+8)`。
 */
export function topKPalette(img: DecodedPNG, k: number): string[] {
  if (k <= 0) return []
  const counts = new Map<number, number>()
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] < 16) continue
    const r = img.data[i] >> 4
    const g = img.data[i + 1] >> 4
    const b = img.data[i + 2] >> 4
    const key = (r << 8) | (g << 4) | b
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const sorted = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
  return sorted.map(([key]) => {
    const r = ((key >> 8) & 0xf) * 16 + 8
    const g = ((key >> 4) & 0xf) * 16 + 8
    const b = (key & 0xf) * 16 + 8
    const hex = (n: number) => n.toString(16).padStart(2, "0")
    return `#${hex(r)}${hex(g)}${hex(b)}`
  })
}
