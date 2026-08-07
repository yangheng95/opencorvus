import {
  OVERLAY_SETTINGS_STORAGE_KEY,
  parsePersistedOverlaySettings,
  type PersistedOverlaySettings,
} from "./persisted-overlay-settings"

export const BROWSER_OVERLAY_SETTINGS_KEY = OVERLAY_SETTINGS_STORAGE_KEY

function requireStorage(): Storage {
  const value = (globalThis as any).window?.localStorage ?? (globalThis as any).localStorage
  if (!value) throw new Error("browser overlay settings storage is unavailable")
  return value as Storage
}

export function loadBrowserOverlaySettings(): PersistedOverlaySettings | null {
  const text = requireStorage().getItem(BROWSER_OVERLAY_SETTINGS_KEY)
  if (text === null) return null
  return parsePersistedOverlaySettings(JSON.parse(text))
}

export function saveBrowserOverlaySettings(input: PersistedOverlaySettings): boolean {
  const settings = parsePersistedOverlaySettings(input)
  requireStorage().setItem(BROWSER_OVERLAY_SETTINGS_KEY, JSON.stringify(settings))
  return true
}
