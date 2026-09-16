import { withImmediateParkToolResultControl } from "@/session/tool-result-control"
import { bindToolExecutionMode } from "@/tool/execution-mode"
import { tool } from "ai"
import z from "zod"
import { taskLifecycleProjection, type TaskLifecycleProjection } from "@/engine/task-lifecycle"

export const NoActionTaskObservationSchema = z.object({
  epoch: z.number().int().positive(),
  status: z.enum(["active", "cancelling", "completed", "failed", "cancelled"]),
  openedEventID: z.string().min(1),
  terminalEventID: z.string().min(1).nullable(),
}).strict()

export function noActionTaskObservation(lifecycle: TaskLifecycleProjection) {
  return {
    epoch: lifecycle.epoch,
    status: lifecycle.status,
    openedEventID: lifecycle.openedEventID,
    terminalEventID: lifecycle.terminalEventID ?? null,
  }
}

export class TaskLifecycleObservationConflictError extends Error {
  constructor(readonly actual: z.infer<typeof NoActionTaskObservationSchema>) {
    super(`The declared Task lifecycle differs from its current canonical facts: ${JSON.stringify(actual)}. Reconsider the decision using these facts.`)
    this.name = "TaskLifecycleObservationConflictError"
  }
}

export const NoActionInputSchema = z
  .object({
    observed_task: NoActionTaskObservationSchema.describe(
      "Copy the current Task execution_lifecycle epoch, status and exact event IDs. Use null for an absent current-epoch terminal event. This declares the facts underlying your decision; it does not assert that the Task is complete.",
    ),
    reason: z
      .string()
      .trim()
      .min(1)
      .describe("Concise evidence-backed reason why the current ingress requires no scheduler action."),
  })
  .strict()

export function createNoActionTool(input: { taskID: string; activeAcceptanceGapID?: string }) {
  return {
    no_action: bindToolExecutionMode(
      tool({
        description:
          "Resolve the current Orchestrator ingress after fully inspecting it when no dispatch, coordination reply, " +
          "Task or Delivery Slice mutation, operator question, or scheduled external wake is required. Use this after a " +
          "visible conversation-only status or diagnosis answer, or after reconciling a lifecycle fact while another " +
          "worker, scheduled wait, pending Interaction, or accepted successor ingress independently continues the Task. " +
          "For active execution work with no such authority, finishing all work requires the current Task epoch's " +
          "manage_task lifecycle decision. A historical completed epoch or completed worker does not close a reopened Task. This " +
          "records only the current decision receipt: it does not create a timer, Automation, Interaction, worker action, " +
          "Task lifecycle fact, future wake, or durable waiting state. Never use it when current evidence requires a real " +
          "scheduler action.",
        inputSchema: NoActionInputSchema,
        execute: async ({ reason, observed_task }) => {
          const actual = noActionTaskObservation(taskLifecycleProjection(input.taskID))
          if (Object.keys(actual).some((key) => actual[key as keyof typeof actual] !== observed_task[key as keyof typeof actual])) {
            throw new TaskLifecycleObservationConflictError(actual)
          }
          if (input.activeAcceptanceGapID) {
            throw new Error(
              `Acceptance gap ${input.activeAcceptanceGapID} requires a scoped repair Turn or an evidence-backed Task terminal decision; no_action cannot settle it.`,
            )
          }
          return {
            title: "Current Ingress Reconciled",
            output: JSON.stringify({ reason, observed_task: actual }),
            metadata: withImmediateParkToolResultControl({}),
          }
        },
      }),
      "turn_control_exclusive",
    ),
  }
}
