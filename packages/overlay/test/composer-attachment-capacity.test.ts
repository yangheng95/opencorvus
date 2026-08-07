import { describe, expect, test } from "bun:test"
import {
  composerAttachmentCapacity,
  composerAttachmentCounts,
  type ComposerAttachmentKinded,
} from "../src/services/composer-attachment-capacity"

function attachments(kind: "file" | "folder", count: number): ComposerAttachmentKinded[] {
  return Array.from({ length: count }, () => ({ kind }))
}

describe("composer attachment capacity", () => {
  test("limits files to ten without consuming folder capacity", () => {
    const staged = [...attachments("file", 10), ...attachments("folder", 2)]
    expect(composerAttachmentCounts(staged)).toEqual({ files: 10, folders: 2 })
    expect(composerAttachmentCapacity(staged, "file")).toBe(0)
    expect(composerAttachmentCapacity(staged, "folder")).toBe(1)
  })

  test("limits folders to three without consuming file capacity", () => {
    const staged = [...attachments("file", 4), ...attachments("folder", 3)]
    expect(composerAttachmentCounts(staged)).toEqual({ files: 4, folders: 3 })
    expect(composerAttachmentCapacity(staged, "file")).toBe(6)
    expect(composerAttachmentCapacity(staged, "folder")).toBe(0)
  })

  test("removal restores only the removed attachment kind capacity", () => {
    const staged = [...attachments("file", 9), ...attachments("folder", 3)]
    expect(composerAttachmentCapacity(staged, "folder")).toBe(0)
    expect(composerAttachmentCapacity(staged.slice(0, -1), "folder")).toBe(1)
    expect(composerAttachmentCapacity(staged.slice(0, -1), "file")).toBe(1)
  })
})
