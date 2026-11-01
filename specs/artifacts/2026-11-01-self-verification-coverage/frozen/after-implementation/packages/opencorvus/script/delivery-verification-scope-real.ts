/** Real Session/Task execution. See the November outcome-quality-repair Recall. */
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import {
  bootstrapIsolatedTestRuntime,
  applyIsolatedTestUserEnvironment,
} from "@opencorvus-ai/util/test-runtime-environment"
import { prepareTestProcessSupervisor } from "./prepare-test-process-supervisor"
import { assertCopiedOAuthAccess, CredentialRedactor, RealProviderAudit } from "./real-provider-audit"
import { VERIFICATION_DISCIPLINE } from "../src/prompt/fragments/verification-discipline"
import { CompleteTaskInputSchema } from "../src/orchestrator/task-lifecycle-input"
import APPLY_PATCH_DESCRIPTION from "../src/tool/apply_patch.txt"

const prefix = "DELIVERY_SCOPE_"
assert.equal(process.env[`${prefix}ALLOW_REAL_PROVIDER`], "1", "Explicit Provider authority is required")
function required(name: string) {
  const value = process.env[`${prefix}${name}`]?.trim()
  assert(value, `${prefix}${name} is required`)
  return value
}
const authSource = path.resolve(required("AUTH_SOURCE"))
const model = required("MODEL")
const phase = required("PHASE")
const cases: Array<{
  kind: "bundle" | "download" | "temperature" | "query-export" | "utc-ledger"
  entry: "coding" | "task"
}> = JSON.parse(required("CASES"))
assert(cases.length > 0)
assert(new Set(cases.map((row) => row.kind)).size === cases.length)
for (const row of cases) {
  assert(["bundle", "download", "temperature", "query-export", "utc-ledger"].includes(row.kind))
  assert(["coding", "task"].includes(row.entry))
}
const output = path.resolve(required("OUTPUT"))
const python = path.resolve(required("PYTHON"))
const maxRequests = Number(required("MAX_REQUESTS"))
assert(Number.isSafeInteger(maxRequests) && maxRequests > 0)
const workflowChecker = path.resolve(import.meta.dir, "../../../script/benchmark/delivery_workflow_cases.py")
const domainChecker = path.resolve(import.meta.dir, "../../../script/benchmark/delivery_domain_cases.py")
const selfcheckChecker = path.resolve(import.meta.dir, "../../../script/benchmark/delivery_selfcheck_cases.py")
const supervisor = prepareTestProcessSupervisor()
const isolated = await bootstrapIsolatedTestRuntime("runner")
applyIsolatedTestUserEnvironment(isolated)
if (supervisor) process.env.OPENCORVUS_PROCESS_SUPERVISOR = supervisor
const root = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-delivery-scope-"))
const runtimeRoot = path.join(root, "runtime")
await fs.mkdir(output, { recursive: false })
const sourceFiles = ["auth.json", "models.json"]
const sourceBytes = new Map<string, Buffer>()
const redactor = new CredentialRedactor()
redactor.collect(process.env)
for (const key of [
  "OPENCORVUS_API_KEY",
  "OPENCORVUS_CONFIG",
  "OPENCORVUS_CONFIG_DIR",
  "OPENCORVUS_EMBEDDED_DASHSCOPE_KEY",
  "OPENCORVUS_TEST_MANAGED_CONFIG_DIR",
])
  delete process.env[key]
process.env.OPENCORVUS_HOME = runtimeRoot
process.env.OPENCORVUS_TEST_HOME = runtimeRoot
process.env.OPENCORVUS_TEST_PROCESS_ROOT = root
process.env.OPENCORVUS_CONFIG_CONTENT = JSON.stringify({ permission_mode: "full_access", model, small_model: model })
process.env.OPENCORVUS_TASK_PROCESS_MODE = "native"
const inactivityMs = 180_000
const report: Record<string, any> = { phase, model, maxRequests, inactivityMs, root, startedAt: Date.now(), cases: [] }
let cleanup: (() => Promise<void>) | undefined
let failure: unknown
let audit: RealProviderAudit | undefined
const write = (name: string, value: unknown) => fs.writeFile(path.join(output, name), redactor.serialize(value, 2))
using lifetime = new DisposableStack()
try {
  await fs.mkdir(path.join(runtimeRoot, "data"), { recursive: true })
  for (const name of sourceFiles) {
    const bytes = await fs.readFile(path.join(path.dirname(authSource), name))
    sourceBytes.set(name, bytes)
    if (name === "auth.json") redactor.collect(JSON.parse(bytes.toString("utf8")))
    await fs.writeFile(path.join(runtimeRoot, "data", name), bytes)
  }
  const { Auth } = await import("@/auth")
  const [providerID, ...modelParts] = model.split("/")
  const modelID = modelParts.join("/")
  assert(providerID && modelID)
  const credential = await Auth.get(providerID)
  assert(credential, "Isolated Provider credential is configured")
  const authority = credential.type === "oauth" ? { copiedOAuthExpiresAt: credential.expires } : undefined
  if (authority) assertCopiedOAuthAccess(authority.copiedOAuthExpiresAt)
  audit = lifetime.use(
    new RealProviderAudit(modelID, maxRequests, undefined, authority, {
      redactor,
      probes: [
        { id: "shared-verification-policy", text: VERIFICATION_DISCIPLINE },
        { id: "completion-summary-schema", text: CompleteTaskInputSchema.shape.summary.description! },
        { id: "patch-operation-contract", text: APPLY_PATCH_DESCRIPTION },
      ],
    }),
  )
  const [
    { Instance },
    { Database, eq },
    { Provider },
    { SessionStatus },
    { Session },
    { EngineTaskTable },
    { readTaskDurableActivityScope },
    { projectTaskRowInTransaction },
    { projectToolPartInTransaction },
    { taskLifecycleProjection },
    { listOwnedPromptSessionsForTask },
    { listenWithRecoveredServerRuntime, requireRecoveredServerRuntime },
    { recoverStartedTaskExecutions, assertStartedTaskProjectRecoverySucceeded },
    { Identifier },
  ] = await Promise.all([
    import("@/project/instance"),
    import("@/storage/db"),
    import("@/provider/provider"),
    import("@/session/status"),
    import("@/session"),
    import("@/engine/engine.sql"),
    import("@/engine/durable-activity"),
    import("@/engine/store"),
    import("@/session/tool-part-facts"),
    import("@/engine/task-lifecycle"),
    import("@/engine/runtime"),
    import("@/cli/server-runtime"),
    import("@/engine/host-recovery"),
    import("@/id/id"),
  ])
  cleanup = async () => {
    await Instance.disposeAll()
    Database.close()
  }
  const prepared = await requireRecoveredServerRuntime(
    await listenWithRecoveredServerRuntime({
      options: { hostname: "127.0.0.1", port: 0, randomPort: true },
      recover: async () => {
        assertStartedTaskProjectRecoverySucceeded(await recoverStartedTaskExecutions())
      },
      disposeInstances: () => Instance.disposeAll(),
    }),
  )
  const server = prepared.server
  audit.localOrigins.add(server.url.origin)
  cleanup = async () => {
    await server.stop(true)
    await Instance.disposeAll()
    Database.close()
  }
  const request = async (route: string, directory: string, body?: unknown) => {
    const url = new URL(route, server.url)
    url.searchParams.set("directory", directory)
    url.searchParams.set("init-git", "false")
    const response = await fetch(url, {
      method: body === undefined ? "GET" : "POST",
      headers: { "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    assert(
      response.ok,
      `${route}: HTTP ${response.status}: ${redactor.redact(await response.clone().text()).slice(0, 1000)}`,
    )
    return (await response.json()) as any
  }
  // Catalog resolution and credential usability are distinct checks before either task.
  const preflightProject = path.join(root, "preflight")
  await fs.mkdir(preflightProject)
  await Instance.provide({
    directory: preflightProject,
    fn: async () => {
      assert.equal((await Provider.getModel(providerID, modelID)).api.id, modelID)
    },
  })
  report.preflight = await audit.preflight({
    serverURL: server.url,
    model,
    inactivityMs,
    activity: SessionStatus.getActivity,
  })
  for (const { kind, entry } of cases) {
    const consumer =
      kind === "bundle"
        ? workflowChecker
        : kind === "query-export" || kind === "utc-ledger"
          ? selfcheckChecker
          : domainChecker
    const project = path.join(root, kind)
    const setup = JSON.parse(
      execFileSync(python, [consumer, "setup", kind, project], { encoding: "utf8", windowsHide: true }),
    )
    for (const args of [
      ["init"],
      ["config", "user.name", "OpenCorvus Acceptance"],
      ["config", "user.email", "acceptance@opencorvus.invalid"],
      ["add", "."],
      ["commit", "-m", "test: initialize delivery prototype"],
    ])
      execFileSync("git", args, { cwd: project, stdio: "ignore", windowsHide: true })
    const prompt = `Repair the supplied project according to CONTRACT.md. Deliver the complete deliverable.pyz, maintainable source and concise handoff. Work directly in this project without delegation.\n\n${setup.contract}`
    const row: Record<string, any> = {
      kind,
      entry,
      project,
      prompt,
      startedAt: Date.now(),
      requestsBefore: audit.requests.length,
    }
    report.cases.push(row)
    let sessionID: string | undefined
    let taskID: string | undefined
    let responseDone = false
    let responseError: unknown
    let responsePromise: Promise<void> | undefined
    if (entry === "coding") {
      const session = await request("/session", project, { kind: "assistant", title: `${phase} ${kind}` })
      sessionID = session.id
      row.sessionID = sessionID
      responsePromise = request(`/session/${sessionID}/message`, project, {
        messageID: Identifier.ascending("message"),
        agent: "coding",
        model: { providerID, modelID },
        parts: [{ type: "text", text: prompt }],
      }).then(
        (value) => {
          row.finalResponse = value
          responseDone = true
        },
        (error) => {
          responseError = error
          responseDone = true
        },
      )
    } else {
      const created = await request("/task", project, {
        productPillar: "code",
        promptProfile: "base",
        title: `${phase} ${kind}`,
        request: prompt,
        requestID: randomUUID(),
        model,
      })
      taskID = created.task_id
      row.taskID = taskID
    }
    let lastActivity = Date.now()
    let signature = ""
    let settled = false
    while (Date.now() - lastActivity < inactivityMs) {
      assert(!audit.exhausted, "E2E_REQUEST_BUDGET_EXHAUSTED")
      if (responseError) throw responseError
      let snapshot: any
      if (sessionID) {
        snapshot = {
          messages: await Instance.provide({
            directory: project,
            fn: () => Session.messages({ sessionID: sessionID! }),
          }),
          activity: SessionStatus.getActivity(sessionID),
        }
        settled = responseDone
      } else {
        snapshot = Database.use((db) => {
          const task = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, taskID!)).get()
          assert(task)
          const scope = readTaskDurableActivityScope(db, projectTaskRowInTransaction(db, task))
          return {
            ...scope,
            tools: scope.toolRequests.map((tool) => projectToolPartInTransaction(db, tool)),
            activity: scope.sessions.map((session) => SessionStatus.getActivity(session.id)),
            lifecycle: taskLifecycleProjection(taskID!),
          }
        })
        settled =
          ["completed", "failed", "cancelled"].includes(snapshot.lifecycle.status) &&
          listOwnedPromptSessionsForTask(taskID!).length === 0
      }
      const next = JSON.stringify({ snapshot, requests: audit.requests })
      if (next !== signature) {
        signature = next
        lastActivity = Date.now()
      }
      await write(`${kind}-trace.json`, snapshot)
      await write("progress.json", {
        phase,
        kind,
        sessionID,
        taskID,
        requests: audit.requests.length,
        lastActivity,
        settled,
      })
      if (settled) {
        row.lifecycle = snapshot.lifecycle
        break
      }
      await Bun.sleep(1000)
    }
    assert(settled, `${kind}: DELIVERY_SCOPE_INACTIVITY`)
    await responsePromise
    row.settledAt = Date.now()
    row.requestsAfter = audit.requests.length
    // Preserve the complete naturally delivered project, including Git, before consumption.
    const delivered = path.join(output, `${kind}-delivered`)
    await fs.cp(project, delivered, { recursive: true })
    const gradeDirectory = path.join(output, `${kind}-consumer`)
    try {
      row.grade = JSON.parse(
        execFileSync(python, [consumer, "grade", kind, delivered, "--output", gradeDirectory], {
          encoding: "utf8",
          windowsHide: true,
        }),
      )
    } catch (error) {
      // A business mismatch is a recorded trial result, not a checker infrastructure error.
      const gradeFile = path.join(gradeDirectory, "grade.json")
      row.grade = JSON.parse(await fs.readFile(gradeFile, "utf8"))
    }
    process.stdout.write(
      `[delivery-scope] ${phase}/${kind} passed=${row.grade.passed} requests=${audit.requests.length}\n`,
    )
    await write("result.json", { ...report, requests: audit.requests, status: "running" })
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
  // Closed SQLite bytes preserve canonical task/tool facts alongside projected traces.
  try {
    const candidates = await fs.readdir(path.join(runtimeRoot, "data"), { recursive: true })
    for (const name of candidates.filter((name) => /\.(db|sqlite|sqlite3)$/.test(name))) {
      const target = path.join(output, "storage", name)
      await fs.mkdir(path.dirname(target), { recursive: true })
      await fs.copyFile(path.join(runtimeRoot, "data", name), target)
    }
  } catch (error) {
    cleanupErrors.push(String(error))
  }
  for (const name of sourceFiles) {
    try {
      await fs.rm(path.join(runtimeRoot, "data", name), { force: true })
      assert(
        (await fs.readFile(path.join(path.dirname(authSource), name))).equals(sourceBytes.get(name)!),
        `Source ${name} changed during acceptance`,
      )
    } catch (error) {
      cleanupErrors.push(String(error))
    }
  }
  report.requests = audit?.requests ?? []
  report.endedAt = Date.now()
  report.status = failure || cleanupErrors.length ? "execution_failed" : "completed"
  report.consumerScope =
    "Per-case registered inputs and independently derived outputs; completion is not universal contract certification"
  report.registeredCasesAgree =
    report.cases.length === cases.length && report.cases.every((row: any) => row.grade?.passed)
  report.error =
    failure instanceof Error
      ? { name: failure.name, message: failure.message }
      : failure === undefined
        ? undefined
        : String(failure)
  report.cleanup = {
    errors: cleanupErrors,
    pairedCopiesRetired: cleanupErrors.length === 0,
    sourceBytesPreserved: cleanupErrors.length === 0,
  }
  await write("result.json", report)
}
process.stdout.write(`[delivery-scope] status=${report.status} result=${path.join(output, "result.json")}\n`)
process.exitCode = report.status === "completed" ? 0 : 1
