import { apiJson } from "./api"
import { taskScopedPath } from "./task-path"
import {
  TaskCancellationRequestBody,
  type TaskCancellationRequestSurface,
} from "@opencorvus-ai/transport-protocol"

export type TaskCancellationSurface = TaskCancellationRequestSurface

export type TaskCancellationRequest = {
  taskID: string
  directory: string
} & TaskCancellationRequestBody

/**
 * The sole Overlay transport for whole-task cancellation. The server derives
 * actor/source from the authenticated route and correlates the durable request
 * event with this transport request identifier.
 */
export async function requestTaskCancellation(input: TaskCancellationRequest): Promise<void> {
  const taskID = input.taskID.trim()
  const directory = input.directory.trim()
  if (!taskID) throw new Error("Task cancellation requires a task identifier.")
  if (!directory) throw new Error("Task cancellation requires the owning directory.")
  const body = TaskCancellationRequestBody.parse({
    surface: input.surface,
    reason: input.reason,
  })
  await apiJson(taskScopedPath(taskID, directory, "/cancel"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
}
