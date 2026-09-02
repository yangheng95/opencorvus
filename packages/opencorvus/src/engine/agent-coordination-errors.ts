import z from "zod"
import { NamedError } from "@opencorvus-ai/util/error"

export const OperatorSteerRequestConflictError = NamedError.create(
  "OperatorSteerRequestConflictError",
  z.object({
    message: z.string(),
    taskID: z.string(),
    sessionID: z.string(),
    requestID: z.string(),
    mismatches: z.array(z.string()),
  }),
)

export const AgentCoordinationFrontierConflictError = NamedError.create(
  "AgentCoordinationFrontierConflictError",
  z.object({
    message: z.string(),
    taskID: z.string(),
    requestID: z.string(),
    frontierID: z.string(),
    mismatches: z.array(z.string()),
  }),
)

export const AgentCoordinationActionSupersededError = NamedError.create(
  "AgentCoordinationActionSupersededError",
  z.object({
    message: z.string(),
    taskID: z.string(),
    actionID: z.string(),
    expectedExecutionEpoch: z.number().int().positive(),
    currentExecutionEpoch: z.number().int().positive(),
    currentTaskStatus: z.string(),
  }),
)
