// Upstream source: anomalyco/opencode packages/core/src/github-copilot/responses/map-openai-responses-finish-reason.ts @ 8e2d422ffe56f3b2eb52e3f7195a2f9722a9fc46.
import type { LanguageModelV3FinishReason } from "@ai-sdk/provider"

export function mapOpenAIResponseFinishReason({
  finishReason,
  hasFunctionCall,
}: {
  finishReason: string | null | undefined
  // flag that checks if there have been client-side tool calls (not executed by openai)
  hasFunctionCall: boolean
}): LanguageModelV3FinishReason["unified"] {
  switch (finishReason) {
    case undefined:
    case null:
      return hasFunctionCall ? "tool-calls" : "stop"
    case "max_output_tokens":
      return "length"
    case "content_filter":
      return "content-filter"
    default:
      return hasFunctionCall ? "tool-calls" : "other"
  }
}
