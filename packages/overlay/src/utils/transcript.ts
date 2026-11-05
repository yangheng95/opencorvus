// ── Transcript & context utilities ──
// Exported surface:
// boardArtifact – find a named artifact in board.artifacts
// goalContextText – goals[] → plain text
// permissionRequestTitle – original Tool identity → current-locale heading
// interactionRequestText – interaction request → plain text
// interactionReplyLabel – permission reply enum → label
// interactionAnswerLines – interaction answers → string[]
// interactionResponseText – full interaction response → plain text

import { t } from "./i18n"

// ── Internal helpers ──

function record(value: any): boolean {
  return !!value && typeof value === "object" && !Array.isArray(value)
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

/** Build retained Question request text. Permissions use their structured scope renderer. */
export function interactionRequestText(interaction: any): string {
  const title =
    typeof interaction?.title === "string" && interaction.title.trim()
      ? interaction.title.trim()
      : interaction?.type === "question"
        ? t("interaction.icon.question")
        : t("detail.pending_interactions")
  const body = typeof interaction?.body === "string" ? interaction.body.trim() : ""
  return [title, body].filter(Boolean).join("\n\n")
}

/** Localize the product label while retaining the original technical Tool name. */
export function permissionRequestTitle(toolName: unknown): string {
  const label = t("interaction.icon.permission")
  return typeof toolName === "string" && toolName.trim() ? `${label} · ${toolName}` : label
}

/** Label for a durable permission decision. */
export function interactionReplyLabel(decision: unknown): string {
  if (decision === "allow_once") return t("permissions.event.allowed_once")
  if (decision === "allow_project") return t("interaction.approved_project")
  if (decision === "allow_task") return t("interaction.approved_task")
  if (decision === "deny") return t("permissions.event.denied")
  throw new Error(`permission response has unknown decision ${String(decision)}`)
}

function questionAnswerText(question: any, answers: unknown): string {
  if (!Array.isArray(answers)) return ""
  const options: any[] = Array.isArray(question?.options) ? question.options : []
  return answers
    .filter((value): value is string => typeof value === "string" && !!value.trim())
    .map((value) => {
      const option = options.find((candidate) => candidate?.value === value)
      return typeof option?.label === "string" && option.label.trim() ? option.label : value
    })
    .join(", ")
}

/** Build retained answer lines from the original option labels and custom text. */
export function interactionAnswerLines(interaction: any): string[] {
  const response = record(interaction?.response) ? interaction.response : null
  const payload = record(interaction?.payload) ? interaction.payload : null
  const questions: any[] = Array.isArray(payload?.questions) ? payload.questions : []
  if (Array.isArray(response?.answers)) {
    return Array.from({ length: Math.max(questions.length, response.answers.length) }, (_, index) => {
      const question = record(questions[index]) ? questions[index] : null
      const value = questionAnswerText(question, response.answers[index]) || t("interaction.no_answer_provided")
      const label =
        typeof question?.header === "string" && question.header.trim()
          ? question.header.trim()
          : typeof question?.question === "string" && question.question.trim()
            ? question.question.trim()
            : ""
      return label ? `- **${label}**: ${value}` : `- ${value}`
    })
  }
  if (record(response?.answers)) {
    return Object.entries(response.answers).flatMap(([key, item]: [string, any], index: number) => {
      const answer = record(item) ? item : null
      const question = record(questions[index]) ? questions[index] : null
      const value = questionAnswerText(question, answer?.answers)
      if (!value) return []
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

/** Check whether the canonical response identifies an automatic reply. */
export function isAutoReplied(interaction: any): boolean {
  const response = record(interaction?.response) ? interaction.response : null
  return response?.auto_reply === true
}

/** Build full interaction response text (mirrors app.js interactionResponseText). */
export function interactionResponseText(interaction: any): string {
  if (interaction?.type === "question" && interaction.status === "expired") {
    const origin = interaction.response?.origin
    if (origin === "deadline") return t("interaction.expired")
    if (origin === "infrastructure") return t("interaction.closed")
    throw new Error(`question ${interaction.id} has unknown expiry origin ${String(origin)}`)
  }
  const auto = isAutoReplied(interaction)
  const prefix = auto ? `[${t("interaction.auto_reply")}] ` : ""
  if (interaction?.type === "permission") {
    const response = record(interaction?.response) ? interaction.response : null
    const decision = response?.decision
    const label = interactionReplyLabel(decision)
    if (
      (interaction.status === "answered" && decision !== "deny") ||
      (interaction.status === "rejected" && decision === "deny")
    ) {
      const termination = response?.termination
      if (termination !== undefined) {
        if (decision !== "deny" || !record(termination)) {
          throw new Error(`permission ${interaction.id} termination conflicts with its decision`)
        }
        if (termination.status === "cancelled") return prefix + t("permissions.event.cancelled")
        if (termination.status === "stale") return prefix + t("permissions.event.stale")
        throw new Error(`permission ${interaction.id} has unknown termination status ${String(termination.status)}`)
      }
      return prefix + label
    }
    throw new Error(
      `permission ${interaction.id} status ${interaction.status} conflicts with decision ${String(decision)}`,
    )
  }
  if (interaction?.status === "rejected") return prefix + t("interaction.skip")
  const answers = interactionAnswerLines(interaction)
  if (answers.length > 0) return prefix + answers.join("\n")
  return prefix + t("interaction.answer")
}
