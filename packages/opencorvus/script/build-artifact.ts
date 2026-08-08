import { createRequire } from "node:module"
import path from "node:path"
import { nodeBinaryPackageName, nodeExecutableName } from "@opencorvus-ai/util/node-runtime"

export type BuildFlavor = "cli" | "overlay-server"

export function parseBuildFlavor(argv: string[]): BuildFlavor {
  return argv.includes("--overlay-server") ? "overlay-server" : "cli"
}

export function artifactPackageBaseName(pkgName: string, flavor: BuildFlavor): string {
  if (flavor === "overlay-server") return `${pkgName}-overlay-server`
  return pkgName
}

export function artifactEntrypoints(flavor: BuildFlavor): string[] {
  if (flavor === "overlay-server") return ["./src/overlay-launcher.ts"]
  return ["./src/launcher.ts"]
}

export function artifactExternalModules(): string[] {
  return [
    // Playwright exposes Electron support as an optional runtime path. The
    // packaged server uses Chromium only, so the compiler must not require
    // Electron to be installed just because Playwright's package graph names it.
    "electron",
    // Playwright carries runtime package-relative resolution (browser registry,
    // protocol helpers, and optional BiDi modules). Bun compile must leave it as
    // a packaged node_modules dependency instead of flattening it into the exe.
    "playwright",
    "playwright-core",
    "chromium-bidi",
    // AWS SDK credential providers contain dynamic credential-chain imports
    // that Bun can rewrite into missing intermediate chunks during bundling.
    // Keep the credential chain in packaged node_modules just like browser and
    // native runtime dependencies.
    "@aws-sdk/credential-providers",
    // Native Node packages must resolve from the executable directory's
    // co-located node_modules tree. Bun compile cannot make their platform
    // .node files available through normal package resolution by itself.
    "@parcel/watcher",
    "@parcel/watcher/wrapper",
    "@lydell/node-pty",
    "node-screenshots",
    "sharp",
    // CUA means Computer Use Agent. Its generated TypeScript binding resolves
    // a target-specific Node-API library from packaged node_modules at runtime.
    "@trycua/cua-driver",
  ]
}

export function artifactBrowserMcpNodeExternalModules(): string[] {
  return artifactExternalModules()
}

export function artifactBrowserMcpNodeRuntimeModules(): ArtifactRuntimeNodeModule[] {
  return [{ name: "playwright" }]
}

export async function buildArtifactBrowserMcpNodeBundle(input: {
  entrypoint: string
  outdir?: string
}) {
  return Bun.build({
    entrypoints: [input.entrypoint],
    ...(input.outdir ? { outdir: input.outdir } : {}),
    target: "node",
    external: artifactBrowserMcpNodeExternalModules(),
  })
}

export function artifactSourcemap(): "none" {
  return "none"
}

export function artifactBrowserMcpNodeExecutableName(os = process.platform): string {
  return os === "win32" || os.startsWith("windows") ? "node.exe" : "node"
}

export function artifactExecutableName(os = process.platform): string {
  return os === "win32" || os.startsWith("windows") ? "opencorvus.exe" : "opencorvus"
}

export function artifactRipgrepExecutableName(os = process.platform): string {
  return os === "win32" || os.startsWith("windows") ? "rg.exe" : "rg"
}

// CLI means Command-Line Interface.
export function artifactOfficeCliExecutableName(os = process.platform): string {
  return os === "win32" || os.startsWith("windows") ? "officecli.exe" : "officecli"
}

export function artifactEmbeddedExecutableRelativePaths(os = process.platform): string[] {
  const executables = [
    artifactExecutableName(os),
    path.join("bin", artifactRipgrepExecutableName(os)),
    path.join("bin", artifactOfficeCliExecutableName(os)),
    path.join("browser-mcp-node", artifactBrowserMcpNodeExecutableName(os)),
  ]
  if (os === "win32" || os.startsWith("windows")) executables.push("opencorvus-process-supervisor.exe")
  return executables
}

export interface ArtifactNodeRuntimeTarget {
  os: string
  arch: string
  abi?: "musl"
}

export interface ArtifactNodeRuntimeHost {
  platform: string
  arch: string
  // libc is the Linux C standard library implementation: glibc or musl.
  linuxLibc?: "glibc" | "musl"
}

export interface ArtifactRuntimeNodeModule {
  name: string
  runtimeDependencies?: string[]
  nodeFileCopy?: boolean
}

export function artifactHostCanProvideNodeRuntime(
  target: ArtifactNodeRuntimeTarget,
  host: ArtifactNodeRuntimeHost,
): boolean {
  if (target.os !== host.platform || target.arch !== host.arch) return false
  if (target.os !== "linux") return target.abi === undefined
  return (target.abi ?? "glibc") === host.linuxLibc
}

export function artifactRuntimeNodeModules(target: ArtifactNodeRuntimeTarget): ArtifactRuntimeNodeModule[] {
  const modules: ArtifactRuntimeNodeModule[] = [
    { name: "playwright" },
    { name: "playwright-core" },
    { name: "chromium-bidi" },
    { name: "@aws-sdk/credential-providers" },
    // Expert-squad package tools compile at runtime and need the plugin
    // Application Programming Interface package as a real filesystem module.
    { name: "@opencorvus-ai/plugin" },
    // Package tools compile the TypeScript compiler into their content-addressed
    // closure; packaged runtimes must provide it to the runtime compiler locally.
    { name: "typescript" },
    { name: "@lydell/node-pty", runtimeDependencies: [nodePtyNativePackageName(target)] },
    { name: "sharp", runtimeDependencies: sharpNativePackageNames(target) },
    { name: "@parcel/watcher", runtimeDependencies: [parcelWatcherNativePackageName(target)] },
    { name: "node-screenshots", runtimeDependencies: nodeScreenshotsNativePackageNames(target) },
  ]
  const cuaRuntimeDependencies = cuaDriverRuntimePackageNames(target)
  if (cuaRuntimeDependencies.length > 0) {
    modules.push({ name: "@trycua/cua-driver", runtimeDependencies: cuaRuntimeDependencies })
  }
  return modules
}

export function artifactRuntimeNodeModuleNames(target: ArtifactNodeRuntimeTarget): string[] {
  return artifactRuntimeNodeModules(target).flatMap((item) => [item.name, ...(item.runtimeDependencies ?? [])])
}

export function artifactPinnedNodeRuntimeExecutable(
  packageRoot: string,
  target: Pick<ArtifactNodeRuntimeTarget, "os" | "arch">,
) {
  const platform = target.os as NodeJS.Platform
  const packageName = nodeBinaryPackageName(platform, target.arch as NodeJS.Architecture)
  const packageJson = createRequire(path.join(packageRoot, "package.json")).resolve(`${packageName}/package.json`)
  return path.join(path.dirname(packageJson), "bin", nodeExecutableName(platform))
}

function sharpNativePackageNames(target: ArtifactNodeRuntimeTarget): string[] {
  if (target.os === "win32") return [`@img/sharp-win32-${target.arch}`]
  if (target.os === "darwin") return [`@img/sharp-darwin-${target.arch}`, `@img/sharp-libvips-darwin-${target.arch}`]
  if (target.os === "linux") {
    const family = target.abi === "musl" ? "linuxmusl" : "linux"
    return [`@img/sharp-${family}-${target.arch}`, `@img/sharp-libvips-${family}-${target.arch}`]
  }
  return []
}

function parcelWatcherNativePackageName(target: ArtifactNodeRuntimeTarget): string {
  if (target.os === "linux") {
    return `@parcel/watcher-linux-${target.arch}-${target.abi ?? "glibc"}`
  }
  return `@parcel/watcher-${target.os}-${target.arch}`
}

function nodePtyNativePackageName(target: ArtifactNodeRuntimeTarget): string {
  return `@lydell/node-pty-${target.os}-${target.arch}`
}

function nodeScreenshotsNativePackageNames(target: ArtifactNodeRuntimeTarget): string[] {
  if (target.os === "win32") return [`node-screenshots-win32-${target.arch}-msvc`]
  if (target.os === "darwin") return [`node-screenshots-darwin-${target.arch}`]
  if (target.os === "linux") {
    if (target.arch === "arm64" && target.abi === "musl") return []
    return [`node-screenshots-linux-${target.arch}-${target.abi === "musl" ? "musl" : "gnu"}`]
  }
  return []
}

function cuaDriverRuntimePackageNames(target: ArtifactNodeRuntimeTarget): string[] {
  if (target.os === "linux" && target.abi === "musl") return []
  const platform = target.os === "linux" ? "linux" : target.os
  const family = target.os === "win32" ? "msvc" : target.os === "linux" ? "gnu" : undefined
  const suffix = `${platform}-${target.arch}${family ? `-${family}` : ""}`
  return [`@trycua/cua-driver-${suffix}`, `@ubjs/node-${suffix}`]
}
