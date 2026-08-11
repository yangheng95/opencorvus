import { readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import {
  createOpenCorvusTemporaryDirectorySync,
  removeManagedDirectoryTreeSync,
} from "@opencorvus-ai/util/runtime-directories"
import sharp from "sharp"

const overlayRoot = join(import.meta.dir, "..")
const brandLogoPath = join(overlayRoot, "src", "opencorvus-logo-light.svg")
const outputRoot = join(overlayRoot, "src-tauri", "icons")
export const DESKTOP_ICON_SIZE = 1024
export const DESKTOP_ICON_OUTLINE_RADIUS = 28
export const DESKTOP_ICON_OUTLINE_COLOR = { r: 22, g: 58, b: 140 } as const
const DISTANCE_INFINITY = 1_000_000_000_000

function transformDistanceLine(
  source: Float64Array,
  result: Float64Array,
  vertices: Int32Array,
  boundaries: Float64Array,
  length: number,
): void {
  let vertexIndex = 0
  vertices[0] = 0
  boundaries[0] = Number.NEGATIVE_INFINITY
  boundaries[1] = Number.POSITIVE_INFINITY

  for (let position = 1; position < length; position += 1) {
    let intersection = 0
    while (true) {
      const vertex = vertices[vertexIndex]!
      intersection =
        (source[position]! + position * position - (source[vertex]! + vertex * vertex)) /
        (2 * (position - vertex))
      if (intersection > boundaries[vertexIndex]!) break
      vertexIndex -= 1
    }
    vertexIndex += 1
    vertices[vertexIndex] = position
    boundaries[vertexIndex] = intersection
    boundaries[vertexIndex + 1] = Number.POSITIVE_INFINITY
  }

  vertexIndex = 0
  for (let position = 0; position < length; position += 1) {
    while (boundaries[vertexIndex + 1]! < position) vertexIndex += 1
    const distance = position - vertices[vertexIndex]!
    result[position] = distance * distance + source[vertices[vertexIndex]!]!
  }
}

function squaredDistanceToMaskClass(mask: Buffer, targetInside: boolean): Float64Array {
  const size = DESKTOP_ICON_SIZE
  const intermediate = new Float64Array(size * size)
  const result = new Float64Array(size * size)
  const sourceLine = new Float64Array(size)
  const resultLine = new Float64Array(size)
  const vertices = new Int32Array(size)
  const boundaries = new Float64Array(size + 1)

  for (let y = 0; y < size; y += 1) {
    const rowOffset = y * size
    for (let x = 0; x < size; x += 1) {
      sourceLine[x] = (mask[rowOffset + x]! > 0) === targetInside ? 0 : DISTANCE_INFINITY
    }
    transformDistanceLine(sourceLine, resultLine, vertices, boundaries, size)
    intermediate.set(resultLine, rowOffset)
  }

  for (let x = 0; x < size; x += 1) {
    for (let y = 0; y < size; y += 1) sourceLine[y] = intermediate[y * size + x]!
    transformDistanceLine(sourceLine, resultLine, vertices, boundaries, size)
    for (let y = 0; y < size; y += 1) result[y * size + x] = resultLine[y]!
  }

  return result
}

export async function renderHollowDesktopIcon(sourcePath: string, outputPath: string): Promise<void> {
  const source = await sharp(sourcePath, { density: 192 })
    .resize(DESKTOP_ICON_SIZE, DESKTOP_ICON_SIZE, { fit: "contain" })
    .ensureAlpha()
    .png()
    .toBuffer()
  const mask = await sharp(source).extractChannel("alpha").threshold(1).raw().toBuffer()
  const distanceToInside = squaredDistanceToMaskClass(mask, true)
  const distanceToOutside = squaredDistanceToMaskClass(mask, false)
  const outline = Buffer.alloc(DESKTOP_ICON_SIZE * DESKTOP_ICON_SIZE * 4)

  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    const offset = pixel * 4
    const squaredDistance = mask[pixel]! > 0 ? distanceToOutside[pixel]! : distanceToInside[pixel]!
    const coverage = Math.min(1, Math.max(0, DESKTOP_ICON_OUTLINE_RADIUS + 0.5 - Math.sqrt(squaredDistance)))
    outline[offset] = DESKTOP_ICON_OUTLINE_COLOR.r
    outline[offset + 1] = DESKTOP_ICON_OUTLINE_COLOR.g
    outline[offset + 2] = DESKTOP_ICON_OUTLINE_COLOR.b
    outline[offset + 3] = Math.round(coverage * 255)
  }

  await sharp(outline, {
    raw: { width: DESKTOP_ICON_SIZE, height: DESKTOP_ICON_SIZE, channels: 4 },
  })
    .png()
    .toFile(outputPath)
}

export function canonicalizeIcnsContainer(path: string): void {
  const container = readFileSync(path)
  if (container.subarray(0, 4).toString("ascii") !== "icns") throw new Error("Invalid ICNS container signature")
  if (container.readUInt32BE(4) !== container.length) throw new Error("Invalid ICNS container length")

  const chunks: Buffer[] = []
  let offset = 8
  while (offset < container.length) {
    const chunkSize = container.readUInt32BE(offset + 4)
    if (chunkSize < 8 || offset + chunkSize > container.length) throw new Error("Invalid ICNS chunk length")
    chunks.push(container.subarray(offset, offset + chunkSize))
    offset += chunkSize
  }
  chunks.sort((left, right) => left.subarray(0, 4).compare(right.subarray(0, 4)))

  const header = Buffer.alloc(8)
  header.write("icns", 0, "ascii")
  header.writeUInt32BE(container.length, 4)
  writeFileSync(path, Buffer.concat([header, ...chunks], container.length))
}

async function generateDesktopIconFamily(): Promise<void> {
  const temporaryRoot = createOpenCorvusTemporaryDirectorySync("app-icons-")
  const sourceIconPath = join(temporaryRoot, "opencorvus-app-icon.png")

  try {
    // PNG means Portable Network Graphics. One high-resolution, alpha-cutout
    // hollow master feeds every desktop platform container and raster size.
    await renderHollowDesktopIcon(brandLogoPath, sourceIconPath)

    const generated = spawnSync(process.execPath, ["run", "tauri", "icon", sourceIconPath, "--output", outputRoot], {
      cwd: overlayRoot,
      stdio: "inherit",
    })
    if (generated.error) throw generated.error
    if (generated.status !== 0)
      throw new Error(`Tauri icon generation exited with status ${generated.status ?? "unknown"}`)
    canonicalizeIcnsContainer(join(outputRoot, "icon.icns"))

    // The Overlay ships desktop bundles only. Tauri also emits Android and iOS
    // (iPhone Operating System) assets by default, so keep the generated family
    // scoped to the configured macOS, Windows, and Linux package surfaces.
    rmSync(join(outputRoot, "android"), { recursive: true })
    rmSync(join(outputRoot, "ios"), { recursive: true })
  } finally {
    removeManagedDirectoryTreeSync(temporaryRoot)
  }
}

if (import.meta.main) await generateDesktopIconFamily()
