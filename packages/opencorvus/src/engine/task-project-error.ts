import z from "zod"
import { NamedError } from "@opencorvus-ai/util/error"

export const TaskGlobalProjectBindingError = NamedError.create(
  "TaskGlobalProjectBindingError",
  z.object({
    message: z.string(),
    taskID: z.string().optional(),
    projectID: z.string(),
  }),
)

export const TaskChannelBindingProjectConflictError = NamedError.create(
  "TaskChannelBindingProjectConflictError",
  z.object({
    message: z.string(),
    platform: z.string(),
    channel: z.string(),
    thread: z.string(),
    taskID: z.string(),
    projectID: z.string(),
    activeProjectID: z.string(),
  }),
)
