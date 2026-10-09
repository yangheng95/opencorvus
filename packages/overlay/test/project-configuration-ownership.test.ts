import { afterEach, beforeEach, expect, test } from "bun:test"
import { captureApiAuthority, configure } from "../src/services/api"
import { currentProjectConfigRequestOptions, patchConfig, reloadProjectScope, updateConfig } from "../src/services/config"
import { setPermissionMode } from "../src/services/permission-mode"
import { boardStore, setBoardStore } from "../src/store/board"
import { appStore, setAppStore } from "../src/store/app"
import { applySettings, bootstrapOverlaySettings, DEFAULT_SETTINGS, loadSettings, settingsStore, setSettingsStore } from "../src/store/settings"
import { requestWorkspaceSelection } from "../src/services/workspace"
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

test("stable project config projects and returns its exact accepted response", async () => {
  const response = { marker: "accepted-A", locale: "zh-CN" }
  reply = async () => ok(response)
  expect(await patchConfig({ locale: "zh-CN" }, currentProjectConfigRequestOptions())).toEqual(response)
  expect(appStore.config).toEqual(response)
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
  const body = { name: "ProjectConfigCommittedReconcileError", data: { committed: true, config: { marker: "accepted-old-A" }, failures: ["runtime reconciliation failed"] } }
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
