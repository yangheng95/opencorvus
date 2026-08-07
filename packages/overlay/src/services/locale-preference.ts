import {
  confirmedPersistedSettingsSnapshot,
  setSettingsStore,
  saveSettings,
} from "../store/settings"
import { setLocale } from "../utils/i18n"
import { syncAgentPromptLocale } from "./config"
import { activeProjectDirectory } from "./project-directory"

let localePreferenceGeneration = 0
let localePreferenceTail = Promise.resolve()

function projectOptions(directory: string, ownsOperation: () => boolean) {
  return {
    directory,
    isCurrentDirectory: (candidate: string) => activeProjectDirectory().trim() === candidate,
    ownsResponse: ownsOperation,
  }
}

/**
 * Apply and durably persist the latest locale selection.
 * Locale rendering is serialized because setLocale mutates one global document.
 * Returns false when a newer selection superseded this operation.
 */
export async function applyLocalePreference(value: string): Promise<boolean> {
  const generation = ++localePreferenceGeneration
  const ownsOperation = () => generation === localePreferenceGeneration
  const directory = activeProjectDirectory().trim()
  const ownsProjectScope = () => ownsOperation() && activeProjectDirectory().trim() === directory
  const previous = localePreferenceTail
  let release!: () => void
  localePreferenceTail = new Promise<void>((resolve) => {
    release = resolve
  })
  setSettingsStore("locale", value)
  await previous
  try {
    if (!ownsOperation()) return false
    const durableLocale = confirmedPersistedSettingsSnapshot().locale
    try {
      await setLocale(value)
      if (!ownsOperation()) return false
      if (directory && ownsProjectScope()) {
        await syncAgentPromptLocale(value, projectOptions(directory, ownsProjectScope))
        if (!ownsOperation()) return false
      }
      await saveSettings({ overrides: { locale: value } })
    } catch (error) {
      if (!ownsOperation()) return false
      setSettingsStore("locale", durableLocale)
      await setLocale(durableLocale)
      if (directory && ownsProjectScope()) {
        await syncAgentPromptLocale(durableLocale, projectOptions(directory, ownsProjectScope))
      }
      throw error
    }
    return ownsOperation()
  } finally {
    release()
  }
}
