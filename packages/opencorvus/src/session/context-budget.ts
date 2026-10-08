import type { Config } from "@/config/config"
import type { Provider } from "@/provider/provider"
import { ProviderTransform } from "@/provider/transform"
import type { Message } from "./message"

export namespace ContextBudget {
  export const COMPACTION_THRESHOLD_DEFAULT = 0.9
  export const MAX_CONTEXT_TOKENS_DEFAULT = 256_000
  export const DEFAULT_TAIL_TURNS = 2
  export const MIN_PRESERVE_RECENT_TOKENS = 2_000
  export const PRESERVE_RECENT_RATIO = 0.25

  export function capacity(input: { config: Config.Info; model: Provider.Model; effectiveOutputTokens?: number }) {
    const context = input.model.limit.context
    const prompt = input.model.limit.input
    const output = input.effectiveOutputTokens ?? ProviderTransform.maxOutputTokens(input.model)
    const reserved = Math.max(output, input.config.compaction?.reserved ?? 0)
    const limits = [
      input.config.compaction?.max_context_tokens ?? MAX_CONTEXT_TOKENS_DEFAULT,
      context > 0 ? Math.max(0, context - reserved) : undefined,
      prompt && prompt > 0 ? prompt : undefined,
    ].filter((value): value is number => value !== undefined)
    return { status: "known" as const, tokens: Math.min(...limits) }
  }

  export function usable(input: { config: Config.Info; model: Provider.Model; effectiveOutputTokens?: number }) {
    return capacity(input).tokens
  }

  export function preserveRecent(input: { config: Config.Info; model: Provider.Model }) {
    return Math.min(
      Math.floor(usable(input) * threshold(input)),
      input.config.compaction?.preserve_recent_tokens ??
        Math.max(MIN_PRESERVE_RECENT_TOKENS, Math.floor(usable(input) * PRESERVE_RECENT_RATIO)),
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
    const budget = capacity(input)
    const usableBudget = budget.tokens
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
    return usageCount(input.tokens) >= usable(input) * threshold({ config: input.config })
  }
}
