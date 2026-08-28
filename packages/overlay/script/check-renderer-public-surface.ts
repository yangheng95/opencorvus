#!/usr/bin/env bun
/**
 * The renderer's global object is a public surface.
 *
 * Anything the renderer writes onto `window` / `globalThis` is readable and
 * callable by every script that runs in the same document, including a
 * DevTools expression. That surface once carried the live settings store with
 * the server password in plaintext, plus directory switching, Task loading and
 * settings persistence — production mutators, reachable with no authority
 * check at all. This checker keeps the surface at exactly the set declared
 * here, so it cannot grow back one convenience assignment at a time.
 *
 * The contract is positive: the assignments found in the renderer source must
 * equal `DECLARED_RENDERER_GLOBALS`. Adding a global is a deliberate act that
 * updates this list and states why the value cannot be an ordinary import.
 */

import { Glob } from "bun"
import path from "node:path"

const SOURCE_ROOT = path.resolve(import.meta.dir, "../src")

/**
 * Every global the renderer is allowed to publish, with the reason an import
 * cannot carry it.
 */
const DECLARED_RENDERER_GLOBALS: Record<string, string> = {
  __opencorvusStartupReady:
    "index.html paints a startup surface before the module bundle exists, so the native window is never empty. " +
    "An inline document script and a module bundle share no import graph; this Promise is the handoff that lets " +
    "the renderer take over the host element.",
}

// Matches `window.x =`, `globalThis.x =`, `(window as any).x =`,
// `(globalThis as Window & { x?: T }).x =` and the bracket form of each. The
// cast wrapper matters: every global this repository ever published was written
// through one.
const CAST = String.raw`(?:\s+as\s+[^)=]+)?\s*\)?\s*`
const MEMBER = String.raw`(?:\.([A-Za-z_$][A-Za-z0-9_$]*)|\[\s*["'` + "`" + String.raw`]([^"'` + "`" + String.raw`]+)["'` + "`" + String.raw`]\s*\])`
const ASSIGNMENT = new RegExp(String.raw`(?:window|globalThis)` + CAST + MEMBER + String.raw`\s*=(?!=)`, "g")

type Found = { name: string; file: string; line: number }

async function findAssignments(): Promise<Found[]> {
  const found: Found[] = []
  for (const pattern of ["**/*.ts", "**/*.tsx", "**/*.html"]) {
    for await (const relative of new Glob(pattern).scan({ cwd: SOURCE_ROOT })) {
      const file = path.join(SOURCE_ROOT, relative)
      const lines = (await Bun.file(file).text()).split(/\r?\n/)
      lines.forEach((text, index) => {
        for (const match of text.matchAll(ASSIGNMENT)) {
          const name = match[1] ?? match[2]
          if (!name) continue
          found.push({ name, file: relative.replaceAll("\\", "/"), line: index + 1 })
        }
      })
    }
  }
  return found.sort((left, right) => left.name.localeCompare(right.name) || left.file.localeCompare(right.file))
}

const found = await findAssignments()
const declared = new Set(Object.keys(DECLARED_RENDERER_GLOBALS))
const publishedNames = new Set(found.map((item) => item.name))

const undeclared = found.filter((item) => !declared.has(item.name))
const missing = [...declared].filter((name) => !publishedNames.has(name))

if (undeclared.length > 0 || missing.length > 0) {
  const report: string[] = ["renderer public surface check failed"]
  for (const item of undeclared) {
    report.push(`  undeclared global: ${item.name} (${item.file}:${item.line})`)
  }
  for (const name of missing) {
    report.push(`  declared global is no longer published: ${name}`)
  }
  report.push(
    "  Declared globals must equal published globals. Publish state through module imports; if a value genuinely " +
      "cannot cross an import boundary, declare it in DECLARED_RENDERER_GLOBALS with that reason.",
  )
  console.error(report.join("\n"))
  process.exit(1)
}

console.log(
  `renderer public surface check passed (${found.length} assignment${found.length === 1 ? "" : "s"}, ` +
    `${declared.size} declared global${declared.size === 1 ? "" : "s"})`,
)
