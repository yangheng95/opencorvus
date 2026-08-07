// Regression for iter24 of the design-language audit.
//
// `.task-row-mini` (the row for each task in the left sidebar
// task list — visible all the time the user has the sidebar
// open) had THREE solo top-level rules in styles.css:
//
//   - line ~9800: chromed canonical — flex layout, 10px
//                 radius, padding 4/6, transparent bg.
//   - line ~12388: !important override — align-items stretch,
//                 gap 6px, padding 4px, var(--radius) ≈ 10px,
//                 1px transparent border, transparent bg
//                 !important.
//   - line ~12822: late override — position relative,
//                 min-height 54px, padding 5/6/5/9.
//
// Same dual-source-with-late-override pattern collapsed in
// iter5 / iter14 / iter15 / iter16 / iter17 / iter20 / iter22 /
// iter23. The canonical lied about padding (4/6 in source,
// 5/6/5/9 rendered) and gap (4px in source, 6px rendered).
//
// After iter15/16 made the surrounding `.sidebar` shell flat
// (border-radius: 0), the task rows still rendered with 10px
// rounded corners — pill-on-flat. Drop the radius so the
// row reads as a flush slice of the flat sidebar.
//
// State-specific pseudo-class rules (`:hover`, `:focus-within`,
// `[data-active="true"]`, drag states) are untouched in this
// iter — those carry distinct visual meanings (each adds its
// own bg / border / accent stripe). Their own dual-source
// duplicates (e.g. two `:hover` rules at lines ~10134 and
// ~12397 setting different bg) are scoped to a follow-up
// iter to keep this commit focused.

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

describe(".task-row-mini base rule is a single flat source", () => {
  test("only one solo top-level `.task-row-mini { … }` rule", () => {
    expect(countSoloTopLevelRules(".task-row-mini")).toBe(1)
  })

  test("the canonical body uses no `!important` (pseudo-state rules can still need it)", () => {
    expect(soloRuleBody(".task-row-mini")).not.toContain("!important")
  })

  test("surface geometry does not override the shared navigation-row corner primitive", () => {
    expect(soloRuleBody(".task-row-mini")).not.toContain("border-radius:")
    expect(soloRuleBody(".oc-navigation-row")).toContain("border-radius: var(--oc-radius-large)")
  })

  test("no theme override re-introduces a non-zero border-radius on the base .task-row-mini", () => {
    // CRON lesson from iter17. Walk every theme-scoped solo
    // rule (`body[data-theme="..."] .task-row-mini { … }`,
    // no pseudo selector) and assert none re-add radius.
    const headRe = /(^|\n)body[^{]*?\.task-row-mini(?![-\w:[])\s*\{/g
    for (const match of STYLES.matchAll(headRe)) {
      const open = match.index + match[0].length - 1
      const close = STYLES.indexOf("}", open)
      const body = STYLES.slice(open + 1, close)
      expect(body).not.toMatch(/border-radius:\s*(?!0)\S/)
    }
  })
})
