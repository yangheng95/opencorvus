export const IMAGE_PREVIEW_MIN_SCALE = 0.02
export const IMAGE_PREVIEW_MAX_SCALE = 8
export const IMAGE_PREVIEW_LONG_IMAGE_ASPECT_RATIO_MULTIPLIER = 1.4

export interface ImagePreviewSize {
  width: number
  height: number
}

export function clampImagePreviewScale(value: number): number {
  return Math.min(IMAGE_PREVIEW_MAX_SCALE, Math.max(IMAGE_PREVIEW_MIN_SCALE, Number.isFinite(value) ? value : 1))
}

export function calculateImagePreviewFitScale(imageSize: ImagePreviewSize, viewportSize: ImagePreviewSize): number {
  if (imageSize.width <= 0 || imageSize.height <= 0 || viewportSize.width <= 0 || viewportSize.height <= 0) return 1
  return clampImagePreviewScale(
    Math.min(1, viewportSize.width / imageSize.width, viewportSize.height / imageSize.height),
  )
}

export function calculateImagePreviewWidthScale(imageSize: ImagePreviewSize, viewportSize: ImagePreviewSize): number {
  if (imageSize.width <= 0 || viewportSize.width <= 0) return 1
  return clampImagePreviewScale(Math.min(1, viewportSize.width / imageSize.width))
}

export function calculateImagePreviewOpenScale(imageSize: ImagePreviewSize, viewportSize: ImagePreviewSize): number {
  if (imageSize.width <= 0 || imageSize.height <= 0 || viewportSize.width <= 0 || viewportSize.height <= 0) return 1

  const imageAspectRatio = imageSize.height / imageSize.width
  const viewportAspectRatio = viewportSize.height / viewportSize.width
  if (imageAspectRatio > viewportAspectRatio * IMAGE_PREVIEW_LONG_IMAGE_ASPECT_RATIO_MULTIPLIER) {
    return calculateImagePreviewWidthScale(imageSize, viewportSize)
  }

  return calculateImagePreviewFitScale(imageSize, viewportSize)
}
