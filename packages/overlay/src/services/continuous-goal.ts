import type { ContinuousGoalCreateData, ContinuousGoalGetResponse, ContinuousGoalUpdateData } from "@opencorvus-ai/sdk"
import { apiJson, type ApiAuthority } from "./api"
import { directoryScopedPath } from "./task-path"

export type ContinuousGoal = NonNullable<ContinuousGoalGetResponse>
export type ContinuousGoalTarget = ContinuousGoal["owner"] & { directory: string }
export type ContinuousGoalCreateInput = ContinuousGoalCreateData["body"]
export type ContinuousGoalUpdateInput = ContinuousGoalUpdateData["body"]

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
