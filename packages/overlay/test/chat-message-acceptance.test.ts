import { afterEach, beforeEach, expect, test } from "bun:test"
import { reconcile } from "solid-js/store"
import { WorkLedgerMissionRow } from "@opencorvus-ai/transport-protocol"
import { ApiError, captureApiAuthority, configure } from "../src/services/api"
import { panelMessage, promptSessionMessage, retireChatRequestProjection, stopChatRequest } from "../src/services/chat"
import { composerDraftStore, composerSubmission, setComposerDraftStore } from "../src/services/composer-draft"
import { HOST_CAPABILITIES, type HostTransport, type TransportRequest, type TransportResponse } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { wakeMission } from "../src/services/mission"
import { retireWorkLedgerProjection, setWorkLedgerRuntimeRows } from "../src/services/work-ledger"
import { setBoardStore } from "../src/store/board"
import { acknowledgeChatRequestMessage, messageStore, setChatRequest } from "../src/store/messages"

const directory = "D:/owned/acceptance"
const model = { providerID: "openai", modelID: "gpt-6.1-sol" }
const response = (body: unknown, status = 200): TransportResponse => ({ status, ok: status < 400, headers: {}, body })
function transport(respond: (request: TransportRequest) => TransportResponse | Promise<TransportResponse>) {
  __setHostTransportForTest({
    kind: "browser", capabilities: HOST_CAPABILITIES.browser,
    async request<T>(request: TransportRequest) { return await respond(request) as TransportResponse<T> },
    openStream() { throw new Error("Unexpected stream in transport unit") },
    async native() { throw new Error("Unexpected native call in transport unit") },
  } satisfies HostTransport)
}
function body(request: TransportRequest): Record<string, any> {
  if (request.body?.kind === "json") return request.body.value as Record<string, any>
  if (request.body?.kind === "text") return JSON.parse(request.body.value)
  throw new Error("Expected serialized request body")
}
beforeEach(() => {
  configure({ serverUrl: "http://acceptance.invalid", directory, password: "" })
  setBoardStore({ selectedSource: null, board: null, taskSwitching: false })
  retireWorkLedgerProjection()
  retireChatRequestProjection()
  setComposerDraftStore("drafts", reconcile({ current: { text: "author input", updated: 100 } }))
})
afterEach(() => {
  retireChatRequestProjection()
  retireWorkLedgerProjection()
  setComposerDraftStore("drafts", reconcile({}))
  __setHostTransportForTest(undefined)
  configure({ serverUrl: "http://127.0.0.1:7878", directory: "" })
})

test("rejected Session sends retain the exact request identity across a manual retry", async () => {
  const sent: Record<string, any>[] = []
  const events: string[] = []
  transport((request) => { sent.push(body(request)); return response({ name: "StorageReadError", message: "owned original unavailable" }, 500) })
  const input = { sessionID: "ses_owned", directory, text: "author input", model, composerDraftKey: "current", onDispatch: () => events.push("dispatch"), onAccepted: () => events.push("accepted") }
  for (let i = 0; i < 2; i++) {
    const error = await promptSessionMessage(input).catch(error => error)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(500)
  }
  expect(sent).toEqual([sent[0], sent[0]])
  expect(sent[0]).toMatchObject({ messageID: composerDraftStore.drafts.current.submission!.messageID, parts: [{ type: "text", text: "author input" }], model })
  expect(events).toEqual(["dispatch", "dispatch"])
  expect(composerDraftStore.drafts.current.text).toBe("author input")
})

test("an attachment change acquires the identity of the new actual request", async () => {
  const sent: Record<string, any>[] = []
  transport((request) => { sent.push(body(request)); return response({ message: "owned failure" }, 500) })
  for (const filename of ["first.txt", "second.txt"]) {
    await promptSessionMessage({ sessionID: "ses_owned", directory, text: "author input", model, composerDraftKey: "current", attachments: [{ url: `attachment://${filename}`, mime: "text/plain", filename }] }).catch(error => expect(error.status).toBe(500))
  }
  expect(sent.map(value => value.parts[1].filename)).toEqual(["first.txt", "second.txt"])
  expect(new Set(sent.map(value => value.messageID)).size).toBe(2)
  expect(composerDraftStore.drafts.current.submission!.messageID).toBe(sent[1].messageID)
})

test("first-send canonical configuration and the ready-view retry share the same exact identity", async () => {
  const sent: Record<string, any>[] = []
  const paths: string[] = []
  transport(request => {
    paths.push(request.path)
    if (request.path.endsWith("/config")) return response({ config: { model: "openai/gpt-6.1-sol" } })
    sent.push(body(request))
    return response({ message: "owned storage failure" }, 500)
  })
  for (const selection of [undefined, model]) {
    const error = await promptSessionMessage({ sessionID: "ses_owned", directory, text: "author input", model: selection, composerDraftKey: "current" }).catch(error => error)
    expect(error.status).toBe(500)
  }
  expect(paths).toEqual(["session/ses_owned/config", "session/ses_owned/message", "session/ses_owned/message"])
  expect(sent).toEqual([sent[0], sent[0]])
  expect(sent[0].model).toEqual(model)
})

test("an unresolved canonical model returns its preparation error with the authored draft retained", async () => {
  transport(() => response({ config: { model: "" } }))
  const error = await promptSessionMessage({ sessionID: "ses_owned", directory, text: "author input", composerDraftKey: "current" }).catch(error => error)
  expect(error.message).toBe("Session model is unresolved: ses_owned")
  expect(composerDraftStore.drafts.current).toEqual({ text: "author input", updated: 100 })
})

test("a real matching user receipt acknowledges the request before its HTTP error settles", async () => {
  const pending = Promise.withResolvers<TransportResponse>()
  const events: string[] = []
  let sent: Record<string, any> = {}
  transport(request => { sent = body(request); return pending.promise })
  const sending = promptSessionMessage({ sessionID: "ses_owned", directory, text: "author input", model, composerDraftKey: "current", onDispatch: () => events.push("dispatch"), onAccepted: () => events.push("accepted") }).catch(error => error)
  acknowledgeChatRequestMessage({ id: sent.messageID, sessionID: "ses_owned", role: "user" })
  expect(events).toEqual(["dispatch", "accepted"])
  pending.resolve(response({ message: "response interrupted" }, 502))
  const error = await sending
  expect(error).toBeInstanceOf(ApiError)
  expect(error.status).toBe(502)
})

test("a successful Session response confirms acceptance before a malformed projection is reported", async () => {
  const events: string[] = []
  transport(() => response(null))
  const error = await promptSessionMessage({ sessionID: "ses_owned", directory, text: "author input", model, onDispatch: () => events.push("dispatch"), onAccepted: () => events.push("accepted") }).catch(error => error)
  expect(error.message).toBe("ingestPersistedConversationMessage: persisted message missing info.id")
  expect(events).toEqual(["dispatch", "accepted"])
})

test("confirmed Session Stop preserves prose and makes the next send a new intent", async () => {
  const first = composerSubmission("current", "request content")
  const requests: string[] = []
  transport(request => { requests.push(request.path); return response(true) })
  setChatRequest({ authority: captureApiAuthority(), requestID: "local_owned", controller: new AbortController(), target: { kind: "session", sessionID: "ses_owned", directory }, composerDraftKey: "current", messageID: first.messageID })
  expect(await stopChatRequest()).toBe(true)
  expect(requests).toEqual(["session/ses_owned/abort"])
  expect(composerDraftStore.drafts.current).toEqual({ text: "author input", updated: expect.any(Number) })
  const next = composerSubmission("current", "request content")
  expect(new Set([first.messageID, next.messageID]).size).toBe(2)
})

test("Mission wake retries use its existing request identity and acknowledge the returned receipt", async () => {
  const sent: Record<string, any>[] = []
  const events: string[] = []
  const receipt = { missionID: "msn_owned", sessionID: "ses_owned", created: false, productPillar: "code" }
  transport(request => { sent.push(body(request)); return sent.length === 1 ? response({ message: "connection failed" }, 502) : response(receipt) })
  const input = { missionID: "msn_owned", directory, text: "author input", productPillar: "code" as const, model: "openai/gpt-6.1-sol", composerDraftKey: "current", onDispatch: () => events.push("dispatch"), onAccepted: () => events.push("accepted") }
  const error = await wakeMission(input).catch(error => error)
  expect(error.status).toBe(502)
  expect(await wakeMission(input)).toEqual(receipt)
  expect(sent).toEqual([sent[0], sent[0]])
  expect(events).toEqual(["dispatch", "dispatch", "accepted"])
})

test("Task follow-up retries reuse the authored request and acknowledge the returned ingress", async () => {
  const sent: Record<string, unknown>[] = []
  const events: string[] = []
  const receipt = {
    wake_status: "accepted",
    ingress_id: "art_owned_task_ingress",
    user_message: { info: { id: "msg_owned_task_note" }, parts: [] },
  }
  transport((request) => {
    expect(request.path).toBe("task/tsk_owned/message")
    sent.push(body(request))
    if (sent.length === 1) throw new TypeError("reply interrupted")
    setBoardStore("selectEpoch", (epoch) => epoch + 1)
    return response(receipt, 202)
  })
  const send = () => panelMessage("author input", [], { target: { taskID: "tsk_owned", directory } },
    () => events.push("dispatch"), { composerDraftKey: "current", onAccepted: () => events.push("accepted") })
  await expect(send()).rejects.toThrow("reply interrupted")
  expect(await send()).toEqual(receipt)
  expect(sent).toEqual(Array(2).fill({
    text: "author input", source: "panel", requestID: composerDraftStore.drafts.current.submission!.messageID,
  }))
  expect(events).toEqual(["dispatch", "dispatch", "accepted"])
})

test("confirmed Mission Stop retires the exact dispatched wake identity and retains authored input", async () => {
  setWorkLedgerRuntimeRows([WorkLedgerMissionRow.parse({ kind: "mission", id: "owned-mission", missionID: "owned-mission", sessionID: "ses_owned", title: "Owned Mission", directory, created: 1, started: 1, updated: 2, pinned: false, interruptible: true, outcome: null, productPillar: "code", taskStats: { total: 0, running: 0, inactive: 0 }, pendingInteractions: 0, tasks: [] })])
  const pending = Promise.withResolvers<TransportResponse>()
  const paths: string[] = []
  let sent: Record<string, any> = {}
  transport(request => {
    paths.push(request.path)
    if (request.path === "mission/wake") { sent = body(request); return pending.promise }
    return response(true)
  })
  const sending = promptSessionMessage({ sessionID: "ses_owned", directory, text: "author input", model, composerDraftKey: "current" })
  expect(messageStore.chatRequest).toMatchObject({ messageID: sent.requestID, composerDraftKey: "current", target: { kind: "mission", missionID: "owned-mission", directory } })
  expect(await stopChatRequest()).toBe(true)
  expect(paths).toEqual(["mission/wake", "mission/owned-mission/abort"])
  expect(composerDraftStore.drafts.current).toEqual({ text: "author input", updated: expect.any(Number) })
  const next = composerSubmission("current", "next request")
  expect(new Set([sent.requestID, next.messageID]).size).toBe(2)
  pending.resolve(response({ message: "request cancelled" }, 409))
  expect(await sending).toBe(undefined)
})
