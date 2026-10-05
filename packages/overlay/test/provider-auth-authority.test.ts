import { afterEach, beforeEach, expect, test } from "bun:test"
import { ApiAuthorityChangedError, captureApiAuthority, configure, renewApiAuthority } from "../src/services/api"
import { HOST_CAPABILITIES, type HostTransport, type TransportRequest } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { authenticateSelectedProvider, authorizeProvider, executeProviderAuth, providerAuthInputs, type AuthDialogCallbacks } from "../src/services/llm"
import { requestProviderCatalogRefresh } from "../src/services/provider-refresh"
import { setAppStore } from "../src/store/app"
import { setLocaleData } from "../src/utils/i18n"
import enUS from "../src/i18n/en-US.json"

const requests: TransportRequest[] = []
function localTransport(response: (request: TransportRequest) => unknown): HostTransport {
  return {
    kind: "browser", capabilities: HOST_CAPABILITIES.browser,
    async request<T>(request: TransportRequest) {
      requests.push(request)
      return { status: 200, ok: true, headers: {}, body: response(request) as T }
    },
    openStream() { return { close() {} } },
    async native() { throw new Error("Local service qualification uses only explicit dialog callbacks") },
  }
}
function dialogs(overrides: Partial<AuthDialogCallbacks> = {}): AuthDialogCallbacks {
  return {
    nativePrompt: async () => "DUMMY_NON_CREDENTIAL",
    nativeSelect: async () => "0", nativeConfirm: async () => true,
    nativeOpen: async () => true, externalUrlNeedsUserGesture: false,
    showLlmNotice() {}, onAuthCancelled() {}, ...overrides,
  }
}
beforeEach(() => {
  requests.length = 0
  setLocaleData("en-US", enUS)
  configure({ serverUrl: "http://local-authority.invalid", username: "dummy", password: "", directory: "" })
  setAppStore({ providerAuth: { dummy: [{ type: "api", label: "Dummy API" }] } })
})
afterEach(() => { __setHostTransportForTest(undefined); configure({ serverUrl: "http://127.0.0.1:7878", username: "opencorvus", password: "", directory: "" }) })

for (const directory of ["", "D:/dummy-project"]) {
  test(`API authentication preserves one entry token and exact body in ${directory || "global"} scope`, async () => {
    const authority = captureApiAuthority()
    __setHostTransportForTest(localTransport((r) => r.path.endsWith("prompts") ? [] : { ok: true }))
    expect(await authenticateSelectedProvider("dummy", dialogs(), { directory, authority })).toBe(true)
    expect(requests.map((r) => ({ path: r.path, authority: r.authority, query: r.query, body: r.body }))).toEqual([
      { path: directory ? "provider/dummy/auth/prompts" : "global/providers/dummy/auth/prompts", authority, query: directory ? { directory } : undefined, body: { kind: "json", value: { method: 0, inputs: {} } } },
      { path: directory ? "provider/dummy/auth/execute" : "global/providers/dummy/auth/execute", authority, query: directory ? { directory } : undefined, body: { kind: "json", value: { method: 0, inputs: { key: "DUMMY_NON_CREDENTIAL" } } } },
    ])
  })
}

test("API key modal completion returns the original typed retirement contract", async () => {
  const authority = captureApiAuthority()
  __setHostTransportForTest(localTransport(() => []))
  const error = await authenticateSelectedProvider("dummy", dialogs({ nativePrompt: async () => { renewApiAuthority(); return "DUMMY_NON_CREDENTIAL" } }), { authority }).catch((e) => e)
  expect(error).toBeInstanceOf(ApiAuthorityChangedError)
  expect({ phase: error.phase, expected: error.expectedRevision, current: error.currentRevision, outcome: error.outcome }).toEqual({ phase: "before_dispatch", expected: authority.revision, current: authority.revision + 1, outcome: { phase: "before_dispatch" } })
})

test("method selection preserves original authority after native renewal", async () => {
  setAppStore({ providerAuth: { dummy: [{ type: "api", label: "First" }, { type: "api", label: "Second" }] } })
  const authority = captureApiAuthority()
  const error = await authenticateSelectedProvider("dummy", dialogs({ nativeSelect: async () => { renewApiAuthority(); return "1" } }), { authority }).catch((e) => e)
  expect(error).toMatchObject({ name: "ApiAuthorityChangedError", phase: "before_dispatch", expectedRevision: authority.revision, currentRevision: authority.revision + 1 })
})

for (const type of ["text", "select"] as const) {
  test(`${type} prompt-loop completion retains its original token`, async () => {
    const authority = captureApiAuthority()
    const prompt = type === "text" ? { type, key: "dummy", message: "Dummy input" } : { type, key: "dummy", message: "Dummy choice", options: [{ label: "Dummy", value: "0" }], selectValue: "0" }
    __setHostTransportForTest(localTransport(() => [prompt]))
    const retire = async () => { renewApiAuthority(); return "DUMMY_NON_CREDENTIAL" }
    const error = await providerAuthInputs("dummy", 0, dialogs({ nativePrompt: retire, nativeSelect: retire }), { authority }).catch((e) => e)
    expect(error).toMatchObject({ name: "ApiAuthorityChangedError", phase: "before_dispatch", expectedRevision: authority.revision, currentRevision: authority.revision + 1 })
  })
}

for (const result of ["DUMMY_CODE", null] as const) {
  test(`OAuth code dialog ${result === null ? "cancel" : "answer"} retires with the original authority`, async () => {
    setAppStore({ providerAuth: { dummy: [{ type: "oauth", label: "Dummy OAuth" }] } })
    const authority = captureApiAuthority()
    __setHostTransportForTest(localTransport((r) => r.path.endsWith("prompts") ? [] : { url: "https://dummy.invalid", method: "code", flowID: "dummy-exact-flow", instructions: "Dummy code" }))
    const error = await authorizeProvider("dummy", 0, dialogs({ nativePrompt: async () => { renewApiAuthority(); return result } }), { authority }).catch((e) => e)
    expect(error).toMatchObject({ name: "ApiAuthorityChangedError", phase: "before_dispatch", expectedRevision: authority.revision, currentRevision: authority.revision + 1 })
    expect(requests[1]).toMatchObject({ path: "global/providers/dummy/oauth/authorize", authority, body: { kind: "json", value: { method: 0, inputs: {} } } })
  })
}

test("current OAuth device callback joins the exact authorize occurrence", async () => {
  setAppStore({ providerAuth: { dummy: [{ type: "oauth", label: "Dummy device" }] } })
  const authority = captureApiAuthority()
  __setHostTransportForTest(localTransport((r) => r.path.endsWith("prompts") ? [] : r.path.endsWith("authorize") ? { url: "https://dummy.invalid", method: "auto", flowID: "dummy-exact-flow" } : { ok: true }))
  expect(await authorizeProvider("dummy", 0, dialogs(), { authority })).toBe(true)
  expect(requests[2]).toMatchObject({ authority, path: "global/providers/dummy/oauth/callback", body: { kind: "json", value: { method: 0, flowID: "dummy-exact-flow" } } })
})

test("execute retains a retired accepted response as its exact private outcome", async () => {
  const authority = captureApiAuthority()
  const receipt = { ok: true, issues: [{ phase: "dummy", message: "Accepted original receipt" }] }
  __setHostTransportForTest(localTransport(() => { renewApiAuthority(); return receipt }))
  const error = await executeProviderAuth("dummy", 0, { key: "DUMMY_NON_CREDENTIAL" }, { authority }).catch((e) => e)
  expect(error).toBeInstanceOf(ApiAuthorityChangedError)
  expect(error.outcome).toEqual({ phase: "response", response: { status: 200, ok: true, headers: {}, body: receipt } })
})

test("provider refresh accepts an explicit current entry token", async () => {
  const authority = captureApiAuthority()
  __setHostTransportForTest(localTransport(() => ({ ok: true, fetchedAt: 123 })))
  expect(await requestProviderCatalogRefresh("", authority)).toEqual({ ok: true, fetchedAt: 123 })
  expect(requests[0]).toMatchObject({ authority, path: "global/providers/refresh", method: "POST" })
})
