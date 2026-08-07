import { createSignal, onCleanup, onMount, Show } from "solid-js"
import { getHostTransport } from "../services/host-transport-runtime"
import { confirmOverlayWindowClose } from "../services/native-window-lifecycle"
import { formatErrorDetails, reportError } from "../services/diagnostics"
import { getTauriWindowHandle } from "../services/tauri-transport"
import { t } from "../utils/i18n"
import { Icon } from "./ui/Icon"
import { Button } from "./ui/Button"

function usesApplicationWindowControls(): boolean {
  return getHostTransport().kind === "tauri" && __OPENCORVUS_BUILD_PLATFORM__ !== "darwin"
}

function maximizeLabel(isMaximized: boolean): string {
  return isMaximized ? t("titlebar.restore") : t("titlebar.maximize")
}

function reportWindowControlError(owner: string, error: unknown): void {
  reportError({
    id: `window-control:${owner}`,
    title: t("common.error"),
    message: error instanceof Error ? error.message : String(error),
    details: formatErrorDetails(error),
  })
}

function runWindowControlAction(owner: string, action: () => void | Promise<void>): void {
  try {
    void Promise.resolve(action()).catch((error) => reportWindowControlError(owner, error))
  } catch (error) {
    reportWindowControlError(owner, error)
  }
}

/**
 * Frameless Windows/Linux builds own one application titlebar. macOS is
 * intentionally excluded because AppKit owns its traffic lights; the browser
 * host is excluded because it does not own a desktop window.
 */
export function WindowControls() {
  const [isMaximized, setIsMaximized] = createSignal(false)
  const [tauriWindow, setTauriWindow] = createSignal<any | null>(null)

  if (!usesApplicationWindowControls()) return null

  let disposed = false
  let cleanupResized: (() => void) | undefined
  let titlebar: HTMLElement | null = null

  const syncMaximized = async (windowHandle: any): Promise<void> => {
    const maximized = await windowHandle.isMaximized?.().catch(() => false)
    if (!disposed) setIsMaximized(Boolean(maximized))
  }

  const handleTitlebarPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || !(event.target instanceof Element)) return
    if (
      event.target.closest(
        '[data-no-drag="true"], button, input, textarea, select, a, label, summary, [contenteditable="true"]',
      )
    ) {
      return
    }
    event.preventDefault()
    const windowHandle = tauriWindow()
    if (windowHandle) runWindowControlAction("drag", () => windowHandle.startDragging?.())
  }

  onMount(() => {
    runWindowControlAction("init", async () => {
      const windowHandle = getTauriWindowHandle()
      if (!windowHandle || disposed) return
      setTauriWindow(windowHandle)
      await syncMaximized(windowHandle)

      if (typeof windowHandle.onResized === "function") {
        const unlisten = await windowHandle.onResized(() =>
          runWindowControlAction("resize-sync", () => syncMaximized(windowHandle)),
        )
        if (disposed) unlisten?.()
        else if (typeof unlisten === "function") cleanupResized = unlisten
      }

      titlebar = document.getElementById("titlebar")
      titlebar?.addEventListener("pointerdown", handleTitlebarPointerDown)
    })
  })

  onCleanup(() => {
    disposed = true
    cleanupResized?.()
    titlebar?.removeEventListener("pointerdown", handleTitlebarPointerDown)
  })

  const handleMaximize = async (): Promise<void> => {
    const windowHandle = tauriWindow()
    if (!windowHandle) return
    await windowHandle.toggleMaximize?.()
    await syncMaximized(windowHandle)
  }

  return (
    <Show when={tauriWindow()}>
      <div class="titlebar-utility" data-no-drag="true">
        <div class="titlebar-actions">
          <div id="solidWindowControls" class="titlebar-window-controls">
            <Button
              type="button"
              id="btnMinimize"
              variant="ghost"
              size="icon"
              tone="neutral"
              data-chrome="window-control"
              title={t("titlebar.minimize")}
              aria-label={t("titlebar.minimize")}
              onClick={() => runWindowControlAction("minimize", () => tauriWindow()?.minimize?.())}
            >
              <Icon name="minimize" />
            </Button>
            <Button
              type="button"
              id="btnMaximize"
              variant="ghost"
              size="icon"
              tone="neutral"
              data-chrome="window-control"
              data-maximized={isMaximized() ? "true" : "false"}
              title={maximizeLabel(isMaximized())}
              aria-label={maximizeLabel(isMaximized())}
              onClick={() => runWindowControlAction("maximize", handleMaximize)}
            >
              <Icon name={isMaximized() ? "restore" : "maximize"} />
            </Button>
            <Button
              type="button"
              id="btnClose"
              variant="ghost"
              size="icon"
              tone="danger"
              data-chrome="window-control"
              title={t("titlebar.close")}
              aria-label={t("titlebar.close")}
              onClick={() => runWindowControlAction("close", confirmOverlayWindowClose)}
            >
              <Icon name="close" />
            </Button>
          </div>
        </div>
      </div>
    </Show>
  )
}
