#!/usr/bin/env bun
/**
 * Linux x64 runtime-bundle package script.
 *
 * This script must run on a Linux x64 host, including WSL. It builds the
 * overlay UI (User Interface), prepares a virtual Bun file-embedding module,
 * compiles the native and baseline Linux overlay-server executables,
 * then copies the executable, packaged Ripgrep, OfficeCLI, and required native runtime
 * node_modules into a bundle directory. The executable is not a standalone
 * single-file artifact: native packages such as sharp, Playwright, and
 * Ripgrep must remain colocated in the bundle directory.
 *
 * Output:
 *   packages/opencorvus/dist/binary/opencorvus-linux-x64/opencorvus-bundle.tar.gz
 *   packages/opencorvus/dist/binary/opencorvus-linux-x64-baseline/opencorvus-bundle.tar.gz
 *
 * The generated executables serve /ui/ from embedded Bun files. They do not
 * require a sibling ui/ directory.
 */

import { $ } from "bun"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  artifactEmbeddedExecutablePaths,
  normalizeArtifactExecutablePermissions,
} from "../packages/opencorvus/script/runtime-executable-contract"
import { verifyNativeBinaryArchive } from "./package-native-binary"

export interface LinuxBinaryTarget {
  distDirName: string
  outputName: string
}

export const LINUX_BINARY_TARGETS: readonly LinuxBinaryTarget[] = [
  {
    distDirName: "opencorvus-linux-x64",
    outputName: "opencorvus-linux-x64",
  },
  {
    distDirName: "opencorvus-linux-x64-baseline",
    outputName: "opencorvus-linux-x64-baseline",
  },
] as const

export interface LinuxBinaryArtifact {
  target: LinuxBinaryTarget
  sourceBundleDir: string
  source: string
  output: string
  bundleDir: string
  archive: string
}

export interface PackageLinuxBinaryOptions {
  skipBuild?: boolean
  skipUi?: boolean
  platform?: string
  arch?: string
  env?: NodeJS.ProcessEnv
}

export interface EmbeddedOverlayUiSourceFile {
  path: string
  source: string
}

export function resolveLinuxBinaryArtifacts(repoRoot: string): LinuxBinaryArtifact[] {
  const opencorvusDist = path.join(repoRoot, "packages", "opencorvus", "dist")
  const outputDir = path.join(opencorvusDist, "binary")
  return LINUX_BINARY_TARGETS.map((target) => {
    const sourceBundleDir = path.join(
      opencorvusDist,
      `opencorvus-overlay-server-${target.distDirName.replace(/^opencorvus-/, "")}`,
    )
    return {
      target,
      sourceBundleDir,
      source: path.join(sourceBundleDir, "opencorvus"),
      output: path.join(outputDir, target.outputName, "opencorvus"),
      bundleDir: path.join(outputDir, target.outputName),
      archive: path.join(outputDir, target.outputName, "opencorvus-bundle.tar.gz"),
    }
  })
}

export function resolveLegacyLooseBinaryDir(repoRoot: string): string {
  return path.join(repoRoot, "packages", "opencorvus", "dist", "bin")
}

export function resolveOverlayDistDir(repoRoot: string): string {
  return path.join(repoRoot, "packages", "overlay", "dist-vite")
}

export function resolveEmbeddedOverlayUiModulePath(repoRoot: string): string {
  return path.join(repoRoot, "packages", "opencorvus", "src", "server", "overlay-ui-embedded.generated.ts")
}

export function resolveObsoleteLinuxBinarySidecarUiDirs(repoRoot: string): string[] {
  return resolveLinuxBinaryArtifacts(repoRoot).map((artifact) => path.join(artifact.bundleDir, "ui"))
}

export function linuxBinaryBuildEnv(baseEnv: NodeJS.ProcessEnv, packageVersion: string): NodeJS.ProcessEnv {
  return {
    ...baseEnv,
    OPENCORVUS_VERSION: baseEnv.OPENCORVUS_VERSION?.trim() || packageVersion,
    OPENCORVUS_CHANNEL: baseEnv.OPENCORVUS_CHANNEL?.trim() || "local",
  }
}

export function assertLinuxX64Host(platform: string, arch: string): void {
  if (platform !== "linux" || arch !== "x64") {
    throw new Error(
      `package-linux-binary must run on linux-x64 so the copied runtime is a Linux binary. ` +
        `Current host is ${platform}-${arch}. Run it inside WSL or a Linux x64 build host.`,
    )
  }
}

export function parsePackageLinuxBinaryArgs(argv: readonly string[]): PackageLinuxBinaryOptions {
  return {
    skipBuild: argv.includes("--skip-build"),
    skipUi: argv.includes("--skip-ui"),
  }
}

async function readPackageVersion(repoRoot: string): Promise<string> {
  const pkg = await Bun.file(path.join(repoRoot, "packages", "opencorvus", "package.json")).json()
  if (!pkg || typeof pkg.version !== "string" || pkg.version.length === 0) {
    throw new Error("packages/opencorvus/package.json is missing a version")
  }
  return pkg.version
}

export async function copyBinaryArtifact(artifact: LinuxBinaryArtifact): Promise<void> {
  if (!fs.existsSync(artifact.source)) {
    if (fs.existsSync(artifact.output)) {
      await fs.promises.chmod(artifact.output, 0o755)
      return
    }
    throw new Error(`Missing built Linux binary: ${artifact.source}`)
  }
  await fs.promises.rm(artifact.bundleDir, { recursive: true, force: true })
  await fs.promises.mkdir(artifact.bundleDir, { recursive: true })
  await fs.promises.cp(artifact.sourceBundleDir, artifact.bundleDir, { recursive: true, force: true })
  await fs.promises.chmod(artifact.output, 0o755)
}

async function verifyBinaryArtifact(artifact: LinuxBinaryArtifact): Promise<string> {
  let openCorvusVersion = ""
  for (const executable of artifactEmbeddedExecutablePaths(artifact.bundleDir, "linux")) {
    const version = (await $`${executable} --version`.text()).trim()
    if (!version) throw new Error(`Embedded executable did not report a version: ${executable}`)
    if (executable === artifact.output) openCorvusVersion = version
  }
  return openCorvusVersion
}

async function buildOverlayUi(repoRoot: string, env: NodeJS.ProcessEnv): Promise<void> {
  const overlayRoot = path.join(repoRoot, "packages", "overlay")
  await $`bun run build:vite`.cwd(overlayRoot).env(env)

  const indexHtml = path.join(resolveOverlayDistDir(repoRoot), "index.html")
  if (!fs.existsSync(indexHtml)) {
    throw new Error(`Missing built overlay UI: ${indexHtml}`)
  }
}

export async function discoverOverlayUiSourceFiles(repoRoot: string): Promise<EmbeddedOverlayUiSourceFile[]> {
  const distDir = resolveOverlayDistDir(repoRoot)
  const files: EmbeddedOverlayUiSourceFile[] = []

  async function walk(dir: string): Promise<void> {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(fullPath)
        continue
      }
      if (!entry.isFile()) continue
      files.push({
        path: `/${path.relative(distDir, fullPath).split(path.sep).join("/")}`,
        source: fullPath,
      })
    }
  }

  await walk(distDir)
  files.sort((a, b) => a.path.localeCompare(b.path))
  if (!files.some((file) => file.path === "/index.html")) {
    throw new Error(`Overlay UI dist is missing /index.html: ${distDir}`)
  }
  return files
}

function moduleImportSpecifier(modulePath: string, sourceFile: string): string {
  const relative = path.relative(path.dirname(modulePath), sourceFile).split(path.sep).join("/")
  return relative.startsWith(".") ? relative : `./${relative}`
}

export function renderEmbeddedOverlayUiModule(
  modulePath: string,
  files: readonly EmbeddedOverlayUiSourceFile[],
): string {
  if (files.length === 0) {
    return [
      "export interface EmbeddedOverlayUiFile {",
      "  path: string",
      "  file: string",
      "}",
      "",
      "// UI means User Interface. The Bun build plugin virtual-loads the populated table",
      "// during compile so this tracked source file always remains empty.",
      "export const EMBEDDED_OVERLAY_UI: readonly EmbeddedOverlayUiFile[] = []",
      "",
    ].join("\n")
  }

  const imports = files.map(
    (file, index) =>
      `import file${index} from ${JSON.stringify(moduleImportSpecifier(modulePath, file.source))} with { type: "file" }`,
  )
  const entries = files.map((file, index) => `  { path: ${JSON.stringify(file.path)}, file: file${index} },`)
  return [
    "// Auto-generated by script/package-linux-binary.ts. Do not edit.",
    ...imports,
    "",
    "export interface EmbeddedOverlayUiFile {",
    "  path: string",
    "  file: string",
    "}",
    "",
    "export const EMBEDDED_OVERLAY_UI: readonly EmbeddedOverlayUiFile[] = [",
    ...entries,
    "]",
    "",
  ].join("\n")
}

async function removeObsoleteSidecarUiDirs(repoRoot: string): Promise<void> {
  for (const dir of resolveObsoleteLinuxBinarySidecarUiDirs(repoRoot)) {
    await fs.promises.rm(dir, { recursive: true, force: true })
  }
}

export async function archiveBinaryArtifact(artifact: LinuxBinaryArtifact): Promise<void> {
  await fs.promises.rm(artifact.archive, { force: true })
  const tmpArchive = path.join(path.dirname(artifact.bundleDir), `${artifact.target.outputName}.tar.gz.tmp`)
  await fs.promises.rm(tmpArchive, { force: true })
  await $`tar -czf ${tmpArchive} -C ${artifact.bundleDir} .`
  await fs.promises.rename(tmpArchive, artifact.archive)
}

export async function packageLinuxBinary(
  repoRoot: string,
  opts: PackageLinuxBinaryOptions = {},
): Promise<LinuxBinaryArtifact[]> {
  assertLinuxX64Host(opts.platform ?? process.platform, opts.arch ?? process.arch)

  const version = await readPackageVersion(repoRoot)
  const env = linuxBinaryBuildEnv(opts.env ?? process.env, version)
  const opencorvusRoot = path.join(repoRoot, "packages", "opencorvus")

  if (!opts.skipBuild && !opts.skipUi) {
    await buildOverlayUi(repoRoot, env)
  }

  if (!opts.skipBuild) {
    await $`bun run script/build.ts --overlay-server --single --baseline`.cwd(opencorvusRoot).env(env)
  }

  await fs.promises.rm(resolveLegacyLooseBinaryDir(repoRoot), { recursive: true, force: true })

  const artifacts = resolveLinuxBinaryArtifacts(repoRoot)
  for (const artifact of artifacts) {
    await copyBinaryArtifact(artifact)
    await normalizeArtifactExecutablePermissions({ root: artifact.bundleDir, os: "linux" })
    const actualVersion = await verifyBinaryArtifact(artifact)
    if (actualVersion !== env.OPENCORVUS_VERSION) {
      throw new Error(`Unexpected ${artifact.output} version: ${actualVersion}; expected ${env.OPENCORVUS_VERSION}`)
    }
  }

  await removeObsoleteSidecarUiDirs(repoRoot)
  for (const artifact of artifacts) {
    await archiveBinaryArtifact(artifact)
    await verifyNativeBinaryArchive(
      {
        id: artifact.target.outputName,
        bundleDir: artifact.bundleDir,
        executable: artifact.output,
        archive: artifact.archive,
      },
      "linux",
    )
  }

  return artifacts
}

async function main() {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  const artifacts = await packageLinuxBinary(repoRoot, parsePackageLinuxBinaryArgs(process.argv.slice(2)))

  console.log("Linux runtime bundles:")
  for (const artifact of artifacts) {
    const stat = await fs.promises.stat(artifact.archive)
    console.log(`  ${path.relative(repoRoot, artifact.archive)} (${Math.round(stat.size / 1024 / 1024)} MiB)`)
  }
}

if (import.meta.main) {
  await main()
}
