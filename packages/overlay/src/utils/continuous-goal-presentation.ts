import { t } from "./i18n"

const systemReasons = new Set([
  "owner_unavailable",
  "owner_cancelled",
  "owner_archived",
  "mission_closed",
  "token_budget",
  "turn_budget",
  "model_not_configured",
  "model_unavailable",
  "user_paused",
  "user_resumed",
  "budget_updated",
  "budget_updated_and_resumed",
])

/** Completed reasons are authored evidence, including text matching a code. */
export function continuousGoalReasonLabel(status: string | undefined, reason: string | undefined): string | undefined {
  return status !== "complete" && reason && systemReasons.has(reason) ? t(`continuous_goal.reason.${reason}`) : reason
}
