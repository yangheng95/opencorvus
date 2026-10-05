import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type { HostTransport, TransportRequest, TransportResponse } from "../src/services/host-transport"
import { HOST_CAPABILITIES } from "../src/services/host-transport"
import type { AppDialogOpenOptions, AppDialogResult } from "../src/services/app-dialog"
import type { ApiAuthorityChangedError as ApiAuthorityRetirement } from "../src/services/api"
;(globalThis as typeof globalThis & { __OPENCORVUS_OVERLAY_VERSION__?: string }).__OPENCORVUS_OVERLAY_VERSION__ = "test"

let reloadCalls = 0
let reload: () => Promise<unknown> = async () => []
let dialog: (options: AppDialogOpenOptions) => Promise<AppDialogResult> = async () => ({ confirmed: true, value: null })
mock.module("../src/services/app-dialog", () => ({
  showAppDialog: (options: AppDialogOpenOptions) => dialog(options),
  nativeMessage: async () => ({ confirmed: true, value: null }),
}))

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
  reloadProjectScope: async () => {
    reloadCalls += 1
    return await reload()
  },
}))

const { configure, captureApiAuthority, ApiAuthorityChangedError } = await import("../src/services/api")
const { AppLog } = await import("../src/utils/log")
const { appStore, setAppStore } = await import("../src/store/app")
const { boardStore, setBoardStore } = await import("../src/store/board")
const { setSettingsStore } = await import("../src/store/settings")
const { initializeProjectDirectoryGit } = await import("../src/services/project-git")
const { initGitCurrent, initializeActiveDirectoryGit } = await import("../src/utils/git")

type Responder = (req: TransportRequest) => TransportResponse<unknown> | Promise<TransportResponse<unknown>>

function fakeTransport(responder: Responder): HostTransport {
  return {
    kind: "tauri",
    capabilities: HOST_CAPABILITIES.tauri,
    async request<T>(req: TransportRequest): Promise<TransportResponse<T>> {
      return (await responder(req)) as TransportResponse<T>
    },
    openStream() {
      throw new Error("openStream not used")
    },
    async native() {
      throw new Error("native not used")
    },
  }
}

beforeEach(() => {
  reloadCalls = 0
  reload = async () => []
  dialog = async () => ({ confirmed: true, value: null })
  AppLog.clear()
  setBoardStore({ selectedSource: null, board: null, selectEpoch: 30 })
  setSettingsStore("directory", "C:/tmp/opencorvus-new-project")
  setSettingsStore("savedDirectory", "C:/tmp/opencorvus-new-project")
  configure({ serverUrl: "http://127.0.0.1:7878", directory: "C:/tmp/opencorvus-new-project" })
  setAppStore("connected", true)
  setBoardStore("vcs", null)
  AppLog.clear()
})

function ok(body: unknown): TransportResponse { return { status: 200, ok: true, headers: {}, body } }
function projection() {
  return { config: appStore.config, catalog: appStore.providerCatalog, path: boardStore.path, vcs: boardStore.vcs, directory: boardStore.vcsDirectory, sequence: boardStore.taskSequence, etag: boardStore.boardEtag, snapshot: boardStore.snapshotVersion }
}

test.each(["different-project", "same-directory-ABA"] as const)("accepted init retains exact successor projection after %s", async (selection) => {
  const pending = Promise.withResolvers<TransportResponse>()
  const started = Promise.withResolvers<void>()
  __setHostTransportForTest(fakeTransport(() => { started.resolve(); return pending.promise }))
  const original = initGitCurrent({ notify: false })
  await started.promise
  const successor = selection === "different-project" ? "D:/owned/successor" : "C:/tmp/opencorvus-new-project"
  setBoardStore({ selectEpoch: 31, selectedSource: { kind: "session", id: "ses_b", directory: "D:/owned/b" } })
  setBoardStore({ selectEpoch: 32, selectedSource: { kind: "session", id: "ses_current", directory: successor }, path: { directory: successor }, vcs: { branch: "current" }, vcsDirectory: successor, taskSequence: 19, boardEtag: "current-etag", snapshotVersion: "current-snapshot" })
  setAppStore({ config: { marker: "current" }, providerCatalog: { marker: "current" } })
  const current = projection()
  pending.resolve(ok({ created: true }))
  expect(await original).toBe(true)
  expect(projection()).toEqual(current)
})

test("original init API retirement retains the exact POST response receipt", async () => {
  const pending = Promise.withResolvers<TransportResponse>()
  const started = Promise.withResolvers<void>()
  __setHostTransportForTest(fakeTransport(() => { started.resolve(); return pending.promise }))
  const authority = captureApiAuthority()
  const operation = initGitCurrent({ notify: false, authority }).catch((error: unknown) => error)
  await started.promise
  configure({ serverUrl: "http://init-retired.invalid" })
  const response = ok({ created: true })
  pending.resolve(response)
  const result = await operation
  expect(result).toBeInstanceOf(ApiAuthorityChangedError)
  expect((result as ApiAuthorityRetirement).expectedRevision).toBe(authority.revision)
  expect((result as ApiAuthorityRetirement).outcome).toEqual({ phase: "response", response })
})

test("accepted init returns true when a secondary refresh retires into the successor API", async () => {
  const pending = Promise.withResolvers<unknown>()
  const started = Promise.withResolvers<void>()
  __setHostTransportForTest(fakeTransport(() => ok({ created: true })))
  reload = () => { started.resolve(); return pending.promise }
  const authority = captureApiAuthority()
  const operation = initGitCurrent({ notify: false, authority })
  await started.promise
  configure({ serverUrl: "http://init-successor.invalid" })
  setAppStore({ config: { marker: "successor" }, providerCatalog: { marker: "successor" } })
  pending.reject(new ApiAuthorityChangedError(authority, { phase: "before_dispatch" }))
  expect(await operation).toBe(true)
  expect({ config: appStore.config, catalog: appStore.providerCatalog }).toEqual({ config: { marker: "successor" }, catalog: { marker: "successor" } })
})

test.each(["refresh", "notification"] as const)("accepted init keeps true and original diagnostic cause on current %s failure", async (phase) => {
  const cause = new Error(`${phase} unavailable`)
  __setHostTransportForTest(fakeTransport(() => ok({ created: true })))
  if (phase === "refresh") reload = async () => { throw cause }
  else dialog = async () => { throw cause }
  expect(await initGitCurrent()).toBe(true)
  const warning = AppLog.entries.at(-1)
  expect(warning).toMatchObject({ level: "warn", service: "git", message: "Git initialization accepted; view update failed", extra: { accepted: true, phase, directory: "C:/tmp/opencorvus-new-project" } })
  expect((warning?.extra as { cause: unknown }).cause).toBe(cause)
})

test("current original write failure keeps false and its error dialog contract", async () => {
  const cause = new Error("write denied")
  const messages: Array<{ kind?: string; message?: string; owns: boolean }> = []
  __setHostTransportForTest(fakeTransport(() => { throw cause }))
  dialog = async (options) => {
    messages.push({ kind: options.kind, message: options.message, owns: options.openingGuard?.() ?? false })
    return { confirmed: true, value: null }
  }
  expect(await initGitCurrent()).toBe(false)
  expect(messages).toEqual([{ kind: "error", message: String(cause), owns: true }])
})

test("accepted idempotent init retains canonical returned refresh issues and its success dialog", async () => {
  const issues = [{ resource: "meta" as const, message: "metadata denied" }]
  const messages: Array<{ kind?: string; owns: boolean }> = []
  __setHostTransportForTest(fakeTransport(() => ok({ created: false })))
  reload = async () => { setAppStore("projectLoadIssues", issues); return issues }
  dialog = async (options) => { messages.push({ kind: options.kind, owns: options.openingGuard?.() ?? false }); return { confirmed: true, value: null } }
  expect(await initGitCurrent()).toBe(true)
  expect(appStore.projectLoadIssues).toEqual(issues)
  expect(messages).toEqual([{ kind: "info", owns: true }])
})

test.each(["success", "error"] as const)("queued init %s dialog consumes the original selection opening guard", async (outcome) => {
  const guards: boolean[] = []
  __setHostTransportForTest(fakeTransport(() => {
    if (outcome === "error") throw new Error("write denied")
    return ok({ created: true })
  }))
  dialog = async (options) => {
    guards.push(options.openingGuard?.() ?? false)
    setBoardStore("selectEpoch", (value) => value + 2)
    guards.push(options.openingGuard?.() ?? true)
    return { confirmed: false, value: null }
  }
  expect(await initGitCurrent()).toBe(outcome === "success")
  expect(guards).toEqual([true, false])
})

afterEach(() => {
  __setHostTransportForTest(undefined)
  configure({ serverUrl: "http://127.0.0.1:7878", directory: "" })
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
