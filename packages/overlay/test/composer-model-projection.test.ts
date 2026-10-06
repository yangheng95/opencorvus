import { afterEach, beforeEach, expect, test } from "bun:test"
import { ApiError, captureApiAuthority, configure } from "../src/services/api"
import {
  clearComposerModelProjection,
  projectComposerModelFromSession,
  refreshActiveComposerModelFromSession,
  selectComposerModel,
} from "../src/services/composer-model"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import {
  HOST_CAPABILITIES,
  type HostTransport,
  type TransportRequest,
  type TransportResponse,
} from "../src/services/host-transport"
import { appStore, setAppStore } from "../src/store/app"
import { boardStore, setBoardStore } from "../src/store/board"
import { setSettingsStore } from "../src/store/settings"
import { getLocale, setLocaleData } from "../src/utils/i18n"
import enUS from "../src/i18n/en-US.json"
import zhCN from "../src/i18n/zh-CN.json"

const directory = "C:/fixture/history"
const ready = (model: string): TransportResponse => ({
  status: 200,
  ok: true,
  headers: {},
  body: { config: { model }, origin: {} },
})
const unavailable = (): TransportResponse => ({
  status: 400,
  ok: false,
  headers: {},
  body: { name: "ProviderModelNotFoundError", data: { providerID: "openai", modelID: "missing", suggestions: [] } },
})
let responder: (request: TransportRequest) => Promise<TransportResponse> = async () => ready("openai/ready")

function select(sessionID = "session-a") {
  setBoardStore("selectEpoch", boardStore.selectEpoch + 1)
  setBoardStore("selectedSource", {
    kind: "session",
    id: sessionID,
    directory,
    sessionKind: "conversation",
    experience: "chat",
  })
}
function project() {
  const source = boardStore.selectedSource
  if (!source || source.kind !== "session") throw new Error("fixture requires an actual Session source")
  return projectComposerModelFromSession(
    { sessionID: source.id, directory, authority: captureApiAuthority() },
    () => true,
  )
}
function pendingRead() {
  let release!: (response: TransportResponse) => void
  let started!: () => void
  const entered = new Promise<void>((resolve) => {
    started = resolve
  })
  const response = new Promise<TransportResponse>((resolve) => {
    release = resolve
  })
  responder = async () => {
    started()
    return response
  }
  return { entered, release }
}

beforeEach(() => {
  setLocaleData(getLocale(), getLocale() === "zh-CN" ? zhCN : enUS)
  configure({ serverUrl: "http://fixture.invalid", directory, password: "" })
  setSettingsStore("serverUrl", "http://fixture.invalid")
  setAppStore("connected", true)
  select()
  clearComposerModelProjection()
  responder = async () => ready("openai/ready")
  const transport: HostTransport = {
    kind: "tauri",
    capabilities: HOST_CAPABILITIES.tauri,
    async request<T>(request: TransportRequest) {
      return (await responder(request)) as TransportResponse<T>
    },
    openStream() {
      throw new Error("stream is outside this model projection fixture")
    },
    async native(command) {
      if (command.kind === "settings.save") return true
      throw new Error("unexpected native command")
    },
  }
  __setHostTransportForTest(transport)
})
afterEach(() => {
  clearComposerModelProjection()
  setBoardStore("selectedSource", null)
  __setHostTransportForTest(undefined)
})

test("canonical ready configuration publishes its model and clears the issue", async () => {
  expect(await project()).toEqual({ status: "ready", model: "openai/ready" })
  expect(appStore.composerModel).toBe("openai/ready")
  expect(appStore.composerModelIssue).toBeNull()
})

test("typed config failure clears the current model and retry settles the same owner", async () => {
  expect(await project()).toEqual({ status: "ready", model: "openai/ready" })
  expect(appStore.composerModel).toBe("openai/ready")
  responder = async () => unavailable()
  const failed = await project()
  if (failed.status !== "failed") throw new Error("expected failed projection")
  expect(failed.error).toBeInstanceOf(ApiError)
  if (!(failed.error instanceof ApiError)) throw new Error("expected original API error")
  expect(failed.error.status).toBe(400)
  expect(appStore.composerModel).toBe("")
  expect(appStore.composerModelIssue?.error).toBe(failed.error)
  const pending = pendingRead()
  const retry = refreshActiveComposerModelFromSession()
  await pending.entered
  expect(appStore.composerModelIssue?.retrying).toBe(true)
  pending.release(ready("openai/recovered"))
  expect(await retry).toEqual({ status: "ready", model: "openai/recovered" })
  expect(appStore.composerModelIssue).toBeNull()
})

test("same API selection ABA retires the original read", async () => {
  const pending = pendingRead()
  const old = project()
  await pending.entered
  select("session-b")
  select("session-a")
  setAppStore("composerModel", "openai/current")
  pending.release(unavailable())
  expect(await old).toEqual({ status: "retired" })
  expect(appStore.composerModel).toBe("openai/current")
})

test("changed API authority retires the original read", async () => {
  const pending = pendingRead()
  const old = project()
  await pending.entered
  configure({ serverUrl: "http://successor.invalid" })
  responder = async () => ready("openai/successor")
  expect(await project()).toEqual({ status: "ready", model: "openai/successor" })
  pending.release(ready("openai/original"))
  expect(await old).toEqual({ status: "retired" })
  expect(appStore.composerModel).toBe("openai/successor")
})

test("explicit canonical selection wins against an older passive read", async () => {
  const pending = pendingRead()
  const old = project()
  await pending.entered
  responder = async () => ready("openai/explicit")
  await selectComposerModel("openai/explicit")
  pending.release(ready("openai/old"))
  expect(await old).toEqual({ status: "retired" })
  expect(appStore.composerModel).toBe("openai/explicit")
  expect(appStore.composerModelIssue).toBeNull()
})

test("explicit write failure restores the original model and original typed issue", async () => {
  responder = async () => unavailable()
  const original = await project()
  if (original.status !== "failed") throw new Error("expected original failed projection")
  const issue = appStore.composerModelIssue
  await expect(selectComposerModel("openai/explicit")).rejects.toBeInstanceOf(ApiError)
  expect(appStore.composerModel).toBe("")
  expect(appStore.composerModelIssue?.error).toBe(issue?.error)
  expect(appStore.composerModelIssue?.retrying).toBe(false)
})

test("passive saved configuration and pending explicit write settle to the canonical confirmed model", async () => {
  responder = async () => unavailable()
  const failed = await project()
  expect(failed.status).toBe("failed")
  let release!: (response: TransportResponse) => void
  let started!: () => void
  const entered = new Promise<void>((resolve) => {
    started = resolve
  })
  const confirmation = new Promise<TransportResponse>((resolve) => {
    release = resolve
  })
  responder = async (request) => {
    if (request.method === "PATCH") {
      started()
      return confirmation
    }
    return ready("openai/confirmed")
  }
  const write = selectComposerModel("openai/confirmed")
  await entered
  expect(await project()).toEqual({ status: "ready", model: "openai/confirmed" })
  expect(appStore.composerModel).toBe("openai/confirmed")
  expect(appStore.composerModelIssue).toBeNull()
  release(ready("openai/confirmed"))
  await write
  expect(appStore.composerModel).toBe("openai/confirmed")
  expect(appStore.composerModelIssue).toBeNull()
})
