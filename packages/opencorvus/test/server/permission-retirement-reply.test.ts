import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Config } from "../../src/config/config"
import { Identifier } from "../../src/id/id"
import { PermissionAuthority } from "../../src/permission/authority"
import { PermissionLedgerTable, PermissionExecutionResultTable } from "../../src/permission/permission.sql"
import { Instance } from "../../src/project/instance"
import { Server } from "../../src/server/server"
import { Session } from "../../src/session"
import { MessageStore } from "../../src/session/message-store"
import { Database, asc, eq, sql } from "../../src/storage/db"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import { startControlledStreamingProvider } from "../fixture/controlled-streaming-provider"
import { BusPublicationOutboxTable } from "../../src/bus/bus.sql"
import { withTimeout } from "../../src/util/await-with-timeout"
import { SessionPrompt } from "../../src/session/prompt"
import { createExecutionCancellationOrigin } from "../../src/session/prompt/cancellation"
import { currentRuntimeProcessOccurrence } from "../../src/runtime/process-occurrence"
import { Log } from "../../src/util/log"

afterEach(async () => { await Instance.disposeAll(); await resetMemoryDatabase() })

test("public shutdown retires pending permission and a later operator reply returns the original cancellation", async () => {
  const startedAt = Date.now(), originalDeadline = startedAt + 90000, closeBy = originalDeadline - 15000
  const root = process.env.OPENCORVUS_TEST_PROCESS_ROOT
  if (!root) throw Error("Formal isolated test process required")
  const external = process.env.OPENCORVUS_PERMISSION_RETIREMENT_EVIDENCE
  if (external && !path.isAbsolute(external)) throw Error("Explicit absolute evidence root required")
  const evidence = external ?? path.join(root, "permission-retirement-reply")
  await fs.mkdir(evidence, { recursive: false })
  const facts: Record<string, unknown> = { startedAt, originalDeadline, closeBy, pid: process.pid,
    occurrence: currentRuntimeProcessOccurrence(), evidence,
    providerCreated: false, providerClosed: "not_started", providerResponsesJoined: "not_started",
    originalListenerCreated: false, originalListenerClosed: "not_started",
    replyListenerCreated: false, replyListenerClosed: "not_started", instanceCreated: false, instanceClosed: "not_started",
    originalExecutionStarted: false, originalExecutionJoined: "not_started" }
  const write = (name: string, value: unknown) => fs.writeFile(path.join(evidence, name), JSON.stringify(value, null, 2))
  await write("scope-start.json", facts)
  const within = <T>(operation: Promise<T>, label: string, closing = false) =>
    withTimeout(operation, Math.max(1, (closing ? originalDeadline : closeBy) - Date.now()), label)
  await using project = await within(memoryProject(), "Owned public Project setup")
  const source = path.join(path.dirname(project.path), `public-retirement-${Identifier.ascending("part")}.csv`)
  const provider = startControlledStreamingProvider({ firstPromptToolCall: { name: "read", arguments: { filePath: source } } })
  const model = { providerID: "public-retirement-contract", modelID: "session-prompt-owner-model" }
  facts.providerCreated = true
  facts.providerClosed = false
  facts.providerURL = provider.apiURL
  const requests: unknown[] = []
  let originalServer: ReturnType<typeof Server.listen> | undefined
  let server: ReturnType<typeof Server.listen> | undefined
  let execution: Promise<unknown> | undefined
  let primaryError: unknown
  let originalRequest: PermissionAuthority.Request | undefined
  let session: Session.Info | undefined
  const signal = () => AbortSignal.timeout(Math.max(1, Math.min(30000, closeBy - Date.now())))
  const release = setInterval(() => { for (const request of provider.requests) request.release() }, 5)
  async function captureFacts(name: string) {
    if (!originalRequest) return write(name, { request: null, state: "not_started" })
    const request = originalRequest
    const ledger = Database.use(db => db.select().from(PermissionLedgerTable)
      .where(eq(PermissionLedgerTable.request_id, request.id)).orderBy(asc(sql`rowid`)).all())
    const results = Database.use(db => ledger.filter(row => row.event_type === "execution_started")
      .map(row => db.select().from(PermissionExecutionResultTable)
        .where(eq(PermissionExecutionResultTable.attempt_id, row.attempt_id!)).get() ?? null))
    const outbox = Database.use(db => db.select().from(BusPublicationOutboxTable).where(sql`
      json_extract(${BusPublicationOutboxTable.properties}, '$.requestID') = ${request.id}
      OR json_extract(${BusPublicationOutboxTable.properties}, '$.info.id') = ${request.messageID}
      OR json_extract(${BusPublicationOutboxTable.properties}, '$.part.messageID') = ${request.messageID}
    `).orderBy(asc(BusPublicationOutboxTable.occurrence_id)).all())
    const message = await MessageStore.get({ sessionID: request.sessionID, messageID: request.messageID })
    const snapshot = { observedAt: Date.now(), request, ledger, message, results, outbox }
    await write(name, snapshot)
    return snapshot
  }
  async function captureLog(name: string) {
    await Log.flush()
    await fs.writeFile(path.join(evidence, name), await fs.readFile(Log.file()))
  }
  async function api(route: string, body?: unknown) {
    if (Date.now() >= closeBy) throw Error("Original route contract close reserve reached")
    const requestStartedAt = Date.now(), listenerURL = server!.url.toString()
    try {
    const response = await fetch(new URL(route, server!.url), { method: body === undefined ? "GET" : "POST",
      headers: { "content-type": "application/json", "x-opencorvus-directory": project.path },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: signal(),
    })
    const result = { route, listenerURL, requestStartedAt, observedAt: Date.now(), status: response.status,
      requestID: response.headers.get("x-opencorvus-request-id"), body: await response.json() }
    requests.push(result)
    await write("http-receipts.json", requests)
    return result
    } catch (error) {
      requests.push({ route, listenerURL, requestStartedAt, observedAt: Date.now(), error: String(error) })
      await write("http-receipts.json", requests)
      throw error
    }
  }
  try {
    await within(fs.writeFile(source, "item,quantity\nMaple,3\nIris,4\n"), "Owned public source setup")
    await within(Config.updateGlobalPatch({
      model: `${model.providerID}/${model.modelID}`,
      small_model: `${model.providerID}/${model.modelID}`,
      permission_mode: "ask", prompt_profile: { active: "base" },
      enabled_providers: [model.providerID],
      mcp: { browser: { enabled: false }, computer: { enabled: false } },
      provider: { [model.providerID]: { name: "Public retirement contract", npm: "@ai-sdk/openai-compatible",
        api: provider.apiURL, options: { apiKey: "local-controlled-provider" }, models: {
          [model.modelID]: { name: "Public retirement contract", tool_call: true,
            modalities: { input: ["text"], output: ["text"] }, limit: { context: 1000000, output: 4096 } },
        },
      } },
    }), "Public controlled model projection")
    originalServer = server = Server.listen({ hostname: "127.0.0.1", port: 0, randomPort: true })
    facts.originalListenerCreated = true
    facts.originalListenerClosed = false
    facts.originalListenerURL = originalServer.url.toString()
    facts.originalListenerCreatedAt = Date.now()
    const created = await api("/session", { kind: "assistant", title: "Public retirement shutdown contract" })
    expect(created.status).toBe(200)
    session = Session.Info.parse(created.body)
    facts.instanceCreated = true
    facts.instanceClosed = false
    const input = { messageID: Identifier.ascending("message"), agent: "chat", model,
      parts: [{ type: "text", text: `Read the public CSV at ${source}.` }] }
    await write("original-public-input.json", { session, input })
    const originalHTTP = api(`/session/${session.id}/message`, input)
    facts.originalExecutionStarted = true
    facts.originalExecutionJoined = false
    execution = originalHTTP.then(
      value => ({ kind: "fulfilled" as const, value }),
      error => ({ kind: "rejected" as const, name: error instanceof Error ? error.name : typeof error, error: String(error) }),
    ).then(async outcome => {
      facts.originalExecutionJoined = true
      facts.originalExecutionOutcome = outcome
      await write("original-http-settled.json", { observedAt: Date.now(), ...outcome })
      return outcome
    })
    void execution.catch(() => undefined)
    const askedDeadline = Math.min(Date.now() + 30000, closeBy)
    while (Date.now() < askedDeadline) {
      const pending = await api("/permission")
      if (pending.status !== 200) throw Error(`Public pending HTTP ${pending.status}`)
      const current = PermissionAuthority.Request.array().parse(pending.body)
      originalRequest = current.find(request => request.sessionID === session!.id)
      if (originalRequest) break
      await Bun.sleep(25)
    }
    if (!originalRequest) throw Error("Actual pending permission required")
    const request = originalRequest
    const asked = await captureFacts("original-public-asked.json")
    if (!asked) throw Error("Actual original Asked facts required")
    expect(structuredClone(request)).toMatchObject({ sessionID: session.id, projectID: session.projectID, toolName: "read" })
    expect(structuredClone(asked.message.info)).toMatchObject({ id: request.messageID, role: "assistant", parentID: input.messageID })
    expect(structuredClone(asked.message.parts.find(part => part.type === "tool" && part.callID === request.toolCallID)))
      .toMatchObject({ type: "tool", tool: "read", state: { status: "running", input: { filePath: source } } })
    // This is the real lifecycle cancellation, outside the HTTP serving lease.
    // It owns Tool interruption and Prompt completion; the test writes neither.
    facts.originalListenerStopRequestedAt = Date.now()
    await within(originalServer.stop(true), "Original public listener shutdown")
    facts.originalListenerClosed = true
    facts.originalListenerClosedAt = Date.now()
    facts.instanceClosed = true
    await within(execution, "Original public HTTP settlement")
    const interrupted = await captureFacts("after-original-shutdown.json")
    if (!interrupted) throw Error("Original public invocation facts required")
    expect(interrupted.ledger.map(row => row.event_type)).toEqual(["requested", "cancelled"])
    const cancelled = interrupted.ledger[1]!
    expect(cancelled).toMatchObject({ decision_slot: request.id, decision_scope: "invocation" })
    expect(interrupted.outbox.filter(row => row.event_type === "permission.terminated")).toMatchObject([{
      project_id: session.projectID, directory: project.path, properties: { requestID: request.id,
        sessionID: session.id, ledgerEventID: cancelled.id, status: "cancelled" },
    }])
    expect(structuredClone(interrupted.message.info)).toMatchObject({ id: request.messageID, role: "assistant",
      parentID: input.messageID, finish: "error", error: { name: "MessageAbortedError" }, time: { completed: expect.any(Number) } })
    const interruptedTool = interrupted.message.parts.find(part => part.type === "tool" && part.callID === request.toolCallID)
    expect(structuredClone(interruptedTool)).toMatchObject({ type: "tool", callID: request.toolCallID,
      tool: "read", state: { status: "error", input: { filePath: source }, failure: { message: expect.any(String) },
        time: { start: expect.any(Number), end: expect.any(Number) } } })
    server = Server.listen({ hostname: "127.0.0.1", port: 0, randomPort: true })
    facts.replyListenerCreated = true
    facts.replyListenerClosed = false
    facts.replyListenerURL = server.url.toString()
    facts.replyListenerCreatedAt = Date.now()
    facts.instanceClosed = false
    const history = await api("/permission/history")
    expect(history.status).toBe(200)
    expect(PermissionAuthority.LedgerEvent.array().parse(history.body)
      .filter(row => row.request_id === request.id).map(row => row.event_type)).toEqual(["cancelled", "requested"])
    const reply = await api(`/permission/${request.id}/reply`, {
      decision: "allow_once", message: "Approve this original public read once.",
    })
    expect(reply.status).toBe(200)
    expect(reply.body).toMatchObject({ request: { id: request.id }, decision: "deny", eventID: cancelled.id })
    const recovered = await captureFacts("after-restart-and-late-reply.json")
    expect(recovered?.ledger).toEqual(interrupted.ledger)
    expect(recovered?.message).toEqual(interrupted.message)
    expect(recovered?.outbox.filter(row => row.event_type === "permission.terminated"))
      .toEqual(interrupted.outbox.filter(row => row.event_type === "permission.terminated"))

  } catch (error) {
    primaryError = error
    throw error
  } finally {
    const cleanupErrors: unknown[] = []
    const clean = async (label: string, fn: () => unknown | Promise<unknown>, flag?: string) => {
      try { await within(Promise.resolve().then(fn), label, true); if (flag) facts[flag] = true }
      catch (error) { cleanupErrors.push(error) }
    }
    await clean("Preserve actual failure facts before cleanup", () => captureFacts("before-cleanup.json"))
    for (const request of provider.requests) request.release()
    clearInterval(release)
    await clean("Cancel exact owned Prompt", async () => {
      if (!session) return
      const cancellation = SessionPrompt.cancel(session.id, project.path, createExecutionCancellationOrigin({
        actor: "runtime", source: "process.shutdown", surface: "test.permission-retirement-reply",
        reason: "The owned public retirement contract is closing", targetSessionID: session.id,
        ...(originalRequest ? { messageID: originalRequest.messageID, toolCallID: originalRequest.toolCallID } : {}),
      }))
      if (cancellation) await cancellation.finished
    })
    if (originalServer && facts.originalListenerClosed !== true) await clean("Original listener shutdown", async () => {
      facts.originalListenerStopRequestedAt ??= Date.now()
      await originalServer!.stop(true)
      facts.originalListenerClosedAt = Date.now()
    }, "originalListenerClosed")
    if (server && server !== originalServer) await clean("Reply listener shutdown", async () => {
      facts.replyListenerStopRequestedAt = Date.now()
      await server!.stop(true)
      facts.replyListenerClosedAt = Date.now()
    }, "replyListenerClosed")
    if (facts.instanceCreated) await clean("Original Instance shutdown", () => Instance.disposeAll(), "instanceClosed")
    if (execution) await clean("Original read operation join", () => execution!, "originalExecutionJoined")
    facts.providerResponseCount = provider.requests.length
    if (provider.requests.length) {
      facts.providerResponsesJoined = false
      await clean("Owned Provider response join", async () => { await Promise.all(provider.requests.map(request => request.responded)) }, "providerResponsesJoined")
    }
    await clean("Owned Provider shutdown", () => provider.server.stop(true), "providerClosed")
    await clean("Owned source cleanup", () => fs.unlink(source), "sourceRemoved")
    await clean("Preserve actual isolated application log", () => captureLog("server-log-final.jsonl"))
    facts.endedAt = Date.now()
    facts.error = primaryError === undefined ? null : String(primaryError)
    facts.cleanupErrors = cleanupErrors.map(String)
    facts.providerRequests = provider.requests.map(request => ({ index: request.index, kind: request.kind,
      model: typeof request.body === "object" && request.body !== null && "model" in request.body ? request.body.model : undefined }))
    await write("http-receipts.json", requests)
    await write("scope-final.json", facts)
    if (cleanupErrors.length) throw new AggregateError(
      primaryError === undefined ? cleanupErrors : [primaryError, ...cleanupErrors], "Public retirement scope cleanup failed")
  }
}, 120000)
