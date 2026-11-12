const WINDOWS_DRIVE_PREFIX = /^([a-z]):(\/)?/i

/** Absolute server paths determine syntax; the browser's platform does not. */
export function isAbsoluteServerPath(path: string): boolean {
  return /^(?:[A-Za-z]:[\\/]|[\\/]{2}|\/)/.test(path)
}

export function isWindowsPath(path: string): boolean {
  return /^(?:[A-Za-z]:[\\/]|\\\\[^\\]|\/\/[^/])/.test(path)
}

/** Convert a persisted file URL using the server's path syntax. */
export function serverFileUrlPath(value: string, directory: string): string {
  const url = new URL(value)
  const windows = isWindowsPath(directory)
  const escapedSeparator = windows ? /%(?:2f|5c)/i : /%2f/i
  if (url.protocol !== "file:" || escapedSeparator.test(url.pathname) || (!windows && url.hostname)) {
    throw new TypeError("Invalid server file URL")
  }
  const pathname = decodeURIComponent(url.pathname)
  if (pathname.includes("\0")) throw new TypeError("Invalid server file URL")
  if (!windows) return pathname
  if (url.hostname) return `//${url.hostname}${pathname}`
  const absolute = pathname.slice(1)
  if (!WINDOWS_DRIVE_PREFIX.exec(absolute)?.[2]) throw new TypeError("Invalid Windows file URL")
  return absolute
}

export function pathWithForwardSeparators(path: string, serverPath: string): string {
  return isWindowsPath(serverPath) ? path.replaceAll("\\", "/") : path
}

/** Classify raw input before resolving it against a project directory. */
export function classifyProjectPathInput(path: string, directory: string): "relative" | "rooted" {
  const normalized = pathWithForwardSeparators(path, directory)
  return normalized.startsWith("/") || (isWindowsPath(directory) && WINDOWS_DRIVE_PREFIX.test(normalized))
    ? "rooted"
    : "relative"
}

/** Lexical normalization retains filename case and never resolves filesystem aliases. */
export function normalizeServerPath(path: string, windows: boolean): string {
  const normalized = windows ? path.replaceAll("\\", "/") : path
  const drive = windows ? WINDOWS_DRIVE_PREFIX.exec(normalized) : null
  const unc = windows && !drive ? /^\/{2,}([^/]+)\/+([^/]+)(?:\/+|$)(.*)$/.exec(normalized) : null
  const absolute = Boolean(drive?.[2] || unc || normalized.startsWith("/"))
  const root = drive
    ? `${drive[1]}:${drive[2] ? "/" : ""}`
    : unc
      ? `//${unc[1]}/${unc[2]}`
      : normalized.startsWith("/")
        ? "/"
        : ""
  const remainder = drive ? normalized.slice(drive[0].length) : unc ? unc[3]! : normalized.replace(/^\/+/, "")
  const segments: string[] = []
  for (const segment of remainder.split(/\/+/)) {
    if (!segment || segment === ".") continue
    if (segment === "..") {
      if (segments.length > 0 && segments.at(-1) !== "..") segments.pop()
      else if (!absolute) segments.push(segment)
      continue
    }
    segments.push(segment)
  }
  const suffix = segments.join("/")
  const driveRelative = Boolean(drive && !drive[2])
  return driveRelative || root.endsWith("/") || !root ? `${root}${suffix}` : `${root}${suffix ? "/" : ""}${suffix}`
}

/** Canonical project-relative keys preserve every filename character. */
export function normalizeProjectFilePath(path: string, directory: string): string {
  const windows = isWindowsPath(directory)
  const base = normalizeServerPath(directory, windows)
  const separator = base && !base.endsWith("/") ? "/" : ""
  const full = normalizeServerPath(`${base}${separator}${path}`, windows)
  const baseSegments = base.split("/").filter(Boolean)
  const fullSegments = full.split("/").filter(Boolean)
  let common = 0
  while (common < baseSegments.length && common < fullSegments.length) {
    const baseSegment = baseSegments[common]!
    const fullSegment = fullSegments[common]!
    if (windows ? baseSegment.toLowerCase() !== fullSegment.toLowerCase() : baseSegment !== fullSegment) break
    common += 1
  }
  return [...Array(baseSegments.length - common).fill(".."), ...fullSegments.slice(common)].join("/")
}

/** Explicit document resources use the document's parent under the server's syntax. */
export function resolveDocumentFilePath(
  reference: string,
  document: { directory: string; path: string; sourceAbsolutePath?: string },
): string {
  if (isAbsoluteServerPath(reference)) return reference
  const source = document.sourceAbsolutePath ?? document.path
  const file = pathWithForwardSeparators(source, document.sourceAbsolutePath ?? document.directory)
  const relative = file.slice(0, file.lastIndexOf("/") + 1) + reference
  return document.sourceAbsolutePath
    ? normalizeServerPath(relative, isWindowsPath(source))
    : normalizeProjectFilePath(relative, document.directory)
}
