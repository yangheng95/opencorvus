import { afterEach, describe, expect, test } from "bun:test"
import { configure } from "../src/services/api"
import { patchConfig } from "../src/services/config"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type { HostTransport, TransportRequest, TransportResponse } from "../src/services/host-transport"
import { appStore, setAppStore } from "../src/store/app"

function fakeTransport(responder: (req: TransportRequest) => TransportResponse<unknown>): HostTransport {
  return {
    kind: "tauri",
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

  test("patchConfig rejects while disconnected instead of returning null", async () => {
    setAppStore({ connected: false, config: { model: "openai/old" } })

    await expect(patchConfig({ model: "openai/new" })).rejects.toThrow("Cannot patch config while disconnected")

    expect(appStore.config).toEqual({ model: "openai/old" })
  })

  test("patchConfig rejects backend failures without mutating the config store", async () => {
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
