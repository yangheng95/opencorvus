import { apiRequest } from "./api"

export interface SubmitTaskRewindInput {
  taskID: string
  cursorTime: number
  anchorID: string
  resetWorktree: boolean
}

export class RewindRequestError extends Error {
  readonly status: number
  readonly path: string
  readonly body: unknown

  constructor(status: number, path: string, body: unknown) {
    super(`rewind request failed ${status}${body == null || body === "" ? "" : `: ${String(body)}`}`)
    this.name = "RewindRequestError"
    this.status = status
    this.path = path
    this.body = body
  }
}

export async function submitTaskRewind(input: SubmitTaskRewindInput): Promise<void> {
  const path = `task/${encodeURIComponent(input.taskID)}/rewind`
  const response = await apiRequest<unknown>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      anchor: { kind: "cursorTime", cursorTime: input.cursorTime, anchorEventID: input.anchorID },
      resetWorktree: input.resetWorktree,
      reason: "user rewind card",
    }),
    responseKind: "text",
  })
  if (!response.ok) throw new RewindRequestError(response.status, path, response.body)
}
