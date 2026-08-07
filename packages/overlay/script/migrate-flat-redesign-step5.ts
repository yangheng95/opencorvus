/**
 * One-shot migration for flat-redesign Step 5 (flat redesign migration contract).
 * Rewrites every literal `font-weight:` callsite under
 * `packages/overlay/src/styles/**\/*.css` to use the 3-token weight scale:
 *   --ui-font-weight-body (400)
 *   --ui-font-weight-medium (500)
 *   --ui-font-weight-strong (600)
 *
 * Mapping:
 *   400         → body
 *   500         → medium
 *   600/620/650/680                  → strong
 *   700/720/760/780 / "bold"         → strong (down-tier heavy weights)
 *
 * Skips `tokens/design-language.css` (it OWNS the literal token values).
 * Skips `var(--ui-font-weight-*)` callsites (already migrated).
 *
 * Run once via:
 *   bun run packages/overlay/script/migrate-flat-redesign-step5.ts
 * Diff is the audit; commit the diff with the script.
 */

import { readdir, readFile, writeFile } from "node:fs/promises"
import { join, relative } from "node:path"

const STYLES_ROOT = "packages/overlay/src/styles"
const TOKEN_FILE = "packages/overlay/src/styles/tokens/design-language.css"

async function listCss(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await listCss(full)))
    else if (entry.name.endsWith(".css")) out.push(full)
  }
  return out
}

const BODY = "var(--ui-font-weight-body)"
const MEDIUM = "var(--ui-font-weight-medium)"
const STRONG = "var(--ui-font-weight-strong)"

function mapValue(raw: string): string {
  const v = raw.trim()
  if (v === BODY || v === MEDIUM || v === STRONG) return v
  if (v === "inherit" || v === "normal") return v
  if (v === "bold") return STRONG
  const n = Number(v)
  if (!Number.isFinite(n)) return raw
  if (n <= 400) return BODY
  if (n <= 500) return MEDIUM
  return STRONG
}

async function migrate() {
  const files = await listCss(STYLES_ROOT)
  let totalChanged = 0
  let totalCallsites = 0
  const unhandled: string[] = []

  for (const file of files) {
    const norm = file.split(/[\\/]/).join("/")
    if (norm.endsWith("tokens/design-language.css")) continue
    const original = await readFile(file, "utf8")
    const changed = original.replace(/font-weight:\s*([^;\n]+);/g, (match, value: string) => {
      totalCallsites++
      const trimmed = value.trim()
      // Already a token consumer; leave alone.
      if (trimmed.startsWith("var(--ui-font-weight-")) return match
      const mapped = mapValue(trimmed)
      if (mapped === trimmed) {
        unhandled.push(`${relative(".", file)}: ${trimmed}`)
        return match
      }
      return `font-weight: ${mapped};`
    })

    if (changed !== original) {
      totalChanged++
      await writeFile(file, changed, "utf8")
      console.log(`  rewrote ${relative(".", file)}`)
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
