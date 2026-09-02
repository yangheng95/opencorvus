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

import { createSignal, onCleanup, Show, type Accessor } from "solid-js"
import { t } from "../utils/i18n"
import { Icon } from "./ui/Icon"
import { AutoGrowTextarea } from "./ui/AutoGrowTextarea"
import { Button } from "./ui/Button"
import { randomUUID } from "../utils/random-id"

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
  onSend: (requestID: string, message: string) => Promise<{ request_id: string }>
  /** Stable target identity. The same worker can be projected in the main
   * conversation and the right dock, and either surface may remount when the
   * accepted coordination request refreshes durable task facts. */
  stateKey?: string
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

interface OperatorSteerState {
  open: Accessor<boolean>
  setOpen: OperatorSteerController["setOpen"]
  text: Accessor<string>
  setText: OperatorSteerController["setText"]
  sending: Accessor<boolean>
  setSending: (value: boolean) => void
  error: Accessor<string>
  setError: OperatorSteerController["setError"]
  receiptRequestID: Accessor<string>
  setReceiptRequestID: (value: string) => void
  pendingRequest?: { requestID: string; message: string }
  admissionBlocked: boolean
  consumers: number
  lastUsed: number
}

const operatorSteerStateByTarget = new Map<string, OperatorSteerState>()
const OPERATOR_STEER_STATE_CACHE_LIMIT = 64

function createOperatorSteerState(admissionBlocked = false): OperatorSteerState {
  const [text, setText] = createSignal("")
  const [sending, setSending] = createSignal(false)
  const [error, setError] = createSignal<string>(
    admissionBlocked
      ? "Too many unresolved guidance requests are retained. Reopen this agent after another request settles."
      : "",
  )
  const [receiptRequestID, setReceiptRequestID] = createSignal("")
  const [open, setOpen] = createSignal(false)
  return {
    open,
    setOpen,
    text,
    setText,
    sending,
    setSending,
    error,
    setError,
    receiptRequestID,
    setReceiptRequestID,
    admissionBlocked,
    consumers: 0,
    lastUsed: Date.now(),
  }
}

function pruneOperatorSteerStateCache(maximumSize = OPERATOR_STEER_STATE_CACHE_LIMIT): void {
  if (operatorSteerStateByTarget.size <= maximumSize) return
  const inactive = [...operatorSteerStateByTarget.entries()]
    .filter(([, state]) => state.consumers === 0 && !state.sending() && !state.pendingRequest)
    .sort((left, right) => left[1].lastUsed - right[1].lastUsed)
  for (const [key] of inactive) {
    if (operatorSteerStateByTarget.size <= maximumSize) break
    operatorSteerStateByTarget.delete(key)
  }
}

function operatorSteerState(stateKey: string | undefined): OperatorSteerState {
  const key = stateKey?.trim()
  if (!key) return createOperatorSteerState()
  const existing = operatorSteerStateByTarget.get(key)
  if (existing) {
    existing.lastUsed = Date.now()
    return existing
  }
  pruneOperatorSteerStateCache(OPERATOR_STEER_STATE_CACHE_LIMIT - 1)
  if (operatorSteerStateByTarget.size >= OPERATOR_STEER_STATE_CACHE_LIMIT) {
    return createOperatorSteerState(true)
  }
  const created = createOperatorSteerState()
  operatorSteerStateByTarget.set(key, created)
  pruneOperatorSteerStateCache()
  return created
}

export function createOperatorSteerController(
  onSend: (requestID: string, message: string) => Promise<{ request_id: string }>,
  stateKey?: string,
): OperatorSteerController {
  const state = operatorSteerState(stateKey)
  state.consumers += 1
  state.lastUsed = Date.now()
  onCleanup(() => {
    state.consumers = Math.max(0, state.consumers - 1)
    state.lastUsed = Date.now()
    pruneOperatorSteerStateCache()
  })
  const { open, setOpen, text, setText, sending, setSending, error, setError, receiptRequestID, setReceiptRequestID } =
    state

  const canSend = () => !state.admissionBlocked && !sending() && text().trim().length > 0

  const submit = async (event: SubmitEvent | KeyboardEvent) => {
    event.preventDefault()
    if (!canSend()) return
    const message = text().trim()
    const request =
      state.pendingRequest?.message === message
        ? state.pendingRequest
        : {
            requestID: `art_${randomUUID().replaceAll("-", "").slice(0, 20)}`,
            message,
          }
    state.pendingRequest = request
    state.lastUsed = Date.now()
    setSending(true)
    setError("")
    setReceiptRequestID("")
    try {
      const receipt = await onSend(request.requestID, message)
      // Only clear the textarea on success — failed sends should keep
      // the operator's text so they don't have to retype after a retry.
      setText("")
      state.pendingRequest = undefined
      setReceiptRequestID(receipt.request_id)
    } catch (e) {
      const info = pickErrorInfo(e)
      const defaultMessage = e instanceof Error ? e.message : String(e)
      setError(messageForError(info, defaultMessage))
    } finally {
      setSending(false)
      state.lastUsed = Date.now()
      pruneOperatorSteerStateCache()
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
  const controller = createOperatorSteerController(props.onSend, props.stateKey)
  return (
    <div class="card__agent-reply-shell" data-open={controller.open() ? "true" : "false"}>
      <OperatorSteerTrigger controller={controller} />
      <OperatorSteerForm controller={controller} />
    </div>
  )
}
