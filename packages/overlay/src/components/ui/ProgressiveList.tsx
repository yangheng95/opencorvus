import { createEffect, createMemo, createSignal, For, onCleanup, Show, type Accessor, type JSX } from "solid-js"
import { t } from "../../utils/i18n"
import { Button } from "./Button"

const INITIAL_VISIBLE_ITEM_COUNT = 10

export interface ProgressiveListProps<T> {
  items: T[]
  initialVisibleCount?: number
  children: (item: T, index: Accessor<number>) => JSX.Element
  class?: string
  dataUi?: string
  revealItem?: T
  onRevealReady?: () => void
  /** Optional owner for focus after keyboard or assistive activation of the disclosure. */
  onExpansionFocus?: (firstRevealed: T) => void
}

export function ProgressiveList<T>(props: ProgressiveListProps<T>): JSX.Element {
  const [expanded, setExpanded] = createSignal(false)
  const visibleCount = () => props.initialVisibleCount ?? INITIAL_VISIBLE_ITEM_COUNT
  const hasOverflow = () => props.items.length > visibleCount()
  const visibleItems = createMemo(() => (expanded() ? props.items : props.items.slice(0, visibleCount())))
  const className = () => ["oc-progressive-list", props.class].filter(Boolean).join(" ")
  let disposed = false
  onCleanup(() => {
    disposed = true
  })
  createEffect(() => {
    const item = props.revealItem
    if (item === undefined) return
    const index = props.items.indexOf(item)
    if (index < 0) return
    if (index >= visibleCount()) setExpanded(true)
    queueMicrotask(() => {
      if (!disposed && props.revealItem === item && props.items.includes(item)) props.onRevealReady?.()
    })
  })

  function toggleExpansion(event: MouseEvent & { currentTarget: HTMLButtonElement }): void {
    if (expanded()) {
      setExpanded(false)
      return
    }
    if (!hasOverflow()) return
    const trigger = event.currentTarget
    const shouldTransferFocus = event.detail === 0 && trigger.ownerDocument.activeElement === trigger
    const firstRevealed = props.items[visibleCount()]
    setExpanded(true)
    if (!shouldTransferFocus || !props.onExpansionFocus) return
    queueMicrotask(() => {
      if (
        !disposed && expanded() && trigger.isConnected &&
        trigger.ownerDocument.activeElement === trigger &&
        props.items[visibleCount()] === firstRevealed
      ) {
        props.onExpansionFocus?.(firstRevealed)
      }
    })
  }

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
          onClick={toggleExpansion}
        >
          {expanded() ? t("progressive_list.collapse") : t("progressive_list.expand")}
        </Button>
      </Show>
    </div>
  )
}
