import { randomBytes } from "node:crypto"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {
  applyIsolatedTestUserEnvironment,
  bootstrapIsolatedTestRuntime,
  removeIsolatedTestRuntime,
} from "@opencorvus-ai/util/test-runtime-environment"
import { prepareTestProcessSupervisor } from "./prepare-test-process-supervisor"

type Target = { scope: "session"; sessionId: string } | { scope: "project"; projectIds: string[] } | { scope: "global" }
type Automation = { id: string; name: string; target: Target; status: "active" | "paused"; nextRun: number | null }
type Run = {
  id: string
  automationId: string
  fireId: string
  targetScope: Target["scope"]
  targetProjectId: string | null
  session: { id: string; directory: string } | null
  outcome: "running" | "retry_wait" | "succeeded"
  completedAt: number | null
  error: string | null
}
type JsonObject = Record<string, unknown>

const runID = `scheduled-e2e-${new Date()
  .toISOString()
  .replace(/[-:.TZ]/g, "")
  .slice(0, 14)}-${randomBytes(4).toString("hex")}`
const root = path.join(os.tmpdir(), `opencorvus-${runID}`)
const testProcessSupervisor = prepareTestProcessSupervisor()
const isolatedRuntime = await bootstrapIsolatedTestRuntime("runner")
applyIsolatedTestUserEnvironment(isolatedRuntime)
if (testProcessSupervisor) process.env.OPENCORVUS_PROCESS_SUPERVISOR = testProcessSupervisor
const home = path.join(root, "home")
const projectOne = path.join(root, "project-one")
const projectTwo = path.join(root, "project-two")
const databasePath = path.join(home, "data", "opencorvus.db")
const managedConfigDirectory = path.join(root, "managed-config")
const resultPath = path.join(root, "result.json")
const providerID = "scheduled-e2e"
const modelID = "streaming-checker"
const model = `${providerID}/${modelID}`

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function recurrence(start: number, intervalSeconds = 120) {
  const stamp = new Date(start)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
  return `DTSTART:${stamp}\nRRULE:FREQ=SECONDLY;INTERVAL=${intervalSeconds}`
}

async function writeJSON(file: string, value: unknown) {
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

async function command(args: string[], cwd: string) {
  const child = Bun.spawn(args, { cwd, stdout: "pipe", stderr: "pipe", env: Bun.env })
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  if (code !== 0) throw new Error(`${args.join(" ")} failed (${code}): ${(stderr || stdout).trim()}`)
  return stdout.trim()
}

async function initializeProject(directory: string, title: string) {
  await fs.mkdir(directory, { recursive: true })
  await fs.writeFile(path.join(directory, "README.md"), `# ${title}\n`, "utf8")
  for (const args of [
    ["git", "init", "--initial-branch=main"],
    ["git", "config", "user.name", "OpenCorvus Scheduled E2E"],
    ["git", "config", "user.email", "scheduled-e2e@opencorvus.invalid"],
    ["git", "add", "README.md"],
    ["git", "commit", "-m", "test: initialize scheduled e2e project"],
  ])
    await command(args, directory)
  return {
    commit: await command(["git", "rev-parse", "HEAD"], directory),
    tree: await command(["git", "rev-parse", "HEAD^{tree}"], directory),
  }
}

function startProvider() {
  let sequence = 0
  let failProjectTwo = false
  let reportBusyStarted!: () => void
  const busyStarted = new Promise<void>((resolve) => (reportBusyStarted = resolve))
  let releaseBusy!: () => void
  const busyReleased = new Promise<void>((resolve) => (releaseBusy = resolve))
  const requests: Array<{ project: "one" | "two" | "global"; retry: boolean }> = []
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      if (new URL(request.url).pathname !== "/v1/chat/completions") return new Response("not found", { status: 404 })
      const body = await request.text()
      const project = body.includes(projectTwo.replace(/\\/g, "\\\\"))
        ? "two"
        : body.includes(projectOne.replace(/\\/g, "\\\\"))
          ? "one"
          : "global"
      const retry = body.includes("SCHEDULED_E2E_RETRY_FANOUT")
      const busy = body.includes("SCHEDULED_E2E_BUSY_HOLD")
      requests.push({ project, retry })
      if (retry && project === "two" && failProjectTwo) {
        failProjectTwo = false
        return Response.json({ error: { message: "injected project-two transient failure" } }, { status: 503 })
      }
      const id = `chatcmpl-scheduled-${++sequence}`
      const created = Math.floor(Date.now() / 1000)
      const chunks = [
        {
          id,
          object: "chat.completion.chunk",
          created,
          model: modelID,
          choices: [
            { index: 0, delta: { role: "assistant", content: `SCHEDULED_E2E_OK_${sequence}` }, finish_reason: null },
          ],
        },
        {
          id,
          object: "chat.completion.chunk",
          created,
          model: modelID,
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
          usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
        },
      ]
      const encoder = new TextEncoder()
      return new Response(
        new ReadableStream({
          async start(controller) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunks[0])}\n\n`))
            if (busy) {
              reportBusyStarted()
              await busyReleased
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunks[1])}\n\n`))
            controller.enqueue(encoder.encode("data: [DONE]\n\n"))
            controller.close()
          },
        }),
        { headers: { "content-type": "text/event-stream" } },
      )
    },
  })
  return {
    server,
    requests,
    busyStarted,
    releaseBusy,
    failProjectTwoOnce() {
      failProjectTwo = true
    },
  }
}

async function waitFor<T>(label: string, observe: () => Promise<T | undefined>, timeout = 90_000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const result = await observe()
    if (result !== undefined) return result
    await Bun.sleep(250)
  }
  throw new Error(`${label} did not converge within ${timeout}ms`)
}

await fs.mkdir(root, { recursive: false })
await fs.mkdir(path.join(home, "config"), { recursive: true })
await fs.mkdir(managedConfigDirectory, { recursive: false })
for (const key of [
  "OPENCORVUS_API_KEY",
  "OPENCORVUS_CONFIG",
  "OPENCORVUS_CONFIG_CONTENT",
  "OPENCORVUS_CONFIG_DIR",
  "OPENCORVUS_DISABLE_PROJECT_CONFIG",
  "OPENCORVUS_EMBEDDED_DASHSCOPE_KEY",
  "OPENCORVUS_ENABLE_EXPERIMENTAL_MODELS",
  "OPENCORVUS_MODELS_PATH",
  "OPENCORVUS_MODELS_URL",
  "OPENCORVUS_PACKAGED_PLUGIN_DIR",
  "OPENCORVUS_SERVER_PASSWORD",
  "OPENCORVUS_SERVER_USERNAME",
]) {
  delete process.env[key]
}
process.env.OPENCORVUS_HOME = home
process.env.OPENCORVUS_TEST_HOME = home
process.env.OPENCORVUS_TEST_PROCESS_ROOT = root
process.env.OPENCORVUS_TEST_MANAGED_CONFIG_DIR = managedConfigDirectory
const [firstGit, secondGit] = await Promise.all([
  initializeProject(projectOne, "Scheduled E2E project one"),
  initializeProject(projectTwo, "Scheduled E2E project two"),
])
const provider = startProvider()
await writeJSON(path.join(home, "config", "opencorvus.jsonc"), {
  model,
  small_model: model,
  provider: {
    [providerID]: {
      name: "Scheduled E2E streaming provider",
      npm: "@ai-sdk/openai-compatible",
      options: { apiKey: "scheduled-e2e-local", baseURL: `http://127.0.0.1:${provider.server.port}/v1` },
      models: {
        [modelID]: {
          name: "Scheduled E2E streaming checker",
          release_date: "2026-08-12",
          attachment: false,
          reasoning: false,
          temperature: true,
          tool_call: true,
          limit: { context: 262_144, output: 4_096 },
          modalities: { input: ["text"], output: ["text"] },
          variants: { high: {} },
        },
      },
    },
  },
})

let backend: ReturnType<typeof Bun.serve> | undefined
const findings: string[] = []
const requestFacts: Array<{ method: string; route: string; status: number; durationMs: number }> = []
try {
  const [
    { listenWithRecoveredServerRuntime, requireRecoveredServerRuntime },
    { Instance },
    { Database },
    { currentAutomationFrontiersInTransaction },
    { declareNativeTaskProcessDeployment },
  ] = await Promise.all([
    import("../src/cli/server-runtime"),
    import("../src/project/instance"),
    import("../src/storage/db"),
    import("../src/scheduler/automation-projection"),
    import("../src/runtime/task-process-deployment"),
  ])
  declareNativeTaskProcessDeployment()
  const prepared = await requireRecoveredServerRuntime(await listenWithRecoveredServerRuntime({
    options: { hostname: "127.0.0.1", port: 0, randomPort: true },
    recover: async () => {},
    disposeInstances: () => Instance.disposeAll(),
  }))
  backend = prepared.server
  const origin = `http://127.0.0.1:${backend.port}`
  async function request(route: string, init: RequestInit = {}, directory = projectOne) {
    const started = Date.now()
    const headers = new Headers(init.headers)
    headers.set("x-opencorvus-directory", directory)
    headers.set("x-opencorvus-request-id", crypto.randomUUID())
    const response = await fetch(`${origin}${route}`, { ...init, headers })
    requestFacts.push({
      method: init.method ?? "GET",
      route,
      status: response.status,
      durationMs: Date.now() - started,
    })
    return response
  }
  async function json<T>(route: string, init: RequestInit = {}, directory = projectOne): Promise<T> {
    const response = await request(route, init, directory)
    const text = await response.text()
    if (!response.ok)
      throw new Error(`${init.method ?? "GET"} ${route} failed ${response.status}: ${text.slice(0, 1000)}`)
    return JSON.parse(text) as T
  }
  const post = <T>(route: string, body: unknown, directory = projectOne) =>
    json<T>(
      route,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
      directory,
    )
  const patchAutomation = <T>(id: string, body: unknown) =>
    json<T>(`/global/automations/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  const create = (input: JsonObject) =>
    post<{ id: string; name: string; nextRun: number | null }>("/global/automations", input)
  const runs = (id: string) => json<Run[]>(`/global/automations/${id}/runs`)
  const remove = (id: string) => json<{ id: string; name: string }>(`/global/automations/${id}`, { method: "DELETE" })
  const messages = (sessionID: string, directory: string) =>
    json<Array<{ info: { role: string } }>>(`/session/${sessionID}/message`, {}, directory)

  const first = await json<{ id: string }>("/project/current", {}, projectOne)
  const second = await json<{ id: string }>("/project/current", {}, projectTwo)
  if (first.id === second.id) findings.push("fresh projects resolved to one Project ID")
  const session = await post<{ id: string; directory: string }>(
    "/session",
    { kind: "assistant", title: "Scheduled E2E exact session" },
    projectOne,
  )

  const invalid = await request("/global/automations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "invalid global model",
      target: { scope: "global" },
      recurrence: recurrence(Date.now() + 120_000),
      model: { providerID: "missing-provider", modelID: "missing-model" },
      prompt: "must never persist",
    }),
  })
  if (invalid.status === 201) {
    const row = (await invalid.json()) as { id: string }
    findings.push("global Automation persisted an unresolved explicit model")
    await remove(row.id)
  } else if (invalid.status < 400 || invalid.status >= 500)
    findings.push(`invalid global model returned ${invalid.status}`)

  const sessionAutomation = await create({
    name: "session lifecycle",
    target: { scope: "session", sessionId: session.id },
    recurrence: recurrence(Date.now() + 120_000),
    model: { providerID, modelID },
    prompt: "SCHEDULED_E2E_SESSION_MANUAL",
  })
  const sessionRun = await post<Run[]>(`/global/automations/${sessionAutomation.id}/run`, {})
  if (sessionRun.length !== 1 || sessionRun[0]?.outcome !== "succeeded" || sessionRun[0]?.session?.id !== session.id)
    findings.push("Run now did not reuse the exact Session")
  const paused = await patchAutomation<Automation>(sessionAutomation.id, { status: "paused" })
  const resumed = await patchAutomation<Automation>(sessionAutomation.id, { status: "active" })
  if (
    paused.status !== "paused" ||
    resumed.status !== "active" ||
    resumed.nextRun === null ||
    resumed.nextRun <= Date.now()
  )
    findings.push("pause/resume did not converge")

  const finiteAutomation = await create({
    name: "finite paused manual",
    target: { scope: "session", sessionId: session.id },
    recurrence: "DTSTART:20260101T000000Z\nRRULE:FREQ=DAILY;COUNT=1",
    model: { providerID, modelID },
    prompt: "SCHEDULED_E2E_FINITE_MANUAL",
  })
  const finitePaused = await patchAutomation<Automation>(finiteAutomation.id, { status: "paused" })
  const finiteRuns = await post<Run[]>(`/global/automations/${finiteAutomation.id}/run`, {})
  const finiteSettled = (await json<Automation[]>("/global/automations")).find((row) => row.id === finiteAutomation.id)
  if (
    finiteAutomation.nextRun !== null ||
    finitePaused.status !== "paused" ||
    finiteRuns.length !== 1 ||
    finiteRuns[0]?.outcome !== "succeeded" ||
    finiteRuns[0]?.session?.id !== session.id ||
    finiteSettled?.status !== "paused" ||
    finiteSettled.nextRun !== null
  )
    findings.push(
      "finite paused manual execution did not settle its exact Session while preserving exhaustion and pause",
    )

  const busyPrompt = post(`/session/${session.id}/message`, {
    messageID: `msg_busy_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`,
    model: { providerID, modelID },
    agent: "chat",
    parts: [{ type: "text", text: "SCHEDULED_E2E_BUSY_HOLD" }],
  })
  await provider.busyStarted
  const busyAutomation = await create({
    name: "busy exact session",
    target: { scope: "session", sessionId: session.id },
    recurrence: recurrence(Date.now() + 2_000),
    model: { providerID, modelID },
    prompt: "SCHEDULED_E2E_BUSY_AUTOMATION",
  })
  await Bun.sleep(3_500)
  const delayedBusy = Database.use((db) =>
    currentAutomationFrontiersInTransaction(db, { status: "active" }).find(
      (candidate) => candidate.id === busyAutomation.id,
    ),
  )
  if (!delayedBusy || delayedBusy.next_run !== busyAutomation.nextRun || delayedBusy.lease_until <= Date.now())
    findings.push("busy Session did not retain and delay its exact due occurrence")
  const busyRunNow = await request(`/global/automations/${busyAutomation.id}/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  })
  if (busyRunNow.status !== 409) findings.push(`busy Session Run now returned ${busyRunNow.status}`)
  provider.releaseBusy()
  await busyPrompt
  const busyRun = await waitFor("busy Session delayed due", async () =>
    (await runs(busyAutomation.id)).find((row) => row.outcome === "succeeded"),
  )
  if (busyRun.session?.id !== session.id || busyRun.fireId.length === 0)
    findings.push("busy Session delayed occurrence lost its exact Session or fire identity")
  await patchAutomation(busyAutomation.id, { status: "paused" })

  const globalAutomation = await create({
    name: "global natural due",
    target: { scope: "global" },
    recurrence: recurrence(Date.now() + 3_000),
    model: { providerID, modelID },
    reasoningEffort: "high",
    prompt: "SCHEDULED_E2E_GLOBAL_NATURAL",
  })
  const globalRun = await waitFor("global natural due", async () =>
    (await runs(globalAutomation.id)).find((row) => row.outcome === "succeeded"),
  )
  if (globalRun.targetScope !== "global" || !globalRun.session) findings.push("global due run lacked a visible Chat")
  await patchAutomation(globalAutomation.id, { status: "paused" })

  provider.failProjectTwoOnce()
  const projectAutomation = await create({
    name: "project natural retry",
    target: { scope: "project", projectIds: [first.id, second.id] },
    recurrence: recurrence(Date.now() + 3_000),
    model: { providerID, modelID },
    prompt: "SCHEDULED_E2E_RETRY_FANOUT",
  })
  const projectRuns = await waitFor("project retry convergence", async () => {
    const history = await runs(projectAutomation.id)
    const success = history.filter((row) => row.outcome === "succeeded")
    return success.length === 2 ? success : undefined
  })
  if (
    new Set(projectRuns.map((row) => row.fireId)).size !== 1 ||
    new Set(projectRuns.map((row) => row.targetProjectId)).size !== 2
  )
    findings.push("project fanout lost one fire or target identity")
  const retryRequests = provider.requests.filter((entry) => entry.retry)
  const oneRequests = retryRequests.filter((entry) => entry.project === "one").length
  const twoRequests = retryRequests.filter((entry) => entry.project === "two").length
  if (oneRequests !== 1 || twoRequests !== 2)
    findings.push(`retry replay cardinality was one=${oneRequests}, two=${twoRequests}`)
  await patchAutomation(projectAutomation.id, { status: "paused" })

  const worktreeAutomation = await create({
    name: "worktree manual",
    target: { scope: "project", projectIds: [first.id] },
    recurrence: recurrence(Date.now() + 120_000),
    executionMode: "worktree",
    model: { providerID, modelID },
    prompt: "SCHEDULED_E2E_WORKTREE",
  })
  const worktreeRun = (await post<Run[]>(`/global/automations/${worktreeAutomation.id}/run`, {}))[0]
  if (
    !worktreeRun?.session ||
    worktreeRun.outcome !== "succeeded" ||
    path.resolve(worktreeRun.session.directory) === path.resolve(projectOne)
  )
    findings.push("worktree run lacked its owned execution directory")
  const switched = await patchAutomation<Automation>(worktreeAutomation.id, {
    target: { scope: "global" },
    executionMode: "local",
    name: "scope switched",
  })
  if (switched.target.scope !== "global") findings.push("target replacement retained stale Project scope")

  if (process.env.OPENCORVUS_SCHEDULED_E2E_VISUAL_HOLD === "1") {
    for (const automation of [
      sessionAutomation,
      busyAutomation,
      globalAutomation,
      projectAutomation,
      worktreeAutomation,
      finiteAutomation,
    ]) {
      await patchAutomation(automation.id, { status: "paused" })
    }
    const releasePath = path.join(root, "visual-release")
    console.log(`SCHEDULED_E2E_VISUAL_READY ${JSON.stringify({ url: `${origin}/ui/`, root, releasePath })}`)
    await waitFor(
      "visual acceptance release",
      async () => {
        try {
          await fs.access(releasePath)
          return true
        } catch {
          return undefined
        }
      },
      15 * 60_000,
    )
  }

  const preserved = [
    sessionRun[0]?.session,
    busyRun.session,
    globalRun.session,
    ...projectRuns.map((row) => row.session),
    worktreeRun?.session,
  ].filter((value): value is { id: string; directory: string } => !!value)
  for (const row of [
    sessionAutomation,
    busyAutomation,
    globalAutomation,
    projectAutomation,
    worktreeAutomation,
    finiteAutomation,
  ]) {
    const receipt = await remove(row.id)
    if (receipt.id !== row.id || !receipt.name) findings.push(`delete receipt was incomplete for ${row.id}`)
  }
  for (const preservedSession of preserved) {
    if (
      !(await messages(preservedSession.id, preservedSession.directory)).some(
        (entry) => entry.info.role === "assistant",
      )
    )
      findings.push(`Session ${preservedSession.id} lost its assistant result after deletion`)
  }

  const evidence = {
    schema_version: 1,
    outcome: findings.length ? "failed" : "passed",
    run_id: runID,
    isolation: {
      backend_port: backend.port,
      provider_port: provider.server.port,
      home_directory: home,
      database_path: databasePath,
      database_identity: Database.Identity(),
      managed_config_directory: managedConfigDirectory,
      projects: {
        one: { id: first.id, directory: projectOne, ...firstGit },
        two: { id: second.id, directory: projectTwo, ...secondGit },
      },
    },
    findings,
    provider: { id: providerID, model: modelID, requests: provider.requests },
    requests: requestFacts,
  }
  await writeJSON(resultPath, evidence)
  console.log(`SCHEDULED_E2E_RESULT ${JSON.stringify({ outcome: evidence.outcome, root, resultPath, findings })}`)
  if (findings.length) throw new Error(findings.join("; "))
} catch (error) {
  console.error(`SCHEDULED_E2E_FAILURE ${JSON.stringify({ root, resultPath, error: message(error) })}`)
  process.exitCode = 1
} finally {
  const cleanupFailures: unknown[] = []
  if (backend) {
    try {
      await backend.stop(true)
    } catch (error) {
      cleanupFailures.push(error)
    }
  }
  try {
    provider.server.stop(true)
  } catch (error) {
    cleanupFailures.push(error)
  }
  const { Database } = await import("../src/storage/db")
  try {
    Database.close()
  } catch (error) {
    cleanupFailures.push(error)
  }
  try {
    await removeIsolatedTestRuntime(isolatedRuntime)
  } catch (error) {
    cleanupFailures.push(error)
  }
  if (cleanupFailures.length === 1) throw cleanupFailures[0]
  if (cleanupFailures.length > 1) throw new AggregateError(cleanupFailures, "Scheduled automations cleanup failed")
}
