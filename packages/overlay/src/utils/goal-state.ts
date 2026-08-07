// ── Goal-level rollup state ──
//
// Maps Task Completion Decision acceptance onto a compact presentation token.
// Activity and review associations remain separate facts and never affect it.

import type { IconName } from "../components/ui/Icon"

export type GoalState = "unaccepted" | "accepted"

const GOAL_STATE_ICON_NAMES: Record<GoalState, IconName> = {
  unaccepted: "status-idle",
  accepted: "check",
}

export function goalState(goal: any): GoalState {
  return goal?.acceptance?.accepted === true ? "accepted" : "unaccepted"
}

export function goalStateIconName(state: GoalState): IconName {
  return GOAL_STATE_ICON_NAMES[state]
}
