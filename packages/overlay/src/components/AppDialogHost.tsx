import { Show } from "solid-js"
import { dialogStore, setDialogStore } from "../store/dialog"
import { dismissAppDialog, settleAppDialog } from "../services/app-dialog"
import { t } from "../utils/i18n"
import { Dialog } from "./ui/Dialog"
import { Button } from "./ui/Button"
import { TextField } from "./ui/TextField"
import { SelectControl } from "./ui/SelectControl"

type AppDialogSelectOption = { value: string; label?: string }

export function AppDialogHost() {
  let okButtonRef: HTMLButtonElement | undefined
  let inputRef: HTMLInputElement | undefined
  let selectRef: HTMLButtonElement | undefined

  const selectOptions = () => (dialogStore.app.selectOptions || []) as AppDialogSelectOption[]
  const selectedOption = () => selectOptions().find((item) => item.value === dialogStore.app.selectValue) ?? null
  const setSelectOption = (option: AppDialogSelectOption | null) => {
    if (!option) return
    setDialogStore("app", "selectValue", option.value)
  }

  return (
    <Dialog
      id="appDialog"
      open={dialogStore.app.open}
      data-dialog-epoch={String(dialogStore.app.epoch)}
      title={<span id="appDialogTitle">{dialogStore.app.title || t("dialog.notice")}</span>}
      overlayClass="app-dialog-overlay"
      formClass="app-dialog-form"
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
            tone="accent"
            ref={(el) => {
              okButtonRef = el
            }}
            onClick={() => {
              void settleAppDialog(true, dialogStore.app.epoch)
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
      <TextField.Root
        as="label"
        classList={{ hidden: dialogStore.app.input !== true }}
        id="appDialogInputField"
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
          }}
          onKeyDown={(event) => {
            if (event.isComposing) return
            if (event.key === "Enter") {
              event.preventDefault()
              void settleAppDialog(true, dialogStore.app.epoch)
            }
          }}
        />
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
