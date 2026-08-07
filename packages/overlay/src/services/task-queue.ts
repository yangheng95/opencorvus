import { apiJson } from "./api"

export async function reorderTaskQueue(input: {
  directory: string
  orderedTaskIDs: string[]
}): Promise<{ directory: string; revision: string; queuedTaskIDs: string[] }> {
  const directory = input.directory.trim()
  if (!directory) throw new Error("reorderTaskQueue requires a task directory")
  if (input.orderedTaskIDs.length < 2) throw new Error("reorderTaskQueue requires at least two queued tasks")
  return apiJson("task-queue/reorder", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ directory, orderedTaskIDs: input.orderedTaskIDs }),
  })
}

export interface StartQueuedTaskNowResult {
  task: { id: string; title: string }
  directory: string
  status: string
  started: boolean
  queuedTaskIDs: string[]
}

export async function startQueuedTaskNow(input: {
  taskID: string
  directory: string
}): Promise<StartQueuedTaskNowResult> {
  const directory = input.directory.trim()
  if (!directory) throw new Error("startQueuedTaskNow requires a task directory")
  const query = new URLSearchParams({ directory })
  return apiJson(`task/${encodeURIComponent(input.taskID)}/start-now?${query.toString()}`, {
    method: "POST",
  })
}
