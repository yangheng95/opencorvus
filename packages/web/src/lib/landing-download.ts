import { closeSync, existsSync, openSync, readSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

export type LandingBinaryPlatform = "windows-x64" | "darwin-arm64" | "linux-x64"

export type LandingBinaryDownload = {
  platform: LandingBinaryPlatform
  version: string
  sourceDirectory: string
  destinationDirectory: string
  sourceFileName: string
  downloadFileName: string
  publicRelativePath: string
  bytes: number
  platformName: "Windows" | "macOS" | "Linux"
  system: "Windows 10/11" | "macOS 10.13+" | "Linux"
  architecture: "x64" | "Apple Silicon"
  packageType: "EXE" | "APP archive" | "DEB"
}

type LandingArtifactDefinition = Pick<
  LandingBinaryDownload,
  "platform" | "platformName" | "system" | "architecture" | "packageType"
> & {
  sourceDirectory: string
  publicSuffix: string
  matchesInstaller: (fileName: string, signature: Buffer) => boolean
}

const VERSIONED_ARTIFACT_PATTERN = /^OpenCorvus_([^_]+)_/
const defaultRepoRoot = path.resolve(process.cwd(), "../..")

function startsWithBytes(signature: Buffer, expected: readonly number[]): boolean {
  return expected.every((byte, index) => signature[index] === byte)
}

function readArtifactSignature(filePath: string): Buffer {
  const descriptor = openSync(filePath, "r")
  try {
    const signature = Buffer.alloc(8)
    const bytesRead = readSync(descriptor, signature, 0, signature.length, 0)
    return signature.subarray(0, bytesRead)
  } finally {
    closeSync(descriptor)
  }
}

const landingArtifactDefinitions = [
  {
    platform: "windows-x64",
    sourceDirectory: "packages/overlay/dist-artifacts/windows-x64",
    publicSuffix: "exe",
    platformName: "Windows",
    system: "Windows 10/11",
    architecture: "x64",
    packageType: "EXE",
    matchesInstaller: (fileName, signature) =>
      fileName.startsWith("OpenCorvus_") && fileName.endsWith("-setup.exe") && startsWithBytes(signature, [0x4d, 0x5a]),
  },
  {
    platform: "darwin-arm64",
    sourceDirectory: "packages/overlay/dist-artifacts/darwin-arm64",
    publicSuffix: "tar.gz",
    platformName: "macOS",
    system: "macOS 10.13+",
    architecture: "Apple Silicon",
    packageType: "APP archive",
    matchesInstaller: (fileName, signature) =>
      fileName.startsWith("OpenCorvus_") &&
      fileName.endsWith(".tar.gz") &&
      startsWithBytes(signature, [0x1f, 0x8b, 0x08]),
  },
  {
    platform: "linux-x64",
    sourceDirectory: "packages/overlay/dist-artifacts/linux-x64",
    publicSuffix: "deb",
    platformName: "Linux",
    system: "Linux",
    architecture: "x64",
    packageType: "DEB",
    matchesInstaller: (fileName, signature) =>
      fileName.startsWith("OpenCorvus_") && signature.subarray(0, 8).toString("ascii") === "!<arch>\n",
  },
] as const satisfies readonly LandingArtifactDefinition[]

function discoverPlatformDownload(repoRoot: string, definition: LandingArtifactDefinition): LandingBinaryDownload {
  const sourceDirectory = path.resolve(repoRoot, definition.sourceDirectory)
  const sourceDirectoryStat = statSync(sourceDirectory)
  if (!sourceDirectoryStat.isDirectory()) {
    throw new Error(`Landing ${definition.platform} artifact source is not a directory: ${sourceDirectory}`)
  }

  const installers = readdirSync(sourceDirectory, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isFile()) return []
    const sourcePath = path.join(sourceDirectory, entry.name)
    const signature = readArtifactSignature(sourcePath)
    return definition.matchesInstaller(entry.name, signature) ? [{ fileName: entry.name, sourcePath }] : []
  })
  if (installers.length !== 1) {
    throw new Error(
      `Landing ${definition.platform} must resolve to exactly one canonical installer under ${sourceDirectory}; found ${installers.length}`,
    )
  }

  const installer = installers[0]!
  const sourceStat = statSync(installer.sourcePath)
  if (sourceStat.size === 0) throw new Error(`Landing ${definition.platform} installer is empty: ${installer.sourcePath}`)
  const version = VERSIONED_ARTIFACT_PATTERN.exec(installer.fileName)?.[1]
  if (!version) throw new Error(`Landing ${definition.platform} installer has no version: ${installer.sourcePath}`)

  const downloadFileName = `OpenCorvus_${version}_${definition.platform}.${definition.publicSuffix}`
  return {
    platform: definition.platform,
    version,
    sourceDirectory,
    destinationDirectory: path.resolve(repoRoot, "packages/web/dist/client/downloads", definition.platform),
    sourceFileName: installer.fileName,
    downloadFileName,
    publicRelativePath: `downloads/${definition.platform}/${downloadFileName}`,
    bytes: sourceStat.size,
    platformName: definition.platformName,
    system: definition.system,
    architecture: definition.architecture,
    packageType: definition.packageType,
  }
}

export function discoverLandingBinaryDownloads(repoRoot = defaultRepoRoot): LandingBinaryDownload[] {
  const downloads = landingArtifactDefinitions.flatMap((definition) =>
    existsSync(path.resolve(repoRoot, definition.sourceDirectory))
      ? [discoverPlatformDownload(repoRoot, definition)]
      : [],
  )
  // A source checkout does not necessarily contain release-matrix installers.
  // The landing renders documentation, source, and release actions when this
  // list is empty; it never presents the source repository as a web app.
  if (downloads.length === 0) return []
  const versions = new Set(downloads.map((download) => download.version))
  if (versions.size !== 1) {
    throw new Error(`Landing platform installer versions must match; found ${[...versions].join(", ")}`)
  }
  return downloads
}
