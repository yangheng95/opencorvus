import * as KobalteHoverCard from "@kobalte/core/hover-card"
import { splitProps, type ComponentProps, type JSX } from "solid-js"

export type HoverCardContentProps = ComponentProps<typeof KobalteHoverCard.Content>

function HoverCardContent(props: HoverCardContentProps): JSX.Element {
  const [local, rest] = splitProps(props, ["class"])
  return (
    <KobalteHoverCard.Content
      {...rest}
      class={local.class ? `oc-popover ${local.class}` : "oc-popover"}
    />
  )
}

/** Canonical hover-preview surface with a pointer-safe trigger-to-content region. */
export const HoverCard = {
  Root: KobalteHoverCard.Root,
  Trigger: KobalteHoverCard.Trigger,
  Portal: KobalteHoverCard.Portal,
  Content: HoverCardContent,
}
