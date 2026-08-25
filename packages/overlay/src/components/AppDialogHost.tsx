import { Show, createEffect, createSignal } from "solid-js"
import { dialogStore, setDialogStore } from "../store/dialog"
import { dismissAppDialog, settleAppDialog } from "../services/app-dialog"
import { t } from "../utils/i18n"
import { nativeOpen } from "../utils/native"
import { Dialog } from "./ui/Dialog"
import { Button } from "./ui/Button"
import { TextField } from "./ui/TextField"
import { SelectControl } from "./ui/SelectControl"

type AppDialogSelectOption = { value: string; label?: string }

export function AppDialogHost() {
  // Reported by the link action alone. Cleared whenever a new dialog opens, so
  // one dialog's failure never greets the next.
  const [linkError, setLinkError] = createSignal("")
  createEffect(() => {
    dialogStore.app.epoch
    setLinkError("")
  })

  let okButtonRef: HTMLButtonElement | undefined
  let inputRef: HTMLInputElement | undefined
  let selectRef: HTMLButtonElement | undefined

  const selectOptions = () => (dialogStore.app.selectOptions || []) as AppDialogSelectOption[]
  const selectedOption = () => selectOptions().find((item) => item.value === dialogStore.app.selectValue) ?? null
  const setSelectOption = (option: AppDialogSelectOption | null) => {
    if (!option) return
    setDialogStore("app", "selectValue", option.value)
  }
  const confirm = async () => {
    if (!(await settleAppDialog(true, dialogStore.app.epoch))) inputRef?.focus()
  }

  return (
    <Dialog
      id="appDialog"
      open={dialogStore.app.open}
      data-dialog-epoch={String(dialogStore.app.epoch)}
      title={<span id="appDialogTitle">{dialogStore.app.title || t("dialog.notice")}</span>}
      overlayClass="app-dialog-overlay"
      formClass="app-dialog-form"
      aria-describedby="appDialogBody"
      onOpenAutoFocus={(event) => {
        event.preventDefault()
        if (dialogStore.app.input && inputRef) {
          inputRef.focus()
          inputRef.select()
          return
        }
        if (dialogStore.app.select && selectRef) {
          selectRef.focus()
          return
        }
        okButtonRef?.focus()
      }}
      onClose={(dialog) => {
        void dismissAppDialog(dialog)
      }}
      footer={
        <>
          <Show when={dialogStore.app.link}>
            {(link) => (
              <Button
                type="button"
                id="btnAppDialogLink"
                data-ui="app-dialog-link"
                variant="outline"
                size="md"
                tone="accent"
                onClick={() => {
                  // Synchronous on purpose. The browser transport reaches
                  // window.open before its first await, so this call still
                  // holds the activation from this very click — which is the
                  // whole reason the dialog offers a button instead of the
                  // flow opening the URL by itself. Attaching .catch() does not
                  // change that: nativeOpen(url) is evaluated first.
                  void nativeOpen(link().url).catch((error) => {
                    setLinkError(error instanceof Error ? error.message : String(error))
                  })
                }}
              >
                {link().label}
              </Button>
            )}
          </Show>
          <Show when={dialogStore.app.cancel === true}>
            <Button
              type="button"
              id="btnAppDialogCancel"
              variant="ghost"
              size="md"
              tone="neutral"
              onClick={() => {
                void settleAppDialog(false, dialogStore.app.epoch)
              }}
            >
              {dialogStore.app.cancelLabel || t("common.cancel")}
            </Button>
          </Show>
          <Button
            type="button"
            id="btnAppDialogOk"
            variant="solid"
            size="md"
            tone={dialogStore.app.okTone || "accent"}
            ref={(el) => {
              okButtonRef = el
            }}
            onClick={() => {
              void confirm()
            }}
          >
            {dialogStore.app.okLabel || t("common.ok")}
          </Button>
        </>
      }
    >
      <div class="app-dialog-body" id="appDialogBody" data-kind={dialogStore.app.kind || undefined}>
        {dialogStore.app.message || ""}
      </div>
      <Show when={linkError()}>
        <p class="app-dialog-link-error" data-ui="app-dialog-link-error" role="alert">
          {linkError()}
        </p>
      </Show>
      <TextField.Root
        as="label"
        classList={{ hidden: dialogStore.app.input !== true }}
        id="appDialogInputField"
        invalid={Boolean(dialogStore.app.inputError)}
      >
        <TextField.Label id="appDialogInputLabel">
          {dialogStore.app.inputLabel || t("dialog.input")}
        </TextField.Label>
        <TextField.Input
          class="app-dialog-input"
          id="appDialogInput"
          type={dialogStore.app.inputType === "password" ? "password" : "text"}
          placeholder={dialogStore.app.inputPlaceholder || ""}
          value={dialogStore.app.inputValue || ""}
          ref={(el) => {
            inputRef = el
          }}
          onInput={(event) => {
            setDialogStore("app", "inputValue", event.currentTarget.value)
            if (dialogStore.app.inputError) setDialogStore("app", "inputError", "")
          }}
          onKeyDown={(event) => {
            if (event.isComposing) return
            if (event.key === "Enter") {
              event.preventDefault()
              void confirm()
            }
          }}
        />
        <Show when={dialogStore.app.inputError}>
          <TextField.ErrorMessage role="alert">{dialogStore.app.inputError}</TextField.ErrorMessage>
        </Show>
      </TextField.Root>
      <TextField.Root classList={{ hidden: dialogStore.app.select !== true }} id="appDialogSelectField">
        <TextField.Label id="appDialogSelectLabel">
          {dialogStore.app.selectLabel || t("dialog.input")}
        </TextField.Label>
        <SelectControl<AppDialogSelectOption>
          class="app-dialog-select"
          options={selectOptions()}
          value={selectedOption()}
          onChange={setSelectOption}
          optionValue="value"
          optionTextValue="label"
          disallowEmptySelection
          gutter={4}
          sameWidth
          triggerID="appDialogSelect"
          ariaLabelledBy="appDialogSelectLabel"
          triggerRef={(el) => {
            selectRef = el
          }}
          optionData={(option) => ({ "data-value": option.value })}
          renderValue={(option) => <span>{option?.label || option?.value || ""}</span>}
          renderOptionLabel={(option) => option.label || option.value}
        />
      </TextField.Root>
    </Dialog>
  )
}
