import assert from "node:assert/strict"
import { RuntimeE2EScenarioSchema, scenarioFixturePath } from "./runtime-e2e-scenario"
import fs from "node:fs/promises"
import path from "node:path"
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { bootstrapIsolatedTestRuntime, applyIsolatedTestUserEnvironment } from "@opencorvus-ai/util/test-runtime-environment"
import { RealProviderAudit } from "./real-provider-audit"
import { prepareTestProcessSupervisor } from "./prepare-test-process-supervisor"

// This checker executes real streaming Provider calls and production HTTP routes.
// It deliberately retains failed runtime evidence, but removes copied credentials.
if (process.env.RUNTIME_DISPATCH_E2E_ALLOW_REAL_PROVIDER !== "1") {
  throw new Error("RUNTIME_DISPATCH_E2E_ALLOW_REAL_PROVIDER=1 requires explicit operator authorization")
}
const source = path.resolve(process.env.RUNTIME_DISPATCH_E2E_AUTH_SOURCE || "")
assert(process.env.RUNTIME_DISPATCH_E2E_AUTH_SOURCE, "An explicit auth source is required")
const scenarioText = process.env.RUNTIME_DISPATCH_E2E_SCENARIO
  ? await fs.readFile(path.resolve(process.env.RUNTIME_DISPATCH_E2E_SCENARIO), "utf8") : undefined
const scenario = RuntimeE2EScenarioSchema.parse(scenarioText ? JSON.parse(scenarioText) : {
  caseID: "advanced-web-intake", title: "Advanced local bookshop delivery acceptance", promptProfile: "advanced",
  request: "帮我创建一个图书销售电商网页，使用虚构图书和价格，仅在当前项目生成本地演示，不进行真实交易、注册账号或对外发布。完成实现后请验证页面和交互并交付可打开的结果。",
})
const model = "openai/gpt-5.6-luna"
const modelID = "gpt-5.6-luna"
const inactivityMs = 180_000
const maxRequests = Number(process.env.RUNTIME_DISPATCH_E2E_MAX_REQUESTS ?? "256")
assert(Number.isSafeInteger(maxRequests) && maxRequests > 0, "Request budget must be a positive integer")
const supervisor = prepareTestProcessSupervisor()
const isolated = await bootstrapIsolatedTestRuntime("runner")
applyIsolatedTestUserEnvironment(isolated)
const root = await fs.mkdtemp(path.join(isolated.processRoot, "dispatch-e2e-"))
const home = path.join(root, "runtime")
const project = path.join(root, "project")
const resultPath = path.join(root, "result.json")
const secrets: string[] = []
const result: Record<string, unknown> = {
  schema: "opencorvus/runtime-dispatch-e2e@1",
  caseID: scenario.caseID,
  scenario,
  scenarioSHA256: createHash("sha256").update(JSON.stringify(scenario)).digest("hex"),
  evidenceClass: "real-provider-http-end-to-end",
  model,
  inactivityMs,
  maxRequests,
  startedAt: new Date().toISOString(),
  evidenceRoot: root,
  runtime: { executable: process.execPath, bun: Bun.version, platform: process.platform, architecture: process.arch },
  acceptance: { dispatch: "pending", workerSettlement: "pending", delivery: "pending", artifacts: "pending", visual: "pending", nativePackage: "not_run" },
  status: "running",
}
let server: { url: URL; stop(force?: boolean): Promise<void> } | undefined
let disposeInstances: (() => Promise<void>) | undefined
let closeDatabase: (() => void) | undefined
let disposeProcesses: ((directory: string) => Promise<void>) | undefined
let lastActivity = Date.now()
const audit = new RealProviderAudit(modelID, maxRequests)
const requests = audit.requests
const nativeFetch = audit.nativeFetch
const errorText = (error: unknown) => {
  let text = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  for (const value of secrets) text = text.replaceAll(value, "[REDACTED]")
  return text.slice(0, 4000)
}

try {
  const repositoryRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim()
  result.sourceSHA = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" }).trim()
  const sourceDiff = execFileSync("git", ["diff", "HEAD", "--", "packages/opencorvus/src"], { cwd: repositoryRoot })
  result.sourceDiffSHA256 = createHash("sha256").update(sourceDiff).digest("hex")
  await fs.writeFile(path.join(root, "source.patch"), sourceDiff)
  result.checkerSHA256 = createHash("sha256").update(await fs.readFile(import.meta.filename)).digest("hex")
  result.scenarioParserSHA256 = createHash("sha256").update(await fs.readFile(path.join(import.meta.dir, "runtime-e2e-scenario.ts"))).digest("hex")
  result.auditSHA256 = createHash("sha256").update(await fs.readFile(path.join(import.meta.dir, "real-provider-audit.ts"))).digest("hex")
  await fs.mkdir(path.join(home, "data"), { recursive: true })
  await fs.mkdir(project, { recursive: true })
  const auth = JSON.parse(await fs.readFile(source, "utf8"))
  assert(auth.openai, "The authorized Provider credential is unavailable")
  const collectSecrets = (value: unknown): void => {
    if (!value || typeof value !== "object") return
    for (const [key, item] of Object.entries(value)) {
      if (/key|token|access|refresh|secret/i.test(key) && typeof item === "string" && item.length >= 8) secrets.push(item)
      else if (item && typeof item === "object") collectSecrets(item)
    }
  }
  collectSecrets(auth)
  await fs.copyFile(source, path.join(home, "data", "auth.json"))
  await fs.copyFile(path.join(path.dirname(source), "models.json"), path.join(home, "data", "models.json"))
  await fs.writeFile(path.join(project, "README.md"), "# Isolated bookshop demonstration\nOnly local fictional demo data; no publication, accounts or purchases.\n")
  await fs.writeFile(path.join(project, "AGENTS.md"), "# Acceptance constraints\nUse fictional local demo data. Do not publish, create accounts, or perform purchases. Do not create or run UI automation tests, browser fixtures, DOM/component assertions, screenshot baselines, or pixel diffs. Validate UI through real page interactions and rendered inspection. Backend contract tests, builds, and type checks are allowed.\n")
  const fixtureFiles: Array<{ path: string; sha256: string }> = []
  for (const [relative, content] of Object.entries(scenario.files)) {
    const target = scenarioFixturePath(project, relative)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, content)
    fixtureFiles.push({ path: relative, sha256: createHash("sha256").update(content).digest("hex") })
  }
  result.fixtureFiles = fixtureFiles
  for (const key of ["OPENCORVUS_CONFIG", "OPENCORVUS_CONFIG_DIR", "OPENCORVUS_TEST_MANAGED_CONFIG_DIR", "OPENCORVUS_API_KEY"]) delete process.env[key]
  process.env.OPENCORVUS_HOME = home
  process.env.OPENCORVUS_TEST_HOME = home
  process.env.OPENCORVUS_TEST_PROCESS_ROOT = root
  process.env.OPENCORVUS_TASK_PROCESS_MODE = "native"
  process.env.OPENCORVUS_CONFIG_CONTENT = JSON.stringify({ model, small_model: model, permission_mode: "full_access" })
  if (supervisor) process.env.OPENCORVUS_PROCESS_SUPERVISOR = supervisor

  const [{ Instance }, { Database, sql }, { Provider }, { Log }, startup, recovery, { SessionStatus }, { ProcessSupervisor }, { MessageStore }] = await Promise.all([
    import("@/project/instance"), import("@/storage/db"), import("@/provider/provider"), import("@/util/log"),
    import("@/cli/server-runtime"), import("@/engine/host-recovery"), import("@/session/status"), import("@/shell/process-supervisor"), import("@/session/message-store"),
  ])
  disposeInstances = () => Instance.disposeAll()
  closeDatabase = () => Database.close()
  disposeProcesses = async (directory) => { await ProcessSupervisor.disposeLiveProcessesUnder(directory) }
  await Log.init({ print: false })
  await Instance.provide({ directory: project, fn: async () => {
    const selected = await Provider.getModel("openai", modelID)
    assert.equal(selected.id, modelID)
    assert.equal(selected.api.id, modelID)
  } })
  const prepared = await startup.requireRecoveredServerRuntime(await startup.listenWithRecoveredServerRuntime({
    options: { hostname: "127.0.0.1", port: 0, randomPort: true },
    recover: async () => { recovery.assertStartedTaskProjectRecoverySucceeded(await recovery.recoverStartedTaskExecutions()) },
    disposeInstances,
  }))
  server = prepared.server
  audit.localOrigins.add(server.url.origin)
  result.serverURL = server.url.toString()
  console.log(`[dispatch-e2e] isolated server=${server.url} result=${resultPath}`)
  const request = async (route: string, body?: unknown, directory = project) => {
    const url = new URL(route, server!.url)
    url.searchParams.set("directory", directory)
    const response = await nativeFetch(url, {
      method: body === undefined ? "GET" : "POST",
      headers: { "content-type": "application/json", "x-opencorvus-directory": directory, "x-opencorvus-request-id": crypto.randomUUID() },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15_000),
    })
    assert(response.ok, `${route} HTTP ${response.status}: ${(await response.clone().text()).slice(0, 1000)}`)
    return await response.json() as any
  }
  result.phase = "provider_preflight"
  result.preflight = await audit.preflight({ serverURL: server.url, model, inactivityMs, activity: SessionStatus.getActivity })
  result.phase = "task_execution"
  const created = await request("/task?init-git=true", {
    title: scenario.title, request: scenario.request,
    source: "runtime-dispatch-e2e", productPillar: "code", promptProfile: scenario.promptProfile, model,
  })
  const taskID = created.task_id
  assert.equal(typeof taskID, "string")
  result.taskID = taskID
  let signature = ""
  lastActivity = Date.now()
  while (true) {
    const board = await request(`/task/${taskID}/board`)
    const debug = await request(`/task/${taskID}/debug/task-root-ingresses`)
    assert.equal(debug.status, "available", "Ingress evidence must be available")
    const snapshot = Database.use((db) => ({
      sessions: db.all(sql`SELECT id,kind,time_updated FROM session WHERE project_id=(SELECT project_id FROM engine_task WHERE id=${taskID})`) as any[],
      lineages: db.all(sql`SELECT id,payload FROM engine_artifact WHERE task_id=${taskID} AND kind='dispatch_lineage'`) as any[],
      outcomes: db.all(sql`SELECT r.id,r.message_id,r.data AS request,o.data AS outcome,p.result FROM tool_part_request r JOIN message m ON m.id=r.message_id JOIN session s ON s.id=m.session_id LEFT JOIN tool_part_outcome o ON o.request_part_id=r.id LEFT JOIN permission_execution_result p ON p.attempt_id=json_extract(o.data,'$.resultAttemptID') WHERE s.project_id=(SELECT project_id FROM engine_task WHERE id=${taskID})`) as any[],
    }))
    const messages = await Promise.all([...new Set(snapshot.outcomes.map((row) => row.message_id))].map(async (messageID) => {
      const owner = Database.use((db) => db.get(sql`SELECT session_id FROM message WHERE id=${messageID}`)) as { session_id: string }
      return MessageStore.get({ sessionID: owner.session_id, messageID })
    }))
    const failed = messages.flatMap((message) => message.parts.flatMap((part) => {
      if (part.type !== "tool" || part.state.status !== "completed" || !["dispatch_agent", "dispatch_agents"].includes(part.tool)) return []
      const value = JSON.parse(part.state.output)
      if (part.tool === "dispatch_agent") return value.kind === "infrastructure_failure" ? [{ toolPartID: part.id, ...value }] : []
      return value.members.flatMap((member: any) => member.status === "failed"
        ? [{ toolPartID: part.id, memberIndex: member.member_index, failure: member.failure }]
        : member.outcome.kind === "infrastructure_failure" ? [{ toolPartID: part.id, memberIndex: member.member_index, ...member.outcome }] : [])
    }))
    const children = snapshot.lineages.map((row) => {
      const payload = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload
      return { lineageID: row.id, dispatchID: payload.dispatch_id, agent: payload.target_agent_id, sessionID: payload.child_session_id, sessionExists: snapshot.sessions.some((session) => session.id === payload.child_session_id) }
    })
    const activity = snapshot.sessions.map((session) => ({ id: session.id, monitor: SessionStatus.getActivity(session.id), status: SessionStatus.get(session.id) }))
    const next = JSON.stringify({ status: board.task.status, sessions: snapshot.sessions, outcomes: snapshot.outcomes.map((row) => [row.id, row.outcome]), children, activity })
    if (next !== signature) { signature = next; lastActivity = Date.now() }
    result.observation = { taskStatus: board.task.status, ingress: debug.entries, children, failures: failed, activity }
    result.requests = requests
    await fs.writeFile(resultPath, JSON.stringify(result, null, 2) + "\n")
    if (failed.length) throw new Error(`DISPATCH_INFRASTRUCTURE_FAILURE: ${JSON.stringify(failed)}`)
    if (audit.exhausted) throw new Error("E2E_REQUEST_BUDGET_EXHAUSTED")
    if (board.task.status === "completed") {
      assert(children.length > 0 && children.every((child) => child.sessionExists), "Completed delivery requires real worker Sessions")
      const facts = Database.use((db) => ({
        descriptors: db.all(sql`SELECT id,session_id,payload FROM worker_turn_descriptor WHERE task_id=${taskID}`) as any[],
        artifacts: db.all(sql`SELECT id,kind,payload FROM engine_artifact WHERE task_id=${taskID}`) as any[],
      }))
      const parsed = (row: any) => typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload
      const settled: Array<{ dispatchID: string; descriptorID: string; settlementID: string; finalMessageID: string; kind: string }> = []
      for (const child of children) {
        const descriptor = facts.descriptors.find((row) => row.session_id === child.sessionID && parsed(row).dispatchTurn?.current_dispatch_id === child.dispatchID)
        assert(descriptor, `Dispatch ${child.dispatchID} requires its exact persisted worker descriptor`)
        const settlement = facts.artifacts.find((row) => row.kind === "dispatch_settlement" && parsed(row).dispatch_id === child.dispatchID)
        assert(settlement, `Dispatch ${child.dispatchID} requires a final settlement`)
        const outcome = parsed(settlement).outcome
        assert.equal(outcome.session_id, child.sessionID, "Settlement must name the exact child")
        if (outcome.kind === "coordination") {
          const coordination = facts.artifacts.find((row) => row.id === outcome.coordination_request.request_id && row.kind === "agent_coordination_request")
          assert(coordination, `Dispatch ${child.dispatchID} requires its durable coordination request`)
          result.acceptance = { dispatch: "passed", workerSettlement: "pending_coordination_review", delivery: "pending", artifacts: "pending", visual: "pending", nativePackage: "not_run" }
          result.status = "task_completed_acceptance_pending"
          continue
        }
        if (outcome.kind === "infrastructure_failure") throw new Error(`DISPATCH_INFRASTRUCTURE_FAILURE: ${JSON.stringify(outcome)}`)
        assert(outcome.final_message_id, `Dispatch ${child.dispatchID} requires a real final worker message`)
        const final = await MessageStore.get({ sessionID: child.sessionID, messageID: outcome.final_message_id })
        assert(final.info.role === "assistant" && final.info.time.completed && final.parts.length > 0, "Worker final output must be durable and inspectable")
        settled.push({ dispatchID: child.dispatchID, descriptorID: descriptor.id, settlementID: settlement.id, finalMessageID: final.info.id, kind: outcome.kind })
      }
      const adapters = [...new Set(facts.descriptors.map((row) => parsed(row).identity.dispatchAdapterID))]
      result.adapterEvidence = adapters
      for (const expected of scenario.requiredAdapters) assert(adapters.includes(expected), `Required adapter ${expected} must have a real persisted worker descriptor`)
      result.workerEvidence = settled
      result.artifactInventory = facts.artifacts.map((row) => ({ id: row.id, kind: row.kind }))
      result.acceptance = { dispatch: "passed", workerSettlement: settled.length === children.length ? "passed" : "pending_coordination_review", delivery: "pending", artifacts: "pending", visual: "pending", nativePackage: "not_run" }
      // Task terminality is one checkpoint. Delivery/workflow/artifact and human
      // rendered inspection remain explicit obligations, never an inferred pass.
      result.status = "task_completed_acceptance_pending"
      break
    }
    if (["failed", "cancelled"].includes(board.task.status)) throw new Error(`TASK_TERMINAL_${board.task.status}`)
    if (Date.now() - lastActivity > inactivityMs) throw new Error("E2E_MEANINGFUL_INACTIVITY")
    await Bun.sleep(500)
  }
} catch (error) {
  result.status = audit.exhausted ? "budget_exhausted" : "failed"
  result.error = errorText(error)
  process.exitCode = 1
} finally {
  const cleanup: string[] = []
  for (const run of [() => disposeProcesses?.(project), () => server?.stop(true), () => disposeInstances?.(), () => closeDatabase?.()]) {
    try { await run() } catch (error) { cleanup.push(errorText(error)) }
  }
  audit[Symbol.dispose]()
  for (const name of ["auth.json", "models.json"]) {
    try { await fs.rm(path.join(home, "data", name), { force: true }) } catch (error) { cleanup.push(errorText(error)) }
  }
  result.finishedAt = new Date().toISOString()
  result.requests = requests
  result.cleanup = cleanup.length ? { status: "failed", errors: cleanup } : { status: "passed" }
  if (cleanup.length) process.exitCode = 1
  await fs.writeFile(resultPath, JSON.stringify(result, null, 2) + "\n")
  console.log(`[dispatch-e2e] ${result.status} requests=${requests.length} result=${resultPath}`)
  if (result.error) console.log(errorText(result.error))
}
