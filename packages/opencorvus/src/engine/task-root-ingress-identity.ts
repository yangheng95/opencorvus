import { Identifier } from "@/id/id"

export const DEFAULT_TASK_ROOT_INGRESS_POLICY = {
  semanticTurnLimit: 3,
  activationLimit: 4,
} as const

export function taskRootIngressPolicyID(input: {
  semanticTurnLimit: number
  activationLimit: number
  absoluteDeadline?: number
}): string {
  return Identifier.deterministic(
    "artifact",
    JSON.stringify([
      "task-root-policy-v1",
      input.semanticTurnLimit,
      input.activationLimit,
      input.absoluteDeadline ?? null,
    ]),
  )
}

export function taskRootIngressID(input: { taskID: string; source: string; sourceID: string }): string {
  return Identifier.deterministic(
    "artifact",
    `task-root-ingress-v1\0${input.taskID}\0${input.source}\0${input.sourceID}`,
  )
}
