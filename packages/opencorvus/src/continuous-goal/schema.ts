import z from "zod"
import { NamedError } from "@opencorvus-ai/util/error"

export const ContinuousGoalOwner = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("chat"), id: z.string().min(1) }).strict(),
  z.object({ kind: z.literal("task"), id: z.string().min(1) }).strict(),
  z.object({ kind: z.literal("mission"), id: z.string().min(1) }).strict(),
])
export type ContinuousGoalOwner = z.infer<typeof ContinuousGoalOwner>
export const ContinuousGoalLimits = z
  .object({
    tokenBudget: z.number().int().positive().optional(),
    turnBudget: z.number().int().positive().optional(),
  })
  .strict()
export const ContinuousGoalCreate = ContinuousGoalLimits.extend({
  requestID: z.string().min(1).max(200),
  objective: z.string().trim().min(1).max(16_000),
}).strict()
export const ContinuousGoalUpdate = ContinuousGoalLimits.extend({
  requestID: z.string().min(1).max(200),
  goalID: z.string().min(1),
  expectedRevision: z.string().min(1),
  status: z.enum(["active", "paused", "blocked", "complete"]),
  reason: z.string().trim().min(1).max(4_000),
}).strict()
export const ContinuousGoalView = z
  .object({
    id: z.string(),
    revision: z.string(),
    owner: ContinuousGoalOwner,
    objective: z.string(),
    status: z.enum(["active", "paused", "blocked", "complete", "budget_limited"]),
    reason: z.string().optional(),
    tokenBudget: z.number().optional(),
    turnBudget: z.number().optional(),
    tokensUsed: z.number(),
    turnsAccepted: z.number(),
    createdAt: z.number(),
    updatedAt: z.number(),
    sessionID: z.string(),
    projectID: z.string(),
    directory: z.string(),
  })
  .strict()
export type ContinuousGoalView = z.infer<typeof ContinuousGoalView>
export const ContinuousGoalError = NamedError.create(
  "ContinuousGoalError",
  z.object({
    code: z.enum([
      "owner_unavailable",
      "owner_forbidden",
      "conflict",
      "revision_conflict",
      "inactive",
      "overlapping_owner",
    ]),
    message: z.string(),
  }),
)
export function goalError(code: z.infer<typeof ContinuousGoalError.Schema>["data"]["code"], message: string): never {
  throw new ContinuousGoalError({ code, message })
}

export const CONTINUOUS_GOAL_TOOL_IDS = [
  "create_continuous_goal",
  "get_continuous_goal",
  "update_continuous_goal",
] as const
export const ContinuousGoalWakeReason = z
  .object({
    source: z.literal("continuous_goal"),
    goalID: z.string().min(1),
    revision: z.string().min(1),
    requestID: z.string().min(1),
  })
  .strict()
