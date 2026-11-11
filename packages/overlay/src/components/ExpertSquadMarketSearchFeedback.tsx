import { Show } from "solid-js"
import { formatErrorDetails } from "../services/diagnostics"
import { t } from "../utils/i18n"
import { Button } from "./ui/Button"
import { Feedback } from "./ui/Feedback"
import { Icon } from "./ui/Icon"

export function ExpertSquadMarketSearchFeedback(props: {
  failure: { cause: unknown } | undefined
  loading: boolean
  onRetry: (trigger: HTMLButtonElement) => void
}) {
  return (
    <Show when={props.failure}>
      {(failure) => (
        <Feedback
          tone="error"
          data-ui="expert-squad-market-search-error"
          details={formatErrorDetails(failure().cause)}
          actions={
            <Button
              type="button"
              variant="outline"
              size="sm"
              tone="neutral"
              aria-disabled={props.loading || undefined}
              aria-busy={props.loading || undefined}
              onClick={(event) => props.onRetry(event.currentTarget)}
            >
              <Icon name={props.loading ? "loading" : "refresh"} size="compact" />
              {t(props.loading ? "common.retrying" : "common.retry")}
            </Button>
          }
        >
          {t("expert_squad.market_search_failed")}
        </Feedback>
      )}
    </Show>
  )
}
