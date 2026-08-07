import type { CardModelUsage, CardUsage } from "../store/card-tree"
import { USD_COST_DECIMAL_PLACES } from "./format-usage"

export interface TurnUsageContribution extends Omit<CardModelUsage, "messageCount"> {
  messageID: string
  observedAt: number
}

interface MutableModelUsage extends CardModelUsage {
  firstObservedAt: number
  firstMessageID: string
}

/** Normalize binary floating-point addition while retaining sub-cent model costs. */
function addCostUSD(left: number, right: number) {
  return Number((left + right).toFixed(USD_COST_DECIMAL_PLACES))
}

/** Aggregate persisted assistant-message usage into the complete positive
 * contract rendered by one Conversation turn. */
export function aggregateTurnUsage(contributions: readonly TurnUsageContribution[]): CardUsage {
  const total: CardUsage = {
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    totalTokens: 0,
    costUSD: 0,
    models: [],
  }
  const models = new Map<string, MutableModelUsage>()

  for (const contribution of contributions) {
    total.inputTokens += contribution.inputTokens
    total.outputTokens += contribution.outputTokens
    total.reasoningTokens += contribution.reasoningTokens
    total.cacheReadTokens += contribution.cacheReadTokens
    total.cacheWriteTokens += contribution.cacheWriteTokens
    total.totalTokens += contribution.totalTokens
    total.costUSD = addCostUSD(total.costUSD, contribution.costUSD)

    const key = JSON.stringify([contribution.providerID, contribution.modelID])
    const model = models.get(key)
    if (model) {
      model.messageCount += 1
      model.inputTokens += contribution.inputTokens
      model.outputTokens += contribution.outputTokens
      model.reasoningTokens += contribution.reasoningTokens
      model.cacheReadTokens += contribution.cacheReadTokens
      model.cacheWriteTokens += contribution.cacheWriteTokens
      model.totalTokens += contribution.totalTokens
      model.costUSD = addCostUSD(model.costUSD, contribution.costUSD)
      if (
        contribution.observedAt < model.firstObservedAt ||
        (contribution.observedAt === model.firstObservedAt && contribution.messageID < model.firstMessageID)
      ) {
        model.firstObservedAt = contribution.observedAt
        model.firstMessageID = contribution.messageID
      }
      continue
    }

    models.set(key, {
      providerID: contribution.providerID,
      modelID: contribution.modelID,
      display: contribution.display,
      messageCount: 1,
      inputTokens: contribution.inputTokens,
      outputTokens: contribution.outputTokens,
      reasoningTokens: contribution.reasoningTokens,
      cacheReadTokens: contribution.cacheReadTokens,
      cacheWriteTokens: contribution.cacheWriteTokens,
      totalTokens: contribution.totalTokens,
      costUSD: contribution.costUSD,
      firstObservedAt: contribution.observedAt,
      firstMessageID: contribution.messageID,
    })
  }

  total.models = [...models.values()]
    .sort(
      (left, right) =>
        left.firstObservedAt - right.firstObservedAt || left.firstMessageID.localeCompare(right.firstMessageID),
    )
    .map(({ firstObservedAt: _firstObservedAt, firstMessageID: _firstMessageID, ...model }) => model)
  return total
}
