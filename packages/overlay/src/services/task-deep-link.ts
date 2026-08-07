export interface TaskDeepLink {
  taskID: string
}

export class TaskDeepLinkError extends Error {
  override readonly name = "TaskDeepLinkError"
}

const TASK_ID_PARAM = "taskID"
const TASK_DIRECTORY_PARAM = "directory"
const UNSUPPORTED_TASK_PARAMS = new Set(["task", "taskId", "task_id"])

function normalizedSearch(search: string): string {
  return search.startsWith("?") ? search.slice(1) : search
}

function canonicalValue(params: URLSearchParams, name: string): string | undefined {
  const values = params.getAll(name)
  if (values.length === 0) return undefined
  if (values.length > 1) throw new TaskDeepLinkError(`Task deep link parameter "${name}" must appear once`)
  return values[0]?.trim()
}

export function taskDeepLinkFromSearch(search: string): TaskDeepLink | null {
  const params = new URLSearchParams(normalizedSearch(search))
  for (const name of UNSUPPORTED_TASK_PARAMS) {
    if (params.has(name)) throw new TaskDeepLinkError(`Unsupported task deep link parameter "${name}"`)
  }

  const taskID = canonicalValue(params, TASK_ID_PARAM)

  if (taskID === undefined) return null
  if (params.has(TASK_DIRECTORY_PARAM)) {
    throw new TaskDeepLinkError(`Unsupported task deep link parameter "${TASK_DIRECTORY_PARAM}"`)
  }
  if (!taskID) throw new TaskDeepLinkError(`Task deep link parameter "${TASK_ID_PARAM}" must be non-empty`)
  return { taskID }
}

export function currentTaskDeepLink(): TaskDeepLink | null {
  if (typeof window === "undefined") return null
  return taskDeepLinkFromSearch(window.location.search)
}
