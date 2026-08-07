import { createSignal } from "solid-js"
import { settingsStore } from "../../store/settings"
import { applyThemePreference } from "../../services/theme-preference"
import { themeOptionsForCurrentHost } from "../../services/theme-registry"
import { t } from "../../utils/i18n"
import { applyLocalePreference } from "../../services/locale-preference"
import { SelectField } from "../ui/SelectField"
import { SettingsGroup, SettingsPanel, SettingsRow, SettingsState } from "./layout"

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export default function AppearancePanel() {
  const [error, setError] = createSignal("")
  const [pendingPreference, setPendingPreference] = createSignal<"theme" | "locale" | "">("")
  let operationGeneration = 0

  function focusPreference(testid: string): void {
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-testid="${testid}"]`)?.focus())
  }

  async function handleThemeChange(value: string): Promise<void> {
    const generation = ++operationGeneration
    setPendingPreference("theme")
    try {
      if (await applyThemePreference(value)) setError("")
    } catch (nextError) {
      if (generation !== operationGeneration) return
      setError(t("settings.save_failed", { error: errorMessage(nextError) }))
      focusPreference("settings-appearance-theme")
    } finally {
      if (generation === operationGeneration) setPendingPreference("")
    }
  }

  async function handleLocaleChange(value: string): Promise<void> {
    const generation = ++operationGeneration
    setPendingPreference("locale")
    try {
      if (await applyLocalePreference(value)) setError("")
    } catch (nextError) {
      if (generation !== operationGeneration) return
      setError(t("settings.save_failed", { error: errorMessage(nextError) }))
      focusPreference("settings-appearance-locale")
    } finally {
      if (generation === operationGeneration) setPendingPreference("")
    }
  }

  return (
    <SettingsPanel class="general-panel appearance-panel">
      <SettingsGroup>
        <SettingsRow
          title={t("settings.theme.label")}
          desc={t("settings.theme_hint")}
          align="center"
          actions={
            <SelectField
              options={themeOptionsForCurrentHost().map((theme) => ({
                value: theme.id,
                label: t(`settings.theme.${theme.i18nSlug}`),
              }))}
              value={settingsStore.theme}
              ariaLabel={t("settings.theme.label")}
              testid="settings-appearance-theme"
              disabled={pendingPreference() === "theme"}
              onChange={(value) => void handleThemeChange(value)}
            />
          }
        />
        <SettingsRow
          title={t("settings.language")}
          desc={t("settings.language_hint")}
          align="center"
          actions={
            <SelectField
              options={[
                { value: "en-US", label: t("settings.language.en_us") },
                { value: "zh-CN", label: t("settings.language.zh_cn") },
              ]}
              value={settingsStore.locale}
              ariaLabel={t("settings.language")}
              testid="settings-appearance-locale"
              disabled={pendingPreference() === "locale"}
              onChange={(value) => void handleLocaleChange(value)}
            />
          }
        />
        {error() ? (
          <SettingsState tone="error" data-ui="settings-appearance-status">
            {error()}
          </SettingsState>
        ) : null}
      </SettingsGroup>
    </SettingsPanel>
  )
}
