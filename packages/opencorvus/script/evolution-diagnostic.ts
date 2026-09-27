/** G58's fixed diagnostic transport. Preparation never submits model work. */
import assert from "node:assert/strict"
import { parseArgs } from "node:util"
import fs from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { createHash } from "node:crypto"
import { CredentialRedactor, requireProcessProviderAudit } from "./real-provider-audit"
import nativeProviderAudit from "./native-provider-audit-plugin"
import { latestAuditSnapshotFiles } from "./audit-snapshot"
import { prepareTestProcessSupervisor } from "./prepare-test-process-supervisor"
import { missionAbortRequest, observeActivityDeadline, settleEvolutionRuntimeBeforeCredentials, taskRoute } from "./expert-squad-evolution-e2e-support"
import { claimDiagnosticInitialization } from "./evolution-diagnostic-initialization"

const { values } = parseArgs({ args: process.argv.slice(2), strict: true, options: {
  prepare: { type: "boolean" }, run: { type: "boolean" },
  "run-root": { type: "string" }, "auth-source": { type: "string" },
  "resume-initialization": { type: "string" },
} })
assert(values.prepare !== values.run, "Choose exactly one of --prepare or --run")
const repo = path.resolve(import.meta.dir, "../../..")
const registeredRoot = path.join(repo, ".tmp/evolution-readiness-g58/diagnostic-01")
const root = values.run ? registeredRoot : path.resolve(values["run-root"] ?? "")
assert(values.run || values["run-root"], "Preparation requires its own --run-root")
assert(values.run || root !== registeredRoot, "The registered root is reserved for --run")
assert(!values.run || values["run-root"] === undefined, "Real execution uses the single registered root")
assert(!values.prepare || values["auth-source"] === undefined, "Preparation does not accept credentials")
const model = "openai/gpt-5.6-luna"
const modelID = "gpt-5.6-luna"
const inactivityMs = 300_000
const pollIntervalMs = 2_000
const targetDigest = "27141f11209e4891fc2119b3f84a239238c08d8951cd5fefab6143e30f31e0ed"
const inputRoot = path.join(repo, "specs/artifacts/2026-09-27-evolution-readiness/input")
const home = path.join(root, "home")
const coordinator = path.join(root, "coordinator")
const execution = path.join(root, "execution")
const auditRoot = path.join(root, "provider-audit")
const redactor = new CredentialRedactor()
async function git(cwd: string, args: string[]) {
  const child = Bun.spawn(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" })
  const [exit, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  assert.equal(exit, 0, `Git failed: ${stderr}`)
  return stdout.trim()
}
const sourceCommit = await git(repo, ["rev-parse", "HEAD"])
if (values.run) {
  assert(values["auth-source"], "Run requires an explicitly authorized auth.json source")
  assert.equal(await git(repo, ["status", "--porcelain"]), "", "Real diagnostic requires committed, clean source")
}
await fs.mkdir(path.dirname(root), { recursive: true })
const resumed = values["resume-initialization"] === undefined ? undefined : await claimDiagnosticInitialization({
  root, parent: values["resume-initialization"], mode: values.run ? "run" : "prepare", model,
})
if (!resumed) {
  try { await fs.mkdir(root) } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error(`DiagnosticRunAlreadyExists: ${root}`)
    throw error
  }
}
const receiptRoot = resumed?.directory ?? root
async function json(name: string, value: unknown) {
  await fs.writeFile(path.join(receiptRoot, name), redactor.redact(JSON.stringify(value, null, 2)) + "\n")
}
async function event(type: string, detail: unknown) {
  await fs.appendFile(path.join(receiptRoot, "controller.jsonl"), redactor.redact(JSON.stringify({ time: new Date().toISOString(), type, detail })) + "\n")
}
const result: Record<string, any> = {
  schema: "opencorvus/g58-diagnostic@1", mode: values.run ? "run" : "prepare",
  sourceCommit, pid: process.pid, startedAt: new Date().toISOString(), model,
  inactivityMs, pollIntervalMs, requestCeiling: null, businessVerdict: "not_evaluated",
  receiptDirectory: resumed?.receiptDirectory ?? ".", ...(resumed ? { parentReceiptDirectory: resumed.parent } : {}),
}
await json("claim.json", result)
let server: { url: URL; stop(force?: boolean): Promise<void> } | undefined
let disposeRuntime: (() => Promise<void>) | undefined
let exportUsage: (() => Promise<void>) | undefined
let request: ((route: string, body?: unknown) => Promise<any>) | undefined
let missionID: string | undefined
let failed = false
let credentialCopiesStarted = false
try {
  for (const directory of [path.join(home, "data"), path.join(home, "config"), coordinator, execution, path.join(root, "managed")]) {
    await fs.mkdir(directory, { recursive: true })
  }
  if (!resumed) {
    for (const directory of [coordinator, execution]) {
      await git(directory, ["init", "--quiet"])
      await git(directory, ["config", "user.name", "G58 diagnostic"])
      await git(directory, ["config", "user.email", "g58@example.invalid"])
    }
    await fs.writeFile(path.join(coordinator, "README.md"), "# G58 diagnostic coordinator\nNo business input or expected answer is stored here.\n")
  }
  const inputFiles: Array<{ path: string; bytes: number; sha256: string }> = []
  for (const name of ["request.md", "metrics.json"]) {
    const bytes = await fs.readFile(path.join(inputRoot, name))
    if (resumed) assert.deepEqual(await fs.readFile(path.join(execution, name)), bytes, `Original diagnostic input changed: ${name}`)
    else await fs.writeFile(path.join(execution, name), bytes, { flag: "wx" })
    inputFiles.push({ path: name, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") })
  }
  result.inputFiles = inputFiles
  for (const key of ["OPENCORVUS_CONFIG", "OPENCORVUS_CONFIG_DIR", "OPENCORVUS_CONFIG_CONTENT", "OPENCORVUS_API_KEY", "OPENAI_API_KEY", "OPENAI_BASE_URL", "OPENCORVUS_SERVER_PASSWORD", "OPENCORVUS_SERVER_USERNAME", "OPENCORVUS_EMBEDDED_DASHSCOPE_KEY"]) delete process.env[key]
  process.env.OPENCORVUS_HOME = home
  process.env.OPENCORVUS_TEST_HOME = home
  process.env.OPENCORVUS_TEST_PROCESS_ROOT = root
  process.env.OPENCORVUS_TEST_MANAGED_CONFIG_DIR = path.join(root, "managed")
  process.env.OPENCORVUS_PROJECT_DIR = coordinator
  process.env.OPENCORVUS_TASK_PROCESS_MODE = "native"
  const supervisor = prepareTestProcessSupervisor()
  if (supervisor) process.env.OPENCORVUS_PROCESS_SUPERVISOR = supervisor
  result.processSupervisor = supervisor ?? "platform-native"
  process.env.OPENCORVUS_NATIVE_REAL_PROVIDER = "1"
  process.env.OPENCORVUS_NATIVE_AUDIT_ROOT = auditRoot
  process.env.OPENCORVUS_NATIVE_AUDIT_MODEL = modelID
  process.env.OPENCORVUS_NATIVE_AUDIT_MAX_REQUESTS = "null"
  delete process.env.OPENCORVUS_NATIVE_AUDIT_COPIED_OAUTH_EXPIRES
  const config = { permission_mode: "full_access", ...(values.run ? { model, small_model: model } : {}), enabled_providers: values.run ? ["openai"] : [],
    plugin: values.run ? [pathToFileURL(path.join(import.meta.dir, "native-provider-audit-plugin.ts")).href] : [],
  }
  await fs.writeFile(path.join(home, "config/opencorvus.jsonc"), JSON.stringify(config))
  if (values.run) {
    const source = path.resolve(values["auth-source"]!)
    credentialCopiesStarted = true
    const { stageDiagnosticProvider } = await import("./evolution-diagnostic-provider")
    const access = await stageDiagnosticProvider({ authSource: source, dataDirectory: path.join(home, "data"), modelID, redactor })
    process.env.OPENCORVUS_NATIVE_AUDIT_COPIED_OAUTH_EXPIRES = String(access.copiedOAuthExpiresAt)
    result.providerAuthority = { kind: "isolated-paired-copy", expiresAt: access.copiedOAuthExpiresAt, refresh: "forbidden" }
    // Establish the copied-access guard before any credential-aware runtime imports.
    await nativeProviderAudit({ serverUrl: new URL("http://127.0.0.1:0") })
  }
  const [{ Instance }, { Database }, { ensureGitProjectMetadata }, { executionCapsuleSourceTreeSnapshot },
    { workspaceTreeDigest }, { ExpertSquadPackageManager }, { Provider }, { SessionStatus }, { ProcessSupervisor },
    { ProviderUsageEventTable }, { Server }, { InstanceBootstrap }, { observeMissionSettlement }] = await Promise.all([
    import("../src/project/instance"), import("../src/storage/db"), import("../src/engine/git-project-metadata"),
    import("../src/execution-capsule/tree-digest"), import("@opencorvus-ai/plugin"), import("../src/expert-squad/manager"),
    import("../src/provider/provider"), import("../src/session/status"), import("../src/shell/process-supervisor"),
    import("../src/usage/usage.sql"), import("../src/server/server"), import("../src/project/bootstrap"), import("./mission-settlement"),
  ])
  exportUsage = async () => {
    const rows = Database.use((db) => db.select().from(ProviderUsageEventTable).all())
    const priced = rows.length > 0 && rows.every((row) => row.billing_status === "priced")
    await json("usage.json", { authority: "original provider_usage_event", rows, totalRecordedTokens: rows.reduce((n, row) => n + row.total_tokens, 0),
      recordedCostUSD: priced ? rows.reduce((n, row) => n + row.cost_usd, 0) : null, coverage: "recorded usage, not an invoice" })
  }
  disposeRuntime = async () => {
    await server?.stop(true)
    await Instance.disposeAll()
    await ProcessSupervisor.disposeLiveProcessesUnder(root)
    await exportUsage!()
    Database.close()
  }
  if (!resumed) {
    for (const directory of [coordinator, execution]) {
      await ensureGitProjectMetadata(directory)
      await git(directory, ["add", "."])
      await git(directory, ["commit", "--quiet", "-m", "Freeze G58 diagnostic input"])
    }
  }
  const initialTree = await executionCapsuleSourceTreeSnapshot(execution)
  if (resumed) assert.deepEqual(initialTree, resumed.initialTree, "Original complete diagnostic tree changed")
  result.initialTree = workspaceTreeDigest(initialTree)
  await json("initial-tree.json", initialTree)
  await Instance.provide({ directory: coordinator, init: InstanceBootstrap, fn: async () => {
    const installed = await ExpertSquadPackageManager.installPayloadPackage({ projectDirectory: coordinator, id: "data-analysis", installationScope: "project" })
    assert.equal(installed.after.packageDigest, targetDigest, "Installed target differs from the registered G58 package")
    result.target = installed.after
    result.projectID = Instance.project.id
  } })
  server = Server.listen({ hostname: "127.0.0.1", port: 0, randomPort: true })
  result.server = { url: server.url.toString(), coordinator, execution }
  const fetchJSON = async (route: string, body?: unknown) => {
    const url = new URL(route, server!.url)
    url.searchParams.set("directory", coordinator)
    const response = await fetch(url, { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30_000) })
    const text = await response.text()
    if (!response.ok) throw new Error(`Diagnostic HTTP ${response.status} ${route}: ${redactor.redact(text).slice(0, 4000)}`)
    return JSON.parse(text)
  }
  request = fetchJSON
  const missionRequest = [
    "Execute the single registered G58 local diagnostic. Create exactly one data-analysis Task and no candidate or evolution Task.",
    `Use productPillar=work, promptProfile=data-analysis, expectedPackageDigest=${targetDigest}, model=${model}.`,
    `Set that Task's directory exactly to ${execution}. Its only input files are request.md and metrics.json in that directory.`,
    "Read request.md completely and use its exact text as the Task request. Preserve its public metric definitions and scope.",
    "Let the existing operating-insight-report workflow execute naturally. Do not inject expected numerical results or change the input.",
    "Read the Task's actual terminal decision and delivered report; preserve any failure. Do not create a replacement Task, author a candidate, or run a comparison.",
    "No external business actions or real accounts. The budget has no declared monetary ceiling. Record unknowns and all actual usage.",
    "", "Verbatim target Task request:", await fs.readFile(path.join(execution, "request.md"), "utf8"),
  ].join("\n")
  await fs.writeFile(path.join(receiptRoot, "mission-request.md"), missionRequest + "\n")
  result.missionRequestPath = path.join(receiptRoot, "mission-request.md")
  result.outcome = "prepared"
  result.providerProjection = "not_checked"
  await json("prepared.json", result)
  if (values.run) {
    await nativeProviderAudit({ serverUrl: server.url })
    const { audit } = requireProcessProviderAudit()
    await Instance.provide({ directory: coordinator, fn: async () => {
      const projected = await Provider.getModel("openai", modelID)
      assert.equal(projected.api.id, modelID, "Actual Provider projection must preserve the registered model")
      result.providerProjection = "projected"
    } })
    await fs.writeFile(path.join(root, "launch.json"), redactor.redact(JSON.stringify({
      ...result, phase: "before-streaming-preflight", launchedAt: new Date().toISOString(),
    }, null, 2)) + "\n", { flag: "wx" })
    result.preflight = await audit.preflight({ serverURL: server.url, model, inactivityMs, pollIntervalMs, activity: SessionStatus.getActivity })
    await json("preflight.json", result.preflight)
    const wake = await fetchJSON("/mission/wake", { text: missionRequest, model, productPillar: "work", expertSquadIDs: ["data-analysis"] })
    missionID = wake.missionID
    assert(missionID && wake.sessionID, "Mission wake must return its persisted identities")
    result.mission = wake
    await json("mission.json", wake)
    let deadline: ReturnType<typeof observeActivityDeadline> | undefined
    for (;;) {
      const status = await fetchJSON(`/mission/${missionID}/status`)
      const cursor = await fetchJSON(`/mission/${missionID}/activity-cursor`)
      const streams = Object.entries(SessionStatus.listActivity()).map(([id, value]) => [id, value?.last_activity_at])
      deadline = observeActivityDeadline({ previous: deadline, activitySHA256: createHash("sha256").update(JSON.stringify([cursor.activity_sha256, streams])).digest("hex"), observedAtMs: Date.now(), inactivityWindowMs: inactivityMs })
      result.lastStatus = status
      await json("status.json", { status, cursor, deadline, streamActivity: streams })
      const snapshots = await Promise.all((await latestAuditSnapshotFiles(auditRoot, "provider")).map(async (file) => JSON.parse(await fs.readFile(file, "utf8"))))
      if (snapshots.some((snapshot) => snapshot.requests.some((entry: { status?: number }) => (entry.status ?? 0) >= 400))) throw new Error("Diagnostic Provider request returned an error; preserve this single run")
      assert(status.tasks.length <= 1, "Diagnostic Task count exceeds the single registered occurrence")
      for (const task of status.tasks) {
        if (["failed", "cancelled"].includes(task.lifecycleStatus)) throw new Error(`Diagnostic Task ended ${task.lifecycleStatus}`)
        const interactions = await fetchJSON(taskRoute(task.taskID, "interactions"))
        if (interactions.some((item: { status: string }) => item.status === "pending")) throw new Error("Diagnostic requested external interaction")
      }
      const settlement = await observeMissionSettlement({ directory: coordinator, missionID, sessionID: wake.sessionID })
      await json("mission-settlement.json", settlement)
      if (settlement.status === "blocked" || settlement.status === "failed") {
        throw new Error(`Diagnostic Mission settlement ${settlement.status}: ${JSON.stringify(settlement)}`)
      }
      if (settlement.status === "accepted" && status.tasks.length === 1 && status.tasks[0].lifecycleStatus === "completed") {
        const taskID = status.tasks[0].taskID
        await json("task.json", await fetchJSON(taskRoute(taskID)))
        await json("task-transcript.json", await fetchJSON(taskRoute(taskID, "transcript")))
        await json("task-turn-artifacts.json", await fetchJSON(taskRoute(taskID, "turn-artifacts")))
        result.outcome = "execution_settled"
        result.businessVerdict = "requires_independent_report_review"
        break
      }
      if (Date.now() >= deadline.deadlineMs) throw new Error("Diagnostic produced no real durable/stream activity for 300 seconds")
      if (await fs.stat(path.join(root, "stop")).catch(() => null)) throw new Error("Diagnostic stopped by its operator marker")
      await Bun.sleep(pollIntervalMs)
    }
  }
} catch (error) {
  failed = true
  result.outcome = "failed"
  result.error = redactor.redact(error instanceof Error ? `${error.name}: ${error.message}` : String(error))
  await event("failed", result.error)
  if (missionID && request) {
    try { result.abort = await request(`/mission/${missionID}/abort`, missionAbortRequest("The single diagnostic ended; preserve all original evidence")) }
    catch (abortError) { result.abortError = redactor.redact(String(abortError)) }
  }
} finally {
  try {
    result.cleanup = await settleEvolutionRuntimeBeforeCredentials({ disposeRuntime,
      removeCredentials: credentialCopiesStarted ? async () => {
        for (const name of ["auth.json", "models.json"]) await fs.rm(path.join(home, "data", name), { force: true })
      } : undefined,
    })
  } catch (error) {
    failed = true
    result.executionOutcome = result.outcome
    result.outcome = "cleanup_failed"
    result.cleanupError = redactor.redact(String(error))
  }
  result.finishedAt = new Date().toISOString()
  await json("result.json", result)
  console.log(JSON.stringify({ outcome: result.outcome, root, receiptRoot, cleanup: result.cleanup, error: result.error, cleanupError: result.cleanupError }))
  process.exitCode = failed ? 1 : 0
}
