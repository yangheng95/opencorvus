import { withImmediateParkToolResultControl } from "@/session/tool-result-control"
import { bindToolExecutionMode } from "@/tool/execution-mode"
import { tool } from "ai"
import z from "zod"

export const NoActionInputSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(1)
      .describe("Concise evidence-backed reason why the current ingress requires no scheduler action."),
  })
  .strict()

export function createNoActionTool() {
  return {
    no_action: bindToolExecutionMode(
      tool({
        description:
          "Resolve the current Orchestrator ingress after fully inspecting it when no dispatch, coordination reply, " +
          "Task or Delivery Slice mutation, operator question, or scheduled external wake is required. Use this after a " +
          "visible status or diagnosis answer, or after reconciling a lifecycle fact with no newly ready frontier. This " +
          "records only the current decision receipt: it does not create a timer, Automation, Interaction, worker action, " +
          "Task lifecycle fact, future wake, or durable waiting state. Never use it when current evidence requires a real " +
          "scheduler action.",
        inputSchema: NoActionInputSchema,
        execute: async ({ reason }) => ({
          title: "Current Ingress Reconciled",
          output: reason,
          metadata: withImmediateParkToolResultControl({}),
        }),
      }),
      "turn_control_exclusive",
    ),
  }
}
