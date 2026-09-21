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
  onRetry?: () => void
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
  const initialLoading = () => Boolean(props.loading && props.items.length === 0)
  return (
    <div class="ledger-list" data-ui="ledger-list" aria-busy={props.loading ? "true" : "false"}>
      <Show when={props.error}>
        <Feedback
          tone="error"
          details={props.error}
          data-ui="ledger-error"
          actions={
            <Show when={props.onRetry}>
              <Button type="button" variant="ghost" size="sm" tone="neutral" onClick={() => props.onRetry?.()}>
                {props.retryLabel}
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
        <ProgressiveList items={props.items} dataUi="ledger-progressive-list">
          {(item) => props.children(item)}
        </ProgressiveList>
      </Show>
    </div>
  )
}
