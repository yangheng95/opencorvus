import { createEffect, createSignal, on, onCleanup, Show } from "solid-js"
import { ApiError, captureApiAuthority, isApiAuthorityCurrent, type ApiAuthority } from "../services/api"
import { formatErrorDetails } from "../services/diagnostics"
import { loadEditableMissionDraft, MissionDraftEditUnconfirmedError, type MissionDraftEditInput, type MissionRecord } from "../services/mission"
import { t } from "../utils/i18n"
import { AutoGrowTextarea } from "./ui/AutoGrowTextarea"
import { Button } from "./ui/Button"
import { Dialog } from "./ui/Dialog"
import { Feedback } from "./ui/Feedback"
import { TextField } from "./ui/TextField"

export type MissionDraftEditTarget = Pick<MissionRecord, "missionID" | "sessionID" | "directory" | "title" | "productPillar"> & {
  expectedRequest: string
}

type DraftReview =
  | { kind: "required" | "reading" }
  | { kind: "failed"; cause: unknown }
  | { kind: "ready" | "confirmed"; text: string }

function conflictReason(error: unknown) {
  if (error instanceof ApiError && error.status === 409 && error.body && typeof error.body === "object") {
    const body = error.body as { name?: string; data?: { reason?: string } }
    if (body.name === "MissionDraftEditConflictError") return body.data?.reason
  }
}

function saveError(error: unknown): string {
  if (error instanceof MissionDraftEditUnconfirmedError) return t("mission_board.edit.unconfirmed")
  const reason = conflictReason(error)
  if (reason === "changed") return t("mission_board.edit.changed")
  if (reason === "missing") return t("mission_board.edit.missing")
  if (reason === "archived") return t("mission_board.edit.archived")
  return t("mission_board.edit.failed")
}

export function MissionDraftEditDialog(props: {
  target: MissionDraftEditTarget | null
  onClose: () => void
  onSave: (input: MissionDraftEditInput) => Promise<void>
}) {
  const [request, setRequest] = createSignal("")
  const [saving, setSaving] = createSignal(false)
  const [error, setError] = createSignal<{ cause: unknown }>()
  const [leaving, setLeaving] = createSignal(false)
  const [openingAuthority, setOpeningAuthority] = createSignal<ApiAuthority>()
  const [review, setReview] = createSignal<DraftReview>()
  let requestInput: HTMLTextAreaElement | undefined
  let leaveFeedback: HTMLDivElement | undefined
  let reviewButton: HTMLButtonElement | undefined
  let savedRequestInput: HTMLTextAreaElement | undefined
  let reviewRequest: AbortController | undefined
  let generation = 0

  const connectionChanged = () => {
    const authority = openingAuthority()
    return authority !== undefined && !isApiAuthorityCurrent(authority)
  }
  const savedReview = () => {
    const current = review()
    return current?.kind === "ready" || current?.kind === "confirmed" ? current : undefined
  }
  const reviewFailed = () => {
    const current = review()
    return current?.kind === "failed" ? current : undefined
  }
  const requiresReview = () => review() !== undefined && review()?.kind !== "confirmed"
  const expectedRequest = () => {
    const current = savedReview()
    return current?.kind === "confirmed" ? current.text : props.target?.expectedRequest
  }
  const saveDisabled = () => saving() || connectionChanged() || requiresReview() ||
    !request().trim() || request().trim().length > 32000

  createEffect(
    on(
      () => props.target,
      (target) => {
        generation += 1
        reviewRequest?.abort()
        setOpeningAuthority(target ? captureApiAuthority() : undefined)
        setRequest(target?.expectedRequest ?? "")
        setSaving(false)
        setError(undefined)
        setLeaving(false)
        setReview(undefined)
      },
    ),
  )
  onCleanup(() => {
    generation += 1
    reviewRequest?.abort()
  })

  function focusAfter(origin: Element | null, owned: () => boolean, target: () => HTMLElement | undefined) {
    queueMicrotask(() => {
      const active = document.activeElement
      if (owned() && (active === origin || active === document.body)) target()?.focus()
    })
  }

  async function reviewSavedRequest() {
    const target = props.target
    const authority = openingAuthority()
    const current = review()
    if (!target || !authority || connectionChanged() || (current?.kind !== "required" && current?.kind !== "failed")) return
    const currentGeneration = generation
    const origin = document.activeElement
    const controller = new AbortController()
    reviewRequest = controller
    const owns = () => generation === currentGeneration && props.target === target &&
      !controller.signal.aborted && isApiAuthorityCurrent(authority)
    setReview({ kind: "reading" })
    try {
      const text = await loadEditableMissionDraft({ ...target, authority, signal: controller.signal })
      if (!owns()) return
      setReview({ kind: "ready", text })
      savedRequestInput?.setSelectionRange(0, 0)
      focusAfter(origin, owns, () => savedRequestInput)
    } catch (cause) {
      if (owns()) setReview({ kind: "failed", cause })
    } finally {
      if (reviewRequest === controller) reviewRequest = undefined
    }
  }

  function confirmReview() {
    const current = review()
    if (connectionChanged() || current?.kind !== "ready") return
    setReview({ kind: "confirmed", text: current.text })
    requestInput?.focus()
  }

  const keepEditing = () => {
    setLeaving(false)
    queueMicrotask(() => requestInput?.focus())
  }
  const close = () => {
    if (saving()) return
    if (leaving()) return keepEditing()
    if (request() === expectedRequest()) return props.onClose()
    setLeaving(true)
    queueMicrotask(() => {
      leaveFeedback?.scrollIntoView({ block: "nearest" })
      leaveFeedback?.focus({ preventScroll: true })
    })
  }
  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    const target = props.target
    const authority = openingAuthority()
    const expected = expectedRequest()
    const text = request().trim()
    if (!target || !authority || !expected || saveDisabled()) return
    const currentGeneration = generation
    const origin = document.activeElement
    const ownsTarget = () => generation === currentGeneration && props.target === target
    const owns = () => ownsTarget() && isApiAuthorityCurrent(authority)
    setSaving(true)
    setError(undefined)
    try {
      await props.onSave({
        missionID: target.missionID,
        sessionID: target.sessionID,
        directory: target.directory,
        request: text,
        expectedRequest: expected,
        authority,
      })
      if (owns()) props.onClose()
    } catch (cause) {
      if (!owns()) return
      const changed = conflictReason(cause) === "changed"
      if (changed) setReview({ kind: "required" })
      setError({ cause })
      focusAfter(origin, owns, () => changed ? reviewButton : requestInput)
    } finally {
      if (ownsTarget()) setSaving(false)
    }
  }

  return (
    <Dialog
      id="missionDraftEditDialog"
      open={Boolean(props.target)}
      title={t("mission_board.edit.title")}
      backdropClose={false}
      onClose={close}
      onOpenAutoFocus={(event) => {
        const target = props.target
        const input = requestInput
        if (!target || !input) return
        event.preventDefault()
        input.focus()
        queueMicrotask(() => {
          if (props.target !== target || input.ownerDocument.activeElement !== input) return
          input.setSelectionRange(0, 0)
          input.scrollTop = 0
        })
      }}
      footer={
        <>
          <Button type="button" variant="ghost" size="md" tone="neutral" disabled={saving()} onClick={close}>
            {leaving() ? t("mission_board.unsaved.keep") : t("common.cancel")}
          </Button>
          <Show when={leaving()}>
            <Button type="button" variant="outline" size="md" tone="danger" disabled={saving()} onClick={props.onClose}>
              {t("mission_board.unsaved.discard")}
            </Button>
          </Show>
          <Button
            type="submit"
            form="missionDraftEditForm"
            variant="solid"
            size="md"
            tone="neutral"
            disabled={saveDisabled()}
          >
            {saving() ? t("common.saving") : t("mission_board.edit.save")}
          </Button>
        </>
      }
    >
      <form
        id="missionDraftEditForm"
        class="mission-create-form"
        onSubmit={(event) => void submit(event)}
        onInput={() => setLeaving(false)}
      >
        <Show when={leaving()}>
          <Feedback ref={leaveFeedback} tone="warning" title={t("mission_board.unsaved.title")} tabIndex={-1}>
            {t("mission_board.unsaved.message")}
          </Feedback>
        </Show>
        <div class="mission-draft-edit__context">
          <strong>{props.target?.title}</strong>
          <span title={props.target?.directory}>{props.target?.directory}</span>
          <p>{t("mission_board.edit.help")}</p>
        </div>
        <TextField.Root as="label" class="mission-create-form__request">
          <TextField.Label>{t("mission_board.create.description")}</TextField.Label>
          <AutoGrowTextarea
            ref={(element) => {
              requestInput = element
            }}
            value={request()}
            rows={8}
            maxLines={14}
            maxlength={32000}
            required
            disabled={saving()}
            onInput={(event) => setRequest(event.currentTarget.value)}
          />
        </TextField.Root>
        <Show when={connectionChanged()}>
          <Feedback tone="error">{t("mission_board.edit.connection_changed")}</Feedback>
        </Show>
        <Show when={error()}>
          {(failure) => {
            const reviewed = () => savedReview()?.kind === "confirmed" && conflictReason(failure().cause) === "changed"
            return <Feedback tone={reviewed() ? "neutral" : "error"} details={formatErrorDetails(failure().cause)}
              actions={<Show when={!connectionChanged() && requiresReview() && !savedReview()}>
                <Button type="button" variant="outline" size="sm" tone="neutral" ref={reviewButton}
                  aria-disabled={review()?.kind === "reading" || undefined} aria-busy={review()?.kind === "reading" || undefined}
                  onClick={() => void reviewSavedRequest()}>
                  {t(review()?.kind === "reading" ? "common.loading" : "mission_board.edit.review")}
                </Button>
              </Show>}>
              {reviewed() ? t("mission_board.edit.review_confirmed") : saveError(failure().cause)}
            </Feedback>
          }}
        </Show>
        <Show when={!connectionChanged() && reviewFailed()}>
          {(failure) => <Feedback tone="error" details={formatErrorDetails(failure().cause)}>
            {t("mission_board.edit.review_failed")}
          </Feedback>}
        </Show>
        <Show when={!connectionChanged() && savedReview()}>
          {(saved) => <div class="mission-draft-edit__comparison">
            <TextField.Root as="label" class="mission-create-form__request">
              <TextField.Label>{t("mission_board.edit.saved_request")}</TextField.Label>
              <AutoGrowTextarea ref={(element) => { savedRequestInput = element }}
                rows={3} maxLines={6} readOnly value={saved().text} />
            </TextField.Root>
            <Show when={saved().kind === "ready"}>
              <Button type="button" variant="outline" size="sm" tone="neutral" onClick={confirmReview}>
                {t("mission_board.edit.review_continue")}
              </Button>
            </Show>
          </div>}
        </Show>
      </form>
    </Dialog>
  )
}
