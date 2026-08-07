// Upstream source: anomalyco/opencode packages/core/src/github-copilot/chat/map-openai-compatible-finish-reason.ts @ 8e2d422ffe56f3b2eb52e3f7195a2f9722a9fc46.
import type { LanguageModelV3FinishReason } from "@ai-sdk/provider"

export function mapOpenAICompatibleFinishReason(
  finishReason: string | null | undefined,
): LanguageModelV3FinishReason["unified"] {
  switch (finishReason) {
    case "stop":
      return "stop"
    case "length":
      return "length"
    case "content_filter":
      return "content-filter"
    case "function_call":
    case "tool_calls":
      return "tool-calls"
    default:
      return "other"
  }
}
