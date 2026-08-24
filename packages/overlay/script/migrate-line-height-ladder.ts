/**
 * Collapse the line-height literals in styles/ onto the
 * --ui-line-height-* ladder.
 *
 * `--ui-line-height-tight` was the only rung that existed for most of the
 * overlay's life, so 217 literals grew up around it at 18 distinct values
 * between 1 and 1.78 — 1.4 and 1.45 alone account for 60. Leading is what
 * sets a reading surface's texture, and 18 uncoordinated values mean no two
 * blocks of text share one.
 *
 * The ladder keeps the three existing rungs at their exact values so no
 * current consumer shifts, and adds the two the literals were clustering
 * around:
 *
 *     flat 1 · snug 1.25 · tight 1.35 · normal 1.5 · relaxed 1.68
 *
 * `flat` is functional rather than typographic — it is the single-line
 * centering used by icons, badges and button labels, where any leading at
 * all would break vertical centering. `snug` covers dense rows and compact
 * headings; folding its 45 occurrences up into `tight` instead would have
 * meant a 12% leading increase on the densest rows in the app.
 *
 * Snapping moves 88 of 216 declarations by 0, and all but 22 of the rest by
 * 0.05 — roughly 0.7px at the 14px body size. As with the spacing ladder,
 * the goal is to bound the vocabulary, not to retune the reading rhythm.
 *
 * Scope guards:
 *   - `line-height: 0` is a layout reset, not leading; preserved verbatim.
 *   - Values carrying a unit (px, em, %) are deliberate metric overrides
 *     and are not touched — only unitless ratios snap.
 *   - The `font:` shorthand's `/ <ratio>` slot is rewritten too, since it
 *     sets the same property.
 *
 * Usage:  bun run script/migrate-line-height-ladder.ts [--check]
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { join, relative } from "node:path"

const STYLES_ROOT = join(import.meta.dir, "..", "src", "styles")

/** ratio -> --ui-line-height-* token name. */
const LADDER: ReadonlyArray<readonly [number, string]> = [
  [1, "--ui-line-height-flat"],
  [1.25, "--ui-line-height-snug"],
  [1.35, "--ui-line-height-tight"],
  [1.5, "--ui-line-height-normal"],
  [1.68, "--ui-line-height-relaxed"],
]

/** `line-height: 0` resets layout; it is not a leading choice. */
const LAYOUT_RESET = 0

/** Ties resolve upward: more leading is the safer direction for reading. */
function snap(ratio: number): readonly [number, string] {
  let best = LADDER[0]
  let bestDistance = Number.POSITIVE_INFINITY
  for (const rung of LADDER) {
    const distance = Math.abs(rung[0] - ratio)
    if (distance < bestDistance - 1e-9 || (Math.abs(distance - bestDistance) < 1e-9 && rung[0] > best[0])) {
      best = rung
      bestDistance = distance
    }
  }
  return best
}

/** `line-height: 1.45;` — unitless only, so px/em overrides survive. */
const DECLARATION = /(^|[;{]\s*)(line-height\s*:\s*)(\d*\.?\d+)(\s*)(?=[;}])/g
/** The `/ <ratio>` slot of the `font:` shorthand. */
const FONT_SHORTHAND = /(font\s*:[^;{}]*?\/\s*)(\d*\.?\d+)/g

interface Shift {
  readonly from: number
  readonly to: number
}

function migrateSource(source: string, shifts: Shift[]): string {
  const rewrite = (raw: string): string | null => {
    const ratio = Number(raw)
    if (!Number.isFinite(ratio) || ratio === LAYOUT_RESET) return null
    const [rungRatio, token] = snap(ratio)
    shifts.push({ from: ratio, to: rungRatio })
    return `var(${token})`
  }

  return source
    .replace(DECLARATION, (whole, lead, property, raw, trail) => {
      const replacement = rewrite(raw)
      return replacement === null ? whole : `${lead}${property}${replacement}${trail}`
    })
    .replace(FONT_SHORTHAND, (whole, lead, raw) => {
      const replacement = rewrite(raw)
      return replacement === null ? whole : `${lead}${replacement}`
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
    const before = readFileSync(path, "utf8")
    const after = migrateSource(before, shifts)
    if (after === before) continue
    touched.push(relative(STYLES_ROOT, path).replaceAll("\\", "/"))
    if (!checkOnly) writeFileSync(path, after)
  }

  const byDistance = new Map<string, number>()
  for (const shift of shifts) {
    const key = Math.abs(shift.to - shift.from).toFixed(2)
    byDistance.set(key, (byDistance.get(key) ?? 0) + 1)
  }

  console.log(`${checkOnly ? "would rewrite" : "rewrote"} ${shifts.length} declarations across ${touched.length} files`)
  for (const key of [...byDistance.keys()].sort()) {
    const count = byDistance.get(key) ?? 0
    console.log(`  ${key === "0.00" ? "no shift" : `${key} shift`}: ${count}`)
  }

  if (checkOnly && shifts.length > 0) process.exitCode = 1
}

main()
