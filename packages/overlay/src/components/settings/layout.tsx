/**
 * Settings layout composites — single source for settings-only panel,
 * group, row, toolbar, and empty-state structure. These are domain
 * compositions of the canonical controls under components/ui; they are
 * deliberately not a second primitive catalog. Each composite renders
 * the `.s-*` layout contract defined in styles/surfaces/settings.css.
 *
 * Visual contract: simple groups own one row surface; complex datasets
 * use SettingsDetailSection/SettingsSurface. Both share radius, border,
 * spacing, typography, and interaction tokens.
 */
import { Show, mergeProps, splitProps } from "solid-js"
import { Dynamic } from "solid-js/web"
import type { JSX } from "solid-js"

export interface SettingsPanelProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, "class" | "children"> {
  children: JSX.Element
  class?: string
}

export function SettingsPanel(props: SettingsPanelProps): JSX.Element {
  const [local, rest] = splitProps(props, ["children", "class"])
  return (
    <div {...rest} class={local.class ? `s-panel ${local.class}` : "s-panel"}>
      {local.children}
    </div>
  )
}

export interface SettingsGroupProps extends Omit<JSX.HTMLAttributes<HTMLElement>, "class" | "children" | "title"> {
  title?: JSX.Element
  description?: JSX.Element
  actions?: JSX.Element
  /** Inset custom body content that does not render through SettingsRow. */
  contentInset?: boolean
  children: JSX.Element
  id?: string
  class?: string
}

export function SettingsGroup(props: SettingsGroupProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    "title",
    "description",
    "actions",
    "contentInset",
    "children",
    "id",
    "class",
  ])
  return (
    <section {...rest} class={local.class ? `s-group ${local.class}` : "s-group"} id={local.id}>
      <Show when={local.title || local.actions}>
        <header class="s-group-head">
          <span class="s-group-head-title">{local.title}</span>
          <Show when={local.actions}>
            <span class="s-group-head-actions">{local.actions}</span>
          </Show>
        </header>
      </Show>
      <Show when={local.description}>
        <div class="s-group-description">{local.description}</div>
      </Show>
      <div class="s-group-body" data-content-inset={local.contentInset ? "true" : undefined}>
        {local.children}
      </div>
    </section>
  )
}

export interface SettingsSurfaceProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, "class" | "children"> {
  children: JSX.Element
  class?: string
}

export function SettingsSurface(props: SettingsSurfaceProps): JSX.Element {
  const [local, rest] = splitProps(props, ["children", "class"])
  return (
    <div {...rest} class={local.class ? `s-surface ${local.class}` : "s-surface"}>
      {local.children}
    </div>
  )
}

export interface SettingsDetailSectionProps {
  title: JSX.Element
  description?: JSX.Element
  actions?: JSX.Element
  children: JSX.Element
  class?: string
}

export function SettingsDetailSection(props: SettingsDetailSectionProps): JSX.Element {
  return (
    <section class={props.class ? `s-detail-section ${props.class}` : "s-detail-section"}>
      <header class="s-detail-section-head">
        <div class="s-detail-section-copy">
          <strong class="s-detail-section-title oc-section-heading">{props.title}</strong>
          <Show when={props.description}>
            <span class="s-detail-section-description">{props.description}</span>
          </Show>
        </div>
        <Show when={props.actions}>
          <div class="s-detail-section-actions">{props.actions}</div>
        </Show>
      </header>
      <SettingsSurface>{props.children}</SettingsSurface>
    </section>
  )
}

export interface SettingsRowProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, "class" | "children" | "title"> {
  /** Root element. Use button for selectable settings rows. */
  as?: "div" | "button"
  /** Optional leading slot (icon, avatar, drag handle). */
  leading?: JSX.Element
  /** Bold title — typically a label or item name. */
  title?: JSX.Element
  /** Soft secondary line — explanation / hint. */
  desc?: JSX.Element
  /** Muted footnotes — credits, paths, counts. Accepts array for chips. */
  meta?: JSX.Element
  /** Right-side button cluster. */
  actions?: JSX.Element
  /** Use children when the main column needs richer content than title/desc. */
  children?: JSX.Element
  /** Let complex domain rows provide their own inner grid while this primitive owns row chrome. */
  customContent?: boolean
  /** Center-align the row instead of the default top-align. */
  align?: "start" | "center"
  /** Opt-in hover wash. Default false — rows are static unless declared interactive. */
  interactive?: boolean
  /** Native disabled state when the row renders as a button. */
  disabled?: boolean
  /** Native tooltip title; kept separate from the visual title slot. */
  nativeTitle?: string
  id?: string
  class?: string
}

export function SettingsRow(props: SettingsRowProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    "leading",
    "as",
    "title",
    "desc",
    "meta",
    "actions",
    "children",
    "customContent",
    "align",
    "interactive",
    "nativeTitle",
    "id",
    "class",
  ])
  const merged = mergeProps({ align: "start" as const, as: "div" as const, interactive: false }, local)
  return (
    <Dynamic
      component={merged.as}
      {...rest}
      class={merged.class ? `s-row ${merged.class}` : "s-row"}
      type={merged.as === "button" ? "button" : undefined}
      id={merged.id}
      title={merged.nativeTitle}
      data-align={merged.align === "center" ? "center" : undefined}
      data-interactive={merged.interactive ? "true" : undefined}
    >
      <Show
        when={merged.customContent}
        fallback={
          <>
            <Show when={merged.leading}>
              <span class="s-row-leading">{merged.leading}</span>
            </Show>
            <div class="s-row-main">
              <Show when={merged.title}>
                <span class="s-row-title">{merged.title}</span>
              </Show>
              <Show when={merged.children}>{merged.children}</Show>
              <Show when={merged.desc}>
                <span class="s-row-desc">{merged.desc}</span>
              </Show>
              <Show when={merged.meta}>
                <span class="s-row-meta">{merged.meta}</span>
              </Show>
            </div>
            <Show when={merged.actions}>
              <div class="s-row-actions">{merged.actions}</div>
            </Show>
          </>
        }
      >
        {merged.children}
      </Show>
    </Dynamic>
  )
}

export interface SettingsToolbarProps {
  children: JSX.Element
}

export function SettingsToolbar(props: SettingsToolbarProps): JSX.Element {
  return <div class="s-toolbar">{props.children}</div>
}

export interface SettingsEmptyProps {
  children: JSX.Element
}

export function SettingsEmpty(props: SettingsEmptyProps): JSX.Element {
  return <div class="s-empty">{props.children}</div>
}

export interface SettingsStateProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, "class" | "children" | "title"> {
  title?: JSX.Element
  children: JSX.Element
  actions?: JSX.Element
  tone?: "neutral" | "info" | "success" | "warning" | "error"
  class?: string
}

/**
 * Canonical feedback surface for settings-only loading, unavailable,
 * success, warning, and error states. Empty collections stay on
 * SettingsEmpty; SettingsState is reserved for state that explains
 * why content is not currently available or needs attention.
 */
export function SettingsState(props: SettingsStateProps): JSX.Element {
  const [local, rest] = splitProps(props, ["title", "children", "actions", "tone", "class"])
  const tone = () => local.tone || "neutral"
  return (
    <div
      {...rest}
      class={local.class ? `s-state ${local.class}` : "s-state"}
      data-tone={tone()}
      role={tone() === "error" ? "alert" : "status"}
      aria-live="polite"
      aria-atomic="true"
    >
      <span class="s-state-marker" aria-hidden="true" />
      <div class="s-state-copy">
        <Show when={local.title}>
          <strong class="s-state-title">{local.title}</strong>
        </Show>
        <span class="s-state-body">{local.children}</span>
      </div>
      <Show when={local.actions}>
        <div class="s-state-actions">{local.actions}</div>
      </Show>
    </div>
  )
}
