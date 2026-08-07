// ── Transcript & context utilities ──
// Exported surface:
// boardArtifact – find a named artifact in board.artifacts
// goalContextText – goals[] → plain text
// interactionRequestText – interaction request → plain text
// interactionReplyLabel – permission reply enum → label
// interactionAnswerLines – interaction answers → string[]
// interactionResponseText – full interaction response → plain text
// hashText – FNV-1a 32-bit hash (used by message identity helpers)

import { t } from "./i18n"

// ── Internal helpers ──

function record(value: any): boolean {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

/** FNV-1a 32-bit hash (mirrors app.js hashText). */
export function hashText(value: string): string {
  const text = String(value || "")
  let hash = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

// ── Public exports ──

/** Find a named artifact in board.artifacts. */
export function boardArtifact(board: any, label: string): any {
  const list: any[] = board?.artifacts || []
  return list.find((item) => item.label === label)
}

/**
 * Build plain-text goal list context (
 * @param goals Goal entries from the task board
 */
export function goalContextText(goals: any[]): string {
  const accepted = goals.filter((goal) => goal?.acceptance?.accepted === true).length
  const active = goals.filter(
    (goal) => Array.isArray(goal?.activity?.activeSessionIDs) && goal.activity.activeSessionIDs.length > 0,
  ).length
  const reviews = goals.reduce(
    (total, goal) => total + (Array.isArray(goal?.reviewAssociations) ? goal.reviewAssociations.length : 0),
    0,
  )
  const header = t("goal.context.facts", { accepted, total: goals.length, active, reviews })
  const lines = [header, ""]
  for (const goal of goals) {
    const icon = goal?.acceptance?.accepted
      ? "\u2705"
      : Array.isArray(goal?.activity?.activeSessionIDs) && goal.activity.activeSessionIDs.length > 0
        ? "\u23F3"
        : "\u2022"
    lines.push(`${icon} **${goal.goalTitle}**`)
    if (goal.goalObjective) lines.push(t("goal.context.criteria", { value: goal.goalObjective }))
  }
  return lines.join("\n")
}

/** Build interaction request prompt text (mirrors app.js interactionRequestText). */
export function interactionRequestText(interaction: any): string {
  const title =
    typeof interaction?.title === "string" && interaction.title.trim()
      ? interaction.title.trim()
      : t("detail.pending_interactions")
  const body = typeof interaction?.body === "string" ? interaction.body.trim() : ""
  return [title, body].filter(Boolean).join("\n\n")
}

/** Label for a permission reply value (mirrors app.js interactionReplyLabel). */
export function interactionReplyLabel(reply: string): string {
  if (reply === "always") return t("interaction.always_allow")
  if (reply === "reject") return t("interaction.reject")
  return t("interaction.allow_once")
}

/** Build answer lines for an interaction (mirrors app.js interactionAnswerLines). */
export function interactionAnswerLines(interaction: any): string[] {
  const response = record(interaction?.response) ? interaction.response : null
  const payload = record(interaction?.payload) ? interaction.payload : null
  const questions: any[] = Array.isArray(payload?.questions) ? payload.questions : []
  if (Array.isArray(response?.answers)) {
    return response.answers.flatMap((answer: any, index: number) => {
      const value = Array.isArray(answer)
        ? answer.filter((item: any) => typeof item === "string" && item.trim()).join(", ")
        : ""
      if (!value) return []
      const question = record(questions[index]) ? questions[index] : null
      const label =
        typeof question?.header === "string" && question.header.trim()
          ? question.header.trim()
          : typeof question?.question === "string" && question.question.trim()
            ? question.question.trim()
            : ""
      return [label ? `- **${label}**: ${value}` : `- ${value}`]
    })
  }
  if (record(response?.answers)) {
    return Object.entries(response.answers).flatMap(([key, item]: [string, any], index: number) => {
      const answer = record(item) ? item : null
      const value = Array.isArray(answer?.answers)
        ? answer.answers.filter((entry: any) => typeof entry === "string" && entry.trim()).join(", ")
        : ""
      if (!value) return []
      const question = record(questions[index]) ? questions[index] : null
      const label =
        typeof question?.header === "string" && question.header.trim()
          ? question.header.trim()
          : typeof question?.question === "string" && question.question.trim()
            ? question.question.trim()
            : key
      return [label ? `- **${label}**: ${value}` : `- ${value}`]
    })
  }
  const message = typeof response?.message === "string" ? response.message.trim() : ""
  return message ? [message] : []
}

/** Check if an interaction was auto-replied by the assistant. */
export function isAutoReplied(interaction: any): boolean {
  const response = record(interaction?.response) ? interaction.response : null
  return response?.auto_reply === true
}

/** Build full interaction response text (mirrors app.js interactionResponseText). */
export function interactionResponseText(interaction: any): string {
  const auto = isAutoReplied(interaction)
  const prefix = auto ? `[${t("interaction.auto_reply")}] ` : ""
  if (interaction?.type === "permission") {
    if (interaction.status === "rejected") return prefix + t("interaction.reject")
    const response = record(interaction?.response) ? interaction.response : null
    return prefix + interactionReplyLabel(typeof response?.reply === "string" ? response.reply : "once")
  }
  if (interaction?.status === "rejected") return prefix + t("interaction.skip")
  const answers = interactionAnswerLines(interaction)
  if (answers.length > 0) return prefix + answers.join("\n")
  return prefix + t("interaction.answer")
}
