const numericVersion = String.raw`(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)`
const productVersionPattern = new RegExp(`^${numericVersion}(?:-(beta))?$`)
const compactPrereleasePattern = new RegExp(`^(${numericVersion})beta$`)

export function normalizeReleaseVersion(input?: string) {
  const value = input?.trim()
  if (!value) return undefined
  const unprefixed = value.replace(/^v(?=\d)/, "")
  const compact = unprefixed.match(compactPrereleasePattern)
  const version = compact ? `${compact[1]}-beta` : unprefixed
  if (!productVersionPattern.test(version)) {
    throw new Error(`Invalid version: ${value}. Use x.y.z or x.y.z-beta (compact x.y.zbeta is also accepted).`)
  }
  return version
}

export function releaseVersionMetadata(input?: string) {
  const version = normalizeReleaseVersion(input)
  if (!version) throw new Error("Release version is required")
  const parsed = version.match(productVersionPattern)
  if (!parsed) throw new Error(`Cannot derive release metadata from invalid version: ${version}`)
  return { version, prerelease: parsed[1] !== undefined }
}
