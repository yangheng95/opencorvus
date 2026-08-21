#!/usr/bin/env bun

import { ExpertSquadRegistry } from "../src/expert-squad/registry"
import { EMBEDDED_EXPERT_SQUAD_IDS } from "../src/expert-squad/builtin/ids"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createOpenCorvusTemporaryDirectory, removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"
import { canonicalExpertSquadPackageFileBytes } from "./expert-squad-package-file-bytes"

interface PayloadPackageInput {
  namespace: string
  id: string
  root: string
  files: string[]
}

export function resolveExpertSquadAuthoringRoot(repoRoot: string): string {
  return path.join(repoRoot, ExpertSquadRegistry.DIRECTORY)
}

export function resolveExpertSquadPayloadModulePath(repoRoot: string): string {
  return path.join(repoRoot, "packages", "opencorvus", "generated", "expert-squad-payload.ts")
}

function comparePath(a: string, b: string): number {
  return a.localeCompare(b)
}

function trackedAuthoringPaths(repoRoot: string): string[] {
  const result = Bun.spawnSync({
    cmd: ["git", "ls-files", "--cached", "-z", "--", ExpertSquadRegistry.DIRECTORY],
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
  })
  const stderr = new TextDecoder().decode(result.stderr).trim()
  if (result.exitCode !== 0) {
    throw new Error(`Expert squad payload generation could not read the Git index: ${stderr || "git ls-files failed"}`)
  }
  if (stderr) throw new Error(`Expert squad payload generation received Git index diagnostics: ${stderr}`)

  const prefix = `${ExpertSquadRegistry.DIRECTORY}/`
  return new TextDecoder()
    .decode(result.stdout)
    .split("\0")
    .filter(Boolean)
    .map((entry) => {
      const normalized = entry.replaceAll("\\", "/")
      if (!normalized.startsWith(prefix)) {
        throw new Error(`Expert squad payload generation received out-of-root tracked path: ${entry}`)
      }
      return normalized.slice(prefix.length)
    })
    .sort(comparePath)
}

export function payloadFileExpression(bytes: Uint8Array): string {
  const canonical = canonicalExpertSquadPackageFileBytes(bytes)
  if (canonical.encoding === "utf8") return JSON.stringify(canonical.bytes.toString("utf8"))
  return JSON.stringify({ encoding: "base64", content: canonical.bytes.toString("base64") })
}

export async function discoverExpertSquadPayloadPackages(repoRoot: string): Promise<PayloadPackageInput[]> {
  const sourceRoot = resolveExpertSquadAuthoringRoot(repoRoot)
  const grouped = new Map<string, { namespace: string; id: string; root: string; files: string[] }>()
  const packages: PayloadPackageInput[] = []
  const seen = new Set<string>()
  const embeddedIDs = new Set<string>(EMBEDDED_EXPERT_SQUAD_IDS)

  for (const trackedPath of trackedAuthoringPaths(repoRoot)) {
    const segments = trackedPath.split("/")
    // A file sitting directly in the authoring root is repository tooling that
    // happens to live beside the packages — `tsconfig.json` for the behavior
    // tests — not a package file with a malformed path. Refusing it turned
    // tracking one such file into a generation failure. Anything deeper still
    // has to name a package, because there a short path is a real mistake.
    if (segments.length === 1 && segments[0]) continue
    if (segments.length < 3 || segments.some((segment) => !segment)) {
      throw new Error(`Expert squad payload generation tracked path must match <namespace>/<id>/<file>: ${trackedPath}`)
    }
    const [namespace, id, ...fileSegments] = segments as [string, string, ...string[]]
    if (embeddedIDs.has(id)) continue
    for (const directory of [namespace, id, ...fileSegments.slice(0, -1)]) {
      if (ExpertSquadRegistry.isRuntimeInternalEntry(directory, true)) {
        throw new Error(`Expert squad payload generation rejects tracked runtime directory: ${trackedPath}`)
      }
    }
    const filename = fileSegments.at(-1)!
    if (ExpertSquadRegistry.isRuntimeInternalEntry(filename, false)) {
      throw new Error(`Expert squad payload generation rejects tracked runtime file: ${trackedPath}`)
    }

    let absolute = sourceRoot
    for (const [index, segment] of segments.entries()) {
      absolute = path.join(absolute, segment)
      const status = await fs.promises.lstat(absolute).catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") {
          throw new Error(`Expert squad payload generation tracked path is missing: ${absolute}`)
        }
        throw error
      })
      if (status.isSymbolicLink()) {
        throw new Error(`Expert squad payload generation rejects tracked symbolic link: ${absolute}`)
      }
      const isFile = index === segments.length - 1
      if (isFile ? !status.isFile() : !status.isDirectory()) {
        throw new Error(
          `Expert squad payload generation tracked path is not a ${isFile ? "file" : "directory"}: ${absolute}`,
        )
      }
    }

    const key = `${namespace}/${id}`
    const group = grouped.get(key) ?? {
      namespace,
      id,
      root: path.join(sourceRoot, namespace, id),
      files: [],
    }
    group.files.push(fileSegments.join("/"))
    grouped.set(key, group)
  }

  const validationRoot = await createOpenCorvusTemporaryDirectory("payload-validation-")
  try {
    for (const group of [...grouped.values()].sort((a, b) => a.id.localeCompare(b.id))) {
      group.files.sort(comparePath)
      if (!group.files.includes(ExpertSquadRegistry.MANIFEST)) {
        throw new Error(
          `Expert squad payload generation found tracked package without ${ExpertSquadRegistry.MANIFEST}: ${group.root}`,
        )
      }

      const validationPackageRoot = path.join(validationRoot, group.namespace, group.id)
      for (const relativePath of group.files) {
        const source = path.join(group.root, ...relativePath.split("/"))
        const destination = path.join(validationPackageRoot, ...relativePath.split("/"))
        await fs.promises.mkdir(path.dirname(destination), { recursive: true })
        await fs.promises.copyFile(source, destination)
      }
      const loaded = await ExpertSquadRegistry.loadPackage(validationPackageRoot)
      if (seen.has(loaded.id)) throw new Error(`Expert squad payload generation found duplicate id: ${loaded.id}`)
      seen.add(loaded.id)
      packages.push({
        namespace: loaded.namespace,
        id: loaded.id,
        root: group.root,
        files: group.files,
      })
    }
  } finally {
    await removeManagedDirectoryTree(validationRoot)
  }

  return packages.sort((a, b) => a.id.localeCompare(b.id))
}

export async function renderExpertSquadPayloadModule(repoRoot: string): Promise<string> {
  const packages = await discoverExpertSquadPayloadPackages(repoRoot)
  const blocks: string[] = []

  for (const pkg of packages) {
    const payloadExpressions = new Map<string, string>()
    for (const relativePath of pkg.files) {
      const sourcePath = path.join(pkg.root, ...relativePath.split("/"))
      payloadExpressions.set(relativePath, payloadFileExpression(await fs.promises.readFile(sourcePath)))
    }

    if (!payloadExpressions.has(ExpertSquadRegistry.MANIFEST)) {
      throw new Error(`Expert squad payload generation lost manifest for ${pkg.id}`)
    }
    blocks.push(
      [
        "  {",
        `    namespace: ${JSON.stringify(pkg.namespace)},`,
        `    id: ${JSON.stringify(pkg.id)},`,
        "    files: {",
        ...pkg.files.map((relativePath) => {
          const expression = payloadExpressions.get(relativePath)
          if (!expression) throw new Error(`Expert squad payload generation lost file ${pkg.id}/${relativePath}`)
          return `      ${JSON.stringify(relativePath)}: ${expression},`
        }),
        "    },",
        "  },",
      ].join("\n"),
    )
  }

  return [
    "// Auto-generated by packages/opencorvus/script/generate-expert-squad-payload.ts. Do not edit.",
    'import type { ExpertSquadRegistry } from "../src/expert-squad/registry"',
    "",
    "export const payloadPackageSources: readonly ExpertSquadRegistry.EmbeddedPackageSource[] = [",
    ...blocks,
    "]",
    "",
  ].join("\n")
}

export async function generateExpertSquadPayloadModule(repoRoot: string): Promise<string> {
  const modulePath = resolveExpertSquadPayloadModulePath(repoRoot)
  const content = await renderExpertSquadPayloadModule(repoRoot)
  const current = await fs.promises.readFile(modulePath, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined
    throw error
  })
  if (current !== content) await fs.promises.writeFile(modulePath, content)
  return modulePath
}

async function main(): Promise<void> {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")
  const modulePath = await generateExpertSquadPayloadModule(repoRoot)
  console.log(`Generated ${path.relative(repoRoot, modulePath).replaceAll(path.sep, "/")}`)
}

if (import.meta.main) {
  await main()
}
