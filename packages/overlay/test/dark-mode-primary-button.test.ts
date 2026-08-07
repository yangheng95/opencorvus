// Regression for iter19 of the design-language audit, refreshed for the
// 2026-05-03 primary-button palette-only refactor.
//
// Original user feedback (2026-05-02 22:57): "深色模式下渐变色按钮有点
// 奇怪" — the gradient primary buttons look weird in dark mode. The
// original fix used a `body:is([data-theme="dark"], …) .btn-primary`
// selector to force a
// solid accent on dark surfaces. That made the theme override button
// chrome, which violates the "themes only swap palette" contract this
// codebase now enforces.
//
// New contract: the dark + vscode-dark root blocks override
// `--accent-gradient` itself to `var(--accent)` (and
// `--accent-gradient-hover` to `var(--accent-hover)`). The shared
// canonical at the multi-class selector reads `--accent-gradient`
// directly, so dark surfaces resolve to a solid accent without any
// theme selector touching `.btn-primary`.
// Light keeps the linear-gradient palette
// because the original complaint was scoped to dark.

import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

const STYLES_ROOT = path.resolve(import.meta.dir, "..", "src", "styles")
const CASCADE_DIR = path.join(STYLES_ROOT, "cascade")

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

function rootBodyOfTheme(theme: "dark" | "vscode-dark"): string {
  // Theme palette blocks now live in styles/cascade/{dark,vscode-dark}.css.
  // The helper reads that file and returns the body of the sole
  // `:root[data-theme="<theme>"] { … }` block — there should be exactly one.
  const file = readFileSync(path.join(CASCADE_DIR, `${theme}.css`), "utf8")
  const headRe = new RegExp(`:root\\[data-theme="${theme}"\\]\\s*\\{`, "g")
  const matches = [...file.matchAll(headRe)]
  if (matches.length === 0) throw new Error(`theme block for ${theme} not found`)
  const last = matches[matches.length - 1]!
  const open = last.index! + last[0].length - 1
  const close = file.indexOf("\n}", open)
  if (close < 0) throw new Error(`theme block ${theme} missing close brace`)
  return file.slice(open + 1, close)
}

describe("dark-mode primary buttons render with a solid accent (no multi-hue gradient)", () => {
  for (const theme of ["dark", "vscode-dark"] as const) {
    test(`${theme} root flattens --accent-gradient to the solid accent palette`, () => {
      const body = rootBodyOfTheme(theme)
      expect(body).toMatch(/--accent-gradient:\s*var\(--accent\)\s*;/)
      expect(body).toMatch(/--accent-gradient-hover:\s*var\(--accent-hover\)\s*;/)
      // Guard against a regression that re-introduces a multi-hue
      // gradient inside the dark palette: the token must resolve to a
      // solid accent var, not a `linear-gradient(...)` value.
      expect(body).not.toMatch(/--accent-gradient:\s*linear-gradient/)
      expect(body).not.toMatch(/--accent-gradient-hover:\s*linear-gradient/)
    })
  }

  test("primary-button selectors do not appear in any theme override block", () => {
    // The chrome layer is single-sourced in the shared canonical at line
    // 7585; no `body:is([data-theme="dark"], …) .btn-primary`
    // override is allowed. Iter19's selector-driven fix has been
    // retired in favour of a palette-only approach.
    const themeWithPrimaryRe = new RegExp(
      "(?:html|body)(?:\\[[^\\]]*data-theme[^\\]]*\\]|:is\\([^)]*data-theme[^)]*\\))" +
        "[^{]*\\.btn-primary\\b",
      "g",
    )
    const stripped = STYLES.replace(/\/\*[\s\S]*?\*\//g, "")
    expect(stripped).not.toMatch(themeWithPrimaryRe)
  })
})
