import * as KobalteSwitch from "@kobalte/core/switch"
import { Show, splitProps, type ComponentProps, type JSX } from "solid-js"

export interface SwitchProps extends Omit<ComponentProps<typeof KobalteSwitch.Root>, "children"> {
  inputID?: string
  children?: JSX.Element
}

/** Canonical switch for immediate boolean settings. */
export function Switch(props: SwitchProps): JSX.Element {
  const [local, rest] = splitProps(props, ["class", "children", "inputID"])
  const className = () => (local.class ? `oc-switch ${local.class}` : "oc-switch")

  return (
    <KobalteSwitch.Root {...rest} as="label" class={className()}>
      <KobalteSwitch.Input id={local.inputID} />
      <KobalteSwitch.Control class="oc-switch-control">
        <KobalteSwitch.Thumb class="oc-switch-thumb" />
      </KobalteSwitch.Control>
      <Show when={local.children !== undefined}>
        <span class="oc-switch-label">{local.children}</span>
      </Show>
    </KobalteSwitch.Root>
  )
}
