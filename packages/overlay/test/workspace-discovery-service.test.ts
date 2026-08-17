import { afterEach, describe, expect, test } from "bun:test"
import { configure } from "../src/services/api"
import { settingsStore, setSettingsStore } from "../src/store/settings"
import { HOST_CAPABILITIES } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type { HostTransport, TransportRequest } from "../src/services/host-transport"
import { deleteProjectState, ensureDefaultDirectory, loadDiscoveredProjects } from "../src/services/workspace"

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

  test("shares one Project deletion request across concurrent equivalent Windows directories", async () => {
    const requests: TransportRequest[] = []
    let releaseRequest!: () => void
    const requestGate = new Promise<void>((resolve) => {
      releaseRequest = resolve
    })
    const result = {
      ok: true,
      status: "committed",
      projectID: "project_app",
      directory: "D:/Workspace/App",
      deletedTaskCount: 2,
      residue: [],
    }
    __setHostTransportForTest({
      kind: "browser",
      capabilities: HOST_CAPABILITIES.browser,
      async request(req) {
        requests.push(req)
        await requestGate
        return { status: 200, ok: true, headers: {}, body: result }
      },
      openStream() {
        return { close() {} }
      },
      async native() {
        throw new Error("native not used")
      },
    } satisfies HostTransport)

    const first = deleteProjectState("D:/Workspace/Parent/../App//", {
      surface: "overlay.work_ledger",
      reason: "Delete the Project once",
    })
    const joined = deleteProjectState("d:\\workspace\\app", {
      surface: "overlay.work_ledger",
      reason: "Join the active Project deletion",
    })
    await Promise.resolve()
    expect(requests.map((request) => ({ method: request.method, path: request.path }))).toEqual([
      { method: "DELETE", path: "project/current" },
    ])

    releaseRequest()
    await expect(Promise.all([first, joined])).resolves.toEqual([
      { status: "deleted", result },
      { status: "deleted", result },
    ])

    await expect(
      deleteProjectState("D:/Workspace/App", {
        surface: "overlay.work_ledger",
        reason: "A later deletion occurrence owns a new request",
      }),
    ).resolves.toEqual({ status: "deleted", result })
    expect(requests).toHaveLength(2)
  })

  test("releases a failed Project deletion operation so a later retry can commit", async () => {
    const requests: TransportRequest[] = []
    const result = {
      ok: true,
      status: "committed",
      projectID: "project_retry",
      directory: "D:/Workspace/Retry",
      deletedTaskCount: 0,
      residue: [],
    }
    __setHostTransportForTest({
      kind: "browser",
      capabilities: HOST_CAPABILITIES.browser,
      async request(req) {
        requests.push(req)
        if (requests.length === 1) {
          return {
            status: 409,
            ok: false,
            headers: {},
            body: {
              name: "ProjectDeletePendingError",
              data: { message: "Project deletion is pending" },
            },
          }
        }
        return { status: 200, ok: true, headers: {}, body: result }
      },
      openStream() {
        return { close() {} }
      },
      async native() {
        throw new Error("native not used")
      },
    } satisfies HostTransport)

    await expect(
      deleteProjectState("D:/Workspace/Retry", {
        surface: "overlay.work_ledger",
        reason: "Observe the typed pending deletion",
      }),
    ).rejects.toMatchObject({ status: 409 })
    await expect(
      deleteProjectState("D:/Workspace/Retry", {
        surface: "overlay.work_ledger",
        reason: "Retry after deletion settlement is restored",
      }),
    ).resolves.toEqual({ status: "deleted", result })
    expect(requests).toHaveLength(2)
  })

  test("keeps Windows drive-absolute and drive-relative deletion keys distinct", async () => {
    const requests: TransportRequest[] = []
    let releaseRequests!: () => void
    const requestGate = new Promise<void>((resolve) => {
      releaseRequests = resolve
    })
    __setHostTransportForTest({
      kind: "browser",
      capabilities: HOST_CAPABILITIES.browser,
      async request(req) {
        requests.push(req)
        await requestGate
        return {
          status: 404,
          ok: false,
          headers: {},
          body: { name: "NotFoundError", data: { message: "Project absent" } },
        }
      },
      openStream() {
        return { close() {} }
      },
      async native() {
        throw new Error("native not used")
      },
    } satisfies HostTransport)

    const root = deleteProjectState("D:/", {
      surface: "overlay.work_ledger",
      reason: "Delete the drive-root Project",
    })
    const relative = deleteProjectState("D:", {
      surface: "overlay.work_ledger",
      reason: "Delete the drive-relative Project",
    })
    const absoluteChild = deleteProjectState("D:/Folder/../Other", {
      surface: "overlay.work_ledger",
      reason: "Delete the drive-absolute child Project",
    })
    const relativeChild = deleteProjectState("D:Folder/../Other", {
      surface: "overlay.work_ledger",
      reason: "Delete the drive-relative child Project",
    })
    await Promise.resolve()
    expect(requests).toHaveLength(4)
    releaseRequests()
    await expect(Promise.all([root, relative, absoluteChild, relativeChild])).resolves.toEqual([
      { status: "already_absent", directory: "D:/" },
      { status: "already_absent", directory: "D:" },
      { status: "already_absent", directory: "D:/Folder/../Other" },
      { status: "already_absent", directory: "D:Folder/../Other" },
    ])
  })
})
