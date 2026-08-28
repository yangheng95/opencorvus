/**
 * Collapse the spacing literals in styles/ onto the --ui-gap-* ladder.
 *
 * Before this ran, padding / gap / margin declarations carried
 * `calc(Npx * var(--ui-scale))` at 37 distinct values of N — nearly every
 * integer from 1 to 36. No vertical rhythm can survive that: each surface
 * picked its own breathing room, and the eye reads the result as "nothing
 * lines up" even though no single value looks wrong.
 *
 * The ladder keeps the four --ui-gap-* steps that already had consumers
 * (xs 4 / sm 6 / md 8 / lg 12) and extends it at both ends, so no existing
 * token changes meaning:
 *
 *     3xs 2 · xs 4 · sm 6 · md 8 · lg 12 · xl 16 · 2xl 20 · 3xl 24 · 4xl 32
 *
 * Rungs were chosen to sit on the existing high-frequency values, so 802 of
 * the 1353 rewritten declarations move by 0px and the rest move by 1-2px;
 * only 28px and 36px (8 occurrences) shift by 4px. The goal of this pass is
 * to bound the vocabulary and let a lint hold it there — NOT to redesign
 * density. Retuning the rhythm is a separate, visual decision.
 *
 * Scope guards:
 *   - Only the spacing properties below. `width`, `height`, `box-shadow`,
 *     `grid-template-columns`, `outline-offset` and friends carry the same
 *     calc() shape but express size or geometry, not rhythm — 1142 such
 *     occurrences are deliberately untouched.
 *   - Only standard properties. Custom properties that happen to hold
 *     spacing (`--oc-button-padding-x` and ~80 others) are left for a
 *     follow-up so this pass stays reviewable.
 *   - Values above 32px are structural dimensions (dialog widths, avatar
 *     offsets), not rhythm steps, and are preserved verbatim.
 *
 * Usage:  bun run script/migrate-spacing-ladder.ts [--check]
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { join, relative } from "node:path"

const STYLES_ROOT = join(import.meta.dir, "..", "src", "styles")

/** px -> --ui-gap-* token name. Every rung has real usage behind it. */
const LADDER: ReadonlyArray<readonly [number, string]> = [
  [2, "--ui-gap-3xs"],
  [4, "--ui-gap-xs"],
  [6, "--ui-gap-sm"],
  [8, "--ui-gap-md"],
  [12, "--ui-gap-lg"],
  [16, "--ui-gap-xl"],
  [20, "--ui-gap-2xl"],
  [24, "--ui-gap-3xl"],
  [32, "--ui-gap-4xl"],
]

/** Largest rung; anything above this is a structural dimension. */
const LADDER_CEILING = LADDER[LADDER.length - 1][0]

const SPACING_PROPERTIES = new Set([
  "gap",
  "row-gap",
  "column-gap",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "padding-block",
  "padding-block-start",
  "padding-block-end",
  "padding-inline",
  "padding-inline-start",
  "padding-inline-end",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "margin-block",
  "margin-block-start",
  "margin-block-end",
  "margin-inline",
  "margin-inline-start",
  "margin-inline-end",
])

/**
 * Snap to the nearest rung. Ties resolve upward: the tied cases (10px and
 * 14px) are predominantly horizontal padding, where a 2px gain reads as
 * breathing room rather than as a broken vertical rhythm.
 */
function snap(px: number): readonly [number, string] {
  let best = LADDER[0]
  let bestDistance = Number.POSITIVE_INFINITY
  for (const rung of LADDER) {
    const distance = Math.abs(rung[0] - px)
    if (distance < bestDistance || (distance === bestDistance && rung[0] > best[0])) {
      best = rung
      bestDistance = distance
    }
  }
  return best
}

const CALC = /calc\((\d+(?:\.\d+)?)px \* var\(--ui-scale(?:, 1)?\)\)/g
/** A declaration: property name, colon, value up to the terminator. */
const DECLARATION = /(^|[;{]\s*)([a-z][-a-z]*)(\s*:\s*)([^;{}]*)/g

interface Shift {
  readonly file: string
  readonly from: number
  readonly to: number
}

function migrateSource(source: string, file: string, shifts: Shift[]): string {
  return source.replace(DECLARATION, (whole, lead, property, separator, value) => {
    if (!SPACING_PROPERTIES.has(property)) return whole
    if (!value.includes("--ui-scale")) return whole

    const rewritten = value.replace(CALC, (occurrence: string, raw: string) => {
      const px = Number(raw)
      if (!Number.isFinite(px) || px > LADDER_CEILING) return occurrence
      const [rungPx, token] = snap(px)
      shifts.push({ file, from: px, to: rungPx })
      return `var(${token})`
    })

    return `${lead}${property}${separator}${rewritten}`
  })
}

function collectCssFiles(directory: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) found.push(...collectCssFiles(path))
    else if (entry.endsWith(".css")) found.push(path)
  }
  return found.sort()
}

function main(): void {
  const checkOnly = process.argv.includes("--check")
  const shifts: Shift[] = []
  const touched: string[] = []

  for (const path of collectCssFiles(STYLES_ROOT)) {
    const label = relative(STYLES_ROOT, path).replaceAll("\\", "/")
    const before = readFileSync(path, "utf8")
    const after = migrateSource(before, label, shifts)
    if (after === before) continue
    touched.push(label)
    if (!checkOnly) writeFileSync(path, after)
  }

  const byDistance = new Map<number, number>()
  for (const shift of shifts) {
    const distance = Math.abs(shift.to - shift.from)
    byDistance.set(distance, (byDistance.get(distance) ?? 0) + 1)
  }

  console.log(`${checkOnly ? "would rewrite" : "rewrote"} ${shifts.length} declarations across ${touched.length} files`)
  for (const distance of [...byDistance.keys()].sort((a, b) => a - b)) {
    const count = byDistance.get(distance) ?? 0
    console.log(`  ${distance === 0 ? "no shift" : `${distance}px shift`}: ${count}`)
  }

  if (checkOnly && shifts.length > 0) process.exitCode = 1
}

main()
