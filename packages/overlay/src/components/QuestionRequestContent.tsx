import { createSignal, For, Show } from "solid-js"
import type { InteractionData } from "./InteractionCard"
import { localeTag, t, tc } from "../utils/i18n"
import { TextPart } from "./TextPart"
import { Disclosure } from "./ui/Disclosure"
import { Icon } from "./ui/Icon"

/** Retained requests stay readable without filling the completed conversation. */
export function QuestionRequestContent(props: { interaction: InteractionData }) {
  const [open, setOpen] = createSignal(false)
  const questions = () => props.interaction.payload?.questions ?? []
  const count = () => questions().length
  const context = () => {
    const original = props.interaction
    const title = questions().map((question) => question.header?.trim()).filter(Boolean).join(" / ")
    const body = questions().map((question) => question.question?.trim()).filter(Boolean).join("\n\n")
    return [
      original.title?.trim() === title ? "" : original.title,
      original.body?.trim() === body ? "" : original.body,
    ].filter(Boolean).join("\n\n")
  }
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
          <Show when={context()}>{(text) => <TextPart text={text()} />}</Show>
          <ol class="question-request-history__questions">
            <For each={questions()}>
              {(question, index) => (
                <li class="question-request-history__question">
                  <div class="question-request-history__heading">
                    <span class="interaction-card__question-position">
                      {t("interaction.question_position", {
                        index: (index() + 1).toLocaleString(localeTag()),
                        count: count().toLocaleString(localeTag()),
                      })}
                    </span>
                    <Show when={question.header}>
                      <strong>{question.header}</strong>
                    </Show>
                  </div>
                  <TextPart text={question.question ?? ""} />
                  <Show when={question.options?.length}>
                    <p class="question-request-history__label">
                      {t(question.multiple ? "interaction.options_multiple" : "interaction.options_single")}
                    </p>
                    <ul class="question-request-history__options">
                      <For each={question.options}>
                        {(option) => (
                          <li>
                            <div>
                              <strong>{option.label}</strong>
                              <Show when={option.disabled}>
                                <span class="question-request-history__unavailable">{t("interaction.option_unavailable")}</span>
                              </Show>
                            </div>
                            <Show when={option.description}>
                              <TextPart text={option.description!} />
                            </Show>
                          </li>
                        )}
                      </For>
                    </ul>
                  </Show>
                  <Show when={question.custom !== false}>
                    <p class="question-request-history__label">{t("interaction.custom_allowed")}</p>
                  </Show>
                </li>
              )}
            </For>
          </ol>
        </Disclosure.Content>
      </Show>
    </Disclosure.Root>
  )
}
