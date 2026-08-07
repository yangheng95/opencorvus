import { Progress } from "@kobalte/core/progress"
import { Show } from "solid-js"
import type { TodoSummary } from "../utils/todos"
import { t } from "../utils/i18n"
import { Tooltip } from "./ui/Tooltip"

export type TodoProgressVariant = "card" | "detail" | "subagent"

export function todoProgressText(summary: TodoSummary, terminal = false): string {
  const vars = {
    cancelled: String(summary.cancelled),
    completed: String(summary.completed),
    current: summary.current,
    remaining: String(summary.remaining),
    total: String(summary.total),
  }
  if (terminal && summary.remaining > 0) return t("todo.progress_value_terminal", vars)
  if (summary.cancelled > 0) {
    return summary.current ? t("todo.progress_value_cancelled_current", vars) : t("todo.progress_value_cancelled", vars)
  }
  return summary.current ? t("todo.progress_value_current", vars) : t("todo.progress_value", vars)
}

export function TodoProgress(props: {
  summary: TodoSummary
  variant: TodoProgressVariant
  terminal?: boolean
  showSummary?: boolean
}) {
  const progressText = () => todoProgressText(props.summary, props.terminal)
  const showSummary = () => props.showSummary !== false

  return (
    <Progress
      class={`todo-progress todo-progress--${props.variant}`}
      value={props.summary.resolved}
      minValue={0}
      maxValue={props.summary.total}
      getValueLabel={() => progressText()}
    >
      <Show when={showSummary()}>
        <div class="todo-progress__summary">
          <Progress.Label class="todo-progress__sr-only">{t("todo.progress_label")}</Progress.Label>
          <span class="todo-progress__count">
            {props.summary.completed}/{props.summary.total}
          </span>
          <Show when={props.summary.current}>
            {(current) => (
              <Show
                when={props.variant === "subagent"}
                fallback={<span class="todo-progress__current">{current()}</span>}
              >
                <Tooltip.Root openDelay={180} closeDelay={80} placement="top-start" gutter={6} fitViewport>
                  <Tooltip.Trigger
                    as="span"
                    class="todo-progress__current todo-progress__current--tooltip"
                    data-ui="subagent-current-todo"
                    tabIndex={0}
                  >
                    {current()}
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content class="todo-progress__tooltip" data-ui="subagent-current-todo-tooltip">
                      {current()}
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Show>
            )}
          </Show>
        </div>
      </Show>
      <Progress.Track class="todo-progress__track">
        <Progress.Fill class="todo-progress__fill" />
      </Progress.Track>
    </Progress>
  )
}
