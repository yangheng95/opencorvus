/**
 * One-shot migration for flat-redesign Step 1 (flat redesign migration contract).
 * Rewrites every `border-radius:` callsite under packages/overlay/src/styles/**\/*.css
 * to use the new 4-token radius scale: --oc-radius-{none,soft,large,pill}.
 *
 * Run once via `bun run packages/overlay/script/migrate-flat-redesign-step1.ts`.
 * Diff is the audit; commit the diff with the script.
 *
 * Mapping (see plan.md §2.1 + §八 v2):
 *   - hardcoded N px (N ≤ 9) → --oc-radius-soft
 *   - hardcoded N px (N ≥ 10) → --oc-radius-large
 *   - 999px / calc(999px*scale) → --oc-radius-pill
 *   - var(--oc-radius-control|card) → --oc-radius-soft
 *   - var(--oc-radius-panel) → 0
 *   - var(--radius) → --oc-radius-soft
 *   - var(--radius-lg) → --oc-radius-large
 *   - var(--panel-radius) → --oc-radius-large
 *   - var(--card-radius) → --oc-radius-soft
 *   - var(--section-corner) → --oc-radius-soft
 *   - var(--oc-button-radius) → --oc-radius-soft
 *   - var(--oc-titlebar-status-radius) → --oc-radius-soft
 *   - calc(var(--radius)*0.5|0.6|0.7) / calc(var(--radius)/2) → --oc-radius-soft
 *   - 0, 50%, inherit → unchanged (whitelist)
 */

import { readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

const STYLES_ROOT = "packages/overlay/src/styles"

async function listCss(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await listCss(full)))
    else if (entry.name.endsWith(".css")) out.push(full)
  }
  return out
}

const NONE = "var(--oc-radius-none)"
const SOFT = "var(--oc-radius-soft)"
const LARGE = "var(--oc-radius-large)"
const PILL = "var(--oc-radius-pill)"

/** Rewrite a single CSS value (the right-hand side of `border-radius: X;`). */
function mapValue(raw: string): string {
  const v = raw.trim()

  // Whitelist passthroughs.
  if (v === "0") return "0"
  if (v === "50%") return "50%"
  if (v === "inherit") return "inherit"
  if (v === PILL) return PILL
  if (v === NONE) return NONE
  if (v === SOFT) return SOFT
  if (v === LARGE) return LARGE

  // Pill literals.
  if (v === "999px") return PILL
  if (/^calc\(\s*999px\s*\*\s*var\(--ui-scale[^)]*\)\s*\)$/.test(v)) return PILL

  // Old token mappings.
  if (v === "var(--oc-radius-pill)") return PILL
  if (v === "var(--oc-radius-control)") return SOFT
  if (v === "var(--oc-radius-card)") return SOFT
  if (v === "var(--oc-radius-panel)") return "0"
  if (v === "var(--radius)") return SOFT
  if (v === "var(--radius-lg)") return LARGE
  if (v === "var(--panel-radius)") return LARGE
  if (v === "var(--card-radius)") return SOFT
  if (v === "var(--section-corner)") return SOFT
  if (v === "var(--oc-button-radius)") return SOFT
  if (v === "var(--oc-titlebar-status-radius)") return SOFT

  // calc(var(--radius)*0.5|0.6|0.7) / calc(var(--radius)/2) → soft
  if (/^calc\(\s*var\(--radius\)\s*[*\/]\s*[0-9.]+\s*\)$/.test(v)) return SOFT

  // Hardcoded calc(Npx * var(--ui-scale[, 1])) — split N≤9 → soft, N≥10 → large.
  const calcMatch = v.match(/^calc\(\s*([0-9]+)px\s*\*\s*var\(--ui-scale[^)]*\)\s*\)$/)
  if (calcMatch) {
    const px = Number(calcMatch[1])
    if (px <= 9) return SOFT
    return LARGE
  }

  // Special: composer drag-over uses `* var(--chat-compose-scale)` extra factor.
  // calc(20px * var(--ui-scale) * var(--chat-compose-scale)) — drop scale, large.
  if (/^calc\(\s*[0-9]+px\s*\*\s*var\(--ui-scale[^)]*\)\s*\*\s*var\([^)]+\)\s*\)$/.test(v)) {
    return LARGE
  }

  // Multi-value shorthand: split on whitespace, recurse. Used for shapes like
  // `0 var(--oc-radius-control) var(--oc-radius-control) 0`.
  if (v.includes(" ") && !v.startsWith("calc(")) {
    const parts: string[] = []
    let depth = 0
    let cur = ""
    for (const ch of v) {
      if (ch === "(") depth++
      if (ch === ")") depth--
      if (ch === " " && depth === 0) {
        if (cur.length > 0) parts.push(cur)
        cur = ""
      } else {
        cur += ch
      }
    }
    if (cur.length > 0) parts.push(cur)
    if (parts.length >= 2) {
      return parts.map(mapValue).join(" ")
    }
  }

  // Bare hardcoded `Npx` (no calc / no scale).
  const bareMatch = v.match(/^([0-9]+)px$/)
  if (bareMatch) {
    const px = Number(bareMatch[1])
    if (px === 0) return "0"
    if (px <= 9) return SOFT
    return LARGE
  }

  // Unhandled — leave as-is and report.
  return raw
}

async function migrate() {
  const files = await listCss(STYLES_ROOT)
  let totalChanged = 0
  let totalCallsites = 0
  const unhandled: string[] = []

  for (const file of files) {
    const original = await readFile(file, "utf8")
    let changed = original

    // Skip the design-language.css token declarations — those are the source.
    // We only rewrite consumer callsites (`border-radius: X;`).
    changed = changed.replace(/border-radius:\s*([^;]+);/g, (match, value: string) => {
      totalCallsites++
      const mapped = mapValue(value)
      if (mapped === value.trim()) return match
      if (mapped === value) {
        unhandled.push(`${file}: ${value.trim()}`)
        return match
      }
      return `border-radius: ${mapped};`
    })

    if (changed !== original) {
      totalChanged++
      await writeFile(file, changed, "utf8")
      console.log(`  rewrote ${file}`)
    }
  }

  console.log(`\nFiles changed: ${totalChanged}`)
  console.log(`Callsites scanned: ${totalCallsites}`)
  if (unhandled.length > 0) {
    console.error(`\nUnhandled values (manual review required, ${unhandled.length}):`)
    for (const u of unhandled) console.error(`  ${u}`)
    process.exit(1)
  }
}

await migrate()
