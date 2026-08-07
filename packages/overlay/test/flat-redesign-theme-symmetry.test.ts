/**
 * Coverage guard for theme-architecture Step 0 (flat redesign migration contract §八 v3+).
 *
 * Pins the structural fixes that retire the cross-theme leak:
 *
 *   1. Theme selectors must target the real theme attributes on both
 *      `:root` and `body`, while dark must not keep the dead
 *      `body:not([data-theme])` boot path.
 *
 *   2. The three theme files in `cascade/` declare the **same set of
 *      palette tokens**. Any asymmetry — a token declared in one
 *      theme but not the other two — is a regression that lets dark
 *      values bleed through to other themes.
 *
 *   3. Structural tokens (font families / sizes, layout dimensions,
 *      title weight + tracking) live exclusively in
 *      `tokens/design-language.css` :root, not in any theme block.
 *
 * Adding a token to one theme without the other two breaks test (2);
 * adding a structural token to a theme block breaks test (3); restoring
 * the dead boot selector breaks test (1).
 */

import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const STYLES_ROOT = join(import.meta.dir, "..", "src", "styles")

function readCascade(name: string): string {
  return readFileSync(join(STYLES_ROOT, "cascade", name), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
}

const DARK = readCascade("dark.css")
const LIGHT = readCascade("light.css")
const VSCODE_DARK = readCascade("vscode-dark.css")

/** Extract the body of the FIRST `<selector> { ... }` block. The cascade
 * theme files each hold exactly one such block. */
function firstBlockBody(text: string): string {
  const open = text.indexOf("{")
  if (open < 0) throw new Error("no block found")
  let depth = 1
  for (let i = open + 1; i < text.length; i++) {
    if (text[i] === "{") depth++
    else if (text[i] === "}") {
      depth--
      if (depth === 0) return text.slice(open + 1, i)
    }
  }
  throw new Error("unbalanced braces")
}

/** Pull every `--token-name: ...;` declaration name from a block body. */
function declaredTokens(blockBody: string): Set<string> {
  const out = new Set<string>()
  for (const m of blockBody.matchAll(/(--[a-z][a-z0-9-]*)\s*:/gi)) {
    out.add(m[1]!)
  }
  return out
}

describe("theme-architecture Step 0 — theme selectors target data-theme", () => {
  test("cascade/dark.css selector targets only the root theme owner", () => {
    const head = DARK.slice(0, DARK.indexOf("{")).trim()
    expect(head).toContain(':root[data-theme="dark"]')
    expect(head).not.toContain('body[data-theme="dark"]')
    expect(head).not.toContain("body:not([data-theme])")
  })

  test("cascade/light.css selector targets only the root theme owner", () => {
    const head = LIGHT.slice(0, LIGHT.indexOf("{")).trim()
    expect(head).toContain(':root[data-theme="light"]')
    expect(head).not.toContain('body[data-theme="light"]')
  })

  test("cascade/vscode-dark.css selector targets only the root theme owner", () => {
    const head = VSCODE_DARK.slice(0, VSCODE_DARK.indexOf("{")).trim()
    expect(head).toContain(':root[data-theme="vscode-dark"]')
    expect(head).not.toContain('body[data-theme="vscode-dark"]')
  })
})

describe("theme-architecture Step 0 — palette parity across themes", () => {
  const darkTokens = declaredTokens(firstBlockBody(DARK))
  const lightTokens = declaredTokens(firstBlockBody(LIGHT))
  const vscodeDarkTokens = declaredTokens(firstBlockBody(VSCODE_DARK))

  test("dark and light declare the same token set", () => {
    const onlyInDark = [...darkTokens].filter((t) => !lightTokens.has(t)).sort()
    const onlyInLight = [...lightTokens].filter((t) => !darkTokens.has(t)).sort()
    if (onlyInDark.length || onlyInLight.length) {
      throw new Error(
        `dark/light asymmetry:\n` +
          (onlyInDark.length ? `  only in dark: ${onlyInDark.join(", ")}\n` : "") +
          (onlyInLight.length ? `  only in light: ${onlyInLight.join(", ")}\n` : ""),
      )
    }
  })

  test("dark and vscode-dark declare the same token set", () => {
    const onlyInDark = [...darkTokens].filter((t) => !vscodeDarkTokens.has(t)).sort()
    const onlyInVscode = [...vscodeDarkTokens].filter((t) => !darkTokens.has(t)).sort()
    if (onlyInDark.length || onlyInVscode.length) {
      throw new Error(
        `dark/vscode-dark asymmetry:\n` +
          (onlyInDark.length ? `  only in dark: ${onlyInDark.join(", ")}\n` : "") +
          (onlyInVscode.length ? `  only in vscode-dark: ${onlyInVscode.join(", ")}\n` : ""),
      )
    }
  })
})

describe("theme-architecture Step 0 — structural tokens are not in theme blocks", () => {
  // These tokens are theme-independent physical constants. They MUST
  // live in tokens/design-language.css :root, not in any theme block.
  const STRUCTURAL_TOKENS = [
    "--font",
    "--mono",
    "--ui-font-display",
    "--ui-font-heading",
    "--ui-font-title",
    "--ui-font-body",
    "--ui-font-control",
    "--ui-font-meta",
    "--ui-font-small",
    "--ui-font-tiny",
    "--ui-font-code",
    "--ui-titlebar-height",
    "--ui-panel-header-height",
    "--ui-panel-padding-x",
    "--ui-panel-padding-y",
    "--ui-rail-width",
    "--ui-rail-min-width",
    "--ui-sidebar-width",
    "--ui-chat-priority-width",
    "--ui-chat-min-width",
    "--ui-capsule-height",
    "--ui-resizer-width",
  ]

  for (const token of STRUCTURAL_TOKENS) {
    test(`${token} declared only in tokens/design-language.css`, () => {
      const re = new RegExp(`${token.replace(/-/g, "\\-")}\\s*:`)
      expect(re.test(DARK)).toBe(false)
      expect(re.test(LIGHT)).toBe(false)
      expect(re.test(VSCODE_DARK)).toBe(false)
    })
  }

  test("tokens/design-language.css :root holds the structural tokens", () => {
    const designLang = readFileSync(join(STYLES_ROOT, "tokens", "design-language.css"), "utf8").replace(
      /\/\*[\s\S]*?\*\//g,
      "",
    )
    for (const token of STRUCTURAL_TOKENS) {
      const re = new RegExp(`${token.replace(/-/g, "\\-")}\\s*:`)
      expect(re.test(designLang)).toBe(true)
    }
  })
})
