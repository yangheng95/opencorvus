export type OverlayArtifactPlatform = "windows" | "darwin" | "linux"
export type OverlayArtifactArch = "x64" | "arm64"

export function overlayPlatformFromNode(platform = process.platform): OverlayArtifactPlatform {
  if (platform === "win32") return "windows"
  if (platform === "darwin") return "darwin"
  if (platform === "linux") return "linux"
  throw new Error(`Unsupported overlay artifact platform: ${platform}`)
}

export function overlayArchFromNode(arch = process.arch): OverlayArtifactArch {
  if (arch === "arm64") return "arm64"
  if (arch === "x64") return "x64"
  throw new Error(`Unsupported overlay artifact arch: ${arch}`)
}

export function overlayPlatformFromTriple(triple: string): OverlayArtifactPlatform {
  if (triple.includes("windows")) return "windows"
  if (triple.includes("apple-darwin")) return "darwin"
  if (triple.includes("linux")) return "linux"
  throw new Error(`Unsupported overlay target triple platform: ${triple}`)
}

export function overlayArchFromTriple(triple: string): OverlayArtifactArch {
  if (triple.startsWith("aarch64")) return "arm64"
  if (triple.startsWith("x86_64")) return "x64"
  throw new Error(`Unsupported overlay target triple arch: ${triple}`)
}

export function overlayServerFileName(platform: OverlayArtifactPlatform): string {
  return platform === "windows" ? "opencorvus.exe" : "opencorvus"
}

export function overlayExecutableFileName(platform: OverlayArtifactPlatform): string {
  return platform === "windows" ? "opencorvus-overlay.exe" : "opencorvus-overlay"
}

export function overlayServerDistName(platform: OverlayArtifactPlatform, arch: OverlayArtifactArch): string {
  return `opencorvus-overlay-server-${platform}-${arch}`
}

export function overlayPackageName(platform: OverlayArtifactPlatform, arch: OverlayArtifactArch): string {
  return `opencorvus-overlay-${platform}-${arch}`
}
