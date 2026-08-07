import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const BADGE_SOURCE = readFileSync(join(import.meta.dir, "../src/components/ui/Badge.tsx"), "utf8")
const BADGE_CSS = readFileSync(join(import.meta.dir, "../src/styles/primitives/badge.css"), "utf8")

test("Badge primitive owns the complete status metadata contract", () => {
  expect(BADGE_SOURCE).toContain('export const BADGE_TONES = ["neutral", "accent", "ok", "warn", "bad", "muted"] as const')
  expect(BADGE_SOURCE).toContain('export const BADGE_SIZES = ["sm", "md"] as const')
  expect(BADGE_SOURCE).toContain('class={className()}')
  expect(BADGE_SOURCE).toContain('data-tone={local.tone ?? "neutral"}')
  expect(BADGE_SOURCE).toContain('data-size={local.size ?? "md"}')
})

test("Badge metadata stays quiet and cannot resemble an outlined action", () => {
  expect(BADGE_CSS).toMatch(/\.oc-badge\s*\{[^}]*border:\s*0 solid transparent;/s)
  for (const tone of ["accent", "ok", "warn", "bad"]) {
    expect(BADGE_CSS).toMatch(
      new RegExp(`\\.oc-badge\\[data-tone="${tone}"\\]\\s*\\{[^}]*background:\\s*color-mix\\(in srgb, var\\(--${tone === "accent" ? "accent" : tone === "ok" ? "good" : tone}\\) 10%, var\\(--surface-inset\\)\\);`, "s"),
    )
  }
  expect(BADGE_CSS).not.toMatch(/\.oc-badge\[data-tone="(?:accent|ok|warn|bad|muted)"\]\s*\{[^}]*border-color:/s)
})
