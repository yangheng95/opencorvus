import { expect, test } from "bun:test"
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

/**
 * Guards the design-language invariants that stylesheet comments claim are
 * enforced but no longer were: the comments in cascade/dark.css,
 * cascade/vscode-dark.css and tokens/design-language.css each cite a
 * `flat-redesign-*.test.ts` that has since been deleted. Every invariant below
 * still held when this file was written, so nothing here is a new rule — this
 * restores the enforcement the comments already promise, and adds the same
 * cover for the spacing and line-height ladders introduced on 2026-08-24,
 * whose whole point is that the literals do not creep back.
 */

const OVERLAY_ROOT = path.resolve(import.meta.dir, "..")
const STYLES_ROOT = path.join(OVERLAY_ROOT, "src", "styles")

function collectCssFiles(directory: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(directory)) {
    const entryPath = path.join(directory, entry)
    if (statSync(entryPath).isDirectory()) found.push(...collectCssFiles(entryPath))
    else if (entry.endsWith(".css")) found.push(entryPath)
  }
  return found.sort()
}

function label(filePath: string): string {
  return path.relative(STYLES_ROOT, filePath).replaceAll("\\", "/")
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split("\n").length
}

/** The body of the first rule matching `selector`, brace-balanced. */
function ruleBody(source: string, selector: string): string {
  const start = source.indexOf(selector)
  if (start < 0) throw new Error(`selector not found: ${selector}`)
  let cursor = source.indexOf("{", start) + 1
  let depth = 1
  const out: string[] = []
  for (; cursor < source.length; cursor += 1) {
    const ch = source[cursor]
    if (ch === "{") depth += 1
    else if (ch === "}") {
      depth -= 1
      if (depth === 0) break
    }
    out.push(ch)
  }
  return out.join("")
}

function declaredTokens(body: string): Set<string> {
  return new Set([...body.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((match) => match[1]))
}

// ── 1. Palette symmetry ──────────────────────────────────────────────
// Three theme files must declare the same palette token set. A token added to
// one and not the others falls through to whatever :root happens to hold,
// which is how the conversation cards once rendered dark surfaces on the light
// theme.

test("the three theme palettes declare the same token set", () => {
  const themes = {
    light: ':root[data-theme="light"]',
    dark: ':root[data-theme="dark"]',
    "vscode-dark": ':root[data-theme="vscode-dark"]',
  }
  const sets = Object.entries(themes).map(([name, selector]) => {
    const file = path.join(STYLES_ROOT, "cascade", `${name}.css`)
    return [name, declaredTokens(ruleBody(readFileSync(file, "utf8"), selector))] as const
  })

  const union = new Set(sets.flatMap(([, tokens]) => [...tokens]))
  const gaps: string[] = []
  for (const token of [...union].sort()) {
    const missing = sets.filter(([, tokens]) => !tokens.has(token)).map(([name]) => name)
    if (missing.length > 0) gaps.push(`${token} missing from ${missing.join(", ")}`)
  }

  expect(gaps).toEqual([])
})

// ── 2. Motion scale ──────────────────────────────────────────────────

test("transition and animation durations come from the motion scale", () => {
  const designLanguage = readFileSync(path.join(STYLES_ROOT, "tokens", "design-language.css"), "utf8")
  const scale = new Set(
    [...designLanguage.matchAll(/--ui-duration-[a-z-]+:\s*([0-9.]+m?s)/g)].map((match) => match[1]),
  )
  expect(scale.size).toBeGreaterThan(0)

  // Chrome only stops repainting an autofilled field's background once the
  // background-color transition finishes, so a transition long enough never to
  // complete is the standard way to keep the field's own surface. It is a
  // sentinel, not a duration anyone perceives.
  const AUTOFILL_SENTINEL = "9999s"

  const offenders: string[] = []
  for (const file of collectCssFiles(STYLES_ROOT)) {
    const source = readFileSync(file, "utf8")
    for (const declaration of source.matchAll(/(?:transition|animation)(?:-duration)?\s*:\s*([^;]+);/g)) {
      for (const literal of declaration[1].matchAll(/(?<![\w-])(\d*\.?\d+m?s)(?![\w-])/g)) {
        if (scale.has(literal[1]) || literal[1] === AUTOFILL_SENTINEL) continue
        offenders.push(`${label(file)}:${lineOf(source, declaration.index)}: ${literal[1]}`)
      }
    }
  }

  expect(offenders).toEqual([])
})

test("no animation duration tracks the UI scale", () => {
  // Zoom changes how large things are, never how long they take. One animation
  // used to multiply its duration by --ui-scale and ran 60% slower at 1.6x.
  const offenders: string[] = []
  for (const file of collectCssFiles(STYLES_ROOT)) {
    const source = readFileSync(file, "utf8")
    for (const match of source.matchAll(
      /(?:transition|animation)[^;]*calc\([0-9.]+m?s\s*\*\s*var\(--ui-scale[^)]*\)\)/g,
    )) {
      offenders.push(`${label(file)}:${lineOf(source, match.index)}`)
    }
  }
  expect(offenders).toEqual([])
})

// ── 3. Spacing ladder ────────────────────────────────────────────────

const SPACING_PROPERTIES = new Set([
  "gap",
  "row-gap",
  "column-gap",
  ...["padding", "margin"].flatMap((side) => [
    side,
    `${side}-top`,
    `${side}-right`,
    `${side}-bottom`,
    `${side}-left`,
    `${side}-block`,
    `${side}-block-start`,
    `${side}-block-end`,
    `${side}-inline`,
    `${side}-inline-start`,
    `${side}-inline-end`,
  ]),
])

/** Sizes above the top rung are structural dimensions, not rhythm steps. */
const LADDER_CEILING_PX = 32

test("padding, gap and margin take their values from the spacing ladder", () => {
  const offenders: string[] = []
  for (const file of collectCssFiles(STYLES_ROOT)) {
    const source = readFileSync(file, "utf8")
    for (const declaration of source.matchAll(/(?:^|[;{])\s*([a-z][-a-z]*)\s*:\s*([^;{}]*)/g)) {
      const [, property, value] = declaration
      if (!SPACING_PROPERTIES.has(property)) continue
      for (const literal of value.matchAll(/calc\((\d+(?:\.\d+)?)px \* var\(--ui-scale(?:, 1)?\)\)/g)) {
        if (Number(literal[1]) > LADDER_CEILING_PX) continue
        offenders.push(`${label(file)}:${lineOf(source, declaration.index)}: ${property} ${literal[1]}px`)
      }
    }
  }
  expect(offenders).toEqual([])
})

// ── 4. Line-height ladder ────────────────────────────────────────────

test("line-height takes its values from the ladder", () => {
  const designLanguage = readFileSync(path.join(STYLES_ROOT, "tokens", "design-language.css"), "utf8")
  const rungs = new Set(
    [...designLanguage.matchAll(/--ui-line-height-[a-z]+:\s*([0-9.]+)\s*;/g)].map((match) => match[1]),
  )
  expect(rungs.size).toBeGreaterThan(0)

  const offenders: string[] = []
  for (const file of collectCssFiles(STYLES_ROOT)) {
    const source = readFileSync(file, "utf8")
    for (const declaration of source.matchAll(/(?:^|[;{])\s*line-height\s*:\s*([0-9.]+)\s*(?=[;}])/g)) {
      const value = declaration[1]
      // `line-height: 0` is a layout reset, not leading. Values carrying a
      // unit never reach this pattern; those are deliberate metric overrides.
      if (value === "0" || rungs.has(value)) continue
      offenders.push(`${label(file)}:${lineOf(source, declaration.index)}: ${value}`)
    }
  }
  expect(offenders).toEqual([])
})

// ── 5. vscode-dark passthrough ───────────────────────────────────────

test("the vscode-dark palette resolves without host tokens", () => {
  // The theme approximates VS Code from the overlay's own palette; reaching for
  // --vscode-* would only resolve inside a real VS Code webview and leave the
  // desktop window unstyled.
  const source = readFileSync(path.join(STYLES_ROOT, "cascade", "vscode-dark.css"), "utf8")
  const hostTokens = [...source.matchAll(/var\((--vscode-[a-z-]+)/g)].map((match) => match[1])
  expect(hostTokens).toEqual([])
})
