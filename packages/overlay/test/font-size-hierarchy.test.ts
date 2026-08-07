// Typography hierarchy guard.
//
// Replaces font-size-cap.test.ts (deleted 2026-05-04).
//
// The old test enforced that --ui-font-display = --ui-font-heading =
// --ui-font-title = --ui-font-body (all capped at 12px), which prevented
// any visual hierarchy. The user's reference-design request (2026-05-04)
// established that the overlay needs a proper 4-tier scale:
//   display > heading > title > body
//
// This guard enforces that ordering rather than a flat ceiling.
// A future contributor who collapses the tiers back to 12px trips the test.

import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

const STYLES_ROOT = path.resolve(import.meta.dir, "..", "src", "styles")

function walkCss(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walkCss(full))
    else if (entry.endsWith(".css")) out.push(full)
  }
  return out
}

const STYLES = walkCss(STYLES_ROOT)
  .map((f) => readFileSync(f, "utf8"))
  .join("\n")
  .replace(/\/\*[\s\S]*?\*\//g, "")

function tokenValues(): Record<string, string> {
  const out: Record<string, string> = {}
  const re = /(--ui-font-(?:display|heading|title|body)):\s*([^;]+);/g
  for (const m of STYLES.matchAll(re)) {
    out[m[1]!] = m[2]!.trim()
  }
  return out
}

function extractPx(value: string): number | null {
  const m = value.match(/calc\((\d+(?:\.\d+)?)px\s*\*/)
  return m ? Number(m[1]) : null
}

describe("typography token hierarchy (display > heading > title > body)", () => {
  test("all 4 tier tokens are declared", () => {
    const t = tokenValues()
    expect(t["--ui-font-display"]).toBeTruthy()
    expect(t["--ui-font-heading"]).toBeTruthy()
    expect(t["--ui-font-title"]).toBeTruthy()
    expect(t["--ui-font-body"]).toBeTruthy()
  })

  test("display > heading", () => {
    const t = tokenValues()
    const display = extractPx(t["--ui-font-display"]!)
    const heading = extractPx(t["--ui-font-heading"]!)
    expect(display).not.toBeNull()
    expect(heading).not.toBeNull()
    expect(display!).toBeGreaterThan(heading!)
  })

  test("heading > title", () => {
    const t = tokenValues()
    const heading = extractPx(t["--ui-font-heading"]!)
    const title = extractPx(t["--ui-font-title"]!)
    expect(heading).not.toBeNull()
    expect(title).not.toBeNull()
    expect(heading!).toBeGreaterThan(title!)
  })

  test("title > body (titles stay visibly larger than content)", () => {
    const t = tokenValues()
    const title = extractPx(t["--ui-font-title"]!)
    const body = extractPx(t["--ui-font-body"]!)
    expect(title).not.toBeNull()
    expect(body).not.toBeNull()
    expect(title!).toBeGreaterThan(body!)
  })

  test("body >= 11px (readable minimum)", () => {
    const t = tokenValues()
    const body = extractPx(t["--ui-font-body"]!)
    expect(body).not.toBeNull()
    expect(body!).toBeGreaterThanOrEqual(11)
  })
})
