/**
 * One-shot migration for flat-redesign Step 8a (flat redesign migration contract §八 v4).
 * Rewrites every `transition:` / `z-index:` / `opacity:` callsite under
 * `packages/overlay/src/styles/**\/*.css` to use the new token sets:
 *   - --ui-duration-{fast,base,slow} + --ui-timing-standard
 *   - --ui-z-{below,base,decoration,raised,sticky,overlay,titlebar,dialog,toast}
 *   - --ui-opacity-{hidden,faint,disabled,dim,subtle,full}
 *
 * Also retires `--oc-disabled-opacity` (rename to `--ui-opacity-disabled`,
 * single callsite at btn.css:91).
 *
 * Run once via `bun run packages/overlay/script/migrate-flat-redesign-step8a.ts`.
 * Diff is the audit; commit the diff with the script.
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

// ────── Duration mapping ──────
function durationToken(ms: number): string {
  if (ms <= 100) return "var(--ui-duration-fast)"
  if (ms <= 150) return "var(--ui-duration-base)"
  return "var(--ui-duration-slow)"
}

/** Rewrite duration literals inside a transition value.
 * Handles: `120ms`, `0.12s`, `200ms`, `0.2s`, `0.15s`. */
function rewriteDurations(value: string): string {
  return value
    .replace(/\b(\d+)ms\b/g, (_, n) => durationToken(Number(n)))
    .replace(/\b0?\.(\d+)s\b/g, (_, n) => durationToken(Number(`0.${n}`) * 1000))
}

/** Rewrite the timing keyword `ease` (only when standalone, not inside `var()`).
 * `ease-in` / `ease-out` / `ease-in-out` are NOT touched — they're rare and
 * carry distinct semantics. */
function rewriteTimingKeyword(value: string): string {
  // Replace bare `ease` not preceded by `-` and not followed by `-`.
  return value.replace(/(^|[\s,])ease(?=$|[\s,;])/g, "$1var(--ui-timing-standard)")
}

// ────── z-index mapping ──────
function zIndexToken(n: number): string {
  if (n === -1) return "var(--ui-z-below)"
  if (n === 0) return "var(--ui-z-base)"
  if (n === 1) return "var(--ui-z-decoration)"
  if (n === 2) return "var(--ui-z-raised)"
  if (n >= 5 && n <= 24) return "var(--ui-z-sticky)"
  if (n >= 100 && n <= 200) return "var(--ui-z-overlay)"
  if (n >= 9000 && n <= 9999) return "var(--ui-z-titlebar)"
  if (n >= 10000 && n <= 10999) return "var(--ui-z-dialog)"
  if (n >= 12000) return "var(--ui-z-toast)"
  throw new Error(`unmapped z-index value: ${n}`)
}

// ────── opacity mapping ──────
function opacityToken(v: number): string {
  if (v === 0) return "var(--ui-opacity-hidden)"
  if (v === 1) return "var(--ui-opacity-full)"
  if (v < 0.5) return "var(--ui-opacity-faint)"
  if (v < 0.65) return "var(--ui-opacity-disabled)"
  if (v < 0.78) return "var(--ui-opacity-dim)"
  if (v < 0.95) return "var(--ui-opacity-subtle)"
  return "var(--ui-opacity-full)"
}

// ────── Per-line rewriter ──────
function rewriteLine(line: string): string {
  // 1. transition: <value>;
  //    Match the whole declaration including a single-line value. Multi-
  //    line transition values (one property per line) are handled
  //    separately below by walking the file as a whole.
  let out = line

  // Replace the legacy var name first, then handle literal transitions.
  out = out.replace(/var\(--oc-disabled-opacity\)/g, "var(--ui-opacity-disabled)")

  // transition: ... — replace duration + timing inside the value.
  out = out.replace(/(\btransition(?:-duration|-timing-function)?\s*:\s*)([^;]*?)(;|$)/g, (_, head, value, tail) => {
    const rewritten = rewriteTimingKeyword(rewriteDurations(value))
    return `${head}${rewritten}${tail}`
  })

  // z-index: <int>;
  out = out.replace(/(\bz-index\s*:\s*)(-?\d+)(\s*;)/g, (m, head, num, tail) => {
    const n = Number(num)
    try {
      return `${head}${zIndexToken(n)}${tail}`
    } catch {
      return m
    }
  })

  // opacity: <number>;  (rejects `var(--*)` already-tokenised values)
  out = out.replace(/(\bopacity\s*:\s*)(-?\d*\.?\d+)(\s*;)/g, (_, head, num, tail) => {
    const v = Number(num)
    return `${head}${opacityToken(v)}${tail}`
  })

  return out
}

// ────── Multi-line transition value rewriter ──────
/** Some `transition:` declarations span multiple lines (one property
 * per line). Per-line rewriter doesn't catch them because the regex
 * requires a `;` on the same line. Walk the file, pair up `transition:`
 * with its terminating `;`, rewrite the whole span. */
function rewriteMultilineTransitions(text: string): string {
  const out: string[] = []
  let i = 0
  while (i < text.length) {
    const match = /transition(?:-duration|-timing-function)?\s*:/.exec(text.slice(i))
    if (!match) {
      out.push(text.slice(i))
      break
    }
    const headStart = i + match.index
    out.push(text.slice(i, headStart))
    // Find the next ; that closes this declaration.
    const semi = text.indexOf(";", headStart)
    if (semi < 0) {
      out.push(text.slice(headStart))
      break
    }
    const decl = text.slice(headStart, semi + 1)
    const rewritten = decl.replace(/^([a-z-]+\s*:\s*)([\s\S]*?)(;)$/, (_m, head, value, tail) => {
      const rewrittenValue = rewriteTimingKeyword(rewriteDurations(value))
      return `${head}${rewrittenValue}${tail}`
    })
    out.push(rewritten)
    i = semi + 1
  }
  return out.join("")
}

async function main() {
  const files = await listCss(STYLES_ROOT)
  let changed = 0
  for (const file of files) {
    // Skip the token source itself — its declarations define the new
    // tokens, the values it lists are literals by design.
    if (file.endsWith("design-language.css")) continue

    const before = await readFile(file, "utf8")
    let after = before

    // Apply per-line rewrites first (handles single-line transitions +
    // z-index + opacity + var rename).
    after = after
      .split(/(?<=\n)/)
      .map(rewriteLine)
      .join("")

    // Then handle multi-line transitions left over.
    after = rewriteMultilineTransitions(after)

    if (after !== before) {
      await writeFile(file, after, "utf8")
      changed++
      console.log(`  rewrote ${file}`)
    }
  }
  console.log(`\nStep 8a migration done. ${changed} files changed.`)
}

await main()
