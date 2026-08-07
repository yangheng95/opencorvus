// Regression for iter15 of the design-language audit, refreshed for
// the 2026-05-04 container-shell theme-override retirement.
//
// Original iter15 fix retired four duplicate `.sections` rules in
// styles.css and pinned a single canonical with no `!important`. The
// 2026-05-04 slice migrated that canonical out of styles.css entirely:
// the right-column container shell now lives in
// `src/styles/surfaces/inspector.css`, and the `body[data-theme]`
// background overrides that used to repaint it are gone (palette
// tokens — `--inspector-surface` differs per theme — drive the
// rendering without selectors). The `.sidebar, .chat, .sections`
// `!important` flat-reset chains are also gone.
//
// Pin the new contract:
// - styles.css must NOT define `.sections` at all (single-source in
//   surfaces/inspector.css).
// - surfaces/inspector.css declares exactly one solo top-level
//   `.sections { … }` rule with no `!important`.
// - The legacy `.sidebar, .chat, .sections { … !important }` reset
//   chain remains absent.

import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

// styles.css was dissolved 2026-05-04. The cascade layer (base + typography +
// dark + light + vscode-dark) is where cross-cutting rules live; .sections
// must not appear there (it lives in surfaces/inspector.css exclusively).
const CASCADE_DIR = path.resolve(import.meta.dir, "..", "src", "styles", "cascade")
const CASCADE_CSS = readdirSync(CASCADE_DIR)
  .filter((f) => f.endsWith(".css"))
  .map((f) => readFileSync(path.join(CASCADE_DIR, f), "utf8"))
  .join("\n")

const INSPECTOR_SURFACE = readFileSync(
  path.resolve(import.meta.dir, "..", "src", "styles", "surfaces", "inspector.css"),
  "utf8",
)

function countSoloTopLevelRules(text: string, selector: string): number {
  // Solo top-level rules only — no leading whitespace, no
  // theme prefix (`body[data-theme]`), no multi-selector list.
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const re = new RegExp(`(^|\\n)${escaped}\\s*\\{`, "g")
  return Array.from(text.matchAll(re)).length
}

function soloRuleBody(text: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const head = new RegExp(`(^|\\n)${escaped}\\s*\\{`, "m").exec(text)
  if (!head) throw new Error(`solo ${selector} not found`)
  const open = head.index + head[0].length - 1
  const close = text.indexOf("}", open)
  if (close < 0) throw new Error(`malformed block for ${selector}`)
  return text.slice(open + 1, close)
}

describe(".sections is a single source of truth", () => {
  test("cascade layer does not define `.sections` (migrated to surfaces/inspector.css)", () => {
    expect(countSoloTopLevelRules(CASCADE_CSS, ".sections")).toBe(0)
  })

  test("surfaces/inspector.css declares exactly one solo top-level `.sections { … }` rule", () => {
    expect(countSoloTopLevelRules(INSPECTOR_SURFACE, ".sections")).toBe(1)
  })

  test("the canonical `.sections` body uses no `!important`", () => {
    expect(soloRuleBody(INSPECTOR_SURFACE, ".sections")).not.toContain("!important")
  })

  test("`.sections` is no longer riding on `.sidebar, .chat, .sections { … !important }` flat resets", () => {
    expect(CASCADE_CSS).not.toMatch(/\.sidebar,[\s\n]*\.chat,[\s\n]*\.sections\s*\{[^}]*!important/)
  })
})
