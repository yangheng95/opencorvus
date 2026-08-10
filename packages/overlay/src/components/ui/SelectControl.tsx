import * as Select from "@kobalte/core/select"
import { Show, type JSX } from "solid-js"
import { Icon } from "./Icon"
import { Tooltip } from "./Tooltip"

type SelectDataAttributes = Record<string, string | undefined>
export type SelectControlVariant = "control" | "composer"

export interface SelectControlProps<T extends object> {
  options: T[]
  value: T | null
  onChange: (next: T | null) => void
  renderValue: (selected: T | null) => JSX.Element
  renderOptionLabel: (option: T) => JSX.Element
  optionValue?: keyof T | ((option: T) => string | number)
  optionTextValue?: keyof T | ((option: T) => string)
  renderOptionDescription?: (option: T) => JSX.Element | undefined
  renderOptionTooltip?: (option: T) => JSX.Element | undefined
  optionData?: (option: T) => SelectDataAttributes
  class?: string
  variant?: SelectControlVariant
  id?: string
  triggerID?: string
  triggerTitle?: string
  triggerDataUI?: string
  triggerTestID?: string
  triggerRef?: (el: HTMLButtonElement) => void
  ariaLabel?: string
  ariaLabelledBy?: string
  disabled?: boolean
  disallowEmptySelection?: boolean
  gutter?: number
  sameWidth?: boolean
}

function withClass(base: string, extra?: string): string {
  return extra ? `${base} ${extra}` : base
}

export function SelectControl<T extends object>(props: SelectControlProps<T>): JSX.Element {
  const variant = () => props.variant ?? "control"
  const shouldWrapOptionCopy = () => !!props.renderOptionDescription

  function SelectControlItem(itemProps: Select.SelectRootItemComponentProps<T>): JSX.Element {
    const option = () => itemProps.item.rawValue
    const description = () => props.renderOptionDescription?.(option())
    const tooltip = () => props.renderOptionTooltip?.(option())
    const optionData = () => props.optionData?.(option()) ?? {}
    const optionCopy = () => (
      <>
        <Select.ItemLabel>{props.renderOptionLabel(option())}</Select.ItemLabel>
        <Show when={description()}>{(value) => <small>{value()}</small>}</Show>
      </>
    )
    return (
      <Select.Item item={itemProps.item} class="oc-select-option" data-variant={variant()} {...optionData()}>
        <Show
          when={tooltip()}
          fallback={
            <Show when={shouldWrapOptionCopy()} fallback={optionCopy()}>
              <span class="oc-select-option-copy">{optionCopy()}</span>
            </Show>
          }
        >
          {(tooltipCopy) => (
            <Tooltip.Root openDelay={180} closeDelay={80} placement="left" gutter={8}>
              <Tooltip.Trigger as="span" class="oc-select-option-copy">
                {optionCopy()}
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content class="oc-select-option-tooltip">{tooltipCopy()}</Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          )}
        </Show>
        <Select.ItemIndicator class="oc-select-indicator">
          <Icon name="status-completed" size="compact" />
        </Select.ItemIndicator>
      </Select.Item>
    )
  }

  return (
    <Select.Root<T>
      id={props.id}
      class={withClass("oc-select", props.class)}
      options={props.options}
      optionValue={props.optionValue}
      optionTextValue={props.optionTextValue}
      value={props.value}
      onChange={props.onChange}
      itemComponent={SelectControlItem}
      disabled={props.disabled}
      disallowEmptySelection={props.disallowEmptySelection}
      gutter={props.gutter ?? 4}
      sameWidth={props.sameWidth ?? true}
    >
      <Select.Trigger
        id={props.triggerID}
        class="oc-select-trigger"
        data-variant={variant()}
        title={props.triggerTitle}
        data-ui={props.triggerDataUI}
        data-testid={props.triggerTestID}
        aria-label={props.ariaLabel}
        aria-labelledby={props.ariaLabelledBy}
        ref={props.triggerRef}
      >
        <span class="oc-select-value">{props.renderValue(props.value)}</span>
        <Select.Icon class="oc-select-icon">
          <Icon name="chevron-down" size="compact" />
        </Select.Icon>
      </Select.Trigger>
      <Select.HiddenSelect aria-label={props.ariaLabel} aria-labelledby={props.ariaLabelledBy} />
      <Select.Portal>
        <Select.Content class="oc-select-content" data-variant={variant()}>
          <Show when={variant() === "composer" && props.ariaLabel}>
            <div class="oc-select-heading">{props.ariaLabel}</div>
          </Show>
          <Select.Listbox class="oc-select-listbox" data-variant={variant()} />
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}
