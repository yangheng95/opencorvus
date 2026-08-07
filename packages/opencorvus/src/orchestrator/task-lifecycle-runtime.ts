import type { TaskCancellationOrigin } from "@/engine/cancellation-origin"

/**
 * Narrow lifecycle adapter for Orchestrator tools. The Task API remains the
 * sole implementation owner; resolving it at invocation time keeps importing
 * the tool schemas independent from the Task API -> bootstrap -> tools cycle.
 */
export const TaskLifecycleRuntime = {
  async cancelTask(input: {
    taskID: string
    origin: TaskCancellationOrigin
  }): Promise<unknown> {
    const { EngineService } = await import("@/task-api")
    return EngineService.cancelTask(input.taskID, { origin: input.origin })
  },
}
