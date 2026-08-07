import os from "node:os"
import path from "node:path"
import { createRequire } from "node:module"

const PACKAGE_NAME = "opencorvus"
const CLI_BINARY_PACKAGE = /^opencorvus-(linux|darwin|windows)-(x64|arm64)(-baseline)?(-musl)?$/

export function isPublishedCliBinaryPackageName(name) {
  return CLI_BINARY_PACKAGE.test(name)
}

export function publishedPackagePlatform(platform = os.platform()) {
  switch (platform) {
    case "darwin":
      return "darwin"
    case "linux":
      return "linux"
    case "win32":
      return "windows"
    default:
      throw new Error(`Unsupported opencorvus platform: ${platform}`)
  }
}

export function publishedPackageArch(arch = os.arch()) {
  switch (arch) {
    case "arm64":
      return "arm64"
    case "x64":
      return "x64"
    default:
      throw new Error(`Unsupported opencorvus architecture: ${arch}`)
  }
}

export function resolvePublishedBinaryDescriptor(runtime = {}) {
  const platform = publishedPackagePlatform(runtime.platform)
  const arch = publishedPackageArch(runtime.arch)
  const sourceBinaryName = platform === "windows" ? `${PACKAGE_NAME}.exe` : PACKAGE_NAME
  const installedBinaryName = platform === "windows" ? `.${PACKAGE_NAME}.exe` : `.${PACKAGE_NAME}`
  return {
    platform,
    arch,
    binaryPackageName: `${PACKAGE_NAME}-${platform}-${arch}`,
    sourceBinaryName,
    installedBinaryName,
  }
}

export function resolveInstalledBinaryPath(wrapperRoot, runtime = {}) {
  const descriptor = resolvePublishedBinaryDescriptor(runtime)
  return path.join(wrapperRoot, "bin", descriptor.installedBinaryName)
}

export function resolveOptionalBinarySourcePath(requireFrom = import.meta.url, runtime = {}) {
  const descriptor = resolvePublishedBinaryDescriptor(runtime)
  const runtimeRequire = typeof requireFrom === "function" ? requireFrom : createRequire(requireFrom)
  const packageJsonPath = runtimeRequire.resolve(`${descriptor.binaryPackageName}/package.json`)
  const packageDir = path.dirname(packageJsonPath)
  return {
    ...descriptor,
    packageJsonPath,
    packageDir,
    sourceBinaryPath: path.join(packageDir, descriptor.sourceBinaryName),
  }
}
