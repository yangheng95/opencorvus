import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { Instance } from "../../src/project/instance"
import { Database, asc, desc, eq } from "../../src/storage/db"
import { PermissionRequest } from "../../src/permission/types"
import { PermissionLedgerTable, PermissionExecutionResultTable } from "../../src/permission/permission.sql"
import { EngineControlActivationLeaseGrantTable } from "../../src/engine/engine.sql"
import { currentControlLeaseInTransaction } from "../../src/engine/control-lease"
import { observeProcessLiveness } from "../../src/engine/process-liveness"
import { currentRuntimeProcessOccurrence } from "../../src/runtime/process-occurrence"
import { declareNativeTaskProcessDeployment } from "../../src/runtime/task-process-deployment"
import { installProcessShims } from "../../src/runtime/shims"
import { installDefaultControlPlaneToolLoaders } from "../../src/tool/control-plane-tool-composition"
import { listenWithRecoveredServerRuntime } from "../../src/cli/server-runtime"
import { recoverStartedTaskExecutions, assertStartedTaskProjectRecoverySucceeded } from "../../src/engine/host-recovery"
import { Identifier } from "../../src/id/id"

const [mode, scenario, runtime, evidence, providerA, providerB, resourceA, resourceB, rawDeadline] = process.argv.slice(2)
assert(mode && ["start", "peer", "crash", "recover"].includes(mode))
assert(scenario && ["live-same-project", "live-two-projects", "dead-unexpired", "dead-expired"].includes(scenario))
assert(runtime && evidence && path.isAbsolute(runtime) && path.isAbsolute(evidence))
assert.equal(process.env.OPENCORVUS_HOME, runtime)
const startedAt = Date.now(), rawWrapperDeadline = process.env.OPENCORVUS_PERMISSION_OWNER_DEADLINE_AT
const wrapperDeadlineAt = rawWrapperDeadline === undefined ? undefined : Number(rawWrapperDeadline)
if (wrapperDeadlineAt !== undefined)
  assert(Number.isSafeInteger(wrapperDeadlineAt) && wrapperDeadlineAt > startedAt, "Supplied original wrapper deadline must be a future integer")
const deadlineAt = Number(rawDeadline)
assert(Number.isSafeInteger(deadlineAt) && deadlineAt > startedAt && deadlineAt <= startedAt + 180000)
if (wrapperDeadlineAt !== undefined)
  assert(deadlineAt <= wrapperDeadlineAt - 60000, "Child deadline must retain the original wrapper close reserve")
const closeBy = wrapperDeadlineAt === undefined ? deadlineAt - 15000 : Math.min(deadlineAt - 15000, wrapperDeadlineAt - 60000)
assert(Date.now() < closeBy, "Original child setup admission deadline")
const directoryA = path.join(runtime, "public-project-a")
const directoryB = scenario === "live-same-project" ? directoryA : path.join(runtime, "public-project-b")
const isPeer = mode === "peer", label = isPeer ? "b" : "a"
const directory = isPeer ? directoryB : directoryA
const http: unknown[] = []
let server: Awaited<ReturnType<typeof listenWithRecoveredServerRuntime>> | undefined
let deliberateCrash = false
let currentPrompt: Promise<Awaited<ReturnType<typeof api>>> | undefined

async function write(name: string, data: unknown) {
  const final = path.join(evidence, name), temporary = `${final}.${mode}.pending`
  await fs.writeFile(temporary, JSON.stringify(data, null, 2))
  await fs.rename(temporary, final)
}

async function exists(name: string) {
  try { await fs.stat(path.join(evidence, name)); return true }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return false; throw error }
}

async function until(check: () => Promise<boolean>, description: string) {
  const limit = Math.min(Date.now() + 30000, closeBy)
  while (!(await check())) {
    if (await exists("stop-requested")) throw Error("Original parent requested this scope's closure")
    if (Date.now() >= limit) throw Error(`Original request window elapsed: ${description}`)
    await Bun.sleep(100)
  }
}

async function api(route: string, method = "GET", body?: unknown, ownerDirectory = directory) {
  assert(Date.now() < closeBy, "Original HTTP admission deadline")
  const requestStartedAt = Date.now(), requestDeadlineAt = Math.min(requestStartedAt + 30000, closeBy)
  assert(requestDeadlineAt > requestStartedAt, "Original HTTP close reserve")
  try {
  const response = await fetch(new URL(route, server!.server.url), {
    method, headers: { "content-type": "application/json", "x-opencorvus-directory": ownerDirectory },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(Math.max(0, requestDeadlineAt - Date.now())),
  })
  const raw = await response.text()
  const receipt = { route, method, directory: ownerDirectory, status: response.status, requestStartedAt, requestDeadlineAt,
    body: raw.length ? JSON.parse(raw) : null, observedAt: Date.now() }
  http.push(receipt)
  return receipt
  } catch (error) {
    http.push({ route, method, directory: ownerDirectory, requestStartedAt, requestDeadlineAt, error: String(error), observedAt: Date.now() })
    throw error
  }
}

function localConfig() {
  const provider = (api: string, name: string) => ({ name, npm: "@ai-sdk/openai-compatible", api,
    options: { apiKey: "local-controlled-provider" }, models: { "session-prompt-owner-model": {
      name, tool_call: true, modalities: { input: ["text"], output: ["text"] }, limit: { context: 1000000, output: 4096 },
    } } })
  return { model: "permission-owner-a/session-prompt-owner-model", small_model: "permission-owner-a/session-prompt-owner-model",
    permission_mode: "ask", prompt_profile: { active: "base" }, enabled_providers: ["permission-owner-a", "permission-owner-b"],
    mcp: { browser: { enabled: false }, computer: { enabled: false } }, provider: {
      "permission-owner-a": provider(providerA!, "Public permission owner A"),
      "permission-owner-b": provider(providerB!, "Public permission owner B"),
    } }
}

async function facts(request: PermissionRequest, ownerDirectory: string) {
  const messages = await api(`/session/${request.sessionID}/message`, "GET", undefined, ownerDirectory)
  assert.equal(messages.status, 200)
  return Instance.provideProjectIdentity({ directory: ownerDirectory, fn: () => Database.use((db) => {
    assert.equal(Instance.project.id, request.projectID)
    const ledger = db.select().from(PermissionLedgerTable).where(eq(PermissionLedgerTable.request_id, request.id))
      .orderBy(asc(PermissionLedgerTable.time_created), asc(PermissionLedgerTable.id)).all()
    const start = ledger.find(row => row.event_type === "execution_started")
    assert(start?.attempt_id, "Actual started effect required")
    const lease = currentControlLeaseInTransaction(db, "effect", start.attempt_id)
    assert(lease, "Actual exact effect lease required")
    const grant = db.select().from(EngineControlActivationLeaseGrantTable)
      .where(eq(EngineControlActivationLeaseGrantTable.lease_id, lease.id))
      .orderBy(desc(EngineControlActivationLeaseGrantTable.ordinal)).get()
    assert(grant)
    const processReceipt = currentControlLeaseInTransaction(db, "runtime_process", lease.owner_occurrence_id)
    assert(processReceipt, "Actual physical owner receipt required")
    const tool = messages.body.flatMap((message: any) => message.parts).find((part: any) =>
      part.type === "tool" && part.messageID === request.messageID && part.callID === request.toolCallID)
    assert(tool && tool.tool === "webfetch")
    const result = db.select().from(PermissionExecutionResultTable)
      .where(eq(PermissionExecutionResultTable.attempt_id, start.attempt_id)).get()
    return { request, ledger, start, lease, grant, processReceipt,
      runtimeIdentity: JSON.parse(processReceipt.owner_occurrence_id),
      osObservation: observeProcessLiveness(lease.owner_occurrence_id), tool, result, messages }
  }) })
}

try {
  assert(Date.now() < closeBy, "Original runtime setup admission deadline")
  installProcessShims(); installDefaultControlPlaneToolLoaders(); declareNativeTaskProcessDeployment()
  await fs.mkdir(directory, { recursive: true })
  assert(Date.now() < closeBy, "Original listener setup admission deadline")
  await write(`${mode}-runtime-owner.json`, { mode, scenario, startedAt, deadlineAt,
    wrapperDeadlineAt: wrapperDeadlineAt ?? null, outerDeadlineObserved: wrapperDeadlineAt !== undefined, closeBy, directory,
    process: currentRuntimeProcessOccurrence() })
  server = await listenWithRecoveredServerRuntime({
    options: { hostname: "127.0.0.1", port: 0, randomPort: true },
    recover: async () => assertStartedTaskProjectRecoverySucceeded(await recoverStartedTaskExecutions({ scopeProjectWorktree: directory })),
    disposeInstances: () => Instance.disposeAll(),
  })
  await server.recovery
  assert(Date.now() < closeBy, "Original recovery setup admission deadline")
  await write(`${mode}-listener.json`, { url: server.server.url.toString(), deadlineAt, occurrence: server.occurrence })
  if (mode === "recover") {
    const original = JSON.parse(await fs.readFile(path.join(evidence, "a-ready.json"), "utf8"))
    const history = await api("/permission/history") // Normal public Project bootstrap performs recovery.
    assert.equal(history.status, 200)
    const snapshot = await facts(PermissionRequest.parse(original.request), directoryA)
    await write("recovered.json", { history, snapshot, observedAt: Date.now() })
  } else {
    if (!isPeer) {
      const configured = await api("/global/config", "PATCH", localConfig())
      await write("config.json", configured)
      assert.equal(configured.status, 200)
    }
    const created = await api("/session", "POST", { kind: "assistant", title: `Permission owner ${label} public CSV` })
    assert.equal(created.status, 200)
    const session = created.body
    const messageID = Identifier.ascending("message"), url = isPeer ? resourceB! : resourceA!
    const input = { messageID, agent: "chat", model: { providerID: `permission-owner-${label}`, modelID: "session-prompt-owner-model" },
      parts: [{ type: "text", text: `Fetch this public CSV and describe its rows: ${url}` }] }
    const promptStartedAt = Date.now()
    currentPrompt = api(`/session/${session.id}/message`, "POST", input)
    void currentPrompt.catch(() => undefined)
    await write(`${label}-input.json`, { session, input, promptStartedAt })
    let request: PermissionRequest | undefined
    await until(async () => {
      const pending = await api("/permission")
      assert.equal(pending.status, 200)
      const matches = PermissionRequest.array().parse(pending.body).filter(item =>
        item.projectID === session.projectID && item.sessionID === session.id && item.toolName === "webfetch")
      assert(matches.length <= 1, "One exact natural webfetch invocation")
      request = matches[0]
      return Boolean(request)
    }, "actual webfetch authorization")
    const before = await api(`/session/${session.id}/message`)
    const originalTool = before.body.flatMap((entry: any) => entry.parts).find((part: any) =>
      part.type === "tool" && part.messageID === request!.messageID && part.callID === request!.toolCallID)
    assert(originalTool && originalTool.tool === "webfetch" && originalTool.state.status === "running")
    assert.equal(originalTool.state.input.url, url)
    const approved = await api(`/permission/${request!.id}/reply`, "POST", {
      decision: "allow_once", message: `Retrieve only the public owned CSV for permission owner ${label}.`,
    })
    assert.equal(approved.status, 200)
    assert.equal(approved.body.request.id, request!.id)
    await until(() => exists(`${label}-resource-arrived.json`), "real HTTP resource request")
    const snapshot = await facts(request!, directory)
    assert.equal(snapshot.osObservation, "exact_live")
    assert.equal(snapshot.runtimeIdentity.occurrenceID, currentRuntimeProcessOccurrence().occurrenceID)
    let peerHistory: unknown
    if (isPeer) peerHistory = await api("/permission/history", "GET", undefined, directoryA)
    await write(`${label}-ready.json`, { request, approved, snapshot, peerHistory, recordedAt: Date.now() })
    if (mode === "crash") {
      deliberateCrash = true
      await write(`${mode}-http.json`, http)
      process.exit(23)
    }
    let completed: any
    await until(async () => {
      const messages = await api(`/session/${session.id}/message`)
      const candidates = messages.body.filter((entry: any) => entry.info.role === "assistant" &&
        entry.info.parentID === messageID && entry.info.finish === "stop" && entry.info.time.completed)
      assert(candidates.length <= 1, "One natural exact-input final reply")
      completed = candidates[0]
      return Boolean(completed)
    }, "actual original-input final reply")
    const promptResponse = await currentPrompt
    assert.equal(promptResponse.status, 200)
    assert.equal(promptResponse.body.info.id, completed.info.id)
    await write(`${label}-completed.json`, { completed, promptResponse, snapshot: await facts(request!, directory),
      history: await api("/permission/history"), endedAt: Date.now() })
    await until(() => exists("close-live"), "parent closes both completed live owners")
  }
} catch (error) {
  await write(`${mode}-failure.json`, { message: String(error), stack: error instanceof Error ? error.stack : undefined })
  console.error(error); process.exitCode = 1
} finally {
  if (!deliberateCrash) {
    await server?.server.stop(true)
    await server?.recovery
    await currentPrompt?.catch(() => undefined)
    await Instance.disposeAll()
    await Database.awaitEffectIdle(5000)
    Database.close()
    await write(`${mode}-http.json`, http)
    await write(`${mode}-closed.json`, { process: currentRuntimeProcessOccurrence(), endedAt: Date.now(),
      deadlineAt, serverStopped: true, databaseClosed: true })
  }
}
