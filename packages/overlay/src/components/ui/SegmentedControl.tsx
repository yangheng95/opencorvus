import {
  Item as KobalteSegmentedItem,
  ItemInput as KobalteSegmentedInput,
  ItemLabel as KobalteSegmentedLabel,
  Root as KobalteSegmentedRoot,
} from "@kobalte/core/segmented-control"
import { For } from "solid-js"
import type { JSX } from "solid-js"

export type SegmentedControlTone = "ok" | "warn" | "bad" | "accent" | "muted" | "neutral"
export type SegmentedControlSize = "sm" | "md"

export interface SegmentedControlOption<T extends string> {
  value: T
  label: JSX.Element
  tone?: SegmentedControlTone
  title?: string
  disabled?: boolean
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[]
  value: T
  ariaLabel?: string
  size?: SegmentedControlSize
  class?: string
  itemClass?: string
  onChange?: (next: T) => void
  onActivate?: (value: T) => void
  itemAttributes?: (option: SegmentedControlOption<T>) => Record<string, string | number | boolean | undefined>
  renderOption?: (option: SegmentedControlOption<T>) => JSX.Element
}

function classes(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(" ")
}

function onItemKeyDown(event: KeyboardEvent & { currentTarget: HTMLInputElement }): void {
  if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
  if (event.key === "Enter") {
    event.preventDefault()
    event.currentTarget.click()
    return
  }
  if (event.key !== "Home" && event.key !== "End") return
  const inputs = event.currentTarget.closest('[role="radiogroup"]')?.querySelectorAll<HTMLInputElement>('input[type="radio"]:not(:disabled)')
  const next = event.key === "Home" ? inputs?.[0] : inputs?.[(inputs?.length ?? 0) - 1]
  if (!next) return
  event.preventDefault()
  next.focus()
}

export function SegmentedControl<T extends string>(props: SegmentedControlProps<T>): JSX.Element {
  function handleChange(next: string) {
    if (next && next !== props.value) props.onChange?.(next as T)
  }

  return (
    <KobalteSegmentedRoot
      class={classes("oc-segmented", props.class)}
      value={props.value}
      onChange={handleChange}
      aria-label={props.ariaLabel}
      data-size={props.size ?? "md"}
    >
      <For each={props.options}>
        {(option) => (
          <KobalteSegmentedItem
            {...(props.itemAttributes?.(option) ?? {})}
            class={classes("oc-segmented__item", props.itemClass)}
            value={option.value}
            data-tone={option.tone ?? "neutral"}
            data-value={option.value}
            title={option.title}
            disabled={option.disabled}
          >
            <KobalteSegmentedInput
              class="oc-segmented__input"
              title={option.title}
              onClick={() => props.onActivate?.(option.value)}
              onKeyDown={onItemKeyDown}
            />
            <KobalteSegmentedLabel class="oc-segmented__label">
              {props.renderOption ? props.renderOption(option) : option.label}
            </KobalteSegmentedLabel>
          </KobalteSegmentedItem>
        )}
      </For>
    </KobalteSegmentedRoot>
  )
}
