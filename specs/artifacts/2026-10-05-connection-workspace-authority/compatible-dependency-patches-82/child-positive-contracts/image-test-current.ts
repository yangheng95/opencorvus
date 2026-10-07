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

test("runtime image codec preserves exact lossless pixels and small SVG output", async () => {
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: { r: 40, g: 80, b: 120 } } })
    .png()
    .toBuffer()
  const decoded = await sharp(png).raw().toBuffer({ resolveWithObject: true })
  expect({
    width: decoded.info.width,
    height: decoded.info.height,
    channels: decoded.info.channels,
    bytes: [...decoded.data],
  }).toEqual({ width: 2, height: 2, channels: 3, bytes: [40, 80, 120, 40, 80, 120, 40, 80, 120, 40, 80, 120] })
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#285078"/></svg>',
  )
  const output = await sharp(svg).resize(4, 4).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  expect({
    width: output.info.width,
    height: output.info.height,
    channels: output.info.channels,
    firstPixel: [...output.data.subarray(0, 4)],
  }).toEqual({ width: 4, height: 4, channels: 4, firstPixel: [40, 80, 120, 255] })
})
