import { Instance } from "@/project/instance"
import { NotFoundError } from "@/storage/db"
import { TaskGlobalProjectBindingError } from "./task-project-error"
import { requireTask, type TaskRow } from "./store"

export function requireTaskInCurrentProject(taskID: string): TaskRow {
  const task = requireTask(taskID)
  if (task.project_id === "global") {
    throw new TaskGlobalProjectBindingError({
      message: `Task ${task.id} is bound to project global. Task execution requires a concrete Git project; recreate the task after initializing the directory as a Git repository.`,
      taskID: task.id,
      projectID: task.project_id,
    })
  }
  const current = Instance.current()
  if (current && task.project_id !== current.project.id) {
    throw new NotFoundError({ message: `Task not found: ${task.id}` })
  }
  return task
}
