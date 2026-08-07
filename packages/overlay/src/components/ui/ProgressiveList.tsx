import { createMemo, createSignal, For, Show, type Accessor, type JSX } from "solid-js"
import { t } from "../../utils/i18n"
import { Button } from "./Button"

const INITIAL_VISIBLE_ITEM_COUNT = 10

export interface ProgressiveListProps<T> {
  items: T[]
  children: (item: T, index: Accessor<number>) => JSX.Element
  class?: string
  dataUi?: string
}

export function ProgressiveList<T>(props: ProgressiveListProps<T>): JSX.Element {
  const [expanded, setExpanded] = createSignal(false)
  const hasOverflow = () => props.items.length > INITIAL_VISIBLE_ITEM_COUNT
  const visibleItems = createMemo(() => (expanded() ? props.items : props.items.slice(0, INITIAL_VISIBLE_ITEM_COUNT)))
  const className = () => ["oc-progressive-list", props.class].filter(Boolean).join(" ")

  return (
    <div class={className()} data-ui={props.dataUi ?? "progressive-list"} data-expanded={expanded() ? "true" : "false"}>
      <For each={visibleItems()}>{props.children}</For>
      <Show when={hasOverflow()}>
        <Button
          type="button"
          variant="ghost"
          size="mini"
          tone="neutral"
          class="oc-progressive-list__toggle"
          data-ui="progressive-list-toggle"
          data-chrome="text-disclosure"
          aria-expanded={expanded()}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded() ? t("progressive_list.collapse") : t("progressive_list.expand")}
        </Button>
      </Show>
    </div>
  )
}
