/** Absolute server paths determine syntax; the browser's platform does not. */
export function isWindowsPath(path: string): boolean {
  return /^(?:[A-Za-z]:[\\/]|\\\\[^\\]|\/\/[^/])/.test(path)
}

export function pathWithForwardSeparators(path: string, serverPath: string): string {
  return isWindowsPath(serverPath) ? path.replaceAll("\\", "/") : path
}

/** Canonical project-relative keys preserve every filename character. */
export function normalizeProjectFilePath(path: string, directory: string): string {
  return pathWithForwardSeparators(path, directory).split("/").filter(Boolean).join("/")
}
