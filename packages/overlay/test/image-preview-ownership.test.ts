import { describe, expect, test } from "bun:test"
import {
  beginImagePreviewRequest,
  cancelImagePreviewRequest,
  closeImagePreview,
  imagePreviewRequestIsCurrent,
  imagePreviewState,
  openImagePreviewForRequest,
} from "../src/services/image-preview"

describe("image preview async ownership", () => {
  test("only the latest preview request may open the global preview", () => {
    closeImagePreview()
    const first = beginImagePreviewRequest()
    const second = beginImagePreviewRequest()

    expect(openImagePreviewForRequest(second, "blob:second", "Second")).toBe(true)
    expect(openImagePreviewForRequest(first, "blob:first", "First")).toBe(false)
    expect(imagePreviewState()).toMatchObject({ open: true, src: "blob:second", alt: "Second", revision: second })
  })

  test("unmount cancellation invalidates a pending preview request", () => {
    closeImagePreview()
    const request = beginImagePreviewRequest()
    cancelImagePreviewRequest(request)

    expect(imagePreviewRequestIsCurrent(request)).toBe(false)
    expect(openImagePreviewForRequest(request, "blob:stale", "Stale")).toBe(false)
    expect(imagePreviewState().open).toBe(false)
  })
})
