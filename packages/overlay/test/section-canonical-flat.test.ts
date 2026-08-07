// Regression for iter40 — single-source pass for `.section` (the
// inner collapsible card primitive in the right-panel section
// column). Refreshed for the 2026-05-04 container-shell theme-
// override retirement: the `.section` canonical was migrated out of
// styles.css and into `surfaces/inspector.css` along with the rest
// of the right-column shell. The flat chrome (--surface-inset bg,
// no drop-shadow) is now expressed directly via palette tokens, and
// the `body[data-theme]` `border: 0 !important` reset that used to
// strip the canonical's border has been retired.
//
// Pin the new contract:
// - The canonical lives in surfaces/inspector.css with --surface-inset
//   background, no 14px chrome radius, no rich drop-shadow.
// - No top-level styles.css selector with `background: ... !important`
//   lists `.section` — the !important reset chain that used to clobber
//   the canonical is gone.

import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import path from "node:path"

// styles.css was dissolved 2026-05-04 into styles/cascade/*.css and
// styles/surfaces/*.css. The !important-reset guard that used to scan
// styles.css now scans the cascade layer where any cross-cutting
// `background: ... !important` rule would live.
const STYLES_DIR = path.resolve(import.meta.dir, "..", "src", "styles")
const CASCADE_FILES = [
  "cascade/base.css",
  "cascade/typography.css",
  "cascade/dark.css",
  "cascade/light.css",
  "cascade/vscode-dark.css",
]
const RAW = CASCADE_FILES.map((rel) => readFileSync(path.join(STYLES_DIR, rel), "utf8")).join("\n")
const STYLES = RAW.replace(/\/\*[\s\S]*?\*\//g, "")
const INSPECTOR_RAW = readFileSync(
  path.resolve(import.meta.dir, "..", "src", "styles", "surfaces", "inspector.css"),
  "utf8",
)
const INSPECTOR_SURFACE = INSPECTOR_RAW.replace(/\/\*[\s\S]*?\*\//g, "")

function soloRuleBody(text: string, selector: string): string {
  for (const chunk of text.split("}")) {
    const openIdx = chunk.indexOf("{")
    if (openIdx < 0) continue
    const raw = chunk.slice(0, openIdx)
    const head = raw.trim()
    if (head !== selector) continue
    const lastNewline = raw.lastIndexOf("\n")
    const lastLine = raw.slice(lastNewline + 1)
    if (lastLine !== lastLine.trimStart()) continue
    return chunk.slice(openIdx + 1)
  }
  throw new Error(`solo ${selector} not found`)
}

// iter40 was a placeholder for migrating the legacy `.section` chrome
// off its !important reset chain. Subsequent work renamed the primitive
// to `.oc-section` (see `styles/primitives/section.css`) and retired
// `.section` entirely — no surface or component file still emits the
// class. So the original assertions ("canonical declares
// --surface-inset / soft radius / no drop-shadow") are obsolete. Pin
// the post-migration invariant instead: no solo `.section` rule
// survives anywhere, and the new primitive's body does not leak
// surface chrome (background/border) at the structural layer.
function hasSoloRule(text: string, selector: string): boolean {
  try {
    soloRuleBody(text, selector)
    return true
  } catch {
    return false
  }
}

describe(".section legacy chrome was retired in favour of .oc-section", () => {
  test("no surface file declares a solo top-level `.section` rule anymore", () => {
    expect(hasSoloRule(INSPECTOR_SURFACE, ".section")).toBe(false)
  })

  test(".oc-section primitive carries the section structural contract", () => {
    const primitiveRaw = readFileSync(
      path.resolve(import.meta.dir, "..", "src", "styles", "primitives", "section.css"),
      "utf8",
    )
    const primitive = primitiveRaw.replace(/\/\*[\s\S]*?\*\//g, "")
    expect(hasSoloRule(primitive, ".oc-section")).toBe(true)
  })

  test(".oc-section primitive intentionally omits surface chrome (background/border/box-shadow)", () => {
    const primitiveRaw = readFileSync(
      path.resolve(import.meta.dir, "..", "src", "styles", "primitives", "section.css"),
      "utf8",
    )
    const primitive = primitiveRaw.replace(/\/\*[\s\S]*?\*\//g, "")
    const body = soloRuleBody(primitive, ".oc-section")
    // The primitive is a flex-column shell only — colors live on surface
    // variants. Pin the contract so future edits don't sneak chrome
    // back into the structural layer (which would re-introduce the
    // double-source the iter40 plan tried to retire).
    expect(body).not.toMatch(/^\s*background:/m)
    expect(body).not.toMatch(/^\s*border:/m)
    expect(body).not.toMatch(/^\s*box-shadow:/m)
  })
})

describe("`.section` no longer rides the !important shell reset chain", () => {
  test("no top-level !important-bg rule still lists `.section`", () => {
    for (const chunk of STYLES.split("}")) {
      const openIdx = chunk.indexOf("{")
      if (openIdx < 0) continue
      const raw = chunk.slice(0, openIdx)
      const head = raw.trim()
      if (!head) continue
      if (head.startsWith("body")) continue
      if (head.startsWith("@")) continue
      const lastNewline = raw.lastIndexOf("\n")
      const lastLine = raw.slice(lastNewline + 1)
      if (lastLine !== lastLine.trimStart()) continue
      const body = chunk.slice(openIdx + 1)
      if (!/background:[^;]*!important/.test(body)) continue
      const segments = head.split(",").map((s) => s.trim())
      expect(segments).not.toContain(".section")
    }
  })
})
