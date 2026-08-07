import { boardStore } from "../store/board"
import { settingsStore, setSettingsStore } from "../store/settings"
import { configure } from "./api-state"
import { taskOwningDirectory } from "./task-directory"

export function activeProjectDirectory(): string {
  const selectedSource = boardStore.selectedSource
  if (selectedSource?.kind === "task") {
    return taskOwningDirectory(selectedSource.id)
  }
  if (selectedSource?.kind === "session") {
    const directory = selectedSource.directory?.trim() || ""
    if (!directory) throw new Error(`session ${selectedSource.id} has no owning project directory`)
    return directory
  }
  return (boardStore.board?.task?.directory || settingsStore.directory || "").trim()
}

export function setProjectDirectoryContext(value: string, persistSavedDirectory: boolean): string {
  const directory = typeof value === "string" ? value.trim() : ""
  if (persistSavedDirectory) {
    setSettingsStore({ directory, savedDirectory: directory })
  } else {
    setSettingsStore("directory", directory)
  }
  configure({ directory })
  return directory
}

export function restoreWorkspaceDirectory(): string {
  const savedDirectory =
    typeof settingsStore.savedDirectory === "string" && settingsStore.savedDirectory.trim()
      ? settingsStore.savedDirectory.trim()
      : ""
  const directory = savedDirectory || (settingsStore.directory ? settingsStore.directory.trim() : "")
  if (!directory) return settingsStore.directory
  setSettingsStore("directory", directory)
  return directory
}

export function projectScopedPath(path: string, directory: string): string {
  const cleanPath = path.replace(/^\/+/, "")
  const cleanDirectory = directory.trim()
  if (!cleanDirectory) throw new Error("projectScopedPath: directory is required")
  const query = new URLSearchParams({ directory: cleanDirectory })
  return `${cleanPath}?${query.toString()}`
}
