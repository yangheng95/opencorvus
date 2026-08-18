import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

/**
 * Brand asset integrity.
 *
 * These files rotted silently for a long time. `og.png` was referenced by every page and had never
 * been committed, so every shared link unfurled to nothing. `social-share.png`, the two manifest
 * icons and `site.webmanifest` were 43-to-56 byte ASCII files holding a relative path — Windows
 * checkouts of symlinks pointing at packages/ui/, a directory that no longer exists in the repo.
 * Nothing failed: the build was happy, the pages rendered, and the only symptom was a blank card
 * in someone else's chat client.
 *
 * So the shape of every asset is asserted here rather than trusted. Run `bun run brand:assets`
 * after changing the generator.
 */

const publicFile = (name: string) => fileURLToPath(new URL(`../public/${name}`, import.meta.url))

/** PNG dimensions straight from the IHDR chunk — no image library needed to check a header. */
function readPng(name: string): { width: number; height: number; bytes: number } {
  const buffer = readFileSync(publicFile(name))
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  expect(buffer.subarray(0, 8).equals(signature), `${name} is not a PNG`).toBe(true)
  expect(buffer.subarray(12, 16).toString("ascii"), `${name} has no IHDR`).toBe("IHDR")
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), bytes: buffer.length }
}

describe("brand assets", () => {
  test("the Open Graph card exists at the standard 1200x630", () => {
    const card = readPng("og.png")
    expect(card).toMatchObject({ width: 1200, height: 630 })
    // A real card is tens of kilobytes; a path-shaped stub is tens of bytes.
    expect(card.bytes).toBeGreaterThan(10_000)
  })

  test("manifest icons are real PNGs at their declared sizes", () => {
    expect(readPng("web-app-manifest-192x192.png")).toMatchObject({ width: 192, height: 192 })
    expect(readPng("web-app-manifest-512x512.png")).toMatchObject({ width: 512, height: 512 })
  })

  test("the web manifest is JSON and its icons resolve to files on disk", () => {
    const manifest = JSON.parse(readFileSync(publicFile("site.webmanifest"), "utf8"))
    expect(manifest.name).toBe("OpenCorvus")
    expect(Array.isArray(manifest.icons)).toBe(true)
    for (const icon of manifest.icons) {
      const path = icon.src.replace(/^\//, "")
      expect(() => readFileSync(publicFile(path)), `${icon.src} is declared but missing`).not.toThrow()
    }
  })

  test("the favicon is an SVG document", () => {
    const favicon = readFileSync(publicFile("favicon.svg"), "utf8")
    expect(favicon.trimStart().startsWith("<svg")).toBe(true)
  })

  test("no asset is a checked-out symlink stub", () => {
    // The exact failure that hid here: a .png whose entire content is a relative path.
    for (const name of ["og.png", "web-app-manifest-192x192.png", "web-app-manifest-512x512.png"]) {
      const buffer = readFileSync(publicFile(name))
      expect(buffer.length, `${name} is suspiciously small`).toBeGreaterThan(1_000)
      const head = buffer.subarray(0, 64).toString("utf8")
      expect(head.includes("../"), `${name} looks like a symlink stub`).toBe(false)
    }
  })
})
