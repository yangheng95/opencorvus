import { Show, splitProps, type JSX } from "solid-js"
import { t } from "../../utils/i18n"
import { Disclosure } from "./Disclosure"

export interface FeedbackProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, "class" | "children" | "title"> {
  title?: JSX.Element
  children: JSX.Element
  details?: JSX.Element
  actions?: JSX.Element
  tone?: "neutral" | "info" | "success" | "warning" | "error"
  class?: string
}

/** Inline state feedback. Diagnostics retain their complete original content. */
export function Feedback(props: FeedbackProps): JSX.Element {
  const [local, rest] = splitProps(props, ["title", "children", "details", "actions", "tone", "class"])
  return (
    <div
      {...rest}
      class={local.class ? `oc-feedback ${local.class}` : "oc-feedback"}
      data-tone={local.tone ?? "neutral"}
      role={local.tone === "error" ? "alert" : "status"}
      aria-live="polite"
      aria-atomic="true"
    >
      <div class="oc-feedback__copy">
        <Show when={local.title}>
          <strong class="oc-feedback__title">{local.title}</strong>
        </Show>
        <div class="oc-feedback__body">{local.children}</div>
        <Show when={local.details}>
          <Disclosure.Root class="oc-feedback__details">
            <Disclosure.Trigger indicatorPosition="end">{t("common.details")}</Disclosure.Trigger>
            <Disclosure.Content class="oc-feedback__diagnostic">{local.details}</Disclosure.Content>
          </Disclosure.Root>
        </Show>
      </div>
      <Show when={local.actions}>
        <div class="oc-feedback__actions">{local.actions}</div>
      </Show>
    </div>
  )
}
