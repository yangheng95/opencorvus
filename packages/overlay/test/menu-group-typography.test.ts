// Regression for iter11 of the design-language audit.
//
// Three more tier-2 leaks where small group labels inside picker
// surfaces (titlebar dropdowns, command palette, provider catalog)
// were styled as tier-3 status pills (uppercase + wide tracking)
// even though they have no pill chrome — they're plain subheaders
// inside a list:
//
//   .titlebar-menubar-group-title  (e.g. "Theme" / "Locale" inside
//                                   a titlebar menu)
//   .cmdk-group-label              (group label in cmd-K palette
//                                   results)
//   .provider-section-label        (provider catalog group:
//                                   "Custom Providers", "Available")
//
// Same logic as iter4 / iter7 / iter9: no pill chrome → not a
// status chip → Title Case wins. Tier-3 status pills (verdict-pill,
// req-status, etc.) keep uppercase via the negative control.

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

function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const head = new RegExp(`(^|\\n)\\s*${escaped}(?=[\\s,{[])[^{]*\\{`, "m").exec(STYLES)
  if (!head) throw new Error(`selector ${selector} not found in surface files`)
  const open = head.index + head[0].length - 1
  const close = STYLES.indexOf("}", open)
  if (close < 0) throw new Error(`malformed block for ${selector}`)
  return STYLES.slice(open + 1, close)
}

describe("picker-surface group labels render Title Case", () => {
  for (const sel of [".titlebar-menubar-group-title", ".cmdk-group-label", ".provider-section-label"]) {
    test(`${sel} does not force-uppercase`, () => {
      expect(ruleBody(sel)).not.toContain("text-transform: uppercase")
    })
  }
})

describe("tier-3 status pills keep uppercase (negative control)", () => {
  for (const sel of [".verdict-pill", ".req-status"]) {
    test(`${sel} stays uppercase`, () => {
      expect(ruleBody(sel)).toContain("text-transform: uppercase")
    })
  }
})
