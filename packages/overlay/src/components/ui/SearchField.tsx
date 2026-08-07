import { Show, type JSX } from "solid-js"
import { t } from "../../utils/i18n"
import { Icon } from "./Icon"
import { Button } from "./Button"
import { TextField, type TextFieldSize } from "./TextField"

export interface SearchFieldProps {
  value: string
  placeholder: string
  ariaLabel?: string
  size?: TextFieldSize
  class?: string
  dataUI?: string
  inputID?: string
  inputDataUI?: string
  inputDataTestID?: string
  inputRef?: (element: HTMLInputElement) => void
  disabled?: boolean
  clearLabel?: string
  clearDataUI?: string
  clearDataTestID?: string
  submitLabel?: string
  submitDataUI?: string
  onValueChange: (value: string) => void
  onClear?: () => void
  onSubmit?: () => void
  onKeyDown?: JSX.EventHandlerUnion<HTMLInputElement, KeyboardEvent>
}

function classes(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(" ")
}

export function SearchField(props: SearchFieldProps): JSX.Element {
  const clearLabel = () => props.clearLabel || t("common.clear")
  const submitLabel = () => props.submitLabel || t("common.search")
  const clear = () => {
    props.onValueChange("")
    props.onClear?.()
  }
  const submit = () => props.onSubmit?.()
  const handleKeyDown: JSX.EventHandler<HTMLInputElement, KeyboardEvent> = (event) => {
    if (event.key === "Enter" && props.onSubmit) {
      event.preventDefault()
      submit()
    }
    if (typeof props.onKeyDown === "function") props.onKeyDown(event)
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
        ref={props.inputRef}
        id={props.inputID}
        type="search"
        value={props.value}
        placeholder={props.placeholder}
        aria-label={props.ariaLabel || props.placeholder}
        data-ui={props.inputDataUI}
        data-testid={props.inputDataTestID}
        disabled={props.disabled}
        onInput={(event) => props.onValueChange(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
      />
      <Show when={props.value && props.onClear}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          tone="neutral"
          data-chrome="icon-action"
          data-ui={props.clearDataUI}
          data-testid={props.clearDataTestID}
          onClick={clear}
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
          disabled={props.disabled}
        >
          <Icon name="search" />
        </Button>
      </Show>
    </TextField.Root>
  )
}
