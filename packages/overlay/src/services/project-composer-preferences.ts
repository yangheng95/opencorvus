import {
  DEFAULT_COMPOSER_INTENT,
  type ComposerIntent,
  type ProjectComposerIntent,
} from "@opencorvus-ai/transport-protocol"
import { saveSettings, settingsStore, setSettingsStore } from "../store/settings"
import { projectComposerIntentKey, replaceProjectComposerIntent } from "./persisted-overlay-settings"

const pendingPreferences = new Map<string, symbol>()

export function projectComposerIntent(serverUrl: string, directory: string): ComposerIntent {
  const key = projectComposerIntentKey({ serverUrl, directory })
  const saved = settingsStore.projectComposerIntents.find((entry) => projectComposerIntentKey(entry) === key)
  return saved
    ? { productPillar: saved.productPillar, conversationTarget: saved.conversationTarget }
    : { ...DEFAULT_COMPOSER_INTENT }
}

export async function rememberProjectComposerIntent(directory: string, intent: ComposerIntent): Promise<void> {
  if (!directory.trim()) return
  const serverUrl = settingsStore.serverUrl
  const entry: ProjectComposerIntent = {
    serverUrl, directory: directory.trim(), productPillar: intent.productPillar, conversationTarget: intent.conversationTarget,
  }
  const key = projectComposerIntentKey(entry)
  const operation = Symbol()
  pendingPreferences.set(key, operation)
  const belongs = (candidate: ProjectComposerIntent) => projectComposerIntentKey(candidate) === key
  const pending = (candidate: ProjectComposerIntent) => pendingPreferences.has(projectComposerIntentKey(candidate))
  setSettingsStore("projectComposerIntents", (entries) => replaceProjectComposerIntent(entries, entry))
  await saveSettings({
    projectComposerIntent: entry,
    onConfirmed(confirmed) {
      if (pendingPreferences.get(key) === operation) pendingPreferences.delete(key)
      setSettingsStore("projectComposerIntents", (entries) => [
        ...(confirmed.projectComposerIntents ?? []).filter((candidate) => !pending(candidate)),
        ...entries.filter(pending),
      ])
      return undefined
    },
    onFailure: ({ confirmed }) => {
      if (pendingPreferences.get(key) !== operation) return
      pendingPreferences.delete(key)
      const saved = confirmed.projectComposerIntents?.find(belongs)
      setSettingsStore("projectComposerIntents", (entries) => [
        ...entries.filter((candidate) => !belongs(candidate)),
        ...(saved ? [saved] : []),
      ])
    },
  })
}
