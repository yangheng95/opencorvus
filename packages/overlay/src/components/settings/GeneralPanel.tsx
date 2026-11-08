import { Feedback } from "../ui/Feedback"
import { createMemo, createSignal, For, onCleanup, Show } from "solid-js"
import { t } from "../../utils/i18n"
import { settingsStore, setSettingsStore, saveSettings } from "../../store/settings"
import { ensureDesktopNotificationPermission } from "../../services/desktop-notifications"
import { downloadLogSupportBundle } from "../../services/log-export"
import { appStore } from "../../store/app"
import { Button } from "../ui/Button"
import { Switch } from "../ui/Switch"
import { PermissionsSettingsGroup } from "./PermissionsPanel"
import { SettingsGroup, SettingsPanel, SettingsRow } from "./layout"
import { inSecureContext } from "../../utils/secure-context"
import { formatErrorDetails } from "../../utils/error-details"

type LogExportNotice = { status: "complete" } | { status: "failed"; error: unknown }

let desktopNotificationAction = 0
let persistedDesktopNotificationError = ""
const desktopNotificationErrorSubscribers = new Set<(value: string) => void>()

export default function GeneralPanel() {
  const [desktopNotificationError, setDesktopNotificationError] = createSignal(persistedDesktopNotificationError)
  const [logExporting, setLogExporting] = createSignal(false)
  const [gitPreferenceError, setGitPreferenceError] = createSignal("")
  const [logExportNotice, setLogExportNotice] = createSignal<LogExportNotice | null>(null)
  const logExportFeedback = createMemo(() => {
    const notice = logExportNotice()
    if (!notice) return undefined
    return notice.status === "complete"
      ? { tone: "success" as const, message: t("settings.log_export_complete"), details: undefined }
      : {
          tone: "error" as const,
          message: t("settings.log_export_failed", { error: describeError(notice.error) }),
          details: formatErrorDetails(notice.error),
        }
  })
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
    if (logExporting() || !appStore.connected) return
    setLogExporting(true)
    setLogExportNotice(null)
    try {
      await downloadLogSupportBundle()
      setLogExportNotice({ status: "complete" })
    } catch (exportError) {
      setLogExportNotice({ status: "failed", error: exportError })
    } finally {
      setLogExporting(false)
    }
  }

  return (
    <SettingsPanel class="general-panel">
      <For each={appStore.configLoadIssues.filter((issue) => issue.resource === "config")}>
        {(issue) => <Feedback tone="error">{issue.message}</Feedback>}
      </For>
      <For each={appStore.projectLoadIssues.filter((issue) => issue.resource !== "config")}>
        {(issue) => (
          <Feedback tone="error">
            {issue.resource}: {issue.message}
          </Feedback>
        )}
      </For>
      <Show when={!inSecureContext()}>
        <Feedback>{t("settings.insecure_context")}</Feedback>
      </Show>
      <PermissionsSettingsGroup />

      <SettingsGroup title={t("settings.title")}>
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
          <Feedback tone="error" data-ui="settings-desktop-notification-status">
            {desktopNotificationError()}
          </Feedback>
        ) : null}
        <SettingsRow
          title={<label for="settings-offer-git-init">{t("settings.offer_git_init")}</label>}
          desc={t("settings.offer_git_init_hint")}
          align="center"
          interactive
          actions={
            <Switch
              inputID="settings-offer-git-init"
              checked={settingsStore.initGit}
              onChange={async (enabled) => {
                setSettingsStore("initGit", enabled)
                setGitPreferenceError("")
                try {
                  await saveSettings({
                    overrides: { initGit: enabled },
                    onFailure({ error, confirmed }) {
                      setSettingsStore("initGit", confirmed.initGit)
                      setGitPreferenceError(t("settings.save_failed", { error: describeError(error) }))
                    },
                  })
                } catch {
                  /* The settings owner has reported the exact failure. */
                }
              }}
            />
          }
        />
        <Show when={gitPreferenceError()}>
          <Feedback tone="error">{gitPreferenceError()}</Feedback>
        </Show>
        <SettingsRow
          title={t("settings.log_export_label")}
          desc={t("settings.log_export_hint")}
          align="center"
          interactive
          actions={
            <Button
              type="button"
              variant="outline"
              size="md"
              tone="neutral"
              data-ui="settings-log-export"
              disabled={!appStore.connected}
              aria-disabled={logExporting() || undefined}
              aria-busy={logExporting() || undefined}
              onClick={handleLogExport}
            >
              {logExporting() ? t("settings.log_export_running") : t("settings.log_export_button")}
            </Button>
          }
        />
        <Show when={logExportFeedback()}>{(feedback) => (
          <Feedback
            tone={feedback().tone}
            details={feedback().details}
            data-ui="settings-log-export-status"
          >
            {feedback().message}
          </Feedback>
        )}</Show>
      </SettingsGroup>
    </SettingsPanel>
  )
}
