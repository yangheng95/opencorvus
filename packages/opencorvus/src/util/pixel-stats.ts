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
 * 一个像素离本图自身背景色多远才算"有内容"，按 8bit 通道的切比雪夫距离。
 * 约等于 1.5 个 4bit 量化桶，用来吸收 PNG/JPEG 量化与抗锯齿噪声——与
 * `uniqueColorBucketCount` 用桶而非原始 RGB 的理由相同。
 */
const BACKGROUND_TOLERANCE = 24

/**
 * 内容像素密度：背景色取该区域自身的众数色（4bit/通道桶），偏离它超过
 * `BACKGROUND_TOLERANCE` 的像素记为"有内容"。α<16 视为背景（否则 dist/
 * 截图的边缘 alpha 会被错当作内容）。
 *
 * 旧实现把"背景"写死为白色（`max(r,g,b) < 250` 即算内容）。深色主题页面因此
 * 恒等于 1.0——一张全黑的失败截图与一张正常的深色页面得到同一个读数，指标
 * 对深色 UI 不携带任何信息，而本仓库自己的产物就是 theme-aware 的。取众数
 * 色让这个比值在任意背景下都表示同一件事：这块裁图相对它自己的底色有多少内容。
 */
export function contentPixelRatio(
  img: DecodedPNG,
  region?: { x: number; y: number; width: number; height: number },
): number {
  const x0 = region ? Math.max(0, Math.min(img.width, region.x)) : 0
  const y0 = region ? Math.max(0, Math.min(img.height, region.y)) : 0
  const x1 = region ? Math.max(0, Math.min(img.width, region.x + region.width)) : img.width
  const y1 = region ? Math.max(0, Math.min(img.height, region.y + region.height)) : img.height
  if (x1 <= x0 || y1 <= y0) return 0

  const counts = new Map<number, number>()
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const idx = (y * img.width + x) * 4
      if (img.data[idx + 3] < 16) continue
      const key = ((img.data[idx] >> 4) << 8) | ((img.data[idx + 1] >> 4) << 4) | (img.data[idx + 2] >> 4)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  // Fully transparent crops carry no background and therefore no content.
  if (counts.size === 0) return 0
  let modalKey = 0
  let modalCount = -1
  for (const [key, count] of counts) {
    if (count > modalCount) {
      modalCount = count
      modalKey = key
    }
  }
  const backgroundR = ((modalKey >> 8) & 0xf) * 16 + 8
  const backgroundG = ((modalKey >> 4) & 0xf) * 16 + 8
  const backgroundB = (modalKey & 0xf) * 16 + 8

  let content = 0
  let total = 0
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const idx = (y * img.width + x) * 4
      total++
      if (img.data[idx + 3] < 16) continue
      const distance = Math.max(
        Math.abs(img.data[idx] - backgroundR),
        Math.abs(img.data[idx + 1] - backgroundG),
        Math.abs(img.data[idx + 2] - backgroundB),
      )
      if (distance > BACKGROUND_TOLERANCE) content++
    }
  }
  return total === 0 ? 0 : content / total
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
