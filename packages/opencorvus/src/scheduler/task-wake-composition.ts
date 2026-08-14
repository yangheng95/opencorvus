import { configureTaskWakeRuntime, type TaskWakeRuntime } from "./task-wake-runtime"

const defaultTaskWakeRuntime: TaskWakeRuntime = {
  consumePendingTaskWaits: async (input) =>
    (await import("./automation-service")).AutomationService.consumePendingTaskWaits(input),
  dispatchTaskLoop: async (input) => (await import("@/engine/task-root-ingress-delivery")).dispatchTaskLoop(input),
  dispatchPersistedTaskLoop: async (taskID) => (await import("@/engine/task-root-ingress-delivery")).dispatchPersistedTaskLoop(taskID),
}

export function installDefaultTaskWakeRuntime(): void {
  configureTaskWakeRuntime(defaultTaskWakeRuntime)
}
