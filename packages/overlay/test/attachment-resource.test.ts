import { expect, test } from "bun:test"
import { attachmentImagePreviewUrl, isStoredAttachmentUrl } from "../src/utils/attachment-resource"

test("canonical image identity selects its display representation independently of optional message metadata", () => {
  expect([
    attachmentImagePreviewUrl("/attachment/project/brand.svg"),
    attachmentImagePreviewUrl("/attachment/project/BRAND.SVG"),
    attachmentImagePreviewUrl("/attachment/project/photo.png"),
    attachmentImagePreviewUrl("/attachment/project/photo.svg.png"),
    attachmentImagePreviewUrl("https://example.com/brand.svg"),
    attachmentImagePreviewUrl("data:image/svg+xml;base64,AAAA"),
    attachmentImagePreviewUrl("blob:https://example.com/brand.svg"),
    attachmentImagePreviewUrl("/file/brand.svg"),
    attachmentImagePreviewUrl("/attachment/project/nested/brand.svg"),
  ]).toEqual([
    "/attachment/project/brand.svg?variant=image-preview",
    "/attachment/project/BRAND.SVG?variant=image-preview",
    "/attachment/project/photo.png",
    "/attachment/project/photo.svg.png",
    "https://example.com/brand.svg",
    "data:image/svg+xml;base64,AAAA",
    "blob:https://example.com/brand.svg",
    "/file/brand.svg",
    "/attachment/project/nested/brand.svg",
  ])
  expect(isStoredAttachmentUrl("/attachment/project/brand.svg")).toBe(true)
})
