// ── InteractionCard ──
// Single self-contained component used wherever the UI surfaces a pending
// `permission` or `question` interaction:
//   • inline in the conversation timeline (CardParts)
// Owns its own busy / error / draft state and dispatches replies through
// the shared `interaction-reply` service (which carries a per-id mutex), so
// callers don't need to wire callbacks. Body markdown is always rendered
// through `renderMarkdown`, eliminating the previous render-divergence
// where the sidebar parsed markdown but the inline card showed raw text.
//
// Visual treatment lives in `styles/surfaces/card.css` under `.interaction-card`,
// reusing the same `--card-*` design vars as the agent / goal cards so all
// system-prompt cards share one look.

import { createEffect, createMemo, createSignal, createUniqueId, For, onCleanup, Show } from "solid-js"
import { t } from "../utils/i18n"
import { renderMarkdown } from "../utils/markdown"
import { loadBoard } from "../store/board"
import { type InteractionReplyEndpoint, replyInteraction, rejectInteraction } from "../services/interaction-reply"
import { currentTraceDirectory } from "../services/trace-directory"
import { AutoGrowTextarea } from "./ui/AutoGrowTextarea"
import { Checkbox } from "./ui/Checkbox"
import { Radio, RadioGroup } from "./ui/RadioGroup"
import { Button } from "./ui/Button"
import { Icon } from "./ui/Icon"

export interface InteractionQuestion {
  header?: string
  question?: string
  multiple?: boolean
  custom?: boolean
  options?: Array<{ value: string; label: string; description?: string; disabled?: boolean }>
}

export interface InteractionData {
  id: string
  type: string
  title?: string
  body?: string
  status: string
  payload?: {
    questions?: InteractionQuestion[]
    automatic?: {
      answers?: string[][]
      timeoutMs?: number
      timeExpires?: number
    }
  }
  replyEndpoint?: InteractionReplyEndpoint
  directory?: string
}

export interface InteractionCardProps {
  interaction: InteractionData
  surface?: "inline" | "dialog"
}

export function InteractionCard(props: InteractionCardProps) {
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal("")
  const [customText, setCustomText] = createSignal<string[]>([])
  const [countdownNow, setCountdownNow] = createSignal(Date.now())
  const instanceID = createUniqueId()
  let cardElement: HTMLDivElement | undefined
  let errorElement: HTMLDivElement | undefined

  const isPermission = () => props.interaction.type === "permission"
  const isDialogSurface = () => props.surface === "dialog"
  const dataKind = () => (isPermission() ? "interaction-permission" : "interaction-question")
  const iconName = () => (isPermission() ? "interaction-permission" : "interaction-question")
  const iconLabel = () => (isPermission() ? t("interaction.icon.permission") : t("interaction.icon.question"))
  const domIDPrefix = createMemo(() => `interaction-${domID(instanceID)}-${domID(props.interaction.id)}`)

  const questions = createMemo<InteractionQuestion[]>(() => {
    const q = props.interaction?.payload?.questions
    return Array.isArray(q) ? q : []
  })
  const automatic = createMemo(() => {
    const value = props.interaction?.payload?.automatic
    const timeExpires = Number(value?.timeExpires)
    if (!Number.isFinite(timeExpires) || timeExpires <= 0) return null
    const answer = value?.answers?.[0]?.[0]
    const label = questions()[0]?.options?.find((option) => option.value === answer)?.label
    if (!label) return null
    return { label, timeExpires }
  })
  const automaticSeconds = createMemo(() => {
    const value = automatic()
    if (!value) return null
    return Math.max(0, Math.ceil((value.timeExpires - countdownNow()) / 1_000))
  })
  const automaticExpired = createMemo(() => automaticSeconds() === 0)
  createEffect(() => {
    if (!automatic()) return
    setCountdownNow(Date.now())
    const timer = window.setInterval(() => setCountdownNow(Date.now()), 250)
    onCleanup(() => window.clearInterval(timer))
  })
  const [drafts, setDrafts] = createSignal<string[][]>(initialQuestionDrafts(questions()))
  const replyEndpoint = createMemo<InteractionReplyEndpoint>(() =>
    props.interaction.replyEndpoint === "question" ? "question" : "interaction",
  )
  const replyTarget = () => ({
    id: props.interaction.id,
    directory: String(props.interaction.directory || "").trim() || currentTraceDirectory(),
  })

  function getSelected(qIdx: number): string[] {
    return drafts()[qIdx] ?? []
  }

  function toggleOption(qIdx: number, value: string, multiple: boolean) {
    setDrafts((prev) => {
      const next = [...prev]
      const current = next[qIdx] ?? []
      next[qIdx] = multiple
        ? current.includes(value)
          ? current.filter((candidate) => candidate !== value)
          : [...current, value]
        : current.includes(value)
          ? []
          : [value]
      return next
    })
  }

  function setCustomAt(qIdx: number, value: string) {
    setCustomText((prev) => {
      const next = [...prev]
      next[qIdx] = value
      return next
    })
  }

  async function runAction(fn: () => Promise<void>) {
    if (busy()) return
    setBusy(true)
    setError("")
    queueMicrotask(() => cardElement?.focus())
    try {
      await fn()
      await loadBoard()
    } catch (err: any) {
      setError(err?.message || String(err))
      queueMicrotask(() => (errorElement ?? cardElement)?.focus())
    } finally {
      setBusy(false)
    }
  }

  const resolvePermission = (action: "once" | "always") =>
    runAction(() => replyInteraction(replyTarget(), action, false, {}, replyEndpoint()))
  const reject = () => runAction(() => rejectInteraction(replyTarget(), false, replyEndpoint()))
  const submitAnswers = () =>
    runAction(() => {
      const answers = questions().map((_, idx) => {
        const picked = getSelected(idx)
        const custom = (customText()[idx] ?? "").trim()
        return custom ? [...picked, custom] : picked
      })
      return replyInteraction(
        replyTarget(),
        "answer",
        false,
        {
          answers,
        },
        replyEndpoint(),
      )
    })

  return (
    <div
      class="interaction-card"
      data-kind={dataKind()}
      data-id={props.interaction.id}
      data-surface={isDialogSurface() ? "dialog" : "inline"}
      aria-busy={busy() ? "true" : "false"}
      tabIndex={-1}
      ref={cardElement}
    >
      <div
        class="interaction-card__content"
        data-ui={isDialogSurface() ? "interaction-dialog-scroll-region" : undefined}
      >
        <Show when={props.interaction.title}>
          <div class="interaction-card__title">
            <span class="interaction-card__icon" role="img" aria-label={iconLabel()}>
              <Icon name={iconName()} size="medium" />
            </span>
            {props.interaction.title}
          </div>
        </Show>
        <Show when={isPermission() && props.interaction.body}>
          <div class="interaction-card__body md-content" innerHTML={renderMarkdown(props.interaction.body || "")} />
        </Show>
        <Show when={error()}>
          <div
            class="interaction-card__error"
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
            tabIndex={-1}
            ref={errorElement}
          >
            {t("interaction.error", { message: error() })}
          </div>
        </Show>
        <Show when={busy()}>
          <div class="interaction-card__status" role="status" aria-live="polite" aria-busy="true">
            {t("interaction.submitting")}
          </div>
        </Show>
        <Show when={!isPermission() && questions().length > 0}>
          <div class="interaction-card__questions">
            <For each={questions()}>
              {(q, qIdx) => {
                const multi = q.multiple === true
                const allowCustom = q.custom !== false
                const opts = Array.isArray(q.options) ? q.options : []
                const questionID = () => `${domIDPrefix()}-question-${qIdx()}`
                const questionText = () => questionLabel(q)
                return (
                  <fieldset class="interaction-card__question" aria-labelledby={questionID()}>
                    <legend id={questionID()} class="interaction-card__question-text">
                      {questionText()}
                    </legend>
                    <Show when={opts.length > 0}>
                      <Show
                        when={multi}
                        fallback={
                          <RadioGroup class="interaction-card__options" aria-labelledby={questionID()}>
                            <For each={opts}>
                              {(opt, optIdx) => {
                                const optionDescID = () => `${questionID()}-option-${optIdx()}-desc`
                                return (
                                  <Radio
                                    class="interaction-card__option"
                                    name={`iq-${domIDPrefix()}-${qIdx()}`}
                                    value={opt.value}
                                    checked={getSelected(qIdx()).includes(opt.value)}
                                    disabled={busy() || opt.disabled === true}
                                    selected={getSelected(qIdx()).includes(opt.value)}
                                    aria-describedby={opt.description ? optionDescID() : undefined}
                                    onChange={() => toggleOption(qIdx(), opt.value, false)}
                                  >
                                    <span class="interaction-card__option-label">{opt.label}</span>
                                    <Show when={opt.description}>
                                      <span id={optionDescID()} class="interaction-card__option-desc">
                                        {opt.description}
                                      </span>
                                    </Show>
                                  </Radio>
                                )
                              }}
                            </For>
                          </RadioGroup>
                        }
                      >
                        <div class="interaction-card__options">
                          <For each={opts}>
                            {(opt, optIdx) => {
                              const optionDescID = () => `${questionID()}-option-${optIdx()}-desc`
                              return (
                                <Checkbox
                                  class="interaction-card__option"
                                  name={`iq-${domIDPrefix()}-${qIdx()}`}
                                  checked={getSelected(qIdx()).includes(opt.value)}
                                  disabled={busy() || opt.disabled === true}
                                  data-selected={getSelected(qIdx()).includes(opt.value) ? "true" : undefined}
                                  inputAriaDescribedBy={opt.description ? optionDescID() : undefined}
                                  onChange={() => toggleOption(qIdx(), opt.value, true)}
                                >
                                  <span class="interaction-card__option-label">{opt.label}</span>
                                  <Show when={opt.description}>
                                    <span id={optionDescID()} class="interaction-card__option-desc">
                                      {opt.description}
                                    </span>
                                  </Show>
                                </Checkbox>
                              )
                            }}
                          </For>
                        </div>
                      </Show>
                    </Show>
                    <Show when={allowCustom}>
                      <AutoGrowTextarea
                        class="interaction-card__custom-input"
                        aria-labelledby={questionID()}
                        placeholder={t("interaction.custom_placeholder")}
                        rows={opts.length > 0 ? 1 : 3}
                        maxLines={6}
                        disabled={busy()}
                        value={customText()[qIdx()] ?? ""}
                        onInput={(event) => setCustomAt(qIdx(), event.currentTarget.value)}
                      />
                    </Show>
                  </fieldset>
                )
              }}
            </For>
          </div>
        </Show>
        <Show when={automatic()}>
          {(value) => (
            <div class="interaction-card__status" role="status" aria-live="polite" aria-atomic="true">
              {t("interaction.automatic_answer_countdown", {
                label: value().label,
                seconds: automaticSeconds() ?? 0,
              })}
            </div>
          )}
        </Show>
      </div>
      <div class="interaction-card__actions">
        <Show
          when={isPermission()}
          fallback={
            <>
              <Button
                type="button"
                variant="solid"
                size="md"
                tone="accent"
                data-action="answer"
                disabled={busy() || automaticExpired()}
                title={t("interaction.answer_title")}
                onClick={submitAnswers}
              >
                {t("interaction.answer")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="md"
                tone="neutral"
                data-action="skip"
                disabled={busy() || automaticExpired()}
                title={t("interaction.skip_title")}
                onClick={reject}
              >
                {t("interaction.skip")}
              </Button>
            </>
          }
        >
          <Button
            type="button"
            variant="solid"
            size="md"
            tone="accent"
            data-action="always"
            disabled={busy()}
            title={t("interaction.always_allow_title")}
            onClick={() => resolvePermission("always")}
          >
            {t("interaction.always_allow")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="md"
            tone="neutral"
            data-action="once"
            disabled={busy()}
            title={t("interaction.allow_once_title")}
            onClick={() => resolvePermission("once")}
          >
            {t("interaction.allow_once")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="md"
            tone="neutral"
            data-action="reject"
            disabled={busy()}
            title={t("interaction.reject_title")}
            onClick={reject}
          >
            {t("interaction.reject")}
          </Button>
        </Show>
      </div>
    </div>
  )
}

function domID(value: string): string {
  return value.trim().replace(/[^A-Za-z0-9_-]+/g, "-")
}

function questionLabel(question: InteractionQuestion): string {
  const primary = typeof question.question === "string" ? question.question.trim() : ""
  const header = typeof question.header === "string" ? question.header.trim() : ""
  if (header && primary && header !== primary) return `${header}: ${primary}`
  if (primary) return primary
  return header
}

function initialQuestionDrafts(questions: InteractionQuestion[]): string[][] {
  return questions.map((question) => {
    if (question.multiple === true || question.custom !== false) return []
    const options = Array.isArray(question.options) ? question.options : []
    const firstEnabled = options.find((option) => option.disabled !== true)
    return firstEnabled ? [firstEnabled.value] : []
  })
}
