import { afterEach, describe, expect, test } from "bun:test"
import { configure as configureApi } from "../src/services/api"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type {
  HostTransport,
  StreamHandlers,
  StreamOpenRequest,
  TransportRequest,
  TransportResponse,
} from "../src/services/host-transport"
import { commitVcsChanges, pushVcsBranch, streamVcsCommitMessage } from "../src/services/meta"
import { boardStore } from "../src/store/board"
import { applySettings, DEFAULT_SETTINGS, setSettingsStore } from "../src/store/settings"

const DIRECTORY = "D:/projects/environment-actions"

function ok(body: unknown): TransportResponse<unknown> {
  return { status: 200, ok: true, headers: {}, body }
}

afterEach(() => {
  __setHostTransportForTest(undefined)
  configureApi({ directory: "" })
  applySettings({ ...DEFAULT_SETTINGS })
})

describe("VCS action service", () => {
  test("streams the generated commit message through the project-scoped POST route", () => {
    let streamRequest: StreamOpenRequest | undefined
    const deltas: string[] = []
    let completed = ""
    const transport: HostTransport = {
      kind: "tauri",
      async request() {
        throw new Error("request not used")
      },
      openStream(input: StreamOpenRequest, handlers: StreamHandlers) {
        streamRequest = input
        handlers.onEvent(JSON.stringify({ type: "delta", delta: "Refine " }))
        handlers.onEvent(JSON.stringify({ type: "delta", delta: "environment controls" }))
        handlers.onEvent(JSON.stringify({ type: "done", message: "Refine environment controls" }))
        handlers.onClose?.("server")
        return { close() {} }
      },
      async native() {
        throw new Error("native not used")
      },
    }
    setSettingsStore("directory", DIRECTORY)
    configureApi({ directory: DIRECTORY })
    __setHostTransportForTest(transport)

    streamVcsCommitMessage({
      sessionID: "session-123",
      onDelta: (delta) => deltas.push(delta),
      onDone: (message) => {
        completed = message
      },
      onError: (error) => {
        throw error
      },
    })

    expect(streamRequest).toEqual({
      path: "vcs/commit-message/stream",
      method: "POST",
      body: { kind: "json", value: { sessionID: "session-123" } },
      headers: { "Content-Type": "application/json" },
      signal: undefined,
    })
    expect(deltas).toEqual(["Refine ", "environment controls"])
    expect(completed).toBe("Refine environment controls")
  })

  test("rejects frames with fields outside the shared stream schema", () => {
    const errors: Error[] = []
    const transport: HostTransport = {
      kind: "tauri",
      async request() {
        throw new Error("request not used")
      },
      openStream(_input: StreamOpenRequest, handlers: StreamHandlers) {
        handlers.onEvent(JSON.stringify({ type: "done", message: "Complete", legacy: true }))
        return { close() {} }
      },
      async native() {
        throw new Error("native not used")
      },
    }
    __setHostTransportForTest(transport)

    streamVcsCommitMessage({
      onDelta: () => undefined,
      onDone: () => errors.push(new Error("invalid done accepted")),
      onError: (error) => errors.push(error),
    })

    expect(errors).toHaveLength(1)
    expect(errors[0]?.message).toBe("Invalid VCS commit-message stream event")
  })

  test("commits the exact edited message and refreshes canonical VCS information", async () => {
    const requests: TransportRequest[] = []
    const refreshed = {
      initialized: true,
      branch: "feature/environment",
      commit: "abcd1234",
      clean: true,
      dirty: false,
      staged: 0,
      modified: 0,
      untracked: 0,
      conflicts: 0,
      ahead: 1,
      behind: 0,
    }
    const transport: HostTransport = {
      kind: "tauri",
      async request<T>(request: TransportRequest): Promise<TransportResponse<T>> {
        requests.push(request)
        if (request.path === "vcs/commit") return ok({ commit: "abcd1234", info: refreshed }) as TransportResponse<T>
        if (request.path === "path") return ok({ directory: DIRECTORY }) as TransportResponse<T>
        if (request.path === "vcs") return ok(refreshed) as TransportResponse<T>
        throw new Error(`unexpected route ${request.path}`)
      },
      openStream() {
        throw new Error("openStream not used")
      },
      async native() {
        throw new Error("native not used")
      },
    }
    setSettingsStore("directory", DIRECTORY)
    configureApi({ directory: DIRECTORY })
    __setHostTransportForTest(transport)

    const result = await commitVcsChanges("  Refine environment controls  ", DIRECTORY)

    expect(result.commit).toBe("abcd1234")
    expect(requests[0]).toMatchObject({
      path: "vcs/commit",
      method: "POST",
      query: { directory: DIRECTORY },
      body: { kind: "json", value: { message: "Refine environment controls" } },
      timeoutMilliseconds: null,
    })
    expect(
      requests
        .slice(1)
        .map((request) => request.path)
        .sort(),
    ).toEqual(["path", "vcs"])
    expect(boardStore.vcs).toEqual(refreshed)
  })

  test("pushes the configured branch and refreshes canonical VCS information", async () => {
    const requests: TransportRequest[] = []
    const refreshed = {
      initialized: true,
      branch: "feature/environment",
      commit: "abcd1234",
      clean: true,
      dirty: false,
      staged: 0,
      modified: 0,
      untracked: 0,
      conflicts: 0,
      ahead: 0,
      behind: 0,
    }
    const transport: HostTransport = {
      kind: "tauri",
      async request<T>(request: TransportRequest): Promise<TransportResponse<T>> {
        requests.push(request)
        if (request.path === "vcs/push") return ok({ info: refreshed }) as TransportResponse<T>
        if (request.path === "path") return ok({ directory: DIRECTORY }) as TransportResponse<T>
        if (request.path === "vcs") return ok(refreshed) as TransportResponse<T>
        throw new Error(`unexpected route ${request.path}`)
      },
      openStream() {
        throw new Error("openStream not used")
      },
      async native() {
        throw new Error("native not used")
      },
    }
    setSettingsStore("directory", DIRECTORY)
    configureApi({ directory: DIRECTORY })
    __setHostTransportForTest(transport)

    await pushVcsBranch(DIRECTORY)

    expect(requests[0]).toMatchObject({
      path: "vcs/push",
      method: "POST",
      query: { directory: DIRECTORY },
      timeoutMilliseconds: null,
    })
    expect(boardStore.vcs).toEqual(refreshed)
  })
})
