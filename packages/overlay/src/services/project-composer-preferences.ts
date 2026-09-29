import {
  DEFAULT_COMPOSER_INTENT,
  type ComposerIntent,
  type ProjectComposerIntent,
} from "@opencorvus-ai/transport-protocol"
import { saveSettings, settingsStore, setSettingsStore } from "../store/settings"
import { projectDirectoryKey } from "../utils/project-directory"

const preferenceWrites = new Map<string, number>()

function scopeKey(serverUrl: string, directory: string): string {
  return JSON.stringify([serverUrl.trim().replace(/\/+$/, ""), projectDirectoryKey(directory)])
}

export function projectComposerIntent(serverUrl: string, directory: string): ComposerIntent {
  const key = scopeKey(serverUrl, directory)
  const saved = settingsStore.projectComposerIntents.find((entry) => scopeKey(entry.serverUrl, entry.directory) === key)
  return saved
    ? { productPillar: saved.productPillar, conversationTarget: saved.conversationTarget }
    : { ...DEFAULT_COMPOSER_INTENT }
}

export async function rememberProjectComposerIntent(directory: string, intent: ComposerIntent): Promise<void> {
  if (!directory.trim()) return
  const serverUrl = settingsStore.serverUrl
  const key = scopeKey(serverUrl, directory)
  const entry: ProjectComposerIntent = { serverUrl, directory: directory.trim(), ...intent }
  const generation = (preferenceWrites.get(key) ?? 0) + 1
  preferenceWrites.set(key, generation)
  const belongs = (candidate: ProjectComposerIntent) => scopeKey(candidate.serverUrl, candidate.directory) === key
  setSettingsStore("projectComposerIntents", (entries) => [
    ...entries.filter((candidate) => !belongs(candidate)),
    entry,
  ])
  await saveSettings({
    onFailure: ({ confirmed }) => {
      if (preferenceWrites.get(key) !== generation) return
      const saved = confirmed.projectComposerIntents?.find(belongs)
      setSettingsStore("projectComposerIntents", (entries) => [
        ...entries.filter((candidate) => !belongs(candidate)),
        ...(saved ? [saved] : []),
      ])
    },
  })
}
