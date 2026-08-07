#!/usr/bin/env bun
/**
 * Host-verified binary package matrix.
 *
 * This matrix packages the row matching the current native host and reports
 * every other row as skipped. Each operating system executes and archives its
 * own artifact instead of pretending a cross-compiled runtime was verified.
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  packageNativeBinary,
  type NativeBinaryArtifact,
  type PackageNativeBinaryOptions,
} from "./package-native-binary"

export interface BinaryPackageMatrixRow {
  id: string
  hostPlatform: NodeJS.Platform
  hostArch: NodeJS.Architecture
  outputNames: readonly string[]
  skipReason: string
}

export interface BinaryPackageMatrixOptions {
  skipBuild?: boolean
  skipUi?: boolean
  platform?: NodeJS.Platform
  arch?: NodeJS.Architecture
  env?: NodeJS.ProcessEnv
}

export interface BinaryPackageMatrixResult {
  row: BinaryPackageMatrixRow
  status: "packaged" | "skipped"
  artifacts: NativeBinaryArtifact[]
  reason?: string
}

export const BINARY_PACKAGE_MATRIX: readonly BinaryPackageMatrixRow[] = [
  {
    id: "linux-x64",
    hostPlatform: "linux",
    hostArch: "x64",
    outputNames: ["opencorvus-linux-x64", "opencorvus-linux-x64-baseline"],
    skipReason: "requires a Linux x64 host or WSL because the generated ELF must be verified on Linux",
  },
  {
    id: "linux-arm64",
    hostPlatform: "linux",
    hostArch: "arm64",
    outputNames: ["opencorvus-linux-arm64"],
    skipReason: "requires a Linux ARM64 host; this script does not fake ARM64 runtime validation",
  },
  {
    id: "darwin-x64",
    hostPlatform: "darwin",
    hostArch: "x64",
    outputNames: ["opencorvus-darwin-x64", "opencorvus-darwin-x64-baseline"],
    skipReason: "requires a macOS x64 host; macOS binaries are skipped off macOS",
  },
  {
    id: "darwin-arm64",
    hostPlatform: "darwin",
    hostArch: "arm64",
    outputNames: ["opencorvus-darwin-arm64"],
    skipReason: "requires a macOS ARM64 host; macOS binaries are skipped off macOS",
  },
  {
    id: "windows-x64",
    hostPlatform: "win32",
    hostArch: "x64",
    outputNames: ["opencorvus-windows-x64.exe", "opencorvus-windows-x64-baseline.exe"],
    skipReason: "requires a Windows x64 host; Windows binaries are skipped off Windows",
  },
] as const

export function parseBinaryMatrixArgs(argv: readonly string[]): BinaryPackageMatrixOptions {
  return {
    skipBuild: argv.includes("--skip-build"),
    skipUi: argv.includes("--skip-ui"),
  }
}

export function supportedMatrixRows(
  opts: Pick<BinaryPackageMatrixOptions, "platform" | "arch"> = {},
): BinaryPackageMatrixRow[] {
  const platform = opts.platform ?? process.platform
  const arch = opts.arch ?? process.arch
  return BINARY_PACKAGE_MATRIX.filter((row) => row.hostPlatform === platform && row.hostArch === arch)
}

export function skippedMatrixRows(
  opts: Pick<BinaryPackageMatrixOptions, "platform" | "arch"> = {},
): BinaryPackageMatrixRow[] {
  const supported = new Set(supportedMatrixRows(opts).map((row) => row.id))
  return BINARY_PACKAGE_MATRIX.filter((row) => !supported.has(row.id))
}

export async function packageBinaryMatrix(
  repoRoot: string,
  opts: BinaryPackageMatrixOptions = {},
): Promise<BinaryPackageMatrixResult[]> {
  const results: BinaryPackageMatrixResult[] = []
  const packageOpts: PackageNativeBinaryOptions = {
    skipBuild: opts.skipBuild,
    skipUi: opts.skipUi,
    platform: opts.platform ?? process.platform,
    arch: opts.arch ?? process.arch,
    env: opts.env ?? process.env,
  }
  for (const row of BINARY_PACKAGE_MATRIX) {
    if (row.hostPlatform !== packageOpts.platform || row.hostArch !== packageOpts.arch) {
      results.push({ row, status: "skipped", artifacts: [], reason: row.skipReason })
      continue
    }

    const artifacts = await packageNativeBinary(repoRoot, packageOpts)
    results.push({ row, status: "packaged", artifacts })
  }

  return results
}

function artifactSizeMiB(file: string): number {
  return Math.round(fs.statSync(file).size / 1024 / 1024)
}

async function main() {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  const results = await packageBinaryMatrix(repoRoot, parseBinaryMatrixArgs(process.argv.slice(2)))
  console.log("Binary package matrix:")
  for (const result of results) {
    if (result.status === "skipped") {
      console.log(`  skip ${result.row.id}: ${result.reason}`)
      continue
    }
    console.log(`  packaged ${result.row.id}:`)
    for (const artifact of result.artifacts) {
      console.log(`    ${path.relative(repoRoot, artifact.executable)} (${artifactSizeMiB(artifact.executable)} MiB)`)
      console.log(`    ${path.relative(repoRoot, artifact.archive)} (${artifactSizeMiB(artifact.archive)} MiB)`)
    }
  }
}

if (import.meta.main) {
  await main()
}
