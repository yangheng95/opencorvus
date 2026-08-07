// ── Section ──
// Collapsible right-rail section composed from the canonical Disclosure.
// Renders .oc-section with icon + title + optional badge in the header.
//
// Usage:
//   <Section title="Requirements" icon={<Icon name="requirement" />} defaultOpen>
//     {children}
//   </Section>
//
// CSS: src/styles/primitives/section.css
// Migration target: Step 9.E — Board / FilesSection / GoalGroup sections.

import { type JSX, splitProps, Show } from "solid-js"
import { Disclosure } from "./Disclosure"

export interface SectionProps {
  /** Section title displayed in the header. */
  title: string
  /** Icon slot rendered left of the title (wrap in <Icon> or a span). */
  icon?: JSX.Element
  /** Open on first render. Default: false. */
  defaultOpen?: boolean
  /** Place the disclosure indicator before or after the title. */
  indicatorPosition?: "start" | "end"
  /** Trailing badge content (text or JSX rendered inside .oc-section__badge). */
  badge?: JSX.Element
  /** data-tone applied to .oc-section__badge (drives tone styling). */
  badgeTone?: string
  /** id applied to .oc-section__badge (for DOM accessors). */
  badgeId?: string
  /** data-variant applied to .oc-section__badge ("status" | "metric"). */
  badgeVariant?: string
  /** id applied to .oc-section__body for stable section anchors. */
  bodyId?: string
  /** id forwarded to the disclosure root for stable section anchors. */
  id?: string
  /** Extra class names on the root. */
  class?: string
  /** data-* attributes forwarded to root. */
  [key: `data-${string}`]: string | boolean | undefined
  /** attr:* attributes forwarded to root (e.g. attr:data-tone). */
  [key: `attr:${string}`]: string | undefined
  children: JSX.Element
}

export function Section(rawProps: SectionProps) {
  const [local, rest] = splitProps(rawProps, [
    "title",
    "icon",
    "defaultOpen",
    "indicatorPosition",
    "badge",
    "badgeTone",
    "badgeId",
    "badgeVariant",
    "bodyId",
    "id",
    "class",
    "children",
  ])

  return (
    <Disclosure.Root
      id={local.id}
      class={["oc-section", local.class].filter(Boolean).join(" ")}
      defaultOpen={local.defaultOpen}
      variant="surface"
      size="sm"
      {...rest}
    >
      <Disclosure.Trigger class="oc-section__head" indicatorPosition={local.indicatorPosition}>
        <Show when={local.icon}>
          <span class="oc-section__icon" aria-hidden="true">
            {local.icon}
          </span>
        </Show>
        <span class="oc-section__title">{local.title}</span>
        <Show when={local.badge !== undefined && local.badge !== null && local.badge !== ""}>
          <span
            class="oc-section__badge"
            id={local.badgeId}
            data-tone={local.badgeTone}
            data-variant={local.badgeVariant}
          >
            {local.badge}
          </span>
        </Show>
      </Disclosure.Trigger>
      <Disclosure.Content class="oc-section__body" id={local.bodyId}>
        {local.children}
      </Disclosure.Content>
    </Disclosure.Root>
  )
}
