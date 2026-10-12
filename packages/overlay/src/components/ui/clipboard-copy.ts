import { createEffect, createMemo, createSignal, on, onCleanup, type Accessor } from "solid-js"
import { copyText } from "../../services/clipboard"
import { formatErrorDetails, reportError } from "../../services/diagnostics"
import { t } from "../../utils/i18n"

type CopyState =
  | { kind: "idle" | "pending" | "copied" }
  | { kind: "error"; message: string; details: string }

/** Feedback belongs to the current value and mounted control; the host remains
 * the sole clipboard writer. A retired action cannot update its replacement. */
export function createClipboardCopy(input: {
  text: Accessor<string>
  label: Accessor<string>
  diagnosticID: string
}) {
  const currentText = createMemo(input.text)
  const [state, setState] = createSignal<CopyState>({ kind: "idle" })
  let generation = 0
  let disposed = false
  let reset: ReturnType<typeof setTimeout> | undefined
  const clearReset = () => {
    if (reset !== undefined) clearTimeout(reset)
    reset = undefined
  }
  createEffect(on(currentText, () => {
    generation++
    clearReset()
    setState({ kind: "idle" })
  }, { defer: true }))
  onCleanup(() => {
    disposed = true
    generation++
    clearReset()
  })
  const copy = async () => {
    if (state().kind === "pending") return
    const text = currentText()
    const owner = ++generation
    const current = () => !disposed && generation === owner && currentText() === text
    clearReset()
    setState({ kind: "pending" })
    try {
      await copyText(text)
      if (!current()) return
      setState({ kind: "copied" })
      reset = setTimeout(() => {
        reset = undefined
        if (current()) setState({ kind: "idle" })
      }, 2000)
    } catch (error) {
      if (!current()) return
      const message = error instanceof Error ? error.message : String(error)
      const details = formatErrorDetails(error)
      setState({ kind: "error", message, details })
      reportError({ id: `clipboard:${input.diagnosticID}`, title: t("clipboard.copy_failed"), message, details })
    }
  }
  return {
    copy,
    pending: () => state().kind === "pending",
    copied: () => state().kind === "copied",
    label: () => state().kind === "copied" ? t("clipboard.copy_confirmed", { action: input.label() }) : input.label(),
    failure: () => {
      const value = state()
      return value.kind === "error" ? value : undefined
    },
  }
}
