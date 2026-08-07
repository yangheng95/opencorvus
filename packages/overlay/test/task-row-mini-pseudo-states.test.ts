// Regression for iter26 of the design-language audit.
//
// `.task-row-mini`'s pseudo-state cousins (`:hover`,
// `:focus-within`, `[data-active="true"]`) were defined
// multiple times each, with the same dual-source-with-late-
// override pattern collapsed in earlier iters:
//
//   :hover / :focus-within
//     - line ~10157: `:hover { background: gradient }` —
//                     dead, no !important, late tail wins.
//     - line ~12415: `:hover, :focus-within {
//                     background: var(--surface-hover) !important
//                   }` — late winner.
//
//   [data-active="true"]
//     - line ~10163: gradient bg + inset accent box-shadow —
//                     dead.
//     - line ~12421: `var(--accent-dim) !important` bg +
//                     accent border — middle override.
//     - line ~12839: color-mix bg !important + accent
//                     border + ::before stripe — late
//                     winner.
//
// The dead canonical-tier rules at 10157 / 10163 (no
// !important) lost specificity wars to the !important
// blocks at the file tail. Anyone tweaking line ~10157 saw
// no visual change — same trap as the iter5 / iter14 /
// iter17 / iter20 / iter25 collapses.
//
// The Work Ledger now consumes the shared `.oc-navigation-row`
// primitive. Pin one top-level primitive hover/focus block and one
// selected block; task-row surface CSS may retain only non-visual
// state details such as its transparent border and marker behavior.

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

function countTopLevelRulesEndingWithSelector(selector: string): number {
  // Walk every CSS rule by splitting the file at closing `}`
  // braces — for each chunk, the selector head is everything
  // up to the next `{`. Top-level rules only (head doesn't
  // start with whitespace after trim, doesn't start with
  // `body[…]` theme prefix, doesn't start with `@`). Match
  // when the selector LIST contains `selector` as its own
  // complete comma-separated entry.
  let count = 0
  for (const chunk of STYLES.split("}")) {
    const openIdx = chunk.indexOf("{")
    if (openIdx < 0) continue
    let head = chunk.slice(0, openIdx).trim()
    if (!head) continue
    if (head.startsWith("body")) continue
    if (head.startsWith("@")) continue
    // Inside @media: a chunk may start with `\n  .foo`.
    // The leading `\s+` would be stripped by `.trim()` so we
    // must inspect indentation separately. Re-find on raw
    // (untrimmed) — if the original (pre-trim) head's first
    // non-newline character is whitespace, the rule is
    // nested inside @media and skipped.
    const raw = chunk.slice(0, openIdx)
    const lastNewline = raw.lastIndexOf("\n")
    const lastLine = raw.slice(lastNewline + 1)
    if (lastLine !== lastLine.trimStart()) continue
    const segments = head.split(",").map((s) => s.trim())
    if (segments.includes(selector)) count += 1
  }
  return count
}

describe("Work Ledger navigation-row pseudo states are single source", () => {
  test(":hover base rule appears only on the shared primitive", () => {
    expect(countTopLevelRulesEndingWithSelector(".task-row-mini:hover")).toBe(0)
    expect(countTopLevelRulesEndingWithSelector(".oc-navigation-row:hover")).toBe(1)
  })

  test('[data-active="true"] visual rule appears only on the shared primitive', () => {
    expect(countTopLevelRulesEndingWithSelector('.task-row-mini[data-active="true"]')).toBe(1)
    expect(countTopLevelRulesEndingWithSelector('.oc-navigation-row[data-active="true"]')).toBe(1)
  })
})
