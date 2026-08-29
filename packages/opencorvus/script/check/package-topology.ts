#!/usr/bin/env bun
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

/**
 * Workspace package dependencies must form a directed acyclic graph, the
 * SDK build's source slicing must not point back at a package that depends on
 * the SDK, and Bun's lockfile inputs must equal the package manifests that own
 * them.
 *
 * `transport-protocol` once depended on `@opencorvus-ai/sdk` for one shared
 * schema while the SDK's build read and sliced the Transport Protocol's
 * private TypeScript source to generate route policy. The manifest edge was
 * later moved to `@opencorvus-ai/util`, but `bun.lock` retained the old edge.
 * Manifest-only topology checks passed while every clean release install
 * failed with a frozen-lockfile error, so the canonical manifest-to-lock input
 * boundary belongs to this checker too.
 */
const repositoryRoot = path.resolve(import.meta.dir, "..", "..", "..", "..")

type DependencyMap = Record<string, string>
type Manifest = {
  name?: string
  version?: string
  bin?: string | Record<string, string>
  dependencies?: DependencyMap
  devDependencies?: DependencyMap
  optionalDependencies?: DependencyMap
  peerDependencies?: DependencyMap
}

type RootManifest = Manifest & {
  workspaces?: { catalog?: DependencyMap }
  overrides?: DependencyMap
  patchedDependencies?: DependencyMap
  trustedDependencies?: string[]
}

type BunLock = {
  workspaces?: Record<string, Manifest>
  catalog?: DependencyMap
  overrides?: DependencyMap
  patchedDependencies?: DependencyMap
  trustedDependencies?: string[]
  packages?: Record<string, unknown>
}

type WorkspaceState = {
  byName: Map<string, Manifest>
  byPath: Map<string, Manifest>
}

export type PackageTopologyInspection = {
  workspaceCount: number
  dependencyCycles: string[]
  generationOrderProblems: string[]
  lockfileInputDrift: string[]
}

const lockWorkspaceFields = [
  "name",
  "version",
  "bin",
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
] as const

async function workspaceManifests(root: string): Promise<WorkspaceState> {
  const byName = new Map<string, Manifest>()
  const byPath = new Map<string, Manifest>()
  const rootManifest = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as Manifest
  byPath.set("", rootManifest)

  const rootPackages = path.join(root, "packages")
  const entries = await readdir(rootPackages, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    for (const relative of [path.posix.join("packages", entry.name), path.posix.join("packages", entry.name, "js")]) {
      const candidate = path.join(root, ...relative.split("/"), "package.json")
      const raw = await readFile(candidate, "utf8").catch(() => undefined)
      if (raw === undefined) continue
      const manifest = JSON.parse(raw) as Manifest
      byPath.set(relative, manifest)
      if (manifest.name) byName.set(manifest.name, manifest)
    }
  }
  return { byName, byPath }
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

function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item
    return Object.fromEntries(
      Object.entries(item as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)),
    )
  })
}

function projectWorkspaceInput(manifest: Manifest): Manifest {
  return Object.fromEntries(
    lockWorkspaceFields.flatMap((field) => (manifest[field] === undefined ? [] : [[field, manifest[field]]])),
  ) as Manifest
}

function compareInput(label: string, expected: unknown, actual: unknown, drift: string[]) {
  if (canonical(expected) === canonical(actual)) return
  drift.push(`${label}: manifest=${canonical(expected)} lock=${canonical(actual)}`)
}

export function inspectBunLockInputs(input: {
  rootManifest: RootManifest
  workspaceManifests: Map<string, Manifest>
  lock: BunLock
}): string[] {
  const drift: string[] = []
  const lockedWorkspaces = input.lock.workspaces ?? {}
  const allWorkspacePaths = new Set([...input.workspaceManifests.keys(), ...Object.keys(lockedWorkspaces)])

  for (const workspacePath of [...allWorkspacePaths].sort()) {
    const manifest = input.workspaceManifests.get(workspacePath)
    const locked = lockedWorkspaces[workspacePath]
    if (!manifest) {
      drift.push(`workspaces.${workspacePath || "<root>"}: lock workspace has no canonical package.json`)
      continue
    }
    if (!locked) {
      drift.push(`workspaces.${workspacePath || "<root>"}: canonical package.json is missing from bun.lock`)
      continue
    }
    compareInput(`workspaces.${workspacePath || "<root>"}`, projectWorkspaceInput(manifest), locked, drift)
  }

  compareInput("catalog", input.rootManifest.workspaces?.catalog ?? {}, input.lock.catalog ?? {}, drift)
  compareInput("overrides", input.rootManifest.overrides ?? {}, input.lock.overrides ?? {}, drift)
  compareInput(
    "patchedDependencies",
    input.rootManifest.patchedDependencies ?? {},
    input.lock.patchedDependencies ?? {},
    drift,
  )

  const lockedPackageNames = new Set(Object.keys(input.lock.packages ?? {}))
  const effectiveTrustedDependencies = (input.rootManifest.trustedDependencies ?? [])
    .filter((dependency) => lockedPackageNames.has(dependency))
    .sort()
  compareInput(
    "trustedDependencies",
    effectiveTrustedDependencies,
    [...(input.lock.trustedDependencies ?? [])].sort(),
    drift,
  )
  return drift
}

export async function inspectPackageTopology(root = repositoryRoot): Promise<PackageTopologyInspection> {
  const manifests = await workspaceManifests(root)
  const edges = new Map<string, string[]>()
  for (const [name, manifest] of manifests.byName) {
    edges.set(
      name,
      Object.entries(manifest.dependencies ?? {})
        .filter(([dependency, spec]) => manifests.byName.has(dependency) && spec.startsWith("workspace:"))
        .map(([dependency]) => dependency),
    )
  }

  const dependencyCycles: string[] = []
  const seen = new Set<string>()
  for (const name of edges.keys()) {
    const cycle = findCycle(name, edges, seen, [])
    if (cycle) dependencyCycles.push(cycle.join(" -> "))
  }

  const generationOrderProblems: string[] = []
  const sdkBuild = await readFile(path.join(root, "packages", "sdk", "js", "script", "build.ts"), "utf8").catch(
    () => undefined,
  )
  if (sdkBuild) {
    for (const match of sdkBuild.matchAll(/packages\/([a-z0-9-]+)\/src\//g)) {
      const sliced = `@opencorvus-ai/${match[1]!}`
      const dependencies = Object.keys(manifests.byName.get(sliced)?.dependencies ?? {})
      if (dependencies.includes("@opencorvus-ai/sdk")) {
        generationOrderProblems.push(`SDK build slices ${sliced}, which depends on @opencorvus-ai/sdk`)
      }
    }
  }

  const rootManifest = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as RootManifest
  const lock = Bun.JSONC.parse(await readFile(path.join(root, "bun.lock"), "utf8")) as BunLock
  return {
    workspaceCount: manifests.byName.size,
    dependencyCycles,
    generationOrderProblems,
    lockfileInputDrift: inspectBunLockInputs({ rootManifest, workspaceManifests: manifests.byPath, lock }),
  }
}

async function main() {
  const inspection = await inspectPackageTopology()
  const failures = [
    ...inspection.dependencyCycles.map((cycle) => `workspace dependency cycle: ${cycle}`),
    ...inspection.generationOrderProblems.map((problem) => `${problem} — a generation-order cycle`),
    ...inspection.lockfileInputDrift.map((problem) => `bun.lock input drift: ${problem}`),
  ]
  if (failures.length > 0) {
    for (const failure of failures) console.error(`package-topology: ${failure}`)
    console.error(`package-topology FAILED (${failures.length} problem${failures.length === 1 ? "" : "s"})`)
    process.exit(1)
  }
  console.log(
    `package-topology ok — ${inspection.workspaceCount} workspace packages, no dependency or generation cycle, bun.lock inputs aligned`,
  )
}

if (import.meta.main) await main()
