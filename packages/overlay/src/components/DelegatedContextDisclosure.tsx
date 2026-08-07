import { Show, type JSX } from "solid-js"
import { conversationDisclosureExpanded, setConversationDisclosureExpanded } from "../store/conversation-ui"
import { t } from "../utils/i18n"
import { Button } from "./ui/Button"
import { Icon } from "./ui/Icon"

export function DelegatedContextDisclosure(props: { id: string; children: JSX.Element }) {
  const expanded = () => conversationDisclosureExpanded(props.id)
  return (
    <section class="msg-delegated-context" data-expanded={expanded() ? "true" : "false"}>
      <Button
        type="button"
        variant="ghost"
        size="mini"
        tone="neutral"
        data-chrome="context-disclosure"
        data-ui="delegated-context-toggle"
        aria-expanded={expanded()}
        aria-label={t("transcript.delegated_context")}
        onClick={(event) => {
          event.stopPropagation()
          setConversationDisclosureExpanded(props.id, !expanded())
        }}
      >
        <span class="msg-delegated-context__icon">
          <Icon name="git-branch" />
        </span>
        <span class="msg-delegated-context__label">{t("transcript.delegated_context")}</span>
        <span class="msg-transcript-disclosure__marker msg-delegated-context__marker">
          <Icon name={expanded() ? "chevron-down" : "chevron"} />
        </span>
      </Button>
      <Show when={expanded()}>
        <div class="msg-delegated-context__body">{props.children}</div>
      </Show>
    </section>
  )
}
