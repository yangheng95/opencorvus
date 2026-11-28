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
        <strong>{t(props.cancelled ? "card.cancelled_reason_title" : "card.response_failed_title")}</strong>
        <Show when={props.messageID}>
          <CardErrorReasonIndicator reason={props.reason} details={props.details} cancelled={props.cancelled} />
        </Show>
      </div>
      <pre class="msg-assistant-error__reason" role="region" tabIndex={0}
        aria-label={t(props.cancelled ? "card.cancelled_reason_title" : "card.error_reason_title")}>
        {props.reason}
      </pre>
      <Show when={props.details}>
        {(details) => <>
          <div>{t(props.cancelled ? "card.cancelled_reason_hint" : "card.response_failed_hint")}</div>
          <Disclosure.Root class="msg-assistant-error__details" size="sm">
            <Disclosure.Trigger>{t(props.cancelled ? "common.details" : "card.error_reason_title")}</Disclosure.Trigger>
            <Disclosure.Content><pre>{details()}</pre></Disclosure.Content>
          </Disclosure.Root>
        </>}
      </Show>
    </div>
  )
}
