import releaseManifest from "../../public/downloads/latest.json"

/**
 * Desktop installers for the hero download control.
 *
 * Imported, not read from disk. The first version of this used `readFileSync` against a path
 * derived from `import.meta.url`, which resolves correctly in source and to nothing at all once the
 * SSR bundle is built — the manifest silently came back null in production and every reader saw the
 * bare fallback. A static import is resolved by the bundler, so it either builds or it does not.
 *
 * The menu is therefore server-rendered: every platform is a real link in the HTML before any
 * script runs. Detection only picks a default, and a reader with JavaScript off still gets every
 * installer rather than a dead button.
 */

export type DownloadAsset = {
  readonly id: string
  readonly platform: "windows" | "macos" | "linux"
  readonly architecture: "x64" | "arm64"
  readonly format: string
  readonly fileName: string
  readonly bytes: number
  readonly url: string
  readonly compatible?: boolean
}

export type DownloadGroup = {
  readonly platform: DownloadAsset["platform"]
  readonly label: string
  readonly assets: readonly DownloadAsset[]
}

export type DownloadManifest = {
  readonly version: string
  readonly releaseUrl: string
  readonly groups: readonly DownloadGroup[]
}

const PLATFORM_LABEL: Record<DownloadAsset["platform"], string> = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
}

/** Most-wanted installer first, per platform. Mirrors the client-side detection order. */
const FORMAT_ORDER: Record<DownloadAsset["platform"], string[]> = {
  windows: ["EXE", "MSI"],
  macos: ["DMG"],
  linux: ["AppImage", "DEB", "RPM"],
}

export function readDownloadManifest(): DownloadManifest | null {
  try {
    const parsed = releaseManifest as unknown as {
      version?: string
      releaseUrl?: string
      assets?: DownloadAsset[]
    }
    if (!parsed.releaseUrl || !parsed.assets?.length) return null

    // Desktop installers only. The CLI tarballs belong with the source-build instructions, not in a
    // control whose whole promise is "click this and the app runs".
    const desktop = parsed.assets.filter((asset) => (asset as { product?: string }).product === "desktop")

    const groups = (["windows", "macos", "linux"] as const)
      .map((platform) => ({
        platform,
        label: PLATFORM_LABEL[platform],
        assets: desktop
          .filter((asset) => asset.platform === platform)
          .sort((left, right) => {
            const order = FORMAT_ORDER[platform]
            const byArch = left.architecture.localeCompare(right.architecture)
            const byFormat = order.indexOf(left.format) - order.indexOf(right.format)
            return byArch !== 0 ? byArch : byFormat
          }),
      }))
      .filter((group) => group.assets.length > 0)

    if (groups.length === 0) return null
    return { version: parsed.version ?? "", releaseUrl: parsed.releaseUrl, groups }
  } catch {
    // A missing or half-written manifest must not fail the build. The control falls back to the
    // releases page, which is always a correct answer.
    return null
  }
}

/** Human file size. Kept here so the same rounding is used server- and client-side. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return ""
  const mib = bytes / (1024 * 1024)
  return mib >= 1024 ? `${(mib / 1024).toFixed(1)} GiB` : `${Math.round(mib)} MiB`
}
