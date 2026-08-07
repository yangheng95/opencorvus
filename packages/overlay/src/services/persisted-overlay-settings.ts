import {
  isOverlayPersistedSettings,
  OVERLAY_SETTINGS_STORAGE_KEY,
  type OverlayPersistedSettings,
} from "@opencorvus-ai/transport-protocol"

export type PersistedOverlaySettings = OverlayPersistedSettings
export { OVERLAY_SETTINGS_STORAGE_KEY }

export function parsePersistedOverlaySettings(value: unknown): PersistedOverlaySettings {
  if (!isOverlayPersistedSettings(value)) throw new TypeError("persisted overlay settings payload is invalid")
  return value
}
