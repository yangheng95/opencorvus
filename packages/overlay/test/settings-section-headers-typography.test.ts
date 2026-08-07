// Regression for iter9 of the design-language audit.
//
// Settings-panel section headers carried the same tier-3 pill
// styling (`text-transform: uppercase` + 0.05em wide tracking) even
// though they read as section subtitles, not status chips:
//
//   - .about-section-title         (About panel: "Runtime", "Shortcuts", …)
//   - .oc-surface-header[data-surface="settings-group"]
//                                  (Settings panels: "Connection", "Database", …)
//   - .agent-model-tier-label      (Agent Models tier dividers)
//
// After iter4 (`.btn`) and iter7 (`.field-label`) the rest of the
// settings surface renders Title Case. These headers were the
// remaining tier-2 leaks — sitting in the same panel as a Title
// Case form label and an underlying Title Case button, but
// rendering as ALL CAPS themselves. Pin a single contract here so
// the entire settings surface stays in one typographic voice.
//
// Tier-3 status pills (req-type, req-status, gwg-verdict,
// verdict-pill, …) keep their uppercase styling. The negative
// control pins that distinction so a future "remove all uppercase"
// sweep can't quietly strip the legitimate pill styling.

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

describe("settings-panel section headers render Title Case", () => {
  for (const sel of [
    ".about-section-title",
    '.oc-surface-header[data-surface="settings-group"]',
    ".agent-model-tier-label",
  ]) {
    test(`${sel} does not force-uppercase`, () => {
      expect(ruleBody(sel)).not.toContain("text-transform: uppercase")
    })
  }
})

describe("tier-3 status pills keep uppercase (negative control)", () => {
  for (const sel of [".verdict-pill", ".req-type", ".req-status", ".gwg-verdict"]) {
    test(`${sel} stays uppercase`, () => {
      expect(ruleBody(sel)).toContain("text-transform: uppercase")
    })
  }
})
