/** Real public scheduler project-retarget qualification.
 * AUTOMATION_PROJECT_TARGET_REAL_ALLOW_REAL_PROVIDER=1, AUTH_SOURCE=<canonical paired auth.json>,
 * MODEL=openai/gpt-6.1-sol are required with the same prefix. RESULT is optional.
 * Uses at most 32 streaming requests and a 180-second activity-based inactivity window.
 */
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
import type { AutomationView, AutomationRunView } from "@/scheduler/automation-service"

const prefix = "AUTOMATION_PROJECT_TARGET_REAL_"
assert.equal(process.env[`${prefix}ALLOW_REAL_PROVIDER`], "1", "Explicit real Provider authorization is required")
const authSource = process.env[`${prefix}AUTH_SOURCE`]
const model = process.env[`${prefix}MODEL`]
assert(authSource, "Canonical authorization source paired with models.json is required")
assert.equal(model, "openai/gpt-6.1-sol")
const resultTarget = process.env[`${prefix}RESULT`]
const maxRequests = 32
const inactivityMs = 180_000
const supervisor = prepareTestProcessSupervisor()
applyIsolatedTestUserEnvironment(await bootstrapIsolatedTestRuntime("runner"))
if (supervisor) process.env.OPENCORVUS_PROCESS_SUPERVISOR = supervisor
const root = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-automation-target-real-"))
const runtime = path.join(root, "runtime")
const directories = [path.join(root, "project-A"), path.join(root, "project-B")]
const markers = [`TARGET-A-${randomUUID()}`, `TARGET-B-${randomUUID()}`]
const resultPath = resultTarget ? path.resolve(resultTarget) : path.join(root, "result.json")
for (const key of [
  "OPENCORVUS_API_KEY",
  "OPENCORVUS_CONFIG",
  "OPENCORVUS_CONFIG_DIR",
  "OPENCORVUS_DISABLE_PROJECT_CONFIG",
  "OPENCORVUS_EMBEDDED_DASHSCOPE_KEY",
  "OPENCORVUS_MODELS_PATH",
  "OPENCORVUS_MODELS_URL",
  "OPENCORVUS_SERVER_PASSWORD",
  "OPENCORVUS_SERVER_USERNAME",
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
let audit: RealProviderAudit | undefined
let cleanup: (() => Promise<void>) | undefined
let failure: unknown
const cases: Array<Record<string, unknown>> = []
const evidence: Record<string, unknown> = { root, model, maxRequests, inactivityMs, directories, markers, cases }
using auditLifetime = new DisposableStack()
try {
  for (const [index, directory] of directories.entries()) {
    await fs.mkdir(directory, { recursive: true })
    await fs.writeFile(path.join(directory, "README.md"), `# Automation target ${index === 0 ? "A" : "B"}\n`)
    await fs.writeFile(path.join(directory, "target.txt"), `${markers[index]}\n`)
    for (const args of [
      ["init"],
      ["config", "user.name", "OpenCorvus Acceptance"],
      ["config", "user.email", "acceptance@opencorvus.invalid"],
      ["add", "README.md", "target.txt"],
      ["commit", "-m", "test: initialize scheduler target"],
    ]) {
      execFileSync("git", args, { cwd: directory, stdio: "ignore" })
    }
  }
  const source = JSON.parse(await fs.readFile(authSource, "utf8"))
  const entry = source.openai
  assert(entry?.generation && entry.info, "Canonical OpenAI generation/info entry is required")
  redactor.collect(entry)
  await fs.mkdir(path.join(runtime, "data"), { recursive: true })
  await fs.writeFile(path.join(runtime, "data/auth.json"), JSON.stringify({ openai: entry }))
  await fs.copyFile(path.join(path.dirname(authSource), "models.json"), path.join(runtime, "data/models.json"))
  const { Auth } = await import("@/auth")
  const credential = await Auth.get("openai")
  assert(credential, "Canonical isolated OpenAI authorization is available")
  const authority = credential.type === "oauth" ? { copiedOAuthExpiresAt: credential.expires } : undefined
  if (authority) assertCopiedOAuthAccess(authority.copiedOAuthExpiresAt)
  const observed = auditLifetime.use(new RealProviderAudit("gpt-6.1-sol", maxRequests, undefined, authority))
  audit = observed
  const [
    { Instance },
    { Database, eq, asc },
    { Provider },
    { Session },
    { SessionStatus },
    { SessionPromptState },
    { SessionPromptOwner },
    tables,
    serverRuntime,
    recovery,
  ] = await Promise.all([
    import("@/project/instance"),
    import("@/storage/db"),
    import("@/provider/provider"),
    import("@/session"),
    import("@/session/status"),
    import("@/session/prompt/state"),
    import("@/session/prompt/owner"),
    import("@/scheduler/automation.sql"),
    import("@/cli/server-runtime"),
    import("@/engine/host-recovery"),
  ])
  cleanup = async () => {
    await Instance.disposeAll()
    Database.close()
  }
  const projected = await Instance.provide({
    directory: directories[0]!,
    fn: () => Provider.getModel("openai", "gpt-6.1-sol"),
  })
  assert.equal(projected.api.id, "gpt-6.1-sol")
  evidence.authority = {
    credential: "available",
    projectedModel: projected.api.id,
    copiedProviders: ["openai"],
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
    model: model!,
    inactivityMs,
    activity: SessionStatus.getActivity,
  })
  const request = async <T>(route: string, body?: unknown, method = "GET", directory = directories[0]!) => {
    const url = new URL(route, server.url)
    url.searchParams.set("directory", directory)
    const response = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    const decoded = await response.json()
    assert(response.ok, `${method} ${route}: HTTP ${response.status} ${JSON.stringify(decoded)}`)
    return decoded as T
  }
  const projects = await Promise.all(
    directories.map((directory) =>
      request<{ id: string; worktree: string }>("/project/current", undefined, "GET", directory),
    ),
  )
  assert.equal(new Set(projects.map((project) => project.id)).size, 2)
  evidence.projects = projects
  const future = new Date(Date.now() + 365 * 86_400_000)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
  const recurrence = `DTSTART:${future}\nRRULE:FREQ=DAILY`
  for (const label of ["A-to-B", "ordered-A-B-to-B"]) {
    if (label === "ordered-A-B-to-B" && maxRequests - observed.requests.length < 12) {
      evidence.orderedCase = {
        status: "skipped",
        reason: "Insufficient remaining cumulative request budget",
        remaining: maxRequests - observed.requests.length,
      }
      break
    }
    const current: Record<string, unknown> = { label }
    cases.push(current)
    const initialProjects = label === "A-to-B" ? [projects[0]!.id] : projects.map((project) => project.id)
    const prompt =
      "Read target.txt in your current working directory. Report its exact marker verbatim and the absolute directory you read it from. This is a read-only check; that report is the complete requested result."
    current.prompt = prompt
    const created = await request<{ id: string; revisionId: string }>(
      "/global/automations",
      {
        name: `Real target ${label}`,
        target: { scope: "project", projectIds: initialProjects },
        recurrence,
        executionMode: "local",
        model: { providerID: "openai", modelID: "gpt-6.1-sol" },
        prompt,
      },
      "POST",
    )
    current.automationID = created.id
    // The public creation schema starts active; a far-future rule is immediately paused before retargeting.
    const paused = await request<AutomationView>(`/global/automations/${created.id}`, { expectedRevisionId: created.revisionId, status: "paused" }, "PATCH")
    assert.equal(paused.status, "paused")
    assert.deepEqual(paused.target, { scope: "project", projectIds: initialProjects })
    const edited = await request<AutomationView>(
      `/global/automations/${created.id}`,
      { expectedRevisionId: paused.revisionId, target: { scope: "project", projectIds: [projects[1]!.id] } },
      "PATCH",
    )
    assert.equal(edited.status, "paused")
    assert.deepEqual(edited.target, { scope: "project", projectIds: [projects[1]!.id] })
    const definitions = Database.use((db) =>
      db
        .select()
        .from(tables.AutomationTable)
        .where(eq(tables.AutomationTable.definition_id, created.id))
        .orderBy(asc(tables.AutomationTable.revision))
        .all()
        .map((row) => ({
          ...row,
          projectTargets: db
            .select()
            .from(tables.AutomationProjectTargetTable)
            .where(eq(tables.AutomationProjectTargetTable.automation_revision_id, row.id))
            .orderBy(asc(tables.AutomationProjectTargetTable.position))
            .all(),
        })),
    )
    assert.deepEqual(
      definitions.map((row) => ({
        revision: row.revision,
        targets: row.projectTargets.map((target) => target.project_id),
      })),
      [
        { revision: 1, targets: initialProjects },
        { revision: 2, targets: initialProjects },
        { revision: 3, targets: [projects[1]!.id] },
      ],
    )
    current.definitions = definitions
    current.paused = paused
    current.edited = edited
    const revision = definitions.at(-1)!
    let runResponse: AutomationRunView[] | undefined
    let runError: unknown
    const running = request<AutomationRunView[]>(`/global/automations/${created.id}/run`, {}, "POST").then(
      (value) => {
        runResponse = value
      },
      (error) => {
        runError = error
      },
    )
    let lastActivity = Date.now(),
      signature = ""
    process.stdout.write(`[automation-target] case=${label} id=${created.id} root=${root}\n`)
    for (;;) {
      if (runError) throw runError
      if (observed.exhausted) throw new Error("E2E_REQUEST_BUDGET_EXHAUSTED")
      const runs = await request<AutomationRunView[]>(`/global/automations/${created.id}/runs`)
      const transcripts = await Promise.all(
        runs
          .flatMap((run) => (run.session ? [run.session] : []))
          .map(async (session) => ({ session, messages: await Session.messages({ sessionID: session.id }) })),
      )
      const owners = SessionPromptState.ownedPromptSessionIDs().map((sessionID) => ({
        sessionID,
        active: SessionPromptOwner.activeExecution(sessionID),
        lastActivity: SessionStatus.getActivity(sessionID)?.last_activity_at,
      }))
      const next = JSON.stringify({ runs, transcripts, owners })
      if (next !== signature) {
        signature = next
        lastActivity = Date.now()
      }
      current.latest = { runs, transcripts, owners }
      await fs.writeFile(
        path.join(root, "progress.json"),
        redactor.redact(
          JSON.stringify(
            { label, runs, requests: observed.requests.length, lastActivity, observedAt: Date.now() },
            null,
            2,
          ),
        ),
      )
      if (runResponse && owners.every((owner) => owner.active === undefined)) {
        assert.equal(runResponse.length, 1)
        const run = runResponse[0]!
        assert.equal(run.outcome, "succeeded")
        assert.equal(run.targetProjectId, projects[1]!.id)
        assert.equal(run.session?.directory, directories[1])
        assert.equal(run.session?.id, transcripts[0]?.session.id)
        const messages = transcripts[0]!.messages
        const accepted = messages.filter(
          (entry) =>
            entry.info.role === "user" && (entry.info.extra?.wake_reason as { fireID?: string })?.fireID === run.fireId,
        )
        assert.equal(accepted.length, 1)
        assert.deepEqual(
          accepted[0]!.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])),
          [prompt],
        )
        const readEvidence = messages
          .flatMap((entry) => entry.parts)
          .filter(
            (part) =>
              part.type === "tool" && part.state.status === "completed" && part.state.output.includes(markers[1]!),
          )
        assert(readEvidence.length > 0, "A real completed Tool must have read the actual B marker")
        const reply = messages.findLast(
          (entry) =>
            entry.info.role === "assistant" &&
            entry.info.time.completed &&
            entry.parts.some((part) => part.type === "text" && part.text.includes(markers[1]!)),
        )
        assert(reply, "A completed actual assistant reply must contain B's exact marker")
        const replyText = reply.parts
          .flatMap((part) => (part.type === "text" ? [part.text] : []))
          .join("\n")
          .replaceAll("\\", "/")
        const expectedDirectory = directories[1]!.replaceAll("\\", "/")
        const msysDirectory = expectedDirectory.replace(/^([A-Za-z]):/, (_, drive: string) => `/${drive.toLowerCase()}`)
        assert(
          replyText.includes(expectedDirectory) || replyText.includes(msysDirectory),
          "Reply must identify its actual project directory",
        )
        const fire = Database.use((db) =>
          db.select().from(tables.AutomationFireTable).where(eq(tables.AutomationFireTable.id, run.fireId)).get(),
        )!
        const persistedRun = Database.use((db) =>
          db.select().from(tables.AutomationRunTable).where(eq(tables.AutomationRunTable.id, run.id)).get(),
        )!
        assert.equal(fire.automation_revision_id, revision.id)
        assert.equal(fire.origin, "manual_api")
        assert.equal(persistedRun.automation_revision_id, revision.id)
        assert.equal(persistedRun.target_project_id, projects[1]!.id)
        assert.equal((await Session.get(run.session!.id)).projectID, projects[1]!.id)
        Object.assign(current, {
          status: "passed",
          run,
          fire,
          persistedRun,
          acceptedMessage: accepted[0],
          readEvidence,
          reply,
          promptDisposition: "settled",
        })
        await running
        break
      }
      if (Date.now() - lastActivity > inactivityMs) throw new Error("AUTOMATION_TARGET_INACTIVITY")
      await Bun.sleep(500)
    }
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
    credentialCleanup: cleanupErrors.length ? "failed" : "passed",
    cleanupErrors,
    error: failure instanceof Error ? { name: failure.name, message: failure.message, stack: failure.stack } : failure,
  }
  await fs.mkdir(path.dirname(resultPath), { recursive: true })
  await fs.writeFile(resultPath, redactor.redact(JSON.stringify(result, null, 2)))
  process.stdout.write(`[automation-target] ${result.status} result=${resultPath}\n`)
  if (result.status !== "passed") process.exitCode = 1
}
