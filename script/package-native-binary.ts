#!/usr/bin/env bun

import { $ } from "bun"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  artifactBrowserMcpNodeExecutableName,
  artifactExecutableName,
  artifactOfficeCliExecutableName,
  artifactRipgrepExecutableName,
} from "../packages/opencorvus/script/build-artifact"
import {
  ARTIFACT_EXECUTABLE_MODE,
  artifactEmbeddedExecutablePaths,
  inspectArtifactExecutableClosure,
  normalizeArtifactExecutablePermissions,
} from "../packages/opencorvus/script/runtime-executable-contract"

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

export function nativeBinaryBuildCommands(repoRoot: string): NativeBinaryBuildCommand[] {
  return [
    {
      cwd: repoRoot,
      argv: ["bun", "packages/sdk/js/script/build.ts"],
    },
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

async function buildOverlayUi(repoRoot: string, env: NodeJS.ProcessEnv): Promise<void> {
  const overlayRoot = path.join(repoRoot, "packages", "overlay")
  await $`bun run build:vite`.cwd(overlayRoot).env(env)
  const index = path.join(overlayRoot, "dist-vite", "index.html")
  if (!fs.existsSync(index)) throw new Error(`Missing built Overlay UI: ${index}`)
}

async function buildNativeCli(
  repoRoot: string,
  platform: NodeJS.Platform,
  arch: NodeJS.Architecture,
  env: NodeJS.ProcessEnv,
): Promise<void> {
  const packageRoot = path.join(repoRoot, "packages", "opencorvus")
  for (const outputName of nativeBinaryOutputNames(platform, arch)) {
    await fs.promises.rm(path.join(packageRoot, "dist", outputName), { recursive: true, force: true })
  }
  for (const command of nativeBinaryBuildCommands(repoRoot)) {
    await $`${command.argv}`.cwd(command.cwd).env(env)
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

export function requiredNativeBundleFiles(artifact: NativeBinaryArtifact, platform: NodeJS.Platform): string[] {
  return [
    ...artifactEmbeddedExecutablePaths(artifact.bundleDir, platform),
    path.join(artifact.bundleDir, "package.json"),
    path.join(artifact.bundleDir, "licenses", "OfficeCLI-LICENSE"),
    path.join(artifact.bundleDir, "licenses", "OfficeCLI-RUNTIME-LOCK.json"),
    path.join(artifact.bundleDir, "browser-mcp-node", "browser.mjs"),
    path.join(artifact.bundleDir, "browser-mcp-node", "node_modules", "playwright", "package.json"),
    path.join(artifact.bundleDir, "ui", "index.html"),
  ]
}

export function nativeBinarySmokeCommands(
  artifact: NativeBinaryArtifact,
  platform: NodeJS.Platform,
): NativeBinarySmokeCommand[] {
  const targetPlatform = nativeBinaryPlatform(platform)
  return [
    { label: "OpenCorvus", argv: [artifact.executable, "--version"] },
    {
      label: "Ripgrep",
      argv: [path.join(artifact.bundleDir, "bin", artifactRipgrepExecutableName(targetPlatform)), "--version"],
    },
    {
      label: "OfficeCLI",
      argv: [path.join(artifact.bundleDir, "bin", artifactOfficeCliExecutableName(targetPlatform)), "--version"],
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

export async function verifyNativeBinaryArtifact(
  artifact: NativeBinaryArtifact,
  platform: NodeJS.Platform,
  expectedVersion: string,
): Promise<void> {
  const missing = requiredNativeBundleFiles(artifact, platform).filter((file) => !fs.existsSync(file))
  if (missing.length > 0) {
    throw new Error(`Native bundle ${artifact.id} is incomplete: ${missing.join(", ")}`)
  }
  const executableClosure = await inspectArtifactExecutableClosure({ root: artifact.bundleDir, os: platform })
  if (platform !== "win32") {
    for (const executable of executableClosure) {
      if (executable.mode !== ARTIFACT_EXECUTABLE_MODE) {
        throw new Error(
          `Native bundle ${artifact.id} executable mode is ${executable.mode.toString(8)}, expected ${ARTIFACT_EXECUTABLE_MODE.toString(8)}: ${executable.path}`,
        )
      }
    }
  }
  const smokeCommands = nativeBinarySmokeCommands(artifact, platform)
  const [openCorvus, ...runtimeCommands] = smokeCommands
  const actualVersion = (await $`${openCorvus.argv}`.text()).trim()
  if (actualVersion !== expectedVersion) {
    throw new Error(`Unexpected ${artifact.executable} version: ${actualVersion}; expected ${expectedVersion}`)
  }
  for (const command of runtimeCommands) {
    const output = (await $`${command.argv}`.text()).trim()
    if (!output) throw new Error(`${command.label} did not report a version`)
  }
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

export async function verifyNativeBinaryArchive(
  artifact: NativeBinaryArtifact,
  platform: NodeJS.Platform,
): Promise<void> {
  const listing = (await $`tar -tvzf ${artifact.archive}`.text()).replaceAll("\\", "/")
  const executableClosure = await inspectArtifactExecutableClosure({ root: artifact.bundleDir, os: platform })
  for (const executable of executableClosure) {
    const normalized = path.relative(artifact.bundleDir, executable.path).replaceAll("\\", "/")
    const line = listing
      .split(/\r?\n/)
      .find((candidate) => candidate.endsWith(`./${normalized}`) || candidate.endsWith(` ${normalized}`))
    if (!line) throw new Error(`Native archive ${artifact.archive} is missing executable ${normalized}`)
    if (platform !== "win32" && !line.startsWith("-rwxr-xr-x")) {
      throw new Error(`Native archive ${artifact.archive} did not preserve mode 755 for ${normalized}: ${line}`)
    }
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
  const env = nativeBinaryBuildEnv(opts.env ?? process.env, packageVersion)
  if (!opts.skipBuild && !opts.skipUi) await buildOverlayUi(repoRoot, env)
  if (!opts.skipBuild) await buildNativeCli(repoRoot, platform, arch, env)

  const artifacts = resolveNativeBinaryArtifacts(repoRoot, platform, arch)
  for (const artifact of artifacts) {
    await stageOverlayUi(repoRoot, artifact)
    await normalizeArtifactExecutablePermissions({ root: artifact.bundleDir, os: platform })
    await signNativeBinaryArtifact(artifact, platform)
    await verifyNativeBinaryArtifact(artifact, platform, env.OPENCORVUS_VERSION!)
    await archiveNativeBinaryArtifact(artifact, platform)
    await verifyNativeBinaryArchive(artifact, platform)
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
