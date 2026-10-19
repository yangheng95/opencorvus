import { afterEach, describe, expect, test } from "bun:test"
import { configure } from "../src/services/api"
import { patchConfig, patchGlobalConfig, patchSessionConfig, updateConfig, updateGlobalConfig } from "../src/services/config"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { HOST_CAPABILITIES, type HostTransport, type TransportRequest, type TransportResponse } from "../src/services/host-transport"
import { appStore, setAppStore, setConfigSnapshot } from "../src/store/app"
import { setBoardStore } from "../src/store/board"
import { setSettingsStore } from "../src/store/settings"
import { setPermissionMode } from "../src/services/permission-mode"

function fakeTransport(responder: (req: TransportRequest) => TransportResponse<unknown>): HostTransport {
  return {
    kind: "tauri",
    capabilities: HOST_CAPABILITIES.tauri,
    async request<T>(req: TransportRequest): Promise<TransportResponse<T>> {
      return responder(req) as TransportResponse<T>
    },
    openStream() {
      throw new Error("openStream not used")
    },
    async native() {
      throw new Error("native not used")
    },
  }
}

describe("config service fail-fast writes", () => {
  afterEach(() => {
    __setHostTransportForTest(undefined)
    configure({ directory: "" })
    setAppStore({ connected: false, config: null })
  })

  test.each(["project-patch", "global-patch", "project-update", "global-update", "session-patch"] as const)(
    "%s waits for the server's canonical configuration settlement", async (operation) => {
      const directory = "C:/Users/example/project"
      const global = operation.startsWith("global")
      configure({ directory: global ? "" : directory })
      setSettingsStore("directory", global ? "" : directory)
      setBoardStore({ board: null, selectedSource: null })
      setAppStore("connected", true)
      const accepted = { model: "owned/after" }
      const response = operation === "session-patch" ? { config: accepted, origin: { model: "session" } } : accepted
      const requests: TransportRequest[] = []
      __setHostTransportForTest(fakeTransport((request) => {
        requests.push(request)
        return { status: 200, ok: true, headers: {}, body: request.method === "GET" ? { model: "owned/before" } : response }
      }))
      const mutate = (config: Record<string, any>) => { config.model = accepted.model }
      const result = operation === "project-patch" ? await patchConfig(accepted)
        : operation === "global-patch" ? await patchGlobalConfig(accepted)
        : operation === "project-update" ? await updateConfig(mutate)
        : operation === "global-update" ? await updateGlobalConfig(mutate)
        : await patchSessionConfig({ sessionID: "ses_config", directory, diff: accepted })
      expect(result).toEqual(response)
      expect(requests.filter((request) => request.method === "PATCH").map(({ path, timeoutMilliseconds, body }) => ({ path, timeoutMilliseconds, body }))).toEqual([{
        path: global ? "global/config" : operation === "session-patch" ? "session/ses_config/config" : "config",
        timeoutMilliseconds: null,
        body: { kind: "json", value: accepted },
      }])
    },
  )

  test("successful PATCH publishes the complete accepted configuration", async () => {
    const accepted = { network: { proxy: { url: "http://127.0.0.1:1", llmProvider: false, webResearch: false } } }
    configure({ directory: "C:/Users/example/project" })
    setAppStore("connected", true)
    setConfigSnapshot({ server: { publicUrl: "http://127.0.0.1:2" }, model: "owned/previous" })
    __setHostTransportForTest(fakeTransport(() => ({ status: 200, ok: true, headers: {}, body: accepted })))

    expect(await patchConfig({ server: null, model: null, ...accepted })).toEqual(accepted)
    expect(appStore.config).toEqual(accepted)
  })

  test("the global permission writer publishes its complete accepted configuration", async () => {
    const accepted = { permission_mode: "ask" }
    const requests: TransportRequest[] = []
    configure({ directory: "" })
    setBoardStore({ board: null, selectedSource: null })
    setSettingsStore("directory", "")
    setAppStore("connected", true)
    setConfigSnapshot({ server: { publicUrl: "http://127.0.0.1:2" }, permission_mode: "full_access" })
    __setHostTransportForTest(fakeTransport((request) => {
      requests.push(request)
      return { status: 200, ok: true, headers: {}, body: accepted }
    }))

    setPermissionMode("ask")
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(appStore.config).toEqual(accepted)
    expect(requests.map(({ method, path, body }) => ({ method, path, body }))).toEqual([
      { method: "PATCH", path: "global/config", body: { kind: "json", value: accepted } },
    ])
  })

  test("GET-to-PATCH publishes exact nested and root deletions from the accepted snapshot", async () => {
    const current = { server: { hostname: "127.0.0.1", publicUrl: "http://127.0.0.1:2" }, model: "owned/previous" }
    const accepted = { server: { hostname: "127.0.0.1" } }
    const requests: TransportRequest[] = []
    configure({ directory: "C:/Users/example/project" })
    setAppStore("connected", true)
    setConfigSnapshot(current)
    __setHostTransportForTest(fakeTransport((request) => {
      requests.push(request)
      return { status: 200, ok: true, headers: {}, body: request.method === "GET" ? current : accepted }
    }))

    expect(await updateConfig((config) => {
      delete config.server.publicUrl
      delete config.model
    })).toEqual(accepted)
    expect(appStore.config).toEqual(accepted)
    expect(requests.map(({ method, body }) => ({ method, body }))).toEqual([
      { method: "GET", body: undefined },
      { method: "PATCH", body: { kind: "json", value: { server: { publicUrl: null }, model: null } } },
    ])
  })

  test("an unchanged GET publishes its complete current configuration", async () => {
    const accepted = { locale: "zh-CN" }
    const requests: TransportRequest[] = []
    configure({ directory: "C:/Users/example/project" })
    setAppStore("connected", true)
    setConfigSnapshot({ server: { publicUrl: "http://127.0.0.1:2" }, locale: "en-US" })
    __setHostTransportForTest(fakeTransport((request) => {
      requests.push(request)
      return { status: 200, ok: true, headers: {}, body: accepted }
    }))

    expect(await updateConfig(() => {})).toEqual(accepted)
    expect(appStore.config).toEqual(accepted)
    expect(requests.map(({ method, path }) => ({ method, path }))).toEqual([{ method: "GET", path: "config" }])
  })

  test.each([
    ["ProjectConfigCommittedReconcileError", patchConfig],
    ["GlobalConfigCommittedReconcileError", patchGlobalConfig],
  ] as const)("%s publishes its complete committed snapshot with the original error", async (name, write) => {
    const accepted = { locale: "zh-CN" }
    const body = { name, data: { committed: true, message: "Owned runtime reconciliation failed", config: accepted, failures: ["owned projection"] } }
    configure({ directory: "C:/Users/example/project" })
    setAppStore("connected", true)
    setConfigSnapshot({ server: { publicUrl: "http://127.0.0.1:2" }, locale: "en-US" })
    __setHostTransportForTest(fakeTransport(() => ({ status: 409, ok: false, headers: {}, body })))

    await expect(write({ server: null, locale: "zh-CN" })).rejects.toMatchObject({ name: "ApiError", status: 409, body })
    expect(appStore.config).toEqual(accepted)
  })

  test("GET-to-PATCH publishes a complete committed receipt before returning its error", async () => {
    const accepted = { server: { hostname: "127.0.0.1" } }
    const current = { server: { hostname: "127.0.0.1", publicUrl: "http://127.0.0.1:2" } }
    const body = { name: "ProjectConfigCommittedReconcileError", data: { committed: true, message: "Owned runtime reconciliation failed", config: accepted, failures: ["owned projection"] } }
    configure({ directory: "C:/Users/example/project" })
    setAppStore("connected", true)
    setConfigSnapshot(current)
    __setHostTransportForTest(fakeTransport((request) => request.method === "GET"
      ? { status: 200, ok: true, headers: {}, body: current }
      : { status: 409, ok: false, headers: {}, body }))

    await expect(updateConfig((config) => { delete config.server.publicUrl })).rejects.toMatchObject({ name: "ApiError", status: 409, body })
    expect(appStore.config).toEqual(accepted)
  })

  test("disconnected config write exposes its explicit failure and retains the current config", async () => {
    setAppStore({ connected: false, config: { model: "openai/old" } })

    await expect(patchConfig({ model: "openai/new" })).rejects.toThrow("Cannot patch config while disconnected")

    expect(appStore.config).toEqual({ model: "openai/old" })
  })

  test("backend503 config write preserves its exact error contract and current config", async () => {
    const requests: TransportRequest[] = []
    configure({ directory: "C:/Users/example/project" })
    setAppStore({ connected: true, config: { model: "openai/old" } })
    __setHostTransportForTest(
      fakeTransport((req) => {
        requests.push(req)
        return { status: 503, ok: false, headers: {}, body: { error: "config write denied" } }
      }),
    )

    await expect(patchConfig({ model: "openai/new" })).rejects.toThrow("config write denied")

    expect(requests.map((req) => [req.method, req.path, req.query?.directory])).toEqual([
      ["PATCH", "config", "C:/Users/example/project"],
    ])
    expect(appStore.config).toEqual({ model: "openai/old" })
  })

  test("patchConfig projects a committed receipt before surfacing runtime reconciliation failure", async () => {
    configure({ directory: "C:/Users/example/project" })
    setAppStore({ connected: true, config: { model: "openai/old" } })
    __setHostTransportForTest(
      fakeTransport(() => ({
        status: 409,
        ok: false,
        headers: {},
        body: {
          name: "ProjectConfigCommittedReconcileError",
          data: {
            committed: true,
            message: "Project configuration committed, but its runtime projection did not fully settle",
            config: { model: "openai/new" },
            failures: ["provider cache reset failed"],
          },
        },
      })),
    )

    await expect(patchConfig({ model: "openai/new" })).rejects.toThrow("runtime projection did not fully settle")
    expect(appStore.config).toEqual({ model: "openai/new" })
  })
})
