import { Show, type JSX } from "solid-js"
import { t } from "../../utils/i18n"
import { Icon } from "./Icon"
import { Button } from "./Button"
import { TextField, type TextFieldSize } from "./TextField"

export interface SearchFieldProps {
  value: string
  placeholder: string
  ariaLabel?: string
  ariaDescribedBy?: string
  ariaKeyShortcuts?: string
  size?: TextFieldSize
  class?: string
  dataUI?: string
  inputID?: string
  inputDataUI?: string
  inputDataTestID?: string
  inputRef?: (element: HTMLInputElement) => void
  disabled?: boolean
  readOnly?: boolean
  clearable?: boolean
  clearLabel?: string
  clearDataUI?: string
  clearDataTestID?: string
  submitLabel?: string
  submitDataUI?: string
  onValueChange: (value: string) => void
  onClear?: () => void
  onSubmit?: () => void
  onKeyDown?: JSX.EventHandlerUnion<HTMLInputElement, KeyboardEvent>
  resultFocusTarget?: (edge: "first" | "last") => HTMLElement | undefined
}

export function createSearchResultNavigation(
  readActions: () => readonly HTMLElement[],
  { tabList = false, returnToSearch }: {
    tabList?: boolean
    returnToSearch?: () => HTMLInputElement | undefined
  } = {},
) {
  function resultFocusTarget(edge: "first" | "last"): HTMLElement | undefined {
    const actions = readActions()
    return edge === "first" ? actions[0] : actions.at(-1)
  }

  function handleResultKeyDown(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    const key = event.key
    const search = key === "Escape" ? returnToSearch?.() : undefined
    if (search && (!search.isConnected || search.disabled || search.readOnly)) return
    if (!search && key !== "ArrowDown" && key !== "ArrowUp" && !(tabList && (key === "Home" || key === "End"))) return

    const actions = readActions()
    const current = actions.findIndex((action) => action === event.target)
    if (current < 0) return
    event.preventDefault()
    event.stopPropagation()
    if (search) {
      search.focus()
      return
    }

    let next = current + (key === "ArrowDown" ? 1 : -1)
    if (key === "Home") next = 0
    else if (key === "End") next = actions.length - 1
    else if (tabList) next = (next + actions.length) % actions.length
    actions[next]?.focus()
  }

  return { resultFocusTarget, handleResultKeyDown }
}

function classes(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(" ")
}

export function SearchField(props: SearchFieldProps): JSX.Element {
  let input: HTMLInputElement | undefined
  const clearLabel = () => props.clearLabel || t("common.clear")
  const submitLabel = () => props.submitLabel || t("common.search")
  const actionsDisabled = () => props.disabled || props.readOnly
  const clear = () => {
    if (actionsDisabled()) return
    props.onValueChange("")
    props.onClear?.()
    if (input?.isConnected && !props.disabled) input.focus()
  }
  const submit = () => {
    if (!actionsDisabled()) props.onSubmit?.()
  }
  const handleKeyDown: JSX.EventHandler<HTMLInputElement, KeyboardEvent> = (event) => {
    const handler = props.onKeyDown
    if (typeof handler === "function") handler(event)
    else if (handler) handler[0](handler[1], event)
    if (event.defaultPrevented) return
    if (
      props.resultFocusTarget && !actionsDisabled() &&
      !event.isComposing && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey &&
      (event.key === "ArrowDown" || event.key === "ArrowUp")
    ) {
      const target = props.resultFocusTarget(event.key === "ArrowDown" ? "first" : "last")
      if (target?.isConnected) {
        event.preventDefault()
        target.focus()
        return
      }
    }
    if (event.key === "Escape" && props.clearable && props.value && !props.disabled) {
      event.preventDefault()
      clear()
      return
    }
    if (event.key === "Enter" && !event.isComposing && (props.onSubmit || event.currentTarget.form)) {
      // The search input owns Enter even when its enclosing form has a default submit button.
      event.preventDefault()
      submit()
    }
  }

  return (
    <TextField.Root
      class={classes("search-field", props.class)}
      size={props.size ?? "md"}
      variant="search"
      data-ui={props.dataUI}
      role={props.onSubmit ? "search" : undefined}
      disabled={props.disabled}
    >
      <Icon name="search" class="search-field-icon" />
      <TextField.Input
        ref={(element) => {
          input = element
          props.inputRef?.(element)
        }}
        id={props.inputID}
        type="search"
        value={props.value}
        placeholder={props.placeholder}
        aria-label={props.ariaLabel || props.placeholder}
        aria-describedby={props.ariaDescribedBy}
        aria-keyshortcuts={props.ariaKeyShortcuts}
        data-ui={props.inputDataUI}
        data-testid={props.inputDataTestID}
        disabled={props.disabled}
        readOnly={props.readOnly}
        onInput={(event) => props.onValueChange(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
      />
      <Show when={props.value && props.clearable}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          tone="neutral"
          data-chrome="icon-action"
          data-ui={props.clearDataUI}
          data-testid={props.clearDataTestID}
          onClick={clear}
          disabled={actionsDisabled()}
          title={clearLabel()}
          aria-label={clearLabel()}
        >
          <Icon name="close" size="compact" />
        </Button>
      </Show>
      <Show when={props.onSubmit}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          tone="neutral"
          data-chrome="icon-action"
          data-ui={props.submitDataUI}
          onClick={submit}
          title={submitLabel()}
          aria-label={submitLabel()}
          disabled={actionsDisabled()}
        >
          <Icon name="search" />
        </Button>
      </Show>
    </TextField.Root>
  )
}
