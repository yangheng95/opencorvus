#!/usr/bin/env bun
/**
 * Wipes every typecheck-related cache layer that has been observed to go stale:
 *   - turbo task cache (`.turbo/` at repo root and per-package)
 *   - bun internal caches (`node_modules/.cache/` at repo root and per-package)
 *   - tsgo incremental info (`*.tsbuildinfo` anywhere)
 *
 * Empirically, drizzle's `$inferSelect` types fall out of sync after schema
 * column additions until these layers are cleared — `bun run typecheck:fresh`
 * is the recovery one-liner that wires this script into a clean re-typecheck.
 */
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

async function rm(p: string) {
  await fs.rm(p, { recursive: true, force: true }).catch(() => undefined)
}

async function listPackages(): Promise<string[]> {
  const dir = path.join(repoRoot, "packages")
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
  const pkgs: string[] = []
  for (const e of entries) {
    if (!e.isDirectory()) continue
    const full = path.join(dir, e.name)
    pkgs.push(full)
    // One level of nesting (e.g. packages/sdk/js) is enough for current layout.
    const nested = await fs.readdir(full, { withFileTypes: true }).catch(() => [])
    for (const n of nested) {
      if (!n.isDirectory()) continue
      const candidate = path.join(full, n.name)
      const hasPkgJson = await fs
        .stat(path.join(candidate, "package.json"))
        .then(() => true)
        .catch(() => false)
      if (hasPkgJson) pkgs.push(candidate)
    }
  }
  return pkgs
}

async function findTsBuildInfo(): Promise<string[]> {
  const found: string[] = []
  async function walk(dir: string, depth: number) {
    if (depth > 6) return
    const base = path.basename(dir)
    if (base === "node_modules" || base === ".git" || base === "dist" || base === "dist-vite") return
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) {
        await walk(full, depth + 1)
      } else if (e.name.endsWith(".tsbuildinfo")) {
        found.push(full)
      }
    }
  }
  await walk(repoRoot, 0)
  return found
}

const targets: string[] = [path.join(repoRoot, ".turbo"), path.join(repoRoot, "node_modules", ".cache")]

for (const pkg of await listPackages()) {
  targets.push(path.join(pkg, ".turbo"))
  targets.push(path.join(pkg, "node_modules", ".cache"))
}

for (const f of await findTsBuildInfo()) targets.push(f)

let removed = 0
for (const t of targets) {
  const existed = await fs
    .stat(t)
    .then(() => true)
    .catch(() => false)
  if (!existed) continue
  await rm(t)
  removed += 1
  console.log(`✓ ${path.relative(repoRoot, t)}`)
}
console.log(`\n${removed} cache path(s) cleared.`)
