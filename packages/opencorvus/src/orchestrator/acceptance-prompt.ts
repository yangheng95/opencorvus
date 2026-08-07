import { AcceptanceSpecSchema, renderSpecsAsText } from "@/acceptance/types"

export function acceptanceSpecsToPromptLines(raw: unknown): string[] {
  return AcceptanceSpecSchema.array()
    .parse(raw)
    .map((spec) => renderSpecsAsText([spec]))
}
