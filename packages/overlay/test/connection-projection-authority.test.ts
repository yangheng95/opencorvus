import { afterEach, beforeEach, expect, test } from "bun:test"
import { WorkLedgerChatRow } from "@opencorvus-ai/transport-protocol"
import { ApiAuthorityChangedError, captureApiAuthority, configure } from "../src/services/api"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import {
  HOST_CAPABILITIES,
  type HostTransport,
  type TransportRequest,
  type TransportResponse,
  type StreamHandlers,
  type StreamOpenRequest,
} from "../src/services/host-transport"
import { appStore, setAppStore } from "../src/store/app"
import { setSettingsStore } from "../src/store/settings"
import { boardStore, setBoardStore, clearBoard, loadBoard, loadTasks, retireTaskListRequests } from "../src/store/board"
import { loadMeta, streamVcsCommitMessage } from "../src/services/meta"
import { updateConfig } from "../src/services/config"
import {
  createGlobalConversationSession,
  renameConversationSession,
  retireConversationSessionProjection,
} from "../src/services/conversation-session"
import { conversationSessionStore } from "../src/store/conversation-session"
import {
  setWorkLedgerRuntimeRows,
  workLedgerSessionExecution,
  retireWorkLedgerProjection,
} from "../src/services/work-ledger"
import { submitMessage } from "../src/services/task"
import { refreshProjectMemory, acknowledgeProjectMemoryNotice } from "../src/services/project-memory"
import {
  loadGlobalComposerReferences,
  retireGlobalComposerReferences,
} from "../src/services/global-composer-references"
import { loadExpertSquadCatalog, retireExpertSquadProjection } from "../src/services/expert-squad"
import { composerReferenceCatalogRequestKey } from "../src/services/expert-squad-scope"
import { promptSessionMessage, stopChatRequest, retireChatRequestProjection } from "../src/services/chat"
import { setChatRequest } from "../src/store/messages"
import { openMcpAppHostEventStream, retireMcpAppEventStreams } from "../src/services/interactive-artifact"
import { deleteAllSkills } from "../src/services/extensions"
import { missionBoardStore, reloadMissionBoard, retireMissionBoardProjection } from "../src/services/mission-board"
import type { MissionRecord } from "../src/services/mission"

const directory = "D:/owned/shared"
// Pure store scheduling only; this fixture creates no DOM or renderer.
const originalFrame = globalThis.requestAnimationFrame
beforeEach(() => {
  globalThis.requestAnimationFrame = (callback) => {
    queueMicrotask(() => callback(performance.now()))
    return 0
  }
})
const ok = (body: unknown): TransportResponse => ({ status: 200, ok: true, headers: {}, body })
function deferred<T>() {
  return Promise.withResolvers<T>()
}
function transport(
  respond: (request: TransportRequest) => TransportResponse | Promise<TransportResponse>,
  open?: HostTransport["openStream"],
) {
  __setHostTransportForTest({
    kind: "browser",
    capabilities: HOST_CAPABILITIES.browser,
    async request<T>(request: TransportRequest) {
      return (await respond(request)) as TransportResponse<T>
    },
    openStream:
      open ??
      (() => {
        throw new Error("Unexpected stream in request fixture")
      }),
    async native() {
      throw new Error("Unexpected native call in request fixture")
    },
  })
}
beforeEach(() => {
  configure({ serverUrl: "http://a.invalid", directory, password: "" })
  setSettingsStore({ directory, directoryEpoch: 0 })
  setAppStore({ connected: true, config: { owner: "initial" } })
  setBoardStore({ selectedSource: null, board: null, taskSwitching: false })
  clearBoard()
  retireTaskListRequests()
  retireConversationSessionProjection()
  retireWorkLedgerProjection()
  retireGlobalComposerReferences()
  retireExpertSquadProjection()
  retireMcpAppEventStreams()
  retireChatRequestProjection()
  retireMissionBoardProjection()
})
afterEach(() => {
  clearBoard()
  retireTaskListRequests()
  retireConversationSessionProjection()
  retireWorkLedgerProjection()
  retireGlobalComposerReferences()
  retireExpertSquadProjection()
  retireMcpAppEventStreams()
  retireChatRequestProjection()
  retireMissionBoardProjection()
  setBoardStore({ selectedSource: null, board: null })
  __setHostTransportForTest(undefined)
  configure({ serverUrl: "http://127.0.0.1:7878", directory: "" })
  globalThis.requestAnimationFrame = originalFrame
})

test("local transport metadata completes B's same-directory facts after A returns", async () => {
  const a = captureApiAuthority()
  const pending = deferred<void>()
  transport(async (request) => {
    const origin = request.authority?.revision === a.revision ? "a" : "b"
    if (origin === "a") await pending.promise
    return ok(request.path === "path" ? { directory } : { initialized: true, branch: origin })
  })
  const old = loadMeta(directory)
  configure({ serverUrl: "http://b.invalid" })
  await loadMeta(directory)
  pending.resolve()
  await old
  expect({ vcs: boardStore.vcs, directory: boardStore.vcsDirectory, loading: boardStore.vcsLoading }).toEqual({
    vcs: { initialized: true, branch: "b" },
    directory,
    loading: false,
  })
})

test("local compound GET and mutator capture retain an exact stale continuation outcome", async () => {
  const requests: Array<{ method?: string; path: string }> = []
  transport((request) => {
    requests.push({ method: request.method, path: request.path })
    return ok({ owner: "a" })
  })
  const result = await updateConfig((next) => {
    next.owner = "edited"
    configure({ serverUrl: "http://b.invalid" })
    setAppStore("config", { owner: "b" })
  }).catch((error) => error)
  expect(result).toBeInstanceOf(ApiAuthorityChangedError)
  expect(result.outcome).toEqual({ phase: "before_dispatch" })
  expect(requests).toEqual([{ method: "GET", path: "config" }])
  expect(appStore.config).toEqual({ owner: "b" })
})

test("local board pending ownership keeps B loading while the old A finally settles", async () => {
  setBoardStore({ selectedSource: { kind: "task", id: "tsk_same", directory }, board: { owner: "b" } })
  const a = captureApiAuthority()
  const pendingA = deferred<TransportResponse>()
  const pendingB = deferred<TransportResponse>()
  transport((request) => (request.authority?.revision === a.revision ? pendingA.promise : pendingB.promise))
  const old = loadBoard()
  await Promise.resolve()
  configure({ serverUrl: "http://b.invalid" })
  const current = loadBoard()
  await Promise.resolve()
  pendingA.resolve({ status: 304, ok: false, headers: {}, body: undefined })
  await old
  expect({ loading: boardStore.loading, owner: boardStore.board.owner }).toEqual({ loading: true, owner: "b" })
  pendingB.resolve({ status: 304, ok: false, headers: {}, body: undefined })
  await current
  expect({ loading: boardStore.loading, owner: boardStore.board.owner }).toEqual({ loading: false, owner: "b" })
})

test("local global Task list uses B's pending owner and retains its exact rows after A", async () => {
  const a = captureApiAuthority()
  const pending = deferred<void>()
  transport(async (request) => {
    const origin = request.authority?.revision === a.revision ? "a" : "b"
    if (origin === "a") await pending.promise
    return ok({ tasks: [{ task: { id: `tsk_${origin}`, directory, status: "inactive", time: { updated: 1 } } }] })
  })
  const old = loadTasks()
  configure({ serverUrl: "http://b.invalid" })
  await loadTasks()
  pending.resolve()
  await old
  expect(boardStore.tasks.map((row) => row.task.id)).toEqual(["tsk_b"])
  expect({ loaded: boardStore.tasksLoaded, error: boardStore.tasksError }).toEqual({ loaded: true, error: "" })
})

test("local same-ID Session mutation retains A receipt and B busy owner before B completes", async () => {
  const a = captureApiAuthority()
  const pendingA = deferred<TransportResponse>()
  const pendingB = deferred<TransportResponse>()
  transport((request) => (request.authority?.revision === a.revision ? pendingA.promise : pendingB.promise))
  const target = { sessionID: "ses_same", directory, experience: "chat" as const }
  const old = renameConversationSession(target, "A title").catch((error) => error)
  configure({ serverUrl: "http://b.invalid" })
  const current = renameConversationSession(target, "B title")
  pendingA.resolve({
    ...ok({ session: { id: target.sessionID, kind: "conversation", title: "A title" } }),
    headers: { "x-opencorvus-request-id": "accepted-a" },
  })
  const outcome = await old
  expect(outcome).toBeInstanceOf(ApiAuthorityChangedError)
  expect(outcome.outcome.response).toMatchObject({ status: 200, headers: { "x-opencorvus-request-id": "accepted-a" } })
  expect(conversationSessionStore.actionBusyID).toBe("ses_same")
  pendingB.resolve(ok({ session: { id: target.sessionID, kind: "conversation", title: "B title" } }))
  expect(await current).toBe(true)
  expect(conversationSessionStore.sessions.map(({ id, title }) => ({ id, title }))).toEqual([
    { id: "ses_same", title: "B title" },
  ])
  expect(conversationSessionStore.actionBusyID).toBe("")
})

test("Work Ledger replacement snapshot and retirement use the existing current map", () => {
  const row = (id: string, title: string) =>
    WorkLedgerChatRow.parse({
      kind: "chat",
      experience: "chat",
      id,
      sessionID: id,
      title,
      directory,
      created: 1,
      started: 1,
      updated: 2,
      pinned: false,
      status: "idle",
    })
  const a = captureApiAuthority()
  setWorkLedgerRuntimeRows([row("ses_same", "A")], a)
  configure({ serverUrl: "http://b.invalid" })
  const b = captureApiAuthority()
  retireWorkLedgerProjection()
  setWorkLedgerRuntimeRows([row("ses_same", "B")], b)
  setWorkLedgerRuntimeRows([row("ses_same", "late A")], a)
  expect(workLedgerSessionExecution("ses_same")?.title).toBe("B")
  setWorkLedgerRuntimeRows([row("ses_next", "next B")], b)
  expect(workLedgerSessionExecution("ses_next")?.title).toBe("next B")
})

test("local VCS and panel POST close settle their original operations with actual stream-close facts", async () => {
  const streams: Array<{ input: StreamOpenRequest; handlers: StreamHandlers }> = []
  transport(
    () => ok({}),
    (input, handlers) => {
      streams.push({ input, handlers })
      return { close() {} }
    },
  )
  const a = captureApiAuthority()
  const vcs = deferred<Error>()
  streamVcsCommitMessage({ authority: a, onDelta() {}, onDone() {}, onError: vcs.resolve })
  const panel = submitMessage("dummy local input", [], { authority: a }).catch((error) => error)
  configure({ serverUrl: "http://b.invalid" })
  const info = { authority: a, current: false }
  for (const stream of streams) stream.handlers.onClose?.("auth-changed", info)
  for (const error of [await vcs.promise, await panel]) {
    expect(error).toBeInstanceOf(ApiAuthorityChangedError)
    expect((error as ApiAuthorityChangedError).outcome).toEqual({
      phase: "stream_closed",
      reason: "auth-changed",
      info,
    })
    expect(JSON.parse(JSON.stringify(error))).toEqual({
      name: "ApiAuthorityChangedError",
      phase: "stream_closed",
      expectedRevision: a.revision,
      currentRevision: a.revision + 1,
    })
  }
})

test("project memory refresh and acknowledgement follow one directory and authority", async () => {
  const a = captureApiAuthority()
  const old = deferred<void>()
  const requests: Array<{ path: string; authority: number; directory: unknown }> = []
  transport(async (request) => {
    requests.push({ path: request.path, authority: request.authority!.revision, directory: request.query?.directory })
    if (request.authority?.revision === a.revision) await old.promise
    return ok({ status: request.authority?.revision === a.revision ? "A" : "B", pendingCount: 0, tokenCount: 5 })
  })
  const oldLoad = refreshProjectMemory({ authority: a, directory }).catch((error) => error)
  configure({ serverUrl: "http://b.invalid" })
  const b = captureApiAuthority()
  await acknowledgeProjectMemoryNotice("owned-generation", { authority: b, directory })
  old.resolve()
  expect(await oldLoad).toBeInstanceOf(ApiAuthorityChangedError)
  expect(appStore.projectMemory).toEqual({ status: "B", pendingCount: 0, tokenCount: 5 })
  expect(requests).toEqual([
    { path: "experimental/project-memory", authority: a.revision, directory },
    { path: "experimental/project-memory/notice/acknowledge", authority: b.revision, directory },
    { path: "experimental/project-memory", authority: b.revision, directory },
  ])
})

test("global and scoped reference pending owners return B's current catalog after A retires", async () => {
  const a = captureApiAuthority()
  const old = deferred<void>()
  transport(async (request) => {
    if (request.authority?.revision === a.revision) await old.promise
    return ok({ catalogOwner: request.authority?.revision === a.revision ? "A" : "B" })
  })
  const scope = { kind: "project" as const, directory }
  const oldGlobal = loadGlobalComposerReferences(a).catch((error) => error)
  const oldScoped = loadExpertSquadCatalog({ ...scope, authority: a }).catch((error) => error)
  const keyA = composerReferenceCatalogRequestKey()
  configure({ password: "DUMMY_NON_CREDENTIAL" })
  const b = captureApiAuthority()
  const global: unknown = await loadGlobalComposerReferences(b)
  const scoped: unknown = await loadExpertSquadCatalog({ ...scope, authority: b })
  expect(global).toEqual({ catalogOwner: "B" })
  expect(scoped).toEqual({ catalogOwner: "B" })
  expect(composerReferenceCatalogRequestKey()).toBe(keyA.replace(`api:${a.revision}:`, `api:${b.revision}:`))
  old.resolve()
  expect(await oldGlobal).toBeInstanceOf(ApiAuthorityChangedError)
  expect(await oldScoped).toBeInstanceOf(ApiAuthorityChangedError)
})

test("Chat prompt-profile completion on A retains its receipt while B remains the active request authority", async () => {
  const pending = deferred<TransportResponse>()
  const requests: TransportRequest[] = []
  transport((request) => {
    requests.push(request)
    return pending.promise
  })
  const a = captureApiAuthority()
  const send = promptSessionMessage({
    authority: a,
    sessionID: "ses_local",
    directory,
    text: "dummy",
    promptProfile: "base",
  }).catch((error) => error)
  configure({ serverUrl: "http://b.invalid" })
  retireChatRequestProjection()
  pending.resolve(
    ok({ scope: { kind: "session", sessionID: "ses_local" }, config: { prompt_profile: { active: "base" } } }),
  )
  const result = await send
  expect(result).toBeInstanceOf(ApiAuthorityChangedError)
  expect(result.outcome.response).toMatchObject({
    status: 200,
    body: { config: { prompt_profile: { active: "base" } } },
  })
  expect(requests.map((request) => ({ path: request.path, authority: request.authority }))).toEqual([
    { path: "session/ses_local/config", authority: a },
  ])
})

test("explicit Chat Stop uses its captured target and stale Stop has a local admission outcome", async () => {
  const requests: TransportRequest[] = []
  transport((request) => {
    requests.push(request)
    return ok(true)
  })
  const a = captureApiAuthority()
  setChatRequest({
    authority: a,
    requestID: "dummy-a",
    controller: new AbortController(),
    target: { kind: "session", sessionID: "ses_a", directory },
  })
  expect(await stopChatRequest()).toBe(true)
  expect(
    requests.map((request) => ({ path: request.path, method: request.method, authority: request.authority })),
  ).toEqual([{ path: "session/ses_a/abort", method: "POST", authority: a }])
  setChatRequest({
    authority: a,
    requestID: "dummy-old",
    controller: new AbortController(),
    target: { kind: "task", taskID: "tsk_a", directory },
  })
  configure({ serverUrl: "http://b.invalid" })
  const error = await stopChatRequest().catch((error) => error)
  expect(error).toBeInstanceOf(ApiAuthorityChangedError)
  expect(error.outcome).toEqual({ phase: "before_dispatch" })
})

test("MCP stream same-ID replacement publishes B capability events after late A close", () => {
  const streams: Array<{ input: StreamOpenRequest; handlers: StreamHandlers }> = []
  transport(
    () => ok({}),
    (input, handlers) => {
      streams.push({ input, handlers })
      return { close() {} }
    },
  )
  const a = captureApiAuthority()
  let current = "initial"
  openMcpAppHostEventStream({
    sessionID: "ses_same",
    directory,
    artifactID: "art_same",
    authority: a,
    onEvent: (e) => {
      current = `A:${e.type}`
    },
    onError: (e) => {
      throw e
    },
  })
  configure({ serverUrl: "http://b.invalid" })
  const b = captureApiAuthority()
  const handle = openMcpAppHostEventStream({
    sessionID: "ses_same",
    directory,
    artifactID: "art_same",
    authority: b,
    onEvent: (e) => {
      current = `B:${e.type}`
    },
    onError: (e) => {
      throw e
    },
  })
  streams[0]!.handlers.onClose?.("auth-changed", { authority: a, current: false })
  streams[1]!.handlers.onEvent(JSON.stringify({ type: "tools/list_changed", serverID: "server-b" }))
  streams[0]!.handlers.onEvent(JSON.stringify({ type: "mcp-app.heartbeat" }))
  expect(current).toBe("B:tools/list_changed")
  expect(streams.map((stream) => stream.input.authority)).toEqual([a, b])
  handle.close("consumer-dispose")
})

test("panel stream preserves the original completed result when authority retires before close", async () => {
  let handlers!: StreamHandlers
  transport(
    () => ok({}),
    (_input, next) => {
      handlers = next
      return { close() {} }
    },
  )
  const authority = captureApiAuthority()
  const pending = submitMessage("local fixture", [], { authority })
  const result = { requestID: "original-a", outcome: "completed" }
  handlers.onEvent(JSON.stringify({ type: "done", result }))
  configure({ serverUrl: "http://b.invalid" })
  handlers.onClose?.("auth-changed", { authority, current: false })
  expect(await pending).toEqual(result)
})

test("Mission board preserves B's completed current snapshot when A's page settles later", async () => {
  const a = captureApiAuthority()
  const old = deferred<TransportResponse>()
  const row: MissionRecord = {
    missionID: "mission_b",
    sessionID: "ses_b",
    directory,
    title: "B mission",
    boardLane: "backlog",
    created: 1,
    updated: 2,
    interruptible: false,
    pendingInteractions: 0,
    productPillar: "code",
    taskStats: { inactive: 0, running: 0, total: 0 },
    tasks: [],
  }
  transport((request) => (request.authority?.revision === a.revision ? old.promise : ok([row])))
  const first = reloadMissionBoard(a)
  configure({ serverUrl: "http://b.invalid" })
  await reloadMissionBoard()
  old.resolve(
    ok(
      Array.from({ length: 50 }, (_, i) => ({
        ...row,
        missionID: `mission_a${i}`,
        sessionID: `ses_a${i}`,
        title: "A",
      })),
    ),
  )
  await first
  expect(missionBoardStore.records).toEqual([row])
  expect({ loading: missionBoardStore.loading, error: missionBoardStore.error }).toEqual({ loading: false, error: "" })
})

test("sequential Skill removal preserves the first accepted A response when its authority retires", async () => {
  const a = captureApiAuthority()
  const first = deferred<TransportResponse>()
  const requests: TransportRequest[] = []
  transport((request) => {
    requests.push(request)
    return first.promise
  })
  const work = deleteAllSkills({
    authority: a,
    directory,
    skills: [
      { name: "one", builtin: false, source: "/owned/one", source_type: "config_path" },
      { name: "two", builtin: false, source: "/owned/two", source_type: "config_path" },
    ],
  }).catch((error) => error)
  configure({ serverUrl: "http://b.invalid" })
  setAppStore("skills", [{ name: "B skill" }])
  first.resolve({ ...ok({ removed: "one" }), headers: { "x-opencorvus-request-id": "remove-a" } })
  const error = await work
  expect(error).toBeInstanceOf(ApiAuthorityChangedError)
  expect(error.outcome.response).toMatchObject({
    status: 200,
    body: { removed: "one" },
    headers: { "x-opencorvus-request-id": "remove-a" },
  })
  expect(appStore.skills).toEqual([{ name: "B skill" }])
  expect(requests.map((request) => ({ path: request.path, authority: request.authority, body: request.body }))).toEqual(
    [{ path: "skill/remove", authority: a, body: { kind: "json", value: { source: "/owned/one", kind: "path" } } }],
  )
})

test("accepted Chat creation returns its canonical ID when later view hydration retires", async () => {
  const hydration = deferred<TransportResponse>()
  const requested = deferred<void>()
  transport((request) => {
    if (request.path === "global/chat")
      return ok({ session: { id: "ses_created_a", kind: "conversation", directory, title: "Created A" } })
    requested.resolve()
    return hydration.promise
  })
  const work = createGlobalConversationSession({ experience: "chat", selectionEpoch: boardStore.selectEpoch })
  await requested.promise
  configure({ serverUrl: "http://b.invalid" })
  const selected = {
    kind: "session" as const,
    id: "ses_current_b",
    directory,
    sessionKind: "conversation" as const,
    experience: "chat" as const,
  }
  setBoardStore("selectedSource", selected)
  hydration.resolve(ok({ session: { id: "ses_created_a", kind: "conversation", directory, title: "Created A" } }))
  expect(await work).toBe("ses_created_a")
  expect(boardStore.selectedSource).toEqual(selected)
})
