import { Show, type JSX } from "solid-js"
import { t } from "../utils/i18n"
import { Feedback } from "./ui/Feedback"
import { Button } from "./ui/Button"
import { ProgressiveList } from "./ui/ProgressiveList"

export interface LedgerListProps<T> {
  items: T[]
  loading?: boolean
  loadingLabel: string
  error?: string
  emptyLabel: string
  retryLabel?: string
  retryRef?: (button: HTMLButtonElement) => void
  onRetry?: () => void
  revealItem?: T
  onRevealReady?: () => void
  onExpansionFocus?: (firstRevealed: T) => void
  children: (item: T) => JSX.Element
}

export function LedgerLoadingStatus(props: { label: string; class?: string; dataUi?: string }) {
  const className = () => (props.class ? `ledger-skeleton ${props.class}` : "ledger-skeleton")
  return (
    <div
      class={className()}
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-ui={props.dataUi ?? "ledger-loading"}
    >
      <span class="ledger-loading-label">{props.label}</span>
      <div class="ledger-skeleton-rows" aria-hidden="true">
        <div class="ledger-skeleton-row" />
        <div class="ledger-skeleton-row" />
        <div class="ledger-skeleton-row" />
      </div>
    </div>
  )
}

export function LedgerList<T>(props: LedgerListProps<T>) {
  const initialLoading = () => Boolean(props.loading && !props.error && props.items.length === 0)
  return (
    <div class="ledger-list" data-ui="ledger-list" aria-busy={props.loading ? "true" : "false"}>
      <Show when={props.error}>
        <Feedback
          class="work-ledger-read-feedback"
          tone="error"
          details={
            <div class="work-ledger-read-diagnostic" role="region" aria-label={t("common.details")} tabIndex={0}>
              {props.error}
            </div>
          }
          data-ui="ledger-error"
          actions={
            <Show when={props.onRetry}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                tone="neutral"
                ref={(button) => props.retryRef?.(button)}
                aria-disabled={props.loading || undefined}
                aria-busy={props.loading || undefined}
                onClick={() => {
                  if (!props.loading) props.onRetry?.()
                }}
              >
                {props.loading ? t("common.retrying") : props.retryLabel}
              </Button>
            </Show>
          }
        >
          {props.items.length > 0 ? t("ledger.update_failed") : t("ledger.load_failed")}
        </Feedback>
      </Show>
      <Show when={initialLoading()}>
        <LedgerLoadingStatus label={props.loadingLabel} />
      </Show>
      <Show when={!props.loading && props.items.length === 0 && !props.error}>
        <div class="ledger-empty" data-ui="ledger-empty">
          {props.emptyLabel}
        </div>
      </Show>
      <Show when={props.items.length > 0}>
        <ProgressiveList
          items={props.items}
          dataUi="ledger-progressive-list"
          revealItem={props.revealItem}
          onRevealReady={props.onRevealReady}
          onExpansionFocus={props.onExpansionFocus}
        >
          {(item) => props.children(item)}
        </ProgressiveList>
      </Show>
    </div>
  )
}
