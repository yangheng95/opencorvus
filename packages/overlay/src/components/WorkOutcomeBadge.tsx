import { createMemo, Show } from "solid-js"
import { workLedgerOutcomeStatus, type WorkLedgerItemRow, type WorkLedgerOutcomeStatus } from "../services/work-ledger"
import { taskLifecycleStatusLabel } from "../utils/status-labels"
import { t } from "../utils/i18n"
import { Badge } from "./ui/Badge"
import { StatusIndicator } from "./ui/StatusIndicator"

function outcomeLabel(status: WorkLedgerOutcomeStatus): string {
  return status === "blocked" ? t("mission.outcome.blocked") : taskLifecycleStatusLabel(status)
}

export function WorkOutcomeBadge(props: { item: WorkLedgerItemRow | null | undefined; compact?: boolean }) {
  const terminal = createMemo(() => (props.item ? workLedgerOutcomeStatus(props.item) : null))
  return (
    <Show when={terminal()}>
      {(status) => (
        <Badge
          class="work-outcome-badge"
          size="sm"
          tone={
            status() === "completed" ? "ok" : status() === "failed" ? "bad" : status() === "blocked" ? "warn" : "muted"
          }
          title={outcomeLabel(status())}
          aria-label={outcomeLabel(status())}
        >
          <StatusIndicator status={status()} label={outcomeLabel(status())} aria-hidden="true" />
          <Show when={!props.compact}>
            <span>{outcomeLabel(status())}</span>
          </Show>
        </Badge>
      )}
    </Show>
  )
}
