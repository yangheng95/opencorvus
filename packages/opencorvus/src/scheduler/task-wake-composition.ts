import { configureTaskWakeRuntime, type TaskWakeRuntime } from "./task-wake-runtime"

const defaultTaskWakeRuntime: TaskWakeRuntime = {
  consumePendingTaskWaits: async (input) =>
    (await import("./automation-service")).AutomationService.consumePendingTaskWaits(input),
  dispatchTaskLoop: async (input) => (await import("@/engine/queue")).dispatchTaskLoop(input),
}

export function installDefaultTaskWakeRuntime(): void {
  configureTaskWakeRuntime(defaultTaskWakeRuntime)
}
