import {
  OVERLAY_SETTINGS_STORAGE_KEY,
  parsePersistedOverlaySettings,
  replaceProjectComposerIntent,
  type PersistedOverlaySettings,
} from "./persisted-overlay-settings"
import { joinServerBaseUrl, type OverlaySettingsField, type ProjectComposerIntent } from "@opencorvus-ai/transport-protocol"
import { openBrowserRecord, type BrowserRecord } from "./browser-record-storage"
import { t } from "../utils/i18n"

export const BROWSER_OVERLAY_SETTINGS_KEY = OVERLAY_SETTINGS_STORAGE_KEY

function requireStorage(): Storage {
  const value = (globalThis as any).window?.localStorage ?? (globalThis as any).localStorage
  if (!value) throw new Error("browser overlay settings storage is unavailable")
  return value as Storage
}

function readLegacySettings(): PersistedOverlaySettings | null {
  const text = requireStorage().getItem(BROWSER_OVERLAY_SETTINGS_KEY)
  if (text === null) return null
  return parsePersistedOverlaySettings(JSON.parse(text))
}

let settingsRecord: Promise<BrowserRecord<PersistedOverlaySettings | null>> | undefined

function browserSettingsRecord(): Promise<BrowserRecord<PersistedOverlaySettings | null>> {
  if (settingsRecord) return settingsRecord
  const opening = openBrowserRecord({
    name: "opencorvus-settings",
    store: "settings",
    key: "overlay",
    migration: {
      read: readLegacySettings,
      retire: () => {
        try {
          requireStorage().removeItem(BROWSER_OVERLAY_SETTINGS_KEY)
        } catch (error) {
          console.warn("[settings] could not remove the migrated browser settings entry", error)
        }
      },
    },
  })
  settingsRecord = opening
  void opening.catch(() => {
    if (settingsRecord === opening) settingsRecord = undefined
  })
  return opening
}

export async function loadBrowserOverlaySettings(): Promise<PersistedOverlaySettings | null> {
  return (await browserSettingsRecord()).read()
}

const CONNECTION_FIELDS: readonly OverlaySettingsField[] = ["serverUrl", "autoServer", "username", "password"]
const CONNECTION_SCOPED_FIELDS: readonly OverlaySettingsField[] = [
  "directory", "workspaceTaskID", "workspaceDirectory", "lastSelectedModel",
]

export function mergeBrowserOverlaySettings(
  previous: PersistedOverlaySettings | null,
  input: PersistedOverlaySettings,
  fields: readonly OverlaySettingsField[],
  projectComposerIntent?: ProjectComposerIntent,
): PersistedOverlaySettings {
  const settings = parsePersistedOverlaySettings(input)
  const requestedServer = joinServerBaseUrl(settings.serverUrl, "")
  const current = previous ?? settings
  const selected = new Set(fields)
  if (selected.delete("projectComposerIntents") !== (projectComposerIntent !== undefined)) {
    throw new TypeError("A project composer setting requires its authored project intent")
  }
  if (selected.has("serverUrl")) {
    for (const field of CONNECTION_FIELDS) selected.add(field)
  } else {
    const editingWorkspace = fields.some((field) => CONNECTION_SCOPED_FIELDS.includes(field))
    const editingConnection = fields.some((field) => CONNECTION_FIELDS.includes(field))
    const credentialsChanged = current.username !== settings.username || current.password !== settings.password
    if (
      (editingWorkspace && credentialsChanged) ||
      ((editingConnection || editingWorkspace) && joinServerBaseUrl(current.serverUrl, "").href !== requestedServer.href)
    ) {
      throw new DOMException(t("settings.concurrent_connection_changed"), "InvalidStateError")
    }
  }
  const patch = Object.fromEntries([...selected].map((field) => [field, settings[field]]))
  const next = { ...current, ...patch }
  if (projectComposerIntent) {
    next.projectComposerIntents = replaceProjectComposerIntent(current.projectComposerIntents ?? [], projectComposerIntent)
  }
  return parsePersistedOverlaySettings(next)
}

export async function saveBrowserOverlaySettings(
  input: PersistedOverlaySettings,
  fields: readonly OverlaySettingsField[],
  projectComposerIntent?: ProjectComposerIntent,
): Promise<PersistedOverlaySettings> {
  const storage = await browserSettingsRecord()
  const outcome = await storage.write((previous) => {
    const settings = mergeBrowserOverlaySettings(previous, input, fields, projectComposerIntent)
    return { records: settings, value: settings }
  })
  return outcome.value
}
