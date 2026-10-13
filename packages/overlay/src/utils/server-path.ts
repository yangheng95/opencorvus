/** Absolute server paths determine syntax; the browser's platform does not. */
export function isAbsoluteServerPath(path: string): boolean {
  return /^(?:[A-Za-z]:[\\/]|[\\/]{2}|\/)/.test(path)
}

export function isWindowsPath(path: string): boolean {
  return /^(?:[A-Za-z]:[\\/]|\\\\[^\\]|\/\/[^/])/.test(path)
}

export function pathWithForwardSeparators(path: string, serverPath: string): string {
  return isWindowsPath(serverPath) ? path.replaceAll("\\", "/") : path
}

/** Lexical normalization retains filename case and never resolves filesystem aliases. */
export function normalizeServerPath(path: string, windows: boolean): string {
  const normalized = windows ? path.replaceAll("\\", "/") : path
  const drive = windows ? /^([a-z]):(\/)?(.*)$/i.exec(normalized) : null
  const unc = windows && !drive ? /^\/{2,}([^/]+)\/+([^/]+)(?:\/+|$)(.*)$/.exec(normalized) : null
  const absolute = Boolean(drive?.[2] || unc || normalized.startsWith("/"))
  const root = drive
    ? `${drive[1]}:${drive[2] ? "/" : ""}`
    : unc
      ? `//${unc[1]}/${unc[2]}`
      : normalized.startsWith("/")
        ? "/"
        : ""
  const remainder = drive ? drive[3]! : unc ? unc[3]! : normalized.replace(/^\/+/, "")
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
