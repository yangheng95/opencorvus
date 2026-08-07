import * as KobalteListbox from "@kobalte/core/listbox"
import type { PolymorphicProps } from "@kobalte/core/polymorphic"
import { splitProps, type JSX } from "solid-js"

export type ListboxDensity = "default" | "rich"

type RootProps<Option, OptGroup> = PolymorphicProps<"ul", KobalteListbox.ListboxRootProps<Option, OptGroup, "ul">> & {
  density: ListboxDensity
}

type ItemProps = PolymorphicProps<"button", KobalteListbox.ListboxItemProps<"button">>
type SectionProps = PolymorphicProps<"li", KobalteListbox.ListboxSectionProps<"li">>

function classes(base: string, feature?: string): string {
  return feature ? `${base} ${feature}` : base
}

export function ListboxRoot<Option, OptGroup = never>(props: RootProps<Option, OptGroup>): JSX.Element {
  const [local, rest] = splitProps(props, ["class", "density"])
  return (
    <KobalteListbox.Root<Option, OptGroup>
      {...rest}
      class={classes("oc-listbox", local.class)}
      data-density={local.density}
    />
  )
}

export function ListboxItem(props: ItemProps): JSX.Element {
  const [local, rest] = splitProps(props, ["class"])
  return <KobalteListbox.Item<"button"> {...rest} class={classes("oc-listbox-item", local.class)} />
}

export function ListboxSection(props: SectionProps): JSX.Element {
  const [local, rest] = splitProps(props, ["class"])
  return <KobalteListbox.Section<"li"> {...rest} class={classes("oc-listbox-section", local.class)} />
}
