import { createSignal, For, onCleanup, Show } from "solid-js"
import { t } from "../../utils/i18n"
import { settingsStore, setSettingsStore, saveSettings } from "../../store/settings"
import { ensureDesktopNotificationPermission } from "../../services/desktop-notifications"
import { downloadLogSupportBundle } from "../../services/log-export"
import { appStore } from "../../store/app"
import { Button } from "../ui/Button"
import { Switch } from "../ui/Switch"
import { PermissionsSettingsGroup } from "./PermissionsPanel"
import { SettingsGroup, SettingsPanel, SettingsRow, SettingsState } from "./layout"
import { inSecureContext } from "../../utils/secure-context"

let desktopNotificationAction = 0
let persistedDesktopNotificationError = ""
const desktopNotificationErrorSubscribers = new Set<(value: string) => void>()

export default function GeneralPanel() {
  const [desktopNotificationError, setDesktopNotificationError] = createSignal(persistedDesktopNotificationError)
  const [logExporting, setLogExporting] = createSignal(false)
  const [logExportNotice, setLogExportNotice] = createSignal("")
  const [logExportNoticeStatus, setLogExportNoticeStatus] = createSignal<"active" | "error">("active")
  const receiveDesktopNotificationError = (value: string) => setDesktopNotificationError(value)
  desktopNotificationErrorSubscribers.add(receiveDesktopNotificationError)
  onCleanup(() => desktopNotificationErrorSubscribers.delete(receiveDesktopNotificationError))

  // ── Handlers ──

  function describeError(e: unknown): string {
    return e instanceof Error ? e.message : String(e)
  }

  function writeDesktopNotificationError(value: string): void {
    persistedDesktopNotificationError = value
    for (const subscriber of desktopNotificationErrorSubscribers) subscriber(value)
  }

  async function handleDesktopNotificationsChange(enabled: boolean) {
    const action = ++desktopNotificationAction
    const ownsAction = () => desktopNotificationAction === action && settingsStore.desktopNotifications === enabled
    setSettingsStore("desktopNotifications", enabled)
    try {
      await saveSettings({
        overrides: { desktopNotifications: enabled },
        onFailure({ error, confirmed }) {
          if (!ownsAction()) return
          setSettingsStore("desktopNotifications", confirmed.desktopNotifications)
          writeDesktopNotificationError(t("settings.save_failed", { error: describeError(error) }))
        },
      })
    } catch {
      return
    }
    if (!ownsAction()) return
    writeDesktopNotificationError("")
    if (!enabled) return
    try {
      const permission = await ensureDesktopNotificationPermission()
      if (!ownsAction() || permission === "granted") return
      writeDesktopNotificationError(t("settings.desktop_notifications_permission_unavailable", { permission }))
    } catch (permissionError) {
      if (!ownsAction()) return
      writeDesktopNotificationError(describeError(permissionError))
    }
  }

  async function handleLogExport() {
    setLogExporting(true)
    setLogExportNotice("")
    try {
      await downloadLogSupportBundle()
      setLogExportNoticeStatus("active")
      setLogExportNotice(t("settings.log_export_complete"))
    } catch (exportError) {
      setLogExportNoticeStatus("error")
      setLogExportNotice(t("settings.log_export_failed", { error: describeError(exportError) }))
    } finally {
      setLogExporting(false)
    }
  }

  return (
    <SettingsPanel class="general-panel">
      <For each={appStore.configLoadIssues.filter((issue) => issue.resource === "config")}>
        {(issue) => <SettingsState tone="error">{issue.message}</SettingsState>}
      </For>
      <For each={appStore.projectLoadIssues.filter((issue) => issue.resource !== "config")}>
        {(issue) => (
          <SettingsState tone="error">
            {issue.resource}: {issue.message}
          </SettingsState>
        )}
      </For>
      <Show when={!inSecureContext()}>
        <SettingsState>{t("settings.insecure_context")}</SettingsState>
      </Show>

      <PermissionsSettingsGroup />

      <SettingsGroup title={t("settings.section.notifications")}>
        <SettingsRow
          title={<label for="settings-desktop-notifications">{t("settings.desktop_notifications_label")}</label>}
          desc={t("settings.desktop_notifications_hint")}
          align="center"
          interactive
          actions={
            <Switch
              inputID="settings-desktop-notifications"
              data-ui="settings-desktop-notifications"
              checked={settingsStore.desktopNotifications}
              onChange={handleDesktopNotificationsChange}
            />
          }
        />
        {desktopNotificationError() ? (
          <SettingsState tone="error" data-ui="settings-desktop-notification-status">
            {desktopNotificationError()}
          </SettingsState>
        ) : null}
      </SettingsGroup>

      <SettingsGroup title={t("settings.section.diagnostics")}>
        <SettingsRow
          title={t("settings.log_export_label")}
          desc={t("settings.log_export_hint")}
          align="center"
          interactive
          actions={
            <Button
              type="button"
              variant="solid"
              size="md"
              tone="accent"
              data-ui="settings-log-export"
              disabled={logExporting() || !appStore.connected}
              onClick={handleLogExport}
            >
              {logExporting() ? t("settings.log_export_running") : t("settings.log_export_button")}
            </Button>
          }
        />
        {logExportNotice() ? (
          <SettingsState
            tone={logExportNoticeStatus() === "error" ? "error" : "success"}
            data-ui="settings-log-export-status"
          >
            {logExportNotice()}
          </SettingsState>
        ) : null}
      </SettingsGroup>
    </SettingsPanel>
  )
}
