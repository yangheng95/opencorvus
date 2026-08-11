#!/usr/bin/env bun

import fs from "node:fs/promises"
import path from "node:path"
import { compare } from "semver"

import { cliArchiveNames, overlayBundlePatterns } from "./release-asset-contract"
import { releaseVersionMetadata } from "./sync-version"

export const WEBSITE_DOWNLOAD_PROTOCOL = "opencorvus/website-downloads@1" as const

export type WebsiteDownloadAsset = {
  id: string
  product: "desktop" | "cli"
  platform: "windows" | "macos" | "linux"
  architecture: "x64" | "arm64"
  format: "EXE" | "MSI" | "DMG" | "AppImage" | "DEB" | "RPM" | "TAR.GZ"
  fileName: string
  bytes: number
  url: string
  compatible: boolean
}

export type WebsiteDownloadManifest = {
  protocol: typeof WEBSITE_DOWNLOAD_PROTOCOL
  version: string
  publishedAt: string
  releaseUrl: string
  prerelease: boolean
  assets: WebsiteDownloadAsset[]
}

type GitHubReleaseAsset = {
  name?: unknown
  size?: unknown
  browser_download_url?: unknown
}

type GitHubRelease = {
  tag_name?: unknown
  draft?: unknown
  prerelease?: unknown
  published_at?: unknown
  html_url?: unknown
  assets?: unknown
}

type NativeRow = {
  nativePlatform: "windows-x64" | "darwin-x64" | "darwin-arm64" | "linux-x64" | "linux-arm64"
  platform: WebsiteDownloadAsset["platform"]
  architecture: WebsiteDownloadAsset["architecture"]
}

const NATIVE_ROWS: readonly NativeRow[] = [
  { nativePlatform: "windows-x64", platform: "windows", architecture: "x64" },
  { nativePlatform: "darwin-x64", platform: "macos", architecture: "x64" },
  { nativePlatform: "darwin-arm64", platform: "macos", architecture: "arm64" },
  { nativePlatform: "linux-x64", platform: "linux", architecture: "x64" },
  { nativePlatform: "linux-arm64", platform: "linux", architecture: "arm64" },
]

function eligibleRelease(value: GitHubRelease) {
  if (value.draft !== false || typeof value.tag_name !== "string") return undefined
  try {
    const metadata = releaseVersionMetadata(value.tag_name)
    if (value.tag_name !== `v${metadata.version}`) return undefined
    return { release: value, ...metadata }
  } catch {
    return undefined
  }
}

function normalizedDate(value: unknown, label: string) {
  if (typeof value !== "string") throw new Error(`${label} is missing`)
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.valueOf())) throw new Error(`${label} is invalid: ${value}`)
  return parsed.toISOString()
}

function requiredString(value: unknown, label: string) {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label} is missing`)
  return value
}

function releaseAssetUrl(asset: GitHubReleaseAsset, version: string, name: string) {
  const raw = requiredString(asset.browser_download_url, `Release asset URL for ${name}`)
  const url = new URL(raw)
  const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent)
  const tagIndex = parts.findIndex((part, index) => part === "download" && parts[index - 1] === "releases") + 1
  if (
    url.protocol !== "https:" ||
    url.hostname !== "github.com" ||
    tagIndex === 0 ||
    parts[tagIndex] !== `v${version}` ||
    parts[tagIndex + 1] !== name
  ) {
    throw new Error(`Release asset URL is not bound to v${version}: ${raw}`)
  }
  return raw
}

function formatFor(name: string): WebsiteDownloadAsset["format"] {
  if (name.endsWith(".tar.gz")) return "TAR.GZ"
  if (name.endsWith(".AppImage")) return "AppImage"
  if (name.endsWith(".exe")) return "EXE"
  if (name.endsWith(".msi")) return "MSI"
  if (name.endsWith(".dmg")) return "DMG"
  if (name.endsWith(".deb")) return "DEB"
  if (name.endsWith(".rpm")) return "RPM"
  throw new Error(`Unsupported website download format: ${name}`)
}

function publicAsset(
  input: GitHubReleaseAsset,
  version: string,
  row: NativeRow,
  product: WebsiteDownloadAsset["product"],
): WebsiteDownloadAsset {
  const fileName = requiredString(input.name, "Release asset name")
  const bytes = input.size
  if (typeof bytes !== "number" || !Number.isSafeInteger(bytes) || bytes <= 0) {
    throw new Error(`Release asset size is invalid: ${fileName}`)
  }
  const compatible = product === "cli" && fileName.includes("-baseline")
  const format = formatFor(fileName)
  return {
    id: [product, row.platform, row.architecture, format.toLowerCase().replaceAll(".", "-"), compatible && "compatible"]
      .filter(Boolean)
      .join("-"),
    product,
    platform: row.platform,
    architecture: row.architecture,
    format,
    fileName,
    bytes,
    url: releaseAssetUrl(input, version, fileName),
    compatible,
  }
}

function requireAsset(assets: GitHubReleaseAsset[], predicate: (name: string) => boolean, label: string) {
  const matches = assets.filter((asset) => typeof asset.name === "string" && predicate(asset.name))
  if (matches.length !== 1)
    throw new Error(`${label} must resolve to exactly one Release asset; found ${matches.length}`)
  return matches[0]!
}

export function generateWebsiteDownloadManifest(
  releases: GitHubRelease[],
  dispatchedVersion?: string,
): WebsiteDownloadManifest {
  if (!Array.isArray(releases)) throw new Error("GitHub Releases input must be an array")
  const eligible = releases.flatMap((release) => {
    const result = eligibleRelease(release)
    return result ? [result] : []
  })
  if (eligible.length === 0) throw new Error("No published canonical OpenCorvus Release was found")

  if (dispatchedVersion) {
    const expected = releaseVersionMetadata(dispatchedVersion).version
    if (!eligible.some(({ version }) => version === expected)) {
      throw new Error(`Dispatched Release is not published: v${expected}`)
    }
  }

  const selected = [...eligible].sort((left, right) => compare(right.version, left.version))[0]!
  const release = selected.release
  const releaseUrl = requiredString(release.html_url, `Release URL for v${selected.version}`)
  const parsedReleaseUrl = new URL(releaseUrl)
  if (
    parsedReleaseUrl.protocol !== "https:" ||
    parsedReleaseUrl.hostname !== "github.com" ||
    !parsedReleaseUrl.pathname.endsWith(`/releases/tag/v${selected.version}`)
  ) {
    throw new Error(`Release URL is not bound to v${selected.version}: ${releaseUrl}`)
  }
  if (!Array.isArray(release.assets)) throw new Error(`Release assets are missing for v${selected.version}`)
  const assets = release.assets as GitHubReleaseAsset[]
  const names = assets.map((asset) => requiredString(asset.name, "Release asset name"))
  if (new Set(names).size !== names.length)
    throw new Error(`Release contains duplicate asset names: v${selected.version}`)

  const desktop = NATIVE_ROWS.flatMap((row) => {
    const patterns = overlayBundlePatterns(row.nativePlatform, selected.version).filter(
      ({ label }) => label !== "macOS app archive bundle",
    )
    return patterns.map(({ label, pattern }) =>
      publicAsset(
        requireAsset(assets, (name) => pattern.test(name), `${label} for ${row.nativePlatform}`),
        selected.version,
        row,
        "desktop",
      ),
    )
  })
  const cli = NATIVE_ROWS.flatMap((row) =>
    cliArchiveNames(row.nativePlatform).map((expected) =>
      publicAsset(
        requireAsset(assets, (name) => name === expected, `CLI archive ${expected}`),
        selected.version,
        row,
        "cli",
      ),
    ),
  )

  return {
    protocol: WEBSITE_DOWNLOAD_PROTOCOL,
    version: selected.version,
    publishedAt: normalizedDate(release.published_at, `Publication date for v${selected.version}`),
    releaseUrl,
    prerelease: release.prerelease === true,
    assets: [...desktop, ...cli],
  }
}

function requiredArg(name: string) {
  const index = process.argv.indexOf(name)
  const value = index >= 0 ? process.argv[index + 1]?.trim() : ""
  if (!value) throw new Error(`Missing required ${name}`)
  return value
}

if (import.meta.main) {
  const releasesPath = path.resolve(requiredArg("--releases-json"))
  const output = path.resolve(requiredArg("--out"))
  const dispatchIndex = process.argv.indexOf("--dispatched-version")
  const dispatchedVersion = dispatchIndex >= 0 ? process.argv[dispatchIndex + 1]?.trim() : undefined
  const releases = JSON.parse(await fs.readFile(releasesPath, "utf8")) as GitHubRelease[]
  const manifest = generateWebsiteDownloadManifest(releases, dispatchedVersion)
  await fs.mkdir(path.dirname(output), { recursive: true })
  await fs.writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`Generated website download manifest v${manifest.version}: ${output}`)
}
