import * as Combobox from "@kobalte/core/combobox"
import { createEffect, Show, type JSX } from "solid-js"

type ComboboxDataAttributes = Record<string, string | undefined>
type ComboboxFilter<T> = "startsWith" | "endsWith" | "contains" | ((option: T, inputValue: string) => boolean)
type ComboboxTriggerMode = "focus" | "input" | "manual"

export interface ComboboxControlProps<T extends object> {
  options: T[]
  onChange: (next: T | null) => void
  renderOptionLabel: (option: T) => JSX.Element
  optionValue: keyof T | ((option: T) => string | number)
  optionTextValue: keyof T | ((option: T) => string)
  optionLabel?: keyof T | ((option: T) => string)
  value?: T | null
  open?: boolean
  onOpenChange?: (isOpen: boolean, triggerMode?: ComboboxTriggerMode) => void
  placeholder?: JSX.Element
  defaultFilter?: ComboboxFilter<T>
  triggerMode?: ComboboxTriggerMode
  shouldFocusWrap?: boolean
  allowsEmptyCollection?: boolean
  disallowEmptySelection?: boolean
  closeOnSelection?: boolean
  class?: string
  controlClass?: string
  inputClass?: string
  listboxClass?: string
  optionClass?: string
  optionLabelClass?: string
  optionPrefixClass?: string
  optionDescriptionClass?: string
  inputID?: string
  listboxID?: string
  inputRef?: (el: HTMLInputElement) => void
  ariaLabel?: string
  onInputChange?: (value: string) => void
  renderOptionPrefix?: (option: T) => JSX.Element | undefined
  renderOptionDescription?: (option: T) => JSX.Element | undefined
  optionData?: (option: T) => ComboboxDataAttributes
  emptyContent?: JSX.Element
}

function ComboboxFocusFirst(props: { open?: boolean; options: readonly object[] }): null {
  const context = Combobox.useComboboxContext()
  createEffect(() => {
    if (!props.open) return
    void props.options
    void context.inputValue()
    queueMicrotask(() => {
      if (!props.open) return
      const listState = context.listState()
      const collection = listState.collection()
      const selectionManager = listState.selectionManager()
      selectionManager.setFocused(true)
      selectionManager.setFocusedKey(undefined)
      selectionManager.setFocusedKey(collection.getFirstKey())
    })
  })
  return null
}

function ComboboxEmptyState(props: { open?: boolean; children?: JSX.Element }): JSX.Element {
  const context = Combobox.useComboboxContext()
  const isEmpty = () => Boolean(props.open && props.children && context.listState().collection().getSize() === 0)
  return <Show when={isEmpty()}>{props.children}</Show>
}

export function ComboboxControl<T extends object>(props: ComboboxControlProps<T>): JSX.Element {
  let comboboxContext: ReturnType<typeof Combobox.useComboboxContext> | undefined
  const controlClass = () => props.controlClass
  const inputClass = () => props.inputClass
  const listboxClass = () => props.listboxClass
  const optionClass = () => props.optionClass
  const optionLabelClass = () => props.optionLabelClass
  const optionPrefixClass = () => props.optionPrefixClass
  const optionDescriptionClass = () => props.optionDescriptionClass
  const optionLabel = (option: T): string => {
    if (typeof props.optionLabel === "function") return props.optionLabel(option)
    if (props.optionLabel) return String(option[props.optionLabel])
    return String(option)
  }

  function ComboboxContextBridge(): null {
    comboboxContext = Combobox.useComboboxContext()
    return null
  }

  function ComboboxControlItem(itemProps: Combobox.ComboboxRootItemComponentProps<T>): JSX.Element {
    const option = () => itemProps.item.rawValue
    const optionData = () => props.optionData?.(option()) ?? {}
    return (
      <Combobox.Item item={itemProps.item} class={optionClass()} {...optionData()}>
        <Show when={props.renderOptionPrefix?.(option())}>
          {(prefix) => <span class={optionPrefixClass()}>{prefix()}</span>}
        </Show>
        <Combobox.ItemLabel as="span" class={optionLabelClass()}>
          {props.renderOptionLabel(option())}
        </Combobox.ItemLabel>
        <Show when={props.renderOptionDescription?.(option())}>
          {(description) => (
            <Combobox.ItemDescription as="span" class={optionDescriptionClass()}>
              {description()}
            </Combobox.ItemDescription>
          )}
        </Show>
      </Combobox.Item>
    )
  }

  return (
    <Combobox.Root<T>
      class={props.class}
      options={props.options}
      optionValue={props.optionValue}
      optionTextValue={props.optionTextValue}
      optionLabel={props.optionLabel}
      value={props.value}
      onChange={(next) => {
        props.onChange(next)
        if (next && props.disallowEmptySelection) {
          queueMicrotask(() => comboboxContext?.setInputValue(optionLabel(next)))
        }
      }}
      open={props.open}
      onOpenChange={props.onOpenChange}
      onInputChange={props.onInputChange}
      placeholder={props.placeholder}
      defaultFilter={props.defaultFilter}
      triggerMode={props.triggerMode ?? "input"}
      shouldFocusWrap={props.shouldFocusWrap ?? true}
      allowsEmptyCollection={props.allowsEmptyCollection}
      disallowEmptySelection={props.disallowEmptySelection}
      closeOnSelection={props.closeOnSelection}
      itemComponent={ComboboxControlItem}
    >
      <ComboboxContextBridge />
      <ComboboxFocusFirst open={props.open} options={props.options} />
      <Combobox.Control class={controlClass()}>
        <Combobox.Input id={props.inputID} ref={props.inputRef} class={inputClass()} aria-label={props.ariaLabel} />
      </Combobox.Control>
      <Combobox.Listbox id={props.listboxID} class={listboxClass()} />
      <ComboboxEmptyState open={props.open}>{props.emptyContent}</ComboboxEmptyState>
    </Combobox.Root>
  )
}
