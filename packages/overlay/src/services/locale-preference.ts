import {
  confirmedPersistedSettingsSnapshot,
  setSettingsStore,
  saveSettings,
} from "../store/settings"
import { boardStore } from "../store/board"
import { ApiAuthorityChangedError, captureApiAuthority, isApiAuthorityCurrent, type ApiAuthority } from "./api"
import { setLocale } from "../utils/i18n"
import { syncAgentPromptLocale } from "./config"
import { activeProjectDirectory } from "./project-directory"

let localePreferenceGeneration = 0
let localePreferenceTail = Promise.resolve()

async function syncProjectLocale(
  locale: string,
  directory: string,
  authority: ApiAuthority,
  ownsProjectScope: () => boolean,
): Promise<void> {
  if (!directory || !ownsProjectScope()) return
  try {
    await syncAgentPromptLocale(locale, {
      authority,
      directory,
      isCurrentDirectory: (candidate) => activeProjectDirectory().trim() === candidate,
      ownsResponse: ownsProjectScope,
    })
  } catch (error) {
    // Only the obsolete backend leg retires. Global locale persistence below
    // has its own writer and must still report a real persistence failure.
    if (error instanceof ApiAuthorityChangedError && error.expectedRevision === authority.revision && !isApiAuthorityCurrent(authority)) return
    throw error
  }
}

/**
 * Apply and durably persist the latest locale selection.
 * Locale rendering is serialized because setLocale mutates one global document.
 * Returns false when a newer selection superseded this operation.
 */
export async function applyLocalePreference(value: string): Promise<boolean> {
  const authority = captureApiAuthority()
  const selectionEpoch = boardStore.selectEpoch
  const generation = ++localePreferenceGeneration
  const ownsOperation = () => generation === localePreferenceGeneration
  const directory = activeProjectDirectory().trim()
  const ownsProjectScope = () => ownsOperation() && isApiAuthorityCurrent(authority) &&
    boardStore.selectEpoch === selectionEpoch && activeProjectDirectory().trim() === directory
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
        await syncProjectLocale(value, directory, authority, ownsProjectScope)
        if (!ownsOperation()) return false
      }
      await saveSettings({ overrides: { locale: value } })
    } catch (error) {
      if (!ownsOperation()) return false
      setSettingsStore("locale", durableLocale)
      await setLocale(durableLocale)
      if (directory && ownsProjectScope()) {
        await syncProjectLocale(durableLocale, directory, authority, ownsProjectScope)
      }
      throw error
    }
    return ownsOperation()
  } finally {
    release()
  }
}
