import * as KobalteDropdownMenu from "@kobalte/core/dropdown-menu"
import { splitProps, type ComponentProps, type JSX } from "solid-js"

function classes(base: string, feature?: string): string {
  return feature ? `${base} ${feature}` : base
}

function MenuContent(props: ComponentProps<typeof KobalteDropdownMenu.Content>): JSX.Element {
  const [local, rest] = splitProps(props, ["class"])
  return <KobalteDropdownMenu.Content {...rest} class={classes("oc-menu", local.class)} />
}

function MenuSubContent(props: ComponentProps<typeof KobalteDropdownMenu.SubContent>): JSX.Element {
  const [local, rest] = splitProps(props, ["class"])
  return <KobalteDropdownMenu.SubContent {...rest} class={classes("oc-menu", local.class)} />
}

function MenuItem(props: ComponentProps<typeof KobalteDropdownMenu.Item>): JSX.Element {
  const [local, rest] = splitProps(props, ["class"])
  return <KobalteDropdownMenu.Item {...rest} class={classes("oc-menu-item", local.class)} />
}

function MenuCheckboxItem(props: ComponentProps<typeof KobalteDropdownMenu.CheckboxItem>): JSX.Element {
  const [local, rest] = splitProps(props, ["class"])
  return <KobalteDropdownMenu.CheckboxItem {...rest} class={classes("oc-menu-item", local.class)} />
}

function MenuRadioItem(props: ComponentProps<typeof KobalteDropdownMenu.RadioItem>): JSX.Element {
  const [local, rest] = splitProps(props, ["class"])
  return <KobalteDropdownMenu.RadioItem {...rest} class={classes("oc-menu-item", local.class)} />
}

function MenuSubTrigger(props: ComponentProps<typeof KobalteDropdownMenu.SubTrigger>): JSX.Element {
  const [local, rest] = splitProps(props, ["class"])
  return <KobalteDropdownMenu.SubTrigger {...rest} class={classes("oc-menu-item", local.class)} />
}

function MenuSeparator(props: ComponentProps<typeof KobalteDropdownMenu.Separator>): JSX.Element {
  const [local, rest] = splitProps(props, ["class"])
  return <KobalteDropdownMenu.Separator {...rest} class={classes("oc-menu-separator", local.class)} />
}

/** Canonical accessible command-menu parts and visual recipes. */
export const DropdownMenu = {
  Root: KobalteDropdownMenu.Root,
  Trigger: KobalteDropdownMenu.Trigger,
  Portal: KobalteDropdownMenu.Portal,
  Content: MenuContent,
  Item: MenuItem,
  Separator: MenuSeparator,
  Sub: KobalteDropdownMenu.Sub,
  SubTrigger: MenuSubTrigger,
  SubContent: MenuSubContent,
  CheckboxItem: MenuCheckboxItem,
  RadioGroup: KobalteDropdownMenu.RadioGroup,
  RadioItem: MenuRadioItem,
}
