// Regression for iter37 of the design-language audit.
//
// `.gwg-priority-badge` (the small "advisory" / priority tag
// next to a goal title in the GoalGroup card header)
// had three top-level rules in styles.css:
//
//   - line ~10628: pill-chrome canonical — `font-size tiny`,
//                  `text-transform: uppercase`, padding
//                  pill, `border-radius: 999px`, `--warn-dim`
//                  bg, `--warn` color. Looked like a
//                  classic warn pill.
//   - line ~11958: multi-selector layout shared with
//                  retired status classes —
//                  REWRITES the chrome to a dot-prefix
//                  status row: `border: none`,
//                  `border-radius: 0`, `background: transparent`,
//                  `padding-left: 10px` + `::before` 5px dot.
//                  Late winner; the canonical's pill chrome
//                  never rendered.
//   - line ~12053: solo `color: var(--warn)` reasserting
//                  the warn tone the canonical also set.
//                  Pure rule-9 redundant copy.
//
// Same specificity-shadowed dead-canonical pattern collapsed
// in iter5 / iter14 / iter17 / iter20 / iter25 / iter26 /
// iter27 / iter29. The canonical lied about the chrome —
// editing it was a no-op.
//
// Pin: delete the lying pill canonical at ~10628; keep the
// actual rendered dot-prefix values. Result: ONE solo top-level
// `.gwg-priority-badge` rule owns the live badge after the retired
// status classes were removed.

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

// Concatenate all surface + cascade + primitive CSS files (styles.css was
// dissolved 2026-05-04 into this decomposed architecture). Comments are
// stripped first so a /* ... */ block immediately preceding a rule does
// not get folded into the rule's selector head when we split on }.
function stripCssComments(input: string): string {
  return input.replace(/\/\*[\s\S]*?\*\//g, "")
}
const STYLES = stripCssComments(
  walkCss(STYLES_ROOT)
    .map((f) => readFileSync(f, "utf8"))
    .join("\n"),
)

function countSoloTopLevelRules(selector: string): number {
  let count = 0
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
    if (head === selector) count += 1
  }
  return count
}

function soloRuleBody(selector: string): string {
  for (const chunk of STYLES.split("}")) {
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

describe(".gwg-priority-badge canonical no longer lies about pill chrome", () => {
  test("only one solo top-level `.gwg-priority-badge { … }` rule", () => {
    expect(countSoloTopLevelRules(".gwg-priority-badge")).toBe(1)
  })

  test("the surviving solo rule does NOT declare the dead pill chrome (radius 999px / pill bg / pill padding)", () => {
    const body = soloRuleBody(".gwg-priority-badge")
    expect(body).not.toMatch(/border-radius:\s*999px/)
    expect(body).not.toMatch(/background:\s*color-mix\(in srgb,\s*var\(--warn-dim\)/)
    // The solo rule should be the warn-color override that
    // pairs with the shared dot-prefix layout — assert it
    // declares the warn color.
    expect(body).toMatch(/color:\s*var\(--warn\)/)
  })
})
