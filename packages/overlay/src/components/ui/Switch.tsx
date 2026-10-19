import * as KobalteSwitch from "@kobalte/core/switch"
import { createUniqueId, Show, splitProps, type ComponentProps, type JSX } from "solid-js"

export interface SwitchProps extends Omit<ComponentProps<typeof KobalteSwitch.Root>, "children"> {
  inputID?: string
  children?: JSX.Element
}

/** Canonical switch for immediate boolean settings. */
export function Switch(props: SwitchProps): JSX.Element {
  const [local, rest] = splitProps(props, ["class", "children", "inputID", "aria-label"])
  const defaultInputID = `switch-input-${createUniqueId()}`
  const className = () => (local.class ? `oc-switch ${local.class}` : "oc-switch")

  return (
    <KobalteSwitch.Root {...rest} class={className()}>
      <KobalteSwitch.Input id={local.inputID ?? defaultInputID} aria-label={local["aria-label"]} />
      <KobalteSwitch.Control class="oc-switch-control">
        <KobalteSwitch.Thumb class="oc-switch-thumb" />
      </KobalteSwitch.Control>
      <Show when={local.children !== undefined}>
        <KobalteSwitch.Label class="oc-switch-label">{local.children}</KobalteSwitch.Label>
      </Show>
    </KobalteSwitch.Root>
  )
}
