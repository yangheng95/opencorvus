import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

/**
 * Scale discipline for the public site's CSS.
 *
 * The reference design's sense of pace comes from one thing: every section, card, and control pads
 * from the same thirteen-rung ladder. Nothing else produces that. As soon as a few `padding: 18px`
 * values creep in, every later pixel adjustment is guesswork against neighbours that no longer
 * agree, so this is a gate rather than a review note. See docs/website-restyle-plan.md §9.
 *
 * Scope: spacing and radius only. Font sizes, line heights, border widths, and icon dimensions are
 * deliberately literal — a type scale is not a spacing scale, and forcing them through tokens would
 * add indirection without adding consistency.
 */

const root = fileURLToPath(new URL("..", import.meta.url))

/** Properties that must draw from the ladder. */
const SPACING_PROPERTIES = [
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "padding-block",
  "padding-inline",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "margin-block",
  "margin-inline",
  "gap",
  "row-gap",
  "column-gap",
]

const RADIUS_PROPERTIES = ["border-radius"]

/**
 * Literals that are correct as written, each with the reason it is not a ladder value. Anything not
 * listed here has to use a token — that is the point of the gate.
 */
const ALLOWED_LITERALS = new Map([
  ["0", "zero needs no scale"],
  ["auto", "not a length"],
  ["inherit", "not a length"],
  ["initial", "not a length"],
  ["revert", "not a length"],
  ["unset", "not a length"],
  ["50%", "a circle, not a spacing decision"],
  ["1px", "hairline nudges for optical alignment of 1px borders"],
  ["2px", "hairline nudges for optical alignment of 1px borders"],
  ["3px", "focus ring and segmented-control inset, both tied to a 1px border"],
  ["4px", "equals --oc-space-1; kept legible where it reads as an optical nudge"],
  ["96px", "fixed-header clearance for scroll-margin and sticky offsets"],
])

type Finding = { file: string; line: number; property: string; value: string }

/** Collect the CSS text of a file: whole file for .css, every <style> block for .astro. */
function cssOf(file: string): string {
  const source = readFileSync(file, "utf8")
  if (file.endsWith(".css")) return source
  return [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((match) => match[1]).join("\n")
}

function scan(file: string): Finding[] {
  // Comments first: prose about spacing is not a declaration.
  const css = cssOf(file).replace(/\/\*[\s\S]*?\*\//g, "")
  const findings: Finding[] = []
  const properties = [...SPACING_PROPERTIES, ...RADIUS_PROPERTIES]

  css.split("\n").forEach((line, index) => {
    const match = line.match(/^\s*([a-z-]+)\s*:\s*([^;{}]+);/)
    if (!match) return
    const [, property, rawValue] = match
    if (!properties.includes(property)) return

    // Shorthands carry several lengths; each is judged on its own.
    for (const token of rawValue.trim().split(/\s+/)) {
      if (token.startsWith("var(--oc-")) continue
      // calc() and min()/max()/clamp() are fine as long as a ladder value is doing the work.
      if (/^(calc|min|max|clamp)\(/.test(token) && rawValue.includes("var(--oc-")) continue
      if (ALLOWED_LITERALS.has(token)) continue
      if (/^-?\d*\.?\d+(px|rem|em)$/.test(token) || /^\d+%$/.test(token)) {
        findings.push({ file: path.relative(root, file), line: index + 1, property, value: token })
      }
    }
  })

  return findings
}

/** Files the public site owns. The Starlight docs theme is out of scope. */
function publicStyleFiles(): string[] {
  const styles = path.join(root, "src", "styles")
  const components = path.join(root, "src", "components")

  const styleFiles = readdirSync(styles)
    .filter((name) => name.endsWith(".css") && name !== "custom.css")
    .map((name) => path.join(styles, name))

  // The restyled surfaces. EnterpriseArchitectureExplorer is excluded on purpose: it carries its own
  // visualization language and was never brought onto the ladder (plan §4.2).
  const componentFiles = readdirSync(components)
    .filter(
      (name) =>
        name.endsWith(".astro") &&
        (name.startsWith("Oc") ||
          name === "MarketplacePage.astro" ||
          name === "SquadDetailPage.astro" ||
          name === "WorkflowTopology.astro"),
    )
    .map((name) => path.join(components, name))

  return [...styleFiles, ...componentFiles]
}

describe("scale discipline", () => {
  const files = publicStyleFiles()

  test("the scan covers the files it is supposed to", () => {
    const names = files.map((file) => path.basename(file))
    expect(names).toContain("tokens.css")
    expect(names).toContain("primitives.css")
    expect(names).toContain("OcLanding.astro")
    expect(names).toContain("MarketplacePage.astro")
    expect(names).toContain("SquadDetailPage.astro")
    expect(names.length).toBeGreaterThanOrEqual(8)
  })

  test("spacing and radius come from the token ladder", () => {
    const findings = files.flatMap(scan)
    const report = findings.map((f) => `${f.file}:${f.line} ${f.property}: ${f.value}`)
    expect(report).toEqual([])
  })

  test("every allowlist entry carries a reason", () => {
    for (const [literal, reason] of ALLOWED_LITERALS) {
      expect(reason.length, `${literal} needs a reason`).toBeGreaterThan(10)
    }
  })
})

describe("degradation guards", () => {
  // These cannot be checked in a browser here (see plan §11), but their presence in the source is
  // exactly what makes the fallback exist, so assert the source.
  const primitives = readFileSync(path.join(root, "src", "styles", "primitives.css"), "utf8")
  const tokens = readFileSync(path.join(root, "src", "styles", "tokens.css"), "utf8")

  test("backdrop-filter always ships its -webkit- prefix", () => {
    const plain = (primitives.match(/(?<!-webkit-)backdrop-filter:/g) ?? []).length
    const prefixed = (primitives.match(/-webkit-backdrop-filter:/g) ?? []).length
    // Safari shipped the prefixed form for years before the standard one; a missing prefix silently
    // drops the glass on older WebKit rather than erroring.
    expect(prefixed).toBe(plain)
  })

  test("mask-composite ships both incompatible spellings", () => {
    expect(primitives).toContain("-webkit-mask-composite: source-in, xor")
    expect(primitives).toContain("mask-composite: intersect")
    expect(primitives).toContain("-webkit-mask-composite: xor")
    expect(primitives).toContain("mask-composite: exclude")
  })

  test("the animated conic border is gated behind @supports", () => {
    // Safari below 16.4 has no @property, so the sweep would freeze at 0deg. The whole effect has to
    // sit inside the guard, not just the animation.
    const guardIndex = primitives.indexOf("@supports (background: conic-gradient(from var(--oc-border-angle)")
    expect(guardIndex).toBeGreaterThan(-1)
    expect(primitives.indexOf(".oc-cta-block::before")).toBeGreaterThan(guardIndex)
  })

  test("motion has a reduced-motion escape", () => {
    expect(primitives).toContain("@media (prefers-reduced-motion: reduce)")
    for (const animated of [".oc-enter", ".oc-caret", ".oc-reveal", ".oc-cta-block::before"]) {
      const block = primitives.slice(primitives.indexOf("@media (prefers-reduced-motion: reduce)"))
      expect(block).toContain(animated)
    }
  })

  test("dark theme is declared for both the toggle and the system preference", () => {
    expect(tokens).toContain(':root[data-theme="dark"]')
    expect(tokens).toContain("@media (prefers-color-scheme: dark)")
    expect(tokens).toContain(':root:not([data-theme="light"])')
  })
})
