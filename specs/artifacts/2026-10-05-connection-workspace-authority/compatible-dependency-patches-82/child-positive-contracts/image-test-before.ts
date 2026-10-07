import { expect, test } from "bun:test"
import { requireRuntimePackage } from "../src/runtime/package-require"

const sharp = requireRuntimePackage<typeof import("sharp", { with: { "resolution-mode": "require" } })>("sharp")

for (const format of ["png", "avif"] as const) {
  test(`runtime image codec decodes and resizes ${format} input`, async () => {
    const input = await sharp({
      create: { width: 32, height: 24, channels: 3, background: { r: 40, g: 80, b: 120 } },
    })
      .toFormat(format)
      .toBuffer()
    const output = await sharp(input).resize(16, 12).png().toBuffer({ resolveWithObject: true })
    expect(output.info).toMatchObject({ format: "png", width: 16, height: 12, channels: 3 })
    expect(await sharp(output.data).metadata()).toMatchObject({ format: "png", width: 16, height: 12 })
  })
}
