import { requireTask } from "@/engine/store"
import { taskRootDirectory } from "@/engine/task-directory"
import { NotFoundError } from "@/storage/db"

export function taskPrimaryProjectRoot(
  taskID: string,
  input: {
    activeProjectID?: string
  } = {},
): string {
  const task = requireTask(taskID)
  if (input.activeProjectID && task.project_id !== input.activeProjectID) {
    throw new NotFoundError({
      message: `Task not found in current project: ${taskID}`,
    })
  }
  return taskRootDirectory(task)
}
