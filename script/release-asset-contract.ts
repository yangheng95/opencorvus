export type OverlayBundleArchitecture = {
  mac?: string
  windows?: string
  linuxDeb?: string
  linuxAppImage?: string
  linuxRpm?: string
}

export type OverlayBundlePattern = {
  label: string
  pattern: RegExp
  sourcePattern?: RegExp
  assetName?: string
}

export type OverlayUpdaterContract = {
  target: "linux-x86_64" | "linux-aarch64" | "darwin-x86_64" | "darwin-aarch64" | "windows-x86_64"
  label: string
  bundlePattern: RegExp
}

/** CLI means command-line interface; these are the public archive names for one native row. */
export function cliArchiveNames(platform: string): string[] {
  if (platform === "linux-x64") {
    return ["opencorvus-linux-x64.tar.gz", "opencorvus-linux-x64-baseline.tar.gz"]
  }
  if (platform === "linux-arm64") return ["opencorvus-linux-arm64.tar.gz"]
  if (platform === "darwin-x64") {
    return ["opencorvus-darwin-x64.tar.gz", "opencorvus-darwin-x64-baseline.tar.gz"]
  }
  if (platform === "darwin-arm64") return ["opencorvus-darwin-arm64.tar.gz"]
  if (platform === "windows-x64") {
    return ["opencorvus-windows-x64.tar.gz", "opencorvus-windows-x64-baseline.tar.gz"]
  }
  throw new Error(`Unsupported CLI archive platform: ${platform}`)
}

export function escapedVersionPattern(version: string): string {
  return version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function overlayBundleArchitecture(platform: string): OverlayBundleArchitecture {
  if (platform === "windows-x64") return { windows: "x64" }
  if (platform === "darwin-x64") return { mac: "x64" }
  if (platform === "darwin-arm64") return { mac: "aarch64" }
  if (platform === "linux-x64") return { linuxDeb: "amd64", linuxAppImage: "amd64", linuxRpm: "x86_64" }
  if (platform === "linux-arm64") return { linuxDeb: "arm64", linuxAppImage: "aarch64", linuxRpm: "aarch64" }
  throw new Error(`Unsupported overlay bundle platform: ${platform}`)
}

export function overlayBundlePatterns(platform: string, version: string): OverlayBundlePattern[] {
  const versionPattern = escapedVersionPattern(version)
  const arch = overlayBundleArchitecture(platform)
  if (platform.startsWith("windows")) {
    return [
      {
        label: "Windows MSI bundle",
        pattern: new RegExp(`^OpenCorvus_${versionPattern}_${arch.windows}(?:_[A-Za-z0-9-]+)?\\.msi$`),
      },
      {
        label: "Windows NSIS bundle",
        pattern: new RegExp(`^OpenCorvus_${versionPattern}_${arch.windows}(?:_[A-Za-z0-9-]+)?-setup\\.exe$`),
      },
    ]
  }
  if (platform.startsWith("darwin")) {
    return [
      {
        label: "macOS DMG bundle",
        pattern: new RegExp(`^OpenCorvus_${versionPattern}_${arch.mac}\\.dmg$`),
      },
      {
        label: "macOS app archive bundle",
        pattern: new RegExp(`^OpenCorvus_${versionPattern}_${arch.mac}\\.app\\.tar\\.gz$`),
        sourcePattern: /^OpenCorvus\.app\.tar\.gz$/,
        assetName: `OpenCorvus_${version}_${arch.mac}.app.tar.gz`,
      },
    ]
  }
  if (platform.startsWith("linux")) {
    return [
      {
        label: "Linux AppImage bundle",
        pattern: new RegExp(`^OpenCorvus_${versionPattern}_${arch.linuxAppImage}\\.AppImage$`),
      },
      {
        label: "Linux DEB bundle",
        pattern: new RegExp(`^OpenCorvus_${versionPattern}_${arch.linuxDeb}\\.deb$`),
      },
      {
        label: "Linux RPM bundle",
        pattern: new RegExp(`^OpenCorvus-${versionPattern}-[0-9]+\\.${arch.linuxRpm}\\.rpm$`),
      },
    ]
  }
  throw new Error(`Unsupported overlay bundle platform: ${platform}`)
}

export function overlayUpdaterContract(platform: string, version: string): OverlayUpdaterContract {
  const versionPattern = escapedVersionPattern(version)
  const arch = overlayBundleArchitecture(platform)
  if (platform === "windows-x64") {
    return {
      target: "windows-x86_64",
      label: "Windows NSIS updater bundle",
      bundlePattern: new RegExp(`^OpenCorvus_${versionPattern}_${arch.windows}(?:_[A-Za-z0-9-]+)?-setup\\.exe$`),
    }
  }
  if (platform === "darwin-x64" || platform === "darwin-arm64") {
    return {
      target: platform === "darwin-x64" ? "darwin-x86_64" : "darwin-aarch64",
      label: "macOS application updater archive",
      bundlePattern: new RegExp(`^OpenCorvus_${versionPattern}_${arch.mac}\\.app\\.tar\\.gz$`),
    }
  }
  if (platform === "linux-x64" || platform === "linux-arm64") {
    return {
      target: platform === "linux-x64" ? "linux-x86_64" : "linux-aarch64",
      label: "Linux AppImage updater bundle",
      bundlePattern: new RegExp(`^OpenCorvus_${versionPattern}_${arch.linuxAppImage}\\.AppImage$`),
    }
  }
  throw new Error(`Unsupported overlay updater platform: ${platform}`)
}

export function updaterSignatureName(bundleName: string): string {
  return `${bundleName}.sig`
}

export function looksLikeOverlayBundle(filename: string): boolean {
  return /^OpenCorvus(?:[-_]|$)/.test(filename) && /\.(?:dmg|app\.tar\.gz|AppImage|deb|msi|rpm|exe)$/.test(filename)
}
