import {
  isOverlayPersistedSettings,
  OVERLAY_SETTINGS_STORAGE_KEY,
  type OverlayPersistedSettings,
  type ProjectComposerIntent,
} from "@opencorvus-ai/transport-protocol"
import { projectDirectoryKey } from "../utils/project-directory"

export type PersistedOverlaySettings = OverlayPersistedSettings
export { OVERLAY_SETTINGS_STORAGE_KEY }

export function parsePersistedOverlaySettings(value: unknown): PersistedOverlaySettings {
  if (!isOverlayPersistedSettings(value)) throw new TypeError("persisted overlay settings payload is invalid")
  return value
}

export function projectComposerIntentKey({ serverUrl, directory }: Pick<ProjectComposerIntent, "serverUrl" | "directory">): string {
  return JSON.stringify([serverUrl.trim().replace(/\/+$/, ""), projectDirectoryKey(directory)])
}

export function replaceProjectComposerIntent(
  entries: readonly ProjectComposerIntent[],
  replacement: ProjectComposerIntent,
): ProjectComposerIntent[] {
  const key = projectComposerIntentKey(replacement)
  return [...entries.filter((entry) => projectComposerIntentKey(entry) !== key), replacement]
}
