// ── App Dialog Service ──
// Store-backed imperative API for the shared app dialog host.
// Call `showAppDialog(options)` / `nativeMessage(message, opts)` from anywhere.

import { t } from "../utils/i18n"
import { dialogStore, setDialogStore } from "../store/dialog"
import { occludeNativeSurfaces, revealNativeSurfaces } from "./native-surface-occlusion"

export type AppDialogOptions = {
  title?: string
  message?: string
  kind?: string
  okLabel?: string
  okTone?: "accent" | "danger"
  cancelLabel?: string
  cancel?: boolean
  input?: boolean
  inputType?: "text" | "password"
  inputLabel?: string
  inputPlaceholder?: string
  inputValue?: string
  inputRequired?: boolean
  inputRequiredMessage?: string
  inputError?: string
  select?: boolean
  selectLabel?: string
  selectValue?: string
  selectOptions?: Array<{ value: string; label?: string }>
  /**
   * An external URL offered as a button in the dialog footer. The open happens
   * inside that click, which is the only way a browser will allow it — a flow
   * that opens after an await has already lost its user activation.
   */
  link?: { url: string; label: string }
}

export type AppDialogOpenOptions = AppDialogOptions & { openingGuard?: () => boolean }

export type AppDialogResult = { confirmed: boolean; value: string | null }

let appDialogSeq = 0
type AppDialogCompletion = {
  epoch: number
  occlusionOwner: string
  resolve: (value: AppDialogResult) => void
  reject: (reason: unknown) => void
}
let activeDialog: AppDialogCompletion | null = null

let appDialogTransitionTail = Promise.resolve()

function runAppDialogTransition<T>(operation: () => Promise<T>): Promise<T> {
  const previous = appDialogTransitionTail
  let release: () => void = () => undefined
  appDialogTransitionTail = new Promise<void>((resolve) => {
    release = resolve
  })
  return previous.then(operation).finally(release)
}

function dialogUsesChoiceValue(options: AppDialogOptions): boolean {
  return options.select === true
}

function validatedChoiceValue(options: AppDialogOptions): string {
  if (!dialogUsesChoiceValue(options)) return typeof options.selectValue === "string" ? options.selectValue : ""
  const selectOptions = Array.isArray(options.selectOptions) ? options.selectOptions : []
  if (selectOptions.length === 0) {
    throw new Error(`showAppDialog ${options.kind || "select"} requires non-empty selectOptions`)
  }
  for (const option of selectOptions) {
    if (typeof option?.value !== "string" || option.value.length === 0) {
      throw new Error(`showAppDialog ${options.kind || "select"} received an option without a value`)
    }
  }
  const selectValue = typeof options.selectValue === "string" ? options.selectValue : ""
  if (!selectValue) {
    throw new Error(`showAppDialog ${options.kind || "select"} requires selectValue`)
  }
  if (!selectOptions.some((option) => option.value === selectValue)) {
    throw new Error(
      `showAppDialog ${options.kind || "select"} selectValue ${JSON.stringify(selectValue)} is not in selectOptions`,
    )
  }
  return selectValue
}

function openingAllowed(options: AppDialogOpenOptions): boolean {
  try {
    return options.openingGuard?.() ?? true
  } catch {
    return false
  }
}

export function showAppDialog(options: AppDialogOpenOptions = {}): Promise<AppDialogResult> {
  const selectValue = validatedChoiceValue(options)
  const epoch = ++appDialogSeq
  const occlusionOwner = `app-dialog:${epoch}`
  return new Promise<AppDialogResult>((resolve, reject) => {
    void runAppDialogTransition(async () => {
      if (epoch !== appDialogSeq || !openingAllowed(options)) {
        resolve({ confirmed: false, value: null })
        return
      }
      await occludeNativeSurfaces(occlusionOwner)
      let committed = false
      try {
        if (epoch !== appDialogSeq || !openingAllowed(options)) {
          resolve({ confirmed: false, value: null })
          return
        }
        if (activeDialog) {
          const replaced = activeDialog
          activeDialog = null
          setDialogStore("app", "open", false)
          try {
            await revealNativeSurfaces(replaced.occlusionOwner)
          } catch (error) {
            replaced.reject(error)
            throw error
          }
          replaced.resolve({ confirmed: false, value: null })
        }
        if (epoch !== appDialogSeq || !openingAllowed(options)) {
          resolve({ confirmed: false, value: null })
          return
        }
        const completion = { epoch, occlusionOwner, resolve, reject }
        setDialogStore("app", {
          open: true,
          epoch,
          title: options.title || t("dialog.notice"),
          message: options.message || "",
          kind: options.kind || "",
          okLabel: options.okLabel || t("common.ok"),
          okTone: options.okTone || "accent",
          cancelLabel: options.cancelLabel || t("common.cancel"),
          cancel: options.cancel === true,
          input: options.input === true,
          inputType: options.inputType || "text",
          inputLabel: options.inputLabel || t("dialog.input"),
          inputPlaceholder: options.inputPlaceholder || "",
          inputValue: options.inputValue || "",
          inputRequired: options.inputRequired === true,
          inputRequiredMessage: options.inputRequiredMessage || t("dialog.input_required"),
          inputError: "",
          select: options.select === true,
          selectLabel: options.selectLabel || t("dialog.input"),
          selectValue,
          selectOptions: options.selectOptions || [],
          // Listed explicitly like every other field: this write is the whole
          // state, so an omitted key is simply never delivered. Passing
          // `undefined` also clears a previous dialog's action rather than
          // letting it linger.
          link: options.link,
        })
        activeDialog = completion
        committed = true
      } finally {
        if (!committed) await revealNativeSurfaces(occlusionOwner)
      }
    }).catch(reject)
  })
}

export async function nativeMessage(
  message: string,
  options: { title?: string; kind?: string; okLabel?: string; link?: AppDialogOptions["link"] } = {},
): Promise<AppDialogResult> {
  return showAppDialog({
    title: options.title,
    message,
    kind: options.kind,
    okLabel: options.okLabel,
    link: options.link,
  })
}

async function finishAppDialog(confirmed: boolean, epoch: number, dialog?: HTMLElement): Promise<boolean> {
  if (confirmed && dialogStore.app.input && dialogStore.app.inputRequired && !dialogStore.app.inputValue.trim()) {
    setDialogStore("app", "inputError", dialogStore.app.inputRequiredMessage || t("dialog.input_required"))
    return false
  }
  await runAppDialogTransition(async () => {
    const completion = activeDialog
    if (!completion || completion.epoch !== epoch || epoch !== dialogStore.app.epoch) return
    const inputValue =
      typeof document !== "undefined"
        ? (document.getElementById("appDialogInput") as HTMLInputElement | null)?.value
        : undefined
    const value = dialogStore.app.input
      ? (inputValue ?? dialogStore.app.inputValue ?? "")
      : dialogStore.app.select
        ? dialogStore.app.selectValue
        : null
    activeDialog = null
    setDialogStore("app", "open", false)
    try {
      await revealNativeSurfaces(completion.occlusionOwner)
    } catch (error) {
      completion.reject(error)
      return
    }
    completion.resolve({ confirmed, value })
  })
  void dialog
  return true
}

export function settleAppDialog(confirmed: boolean, epoch = dialogStore.app.epoch): Promise<boolean> {
  return finishAppDialog(confirmed, epoch)
}

export function dismissAppDialog(dialog?: HTMLElement): Promise<boolean> {
  const epoch = Number(dialog?.dataset.dialogEpoch || dialogStore.app.epoch)
  return finishAppDialog(false, epoch, dialog)
}
