import z from "zod"
import { tool as aiTool } from "ai"
import { Tool } from "./tool"
import { resolveCoreProjectedTaskToolExecutionScope } from "./task-tool-execution-scope"
import { ContinuousGoalCreate, ContinuousGoalUpdate, CONTINUOUS_GOAL_TOOL_IDS } from "@/continuous-goal/schema"
import {
  createContinuousGoal,
  readContinuousGoal,
  updateContinuousGoal,
  goalOwnerForAgent,
} from "@/continuous-goal/store"

const descriptors = {
  create_continuous_goal: {
    parameters: ContinuousGoalCreate.omit({ requestID: true }),
    description:
      "Create a durable continuous goal for this Chat, Task or Mission ONLY when the user explicitly requests continuous goal mode. Do not infer it from an ordinary task. Unlike Delivery Slice Goals, this authorizes automatic further turns until complete, paused, blocked or budget-limited. Set tokenBudget/turnBudget only when the user explicitly specifies them. Token budget covers requests started after creation, including descendants; it stops new automatic turns, while accepted requests may settle and exceed it. turnBudget counts automatic continuations. This grants no additional permissions.",
  },
  get_continuous_goal: {
    parameters: z.object({}).strict(),
    description:
      "Read this owner's durable continuous goal, exact revision, status, settled token usage and accepted continuation count. null means no goal. This is separate from Delivery Slice Goals.",
  },
  update_continuous_goal: {
    parameters: ContinuousGoalUpdate.omit({ requestID: true }),
    description:
      "Update the exact continuous goal revision returned by get_continuous_goal. Mark complete only when the actual objective is achieved and explain the evidence in reason. Mark blocked only for a concrete external blocker, listing unmet work. Set paused only on the user's explicit request; pause stops new automatic turns and lets accepted work settle. Resume with active, or change budgets, only with explicit user authorization. Preserve accumulated usage; completion does not replace Task/Mission completion contracts.",
  },
}

type GoalToolID = (typeof CONTINUOUS_GOAL_TOOL_IDS)[number]
function execute(id: GoalToolID, args: unknown, sessionID: string, requestID: string) {
  const owner = goalOwnerForAgent(sessionID)
  if (id === "get_continuous_goal") return readContinuousGoal(owner) ?? null
  if (id === "create_continuous_goal") {
    const input = descriptors.create_continuous_goal.parameters.parse(args)
    return createContinuousGoal(owner, { ...input, requestID }, sessionID)
  }
  const input = descriptors.update_continuous_goal.parameters.parse(args)
  return updateContinuousGoal(owner, { ...input, requestID }, sessionID)
}

export const ContinuousGoalTools = CONTINUOUS_GOAL_TOOL_IDS.map((id) =>
  Tool.define(id, {
    ...descriptors[id],
    async execute(args, ctx) {
      if (!ctx.callID) throw new Error("Continuous goal Tool requires its persisted call identity.")
      const result = execute(id, args, ctx.sessionID, ctx.messageID + ":" + ctx.callID)
      return { title: id, metadata: { continuousGoal: result }, output: JSON.stringify(result) }
    },
  }),
)

export function createContinuousGoalAiTool(id: GoalToolID, trace: { taskID: string; sessionID: string }) {
  return aiTool({
    description: descriptors[id].description,
    inputSchema: descriptors[id].parameters as z.ZodType<Record<string, unknown>>,
    execute: async (args, options) => {
      const scope = await resolveCoreProjectedTaskToolExecutionScope({ options, toolName: id })
      if (scope.taskID !== trace.taskID || scope.sessionID !== trace.sessionID)
        throw new Error("Continuous goal invocation belongs to another Task or Session.")
      return execute(id, args, scope.sessionID, scope.toolPartID)
    },
  })
}
