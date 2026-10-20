import type { ContinuousGoalCreateData, ContinuousGoalGetResponse, ContinuousGoalUpdateData } from "@opencorvus-ai/sdk"
import { apiJson, isApiAuthorityCurrent, type ApiAuthority } from "./api"
import { directoryScopedPath } from "./task-path"
import { projectDirectoryKey } from "../utils/project-directory"

export type ContinuousGoal = NonNullable<ContinuousGoalGetResponse>
export type ContinuousGoalTarget = ContinuousGoal["owner"] & { directory: string }
export type ContinuousGoalCreateInput = ContinuousGoalCreateData["body"]
export type ContinuousGoalUpdateInput = ContinuousGoalUpdateData["body"]

export type ContinuousGoalRefreshReason = "connected" | "intent" | "settled"
type GoalRefreshListener = {
  key: string
  authority: ApiAuthority
  refresh: (reason: ContinuousGoalRefreshReason) => void
}
const refreshListeners = new Set<GoalRefreshListener>()

function refreshKey(target: ContinuousGoalTarget, authority: ApiAuthority): string {
  return JSON.stringify([authority.revision, target.kind, target.id, projectDirectoryKey(target.directory)])
}

/** Execution notifications invalidate the existing HTTP projection; they carry no Goal state. */
export function listenContinuousGoalRefresh(
  target: ContinuousGoalTarget,
  authority: ApiAuthority,
  refresh: GoalRefreshListener["refresh"],
): () => void {
  const listener = { key: refreshKey(target, authority), authority, refresh }
  refreshListeners.add(listener)
  return () => {
    refreshListeners.delete(listener)
  }
}

export function observeContinuousGoalRefresh(
  target: ContinuousGoalTarget,
  authority: ApiAuthority,
  event: { type?: string; properties?: any; payload?: any },
): void {
  if (!isApiAuthorityCurrent(authority)) return
  const properties = event.properties ?? event.payload
  let reason: ContinuousGoalRefreshReason | undefined
  if (event.type === "session.connected" || event.type === "task.connected") reason = "connected"
  else if (
    event.type === "continuous_goal.created" ||
    event.type === "continuous_goal.updated" ||
    event.type === "continuous_goal.continuation_requested"
  )
    reason = "intent"
  else if (
    (event.type === "message.updated" &&
      properties?.info?.role === "assistant" &&
      typeof properties.info.time?.completed === "number") ||
    (event.type === "agent.execution.lifecycle" && properties?.status?.type === "terminal") ||
    event.type === "task.completed" ||
    event.type === "task.failed" ||
    event.type === "task.cancelled"
  )
    reason = "settled"
  if (!reason) return
  const key = refreshKey(target, authority)
  for (const listener of refreshListeners) {
    if (listener.key === key && isApiAuthorityCurrent(listener.authority)) listener.refresh(reason)
  }
}

function goalPath(target: ContinuousGoalTarget): string {
  return directoryScopedPath(`continuous-goal/${target.kind}/${encodeURIComponent(target.id)}`, target.directory)
}

export function loadContinuousGoal(
  target: ContinuousGoalTarget,
  authority: ApiAuthority,
): Promise<ContinuousGoal | null> {
  return apiJson(goalPath(target), { authority })
}

export function createContinuousGoal(
  target: ContinuousGoalTarget,
  input: ContinuousGoalCreateInput,
  authority: ApiAuthority,
): Promise<ContinuousGoal> {
  return apiJson(goalPath(target), {
    authority,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
}

export function updateContinuousGoal(
  target: ContinuousGoalTarget,
  input: ContinuousGoalUpdateInput,
  authority: ApiAuthority,
): Promise<ContinuousGoal> {
  return apiJson(goalPath(target), {
    authority,
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
}
