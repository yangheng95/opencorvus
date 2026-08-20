import fs from "node:fs/promises"
import path from "node:path"
import crypto from "node:crypto"
import { Database as SQLite } from "bun:sqlite"
import {
  applyIsolatedTestUserEnvironment,
  bootstrapIsolatedTestRuntime,
  removeIsolatedTestRuntime,
} from "@opencorvus-ai/util/test-runtime-environment"
import { prepareTestProcessSupervisor } from "../../prepare-test-process-supervisor"
import {
  EXTERNAL_BENCHMARK_SCHEMA_VERSION,
  benchmarkActivitySignature,
  benchmarkRunKey,
  normalizeTrajectory,
  renderTrajectorySVG,
  summarizeTranscriptUsage,
  type TokenBreakdown,
} from "./contract"

const SCRIPT_DIRECTORY = import.meta.dir
const AUTOMATIONBENCH_VERSION = "1.0.6"
const AUTOMATIONBENCH_SOURCE_REVISION = "4a8e1061254004d9dac807054eed33fad7d1ff14"
const DEFAULT_MODEL = "openai/gpt-5.6-luna"
const DEFAULT_INACTIVITY_MS = 120_000

type Profile = "base" | "advanced"

type Arguments = {
  profile: Profile
  domain: string
  task: string
  model: string
  python: string
  sourceData: string
  output: string
  inactivityMs: number
}

function parseArguments(argv: string[]): Arguments {
  const values = new Map<string, string>()
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]
    const value = argv[index + 1]
    if (!key?.startsWith("--") || value === undefined) throw new Error(`Expected --name value arguments, got ${argv.join(" ")}`)
    values.set(key.slice(2), value)
  }
  const profile = values.get("profile")
  if (profile !== "base" && profile !== "advanced") throw new Error("--profile must be base or advanced")
  const python = values.get("python") ?? process.env.AUTOMATION_BENCH_PYTHON
  if (!python) throw new Error("--python or AUTOMATION_BENCH_PYTHON must name a Python 3.13 AutomationBench environment")
  const sourceData = values.get("source-data") ?? process.env.OPENCORVUS_BENCH_SOURCE_DATA
  if (!sourceData) throw new Error("--source-data or OPENCORVUS_BENCH_SOURCE_DATA must name the existing OpenCorvus data directory")
  const output = values.get("output")
  if (!output) throw new Error("--output is required")
  const inactivityMs = Number(values.get("inactivity-ms") ?? DEFAULT_INACTIVITY_MS)
  if (!Number.isFinite(inactivityMs) || inactivityMs <= 0) throw new Error("--inactivity-ms must be a positive finite number")
  return {
    profile,
    domain: values.get("domain") ?? "sales",
    task: values.get("task") ?? "sales.multi_hop_lookup",
    model: values.get("model") ?? DEFAULT_MODEL,
    python: path.resolve(python),
    sourceData: path.resolve(sourceData),
    output: path.resolve(output),
    inactivityMs: Math.floor(inactivityMs),
  }
}

async function verifySourceProjection(input: Arguments) {
  const authPath = path.join(input.sourceData, "auth.json")
  const modelsPath = path.join(input.sourceData, "models.json")
  const [authRaw, modelsRaw] = await Promise.all([fs.readFile(authPath, "utf8"), fs.readFile(modelsPath, "utf8")])
  const auth = JSON.parse(authRaw) as Record<string, unknown>
  const models = JSON.parse(modelsRaw) as Record<string, any>
  const slash = input.model.indexOf("/")
  if (slash < 1) throw new Error(`Model must use provider/model form: ${input.model}`)
  const providerID = input.model.slice(0, slash)
  const modelID = input.model.slice(slash + 1)
  if (!(providerID in auth)) throw new Error(`Source auth.json does not configure provider ${providerID}`)
  if (!models[providerID]?.models?.[modelID]) throw new Error(`Source models.json does not project exact model ${input.model}`)
  return { authPath, modelsPath, providerID, modelID }
}

async function sourceEvidence() {
  const commit = Bun.spawnSync(["git", "rev-parse", "HEAD"], { cwd: process.cwd() }).stdout.toString().trim()
  const status = Bun.spawnSync(["git", "status", "--short"], { cwd: process.cwd() }).stdout.toString().trim()
  const bundleFiles = [
    "automationbench-api.SKILL.md",
    "automationbench_bridge.py",
    "automationbench_tool.py",
    "contract.ts",
    "run-automationbench.ts",
  ]
  const bundle = crypto.createHash("sha256")
  for (const name of bundleFiles) {
    bundle.update(name)
    bundle.update("\0")
    bundle.update(await fs.readFile(path.join(SCRIPT_DIRECTORY, name)))
    bundle.update("\0")
  }
  return {
    commit,
    worktree_clean: status.length === 0,
    dirty_paths: status ? status.split(/\r?\n/) : [],
    benchmark_bundle_sha256: bundle.digest("hex"),
  }
}

function jsonLines(raw: string): Array<Record<string, any>> {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as Record<string, any>]
      } catch {
        return []
      }
    })
}

async function readJSONLines(file: string): Promise<Array<Record<string, any>>> {
  return jsonLines(await fs.readFile(file, "utf8").catch(() => ""))
}

async function startAutomationBenchBridge(input: Arguments, eventsPath: string) {
  const toolToken = crypto.randomBytes(24).toString("hex")
  const adminToken = crypto.randomBytes(24).toString("hex")
  const process = Bun.spawn(
    [
      input.python,
      path.join(SCRIPT_DIRECTORY, "automationbench_bridge.py"),
      "--domain",
      input.domain,
      "--task",
      input.task,
      "--events",
      eventsPath,
      "--tool-token",
      toolToken,
      "--admin-token",
      adminToken,
    ],
    { stdout: "pipe", stderr: "pipe" },
  )
  const reader = process.stdout.getReader()
  const decoder = new TextDecoder()
  let pending = ""
  let ready: Record<string, any> | undefined
  while (!ready) {
    const next = await reader.read()
    if (next.done) {
      const stderr = await new Response(process.stderr).text()
      throw new Error(`AutomationBench bridge exited before ready: ${stderr}`)
    }
    pending += decoder.decode(next.value, { stream: true })
    const newline = pending.indexOf("\n")
    if (newline < 0) continue
    ready = JSON.parse(pending.slice(0, newline))
  }
  if (ready.event !== "ready" || typeof ready.port !== "number") throw new Error("AutomationBench bridge returned an invalid ready event")
  const baseURL = `http://127.0.0.1:${ready.port}`
  const request = async <T>(route: string, token: string, body?: unknown): Promise<T> => {
    const response = await fetch(baseURL + route, {
      method: body === undefined ? "GET" : "POST",
      headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "content-type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await response.text()
    if (!response.ok) throw new Error(`AutomationBench bridge ${route} failed ${response.status}: ${text}`)
    return JSON.parse(text) as T
  }
  await request("/health", toolToken)
  return { process, toolToken, adminToken, baseURL, request }
}

async function seedProject(input: { projectDirectory: string; baseURL: string; toolToken: string }) {
  const skillDirectory = path.join(input.projectDirectory, ".opencorvus", "skill", "automationbench-api")
  await fs.mkdir(skillDirectory, { recursive: true })
  await Promise.all([
    fs.copyFile(path.join(SCRIPT_DIRECTORY, "automationbench_tool.py"), path.join(input.projectDirectory, "automationbench_tool.py")),
    fs.copyFile(path.join(SCRIPT_DIRECTORY, "automationbench-api.SKILL.md"), path.join(skillDirectory, "SKILL.md")),
    fs.writeFile(
      path.join(input.projectDirectory, ".automationbench-tool.json"),
      JSON.stringify({ base_url: input.baseURL, tool_token: input.toolToken }) + "\n",
      "utf8",
    ),
    fs.writeFile(
      path.join(input.projectDirectory, "README.md"),
      "# AutomationBench trial workspace\n\nUse the explicitly requested `automationbench-api` Skill and project-local tool client.\n",
      "utf8",
    ),
  ])
}

function officialTaskRequest(prompt: unknown): string {
  if (!Array.isArray(prompt)) throw new Error("AutomationBench task prompt must be an array")
  const messages = prompt.map((item) => {
    if (!item || typeof item !== "object") throw new Error("AutomationBench task prompt contains a non-object message")
    const role = String((item as Record<string, unknown>).role ?? "")
    const content = String((item as Record<string, unknown>).content ?? "")
    return `${role.toUpperCase()}:\n${content}`
  })
  return [
    "This is an AutomationBench API-mode evaluation. The simulated business end state is the only scored deliverable.",
    "Load the project Skill named `automationbench-api` before acting and use only its project-local client for benchmark operations.",
    "Do not ask the operator a question, do not modify product files, and do not replace benchmark operations with a prose report.",
    "",
    ...messages,
  ].join("\n\n")
}

function ledgerUsage(databasePath: string): TokenBreakdown & { modelCalls: number } {
  const db = new SQLite(databasePath, { readonly: true })
  try {
    const row = db
      .query<
        {
          input: number
          output: number
          reasoning: number
          cacheRead: number
          cacheWrite: number
          total: number
          costUSD: number
          pricedCalls: number
          unpricedCalls: number
          modelCalls: number
        },
        []
      >(
        `SELECT
           COALESCE(SUM(input_tokens), 0) AS input,
           COALESCE(SUM(output_tokens), 0) AS output,
           COALESCE(SUM(reasoning_tokens), 0) AS reasoning,
           COALESCE(SUM(cache_read_tokens), 0) AS cacheRead,
           COALESCE(SUM(cache_write_tokens), 0) AS cacheWrite,
           COALESCE(SUM(total_tokens), 0) AS total,
           COALESCE(SUM(cost_usd), 0) AS costUSD,
           COALESCE(SUM(CASE WHEN billing_status = 'priced' THEN 1 ELSE 0 END), 0) AS pricedCalls,
           COALESCE(SUM(CASE WHEN billing_status = 'unpriced' THEN 1 ELSE 0 END), 0) AS unpricedCalls,
           COUNT(*) AS modelCalls
         FROM provider_usage_event
         WHERE purpose <> 'provider-connectivity'`,
      )
      .get()
    if (!row) throw new Error("Provider usage ledger aggregation returned no row")
    return { ...row, assistantMessages: 0 }
  } finally {
    db.close()
  }
}

const arguments_ = parseArguments(process.argv.slice(2))
const source = await verifySourceProjection(arguments_)
const runSource = await sourceEvidence()
const runID = crypto.randomUUID()
const startedAt = Date.now()
const runKey = benchmarkRunKey(startedAt, runID)
const outputDirectory = path.join(
  arguments_.output,
  `${arguments_.domain}-${arguments_.task.replaceAll(".", "-")}-${arguments_.profile}`,
  runKey,
)
await fs.mkdir(outputDirectory, { recursive: true })
const bridgeEventsPath = path.join(outputDirectory, "automationbench-events.jsonl")
const bridge = await startAutomationBenchBridge(arguments_, bridgeEventsPath)
const isolatedRuntime = await bootstrapIsolatedTestRuntime("runner")
applyIsolatedTestUserEnvironment(isolatedRuntime)
const testProcessSupervisor = prepareTestProcessSupervisor()
if (testProcessSupervisor) process.env.OPENCORVUS_PROCESS_SUPERVISOR = testProcessSupervisor
const isolatedHome = path.join(isolatedRuntime.processRoot, "opencorvus-home")
process.env.OPENCORVUS_HOME = isolatedHome
const isolatedData = path.join(isolatedHome, "data")
await fs.mkdir(isolatedData, { recursive: true })
await Promise.all([
  fs.copyFile(source.authPath, path.join(isolatedData, "auth.json")),
  fs.copyFile(source.modelsPath, path.join(isolatedData, "models.json")),
])
const projectDirectory = path.join(isolatedRuntime.processRoot, "project")
await fs.mkdir(projectDirectory, { recursive: true })
await seedProject({ projectDirectory, baseURL: bridge.baseURL, toolToken: bridge.toolToken })

const { Database } = await import("@/storage/db")
const { waitForIngressDeliveryHooksForTest } = await import("@/engine/task-root-ingress-delivery")
const { Log } = await import("@/util/log")
const { Server } = await import("@/server/server")
const { declareNativeTaskProcessDeployment } = await import("@/runtime/task-process-deployment")
await Log.init({ print: false })
declareNativeTaskProcessDeployment()

let backend: ReturnType<typeof Server.listen> | undefined
let taskID: string | undefined
let stage = "runtime_start"

async function writeEvidenceManifest() {
  const entries = await fs.readdir(outputDirectory, { withFileTypes: true })
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name !== "evidence-manifest.json")
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(async (entry) => {
        const bytes = await fs.readFile(path.join(outputDirectory, entry.name))
        return {
          path: entry.name,
          bytes: bytes.byteLength,
          sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
        }
      }),
  )
  await fs.writeFile(
    path.join(outputDirectory, "evidence-manifest.json"),
    JSON.stringify(
      {
        schema_version: EXTERNAL_BENCHMARK_SCHEMA_VERSION,
        run_id: runID,
        run_key: runKey,
        generated_at: Date.now(),
        files,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  )
}

async function requestJSON<T>(route: string, init: RequestInit = {}, projectScoped = true): Promise<T> {
  if (!backend) throw new Error("OpenCorvus benchmark Server is not listening")
  const url = new URL(route, backend.url)
  const headers = new Headers(init.headers)
  headers.set("x-opencorvus-request-id", crypto.randomUUID())
  if (projectScoped) {
    url.searchParams.set("directory", projectDirectory)
    headers.set("x-opencorvus-directory", projectDirectory)
  }
  const response = await fetch(url, { ...init, headers, timeout: false } as BunFetchRequestInit)
  const body = await response.text()
  if (!response.ok) throw new Error(`${init.method ?? "GET"} ${url.pathname} failed ${response.status}: ${body}`)
  return body ? (JSON.parse(body) as T) : (undefined as T)
}

async function discoverTaskID(input: {
  title: string
  creation: Promise<{ ok: true; value: { task_id: string } } | { ok: false; error: unknown }>
}) {
  while (true) {
    const settled = await Promise.race([input.creation, Bun.sleep(1000).then(() => undefined)])
    if (settled?.ok) return settled.value.task_id
    if (settled && !settled.ok) throw settled.error
    const board = await requestJSON<{
      tasks: Array<{ task: { id: string; title: string } }>
    }>(`/tasks?q=${encodeURIComponent(input.title)}&limit=10`)
    const matched = board.tasks.find((item) => item.task.title === input.title)
    if (matched) return matched.task.id
  }
}

async function observations() {
  if (!taskID) throw new Error("Task has not been created")
  const [board, transcript, traceProjection, interactions, benchmarkEvents] = await Promise.all([
    requestJSON<Record<string, any>>(`/task/${taskID}/board?sync=0`),
    requestJSON<Array<{ info: Record<string, any>; parts: Array<Record<string, any>> }>>(`/task/${taskID}/transcript`),
    requestJSON<{ ok: true; enabled: boolean; traceDir: string; events: Array<Record<string, any>> }>(`/task/${taskID}/trace`),
    requestJSON<Array<Record<string, any>>>(`/task/${taskID}/interactions`),
    readJSONLines(bridgeEventsPath),
  ])
  if (!traceProjection.enabled) throw new Error("OpenCorvus AgentTrace is disabled for the benchmark Task")
  return { board, transcript, trace: traceProjection.events, interactions, benchmarkEvents }
}

async function waitForTerminal() {
  let signature = ""
  let inactivityDeadline = Date.now() + arguments_.inactivityMs
  while (Date.now() < inactivityDeadline) {
    const current = await observations()
    const status = String(current.board.task?.status ?? "")
    if (["completed", "failed", "cancelled"].includes(status)) return current
    const next = benchmarkActivitySignature({
      board: current.board,
      transcript: current.transcript,
      trace: current.trace,
      benchmarkEventCount: current.benchmarkEvents.length,
    })
    if (next !== signature) {
      signature = next
      inactivityDeadline = Date.now() + arguments_.inactivityMs
      process.stdout.write(
        JSON.stringify({
          event: "activity",
          profile: arguments_.profile,
          taskID,
          status,
          messages: current.transcript.length,
          traceEvents: current.trace.length,
          benchmarkCalls: current.benchmarkEvents.filter((event) => event.kind === "tool").length,
          pendingInteractions: current.interactions.filter((item) => item.status === "pending").length,
        }) + "\n",
      )
    }
    await Bun.sleep(1000)
  }
  const current = await observations()
  throw new Error(
    `AutomationBench ${arguments_.profile} Task had no observable activity for ${arguments_.inactivityMs}ms; ` +
      `pending interactions=${current.interactions.filter((item) => item.status === "pending").length}`,
  )
}

try {
  backend = Server.listen({ hostname: "127.0.0.1", port: 0, randomPort: true })
  stage = "provider_preflight"
  const preflight = await requestJSON<{
    ok: boolean
    status: string
    providerID: string
    modelID: string
    message: string
  }>(
    `/global/providers/${encodeURIComponent(source.providerID)}/test`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ modelID: source.modelID }) },
    false,
  )
  if (!preflight.ok || preflight.status !== "connected" || preflight.modelID !== source.modelID) {
    throw new Error(`Exact Provider/model preflight failed: ${JSON.stringify(preflight)}`)
  }
  stage = "benchmark_task_load"
  const benchmarkTask = await bridge.request<{ prompt: unknown; example_id: string }>("/admin/task", bridge.adminToken)
  stage = "task_create"
  const taskTitle = `AutomationBench ${arguments_.task} (${arguments_.profile}) · ${crypto.randomUUID()}`
  const requestID = crypto.randomUUID()
  const creation = requestJSON<{ task_id: string }>("/task?init-git=true", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: taskTitle,
      request: officialTaskRequest(benchmarkTask.prompt),
      requestID,
      source: "external-automationbench-pilot",
      productPillar: "work",
      model: arguments_.model,
      promptProfile: arguments_.profile,
    }),
  }).then(
    (value) => ({ ok: true as const, value }),
    (error) => ({ ok: false as const, error }),
  )
  taskID = await discoverTaskID({ title: taskTitle, creation })
  stage = "task_execution"
  const terminal = await waitForTerminal()
  const created = await creation
  if (!created.ok) throw created.error
  if (created.value.task_id !== taskID) {
    throw new Error(`Task creation response ${created.value.task_id} did not match observed Task ${taskID}`)
  }
  stage = "benchmark_scoring"
  const score = await bridge.request<{
    partial_credit: number
    task_completed_correctly: number
    assertion_results: Array<Record<string, unknown>>
    end_state_sha256: string
    tool_calls: number
  }>("/admin/score", bridge.adminToken, {})
  const transcriptTokens = summarizeTranscriptUsage(terminal.transcript)
  const tokens = ledgerUsage(path.join(isolatedData, "opencorvus.db"))
  const trajectory = normalizeTrajectory({
    transcript: terminal.transcript,
    trace: terminal.trace,
    benchmarkEvents: await readJSONLines(bridgeEventsPath),
  })
  const completion = (terminal.board.artifacts ?? [])
    .filter((artifact: any) => artifact.kind === "task_completion_decision")
    .sort((left: any, right: any) => Number(right.time?.created ?? 0) - Number(left.time?.created ?? 0))[0]
  const finishedAt = Date.now()
  const lifecycleStatus = String(terminal.board.task?.status ?? "")
  const valid = lifecycleStatus === "completed"
  const result = {
    schema_version: EXTERNAL_BENCHMARK_SCHEMA_VERSION,
    run: {
      id: runID,
      key: runKey,
      started_at: startedAt,
      finished_at: finishedAt,
      duration_ms: finishedAt - startedAt,
      status: valid ? "scored" : "invalid",
    },
    benchmark: {
      name: "automationbench",
      version: AUTOMATIONBENCH_VERSION,
      source_revision: AUTOMATIONBENCH_SOURCE_REVISION,
      split: "public",
      domain: arguments_.domain,
      task: arguments_.task,
      example_id: benchmarkTask.example_id,
      toolset: "api",
      repetitions: 1,
      metrics: valid
        ? {
            partial_credit: score.partial_credit,
            task_completed_correctly: score.task_completed_correctly,
          }
        : null,
      diagnostic_metrics: {
        partial_credit: score.partial_credit,
        task_completed_correctly: score.task_completed_correctly,
      },
      assertion_results: score.assertion_results,
      end_state_sha256: score.end_state_sha256,
      tool_calls: score.tool_calls,
    },
    opencorvus: {
      commit: runSource.commit,
      source: runSource,
      task_id: taskID,
      lifecycle_status: lifecycleStatus,
      profile: arguments_.profile,
      model: arguments_.model,
      skill: { name: "automationbench-api", enabled: true, revision: 1 },
      selected_workflow_id: completion?.payload?.selected_workflow_id ?? null,
      provider_preflight: {
        ok: preflight.ok,
        status: preflight.status,
        provider_id: preflight.providerID,
        model_id: preflight.modelID,
      },
      tokens,
      transcript_token_reconciliation: transcriptTokens,
      sessions: new Set(terminal.transcript.map((message) => message.info?.sessionID).filter(Boolean)).size,
      agents: [...new Set(terminal.transcript.map((message) => message.info?.agent).filter(Boolean))],
      trace_events: terminal.trace.length,
      interactions: terminal.interactions,
    },
    comparison: {
      leaderboard_eligible: false,
      reason: valid
        ? "One-task public smoke under the OpenCorvus harness; official AutomationBench uses a held-out private set."
        : `OpenCorvus Task lifecycle settled ${lifecycleStatus}; rubric values are diagnostic only.`,
    },
  }
  const resultPath = path.join(outputDirectory, "result.json")
  const tracePath = path.join(outputDirectory, "opencorvus-trace.json")
  const transcriptPath = path.join(outputDirectory, "opencorvus-transcript.json")
  const trajectoryPath = path.join(outputDirectory, "trajectory.json")
  const svgPath = path.join(outputDirectory, "trajectory.svg")
  await Promise.all([
    fs.writeFile(resultPath, JSON.stringify(result, null, 2) + "\n", "utf8"),
    fs.writeFile(tracePath, JSON.stringify(terminal.trace, null, 2) + "\n", "utf8"),
    fs.writeFile(transcriptPath, JSON.stringify(terminal.transcript, null, 2) + "\n", "utf8"),
    fs.writeFile(trajectoryPath, JSON.stringify(trajectory, null, 2) + "\n", "utf8"),
    fs.writeFile(
      svgPath,
      renderTrajectorySVG({ title: `AutomationBench ${arguments_.task} · ${arguments_.profile}`, events: trajectory, tokens }),
      "utf8",
    ),
  ])
  stage = "complete"
  process.stdout.write(JSON.stringify({ event: "result", resultPath, svgPath, result }) + "\n")
} catch (error) {
  const failure = {
    schema_version: EXTERNAL_BENCHMARK_SCHEMA_VERSION,
    run: {
      id: runID,
      key: runKey,
      started_at: startedAt,
      failed_at: Date.now(),
      status: stage === "provider_preflight" ? "blocked_preflight" : "failed",
      stage,
    },
    benchmark: {
      name: "automationbench",
      version: AUTOMATIONBENCH_VERSION,
      source_revision: AUTOMATIONBENCH_SOURCE_REVISION,
      split: "public",
      domain: arguments_.domain,
      task: arguments_.task,
    },
    opencorvus: {
      profile: arguments_.profile,
      model: arguments_.model,
      task_id: taskID ?? null,
      source: runSource,
    },
    error: error instanceof Error ? { name: error.name, message: error.message } : { name: "UnknownError", message: String(error) },
  }
  await fs.writeFile(path.join(outputDirectory, "failure.json"), JSON.stringify(failure, null, 2) + "\n", "utf8")
  throw error
} finally {
  const failures: unknown[] = []
  try {
    await writeEvidenceManifest()
  } catch (error) {
    failures.push(error)
  }
  try {
    await waitForIngressDeliveryHooksForTest()
  } catch (error) {
    failures.push(error)
  }
  if (backend) {
    try {
      await backend.stop(true)
    } catch (error) {
      failures.push(error)
    }
  }
  try {
    Database.close()
  } catch (error) {
    failures.push(error)
  }
  try {
    bridge.process.kill()
    await bridge.process.exited
  } catch (error) {
    failures.push(error)
  }
  try {
    await removeIsolatedTestRuntime(isolatedRuntime)
  } catch (error) {
    failures.push(error)
  }
  if (failures.length === 1) throw failures[0]
  if (failures.length > 1) throw new AggregateError(failures, "AutomationBench pilot cleanup failed")
}
