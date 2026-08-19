import { Show, createMemo } from "solid-js"

import {
  confirmAndInstallDesktopUpdate,
  desktopUpdateDownloading,
  desktopUpdateError,
  desktopUpdateInfo,
  desktopUpdateProgressLabel,
  desktopUpdateSupported,
  downloadDesktopUpdate,
  formatDesktopUpdateBytes,
} from "../services/desktop-update"
import { t } from "../utils/i18n"
import { Button } from "./ui/Button"
import { Icon } from "./ui/Icon"

export function SidebarUpdateButton() {
  const available = createMemo(() => Boolean(desktopUpdateInfo()?.available))
  const readyToInstall = createMemo(() => desktopUpdateInfo()?.downloadedBytes !== undefined)
  const busy = createMemo(() => desktopUpdateDownloading())
  const error = createMemo(() => desktopUpdateError())

  // The footer only carries this control when there is something to install.
  // A running check is invisible: an idle installation has no update work to
  // offer, so it must not spin an icon at the operator.
  const visible = createMemo(() => desktopUpdateSupported() && available())

  const version = createMemo(() => desktopUpdateInfo()?.version || "")
  const title = createMemo(() => {
    if (error()) return `${t("sidebar.update")}: ${error()}`
    if (busy()) return desktopUpdateProgressLabel()
    const headline = t("about.update_available", { version: version() })
    if (readyToInstall()) {
      const size = formatDesktopUpdateBytes(desktopUpdateInfo()?.downloadedBytes || 0)
      return `${headline} · ${t("about.update_ready", { size })}`
    }
    return `${headline} · ${t("about.update_download")}`
  })
  const icon = createMemo(() => {
    if (busy()) return "loading" as const
    if (readyToInstall()) return "check" as const
    return "download" as const
  })

  // One click carries the update all the way home: download the verified
  // package, then confirm the restart that installs it. No settings detour.
  async function handleUpdateAction(): Promise<void> {
    if (busy()) return
    if (!readyToInstall()) {
      await downloadDesktopUpdate()
      if (desktopUpdateError() || !readyToInstall()) return
    }
    await confirmAndInstallDesktopUpdate()
  }

  return (
    <Show when={visible()}>
      <Button
        type="button"
        variant="outline"
        size="mini"
        tone={error() ? "danger" : "accent"}
        class="sidebar-update"
        data-ui="sidebar-update"
        data-busy={String(busy())}
        disabled={busy()}
        title={title()}
        aria-label={title()}
        onClick={() => void handleUpdateAction()}
      >
        <span class="sidebar-update__icon" aria-hidden="true">
          <Icon name={icon()} />
        </span>
      </Button>
    </Show>
  )
}
