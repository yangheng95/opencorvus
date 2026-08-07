import type { Question } from "@/question"
import type { IntentClarification } from "./types"

export interface ClarificationAnswer {
  clarification: IntentClarification
  answers: string[]
}

export function clarificationToQuestionInfo(clarification: IntentClarification): Question.Info {
  return {
    header: clarification.header,
    question: clarification.question,
    options: clarification.options,
    multiple: clarification.multiple,
    custom: clarification.custom,
  }
}

export function clarificationAnswers(input: {
  clarifications: IntentClarification[]
  answers: Question.Answer[]
}): ClarificationAnswer[] {
  if (input.answers.length !== input.clarifications.length) {
    throw new Error(
      `intent-analysis clarification answer count mismatch: questions=${input.clarifications.length}, answers=${input.answers.length}`,
    )
  }
  return input.clarifications.map((clarification, index) => {
    const answers = input.answers[index]
    if (!Array.isArray(answers)) {
      throw new Error(`intent-analysis clarification answer ${index + 1} is not an answer array`)
    }
    return { clarification, answers }
  })
}

export function renderClarificationAnswers(rows: ClarificationAnswer[]): string {
  return rows
    .map((row, index) => {
      const answers =
        row.answers.length > 0
          ? row.answers
              .map((answer) => {
                const option = row.clarification.options.find((candidate) => candidate.value === answer)
                return option ? `${option.label} [${option.value}]` : answer
              })
              .join(", ")
          : "(empty answer)"
      return [
        `${index + 1}. ${row.clarification.question}`,
        `   header: ${row.clarification.header}`,
        `   why_needed: ${row.clarification.why_needed}`,
        `   answer: ${answers}`,
      ].join("\n")
    })
    .join("\n")
}

export function buildClarifiedUserRequest(input: { originalRequest: string; answers: ClarificationAnswer[] }): string {
  if (input.answers.length === 0) {
    throw new Error("intent-analysis clarified request requires at least one answered clarification")
  }
  return [
    "# Original user request",
    "",
    input.originalRequest.trimEnd(),
    "",
    "# Clarifying answers",
    "",
    renderClarificationAnswers(input.answers),
  ].join("\n")
}
