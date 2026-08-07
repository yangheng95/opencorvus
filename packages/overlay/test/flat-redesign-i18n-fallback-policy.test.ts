import { describe, expect, it } from "bun:test"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const OVERLAY_ROOT = join(import.meta.dir, "..")
const SRC_ROOT = join(OVERLAY_ROOT, "src")

function walkSourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const file = join(dir, entry)
    const stat = statSync(file)
    if (stat.isDirectory()) out.push(...walkSourceFiles(file))
    else if (/\.(?:ts|tsx)$/.test(entry)) out.push(file)
  }
  return out
}

function relativeOverlayPath(file: string): string {
  return relative(OVERLAY_ROOT, file).replace(/\\/g, "/")
}

function lineAtOffset(text: string, offset: number): number {
  return text.slice(0, offset).split(/\r?\n/).length
}

describe("flat-redesign i18n fallback policy", () => {
  it("source does not use t(...) string fallback expressions", () => {
    const violations: string[] = []
    const fallbackPattern = /\bt\([^)]*\)\s*\|\|\s*["']/g
    for (const file of walkSourceFiles(SRC_ROOT).sort()) {
      const text = readFileSync(file, "utf8")
      for (const match of text.matchAll(fallbackPattern)) {
        violations.push(`${relativeOverlayPath(file)}:${lineAtOffset(text, match.index ?? 0)}: ${match[0]}`)
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `i18n fallback policy violations:\n  ${violations.join("\n  ")}\n` +
          "Add the key to locale catalogs instead of masking missing translations with t(...) || string.",
      )
    }
    expect(violations).toHaveLength(0)
  })
})
