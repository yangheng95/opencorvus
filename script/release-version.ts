const semverPattern = /^\d+\.\d+\.\d+(?:-([0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*))?$/
const compactPrereleasePattern = /^(\d+\.\d+\.\d+)([A-Za-z][0-9A-Za-z]*(?:[.-][0-9A-Za-z]+)*)$/

export function normalizeReleaseVersion(input?: string) {
  const value = input?.trim()
  if (!value) return undefined
  const unprefixed = value.replace(/^v(?=\d)/, "")
  const compact = unprefixed.match(compactPrereleasePattern)
  const version = compact ? `${compact[1]}-${compact[2]}` : unprefixed
  if (!semverPattern.test(version)) {
    throw new Error(`Invalid version: ${value}. Use x.y.z, x.y.z-tag, x.y.ztag, or the same value prefixed with v.`)
  }
  return version
}

export function releaseVersionMetadata(input?: string) {
  const version = normalizeReleaseVersion(input)
  if (!version) throw new Error("Release version is required")
  const parsed = version.match(semverPattern)
  if (!parsed) throw new Error(`Cannot derive release metadata from invalid version: ${version}`)
  return { version, prerelease: parsed[1] !== undefined }
}
