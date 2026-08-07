import { boardStore, taskByID } from "../store/board"

export function taskOwningDirectory(taskID: string): string {
  const id = String(taskID || "").trim()
  if (!id) throw new Error("taskOwningDirectory requires a taskID")
  const rowDirectory = taskByID(id)?.task?.directory
  const boardTask = boardStore.board?.task
  const boardDirectory =
    boardTask?.id === id && typeof boardTask.directory === "string" ? boardTask.directory.trim() : ""
  const selectedSource = boardStore.selectedSource
  const sourceDirectory =
    selectedSource?.kind === "task" && selectedSource.id === id && typeof selectedSource.directory === "string"
      ? selectedSource.directory.trim()
      : ""
  const row = typeof rowDirectory === "string" ? rowDirectory.trim() : ""
  const directories = [row, boardDirectory, sourceDirectory].filter(Boolean)
  if (new Set(directories).size > 1) {
    throw new Error(`task ${id} has inconsistent project directories`)
  }
  if (row) return row
  if (boardDirectory) return boardDirectory
  if (sourceDirectory) return sourceDirectory
  throw new Error(`task ${id} has no owning project directory`)
}
