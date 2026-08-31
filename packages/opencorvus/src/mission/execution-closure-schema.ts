import z from "zod"
import { TaskCancellationReason, TaskCancellationRequestSurface } from "@opencorvus-ai/transport-protocol"

/** Sources that are allowed to create a durable Mission execution occurrence. */
export const MissionExecutionOpenSource = z.enum(["mission.dispatch", "mission.wake"])

/** Sources that are allowed to close a durable Mission execution occurrence. */
export const MissionExecutionCloseSource = z.enum(["mission.abort", "mission.delete", "mission.archive"])

export const MissionExecutionCloseProvenance = z
  .object({
    kind: z.literal("request"),
    surface: TaskCancellationRequestSurface,
    reason: TaskCancellationReason,
  })
  .strict()
