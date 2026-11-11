import { afterEach, beforeEach, expect, test } from "bun:test"
import { createComputed, createRoot } from "solid-js"
import { captureApiAuthority, configure } from "../src/services/api"
import { queryWithDirectory } from "../src/services/api-state"
import { currentProjectConfigRequestOptions, patchConfig, patchGlobalConfig, reloadProjectScope, updateConfig, updateGlobalConfig } from "../src/services/config"
import { loadConfigInfo, loadProviderInfo } from "../src/services/config-load"
import { setPermissionMode } from "../src/services/permission-mode"
import { boardStore, setBoardStore } from "../src/store/board"
import { appStore, setAppStore } from "../src/store/app"
import { applySettings, bootstrapOverlaySettings, DEFAULT_SETTINGS, loadSettings, settingsStore, setSettingsStore } from "../src/store/settings"
import { activeDirectory, closeProject, leaveUnavailableProject, requestWorkspaceSelection } from "../src/services/workspace"
import { HOST_CAPABILITIES, type HostTransport, type TransportRequest, type TransportResponse } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { setLocale } from "../src/utils/i18n"
import { installRealOverlayI18n } from "./fixtures/i18n"
import type { PersistedOverlaySettings } from "../src/services/persisted-overlay-settings"

installRealOverlayI18n()
const A = "http://project-aba-a.invalid"
const B = "http://project-aba-b.invalid"
const directory = "/owned/project-a"
const sourceA = { kind: "session" as const, id: "ses_a", directory, sessionKind: "conversation" as const }
const sourceB = { ...sourceA, id: "ses_b", directory: "/owned/project-b" }
const ok = (body: unknown): TransportResponse<unknown> => ({ status: 200, ok: true, headers: {}, body })
let persisted: PersistedOverlaySettings
let requests: TransportRequest[]
let reply: (request: TransportRequest) => Promise<TransportResponse<unknown>>
let persist: (value: PersistedOverlaySettings) => Promise<void>
const originalFrame = globalThis.requestAnimationFrame

function jsonBody(request: TransportRequest): Record<string, unknown> {
  if (request.body?.kind !== "json") throw new Error("Expected canonical JSON request")
  return request.body.value as Record<string, unknown>
}
function install() {
  __setHostTransportForTest({
    kind: "tauri", capabilities: HOST_CAPABILITIES.tauri,
    async request<T>(request: TransportRequest): Promise<TransportResponse<T>> {
      requests.push(request)
      return await reply(request) as TransportResponse<T>
    },
    openStream() { throw new Error("This fixture only implements configuration requests") },
    async native(command) {
      if (command.kind === "settings.load") return structuredClone(persisted)
      if (command.kind === "settings.save") {
        await persist(command.payload)
        persisted = structuredClone(command.payload)
        return true
      }
      throw new Error(`Unexpected configuration fixture command ${command.kind}`)
    },
  } satisfies HostTransport)
}
function selectFixture(source: typeof sourceA) {
  setBoardStore({ selectedSource: source, board: { kind: "session", sessionID: source.id }, taskSwitching: false })
}
async function projectABA() {
  await requestWorkspaceSelection(sourceB)
  selectFixture(sourceB)
  await requestWorkspaceSelection(sourceA)
  selectFixture(sourceA)
}
function connectB() {
  setSettingsStore("serverUrl", B)
  configure({ serverUrl: B })
  setAppStore("config", { marker: "current-B", locale: "en-US", permission_mode: "ask" })
}

beforeEach(async () => {
  globalThis.requestAnimationFrame = (callback) => {
    queueMicrotask(() => callback(performance.now()))
    return 0
  }
  applySettings({ ...DEFAULT_SETTINGS, serverUrl: A, autoServer: false, directory, savedDirectory: directory, locale: "en-US" })
  configure({ serverUrl: A, directory, username: "opencorvus", password: "" })
  persisted = bootstrapOverlaySettings()
  requests = []
  reply = async (request) => ok(jsonBody(request))
  persist = async () => {}
  install()
  await loadSettings()
  await setLocale("en-US")
  selectFixture(sourceA)
  setAppStore({ connected: true, config: { marker: "initial-A" } })
})
afterEach(async () => {
  // setPermissionMode intentionally returns void; one event-loop boundary
  // drains already-resolved fixture microtasks without a production test accessor.
  await new Promise<void>((resolve) => setImmediate(resolve))
  globalThis.requestAnimationFrame = originalFrame
  __setHostTransportForTest(undefined)
  setBoardStore({ selectedSource: null, board: null, taskSwitching: false })
  setAppStore({ connected: false, config: null })
  applySettings(DEFAULT_SETTINGS)
  configure({ serverUrl: DEFAULT_SETTINGS.serverUrl, directory: "", username: "opencorvus", password: "" })
  await setLocale("en-US")
})

test("admitted transient A/B/A selections advance the shared selection epoch before directory storage changes", async () => {
  const epoch = boardStore.selectEpoch
  const directoryEpoch = settingsStore.directoryEpoch
  const authority = captureApiAuthority()
  await projectABA()
  expect({ epoch: boardStore.selectEpoch, directoryEpoch: settingsStore.directoryEpoch, authority: captureApiAuthority(), source: boardStore.selectedSource }).toEqual({
    epoch: epoch + 2, directoryEpoch, authority, source: sourceA,
  })
  expect(await requestWorkspaceSelection(sourceA)).toEqual({ kind: "unchanged" })
  expect(boardStore.selectEpoch).toBe(epoch + 2)
})

test.each([
  ["operator close", closeProject],
  ["unavailable active directory", () => leaveUnavailableProject(directory)],
] as const)("%s publishes one coherent transition to the global configuration scope", async (_, leave) => {
  const epoch = boardStore.selectEpoch
  const directoryEpoch = settingsStore.directoryEpoch
  const globalConfig = { marker: "accepted-global" }
  reply = async () => ok(globalConfig)
  const scope = () => ({
    epoch: boardStore.selectEpoch,
    directoryEpoch: settingsStore.directoryEpoch,
    active: activeDirectory(),
    source: boardStore.selectedSource?.id ?? null,
    apiDirectory: queryWithDirectory("config")?.directory ?? "",
  })
  const scopes: ReturnType<typeof scope>[] = []
  const dispose = createRoot((dispose) => {
    createComputed(() => {
      scopes.push(scope())
    })
    return dispose
  })
  try {
    await leave()
    expect(scopes).toEqual([
      { epoch, directoryEpoch, active: directory, source: sourceA.id, apiDirectory: directory },
      { epoch: epoch + 1, directoryEpoch: directoryEpoch + 1, active: "", source: null, apiDirectory: "" },
    ])
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(requests.map(({ path, query }) => ({ path, query }))).toEqual([{ path: "global/config", query: undefined }])
    expect({ config: appStore.config, savedDirectory: persisted.directory, session: persisted.workspaceTaskID }).toEqual({
      config: globalConfig, savedDirectory: undefined, session: undefined,
    })
  } finally {
    dispose()
  }
})

test("a late project catalog leaves the accepted global catalog and configuration current after close", async () => {
  const pendingProjectCatalog = Promise.withResolvers<TransportResponse<unknown>>()
  const globalCatalog = { all: [{ id: "global-provider" }], connected: [] }
  const globalConfig = { marker: "accepted-global" }
  reply = async (request) => {
    switch (request.path) {
      case "provider": return pendingProjectCatalog.promise
      case "global/providers": return ok({ catalog: globalCatalog })
      case "global/config": return ok(globalConfig)
      case "provider/auth":
      case "global/providers/auth": return ok({})
      default: throw new Error(`Unexpected provider route ${request.path}`)
    }
  }
  const projectRead = loadProviderInfo()
  try {
    await closeProject()
    expect(await loadProviderInfo()).toEqual([])
  } finally {
    pendingProjectCatalog.resolve(ok({ all: [{ id: "project-provider" }], connected: [] }))
    await projectRead
  }
  expect({ directory: activeDirectory(), catalog: appStore.providerCatalog, config: appStore.config }).toEqual({
    directory: "", catalog: globalCatalog, config: globalConfig,
  })
})

test("stable project config projects and returns its exact accepted response", async () => {
  const response = { marker: "accepted-A", locale: "zh-CN" }
  reply = async () => ok(response)
  expect(await patchConfig({ locale: "zh-CN" }, currentProjectConfigRequestOptions())).toEqual(response)
  expect(appStore.config).toEqual(response)
})

test.each(["delayed", "already accepted"] as const)("a project commit keeps its accepted configuration with an %s read and a pending channel", async (timing) => {
  const earlierConfig = Promise.withResolvers<TransportResponse<unknown>>()
  const pendingChannel = Promise.withResolvers<TransportResponse<unknown>>()
  const previous = { locale: "en-US" }
  const saved = { locale: "zh-CN" }
  const channels = [{ id: "owned-channel", status: "missing" }]
  const observed: Record<string, unknown>[] = []
  reply = async (request) => {
    if (request.path === "channel") return pendingChannel.promise
    if (request.method === "PATCH") return ok(saved)
    return earlierConfig.promise
  }
  const reading = loadConfigInfo(undefined, { onAcceptedConfig: (config) => { observed.push(config) } })
  try {
    if (timing === "already accepted") {
      earlierConfig.resolve(ok(previous))
      await new Promise<void>((resolve) => setImmediate(resolve))
      expect(appStore.config).toEqual(previous)
    }
    expect(await patchConfig(saved, currentProjectConfigRequestOptions())).toEqual(saved)
  } finally {
    earlierConfig.resolve(ok(previous))
    pendingChannel.resolve(ok(channels))
    await reading
  }
  expect(appStore.config).toEqual(saved)
  expect(appStore.channelCatalog?.entries).toEqual(channels)

  const current = { locale: "zh-CN", model: "review/one" }
  reply = async (request) => ok(request.path === "channel" ? channels : current)
  await loadConfigInfo(undefined, { onAcceptedConfig: (config) => { observed.push(config) } })
  expect({ config: appStore.config, receipts: observed }).toEqual({ config: current, receipts: [current] })
})

test("a global save returns its receipt while the selected project's configuration keeps ownership", async () => {
  const current = { locale: "en-US", marker: "active-project" }
  const global = { locale: "zh-CN", marker: "global" }
  setSettingsStore("directory", "")
  setAppStore("config", current)
  reply = async () => ok(global)
  expect(await patchGlobalConfig(global)).toEqual(global)
  expect(appStore.config).toEqual(current)
})

test("a global update keeps its accepted configuration when an earlier global read settles", async () => {
  setBoardStore({ selectedSource: null, board: null })
  setSettingsStore("directory", "")
  configure({ directory: "" })
  const earlierConfig = Promise.withResolvers<TransportResponse<unknown>>()
  const saved = { locale: "zh-CN" }
  let reads = 0
  reply = async (request) => {
    expect(request.path).toBe("global/config")
    if (request.method === "PATCH") return ok(saved)
    return ++reads === 1 ? earlierConfig.promise : ok({ locale: "en-US" })
  }
  const reading = loadConfigInfo()
  try {
    expect(await updateGlobalConfig((config) => { config.locale = "zh-CN" })).toEqual(saved)
  } finally {
    earlierConfig.resolve(ok({ locale: "en-US" }))
    await reading
  }
  expect(appStore.config).toEqual(saved)
})

test("an unchanged project update returns its own read while the accepted commit remains current", async () => {
  const previous = { locale: "en-US" }
  const saved = { locale: "zh-CN" }
  const earlierConfig = Promise.withResolvers<TransportResponse<unknown>>()
  reply = async (request) => request.method === "GET" ? earlierConfig.promise : ok(saved)
  const checking = updateConfig(() => {}, currentProjectConfigRequestOptions())
  try {
    expect(await patchConfig(saved, currentProjectConfigRequestOptions())).toEqual(saved)
  } finally {
    earlierConfig.resolve(ok(previous))
  }
  expect(await checking).toEqual(previous)
  expect(appStore.config).toEqual(saved)
})

test("a committed global error preserves its typed receipt and accepted snapshot across an earlier read failure", async () => {
  setBoardStore({ selectedSource: null, board: null })
  setSettingsStore("directory", "")
  configure({ directory: "" })
  const earlierConfig = Promise.withResolvers<TransportResponse<unknown>>()
  const accepted = { locale: "zh-CN" }
  const receipt = {
    name: "GlobalConfigCommittedReconcileError",
    data: { committed: true, message: "Runtime reconciliation failed", config: accepted, failures: ["runtime"] },
  }
  const earlierIssue = { name: "AuthReadError", data: { message: "Earlier configuration unavailable" } }
  reply = async (request) => request.method === "GET"
    ? earlierConfig.promise
    : { status: 409, ok: false, headers: {}, body: receipt }
  const reading = loadConfigInfo()
  try {
    await expect(patchGlobalConfig(accepted)).rejects.toMatchObject({ status: 409, body: receipt })
  } finally {
    earlierConfig.resolve({ status: 503, ok: false, headers: {}, body: earlierIssue })
  }
  expect(await reading).toEqual([])
  expect({ config: appStore.config, issues: appStore.configLoadIssues }).toEqual({ config: accepted, issues: [] })
})

test.each(["project", "global"] as const)("reversed %s write responses preserve each receipt and refresh the complete projection", async (scope) => {
  const project = scope === "project"
  if (!project) {
    setBoardStore({ selectedSource: null, board: null })
    setSettingsStore("directory", "")
    configure({ directory: "" })
  }
  const path = project ? "config" : "global/config"
  const options = project ? currentProjectConfigRequestOptions() : undefined
  const earlierResponse = Promise.withResolvers<TransportResponse<unknown>>()
  const refreshedResponse = Promise.withResolvers<TransportResponse<unknown>>()
  const original = { locale: "zh-CN", name: "Before" }
  const later = { locale: "zh-CN", name: "After" }
  const refreshed = { ...later, marker: "current-server-value" }
  let reads = 0
  reply = async (request) => {
    expect(request.path).toBe(path)
    if (request.method === "PATCH") return jsonBody(request).locale ? earlierResponse.promise : ok(later)
    return ++reads === 1 ? ok(original) : refreshedResponse.promise
  }
  const earlier = project ? patchConfig({ locale: "zh-CN" }, options) : patchGlobalConfig({ locale: "zh-CN" })
  try {
    const rename = (value: Record<string, unknown>) => { value.name = "After" }
    expect(await (project ? updateConfig(rename, options) : updateGlobalConfig(rename))).toEqual(later)
    earlierResponse.resolve(ok(original))
    expect(await earlier).toEqual(original)
    expect(appStore.config).toEqual(later)
    refreshedResponse.resolve(ok(refreshed))
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(appStore.config).toEqual(refreshed)
  } finally {
    earlierResponse.resolve(ok(original))
    refreshedResponse.resolve(ok(refreshed))
    await earlier
  }
})

test("an overlapping committed project error keeps the current read and reports the actual refresh failure", async () => {
  const delayed = Promise.withResolvers<TransportResponse<unknown>>()
  const pendingChannel = Promise.withResolvers<TransportResponse<unknown>>()
  const accepted = { locale: "zh-CN", name: "Latest read" }
  const channels = [{ id: "owned-channel", status: "missing" }]
  const receipt = {
    name: "ProjectConfigCommittedReconcileError",
    data: { committed: true, message: "Runtime reconciliation failed", config: { locale: "zh-CN" }, failures: ["runtime"] },
  }
  let reads = 0
  reply = async (request) => {
    if (request.method === "PATCH") return delayed.promise
    if (request.path === "channel") return pendingChannel.promise
    if (++reads === 1) return ok(accepted)
    return { status: 503, ok: false, headers: {}, body: { error: "Current configuration unavailable" } }
  }
  const saving = patchConfig({ locale: "zh-CN" }, currentProjectConfigRequestOptions())
  const reading = loadConfigInfo()
  try {
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(appStore.config).toEqual(accepted)
    delayed.resolve({ status: 409, ok: false, headers: {}, body: receipt })
    await expect(saving).rejects.toMatchObject({ status: 409, body: receipt })
  } finally {
    delayed.resolve({ status: 409, ok: false, headers: {}, body: receipt })
    pendingChannel.resolve(ok(channels))
    await reading
  }
  expect(appStore.config).toEqual(accepted)
  expect(appStore.channelCatalog?.entries).toEqual(channels)
  expect(appStore.configLoadIssues.map(({ resource, message }) => ({ resource, message }))).toEqual([{
    resource: "config",
    message: "Current configuration unavailable",
  }])
})

test("project ABA preserves a pending PATCH's accepted A return and the current A projection", async () => {
  const pending = Promise.withResolvers<TransportResponse<unknown>>()
  reply = () => pending.promise
  const response = { marker: "accepted-old-A" }
  const operation = patchConfig({ marker: "accepted-old-A" }, currentProjectConfigRequestOptions())
  await projectABA()
  setAppStore("config", { marker: "current-new-A" })
  pending.resolve(ok(response))
  expect(await operation).toEqual(response)
  expect(appStore.config).toEqual({ marker: "current-new-A" })
})

test("retained project options keep their captured selection even when passed after A/B/A", async () => {
  const options = currentProjectConfigRequestOptions()
  await projectABA()
  setAppStore("config", { marker: "current-new-A" })
  const response = { marker: "accepted-original-A" }
  reply = async () => ok(response)
  expect(await patchConfig(response, options)).toEqual(response)
  expect(appStore.config).toEqual({ marker: "current-new-A" })
})

test("a committed reconciliation error preserves its original receipt after project ABA", async () => {
  const pending = Promise.withResolvers<TransportResponse<unknown>>()
  reply = () => pending.promise
  const body = { name: "ProjectConfigCommittedReconcileError", data: { committed: true, message: "Project configuration committed, but its runtime projection did not fully settle", config: { marker: "accepted-old-A" }, failures: ["runtime reconciliation failed"] } }
  const operation = patchConfig({ marker: "accepted-old-A" }, currentProjectConfigRequestOptions())
  await projectABA()
  setAppStore("config", { marker: "current-new-A" })
  pending.resolve({ status: 409, ok: false, headers: {}, body })
  await expect(operation).rejects.toMatchObject({ name: "ApiError", status: 409, body })
  expect(appStore.config).toEqual({ marker: "current-new-A" })
})

test("GET-to-PATCH retains original project request and saved return across UI departure", async () => {
  const get = Promise.withResolvers<TransportResponse<unknown>>()
  reply = (request) => request.method === "GET" ? get.promise : Promise.resolve(ok({ marker: "accepted-A", locale: "zh-CN" }))
  const operation = updateConfig((config) => { config.locale = "zh-CN" }, currentProjectConfigRequestOptions())
  await projectABA()
  setAppStore("config", { marker: "current-new-A" })
  get.resolve(ok({ marker: "accepted-A", locale: "en-US" }))
  expect(await operation).toEqual({ marker: "accepted-A", locale: "zh-CN" })
  expect(requests.map((request) => ({ method: request.method, path: request.path, directory: request.query?.directory, body: request.body }))).toEqual([
    { method: "GET", path: "config", directory, body: undefined },
    { method: "PATCH", path: "config", directory, body: { kind: "json", value: { locale: "zh-CN" } } },
  ])
  expect(appStore.config).toEqual({ marker: "current-new-A" })
})

test("permission tail retires queued A authority and then applies a newly authored B choice", async () => {
  const entered = Promise.withResolvers<void>()
  const first = Promise.withResolvers<TransportResponse<unknown>>()
  const last = Promise.withResolvers<void>()
  const original = captureApiAuthority()
  reply = (request) => {
    if (requests.length === 1) { entered.resolve(); return first.promise }
    last.resolve()
    return Promise.resolve(ok(jsonBody(request)))
  }
  setPermissionMode("full_access")
  await entered.promise
  setPermissionMode("ask")
  connectB()
  const current = captureApiAuthority()
  setPermissionMode("full_access")
  first.resolve(ok({ permission_mode: "full_access" }))
  await last.promise
  await new Promise<void>((resolve) => setImmediate(resolve))
  expect(requests.map((request) => ({ authority: request.authority, body: request.body, directory: request.query?.directory }))).toEqual([
    { authority: original, body: { kind: "json", value: { permission_mode: "full_access" } }, directory },
    { authority: current, body: { kind: "json", value: { permission_mode: "full_access" } }, directory },
  ])
  expect(appStore.config.permission_mode).toBe("full_access")
})

test("retired project reload returns its existing empty outcome while current configuration, issues and directory retain ownership", async () => {
  const pending = Promise.withResolvers<void>()
  reply = async (request) => {
    if (["config", "channel", "mcp", "skill/mounts"].includes(request.path)) await pending.promise
    if (request.path === "config") return ok({ marker: "old-A-config" })
    if (request.path === "channel") return ok([])
    if (request.path === "mcp") return ok({ oldA: { status: "connected" } })
    if (request.path === "skill/mounts") return { status: 503, ok: false, headers: {}, body: { error: "old-A skills failure" } }
    if (request.path === "path") return ok({ directory })
    if (request.path === "vcs") return ok({ initialized: false, hasRemote: false })
    if (request.path === "global/tasks") return ok({ tasks: [] })
    throw new Error(`Unexpected reload fixture route ${request.path}`)
  }
  const loading = reloadProjectScope({ restoreWorkspace: true })
  await projectABA()
  const currentIssue = { resource: "config" as const, message: "current A issue" }
  setAppStore({ config: { marker: "current-new-A" }, mcp: { currentA: { status: "connected" } }, projectLoadIssues: [currentIssue] })
  setSettingsStore({ directory, savedDirectory: "/owned/other-saved-directory" })
  pending.resolve()
  expect(await loading).toEqual([])
  expect({ config: appStore.config, mcp: appStore.mcp, issues: appStore.projectLoadIssues, directory: settingsStore.directory }).toEqual({
    config: { marker: "current-new-A" }, mcp: { currentA: { status: "connected" } }, issues: [currentIssue], directory,
  })
})

test("current project reload publishes exact accepted configuration and extension failure issues", async () => {
  reply = async (request) => {
    if (request.path === "config") return ok({ marker: "accepted-current-A" })
    if (request.path === "channel") return ok([])
    if (request.path === "mcp") return ok({ currentA: { status: "connected" } })
    if (request.path === "skill/mounts") return { status: 503, ok: false, headers: {}, body: { error: "owned current skills failure" } }
    if (request.path === "path") return ok({ directory })
    if (request.path === "vcs") return ok({ initialized: false, hasRemote: false })
    if (request.path === "global/tasks") return ok({ tasks: [] })
    throw new Error(`Unexpected reload fixture route ${request.path}`)
  }
  const issues = await reloadProjectScope()
  expect(issues).toEqual([{ resource: "extensions", message: "skills: API 503 skill/mounts?directory=%2Fowned%2Fproject-a: owned current skills failure" }])
  expect({ config: appStore.config, mcp: appStore.mcp, issues: appStore.projectLoadIssues }).toEqual({
    config: { marker: "accepted-current-A" }, mcp: { currentA: { status: "connected" } }, issues,
  })
})
