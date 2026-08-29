import { releaseVersionMetadata } from "./release-version"
import { overlayUpdaterContract } from "./release-asset-contract"

export const DESKTOP_UPDATE_PLATFORMS = [
  "linux-x64",
  "linux-arm64",
  "darwin-x64",
  "darwin-arm64",
  "windows-x64",
] as const

export interface DesktopUpdateManifest {
  version: string
  notes: string
  pub_date: string
  platforms: Record<string, { url: string; signature: string }>
}

export class DesktopUpdateManifestValidationError extends Error {
  readonly code = "desktop_update_manifest_invalid"

  constructor(message: string) {
    super(message)
    this.name = "DesktopUpdateManifestValidationError"
  }
}

export function canonicalDesktopUpdateManifestVersion(value: string): string {
  let version: string
  try {
    version = releaseVersionMetadata(value).version
  } catch {
    throw new DesktopUpdateManifestValidationError(`Desktop update manifest version is invalid: ${value}`)
  }
  if (version !== value) {
    throw new DesktopUpdateManifestValidationError(`Desktop update manifest version must be canonical SemVer: ${value}`)
  }
  return version
}

export function canonicalDesktopUpdatePublicationDate(value: string): string {
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString() !== value) {
    throw new DesktopUpdateManifestValidationError(
      `Desktop update publication date must be canonical RFC 3339 UTC: ${value}`,
    )
  }
  return value
}

function canonicalPlatformURL(input: { value: string; target: string; repository: string; version: string }): string {
  const { value, target, repository, version } = input
  if (!value || value.trim() !== value) {
    throw new DesktopUpdateManifestValidationError(`Desktop update platform ${target} has an invalid URL`)
  }
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new DesktopUpdateManifestValidationError(`Desktop update platform ${target} has an invalid URL`)
  }
  if (url.protocol !== "https:" || url.username || url.password || url.hash || url.search) {
    throw new DesktopUpdateManifestValidationError(
      `Desktop update platform ${target} URL must be an unauthenticated HTTPS asset URL`,
    )
  }
  const contract = DESKTOP_UPDATE_PLATFORMS.map((platform) => overlayUpdaterContract(platform, version)).find(
    (candidate) => candidate.target === target,
  )
  if (!contract) {
    throw new DesktopUpdateManifestValidationError(`Desktop update manifest has an unknown platform target: ${target}`)
  }
  const prefix = `https://github.com/${repository}/releases/download/v${version}/`
  if (!value.startsWith(prefix)) {
    throw new DesktopUpdateManifestValidationError(
      `Desktop update platform ${target} must reference the immutable v${version} Release in ${repository}`,
    )
  }
  const encodedAsset = value.slice(prefix.length)
  let asset: string
  try {
    asset = decodeURIComponent(encodedAsset)
  } catch {
    throw new DesktopUpdateManifestValidationError(`Desktop update platform ${target} has an invalid asset name`)
  }
  if (
    !encodedAsset ||
    encodedAsset.includes("/") ||
    encodeURIComponent(asset) !== encodedAsset ||
    !contract.bundlePattern.test(asset)
  ) {
    throw new DesktopUpdateManifestValidationError(
      `Desktop update platform ${target} does not reference its v${version} updater bundle`,
    )
  }
  return value
}

export function parseDesktopUpdateManifest(text: string, input: { repository: string }): DesktopUpdateManifest {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new DesktopUpdateManifestValidationError("Desktop update manifest returned invalid JSON")
  }
  if (
    typeof value !== "object" ||
    value === null ||
    !("version" in value) ||
    typeof value.version !== "string" ||
    !("notes" in value) ||
    typeof value.notes !== "string" ||
    !("pub_date" in value) ||
    typeof value.pub_date !== "string" ||
    !("platforms" in value) ||
    typeof value.platforms !== "object" ||
    value.platforms === null ||
    Array.isArray(value.platforms)
  ) {
    throw new DesktopUpdateManifestValidationError("Desktop update manifest has an invalid top-level shape")
  }

  const platforms: DesktopUpdateManifest["platforms"] = {}
  const entries = Object.entries(value.platforms)
  if (entries.length === 0) {
    throw new DesktopUpdateManifestValidationError("Desktop update manifest has no platform assets")
  }
  for (const [target, platform] of entries) {
    if (
      typeof platform !== "object" ||
      platform === null ||
      !("url" in platform) ||
      typeof platform.url !== "string" ||
      !("signature" in platform) ||
      typeof platform.signature !== "string" ||
      !platform.signature ||
      platform.signature.trim() !== platform.signature
    ) {
      throw new DesktopUpdateManifestValidationError(
        `Desktop update platform ${target} must contain an asset URL and non-empty signature`,
      )
    }
    platforms[target] = {
      url: platform.url,
      signature: platform.signature,
    }
  }

  const version = canonicalDesktopUpdateManifestVersion(value.version)
  if (!input.repository.match(/^[0-9A-Za-z_.-]+\/[0-9A-Za-z_.-]+$/)) {
    throw new DesktopUpdateManifestValidationError(`Desktop update manifest repository is invalid: ${input.repository}`)
  }
  for (const [target, platform] of Object.entries(platforms)) {
    platform.url = canonicalPlatformURL({
      value: platform.url,
      target,
      repository: input.repository,
      version,
    })
  }
  return {
    version,
    notes: value.notes,
    pub_date: canonicalDesktopUpdatePublicationDate(value.pub_date),
    platforms,
  }
}
