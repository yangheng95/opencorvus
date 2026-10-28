import { expect, test } from "bun:test"
import { attachmentImagePreviewUrl, isStoredAttachmentUrl } from "../src/utils/attachment-resource"

test("canonical SVG selects its safe image representation and other resource identities retain their URLs", () => {
  expect([
    attachmentImagePreviewUrl("/attachment/project/brand.svg", "image/svg+xml"),
    attachmentImagePreviewUrl("/attachment/project/photo.png", "image/png"),
    attachmentImagePreviewUrl("https://example.com/brand.svg", "image/svg+xml"),
    attachmentImagePreviewUrl("data:image/svg+xml;base64,AAAA", "image/svg+xml"),
    attachmentImagePreviewUrl("/file/brand.svg", "image/svg+xml"),
  ]).toEqual([
    "/attachment/project/brand.svg?variant=image-preview",
    "/attachment/project/photo.png",
    "https://example.com/brand.svg",
    "data:image/svg+xml;base64,AAAA",
    "/file/brand.svg",
  ])
  expect(isStoredAttachmentUrl("/attachment/project/brand.svg")).toBe(true)
})
