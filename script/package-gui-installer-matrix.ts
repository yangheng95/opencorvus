#!/usr/bin/env bun

import { $ } from "bun"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { overlayExecutableFileName, overlayPlatformFromNode } from "../packages/overlay/script/artifact-names"
import { copyReleaseFile } from "./copy-release-file"
import {
  preparePackageBuildEnvironment,
  publicRuntimePackageBuildCommands,
  type PublicRuntimePackageBuildCommand,
} from "./package-build-environment"
import { overlayBundlePatterns, overlayUpdaterContract, updaterSignatureName } from "./release-asset-contract"
import { runTimedStage } from "./timed-stage"

export interface GuiInstallerMatrixRow {
  id: string
  hostPlatform: NodeJS.Platform
  hostArch: NodeJS.Architecture
  bundleKinds: readonly string[]
  skipReason: string
}

export interface PackageGuiInstallerMatrixOptions {
  skipBuild?: boolean
  platform?: NodeJS.Platform
  arch?: NodeJS.Architecture
  env?: NodeJS.ProcessEnv
}

export interface GuiInstallerMatrixResult {
  row: GuiInstallerMatrixRow
  status: "packaged" | "skipped"
  artifacts: string[]
  reason?: string
}

export const GUI_INSTALLER_AUTOMATION_ENV = { CI: "true" } as const

export function guiInstallerBuildEnvironment(env: NodeJS.ProcessEnv, version: string): NodeJS.ProcessEnv {
  return { ...env, ...GUI_INSTALLER_AUTOMATION_ENV, OPENCORVUS_VERSION: version }
}

export function guiInstallerBuildCommands(repoRoot: string): PublicRuntimePackageBuildCommand[] {
  return [
    ...publicRuntimePackageBuildCommands(repoRoot),
    {
      label: "Overlay release build",
      cwd: path.join(repoRoot, "packages", "overlay"),
      argv: ["bun", "run", "script/build.ts"],
    },
  ]
}

export const GUI_INSTALLER_MATRIX: readonly GuiInstallerMatrixRow[] = [
  {
    id: "linux-x64",
    hostPlatform: "linux",
    hostArch: "x64",
    bundleKinds: ["deb", "rpm", "appimage"],
    skipReason: "requires a native Linux x64 runner",
  },
  {
    id: "linux-arm64",
    hostPlatform: "linux",
    hostArch: "arm64",
    bundleKinds: ["deb", "rpm", "appimage"],
    skipReason: "requires a native Linux ARM64 runner",
  },
  {
    id: "darwin-x64",
    hostPlatform: "darwin",
    hostArch: "x64",
    bundleKinds: ["app", "dmg"],
    skipReason: "requires a native macOS x64 runner",
  },
  {
    id: "darwin-arm64",
    hostPlatform: "darwin",
    hostArch: "arm64",
    bundleKinds: ["app", "dmg"],
    skipReason: "requires a native macOS ARM64 runner",
  },
  {
    id: "windows-x64",
    hostPlatform: "win32",
    hostArch: "x64",
    bundleKinds: ["msi", "nsis"],
    skipReason: "requires a native Windows x64 runner",
  },
] as const

export function parseGuiInstallerMatrixArgs(argv: readonly string[]): PackageGuiInstallerMatrixOptions {
  return { skipBuild: argv.includes("--skip-build") }
}

export function supportedGuiInstallerRows(
  options: Pick<PackageGuiInstallerMatrixOptions, "platform" | "arch"> = {},
): GuiInstallerMatrixRow[] {
  const platform = options.platform ?? process.platform
  const arch = options.arch ?? process.arch
  return GUI_INSTALLER_MATRIX.filter((row) => row.hostPlatform === platform && row.hostArch === arch)
}

export function skippedGuiInstallerRows(
  options: Pick<PackageGuiInstallerMatrixOptions, "platform" | "arch"> = {},
): GuiInstallerMatrixRow[] {
  const supported = new Set(supportedGuiInstallerRows(options).map((row) => row.id))
  return GUI_INSTALLER_MATRIX.filter((row) => !supported.has(row.id))
}

function walkFiles(root: string): string[] {
  const result: string[] = []
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name)
    if (entry.isDirectory()) result.push(...walkFiles(fullPath))
    if (entry.isFile()) result.push(fullPath)
  }
  return result
}

function requireSingleMatchingFile(root: string, pattern: RegExp, label: string): string {
  const matches = walkFiles(root).filter((file) => pattern.test(path.basename(file)))
  if (matches.length !== 1) {
    throw new Error(`${label} must resolve to exactly one file under ${root}; found ${matches.length}`)
  }
  return matches[0]!
}

async function packageVersion(repoRoot: string, env: NodeJS.ProcessEnv): Promise<string> {
  const configured = env.OPENCORVUS_VERSION?.trim()
  if (configured) return configured.replace(/^v(?=\d)/, "")
  const manifest = await Bun.file(path.join(repoRoot, "packages", "overlay", "package.json")).json()
  if (!manifest || typeof manifest.version !== "string" || !manifest.version.trim()) {
    throw new Error("packages/overlay/package.json is missing a version")
  }
  return manifest.version.replace(/^v(?=\d)/, "")
}

export function guiInstallerStagePaths(repoRoot: string, row: GuiInstallerMatrixRow) {
  const overlayRoot = path.join(repoRoot, "packages", "overlay")
  const releaseRoot = path.join(overlayRoot, "src-tauri", "target", "release")
  const platform = overlayPlatformFromNode(row.hostPlatform)
  return {
    overlayRoot,
    releaseRoot,
    bundleRoot: path.join(releaseRoot, "bundle"),
    executable: path.join(releaseRoot, "package-input", overlayExecutableFileName(platform)),
    output: path.join(overlayRoot, "dist-artifacts", row.id),
  }
}

export async function stageGuiInstallerArtifacts(
  repoRoot: string,
  row: GuiInstallerMatrixRow,
  version: string,
): Promise<string[]> {
  const paths = guiInstallerStagePaths(repoRoot, row)
  if (!fs.existsSync(paths.executable)) throw new Error(`Missing GUI executable: ${paths.executable}`)
  if (!fs.existsSync(paths.bundleRoot)) throw new Error(`Missing Tauri bundle directory: ${paths.bundleRoot}`)

  await fs.promises.rm(paths.output, { recursive: true, force: true })
  await fs.promises.mkdir(paths.output, { recursive: true })
  const staged: string[] = []
  const stagedExecutable = path.join(paths.output, path.basename(paths.executable))
  await copyReleaseFile(paths.executable, stagedExecutable)
  staged.push(stagedExecutable)

  const expectedPatterns = overlayBundlePatterns(row.id, version)
  const updater = overlayUpdaterContract(row.id, version)
  for (const expected of expectedPatterns) {
    const source = requireSingleMatchingFile(
      paths.bundleRoot,
      expected.sourcePattern ?? expected.pattern,
      expected.label,
    )
    const destination = path.join(paths.output, expected.assetName ?? path.basename(source))
    await copyReleaseFile(source, destination)
    staged.push(destination)
    if (updater.bundlePattern.test(path.basename(destination))) {
      const sourceSignature = updaterSignatureName(source)
      if (!fs.existsSync(sourceSignature)) {
        throw new Error(`Missing ${updater.label} signature: ${sourceSignature}`)
      }
      const destinationSignature = updaterSignatureName(destination)
      await copyReleaseFile(sourceSignature, destinationSignature)
      staged.push(destinationSignature)
    }
  }

  return staged
}

async function validateGuiInstallerArtifacts(repoRoot: string, row: GuiInstallerMatrixRow, version: string) {
  const output = guiInstallerStagePaths(repoRoot, row).output
  await $`bun ./script/check-release-assets.ts overlay --dir ${output} --platform ${row.id} --version ${version} --require-bundle --require-updater`.cwd(
    repoRoot,
  )
}

export async function packageGuiInstallerMatrix(
  repoRoot: string,
  options: PackageGuiInstallerMatrixOptions = {},
): Promise<GuiInstallerMatrixResult[]> {
  const platform = options.platform ?? process.platform
  const arch = options.arch ?? process.arch
  const env = options.env ?? process.env
  const supported = supportedGuiInstallerRows({ platform, arch })
  if (supported.length !== 1) {
    throw new Error(`Unsupported GUI installer host: ${platform}-${arch}`)
  }

  const version = await packageVersion(repoRoot, env)
  const buildEnv = await preparePackageBuildEnvironment(repoRoot, guiInstallerBuildEnvironment(env, version))
  const results: GuiInstallerMatrixResult[] = []
  for (const row of GUI_INSTALLER_MATRIX) {
    if (row !== supported[0]) {
      results.push({ row, status: "skipped", artifacts: [], reason: row.skipReason })
      continue
    }
    if (!options.skipBuild) {
      for (const command of guiInstallerBuildCommands(repoRoot)) {
        await runTimedStage(command.label, async () => {
          await $`${command.argv}`.cwd(command.cwd).env(buildEnv)
        })
      }
    }
    const artifacts = await runTimedStage("Installer staging", () => stageGuiInstallerArtifacts(repoRoot, row, version))
    await runTimedStage("Installer validation", () => validateGuiInstallerArtifacts(repoRoot, row, version))
    results.push({ row, status: "packaged", artifacts })
  }
  return results
}

async function main() {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  const results = await packageGuiInstallerMatrix(repoRoot, parseGuiInstallerMatrixArgs(process.argv.slice(2)))
  console.log("GUI installer matrix:")
  for (const result of results) {
    if (result.status === "skipped") {
      console.log(`  skip ${result.row.id}: ${result.reason}`)
      continue
    }
    console.log(`  packaged ${result.row.id}:`)
    for (const artifact of result.artifacts) console.log(`    ${path.relative(repoRoot, artifact)}`)
  }
}

if (import.meta.main) await main()
