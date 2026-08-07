import { Show, createMemo, createSignal, onCleanup } from "solid-js"

import { formatErrorDetails, reportError } from "../services/diagnostics"
import type { CardModelUsage, CardNode, CardUsage } from "../store/card-tree"
import { formatDetailedCostUSD, formatTokenCount } from "../utils/format-usage"
import { t } from "../utils/i18n"
import { compactDetailStamp, fullStampWithRelative } from "../utils/time"
import { Button } from "./ui/Button"
import { Icon } from "./ui/Icon"
import { Popover } from "./ui/Popover"
import { SegmentedControl, type SegmentedControlOption } from "./ui/SegmentedControl"

const ALL_MODELS = "__all_models__"

function modelUsageKey(model: Pick<CardModelUsage, "providerID" | "modelID">): string {
  return JSON.stringify([model.providerID, model.modelID])
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat().format(value)
}

export interface ConversationTurnControlProps {
  node: CardNode
  copyText?: string
  agentSteerOpen?: boolean
  onAgentSteerToggle?: () => void
}

/** The sole bottom action and usage surface for one visible Conversation turn.
 * Structured and Tool cards retain `CardHeaderChrome`; ordinary turns never
 * mount both surfaces. */
export function ConversationTurnControl(props: ConversationTurnControlProps) {
  const [copyState, setCopyState] = createSignal<"idle" | "copied">("idle")
  const [selectedModelKey, setSelectedModelKey] = createSignal(ALL_MODELS)
  let copyFeedbackTimer: number | undefined

  onCleanup(() => {
    if (copyFeedbackTimer !== undefined) window.clearTimeout(copyFeedbackTimer)
  })

  const usage = () => props.node.usage
  const models = () => usage()?.models ?? []
  const selectedModel = createMemo(() => {
    const key = selectedModelKey()
    if (key === ALL_MODELS) return undefined
    return models().find((model) => modelUsageKey(model) === key)
  })
  const selectedUsage = createMemo<CardUsage | CardModelUsage | undefined>(() => selectedModel() ?? usage())
  const selectorValue = () => (selectedModel() ? selectedModelKey() : ALL_MODELS)
  const modelOptions = createMemo<SegmentedControlOption<string>[]>(() => [
    { value: ALL_MODELS, label: t("chat.turn_usage_all_models") },
    ...models().map((model) => ({ value: modelUsageKey(model), label: model.display })),
  ])
  const hasUsage = () => {
    const value = usage()
    return !!value && (value.totalTokens > 0 || value.costUSD > 0)
  }
  const usageTriggerValue = () => {
    const value = usage()
    if (!value) return ""
    const cost = formatDetailedCostUSD(value.costUSD)
    return value.costUSD > 0 ? cost : formatTokenCount(value.totalTokens).toUpperCase()
  }
  const usageTriggerAriaValue = () => {
    const value = usage()
    if (!value) return ""
    return value.costUSD > 0 ? formatDetailedCostUSD(value.costUSD) : `${usageTriggerValue()} Token`
  }
  const selectedModelLabel = () => {
    const model = selectedModel()
    if (model) return model.display
    const count = models().length
    return count === 1 ? models()[0]?.display || "" : t("chat.turn_usage_model_count", { value: String(count) })
  }

  async function copyTurn(): Promise<void> {
    const text = props.copyText?.trim() || ""
    if (!text) return
    if (copyFeedbackTimer !== undefined) window.clearTimeout(copyFeedbackTimer)
    try {
      if (!navigator.clipboard?.writeText) throw new Error(t("chat.message_copy_unavailable"))
      await navigator.clipboard.writeText(text)
      setCopyState("copied")
      copyFeedbackTimer = window.setTimeout(() => {
        setCopyState("idle")
        copyFeedbackTimer = undefined
      }, 1200)
    } catch (error) {
      reportError({
        id: `chat-message-copy:${props.node.id}`,
        title: t("common.error"),
        message: t("chat.message_copy_failed"),
        details: formatErrorDetails(error),
      })
    }
  }

  return (
    <div class="conversation-turn-control" data-ui="conversation-turn-control">
      <div class="conversation-turn-control__actions">
        <Show when={props.copyText?.trim()}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            tone="neutral"
            data-chrome="icon-action"
            data-ui="conversation-turn-copy"
            data-state={copyState()}
            title={t(copyState() === "copied" ? "chat.message_copied" : "chat.message_copy")}
            aria-label={t(copyState() === "copied" ? "chat.message_copied" : "chat.message_copy")}
            onClick={() => void copyTurn()}
          >
            <Icon name={copyState() === "copied" ? "check" : "copy"} />
          </Button>
        </Show>
        <Show when={props.onAgentSteerToggle}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            tone="neutral"
            class="conversation-turn-control__guidance"
            data-chrome="icon-action"
            data-ui="conversation-turn-guidance"
            aria-expanded={props.agentSteerOpen}
            title={t("card.agent_reply_toggle")}
            aria-label={t("card.agent_reply_toggle")}
            onClick={() => props.onAgentSteerToggle?.()}
          >
            <Icon name="message" />
          </Button>
        </Show>
      </div>

      <div class="conversation-turn-control__facts">
        <Show when={hasUsage()}>
          <Popover.Root placement="top-start" gutter={7} slide={false} fitViewport>
            <Popover.Trigger
              as={Button}
              type="button"
              variant="ghost"
              size="sm"
              tone="neutral"
              class="conversation-turn-control__usage-trigger"
              data-ui="conversation-turn-usage-trigger"
              title={t("chat.turn_usage_aria", { value: usageTriggerAriaValue() })}
              aria-label={t("chat.turn_usage_aria", { value: usageTriggerAriaValue() })}
            >
              <Icon name="usage-metrics" />
              <span>{usageTriggerValue()}</span>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content class="conversation-turn-usage-popover" data-ui="conversation-turn-usage-popover">
                <div class="conversation-turn-usage-popover__heading">
                  <strong>{t("chat.turn_usage_title")}</strong>
                  <span>
                    {formatTokenCount(usage()!.totalTokens)} Token · {formatDetailedCostUSD(usage()!.costUSD)}
                  </span>
                </div>
                <Show when={models().length > 1}>
                  <SegmentedControl
                    class="conversation-turn-usage-popover__models"
                    options={modelOptions()}
                    value={selectorValue()}
                    size="sm"
                    ariaLabel={t("chat.turn_usage_select_model")}
                    onChange={setSelectedModelKey}
                  />
                </Show>
                <Show when={selectedUsage()}>
                  {(value) => (
                    <dl class="conversation-turn-usage-popover__rows">
                      <div>
                        <dt>{t("card.metadata_model")}</dt>
                        <dd>{selectedModelLabel()}</dd>
                      </div>
                      <div>
                        <dt>{t("chat.turn_usage_input")}</dt>
                        <dd>{formatInteger(value().inputTokens)}</dd>
                      </div>
                      <div>
                        <dt>{t("chat.turn_usage_output")}</dt>
                        <dd>{formatInteger(value().outputTokens)}</dd>
                      </div>
                      <div>
                        <dt>{t("chat.turn_usage_reasoning")}</dt>
                        <dd>{formatInteger(value().reasoningTokens)}</dd>
                      </div>
                      <div>
                        <dt>{t("chat.turn_usage_cache")}</dt>
                        <dd>
                          {formatInteger(value().cacheReadTokens)} / {formatInteger(value().cacheWriteTokens)}
                        </dd>
                      </div>
                      <div>
                        <dt>{t("chat.turn_usage_total_tokens")}</dt>
                        <dd>{formatInteger(value().totalTokens)}</dd>
                      </div>
                      <div>
                        <dt>{t("chat.turn_usage_cost")}</dt>
                        <dd>{formatDetailedCostUSD(value().costUSD)}</dd>
                      </div>
                    </dl>
                  )}
                </Show>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </Show>

        <time
          class="conversation-turn-control__time"
          dateTime={new Date(props.node.time).toISOString()}
          title={fullStampWithRelative(props.node.time)}
        >
          {compactDetailStamp(props.node.time)}
        </time>
      </div>
    </div>
  )
}
