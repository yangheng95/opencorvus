// ── Panel ──
// Structural container for header+body+footer panels.
// Renders an .oc-panel root with optional header and footer slots.
// The `as` prop lets callers override the root tag (div / section / aside).
//
// Usage:
//   <Panel header={<PanelHeader />} footer={<PanelFooter />}>
//     {children}
//   </Panel>
//
// CSS: src/styles/primitives/panel.css
// Migration target: Step 9.E — workspace and task-scope panels.

import { Show, type JSX, mergeProps, splitProps } from "solid-js"
import { Dynamic } from "solid-js/web"

export interface PanelProps {
  /** Root element tag. Default: "div". */
  as?: "div" | "section" | "aside" | "article"
  /** Header content rendered in .oc-panel__header. */
  header?: JSX.Element
  /** Footer content rendered in .oc-panel__footer. */
  footer?: JSX.Element
  /** Body content. */
  children: JSX.Element
  /** Additional class names merged onto the root. */
  class?: string
  /** Ref forwarded to the root element. */
  ref?: ((el: HTMLElement) => void) | HTMLElement
  [key: `data-${string}`]: string | boolean | undefined
}

export function Panel(rawProps: PanelProps) {
  const merged = mergeProps({ as: "div" as const }, rawProps)
  const [local, rest] = splitProps(merged, ["as", "header", "footer", "children", "class", "ref"])

  return (
    <Dynamic
      component={local.as}
      class={["oc-panel", local.class].filter(Boolean).join(" ")}
      ref={local.ref as any}
      {...rest}
    >
      <Show when={local.header}>
        <div class="oc-panel__header">{local.header}</div>
      </Show>
      <div class="oc-panel__body">{local.children}</div>
      <Show when={local.footer}>
        <div class="oc-panel__footer">{local.footer}</div>
      </Show>
    </Dynamic>
  )
}
