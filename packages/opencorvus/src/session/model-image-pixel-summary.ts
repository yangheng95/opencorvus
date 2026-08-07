import z from "zod"

export const MAX_MODEL_IMAGE_INPUT_DIMENSION = 8000
export const MODEL_IMAGE_INPUT_PIXEL_BUDGET = 1_048_576
export const MODEL_IMAGE_INPUT_COMPRESSION_WARNING_RATIO = 2

export const modelImagePixelSummarySchema = z.object({
  currentPixels: z.number(),
  compressedPixels: z.number(),
  compressedWidth: z.number(),
  compressedHeight: z.number(),
  compressionRatio: z.number(),
  preferPartialScreenshot: z.boolean(),
  text: z.string(),
})

export type ModelImagePixelSummary = z.infer<typeof modelImagePixelSummarySchema>

export const modelImagePixelSummary = (
  width: number,
  height: number,
  maxPixels = MODEL_IMAGE_INPUT_PIXEL_BUDGET,
): ModelImagePixelSummary => {
  const currentPixels = width * height
  const target = modelImageInputTargetDimensions({ width, height, maxPixels })
  const compressedWidth = target.width
  const compressedHeight = target.height
  const compressedPixels = compressedWidth * compressedHeight
  const compressionRatio =
    compressedWidth > 0 && compressedHeight > 0
      ? Number(Math.max(width / compressedWidth, height / compressedHeight).toFixed(2))
      : 1
  const preferPartialScreenshot = compressionRatio >= MODEL_IMAGE_INPUT_COMPRESSION_WARNING_RATIO
  return {
    currentPixels,
    compressedPixels,
    compressedWidth,
    compressedHeight,
    compressionRatio,
    preferPartialScreenshot,
    text:
      `当前像素: ${currentPixels} (${width}x${height}); 压缩后像素: ${compressedPixels} (${compressedWidth}x${compressedHeight}); ` +
      `压缩率: ${compressionRatio.toFixed(2)}x` +
      (preferPartialScreenshot ? "; 压缩率过大，请优先使用 selector 或 clip 做局部截图。" : ""),
  }
}

export function modelImageInputTargetDimensions(input: {
  width: number
  height: number
  maxDimension?: number
  maxPixels?: number
}): { width: number; height: number; scale: number } {
  const maxDimension = input.maxDimension ?? MAX_MODEL_IMAGE_INPUT_DIMENSION
  const maxPixels = input.maxPixels ?? MODEL_IMAGE_INPUT_PIXEL_BUDGET
  const pixels = input.width * input.height
  const scale = Math.min(
    1,
    maxDimension / input.width,
    maxDimension / input.height,
    pixels > maxPixels ? Math.sqrt(maxPixels / pixels) : 1,
  )
  let width = Math.max(1, Math.round(input.width * scale))
  let height = Math.max(1, Math.round(input.height * scale))
  while (width > maxDimension) width--
  while (height > maxDimension) height--
  while (width * height > maxPixels && (width > 1 || height > 1)) {
    if (width / input.width >= height / input.height && width > 1) {
      width--
    } else {
      height--
    }
  }
  return {
    width,
    height,
    scale,
  }
}
