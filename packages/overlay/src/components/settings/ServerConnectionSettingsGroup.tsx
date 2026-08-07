import { createSignal, onCleanup } from "solid-js"
import { configure as configureApi } from "../../services/api"
import { checkConnection } from "../../services/connection"
import { reloadProjectScope } from "../../services/config"
import { settingsStore, setSettingsStore, saveSettings } from "../../store/settings"
import { t } from "../../utils/i18n"
import { Button } from "../ui/Button"
import { SettingsGroup, SettingsRow, SettingsState } from "./layout"
import { TextField } from "../ui/TextField"

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function ServerConnectionSettingsGroup() {
  const [saved, setSaved] = createSignal(false)
  const [error, setError] = createSignal("")
  const [saving, setSaving] = createSignal(false)
  let saveGeneration = 0
  let savedTimer: ReturnType<typeof setTimeout> | undefined

  const clearFeedback = () => {
    saveGeneration += 1
    if (savedTimer) clearTimeout(savedTimer)
    savedTimer = undefined
    setSaved(false)
    setError("")
  }

  async function saveConnection(): Promise<void> {
    if (saving()) return
    const snapshot = {
      serverUrl: settingsStore.serverUrl,
      username: settingsStore.username,
      password: settingsStore.password,
    }
    const generation = ++saveGeneration
    const ownsSave = () => saveGeneration === generation
    setSaving(true)
    setSaved(false)
    setError("")
    configureApi(snapshot)
    try {
      await saveSettings({ overrides: snapshot })
      if (!ownsSave()) return
      await checkConnection()
      if (!ownsSave()) return
      await reloadProjectScope()
      if (!ownsSave()) return
      setError("")
      setSaved(true)
      savedTimer = setTimeout(() => {
        if (ownsSave()) setSaved(false)
        savedTimer = undefined
      }, 1800)
    } catch (nextError) {
      if (!ownsSave()) return
      setSaved(false)
      setError(t("settings.save_failed", { error: errorMessage(nextError) }))
    } finally {
      if (ownsSave()) setSaving(false)
    }
  }

  onCleanup(() => {
    saveGeneration += 1
    if (savedTimer) clearTimeout(savedTimer)
  })

  return (
    <SettingsGroup title={t("settings.section.connection")} data-ui="settings-server-connection-group">
      <SettingsRow>
        <TextField.Root as="label">
          <TextField.Label>{t("settings.server_url")}</TextField.Label>
          <TextField.Input
            type="url"
            value={settingsStore.serverUrl}
            placeholder="http://127.0.0.1:7878"
            disabled={saving()}
            onInput={(event) => {
              clearFeedback()
              setSettingsStore("serverUrl", event.currentTarget.value.trim())
            }}
          />
        </TextField.Root>
      </SettingsRow>
      <SettingsRow>
        <TextField.Root as="label">
          <TextField.Label>{t("settings.username")}</TextField.Label>
          <TextField.Input
            type="text"
            value={settingsStore.username}
            disabled={saving()}
            onInput={(event) => {
              clearFeedback()
              setSettingsStore("username", event.currentTarget.value.trim())
            }}
          />
        </TextField.Root>
      </SettingsRow>
      <SettingsRow>
        <TextField.Root as="label">
          <TextField.Label>{t("settings.password")}</TextField.Label>
          <TextField.Input
            type="password"
            value={settingsStore.password}
            disabled={saving()}
            onInput={(event) => {
              clearFeedback()
              setSettingsStore("password", event.currentTarget.value)
            }}
          />
        </TextField.Root>
      </SettingsRow>
      <SettingsRow
        align="center"
        actions={
          <Button
            type="button"
            variant="solid"
            size="md"
            tone="accent"
            data-ui="settings-server-save"
            onClick={() => void saveConnection()}
            disabled={saving()}
          >
            {saving() ? t("common.saving") : saved() ? t("common.saved") : t("common.save")}
          </Button>
        }
      />
      {error() ? (
        <SettingsState tone="error" data-ui="settings-server-status">
          {error()}
        </SettingsState>
      ) : null}
    </SettingsGroup>
  )
}
