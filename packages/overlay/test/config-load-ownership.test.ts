import { afterEach, beforeEach, expect, test } from "bun:test"
import { ApiError, captureApiAuthority, configure } from "../src/services/api"
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
  setAppStore({ config: { permission_mode: "ask" }, providerCatalog: null, channelCatalog: null })
})
afterEach(() => __setHostTransportForTest(undefined))

test("project load publishes its complete configuration and settled channel resources", async () => {
  const accepted = { server: { hostname: "127.0.0.1" }, locale: "zh-CN" }
  const channels = [{ id: "owned-channel", status: "missing" }]
  setConfigSnapshot({ server: { hostname: "127.0.0.1", publicUrl: "http://127.0.0.1:2" }, model: "owned/previous" })
  transport((request) => request.path === "config" ? accepted : channels)
  const observed: Record<string, unknown>[] = []
  expect(await loadConfigInfo(undefined, { onAcceptedConfig: (config) => { observed.push(config) } })).toEqual([])
  expect(observed).toEqual([accepted])
  expect({ config: appStore.config, catalog: appStore.channelCatalog, issues: appStore.configLoadIssues }).toEqual({
    config: accepted,
    catalog: { directory: "C:/Project-A", authorityRevision: captureApiAuthority().revision, entries: channels },
    issues: [],
  })
})

test("a fast project configuration becomes usable while the catalog is still reading", async () => {
  const pending = Promise.withResolvers<unknown[]>()
  const accepted = { permission_mode: "full_access", server: { publicUrl: "https://first.example.invalid" } }
  const newer = { permission_mode: "ask", server: { publicUrl: "https://second.example.invalid" } }
  const channels = [{ id: "current-channel", status: "missing" }]
  transport((request) => request.path === "config" ? accepted : pending.promise)
  const observed: Record<string, unknown>[] = []
  const loading = loadConfigInfo(undefined, { onAcceptedConfig: (config) => { observed.push(config) } })

  await new Promise<void>((resolve) => setImmediate(resolve))
  expect(appStore.config).toEqual(accepted)

  setConfigSnapshot(newer)
  pending.resolve(channels)
  expect(await loading).toEqual([])
  expect({ config: appStore.config, catalog: appStore.channelCatalog, receipts: observed }).toEqual({
    config: newer,
    catalog: { directory: "C:/Project-A", authorityRevision: captureApiAuthority().revision, entries: channels },
    receipts: [accepted],
  })
})

test("a fast channel catalog becomes readable while configuration is still reading", async () => {
  const pending = Promise.withResolvers<Record<string, unknown>>()
  const accepted = { permission_mode: "full_access", locale: "zh-CN" }
  const channels = [{ id: "current-channel", status: "missing" }]
  transport((request) => request.path === "config" ? pending.promise : channels)
  const loading = loadConfigInfo()

  await new Promise<void>((resolve) => setImmediate(resolve))
  const catalog = { directory: "C:/Project-A", authorityRevision: captureApiAuthority().revision, entries: channels }
  expect(appStore.channelCatalog).toEqual(catalog)

  pending.resolve(accepted)
  expect(await loading).toEqual([])
  expect({ config: appStore.config, catalog: appStore.channelCatalog }).toEqual({ config: accepted, catalog })
})

test("the selected project owns both read projections after an earlier project partially settled", async () => {
  const pending = Promise.withResolvers<unknown[]>()
  const first = { permission_mode: "full_access", server: { publicUrl: "https://first.example.invalid" } }
  const second = { permission_mode: "ask", server: { publicUrl: "https://second.example.invalid" } }
  const secondChannels = [{ id: "second-channel", status: "missing" }]
  transport((request) => {
    if (request.query?.directory === "C:/Project-A") return request.path === "config" ? first : pending.promise
    return request.path === "config" ? second : secondChannels
  })
  const firstLoad = loadConfigInfo()
  await new Promise<void>((resolve) => setImmediate(resolve))
  expect(appStore.config).toEqual(first)

  setSettingsStore("directory", "C:/Project-B")
  configure({ directory: "C:/Project-B" })
  await loadConfigInfo()
  pending.resolve([{ id: "first-channel", status: "missing" }])
  await firstLoad
  expect({ config: appStore.config, catalog: appStore.channelCatalog }).toEqual({
    config: second,
    catalog: { directory: "C:/Project-B", authorityRevision: captureApiAuthority().revision, entries: secondChannels },
  })
})

test("a rejected configuration read retains its original diagnostic and accepts the channel result", async () => {
  const accepted = { permission_mode: "ask", locale: "en-US" }
  const channels = [{ id: "owned-channel", status: "missing" }]
  const error = new ApiError(409, "config?directory=C%3A%2FProject-A", {
    name: "NonCanonicalConfigFileError",
    data: {
      canonical: "C:/Project-A/.opencorvus/opencorvus.jsonc",
      conflicts: ["C:/Project-A/.opencorvus/opencorvus.json"],
      message: "Read the canonical configuration file.",
    },
  }, { "x-opencorvus-request-id": "config-read-409" }, "GET")
  setConfigSnapshot(accepted)
  transport((request) => {
    if (request.path === "config") throw error
    return channels
  })

  const issues = await loadConfigInfo()
  expect(issues).toEqual([{ resource: "config", message: "Read the canonical configuration file.", cause: error }])
  expect(appStore.configLoadIssues[0]?.cause).toBe(error)
  expect({ config: appStore.config, entries: appStore.channelCatalog?.entries }).toEqual({ config: accepted, entries: channels })
})

test("the channel catalog distinguishes a read failure from an accepted empty result", async () => {
  const acceptedConfig = { permission_mode: "ask", locale: "zh-CN" }
  const error = new ApiError(503, "channel?directory=C%3A%2FProject-A", "Catalog reader unavailable", {}, "GET")
  const scope = { directory: "C:/Project-A", authorityRevision: captureApiAuthority().revision }
  transport((request) => {
    if (request.path === "channel") throw error
    return acceptedConfig
  })
  const issues = await loadConfigInfo()
  expect(issues).toEqual([{ resource: "channel", message: error.message, cause: error }])
  expect(appStore.channelCatalog).toEqual({ ...scope, entries: null, failure: issues[0] })
  expect(appStore.config).toEqual(acceptedConfig)

  transport((request) => request.path === "channel" ? [] : acceptedConfig)
  await loadConfigInfo()
  expect(appStore.channelCatalog).toEqual({ ...scope, entries: [] })
})

test("channel read failure keeps only the accepted catalog for its own project and connection", async () => {
  const acceptedEntries = [{ id: "owned-channel", status: "missing" }]
  const acceptedConfig = { permission_mode: "ask" }
  const error = new ApiError(503, "channel", "Catalog reader unavailable", {}, "GET")
  transport((request) => request.path === "channel" ? acceptedEntries : acceptedConfig)
  await loadConfigInfo()
  transport((request) => {
    if (request.path === "channel") throw error
    return acceptedConfig
  })
  const issues = await loadConfigInfo()
  expect(appStore.channelCatalog).toEqual({
    directory: "C:/Project-A", authorityRevision: captureApiAuthority().revision, entries: acceptedEntries, failure: issues[0],
  })

  setSettingsStore("directory", "C:/Project-B")
  configure({ directory: "C:/Project-B" })
  const newIssues = await loadConfigInfo()
  expect(appStore.channelCatalog).toEqual({
    directory: "C:/Project-B", authorityRevision: captureApiAuthority().revision, entries: null, failure: newIssues[0],
  })
})

test("directory-free workspace refresh publishes global configuration and its empty project inventory", async () => {
  setAppStore("channelCatalog", {
    directory: "C:/Project-A", authorityRevision: captureApiAuthority().revision, entries: [{ id: "prior-project" }],
  })
  setSettingsStore("directory", "")
  configure({ directory: "" })
  const accepted = { permission_mode: "ask", locale: "zh-CN" }
  const requests: TransportRequest[] = []
  transport((request) => {
    requests.push(request)
    return accepted
  })
  expect(await reloadProjectScope()).toEqual([])
  expect({ config: appStore.config, channelCatalog: appStore.channelCatalog, configIssues: appStore.configLoadIssues, issues: appStore.projectLoadIssues }).toEqual({
    config: accepted, channelCatalog: null, configIssues: [], issues: [],
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
