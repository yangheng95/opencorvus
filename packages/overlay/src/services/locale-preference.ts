import {
  confirmedPersistedSettingsSnapshot,
  setSettingsStore,
  saveSettings,
} from "../store/settings"
import { setLocale } from "../utils/i18n"

let localePreferenceGeneration = 0
let localePreferenceTail = Promise.resolve()

/**
 * Apply and durably persist the latest locale selection.
 * Locale rendering is serialized because setLocale mutates one global document.
 * Returns false when a newer selection superseded this operation.
 */
export async function applyLocalePreference(value: string): Promise<boolean> {
  const generation = ++localePreferenceGeneration
  const ownsOperation = () => generation === localePreferenceGeneration
  const previous = localePreferenceTail
  let release!: () => void
  localePreferenceTail = new Promise<void>((resolve) => {
    release = resolve
  })
  setSettingsStore("locale", value)
  await previous
  try {
    if (!ownsOperation()) return false
    let durableLocale = confirmedPersistedSettingsSnapshot().locale
    try {
      await setLocale(value)
      if (!ownsOperation()) return false
      await saveSettings({
        overrides: { locale: value },
        onFailure({ confirmed }) {
          durableLocale = confirmed.locale
        },
      })
    } catch (error) {
      if (!ownsOperation()) return false
      setSettingsStore("locale", durableLocale)
      await setLocale(durableLocale)
      throw error
    }
    return ownsOperation()
  } finally {
    release()
  }
}
