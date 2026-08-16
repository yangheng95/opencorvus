import { configureTaskWakeRuntime, type TaskWakeRuntime } from "./task-wake-runtime"

const defaultTaskWakeRuntime: TaskWakeRuntime = {
  consumePendingTaskWaits: async (input) =>
    (await import("./automation-service")).AutomationService.consumePendingTaskWaits(input),
  dispatchTaskLoop: async (input) => {
    const result = await (await import("@/engine/task-root-ingress-delivery")).dispatchTaskLoop(input)
    // Scheduler wakes never carry a dispatch infrastructure failure, so the
    // budget gate is unreachable from here; treating it as accepted keeps the
    // scheduler's contract two-valued if that ever changes.
    return result === "ignored" ? "ignored" : "accepted"
  },
  dispatchPersistedTaskLoop: async (taskID) => (await import("@/engine/task-root-ingress-delivery")).dispatchPersistedTaskLoop(taskID),
}

export function installDefaultTaskWakeRuntime(): void {
  configureTaskWakeRuntime(defaultTaskWakeRuntime)
}
