#!/usr/bin/env bun
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

/**
 * Workspace package dependencies must form a directed acyclic graph, and the
 * SDK build's source slicing must not point back at a package that depends on
 * the SDK.
 *
 * `transport-protocol` depended on `@opencorvus-ai/sdk` for one shared schema
 * while the SDK's build read and sliced the Transport Protocol's private
 * TypeScript source to generate route policy. Neither edge is visible to a
 * package manager as a cycle, so clean build order depended on incidental
 * workspace state. Both halves are checked here.
 */
const packagesRoot = path.resolve(import.meta.dir, "..", "..", "..")

type Manifest = { name?: string; dependencies?: Record<string, string> }

async function workspaceManifests(): Promise<Map<string, Manifest>> {
  const manifests = new Map<string, Manifest>()
  const entries = await readdir(packagesRoot, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    for (const candidate of [
      path.join(packagesRoot, entry.name, "package.json"),
      path.join(packagesRoot, entry.name, "js", "package.json"),
    ]) {
      const raw = await readFile(candidate, "utf8").catch(() => undefined)
      if (raw === undefined) continue
      const manifest = JSON.parse(raw) as Manifest
      if (manifest.name) manifests.set(manifest.name, manifest)
    }
  }
  return manifests
}

/** Every workspace cycle reachable from `start`, as a name path. */
function findCycle(
  start: string,
  edges: Map<string, string[]>,
  seen: Set<string>,
  stack: string[],
): string[] | undefined {
  if (stack.includes(start)) return [...stack.slice(stack.indexOf(start)), start]
  if (seen.has(start)) return undefined
  seen.add(start)
  for (const next of edges.get(start) ?? []) {
    const cycle = findCycle(next, edges, seen, [...stack, start])
    if (cycle) return cycle
  }
  return undefined
}

async function main() {
  const manifests = await workspaceManifests()
  const edges = new Map<string, string[]>()
  for (const [name, manifest] of manifests) {
    edges.set(
      name,
      Object.entries(manifest.dependencies ?? {})
        .filter(([dependency, spec]) => manifests.has(dependency) && spec.startsWith("workspace:"))
        .map(([dependency]) => dependency),
    )
  }

  const failures: string[] = []
  const seen = new Set<string>()
  for (const name of edges.keys()) {
    const cycle = findCycle(name, edges, seen, [])
    if (cycle) failures.push(`workspace dependency cycle: ${cycle.join(" -> ")}`)
  }

  // The SDK build slices another package's private source; that package must
  // not depend on the SDK, or the generation order is a cycle in disguise.
  const sdkBuild = await readFile(path.join(packagesRoot, "sdk", "js", "script", "build.ts"), "utf8").catch(
    () => undefined,
  )
  if (sdkBuild) {
    for (const match of sdkBuild.matchAll(/packages\/([a-z0-9-]+)\/src\//g)) {
      const sliced = `@opencorvus-ai/${match[1]!}`
      const dependencies = Object.keys(manifests.get(sliced)?.dependencies ?? {})
      if (dependencies.includes("@opencorvus-ai/sdk")) {
        failures.push(`SDK build slices ${sliced}, which depends on @opencorvus-ai/sdk — a generation-order cycle`)
      }
    }
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error(`package-topology: ${failure}`)
    console.error(`package-topology FAILED (${failures.length} problem${failures.length === 1 ? "" : "s"})`)
    process.exit(1)
  }
  console.log(`package-topology ok — ${manifests.size} workspace packages, no dependency or generation cycle`)
}

await main()
