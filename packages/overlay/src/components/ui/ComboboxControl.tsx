import * as Combobox from "@kobalte/core/combobox"
import { createEffect, Show, type JSX } from "solid-js"
import { localeTag, t } from "../../utils/i18n"
import { topLayerPortalMount } from "../../utils/top-layer"
import { Icon } from "./Icon"
import { Tooltip } from "./Tooltip"
import { useTextFieldControlProps } from "./TextField"

type ComboboxDataAttributes = Record<string, string | undefined>
type ComboboxFilter<T> = "startsWith" | "endsWith" | "contains" | ((option: T, inputValue: string) => boolean)
type ComboboxTriggerMode = "focus" | "input" | "manual"

export interface ComboboxControlProps<T extends object> {
  presentation?: "inline" | "popup"
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
  noResetInputOnBlur?: boolean
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
  ariaDescribedBy?: string
  disabled?: boolean
  inputTitle?: string
  inputDataUI?: string
  onInputChange?: (value: string) => void
  preserveFocusedOptionOnInputChange?: (value: string) => boolean
  onInputKeyDown?: JSX.EventHandlerUnion<HTMLInputElement, KeyboardEvent>
  renderOptionPrefix?: (option: T) => JSX.Element | undefined
  renderOptionDescription?: (option: T) => JSX.Element | undefined
  renderOptionTooltip?: (option: T) => JSX.Element | undefined
  optionData?: (option: T) => ComboboxDataAttributes
  emptyContent?: JSX.Element
}

function ComboboxFocus(props: {
  options: readonly object[]
  takeRetainedOption: (value: string | undefined) => string | undefined
}): null {
  const context = Combobox.useComboboxContext()
  createEffect(() => {
    if (!context.isOpen()) return
    void props.options
    const inputValue = context.inputValue()
    queueMicrotask(() => {
      if (!context.isOpen() || context.inputValue() !== inputValue) return
      const retainedKey = props.takeRetainedOption(inputValue)
      const listState = context.listState()
      const collection = listState.collection()
      const selectionManager = listState.selectionManager()
      const focusedKey = selectionManager.focusedKey()
      if (focusedKey != null && collection.getItem(focusedKey)) return
      selectionManager.setFocused(true)
      selectionManager.setFocusedKey(retainedKey != null && collection.getItem(retainedKey) ? retainedKey : collection.getFirstKey())
    })
  })
  return null
}

function ComboboxEmptyState(props: { children?: JSX.Element }): JSX.Element {
  const context = Combobox.useComboboxContext()
  const isEmpty = () => Boolean(context.isOpen() && props.children && context.listState().collection().getSize() === 0)
  return <Show when={isEmpty()}>{props.children}</Show>
}

export function ComboboxControl<T extends object>(props: ComboboxControlProps<T>): JSX.Element {
  let comboboxContext: ReturnType<typeof Combobox.useComboboxContext> | undefined
  let input: HTMLInputElement | undefined
  let retainedOption: { value: string; key: string } | undefined
  const popup = () => props.presentation === "popup"
  const textFieldControl = useTextFieldControlProps()
  const popupClass = (base: string, extra?: string) => (popup() ? [base, extra].filter(Boolean).join(" ") : extra)
  const controlClass = () => popupClass("oc-combobox-control", props.controlClass)
  const inputClass = () => popupClass("oc-combobox-input", props.inputClass)
  const listboxClass = () => popupClass("oc-select-listbox", props.listboxClass)
  const optionClass = () => popupClass("oc-select-option", props.optionClass)
  const optionLabelClass = () => props.optionLabelClass
  const optionPrefixClass = () => props.optionPrefixClass
  const optionDescriptionClass = () => props.optionDescriptionClass
  const optionLabel = (option: T): string => {
    if (typeof props.optionLabel === "function") return props.optionLabel(option)
    if (props.optionLabel) return String(option[props.optionLabel])
    return String(option)
  }
  const countAnnouncement = (count: number): string =>
    t(count === 1 ? "combobox.option_available" : "combobox.options_available", {
      count: count.toLocaleString(localeTag()),
    })

  const handleInputChange = (value: string) => {
    // Kobalte clears its current option after it notifies the input consumer.
    const key = input === document.activeElement && comboboxContext?.isOpen() && props.preserveFocusedOptionOnInputChange?.(value)
      ? comboboxContext.listState().selectionManager().focusedKey()
      : undefined
    retainedOption = key == null ? undefined : { value, key }
    props.onInputChange?.(value)
  }

  const takeRetainedOption = (value: string | undefined) => {
    const retained = retainedOption
    retainedOption = undefined
    return retained && retained.value === value && input === document.activeElement ? retained.key : undefined
  }

  function ComboboxContextBridge(): null {
    comboboxContext = Combobox.useComboboxContext()
    return null
  }

  function ComboboxControlItem(itemProps: Combobox.ComboboxRootItemComponentProps<T>): JSX.Element {
    const context = Combobox.useComboboxContext()
    const option = () => itemProps.item.rawValue
    const optionData = () => props.optionData?.(option()) ?? {}
    const tooltip = () => props.renderOptionTooltip?.(option())
    const optionCopy = () => (
      <>
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
      </>
    )
    return (
      <Combobox.Item
        id={context.generateId(`option-${encodeURIComponent(itemProps.item.key)}`)}
        item={itemProps.item}
        class={optionClass()}
        {...optionData()}
      >
        <Show when={props.renderOptionPrefix?.(option())}>
          {(prefix) => <span class={optionPrefixClass()}>{prefix()}</span>}
        </Show>
        <Show when={popup()} fallback={optionCopy()}>
          <Show when={tooltip()} fallback={<span class="oc-select-option-copy">{optionCopy()}</span>}>
            {(copy) => (
              <Tooltip.Root openDelay={180} closeDelay={80} placement="left" gutter={8}>
                <Tooltip.Trigger as="span" class="oc-select-option-copy">
                  {optionCopy()}
                </Tooltip.Trigger>
                <Tooltip.Portal mount={topLayerPortalMount(input)}>
                  <Tooltip.Content class="oc-select-option-tooltip">{copy()}</Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            )}
          </Show>
          <Combobox.ItemIndicator class="oc-select-indicator">
            <Icon name="check" size="compact" />
          </Combobox.ItemIndicator>
        </Show>
      </Combobox.Item>
    )
  }

  const listbox = () => (
    <>
      <Combobox.Listbox id={props.listboxID} class={listboxClass()} />
      <ComboboxEmptyState>
        <Show when={props.emptyContent}>
          {(content) =>
            popup() ? (
              <div class="oc-combobox-empty" role="status">
                {content()}
              </div>
            ) : (
              content()
            )
          }
        </Show>
      </ComboboxEmptyState>
    </>
  )

  return (
    <Combobox.Root<T>
      translations={{
        focusAnnouncement: (option, selected) => (selected ? t("combobox.selected", { option }) : option),
        selectedAnnouncement: (option) => t("combobox.selected", { option }),
        // Kobalte 0.13.11 incorrectly infers this public translator's result
        // as its English literal; the implementation announces arbitrary text.
        countAnnouncement: countAnnouncement as NonNullable<
          Combobox.ComboboxRootOptions<T>["translations"]
        >["countAnnouncement"],
        triggerLabel: t("combobox.show_suggestions"),
        listboxLabel: t("combobox.suggestions"),
      }}
      class={popupClass("oc-select", props.class)}
      disabled={props.disabled}
      sameWidth={popup() ? true : undefined}
      gutter={popup() ? 4 : undefined}
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
      onInputChange={props.preserveFocusedOptionOnInputChange ? handleInputChange : props.onInputChange}
      placeholder={props.placeholder}
      defaultFilter={props.defaultFilter}
      triggerMode={props.triggerMode ?? "input"}
      shouldFocusWrap={props.shouldFocusWrap ?? true}
      allowsEmptyCollection={props.allowsEmptyCollection}
      disallowEmptySelection={props.disallowEmptySelection}
      closeOnSelection={props.closeOnSelection}
      noResetInputOnBlur={props.noResetInputOnBlur}
      itemComponent={ComboboxControlItem}
    >
      <ComboboxContextBridge />
      <ComboboxFocus options={props.options} takeRetainedOption={takeRetainedOption} />
      <Combobox.Control class={controlClass()}>
        <Show when={popup()}>
          <Icon name="search" size="compact" />
        </Show>
        <Combobox.Input
          id={props.inputID}
          ref={(element) => {
            input = element
            props.inputRef?.(element)
          }}
          class={inputClass()}
          title={props.inputTitle}
          data-ui={props.inputDataUI}
          aria-label={props.ariaLabel}
          aria-describedby={props.ariaDescribedBy ?? textFieldControl.describedBy()}
          aria-invalid={textFieldControl.invalid() ? "true" : undefined}
          aria-errormessage={textFieldControl.errorMessageID()}
          onFocus={(event) => {
            if (popup()) event.currentTarget.select()
          }}
          onKeyDown={(event) => {
            const wasOpen = comboboxContext?.isOpen()
            const handler = props.onInputKeyDown
            if (typeof handler === "function") handler(event)
            else if (handler) handler[0](handler[1], event)
            if (event.key === "Escape" && !event.isComposing && !event.defaultPrevented) {
              if (wasOpen) {
                event.preventDefault()
                event.stopPropagation()
              } else {
                queueMicrotask(() => {
                  const selected = props.value
                  if (selected) comboboxContext?.setInputValue(optionLabel(selected))
                })
              }
            }
          }}
        />
        <Show when={popup()}>
          <Combobox.Trigger class="oc-combobox-trigger">
            <Icon name="chevron-down" size="compact" />
          </Combobox.Trigger>
        </Show>
      </Combobox.Control>
      <Show when={popup()} fallback={listbox()}>
        <Combobox.Portal mount={topLayerPortalMount(input)}>
          <Combobox.Content class="oc-select-content oc-combobox-content">{listbox()}</Combobox.Content>
        </Combobox.Portal>
      </Show>
    </Combobox.Root>
  )
}
