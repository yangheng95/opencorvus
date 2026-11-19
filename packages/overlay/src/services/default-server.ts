import serverDefaults from "../../../opencorvus/server-defaults.json"

export const DEFAULT_LOCAL_SERVER_URL = `http://${serverDefaults.host}:${serverDefaults.port}`

export function defaultServerFromModule(documentOrigin: string | undefined, moduleUrl: URL): string {
  if (moduleUrl.origin !== documentOrigin || (moduleUrl.protocol !== "http:" && moduleUrl.protocol !== "https:")) {
    return DEFAULT_LOCAL_SERVER_URL
  }

  // The service publishes bundled modules under its UI mount. The module's
  // directory stays at that mount even when either path contains another ui.
  const directory = new URL(".", moduleUrl)
  const assetsPath = "/ui/assets/"
  if (!directory.pathname.endsWith(assetsPath)) return DEFAULT_LOCAL_SERVER_URL
  return directory.origin + directory.pathname.slice(0, -assetsPath.length)
}

export const DEFAULT_SERVER = defaultServerFromModule(
  typeof window === "undefined" ? undefined : window.location?.origin,
  new URL(import.meta.url),
)
