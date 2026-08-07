import { tool } from "ai"
import z from "zod"
import { createDecisionLog } from "@/decision-log"
import { Event as EngineEvent } from "@/engine/model"
import { EngineProtocol } from "@/engine/protocol"
import { applyGoalGraphMutation } from "@/engine/persist"
import { requireCurrentGoalContext, requireTask } from "@/engine/store"
import { deriveTaskStatus } from "@/engine/task-status"
import { GoalContractFieldsSchema, GoalContractUpdateSchema } from "@/pipeline/goal-contract.schema"
import { requireTaskOrchestratorToolExecutionContext } from "./tool-execution-context"

export const ModifyGoalInputSchema = z
  .object({
    goalID: z.string().min(1).describe("The exact current Delivery Slice revision ID to modify."),
    updates: GoalContractUpdateSchema.describe(
      "Partial Delivery Slice contract replacement. Include only fields that must change; every included field fully replaces the prior value and produces a new immutable revision.",
    ),
    reason: z.string().min(1).describe("Why current evidence requires a new revision of this Delivery Slice contract."),
  })
  .strict()

export const AddGoalInputSchema = z
  .object({
    goal: GoalContractFieldsSchema.omit({ id: true }).describe(
      "Complete Delivery Slice contract to append, without id. Must include title, objective, owned_paths, acceptance_specs, priority, and kind.",
    ),
    reason: z
      .string()
      .min(1)
      .describe("Evidence that this new Delivery Slice belongs to the latest operator instruction or current Task findings."),
  })
  .strict()

export const DeleteGoalInputSchema = z
  .object({
    goalID: z.string().min(1).describe("The exact current Delivery Slice revision ID to retract without deleting history."),
    reason: z.string().min(1).describe("Concrete evidence proving this Delivery Slice is obsolete or outside current Task scope."),
  })
  .strict()

export function computeContractFieldChanges(
  updates: Record<string, unknown>,
  goal: Record<string, unknown>,
): Record<string, unknown> {
  const contractFields = [
    "title",
    "objective",
    "acceptance_specs",
    "owned_paths",
    "priority",
    "kind",
  ] as const
  const setValues: Record<string, unknown> = {}
  for (const field of contractFields) {
    const incoming = updates[field]
    if (incoming === undefined) continue
    if (JSON.stringify(incoming) === JSON.stringify(goal[field])) continue
    setValues[field] = incoming
  }
  return setValues
}

export function createDeliverySliceContractTools(input: {
  taskID: string
  agentSessionID: string
}) {
  const { taskID } = input
  const producer = async (
    options: unknown,
    operation: "add" | "modify" | "remove",
    reason: string,
    targetGoalID: string | null,
  ) => {
    const execution = await requireTaskOrchestratorToolExecutionContext(
      options,
      `${operation}_goal`,
      {
        taskID,
        agentSessionID: input.agentSessionID,
      },
    )
    return {
      kind: "orchestrator_decision" as const,
      session_id: execution.orchestratorSessionID,
      message_id: execution.orchestratorMessageID,
      tool_call_id: execution.toolCallID,
      operation,
      reason,
      target_goal_id: targetGoalID,
    }
  }
  return {
    add_goal: tool({
      description:
        "Append one new immutable Delivery Slice revision when visible Task evidence adds a concrete in-scope delivery or acceptance surface that no current Slice owns. This changes contract coverage only and does not dispatch, complete, or otherwise synthesize execution.",
      inputSchema: AddGoalInputSchema,
      execute: async ({ goal, reason }, options) => {
        requireTask(taskID)
        const mutation = applyGoalGraphMutation({
          taskID,
          producer: await producer(options, "add", reason, null),
          mutation: {
            operation: "add",
            goal: {
              title: goal.title,
              objective: goal.objective,
              acceptance_specs: goal.acceptance_specs,
              owned_paths: goal.owned_paths,
              kind: goal.kind,
              priority: goal.priority,
              source: "system",
              metadata: { add_goal_reason: reason },
            },
          },
        })
        if (mutation.status !== "applied" || !mutation.goalID) {
          throw new Error("GoalGraph add did not produce a current Delivery Slice revision")
        }
        createDecisionLog(taskID).append({
          phase: "orchestrator",
          key: `added_goal_${mutation.goalID}`,
          value: `Added goal ${mutation.goalID}: ${goal.title}\n\nReason: ${reason}\n\nObjective: ${goal.objective}`,
          reason: "add_goal",
        })
        await EngineProtocol.emit(
          EngineEvent.TaskUpdated,
          { taskID, status: deriveTaskStatus(requireTask(taskID)), summary: `Goal ${mutation.goalID} added by Orchestrator` },
          { source: "orchestrator.add_goal" },
        )
        return mutation
      },
    }),
    modify_goal: tool({
      description:
        "Append a revised immutable Delivery Slice fact that supersedes one exact current revision while preserving the prior revision as history. This changes the current contract projection and does not synthesize execution.",
      inputSchema: ModifyGoalInputSchema,
      execute: async (toolInput, options) => {
        const goalID = toolInput.goalID
        requireTask(taskID)
        const { goal: currentGoal } = requireCurrentGoalContext({ taskID, goalID })
        const goal = currentGoal.goal
        const setValues = computeContractFieldChanges(
          toolInput.updates as Record<string, unknown>,
          goal as unknown as Record<string, unknown>,
        )
        const changed = Object.keys(setValues)
        const revision = applyGoalGraphMutation({
          taskID,
          producer: await producer(options, "modify", toolInput.reason, goalID),
          mutation: {
            operation: "modify",
            goalID,
            values: setValues,
          },
        })
        if (revision.status === "unchanged") {
          return revision
        }
        if (!revision.goalID) {
          throw new Error(`Goal ${goalID} revision produced no Goal identity`)
        }
        createDecisionLog(taskID).append({
          phase: "orchestrator",
          key: `revised_goal_${revision.goalID}`,
          value: `Revised Goal ${goalID} as ${revision.goalID}. Fields: ${changed.join(", ")}.\n\nReason: ${toolInput.reason}`,
          reason: "modify_goal",
        })
        await EngineProtocol.emit(
          EngineEvent.TaskUpdated,
          {
            taskID,
            status: deriveTaskStatus(requireTask(taskID)),
            summary: `Goal ${goalID} revised as ${revision.goalID} by Orchestrator`,
          },
          { source: "orchestrator.modify_goal" },
        )
        return revision
      },
    }),
    delete_goal: tool({
      description:
        "Append the next GoalGraph projection excluding one exact current Delivery Slice revision proved obsolete, redundant, or out of scope. The excluded revision remains immutable history and no execution fact is synthesized.",
      inputSchema: DeleteGoalInputSchema,
      execute: async ({ goalID, reason }, options) => {
        requireTask(taskID)
        const { goal: currentGoal } = requireCurrentGoalContext({ taskID, goalID })
        const goal = currentGoal.goal
        const removal = applyGoalGraphMutation({
          taskID,
          producer: await producer(options, "remove", reason, goalID),
          mutation: { operation: "remove", goalID },
        })
        createDecisionLog(taskID).append({
          phase: "orchestrator",
          key: `retracted_goal_${goalID}`,
          value: `Removed Goal ${goalID} from current GoalGraph: ${goal.title}\n\nReason: ${reason}\n\nProjection: ${JSON.stringify(removal.goalGraphProjectionArtifactLocator)}`,
          reason: "delete_goal",
        })
        await EngineProtocol.emit(
          EngineEvent.TaskUpdated,
          { taskID, status: deriveTaskStatus(requireTask(taskID)), summary: `Goal ${goalID} retracted by Orchestrator` },
          { source: "orchestrator.delete_goal" },
        )
        return removal
      },
    }),
  }
}
