import { splitProps, type JSX } from "solid-js"
import { Icon } from "./Icon"

export const DISCLOSURE_VARIANTS = ["plain", "surface"] as const
export const DISCLOSURE_SIZES = ["sm", "md"] as const

export type DisclosureVariant = (typeof DISCLOSURE_VARIANTS)[number]
export type DisclosureSize = (typeof DISCLOSURE_SIZES)[number]

export interface DisclosureRootProps extends Omit<JSX.DetailsHtmlAttributes<HTMLDetailsElement>, "onToggle" | "open"> {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** Animate the native details content wrapper without changing default callers. */
  animated?: boolean
  variant?: DisclosureVariant
  size?: DisclosureSize
}

export interface DisclosureTriggerProps extends JSX.HTMLAttributes<HTMLElement> {
  indicatorPosition?: "start" | "end"
}

export type DisclosureContentProps = JSX.HTMLAttributes<HTMLDivElement>

function Root(props: DisclosureRootProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    "class",
    "open",
    "defaultOpen",
    "onOpenChange",
    "animated",
    "variant",
    "size",
  ])
  return (
    <details
      {...rest}
      class={local.class ? `oc-disclosure ${local.class}` : "oc-disclosure"}
      open={local.open ?? local.defaultOpen}
      data-animated={local.animated ? "true" : undefined}
      data-variant={local.variant ?? "plain"}
      data-size={local.size ?? "sm"}
      onToggle={(event) => local.onOpenChange?.(event.currentTarget.open)}
    />
  )
}

function Trigger(props: DisclosureTriggerProps): JSX.Element {
  const [local, rest] = splitProps(props, ["class", "children", "indicatorPosition"])
  const indicator = (
    <span class="oc-disclosure__indicator" aria-hidden="true">
      <Icon name="chevron" size="compact" decorative />
    </span>
  )
  return (
    <summary
      {...rest}
      class={local.class ? `oc-disclosure__trigger ${local.class}` : "oc-disclosure__trigger"}
      data-indicator-position={local.indicatorPosition ?? "start"}
    >
      {(local.indicatorPosition ?? "start") === "start" ? indicator : null}
      {local.children}
      {local.indicatorPosition === "end" ? indicator : null}
    </summary>
  )
}

function Content(props: DisclosureContentProps): JSX.Element {
  const [local, rest] = splitProps(props, ["class"])
  return <div {...rest} class={local.class ? `oc-disclosure__content ${local.class}` : "oc-disclosure__content"} />
}

/** Canonical native disclosure composition with browser-owned semantics and keyboard behavior. */
export const Disclosure = { Root, Trigger, Content }
