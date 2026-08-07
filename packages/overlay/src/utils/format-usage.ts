// ── Usage formatters & aggregation ──
//
// Shared compact token / cost formatters used by every surface that prints
// LLM usage hints: per-card chrome (CardHeader, ChatBubble) and the chat
// header's whole-conversation aggregate strip. Single-source so the three
// surfaces stay byte-aligned — rule 8 (no double source) / rule 9 (no
// copy-paste).
//
// `aggregateUsageAcrossSessions` is the pure kernel of the chat-header
// usage strip. `store/card-tree-stats.ts` owns the Solid-store projection,
// while this file owns only the token/cost semantics so it can be
// unit-tested without touching the DOM or Solid.

/** Compact token count — "8.4k" rather than "8432", so low-contrast hint
 *  chrome reads at a glance without dominating the row. */
export function formatTokenCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—"
  if (n < 1000) return String(n)
  const units = [
    { value: 1_000, suffix: "k" },
    { value: 1_000_000, suffix: "m" },
    { value: 1_000_000_000, suffix: "b" },
    { value: 1_000_000_000_000, suffix: "t" },
  ]
  let unitIndex = 0
  while (unitIndex < units.length - 1 && n >= units[unitIndex + 1].value) unitIndex++

  const render = (index: number): string => {
    const scaled = n / units[index].value
    if (scaled < 10) {
      const rounded = Number(scaled.toFixed(1))
      return rounded >= 10
        ? `${Math.round(scaled)}${units[index].suffix}`
        : `${scaled.toFixed(1)}${units[index].suffix}`
    }
    return `${Math.round(scaled)}${units[index].suffix}`
  }

  let label = render(unitIndex)
  if (/^1000[.0]*[kmb]$/.test(label) && unitIndex < units.length - 1) {
    unitIndex++
    label = render(unitIndex)
  }
  return label
}

/** Format a cost in USD as a tight badge value: under $0.01 → "<$0.01",
 *  under $1 → 3-decimal cents-wise, otherwise 2 decimals. Hundreds of
 *  these scan past the operator so we stay under 7 chars. */
export function formatCostUSD(n: number): string {
  if (!Number.isFinite(n) || n < 0) return ""
  if (n === 0) return "$0"
  if (n < 0.01) return "<$0.01"
  if (n < 1) return "$" + n.toFixed(3)
  return "$" + n.toFixed(2)
}

/** Detailed United States dollar (USD) formatter for an inspectable usage
 * breakdown. Preserve meaningful sub-cent precision without exposing binary
 * floating-point tails. */
export const USD_COST_DECIMAL_PLACES = 12

export function formatDetailedCostUSD(n: number): string {
  if (!Number.isFinite(n) || n < 0) return ""
  if (n === 0) return "$0"
  const decimal = n.toFixed(USD_COST_DECIMAL_PLACES).replace(/0+$/, "").replace(/\.$/, "")
  return decimal === "0" ? "<$0.000000000001" : `$${decimal}`
}

/** Minimal card shape consumed by the usage aggregator. Kept
 *  independent of the full `CardNode` interface so tests can build
 *  fixtures without importing the store. */
export interface UsageCardLike {
  contextTokens?: number
  contextTokensEstimated?: boolean
  usage?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
    costUSD?: number
  }
}

export interface UsageAggregate {
  tokens: number
  costUSD: number
  estimated: boolean
}

/** Aggregate whole-conversation usage by summing each card's own
 *  per-message usage. tree-writer projects `Message.Assistant.{tokens,cost}`
 *  onto exactly one turn card per assistant message — every card carries
 *  its own message's totals, no overlap between cards — so a straight
 *  sum-across-cards gives the conversation total. Cards without a `usage`
 *  field (user messages, phase boundaries, tool-result chrome) contribute
 *  nothing. */
export function aggregateUsageAcrossSessions(cards: Iterable<UsageCardLike | undefined | null>): UsageAggregate {
  let tokens = 0
  let costUSD = 0
  let estimated = false
  for (const card of cards) {
    const usage = card?.usage
    if (usage) {
      const total = (usage.totalTokens ?? 0) || (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)
      if (total > 0 || (usage.costUSD ?? 0) > 0) {
        tokens += total
        costUSD += usage.costUSD ?? 0
        continue
      }
    }
    const contextTokens = card?.contextTokens ?? 0
    if (contextTokens > 0) {
      tokens += contextTokens
      estimated = estimated || !!card?.contextTokensEstimated
    }
  }
  return { tokens, costUSD, estimated }
}

/** Format a `{tokens, costUSD}` aggregate as compact UI text. Empty
 *  string when nothing was spent so consumers can omit their surface.
 *  Segments with zero value are dropped — a session that
 *  reports tokens but no cost should not show a stray "· $0", and
 *  vice-versa. */
export function formatUsageStrip(input: { tokens: number; costUSD: number; estimated?: boolean }): string {
  const parts: string[] = []
  if (input.tokens > 0) parts.push(`${input.estimated ? "~" : ""}${formatTokenCount(input.tokens)} tok`)
  if (input.costUSD > 0) {
    const costLabel = formatCostUSD(input.costUSD)
    if (costLabel) parts.push(costLabel)
  }
  return parts.join(" · ")
}
