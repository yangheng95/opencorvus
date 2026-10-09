import { afterEach, beforeEach, expect, test } from "bun:test"
import { configure } from "../src/services/api"
import { applyLocalePreference } from "../src/services/locale-preference"
import { HOST_CAPABILITIES, type HostTransport } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { parsePersistedOverlaySettings, type PersistedOverlaySettings } from "../src/services/persisted-overlay-settings"
import { setAppStore } from "../src/store/app"
import { setBoardStore } from "../src/store/board"
import { applySettings, bootstrapOverlaySettings, confirmedPersistedSettingsSnapshot, DEFAULT_SETTINGS, loadSettings, saveSettings } from "../src/store/settings"
import { getLocale, setLocale } from "../src/utils/i18n"
import { installRealOverlayI18n } from "./fixtures/i18n"

installRealOverlayI18n()
let initial: PersistedOverlaySettings
let persisted: PersistedOverlaySettings
let saves: PersistedOverlaySettings[]
let persist: (document: PersistedOverlaySettings) => Promise<void>

beforeEach(async () => {
  applySettings({ ...DEFAULT_SETTINGS, serverUrl: "http://locale-client.invalid", locale: "en-US", autoServer: false })
  initial = bootstrapOverlaySettings()
  persisted = structuredClone(initial)
  saves = []
  persist = async () => {}
  __setHostTransportForTest({
    kind: "tauri", capabilities: HOST_CAPABILITIES.tauri,
    async request() {
      return { status: 503, ok: false, headers: {}, body: undefined }
    },
    openStream() { throw new Error("Locale service fixture has no stream transport") },
    async native(command) {
      if (command.kind === "settings.load") return structuredClone(persisted)
      if (command.kind === "settings.save") {
        const document = structuredClone(command.payload)
        saves.push(document)
        await persist(document)
        persisted = document
        return true
      }
      throw new Error(`Unexpected locale host command ${command.kind}`)
    },
  } satisfies HostTransport)
  configure({ serverUrl: initial.serverUrl, username: initial.username, password: "" })
  await loadSettings()
  await setLocale("en-US")
  setAppStore({ connected: true, config: { model: "unavailable/model", locale: "en-US" } })
  setBoardStore({ selectedSource: { kind: "session", id: "ses_locale_a", directory: "/locale/a", sessionKind: "conversation" }, taskSwitching: false })
})

afterEach(async () => {
  __setHostTransportForTest(undefined)
  setBoardStore({ selectedSource: null, board: null, taskSwitching: false })
  setAppStore({ connected: false, config: null })
  applySettings(DEFAULT_SETTINGS)
  configure({ serverUrl: DEFAULT_SETTINGS.serverUrl, directory: "", username: "opencorvus", password: "" })
  await setLocale("en-US")
})

test("client locale confirms a complete host document and survives a cold settings read", async () => {
  expect(await applyLocalePreference("zh-CN")).toBe(true)
  const expected = { ...initial, locale: "zh-CN" }
  expect(parsePersistedOverlaySettings(persisted)).toEqual(expected)
  expect(confirmedPersistedSettingsSnapshot()).toEqual(expected)
  applySettings({ ...DEFAULT_SETTINGS, locale: "en-US" })
  await loadSettings()
  await setLocale(confirmedPersistedSettingsSnapshot().locale)
  expect(getLocale()).toBe("zh-CN")
})

test("an offline client confirms its language through the same host writer", async () => {
  setAppStore({ connected: false, config: null })
  expect(await applyLocalePreference("zh-CN")).toBe(true)
  expect({ active: getLocale(), saved: persisted.locale }).toEqual({ active: "zh-CN", saved: "zh-CN" })
})

test("host persistence failure returns its original error, restores confirmed language, and releases the locale tail", async () => {
  const failure = new Error("Locale host storage write failed")
  persist = async () => { throw failure }
  await expect(applyLocalePreference("zh-CN")).rejects.toBe(failure)
  expect({ active: getLocale(), confirmed: confirmedPersistedSettingsSnapshot().locale }).toEqual({ active: "en-US", confirmed: "en-US" })
  persist = async () => {}
  expect(await applyLocalePreference("zh-CN")).toBe(true)
  expect(persisted).toEqual({ ...initial, locale: "zh-CN" })
})

test("in-flight language persistence settles before the newer selection becomes the confirmed host document", async () => {
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  persist = async () => {
    if (saves.length === 1) { entered.resolve(); await release.promise }
  }
  const first = applyLocalePreference("zh-CN")
  await entered.promise
  const second = applyLocalePreference("en-US")
  release.resolve()
  expect(await Promise.all([first, second])).toEqual([false, true])
  expect(saves.map((document) => document.locale)).toEqual(["zh-CN", "en-US"])
  expect({ active: getLocale(), confirmed: confirmedPersistedSettingsSnapshot().locale, saved: persisted.locale }).toEqual({ active: "en-US", confirmed: "en-US", saved: "en-US" })
})

test("client language persistence completes across connection and selected-project changes", async () => {
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  persist = async () => { entered.resolve(); await release.promise }
  const operation = applyLocalePreference("zh-CN")
  await entered.promise
  configure({ serverUrl: "http://locale-client-b.invalid" })
  setBoardStore({ selectedSource: { kind: "session", id: "ses_locale_b", directory: "/locale/b", sessionKind: "conversation" }, taskSwitching: false })
  release.resolve()
  expect(await operation).toBe(true)
  expect({ active: getLocale(), saved: persisted.locale }).toEqual({ active: "zh-CN", saved: "zh-CN" })
})

test("a failed queued locale write restores the language confirmed by the preceding settings writer", async () => {
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const failure = new Error("Queued locale storage failed")
  persist = async () => {
    if (saves.length === 1) { entered.resolve(); await release.promise; return }
    throw failure
  }
  const preceding = saveSettings({ overrides: { locale: "zh-CN" } })
  await entered.promise
  const operation = applyLocalePreference("zh-CN")
  await new Promise<void>((resolve) => setImmediate(resolve))
  release.resolve()
  await preceding
  await expect(operation).rejects.toBe(failure)
  expect({ active: getLocale(), confirmed: confirmedPersistedSettingsSnapshot().locale, saved: persisted.locale }).toEqual({ active: "zh-CN", confirmed: "zh-CN", saved: "zh-CN" })
})
