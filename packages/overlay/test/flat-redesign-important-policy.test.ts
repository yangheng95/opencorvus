import { describe, expect, it } from "bun:test"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const OVERLAY_ROOT = join(import.meta.dir, "..")
const STYLES_ROOT = join(OVERLAY_ROOT, "src", "styles")

const ALLOWED_IMPORTANT_COUNTS = new Map([
  ["src/styles/cascade/base.css:display: none !important;", 2],
  ["src/styles/cascade/base.css:animation: none !important;", 1],
])

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

function importantOccurrences(): string[] {
  const occurrences: string[] = []
  for (const file of walkCssFiles(STYLES_ROOT).sort()) {
    const lines = withoutComments(readFileSync(file, "utf8")).split(/\r?\n/)
    lines.forEach((line, index) => {
      if (line.includes("!important")) {
        occurrences.push(`${relativeOverlayPath(file)}:${index + 1}:${line.trim()}`)
      }
    })
  }
  return occurrences
}

describe("flat-redesign important policy", () => {
  it("styles keep !important constrained to the explicit browser-behavior whitelist", () => {
    const occurrences = importantOccurrences()
    const actualCounts = new Map<string, number>()
    for (const occurrence of occurrences) {
      const signature = occurrence.replace(/:\d+:/, ":")
      actualCounts.set(signature, (actualCounts.get(signature) ?? 0) + 1)
    }

    const violations: string[] = []
    for (const [signature, count] of actualCounts) {
      if (ALLOWED_IMPORTANT_COUNTS.get(signature) !== count) {
        violations.push(`${signature} count=${count}`)
      }
    }
    for (const [signature, count] of ALLOWED_IMPORTANT_COUNTS) {
      if ((actualCounts.get(signature) ?? 0) !== count) {
        violations.push(`${signature} expected=${count} actual=${actualCounts.get(signature) ?? 0}`)
      }
    }

    if (occurrences.length > 3 || violations.length > 0) {
      throw new Error(
        `!important policy violations:\n` +
          `  total: ${occurrences.length}\n` +
          (violations.length ? `  outside whitelist:\n  ${violations.join("\n  ")}\n` : "") +
          "Only base.css hidden and reduced-motion declarations may use !important.",
      )
    }
    expect(occurrences).toHaveLength(3)
  })
})
