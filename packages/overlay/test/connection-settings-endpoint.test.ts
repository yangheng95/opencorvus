import { afterEach, beforeEach, expect, test } from "bun:test"
import { apiUrl, captureApiAuthority, configure, getServerUrl } from "../src/services/api-state"
import { saveConnectionSettings } from "../src/services/connection-settings"
import { activeProjectDirectory, setProjectDirectoryContext } from "../src/services/project-directory"
import type { HostTransport } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import {
  applySettings,
  bootstrapOverlaySettings,
  confirmedPersistedSettingsSnapshot,
  DEFAULT_SETTINGS,
  loadSettings,
  setSettingsStore,
} from "../src/store/settings"

const project = "C:/owned-fixture/project"
const originalFrame = globalThis.requestAnimationFrame

beforeEach(() => {
  globalThis.requestAnimationFrame = (callback) => {
    callback(performance.now())
    return 0
  }
})

async function start(serverUrl: string) {
  let persisted = bootstrapOverlaySettings({
    ...DEFAULT_SETTINGS,
    serverUrl,
    savedDirectory: project,
    workspaceDirectory: project,
    lastSelectedModel: "owned/model",
    projectComposerIntents: [
      { serverUrl, directory: project, productPillar: "code", conversationTarget: "chat" },
    ],
  })
  __setHostTransportForTest({
    kind: "browser",
    async native(command) {
      if (command.kind === "settings.load") return structuredClone(persisted)
      if (command.kind !== "settings.save") throw new Error(`Unexpected settings action: ${command.kind}`)
      persisted = structuredClone(command.payload)
      return command.payload
    },
  } as HostTransport)
  await loadSettings()
  setProjectDirectoryContext(project, true)
  configure({ serverUrl, username: DEFAULT_SETTINGS.username, password: "" })
  return () => persisted
}

afterEach(() => {
  if (originalFrame) globalThis.requestAnimationFrame = originalFrame
  else Reflect.deleteProperty(globalThis, "requestAnimationFrame")
  __setHostTransportForTest(undefined)
  applySettings(DEFAULT_SETTINGS)
  setSettingsStore("savedDirectory", "")
  configure({ serverUrl: DEFAULT_SETTINGS.serverUrl, username: DEFAULT_SETTINGS.username, password: "", directory: "" })
})

function save(serverUrl: string) {
  return saveConnectionSettings({ serverUrl, username: DEFAULT_SETTINGS.username, password: "" })
}

const equivalentAddresses = [
  ["http://local.example:40212", "http://local.example:40212/", "http://local.example:40212/global/health"],
  ["https://local.example/proxy/", "https://LOCAL.example:443/proxy///", "https://local.example/proxy/global/health"],
] as const

for (const [applied, alias, health] of equivalentAddresses) {
  test(`the existing workspace and address identity survive a save for ${alias}`, async () => {
    const persisted = await start(applied)
    const original = structuredClone(persisted())
    const authority = captureApiAuthority()

    expect(await save(alias)).toMatchObject({ serverUrl: applied, authority })
    expect({ directory: activeProjectDirectory(), server: getServerUrl(), health: apiUrl("/global/health") })
      .toEqual({ directory: project, server: applied, health })
    expect(persisted()).toEqual(original)
    expect(confirmedPersistedSettingsSnapshot()).toEqual(original)
  })
}

for (const [applied, selected] of [
  ["http://local.example:40212", "http://local.example:40210"],
  ["https://local.example/proxy", "https://local.example/other"],
  ["http://", "http://local.example:40212"],
] as const) {
  test(`changing ${applied} to ${selected} publishes the new connection and its empty workspace`, async () => {
    const persisted = await start(applied)
    const original = structuredClone(persisted())
    const prior = captureApiAuthority()
    const result = await save(selected)

    expect(result).toMatchObject({ serverUrl: selected, authority: { revision: prior.revision + 1 } })
    expect({ directory: activeProjectDirectory(), server: getServerUrl() }).toEqual({ directory: "", server: selected })
    expect(persisted()).toEqual({
      ...original,
      serverUrl: selected,
      directory: undefined,
      workspaceDirectory: undefined,
      lastSelectedModel: undefined,
    })
  })
}

test("an invalid proposed address returns the existing named validation error", async () => {
  await start("http://local.example:40212")
  await expect(save("http://local.example:40212/#fragment"))
    .rejects.toMatchObject({ name: "ServerBaseUrlError", reason: "fragment" })
})
