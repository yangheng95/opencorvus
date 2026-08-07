// ── OperatorSteerBox ──
// Inline textarea + steer button rendered at the END of an agent/session
// card. All callers route through one target-scoped operator steer API that
// persists a visible coordination request for the orchestrator to answer.
//
// Trigger and form share one controller so message surfaces can place the
// trigger in hover chrome while keeping the opened form in the body flow.
//
// Error handling: structural backend errors are visible diagnostics only. The
// operator steer route must not rewrite failed steer into task-root input or a
// direct child-session reply.

import { createSignal, Show, type Accessor } from "solid-js"
import { t } from "../utils/i18n"
import { Icon } from "./ui/Icon"
import { AutoGrowTextarea } from "./ui/AutoGrowTextarea"
import { Button } from "./ui/Button"

/** Backend NamedError names the operator steer route may surface. Kept here as a
 *  closed string union so the JSX branches stay exhaustive at the type
 *  level. If the backend adds a new name, TS will surface the missing
 *  branch via `(errorName satisfies undefined)` in the default arm. */
type OperatorSteerErrorName = "OperatorSteerTargetError"

interface OperatorSteerErrorInfo {
  name: OperatorSteerErrorName | undefined
}

function pickErrorInfo(err: unknown): OperatorSteerErrorInfo {
  if (!err || typeof err !== "object") return { name: undefined }
  // ApiError attaches the parsed JSON body verbatim. NamedError.toObject()
  // shape is `{ name: "...", data: {...} }` — read body.name when
  // available, falling back to top-level name on raw error objects.
  const body = (err as { body?: unknown }).body
  const fromBody =
    body && typeof body === "object" && typeof (body as { name?: unknown }).name === "string"
      ? (body as { name: string }).name
      : undefined
  const fromError = typeof (err as { name?: unknown }).name === "string" ? (err as { name: string }).name : undefined
  const candidate = fromBody ?? fromError
  let name: OperatorSteerErrorName | undefined
  switch (candidate) {
    case "OperatorSteerTargetError":
      name = candidate
      break
    default:
      name = undefined
  }
  return { name }
}

function messageForError(info: OperatorSteerErrorInfo, defaultMessage: string): string {
  switch (info.name) {
    case "OperatorSteerTargetError":
      return t("card.agent_reply_kind_not_allowed")
    default:
      return defaultMessage || t("card.agent_reply_failed")
  }
}

export interface OperatorSteerBoxProps {
  /** Persist operator guidance for the target Session's Orchestrator.
   * Resolves when the durable coordination request is accepted. */
  onSend: (message: string) => Promise<{ request_id: string }>
}

export interface OperatorSteerController {
  open: Accessor<boolean>
  setOpen: (value: boolean | ((current: boolean) => boolean)) => void
  text: Accessor<string>
  setText: (value: string) => void
  sending: Accessor<boolean>
  error: Accessor<string>
  setError: (value: string) => void
  receiptRequestID: Accessor<string>
  canSend: () => boolean
  submit: (event: SubmitEvent | KeyboardEvent) => Promise<void>
}

export function createOperatorSteerController(
  onSend: (message: string) => Promise<{ request_id: string }>,
): OperatorSteerController {
  const [text, setText] = createSignal("")
  const [sending, setSending] = createSignal(false)
  const [error, setError] = createSignal<string>("")
  const [receiptRequestID, setReceiptRequestID] = createSignal("")
  const [open, setOpen] = createSignal(false)

  const canSend = () => !sending() && text().trim().length > 0

  const submit = async (event: SubmitEvent | KeyboardEvent) => {
    event.preventDefault()
    if (!canSend()) return
    const message = text().trim()
    setSending(true)
    setError("")
    setReceiptRequestID("")
    try {
      const receipt = await onSend(message)
      // Only clear the textarea on success — failed sends should keep
      // the operator's text so they don't have to retype after a retry.
      setText("")
      setReceiptRequestID(receipt.request_id)
    } catch (e) {
      const info = pickErrorInfo(e)
      const defaultMessage = e instanceof Error ? e.message : String(e)
      setError(messageForError(info, defaultMessage))
    } finally {
      setSending(false)
    }
  }

  return { open, setOpen, text, setText, sending, error, setError, receiptRequestID, canSend, submit }
}

export function OperatorSteerTrigger(props: { controller: OperatorSteerController }) {
  return (
    <Button
        type="button"
        variant="ghost"
        size="sm"
        tone="neutral"
        class="card__agent-reply-disclosure"
        data-ui="agent-reply-disclosure"
        aria-expanded={props.controller.open()}
        aria-label={t("card.agent_reply_toggle")}
        title={t("card.agent_reply_toggle")}
        onClick={(event) => {
          event.stopPropagation()
          props.controller.setOpen((value) => !value)
        }}
      >
        <Icon name={props.controller.open() ? "chevron-down" : "message"} />
        <span class="card__agent-reply-disclosure-label">{t("card.agent_reply_toggle")}</span>
    </Button>
  )
}

export function OperatorSteerForm(props: { controller: OperatorSteerController }) {
  return (
    <Show when={props.controller.open()}>
      <form
          class="card__agent-reply"
          onSubmit={props.controller.submit}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <div class="card__agent-reply-field">
            <AutoGrowTextarea
              class="card__agent-reply-input"
              value={props.controller.text()}
              rows={2}
              maxLines={2}
              placeholder={t("card.agent_reply_placeholder")}
              disabled={props.controller.sending()}
              onInput={(event) => props.controller.setText(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  void props.controller.submit(event)
                }
              }}
            />
            <Button
              type="submit"
              variant="solid"
              size="sm"
              tone="accent"
              data-ui="agent-reply-send"
              disabled={!props.controller.canSend()}
              aria-label={props.controller.sending() ? t("card.agent_reply_sending") : t("card.agent_reply_send")}
              title={props.controller.sending() ? t("card.agent_reply_sending") : t("card.agent_reply_send")}
            >
              <Icon name="send" />
              <span>
                <Show when={!props.controller.sending()} fallback={t("card.agent_reply_sending")}>
                  {t("card.agent_reply_send")}
                </Show>
              </span>
            </Button>
          </div>
          <Show when={props.controller.receiptRequestID()}>
            {(requestID) => (
              <div class="card__agent-reply-receipt" role="status">
                {t("card.agent_reply_accepted", { requestID: requestID() })}
              </div>
            )}
          </Show>
          <Show when={props.controller.error()}>
            <div class="card__agent-reply-error" role="alert">
              <span class="card__agent-reply-error-msg">{props.controller.error()}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                tone="danger"
                data-ui="agent-reply-error-dismiss"
                data-chrome="icon-action"
                onClick={() => props.controller.setError("")}
                aria-label={t("common.clear")}
                title={t("common.clear")}
              >
                <Icon name="close" />
              </Button>
            </div>
          </Show>
      </form>
    </Show>
  )
}

export function OperatorSteerBox(props: OperatorSteerBoxProps) {
  const controller = createOperatorSteerController(props.onSend)
  return (
    <div class="card__agent-reply-shell" data-open={controller.open() ? "true" : "false"}>
      <OperatorSteerTrigger controller={controller} />
      <OperatorSteerForm controller={controller} />
    </div>
  )
}
