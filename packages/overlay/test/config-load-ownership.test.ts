import { afterEach, beforeEach, expect, test } from "bun:test"
import { configure } from "../src/services/api"
import { loadConfigInfo, loadProviderInfo } from "../src/services/config-load"
import { reloadProjectScope } from "../src/services/config"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type { HostTransport, TransportRequest } from "../src/services/host-transport"
import { appStore, setAppStore, setConfigSnapshot } from "../src/store/app"
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

test("project load publishes its complete configuration and settled channel resources", async () => {
  const accepted = { server: { hostname: "127.0.0.1" }, locale: "zh-CN" }
  const channels = [{ id: "owned-channel", status: "missing" }]
  setConfigSnapshot({ server: { hostname: "127.0.0.1", publicUrl: "http://127.0.0.1:2" }, model: "owned/previous" })
  transport((request) => request.path === "config" ? accepted : channels)
  expect(await loadConfigInfo()).toEqual([])
  expect({ config: appStore.config, channels: appStore.channels, issues: appStore.configLoadIssues }).toEqual({
    config: accepted, channels, issues: [],
  })
})

test("directory-free workspace refresh publishes global configuration and its empty project inventory", async () => {
  setSettingsStore("directory", "")
  configure({ directory: "" })
  setAppStore("channels", [{ id: "prior-project" }])
  const accepted = { permission_mode: "ask", locale: "zh-CN" }
  const requests: TransportRequest[] = []
  transport((request) => {
    requests.push(request)
    return accepted
  })
  expect(await reloadProjectScope()).toEqual([])
  expect({ config: appStore.config, channels: appStore.channels, configIssues: appStore.configLoadIssues, issues: appStore.projectLoadIssues }).toEqual({
    config: accepted, channels: [], configIssues: [], issues: [],
  })
  expect(requests.map(({ method, path }) => ({ method, path }))).toEqual([{ method: "GET", path: "global/config" }])
})

test("renewed global selection keeps the configuration accepted by its current provider read", async () => {
  setSettingsStore("directory", "")
  configure({ directory: "" })
  const old = Promise.withResolvers<Record<string, unknown>>()
  transport(() => old.promise)
  const loading = loadConfigInfo()
  setBoardStore("selectEpoch", (value) => value + 2)
  const accepted = { permission_mode: "ask", locale: "zh-CN" }
  const catalog = { connected: ["current-global"] }
  transport((request) => request.path === "global/config" ? accepted : request.path === "global/providers" ? { catalog } : {})
  await loadProviderInfo()
  old.resolve({ permission_mode: "full_access", locale: "en-US" })
  await loading
  expect({ config: appStore.config, catalog: appStore.providerCatalog }).toEqual({ config: accepted, catalog })
})

test("global provider load publishes the complete global configuration with catalog and authentication", async () => {
  setSettingsStore("directory", "")
  const accepted = { locale: "en-US" }
  const catalog = { connected: ["owned-global"] }
  const authentication = { "owned-global": { type: "api" } }
  setConfigSnapshot({ server: { publicUrl: "http://127.0.0.1:2" }, locale: "zh-CN" })
  transport((request) => request.path === "global/providers"
    ? { catalog }
    : request.path === "global/config" ? accepted : authentication)
  expect(await loadProviderInfo(undefined, { directory: "" })).toEqual([])
  expect({ config: appStore.config, catalog: appStore.providerCatalog, authentication: appStore.providerAuth, issues: appStore.providerLoadIssues }).toEqual({
    config: accepted, catalog, authentication, issues: [],
  })
})

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
