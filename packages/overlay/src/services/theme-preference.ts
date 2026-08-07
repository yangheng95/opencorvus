import type { PersistedOverlaySettings } from "./persisted-overlay-settings"
import { saveSettings, setSettingsStore } from "../store/settings"
import { applyTheme } from "./theme"

let themePreferenceGeneration = 0

function writeTheme(value: string): void {
  setSettingsStore("theme", value)
  applyTheme(value)
}

/**
 * Apply and durably persist the latest theme selection.
 * Returns false when a newer selection superseded this operation.
 */
export async function applyThemePreference(value: string): Promise<boolean> {
  const generation = ++themePreferenceGeneration
  const ownsOperation = () => generation === themePreferenceGeneration
  let confirmed: Readonly<PersistedOverlaySettings> | undefined

  writeTheme(value)
  try {
    await saveSettings({
      overrides: { theme: value },
      onFailure(failure) {
        confirmed = failure.confirmed
      },
    })
  } catch (error) {
    if (!ownsOperation()) return false
    if (confirmed) writeTheme(confirmed.theme)
    throw error
  }
  return ownsOperation()
}
