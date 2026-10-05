import { afterEach, beforeEach, expect, test } from "bun:test"
import { configure } from "../src/services/api"
import { loadConfigInfo, loadProviderInfo } from "../src/services/config-load"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type { HostTransport, TransportRequest } from "../src/services/host-transport"
import { appStore, setAppStore } from "../src/store/app"
import { setBoardStore } from "../src/store/board"
import { DEFAULT_SETTINGS, setSettingsStore } from "../src/store/settings"

function transport(read: (request: TransportRequest) => unknown | Promise<unknown>) {
  __setHostTransportForTest({
    kind: "browser",
    async request(request) {
      return { status: 200, ok: true, headers: {}, body: await read(request) }
    },
  } as HostTransport)
}
beforeEach(() => {
  setBoardStore({ board: null, selectedSource: null })
  setSettingsStore({ ...DEFAULT_SETTINGS, directory: "C:/Project-A" })
  configure({ directory: "C:/Project-A" })
  setAppStore({ config: { permission_mode: "ask" }, providerCatalog: null })
})
afterEach(() => __setHostTransportForTest(undefined))

test("default provider refresh loads the active project's catalog and retains its saved authorization", async () => {
  const requests: TransportRequest[] = []
  transport((request) => {
    requests.push(request)
    return request.path === "provider" ? { connected: ["project-provider"] } : {}
  })
  await loadProviderInfo()
  expect(requests.map((request) => ({ path: request.path, directory: request.query?.directory }))).toEqual([
    { path: "provider", directory: "C:/Project-A" },
    { path: "provider/auth", directory: "C:/Project-A" },
  ])
  expect(appStore.config).toEqual({ permission_mode: "ask" })
  expect(appStore.providerCatalog).toEqual({ connected: ["project-provider"] })
})

test("a completed global read leaves the newly selected project's config as the current projection", async () => {
  setSettingsStore("directory", "")
  const pending = Promise.withResolvers<void>()
  transport(async (request) => {
    await pending.promise
    return request.path === "global/providers"
      ? { catalog: { connected: ["global-provider"] } }
      : request.path === "global/config"
        ? { permission_mode: "full_access" }
        : {}
  })
  const loading = loadProviderInfo(undefined, { directory: "" })
  setSettingsStore("directory", "C:/Project-B")
  setAppStore({ config: { permission_mode: "ask" }, providerCatalog: { connected: ["project-b"] } })
  pending.resolve()
  await loading
  expect(appStore.config).toEqual({ permission_mode: "ask" })
  expect(appStore.providerCatalog).toEqual({ connected: ["project-b"] })
})

test("project config reload projects the selected server and project after an earlier server finishes", async () => {
  const pending = Promise.withResolvers<void>()
  transport(async (request) => {
    await pending.promise
    return request.path === "config" ? { permission_mode: "full_access" } : []
  })
  const loading = loadConfigInfo()
  setSettingsStore("serverUrl", "http://server-b:7878")
  configure({ serverUrl: "http://server-b:7878" })
  setAppStore("config", { permission_mode: "ask", locale: "zh-CN" })
  pending.resolve()
  await loading
  expect(appStore.config).toEqual({ permission_mode: "ask", locale: "zh-CN" })
})
