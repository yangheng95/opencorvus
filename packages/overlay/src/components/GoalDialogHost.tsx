import { createEffect, Show } from "solid-js"
import { dialogStore, setDialogStore } from "../store/dialog"
import { closeGoalDialog, saveGoalDialog } from "../services/dialog"
import { formatErrorDetails, reportError } from "../services/diagnostics"
import { t } from "../utils/i18n"
import { Dialog } from "./ui/Dialog"
import { AutoGrowTextarea } from "./ui/AutoGrowTextarea"
import { TextField } from "./ui/TextField"
import { Button } from "./ui/Button"

export function GoalDialogHost() {
  let titleRef: HTMLTextAreaElement | undefined

  createEffect(() => {
    if (!dialogStore.goal.open) return
    queueMicrotask(() => {
      titleRef?.focus()
      titleRef?.select()
    })
  })

  return (
    <Dialog
      id="goalDialog"
      open={dialogStore.goal.open}
      title={<span id="goalDialogTitle">{t("goal.title")}</span>}
      onClose={() => void closeGoalDialog()}
      footer={
        <>
          <Button
            type="button"
            id="btnCancelGoal"
            variant="ghost"
            size="md"
            tone="neutral"
            disabled={dialogStore.goal.saving}
            onClick={closeGoalDialog}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            form="goalForm"
            id="btnSaveGoal"
            variant="solid"
            size="md"
            tone="accent"
            disabled={dialogStore.goal.saving || !dialogStore.goal.title.trim()}
          >
            {dialogStore.goal.saving ? t("common.saving") : t("goal.save")}
          </Button>
        </>
      }
    >
      <form
        class="goal-dialog-form"
        id="goalForm"
        onSubmit={(event) => {
          event.preventDefault()
          void saveGoalDialog().catch((error) => {
            reportError({
              id: `goal:save:${dialogStore.goal.goalID || "new"}`,
              title: t("common.error"),
              message: error instanceof Error ? error.message : String(error),
              details: formatErrorDetails(error),
            })
          })
        }}
      >
        <input type="hidden" name="goalId" id="goalId" value={dialogStore.goal.goalID} />
        <TextField.Root as="label">
          <TextField.Label innerHTML={t("goal.field.title") + " <em>*</em>"} />
          <AutoGrowTextarea
            id="goalDescription"
            name="title"
            required={true}
            rows={3}
            maxLines={4}
            placeholder={t("goal.field.title_placeholder")}
            value={dialogStore.goal.title}
            ref={(el) => {
              titleRef = el
            }}
            onInput={(event) => {
              setDialogStore("goal", "title", event.currentTarget.value)
            }}
          />
        </TextField.Root>
        <Show when={!dialogStore.goal.goalID}>
          <TextField.Root as="label">
            <TextField.Label>{t("goal.field.acceptance")}</TextField.Label>
            <AutoGrowTextarea
              id="goalCriteria"
              name="acceptance"
              rows={3}
              maxLines={10}
              placeholder={t("goal.field.acceptance_placeholder")}
              value={dialogStore.goal.acceptance}
              onInput={(event) => {
                setDialogStore("goal", "acceptance", event.currentTarget.value)
              }}
            />
          </TextField.Root>
        </Show>
      </form>
    </Dialog>
  )
}
