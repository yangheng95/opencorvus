import fs from "node:fs/promises"
import path from "node:path"
import crypto from "node:crypto"
import { Database as SQLite } from "bun:sqlite"
import lockfile from "proper-lockfile"
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
  automationBenchToolConfig,
  automationBenchHarnessRequest,
  auditBenchmarkIsolation,
  normalizeTrajectory,
  renderTrajectorySVG,
  sourceAuthSecretLeaves,
  summarizeBenchmarkToolEvents,
  summarizeTranscriptUsage,
  summarizeProviderUsageRows,
  type ProviderUsageRow,
} from "./contract"

const SCRIPT_DIRECTORY = import.meta.dir
const AUTOMATIONBENCH_VERSION = "1.0.6"
const AUTOMATIONBENCH_SOURCE_REVISION = "4a8e1061254004d9dac807054eed33fad7d1ff14"
const AUTOMATIONBENCH_PACKAGE_TREE_SHA256 = "cc7a63f9444814c7029e325dacbdf1c2e870430d08aaf8d4ecf5c0e44fe829d4"
const DEFAULT_MODEL = "openai/gpt-5.6-luna"
const DEFAULT_INACTIVITY_MS = 120_000
const CLEANUP_TIMEOUT_MS = 10_000

type Profile = "base" | "advanced"

async function within<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  return Promise.race([
    promise,
    Bun.sleep(timeoutMs).then(() => {
      throw new Error(`${label} exceeded ${timeoutMs}ms`)
    }),
  ])
}

type ActiveLease = {
  run_id: string
  pid: number
  case_id: string
  profile: Profile
  started_at: number
  batch_run_id: string
  batch_index: number
  batch_plan_sha256: string
}

type Arguments = {
  profile: Profile
  domain: string
  task: string
  model: string
  python: string
  sourceData: string
  output: string
  inactivityMs: number
  caseSet: string
  repetition: number
  batchPlan: string
  batchRunID: string
  batchIndex: number
  waveIndex: number
  priorWaveCompletion?: string
  batchAuthorization: string
  restrictedShell: string
}

type FrozenCase = {
  domain: string
  task: string
  example_id: string | number
  task_contract_sha256: string
  case_index: number
  batch_index: number
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
  const repetition = Number(values.get("repetition") ?? 1)
  if (!Number.isInteger(repetition) || repetition < 1) throw new Error("--repetition must be a positive integer")
  const batchPlan = values.get("batch-plan")
  const batchRunID = values.get("batch-run-id")
  const batchAuthorization = values.get("batch-authorization")
  const restrictedShell = values.get("restricted-shell")
  const batchIndex = Number(values.get("batch-index"))
  const waveIndex = Number(values.get("wave-index"))
  if (
    !batchPlan ||
    !batchRunID ||
    !batchAuthorization ||
    !restrictedShell ||
    !Number.isInteger(batchIndex) ||
    batchIndex < 1 ||
    batchIndex > 10 ||
    ![1, 2].includes(waveIndex)
  ) {
    throw new Error(
      "Batch plan/run/authorization, restricted shell, --batch-index 1..10, and --wave-index 1|2 are required",
    )
  }
  return {
    profile,
    domain: values.get("domain") ?? "sales",
    task: values.get("task") ?? "sales.multi_hop_lookup",
    model: values.get("model") ?? DEFAULT_MODEL,
    python: path.resolve(python),
    sourceData: path.resolve(sourceData),
    output: path.resolve(output),
    inactivityMs: Math.floor(inactivityMs),
    caseSet: path.resolve(values.get("case-set") ?? path.join(SCRIPT_DIRECTORY, "automationbench-case-set.json")),
    repetition,
    batchPlan: path.resolve(batchPlan),
    batchRunID,
    batchIndex,
    waveIndex,
    priorWaveCompletion: values.get("prior-wave-completion")
      ? path.resolve(values.get("prior-wave-completion")!)
      : undefined,
    batchAuthorization: path.resolve(batchAuthorization),
    restrictedShell: path.resolve(restrictedShell),
  }
}

async function loadBatchAuthority(input: Arguments, frozenCase: FrozenCase) {
  const bytes = await fs.readFile(input.batchPlan)
  const planSHA256 = crypto.createHash("sha256").update(bytes).digest("hex")
  const authorization = JSON.parse(await fs.readFile(input.batchAuthorization, "utf8")) as {
    batch_run_id: string
    batch_index: number
    output_root: string
    batch_plan: string
    batch_plan_sha256: string
    coordinator_pid: number
  }
  const plan = JSON.parse(bytes.toString("utf8")) as {
    batch_run_id: string
    batch_index: number
    model: string
    profiles: string[]
    trial_concurrency: number
    cases: FrozenCase[]
    waves: Array<Array<{ case_index: number; profile: Profile }>>
  }
  const authorizedCase = plan.cases?.some(
    (item) => item.case_index === frozenCase.case_index && item.domain === frozenCase.domain && item.task === frozenCase.task,
  )
  const authorizedWave = plan.waves?.[input.waveIndex - 1]
  const authorizedSlot = authorizedWave?.some(
    (item) => item.case_index === frozenCase.case_index && item.profile === input.profile,
  )
  if (
    authorization.batch_run_id !== input.batchRunID ||
    authorization.batch_index !== input.batchIndex ||
    path.resolve(authorization.output_root) !== input.output ||
    path.resolve(authorization.batch_plan) !== input.batchPlan ||
    authorization.batch_plan_sha256 !== planSHA256 ||
    !processIsAlive(authorization.coordinator_pid) ||
    plan.batch_run_id !== input.batchRunID ||
    plan.batch_index !== input.batchIndex ||
    frozenCase.batch_index !== input.batchIndex ||
    plan.model !== input.model ||
    plan.trial_concurrency !== 5 ||
    plan.cases?.length !== 5 ||
    plan.waves?.length !== 2 ||
    authorizedWave?.length !== 5 ||
    !plan.profiles?.includes(input.profile) ||
    !authorizedCase ||
    !authorizedSlot
  ) {
    throw new Error("Trial is not authorized by the exact frozen batch plan")
  }
  if (input.waveIndex === 2) {
    if (!input.priorWaveCompletion) throw new Error("Second-wave trial requires the sealed first-wave completion receipt")
    const completion = JSON.parse(await fs.readFile(input.priorWaveCompletion, "utf8")) as {
      batch_run_id: string
      batch_index: number
      status: string
      eligible_slots: Array<{ case_index: number; profile: Profile }>
    }
    const expected = JSON.stringify(
      plan.waves[0]!.map((item) => `${item.case_index}:${item.profile}`).sort(),
    )
    if (
      completion.batch_run_id !== input.batchRunID ||
      completion.batch_index !== input.batchIndex ||
      completion.status !== "wave_1_complete" ||
      JSON.stringify(completion.eligible_slots.map((item) => `${item.case_index}:${item.profile}`).sort()) !== expected
    ) {
      throw new Error("Second-wave prior completion receipt is invalid")
    }
  }
  return { sha256: planSHA256 }
}

async function loadFrozenCase(input: Arguments) {
  const raw = await fs.readFile(input.caseSet)
  const manifest = JSON.parse(raw.toString("utf8")) as {
    distribution_version: string
    source_revision: string
    package_tree_sha256: string
    selection: { count: number; dataset_index_sha256: string }
    cases: FrozenCase[]
  }
  if (
    manifest.distribution_version !== AUTOMATIONBENCH_VERSION ||
    manifest.source_revision !== AUTOMATIONBENCH_SOURCE_REVISION ||
    manifest.package_tree_sha256 !== AUTOMATIONBENCH_PACKAGE_TREE_SHA256 ||
    manifest.selection?.count !== 50 ||
    manifest.cases?.length !== 50
  ) {
    throw new Error("Frozen AutomationBench case-set identity does not match the round-one contract")
  }
  const matches = manifest.cases.filter((item) => item.domain === input.domain && item.task === input.task)
  if (matches.length !== 1) throw new Error(`Case ${input.domain}:${input.task} is not uniquely frozen in the round-one set`)
  return {
    case: matches[0]!,
    manifest_sha256: crypto.createHash("sha256").update(raw).digest("hex"),
    manifest_canonical_sha256: crypto.createHash("sha256").update(JSON.stringify(manifest)).digest("hex"),
    dataset_index_sha256: manifest.selection.dataset_index_sha256,
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
  const protectedSecrets = sourceAuthSecretLeaves(auth)
  if (protectedSecrets.length === 0) throw new Error("Source auth.json did not contain a recognized non-empty credential leaf")
  return { authPath, modelsPath, providerID, modelID, protectedSecrets }
}

async function sourceEvidence() {
  const commit = Bun.spawnSync(["git", "rev-parse", "HEAD"], { cwd: process.cwd() }).stdout.toString().trim()
  const status = Bun.spawnSync(["git", "status", "--short"], { cwd: process.cwd() }).stdout.toString().trim()
  const bundleFiles = [
    "automationbench-api.SKILL.md",
    "automationbench_bridge.py",
    "automationbench_tool.py",
    "automationbench-case-set.json",
    "freeze_automationbench_case_set.py",
    "restricted-agent-shell.sh",
    "verify_automationbench_replay.py",
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

function processIsAlive(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function updateActiveLeases(
  outputRoot: string,
  update: (active: ActiveLease[]) => { active: ActiveLease[]; acquired?: boolean },
) {
  await fs.mkdir(outputRoot, { recursive: true })
  const statePath = path.join(outputRoot, ".automationbench-active-leases.json")
  await fs.open(statePath, "a").then((handle) => handle.close())
  const release = await lockfile.lock(statePath, {
    realpath: false,
    stale: 60_000,
    retries: { retries: 50, factor: 1.2, minTimeout: 20, maxTimeout: 500 },
  })
  try {
    const parsed = JSON.parse((await fs.readFile(statePath, "utf8")) || '{"active":[]}') as { active?: ActiveLease[] }
    const live = (parsed.active ?? []).filter((lease) => processIsAlive(lease.pid))
    const next = update(live)
    await fs.writeFile(statePath, JSON.stringify({ schema_version: 1, active: next.active }, null, 2) + "\n", "utf8")
    return next
  } finally {
    await release()
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

async function startAutomationBenchBridge(
  input: Arguments,
  frozenCase: FrozenCase,
  eventsPath: string,
  initialWorldPath: string,
  finalWorldPath: string,
  toolSocketPath: string,
  agentUID: number,
  signal: AbortSignal,
) {
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
      "--initial-world",
      initialWorldPath,
      "--final-world",
      finalWorldPath,
      "--tool-socket",
      toolSocketPath,
      "--agent-uid",
      String(agentUID),
    ],
    { stdin: "pipe", stdout: "pipe", stderr: "pipe" },
  )
  try {
    process.stdin.write(`${adminToken}\n`)
    process.stdin.end()
    const reader = process.stdout.getReader()
    const decoder = new TextDecoder()
    let pending = ""
    let ready: Record<string, any> | undefined
    while (!ready) {
      const next = await Promise.race([
        reader.read(),
        new Promise<never>((_resolve, reject) => {
          if (signal.aborted) reject(signal.reason)
          else signal.addEventListener("abort", () => reject(signal.reason), { once: true })
        }),
        Bun.sleep(input.inactivityMs).then(() => {
          throw new Error(`AutomationBench bridge ready exceeded ${input.inactivityMs}ms`)
        }),
      ])
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
    if (
      ready.distribution_version !== AUTOMATIONBENCH_VERSION ||
      ready.package_tree_sha256 !== AUTOMATIONBENCH_PACKAGE_TREE_SHA256 ||
      ready.task_contract_sha256 !== frozenCase.task_contract_sha256 ||
      ready.example_id !== frozenCase.example_id ||
      ready.tool_transport !== "unix_socket_uid_scoped" ||
      ready.agent_uid !== agentUID
    ) {
      throw new Error(
        `AutomationBench identity mismatch: ${JSON.stringify({
          distribution_version: ready.distribution_version,
          package_tree_sha256: ready.package_tree_sha256,
          task_contract_sha256: ready.task_contract_sha256,
        })}`,
      )
    }
    const adminBaseURL = `http://127.0.0.1:${ready.port}`
    const request = async <T>(route: string, token?: string, body?: unknown): Promise<T> => {
      const response = await fetch(adminBaseURL + route, {
        method: body === undefined ? "GET" : "POST",
        headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { "content-type": "application/json" }) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.any([signal, AbortSignal.timeout(input.inactivityMs)]),
      })
      const text = await response.text()
      if (!response.ok) throw new Error(`AutomationBench bridge ${route} failed ${response.status}: ${text}`)
      return JSON.parse(text) as T
    }
    await request("/health")
    return {
      process,
      adminToken,
      adminBaseURL,
      toolSocketPath,
      request,
      identity: {
        distributionVersion: String(ready.distribution_version),
        packageTreeSHA256: String(ready.package_tree_sha256),
        taskContractSchema: String(ready.task_contract_schema),
        taskContractSHA256: String(ready.task_contract_sha256),
        initialWorldSHA256: String(ready.initial_world_sha256),
      },
    }
  } catch (error) {
    process.kill()
    await process.exited
    throw error
  }
}

async function replayAutomationBenchScore(input: {
  arguments: Arguments
  eventsPath: string
  initialWorldPath: string
  finalWorldPath: string
  expected: Record<string, unknown>
}) {
  const process = Bun.spawn(
    [
      input.arguments.python,
      path.join(SCRIPT_DIRECTORY, "verify_automationbench_replay.py"),
      "--domain",
      input.arguments.domain,
      "--task",
      input.arguments.task,
      "--events",
      input.eventsPath,
      "--initial-world",
      input.initialWorldPath,
      "--final-world",
      input.finalWorldPath,
    ],
    { cwd: SCRIPT_DIRECTORY, stdin: "pipe", stdout: "pipe", stderr: "pipe" },
  )
  process.stdin.write(JSON.stringify(input.expected))
  process.stdin.end()
  const [exitCode, stdout, stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ])
  if (exitCode !== 0) throw new Error(`AutomationBench replay verifier failed: ${stderr.trim() || `exit ${exitCode}`}`)
  const audit = JSON.parse(stdout) as Record<string, unknown>
  if (audit.passed !== true) throw new Error("AutomationBench replay verifier did not return passed=true")
  return audit
}

async function verifyAgentShellIsolation(input: {
  projectDirectory: string
  agentUID: number
  agentHome: string
  toolSocketPath: string
  sourceData: string
  evaluatorRoot: string
  isolatedData: string
  bridgePID: number
  restrictedShell: string
  evidenceRoot: string
  controlRoot: string
}) {
  if (process.platform !== "linux" || process.getuid?.() !== 0) {
    throw new Error("Formal AutomationBench runs require the Linux root-owned evaluator harness with a demoted Agent shell")
  }
  const shell = input.restrictedShell
  const [wrapperBytes, expectedWrapperBytes, wrapperStat] = await Promise.all([
    fs.readFile(shell),
    fs.readFile(path.join(SCRIPT_DIRECTORY, "restricted-agent-shell.sh")),
    fs.stat(shell),
  ])
  const wrapperSHA256 = crypto.createHash("sha256").update(wrapperBytes).digest("hex")
  const expectedWrapperSHA256 = crypto.createHash("sha256").update(expectedWrapperBytes).digest("hex")
  if (
    wrapperSHA256 !== expectedWrapperSHA256 ||
    wrapperStat.uid !== 0 ||
    (wrapperStat.mode & 0o022) !== 0 ||
    !wrapperStat.isFile()
  ) {
    throw new Error("Restricted Agent shell does not match the frozen root-owned non-writable wrapper")
  }
  const probe = path.join(input.projectDirectory, `.agent-shell-write-probe-${crypto.randomUUID()}`)
  const shellQuote = (value: string) => `'${value.replaceAll("'", `'"'"'`)}'`
  const script = [
    `BENCH_SOURCE_DATA=${shellQuote(input.sourceData)}`,
    `BENCH_EVALUATOR_ROOT=${shellQuote(input.evaluatorRoot)}`,
    `BENCH_ISOLATED_DATA=${shellQuote(input.isolatedData)}`,
    `BENCH_BRIDGE_PROC=${shellQuote(`/proc/${input.bridgePID}`)}`,
    `BENCH_EVIDENCE_ROOT=${shellQuote(input.evidenceRoot)}`,
    `BENCH_CONTROL_ROOT=${shellQuote(input.controlRoot)}`,
    `BENCH_PROJECT_PROBE=${shellQuote(probe)}`,
    `BENCH_AGENT_HOME=${shellQuote(input.agentHome)}`,
    `BENCH_TOOL_SOCKET=${shellQuote(input.toolSocketPath)}`,
    'uid="$(id -u)"',
    'auth="$(test ! -x "$BENCH_SOURCE_DATA" && printf blocked || printf readable)"',
    'evaluator="$(test ! -x "$BENCH_EVALUATOR_ROOT" && printf blocked || printf readable)"',
    'runtime="$(test ! -x "$BENCH_ISOLATED_DATA" && printf blocked || printf readable)"',
    'bridge="$(test ! -r "$BENCH_BRIDGE_PROC/environ" && test ! -r "$BENCH_BRIDGE_PROC/mem" && test ! -r "$BENCH_BRIDGE_PROC/fd/0" && printf blocked || printf readable)"',
    'evidence="$(test ! -x "$BENCH_EVIDENCE_ROOT" && printf blocked || printf readable)"',
    'control="$(test ! -x "$BENCH_CONTROL_ROOT" && printf blocked || printf readable)"',
    'mounts="$(test ! -e /mnt/c/Windows && ! mountpoint -q /mnt/c && ! mountpoint -q /mnt/d && printf blocked || printf readable)"',
    'project="$(touch "$BENCH_PROJECT_PROBE" 2>/dev/null && printf writable || printf blocked)"',
    'home="$(test "$HOME" = "$BENCH_AGENT_HOME" && test -w "$HOME" && printf private || printf invalid)"',
    'socket="$(test -S "$BENCH_TOOL_SOCKET" && test -r "$BENCH_TOOL_SOCKET" && test -w "$BENCH_TOOL_SOCKET" && printf scoped || printf blocked)"',
    'printf \'{"uid":%s,"auth":"%s","evaluator":"%s","runtime":"%s","bridge":"%s","evidence":"%s","control":"%s","mounts":"%s","project":"%s","home":"%s","socket":"%s"}\\n\' "$uid" "$auth" "$evaluator" "$runtime" "$bridge" "$evidence" "$control" "$mounts" "$project" "$home" "$socket"',
  ].join("\n")
  const child = Bun.spawn([shell, "-lc", script], {
    cwd: input.projectDirectory,
    env: {
      PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
      OPENCORVUS_BENCH_AGENT_UID: String(input.agentUID),
      OPENCORVUS_BENCH_AGENT_HOME: input.agentHome,
    },
    stdout: "pipe",
    stderr: "pipe",
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  await fs.rm(probe, { force: true })
  if (exitCode !== 0) throw new Error(`Restricted Agent shell probe failed: ${stderr.trim() || `exit ${exitCode}`}`)
  const audit = JSON.parse(stdout) as Record<string, unknown>
  const passed =
    audit.uid === input.agentUID &&
    audit.auth === "blocked" &&
    audit.evaluator === "blocked" &&
    audit.runtime === "blocked" &&
    audit.bridge === "blocked" &&
    audit.evidence === "blocked" &&
    audit.control === "blocked" &&
    audit.mounts === "blocked" &&
    audit.project === "writable" &&
    audit.home === "private" &&
    audit.socket === "scoped"
  if (!passed) throw new Error(`Restricted Agent shell isolation probe failed: ${JSON.stringify(audit)}`)
  return {
    schema_version: 1,
    passed: true,
    boundary: "linux_mount_namespace_unique_uid_unix_socket",
    wrapper_sha256: wrapperSHA256,
    ...audit,
  }
}

async function chownAgentTree(target: string, uid: number) {
  const stat = await fs.lstat(target)
  if (stat.isSymbolicLink()) throw new Error("Agent project seed must not contain symbolic links")
  await fs.chown(target, uid, uid)
  if (stat.isDirectory()) {
    await fs.chmod(target, 0o700)
    for (const entry of await fs.readdir(target)) await chownAgentTree(path.join(target, entry), uid)
  } else {
    await fs.chmod(target, 0o600)
  }
}

async function seedProject(input: { projectDirectory: string; socketPath: string }) {
  const skillDirectory = path.join(input.projectDirectory, ".opencorvus", "skill", "automationbench-api")
  await fs.mkdir(skillDirectory, { recursive: true })
  await Promise.all([
    fs.copyFile(path.join(SCRIPT_DIRECTORY, "automationbench_tool.py"), path.join(input.projectDirectory, "automationbench_tool.py")),
    fs.copyFile(path.join(SCRIPT_DIRECTORY, "automationbench-api.SKILL.md"), path.join(skillDirectory, "SKILL.md")),
    fs.writeFile(
      path.join(input.projectDirectory, ".automationbench-tool.json"),
      JSON.stringify(automationBenchToolConfig(input.socketPath)) + "\n",
      "utf8",
    ),
    fs.writeFile(
      path.join(input.projectDirectory, "README.md"),
      "# AutomationBench trial workspace\n\nUse the explicitly requested `automationbench-api` Skill and project-local tool client.\n",
      "utf8",
    ),
  ])
}

function ledgerRows(databasePath: string): ProviderUsageRow[] {
  const db = new SQLite(databasePath, { readonly: true })
  try {
    return db
      .query<ProviderUsageRow, []>(
        `SELECT id, occurred_at, provider_id, model_id, purpose,
                input_tokens, output_tokens, reasoning_tokens,
                cache_read_tokens, cache_write_tokens, total_tokens,
                cost_usd, billing_status
         FROM provider_usage_event
         WHERE purpose <> 'provider-connectivity'
         ORDER BY occurred_at ASC, id ASC`,
      )
      .all()
  } finally {
    db.close()
  }
}

const arguments_ = parseArguments(process.argv.slice(2))
const runID = crypto.randomUUID()
const startedAt = Date.now()
const runKey = benchmarkRunKey(startedAt, runID)
const caseID = `${arguments_.domain}:${arguments_.task}`
const outputDirectory = path.join(
  arguments_.output,
  `${arguments_.domain}-${arguments_.task.replaceAll(".", "-")}-${arguments_.profile}`,
  runKey,
)
await fs.mkdir(outputDirectory, { recursive: true })
const bridgeEventsPath = path.join(outputDirectory, "automationbench-events.jsonl")
const initialWorldPath = path.join(outputDirectory, "automationbench-initial-world.json")
const finalWorldPath = path.join(outputDirectory, "automationbench-final-world.json")
const toolSocketDirectory = path.join("/run/opencorvus-automationbench", runID)
const toolSocketPath = path.join(toolSocketDirectory, "tool.sock")
let source: Awaited<ReturnType<typeof verifySourceProjection>> | undefined
let frozenCaseInfo: Awaited<ReturnType<typeof loadFrozenCase>> | undefined
let batchAuthority: Awaited<ReturnType<typeof loadBatchAuthority>> | undefined
let runSource: Awaited<ReturnType<typeof sourceEvidence>> | undefined
let bridge: Awaited<ReturnType<typeof startAutomationBenchBridge>> | undefined
let isolatedRuntime: Awaited<ReturnType<typeof bootstrapIsolatedTestRuntime>> | undefined
let isolatedData = ""
let projectDirectory = ""
let backend: { url: URL; stop(closeActiveConnections?: boolean): Promise<void> } | undefined
let waitForIngressDeliveryHooks: (() => Promise<void>) | undefined
let closeDatabase: (() => void) | undefined
let runtimeLogPath = ""
let flushRuntimeLog: (() => Promise<void>) | undefined
let taskID: string | undefined
let stage = "source_preflight"
let agentUID: number | undefined
let leaseAcquired = false
let terminationSignal: "SIGINT" | "SIGTERM" | undefined
const terminationAbort = new AbortController()
const requestTermination = (signal: "SIGINT" | "SIGTERM") => {
  terminationSignal = signal
  terminationAbort.abort(new Error(`Benchmark runner received ${signal}`))
  bridge?.process.kill("SIGTERM")
}
const onSIGINT = () => requestTermination("SIGINT")
const onSIGTERM = () => requestTermination("SIGTERM")
process.once("SIGINT", onSIGINT)
process.once("SIGTERM", onSIGTERM)

function throwIfTerminationRequested() {
  if (terminationSignal) throw new Error(`Benchmark runner received ${terminationSignal}`)
}

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
  const response = await fetch(url, {
    ...init,
    headers,
    timeout: false,
    signal: AbortSignal.any([terminationAbort.signal, AbortSignal.timeout(arguments_.inactivityMs)]),
  } as BunFetchRequestInit)
  const body = await response.text()
  if (!response.ok) throw new Error(`${init.method ?? "GET"} ${url.pathname} failed ${response.status}: ${body}`)
  return body ? (JSON.parse(body) as T) : (undefined as T)
}

async function discoverTaskID(input: {
  title: string
  creation: Promise<{ ok: true; value: { task_id: string } } | { ok: false; error: unknown }>
}) {
  while (true) {
    throwIfTerminationRequested()
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
    throwIfTerminationRequested()
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
  stage = "run_start"
  await fs.writeFile(
    path.join(outputDirectory, "run-start.json"),
    JSON.stringify(
      {
        schema_version: EXTERNAL_BENCHMARK_SCHEMA_VERSION,
        run: { id: runID, key: runKey, started_at: startedAt, status: "started" },
        benchmark: {
          name: "automationbench",
          version: AUTOMATIONBENCH_VERSION,
          domain: arguments_.domain,
          task: arguments_.task,
          case_id: caseID,
          repetition: arguments_.repetition,
          batch_run_id: arguments_.batchRunID,
          batch_index: arguments_.batchIndex,
          wave_index: arguments_.waveIndex,
        },
        opencorvus: { profile: arguments_.profile, model: arguments_.model },
        process: { pid: process.pid },
      },
      null,
      2,
    ) + "\n",
    { encoding: "utf8", flag: "wx" },
  )
  if (process.platform !== "linux" || process.getuid?.() !== 0) {
    throw new Error("Formal AutomationBench runs require the WSL2 Linux root-owned Host boundary")
  }
  stage = "protected_root_isolation"
  const protectedRoots = [arguments_.output, path.dirname(arguments_.batchAuthorization)]
  const protectedRootFacts = await Promise.all(
    protectedRoots.map(async (target) => {
      const [lstat, realpath, stat] = await Promise.all([fs.lstat(target), fs.realpath(target), fs.stat(target)])
      return {
        path: target,
        realpath,
        uid: stat.uid,
        mode: (stat.mode & 0o777).toString(8).padStart(3, "0"),
        passed: lstat.isDirectory() && realpath === target && stat.uid === 0 && (stat.mode & 0o777) === 0o700,
      }
    }),
  )
  if (protectedRootFacts.some((item) => !item.passed)) {
    throw new Error(`Benchmark protected root audit failed: ${JSON.stringify(protectedRootFacts)}`)
  }
  const protectedRootAudit = {
    schema_version: 1,
    passed: true,
    evidence: protectedRootFacts[0],
    control: protectedRootFacts[1],
  }
  throwIfTerminationRequested()
  stage = "case_set_preflight"
  frozenCaseInfo = await loadFrozenCase(arguments_)
  stage = "batch_authority_preflight"
  batchAuthority = await loadBatchAuthority(arguments_, frozenCaseInfo.case)
  stage = "trial_lease"
  const lease = await updateActiveLeases(arguments_.output, (active) => {
    const wrongBatch = active.some(
      (item) =>
        item.batch_run_id !== arguments_.batchRunID ||
        item.batch_index !== arguments_.batchIndex ||
        item.batch_plan_sha256 !== batchAuthority!.sha256,
    )
    if (active.length >= 5 || wrongBatch || active.some((item) => item.case_id === caseID)) {
      return { active, acquired: false }
    }
    return {
      active: [
        ...active,
        {
          run_id: runID,
          pid: process.pid,
          case_id: caseID,
          profile: arguments_.profile,
          started_at: startedAt,
          batch_run_id: arguments_.batchRunID,
          batch_index: arguments_.batchIndex,
          batch_plan_sha256: batchAuthority!.sha256,
        },
      ],
      acquired: true,
    }
  })
  if (!lease.acquired) {
    throw new Error("AutomationBench trial lease rejected: at most five distinct cases may run and paired profiles may not overlap")
  }
  leaseAcquired = true
  throwIfTerminationRequested()
  agentUID = 60_000 + frozenCaseInfo.case.case_index
  await fs.mkdir("/run/opencorvus-automationbench", { recursive: true, mode: 0o711 })
  await fs.chmod("/run/opencorvus-automationbench", 0o711)
  await fs.mkdir(toolSocketDirectory, { mode: 0o700 })
  await fs.chown(toolSocketDirectory, agentUID, agentUID)
  stage = "source_preflight"
  source = await verifySourceProjection(arguments_)
  runSource = await sourceEvidence()
  stage = "bridge_start"
  bridge = await startAutomationBenchBridge(
    arguments_,
    frozenCaseInfo.case,
    bridgeEventsPath,
    initialWorldPath,
    finalWorldPath,
    toolSocketPath,
    agentUID,
    terminationAbort.signal,
  )
  stage = "runtime_bootstrap"
  isolatedRuntime = await bootstrapIsolatedTestRuntime("runner")
  applyIsolatedTestUserEnvironment(isolatedRuntime)
  const testProcessSupervisor = prepareTestProcessSupervisor()
  if (testProcessSupervisor) process.env.OPENCORVUS_PROCESS_SUPERVISOR = testProcessSupervisor
  const isolatedHome = path.join(isolatedRuntime.processRoot, "opencorvus-home")
  process.env.OPENCORVUS_HOME = isolatedHome
  isolatedData = path.join(isolatedHome, "data")
  await fs.mkdir(isolatedData, { recursive: true })
  await Promise.all([
    fs.copyFile(source.authPath, path.join(isolatedData, "auth.json")),
    fs.copyFile(source.modelsPath, path.join(isolatedData, "models.json")),
  ])
  await Promise.all([
    fs.chmod(isolatedData, 0o700),
    fs.chmod(path.join(isolatedData, "auth.json"), 0o600),
    fs.chmod(path.join(isolatedData, "models.json"), 0o600),
  ])
  projectDirectory = path.join(isolatedRuntime.processRoot, "project")
  await fs.mkdir(projectDirectory, { recursive: true })
  await seedProject({ projectDirectory, socketPath: bridge.toolSocketPath })
  const agentHome = `/tmp/opencorvus-benchmark-agent-${runID}`
  await fs.mkdir(agentHome, { mode: 0o700 })
  await Promise.all([
    fs.chmod(isolatedRuntime.ownerRoot, 0o711),
    fs.chmod(isolatedRuntime.processRoot, 0o711),
  ])
  await chownAgentTree(projectDirectory, agentUID)
  process.env.GIT_CONFIG_COUNT = "1"
  process.env.GIT_CONFIG_KEY_0 = "safe.directory"
  process.env.GIT_CONFIG_VALUE_0 = projectDirectory
  process.env.OPENCORVUS_BENCH_AGENT_UID = String(agentUID)
  process.env.OPENCORVUS_BENCH_AGENT_HOME = agentHome
  process.env.SHELL = arguments_.restrictedShell
  stage = "agent_shell_isolation"
  const sandboxAudit = await verifyAgentShellIsolation({
    projectDirectory,
    agentUID,
    agentHome,
    toolSocketPath,
    sourceData: arguments_.sourceData,
    evaluatorRoot: path.dirname(path.dirname(arguments_.python)),
    isolatedData,
    bridgePID: bridge.process.pid,
    restrictedShell: arguments_.restrictedShell,
    evidenceRoot: arguments_.output,
    controlRoot: path.dirname(arguments_.batchAuthorization),
  })
  stage = "runtime_imports"
  const { Database } = await import("@/storage/db")
  closeDatabase = () => Database.close()
  const ingress = await import("@/engine/task-root-ingress-delivery")
  waitForIngressDeliveryHooks = ingress.waitForIngressDeliveryHooksForTest
  const { Log } = await import("@/util/log")
  const { Global } = await import("@/global")
  const { Server } = await import("@/server/server")
  const { declareNativeTaskProcessDeployment } = await import("@/runtime/task-process-deployment")
  await Log.init({ print: false })
  runtimeLogPath = Log.file()
  flushRuntimeLog = Log.flush
  const engineGitHome = path.join(Global.Path.cache, "engine-git-runtime", "home")
  await fs.mkdir(engineGitHome, { recursive: true, mode: 0o700 })
  await fs.writeFile(path.join(engineGitHome, ".gitconfig"), `[safe]\n\tdirectory = ${projectDirectory}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  })
  declareNativeTaskProcessDeployment()
  stage = "runtime_start"
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
  const benchmarkTask = await bridge.request<{
    prompt: unknown
    example_id: string | number
    distribution_version: string
    package_tree_sha256: string
    task_contract_schema: string
    task_contract_sha256: string
    initial_world_sha256: string
  }>("/admin/task", bridge.adminToken)
  if (
    benchmarkTask.distribution_version !== bridge.identity.distributionVersion ||
    benchmarkTask.package_tree_sha256 !== bridge.identity.packageTreeSHA256 ||
    benchmarkTask.task_contract_sha256 !== bridge.identity.taskContractSHA256 ||
    benchmarkTask.initial_world_sha256 !== bridge.identity.initialWorldSHA256 ||
    benchmarkTask.example_id !== frozenCaseInfo.case.example_id
  ) {
    throw new Error("AutomationBench admin task identity did not match the ready identity")
  }
  stage = "task_create"
  const taskTitle = `AutomationBench ${arguments_.task} (${arguments_.profile}) · ${crypto.randomUUID()}`
  const requestID = crypto.randomUUID()
  const harnessRequest = automationBenchHarnessRequest(benchmarkTask.prompt)
  const taskCreateInput = {
    title: taskTitle,
    request: harnessRequest,
    requestID,
    source: "external-automationbench-pilot",
    productPillar: "work",
    model: arguments_.model,
    promptProfile: arguments_.profile,
  }
  const creation = requestJSON<{ task_id: string }>("/task?init-git=true", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(taskCreateInput),
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
    final_world_sha256: string
    tool_calls: number
    tool_attempts: number
    tool_succeeded: number
    tool_failed: number
    max_in_flight_stateless: number
  }>("/admin/score", bridge.adminToken, {})
  stage = "benchmark_evidence_reconciliation"
  const benchmarkEvents = await readJSONLines(bridgeEventsPath)
  const benchmarkToolAudit = summarizeBenchmarkToolEvents(benchmarkEvents)
  if (
    !benchmarkToolAudit.sequenceValid ||
    benchmarkToolAudit.scoreEvents !== 1 ||
    benchmarkToolAudit.attempts !== score.tool_attempts ||
    benchmarkToolAudit.succeeded !== score.tool_succeeded ||
    benchmarkToolAudit.failed !== score.tool_failed ||
    score.tool_calls !== score.tool_attempts
  ) {
    throw new Error("AutomationBench scorer counters did not reconcile with the raw event ledger")
  }
  stage = "benchmark_scorer_replay"
  const scorerReplayAudit = await replayAutomationBenchScore({
    arguments: arguments_,
    eventsPath: bridgeEventsPath,
    initialWorldPath,
    finalWorldPath,
    expected: { ...score, initial_world_sha256: bridge.identity.initialWorldSHA256 },
  })
  const transcriptTokens = summarizeTranscriptUsage(terminal.transcript)
  const providerUsageLedger = ledgerRows(path.join(isolatedData, "opencorvus.db"))
  const tokens = summarizeProviderUsageRows(providerUsageLedger)
  const trajectory = normalizeTrajectory({
    transcript: terminal.transcript,
    trace: terminal.trace,
    benchmarkEvents,
  })
  const finishedAt = Date.now()
  const lifecycleStatus = String(terminal.board.task?.status ?? "")
  const boundProfile = String(terminal.board.task?.packageRevisionBinding?.id ?? "")
  const profileAudit = {
    passed: boundProfile === arguments_.profile,
    requested_profile: arguments_.profile,
    bound_profile: boundProfile || null,
    package_revision: terminal.board.task?.packageRevisionBinding ?? null,
  }
  const workflowBinding = terminal.board.task?.completionDecision?.workflowBinding ?? null
  const selectedWorkflowID = workflowBinding?.kind === "virtual_workflow" ? workflowBinding.workflow_id : null
  const isolationAudit = auditBenchmarkIsolation(terminal.transcript, {
    protectedPaths: [
      path.dirname(path.dirname(arguments_.python)),
      path.join(SCRIPT_DIRECTORY, "automationbench_bridge.py"),
      arguments_.sourceData,
      source.authPath,
      source.modelsPath,
      isolatedData,
      path.join(isolatedData, "auth.json"),
      path.join(isolatedData, "models.json"),
    ],
    forbiddenMarkers: [
      "/admin/task",
      "/admin/score",
      "task_contract_sha256",
      "automationbench.rubric",
      "task_completed_correctly",
      "assertion_results",
    ],
    protectedSecrets: source.protectedSecrets,
  })
  const valid = lifecycleStatus === "completed" && profileAudit.passed && isolationAudit.passed
  const invalidReason =
    lifecycleStatus !== "completed"
      ? `OpenCorvus Task lifecycle settled ${lifecycleStatus}`
      : !profileAudit.passed
        ? "OpenCorvus Task bound a different Expert Squad profile"
        : !isolationAudit.passed
          ? "OpenCorvus transcript touched protected benchmark evaluator state"
          : null
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
      distribution_version: bridge.identity.distributionVersion,
      package_tree_sha256: bridge.identity.packageTreeSHA256,
      task_contract_schema: bridge.identity.taskContractSchema,
      task_contract_sha256: bridge.identity.taskContractSHA256,
      harness_request_sha256: crypto.createHash("sha256").update(harnessRequest).digest("hex"),
      prompt_mapping: "remove_stock_single_model_turn_budget_v1",
      split: "public",
      domain: arguments_.domain,
      task: arguments_.task,
      example_id: benchmarkTask.example_id,
      case_index: frozenCaseInfo.case.case_index,
      batch_index: frozenCaseInfo.case.batch_index,
      batch_run_id: arguments_.batchRunID,
      batch_plan_sha256: batchAuthority.sha256,
      wave_index: arguments_.waveIndex,
      repetition: arguments_.repetition,
      case_set_manifest_sha256: frozenCaseInfo.manifest_sha256,
      case_set_canonical_sha256: frozenCaseInfo.manifest_canonical_sha256,
      dataset_index_sha256: frozenCaseInfo.dataset_index_sha256,
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
      initial_world_sha256: bridge.identity.initialWorldSHA256,
      final_world_sha256: score.final_world_sha256,
      tool_calls: score.tool_calls,
      tool_attempts: score.tool_attempts,
      tool_succeeded: score.tool_succeeded,
      tool_failed: score.tool_failed,
      max_in_flight_stateless: score.max_in_flight_stateless,
      tool_event_audit: benchmarkToolAudit,
      scorer_replay_audit: { passed: true, file: "scorer-replay-audit.json" },
    },
    opencorvus: {
      commit: runSource.commit,
      source: runSource,
      task_id: taskID,
      lifecycle_status: lifecycleStatus,
      profile: arguments_.profile,
      model: arguments_.model,
      skill: { name: "automationbench-api", enabled: true, revision: 1 },
      selected_workflow_id: selectedWorkflowID,
      workflow_binding: workflowBinding,
      profile_audit: profileAudit,
      isolation_audit: isolationAudit,
      sandbox_isolation_audit: sandboxAudit,
      protected_root_isolation_audit: protectedRootAudit,
      agent_isolation_uid: agentUID,
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
        ? "One frozen public case under the paired 50-case OpenCorvus matrix; official AutomationBench uses a held-out private set."
        : `${invalidReason}; rubric values are diagnostic only.`,
    },
  }
  const resultPath = path.join(outputDirectory, "result.json")
  const tracePath = path.join(outputDirectory, "opencorvus-trace.json")
  const transcriptPath = path.join(outputDirectory, "opencorvus-transcript.json")
  const boardPath = path.join(outputDirectory, "terminal-board.json")
  const taskReceiptPath = path.join(outputDirectory, "task-receipt.json")
  const providerLedgerPath = path.join(outputDirectory, "provider-usage-ledger.json")
  const scorerReplayPath = path.join(outputDirectory, "scorer-replay-audit.json")
  const sandboxAuditPath = path.join(outputDirectory, "sandbox-isolation-audit.json")
  const protectedRootAuditPath = path.join(outputDirectory, "protected-root-isolation-audit.json")
  const trajectoryPath = path.join(outputDirectory, "trajectory.json")
  const svgPath = path.join(outputDirectory, "trajectory.svg")
  await Promise.all([
    fs.writeFile(resultPath, JSON.stringify(result, null, 2) + "\n", "utf8"),
    fs.writeFile(tracePath, JSON.stringify(terminal.trace, null, 2) + "\n", "utf8"),
    fs.writeFile(transcriptPath, JSON.stringify(terminal.transcript, null, 2) + "\n", "utf8"),
    fs.writeFile(boardPath, JSON.stringify(terminal.board, null, 2) + "\n", "utf8"),
    fs.writeFile(
      taskReceiptPath,
      JSON.stringify(
        {
          schema_version: EXTERNAL_BENCHMARK_SCHEMA_VERSION,
          request: taskCreateInput,
          response: created.value,
          bound_profile: profileAudit,
          workflow_binding: workflowBinding,
        },
        null,
        2,
      ) + "\n",
      "utf8",
    ),
    fs.writeFile(providerLedgerPath, JSON.stringify(providerUsageLedger, null, 2) + "\n", "utf8"),
    fs.writeFile(scorerReplayPath, JSON.stringify(scorerReplayAudit, null, 2) + "\n", "utf8"),
    fs.writeFile(sandboxAuditPath, JSON.stringify(sandboxAudit, null, 2) + "\n", "utf8"),
    fs.writeFile(protectedRootAuditPath, JSON.stringify(protectedRootAudit, null, 2) + "\n", "utf8"),
    fs.writeFile(trajectoryPath, JSON.stringify(trajectory, null, 2) + "\n", "utf8"),
    fs.writeFile(
      svgPath,
      renderTrajectorySVG({
        title: `AutomationBench ${arguments_.task} · ${arguments_.profile}`,
        events: trajectory,
        tokens,
        runDurationMs: finishedAt - startedAt,
        modelCalls: tokens.modelCalls,
        toolCalls: score.tool_calls,
      }),
      "utf8",
    ),
  ])
  stage = "complete"
  process.stdout.write(JSON.stringify({ event: "result", resultPath, svgPath, result }) + "\n")
  if (!valid) process.exitCode = 2
} catch (error) {
  if (runtimeLogPath && source) {
    await flushRuntimeLog?.().catch(() => undefined)
    const rawRuntimeLog = await fs.readFile(runtimeLogPath, "utf8").catch(() => "")
    let redactedRuntimeLog = rawRuntimeLog
    for (const secret of source.protectedSecrets) {
      redactedRuntimeLog = redactedRuntimeLog.replaceAll(secret.value, `[REDACTED:${secret.label}]`)
    }
    redactedRuntimeLog = redactedRuntimeLog
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
      .replace(/\b[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g, "[REDACTED:jwt]")
      .replace(
        /((?:access_token|refresh_token|id_token|api[_-]?key|authorization|token)(?:\\?"|')?\s*[:=]\s*(?:\\?"|')?)[^"'\\\s,}]+/gi,
        "$1[REDACTED]",
      )
    await fs
      .writeFile(path.join(outputDirectory, "opencorvus-runtime.log"), redactedRuntimeLog, { encoding: "utf8", flag: "wx" })
      .catch(() => undefined)
  }
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
      distribution_version: bridge?.identity.distributionVersion ?? null,
      package_tree_sha256: bridge?.identity.packageTreeSHA256 ?? null,
      task_contract_schema: bridge?.identity.taskContractSchema ?? null,
      task_contract_sha256: bridge?.identity.taskContractSHA256 ?? null,
      split: "public",
      domain: arguments_.domain,
      task: arguments_.task,
      case_index: frozenCaseInfo?.case.case_index ?? null,
      batch_index: frozenCaseInfo?.case.batch_index ?? null,
      batch_run_id: arguments_.batchRunID,
      batch_plan_sha256: batchAuthority?.sha256 ?? null,
      wave_index: arguments_.waveIndex,
      repetition: arguments_.repetition,
      case_set_manifest_sha256: frozenCaseInfo?.manifest_sha256 ?? null,
      case_set_canonical_sha256: frozenCaseInfo?.manifest_canonical_sha256 ?? null,
      dataset_index_sha256: frozenCaseInfo?.dataset_index_sha256 ?? null,
    },
    opencorvus: {
      profile: arguments_.profile,
      model: arguments_.model,
      task_id: taskID ?? null,
      source: runSource ?? null,
    },
    error: error instanceof Error ? { name: error.name, message: error.message } : { name: "UnknownError", message: String(error) },
  }
  await fs.writeFile(path.join(outputDirectory, "failure.json"), JSON.stringify(failure, null, 2) + "\n", "utf8")
  process.stdout.write(JSON.stringify({ event: "failure", failure }) + "\n")
  throw error
} finally {
  const failures: unknown[] = []
  if (waitForIngressDeliveryHooks) {
    try {
      await within(waitForIngressDeliveryHooks(), CLEANUP_TIMEOUT_MS, "Ingress cleanup")
    } catch (error) {
      failures.push(error)
    }
  }
  if (backend) {
    try {
      await within(backend.stop(true), CLEANUP_TIMEOUT_MS, "Server cleanup")
    } catch (error) {
      failures.push(error)
    }
  }
  if (closeDatabase) {
    try {
      closeDatabase()
    } catch (error) {
      failures.push(error)
    }
  }
  if (bridge) {
    try {
      bridge.process.kill()
      try {
        await within(bridge.process.exited, CLEANUP_TIMEOUT_MS, "Bridge cleanup")
      } catch {
        bridge.process.kill("SIGKILL")
        await within(bridge.process.exited, CLEANUP_TIMEOUT_MS, "Bridge forced cleanup")
      }
      await fs.rm(bridge.toolSocketPath, { force: true })
    } catch (error) {
      failures.push(error)
    }
  }
  if (process.platform === "linux") {
    try {
      await fs.rm(toolSocketPath, { force: true })
      await fs.rmdir(toolSocketDirectory)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") failures.push(error)
    }
  }
  if (isolatedRuntime) {
    try {
      await removeIsolatedTestRuntime(isolatedRuntime)
    } catch (error) {
      failures.push(error)
    }
  }
  if (process.platform === "linux") {
    const agentHome = `/tmp/opencorvus-benchmark-agent-${runID}`
    try {
      await fs.rmdir(agentHome)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") failures.push(error)
    }
  }
  delete process.env.OPENCORVUS_BENCH_AGENT_UID
  delete process.env.OPENCORVUS_BENCH_AGENT_HOME
  if (leaseAcquired) {
    try {
      await updateActiveLeases(arguments_.output, (active) => ({
        active: active.filter((lease) => lease.run_id !== runID),
      }))
    } catch (error) {
      failures.push(error)
    }
  }
  process.removeListener("SIGINT", onSIGINT)
  process.removeListener("SIGTERM", onSIGTERM)
  if (failures.length > 0) {
    await fs.writeFile(
      path.join(outputDirectory, "cleanup-failure.json"),
      JSON.stringify(
        {
          schema_version: EXTERNAL_BENCHMARK_SCHEMA_VERSION,
          run_id: runID,
          run_key: runKey,
          failures: failures.map((error) =>
            error instanceof Error ? { name: error.name, message: error.message } : { name: "UnknownError", message: String(error) },
          ),
        },
        null,
        2,
      ) + "\n",
      "utf8",
    )
  }
  try {
    await writeEvidenceManifest()
  } catch (error) {
    failures.push(error)
    await fs.writeFile(
      path.join(outputDirectory, "evidence-seal-failure.json"),
      JSON.stringify(
        {
          schema_version: EXTERNAL_BENCHMARK_SCHEMA_VERSION,
          run_id: runID,
          run_key: runKey,
          error: error instanceof Error ? { name: error.name, message: error.message } : { name: "UnknownError", message: String(error) },
        },
        null,
        2,
      ) + "\n",
      "utf8",
    ).catch(() => undefined)
  }
  if (failures.length === 1) throw failures[0]
  if (failures.length > 1) throw new AggregateError(failures, "AutomationBench pilot cleanup failed")
}
