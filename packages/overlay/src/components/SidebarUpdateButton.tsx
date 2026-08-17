import { createMemo } from "solid-js"

import {
  checkDesktopUpdate,
  desktopUpdateChecking,
  desktopUpdateDownloading,
  desktopUpdateError,
  desktopUpdateInfo,
  desktopUpdateSupported,
} from "../services/desktop-update"
import { openConfigDialog } from "../services/config-dialog-control"
import { t } from "../utils/i18n"
import { Button } from "./ui/Button"
import { Icon } from "./ui/Icon"

export function SidebarUpdateButton() {
  const busy = createMemo(() => desktopUpdateChecking() || desktopUpdateDownloading())
  const available = createMemo(() => Boolean(desktopUpdateInfo()?.available))
  const error = createMemo(() => desktopUpdateError())
  const title = createMemo(() => {
    if (!desktopUpdateSupported()) return t("about.update_desktop_only")
    if (error()) return `${t("sidebar.update")}: ${error()}`
    if (desktopUpdateDownloading()) return t("about.update_downloading")
    if (desktopUpdateChecking()) return t("about.update_checking")
    if (available()) return t("about.update_available", { version: desktopUpdateInfo()?.version || "" })
    if (desktopUpdateInfo()) return t("about.update_latest")
    return t("about.update_check")
  })
  const icon = createMemo(() => {
    if (busy()) return "loading" as const
    if (available()) return "download" as const
    return "refresh" as const
  })

  async function handleUpdateAction(): Promise<void> {
    if (busy()) return
    if (!desktopUpdateSupported()) {
      openConfigDialog("about")
      return
    }
    if (available() || error()) {
      openConfigDialog("about")
      return
    }
    await checkDesktopUpdate()
    if (desktopUpdateInfo()?.available || desktopUpdateError()) openConfigDialog("about")
  }

  return (
    <Button
      type="button"
      variant={available() ? "outline" : "ghost"}
      size="mini"
      tone={error() ? "danger" : available() ? "accent" : "neutral"}
      class="sidebar-update"
      data-ui="sidebar-update"
      data-busy={String(busy())}
      data-available={String(available())}
      disabled={busy()}
      title={title()}
      aria-label={title()}
      onClick={() => void handleUpdateAction()}
    >
      <span class="sidebar-update__icon" aria-hidden="true">
        <Icon name={icon()} />
      </span>
    </Button>
  )
}
