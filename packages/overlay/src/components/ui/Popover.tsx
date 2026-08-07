import * as KobaltePopover from "@kobalte/core/popover"
import { splitProps, type ComponentProps, type JSX } from "solid-js"

export type PopoverContentProps = ComponentProps<typeof KobaltePopover.Content>

function PopoverContent(props: PopoverContentProps): JSX.Element {
  const [local, rest] = splitProps(props, ["class"])
  return (
    <KobaltePopover.Content
      {...rest}
      class={local.class ? `oc-popover ${local.class}` : "oc-popover"}
    />
  )
}

/** Canonical accessible non-modal disclosure surface. */
export const Popover = {
  Root: KobaltePopover.Root,
  Anchor: KobaltePopover.Anchor,
  Trigger: KobaltePopover.Trigger,
  Portal: KobaltePopover.Portal,
  Content: PopoverContent,
}
