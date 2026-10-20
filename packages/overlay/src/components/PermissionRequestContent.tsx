import { createMemo, Show } from "solid-js"
import type { InteractionData } from "./InteractionCard"
import { t } from "../utils/i18n"
import { permissionRequestTitle } from "../utils/transcript"
import { Disclosure } from "./ui/Disclosure"
import { Icon } from "./ui/Icon"

/** Read the original structured scope on both the approval and history surfaces. */
export function PermissionRequestContent(props: { interaction: InteractionData; compact?: boolean }) {
  const payload = () => props.interaction.payload
  const effect = () => payload()?.effectClass ?? ""
  const label = createMemo(() => {
    switch (effect()) {
      case "read_local":
        return t("permission.effect.read_local")
      case "write_local":
        return t("permission.effect.write_local")
      case "process":
        return t("permission.effect.process")
      case "network_read":
        return t("permission.effect.network_read")
      case "external_effect":
        return t("permission.effect.external_effect")
      case "credential_release":
        return t("permission.effect.credential_release")
      case "destructive":
        return t("permission.effect.destructive")
      default:
        return effect()
    }
  })
  const resource = createMemo(() => {
    const value = payload()?.scope?.resource
    return value === undefined ? "" : JSON.stringify(value, null, 2)
  })
  const scope = createMemo(() => JSON.stringify(payload()?.scope, null, 2))
  const Heading = () => (
    <>
      <span class="interaction-card__icon" role="img" aria-label={t("interaction.icon.permission")}>
        <Icon name="interaction-permission" size="medium" />
      </span>
      <span class="permission-request__title">{permissionRequestTitle(payload()?.toolName)}</span>
      <span class="permission-request__effect">{label()}</span>
    </>
  )
  const DetailsContent = () => (
    <Disclosure.Content>
      <pre tabIndex={0} aria-label={t("permission.exact_scope")}>
        {scope()}
      </pre>
    </Disclosure.Content>
  )
  return (
    <div class="permission-request" data-compact={props.compact ? "true" : undefined} data-effect={effect()}>
      <Show
        when={props.compact}
        fallback={
          <>
            <div class="permission-request__heading">
              <Heading />
            </div>
            <p class="permission-request__hint">{t("permission.review_hint")}</p>
            <Show when={resource()}>
              <div class="permission-request__operation">
                <div class="permission-request__label">{t("permission.requested_operation")}</div>
                <pre tabIndex={0} aria-label={t("permission.requested_operation")}>
                  {resource()}
                </pre>
              </div>
            </Show>
            <Disclosure.Root class="permission-request__details">
              <Disclosure.Trigger>{t("permission.exact_scope")}</Disclosure.Trigger>
              <DetailsContent />
            </Disclosure.Root>
          </>
        }
      >
        <Disclosure.Root>
          <Disclosure.Trigger
            class="permission-request__heading"
            aria-label={`${permissionRequestTitle(payload()?.toolName)} · ${label()} · ${t("permission.exact_scope")}`}
          >
            <Heading />
          </Disclosure.Trigger>
          <DetailsContent />
        </Disclosure.Root>
      </Show>
    </div>
  )
}
