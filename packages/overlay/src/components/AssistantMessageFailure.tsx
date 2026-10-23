import { Show } from "solid-js"
import { t } from "../utils/i18n"
import { CardErrorReasonIndicator } from "./CardHeaderChrome"
import { Disclosure } from "./ui/Disclosure"

/** Render the original assistant failure beside the message that owns it. */
export function AssistantMessageFailure(props: {
  reason: string
  details?: string
  cardID?: string
  messageID?: string
  cancelled?: boolean
}) {
  return (
    <div
      class="msg-tool-error msg-assistant-error"
      data-agent-error-card-id={props.cardID}
      data-agent-error-message-id={props.messageID}
      data-cancelled={props.cancelled ? "true" : undefined}
      role={props.cancelled ? "status" : "alert"}
    >
      <div class="msg-assistant-error__heading">
        <strong>{t(props.cancelled ? "card.cancelled_reason_title" : "card.error_reason_title")}</strong>
        <Show when={props.messageID}>
          <CardErrorReasonIndicator reason={props.reason} details={props.details} cancelled={props.cancelled} />
        </Show>
      </div>
      <div>{props.reason}</div>
      <Show when={props.details}>
        {(details) => (
          <Disclosure.Root class="msg-assistant-error__details" size="sm">
            <Disclosure.Trigger>{t("common.details")}</Disclosure.Trigger>
            <Disclosure.Content><pre>{details()}</pre></Disclosure.Content>
          </Disclosure.Root>
        )}
      </Show>
    </div>
  )
}
