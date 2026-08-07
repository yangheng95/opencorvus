// Regression for the right-panel empty-state design-language audit (iter3).
//
// Before this iter, every right-panel-adjacent component carried its own
// "no data yet" CSS class:
//   - ArchitectPanel    -> .arch-empty
//   - RequirementsPanel -> .req-empty
//
// Each rolled its own font, padding, color, italic-or-not, bordered-card-
// or-bare, so a user staring at a fresh task saw four different visual
// treatments for the same semantic state. There IS a shared primitive
// already — `.empty-hint` plus a card-chrome shell at styles.css:2444 —
// but only DiffView / LogViewer / MemoryPanel /
// settings package inspectors used it. The right panel didn't.
//
// This test pins the contract:
//   1. The three components above that still render explicit empty-state DOM
//      do so with the
//      shared `.empty-hint` class plus the `.empty-hint--card`
//      modifier, never the legacy per-panel class.
//   2. AcceptancePanel retired its bespoke empty placeholder entirely; when
//      there is no acceptance payload, it no longer renders a fake empty card.
//   2. styles.css advertises `.empty-hint--card` on the same card-chrome
//      selector group as the existing nested-`.empty-hint` cards
//      (single source — rule 8). That way every empty card looks the
//      same regardless of parent.
//   3. The legacy per-panel CSS rules are gone (no dual source).

import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

const SRC = path.resolve(import.meta.dir, "..", "src")
const STYLES_ROOT = path.join(SRC, "styles")

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

function readComponent(rel: string): string {
  return readFileSync(path.join(SRC, "components", rel), "utf8")
}

describe("right-panel components emit the shared empty-hint primitive", () => {
  const cases: Array<{ panel: string; file: string; legacyClass: string }> = [
    { panel: "ArchitectPanel", file: "ArchitectPanel.tsx", legacyClass: "arch-empty" },
    { panel: "RequirementsPanel", file: "RequirementsPanel.tsx", legacyClass: "req-empty" },
  ]

  for (const c of cases) {
    test(`${c.panel} uses .empty-hint .empty-hint--card, not .${c.legacyClass}`, () => {
      const src = readComponent(c.file)
      expect(src).not.toContain(c.legacyClass)
      // It is sufficient to assert the primitive class shows up at least
      // once in the source — these components only render empty state in
      // one or two places, so any match is the migrated empty state.
      expect(src).toContain('class="empty-hint empty-hint--card"')
    })
  }
})

describe("AcceptancePanel retires the bespoke empty placeholder", () => {
  test("AcceptancePanel keeps the legacy empty class deleted and does not fake a shared empty-hint card", () => {
    const src = readComponent("Board.tsx")
    const acceptancePanel = src.slice(
      src.indexOf("export function AcceptancePanel"),
      src.indexOf("// ── TaskActionsPanel ──"),
    )
    expect(acceptancePanel).not.toContain("acceptance-empty-hint")
    expect(acceptancePanel).not.toContain('class="empty-hint empty-hint--card"')
  })
})

describe("surface CSS declares .empty-hint--card on the shared card-chrome group", () => {
  test("the card-chrome selector list advertises .empty-hint--card", () => {
    // Anchored at the canonical nested-card block (lines 2444+ before the
    // refactor). Right-panel empty states now opt into card chrome with the
    // `.empty-hint--card` modifier, not a dead section-body child selector.
    expect(STYLES).not.toMatch(new RegExp("(?:^|[\\s,])\\.section" + "-body\\s*>"))
    expect(STYLES).not.toMatch(/\.oc-section__body\s*>\s*\.empty-hint/)
    const cardChromeBlock = STYLES.match(/(\.empty-hint--card[^{]*\{[\s\S]*?border-radius[^}]*\})/)
    expect(cardChromeBlock).not.toBeNull()
    expect(cardChromeBlock![0]).toContain(".empty-hint--card")
  })

  test("legacy per-panel empty-state CSS rules are gone", () => {
    expect(STYLES).not.toMatch(/^\s*\.arch-empty\s*\{/m)
    expect(STYLES).not.toMatch(/^\s*\.req-empty\s*\{/m)
    expect(STYLES).not.toMatch(/^\s*\.integrity__empty\s*\{/m)
    expect(STYLES).not.toMatch(/^\s*\.agent-activity-empty\s*\{/m)
    expect(STYLES).not.toMatch(/^\s*\.acceptance-empty-hint\s*\{/m)
  })
})
