import type { Config } from "@/config/config"
import type { Provider } from "@/provider/provider"
import { ProviderTransform } from "@/provider/transform"
import type { Message } from "./message"

export namespace ContextBudget {
  export const COMPACTION_BUFFER = 20_000
  export const COMPACTION_THRESHOLD_DEFAULT = 0.9
  export const DEFAULT_TAIL_TURNS = 2
  export const MIN_PRESERVE_RECENT_TOKENS = 2_000
  export const MAX_PRESERVE_RECENT_TOKENS = 8_000

  export function usable(input: { config: Config.Info; model: Provider.Model }) {
    const context = input.model.limit.context
    if (context === 0) return 0
    const reserved =
      input.config.compaction?.reserved ?? Math.min(COMPACTION_BUFFER, ProviderTransform.maxOutputTokens(input.model))
    const usable = input.model.limit.input ? input.model.limit.input - reserved : context - reserved
    return Math.max(0, usable)
  }

  export function preserveRecent(input: { config: Config.Info; model: Provider.Model }) {
    return (
      input.config.compaction?.preserve_recent_tokens ??
      Math.min(MAX_PRESERVE_RECENT_TOKENS, Math.max(MIN_PRESERVE_RECENT_TOKENS, Math.floor(usable(input) * 0.25)))
    )
  }

  export function usageCount(tokens: Message.Assistant["tokens"]) {
    return tokens.total || tokens.input + tokens.output + tokens.cache.read + tokens.cache.write
  }

  export function threshold(input: { config: Config.Info }) {
    return input.config.compaction?.threshold ?? COMPACTION_THRESHOLD_DEFAULT
  }

  export function predictiveLimit(input: { config: Config.Info; model: Provider.Model }) {
    if (input.config.compaction?.auto === false) return undefined
    if (input.model.limit.context === 0) return undefined
    const usableBudget = usable(input)
    if (usableBudget === 0) return undefined
    const ratio = threshold({ config: input.config })
    return {
      usableBudget,
      threshold: ratio,
      limit: Math.floor(usableBudget * ratio),
    }
  }

  export function isUsageOverflow(input: {
    config: Config.Info
    tokens: Message.Assistant["tokens"]
    model: Provider.Model
  }) {
    if (input.config.compaction?.auto === false) return false
    if (input.model.limit.context === 0) return false
    return usageCount(input.tokens) >= usable(input) * threshold({ config: input.config })
  }
}
