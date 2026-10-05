import { afterEach, describe, expect, test } from "bun:test"
import { configure as configureApi, captureApiAuthority, ApiAuthorityChangedError } from "../src/services/api"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { HOST_CAPABILITIES } from "../src/services/host-transport"
import type {
  HostTransport,
  StreamHandlers,
  StreamOpenRequest,
  TransportRequest,
  TransportResponse,
} from "../src/services/host-transport"
import { commitVcsChanges, pushVcsBranch, switchVcsBranch, retireMetaProjection, streamVcsCommitMessage } from "../src/services/meta"
import { boardStore, setBoardStore } from "../src/store/board"
import { AppLog } from "../src/utils/log"
import { applySettings, DEFAULT_SETTINGS, setSettingsStore } from "../src/store/settings"

const DIRECTORY = "D:/projects/environment-actions"

function ok(body: unknown): TransportResponse<unknown> {
  return { status: 200, ok: true, headers: {}, body }
}

afterEach(() => {
  retireMetaProjection()
  setBoardStore({ selectedSource: null, selectEpoch: 0, board: null })
  AppLog.clear()
  __setHostTransportForTest(undefined)
  configureApi({ serverUrl: "http://127.0.0.1:7878", directory: "" })
  applySettings({ ...DEFAULT_SETTINGS })
})

const accepted = { commit: "accepted-commit", info: { branch: "accepted-branch" } }
const actions = [
  { action: "commit", route: "vcs/commit", invoke: () => commitVcsChanges("exact message", DIRECTORY), result: accepted },
  { action: "push", route: "vcs/push", invoke: () => pushVcsBranch(DIRECTORY), result: undefined },
  { action: "switch-branch", route: "vcs/branch", invoke: () => switchVcsBranch("accepted-branch", DIRECTORY), result: undefined },
] as const

function actionTransport(read: (request: TransportRequest) => TransportResponse | Promise<TransportResponse>): void {
  __setHostTransportForTest({
    kind: "tauri", capabilities: HOST_CAPABILITIES.tauri,
    async request<T>(request: TransportRequest): Promise<TransportResponse<T>> { return await read(request) as TransportResponse<T> },
    openStream() { throw new Error("unexpected stream") },
    async native() { throw new Error("unexpected native") },
  })
  setSettingsStore("directory", DIRECTORY)
  setBoardStore({ selectedSource: null, selectEpoch: 30, board: null })
  configureApi({ directory: DIRECTORY })
}

for (const entry of actions) {
  test(`${entry.action} retains the accepted outcome and current metadata error with its diagnostic cause`, async () => {
    const cause = new Error(`${entry.action} metadata denied`)
    actionTransport((request) => {
      if (request.path === entry.route) return ok(accepted)
      if (request.path === "path") return ok({ directory: DIRECTORY })
      throw cause
    })
    expect(await entry.invoke()).toBe(entry.result)
    expect({ directory: boardStore.vcsDirectory, vcs: boardStore.vcs, error: boardStore.vcsError, loading: boardStore.vcsLoading }).toEqual({ directory: DIRECTORY, vcs: null, error: cause.message, loading: false })
    const diagnostic = AppLog.entries.at(-1)
    expect(diagnostic).toMatchObject({ level: "warn", service: "meta", message: "VCS mutation accepted; metadata refresh failed", extra: { action: entry.action, directory: DIRECTORY, accepted: true } })
    expect((diagnostic?.extra as { cause: unknown }).cause).toBe(cause)
  })

  test(`${entry.action} propagates its original POST error`, async () => {
    const cause = new Error(`${entry.action} write denied`)
    actionTransport(() => { throw cause })
    expect(await entry.invoke().catch((error: unknown) => error)).toBe(cause)
  })

  test.each(["different-project", "same-directory-ABA"] as const)(`${entry.action} preserves the successor projection after %s selection`, async (selection) => {
    const pending = Promise.withResolvers<TransportResponse>()
    const started = Promise.withResolvers<void>()
    actionTransport(() => { started.resolve(); return pending.promise })
    const operation = entry.invoke()
    await started.promise
    const successorDirectory = selection === "different-project" ? "D:/successor" : DIRECTORY
    setBoardStore({ selectEpoch: 31, selectedSource: { kind: "session", id: "ses_b", directory: "D:/successor" } })
    setBoardStore({ selectEpoch: 32, selectedSource: { kind: "session", id: "ses_current", directory: successorDirectory }, path: { directory: successorDirectory }, vcs: { branch: "successor" }, vcsDirectory: successorDirectory, vcsLoading: true, vcsError: "successor-owned" })
    pending.resolve(ok(accepted))
    expect(await operation).toBe(entry.result)
    expect({ path: boardStore.path, vcs: boardStore.vcs, directory: boardStore.vcsDirectory, loading: boardStore.vcsLoading, error: boardStore.vcsError }).toEqual({ path: { directory: successorDirectory }, vcs: { branch: "successor" }, directory: successorDirectory, loading: true, error: "successor-owned" })
  })

  test(`${entry.action} returns the original typed API retirement response receipt`, async () => {
    const pending = Promise.withResolvers<TransportResponse>()
    const started = Promise.withResolvers<void>()
    actionTransport(() => { started.resolve(); return pending.promise })
    const authority = captureApiAuthority()
    const operation = entry.invoke().catch((error: unknown) => error)
    await started.promise
    configureApi({ serverUrl: "http://retired-meta.invalid" })
    const response = ok(accepted)
    pending.resolve(response)
    const result = await operation
    expect(result).toBeInstanceOf(ApiAuthorityChangedError)
    expect((result as ApiAuthorityChangedError).expectedRevision).toBe(authority.revision)
    expect((result as ApiAuthorityChangedError).outcome).toEqual({ phase: "response", response })
  })
}

test("accepted commit metadata failure permits the separately accepted push and its fresh projection", async () => {
  const requests: string[] = []
  let pushed = false
  const refreshed = { branch: "accepted-branch", ahead: 0 }
  actionTransport((request) => {
    requests.push(request.path)
    if (request.path === "vcs/commit") return ok(accepted)
    if (request.path === "vcs/push") { pushed = true; return ok({ accepted: true }) }
    if (request.path === "path") return ok({ directory: DIRECTORY })
    if (!pushed) throw new Error("commit projection temporarily unavailable")
    return ok(refreshed)
  })
  const authority = captureApiAuthority()
  const result = await commitVcsChanges("exact message", DIRECTORY, authority)
  await pushVcsBranch(DIRECTORY, authority)
  expect(result).toBe(accepted)
  expect(requests).toEqual(["vcs/commit", "path", "vcs", "vcs/push", "path", "vcs"])
  expect({ vcs: boardStore.vcs, directory: boardStore.vcsDirectory, error: boardStore.vcsError, loading: boardStore.vcsLoading }).toEqual({ vcs: refreshed, directory: DIRECTORY, error: "", loading: false })
})

describe("VCS action service", () => {
  test("streams the generated commit message through the project-scoped POST route", () => {
    let streamRequest: StreamOpenRequest | undefined
    const deltas: string[] = []
    let completed = ""
    const transport: HostTransport = {
      kind: "tauri",
      capabilities: HOST_CAPABILITIES.tauri,
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
      authority: captureApiAuthority(),
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
      capabilities: HOST_CAPABILITIES.tauri,
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
      capabilities: HOST_CAPABILITIES.tauri,
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
      capabilities: HOST_CAPABILITIES.tauri,
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
