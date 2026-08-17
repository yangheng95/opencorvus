import { releaseVersionMetadata } from "./release-version"

export type DesktopUpdateChannel = "beta" | "stable"

export function desktopUpdateChannel(version: string): DesktopUpdateChannel {
  return releaseVersionMetadata(version).prerelease ? "beta" : "stable"
}

export function desktopUpdateChannelTag(channel: DesktopUpdateChannel): string {
  return `desktop-update-${channel}`
}

export function desktopUpdateEndpoint(repository: string, version: string): string {
  const channel = desktopUpdateChannel(version)
  return `https://github.com/${repository}/releases/download/${desktopUpdateChannelTag(channel)}/latest.json`
}
