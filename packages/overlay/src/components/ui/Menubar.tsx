import * as KobalteMenubar from "@kobalte/core/menubar"
import { splitProps, type ComponentProps, type JSX } from "solid-js"

function classes(base: string, feature?: string): string {
  return feature ? `${base} ${feature}` : base
}

function MenubarContent(props: ComponentProps<typeof KobalteMenubar.Content>): JSX.Element {
  const [local, rest] = splitProps(props, ["class"])
  return <KobalteMenubar.Content {...rest} class={classes("oc-menu", local.class)} />
}

function MenubarItem(props: ComponentProps<typeof KobalteMenubar.Item>): JSX.Element {
  const [local, rest] = splitProps(props, ["class"])
  return <KobalteMenubar.Item {...rest} class={classes("oc-menu-item", local.class)} />
}

function MenubarRadioItem(props: ComponentProps<typeof KobalteMenubar.RadioItem>): JSX.Element {
  const [local, rest] = splitProps(props, ["class"])
  return <KobalteMenubar.RadioItem {...rest} class={classes("oc-menu-item", local.class)} />
}

function MenubarSeparator(props: ComponentProps<typeof KobalteMenubar.Separator>): JSX.Element {
  const [local, rest] = splitProps(props, ["class"])
  return <KobalteMenubar.Separator {...rest} class={classes("oc-menu-separator", local.class)} />
}

/** Canonical accessible desktop menubar behavior composed with the shared menu recipe. */
export const Menubar = {
  Root: KobalteMenubar.Root,
  Menu: KobalteMenubar.Menu,
  Trigger: KobalteMenubar.Trigger,
  Content: MenubarContent,
  Item: MenubarItem,
  Group: KobalteMenubar.Group,
  GroupLabel: KobalteMenubar.GroupLabel,
  Separator: MenubarSeparator,
  RadioGroup: KobalteMenubar.RadioGroup,
  RadioItem: MenubarRadioItem,
}
