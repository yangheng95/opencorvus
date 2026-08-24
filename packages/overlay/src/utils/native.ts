// ── Native / Platform Utilities ──
// Exported functions:
// nativeConfirm — show a confirm dialog (ok/cancel)
// nativePrompt — show a text-input dialog
// nativeSelect — show a select-option dialog
// nativeOpen — open a URL or filesystem path via the Tauri plugin

import { showAppDialog } from "../services/app-dialog"

// ── nativeConfirm ──
// Shows a confirm dialog and returns true when the user clicked OK.

export async function nativeConfirm(
  message: string,
  options?: {
    title?: string
    kind?: string
    okLabel?: string
    cancelLabel?: string
    okTone?: "accent" | "danger"
  },
): Promise<boolean> {
  const result = await showAppDialog({
    title: options?.title,
    message,
    kind: options?.kind || "warning",
    okLabel: options?.okLabel,
    cancelLabel: options?.cancelLabel,
    okTone: options?.okTone,
    cancel: true,
  })
  return !!result?.confirmed
}

// ── nativePrompt ──
// Shows a text-input dialog and returns the entered value, or null if cancelled.

export async function nativePrompt(
  message: string,
  options?: {
    title?: string
    kind?: string
    okLabel?: string
    cancelLabel?: string
    inputLabel?: string
    inputPlaceholder?: string
    inputValue?: string
    inputType?: "text" | "password"
    inputRequired?: boolean
    inputRequiredMessage?: string
  },
): Promise<string | null> {
  const result = await showAppDialog({
    title: options?.title,
    message,
    kind: options?.kind || "info",
    okLabel: options?.okLabel,
    cancelLabel: options?.cancelLabel,
    cancel: true,
    input: true,
    inputType: options?.inputType || "text",
    inputLabel: options?.inputLabel,
    inputPlaceholder: options?.inputPlaceholder || "",
    inputValue: options?.inputValue || "",
    inputRequired: options?.inputRequired === true,
    inputRequiredMessage: options?.inputRequiredMessage,
  })
  return result?.confirmed ? (result.value ?? null) : null
}

// ── nativeSelect ──
// Shows a select-option dialog and returns the chosen value, or null if cancelled.

export interface SelectOption {
  value: string
  label?: string
}

export async function nativeSelect(
  message: string,
  options?: {
    title?: string
    kind?: string
    okLabel?: string
    cancelLabel?: string
    selectLabel?: string
    selectValue: string
    options?: SelectOption[]
  },
): Promise<string | null> {
  const list = Array.isArray(options?.options) ? options!.options : []
  if (!list.length) return null
  const selectValue = typeof options?.selectValue === "string" ? options.selectValue : ""
  if (!selectValue) {
    throw new Error("nativeSelect requires selectValue when options are provided")
  }
  if (!list.some((item) => item.value === selectValue)) {
    throw new Error(`nativeSelect selectValue ${JSON.stringify(selectValue)} is not in options`)
  }
  const result = await showAppDialog({
    title: options?.title,
    message,
    kind: options?.kind || "info",
    okLabel: options?.okLabel,
    cancelLabel: options?.cancelLabel,
    cancel: true,
    select: true,
    selectLabel: options?.selectLabel,
    selectOptions: list,
    selectValue,
  })
  return result?.confirmed ? (result.value ?? null) : null
}

// ── nativeOpen ──
// Open a URL or filesystem path via the host. Routes through
// HostTransport.native so the same call works under Tauri (invokes
// overlay_open_url / overlay_open_path) and, in the future, under VS
// Code (vscode.env.openExternal). Throws UnsupportedNativeCommandError
// in hosts that don't implement the command. It never substitutes one command
// for another, and never opens anything itself; each host's transport carries
// out the command it declares.

import { getHostTransport } from "../services/host-transport-runtime"

export async function nativeOpen(target: string): Promise<boolean> {
  if (!target) return false
  const isUrl = /^https?:\/\//i.test(target)
  const opened = await getHostTransport().native(
    isUrl ? { kind: "open-url", url: target } : { kind: "open-path", path: target },
  )
  return opened === true
}
