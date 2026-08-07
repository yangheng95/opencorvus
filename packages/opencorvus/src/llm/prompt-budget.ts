import { NamedError } from "@opencorvus-ai/util/error"
import z from "zod"

export const MissingPromptInputLimitError = NamedError.create(
  "MissingPromptInputLimitError",
  z.object({
    providerID: z.string().optional(),
    modelID: z.string().optional(),
    message: z.string(),
  }),
)

export type PromptBudgetNotice = {
  section: string
  originalChars: number
  renderedChars: number
  reason: "section_cap" | "budget_exhausted"
}

export type PromptBudgetedText = {
  text: string
  originalChars: number
  renderedChars: number
  truncated: boolean
}

export type PromptBudgetModel = {
  id: string
  providerID: string
  limit: {
    context: number
    input?: number
  }
}

const DEFAULT_TRUNCATION_MARKER =
  "\n... (truncated by prompt budget; inspect stored artifacts or tool results for full detail)"

export function modelInputCharLimit(model: PromptBudgetModel): number {
  const limit = typeof model.limit.input === "number" && model.limit.input > 0 ? model.limit.input : model.limit.context
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new MissingPromptInputLimitError({
      providerID: model.providerID,
      modelID: model.id,
      message:
        `Model ${model.providerID}/${model.id} does not declare limit.input ` +
        `or limit.context; prompt budgeting cannot safely proceed.`,
    })
  }
  return limit
}

export function acceptanceUserPromptCharBudget(model: PromptBudgetModel): number {
  const limit = modelInputCharLimit(model)
  return Math.max(4096, Math.floor(limit * 0.6))
}

export function truncateToCharBudget(
  text: string,
  maxChars: number,
  marker = DEFAULT_TRUNCATION_MARKER,
): PromptBudgetedText {
  const originalChars = text.length
  if (!Number.isFinite(maxChars) || maxChars < 0) maxChars = 0
  if (originalChars <= maxChars) {
    return { text, originalChars, renderedChars: originalChars, truncated: false }
  }
  if (maxChars <= 0) {
    return { text: "", originalChars, renderedChars: 0, truncated: true }
  }
  if (maxChars <= marker.length) {
    const clipped = marker.slice(0, maxChars)
    return { text: clipped, originalChars, renderedChars: clipped.length, truncated: true }
  }
  const clipped = text.slice(0, maxChars - marker.length).trimEnd() + marker
  return { text: clipped, originalChars, renderedChars: clipped.length, truncated: true }
}

export class PromptBudget {
  private usedChars = 0
  private readonly notices: PromptBudgetNotice[] = []

  constructor(private readonly maxChars: number) {
    if (!Number.isFinite(maxChars) || maxChars <= 0) {
      throw new MissingPromptInputLimitError({
        message: `PromptBudget requires a positive maxChars value, got ${maxChars}.`,
      })
    }
  }

  used() {
    return this.usedChars
  }

  remaining() {
    return Math.max(0, this.maxChars - this.usedChars)
  }

  addRequired(_section: string, text: string): string {
    this.usedChars += text.length
    return text
  }

  addOptional(section: string, text: string, opts?: { maxChars?: number }): string {
    const sectionLimit = opts?.maxChars ?? Number.POSITIVE_INFINITY
    const allowed = Math.max(0, Math.min(this.remaining(), sectionLimit))
    const result = truncateToCharBudget(text, allowed)
    this.usedChars += result.renderedChars
    if (result.truncated) {
      this.notices.push({
        section,
        originalChars: result.originalChars,
        renderedChars: result.renderedChars,
        reason: allowed < sectionLimit ? "budget_exhausted" : "section_cap",
      })
    }
    return result.text
  }

  truncationNotices(): PromptBudgetNotice[] {
    return [...this.notices]
  }

  renderNotice(): string {
    if (this.notices.length === 0) return ""
    const lines = [
      "# Prompt Truncation Notice",
      "",
      "Some auxiliary acceptance context was shortened to fit the model input budget. Treat omitted details as unavailable unless you inspect the referenced artifacts or call tools.",
      "",
      ...this.notices.map(
        (item) => `- ${item.section}: rendered ${item.renderedChars}/${item.originalChars} chars (${item.reason})`,
      ),
    ]
    return lines.join("\n")
  }
}
