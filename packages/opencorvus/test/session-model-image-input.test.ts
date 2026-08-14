import { describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import sharp from "sharp"
import { prepareModelImageInput, readModelImageDimensions } from "../src/session/model-image-input"

const transparentTrackingPixelGif = Buffer.from(
  "R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICSAEAOw==",
  "base64",
)

describe("model image input preparation", () => {
  test("converts a real embedded GIF tracking pixel into provider-ready PNG bytes", async () => {
    const sourceBytes = Buffer.from(transparentTrackingPixelGif)
    const sourceDigest = createHash("sha256").update(sourceBytes).digest("hex")
    const prepared = await prepareModelImageInput({
      mime: "image/gif",
      bytes: sourceBytes,
      source: "webfetch embedded tracking pixel",
    })

    expect({
      sourceBytes,
      sourceDigest: createHash("sha256").update(sourceBytes).digest("hex"),
      mime: prepared.mime,
      dimensions: readModelImageDimensions(prepared.bytes),
      signature: prepared.bytes.subarray(0, 8),
      note: prepared.note,
    }).toEqual({
      sourceBytes: transparentTrackingPixelGif,
      sourceDigest,
      mime: "image/png",
      dimensions: { format: "png", width: 1, height: 1 },
      signature: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      note:
        "[model-image-input] Converted webfetch embedded tracking pixel from image/gif to image/png " +
        "(1x1) for provider input. Original attachment remains unchanged.",
    })
  })

  test("preserves exact provider-ready image bytes and dimensions", async () => {
    const fixture = sharp({
      create: { width: 2, height: 2, channels: 4, background: { r: 31, g: 97, b: 183, alpha: 1 } },
    })
    const inputs = [
      { mime: "image/png", bytes: await fixture.clone().png().toBuffer(), format: "png" },
      { mime: "image/jpeg", bytes: await fixture.clone().jpeg().toBuffer(), format: "jpeg" },
      { mime: "image/webp", bytes: await fixture.clone().webp().toBuffer(), format: "webp" },
    ] as const

    const prepared = await Promise.all(
      inputs.map(async (input) => {
        const sourceBytes = Buffer.from(input.bytes)
        const result = await prepareModelImageInput({
          mime: input.mime,
          bytes: sourceBytes,
          source: `${input.format} fixture`,
        })
        return {
          mime: result.mime,
          dimensions: readModelImageDimensions(result.bytes),
          preparedBytes: result.bytes,
          sourceBytes,
        }
      }),
    )

    expect(prepared).toEqual(
      inputs.map((input) => ({
        mime: input.mime,
        dimensions: { format: input.format, width: 2, height: 2 },
        preparedBytes: input.bytes,
        sourceBytes: input.bytes,
      })),
    )
  })

  test("keeps blank-margin crop and model-budget resize in the normalized image pipeline", async () => {
    const croppedSource = await sharp({
      create: { width: 10, height: 10, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    })
      .composite([{
        input: Buffer.from(Array.from({ length: 4 * 4 }, () => [201, 37, 46, 255]).flat()),
        raw: { width: 4, height: 4, channels: 4 },
        left: 3,
        top: 3,
      }])
      .png()
      .toBuffer()
    const cropped = await prepareModelImageInput({
      mime: "image/png",
      bytes: croppedSource,
      source: "blank-margin fixture",
    })

    const checkerboard = Buffer.alloc(8 * 2 * 4)
    for (let pixel = 0; pixel < 8 * 2; pixel++) {
      const offset = pixel * 4
      const value = pixel % 2 === 0 ? 24 : 224
      checkerboard[offset] = value
      checkerboard[offset + 1] = 255 - value
      checkerboard[offset + 2] = 113
      checkerboard[offset + 3] = 255
    }
    const resizedSource = await sharp(checkerboard, { raw: { width: 8, height: 2, channels: 4 } }).png().toBuffer()
    const resized = await prepareModelImageInput({
      mime: "image/png",
      bytes: resizedSource,
      source: "model-budget fixture",
      maxDimension: 4,
      maxPixels: 8,
    })

    expect({
      cropped: {
        mime: cropped.mime,
        dimensions: readModelImageDimensions(cropped.bytes),
        crop: cropped.crop,
      },
      resized: {
        mime: resized.mime,
        dimensions: readModelImageDimensions(resized.bytes),
        resize: resized.resize,
      },
    }).toEqual({
      cropped: {
        mime: "image/png",
        dimensions: { format: "png", width: 4, height: 4 },
        crop: { originalWidth: 10, originalHeight: 10, width: 4, height: 4, trimOffsetLeft: -3, trimOffsetTop: -3 },
      },
      resized: {
        mime: "image/png",
        dimensions: { format: "png", width: 4, height: 1 },
        resize: { inputWidth: 8, inputHeight: 2, width: 4, height: 1, scale: 0.5, maxDimension: 4, maxPixels: 8 },
      },
    })
  })
})
