import serverDefaults from "../../../opencorvus/server-defaults.json"

export const DEFAULT_LOCAL_SERVER_URL = `http://${serverDefaults.host}:${serverDefaults.port}`

function prefixedServerUrlFromOverlayLocation(
  location: Pick<Location, "origin" | "pathname" | "protocol">,
): string | null {
  if (!location.protocol.startsWith("http")) return null
  const segments = location.pathname.split("/").filter(Boolean)
  const uiIndex = segments.indexOf("ui")
  if (uiIndex < 0) return null
  const prefix = segments.slice(0, uiIndex).join("/")
  return prefix ? `${location.origin}/${prefix}` : location.origin
}

export function originOnlyServerUrlFromOverlayLocation(
  location: Pick<Location, "origin" | "pathname" | "protocol">,
): string | null {
  if (!location.protocol.startsWith("http")) return null
  const segments = location.pathname.split("/").filter(Boolean)
  return segments.includes("ui") ? location.origin : null
}

export function serverUrlFromOverlayLocation(
  location: Pick<Location, "origin" | "pathname" | "protocol">,
): string | null {
  return prefixedServerUrlFromOverlayLocation(location)
}

export function currentDefaultServer(): string {
  if (typeof window !== "undefined" && window.location) {
    return serverUrlFromOverlayLocation(window.location) ?? DEFAULT_LOCAL_SERVER_URL
  }
  return DEFAULT_LOCAL_SERVER_URL
}

export const DEFAULT_SERVER = currentDefaultServer()
