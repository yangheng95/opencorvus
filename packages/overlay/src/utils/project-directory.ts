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
  return directory || "__opencorvus_unassigned_project__"
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
