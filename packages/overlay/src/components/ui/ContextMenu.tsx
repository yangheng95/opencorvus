import * as KobalteContextMenu from "@kobalte/core/context-menu"
import { splitProps, type ComponentProps, type JSX } from "solid-js"

function classes(base: string, feature?: string): string {
  return feature ? `${base} ${feature}` : base
}

function ContextMenuContent(props: ComponentProps<typeof KobalteContextMenu.Content>): JSX.Element {
  const [local, rest] = splitProps(props, ["class"])
  return <KobalteContextMenu.Content {...rest} class={classes("oc-menu", local.class)} />
}

function ContextMenuItem(props: ComponentProps<typeof KobalteContextMenu.Item>): JSX.Element {
  const [local, rest] = splitProps(props, ["class"])
  return <KobalteContextMenu.Item {...rest} class={classes("oc-menu-item", local.class)} />
}

function ContextMenuSeparator(props: ComponentProps<typeof KobalteContextMenu.Separator>): JSX.Element {
  const [local, rest] = splitProps(props, ["class"])
  return <KobalteContextMenu.Separator {...rest} class={classes("oc-menu-separator", local.class)} />
}

/** Canonical accessible context-menu behavior composed with the shared menu visual recipe. */
export const ContextMenu = {
  Root: KobalteContextMenu.Root,
  Trigger: KobalteContextMenu.Trigger,
  Portal: KobalteContextMenu.Portal,
  Content: ContextMenuContent,
  Item: ContextMenuItem,
  Separator: ContextMenuSeparator,
}
