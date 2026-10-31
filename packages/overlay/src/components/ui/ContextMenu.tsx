import * as KobalteContextMenu from "@kobalte/core/context-menu"
import type { PolymorphicProps } from "@kobalte/core/polymorphic"
import { createContext, createSignal, onCleanup, splitProps, useContext, type ComponentProps, type JSX, type ValidComponent } from "solid-js"

function createMenuElements() {
  const [trigger, setTrigger] = createSignal<HTMLElement>()
  const [content, setContent] = createSignal<HTMLElement>()
  return { trigger, setTrigger, content, setContent }
}

const MenuElements = createContext<ReturnType<typeof createMenuElements>>()

function menuElements() {
  const elements = useContext(MenuElements)
  if (!elements) throw new Error("ContextMenu parts must be used within ContextMenu.Root")
  return elements
}

function ContextMenuRoot(props: ComponentProps<typeof KobalteContextMenu.Root>): JSX.Element {
  return <MenuElements.Provider value={createMenuElements()}><KobalteContextMenu.Root {...props} /></MenuElements.Provider>
}

function ContextMenuTrigger<T extends ValidComponent = "div">(
  props: PolymorphicProps<T, KobalteContextMenu.ContextMenuTriggerProps<T>>,
): JSX.Element {
  const elements = menuElements()
  onCleanup(() => elements.setTrigger(undefined))
  return <KobalteContextMenu.Trigger<T> {...props} aria-controls={elements.content()?.id} ref={(node) => {
    elements.setTrigger(node)
    if (typeof props.ref === "function") (props.ref as (element: typeof node) => void)(node)
  }} />
}

function classes(base: string, feature?: string): string {
  return feature ? `${base} ${feature}` : base
}

function ContextMenuContent(props: ComponentProps<typeof KobalteContextMenu.Content>): JSX.Element {
  const elements = menuElements()
  const [local, rest] = splitProps(props, ["class", "ref"])
  onCleanup(() => elements.setContent(undefined))
  return <KobalteContextMenu.Content {...rest} aria-labelledby={elements.trigger()?.id} ref={(node) => {
    elements.setContent(node)
    if (typeof local.ref === "function") local.ref(node)
  }} class={classes("oc-menu", local.class)} />
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
  Root: ContextMenuRoot,
  Trigger: ContextMenuTrigger,
  Portal: KobalteContextMenu.Portal,
  Content: ContextMenuContent,
  Item: ContextMenuItem,
  Separator: ContextMenuSeparator,
}
