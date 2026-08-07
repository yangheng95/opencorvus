import { NamedError } from "@opencorvus-ai/util/error"
import z from "zod"

export const TaskCancellationIncompleteError = NamedError.create(
  "TaskCancellationIncompleteError",
  z.object({
    message: z.string(),
    taskID: z.string().optional(),
    handle: z.string(),
    cause: z.string(),
  }),
)

export function createTaskCancellationIncomplete(input: {
  taskID?: string
  handle: string
  cause: unknown
}): InstanceType<typeof TaskCancellationIncompleteError> {
  const cause = input.cause instanceof Error ? input.cause.message : String(input.cause)
  return new TaskCancellationIncompleteError({
    message: `Cancellation did not complete for ${input.handle}: ${cause}`,
    taskID: input.taskID,
    handle: input.handle,
    cause,
  })
}
