import { afterEach, beforeEach, expect, test } from "bun:test"
import type { HostTransport } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type { PersistedOverlaySettings } from "../src/services/persisted-overlay-settings"
import { ServerBaseUrlError } from "@opencorvus-ai/transport-protocol"
import { apiHeaders, configure } from "../src/services/api-state"
import {
  applySettings,
  bootstrapOverlaySettings,
  confirmedPersistedSettingsSnapshot,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  SettingsActivationError,
  settingsStore,
  setSettingsStore,
} from "../src/store/settings"

const SERVER_A = "http://backend-a.invalid"
const SERVER_B = "http://backend-b.invalid"
const SERVER_C = "http://backend-c.invalid"
let persisted: PersistedOverlaySettings
let initial: PersistedOverlaySettings
let writes: PersistedOverlaySettings[]
let events: string[]
let beforePersist: (payload: PersistedOverlaySettings, call: number) => Promise<void>

function publishConnection(confirmed: Readonly<PersistedOverlaySettings>): undefined {
  setSettingsStore({ serverUrl: confirmed.serverUrl, username: confirmed.username, password: confirmed.password })
  events.push(`publish:${confirmed.serverUrl}`)
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

beforeEach(async () => {
  initial = bootstrapOverlaySettings({
    ...DEFAULT_SETTINGS,
    serverUrl: SERVER_A,
    theme: "light",
    password: "",
    savedDirectory: "C:/owned-fixture/project-a",
    workspaceTaskID: "task-owned-a",
    workspaceDirectory: "C:/owned-fixture/project-a",
  })
  persisted = structuredClone(initial)
  writes = []
  events = []
  beforePersist = async () => {}
  __setHostTransportForTest({
    kind: "browser",
    async native(command) {
      if (command.kind === "settings.load") return structuredClone(persisted)
      if (command.kind !== "settings.save") throw new Error(`Unexpected native command: ${command.kind}`)
      const payload = structuredClone(command.payload)
      writes.push(payload)
      events.push(`persist:${payload.serverUrl}`)
      await beforePersist(payload, writes.length)
      persisted = payload
      events.push(`confirmed:${payload.serverUrl}`)
      return true
    },
  } as HostTransport)
  await loadSettings()
})

afterEach(() => {
  __setHostTransportForTest(undefined)
  applySettings(DEFAULT_SETTINGS)
  configure({ username: DEFAULT_SETTINGS.username, password: "" })
})

test("confirmed connection publication precedes a queued preference snapshot and survives cold read", async () => {
  const started = deferred()
  const release = deferred()
  beforePersist = async (_payload, call) => {
    if (call !== 1) return
    started.resolve()
    await release.promise
  }
  const connection = saveSettings({
    overrides: { serverUrl: SERVER_B },
    onConfirmed(confirmed) {
      expect(confirmedPersistedSettingsSnapshot()).toBe(confirmed)
      expect(confirmed).toEqual({ ...initial, serverUrl: SERVER_B })
      return publishConnection(confirmed)
    },
  })
  const preference = saveSettings({ overrides: { theme: "dark" } })
  await started.promise
  expect(settingsStore.serverUrl).toBe(SERVER_A)
  release.resolve()
  await Promise.all([connection, preference])
  expect(writes).toEqual([
    { ...initial, serverUrl: SERVER_B },
    { ...initial, serverUrl: SERVER_B, theme: "dark" },
  ])
  expect(events).toEqual([
    `persist:${SERVER_B}`,
    `confirmed:${SERVER_B}`,
    `publish:${SERVER_B}`,
    `persist:${SERVER_B}`,
    `confirmed:${SERVER_B}`,
  ])
  expect(settingsStore.serverUrl).toBe(SERVER_B)
  applySettings(DEFAULT_SETTINGS)
  await loadSettings()
  expect(bootstrapOverlaySettings()).toEqual({ ...initial, serverUrl: SERVER_B, theme: "dark" })
})

test("native failure reports the confirmed A document and a later explicit retry commits B", async () => {
  const failure = new Error("Owned storage write failed")
  beforePersist = async () => {
    throw failure
  }
  let failed: unknown
  const action = {
    overrides: { serverUrl: SERVER_B },
    onConfirmed: publishConnection,
    onFailure(input: { error: unknown; confirmed: Readonly<PersistedOverlaySettings> }) {
      failed = input
    },
  }
  await expect(saveSettings(action)).rejects.toBe(failure)
  expect(failed).toEqual({ error: failure, confirmed: initial })
  expect({
    applied: settingsStore.serverUrl,
    durable: persisted.serverUrl,
    confirmed: confirmedPersistedSettingsSnapshot().serverUrl,
  }).toEqual({ applied: SERVER_A, durable: SERVER_A, confirmed: SERVER_A })
  beforePersist = async () => {}
  await saveSettings(action)
  expect({
    applied: settingsStore.serverUrl,
    durable: persisted.serverUrl,
    confirmed: confirmedPersistedSettingsSnapshot().serverUrl,
  }).toEqual({ applied: SERVER_B, durable: SERVER_B, confirmed: SERVER_B })
})

test("queued B and C transactions merge the latest unrelated workspace and preference fields", async () => {
  const started = deferred()
  const release = deferred()
  beforePersist = async (_payload, call) => {
    if (call !== 1) return
    started.resolve()
    await release.promise
  }
  const first = saveSettings({ overrides: { serverUrl: SERVER_B }, onConfirmed: publishConnection })
  const second = saveSettings({ overrides: { serverUrl: SERVER_C }, onConfirmed: publishConnection })
  const preference = saveSettings({ overrides: { sidebarWidth: 320 } })
  await started.promise
  setSettingsStore({ workspaceTaskID: "task-owned-new", workspaceDirectory: "C:/owned-fixture/project-new" })
  release.resolve()
  await Promise.all([first, second, preference])
  const nextWorkspace = { workspaceTaskID: "task-owned-new", workspaceDirectory: "C:/owned-fixture/project-new" }
  expect(writes).toEqual([
    { ...initial, serverUrl: SERVER_B },
    { ...initial, ...nextWorkspace, serverUrl: SERVER_C },
    { ...initial, ...nextWorkspace, serverUrl: SERVER_C, sidebarWidth: 320 },
  ])
  expect(events).toEqual([
    `persist:${SERVER_B}`,
    `confirmed:${SERVER_B}`,
    `publish:${SERVER_B}`,
    `persist:${SERVER_C}`,
    `confirmed:${SERVER_C}`,
    `publish:${SERVER_C}`,
    `persist:${SERVER_C}`,
    `confirmed:${SERVER_C}`,
  ])
  expect(settingsStore.serverUrl).toBe(SERVER_C)
  expect(confirmedPersistedSettingsSnapshot()).toEqual(writes[2])
})

test("activation failure exposes its durable fact and the queue admits the next explicit transaction", async () => {
  const cause = new Error("Owned activation failed")
  let caught: unknown
  try {
    await saveSettings({
      overrides: { serverUrl: SERVER_B },
      onConfirmed() {
        throw cause
      },
    })
  } catch (error) {
    caught = error
  }
  expect(caught).toBeInstanceOf(SettingsActivationError)
  const activation = caught as SettingsActivationError
  expect({
    name: activation.name,
    persisted: activation.persisted,
    message: activation.message,
    cause: activation.cause,
  }).toEqual({
    name: "SettingsActivationError",
    persisted: true,
    message: "Settings were saved, but could not be applied to the current client.",
    cause,
  })
  expect({
    applied: settingsStore.serverUrl,
    durable: persisted.serverUrl,
    confirmed: confirmedPersistedSettingsSnapshot().serverUrl,
  }).toEqual({ applied: SERVER_A, durable: SERVER_B, confirmed: SERVER_B })
  await saveSettings({ overrides: { serverUrl: SERVER_C }, onConfirmed: publishConnection })
  expect({
    applied: settingsStore.serverUrl,
    durable: persisted.serverUrl,
    confirmed: confirmedPersistedSettingsSnapshot().serverUrl,
  }).toEqual({ applied: SERVER_C, durable: SERVER_C, confirmed: SERVER_C })
})

test("ordinary overrides retain the existing persistence-only action contract", async () => {
  await saveSettings({ overrides: { theme: "dark" } })
  expect({
    appliedTheme: settingsStore.theme,
    durableTheme: persisted.theme,
    confirmedTheme: confirmedPersistedSettingsSnapshot().theme,
  }).toEqual({ appliedTheme: "light", durableTheme: "dark", confirmedTheme: "dark" })
  expect(persisted).toEqual({ ...initial, theme: "dark" })
})

test("operational admission failure reconciles provisional state before the queued correction commits", async () => {
  setSettingsStore({ serverUrl: "http://", theme: "dark" })
  let failure: unknown
  let failureFacts: unknown
  const invalid = saveSettings({
    onFailure({ error, confirmed }) {
      failure = error
      expect(confirmed).toEqual(initial)
      applySettings(confirmed)
      failureFacts = { applied: settingsStore.serverUrl, theme: settingsStore.theme, confirmed, durable: persisted }
      events.push("reconcile:confirmed-a")
    },
  })
  const correction = saveSettings({ overrides: { serverUrl: SERVER_B }, onConfirmed: publishConnection })
  await expect(invalid).rejects.toBeInstanceOf(ServerBaseUrlError)
  expect({
    name: (failure as Error).name,
    reason: (failure as ServerBaseUrlError).reason,
    message: (failure as Error).message,
  }).toEqual({ name: "ServerBaseUrlError", reason: "malformed", message: "Server URL is not a valid absolute URL." })
  await correction
  expect(failureFacts).toEqual({ applied: SERVER_A, theme: "light", confirmed: initial, durable: initial })
  expect(events).toEqual([
    "reconcile:confirmed-a",
    `persist:${SERVER_B}`,
    `confirmed:${SERVER_B}`,
    `publish:${SERVER_B}`,
  ])
  expect({
    applied: settingsStore.serverUrl,
    confirmed: confirmedPersistedSettingsSnapshot(),
    durable: persisted,
  }).toEqual({
    applied: SERVER_B,
    confirmed: { ...initial, serverUrl: SERVER_B },
    durable: { ...initial, serverUrl: SERVER_B },
  })
  expect(settingsStore.theme).toBe("light")
})

test("structural save admission shares the existing confirmed failure callback and retry contract", async () => {
  let observed: unknown
  await expect(
    saveSettings({
      overrides: { serverUrl: "" },
      onFailure(input) {
        observed = input
      },
    }),
  ).rejects.toThrow("persisted overlay settings payload is invalid")
  const failure = observed as { error: Error; confirmed: PersistedOverlaySettings }
  expect({
    name: failure.error.name,
    message: failure.error.message,
    confirmed: failure.confirmed,
    applied: settingsStore.serverUrl,
    durable: persisted,
  }).toEqual({
    name: "TypeError",
    message: "persisted overlay settings payload is invalid",
    confirmed: initial,
    applied: SERVER_A,
    durable: initial,
  })
  await saveSettings({ overrides: { serverUrl: SERVER_C }, onConfirmed: publishConnection })
  expect({
    applied: settingsStore.serverUrl,
    confirmed: confirmedPersistedSettingsSnapshot().serverUrl,
    durable: persisted.serverUrl,
  }).toEqual({ applied: SERVER_C, confirmed: SERVER_C, durable: SERVER_C })
})

test("an old readable invalid address can be corrected without rewriting historical intent identities", async () => {
  const projectComposerIntents = [
    {
      serverUrl: "historical bad address",
      directory: "C:/owned-fixture/project-a",
      productPillar: "code" as const,
      conversationTarget: "mission" as const,
    },
  ]
  persisted = { ...initial, serverUrl: "not a url", theme: "sage", projectComposerIntents }
  await loadSettings()
  expect({
    applied: settingsStore.serverUrl,
    confirmed: confirmedPersistedSettingsSnapshot(),
    durable: persisted,
  }).toEqual({
    applied: "not a url",
    confirmed: { ...initial, serverUrl: "not a url", theme: "sage", projectComposerIntents },
    durable: { ...initial, serverUrl: "not a url", theme: "sage", projectComposerIntents },
  })
  await saveSettings({ overrides: { serverUrl: SERVER_B }, onConfirmed: publishConnection })
  const expected: PersistedOverlaySettings = { ...initial, serverUrl: SERVER_B, theme: "sage", projectComposerIntents }
  expect({
    applied: settingsStore.serverUrl,
    confirmed: confirmedPersistedSettingsSnapshot(),
    durable: persisted,
  }).toEqual({ applied: SERVER_B, confirmed: expected, durable: expected })
})

test("cold load and a later preference save preserve an explicitly empty Basic username", async () => {
  persisted = { ...initial, username: "", password: "" }
  await loadSettings()
  expect({
    applied: settingsStore.username,
    confirmed: confirmedPersistedSettingsSnapshot(),
    durable: persisted,
  }).toEqual({
    applied: "",
    confirmed: { ...initial, username: "", password: "" },
    durable: { ...initial, username: "", password: "" },
  })
  configure({ username: settingsStore.username, password: settingsStore.password })
  expect(apiHeaders()).toEqual({ Accept: "application/json" })
  await saveSettings({ overrides: { theme: "dark" } })
  expect({
    applied: settingsStore.username,
    confirmed: confirmedPersistedSettingsSnapshot(),
    durable: persisted,
  }).toEqual({
    applied: "",
    confirmed: { ...initial, username: "", password: "", theme: "dark" },
    durable: { ...initial, username: "", password: "", theme: "dark" },
  })
  configure({ username: settingsStore.username, password: "DUMMY_NON_CREDENTIAL" })
  expect(apiHeaders()).toEqual({ Accept: "application/json", Authorization: "Basic OkRVTU1ZX05PTl9DUkVERU5USUFM" })
})
