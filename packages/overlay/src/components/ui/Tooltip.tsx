import * as KobalteTooltip from "@kobalte/core/tooltip"
import { Show, splitProps, type ComponentProps, type JSX } from "solid-js"

export type TooltipContentProps = ComponentProps<typeof KobalteTooltip.Content>
export type TooltipExplainerContentProps = Omit<TooltipContentProps, "children"> & {
  heading: JSX.Element
  description: JSX.Element
  /** Optional feature detail rendered below the description, inside the shared explainer rhythm. */
  detail?: JSX.Element
}

function TooltipContent(props: TooltipContentProps): JSX.Element {
  const [local, rest] = splitProps(props, ["class"])
  return <KobalteTooltip.Content {...rest} class={local.class ? `oc-tooltip ${local.class}` : "oc-tooltip"} />
}

function TooltipExplainerContent(props: TooltipExplainerContentProps): JSX.Element {
  const [local, rest] = splitProps(props, ["heading", "description", "detail", "class"])
  return (
    <TooltipContent {...rest} class={local.class ? `oc-tooltip-explainer ${local.class}` : "oc-tooltip-explainer"}>
      <strong class="oc-tooltip-explainer__heading">{local.heading}</strong>
      <span class="oc-tooltip-explainer__description">{local.description}</span>
      <Show when={local.detail}>
        <div class="oc-tooltip-explainer__detail">{local.detail}</div>
      </Show>
    </TooltipContent>
  )
}

/**
 * Canonical accessible tooltip parts.
 *
 * Kobalte owns delay, placement, trigger and dismissal semantics. The
 * wrapped Content always receives the shared `.oc-tooltip` visual recipe;
 * feature classes may arrange their internal copy but must not recreate the
 * popup surface chrome.
 */
export const Tooltip = {
  Root: KobalteTooltip.Root,
  Trigger: KobalteTooltip.Trigger,
  Portal: KobalteTooltip.Portal,
  Content: TooltipContent,
  ExplainerContent: TooltipExplainerContent,
}
