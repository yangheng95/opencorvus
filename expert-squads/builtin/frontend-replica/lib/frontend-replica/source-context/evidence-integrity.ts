import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"

export interface PngEvidence {
  path: string
  valid: boolean
  width?: number
  height?: number
  bytes?: number
  sha256?: string
  error?: string
}

export const WEB_CLONE_REQUIRED_WEBPAGE_EVIDENCE_ARTIFACTS = [
  "reference.png",
  "capture.html",
  "extracted-page.json",
  "page.ir.json",
  "assets/manifest.json",
  "segments.json",
  "codegen-context.json",
  "source-skeleton/index.html",
  "source-skeleton/critical.css",
  "source-skeleton/full-source.css",
  "source-skeleton/used-selectors.json",
  "source-skeleton/skeleton-manifest.json",
  "source-skeleton/source-skeleton-audit.json",
  "source-ir/component-tree.json",
  "source-ir/content-model.json",
  "source-ir/layout-map.json",
  "source-ir/style-tokens.json",
  "source-ir/style-profile.json",
  "source-ir/interaction-hints.json",
  "source-ir/interaction-state-snapshots.json",
  "source-ir/source-quality-audit.json",
  "interaction-states/initial.png",
  "interaction-states/scroll-25.png",
  "interaction-states/scroll-50.png",
  "interaction-states/scroll-75.png",
] as const

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

export async function readPngEvidence(file: string): Promise<PngEvidence> {
  const resolved = path.resolve(file)
  let buffer: Buffer
  try {
    buffer = await fs.readFile(resolved)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    return { path: resolved, valid: false, error: `missing PNG file (${errorMessage(error)})` }
  }
  if (buffer.length < 24) {
    return {
      path: resolved,
      valid: false,
      bytes: buffer.length,
      sha256: sha256Buffer(buffer),
      error: "PNG file is too small to contain IHDR metadata",
    }
  }
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return {
      path: resolved,
      valid: false,
      bytes: buffer.length,
      sha256: sha256Buffer(buffer),
      error: "file does not have a PNG signature",
    }
  }
  if (buffer.readUInt32BE(8) !== 13 || buffer.subarray(12, 16).toString("ascii") !== "IHDR") {
    return {
      path: resolved,
      valid: false,
      bytes: buffer.length,
      sha256: sha256Buffer(buffer),
      error: "PNG first chunk must be a 13-byte IHDR chunk",
    }
  }
  const width = buffer.readUInt32BE(16)
  const height = buffer.readUInt32BE(20)
  if (width <= 0 || height <= 0) {
    return {
      path: resolved,
      valid: false,
      width,
      height,
      bytes: buffer.length,
      sha256: sha256Buffer(buffer),
      error: "PNG IHDR width/height must be positive",
    }
  }
  return {
    path: resolved,
    valid: true,
    width,
    height,
    bytes: buffer.length,
    sha256: sha256Buffer(buffer),
  }
}

export async function sha256File(file: string): Promise<string | undefined> {
  try {
    return sha256Buffer(await fs.readFile(file))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined
    throw error
  }
}

export async function readPassedAudit(file: string): Promise<boolean | undefined> {
  const parsed = JSON.parse(await fs.readFile(file, "utf8"))
  return typeof parsed?.passed === "boolean" ? parsed.passed : undefined
}

function sha256Buffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex")
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
