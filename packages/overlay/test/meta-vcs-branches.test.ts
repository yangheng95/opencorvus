import { afterEach, describe, expect, test } from "bun:test"
import { configure as configureApi } from "../src/services/api"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type { HostTransport, TransportRequest, TransportResponse } from "../src/services/host-transport"
import { loadVcsBranches, switchVcsBranch } from "../src/services/meta"
import { boardStore } from "../src/store/board"
import { applySettings, DEFAULT_SETTINGS, setSettingsStore } from "../src/store/settings"

const DIRECTORY = "D:/projects/environment-controls"

function fakeTransport(
  responder: (request: TransportRequest) => Promise<TransportResponse<unknown>> | TransportResponse<unknown>,
): HostTransport {
  return {
    kind: "tauri",
    async request<T>(request: TransportRequest): Promise<TransportResponse<T>> {
      return (await responder(request)) as TransportResponse<T>
    },
    openStream() {
      throw new Error("openStream not used in VCS branch service tests")
    },
    async native() {
      throw new Error("native not used in VCS branch service tests")
    },
  }
}

function ok(body: unknown): TransportResponse<unknown> {
  return { status: 200, ok: true, headers: {}, body }
}

afterEach(() => {
  __setHostTransportForTest(undefined)
  configureApi({ directory: "" })
  applySettings({ ...DEFAULT_SETTINGS })
})

describe("VCS branch service", () => {
  test("loads exact branch records through the project-scoped route", async () => {
    const requests: TransportRequest[] = []
    setSettingsStore("directory", DIRECTORY)
    configureApi({ directory: DIRECTORY })
    __setHostTransportForTest(
      fakeTransport((request) => {
        requests.push(request)
        return ok([
          { name: "main", current: true },
          { name: "feature/menu", current: false },
        ])
      }),
    )

    expect(await loadVcsBranches()).toEqual([
      { name: "main", current: true },
      { name: "feature/menu", current: false },
    ])
    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({
      path: "vcs/branches",
      method: "GET",
      query: { directory: DIRECTORY },
    })
  })

  test("rejects a malformed branch payload instead of manufacturing options", async () => {
    setSettingsStore("directory", DIRECTORY)
    configureApi({ directory: DIRECTORY })
    __setHostTransportForTest(fakeTransport(() => ok([{ name: "main" }])))

    await expect(loadVcsBranches()).rejects.toThrow("vcs/branches returned an invalid branch at index 0")
  })

  test("switches one exact branch and refreshes the canonical VCS store through loadMeta", async () => {
    const requests: TransportRequest[] = []
    const updated = {
      initialized: true,
      branch: "feature/menu",
      commit: "0123abcd",
      clean: true,
      dirty: false,
      staged: 0,
      modified: 0,
      untracked: 0,
      conflicts: 0,
      ahead: 0,
      behind: 0,
    }
    setSettingsStore("directory", DIRECTORY)
    configureApi({ directory: DIRECTORY })
    __setHostTransportForTest(
      fakeTransport((request) => {
        requests.push(request)
        if (request.path === "vcs/branch") return ok(updated)
        if (request.path === "path") return ok({ directory: DIRECTORY })
        if (request.path === "vcs") return ok(updated)
        throw new Error(`unexpected route ${request.path}`)
      }),
    )

    await switchVcsBranch("feature/menu")

    expect(requests[0]).toMatchObject({
      path: "vcs/branch",
      method: "POST",
      query: { directory: DIRECTORY },
      body: { kind: "json", value: { branch: "feature/menu" } },
    })
    expect(requests.slice(1).map((request) => request.path).sort()).toEqual(["path", "vcs"])
    expect(boardStore.vcs).toEqual(updated)
  })
})
