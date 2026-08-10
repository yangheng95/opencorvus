import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type { HostTransport, TransportRequest, TransportResponse } from "../src/services/host-transport"
;(globalThis as typeof globalThis & { __OPENCORVUS_OVERLAY_VERSION__?: string }).__OPENCORVUS_OVERLAY_VERSION__ = "test"

let reloadCalls = 0

mock.module("../src/services/config", () => ({
  checkConfig: () => ({}),
  hasExplicitChecks: () => false,
  checkCanToggle: () => true,
  checkSelectionConfig: () => undefined,
  buildCheckConfigFromSpecs: () => ({}),
  patchConfig: async () => ({}),
  modelContextID: () => "",
  sessionConfigRefreshToken: () => 0,
  markSessionConfigStale: () => {},
  getSessionConfig: async () => ({}),
  patchSessionConfig: async () => ({}),
  getTaskOperatorModelContext: async () => ({}),
  syncAgentPromptLocale: async () => {},
  updateConfig: async () => ({}),
  scaffoldProjectConfig: async () => {},
  reloadProjectScope: async () => {
    reloadCalls += 1
  },
}))

const { configure } = await import("../src/services/api")
const { appStore, setAppStore } = await import("../src/store/app")
const { boardStore, setBoardStore } = await import("../src/store/board")
const { setSettingsStore } = await import("../src/store/settings")
const { initializeProjectDirectoryGit } = await import("../src/services/project-git")
const { initGitCurrent, initializeActiveDirectoryGit } = await import("../src/utils/git")

type Responder = (req: TransportRequest) => TransportResponse<unknown> | Promise<TransportResponse<unknown>>

function fakeTransport(responder: Responder): HostTransport {
  return {
    kind: "tauri",
    capabilities: {
      nativeCommands: {},
      ui: { projectEditors: [] },
    },
    async request<T>(req: TransportRequest): Promise<TransportResponse<T>> {
      return (await responder(req)) as TransportResponse<T>
    },
    openStream() {
      throw new Error("openStream not used")
    },
    async native() {
      throw new Error("native not used")
    },
  } as unknown as HostTransport
}

beforeEach(() => {
  reloadCalls = 0
  setSettingsStore("directory", "C:/tmp/opencorvus-new-project")
  setSettingsStore("savedDirectory", "C:/tmp/opencorvus-new-project")
  configure({ directory: "C:/tmp/opencorvus-new-project" })
  setAppStore("connected", true)
  setBoardStore("vcs", null)
})

afterEach(() => {
  __setHostTransportForTest(undefined)
  configure({ directory: "" })
  setSettingsStore("directory", "")
  setSettingsStore("savedDirectory", "")
  setAppStore("connected", false)
  setBoardStore("vcs", null)
})

describe("Git initialization utilities", () => {
  test("startup primitive only initializes through the canonical endpoint", async () => {
    const requests: TransportRequest[] = []
    __setHostTransportForTest(
      fakeTransport((req) => {
        requests.push(req)
        return {
          status: 200,
          ok: true,
          headers: {},
          body: { created: true, project: { id: "p", worktree: "C:/tmp/opencorvus-new-project" } },
        }
      }),
    )

    await expect(initializeActiveDirectoryGit()).resolves.toMatchObject({ created: true })

    expect(requests).toHaveLength(1)
    expect(requests[0]?.method).toBe("POST")
    expect(requests[0]?.path).toBe("project/current/init-git")
    expect(requests[0]?.query?.directory).toBe("C:/tmp/opencorvus-new-project")
    expect(requests[0]?.timeoutMilliseconds).toBeNull()
    expect(reloadCalls).toBe(0)
  })

  test("posts init-git even when VCS metadata has not loaded yet", async () => {
    const requests: TransportRequest[] = []
    __setHostTransportForTest(
      fakeTransport((req) => {
        requests.push(req)
        return {
          status: 200,
          ok: true,
          headers: {},
          body: { created: true, project: { id: "p", worktree: "C:/tmp/opencorvus-new-project" } },
        }
      }),
    )

    expect(boardStore.vcs).toBe(null)
    expect(appStore.connected).toBe(true)
    await expect(initGitCurrent({ notify: false })).resolves.toBe(true)

    expect(requests).toHaveLength(1)
    expect(requests[0]?.method).toBe("POST")
    expect(requests[0]?.path).toBe("project/current/init-git")
    expect(requests[0]?.query?.directory).toBe("C:/tmp/opencorvus-new-project")
    expect(requests[0]?.timeoutMilliseconds).toBeNull()
    expect(reloadCalls).toBe(1)
  })

  test("preserves explicit caller cancellation while waiting for Git initialization settlement", async () => {
    const requests: TransportRequest[] = []
    const controller = new AbortController()
    let markRequestStarted!: () => void
    const requestStarted = new Promise<void>((resolve) => {
      markRequestStarted = resolve
    })
    __setHostTransportForTest(
      fakeTransport((req) => {
        requests.push(req)
        markRequestStarted()
        return new Promise((_resolve, reject) => {
          const signal = req.signal
          if (!signal) return reject(new Error("Git initialization request missing caller signal"))
          if (signal.aborted) return reject(signal.reason)
          signal.addEventListener("abort", () => reject(signal.reason), { once: true })
        })
      }),
    )

    const reason = new DOMException("Project selection superseded", "AbortError")
    const operation = initializeProjectDirectoryGit("C:/tmp/opencorvus-new-project", { signal: controller.signal })
    await requestStarted
    controller.abort(reason)

    await expect(operation).rejects.toBe(reason)

    expect(requests).toHaveLength(1)
    expect(requests[0]?.timeoutMilliseconds).toBeNull()
    expect(requests[0]?.signal).toBe(controller.signal)
  })
})
