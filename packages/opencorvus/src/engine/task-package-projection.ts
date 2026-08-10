import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { requireTaskResolvedPackageRevision } from "./task-package-revision-binding"
import { taskIDForSession } from "./task-session-lineage"

export function taskPackageRevisionForSession(sessionID: string) {
  const taskID = taskIDForSession(sessionID)
  return taskID ? requireTaskResolvedPackageRevision(taskID) : undefined
}

export async function resolvePinnedTaskSchedulerTurnProjection(input: {
  taskID: string
  projectDirectory: string
  config: Parameters<typeof PromptProfileResolver.resolveSchedulerTurnProjection>[0]["config"]
}) {
  const packageRevision = requireTaskResolvedPackageRevision(input.taskID)
  const projection = await PromptProfileResolver.resolveSchedulerTurnProjection({
    projectDirectory: input.projectDirectory,
    config: input.config,
    packageRevision,
  })
  return { packageRevision, ...projection }
}
