import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import {
  evidenceFileSetMatches,
  paperEvidenceChecks,
  auditBenchmarkIsolation,
  analyzePromptComposition,
  auditRunBinding,
  auditSkillEvidenceSeal,
  auditTaskInfrastructureIncidents,
  auditTaskOutcome,
  auditTerminalQuiescence,
  auditBatchEvidence,
  reusableBatchCandidateRunIDs,
  permanentRunInvalidation,
  sourceAuthSecretLeaves,
  summarizeBenchmarkToolEvents,
  summarizeProviderUsageRows,
  providerUsageMatchesModel,
  type ProviderUsageRow,
} from "./contract"

const EXPECTED_PACKAGE_TREE_SHA256 = "cc7a63f9444814c7029e325dacbdf1c2e870430d08aaf8d4ecf5c0e44fe829d4"

type Profile = "base" | "advanced"

type Result = {
  run: { id?: string; key?: string; started_at: number; finished_at?: number; duration_ms?: number; status: string }
  benchmark: {
    name: string
    version: string
    domain?: string
    task: string
    metrics: { partial_credit: number; task_completed_correctly: number } | null
    tool_calls?: number
    package_tree_sha256?: string
    task_contract_sha256?: string
    case_index?: number
    batch_index?: number
    repetition?: number
    example_id?: string | number
    case_set_manifest_sha256?: string
    case_set_canonical_sha256?: string
    dataset_index_sha256?: string
    harness_request_sha256?: string
    tool_attempts?: number
    tool_succeeded?: number
    tool_failed?: number
  }
  opencorvus: {
    commit?: string
    source?: { worktree_clean?: boolean; benchmark_bundle_sha256?: string; dirty_paths?: string[] }
    task_id?: string | null
    lifecycle_status?: string
    profile: string
    model: string
    tokens?: Record<string, number>
    modelCalls?: number
    sessions?: number
    agents?: string[]
    profile_audit?: { passed?: boolean }
    isolation_audit?: { passed?: boolean }
    task_outcome_audit?: { scored_terminal?: boolean }
    terminal_quiescence_audit?: { passed?: boolean }
    skill?: {
      name?: string
      projection?: { passed?: boolean }
      dispatched_coverage?: { passed?: boolean }
    }
  }
}

type Failure = {
  run: { id?: string; key?: string; started_at: number; failed_at?: number; status: string; stage?: string }
  benchmark: { name: string; version: string; task: string }
  opencorvus: { profile: string; model: string; task_id?: string | null }
  error?: { name?: string; message?: string }
}

async function arguments_() {
  const values = new Map<string, string>()
  const argv = process.argv.slice(2)
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]
    const value = argv[index + 1]
    if (!key?.startsWith("--") || value === undefined) throw new Error("Expected --root value")
    values.set(key.slice(2), value)
  }
  const root = values.get("root")
  const sourceData = values.get("source-data")
  const python = values.get("python")
  const restrictedShell = values.get("restricted-shell")
  const model = values.get("model")
  if (!root || !sourceData || !python || !restrictedShell || !model) {
    throw new Error("--root, --source-data, --python, --restricted-shell, and --model are required")
  }
  const profiles = (values.get("profiles") ?? "base,advanced").split(",").map((item) => item.trim()) as Profile[]
  if (
    profiles.length < 1 ||
    profiles.length > 2 ||
    new Set(profiles).size !== profiles.length ||
    profiles.some((profile) => profile !== "base" && profile !== "advanced")
  ) {
    throw new Error("--profiles must be base, advanced, or base,advanced")
  }
  return {
    root: path.resolve(root),
    sourceData: path.resolve(sourceData),
    python: path.resolve(python),
    restrictedShell: path.resolve(restrictedShell),
    model,
    profiles,
    caseSet: path.resolve(values.get("case-set") ?? path.join(import.meta.dir, "automationbench-case-set.json")),
  }
}

async function walk(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map((entry) => {
      const target = path.join(directory, entry.name)
      return entry.isDirectory() ? walk(target) : Promise.resolve([target])
    }),
  )
  return nested.flat()
}

async function sha256(file: string) {
  return crypto.createHash("sha256").update(await fs.readFile(file)).digest("hex")
}

async function inspectManifest(directory: string, payload: Result | Failure, isResult: boolean) {
  const manifestPath = path.join(directory, "evidence-manifest.json")
  const existing = await fs.readFile(manifestPath, "utf8").catch(() => undefined)
  if (existing) {
    const manifest = JSON.parse(existing) as {
      schema_version: number
      run_id?: string
      run_key?: string
      generated_at: number
      files: Array<{ path: string; bytes: number; sha256: string }>
    }
    const actualFiles = (await fs.readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name !== "evidence-manifest.json")
      .map((entry) => entry.name)
      .sort()
    const expectedFiles = manifest.files.map((entry) => entry.path).sort()
    if (!evidenceFileSetMatches(actualFiles, expectedFiles)) {
      return { ...manifest, verified: false, reason: "manifest_file_set_mismatch" }
    }
    for (const expected of manifest.files) {
      const file = path.join(directory, expected.path)
      const stat = await fs.stat(file)
      const actualHash = await sha256(file)
      if (stat.size !== expected.bytes || actualHash !== expected.sha256) {
        return { ...manifest, verified: false, reason: `manifest_hash_mismatch:${expected.path}` }
      }
    }
    if (manifest.run_id !== undefined && manifest.run_id !== payload.run.id) {
      return { ...manifest, verified: false, reason: "manifest_run_id_mismatch" }
    }
    if (manifest.run_key !== undefined && manifest.run_key !== payload.run.key) {
      return { ...manifest, verified: false, reason: "manifest_run_key_mismatch" }
    }
    if ((payload.run.id || payload.run.key) && (manifest.run_id === undefined || manifest.run_key === undefined)) {
      const sourceRecorded = isResult && (payload as Result).opencorvus.source !== undefined
      if (sourceRecorded) return { ...manifest, verified: false, reason: "manifest_identity_missing" }
    }
    return { ...manifest, verified: true }
  }
  if (isResult || payload.run.id || payload.run.key) {
    return { schema_version: 1, generated_at: null, files: [], verified: false, reason: "sealed_manifest_missing" }
  }
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name !== "evidence-manifest.json")
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(async (entry) => {
        const file = path.join(directory, entry.name)
        const stat = await fs.stat(file)
        return { path: entry.name, bytes: stat.size, sha256: await sha256(file) }
      }),
  )
  const manifest = {
    schema_version: 1,
    generated_at: Date.now(),
    files,
  }
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" })
  return { ...manifest, verified: true, legacy_generated: true }
}

function percent(value: number | undefined) {
  return value === undefined ? "—" : `${(value * 100).toFixed(2)}%`
}

function integer(value: number | undefined) {
  return value === undefined ? "—" : Math.round(value).toLocaleString("en-US")
}

function duration(value: number | undefined) {
  return value === undefined ? "—" : `${(value / 60_000).toFixed(2)} min`
}

function relativeChange(current: number, baseline: number) {
  if (baseline === 0) return "—"
  const change = ((current - baseline) / baseline) * 100
  return `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`
}

async function inspectProviderLedger(directory: string, result: Result | undefined, model: string) {
  if (!result) return { required: false, passed: true }
  const ledgerPath = path.join(directory, "provider-usage-ledger.json")
  const raw = await fs.readFile(ledgerPath, "utf8").catch(() => undefined)
  if (!raw) return { required: result.opencorvus.source?.worktree_clean === true, passed: false, reason: "provider_ledger_missing" }
  const rows = JSON.parse(raw) as ProviderUsageRow[]
  const aggregate = summarizeProviderUsageRows(rows)
  const expected = result.opencorvus.tokens ?? {}
  const fields = ["input", "output", "reasoning", "cacheRead", "cacheWrite", "total", "costUSD", "pricedCalls", "unpricedCalls", "modelCalls"]
  const mismatches = fields.filter((field) => aggregate[field as keyof typeof aggregate] !== expected[field])
  const identityAudit = providerUsageMatchesModel(rows, model)
  const identityMismatch = !identityAudit.passed
  return {
    required: true,
    passed: mismatches.length === 0 && !identityMismatch,
    rows: rows.length,
    aggregate,
    mismatches,
    identity_mismatch: identityMismatch,
    expected_provider_id: identityAudit.provider_id,
    expected_model_id: identityAudit.model_id,
  }
}

async function inspectPermanentInvalidation(directory: string, manifest: Record<string, any>) {
  const names = await fs.readdir(directory)
  return permanentRunInvalidation(names, manifest)
}

async function replayScorer(directory: string, result: Result, python: string) {
  const benchmark = result.benchmark as any
  const expected = {
    partial_credit: benchmark.diagnostic_metrics?.partial_credit ?? benchmark.metrics?.partial_credit,
    task_completed_correctly:
      benchmark.diagnostic_metrics?.task_completed_correctly ?? benchmark.metrics?.task_completed_correctly,
    assertion_results: benchmark.assertion_results,
    end_state_sha256: benchmark.end_state_sha256,
    initial_world_sha256: benchmark.initial_world_sha256,
    final_world_sha256: benchmark.final_world_sha256,
    tool_attempts: benchmark.tool_attempts,
    tool_succeeded: benchmark.tool_succeeded,
    tool_failed: benchmark.tool_failed,
  }
  const child = Bun.spawn(
    [
      python,
      path.join(import.meta.dir, "verify_automationbench_replay.py"),
      "--domain",
      benchmark.domain,
      "--task",
      benchmark.task,
      "--events",
      path.join(directory, "automationbench-events.jsonl"),
      "--initial-world",
      path.join(directory, "automationbench-initial-world.json"),
      "--final-world",
      path.join(directory, "automationbench-final-world.json"),
    ],
    { cwd: import.meta.dir, stdin: "pipe", stdout: "pipe", stderr: "pipe" },
  )
  child.stdin.write(JSON.stringify(expected))
  child.stdin.end()
  const [exitCode, stdout] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  if (exitCode !== 0) throw new Error("independent_scorer_replay_failed")
  return JSON.parse(stdout)
}

async function inspectRawRunEvidence(
  directory: string,
  result: Result | undefined,
  input: {
    sourceData: string
    python: string
    protectedSecrets: Array<{ label: string; value: string }>
    wrapperSHA256: string
  },
) {
  if (!result) return { required: false, passed: true }
  const required = result.opencorvus.source?.worktree_clean === true
  try {
    const [
      board,
      receipt,
      transcript,
      benchmarkEvents,
      scorerReplay,
      sandboxAudit,
      protectedRootAudit,
      skillProjection,
      runtimeSnapshot,
    ] = await Promise.all([
      fs.readFile(path.join(directory, "terminal-board.json"), "utf8").then(JSON.parse),
      fs.readFile(path.join(directory, "task-receipt.json"), "utf8").then(JSON.parse),
      fs.readFile(path.join(directory, "opencorvus-transcript.json"), "utf8").then(JSON.parse),
      fs
        .readFile(path.join(directory, "automationbench-events.jsonl"), "utf8")
        .then((text) => text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))),
      fs.readFile(path.join(directory, "scorer-replay-audit.json"), "utf8").then(JSON.parse),
      fs.readFile(path.join(directory, "sandbox-isolation-audit.json"), "utf8").then(JSON.parse),
      fs.readFile(path.join(directory, "protected-root-isolation-audit.json"), "utf8").then(JSON.parse),
      fs.readFile(path.join(directory, "skill-projection.json"), "utf8").then(JSON.parse),
      // Runs sealed before the snapshot existed still have to be classifiable,
      // so absence is handed to the audit as a missing source rather than
      // failing the whole raw-evidence read as `raw_evidence_missing`.
      fs
        .readFile(path.join(directory, "runtime-database-snapshot.json"), "utf8")
        .then(JSON.parse)
        .catch(() => undefined),
    ])
    const requestedProfile = receipt.request?.promptProfile
    const boundProfile = board.task?.packageRevisionBinding?.id
    const boardTaskID = board.task?.id
    const responseTaskID = receipt.response?.task_id
    const boardWorkflow = board.task?.completionDecision?.workflowBinding ?? null
    const requestHash = crypto.createHash("sha256").update(String(receipt.request?.request ?? "")).digest("hex")
    const bindingAudit = auditRunBinding({
      resultProfile: result.opencorvus.profile,
      resultTaskID: result.opencorvus.task_id,
      resultWorkflow: (result.opencorvus as any).workflow_binding,
      resultSelectedWorkflowID: (result.opencorvus as any).selected_workflow_id,
      requestedProfile,
      boundProfile,
      boardTaskID,
      responseTaskID,
      boardWorkflow,
    })
    const profilePassed = bindingAudit.passed
    const taskOutcomeAudit = auditTaskOutcome(result.opencorvus.lifecycle_status, transcript)
    const taskOutcomePassed =
      taskOutcomeAudit.passed &&
      JSON.stringify((result.opencorvus as any).task_outcome_audit ?? null) === JSON.stringify(taskOutcomeAudit)
    const terminalQuiescenceAudit = auditTerminalQuiescence(board)
    const terminalQuiescencePassed =
      terminalQuiescenceAudit.passed &&
      JSON.stringify((result.opencorvus as any).terminal_quiescence_audit ?? null) ===
        JSON.stringify(terminalQuiescenceAudit)
    const taskInfrastructureAudit = auditTaskInfrastructureIncidents({ snapshot: runtimeSnapshot, board })
    const taskInfrastructurePassed = taskInfrastructureAudit.passed
    const skillSeal = auditSkillEvidenceSeal({
      profile: result.opencorvus.profile,
      resultSkill: result.opencorvus.skill,
      projectionFile: skillProjection,
      transcript,
    })
    const skillPassed = skillSeal.passed
    const isolation = auditBenchmarkIsolation(transcript, {
      protectedPaths: [
        path.dirname(path.dirname(input.python)),
        input.sourceData,
        path.join(input.sourceData, "auth.json"),
        path.join(input.sourceData, "models.json"),
      ],
      forbiddenMarkers: [
        "/admin/task",
        "/admin/score",
        "task_contract_sha256",
        "automationbench.rubric",
        "task_completed_correctly",
        "assertion_results",
        "automationbench_bridge.py",
        "site-packages/automationbench",
        "opencorvus-home/data/auth.json",
        "opencorvus-home\\data\\auth.json",
      ],
      protectedSecrets: input.protectedSecrets,
    })
    const toolAudit = summarizeBenchmarkToolEvents(benchmarkEvents)
    const toolPassed =
      toolAudit.sequenceValid &&
      toolAudit.scoreEvents === 1 &&
      toolAudit.attempts === result.benchmark.tool_attempts &&
      toolAudit.succeeded === result.benchmark.tool_succeeded &&
      toolAudit.failed === result.benchmark.tool_failed &&
      result.benchmark.tool_calls === result.benchmark.tool_attempts
    const requestPassed = requestHash === result.benchmark.harness_request_sha256
    const independentReplay = await replayScorer(directory, result, input.python)
    const replayPassed =
      scorerReplay.passed === true &&
      scorerReplay.example_id === (result.benchmark as any).example_id &&
      JSON.stringify(independentReplay) === JSON.stringify(scorerReplay)
    const expectedAgentUID = 60_000 + Number((result.benchmark as any).case_index)
    const sandboxPassed =
      sandboxAudit.passed === true &&
      sandboxAudit.boundary === "linux_mount_namespace_unique_uid_unix_socket" &&
      sandboxAudit.wrapper_sha256 === input.wrapperSHA256 &&
      sandboxAudit.uid === expectedAgentUID &&
      sandboxAudit.home === "private" &&
      sandboxAudit.socket === "scoped"
    const hostBoundaryPassed =
      protectedRootAudit.passed === true &&
      protectedRootAudit.evidence?.uid === 0 &&
      protectedRootAudit.evidence?.mode === "700" &&
      protectedRootAudit.control?.uid === 0 &&
      protectedRootAudit.control?.mode === "700"
    // Ordered most-specific first: a disposition that says `raw_evidence_mismatch`
    // for every failure mode makes the ten checks below indistinguishable in the
    // catalog, which is how a whole batch of infrastructure-faulted runs read as
    // ordinary scores.
    const violations = [
      ...(profilePassed ? [] : ["profile_binding_mismatch"]),
      ...(taskInfrastructurePassed ? [] : taskInfrastructureAudit.violations),
      ...(taskOutcomePassed ? [] : ["task_outcome_mismatch"]),
      ...(terminalQuiescencePassed ? [] : ["terminal_quiescence_failed"]),
      ...(skillPassed ? [] : skillSeal.violations.map((item) => `skill:${item}`)),
      ...(isolation.passed ? [] : ["evaluator_isolation_failed"]),
      ...(toolPassed ? [] : ["benchmark_tool_ledger_mismatch"]),
      ...(requestPassed ? [] : ["harness_request_hash_mismatch"]),
      ...(replayPassed ? [] : ["scorer_replay_mismatch"]),
      ...(sandboxPassed ? [] : ["sandbox_isolation_failed"]),
      ...(hostBoundaryPassed ? [] : ["host_boundary_isolation_failed"]),
    ]
    const passed = violations.length === 0
    return {
      required,
      passed,
      ...(passed ? {} : { reason: violations[0], violations }),
      task_infrastructure_audit: taskInfrastructureAudit,
      task_infrastructure_passed: taskInfrastructurePassed,
      profile_passed: profilePassed,
      task_outcome_audit: taskOutcomeAudit,
      task_outcome_passed: taskOutcomePassed,
      terminal_quiescence_audit: terminalQuiescenceAudit,
      terminal_quiescence_passed: terminalQuiescencePassed,
      skill_projection_audit: skillSeal.projection,
      skill_dispatched_coverage_audit: skillSeal.coverage,
      skill_evidence_violations: skillSeal.violations,
      skill_projection_passed: skillPassed,
      isolation,
      tool_audit: toolAudit,
      tool_passed: toolPassed,
      request_hash_passed: requestPassed,
      scorer_replay_passed: replayPassed,
      sandbox_isolation_passed: sandboxPassed,
      host_boundary_isolation_passed: hostBoundaryPassed,
    }
  } catch (error) {
    return {
      required,
      passed: false,
      reason:
        error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT"
          ? "raw_evidence_missing"
          : "raw_evidence_invalid",
    }
  }
}

function strictScore(value: number | undefined) {
  if (value === undefined) return "—"
  return `${Math.round(value)}/1`
}

const cli = await arguments_()
const root = cli.root
await fs
  .writeFile(
    path.join(root, "run-dispositions.json"),
    JSON.stringify({ schema_version: 1, runs: {} }, null, 2) + "\n",
    { encoding: "utf8", flag: "wx" },
  )
  .catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "EEXIST") throw error
  })
const [restrictedShellBytes, expectedRestrictedShellBytes, restrictedShellStat] = await Promise.all([
  fs.readFile(cli.restrictedShell),
  fs.readFile(path.join(import.meta.dir, "restricted-agent-shell.sh")),
  fs.stat(cli.restrictedShell),
])
const restrictedShellSHA256 = crypto.createHash("sha256").update(restrictedShellBytes).digest("hex")
if (
  restrictedShellSHA256 !== crypto.createHash("sha256").update(expectedRestrictedShellBytes).digest("hex") ||
  restrictedShellStat.uid !== 0 ||
  (restrictedShellStat.mode & 0o022) !== 0
) {
  throw new Error("Catalog requires the frozen root-owned restricted Agent shell")
}
const caseSetBytes = await fs.readFile(cli.caseSet)
const caseSetSHA256 = crypto.createHash("sha256").update(caseSetBytes).digest("hex")
const caseSet = JSON.parse(caseSetBytes.toString("utf8")) as {
  selection: { count: number; dataset_index_sha256: string }
  cases: Array<{
    domain: string
    task: string
    example_id: string | number
    task_contract_sha256: string
    case_index: number
    batch_index: number
  }>
}
const caseSetCanonicalSHA256 = crypto.createHash("sha256").update(JSON.stringify(caseSet)).digest("hex")
if (caseSet.selection?.count !== 50 || caseSet.cases?.length !== 50)
  throw new Error("Catalog requires the frozen 50-case manifest")
await fs.writeFile(path.join(root, "automationbench-case-set.json"), caseSetBytes)
const protectedSecrets = sourceAuthSecretLeaves(
  JSON.parse(await fs.readFile(path.join(cli.sourceData, "auth.json"), "utf8")),
)
const dispositions = JSON.parse(
  await fs.readFile(path.join(root, "run-dispositions.json"), "utf8").catch(() => '{"runs":{}}'),
) as { runs: Record<string, { status: string; reason: string }> }
const files = await walk(root)
const records: Array<Record<string, any>> = []
const terminalDirectories = new Set(
  files
    .filter((item) => ["result.json", "failure.json"].includes(path.basename(item)))
    .map((item) => path.dirname(item)),
)

for (const directory of terminalDirectories) {
  const hasResult = files.includes(path.join(directory, "result.json"))
  const hasFailure = files.includes(path.join(directory, "failure.json"))
  const terminalAmbiguous = hasResult && hasFailure
  const file = path.join(directory, terminalAmbiguous || !hasResult ? "failure.json" : "result.json")
  const payload = JSON.parse(await fs.readFile(file, "utf8")) as Result | Failure
  const isResult = !terminalAmbiguous && path.basename(file) === "result.json"
  const result = isResult ? (payload as Result) : undefined
  const failure = isResult ? undefined : (payload as Failure)
  const disposition = payload.run.id ? dispositions.runs[payload.run.id] : undefined
  const manifest = await inspectManifest(directory, payload, isResult)
  const permanentInvalidation = terminalAmbiguous
    ? { invalid: true, reason: "multiple_terminal_records" }
    : await inspectPermanentInvalidation(directory, manifest as Record<string, any>)
  const ledgerAudit = await inspectProviderLedger(directory, result, cli.model)
  const rawEvidenceAudit = await inspectRawRunEvidence(directory, result, {
    sourceData: cli.sourceData,
    python: cli.python,
    protectedSecrets,
    wrapperSHA256: restrictedShellSHA256,
  })
  const frozenCase = result
    ? caseSet.cases.find(
        (item) => item.domain === (result.benchmark as any).domain && item.task === result.benchmark.task,
      )
    : undefined
  const benchmarkIdentityPassed =
    result?.opencorvus.model === cli.model &&
    result?.benchmark.version === "1.0.6" &&
    result.benchmark.package_tree_sha256 === EXPECTED_PACKAGE_TREE_SHA256 &&
    frozenCase !== undefined &&
    result.benchmark.task_contract_sha256 === frozenCase.task_contract_sha256 &&
    result.benchmark.example_id === frozenCase.example_id &&
    result.benchmark.case_index === frozenCase.case_index &&
    result.benchmark.batch_index === frozenCase.batch_index &&
    result.benchmark.case_set_manifest_sha256 === caseSetSHA256 &&
    result.benchmark.case_set_canonical_sha256 === caseSetCanonicalSHA256 &&
    result.benchmark.dataset_index_sha256 === caseSet.selection.dataset_index_sha256
  const evidenceChecks = paperEvidenceChecks({
    manifestVerified: manifest.verified === true,
    providerLedgerVerified: ledgerAudit.passed === true,
    profileVerified:
      result?.opencorvus.profile_audit?.passed === true && (rawEvidenceAudit as any).profile_passed === true,
    isolationVerified:
      result?.opencorvus.isolation_audit?.passed === true && (rawEvidenceAudit as any).isolation?.passed === true,
    benchmarkIdentityVerified: benchmarkIdentityPassed,
    rawEvidenceVerified: rawEvidenceAudit.passed === true,
  })
  const evidencePassed = evidenceChecks.passed
  const evidenceFailureReason =
    manifest.verified !== true
      ? manifest.reason
      : ledgerAudit.passed !== true
        ? ((ledgerAudit as any).reason ?? "provider_ledger_mismatch")
        : rawEvidenceAudit.passed !== true
          ? ((rawEvidenceAudit as any).reason ?? "raw_evidence_mismatch")
          : result?.opencorvus.profile_audit?.passed !== true
            ? "profile_audit_failed"
            : result?.opencorvus.isolation_audit?.passed !== true
              ? "isolation_audit_failed"
              : !benchmarkIdentityPassed
                ? "benchmark_identity_failed"
                : undefined
  const eligible =
    result?.run.status === "scored" &&
    result.opencorvus.task_outcome_audit?.scored_terminal === true &&
    result.opencorvus.terminal_quiescence_audit?.passed === true &&
    result.opencorvus.skill?.projection?.passed === true &&
    result.opencorvus.skill?.dispatched_coverage?.passed === true &&
    result.benchmark.metrics !== null &&
    result.opencorvus.source?.worktree_clean === true &&
    !permanentInvalidation.invalid &&
    disposition === undefined &&
    evidencePassed
  const developmentScore =
    result?.run.status === "scored" &&
    result.opencorvus.task_outcome_audit?.scored_terminal === true &&
    result.opencorvus.skill?.projection?.passed === true &&
    result.opencorvus.skill?.dispatched_coverage?.passed === true &&
    result.benchmark.metrics !== null &&
    result.opencorvus.source?.worktree_clean !== true &&
    !permanentInvalidation.invalid &&
    disposition === undefined
  // A `task-infrastructure-error` is the Host reporting its own broken write, so
  // the run is bug-affected evidence rather than unverifiable evidence: it keeps
  // its place in the all-attempt catalog and stays out of every aggregate, and
  // its reason names the fault so the rerun set is readable without opening the
  // snapshots. This sits below an explicit operator disposition, which is a
  // deliberate human classification, and above the generic evidence branch,
  // which would otherwise absorb it as `invalid_evidence`.
  const taskInfrastructureAudit = (rawEvidenceAudit as any).task_infrastructure_audit as
    | { passed: boolean; violations: string[]; counts_by_reason: Record<string, number> }
    | undefined
  const taskInfrastructureFaulted = taskInfrastructureAudit?.passed === false
  const taskInfrastructureReason = taskInfrastructureFaulted
    ? `host_${Object.keys(taskInfrastructureAudit?.counts_by_reason ?? {})
        .sort()
        .join("+")
        .replaceAll("|", "_") || "task_infrastructure_error"}`
    : undefined
  const evidenceStatus = permanentInvalidation.invalid
    ? "invalid_bug"
    : disposition
      ? disposition.status
      : taskInfrastructureFaulted
        ? "invalid_bug"
        : eligible
          ? "scored"
          : result?.opencorvus.source?.worktree_clean === true && !evidencePassed
            ? "invalid_evidence"
            : developmentScore
              ? "development_scored"
              : failure?.run.status === "blocked_preflight"
                ? "blocked_preflight"
                : "invalid"
  const reason = permanentInvalidation.invalid
    ? permanentInvalidation.reason
    : disposition
      ? disposition.reason
      : taskInfrastructureFaulted
        ? taskInfrastructureReason
        : eligible
          ? "natural_terminal_official_score"
          : result?.opencorvus.source?.worktree_clean === true && !evidencePassed
            ? evidenceFailureReason
            : developmentScore
              ? "uncommitted_or_unrecorded_source_state"
              : result
                ? `lifecycle_${result.opencorvus.lifecycle_status ?? "unknown"}`
                : `${failure?.run.stage ?? "unknown_stage"}:${failure?.error?.name ?? "unknown_error"}`
  // Phase 0 observation. Derived from sealed evidence rather than sealed by the
  // runner, so a run captured before the fingerprint existed simply reports no
  // sessions instead of failing its evidence audit.
  const promptComposition = result
    ? await fs
        .readFile(path.join(directory, "opencorvus-trace.json"), "utf8")
        .then((text) => analyzePromptComposition(JSON.parse(text) as unknown[]))
        .catch(() => undefined)
    : undefined
  const tokens = result?.opencorvus.tokens
  records.push({
    run_id: payload.run.id ?? path.basename(directory),
    run_key: payload.run.key ?? path.relative(root, directory).replaceAll("\\", "/"),
    evidence_status: evidenceStatus,
    raw_leaderboard_eligible: eligible,
    leaderboard_eligible: eligible,
    reason,
    started_at: payload.run.started_at,
    finished_at: result?.run.finished_at ?? failure?.run.failed_at ?? null,
    duration_ms: result?.run.duration_ms ?? null,
    benchmark: payload.benchmark,
    opencorvus: {
      ...payload.opencorvus,
      tokens: tokens ?? null,
    },
    failure: failure?.error ?? null,
    ...(promptComposition ? { prompt_composition: promptComposition } : {}),
    evidence_directory: path.relative(root, directory).replaceAll("\\", "/"),
    evidence_manifest: manifest,
    provider_ledger_audit: ledgerAudit,
    raw_evidence_audit: rawEvidenceAudit,
    permanent_invalidation: permanentInvalidation,
  })
}

for (const file of files.filter(
  (item) => path.basename(item) === "run-start.json" && !terminalDirectories.has(path.dirname(item)),
)) {
  const directory = path.dirname(file)
  const started = JSON.parse(await fs.readFile(file, "utf8")) as Failure
  const manifest = await inspectManifest(directory, started, false)
  const permanentInvalidation = await inspectPermanentInvalidation(directory, manifest as Record<string, any>)
  records.push({
    run_id: started.run.id ?? path.basename(directory),
    run_key: started.run.key ?? path.relative(root, directory).replaceAll("\\", "/"),
    evidence_status: permanentInvalidation.invalid ? "invalid_bug" : "orphan_unsealed",
    raw_leaderboard_eligible: false,
    leaderboard_eligible: false,
    reason: permanentInvalidation.invalid ? permanentInvalidation.reason : "started_attempt_without_terminal_record",
    started_at: started.run.started_at,
    finished_at: null,
    duration_ms: null,
    benchmark: started.benchmark,
    opencorvus: started.opencorvus,
    failure: null,
    evidence_directory: path.relative(root, directory).replaceAll("\\", "/"),
    evidence_manifest: manifest,
    provider_ledger_audit: { required: false, passed: false, reason: "terminal_record_missing" },
    raw_evidence_audit: { required: false, passed: false, reason: "terminal_record_missing" },
    permanent_invalidation: permanentInvalidation,
  })
}

const batchPlanArtifacts = await walk(path.join(root, "batch-plans")).catch(() => [] as string[])
const batchAudits = await Promise.all(
  batchPlanArtifacts
    .filter((file) => file.endsWith("-plan.json"))
    .map(async (planPath) => {
      const planBytes = await fs.readFile(planPath)
      const plan = JSON.parse(planBytes.toString("utf8"))
      const prefix = planPath.slice(0, -"-plan.json".length)
      const receipt = await fs
        .readFile(`${prefix}-receipt.json`, "utf8")
        .then(JSON.parse)
        .catch(() => undefined)
      const waveCompletion = await fs
        .readFile(`${prefix}-wave-1-complete.json`, "utf8")
        .then(JSON.parse)
        .catch(() => undefined)
      const planSHA256 = crypto.createHash("sha256").update(planBytes).digest("hex")
      const audit = auditBatchEvidence({ plan, receipt, waveCompletion, attempts: records, planSHA256 })
      const referencedRunIDs = new Set(reusableBatchCandidateRunIDs(audit))
      return {
        batch_run_id: plan.batch_run_id,
        batch_index: plan.batch_index,
        plan: path.relative(root, planPath).replaceAll("\\", "/"),
        plan_sha256: planSHA256,
        receipt_present: receipt !== undefined,
        audit,
        referenced_run_ids: [...referencedRunIDs],
        eligible_run_ids: (audit.eligible_run_ids ?? []).map(String),
        adopted_run_ids: (audit.adopted_run_ids ?? []).map(String),
      }
    }),
)
for (let pass = 0; pass < batchAudits.length; pass++) {
  let changed = false
  for (const batch of batchAudits.filter((item) => item.audit.passed === true && item.adopted_run_ids.length > 0)) {
    const dependenciesPassed = batch.adopted_run_ids.every((runID) =>
      batchAudits.some(
        (candidate) =>
          candidate.batch_run_id !== batch.batch_run_id &&
          candidate.referenced_run_ids.includes(runID),
      ),
    )
    if (!dependenciesPassed) {
      batch.audit = {
        ...batch.audit,
        passed: false,
        status: "invalid",
        reasons: [...batch.audit.reasons, "preexisting_run_not_independently_sealed"],
      }
      changed = true
    }
  }
  if (!changed) break
}
for (const record of records.filter((item) => item.leaderboard_eligible)) {
  const candidateBatch = batchAudits.find(
    (item) => item.receipt_present && item.referenced_run_ids.includes(String(record.run_id)),
  )
  record.batch_candidate_eligible = candidateBatch !== undefined
  const completedBatch = batchAudits.find(
    (item) =>
      item.receipt_present &&
      item.audit.passed === true &&
      item.audit.status === "completed" &&
      item.eligible_run_ids.includes(String(record.run_id)),
  )
  if (!completedBatch) {
    record.leaderboard_eligible = false
    record.evidence_status = candidateBatch ? "sealed_candidate" : "invalid_evidence"
    record.reason = candidateBatch ? "awaiting_completed_batch" : "batch_evidence_failed"
  }
}
for (const record of records.filter((item) => item.batch_candidate_eligible === undefined)) {
  record.batch_candidate_eligible = false
}

records.sort((left, right) => left.started_at - right.started_at)
const eligible = records.filter((record) => record.leaderboard_eligible)
function summarizeProfile(profile: "base" | "advanced") {
  const rows = eligible.filter((record) => record.opencorvus.profile === profile)
  const keys = rows.map((record) => `${record.benchmark.case_index}:${record.benchmark.repetition ?? 1}`)
  if (new Set(keys).size !== keys.length)
    throw new Error(`Eligible ${profile} runs contain duplicate case/repetition identities`)
  const expectedKeys = Array.from({ length: 50 }, (_, index) => `${index + 1}:1`)
  const matrixComplete = JSON.stringify([...keys].sort()) === JSON.stringify(expectedKeys.sort())
  const strictPasses = rows.reduce(
    (sum, record) => sum + Number(record.benchmark.metrics?.task_completed_correctly ?? 0),
    0,
  )
  const partialTotal = rows.reduce((sum, record) => sum + Number(record.benchmark.metrics?.partial_credit ?? 0), 0)
  const totals = (field: string) =>
    rows.reduce((sum, record) => sum + Number(record.opencorvus.tokens?.[field] ?? 0), 0)
  const durationTotal = rows.reduce((sum, record) => sum + Number(record.duration_ms ?? 0), 0)
  return {
    profile,
    target_cases: 50,
    completed_cases: rows.length,
    matrix_complete: matrixComplete,
    strict_passes: strictPasses,
    strict_success_rate: rows.length === 0 ? null : strictPasses / rows.length,
    partial_credit_mean: rows.length === 0 ? null : partialTotal / rows.length,
    tokens_total: totals("total"),
    output_tokens_total: totals("output"),
    model_calls_total: totals("modelCalls"),
    benchmark_attempts_total: rows.reduce((sum, record) => sum + Number(record.benchmark.tool_attempts ?? 0), 0),
    benchmark_failed_total: rows.reduce((sum, record) => sum + Number(record.benchmark.tool_failed ?? 0), 0),
    duration_ms_total: durationTotal,
    duration_ms_mean: rows.length === 0 ? null : durationTotal / rows.length,
  }
}
const profileSummaries = cli.profiles.map(summarizeProfile)
const exploratoryProfileSummaries = (["base", "advanced"] as const)
  .filter((profile) => !cli.profiles.includes(profile))
  .map(summarizeProfile)
const primaryEligible = eligible.filter((record) => cli.profiles.includes(record.opencorvus.profile))
const completeSummaries = profileSummaries.filter((summary) => summary.matrix_complete)
const internalRanking = [...completeSummaries]
  .sort(
    (left, right) =>
      Number(right.strict_success_rate) - Number(left.strict_success_rate) ||
      Number(right.partial_credit_mean) - Number(left.partial_credit_mean) ||
      left.tokens_total - right.tokens_total,
  )
  .map((summary, index) => ({ rank: index + 1, profile: summary.profile }))
const base = profileSummaries.find((summary) => summary.profile === "base")
const advanced = profileSummaries.find((summary) => summary.profile === "advanced")
const catalog = {
  schema_version: 1,
  generated_at: Date.now(),
  scope: {
    round: 1,
    benchmark: "AutomationBench",
    model: cli.model,
    profiles: cli.profiles,
    exploratory_profiles: exploratoryProfileSummaries.map((summary) => summary.profile),
    note: "Every attempt is evidence; only natural terminal official scores enter the self-owned leaderboard.",
  },
  public_context: {
    comparability: "context_only_private_held_out_vs_local_public_50_case_set",
    exact_primary_model_listed: false,
    automationbench_version: "1.0.6",
    snapshot_date: "2026-08-20",
    source: "https://zapier.com/benchmarks",
    rows: [
      { model: "Gemini 3.7 Flash High", strict_success_rate: 0.3044 },
      { model: "Claude Opus 5 Max", strict_success_rate: 0.2694 },
      { model: "GPT-5.6 Terra Max", strict_success_rate: 0.21 },
      { model: "GPT-5.6 Sol Max", strict_success_rate: 0.1963 },
    ],
  },
  attempts: records,
  candidates: records.filter((record) => record.batch_candidate_eligible),
  leaderboard: eligible,
  primary_leaderboard: primaryEligible,
  profile_summaries: profileSummaries,
  exploratory_profile_summaries: exploratoryProfileSummaries,
  internal_ranking: internalRanking,
  batches: batchAudits,
}

await fs.writeFile(path.join(root, "evidence-catalog.json"), JSON.stringify(catalog, null, 2) + "\n")

const lines = [
  "# AutomationBench round 1 · OpenCorvus self-owned leaderboard",
  "",
  `This board contains only \`${cli.model}\` runs made through the OpenCorvus harness. Every attempt is retained below; only a clean-source, natural OpenCorvus \`completed\` terminal state followed by the official AutomationBench scorer is leaderboard-eligible.`,
  "",
  "## Primary 50-case profile summary",
  "",
  "| Internal rank | Profile | Coverage | Strict | Partial mean | Total tokens | Output tokens | Model calls | API attempts | Failed API | Mean duration |",
  "| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ...profileSummaries.map((summary) => {
    const rank = internalRanking.find((item) => item.profile === summary.profile)?.rank
    return `| ${rank ?? "—"} | ${summary.profile} | ${summary.completed_cases}/${summary.target_cases} | ${summary.strict_passes}/${summary.completed_cases || 0} (${percent(summary.strict_success_rate ?? undefined)}) | ${percent(summary.partial_credit_mean ?? undefined)} | ${integer(summary.tokens_total)} | ${integer(summary.output_tokens_total)} | ${integer(summary.model_calls_total)} | ${integer(summary.benchmark_attempts_total)} | ${integer(summary.benchmark_failed_total)} | ${duration(summary.duration_ms_mean ?? undefined)} |`
  }),
  ...(base?.matrix_complete && advanced?.matrix_complete
    ? [
        "",
        "## Advanced versus Base",
        "",
        "| Metric | Base | Advanced | Advanced − Base |",
        "| --- | ---: | ---: | ---: |",
        `| Strict success | ${percent(base.strict_success_rate ?? undefined)} | ${percent(advanced.strict_success_rate ?? undefined)} | ${base.strict_success_rate === null || advanced.strict_success_rate === null ? "—" : ((advanced.strict_success_rate - base.strict_success_rate) * 100).toFixed(2) + " pp"} |`,
        `| Partial credit mean | ${percent(base.partial_credit_mean ?? undefined)} | ${percent(advanced.partial_credit_mean ?? undefined)} | ${base.partial_credit_mean === null || advanced.partial_credit_mean === null ? "—" : ((advanced.partial_credit_mean - base.partial_credit_mean) * 100).toFixed(2) + " pp"} |`,
        `| Total tokens | ${integer(base.tokens_total)} | ${integer(advanced.tokens_total)} | ${relativeChange(advanced.tokens_total, base.tokens_total)} |`,
        `| Text output tokens | ${integer(base.output_tokens_total)} | ${integer(advanced.output_tokens_total)} | ${relativeChange(advanced.output_tokens_total, base.output_tokens_total)} |`,
        `| Model calls | ${integer(base.model_calls_total)} | ${integer(advanced.model_calls_total)} | ${relativeChange(advanced.model_calls_total, base.model_calls_total)} |`,
        `| Benchmark API attempts | ${integer(base.benchmark_attempts_total)} | ${integer(advanced.benchmark_attempts_total)} | ${relativeChange(advanced.benchmark_attempts_total, base.benchmark_attempts_total)} |`,
        `| Mean duration | ${duration(base.duration_ms_mean ?? undefined)} | ${duration(advanced.duration_ms_mean ?? undefined)} | ${base.duration_ms_mean === null || advanced.duration_ms_mean === null ? "—" : relativeChange(advanced.duration_ms_mean, base.duration_ms_mean)} |`,
      ]
    : []),
  "",
  "## Primary eligible per-case scores",
  "",
  "| Case | Batch | Profile | Task | Strict | Partial | Total tokens | Model calls | API attempts | API failures | Duration |",
  "| ---: | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ...primaryEligible.map((record) => {
    const metrics = record.benchmark.metrics
    const tokens = record.opencorvus.tokens
    return `| ${record.benchmark.case_index} | ${record.benchmark.batch_index} | ${record.opencorvus.profile} | ${record.benchmark.task} | ${strictScore(metrics.task_completed_correctly)} | ${percent(metrics.partial_credit)} | ${integer(tokens?.total)} | ${integer(tokens?.modelCalls)} | ${integer(record.benchmark.tool_attempts)} | ${integer(record.benchmark.tool_failed)} | ${duration(record.duration_ms)} |`
  }),
  "",
  "## All attempts (paper evidence index)",
  "",
  "| Started | Profile | Status | Reason | Task ID | Evidence |",
  "| --- | --- | --- | --- | --- | --- |",
  ...records.map(
    (record) =>
      `| ${new Date(record.started_at).toISOString()} | ${record.opencorvus.profile} | ${record.evidence_status} | ${record.reason} | ${record.opencorvus.task_id ?? "—"} | [manifest](${record.evidence_directory}/evidence-manifest.json) |`,
  ),
  "",
  "## Public leaderboard context (not numerically comparable)",
  "",
  `The official AutomationBench board uses a private held-out set, while this round uses a deterministic 50-case public set. The exact \`${cli.model}\` configuration is not an official comparable row; in particular, the published GPT-5.6 Terra Max row is not relabeled as this run. No cross-dataset position, rank, slot, statistical estimate, or numeric delta is computed.`,
  "",
  "| Official row | Strict success rate |",
  "| --- | ---: |",
  ...catalog.public_context.rows.map((row) => `| ${row.model} | ${percent(row.strict_success_rate)} |`),
  "",
  `Snapshot: [AutomationBench official leaderboard](${catalog.public_context.source}), ${catalog.public_context.snapshot_date}.`,
  "",
]
await fs.writeFile(path.join(root, "leaderboard.md"), lines.join("\n"))
const paperArtifacts = [
  path.join(root, "automationbench-case-set.json"),
  path.join(root, "run-dispositions.json"),
  path.join(root, "evidence-catalog.json"),
  path.join(root, "leaderboard.md"),
  ...batchPlanArtifacts,
  ...eligible.flatMap((record) => [
    path.join(root, record.evidence_directory, "result.json"),
    path.join(root, record.evidence_directory, "evidence-manifest.json"),
  ]),
]
const paperFiles = await Promise.all(
  paperArtifacts.map(async (file) => {
    const stat = await fs.stat(file)
    return { path: path.relative(root, file).replaceAll("\\", "/"), bytes: stat.size, sha256: await sha256(file) }
  }),
)
await fs.writeFile(
  path.join(root, "paper-artifact-manifest.json"),
  JSON.stringify({ schema_version: 1, generated_at: Date.now(), files: paperFiles }, null, 2) + "\n",
)
process.stdout.write(JSON.stringify({ root, attempts: records.length, eligible: eligible.length }) + "\n")
