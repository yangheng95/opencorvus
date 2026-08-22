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
  automationBenchRunValidity,
  canonicalTranscriptOrder,
  auditBenchmarkIsolation,
  auditTaskBoundPromptCompositionCoverage,
  auditDispatchedSkillCoverage,
  auditSkillProjection,
  auditMissionOutcome,
  auditMissionQuiescence,
  auditMissionRunBinding,
  normalizeTrajectory,
  renderTrajectorySVG,
  sourceAuthSecretLeaves,
  summarizeBenchmarkToolEvents,
  analyzePromptComposition,
  summarizeTranscriptUsage,
  summarizeProviderUsageRows,
  summarizeProviderUsageByAgent,
  AUTOMATIONBENCH_SKILL_NAME,
  AUTOMATIONBENCH_SKILL_REF,
  automationBenchSkillAgentIDs,
  failureObservationReceipt,
  type ProviderUsageRow,
  type SkillMountMatrix,
} from "./contract"

const SCRIPT_DIRECTORY = import.meta.dir
const AUTOMATIONBENCH_VERSION = "1.0.6"
const AUTOMATIONBENCH_SOURCE_REVISION = "4a8e1061254004d9dac807054eed33fad7d1ff14"
const AUTOMATIONBENCH_PACKAGE_TREE_SHA256 = "cc7a63f9444814c7029e325dacbdf1c2e870430d08aaf8d4ecf5c0e44fe829d4"
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
    if (!key?.startsWith("--") || value === undefined)
      throw new Error(`Expected --name value arguments, got ${argv.join(" ")}`)
    values.set(key.slice(2), value)
  }
  const profile = values.get("profile")
  if (profile !== "base" && profile !== "advanced") throw new Error("--profile must be base or advanced")
  const python = values.get("python") ?? process.env.AUTOMATION_BENCH_PYTHON
  if (!python)
    throw new Error("--python or AUTOMATION_BENCH_PYTHON must name a Python 3.13 AutomationBench environment")
  const sourceData = values.get("source-data") ?? process.env.OPENCORVUS_BENCH_SOURCE_DATA
  if (!sourceData)
    throw new Error("--source-data or OPENCORVUS_BENCH_SOURCE_DATA must name the existing OpenCorvus data directory")
  const output = values.get("output")
  if (!output) throw new Error("--output is required")
  const model = values.get("model")
  if (!model) throw new Error("--model is required")
  const inactivityMs = Number(values.get("inactivity-ms") ?? DEFAULT_INACTIVITY_MS)
  if (!Number.isFinite(inactivityMs) || inactivityMs <= 0)
    throw new Error("--inactivity-ms must be a positive finite number")
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
    model,
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
    launch_mode: string
    batch_run_id: string
    batch_index: number
    model: string
    profiles: string[]
    trial_concurrency: number
    schedule_mode?: string
    cases: FrozenCase[]
    waves: Array<Array<{ case_index: number; profile: Profile }>>
  }
  const authorizedCase = plan.cases?.some(
    (item) =>
      item.case_index === frozenCase.case_index && item.domain === frozenCase.domain && item.task === frozenCase.task,
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
    plan.launch_mode !== "mission" ||
    plan.trial_concurrency !== 5 ||
    plan.cases?.length !== 5 ||
    plan.profiles?.length !== 1 ||
    plan.waves?.length !== plan.profiles.length ||
    plan.waves.some((wave) => wave.length !== 5) ||
    authorizedWave?.length !== 5 ||
    !plan.profiles?.includes(input.profile) ||
    !authorizedCase ||
    !authorizedSlot
  ) {
    throw new Error("Trial is not authorized by the exact frozen batch plan")
  }
  if (input.waveIndex === 2 && plan.schedule_mode !== "rolling_case_slots_v1") {
    if (!input.priorWaveCompletion)
      throw new Error("Second-wave trial requires the sealed first-wave completion receipt")
    const completion = JSON.parse(await fs.readFile(input.priorWaveCompletion, "utf8")) as {
      batch_run_id: string
      batch_index: number
      status: string
      eligible_slots: Array<{ case_index: number; profile: Profile }>
    }
    const expected = JSON.stringify(plan.waves[0]!.map((item) => `${item.case_index}:${item.profile}`).sort())
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
  if (matches.length !== 1)
    throw new Error(`Case ${input.domain}:${input.task} is not uniquely frozen in the round-one set`)
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
  if (!models[providerID]?.models?.[modelID])
    throw new Error(`Source models.json does not project exact model ${input.model}`)
  const protectedSecrets = sourceAuthSecretLeaves(auth)
  if (protectedSecrets.length === 0)
    throw new Error("Source auth.json did not contain a recognized non-empty credential leaf")
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
    if (ready.event !== "ready" || typeof ready.port !== "number")
      throw new Error("AutomationBench bridge returned an invalid ready event")
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
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
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
    throw new Error(
      "Formal AutomationBench runs require the Linux root-owned evaluator harness with a demoted Agent shell",
    )
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
  const skillDirectory = path.join(input.projectDirectory, ".opencorvus", "skill", AUTOMATIONBENCH_SKILL_NAME)
  const skillPath = path.join(skillDirectory, "SKILL.md")
  await fs.mkdir(skillDirectory, { recursive: true })
  const skillBytes = await fs.readFile(path.join(SCRIPT_DIRECTORY, "automationbench-api.SKILL.md"))
  await Promise.all([
    fs.copyFile(
      path.join(SCRIPT_DIRECTORY, "automationbench_tool.py"),
      path.join(input.projectDirectory, "automationbench_tool.py"),
    ),
    fs.writeFile(skillPath, skillBytes),
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
  return {
    location: skillPath,
    sha256: crypto.createHash("sha256").update(skillBytes).digest("hex"),
    bytes: skillBytes.byteLength,
  }
}

/**
 * The isolated runtime — database included — is removed at the end of every trial, so the sealed
 * evidence directory is the only place a later analysis can look. `result.json`, the transcript,
 * and the board answer per-message questions but cannot be joined: reconstructing "which Agent
 * occurrence produced this Artifact, and what did that occurrence cost" needs the relational rows.
 * This exports exactly the identity/relationship tables for that join, and never message or part
 * payloads, which already exist as transcript evidence and would re-import Provider text.
 */
const SNAPSHOT_TABLES = [
  "engine_task",
  "engine_workflow_node_occurrence",
  "engine_artifact",
  "engine_artifact_catalog_revision",
  "session",
  "provider_usage_event",
  "protocol_inbox",
  "protocol_delivery_receipt",
] as const

/**
 * Tables sealed by an explicit column list rather than `SELECT *`.
 *
 * `engine_task_root_ingress` carries `inline_payload`, a free-form JSON body
 * that can hold operator message text. The whole-table snapshot above is safe
 * only because those tables hold identities and counters; adding an ingress
 * table wholesale would quietly falsify that premise, so its body column is
 * named out here instead of being redacted after the fact.
 */
const SNAPSHOT_TABLE_COLUMNS: Record<string, string[]> = {
  engine_task_root_ingress: [
    "id",
    "task_id",
    "execution_epoch",
    "sequence",
    "source",
    "source_id",
    "policy_id",
    "time_accepted",
  ],
  engine_task_root_ingress_policy: ["id", "semantic_turn_limit", "activation_limit", "absolute_deadline"],
  engine_control_activation_lease: [
    "id",
    "target",
    "target_id",
    "owner_occurrence_id",
    "time_activated",
    "expires_at",
  ],
}

/**
 * Message and Part evidence, projected rather than copied.
 *
 * Turn counts, decision facts and per-Artifact read counts all need these two
 * tables, and neither can be answered from the transcript alone. Copying them
 * would put a second full copy of every prompt, tool input and tool output into
 * sealed evidence, inflate the snapshot, widen the credential surface, and give
 * the run two sources of truth for the same text. Identity, shape, timing,
 * relationships, length and digest answer every counting question; the bodies
 * stay in the transcript, which is already sealed and already audited.
 */
function messageEvidenceProjection(db: SQLite) {
  const sha = (value: unknown) =>
    typeof value === "string" ? crypto.createHash("sha256").update(value).digest("hex").slice(0, 16) : null
  const messages = db
    .query<Record<string, any>, []>(
      `SELECT id, session_id, time_created, time_updated,
              json_extract(data, '$.role')         AS role,
              json_extract(data, '$.agent')        AS agent,
              json_extract(data, '$.author')       AS author,
              json_extract(data, '$.parentID')     AS parent_id,
              json_extract(data, '$.activationID') AS activation_id,
              json_extract(data, '$.modelID')      AS model_id,
              json_extract(data, '$.providerID')   AS provider_id,
              json_extract(data, '$.finish')       AS finish,
              json_extract(data, '$.error.name')   AS error_name,
              json_extract(data, '$.time.completed') AS time_completed,
              length(data) AS data_length,
              data AS _body
         FROM message`,
    )
    .all()
    .map(({ _body, ...row }) => ({ ...row, data_sha256: sha(_body) }))
  const parts = db
    .query<Record<string, any>, []>(
      `SELECT id, message_id, time_created,
              json_extract(data, '$.type')         AS type,
              json_extract(data, '$.tool')         AS tool,
              json_extract(data, '$.callID')       AS call_id,
              json_extract(data, '$.state.status') AS state_status,
              json_extract(data, '$.reason')       AS reason,
              length(data) AS data_length,
              data AS _body
         FROM part`,
    )
    .all()
    .map(({ _body, ...row }) => ({ ...row, data_sha256: sha(_body) }))
  return { message: messages, part: parts }
}

function databaseSnapshot(databasePath: string) {
  const db = new SQLite(databasePath, { readonly: true })
  try {
    const present = new Set(
      db
        .query<{ name: string }, []>(`SELECT name FROM sqlite_master WHERE type = 'table'`)
        .all()
        .map((row) => row.name),
    )
    const tables: Record<string, unknown[]> = {}
    const missing: string[] = []
    for (const table of SNAPSHOT_TABLES) {
      if (!present.has(table)) {
        missing.push(table)
        continue
      }
      tables[table] = db.query<Record<string, unknown>, []>(`SELECT * FROM "${table}"`).all()
    }
    for (const [table, columns] of Object.entries(SNAPSHOT_TABLE_COLUMNS)) {
      if (!present.has(table)) {
        missing.push(table)
        continue
      }
      const projection = columns.map((column) => `"${column}"`).join(", ")
      tables[table] = db.query<Record<string, unknown>, []>(`SELECT ${projection} FROM "${table}"`).all()
    }
    if (present.has("message") && present.has("part")) {
      const projected = messageEvidenceProjection(db)
      tables["message"] = projected.message
      tables["part"] = projected.part
    } else {
      if (!present.has("message")) missing.push("message")
      if (!present.has("part")) missing.push("part")
    }
    if (independentTranscriptSurface) tables["benchmark_transcript_surface"] = independentTranscriptSurface
    return { tables, missing: missing.sort() }
  } finally {
    db.close()
  }
}

/** Redaction is defence in depth: these tables carry identities and counters rather than Provider
 *  credentials, but the same secret leaves the transcript audit uses are stripped before sealing. */
function redactSnapshot(value: unknown, secrets: Array<{ label: string; value: string }>): unknown {
  if (typeof value === "string") {
    let result = value
    for (const secret of secrets) {
      if (secret.value) result = result.replaceAll(secret.value, `[REDACTED:${secret.label}]`)
    }
    return result
  }
  if (Array.isArray(value)) return value.map((item) => redactSnapshot(item, secrets))
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, redactSnapshot(item, secrets)]),
    )
  }
  return value
}

function ledgerRows(databasePath: string): ProviderUsageRow[] {
  const db = new SQLite(databasePath, { readonly: true })
  try {
    return db
      .query<ProviderUsageRow, []>(
        `SELECT id, occurred_at, provider_id, model_id, purpose,
                input_tokens, output_tokens, reasoning_tokens,
                cache_read_tokens, cache_write_tokens, total_tokens,
                cost_usd, billing_status, session_id, agent_id
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
const skillProjectionPath = path.join(outputDirectory, "skill-projection.json")
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
let waitForProtocolDeliveryIdle: (() => Promise<void>) | undefined
let drainMissionSchedulerMessages: (() => Promise<void>) | undefined
let missionSchedulerSettlement:
  | (() => {
      passed: boolean
      pendingInboxIDs: string[]
      leasedInboxIDs: string[]
      unansweredInboxIDs: string[]
      deadLetterInboxIDs: string[]
      invalidTerminalInboxIDs: string[]
    })
  | undefined
let activeMissionSchedulerDrain: Promise<void> | undefined
let missionSchedulerDrainError: unknown
let closeDatabase: (() => void) | undefined
let runtimeLogPath = ""
let flushRuntimeLog: (() => Promise<void>) | undefined
let skillProjection: Awaited<ReturnType<typeof projectBenchmarkSkill>> | undefined
let taskID: string | undefined
let taskIDs: string[] = []
let missionID: string | undefined
let missionSessionID: string | undefined
let missionSessionReceipt: Record<string, any> | undefined
let independentTranscriptSurface: Array<{
  surface: "mission" | "task"
  owner_id: string
  message_id: string
  session_id: string
}> | undefined
let captureIndependentTranscriptSurface: (() => Promise<typeof independentTranscriptSurface>) | undefined
let projectInitReceipt: Record<string, any> | undefined
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

/**
 * A projected Expert Squad agent sees only the Skills its package manifest grants plus explicit
 * operator mounts, so seeding `.opencorvus/skill/` alone leaves every worker's `skill` call with
 * zero matches. Mount the experimental Skill only on the profile's exact planning/execution/
 * readback owners through the same public operator route a user would use, then re-read the Host's
 * own matrix and refuse to create the Task unless that exact projection carries it.
 */
async function projectBenchmarkSkill(input: {
  profile: Profile
  skill: { location: string; sha256: string; bytes: number }
}) {
  const matrixRoute = `/skill/mounts?expertSquadID=${encodeURIComponent(input.profile)}&refresh=true`
  const discovered = await requestJSON<SkillMountMatrix>(matrixRoute)
  const requiredAgentIDs = automationBenchSkillAgentIDs(input.profile)
  const agentsByID = new Map((discovered.agents ?? []).map((agent) => [String(agent.agent_id ?? ""), agent]))
  for (const agentID of requiredAgentIDs) {
    const agent = agentsByID.get(agentID)
    if (!agent || agent.skill_mountable !== true || agent.skill_tool_available !== true) {
      throw new Error(`AutomationBench Skill owner ${input.profile}/${agentID} is not physically mountable`)
    }
    await requestJSON<SkillMountMatrix>("/skill/mount", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scope: "project",
        expertSquadID: input.profile,
        agentID,
        defaultSkillRef: AUTOMATIONBENCH_SKILL_REF,
        override: true,
      }),
    })
  }
  const projected = await requestJSON<SkillMountMatrix>(
    `/skill/mounts?expertSquadID=${encodeURIComponent(input.profile)}`,
  )
  const poolLocation = (projected.skills ?? []).find((skill) => skill.ref === AUTOMATIONBENCH_SKILL_REF)?.location
  const poolSHA256 =
    typeof poolLocation === "string"
      ? crypto
          .createHash("sha256")
          .update(await fs.readFile(poolLocation))
          .digest("hex")
      : undefined
  const audit = auditSkillProjection({
    profile: input.profile,
    matrix: projected,
    expectedLocation: input.skill.location,
    expectedSHA256: input.skill.sha256,
    poolSHA256,
  })
  if (!audit.passed) {
    throw new Error(`Experimental Skill projection failed fail-closed verification: ${JSON.stringify(audit)}`)
  }
  return {
    summary: {
      name: AUTOMATIONBENCH_SKILL_NAME,
      ref: AUTOMATIONBENCH_SKILL_REF,
      revision: 1,
      source: {
        location: `.opencorvus/skill/${AUTOMATIONBENCH_SKILL_NAME}/SKILL.md`,
        sha256: input.skill.sha256,
        bytes: input.skill.bytes,
      },
      projection: audit,
    },
    matrix: projected,
  }
}

let latestObservation: Awaited<ReturnType<typeof observations>> | undefined
let latestObservationAt: number | undefined

const orderedMessages = canonicalTranscriptOrder

async function observations() {
  if (!missionID || !missionSessionID) throw new Error("Mission has not been created")
  const [missionStatus, missionRecords, missionTranscript, benchmarkEvents] =
    await Promise.all([
      requestJSON<Record<string, any>>(`/mission/${missionID}/status`),
      requestJSON<Array<Record<string, any>>>("/mission?limit=100"),
      requestJSON<Array<{ info: Record<string, any>; parts: Array<Record<string, any>> }>>(
        `/session/${missionSessionID}/message`,
      ),
      readJSONLines(bridgeEventsPath),
    ])
  const missionRecord = missionRecords.find((record) => record.missionID === missionID)
  if (!missionRecord) throw new Error(`Mission ${missionID} is missing from the current project projection`)
  const observedTaskIDs = [
    ...new Set(
      (Array.isArray(missionStatus.tasks) ? missionStatus.tasks : [])
        .map((task: any) => task.taskID)
        .filter((value: unknown): value is string => typeof value === "string" && value.length > 0),
    ),
  ].sort()
  const tasks = await Promise.all(
    observedTaskIDs.map(async (observedTaskID) => {
      const [board, transcript, traceProjection, interactions] = await Promise.all([
        requestJSON<Record<string, any>>(`/task/${observedTaskID}/board?sync=0`),
        requestJSON<Array<{ info: Record<string, any>; parts: Array<Record<string, any>> }>>(
          `/task/${observedTaskID}/transcript`,
        ),
        requestJSON<{ ok: true; enabled: boolean; traceDir: string; events: Array<Record<string, any>> }>(
          `/task/${observedTaskID}/trace`,
        ),
        requestJSON<Array<Record<string, any>>>(`/task/${observedTaskID}/interactions`),
      ])
      if (!traceProjection.enabled) {
        throw new Error(`OpenCorvus AgentTrace is disabled for benchmark child Task ${observedTaskID}`)
      }
      return {
        task_id: observedTaskID,
        board,
        transcript,
        trace: traceProjection.events,
        interactions: interactions.map(
          (interaction): Record<string, any> => ({ ...interaction, task_id: observedTaskID }),
        ),
      }
    }),
  )
  taskIDs = observedTaskIDs
  taskID = observedTaskIDs[0]
  const taskTranscript = orderedMessages(tasks.flatMap((task) => task.transcript))
  const allTranscript = orderedMessages([...missionTranscript, ...taskTranscript])
  // AgentTrace is physically Task-bound: Mission Sessions have no Task trace directory.
  // Mission Provider calls remain complete in the preserved usage ledger and DB snapshot.
  const trace = tasks.flatMap((task) => task.trace).sort(
    (left, right) => Number(left.ts ?? 0) - Number(right.ts ?? 0),
  )
  const interactions = tasks.flatMap((task) => task.interactions)
  const board = {
    launch_mode: "mission",
    mission: missionRecord,
    mission_status: missionStatus,
    tasks: tasks.map((task) => ({ task_id: task.task_id, board: task.board })),
  }
  const current = {
    board,
    missionRecord,
    missionStatus,
    missionTranscript,
    taskTranscript,
    allTranscript,
    tasks,
    transcript: taskTranscript,
    trace,
    interactions,
    benchmarkEvents,
  }
  latestObservation = current
  latestObservationAt = Date.now()
  return current
}

function missionActivitySignature(current: Awaited<ReturnType<typeof observations>>) {
  return benchmarkActivitySignature({
    board: current.board,
    transcript: current.allTranscript,
    trace: current.trace,
    benchmarkEventCount: current.benchmarkEvents.length,
  })
}

function missionReachedNaturalTerminal(current: Awaited<ReturnType<typeof observations>>) {
  const statuses = Array.isArray(current.missionStatus.tasks) ? current.missionStatus.tasks : []
  return (
    current.missionStatus.status === "inactive" &&
    current.missionRecord.interruptible === false &&
    statuses.every((task: any) => ["completed", "failed", "cancelled"].includes(String(task.lifecycleStatus)))
  )
}

function missionOutcomeForObservation(current: Awaited<ReturnType<typeof observations>>) {
  return auditMissionOutcome({
    missionRecord: current.missionRecord,
    missionStatus: current.missionStatus,
    missionTranscript: current.missionTranscript,
    taskTranscripts: current.tasks.map((task) => ({
      task_id: task.task_id,
      lifecycle_status: task.board?.task?.status,
      transcript: task.transcript,
    })),
  })
}

function requestMissionSchedulerDrain() {
  if (!drainMissionSchedulerMessages || activeMissionSchedulerDrain) return
  activeMissionSchedulerDrain = drainMissionSchedulerMessages()
    .catch((error) => {
      missionSchedulerDrainError = error
    })
    .finally(() => {
      activeMissionSchedulerDrain = undefined
    })
}

function throwIfMissionSchedulerDrainFailed() {
  if (!missionSchedulerDrainError) return
  const error = missionSchedulerDrainError
  missionSchedulerDrainError = undefined
  throw error
}

function currentMissionSchedulerSettlement() {
  const settlement = missionSchedulerSettlement?.()
  if (settlement?.deadLetterInboxIDs.length || settlement?.invalidTerminalInboxIDs.length) {
    throw new Error(`AutomationBench Mission scheduler delivery settlement failed: ${JSON.stringify(settlement)}`)
  }
  return settlement
}

async function waitForTerminal() {
  let signature = ""
  let inactivityDeadline = Date.now() + arguments_.inactivityMs
  while (Date.now() < inactivityDeadline) {
    throwIfTerminationRequested()
    throwIfMissionSchedulerDrainFailed()
    const current = await observations()
    const status = String(current.missionStatus.status ?? "")
    if (
      current.missionRecord.completion &&
      missionReachedNaturalTerminal(current) &&
      missionOutcomeForObservation(current).scored_terminal
    ) {
      return current
    }
    const next = missionActivitySignature(current)
    if (next !== signature) {
      signature = next
      inactivityDeadline = Date.now() + arguments_.inactivityMs
      process.stdout.write(
        JSON.stringify({
          event: "activity",
          profile: arguments_.profile,
          missionID,
          taskIDs,
          status,
          messages: current.allTranscript.length,
          traceEvents: current.trace.length,
          benchmarkCalls: current.benchmarkEvents.filter((event) => event.kind === "tool").length,
          pendingInteractions: current.interactions.filter((item) => item.status === "pending").length,
        }) + "\n",
      )
    }
    if (missionReachedNaturalTerminal(current) && currentMissionSchedulerSettlement()?.passed === false) {
      requestMissionSchedulerDrain()
    }
    await Bun.sleep(1000)
  }
  const current = await observations()
  throwIfMissionSchedulerDrainFailed()
  if (activeMissionSchedulerDrain || currentMissionSchedulerSettlement()?.passed === false) {
    throw new Error("AutomationBench Mission scheduler delivery remained active through the full inactivity window")
  }
  const outcome = missionOutcomeForObservation(current)
  if (missionReachedNaturalTerminal(current) && outcome.mission_assistant_healthy) {
    process.stdout.write(
      JSON.stringify({
        event: "mission_incomplete_terminal",
        profile: arguments_.profile,
        missionID,
        taskIDs,
        status: current.missionStatus.status,
      }) + "\n",
    )
    return current
  }
  if (!outcome.mission_assistant_healthy) {
    throw new Error(
      `AutomationBench ${arguments_.profile} Mission assistant did not settle cleanly: ${JSON.stringify(outcome)}`,
    )
  }
  throw new Error(
    `AutomationBench ${arguments_.profile} Mission had no observable activity for ${arguments_.inactivityMs}ms; ` +
      `pending interactions=${current.interactions.filter((item) => item.status === "pending").length}`,
  )
}

async function waitForTerminalQuiescence(initial: Awaited<ReturnType<typeof observations>>) {
  let current = initial
  let signature = missionActivitySignature(current)
  let inactivityDeadline = Date.now() + arguments_.inactivityMs
  while (Date.now() < inactivityDeadline) {
    throwIfTerminationRequested()
    throwIfMissionSchedulerDrainFailed()
    const audit = auditMissionQuiescence({
      missionRecord: current.missionRecord,
      missionStatus: current.missionStatus,
      taskBoards: current.tasks.map((task) => ({ task_id: task.task_id, board: task.board })),
    })
    if (audit.passed) {
      await within(waitForIngressDeliveryHooks?.() ?? Promise.resolve(), CLEANUP_TIMEOUT_MS, "Terminal ingress settlement")
      if (currentMissionSchedulerSettlement()?.passed === false) {
        requestMissionSchedulerDrain()
        await Bun.sleep(1000)
        const next = await observations()
        const nextSignature = missionActivitySignature(next)
        if (nextSignature !== signature) inactivityDeadline = Date.now() + arguments_.inactivityMs
        current = next
        signature = nextSignature
        continue
      }
      await within(
        waitForProtocolDeliveryIdle?.() ?? Promise.resolve(),
        CLEANUP_TIMEOUT_MS,
        "Mission protocol delivery settlement",
      )
      await Bun.sleep(2_000)
      const confirmed = await observations()
      const confirmedSignature = missionActivitySignature(confirmed)
      const confirmedAudit = auditMissionQuiescence({
        missionRecord: confirmed.missionRecord,
        missionStatus: confirmed.missionStatus,
        taskBoards: confirmed.tasks.map((task) => ({ task_id: task.task_id, board: task.board })),
      })
      if (confirmedAudit.passed && confirmedSignature === signature) {
        return { terminal: confirmed, audit: confirmedAudit }
      }
      current = confirmed
      signature = confirmedSignature
      inactivityDeadline = Date.now() + arguments_.inactivityMs
      continue
    }
    await Bun.sleep(1000)
    const next = await observations()
    const nextSignature = missionActivitySignature(next)
    if (nextSignature !== signature) {
      signature = nextSignature
      inactivityDeadline = Date.now() + arguments_.inactivityMs
    }
    current = next
  }
  throw new Error(
    `AutomationBench ${arguments_.profile} Mission did not reach terminal execution quiescence; ${JSON.stringify(
      auditMissionQuiescence({
        missionRecord: current.missionRecord,
        missionStatus: current.missionStatus,
        taskBoards: current.tasks.map((task) => ({ task_id: task.task_id, board: task.board })),
      }),
    )}`,
  )
}

async function captureFailureObservationEvidence() {
  const receipt = {
    ...failureObservationReceipt({
      runID,
      runKey,
      taskID,
      missionID,
      missionSessionID,
      taskIDs,
      capturedAt: latestObservationAt ?? Date.now(),
      projection: skillProjection?.summary.projection,
      observation: latestObservation,
    }),
    launch_mode: "mission",
  }
  if (latestObservation) {
    const secrets = source?.protectedSecrets ?? []
    const artifacts = [
      ["latest-board.json", latestObservation.board],
      ["opencorvus-transcript.json", latestObservation.transcript],
      ["mission-transcript.json", latestObservation.missionTranscript],
      ["task-transcripts.json", latestObservation.tasks.map((task) => ({ task_id: task.task_id, transcript: task.transcript }))],
      ["task-interactions.json", latestObservation.tasks.map((task) => ({ task_id: task.task_id, interactions: task.interactions }))],
      ["opencorvus-trace.json", latestObservation.trace],
      ["opencorvus-interactions.json", latestObservation.interactions],
    ] as const
    await Promise.all(
      artifacts.map(([name, value]) =>
        fs.writeFile(
          path.join(outputDirectory, name),
          JSON.stringify(redactSnapshot(value, secrets), null, 2) + "\n",
          { encoding: "utf8", flag: "wx" },
        ),
      ),
    )
  }
  await fs.writeFile(
    path.join(outputDirectory, "failure-observation-receipt.json"),
    JSON.stringify(receipt, null, 2) + "\n",
    { encoding: "utf8", flag: "wx" },
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
        opencorvus: { profile: arguments_.profile, model: arguments_.model, launch_mode: "mission" },
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
    throw new Error(
      "AutomationBench trial lease rejected: at most five distinct cases may run and paired profiles may not overlap",
    )
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
  const seededSkill = await seedProject({ projectDirectory, socketPath: bridge.toolSocketPath })
  const agentHome = `/tmp/opencorvus-benchmark-agent-${runID}`
  await fs.mkdir(agentHome, { mode: 0o700 })
  await Promise.all([fs.chmod(isolatedRuntime.ownerRoot, 0o711), fs.chmod(isolatedRuntime.processRoot, 0o711)])
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
  const protocolBridge = await import("@/orchestrator/protocol/message-bridge")
  waitForProtocolDeliveryIdle = protocolBridge.awaitTaskMessageProtocolBridgeIdle
  const schedulerMessages = await import("@/protocol/scheduler-message")
  drainMissionSchedulerMessages = schedulerMessages.SchedulerMessageDeliveryService.runDueNow
  const schedulerDelivery = await import("@/protocol/delivery")
  missionSchedulerSettlement = () => {
    if (!missionSessionID) throw new Error("Mission Session identity is unavailable for scheduler settlement")
    return schedulerDelivery.auditSchedulerSessionDeliverySettlement(missionSessionID)
  }
  const { Session } = await import("@/session")
  const engineStore = await import("@/engine/store")
  const conversationView = await import("@/conversation/view")
  captureIndependentTranscriptSurface = async () => {
    if (!missionID || !missionSessionID) return undefined
    const missionMessages = (await Session.messages({ sessionID: missionSessionID })).filter(
      conversationView.conversationMessageHasDisplay,
    )
    const taskRows = await Promise.all(
      taskIDs.map(async (currentTaskID) => {
        const sessionIDs = engineStore.sessionIDsForTask(currentTaskID)
        const messages = (
          await Promise.all(sessionIDs.map((sessionID) => Session.messages({ sessionID })))
        ).flat().filter(conversationView.conversationMessageHasDisplay)
        return messages.map((message) => ({
          surface: "task" as const,
          owner_id: currentTaskID,
          message_id: message.info.id,
          session_id: message.info.sessionID,
        }))
      }),
    )
    return [
      ...missionMessages.map((message) => ({
        surface: "mission" as const,
        owner_id: missionID!,
        message_id: message.info.id,
        session_id: message.info.sessionID,
      })),
      ...taskRows.flat(),
    ]
  }
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
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ modelID: source.modelID }),
    },
    false,
  )
  if (!preflight.ok || preflight.status !== "connected" || preflight.modelID !== source.modelID) {
    throw new Error(`Exact Provider/model preflight failed: ${JSON.stringify(preflight)}`)
  }
  stage = "project_git_init"
  projectInitReceipt = await requestJSON<Record<string, any>>("/project/current/init-git", { method: "POST" })
  stage = "skill_projection"
  // Fail-closed before Task creation. The sealed receipt is written after the terminal transcript,
  // because half of it — which Agents actually ran under this projection — does not exist yet.
  // Preserve the pre-Task matrix immediately as failure evidence, then replace this unsealed file
  // with the terminal coverage receipt before the exact-file-set manifest is written.
  skillProjection = await projectBenchmarkSkill({ profile: arguments_.profile, skill: seededSkill })
  await fs.writeFile(
    skillProjectionPath,
    JSON.stringify(
      {
        schema_version: EXTERNAL_BENCHMARK_SCHEMA_VERSION,
        profile: arguments_.profile,
        skill: skillProjection.summary,
        matrix: skillProjection.matrix,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  )
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
  stage = "mission_create"
  const harnessRequest = automationBenchHarnessRequest(benchmarkTask.prompt)
  const missionWakeInput = {
    text: harnessRequest,
    model: arguments_.model,
    productPillar: "work",
    expertSquadIDs: [arguments_.profile],
  }
  const missionWake = await requestJSON<{
    missionID: string
    sessionID: string
    created: boolean
    productPillar: string
  }>("/mission/wake", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(missionWakeInput),
  })
  missionID = missionWake.missionID
  missionSessionID = missionWake.sessionID
  if (!missionWake.created || missionWake.productPillar !== "work") {
    throw new Error("AutomationBench Mission wake did not create the expected fresh work Mission")
  }
  missionSessionReceipt = await requestJSON<Record<string, any>>(`/session/${missionSessionID}`)
  if (!missionSessionReceipt.projectID) throw new Error("AutomationBench Mission Session omitted its project identity")
  stage = "mission_execution"
  const observedTerminal = await waitForTerminal()
  const quiescence = await waitForTerminalQuiescence(observedTerminal)
  const terminal = quiescence.terminal
  independentTranscriptSurface = await captureIndependentTranscriptSurface?.()
  if (!independentTranscriptSurface) {
    throw new Error("AutomationBench Mission transcript surface could not be rebuilt from durable Session rows")
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
  const transcriptTokens = summarizeTranscriptUsage(terminal.allTranscript)
  const providerUsageLedger = ledgerRows(path.join(isolatedData, "opencorvus.db"))
  const tokens = summarizeProviderUsageRows(providerUsageLedger)
  const tracedSessionIDs = new Set(
    terminal.trace.map((event) => event.sessionID).filter((value): value is string => typeof value === "string"),
  )
  const promptCompositionAudit = auditTaskBoundPromptCompositionCoverage({
    traceEvents: terminal.trace,
    providerRows: providerUsageLedger,
    missionSessionID: missionSessionID!,
  })
  const promptComposition = analyzePromptComposition(terminal.trace)
  const trajectory = normalizeTrajectory({
    transcript: terminal.allTranscript,
    trace: terminal.trace,
    benchmarkEvents,
  })
  const finishedAt = Date.now()
  const lifecycleStatus = terminal.missionRecord.completion ? "completed" : "inactive"
  const missionSession = missionSessionReceipt
  const taskBoards = terminal.tasks.map((task) => ({ task_id: task.task_id, board: task.board }))
  const profileAudit = auditMissionRunBinding({
    resultProfile: arguments_.profile,
    resultModel: arguments_.model,
    resultMissionID: missionID,
    resultMissionSessionID: missionSessionID,
    resultTaskIDs: taskIDs,
    wakeRequest: missionWakeInput,
    wakeResponse: missionWake,
    missionSession,
    missionRecord: terminal.missionRecord,
    missionStatus: terminal.missionStatus,
    projectGitInit: projectInitReceipt,
    taskBoards,
  })
  const workflowBindings = terminal.tasks.map((task) => ({
    task_id: task.task_id,
    workflow_binding: task.board.task?.completionDecision?.workflowBinding ?? null,
  }))
  const selectedWorkflowIDs = workflowBindings.map((item) => ({
    task_id: item.task_id,
    workflow_id:
      item.workflow_binding?.kind === "virtual_workflow" ? item.workflow_binding.workflow_id : null,
  }))
  const isolationAudit = auditBenchmarkIsolation(terminal.allTranscript, {
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
  const missionOutcomeAudit = auditMissionOutcome({
    missionRecord: terminal.missionRecord,
    missionStatus: terminal.missionStatus,
    missionTranscript: terminal.missionTranscript,
    taskTranscripts: terminal.tasks.map((task) => ({
      task_id: task.task_id,
      lifecycle_status: task.board.task?.status,
      transcript: task.transcript,
    })),
  })
  const skillCoverageAudit = auditDispatchedSkillCoverage({
    projection: skillProjection.summary.projection,
    transcript: terminal.transcript,
  })
  const skillEvidence = { ...skillProjection.summary, dispatched_coverage: skillCoverageAudit }
  const validity = automationBenchRunValidity({
    taskOutcomePassed: missionOutcomeAudit.scored_terminal,
    profilePassed: profileAudit.passed,
    isolationPassed: isolationAudit.passed,
    promptCompositionPassed: promptCompositionAudit.passed,
    skillProjectionPassed: skillProjection.summary.projection.passed,
    skillCoveragePassed: skillCoverageAudit.passed,
    skillRuntimeAdherencePassed: skillCoverageAudit.runtime_adherence_passed,
  })
  const valid = validity.valid
  const invalidReason = !missionOutcomeAudit.scored_terminal
    ? "OpenCorvus Mission or one of its child Tasks did not reach a natural scorable terminal"
    : !skillProjection.summary.projection.passed
      ? "The experimental Skill was not projected onto the Expert Squad's agents"
      : !skillCoverageAudit.passed
        ? `Experimental Skill runtime evidence failed (${skillCoverageAudit.violations.join(", ")})`
        : !profileAudit.passed
          ? "OpenCorvus Mission or child Task bound a different Expert Squad profile"
          : !promptCompositionAudit.passed
            ? `Prompt composition evidence did not cover the Provider ledger (${promptCompositionAudit.violations.join(", ")})`
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
      prompt_mapping: "remove_stock_single_model_turn_budget_and_use_mission_intake_v2",
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
      launch_mode: "mission",
      mission_id: missionID,
      mission_session_id: missionSessionID,
      task_id: taskIDs.length === 1 ? taskID : null,
      task_ids: taskIDs,
      lifecycle_status: lifecycleStatus,
      mission_outcome_audit: missionOutcomeAudit,
      terminal_quiescence_audit: quiescence.audit,
      profile: arguments_.profile,
      model: arguments_.model,
      skill: skillEvidence,
      selected_workflow_ids: selectedWorkflowIDs,
      workflow_bindings: workflowBindings,
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
      prompt_composition_audit: promptCompositionAudit,
      prompt_composition: promptComposition,
      tokens_by_agent: summarizeProviderUsageByAgent(providerUsageLedger),
      transcript_token_reconciliation: transcriptTokens,
      sessions: new Set(terminal.allTranscript.map((message) => message.info?.sessionID).filter(Boolean)).size,
      agents: [...new Set(terminal.allTranscript.map((message) => message.info?.agent).filter(Boolean))],
      trace_events: terminal.trace.length,
      trace_scope: {
        kind: "task_bound_agent_trace",
        mission_session_traced: false,
        mission_usage_preserved_in_provider_ledger: true,
        traced_session_ids: [...tracedSessionIDs].sort(),
      },
      interactions: terminal.interactions,
    },
    comparison: {
      leaderboard_eligible: false,
      reason: valid
        ? "One frozen public case under the 50-case OpenCorvus Mission Base matrix; official AutomationBench uses a held-out private set."
        : `${invalidReason}; rubric values are diagnostic only.`,
    },
  }
  const resultPath = path.join(outputDirectory, "result.json")
  const tracePath = path.join(outputDirectory, "opencorvus-trace.json")
  const transcriptPath = path.join(outputDirectory, "opencorvus-transcript.json")
  const boardPath = path.join(outputDirectory, "terminal-board.json")
  const missionReceiptPath = path.join(outputDirectory, "mission-receipt.json")
  const missionTranscriptPath = path.join(outputDirectory, "mission-transcript.json")
  const taskTranscriptsPath = path.join(outputDirectory, "task-transcripts.json")
  const interactionsPath = path.join(outputDirectory, "opencorvus-interactions.json")
  const taskInteractionsPath = path.join(outputDirectory, "task-interactions.json")
  const providerLedgerPath = path.join(outputDirectory, "provider-usage-ledger.json")
  const scorerReplayPath = path.join(outputDirectory, "scorer-replay-audit.json")
  const sandboxAuditPath = path.join(outputDirectory, "sandbox-isolation-audit.json")
  const protectedRootAuditPath = path.join(outputDirectory, "protected-root-isolation-audit.json")
  const trajectoryPath = path.join(outputDirectory, "trajectory.json")
  const svgPath = path.join(outputDirectory, "trajectory.svg")
  await Promise.all([
    fs.writeFile(
      skillProjectionPath,
      JSON.stringify(
        {
          schema_version: EXTERNAL_BENCHMARK_SCHEMA_VERSION,
          profile: arguments_.profile,
          skill: skillEvidence,
          matrix: skillProjection.matrix,
        },
        null,
        2,
      ) + "\n",
      "utf8",
    ),
    fs.writeFile(resultPath, JSON.stringify(result, null, 2) + "\n", "utf8"),
    fs.writeFile(tracePath, JSON.stringify(terminal.trace, null, 2) + "\n", "utf8"),
    fs.writeFile(transcriptPath, JSON.stringify(terminal.transcript, null, 2) + "\n", "utf8"),
    fs.writeFile(missionTranscriptPath, JSON.stringify(terminal.missionTranscript, null, 2) + "\n", "utf8"),
    fs.writeFile(interactionsPath, JSON.stringify(terminal.interactions, null, 2) + "\n", "utf8"),
    fs.writeFile(
      taskInteractionsPath,
      JSON.stringify(
        terminal.tasks.map((task) => ({ task_id: task.task_id, interactions: task.interactions })),
        null,
        2,
      ) + "\n",
      "utf8",
    ),
    fs.writeFile(
      taskTranscriptsPath,
      JSON.stringify(
        terminal.tasks.map((task) => ({ task_id: task.task_id, transcript: task.transcript })),
        null,
        2,
      ) + "\n",
      "utf8",
    ),
    fs.writeFile(boardPath, JSON.stringify(terminal.board, null, 2) + "\n", "utf8"),
    fs.writeFile(
      missionReceiptPath,
      JSON.stringify(
        {
          schema_version: EXTERNAL_BENCHMARK_SCHEMA_VERSION,
          launch_mode: "mission",
          request: missionWakeInput,
          response: missionWake,
          project_git_init: projectInitReceipt,
          mission_session: missionSession,
          bound_profile: profileAudit,
          workflow_bindings: workflowBindings,
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
  try {
    await captureFailureObservationEvidence()
  } catch (captureError) {
    await fs
      .writeFile(
        path.join(outputDirectory, "failure-observation-receipt.json"),
        JSON.stringify(
          {
            schema_version: EXTERNAL_BENCHMARK_SCHEMA_VERSION,
            run_id: runID,
            run_key: runKey,
            task_id: taskID ?? null,
            task_ids: taskIDs,
            mission_id: missionID ?? null,
            mission_session_id: missionSessionID ?? null,
            status: "capture_failed",
            reason: captureError instanceof Error ? captureError.name : "UnknownError",
          },
          null,
          2,
        ) + "\n",
        { encoding: "utf8", flag: "wx" },
      )
      .catch(() => undefined)
  }
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
      .writeFile(path.join(outputDirectory, "opencorvus-runtime.log"), redactedRuntimeLog, {
        encoding: "utf8",
        flag: "wx",
      })
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
      launch_mode: "mission",
      mission_id: missionID ?? null,
      mission_session_id: missionSessionID ?? null,
      task_id: taskIDs.length === 1 ? (taskID ?? null) : null,
      task_ids: taskIDs,
      source: runSource ?? null,
    },
    error:
      error instanceof Error
        ? { name: error.name, message: error.message }
        : { name: "UnknownError", message: String(error) },
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
  if (drainMissionSchedulerMessages) {
    try {
      await within(
        activeMissionSchedulerDrain ?? drainMissionSchedulerMessages(),
        CLEANUP_TIMEOUT_MS,
        "Mission scheduler cleanup",
      )
    } catch (error) {
      failures.push(error)
    }
  }
  if (waitForProtocolDeliveryIdle) {
    try {
      await within(waitForProtocolDeliveryIdle(), CLEANUP_TIMEOUT_MS, "Mission protocol cleanup")
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
  // A run that failed before the runtime opened its database has nothing to snapshot. Treating that
  // as a cleanup failure would permanently invalidate an attempt whose real stage is `blocked_preflight`.
  const isolatedDatabasePath = isolatedData ? path.join(isolatedData, "opencorvus.db") : ""
  if (
    isolatedDatabasePath &&
    (await fs.stat(isolatedDatabasePath).then(
      () => true,
      () => false,
    ))
  ) {
    try {
      const snapshot = databaseSnapshot(isolatedDatabasePath)
      await fs.writeFile(
        path.join(outputDirectory, "runtime-database-snapshot.json"),
        JSON.stringify(
          {
            schema_version: EXTERNAL_BENCHMARK_SCHEMA_VERSION,
            run_id: runID,
            run_key: runKey,
            launch_mode: "mission",
            mission_id: missionID ?? null,
            mission_session_id: missionSessionID ?? null,
            task_id: taskIDs.length === 1 ? (taskID ?? null) : null,
            task_ids: taskIDs,
            tables: SNAPSHOT_TABLES,
            missing_tables: snapshot.missing,
            rows: redactSnapshot(snapshot.tables, source?.protectedSecrets ?? []),
          },
          null,
          2,
        ) + "\n",
        { encoding: "utf8", flag: "wx" },
      )
    } catch (error) {
      failures.push(error)
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
            error instanceof Error
              ? { name: error.name, message: error.message }
              : { name: "UnknownError", message: String(error) },
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
    await fs
      .writeFile(
        path.join(outputDirectory, "evidence-seal-failure.json"),
        JSON.stringify(
          {
            schema_version: EXTERNAL_BENCHMARK_SCHEMA_VERSION,
            run_id: runID,
            run_key: runKey,
            error:
              error instanceof Error
                ? { name: error.name, message: error.message }
                : { name: "UnknownError", message: String(error) },
          },
          null,
          2,
        ) + "\n",
        "utf8",
      )
      .catch(() => undefined)
  }
  if (failures.length === 1) throw failures[0]
  if (failures.length > 1) throw new AggregateError(failures, "AutomationBench pilot cleanup failed")
}
