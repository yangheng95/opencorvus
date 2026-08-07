// ── Release-version bump ──
//
// audit-2026-04-29 W2-V20. Lifted out of script/src/index.ts so the
// pure semver-bump logic is unit-testable without executing the
// host module's top-level `await $\`git branch\`` + npm registry
// fetch.

/**
 * Pre-fix `latestVersion.split(".").map((x) => Number(x) || 0)`
 * silently degraded to [N, N, 0] on a prerelease tag
 * (`1.0.0-rc.1` split → ["1","0","0-rc","1"] → Number("0-rc") =
 * NaN → || 0 → 0, so the patch component became 0 and the -rc.N
 * metadata vanished). If npm "latest" tag was ever pointed at a
 * prerelease (operator error, accidental npm dist-tag update) the
 * bump produced a version that had ALREADY been published — the
 * upload silently 409'd or overwrote.
 *
 * Reject anything that doesn't match strict X.Y.Z so the operator
 * sees the issue at build-time rather than after a botched
 * release.
 */
export function computeNextVersion(latestVersion: string, bump?: string): string {
  const semverMatch = latestVersion.match(/^(\d+)\.(\d+)\.(\d+)$/)
  if (!semverMatch) {
    throw new Error(
      `npm latest version "${latestVersion}" is not a clean X.Y.Z release; ` +
        `cannot compute next bump. Either retag the npm "latest" dist-tag at a ` +
        `stable release, or pass env.VERSION explicitly.`,
    )
  }
  const major = Number(semverMatch[1])
  const minor = Number(semverMatch[2])
  const patch = Number(semverMatch[3])
  const normalised = bump?.toLowerCase()
  if (normalised === "major") return `${major + 1}.0.0`
  if (normalised === "minor") return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}
