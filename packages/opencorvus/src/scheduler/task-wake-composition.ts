import { configureTaskWakeRuntime, type TaskWakeRuntime } from "./task-wake-runtime"

const defaultTaskWakeRuntime: TaskWakeRuntime = {
  consumePendingTaskWaits: async (input) =>
    (await import("./automation-service")).AutomationService.consumePendingTaskWaits(input),
  dispatchTaskLoop: async (input) => (await import("@/engine/queue")).dispatchTaskLoop(input),
  dispatchPersistedTaskLoop: async (taskID) => (await import("@/engine/queue")).dispatchPersistedTaskLoop(taskID),
}

export function installDefaultTaskWakeRuntime(): void {
  configureTaskWakeRuntime(defaultTaskWakeRuntime)
}
