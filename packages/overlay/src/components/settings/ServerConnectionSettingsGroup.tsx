import { Feedback } from "../ui/Feedback"
import { createSignal, onCleanup } from "solid-js"
import { checkConnection } from "../../services/connection"
import { refreshConnectionWorkspace } from "../../services/connection-projection"
import { settingsStore, SettingsActivationError } from "../../store/settings"
import { saveConnectionSettings } from "../../services/connection-settings"
import { isApiAuthorityCurrent, ApiAuthorityChangedError } from "../../services/api"
import { FileEditorAdmissionError } from "../../services/file-workbench"
import { t } from "../../utils/i18n"
import { Button } from "../ui/Button"
import { SettingsGroup, SettingsRow } from "./layout"
import { TextField } from "../ui/TextField"

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function ServerConnectionSettingsGroup() {
  const [draft, setDraft] = createSignal({
    serverUrl: settingsStore.serverUrl,
    username: settingsStore.username,
    password: settingsStore.password,
  })
  const [saved, setSaved] = createSignal(false)
  const [error, setError] = createSignal("")
  const [saving, setSaving] = createSignal(false)
  const [referencesRetired, setReferencesRetired] = createSignal(false)
  let saveGeneration = 0
  let savedTimer: ReturnType<typeof setTimeout> | undefined

  const clearFeedback = () => {
    saveGeneration += 1
    if (savedTimer) clearTimeout(savedTimer)
    savedTimer = undefined
    setSaved(false)
    setError("")
    setReferencesRetired(false)
  }

  async function saveConnection(): Promise<void> {
    if (saving()) return
    const snapshot = { ...draft() }
    const generation = ++saveGeneration
    const ownsSave = () => saveGeneration === generation
    setSaving(true)
    setSaved(false)
    setError("")
    let persistenceConfirmed = false
    try {
      const { authority, retiredReferences } = await saveConnectionSettings(snapshot)
      persistenceConfirmed = true
      if (!ownsSave()) return
      setReferencesRetired(retiredReferences)
      const connected = await checkConnection({ authority })
      if (!ownsSave() || !isApiAuthorityCurrent(authority)) return
      if (connected) await refreshConnectionWorkspace(authority)
      if (!ownsSave() || !isApiAuthorityCurrent(authority)) return
      setError("")
      setSaved(true)
      savedTimer = setTimeout(() => {
        if (ownsSave()) setSaved(false)
        savedTimer = undefined
      }, 1800)
    } catch (nextError) {
      if (!ownsSave()) return
      if (nextError instanceof FileEditorAdmissionError && nextError.reason !== "busy") return
      if (persistenceConfirmed && nextError instanceof ApiAuthorityChangedError) {
        setSaved(true)
        return
      }
      setSaved(false)
      setError(
        nextError instanceof SettingsActivationError
          ? nextError.message
          : t("settings.save_failed", { error: errorMessage(nextError) }),
      )
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
            value={draft().serverUrl}
            placeholder="http://127.0.0.1:7878"
            disabled={saving()}
            onInput={(event) => {
              clearFeedback()
              setDraft((value) => ({ ...value, serverUrl: event.currentTarget.value.trim() }))
            }}
          />
        </TextField.Root>
      </SettingsRow>
      <SettingsRow>
        <TextField.Root as="label">
          <TextField.Label>{t("settings.username")}</TextField.Label>
          <TextField.Input
            type="text"
            value={draft().username}
            disabled={saving()}
            onInput={(event) => {
              clearFeedback()
              setDraft((value) => ({ ...value, username: event.currentTarget.value.trim() }))
            }}
          />
        </TextField.Root>
      </SettingsRow>
      <SettingsRow>
        <TextField.Root as="label">
          <TextField.Label>{t("settings.password")}</TextField.Label>
          <TextField.Input
            type="password"
            value={draft().password}
            disabled={saving()}
            onInput={(event) => {
              clearFeedback()
              setDraft((value) => ({ ...value, password: event.currentTarget.value }))
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
        <Feedback tone="error" data-ui="settings-server-status">
          {error()}
        </Feedback>
      ) : null}
      {referencesRetired() ? <Feedback tone="info">{t("settings.connection_references_retired")}</Feedback> : null}
    </SettingsGroup>
  )
}
