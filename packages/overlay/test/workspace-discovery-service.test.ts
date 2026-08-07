import { afterEach, describe, expect, test } from "bun:test"
import { configure } from "../src/services/api"
import { settingsStore, setSettingsStore } from "../src/store/settings"
import { HOST_CAPABILITIES } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type { HostTransport, TransportRequest } from "../src/services/host-transport"
import { ensureDefaultDirectory, loadDiscoveredProjects } from "../src/services/workspace"

const LAUNCH_DIRECTORY = "D:/workspace/1a2b3c4d"

function fakeTransport(requests: TransportRequest[], options: { defaultDirectory?: string } = {}): HostTransport {
  return {
    kind: "browser",
    capabilities: HOST_CAPABILITIES.browser,
    async request(req) {
      requests.push(req)
      if (req.path === "global/projects/discover") {
        return {
          status: 200,
          ok: true,
          headers: {},
          body: {
            root: "D:/workspace",
            defaultDirectory: options.defaultDirectory ?? LAUNCH_DIRECTORY,
            projects: [
              {
                id: "project_app",
                directory: "D:/workspace/app",
                name: "app",
                marker: "D:/workspace/app/.opencorvus",
              },
            ],
          },
        }
      }
      return { status: 404, ok: false, headers: {}, body: { error: `unhandled ${req.path}` } }
    },
    openStream() {
      return { close() {} }
    },
    async native() {
      throw new Error("native not used")
    },
  } satisfies HostTransport
}

describe("workspace discovery service", () => {
  afterEach(() => {
    __setHostTransportForTest(undefined)
    configure({ directory: "" })
    setSettingsStore({
      directory: "",
      savedDirectory: "",
    })
  })

  test("loads launch-directory project discovery through the global route", async () => {
    const requests: TransportRequest[] = []
    __setHostTransportForTest(fakeTransport(requests))
    configure({ directory: "D:/active/project" })

    const discovery = await loadDiscoveredProjects()

    expect(discovery).toEqual({
      root: "D:/workspace",
      defaultDirectory: LAUNCH_DIRECTORY,
      projects: [
        {
          id: "project_app",
          directory: "D:/workspace/app",
          name: "app",
          marker: "D:/workspace/app/.opencorvus",
        },
      ],
    })
    expect(requests).toHaveLength(1)
    expect(requests[0]!.path).toBe("global/projects/discover")
  })

  test("ensureDefaultDirectory selects the explicit launch directory", async () => {
    const requests: TransportRequest[] = []
    __setHostTransportForTest(fakeTransport(requests))
    setSettingsStore({
      directory: "",
      savedDirectory: "",
    })

    await expect(ensureDefaultDirectory()).resolves.toBe(true)

    expect(requests.map((request) => ({ method: request.method, path: request.path }))).toEqual([
      { method: "GET", path: "global/projects/discover" },
    ])
    expect(settingsStore.directory).toBe(LAUNCH_DIRECTORY)
  })

  test("ensureDefaultDirectory keeps a directory-free startup when discovery has no explicit launch directory", async () => {
    const requests: TransportRequest[] = []
    __setHostTransportForTest(fakeTransport(requests, { defaultDirectory: "" }))

    await expect(ensureDefaultDirectory()).resolves.toBe(false)

    expect(requests.map((request) => ({ method: request.method, path: request.path }))).toEqual([
      { method: "GET", path: "global/projects/discover" },
    ])
    expect(settingsStore.directory).toBe("")
  })

  test("ensureDefaultDirectory restores the saved directory as the active context", async () => {
    const requests: TransportRequest[] = []
    __setHostTransportForTest(fakeTransport(requests))
    setSettingsStore({ directory: "", savedDirectory: "D:/workspace/saved" })

    await expect(ensureDefaultDirectory()).resolves.toBe(true)

    expect(settingsStore.directory).toBe("D:/workspace/saved")
  })

  test("ensureDefaultDirectory preserves the live runtime directory during reconnect", async () => {
    const requests: TransportRequest[] = []
    __setHostTransportForTest(fakeTransport(requests))
    setSettingsStore({ directory: "D:/workspace/runtime", savedDirectory: "" })

    await expect(ensureDefaultDirectory()).resolves.toBe(true)

    expect(settingsStore.directory).toBe("D:/workspace/runtime")
  })

})
