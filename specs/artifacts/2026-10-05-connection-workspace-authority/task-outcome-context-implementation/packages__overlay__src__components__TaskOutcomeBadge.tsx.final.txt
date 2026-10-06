import { createMemo, Show } from "solid-js"
import type { WorkLedgerTaskRow } from "../services/work-ledger"
import { taskLifecycleStatusLabel } from "../utils/status-labels"
import { Badge } from "./ui/Badge"
import { StatusIndicator } from "./ui/StatusIndicator"

/** The current Task execution result is separate from its physical activity. */
export function TaskOutcomeBadge(props: { status: WorkLedgerTaskRow["lifecycleStatus"] }) {
  const terminal = createMemo(() => (props.status === "active" ? undefined : props.status))
  return (
    <Show when={terminal()}>
      {(status) => (
        <Badge
          class="task-outcome-badge"
          size="sm"
          tone={status() === "completed" ? "ok" : status() === "failed" ? "bad" : "muted"}
          title={taskLifecycleStatusLabel(status())}
          aria-label={taskLifecycleStatusLabel(status())}
        >
          <StatusIndicator status={status()} label={taskLifecycleStatusLabel(status())} aria-hidden="true" />
          <span>{taskLifecycleStatusLabel(status())}</span>
        </Badge>
      )}
    </Show>
  )
}
