import { Instance } from "@/project/instance"
import { taskPrimaryProjectRoot } from "@/project/task-runtime-root"

export function browserPreviewTaskEvidenceRoot(taskID: string): string {
  return taskPrimaryProjectRoot(taskID, { activeProjectID: Instance.project.id })
}
