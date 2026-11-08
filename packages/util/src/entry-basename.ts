export type EntryBasenameStatus = "valid" | "empty" | "path" | "windows-invalid" | "windows-reserved"

// Windows device aliases remain reserved when followed by a filename extension.
const windowsReservedDeviceNamePattern = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i

/** Classify a component under the host file-mutation policy without runtime or filesystem access. */
export function classifyEntryBasename(name: string, windows: boolean): EntryBasenameStatus {
  if (!name || name === "." || name === "..") return "empty"
  if (name.includes("/") || name.includes("\\") || name.includes("\0")) return "path"
  if (windows && /[<>:"|?*\x00-\x1F]/.test(name)) return "windows-invalid"
  if (windows && (/[. ]$/.test(name) || windowsReservedDeviceNamePattern.test(name))) return "windows-reserved"
  return "valid"
}
