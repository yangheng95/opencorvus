import type { OrchestratorEvent } from "@/orchestrator/event"

export type TaskWakeDispatchResult = "started" | "queued" | "ignored"

export interface TaskWakeRuntime {
  consumePendingTaskWaits(input: {
    taskId: string
    projectId: string
    reason: string
  }): Promise<{ jobIDs: string[] }>
  dispatchTaskLoop(input: {
    taskID: string
    event?: OrchestratorEvent
  }): Promise<TaskWakeDispatchResult>
}

let installedRuntime: TaskWakeRuntime | undefined

export function configureTaskWakeRuntime(runtime: TaskWakeRuntime): void {
  if (installedRuntime && installedRuntime !== runtime) {
    throw new Error("Task wake runtime is already configured")
  }
  installedRuntime = runtime
}

export function requireTaskWakeRuntime(): TaskWakeRuntime {
  if (!installedRuntime) throw new Error("Task wake runtime is not configured")
  return installedRuntime
}
