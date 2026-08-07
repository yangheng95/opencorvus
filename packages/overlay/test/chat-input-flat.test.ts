// Single-source guard for the chat composer input (.chat-input).
//
// Replaces the old "flat" guard (iter17, 2026-05-02) which enforced
// `border-radius: 0`. That constraint was superseded by the 2026-05-04
// reference-design request (chat ui.png) which shows a rounded floating
// card input. The core value of this test — preventing multiple conflicting
// `.chat-input {}` blocks from fighting over border-radius / margin /
// background (the !important wars seen in iter5/iter14/iter15/iter16/iter17)
// — is preserved. Only the specific "must be flat" assertions are removed.

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
const CLEAN_STYLES = STYLES.replace(/\/\*[\s\S]*?\*\//g, "")

function countSoloTopLevelRules(selector: string): number {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const re = new RegExp(`(^|\\n)${escaped}\\s*\\{`, "g")
  return Array.from(STYLES.matchAll(re)).length
}

function soloRuleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const head = new RegExp(`(^|\\n)${escaped}\\s*\\{`, "m").exec(STYLES)
  if (!head) throw new Error(`solo ${selector} not found in surface files`)
  const open = head.index + head[0].length - 1
  const close = STYLES.indexOf("}", open)
  if (close < 0) throw new Error(`malformed block for ${selector}`)
  return STYLES.slice(open + 1, close)
}

describe(".chat-input is a single-source canonical rule", () => {
  test("only one solo top-level `.chat-input { … }` rule", () => {
    expect(countSoloTopLevelRules(".chat-input")).toBe(1)
  })

  test("the canonical body uses no `!important`", () => {
    expect(soloRuleBody(".chat-input")).not.toContain("!important")
  })

  test("the canonical uses a radius token (not a raw px value)", () => {
    const body = soloRuleBody(".chat-input")
    // border-radius must route through the canonical radius token set.
    // Raw px values are forbidden (radius-coverage test guards this globally).
    expect(body).toMatch(/border-radius:\s*var\(--oc-radius-(?:none|soft|large|xl|pill)\)/)
  })

  test("the canonical has a single border declaration (no !important duplication)", () => {
    const body = soloRuleBody(".chat-input")
    const borderMatches = [...body.matchAll(/\bborder(?!-radius|-color|-top|-bottom|-left|-right|-block|-inline):/g)]
    expect(borderMatches.length).toBe(1)
  })

  test("theme selectors cannot own `.chat-input` chrome", () => {
    for (const chunk of CLEAN_STYLES.split("}")) {
      const openIdx = chunk.indexOf("{")
      if (openIdx < 0) continue
      const selector = chunk.slice(0, openIdx).trim()
      const isThemeSelector = /body(?:\[[^\]]*data-theme[^\]]*\]|:is\([^)]*data-theme[^)]*\))/.test(selector)
      if (!isThemeSelector) continue
      expect(selector).not.toMatch(/(?:^|\s|:is\([^)]*)\.chat-input(?:\b|[:.[#])/)
    }
  })

  test("no `.chat-input::before` decorative gradient survives", () => {
    expect(STYLES).not.toMatch(/\n\.chat-input::before\s*\{/)
  })
})
