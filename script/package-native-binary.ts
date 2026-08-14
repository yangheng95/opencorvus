#!/usr/bin/env bun

import { $ } from "bun"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  artifactBrowserMcpNodeExecutableName,
  artifactExecutableName,
  artifactRipgrepExecutableName,
} from "../packages/opencorvus/script/build-artifact"
import {
  ARTIFACT_EXECUTABLE_MODE,
  ARTIFACT_SHARED_LIBRARY_MODE,
  artifactEmbeddedExecutablePaths,
  inspectArtifactExecutableClosure,
  normalizeArtifactExecutablePermissions,
} from "../packages/opencorvus/script/runtime-executable-contract"
import { preparePackageBuildEnvironment } from "./package-build-environment"
import { writeOverlayPayloadStamp } from "../packages/opencorvus/script/build-overlay-payload-stamp"
import { WORK_ARTIFACT_RUNTIME_LOCK } from "../packages/opencorvus/script/work-artifact-runtime-lock"
import { officeCliRuntime } from "../packages/opencorvus/src/work-artifact/runtime/runtime-lock"
import {
  WORK_ARTIFACT_TARGET_PACKAGE_MANIFEST,
  verifyWorkArtifactTargetPackageManifest,
  workArtifactManagedPackageFiles,
  writeWorkArtifactTargetPackageManifest,
} from "../packages/opencorvus/src/work-artifact/runtime/package-manifest"

export type NativeBinaryPlatform = "linux" | "darwin" | "windows"

export interface NativeBinaryArtifact {
  id: string
  bundleDir: string
  executable: string
  archive: string
}

export interface PackageNativeBinaryOptions {
  skipBuild?: boolean
  skipUi?: boolean
  platform?: NodeJS.Platform
  arch?: NodeJS.Architecture
  env?: NodeJS.ProcessEnv
}

export interface NativeBinaryBuildCommand {
  cwd: string
  argv: string[]
}

export interface NativeBinarySmokeCommand {
  label: string
  argv: string[]
  env?: Record<string, string>
}

export interface NativeBinaryFinalization {
  smoke: () => Promise<void>
  sign: () => Promise<void>
  writeManifest: () => Promise<void>
  writeStamp: () => Promise<void>
  verify: () => Promise<void>
}

export function nativeBinaryCodeSignCommands(executables: readonly string[], platform: NodeJS.Platform): string[][] {
  if (platform !== "darwin") return []
  return executables.flatMap((executable) => [
    ["codesign", "--force", "--sign", "-", executable],
    ["codesign", "--verify", "--strict", "--verbose=2", executable],
  ])
}

export function nativeBinaryPlatform(platform: NodeJS.Platform): NativeBinaryPlatform {
  if (platform === "linux" || platform === "darwin") return platform
  if (platform === "win32") return "windows"
  throw new Error(`Unsupported native OpenCorvus platform: ${platform}`)
}

export function nativeBinaryOutputNames(platform: NodeJS.Platform, arch: NodeJS.Architecture): string[] {
  const targetPlatform = nativeBinaryPlatform(platform)
  if (arch === "arm64") return [`opencorvus-${targetPlatform}-arm64`]
  if (arch === "x64") {
    return [`opencorvus-${targetPlatform}-x64`, `opencorvus-${targetPlatform}-x64-baseline`]
  }
  throw new Error(`Unsupported native OpenCorvus architecture: ${arch}`)
}

export function assertNativeBinaryHost(platform: NodeJS.Platform, arch: NodeJS.Architecture): void {
  nativeBinaryPlatform(platform)
  if (arch !== "x64" && arch !== "arm64") {
    throw new Error(`Unsupported native OpenCorvus host: ${platform}-${arch}`)
  }
  if (platform === "win32" && arch !== "x64") {
    throw new Error(`Unsupported native OpenCorvus host: ${platform}-${arch}`)
  }
}

export function resolveNativeBinaryArtifacts(
  repoRoot: string,
  platform: NodeJS.Platform,
  arch: NodeJS.Architecture,
): NativeBinaryArtifact[] {
  const distDir = path.join(repoRoot, "packages", "opencorvus", "dist")
  const targetPlatform = nativeBinaryPlatform(platform)
  return nativeBinaryOutputNames(platform, arch).map((id) => {
    const bundleDir = path.join(distDir, id)
    return {
      id,
      bundleDir,
      executable: path.join(bundleDir, artifactExecutableName(targetPlatform)),
      archive: path.join(distDir, `${id}.tar.gz`),
    }
  })
}

export function nativeBinaryBuildEnv(baseEnv: NodeJS.ProcessEnv, packageVersion: string): NodeJS.ProcessEnv {
  return {
    ...baseEnv,
    OPENCORVUS_VERSION: baseEnv.OPENCORVUS_VERSION?.trim() || packageVersion,
    OPENCORVUS_CHANNEL: baseEnv.OPENCORVUS_CHANNEL?.trim() || "local",
  }
}

export function nativeBinaryBuildCommands(repoRoot: string, skipUi = false): NativeBinaryBuildCommand[] {
  return [
    {
      cwd: repoRoot,
      argv: ["bun", "packages/sdk/js/script/build.ts"],
    },
    ...(skipUi
      ? []
      : [
          {
            cwd: path.join(repoRoot, "packages", "overlay"),
            argv: ["bun", "run", "build:vite"],
          },
        ]),
    {
      cwd: path.join(repoRoot, "packages", "opencorvus"),
      argv: ["bun", "run", "script/build.ts", "--single", "--baseline", "--no-clean"],
    },
  ]
}

async function readPackageVersion(repoRoot: string): Promise<string> {
  const manifest = await Bun.file(path.join(repoRoot, "packages", "opencorvus", "package.json")).json()
  if (!manifest || typeof manifest.version !== "string" || manifest.version.length === 0) {
    throw new Error("packages/opencorvus/package.json is missing a version")
  }
  return manifest.version
}

async function buildNativeSources(
  repoRoot: string,
  platform: NodeJS.Platform,
  arch: NodeJS.Architecture,
  env: NodeJS.ProcessEnv,
  skipUi: boolean,
): Promise<void> {
  const packageRoot = path.join(repoRoot, "packages", "opencorvus")
  for (const outputName of nativeBinaryOutputNames(platform, arch)) {
    await fs.promises.rm(path.join(packageRoot, "dist", outputName), { recursive: true, force: true })
  }
  for (const command of nativeBinaryBuildCommands(repoRoot, skipUi)) {
    await $`${command.argv}`.cwd(command.cwd).env(env)
  }
  if (!skipUi) {
    const index = path.join(repoRoot, "packages", "overlay", "dist-vite", "index.html")
    if (!fs.existsSync(index)) throw new Error(`Missing built Overlay UI: ${index}`)
  }
}

async function stageOverlayUi(repoRoot: string, artifact: NativeBinaryArtifact): Promise<void> {
  const source = path.join(repoRoot, "packages", "overlay", "dist-vite")
  const destination = path.join(artifact.bundleDir, "ui")
  if (!fs.existsSync(path.join(source, "index.html"))) {
    throw new Error(`Missing built Overlay UI: ${source}`)
  }
  await fs.promises.rm(destination, { recursive: true, force: true })
  await fs.promises.cp(source, destination, { recursive: true, force: true })
}

export function requiredNativeBundleFiles(
  artifact: NativeBinaryArtifact,
  platform: NodeJS.Platform,
  arch: NodeJS.Architecture,
): string[] {
  const workArtifactFiles = workArtifactManagedPackageFiles({
    lock: WORK_ARTIFACT_RUNTIME_LOCK,
    target: { os: platform as "darwin" | "linux" | "win32", arch: arch as "arm64" | "x64" },
  })
  return [
    ...artifactEmbeddedExecutablePaths(artifact.bundleDir, platform),
    path.join(artifact.bundleDir, "package.json"),
    ...workArtifactFiles.map((file) => path.join(artifact.bundleDir, ...file.path.split("/"))),
    path.join(artifact.bundleDir, WORK_ARTIFACT_TARGET_PACKAGE_MANIFEST),
    path.join(artifact.bundleDir, "browser-mcp-node", "browser.mjs"),
    path.join(artifact.bundleDir, "browser-mcp-node", "node_modules", "playwright", "package.json"),
    path.join(artifact.bundleDir, "ui", "index.html"),
  ]
}

export function nativeBinarySmokeCommands(
  artifact: NativeBinaryArtifact,
  platform: NodeJS.Platform,
  arch: NodeJS.Architecture,
): NativeBinarySmokeCommand[] {
  const targetPlatform = nativeBinaryPlatform(platform)
  const runtime = officeCliRuntime(WORK_ARTIFACT_RUNTIME_LOCK)
  const runtimeFile = workArtifactManagedPackageFiles({
    lock: WORK_ARTIFACT_RUNTIME_LOCK,
    target: { os: platform as "darwin" | "linux" | "win32", arch: arch as "arm64" | "x64" },
  }).find((file) => file.kind === "executable")
  if (!runtimeFile) throw new Error(`Work Artifact runtime has no executable for ${platform}-${arch}`)
  return [
    { label: "OpenCorvus", argv: [artifact.executable, "--version"] },
    {
      label: "Ripgrep",
      argv: [path.join(artifact.bundleDir, "bin", artifactRipgrepExecutableName(targetPlatform)), "--version"],
    },
    {
      label: runtime.id,
      argv: [path.join(artifact.bundleDir, ...runtimeFile.path.split("/")), ...runtime.smoke_argv],
      env: runtime.execution_policy.environment,
    },
    {
      label: "Browser MCP Node.js",
      argv: [
        path.join(artifact.bundleDir, "browser-mcp-node", artifactBrowserMcpNodeExecutableName(platform)),
        "--version",
      ],
    },
    ...(platform === "win32"
      ? [
          {
            label: "OpenCorvus process supervisor",
            argv: [path.join(artifact.bundleDir, "opencorvus-process-supervisor.exe"), "--version"],
          },
        ]
      : []),
  ]
}

export async function runNativeBinarySmokeCommand(
  command: NativeBinarySmokeCommand,
  inheritedEnv: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  return (await $`${command.argv}`.env({ ...inheritedEnv, ...command.env }).text()).trim()
}

export async function verifyNativeBinaryRuntimeSmoke(
  artifact: NativeBinaryArtifact,
  platform: NodeJS.Platform,
  arch: NodeJS.Architecture,
  expectedVersion: string,
): Promise<void> {
  const smokeCommands = nativeBinarySmokeCommands(artifact, platform, arch)
  const [openCorvus, ...runtimeCommands] = smokeCommands
  const actualVersion = (await $`${openCorvus.argv}`.text()).trim()
  if (actualVersion !== expectedVersion) {
    throw new Error(`Unexpected ${artifact.executable} version: ${actualVersion}; expected ${expectedVersion}`)
  }
  for (const command of runtimeCommands) {
    const output = await runNativeBinarySmokeCommand(command)
    if (!output) throw new Error(`${command.label} did not report a version`)
  }
}

export async function verifyNativeBinaryArtifact(
  artifact: NativeBinaryArtifact,
  platform: NodeJS.Platform,
  arch: NodeJS.Architecture,
): Promise<void> {
  const missing = requiredNativeBundleFiles(artifact, platform, arch).filter((file) => !fs.existsSync(file))
  if (missing.length > 0) {
    throw new Error(`Native bundle ${artifact.id} is incomplete: ${missing.join(", ")}`)
  }
  const executableClosure = await inspectArtifactExecutableClosure({ root: artifact.bundleDir, os: platform })
  await verifyWorkArtifactTargetPackageManifest({
    root: artifact.bundleDir,
    target: { os: platform as "darwin" | "linux" | "win32", arch: arch as "arm64" | "x64" },
    lock: WORK_ARTIFACT_RUNTIME_LOCK,
  })
  if (platform !== "win32") {
    for (const executable of executableClosure) {
      const expectedMode = executable.kind === "executable" ? ARTIFACT_EXECUTABLE_MODE : ARTIFACT_SHARED_LIBRARY_MODE
      if (executable.mode !== expectedMode) {
        throw new Error(
          `Native bundle ${artifact.id} ${executable.kind} mode is ${executable.mode.toString(8)}, expected ${expectedMode.toString(8)}: ${executable.path}`,
        )
      }
    }
  }
}

export async function finalizeNativeBinaryArtifact(finalization: NativeBinaryFinalization): Promise<void> {
  await finalization.smoke()
  await finalization.sign()
  await finalization.writeManifest()
  await finalization.writeStamp()
  await finalization.verify()
}

export async function signNativeBinaryArtifact(
  artifact: NativeBinaryArtifact,
  platform: NodeJS.Platform,
): Promise<void> {
  const executableClosure = await inspectArtifactExecutableClosure({ root: artifact.bundleDir, os: platform })
  for (const argv of nativeBinaryCodeSignCommands(
    executableClosure.map((executable) => executable.path),
    platform,
  )) {
    await $`${argv}`
  }
}

export async function archiveNativeBinaryArtifact(
  artifact: NativeBinaryArtifact,
  _platform: NodeJS.Platform,
): Promise<void> {
  await fs.promises.rm(artifact.archive, { force: true })
  const archiveDir = path.dirname(artifact.archive)
  const temporaryName = `${path.basename(artifact.archive)}.tmp.tar.gz`
  const temporary = path.join(archiveDir, temporaryName)
  await fs.promises.rm(temporary, { force: true })
  await $`tar -czf ${temporaryName} -C ${path.basename(artifact.bundleDir)} .`.cwd(archiveDir)
  await fs.promises.rename(temporary, artifact.archive)
}

export function nativeBinaryArchiveListingCommand(archive: string): NativeBinaryBuildCommand {
  return {
    cwd: path.dirname(archive),
    argv: ["tar", "-tvzf", path.basename(archive)],
  }
}

export function nativeBinaryArchiveExtractionCommand(archive: string, destination: string): NativeBinaryBuildCommand {
  return {
    cwd: path.dirname(archive),
    argv: ["tar", "-xzf", path.basename(archive), "-C", destination],
  }
}

export function assertNativeArchiveEntry(input: {
  archive: string
  listing: string
  path: string
  kind: "executable" | "shared_library" | "data"
  platform: NodeJS.Platform
}): void {
  const normalized = input.path.replaceAll("\\", "/")
  const line = input.listing
    .replaceAll("\\", "/")
    .split(/\r?\n/)
    .find((candidate) => candidate.endsWith(`./${normalized}`) || candidate.endsWith(` ${normalized}`))
  if (!line) throw new Error(`Native archive ${input.archive} is missing ${input.kind} ${normalized}`)
  const expectedPrefix = input.kind === "executable" ? "-rwxr-xr-x" : "-rw-r--r--"
  if (input.platform !== "win32" && !line.startsWith(expectedPrefix)) {
    throw new Error(
      `Native archive ${input.archive} did not preserve the ${input.kind} mode for ${normalized}: ${line}`,
    )
  }
}

export function assertNativeArchiveClosure(input: {
  archive: string
  listing: string
  platform: NodeJS.Platform
}): void {
  const normalizedPaths = new Set<string>()
  for (const rawLine of input.listing.replaceAll("\\", "/").split(/\r?\n/)) {
    const line = rawLine.trimEnd()
    if (!line) continue
    const type = line[0]
    if (type !== "-" && type !== "d") {
      throw new Error(`Native archive ${input.archive} contains an unsupported entry type: ${line}`)
    }
    const marker = line.indexOf("./")
    if (marker < 0) throw new Error(`Native archive ${input.archive} has an unreadable entry path: ${line}`)
    const entryPath = line.slice(marker + 2).replace(/\/$/, "")
    if (!entryPath && type === "d") continue
    if (
      path.posix.isAbsolute(entryPath) ||
      entryPath.split("/").some((segment) => !segment || segment === "." || segment === "..")
    ) {
      throw new Error(`Native archive ${input.archive} contains an unsafe entry path: ${entryPath}`)
    }
    const collisionKey = entryPath.normalize("NFC").toLowerCase()
    if (normalizedPaths.has(collisionKey)) {
      throw new Error(`Native archive ${input.archive} contains a normalized path collision: ${entryPath}`)
    }
    normalizedPaths.add(collisionKey)
    if (input.platform === "win32") {
      for (const segment of entryPath.split("/")) {
        const stem = segment.split(".", 1)[0]!.toUpperCase()
        if (
          /[\x00-\x1f<>:"|?*]/.test(segment) ||
          /[ .]$/.test(segment) ||
          /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(stem)
        ) {
          throw new Error(`Native archive ${input.archive} contains an unsafe Windows entry path: ${entryPath}`)
        }
      }
    }
    if (input.platform !== "win32") {
      const expected = type === "d" ? "drwxr-xr-x" : undefined
      if (expected && !line.startsWith(expected)) {
        throw new Error(`Native archive ${input.archive} directory mode is not 0755: ${line}`)
      }
      if (type === "-" && !line.startsWith("-rw-r--r--") && !line.startsWith("-rwxr-xr-x")) {
        throw new Error(`Native archive ${input.archive} file mode is not 0644 or 0755: ${line}`)
      }
    }
  }
}

export async function verifyNativeBinaryArchive(
  artifact: NativeBinaryArtifact,
  platform: NodeJS.Platform,
  arch: NodeJS.Architecture,
): Promise<void> {
  const profileChecker = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "packages",
    "opencorvus",
    "script",
    "check-work-artifact-profile.ts",
  )
  const executableClosure = await inspectArtifactExecutableClosure({ root: artifact.bundleDir, os: platform })
  const manifest = await verifyWorkArtifactTargetPackageManifest({
    root: artifact.bundleDir,
    target: { os: platform as "darwin" | "linux" | "win32", arch: arch as "arm64" | "x64" },
    lock: WORK_ARTIFACT_RUNTIME_LOCK,
  })
  const command = nativeBinaryArchiveListingCommand(artifact.archive)
  const listing = (await $`${command.argv}`.cwd(command.cwd).text()).replaceAll("\\", "/")
  assertNativeArchiveClosure({ archive: artifact.archive, listing, platform })
  const entries = [
    ...executableClosure.map((file) => ({
      path: path.relative(artifact.bundleDir, file.path).replaceAll("\\", "/"),
      kind: file.kind,
    })),
    ...manifest.files.map((file) => ({ path: file.path, kind: file.kind })),
    { path: WORK_ARTIFACT_TARGET_PACKAGE_MANIFEST, kind: "data" as const },
  ].filter((entry, index, all) => all.findIndex((candidate) => candidate.path === entry.path) === index)
  for (const entry of entries) {
    assertNativeArchiveEntry({ archive: artifact.archive, listing, path: entry.path, kind: entry.kind, platform })
  }
  const extracted = await fs.promises.mkdtemp(path.join(os.tmpdir(), "opencorvus-native-archive-check-"))
  try {
    const extraction = nativeBinaryArchiveExtractionCommand(artifact.archive, extracted)
    await $`${extraction.argv}`.cwd(extraction.cwd)
    await $`${process.execPath} ${profileChecker} --profile office.presentation@1 --package-root ${extracted}`
  } finally {
    await fs.promises.rm(extracted, { recursive: true, force: true })
  }
}

export async function packageNativeBinary(
  repoRoot: string,
  opts: PackageNativeBinaryOptions = {},
): Promise<NativeBinaryArtifact[]> {
  const platform = opts.platform ?? process.platform
  const arch = opts.arch ?? process.arch
  assertNativeBinaryHost(platform, arch)

  const packageVersion = await readPackageVersion(repoRoot)
  const env = await preparePackageBuildEnvironment(
    repoRoot,
    nativeBinaryBuildEnv(opts.env ?? process.env, packageVersion),
  )
  if (!opts.skipBuild) await buildNativeSources(repoRoot, platform, arch, env, opts.skipUi === true)

  const artifacts = resolveNativeBinaryArtifacts(repoRoot, platform, arch)
  for (const artifact of artifacts) {
    await stageOverlayUi(repoRoot, artifact)
    await normalizeArtifactExecutablePermissions({ root: artifact.bundleDir, os: platform })
    await finalizeNativeBinaryArtifact({
      smoke: () => verifyNativeBinaryRuntimeSmoke(artifact, platform, arch, env.OPENCORVUS_VERSION!),
      sign: () => signNativeBinaryArtifact(artifact, platform),
      writeManifest: async () => {
        await writeWorkArtifactTargetPackageManifest({
          root: artifact.bundleDir,
          target: { os: platform as "darwin" | "linux" | "win32", arch: arch as "arm64" | "x64" },
          lock: WORK_ARTIFACT_RUNTIME_LOCK,
          phase: "final",
        })
      },
      writeStamp: async () => {
        await writeOverlayPayloadStamp(artifact.bundleDir)
      },
      verify: () => verifyNativeBinaryArtifact(artifact, platform, arch),
    })
    await archiveNativeBinaryArtifact(artifact, platform)
    await verifyNativeBinaryArchive(artifact, platform, arch)
  }
  return artifacts
}

async function main() {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  const artifacts = await packageNativeBinary(repoRoot, {
    skipBuild: process.argv.includes("--skip-build"),
    skipUi: process.argv.includes("--skip-ui"),
  })
  console.log("Native OpenCorvus bundles:")
  for (const artifact of artifacts) {
    const size = Math.round((await fs.promises.stat(artifact.archive)).size / 1024 / 1024)
    console.log(`  ${path.relative(repoRoot, artifact.archive)} (${size} MiB)`)
  }
}

if (import.meta.main) await main()
