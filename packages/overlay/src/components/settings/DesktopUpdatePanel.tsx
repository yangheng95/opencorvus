import { Show, createMemo, onMount } from "solid-js"
import { Button } from "../ui/Button"
import { showAppDialog } from "../../services/app-dialog"
import {
  checkDesktopUpdate,
  desktopUpdateChecking,
  desktopUpdateDownloading,
  desktopUpdateError,
  desktopUpdateInfo,
  desktopUpdateProgress,
  desktopUpdateSupported,
  downloadDesktopUpdate,
  installDesktopUpdate,
} from "../../services/desktop-update"
import { t } from "../../utils/i18n"
import { OVERLAY_VERSION } from "../../utils/version"
import { SettingsGroup, SettingsRow, SettingsState, SettingsSurface } from "./layout"

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
}

export default function DesktopUpdatePanel() {
  const readyToInstall = createMemo(() => desktopUpdateInfo()?.downloadedBytes !== undefined)
  const progressDescription = createMemo(() => {
    const progress = desktopUpdateProgress()
    if (!progress) return t("about.update_downloading")
    const downloaded = formatBytes(progress.downloadedBytes)
    return progress.totalBytes === undefined
      ? t("about.update_progress_unknown", { downloaded })
      : t("about.update_progress", { downloaded, total: formatBytes(progress.totalBytes) })
  })

  onMount(() => {
    if (desktopUpdateSupported() && desktopUpdateInfo() === null) void checkDesktopUpdate()
  })

  const confirmInstall = async () => {
    const version = desktopUpdateInfo()?.version
    if (!version) return
    const result = await showAppDialog({
      title: t("about.update_install_title"),
      message: t("about.update_install_message", { version }),
      okLabel: t("about.update_restart"),
      cancel: true,
    })
    if (result.confirmed) await installDesktopUpdate()
  }

  return (
    <SettingsGroup title={t("about.update_title")} description={t("about.update_description")}>
      <Show when={desktopUpdateSupported()} fallback={<SettingsState>{t("about.update_desktop_only")}</SettingsState>}>
        <SettingsSurface>
          <SettingsRow
            align="center"
            title={t("about.update_current_version")}
            actions={
              <Button
                variant="outline"
                size="sm"
                tone="neutral"
                disabled={desktopUpdateChecking() || desktopUpdateDownloading()}
                onClick={() => void checkDesktopUpdate()}
              >
                {desktopUpdateChecking() ? t("about.update_checking") : t("about.update_check")}
              </Button>
            }
          >
            {desktopUpdateInfo()?.currentVersion || OVERLAY_VERSION}
          </SettingsRow>
        </SettingsSurface>

        <Show when={desktopUpdateError()}>{(message) => <SettingsState tone="error">{message()}</SettingsState>}</Show>

        <Show when={desktopUpdateDownloading()}>
          <SettingsState tone="info" title={t("about.update_downloading")}>
            {progressDescription()}
          </SettingsState>
        </Show>

        <Show when={!desktopUpdateChecking() && !desktopUpdateDownloading() && desktopUpdateInfo()}>
          {(info) => (
            <Show
              when={info().available}
              fallback={<SettingsState tone="success">{t("about.update_latest")}</SettingsState>}
            >
              <SettingsState
                tone="info"
                title={t("about.update_available", { version: info().version || "" })}
                actions={
                  readyToInstall() ? (
                    <Button variant="solid" size="sm" tone="accent" onClick={() => void confirmInstall()}>
                      {t("about.update_restart")}
                    </Button>
                  ) : (
                    <Button variant="solid" size="sm" tone="accent" onClick={() => void downloadDesktopUpdate()}>
                      {t("about.update_download")}
                    </Button>
                  )
                }
              >
                {readyToInstall()
                  ? t("about.update_ready", { size: formatBytes(info().downloadedBytes || 0) })
                  : info().notes || t("about.update_available_description")}
              </SettingsState>
            </Show>
          )}
        </Show>
      </Show>
    </SettingsGroup>
  )
}
