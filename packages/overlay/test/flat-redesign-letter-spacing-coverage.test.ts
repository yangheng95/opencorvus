import { describe, expect, it } from "bun:test"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const OVERLAY_ROOT = join(import.meta.dir, "..")
const STYLE_ROOTS = [join(OVERLAY_ROOT, "src", "styles", "surfaces"), join(OVERLAY_ROOT, "src", "styles", "primitives")]

function walkCssFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const file = join(dir, entry)
    const stat = statSync(file)
    if (stat.isDirectory()) out.push(...walkCssFiles(file))
    else if (entry.endsWith(".css")) out.push(file)
  }
  return out
}

function relativeOverlayPath(file: string): string {
  return relative(OVERLAY_ROOT, file).replace(/\\/g, "/")
}

function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, (match) => "\n".repeat(match.split(/\r?\n/).length - 1))
}

function failWithViolations(kind: string, violations: string[], guidance: string): void {
  if (violations.length > 0) {
    throw new Error(`${kind} violations:\n  ${violations.join("\n  ")}\n${guidance}`)
  }
  expect(violations).toHaveLength(0)
}

describe("flat-redesign letter-spacing coverage", () => {
  it("surfaces and primitives do not contain unit letter-spacing literals", () => {
    const violations: string[] = []
    const literal = /letter-spacing\s*:\s*-?\d+(?:\.\d+)?(?:em|px|%)\b/i
    for (const file of STYLE_ROOTS.flatMap(walkCssFiles).sort()) {
      const lines = withoutComments(readFileSync(file, "utf8")).split(/\r?\n/)
      lines.forEach((line, index) => {
        if (literal.test(line)) violations.push(`${relativeOverlayPath(file)}:${index + 1}: ${line.trim()}`)
      })
    }

    failWithViolations(
      "letter-spacing literal",
      violations,
      "Use var(--ui-letter-spacing-*) tokens instead of numeric letter-spacing literals.",
    )
  })

  it("every letter-spacing declaration uses the canonical ui token scale", () => {
    const violations: string[] = []
    const declaration = /letter-spacing\s*:\s*([^;]+);/i
    const tokenReference = /^var\(--ui-letter-spacing-[a-z0-9-]+\)$/i
    for (const file of STYLE_ROOTS.flatMap(walkCssFiles).sort()) {
      const lines = withoutComments(readFileSync(file, "utf8")).split(/\r?\n/)
      lines.forEach((line, index) => {
        const match = line.match(declaration)
        if (!match) return
        const value = match[1]!.trim()
        if (!tokenReference.test(value)) {
          violations.push(`${relativeOverlayPath(file)}:${index + 1}: ${line.trim()}`)
        }
      })
    }

    failWithViolations(
      "letter-spacing token",
      violations,
      "Only var(--ui-letter-spacing-*) references are allowed under surfaces/ and primitives/.",
    )
  })
})
