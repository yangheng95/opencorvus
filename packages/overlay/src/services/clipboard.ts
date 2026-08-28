// ── copyText ──
// One clipboard writer for the whole overlay.
//
// `clipboard.writeText` is a declared host capability: the desktop host writes
// through Tauri, the browser host through `navigator.clipboard`. Going through
// the transport means both hosts get their own correct implementation, and the
// one place that knows why a write is impossible — an insecure origin, where
// `navigator.clipboard` does not exist — is the one place that says so.
//
// Components do not touch `navigator.clipboard` directly. Eight of them once
// did, and between them produced four different explanations for one condition
// plus two that silently did nothing at all.

import { t } from "../utils/i18n"
import { formatErrorDetails, reportError } from "./diagnostics"
import { getHostTransport } from "./host-transport-runtime"

/** Write `text` to the system clipboard, or throw explaining why not. */
export async function copyText(text: string): Promise<void> {
  await getHostTransport().native({ kind: "clipboard.writeText", text })
}

/**
 * Copy `text`, surfacing any failure to the operator.
 *
 * For controls whose only affordance is the click itself: a bare `onClick`
 * handler has nowhere to put a rejection, so without this the copy fails as
 * an unhandled promise and the button appears to do nothing.
 */
export async function copyTextReporting(text: string, id: string): Promise<void> {
  try {
    await copyText(text)
  } catch (error) {
    reportError({
      id: `clipboard:${id}`,
      title: t("common.error"),
      message: error instanceof Error ? error.message : String(error),
      details: formatErrorDetails(error),
    })
  }
}
