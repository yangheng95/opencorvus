/** Real manual Mission draft/dispatch acceptance. Requires MISSION_DISPATCH_E2E_ALLOW_REAL_PROVIDER=1,
 * AUTH_SOURCE=<canonical paired auth.json>, MODEL=openai/gpt-6.1-sol (same prefix).
 * Optional RESULT; cumulative request budget 32, activity-based inactivity 180 seconds.
 * Copies only the selected canonical Provider entry and its complete model catalog; owns its isolated runtime.
 */
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { execFileSync } from "node:child_process"
import {
  bootstrapIsolatedTestRuntime,
  applyIsolatedTestUserEnvironment,
} from "@opencorvus-ai/util/test-runtime-environment"
import { prepareTestProcessSupervisor } from "./prepare-test-process-supervisor"
import { assertCopiedOAuthAccess, CredentialRedactor, RealProviderAudit } from "./real-provider-audit"

const prefix = "MISSION_DISPATCH_E2E_"
assert.equal(process.env[`${prefix}ALLOW_REAL_PROVIDER`], "1")
const authSource = process.env[`${prefix}AUTH_SOURCE`]!
const model = process.env[`${prefix}MODEL`]!
assert(authSource && model?.includes("/"), "Paired authority and exact Provider/model are required")
const resultTarget = process.env[`${prefix}RESULT`]
const [providerID, ...modelParts] = model.split("/")
const modelID = modelParts.join("/")
const supervisor = prepareTestProcessSupervisor()
applyIsolatedTestUserEnvironment(await bootstrapIsolatedTestRuntime("runner"))
if (supervisor) process.env.OPENCORVUS_PROCESS_SUPERVISOR = supervisor
const root = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-mission-dispatch-e2e-"))
const runtime = path.join(root, "runtime")
const project = path.join(root, "project")
const resultPath = resultTarget ? path.resolve(resultTarget) : path.join(root, "result.json")
for (const key of [
  "OPENCORVUS_API_KEY",
  "OPENCORVUS_CONFIG",
  "OPENCORVUS_CONFIG_DIR",
  "OPENCORVUS_EMBEDDED_DASHSCOPE_KEY",
  "OPENCORVUS_TEST_MANAGED_CONFIG_DIR",
])
  delete process.env[key]
Object.assign(process.env, {
  OPENCORVUS_HOME: runtime,
  OPENCORVUS_TEST_HOME: runtime,
  OPENCORVUS_TEST_PROCESS_ROOT: root,
  OPENCORVUS_CONFIG_CONTENT: JSON.stringify({ permission_mode: "full_access", model, small_model: model }),
  OPENCORVUS_TASK_PROCESS_MODE: "native",
})
const redactor = new CredentialRedactor()
redactor.collect(process.env)
const requestID = `DISPATCH-${crypto.randomUUID()}`
const operatorPrompt = `For acceptance ${requestID}, report the sum of 137 and 249 and the difference between 249 and 137. Return both numeric results in the conversation. This is the complete requested deliverable.`
let evidence: Record<string, unknown> = { model, root, requestID, operatorPrompt }
let audit: RealProviderAudit | undefined
let snapshotAtSend: (() => unknown) | undefined
let cleanup: (() => Promise<void>) | undefined
let failure: unknown
const sendObservations: Array<{ requestIndex: number; observedAt: number; facts: unknown }> = []
let observedCount = 0
try {
  await fs.mkdir(project, { recursive: true })
  await fs.writeFile(path.join(project, "README.md"), "# Manual Mission dispatch acceptance\n")
  for (const args of [
    ["init"],
    ["config", "user.name", "OpenCorvus Acceptance"],
    ["config", "user.email", "acceptance@opencorvus.invalid"],
    ["add", "README.md"],
    ["commit", "-m", "test: initialize dispatch project"],
  ])
    execFileSync("git", args, { cwd: project, stdio: "ignore" })
  const source = JSON.parse(await fs.readFile(authSource, "utf8"))
  const entry = source[providerID]
  assert(entry?.generation && entry.info, "Source must contain the canonical Provider generation/info entry")
  redactor.collect(entry)
  await fs.mkdir(path.join(runtime, "data"), { recursive: true })
  await fs.writeFile(path.join(runtime, "data", "auth.json"), JSON.stringify({ [providerID]: entry }))
  await fs.copyFile(path.join(path.dirname(authSource), "models.json"), path.join(runtime, "data", "models.json"))
  const { Auth } = await import("@/auth")
  const credential = await Auth.get(providerID)
  assert(credential, "Canonical isolated Provider credential is available")
  const authority = credential.type === "oauth" ? { copiedOAuthExpiresAt: credential.expires } : undefined
  if (authority) assertCopiedOAuthAccess(authority.copiedOAuthExpiresAt)
  using observed = new RealProviderAudit(
    modelID,
    32,
    () => {
      while (audit && observedCount < audit.requests.length) {
        const requestIndex = observedCount++
        if (snapshotAtSend) sendObservations.push({ requestIndex, observedAt: Date.now(), facts: snapshotAtSend() })
      }
    },
    authority,
  )
  audit = observed
  const [
    { Instance },
    { Database, eq },
    { Provider },
    { Session },
    { SessionStatus },
    { SessionTable, MessageTable },
    mission,
    closure,
    serverRuntime,
    recovery,
    { readMissionDurableActivity },
    { taskLifecycleProjection },
    { SessionPromptState },
    { SessionPromptOwner },
  ] = await Promise.all([
    import("@/project/instance"),
    import("@/storage/db"),
    import("@/provider/provider"),
    import("@/session"),
    import("@/session/status"),
    import("@/session/session.sql"),
    import("@/mission/session"),
    import("@/mission/execution-closure"),
    import("@/cli/server-runtime"),
    import("@/engine/host-recovery"),
    import("@/engine/durable-activity"),
    import("@/engine/task-lifecycle"),
    import("@/session/prompt/state"),
    import("@/session/prompt/owner"),
  ])
  cleanup = async () => {
    await Instance.disposeAll()
    Database.close()
  }
  const projected = await Instance.provide({ directory: project, fn: () => Provider.getModel(providerID, modelID) })
  assert.equal(projected.api.id, modelID)
  evidence.authority = {
    credential: "available",
    projectedModel: projected.api.id,
    copiedProviders: [providerID],
    pairedModels: true,
  }
  const { server } = await serverRuntime.requireRecoveredServerRuntime(
    await serverRuntime.listenWithRecoveredServerRuntime({
      options: { hostname: "127.0.0.1", port: 0, randomPort: true },
      recover: async () => {
        recovery.assertStartedTaskProjectRecoverySucceeded(await recovery.recoverStartedTaskExecutions())
      },
      disposeInstances: () => Instance.disposeAll(),
    }),
  )
  observed.localOrigins.add(server.url.origin)
  cleanup = async () => {
    await server.stop(true)
    await Instance.disposeAll()
    Database.close()
  }
  evidence.preflight = await observed.preflight({
    serverURL: server.url,
    model,
    inactivityMs: 180_000,
    activity: SessionStatus.getActivity,
  })
  const post = async (route: string, body: unknown) => {
    const url = new URL(route, server.url)
    url.searchParams.set("directory", project)
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
    return { status: response.status, body: (await response.json()) as any }
  }
  const draft = await post("/mission/draft", {
    title: "Atomic manual draft acceptance",
    request: operatorPrompt,
    productPillar: "work",
    expertSquadIDs: ["base"],
  })
  assert.equal(draft.status, 200)
  const { missionID, sessionID } = draft.body as { missionID: string; sessionID: string }
  evidence.draft = draft
  snapshotAtSend = () =>
    Database.use((db) => {
      const row = db.select().from(SessionTable).where(eq(SessionTable.id, sessionID)).get()!
      const inputs = db
        .select()
        .from(MessageTable)
        .where(eq(MessageTable.session_id, sessionID))
        .all()
        .filter(
          (row) =>
            row.data.role === "user" &&
            (row.data as { extra?: { wake_reason?: { requestID?: string } } }).extra?.wake_reason?.requestID ===
              requestID,
        )
      return {
        draftDisposition: mission.missionPendingPrompt(Session.fromRow(row)) ? "pending" : "consumed",
        acceptedMessageIDs: inputs.map((row) => row.id),
        closure: closure.currentMissionExecutionClosure(sessionID),
      }
    })
  const dispatch = await post(`/mission/${missionID}/dispatch`, { requestID, model })
  assert.equal(dispatch.status, 200)
  evidence.dispatch = dispatch
  process.stdout.write(`[dispatch-e2e] session=${sessionID} root=${root} result=${resultPath}\n`)
  const projectID = (await Session.get(sessionID)).projectID
  const pendingPrompt = { text: `Exact next draft after ${requestID}; retain this punctuation: A → B.` }
  let replayVerified = false
  let signature = "",
    lastActivity = Date.now()
  for (;;) {
    const messages = await Session.messages({ sessionID })
    const state = SessionStatus.get(sessionID)
    const durable = readMissionDurableActivity({ projectID, missionID, sessionID })
    const tasks = durable.tasks.map((task) => taskLifecycleProjection(task.task_id))
    const ownedPrompts = SessionPromptState.ownedPromptSessionIDs()
    const promptExecutions = ownedPrompts.map((id) => {
      const active = SessionPromptOwner.activeExecution(id)
      return { sessionID: id, disposition: active ? "active" : "settled", active }
    })
    const next = JSON.stringify({
      messages,
      state,
      durable,
      tasks,
      promptActivity: ownedPrompts.map((id) => ({ id, lastActivity: SessionStatus.getActivity(id)?.last_activity_at })),
    })
    if (next !== signature) {
      signature = next
      lastActivity = Date.now()
    }
    if (observed.exhausted) throw new Error("E2E_REQUEST_BUDGET_EXHAUSTED")
    if (state.type === "terminal" && state.reason === "error")
      throw new Error(`Mission dispatch execution error: ${state.error}`)
    evidence.latest = { tasks, ownedPrompts, promptExecutions, state }
    await fs.writeFile(
      path.join(root, "progress.json"),
      JSON.stringify(
        { tasks, ownedPrompts, promptExecutions, state, requests: observed.requests.length, observedAt: Date.now() },
        null,
        2,
      ),
    )
    for (const task of tasks) {
      if (["completed", "failed", "cancelled"].includes(task.status))
        assert.equal(task.status, "completed", "A naturally created child Task must complete before teardown")
    }
    const firstModelOutput = messages.find(
      (entry) =>
        entry.info.role === "assistant" &&
        entry.parts.some((part) => (part.type === "text" || part.type === "reasoning") && part.text.trim()),
    )
    if (!replayVerified && firstModelOutput) {
      assert(sendObservations.length > 0, "Actual Mission Provider sends must be observed")
      evidence.firstModelOutput = {
        messageID: firstModelOutput.info.id,
        observedAt: Date.now(),
        requestCount: observed.requests.length,
      }
      await Instance.provide({
        directory: project,
        fn: async () => mission.setMissionPendingPrompt({ session: await Session.get(sessionID), pendingPrompt }),
      })
      const replay = await post(`/mission/${missionID}/dispatch`, { requestID, model })
      assert.deepEqual(replay, dispatch)
      const retainedDraft = mission.missionPendingPrompt(await Session.get(sessionID))
      assert.deepEqual(retainedDraft, pendingPrompt)
      evidence = { ...evidence, replay, retainedDraft }
      replayVerified = true
    }
    const reply = messages.findLast(
      (entry) =>
        entry.info.role === "assistant" &&
        entry.info.time.completed &&
        entry.parts.some((part) => part.type === "text" && part.text.includes("386") && part.text.includes("112")),
    )
    if (
      reply &&
      replayVerified &&
      tasks.every((task) => task.status === "completed") &&
      promptExecutions.every((prompt) => prompt.disposition === "settled") &&
      (state.type === "idle" || state.type === "terminal")
    ) {
      evidence.reply = reply
      evidence.executionState = state
      evidence.messages = messages
      evidence.settlement = { tasks, promptExecutions, promptDisposition: "settled", observedAt: Date.now() }
      break
    }
    if (Date.now() - lastActivity > 180_000) throw new Error("MISSION_DISPATCH_INACTIVITY")
    await Bun.sleep(500)
  }
  assert(sendObservations.length > 0, "Actual Mission Provider sends must be observed")
  const first = sendObservations[0]!.facts as {
    draftDisposition: string
    acceptedMessageIDs: string[]
    closure: { state: string }
  }
  assert.equal(first.draftDisposition, "consumed")
  assert.equal(first.acceptedMessageIDs.length, 1)
  assert.equal(first.closure.state, "opened")
  const retainedDraft = mission.missionPendingPrompt(await Session.get(sessionID))
  assert.deepEqual(retainedDraft, pendingPrompt)
  evidence = {
    ...evidence,
    retainedDraft,
    closure: closure.currentMissionExecutionClosure(sessionID),
    sendObservations,
  }
} catch (error) {
  failure = error
} finally {
  const cleanupErrors: string[] = []
  try {
    await cleanup?.()
  } catch (error) {
    cleanupErrors.push(String(error))
  }
  for (const name of ["auth.json", "models.json"]) {
    try {
      await fs.rm(path.join(runtime, "data", name), { force: true })
    } catch (error) {
      cleanupErrors.push(String(error))
    }
  }
  const result = {
    ...evidence,
    status: failure || cleanupErrors.length ? "failed" : "passed",
    requests: audit?.requests ?? [],
    sendObservations,
    error: failure instanceof Error ? { name: failure.name, message: failure.message, stack: failure.stack } : failure,
    credentialCleanup: cleanupErrors.length ? "failed" : "passed",
    cleanupErrors,
  }
  await fs.mkdir(path.dirname(resultPath), { recursive: true })
  await fs.writeFile(resultPath, redactor.redact(JSON.stringify(result, null, 2)))
  process.stdout.write(`[dispatch-e2e] ${result.status} result=${resultPath}\n`)
  if (result.status !== "passed") process.exitCode = 1
}
