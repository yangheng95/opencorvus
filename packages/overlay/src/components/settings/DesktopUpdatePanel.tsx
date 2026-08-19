import { Show, createMemo, onMount } from "solid-js"
import { Button } from "../ui/Button"
import {
  checkDesktopUpdate,
  confirmAndInstallDesktopUpdate,
  desktopUpdateChecking,
  desktopUpdateDownloading,
  desktopUpdateError,
  desktopUpdateInfo,
  desktopUpdateProgressLabel,
  desktopUpdateSupported,
  downloadDesktopUpdate,
  formatDesktopUpdateBytes,
} from "../../services/desktop-update"
import { t } from "../../utils/i18n"
import { OVERLAY_VERSION } from "../../utils/version"
import { SettingsGroup, SettingsRow, SettingsState, SettingsSurface } from "./layout"

export default function DesktopUpdatePanel() {
  const readyToInstall = createMemo(() => desktopUpdateInfo()?.downloadedBytes !== undefined)
  const progressDescription = createMemo(() => desktopUpdateProgressLabel())

  onMount(() => {
    if (desktopUpdateSupported() && desktopUpdateInfo() === null) void checkDesktopUpdate()
  })

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
                    <Button
                      variant="solid"
                      size="sm"
                      tone="accent"
                      onClick={() => void confirmAndInstallDesktopUpdate()}
                    >
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
                  ? t("about.update_ready", { size: formatDesktopUpdateBytes(info().downloadedBytes || 0) })
                  : info().notes || t("about.update_available_description")}
              </SettingsState>
            </Show>
          )}
        </Show>
      </Show>
    </SettingsGroup>
  )
}
