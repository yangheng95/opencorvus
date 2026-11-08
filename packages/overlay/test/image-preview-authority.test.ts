import { afterEach, expect, test } from "bun:test"
import { configure, renewApiAuthority } from "../src/services/api-state"
import {
  closeImagePreview,
  imagePreviewState,
  openImagePreview,
} from "../src/services/image-preview"

afterEach(() => {
  closeImagePreview()
  configure({ serverUrl: "http://127.0.0.1:7878", username: "opencorvus", password: "", directory: "" })
})

test("synchronous image openings publish exact resources and sequential revisions", () => {
  const revision = imagePreviewState().revision
  openImagePreview("blob:owned-thumbnail", "owned image", "/attachment/owned/image.png")
  expect(imagePreviewState()).toEqual({
    open: true, src: "blob:owned-thumbnail", alt: "owned image", revision: revision + 1,
    resourceUrl: "/attachment/owned/image.png",
  })
  openImagePreview("blob:next-thumbnail", "next image", "/attachment/owned/next.svg")
  expect(imagePreviewState()).toEqual({
    open: true, src: "blob:next-thumbnail", alt: "next image", revision: revision + 2,
    resourceUrl: "/attachment/owned/next.svg",
  })
})

test("a relative image publishes its canonical source and closing advances to the exact closed state", () => {
  const revision = imagePreviewState().revision
  openImagePreview("/attachment/owned/direct.png", "direct image")
  expect(imagePreviewState()).toEqual({
    open: true, src: "/attachment/owned/direct.png", alt: "direct image", revision: revision + 1,
    resourceUrl: "/attachment/owned/direct.png",
  })
  closeImagePreview()
  expect(imagePreviewState()).toEqual({ open: false, src: "", alt: "", revision: revision + 2 })
})

test("an external URL supplied as an authorized resource returns its explicit integrity error", () => {
  let failure: unknown
  try {
    openImagePreview("blob:owned-thumbnail", "owned image", "https://external.invalid/image.png")
  } catch (error) {
    failure = error
  }
  expect(failure).toBeInstanceOf(Error)
  expect({ name: (failure as Error).name, message: (failure as Error).message }).toEqual({
    name: "Error", message: "Image preview resource must be host-relative",
  })
})

test("standalone external images retain their exact view while API authority renews", () => {
  openImagePreview("data:image/png;base64,OWNED", "external fixture")
  const state = imagePreviewState()
  renewApiAuthority()
  expect(imagePreviewState()).toEqual({
    open: true,
    src: "data:image/png;base64,OWNED",
    alt: "external fixture",
    revision: state.revision,
  })
})
