import { afterEach, beforeEach, expect, test } from "bun:test"
import { reconcile } from "solid-js/store"
import { saveConnectionSettings } from "../src/services/connection-settings"
import { captureApiAuthority, configure, isApiAuthorityCurrent, ApiAuthorityChangedError } from "../src/services/api"
import {
  HOST_CAPABILITIES,
  type HostTransport,
  type TransportRequest,
  type TransportResponse,
} from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import {
  applySettings,
  bootstrapOverlaySettings,
  confirmedPersistedSettingsSnapshot,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  settingsStore,
  SettingsActivationError,
  setSettingsStore,
} from "../src/store/settings"
import type { PersistedOverlaySettings } from "../src/services/persisted-overlay-settings"
import { boardStore, setBoardStore } from "../src/store/board"
import {
  closeFileEditor,
  fileEditorReserved,
  FileEditorAdmissionError,
  openFileEditor,
  registerFileEditorBeforeNavigate,
  selectedFileTarget,
} from "../src/services/file-workbench"
import {
  composerDraftStore,
  setComposerDraftStore,
  setComposerDraft,
  setComposerQuotation,
  composerSubmission,
  workspaceComposerDraftKey,
} from "../src/services/composer-draft"
import { appStore, setAppStore, setConnectionStatus } from "../src/store/app"
import { checkConnection, restartLocalServer, syncLocalServerUrl } from "../src/services/connection"
import { installRealOverlayI18n } from "./fixtures/i18n"
import { deleteProjectState, ensureDefaultDirectory, type ProjectDeleteResult } from "../src/services/workspace"

installRealOverlayI18n()
const A = "http://owned-a.invalid"
const B = "http://owned-b.invalid"
const directory = "D:/owned/connection/project-a"
const source = {
  kind: "session" as const,
  id: "ses_owned_a",
  directory,
  sessionKind: "conversation" as const,
  experience: "chat" as const,
}
const draftKey = workspaceComposerDraftKey("", source.id, directory)
const originalFrame = globalThis.requestAnimationFrame
let persisted: PersistedOverlaySettings
let writes: PersistedOverlaySettings[]
let beforePersist: () => Promise<void>
let confirmLeave: () => Promise<number | null>
let unregister: () => void

function installTransport(
  request?: (input: TransportRequest) => Promise<TransportResponse>,
  native?: HostTransport["native"],
): void {
  __setHostTransportForTest({
    kind: native ? "tauri" : "browser",
    capabilities: native ? HOST_CAPABILITIES.tauri : HOST_CAPABILITIES.browser,
    request: async <T>(input: TransportRequest) => {
      if (!request) throw new Error("Unexpected HTTP in settings-only local contract")
      return (await request(input)) as TransportResponse<T>
    },
    openStream: () => {
      throw new Error("Unexpected stream in settings-only local contract")
    },
    native:
      native ??
      (async (command) => {
        if (command.kind === "settings.load") return structuredClone(persisted)
        if (command.kind === "settings.save") {
          const payload = structuredClone(command.payload)
          writes.push(payload)
          await beforePersist()
          persisted = payload
          return true
        }
        throw new Error(`Unexpected native command ${command.kind}`)
      }),
  })
}

beforeEach(async () => {
  globalThis.requestAnimationFrame = (callback) => {
    queueMicrotask(() => callback(performance.now()))
    return 0
  }
  applySettings({
    ...DEFAULT_SETTINGS,
    serverUrl: A,
    autoServer: false,
    savedDirectory: directory,
    directory,
    workspaceTaskID: "tsk_owned_a",
    workspaceDirectory: directory,
    lastSelectedModel: "owned/model-a",
  })
  configure({ serverUrl: A, username: "opencorvus", password: "", directory })
  setSettingsStore("savedDirectory", directory)
  persisted = bootstrapOverlaySettings()
  writes = []
  beforePersist = async () => {}
  confirmLeave = async () => 7
  installTransport()
  await loadSettings()
  setSettingsStore({ workspaceEpoch: 0, directoryEpoch: 0 })
  setBoardStore({ selectedSource: source, board: null, selectEpoch: 4, taskSwitching: true })
  setAppStore({ serverPid: undefined, enginePaths: null })
  setConnectionStatus("online")
  setComposerDraftStore("drafts", reconcile({}))
  unregister = registerFileEditorBeforeNavigate({
    confirmLeave: () => confirmLeave(),
    getRevision: () => 7,
    isBusy: () => false,
    isDirty: () => true,
  })
  await openFileEditor("note.txt", { directory })
})

afterEach(async () => {
  unregister()
  await closeFileEditor()
  setBoardStore({ selectedSource: null, board: null, taskSwitching: false })
  setComposerDraftStore("drafts", reconcile({}))
  __setHostTransportForTest(undefined)
  applySettings(DEFAULT_SETTINGS)
  configure({ serverUrl: DEFAULT_SETTINGS.serverUrl, username: "opencorvus", password: "", directory: "" })
  globalThis.requestAnimationFrame = originalFrame
})

test("local confirmed departure retains exact A file until ack and commits cleared B pointers before the queued preference", async () => {
  const initialTheme = persisted.theme
  setComposerDraft(draftKey, '@skill("owned-a") prose A')
  setComposerQuotation(draftKey, { text: "A quote", sessionID: source.id, messageID: "msg_owned_a" })
  composerSubmission(draftKey, "owned request A")
  const started = Promise.withResolvers<void>()
  const pending = Promise.withResolvers<void>()
  beforePersist = async () => {
    started.resolve()
    await pending.promise
  }
  const save = saveConnectionSettings({ serverUrl: B, username: "opencorvus", password: "" })
  await started.promise
  expect({ server: settingsStore.serverUrl, target: selectedFileTarget()?.path, held: fileEditorReserved() }).toEqual({
    server: A,
    target: "note.txt",
    held: true,
  })
  setComposerDraft(draftKey, '@mission("owned-a") newer prose A')
  setComposerDraft("other", "ordinary waiting prose")
  const preference = saveSettings({ overrides: { theme: "dark" } })
  pending.resolve()
  const { authority, retiredReferences } = await save
  await preference
  expect({
    source: boardStore.selectedSource,
    target: selectedFileTarget(),
    held: fileEditorReserved(),
    switching: boardStore.taskSwitching,
  }).toEqual({ source: null, target: null, held: false, switching: false })
  expect({
    server: settingsStore.serverUrl,
    directory: settingsStore.directory,
    savedDirectory: settingsStore.savedDirectory,
    workspaceEpoch: settingsStore.workspaceEpoch,
    directoryEpoch: settingsStore.directoryEpoch,
    selectionEpoch: boardStore.selectEpoch,
    model: settingsStore.lastSelectedModel,
  }).toEqual({
    server: B,
    directory: "",
    savedDirectory: "",
    workspaceEpoch: 1,
    directoryEpoch: 1,
    selectionEpoch: 5,
    model: "",
  })
  expect(
    writes.map((entry) => ({
      server: entry.serverUrl,
      directory: entry.directory,
      task: entry.workspaceTaskID,
      workspace: entry.workspaceDirectory,
      theme: entry.theme,
    })),
  ).toEqual([
    { server: B, directory: undefined, task: undefined, workspace: undefined, theme: initialTheme },
    { server: B, directory: undefined, task: undefined, workspace: undefined, theme: "dark" },
  ])
  expect(composerDraftStore.drafts[workspaceComposerDraftKey("", "", "")]?.text).toBe("newer prose A")
  expect(Object.keys(composerDraftStore.drafts.other!)).toEqual(["text", "updated"])
  expect(composerDraftStore.drafts.other?.text).toBe("ordinary waiting prose")
  expect(isApiAuthorityCurrent(authority)).toBe(true)
  expect(retiredReferences).toBe(true)
})

test("local persistence failure releases the same reservation and retains exact original source/draft", async () => {
  setComposerDraft(draftKey, "original prose")
  const quotation = { text: "owned quote", sessionID: source.id, messageID: "msg_owned_a" }
  setComposerQuotation(draftKey, quotation)
  const failure = new Error("Owned preference write failed")
  beforePersist = async () => {
    throw failure
  }
  await expect(saveConnectionSettings({ serverUrl: B, username: "opencorvus", password: "" })).rejects.toBe(failure)
  expect({
    applied: settingsStore.serverUrl,
    durable: persisted.serverUrl,
    confirmed: confirmedPersistedSettingsSnapshot().serverUrl,
    target: selectedFileTarget()?.path,
    held: fileEditorReserved(),
  }).toEqual({ applied: A, durable: A, confirmed: A, target: "note.txt", held: false })
  expect(composerDraftStore.drafts[draftKey]).toMatchObject({ text: "original prose", quotation })
  setComposerDraft(draftKey, "retry prose")
  beforePersist = async () => {}
  await saveConnectionSettings({ serverUrl: B, username: "opencorvus", password: "" })
  expect(composerDraftStore.drafts[workspaceComposerDraftKey("", "", "")]?.text).toBe("retry prose")
})

test("local Cancel returns its explicit admission contract and the next queued preference persists A", async () => {
  confirmLeave = async () => null
  const result = await saveConnectionSettings({ serverUrl: B, username: "opencorvus", password: "" }).catch(
    (error) => error,
  )
  expect(result).toBeInstanceOf(FileEditorAdmissionError)
  expect(result.reason).toBe("cancelled")
  await saveSettings({ overrides: { theme: "dark" } })
  expect(writes.map((entry) => ({ server: entry.serverUrl, theme: entry.theme, directory: entry.directory }))).toEqual([
    { server: A, theme: "dark", directory },
  ])
  expect({
    source: boardStore.selectedSource?.id,
    target: selectedFileTarget()?.path,
    held: fileEditorReserved(),
  }).toEqual({ source: source.id, target: "note.txt", held: false })
})

test("local draft parsing happens at the writer before ack; confirmed activation consumes prepared prose", async () => {
  setComposerDraft(draftKey, "safe prose")
  const started = Promise.withResolvers<void>()
  const pending = Promise.withResolvers<void>()
  beforePersist = async () => {
    started.resolve()
    await pending.promise
  }
  const save = saveConnectionSettings({ serverUrl: B, username: "opencorvus", password: "" })
  await started.promise
  expect(() => setComposerDraft(draftKey, String.raw`@skill("\q")`)).toThrow(SyntaxError)
  expect(composerDraftStore.drafts[draftKey]?.text).toBe("safe prose")
  pending.resolve()
  await save
  expect({
    server: settingsStore.serverUrl,
    prose: composerDraftStore.drafts[workspaceComposerDraftKey("", "", "")]?.text,
  }).toEqual({ server: B, prose: "safe prose" })
})

test("local same-endpoint reauthentication preserves selected scope and dirty file while returning its exact new token", async () => {
  setComposerDraft(draftKey, "retained text")
  const previous = captureApiAuthority()
  const { authority } = await saveConnectionSettings({ serverUrl: A, username: "", password: "" })
  expect({
    revision: authority.revision,
    source: boardStore.selectedSource?.id,
    target: selectedFileTarget()?.path,
    directory: settingsStore.directory,
    workspaceEpoch: settingsStore.workspaceEpoch,
    prose: composerDraftStore.drafts[draftKey]?.text,
  }).toEqual({
    revision: previous.revision + 1,
    source: source.id,
    target: "note.txt",
    directory,
    workspaceEpoch: 0,
    prose: "retained text",
  })
  expect(persisted.username).toBe("")
})

test("local activation error truthfully retains durable acknowledgement and releases prepare before the next save", async () => {
  const events: string[] = []
  const result = await saveSettings({
    overrides: { theme: "dark" },
    prepare: async () => ({
      onConfirmed: () => {
        throw new Error("Owned activation failure")
      },
      release: () => {
        events.push("released")
      },
    }),
  }).catch((error) => error)
  expect(result).toBeInstanceOf(SettingsActivationError)
  expect({ persisted: result.persisted, theme: confirmedPersistedSettingsSnapshot().theme, events }).toEqual({
    persisted: true,
    theme: "dark",
    events: ["released"],
  })
  await saveSettings({ overrides: { zoom: 1.2 } })
  expect(persisted.zoom).toBe(1.2)
})

test("local acknowledged same-URL native restart retires once, marks connecting and preserves the file", async () => {
  const url = "http://127.0.0.1:17800"
  setSettingsStore({ serverUrl: url, autoServer: true })
  configure({ serverUrl: url })
  setAppStore("serverPid", 100)
  installTransport(undefined, async (command) => {
    if (command.kind === "server.restart" || command.kind === "server.info") return { url, pid: 101 }
    throw new Error(`Unexpected native command ${command.kind}`)
  })
  const before = captureApiAuthority()
  await restartLocalServer()
  expect({
    revision: captureApiAuthority().revision,
    pid: appStore.serverPid,
    connected: appStore.connected,
    status: appStore.connectionStatus,
    target: selectedFileTarget()?.path,
    source: boardStore.selectedSource?.id,
  }).toEqual({
    revision: before.revision + 1,
    pid: 101,
    connected: false,
    status: "connecting",
    target: "note.txt",
    source: source.id,
  })
  await syncLocalServerUrl()
  expect(captureApiAuthority().revision).toBe(before.revision + 1)
})

test("local old health completion settles its caller while B retains its current public connection facts", async () => {
  const pending = Promise.withResolvers<void>()
  const started = Promise.withResolvers<void>()
  installTransport(async () => {
    started.resolve()
    await pending.promise
    return {
      status: 200,
      ok: true,
      headers: {},
      body: { healthy: true, paths: { database: "owned-a", data: "owned-a", home: "owned-a" } },
    }
  })
  const old = checkConnection({ background: true })
  await started.promise
  configure({ serverUrl: B })
  setAppStore("enginePaths", { database: "owned-b", data: "owned-b", home: "owned-b" })
  setConnectionStatus("online")
  pending.resolve()
  expect(await old).toBe(false)
  expect({ status: appStore.connectionStatus, paths: appStore.enginePaths }).toEqual({
    status: "online",
    paths: { database: "owned-b", data: "owned-b", home: "owned-b" },
  })
})

test("local same-directory project deletion keeps B's pending operation distinct from A's actual response", async () => {
  const a = captureApiAuthority()
  const pendingA = Promise.withResolvers<TransportResponse>()
  const pendingB = Promise.withResolvers<TransportResponse>()
  const startedA = Promise.withResolvers<void>()
  const startedB = Promise.withResolvers<void>()
  const requests: number[] = []
  installTransport(async (request) => {
    requests.push(request.authority!.revision)
    if (request.authority!.revision === a.revision) {
      startedA.resolve()
      return pendingA.promise
    }
    startedB.resolve()
    return pendingB.promise
  })
  const provenance = { surface: "overlay.work_ledger" as const, reason: "Owned local deletion contract" }
  const old = deleteProjectState(directory, provenance, a).catch((error) => error)
  await startedA.promise
  configure({ serverUrl: B })
  const b = captureApiAuthority()
  const current = deleteProjectState(directory, provenance, b)
  await startedB.promise
  const joined = deleteProjectState(directory, provenance, b)
  const body: ProjectDeleteResult = {
    ok: true,
    status: "committed",
    projectID: "owned",
    directory,
    residue: [],
    deletedTaskCount: 0,
  }
  const responseA: TransportResponse = { status: 200, ok: true, headers: {}, body: { ...body, projectID: "owned-a" } }
  pendingA.resolve(responseA)
  const oldOutcome = await old
  expect(oldOutcome).toBeInstanceOf(ApiAuthorityChangedError)
  expect(oldOutcome.outcome).toEqual({ phase: "response", response: responseA })
  pendingB.resolve({ status: 200, ok: true, headers: {}, body: { ...body, projectID: "owned-b" } })
  const result = await current
  expect(await joined).toBe(result)
  expect(result).toEqual({ status: "deleted", result: { ...body, projectID: "owned-b" } })
  expect(requests).toEqual([a.revision, b.revision])
})

test("local discovery's original authority retains B's explicit directory on late A completion", async () => {
  setBoardStore("selectedSource", null)
  setSettingsStore({ directory: "", savedDirectory: "" })
  const pending = Promise.withResolvers<void>()
  const started = Promise.withResolvers<void>()
  installTransport(async () => {
    started.resolve()
    await pending.promise
    return {
      status: 200,
      ok: true,
      headers: {},
      body: { root: "owned", defaultDirectory: "D:/owned/default-a", projects: [] },
    }
  })
  const old = ensureDefaultDirectory().catch((error) => error)
  await started.promise
  configure({ serverUrl: B, directory: "D:/owned/explicit-b" })
  setSettingsStore({ directory: "D:/owned/explicit-b", directoryEpoch: 2 })
  pending.resolve()
  expect(await old).toBeInstanceOf(ApiAuthorityChangedError)
  expect({ directory: settingsStore.directory, epoch: settingsStore.directoryEpoch }).toEqual({
    directory: "D:/owned/explicit-b",
    epoch: 2,
  })
})

test("local supplied health authority reports the acknowledged native handoff, then a fresh exact probe succeeds", async () => {
  const url = "http://127.0.0.1:17800"
  setSettingsStore({ serverUrl: url, autoServer: true })
  configure({ serverUrl: url })
  setAppStore("serverPid", 100)
  installTransport(
    async () => ({ status: 200, ok: true, headers: {}, body: { healthy: true } }),
    async (command) => {
      if (command.kind === "server.info") return { url, pid: 102 }
      throw new Error(`Unexpected native command ${command.kind}`)
    },
  )
  const original = captureApiAuthority()
  const old = await checkConnection({ authority: original }).catch((error) => error)
  expect(old).toBeInstanceOf(ApiAuthorityChangedError)
  expect({
    pid: appStore.serverPid,
    status: appStore.connectionStatus,
    revision: captureApiAuthority().revision,
  }).toEqual({ pid: 102, status: "connecting", revision: original.revision + 1 })
  let receipt: ReturnType<typeof captureApiAuthority> | undefined
  expect(
    await checkConnection({
      onHealthy: (authority) => {
        receipt = authority
        return undefined
      },
    }),
  ).toBe(true)
  expect({ receipt: receipt?.revision, status: appStore.connectionStatus }).toEqual({
    receipt: original.revision + 1,
    status: "online",
  })
})
