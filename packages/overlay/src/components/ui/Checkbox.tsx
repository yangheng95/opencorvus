import * as KobalteCheckbox from "@kobalte/core/checkbox"
import { createUniqueId, Show, splitProps, type ComponentProps, type JSX } from "solid-js"
import { Icon } from "./Icon"

export interface CheckboxProps extends Omit<ComponentProps<typeof KobalteCheckbox.Root>, "children"> {
  inputID?: string
  description?: string
  children?: JSX.Element
}

/** Canonical checkbox for discrete multi-selection. */
export function Checkbox(props: CheckboxProps): JSX.Element {
  const [local, rest] = splitProps(props, ["class", "children", "inputID", "description", "aria-label"])
  const defaultInputID = `checkbox-input-${createUniqueId()}`
  const inputID = () => local.inputID ?? defaultInputID
  const className = () => (local.class ? `oc-checkbox ${local.class}` : "oc-checkbox")

  return (
    <KobalteCheckbox.Root {...rest} class={className()}>
      <KobalteCheckbox.Input id={inputID()} aria-label={local["aria-label"]} />
      <KobalteCheckbox.Control class="oc-checkbox-control">
        <KobalteCheckbox.Indicator class="oc-checkbox-indicator">
          <Icon name="check" size="compact" />
        </KobalteCheckbox.Indicator>
      </KobalteCheckbox.Control>
      <Show when={local.children !== undefined}>
        <KobalteCheckbox.Label class="oc-checkbox-label">{local.children}</KobalteCheckbox.Label>
      </Show>
      <Show when={local.description}>
        <KobalteCheckbox.Description as="label" for={inputID()} class="oc-checkbox-description">
          {local.description}
        </KobalteCheckbox.Description>
      </Show>
    </KobalteCheckbox.Root>
  )
}
