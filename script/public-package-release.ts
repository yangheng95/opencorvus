#!/usr/bin/env bun
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { buildPublishPackageJson, stagePluginPackage } from "../packages/plugin/script/publish-package"
import { NodeProcess } from "../packages/util/src/process-node"

const workspaceRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)))
const releaseOrder = [
  { name: "@opencorvus-ai/util", directory: "packages/util", staging: "built" },
  { name: "@opencorvus-ai/sdk", directory: "packages/sdk/js", staging: "built" },
  { name: "@opencorvus-ai/plugin", directory: "packages/plugin", staging: "plugin" },
] as const
const releaseNames = new Set<string>(releaseOrder.map((entry) => entry.name))

type PreparedPackage = Readonly<{
  name: string
  version: string
  archive: string
  manifest: Record<string, unknown>
}>

async function run(executable: string, args: string[], cwd = workspaceRoot): Promise<void> {
  const result = await NodeProcess.run({
    command: { executable, args },
    cwd,
    nothrow: true,
    timeoutMs: 180_000,
    maxOutputBytes: 8 * 1024 * 1024,
  })
  if (result.receipt.exitCode === 0) return
  const decoder = new TextDecoder()
  throw new Error(
    `${executable} ${args.join(" ")} failed with code ${result.receipt.exitCode}\n${decoder.decode(result.stderr)}\n${decoder.decode(result.stdout)}`,
  )
}

let npmRuntime: { executable: string; prefix: string[] } | undefined
async function runNpm(args: string[], cwd = workspaceRoot): Promise<void> {
  if (!npmRuntime) {
    if (process.platform !== "win32") npmRuntime = { executable: "npm", prefix: [] }
    else {
      const located = await NodeProcess.run({
        command: { executable: "where.exe", args: ["npm.cmd"] },
        nothrow: true,
        timeoutMs: 10_000,
      })
      const npmCommand = new TextDecoder()
        .decode(located.stdout)
        .split(/\r?\n/)
        .map((value) => value.trim())
        .find(Boolean)
      if (located.receipt.exitCode !== 0 || !npmCommand) throw new Error("npm.cmd is unavailable")
      const node = path.join(path.dirname(npmCommand), "node.exe")
      const cli = path.join(path.dirname(npmCommand), "node_modules", "npm", "bin", "npm-cli.js")
      await Promise.all([fs.access(node), fs.access(cli)])
      npmRuntime = { executable: node, prefix: [cli] }
    }
  }
  await run(npmRuntime.executable, [...npmRuntime.prefix, ...args], cwd)
}

async function dependencyVersions() {
  const rootManifest = JSON.parse(await fs.readFile(path.join(workspaceRoot, "package.json"), "utf8")) as {
    workspaces?: { catalog?: Record<string, string> }
  }
  const workspace: Record<string, string> = {}
  for (const entry of releaseOrder) {
    const manifest = JSON.parse(
      await fs.readFile(path.join(workspaceRoot, entry.directory, "package.json"), "utf8"),
    ) as { name: string; version: string }
    workspace[manifest.name] = manifest.version
  }
  return { catalog: rootManifest.workspaces?.catalog ?? {}, workspace }
}

function assertPublishManifest(
  manifest: Record<string, unknown>,
  expectedName: string,
): asserts manifest is Record<string, unknown> & { name: string; version: string } {
  if (manifest.name !== expectedName || typeof manifest.version !== "string") {
    throw new Error(`Published package identity does not match ${expectedName}`)
  }
  const serialized = JSON.stringify(manifest)
  if (/"(?:workspace|catalog):/.test(serialized)) {
    throw new Error(`${expectedName} packed manifest retains a workspace or catalog dependency protocol`)
  }
  const exports = manifest.exports
  if (!exports || typeof exports !== "object" || Array.isArray(exports)) {
    throw new Error(`${expectedName} packed manifest has no public export map`)
  }
}

async function stageBuiltPackage(input: {
  sourceDirectory: string
  stagingDirectory: string
  versions: Awaited<ReturnType<typeof dependencyVersions>>
}): Promise<Record<string, unknown>> {
  await run(process.execPath, ["run", "build"], input.sourceDirectory)
  const sourceManifest = JSON.parse(await fs.readFile(path.join(input.sourceDirectory, "package.json"), "utf8"))
  const manifest = buildPublishPackageJson(sourceManifest, input.versions) as Record<string, unknown>
  await fs.mkdir(input.stagingDirectory, { recursive: true })
  await fs.cp(path.join(input.sourceDirectory, "dist"), path.join(input.stagingDirectory, "dist"), {
    recursive: true,
  })
  if (process.platform === "win32" && sourceManifest.name === "@opencorvus-ai/util") {
    const nativeManifest = path.join(workspaceRoot, "packages/opencorvus/native/process-supervisor/Cargo.toml")
    await run("cargo", ["build", "--release", "--locked", "--manifest-path", nativeManifest])
    const helper = path.join(
      workspaceRoot,
      "packages/opencorvus/native/process-supervisor/target/release/opencorvus-process-supervisor.exe",
    )
    await fs.access(helper)
    await fs.copyFile(helper, path.join(input.stagingDirectory, "dist", "opencorvus-process-supervisor.exe"))
  }
  await fs.writeFile(path.join(input.stagingDirectory, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}

async function packStagedPackage(
  stagingDirectory: string,
  archiveDirectory: string,
  manifest: Record<string, unknown>,
): Promise<PreparedPackage> {
  assertPublishManifest(manifest, String(manifest.name))
  const filename = `${manifest.name.replace(/^@/, "").replaceAll("/", "-")}-${manifest.version}.tgz`
  const archive = path.join(archiveDirectory, filename)
  await run(process.execPath, ["pm", "pack", "--ignore-scripts", "--filename", archive], stagingDirectory)
  const unpacked = path.join(archiveDirectory, `${filename}.unpacked`)
  await fs.mkdir(unpacked, { recursive: true })
  await run("tar", ["-xf", archive, "-C", unpacked])
  const packedManifest = JSON.parse(
    await fs.readFile(path.join(unpacked, "package", "package.json"), "utf8"),
  ) as Record<string, unknown>
  assertPublishManifest(packedManifest, manifest.name)
  return { name: packedManifest.name, version: packedManifest.version, archive, manifest: packedManifest }
}

export async function preparePublicPackageRelease(temporaryRoot: string): Promise<PreparedPackage[]> {
  const versions = await dependencyVersions()
  const archives = path.join(temporaryRoot, "archives")
  await fs.mkdir(archives, { recursive: true })
  const prepared: PreparedPackage[] = []
  for (const entry of releaseOrder) {
    const sourceDirectory = path.join(workspaceRoot, entry.directory)
    const stagingDirectory = path.join(temporaryRoot, "staged", entry.name.replaceAll("/", "-"))
    const manifest =
      entry.staging === "plugin"
        ? (await stagePluginPackage({ sourceDirectory, stagingDirectory, workspaceDirectory: workspaceRoot }))
            .packageJson
        : await stageBuiltPackage({ sourceDirectory, stagingDirectory, versions })
    assertPublishManifest(manifest, entry.name)
    prepared.push(await packStagedPackage(stagingDirectory, archives, manifest))
  }
  const identities = prepared.map((entry) => `${entry.name}@${entry.version}`)
  if (new Set(prepared.map((entry) => entry.version)).size !== 1) {
    throw new Error(`Public package versions must match: ${identities.join(", ")}`)
  }
  return prepared
}

async function resolveInstalledPackage(name: string, dependencyRoots: Iterable<string> = []): Promise<string> {
  const bases = [
    path.join(workspaceRoot, "node_modules"),
    path.join(workspaceRoot, "packages/plugin/node_modules"),
    path.join(workspaceRoot, "packages/util/node_modules"),
  ]
  for (const root of dependencyRoots) {
    let current = root
    for (let depth = 0; depth < 5; depth += 1) {
      if (path.basename(current) === "node_modules") bases.push(current)
      bases.push(path.join(current, "node_modules"))
      current = path.dirname(current)
    }
  }
  for (const base of bases) {
    try {
      return await fs.realpath(path.join(base, ...name.split("/")))
    } catch {}
  }
  throw new Error(`Workspace installation is missing release dependency ${name}`)
}

async function externalDependencyDirectories(prepared: readonly PreparedPackage[]): Promise<Map<string, string>> {
  const directories = new Map<string, string>()
  const pending = prepared.flatMap((entry) =>
    Object.keys((entry.manifest.dependencies ?? {}) as Record<string, string>).filter(
      (name) => !releaseNames.has(name),
    ),
  )
  while (pending.length) {
    const name = pending.shift()!
    if (directories.has(name) || releaseNames.has(name)) continue
    const directory = await resolveInstalledPackage(name, directories.values())
    directories.set(name, directory)
    const manifest = JSON.parse(await fs.readFile(path.join(directory, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>
      optionalDependencies?: Record<string, string>
    }
    pending.push(...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.optionalDependencies ?? {}))
  }
  return directories
}

export async function checkPublicPackageRelease(prepared: readonly PreparedPackage[], temporaryRoot: string) {
  const consumer = path.join(temporaryRoot, "consumer")
  await fs.mkdir(consumer, { recursive: true })
  const dependencies: Record<string, string> = {}
  for (const [name, directory] of await externalDependencyDirectories(prepared)) {
    dependencies[name] = `file:${directory.replaceAll("\\", "/")}`
  }
  for (const entry of prepared) {
    dependencies[entry.name] = `file:${entry.archive.replaceAll("\\", "/")}`
    await fs.writeFile(
      path.join(consumer, "package.json"),
      `${JSON.stringify({ private: true, type: "module", dependencies }, null, 2)}\n`,
    )
    await runNpm(["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund"], consumer)
    const installed = JSON.parse(
      await fs.readFile(path.join(consumer, "node_modules", ...entry.name.split("/"), "package.json"), "utf8"),
    ) as { name?: string; version?: string }
    if (installed.name !== entry.name || installed.version !== entry.version) {
      throw new Error(`npm did not resolve ${entry.name}@${entry.version} in release order`)
    }
  }
  await fs.writeFile(
    path.join(consumer, "runtime.mjs"),
    `import { NodeProcess } from "@opencorvus-ai/util/process-node"
import { ProcessDeadlineExceededError } from "@opencorvus-ai/util/process"
await import("@opencorvus-ai/sdk/server")
await import("@opencorvus-ai/plugin")
for (let occurrence = 0; occurrence < 12; occurrence += 1) {
  const tree = await NodeProcess.run({
    command: { executable: process.execPath, args: ["-e", "process.stdout.write(process.argv[1])", String(occurrence)] },
    ownership: "owned_tree",
    occurrenceID: "published-owned-tree-" + occurrence,
    timeoutMs: 5_000,
  })
  if (new TextDecoder().decode(tree.stdout) !== String(occurrence)) {
    throw new Error("Published owned_tree adapter lost a Node readiness occurrence")
  }
}
let failure
try {
  await NodeProcess.run({
    command: { executable: process.execPath, args: ["-e", "setInterval(() => {}, 10000)"] },
    timeoutMs: 100,
  })
} catch (error) {
  failure = error
}
if (!(failure instanceof ProcessDeadlineExceededError)) {
  throw new Error("Published process deadline contract did not settle")
}
`,
  )
  await run("node", ["runtime.mjs"], consumer)
}

export async function publishPublicPackageRelease(prepared: readonly PreparedPackage[]) {
  for (const entry of prepared) {
    await runNpm(["publish", entry.archive, "--access", "public"])
  }
}

async function main() {
  const mode = process.argv[2]
  if (mode !== "--check" && mode !== "--publish") {
    throw new Error("Usage: public-package-release.ts --check | --publish")
  }
  if (mode === "--publish" && process.platform !== "win32") {
    throw new Error("Public package publication must run on Windows so the universal util archive includes owned_tree")
  }
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-public-package-release-"))
  try {
    const prepared = await preparePublicPackageRelease(temporaryRoot)
    if (mode === "--check") {
      await checkPublicPackageRelease(prepared, temporaryRoot)
      console.log(`Public package release order passed: ${prepared.map((entry) => entry.name).join(" -> ")}`)
    } else {
      await checkPublicPackageRelease(prepared, temporaryRoot)
      await publishPublicPackageRelease(prepared)
    }
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true })
  }
}

if (import.meta.main) await main()
