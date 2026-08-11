import { tool } from "ai"
import type z from "zod"
import type { ProjectedAgentWorkScope } from "@/agent/projected-agent-work-scope"
import { DispatchOutcomeSchema, type DispatchOutcome } from "@/agent/dispatch-outcome"
import { projectedAdapterError } from "./projected-adapter-error"

const exactIntegrityOccurrenceInflight = new Map<string, Promise<unknown>>()

export function createIntegrityReviewRunner<
  Input,
  ExecutionContext extends {
    agentID: string
    workScope: ProjectedAgentWorkScope
    dispatch: { dispatchID: string }
  },
  Task extends { id: string },
  Result,
>(input: {
  taskID: string
  requireTask(): Task
  runReviewOnce(context: { toolExecution: ExecutionContext; toolInput: Input }): Promise<Result>
}) {
  return async (toolExecution: ExecutionContext, toolInput: Input): Promise<Result> => {
    const task = input.requireTask()
    const exactOccurrenceKey = `${task.id}:${toolExecution.dispatch.dispatchID}`
    const existing = exactIntegrityOccurrenceInflight.get(exactOccurrenceKey)
    if (existing) return (await existing) as Result
    const execution = input.runReviewOnce({ toolExecution, toolInput })
    exactIntegrityOccurrenceInflight.set(exactOccurrenceKey, execution)
    try {
      return await execution
    } finally {
      if (exactIntegrityOccurrenceInflight.get(exactOccurrenceKey) === execution) {
        exactIntegrityOccurrenceInflight.delete(exactOccurrenceKey)
      }
    }
  }
}

export function createIntegrityTool<
  Input,
  ExecutionContext extends { agentID: string; workScope: ProjectedAgentWorkScope },
>(input: {
  inputSchema: z.ZodType<Input>
  requireExecutionContext(options: unknown): ExecutionContext
  runReview(context: ExecutionContext, toolInput: Input): Promise<DispatchOutcome>
}) {
  return tool<Input, DispatchOutcome>({
    description:
      "Adversarial integrity evidence review of scheduler-provided structured contracts and the delivered system. " +
      "One projected streaming review session registers task-specific evidence perspectives through read-only inspection tools. Findings, evidence, required repairs, unresolved disagreements, and optional judgment remain visible as IntegrityReview artifact facts. Reviewer rows are evidence perspectives, not child sessions. " +
      "Every verdict records phase-tagged review evidence; the active expert-squad scheduler decides how that evidence affects its declared obligations. The review does not complete or block the task by itself. Non-pass findings are persisted as evidence only: this review never rewrites requirements, never upserts goals, and the host never auto-routes findings. " +
      "The active scheduler policy decides when to invoke this adapter.",
    inputSchema: input.inputSchema,
    outputSchema: DispatchOutcomeSchema,
    execute: async (toolInput, options) => {
      const executionContext = input.requireExecutionContext(options)
      try {
        return await input.runReview(executionContext, toolInput)
      } catch (error) {
        throw projectedAdapterError(executionContext.agentID, "integrity", error)
      }
    },
  })
}
