import type { TaskRow } from "@/engine"
import { Instance } from "@/project/instance"
import { Session } from "@/session"

const creationLocks = new Map<string, Promise<Session.Info>>()

export async function assertTaskRootSessionLineage(
  task: Pick<TaskRow, "id" | "session_id" | "project_id">,
): Promise<void> {
  if (!task.session_id) throw new Error(`Task ${task.id} has no root session`)
  await Session.assertLineageInProject({ sessionID: task.session_id, projectID: task.project_id })
}

/**
 * Resolve the one durable Orchestrator conversation owned by a Task.
 * Creation is serialized per Task so scheduler ingress and the initial Task
 * wake cannot race into parallel Orchestrator histories.
 */
export async function taskOrchestratorSession(task: TaskRow): Promise<Session.Info> {
  if (!task.session_id) throw new Error(`Task ${task.id} has no root session`)
  await assertTaskRootSessionLineage(task)

  const resolve = async () => {
    const existing = (await Session.children(task.session_id!))
      .filter((session) => session.kind === "orchestrator")
      .sort((left, right) => left.time.created - right.time.created)
    const current = existing.at(-1)
    if (current) {
      await Session.touch(current.id)
      return current
    }
    return Session.createNext({
      kind: "orchestrator",
      parentID: task.session_id!,
      title: `Agent: ${task.title}`,
      directory: Instance.directory,
    })
  }

  const prior = creationLocks.get(task.id)
  if (prior) return prior
  const pending = resolve().finally(() => {
    if (creationLocks.get(task.id) === pending) creationLocks.delete(task.id)
  })
  creationLocks.set(task.id, pending)
  return pending
}
