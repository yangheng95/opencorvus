import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

/**
 * Design token parity.
 *
 * A colour token that exists in only one theme is invisible in the other, and nobody notices
 * until a screenshot lands in a bug report. The reference design we calibrate against has exactly
 * this defect: it leaves `--ds-color-text-link-blue` (#234792) un-themed, which measures 2.25:1
 * against its own dark page background. These tests exist so we do not inherit that class of bug.
 *
 * See docs/website-restyle-plan.md §6.
 */

/** Comments are stripped first so prose that mentions a selector cannot be mistaken for one. */
const tokensCss = readFileSync(
  fileURLToPath(new URL("../src/styles/tokens.css", import.meta.url)),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "")

/**
 * Tokens that are theme-independent by design: they sit on a fixed-colour substrate (the shader
 * hero, an always-dark panel) so following the theme would be the bug. Every entry needs a reason
 * here, otherwise "it's intentional" becomes the excuse that swallows real misses.
 */
const STATIC_BY_DESIGN = new Map([
  ["--oc-color-static-white", "literal white; the name is the contract"],
  ["--oc-color-static-black", "literal near-black; the name is the contract"],
  ["--oc-color-static-black-secondary", "literal ink at 60%; used over fixed-colour media"],
  ["--oc-color-text-inverse", "always the opposite of ink, used on --oc-color-bg-contrast"],
  ["--oc-btn-ghost-static-bg", "ghost-static variant sits on the shader, not on the page"],
  ["--oc-btn-ghost-static-text", "ghost-static variant sits on the shader, not on the page"],
  ["--oc-btn-ghost-static-border", "ghost-static variant sits on the shader, not on the page"],
  ["--oc-btn-ghost-static-hover-bg", "ghost-static variant sits on the shader, not on the page"],
  ["--oc-btn-ghost-static-hover-border", "ghost-static variant sits on the shader, not on the page"],
])

/** Extract the declaration body for a selector, matching braces so @media nesting is safe. */
function ruleBody(css: string, selector: string): string {
  const start = css.indexOf(selector)
  if (start < 0) throw new Error(`selector not found in tokens.css: ${selector}`)
  const open = css.indexOf("{", start + selector.length)
  if (open < 0) throw new Error(`no opening brace for selector: ${selector}`)
  let depth = 0
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === "{") depth += 1
    else if (css[index] === "}") {
      depth -= 1
      if (depth === 0) return css.slice(open + 1, index)
    }
  }
  throw new Error(`unbalanced braces for selector: ${selector}`)
}

function declarations(body: string): Map<string, string> {
  const found = new Map<string, string>()
  for (const [, name, value] of body.matchAll(/(--oc-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    found.set(name, value.trim().replace(/\s+/g, " "))
  }
  return found
}

/** The base `:root` block. It is first in the file, so a plain scan lands on it. */
const base = declarations(ruleBody(tokensCss, ":root"))
const explicitDark = declarations(ruleBody(tokensCss, ':root[data-theme="dark"]'))
const systemDark = declarations(ruleBody(tokensCss, ':root:not([data-theme="light"])'))

const isThemeable = (name: string) => name.startsWith("--oc-color-") || name.startsWith("--oc-btn-")

describe("token parity", () => {
  test("the base block defines every themeable token", () => {
    expect(base.size).toBeGreaterThan(0)
    const themeable = [...base.keys()].filter(isThemeable)
    expect(themeable.length).toBeGreaterThan(40)
  })

  test("every themeable base token is re-declared in the explicit dark block", () => {
    const missing = [...base.keys()]
      .filter(isThemeable)
      .filter((name) => !STATIC_BY_DESIGN.has(name))
      .filter((name) => !explicitDark.has(name))
    expect(missing).toEqual([])
  })

  test("no token is dark-only", () => {
    const orphans = [...explicitDark.keys()].filter((name) => !base.has(name))
    expect(orphans).toEqual([])
  })

  test("the two dark blocks declare identical values", () => {
    // The toggle block and the prefers-color-scheme block must not drift. Drift here means the
    // toggle and the OS preference render different sites.
    const drift: string[] = []
    for (const [name, value] of explicitDark) {
      const other = systemDark.get(name)
      if (other !== value) drift.push(`${name}: toggle=${value} system=${other ?? "<missing>"}`)
    }
    for (const name of systemDark.keys()) {
      if (!explicitDark.has(name)) drift.push(`${name}: missing from the toggle block`)
    }
    expect(drift).toEqual([])
  })

  test("static-by-design tokens are not themed", () => {
    const themed = [...STATIC_BY_DESIGN.keys()].filter((name) => explicitDark.has(name))
    expect(themed).toEqual([])
  })

  test("the static allowlist has no stale entries", () => {
    const stale = [...STATIC_BY_DESIGN.keys()].filter((name) => !base.has(name))
    expect(stale).toEqual([])
  })
})

describe("scale discipline", () => {
  test("the spacing scale is the aligned 13-step ladder", () => {
    const expected = [4, 8, 12, 16, 24, 32, 40, 56, 80, 120, 160, 200, 240]
    const actual = expected.map((_, index) => base.get(`--oc-space-${index + 1}`))
    expect(actual).toEqual(expected.map((value) => `${value}px`))
  })

  test("the radius scale is complete", () => {
    for (const [name, value] of [
      ["pill", "100px"],
      ["card", "24px"],
      ["panel", "16px"],
      ["media", "10px"],
      ["input", "10px"],
      ["sm", "8px"],
    ]) {
      expect(base.get(`--oc-radius-${name}`)).toBe(value)
    }
  })

  test("no CJK webfont is declared in the family stacks", () => {
    // Chinese falls through to system fonts on purpose; a CJK woff2 costs megabytes.
    // See docs/website-restyle-plan.md §2.2.
    for (const name of ["--oc-font-body", "--oc-font-display", "--oc-font-mono"]) {
      const stack = base.get(name) ?? ""
      expect(stack).not.toMatch(/Noto Sans SC.*\.woff|source-han|SourceHan/i)
    }
  })
})

describe("contrast red lines", () => {
  /** WCAG 2.x relative luminance for an opaque sRGB triple. */
  function luminance([r, g, b]: [number, number, number]): number {
    const channel = (raw: number) => {
      const srgb = raw / 255
      return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  }

  function ratio(a: [number, number, number], b: [number, number, number]): number {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (high + 0.05) / (low + 0.05)
  }

  /** Flatten an `rgba`/`hsla` white-or-ink alpha over an opaque background. */
  function over(
    fg: [number, number, number],
    alpha: number,
    bg: [number, number, number],
  ): [number, number, number] {
    return [0, 1, 2].map((index) => fg[index] * alpha + bg[index] * (1 - alpha)) as [
      number,
      number,
      number,
    ]
  }

  const LIGHT_PAGE: [number, number, number] = [249, 248, 248]
  const DARK_PAGE: [number, number, number] = [10, 10, 10]
  const WHITE: [number, number, number] = [255, 255, 255]
  const INK: [number, number, number] = [0, 0, 0]

  test("light body text clears AA", () => {
    expect(ratio(over(INK, 0.65, LIGHT_PAGE), LIGHT_PAGE)).toBeGreaterThanOrEqual(4.5)
  })

  test("dark body text clears AA", () => {
    expect(ratio(over(WHITE, 0.5, DARK_PAGE), DARK_PAGE)).toBeGreaterThanOrEqual(4.5)
  })

  test("placeholder text clears AA in both themes", () => {
    // Both of these are raised above the reference values, which fail (3.0:1 and 2.6:1).
    expect(ratio([98, 109, 126], LIGHT_PAGE)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(over(WHITE, 0.48, DARK_PAGE), DARK_PAGE)).toBeGreaterThanOrEqual(4.5)
  })

  test("brand and link colours clear AA in both themes", () => {
    expect(ratio([41, 70, 211], LIGHT_PAGE)).toBeGreaterThanOrEqual(4.5)
    expect(ratio([111, 141, 250], DARK_PAGE)).toBeGreaterThanOrEqual(4.5)
    expect(ratio([28, 58, 158], LIGHT_PAGE)).toBeGreaterThanOrEqual(4.5)
    expect(ratio([157, 180, 255], DARK_PAGE)).toBeGreaterThanOrEqual(4.5)
  })
})
