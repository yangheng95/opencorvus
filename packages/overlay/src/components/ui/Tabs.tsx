import { Tabs as KobalteTabs } from "@kobalte/core/tabs"
import { splitProps } from "solid-js"
import type { JSX } from "solid-js"

export const TABS_SIZES = ["sm", "md"] as const
export const TABS_TONES = ["neutral"] as const
export const TABS_LAYOUTS = ["strip", "rail"] as const

export type TabsSize = (typeof TABS_SIZES)[number]
export type TabsTone = (typeof TABS_TONES)[number]
export type TabsLayout = (typeof TABS_LAYOUTS)[number]

export interface TabsProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, "classList" | "role" | "onChange"> {
  value: string
  onValueChange?: (value: string) => void
  orientation?: "horizontal" | "vertical"
}

export interface TabListProps
  extends Omit<JSX.HTMLAttributes<HTMLDivElement>, "classList" | "role" | "onChange"> {
  size: TabsSize
  tone: TabsTone
  layout?: TabsLayout
}

export interface TabProps
  extends Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "classList" | "role" | "type" | "onClick"> {
  value: string
  size: TabsSize
  tone: TabsTone
}

export interface TabPanelProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, "role"> {
  value: string
  forceMount?: boolean
}

export function Tabs(props: TabsProps): JSX.Element {
  const [local, tabsProps] = splitProps(props, ["value", "onValueChange", "orientation", "children"])

  return (
    <KobalteTabs
      {...tabsProps}
      value={local.value}
      onChange={local.onValueChange}
      orientation={local.orientation}
      activationMode="manual"
    >
      {local.children}
    </KobalteTabs>
  )
}

export function TabList(props: TabListProps): JSX.Element {
  const [local, listProps] = splitProps(props, ["size", "tone", "layout", "class", "children"])
  const className = () => (local.class ? `oc-tabs ${local.class}` : "oc-tabs")

  return (
    <KobalteTabs.List
      {...listProps}
      class={className()}
      data-size={local.size}
      data-tone={local.tone}
      data-layout={local.layout ?? "strip"}
    >
      {local.children}
    </KobalteTabs.List>
  )
}

export function Tab(props: TabProps): JSX.Element {
  const [local, tabProps] = splitProps(props, ["value", "size", "tone", "class"])
  const className = () => (local.class ? `oc-tab ${local.class}` : "oc-tab")

  return (
    <KobalteTabs.Trigger
      {...tabProps}
      value={local.value}
      class={className()}
      data-size={local.size}
      data-tone={local.tone}
    />
  )
}

export function TabPanel(props: TabPanelProps): JSX.Element {
  const [local, panelProps] = splitProps(props, ["value", "children"])

  return (
    <KobalteTabs.Content {...panelProps} value={local.value}>
      {local.children}
    </KobalteTabs.Content>
  )
}
