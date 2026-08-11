import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  createOpenCorvusTemporaryDirectorySync,
  removeManagedDirectoryTreeSync,
} from "@opencorvus-ai/util/runtime-directories"
import sharp from "sharp"
import {
  DESKTOP_ICON_OUTLINE_COLOR,
  DESKTOP_ICON_SIZE,
  renderHollowDesktopIcon,
} from "../script/generate-app-icons"

function pixelAt(buffer: Buffer, width: number, x: number, y: number): number[] {
  const offset = (y * width + x) * 4
  return [...buffer.subarray(offset, offset + 4)]
}

function icoFrames(path: string): Array<{ image: Buffer; size: number }> {
  const container = readFileSync(path)
  const frameCount = container.readUInt16LE(4)
  const frames: Array<{ image: Buffer; size: number }> = []

  for (let frame = 0; frame < frameCount; frame += 1) {
    const entry = 6 + frame * 16
    const width = container[entry]! || 256
    const byteLength = container.readUInt32LE(entry + 8)
    const offset = container.readUInt32LE(entry + 12)
    frames.push({ image: container.subarray(offset, offset + byteLength), size: width })
  }

  return frames
}

function icnsPngFrames(path: string): Array<{ image: Buffer; size: number }> {
  const container = readFileSync(path)
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const frameSizes: Record<string, number> = {
    ic10: 1024,
    ic14: 512,
    ic09: 512,
    ic13: 256,
    ic08: 256,
    ic07: 128,
    ic12: 64,
    ic11: 32,
  }
  let offset = 8
  const frames: Array<{ image: Buffer; size: number }> = []

  while (offset + 8 <= container.length) {
    const chunkType = container.toString("ascii", offset, offset + 4)
    const chunkSize = container.readUInt32BE(offset + 4)
    const chunk = container.subarray(offset + 8, offset + chunkSize)
    const pngOffset = chunk.indexOf(pngSignature)
    const frameSize = frameSizes[chunkType] ?? 0
    if (pngOffset >= 0 && frameSize > 0) frames.push({ image: chunk.subarray(pngOffset), size: frameSize })
    offset += chunkSize
  }

  if (frames.length === 0) throw new Error("ICNS container has no PNG frame")
  return frames
}

function icnsChunkTypes(path: string): string[] {
  const container = readFileSync(path)
  const types: string[] = []
  let offset = 8
  while (offset < container.length) {
    types.push(container.toString("ascii", offset, offset + 4))
    offset += container.readUInt32BE(offset + 4)
  }
  return types
}

async function expectAlphaCutoutHollowImage(input: string | Buffer, expectedSize: number): Promise<void> {
  const image = sharp(input)
  const metadata = await image.metadata()
  const pixels = await image.ensureAlpha().raw().toBuffer()
  let transparentPixelCount = 0
  let outlinePixelCount = 0

  for (let offset = 0; offset < pixels.length; offset += 4) {
    if (pixels[offset + 3] === 0) transparentPixelCount += 1
    if (
      pixels[offset + 3]! >= 128 &&
      pixels[offset]! < 80 &&
      pixels[offset + 1]! < 110 &&
      pixels[offset + 2]! < 190
    ) {
      outlinePixelCount += 1
    }
  }

  expect(metadata).toMatchObject({ width: expectedSize, height: expectedSize })
  expect(transparentPixelCount).toBeGreaterThan((expectedSize * expectedSize) / 4)
  expect(outlinePixelCount).toBeGreaterThan(expectedSize)
  for (const sample of [
    pixelAt(pixels, expectedSize, 0, 0),
    pixelAt(pixels, expectedSize, Math.floor(expectedSize / 2), Math.floor(expectedSize / 2)),
  ]) {
    expect(sample[3]).toBeLessThanOrEqual(4)
  }
}

describe("desktop application icon generation", () => {
  test("renders a true alpha-cutout hollow OpenCorvus silhouette", async () => {
    const temporaryRoot = createOpenCorvusTemporaryDirectorySync("app-icon-test-")
    const outputPath = join(temporaryRoot, "icon.png")
    const sourcePath = join(import.meta.dir, "..", "src", "opencorvus-logo-light.svg")

    try {
      await renderHollowDesktopIcon(sourcePath, outputPath)
      const image = sharp(outputPath)
      const metadata = await image.metadata()
      const pixels = await image.ensureAlpha().raw().toBuffer()
      const outline = [
        DESKTOP_ICON_OUTLINE_COLOR.r,
        DESKTOP_ICON_OUTLINE_COLOR.g,
        DESKTOP_ICON_OUTLINE_COLOR.b,
        255,
      ]
      let outlinePixelCount = 0

      for (let offset = 0; offset < pixels.length; offset += 4) {
        if (
          pixels[offset] === outline[0] &&
          pixels[offset + 1] === outline[1] &&
          pixels[offset + 2] === outline[2] &&
          pixels[offset + 3] === outline[3]
        ) {
          outlinePixelCount += 1
        }
      }

      expect(metadata).toMatchObject({
        width: DESKTOP_ICON_SIZE,
        height: DESKTOP_ICON_SIZE,
        channels: 4,
        hasAlpha: true,
      })
      expect(pixelAt(pixels, DESKTOP_ICON_SIZE, 0, 0)[3]).toBe(0)
      expect(pixelAt(pixels, DESKTOP_ICON_SIZE, DESKTOP_ICON_SIZE / 2, DESKTOP_ICON_SIZE / 2)[3]).toBe(0)
      expect(outlinePixelCount).toBeGreaterThan(20_000)
    } finally {
      removeManagedDirectoryTreeSync(temporaryRoot)
    }
  })

  test("projects the alpha-cutout hollow master into every desktop platform asset", async () => {
    const iconRoot = join(import.meta.dir, "..", "src-tauri", "icons")
    const pngAssets = {
      "32x32.png": 32,
      "64x64.png": 64,
      "128x128.png": 128,
      "128x128@2x.png": 256,
      "icon.png": 512,
      "StoreLogo.png": 50,
      "Square30x30Logo.png": 30,
      "Square44x44Logo.png": 44,
      "Square71x71Logo.png": 71,
      "Square89x89Logo.png": 89,
      "Square107x107Logo.png": 107,
      "Square142x142Logo.png": 142,
      "Square150x150Logo.png": 150,
      "Square284x284Logo.png": 284,
      "Square310x310Logo.png": 310,
    } as const

    for (const [name, size] of Object.entries(pngAssets)) {
      await expectAlphaCutoutHollowImage(join(iconRoot, name), size)
    }
    const windowsFrames = icoFrames(join(iconRoot, "icon.ico"))
    expect(windowsFrames.map((frame) => frame.size).sort((left, right) => left - right)).toEqual([
      16, 24, 32, 48, 64, 256,
    ])
    for (const frame of windowsFrames) await expectAlphaCutoutHollowImage(frame.image, frame.size)
    const icnsPath = join(iconRoot, "icon.icns")
    expect(icnsChunkTypes(icnsPath)).toEqual([...icnsChunkTypes(icnsPath)].sort())
    const macosFrames = icnsPngFrames(icnsPath)
    expect(macosFrames.map((frame) => frame.size).sort((left, right) => left - right)).toEqual([
      32, 64, 128, 256, 256, 512, 512, 1024,
    ])
    for (const frame of macosFrames) await expectAlphaCutoutHollowImage(frame.image, frame.size)
  })
})
