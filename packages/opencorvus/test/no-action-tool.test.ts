import { describe, expect, test } from "bun:test"
import { orchestratorDecisionToolCompletionEffect } from "@/orchestrator/decision-tool-names"
import { createNoActionTool, NoActionInputSchema } from "@/orchestrator/no-action-tool"
import { toolResultControl } from "@/session/tool-result-control"
import { toolExecutionModeOf } from "@/tool/execution-mode"

describe("Orchestrator no_action decision", () => {
  test("returns one visible immediate-park receipt that satisfies the current epoch", async () => {
    const definition = createNoActionTool().no_action
    const input = NoActionInputSchema.parse({ reason: "Lifecycle evidence is reconciled and no frontier is ready." })
    const result = await definition.execute!(input, {} as never)

    expect({
      executionMode: toolExecutionModeOf(definition as object),
      effect: orchestratorDecisionToolCompletionEffect({ tool: "no_action", stateInput: input }),
      result,
      control: toolResultControl((result as { metadata: Record<string, unknown> }).metadata),
    }).toEqual({
      executionMode: "turn_control_exclusive",
      effect: "satisfies_current_epoch",
      result: {
        title: "Current Ingress Reconciled",
        output: input.reason,
        metadata: expect.any(Object),
      },
      control: { kind: "immediate_park" },
    })
  })
})
