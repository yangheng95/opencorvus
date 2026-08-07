import { Tooltip } from "./ui/Tooltip"
import { Show, createMemo, createSignal, onCleanup } from "solid-js"

import type { CardNode } from "../store/card-tree"
import { useNowTick } from "../services/clock"
import { cardDurationMs } from "../utils/card-timing"
import { formatCostUSD, formatTokenCount } from "../utils/format-usage"
import { t } from "../utils/i18n"
import { formatDuration, stamp } from "../utils/time"
import { Icon } from "./ui/Icon"
import { Button } from "./ui/Button"
import { CardOverflowMenu } from "./CardOverflowMenu"

function stopMetaClick(event: MouseEvent): void {
  event.stopPropagation()
}

async function writeClipboard(text: string): Promise<boolean> {
  if (!text) return false
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return true
  }
  return false
}

export function CardErrorReasonIndicator(props: { reason: string }) {
  const [copyFeedback, setCopyFeedback] = createSignal<"copied" | "failed" | null>(null)
  let copyFeedbackTimer: number | undefined

  onCleanup(() => {
    if (copyFeedbackTimer !== undefined) window.clearTimeout(copyFeedbackTimer)
  })

  async function copyReason(): Promise<void> {
    if (copyFeedbackTimer !== undefined) window.clearTimeout(copyFeedbackTimer)
    try {
      const copied = await writeClipboard(props.reason)
      setCopyFeedback(copied ? "copied" : "failed")
    } catch {
      setCopyFeedback("failed")
    }
    copyFeedbackTimer = window.setTimeout(() => {
      setCopyFeedback(null)
      copyFeedbackTimer = undefined
    }, 1400)
  }

  const feedbackText = () => {
    if (copyFeedback() === "copied") return t("common.copied")
    if (copyFeedback() === "failed") return t("markdown.copy_failed")
    return t("card.error_reason_copy_hint")
  }

  return (
    <Tooltip.Root openDelay={160} closeDelay={80} placement="top-start" gutter={7} fitViewport>
      <Tooltip.Trigger
        as={Button}
        type="button"
        variant="ghost"
        size="icon"
        tone="danger"
        class="card-error-reason-indicator"
        data-chrome="icon-action"
        data-ui="card-error-reason"
        data-copy-feedback={copyFeedback() ?? undefined}
        aria-label={t("card.error_reason_title")}
        onClick={stopMetaClick}
        onDblClick={(event: MouseEvent) => {
          event.preventDefault()
          event.stopPropagation()
          void copyReason()
        }}
      >
        <Icon name="error-reason" size="medium" />
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content class="card-error-reason-tooltip" data-ui="card-error-reason-tooltip">
          <strong>{t("card.error_reason_title")}</strong>
          <pre>{props.reason}</pre>
          <span data-copy-feedback={copyFeedback() ?? undefined} aria-live="polite">
            {feedbackText()}
          </span>
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

export function CardDurationChip(props: { node: CardNode }) {
  const now = useNowTick()
  const durationMs = createMemo<number | null>(() => cardDurationMs(props.node, now()))
  const toolStartedAt = createMemo<number | null>(() => {
    const start = props.node.time
    return props.node.kind === "tool" && Number.isFinite(start) && start > 0 ? start : null
  })
  const durationText = createMemo(() => {
    const ms = durationMs()
    return ms === null ? "" : formatDuration(ms)
  })

  return (
    <Show when={durationText()}>
      <>
        <Show when={toolStartedAt()}>
          {(startedAt) => (
            <time
              class="card__tool-start-time"
              data-ui="card-tool-start-time"
              dateTime={new Date(startedAt()).toISOString()}
            >
              {stamp(startedAt())}
            </time>
          )}
        </Show>
        <span
          class="card__duration"
          title={props.node.kind === "tool" ? undefined : t("card.duration_tooltip", { value: durationText() })}
        >
          {durationText()}
        </span>
      </>
    </Show>
  )
}

export function CardHeaderChrome(props: {
  node: CardNode
  actionsClass: string
  onRewind?: (cursorTime: number, anchorID: string, opts: { resetWorktree: boolean }) => Promise<void>
  traceSessionID?: string
  traceOpen?: boolean
  onTrace?: () => void
  agentSessionID?: string
  onAgentCancel?: (sessionID: string) => Promise<void>
  agentSteerOpen?: boolean
  onAgentSteerToggle?: () => void
  hideErrorReason?: boolean
}) {
  const modelLabel = () => props.node.model?.display || ""
  const hasContextTokens = () =>
    typeof props.node.contextTokens === "number" && (props.node.contextTokens as number) > 0
  const hasUsage = () => {
    const usage = props.node.usage
    if (!usage) return false
    return (usage.totalTokens ?? 0) > 0 || (usage.costUSD ?? 0) > 0
  }
  const usageTotalLabel = () => {
    const usage = props.node.usage
    if (!usage) return ""
    const total = usage.totalTokens ?? 0
    const input = usage.inputTokens ?? 0
    const output = usage.outputTokens ?? 0
    if (total > 0) return formatTokenCount(total)
    if (input > 0 || output > 0) return formatTokenCount(input + output)
    return ""
  }
  const usageCostLabel = () => {
    const usage = props.node.usage
    if (!usage) return ""
    const cost = usage.costUSD ?? 0
    return cost > 0 ? formatCostUSD(cost) : ""
  }
  const usageTip = () => {
    const usage = props.node.usage
    if (!usage) return ""
    const parts: string[] = []
    if ((usage.inputTokens ?? 0) > 0) {
      parts.push(t("card.usage_input_tokens", { value: String(usage.inputTokens) }))
    }
    if ((usage.outputTokens ?? 0) > 0) {
      parts.push(t("card.usage_output_tokens", { value: String(usage.outputTokens) }))
    }
    if ((usage.totalTokens ?? 0) > 0) {
      parts.push(t("card.usage_total_tokens", { value: String(usage.totalTokens) }))
    }
    if ((usage.costUSD ?? 0) > 0) {
      parts.push(t("card.usage_cost", { value: formatCostUSD(usage.costUSD!) }))
    }
    return parts.length > 0 ? t("card.usage_tooltip", { detail: parts.join(t("card.meta_separator")) }) : ""
  }
  const contextTokensTip = () =>
    t(props.node.contextTokensEstimated ? "card.context_tokens_tooltip_estimated" : "card.context_tokens_tooltip", {
      value: String(props.node.contextTokens),
    })
  const contextTokensLabel = () =>
    hasContextTokens()
      ? `~${formatTokenCount(props.node.contextTokens as number)} tok${
          props.node.contextTokensEstimated ? ` ${t("card.metadata_estimated")}` : ""
        }`
      : ""
  const usageLabel = () =>
    [usageTotalLabel() ? `${usageTotalLabel()} tok` : "", usageCostLabel()]
      .filter(Boolean)
      .join(t("card.meta_separator"))
  const metadataSummaryLabel = () =>
    [
      modelLabel() ? `${t("card.metadata_model")}: ${modelLabel()}` : "",
      contextTokensLabel() ? `${t("card.metadata_context")}: ${contextTokensLabel()}` : "",
      usageLabel() ? `${t("card.metadata_usage")}: ${usageLabel()}` : "",
    ]
      .filter(Boolean)
      .join(t("card.meta_separator"))
  const hasMetaActions = () => !!modelLabel() || hasContextTokens() || hasUsage()
  return (
    <div class={props.actionsClass}>
      <Show when={!props.hideErrorReason && props.node.status === "error" && props.node.errorReason}>
        {(reason) => (
          <div class="card__error-actions">
            <CardErrorReasonIndicator reason={reason()} />
          </div>
        )}
      </Show>
      <Show when={hasMetaActions()}>
        <div class="card__meta-actions">
          <Tooltip.Root openDelay={0} closeDelay={0} placement="top" gutter={6}>
            <Tooltip.Trigger
              as={Button}
              type="button"
              variant="ghost"
              size="icon"
              tone="neutral"
              data-chrome="icon-action"
              data-ui="card-metadata-summary"
              title={metadataSummaryLabel()}
              aria-label={metadataSummaryLabel()}
              onClick={stopMetaClick}
            >
              <Icon name="model-metadata" size="medium" />
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content class="card-meta-tooltip card-metadata-tooltip" data-ui="card-metadata-tooltip">
                <dl class="card-metadata-tooltip__rows">
                  <Show when={modelLabel()}>
                    <div class="card-metadata-tooltip__row" data-kind="model">
                      <dt>{t("card.metadata_model")}</dt>
                      <dd>{modelLabel()}</dd>
                    </div>
                  </Show>
                  <Show when={hasContextTokens()}>
                    <div
                      class="card-metadata-tooltip__row"
                      data-kind="context"
                      data-estimated={props.node.contextTokensEstimated ? "true" : undefined}
                      title={contextTokensTip()}
                    >
                      <dt>{t("card.metadata_context")}</dt>
                      <dd>{contextTokensLabel()}</dd>
                    </div>
                  </Show>
                  <Show when={hasUsage()}>
                    <div class="card-metadata-tooltip__row" data-kind="usage" title={usageTip()}>
                      <dt>{t("card.metadata_usage")}</dt>
                      <dd>{usageLabel()}</dd>
                    </div>
                  </Show>
                </dl>
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </div>
      </Show>
      <CardOverflowMenu
        node={props.node}
        class="card__control-actions"
        onRewind={props.onRewind}
        traceSessionID={props.traceSessionID}
        traceOpen={props.traceOpen}
        onTrace={props.onTrace}
        agentSessionID={props.agentSessionID}
        onAgentCancel={props.onAgentCancel}
        agentSteerOpen={props.agentSteerOpen}
        onAgentSteerToggle={props.onAgentSteerToggle}
      />
    </div>
  )
}
