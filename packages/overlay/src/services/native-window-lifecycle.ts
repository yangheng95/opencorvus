import { formatErrorDetails, reportError } from "./diagnostics"
import { getTauriWindowHandle } from "./tauri-transport"
import { quitOverlay } from "./window"
import { nativeConfirm } from "../utils/native"
import { t } from "../utils/i18n"

interface NativeCloseRequestEvent {
  preventDefault(): void
}

interface NativeWindowCloseHandle {
  onCloseRequested(handler: (event: NativeCloseRequestEvent) => void): Promise<() => void>
}

function reportNativeCloseError(error: unknown): void {
  reportError({
    id: "native-window:close",
    title: t("common.error"),
    message: error instanceof Error ? error.message : String(error),
    details: formatErrorDetails(error),
  })
}

export async function confirmOverlayWindowClose(): Promise<void> {
  const confirmed = await nativeConfirm(t("titlebar.close_confirm_message"), {
    title: t("titlebar.close_confirm_title"),
    okLabel: t("titlebar.close_confirm_quit"),
    cancelLabel: t("common.cancel"),
    kind: "warning",
  })
  if (confirmed) await quitOverlay()
}

function observeNativeWindowClose(): void {
  void confirmOverlayWindowClose().catch(reportNativeCloseError)
}

/**
 * Route operating-system close requests (including Alt+F4 on a frameless
 * Windows/Linux window) through the same confirmation and canonical backend
 * cleanup command used by application-owned window chrome. Browser and VS
 * Code hosts have no Tauri window handle.
 */
export async function installNativeWindowCloseLifecycle(): Promise<(() => void) | undefined> {
  const windowHandle = getTauriWindowHandle() as NativeWindowCloseHandle | null
  if (typeof windowHandle?.onCloseRequested !== "function") return undefined
  return windowHandle.onCloseRequested((event) => {
    event.preventDefault()
    observeNativeWindowClose()
  })
}
