import { createEffect, createSignal, on, onCleanup, Show } from "solid-js"
import { ApiError } from "../services/api"
import type { MissionDraftEditInput, MissionRecord } from "../services/mission"
import { t } from "../utils/i18n"
import { AutoGrowTextarea } from "./ui/AutoGrowTextarea"
import { Button } from "./ui/Button"
import { Dialog } from "./ui/Dialog"
import { Feedback } from "./ui/Feedback"
import { TextField } from "./ui/TextField"

export type MissionDraftEditTarget = Pick<MissionRecord, "missionID" | "directory" | "title"> & {
  expectedRequest: string
}

function saveError(error: unknown): string {
  if (error instanceof ApiError && error.status === 409 && error.body && typeof error.body === "object") {
    const body = error.body as { name?: string; data?: { reason?: string } }
    if (body.name === "MissionDraftEditConflictError") {
      if (body.data?.reason === "changed") return t("mission_board.edit.changed")
      if (body.data?.reason === "missing") return t("mission_board.edit.missing")
      if (body.data?.reason === "archived") return t("mission_board.edit.archived")
    }
  }
  return error instanceof Error ? error.message : String(error)
}

export function MissionDraftEditDialog(props: {
  target: MissionDraftEditTarget | null
  onClose: () => void
  onSave: (input: MissionDraftEditInput) => Promise<void>
}) {
  const [request, setRequest] = createSignal("")
  const [saving, setSaving] = createSignal(false)
  const [error, setError] = createSignal("")
  let requestInput: HTMLTextAreaElement | undefined
  let generation = 0

  createEffect(
    on(
      () => props.target,
      (target) => {
        generation += 1
        setRequest(target?.expectedRequest ?? "")
        setSaving(false)
        setError("")
      },
    ),
  )
  onCleanup(() => {
    generation += 1
  })

  const close = () => {
    if (!saving()) props.onClose()
  }
  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    const target = props.target
    const text = request().trim()
    if (!target || saving() || !text || text.length > 32000) return
    const currentGeneration = generation
    setSaving(true)
    setError("")
    try {
      await props.onSave({
        missionID: target.missionID,
        directory: target.directory,
        request: text,
        expectedRequest: target.expectedRequest,
      })
      if (generation === currentGeneration && props.target === target) props.onClose()
    } catch (cause) {
      if (generation === currentGeneration && props.target === target) setError(saveError(cause))
    } finally {
      if (generation === currentGeneration && props.target === target) setSaving(false)
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
        event.preventDefault()
        requestInput?.focus()
      }}
      footer={
        <>
          <Button type="button" variant="ghost" size="md" tone="neutral" disabled={saving()} onClick={close}>
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            form="missionDraftEditForm"
            variant="solid"
            size="md"
            tone="neutral"
            disabled={saving() || !request().trim() || request().trim().length > 32000}
          >
            {saving() ? t("common.saving") : t("mission_board.edit.save")}
          </Button>
        </>
      }
    >
      <form id="missionDraftEditForm" class="mission-create-form" onSubmit={(event) => void submit(event)}>
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
        <Show when={error()}>
          <Feedback tone="error">{error()}</Feedback>
        </Show>
      </form>
    </Dialog>
  )
}
