import { createSignal, Show } from "solid-js"
import type { InteractionData } from "./InteractionCard"
import { interactionRequestText } from "../utils/transcript"
import { t, tc } from "../utils/i18n"
import { TextPart } from "./TextPart"
import { Disclosure } from "./ui/Disclosure"
import { Icon } from "./ui/Icon"

/** Retained requests stay readable without filling the completed conversation. */
export function QuestionRequestContent(props: { interaction: InteractionData }) {
  const [open, setOpen] = createSignal(false)
  const count = () => props.interaction.payload?.questions?.length ?? 0
  return (
    <Disclosure.Root class="question-request-history" open={open()} onOpenChange={setOpen}>
      <Disclosure.Trigger>
        <Icon name="interaction-question" size="compact" decorative />
        <span>{t("interaction.question_details")}</span>
        <Show when={count() > 0}>
          <span class="question-request-history__count">{tc("tool.question_count", count())}</span>
        </Show>
      </Disclosure.Trigger>
      <Show when={open()}>
        <Disclosure.Content>
          <TextPart text={interactionRequestText(props.interaction)} />
        </Disclosure.Content>
      </Show>
    </Disclosure.Root>
  )
}
