import { splitProps, type JSX } from "solid-js"

export interface RadioGroupProps extends JSX.HTMLAttributes<HTMLDivElement> {}

/** Semantic wrapper for a native single-selection group. */
export function RadioGroup(props: RadioGroupProps): JSX.Element {
  const [local, rest] = splitProps(props, ["class"])
  const className = () => (local.class ? `oc-radio-group ${local.class}` : "oc-radio-group")
  return <div {...rest} role="radiogroup" class={className()} />
}

export interface RadioProps
  extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "type" | "class" | "children"> {
  class?: string
  children?: JSX.Element
  selected?: boolean
}

/** Canonical native radio; the browser owns grouped arrow-key behavior. */
export function Radio(props: RadioProps): JSX.Element {
  const [local, input] = splitProps(props, ["class", "children", "selected"])
  const className = () => (local.class ? `oc-radio ${local.class}` : "oc-radio")

  return (
    <label
      class={className()}
      data-checked={input.checked ? "" : undefined}
      data-selected={local.selected ? "true" : undefined}
      data-disabled={input.disabled ? "" : undefined}
    >
      <input {...input} class="oc-selection-input" type="radio" />
      <span class="oc-radio-control" data-checked={input.checked ? "" : undefined} aria-hidden="true">
        <span class="oc-radio-indicator" />
      </span>
      <span class="oc-radio-label">{local.children}</span>
    </label>
  )
}
