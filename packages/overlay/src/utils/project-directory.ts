import { normalizeServerPath } from "./server-path"

export interface ProjectDirectoryLabel {
  name: string
  parent: string
}

export interface ProjectDisplayNameInput {
  directory: string
  customName?: string
  unknownName: string
  implicitProjectName?: string
}

const UUID_V4_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isImplicitProjectDirectory(directory: string): boolean {
  const segments = directory.split(/[\\/]/).filter(Boolean)
  if (segments.length < 4) return false
  const [year, month, day, id] = segments.slice(-4)
  return /^\d{4}$/.test(year) && /^\d{2}$/.test(month) && /^\d{2}$/.test(day) && UUID_V4_SEGMENT.test(id)
}

export function implicitProjectSuffix(directory: string): string {
  if (!isImplicitProjectDirectory(directory)) return ""
  const id = directory.split(/[\\/]/).filter(Boolean).at(-1)
  return id?.slice(-6) ?? ""
}

export function projectDirectoryKey(directory: string): string {
  const input = directory.trim()
  if (!input) return "__opencorvus_unassigned_project__"
  const normalized = input.replaceAll("\\", "/")
  const resolved = normalizeServerPath(normalized, true)
  return /^[a-z]:|^\/\/[^/]+\/[^/]+/i.test(resolved) ? resolved.toLowerCase() : resolved
}

export function projectDirectoryLabel(
  directory: string,
  unknownName: string,
  implicitProjectName?: string,
): ProjectDirectoryLabel {
  const normalized = (directory || "").replace(/\\/g, "/").replace(/\/+$/, "")
  if (!normalized) return { name: unknownName, parent: "" }
  if (implicitProjectName && isImplicitProjectDirectory(normalized)) {
    return { name: implicitProjectName, parent: "" }
  }
  const parts = normalized.split("/").filter(Boolean)
  const name = parts[parts.length - 1] || normalized
  const parent =
    parts.length > 1 ? (parts.length > 3 ? ".../" + parts.slice(-3, -1).join("/") : parts.slice(0, -1).join("/")) : ""
  return { name, parent }
}

export function projectDisplayName(input: ProjectDisplayNameInput): string {
  const customName = String(input.customName || "").trim()
  return customName || projectDirectoryLabel(input.directory, input.unknownName, input.implicitProjectName).name
}

export function projectLedgerDisplayName(input: ProjectDisplayNameInput & { implicitProjectName: string }): string {
  if (isImplicitProjectDirectory(input.directory)) {
    return `${input.implicitProjectName} ${implicitProjectSuffix(input.directory)}`
  }
  return projectDisplayName(input)
}

export function projectDirectoryHints(projects: readonly { directory: string; name: string }[]): Map<string, string> {
  const byName = new Map<string, string[]>()
  for (const { directory, name } of projects) {
    if (!directory.trim()) continue
    const peers = byName.get(name) ?? []
    peers.push(directory)
    byName.set(name, peers)
  }
  const hints = new Map<string, string>()
  for (const peers of byName.values()) {
    if (peers.length < 2) continue
    const entries = peers.map((directory) => ({
      directory,
      parts: directory.replaceAll("\\", "/").split("/").filter(Boolean),
      keys: projectDirectoryKey(directory).split("/").filter(Boolean),
    }))
    // A shared folder name is already the heading; compare its parents.
    const sameFolder = entries.every((entry) => entry.keys.at(-1) === entries[0].keys.at(-1))
    if (sameFolder) {
      for (const entry of entries) {
        entry.parts.pop()
        entry.keys.pop()
      }
    }
    for (const entry of entries) {
      let length = 1
      while (length < entry.keys.length && entries.some((other) =>
        other !== entry && other.keys.slice(-length).join("/") === entry.keys.slice(-length).join("/"),
      )) length += 1
      hints.set(entry.directory, entry.parts.slice(-length).join("/") || entry.directory)
    }
  }
  return hints
}
