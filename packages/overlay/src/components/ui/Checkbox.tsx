import * as KobalteCheckbox from "@kobalte/core/checkbox"
import { Show, splitProps, type ComponentProps, type JSX } from "solid-js"
import { Icon } from "./Icon"

export interface CheckboxProps extends Omit<ComponentProps<typeof KobalteCheckbox.Root>, "children"> {
  inputID?: string
  inputAriaDescribedBy?: string
  children?: JSX.Element
}

/** Canonical checkbox for discrete multi-selection. */
export function Checkbox(props: CheckboxProps): JSX.Element {
  const [local, rest] = splitProps(props, ["class", "children", "inputID", "inputAriaDescribedBy"])
  const className = () => (local.class ? `oc-checkbox ${local.class}` : "oc-checkbox")

  return (
    <KobalteCheckbox.Root {...rest} class={className()}>
      <KobalteCheckbox.Input id={local.inputID} aria-describedby={local.inputAriaDescribedBy} />
      <KobalteCheckbox.Control class="oc-checkbox-control">
        <KobalteCheckbox.Indicator class="oc-checkbox-indicator">
          <Icon name="check" size="compact" />
        </KobalteCheckbox.Indicator>
      </KobalteCheckbox.Control>
      <Show when={local.children !== undefined}>
        <KobalteCheckbox.Label class="oc-checkbox-label">{local.children}</KobalteCheckbox.Label>
      </Show>
    </KobalteCheckbox.Root>
  )
}
