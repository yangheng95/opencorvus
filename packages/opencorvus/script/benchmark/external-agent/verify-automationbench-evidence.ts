import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import {
  auditBenchmarkIsolation,
  auditAutomationBenchBatchPlanSchema,
  auditBatchEvidence,
  auditSkillEvidenceSeal,
  auditTaskInfrastructureIncidents,
  auditMissionOutcome,
  auditMissionEvidenceLineage,
  auditMissionEvidenceCollections,
  auditTaskBoundPromptCompositionCoverage,
  auditTaskTraceScopeSeal,
  auditLegacyTraceEnvironmentAttestation,
  auditBatchReceiptRedaction,
  auditMissionQuiescence,
  auditMissionRunBinding,
  evidenceFileSetMatches,
  missingCompletedBatchProfileReceipts,
  reusableBatchCandidateRunIDs,
  sourceAuthSecretLeaves,
  summarizeBenchmarkToolEvents,
  summarizeProviderUsageRows,
  providerUsageMatchesModel,
  type ProviderUsageRow,
} from "./contract"

const values = new Map<string, string>()
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index]
  const value = process.argv[index + 1]
  if (!key?.startsWith("--") || value === undefined)
    throw new Error("Expected --root, --source-data, and --python values")
  values.set(key.slice(2), value)
}
const rootValue = values.get("root")
const sourceDataValue = values.get("source-data")
const pythonValue = values.get("python")
const restrictedShellValue = values.get("restricted-shell")
const model = values.get("model")
if (!rootValue || !sourceDataValue || !pythonValue || !restrictedShellValue || !model) {
  throw new Error("--root, --source-data, --python, --restricted-shell, and --model are required")
}
const root = path.resolve(rootValue)
const sourceData = path.resolve(sourceDataValue)
const python = path.resolve(pythonValue)
const restrictedShell = path.resolve(restrictedShellValue)
const finalMode = values.get("mode") === "final"
const repetitions = Number(values.get("repetitions") ?? 1)
if (!Number.isInteger(repetitions) || repetitions < 1) throw new Error("--repetitions must be a positive integer")
const finalProfiles = (values.get("profiles") ?? "base,advanced").split(",").map((item) => item.trim())
if (
  finalProfiles.length < 1 ||
  finalProfiles.length > 2 ||
  new Set(finalProfiles).size !== finalProfiles.length ||
  finalProfiles.some((profile) => profile !== "base" && profile !== "advanced")
) {
  throw new Error("--profiles must be base, advanced, or base,advanced")
}
const caseSetPath = path.resolve(values.get("case-set") ?? path.join(import.meta.dir, "automationbench-case-set.json"))
const [restrictedShellBytes, expectedRestrictedShellBytes, restrictedShellStat] = await Promise.all([
  fs.readFile(restrictedShell),
  fs.readFile(path.join(import.meta.dir, "restricted-agent-shell.sh")),
  fs.stat(restrictedShell),
])
const restrictedShellSHA256 = digest(restrictedShellBytes)
if (
  restrictedShellSHA256 !== digest(expectedRestrictedShellBytes) ||
  restrictedShellStat.uid !== 0 ||
  (restrictedShellStat.mode & 0o022) !== 0
) {
  throw new Error("Verifier requires the frozen root-owned restricted Agent shell")
}

function digest(bytes: Uint8Array | string) {
  return crypto.createHash("sha256").update(bytes).digest("hex")
}

function canonicalJSON(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJSON(item)}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

async function walk(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  return (
    await Promise.all(
      entries.map((entry) => {
        const target = path.join(directory, entry.name)
        return entry.isDirectory() ? walk(target) : Promise.resolve([target])
      }),
    )
  ).flat()
}

async function verifyManifest(directory: string, runID: unknown, runKey: unknown) {
  const manifest = JSON.parse(await fs.readFile(path.join(directory, "evidence-manifest.json"), "utf8")) as {
    run_id?: string
    run_key?: string
    files: Array<{ path: string; bytes: number; sha256: string }>
  }
  if (
    (runID !== undefined && manifest.run_id !== runID) ||
    (runKey !== undefined && manifest.run_key !== runKey) ||
    ((runID !== undefined || runKey !== undefined) && (manifest.run_id === undefined || manifest.run_key === undefined))
  ) {
    throw new Error(`Run manifest identity mismatch: ${directory}`)
  }
  const actual = (await fs.readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name !== "evidence-manifest.json")
    .map((entry) => entry.name)
  if (
    !evidenceFileSetMatches(
      actual,
      manifest.files.map((entry) => entry.path),
    )
  ) {
    throw new Error(`Run manifest file-set mismatch: ${directory}`)
  }
  for (const expected of manifest.files) {
    const bytes = await fs.readFile(path.join(directory, expected.path))
    if (bytes.byteLength !== expected.bytes || digest(bytes) !== expected.sha256) {
      throw new Error(`Run manifest content mismatch: ${path.join(directory, expected.path)}`)
    }
  }
  return manifest as typeof manifest & { redacted_from_manifest_sha256?: string }
}

async function replayScore(directory: string, payload: Record<string, any>) {
  const expected = {
    partial_credit: payload.benchmark.diagnostic_metrics?.partial_credit ?? payload.benchmark.metrics?.partial_credit,
    task_completed_correctly:
      payload.benchmark.diagnostic_metrics?.task_completed_correctly ??
      payload.benchmark.metrics?.task_completed_correctly,
    assertion_results: payload.benchmark.assertion_results,
    end_state_sha256: payload.benchmark.end_state_sha256,
    tool_attempts: payload.benchmark.tool_attempts,
    tool_succeeded: payload.benchmark.tool_succeeded,
    tool_failed: payload.benchmark.tool_failed,
    initial_world_sha256: payload.benchmark.initial_world_sha256,
    final_world_sha256: payload.benchmark.final_world_sha256,
  }
  const child = Bun.spawn(
    [
      python,
      path.join(import.meta.dir, "verify_automationbench_replay.py"),
      "--domain",
      payload.benchmark.domain,
      "--task",
      payload.benchmark.task,
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
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  if (exitCode !== 0) throw new Error(`Independent scorer replay failed: ${stderr.trim() || `exit ${exitCode}`}`)
  return JSON.parse(stdout)
}

function collectStrings(value: unknown, result: string[]) {
  if (typeof value === "string") {
    result.push(value)
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, result)
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectStrings(item, result)
  }
}

const paperManifest = JSON.parse(await fs.readFile(path.join(root, "paper-artifact-manifest.json"), "utf8")) as {
  files: Array<{ path: string; bytes: number; sha256: string }>
}
if (
  new Set(paperManifest.files.map((item) => item.path)).size !== paperManifest.files.length ||
  paperManifest.files.some((item) => path.isAbsolute(item.path) || item.path.split(/[\\/]/).includes(".."))
) {
  throw new Error("Paper artifact manifest contains duplicate or escaping paths")
}
for (const expected of paperManifest.files) {
  const bytes = await fs.readFile(path.join(root, expected.path))
  if (bytes.byteLength !== expected.bytes || digest(bytes) !== expected.sha256) {
    throw new Error(`Paper artifact mismatch: ${expected.path}`)
  }
}

const protectedSecrets = sourceAuthSecretLeaves(
  JSON.parse(await fs.readFile(path.join(sourceData, "auth.json"), "utf8")),
)
if (protectedSecrets.length === 0) throw new Error("Source auth did not contain recognized credential leaves")
const caseSetBytes = await fs.readFile(caseSetPath)
const caseSetSHA256 = digest(caseSetBytes)
const caseSet = JSON.parse(caseSetBytes.toString("utf8")) as {
  selection: { count: number; dataset_index_sha256: string }
  cases: Array<Record<string, any>>
}
const caseSetCanonicalSHA256 = digest(JSON.stringify(caseSet))
if (caseSet.selection?.count !== 50 || caseSet.cases?.length !== 50)
  throw new Error("Verifier requires the frozen 50-case manifest")
if (digest(await fs.readFile(path.join(root, "automationbench-case-set.json"))) !== caseSetSHA256) {
  throw new Error("Paper case-set copy does not match the committed frozen manifest")
}
const selector = Bun.spawn(
  [python, path.join(import.meta.dir, "freeze_automationbench_case_set.py"), "--count", "50"],
  { cwd: import.meta.dir, stdout: "pipe", stderr: "pipe" },
)
const [selectorExit, selectorStdout, selectorStderr] = await Promise.all([
  selector.exited,
  new Response(selector.stdout).text(),
  new Response(selector.stderr).text(),
])
if (selectorExit !== 0 || canonicalJSON(JSON.parse(selectorStdout)) !== canonicalJSON(caseSet)) {
  throw new Error(
    `Frozen case selector did not reproduce the committed manifest: ${selectorStderr.trim() || selectorExit}`,
  )
}
const secretFindings: string[] = []
for (const file of await walk(root)) {
  if ([".png", ".jpg", ".jpeg", ".gif"].includes(path.extname(file).toLowerCase())) continue
  const text = await fs.readFile(file, "utf8")
  const strings = [text]
  if (path.extname(file).toLowerCase() === ".json") {
    try {
      collectStrings(JSON.parse(text), strings)
    } catch {}
  } else if (path.extname(file).toLowerCase() === ".jsonl") {
    for (const line of text.split(/\r?\n/).filter(Boolean)) {
      try {
        collectStrings(JSON.parse(line), strings)
      } catch {
        secretFindings.push(path.relative(root, file).replaceAll("\\", "/"))
      }
    }
  }
  const ephemeral = /tool_token.{0,120}?[0-9a-f]{48}\b/is.test(text) || /Bearer\s+[0-9a-f]{48}\b/i.test(text)
  const sourceSecret = protectedSecrets.some((secret) => strings.some((value) => value.includes(secret.value)))
  if (ephemeral || sourceSecret) secretFindings.push(path.relative(root, file).replaceAll("\\", "/"))
}
if (secretFindings.length > 0) {
  throw new Error(`Evidence contains protected credential material: ${[...new Set(secretFindings)].join(", ")}`)
}

const catalog = JSON.parse(await fs.readFile(path.join(root, "evidence-catalog.json"), "utf8")) as {
  scope?: { profiles?: string[]; model?: string; launch_mode?: string; repetitions?: number }
  attempts: Array<Record<string, any>>
  leaderboard: Array<Record<string, any>>
  batches: Array<Record<string, any>>
}
if (catalog.scope?.model !== model || catalog.scope?.launch_mode !== "mission") {
  throw new Error("Catalog primary model/launch mode does not match the Mission verifier")
}
const discoveredAttemptDirectories = [
  ...new Set(
    (await walk(root))
      .filter((file) => ["run-start.json", "result.json", "failure.json"].includes(path.basename(file)))
      .map((file) => path.relative(root, path.dirname(file)).replaceAll("\\", "/")),
  ),
].sort()
const catalogAttemptDirectories = catalog.attempts.map((attempt) => String(attempt.evidence_directory)).sort()
if (JSON.stringify(discoveredAttemptDirectories) !== JSON.stringify(catalogAttemptDirectories)) {
  throw new Error("Catalog attempts do not cover the exact discovered run directory set")
}
const dispositions = JSON.parse(await fs.readFile(path.join(root, "run-dispositions.json"), "utf8")) as {
  runs?: Record<string, { status: string; reason: string }>
}
const legacyTraceAttestation = JSON.parse(
  await fs.readFile(path.join(root, "legacy-trace-environment-attestation.json"), "utf8").catch(() => '{"runs":[]}'),
)
const legacyTraceAttestationAudit = auditLegacyTraceEnvironmentAttestation(legacyTraceAttestation)
if ((legacyTraceAttestation.runs?.length ?? 0) > 0 && !legacyTraceAttestationAudit.passed) {
  throw new Error(`Legacy trace environment attestation failed: ${legacyTraceAttestationAudit.violations.join(", ")}`)
}
const legacyTraceRunIDs = new Set(legacyTraceAttestationAudit.run_ids)
for (const runID of legacyTraceRunIDs) {
  const attempt = catalog.attempts.find((candidate) => candidate.run_id === runID)
  if (
    !attempt ||
    dispositions.runs?.[runID]?.status === "invalid_bug" ||
    attempt.permanent_invalidation?.invalid === true ||
    attempt.raw_leaderboard_eligible !== true ||
    attempt.raw_evidence_audit?.trace_scope_audit?.mode !== "legacy_operator_attested_tail_lower_bound"
  ) {
    throw new Error(`Legacy trace attestation references an unknown or permanently invalid run: ${runID}`)
  }
}
const independentlyRawEligible: string[] = []
const independentAttempts: Array<Record<string, any>> = []
for (const attempt of catalog.attempts) {
  const directory = path.join(root, attempt.evidence_directory)
  if (attempt.evidence_status === "orphan_unsealed") {
    if (attempt.leaderboard_eligible) throw new Error(`Orphan attempt entered leaderboard: ${attempt.run_id}`)
    const started = JSON.parse(await fs.readFile(path.join(directory, "run-start.json"), "utf8"))
    if (started.run?.id !== attempt.run_id) throw new Error(`Orphan start receipt identity mismatch: ${attempt.run_id}`)
    independentAttempts.push({
      ...attempt,
      raw_leaderboard_eligible: false,
      leaderboard_eligible: false,
      started_at: started.run.started_at,
      finished_at: null,
      benchmark: started.benchmark,
      opencorvus: started.opencorvus,
    })
    continue
  }
  const names = await fs.readdir(directory)
  const terminalPath = names.includes("failure.json")
    ? path.join(directory, "failure.json")
    : path.join(directory, "result.json")
  const payload = JSON.parse(await fs.readFile(terminalPath, "utf8")) as Record<string, any>
  const runManifest = await verifyManifest(directory, undefined, undefined)
  const permanentlyInvalid =
    (names.includes("failure.json") && names.includes("result.json")) ||
    names.includes("cleanup-failure.json") ||
    names.includes("evidence-seal-failure.json") ||
    names.some((name) => /^redaction-receipt(?:-\d+)?\.json$/.test(name)) ||
    Boolean(runManifest.redacted_from_manifest_sha256)
  const disposition = dispositions.runs?.[String(payload.run.id)]
  // Recomputed here rather than read from the sealed result: the runner never
  // sealed this audit, and a Host fault that the transcript cannot show must not
  // depend on the runner having thought to record it.
  const [infrastructureSnapshot, infrastructureBoard] = await Promise.all([
    fs
      .readFile(path.join(directory, "runtime-database-snapshot.json"), "utf8")
      .then(JSON.parse)
      .catch(() => undefined),
    fs
      .readFile(path.join(directory, "terminal-board.json"), "utf8")
      .then(JSON.parse)
      .catch(() => undefined),
  ])
  const infrastructureAudit = auditTaskInfrastructureIncidents({
    snapshot: infrastructureSnapshot,
    board: infrastructureBoard,
  })
  const rawEligible =
    names.includes("result.json") &&
    infrastructureAudit.passed &&
    payload.run?.status === "scored" &&
    payload.opencorvus?.launch_mode === "mission" &&
    payload.opencorvus?.mission_outcome_audit?.scored_terminal === true &&
    payload.opencorvus?.terminal_quiescence_audit?.passed === true &&
    payload.opencorvus?.skill?.projection?.passed === true &&
    payload.opencorvus?.skill?.dispatched_coverage?.passed === true &&
    payload.benchmark?.metrics !== null &&
    payload.opencorvus?.source?.worktree_clean === true &&
    !permanentlyInvalid &&
    disposition === undefined
  if (rawEligible && (runManifest.run_id !== payload.run.id || runManifest.run_key !== payload.run.key)) {
    throw new Error(`Raw-eligible run manifest identity mismatch: ${attempt.run_id}`)
  }
  independentAttempts.push({
    ...attempt,
    raw_leaderboard_eligible: rawEligible,
    leaderboard_eligible: rawEligible,
    started_at: payload.run.started_at,
    finished_at: payload.run.finished_at ?? payload.run.failed_at ?? null,
    benchmark: payload.benchmark,
    opencorvus: payload.opencorvus,
  })
  if (attempt.raw_leaderboard_eligible !== rawEligible) {
    throw new Error(`Catalog raw eligibility does not match sealed terminal evidence: ${attempt.run_id}`)
  }
  if (!rawEligible) continue

  const frozenCase = caseSet.cases.find(
    (item) => item.domain === payload.benchmark.domain && item.task === payload.benchmark.task,
  )
  if (
    !frozenCase ||
    payload.benchmark.task_contract_sha256 !== frozenCase.task_contract_sha256 ||
    payload.benchmark.example_id !== frozenCase.example_id ||
    payload.benchmark.case_index !== frozenCase.case_index ||
    payload.benchmark.batch_index !== frozenCase.batch_index ||
    payload.benchmark.case_set_manifest_sha256 !== caseSetSHA256 ||
    payload.benchmark.case_set_canonical_sha256 !== caseSetCanonicalSHA256 ||
    payload.benchmark.dataset_index_sha256 !== caseSet.selection.dataset_index_sha256
  ) {
    throw new Error(`Frozen case identity mismatch: ${attempt.run_id}`)
  }

  const [
    board,
    receipt,
    transcript,
    missionTranscript,
    taskTranscripts,
    taskInteractions,
    interactions,
    trace,
    eventText,
    ledger,
    scorerReplay,
    sandboxAudit,
    protectedRootAudit,
    skillProjection,
  ] = await Promise.all([
    fs.readFile(path.join(directory, "terminal-board.json"), "utf8").then(JSON.parse),
    fs.readFile(path.join(directory, "mission-receipt.json"), "utf8").then(JSON.parse),
    fs.readFile(path.join(directory, "opencorvus-transcript.json"), "utf8").then(JSON.parse),
    fs.readFile(path.join(directory, "mission-transcript.json"), "utf8").then(JSON.parse),
    fs.readFile(path.join(directory, "task-transcripts.json"), "utf8").then(JSON.parse),
    fs.readFile(path.join(directory, "task-interactions.json"), "utf8").then(JSON.parse),
    fs.readFile(path.join(directory, "opencorvus-interactions.json"), "utf8").then(JSON.parse),
    fs.readFile(path.join(directory, "opencorvus-trace.json"), "utf8").then(JSON.parse),
    fs.readFile(path.join(directory, "automationbench-events.jsonl"), "utf8"),
    fs.readFile(path.join(directory, "provider-usage-ledger.json"), "utf8").then(JSON.parse) as Promise<
      ProviderUsageRow[]
    >,
    fs.readFile(path.join(directory, "scorer-replay-audit.json"), "utf8").then(JSON.parse),
    fs.readFile(path.join(directory, "sandbox-isolation-audit.json"), "utf8").then(JSON.parse),
    fs.readFile(path.join(directory, "protected-root-isolation-audit.json"), "utf8").then(JSON.parse),
    fs.readFile(path.join(directory, "skill-projection.json"), "utf8").then(JSON.parse),
  ])
  const profile = payload.opencorvus.profile
  if (receipt.launch_mode !== "mission" || board.launch_mode !== "mission") {
    throw new Error(`Mission launch receipt mismatch: ${attempt.run_id}`)
  }
  const taskBoards = Array.isArray(board.tasks) ? board.tasks : []
  const taskOutcomeAudit = auditMissionOutcome({
    missionRecord: board.mission,
    missionStatus: board.mission_status,
    missionTranscript,
    taskTranscripts: taskBoards.map((task: any) => ({
      task_id: task.task_id,
      lifecycle_status: task.board?.task?.status,
      transcript: taskTranscripts.find((candidate: any) => candidate.task_id === task.task_id)?.transcript ?? [],
    })),
  })
  const missionLineageAudit = auditMissionEvidenceLineage({
    snapshot: infrastructureSnapshot,
    missionID: String(payload.opencorvus.mission_id ?? ""),
    missionSessionID: String(payload.opencorvus.mission_session_id ?? ""),
    taskIDs: Array.isArray(payload.opencorvus.task_ids) ? payload.opencorvus.task_ids.map(String) : [],
    missionTranscript,
    taskTranscripts,
    flattenedTaskTranscript: transcript,
  })
  const missionCollectionsAudit = auditMissionEvidenceCollections({
    snapshot: infrastructureSnapshot,
    missionSessionID: String(payload.opencorvus.mission_session_id ?? ""),
    taskIDs: Array.isArray(payload.opencorvus.task_ids) ? payload.opencorvus.task_ids.map(String) : [],
    taskBoards,
    taskInteractions,
    flattenedInteractions: interactions,
    resultInteractions: Array.isArray(payload.opencorvus.interactions) ? payload.opencorvus.interactions : [],
    providerLedger: ledger,
    taskTrace: trace,
  })
  const promptCompositionAudit = auditTaskBoundPromptCompositionCoverage({
    traceEvents: trace,
    providerRows: ledger,
    missionSessionID: String(payload.opencorvus.mission_session_id ?? ""),
  })
  const traceScopeAudit = auditTaskTraceScopeSeal({
    taskIDs: Array.isArray(payload.opencorvus.task_ids) ? payload.opencorvus.task_ids.map(String) : [],
    traceEvents: trace,
    tracedSessionIDs: missionCollectionsAudit.traced_task_session_ids,
    declaredScope: payload.opencorvus.trace_scope,
    legacyDefaultBoundAttested: legacyTraceRunIDs.has(String(payload.run.id ?? "")),
  })
  const terminalQuiescenceAudit = auditMissionQuiescence({
    missionRecord: board.mission,
    missionStatus: board.mission_status,
    taskBoards,
  })
  const bindingAudit = auditMissionRunBinding({
    resultProfile: profile,
    resultModel: payload.opencorvus.model,
    resultMissionID: payload.opencorvus.mission_id,
    resultMissionSessionID: payload.opencorvus.mission_session_id,
    resultTaskIDs: payload.opencorvus.task_ids,
    wakeRequest: receipt.request,
    wakeResponse: receipt.response,
    missionSession: receipt.mission_session,
    missionRecord: board.mission,
    missionStatus: board.mission_status,
    projectGitInit: receipt.project_git_init,
    taskBoards,
  })
  const skillSeal = auditSkillEvidenceSeal({
    profile,
    resultSkill: payload.opencorvus.skill,
    projectionFile: skillProjection,
    transcript,
  })
  if (!skillSeal.passed) {
    throw new Error(`Experimental Skill evidence seal failed for ${attempt.run_id}: ${skillSeal.violations.join(", ")}`)
  }
  if (!infrastructureAudit.passed) {
    throw new Error(
      `Host recorded a task infrastructure error for ${attempt.run_id}: ${infrastructureAudit.violations.join(", ")}`,
    )
  }
  const workflowBindings = taskBoards.map((task: any) => ({
    task_id: task.task_id,
    workflow_binding: task.board?.task?.completionDecision?.workflowBinding ?? null,
  }))
  const selectedWorkflowIDs = workflowBindings.map((item: any) => ({
    task_id: item.task_id,
    workflow_id:
      item.workflow_binding?.kind === "virtual_workflow" ? item.workflow_binding.workflow_id : null,
  }))
  if (
    !taskOutcomeAudit.passed ||
    !missionLineageAudit.passed ||
    !missionCollectionsAudit.passed ||
    !promptCompositionAudit.passed ||
    JSON.stringify(promptCompositionAudit) !==
      JSON.stringify(payload.opencorvus.prompt_composition_audit ?? null) ||
    !traceScopeAudit.passed ||
    Number(payload.opencorvus.trace_events ?? -1) !== trace.length ||
    JSON.stringify(taskOutcomeAudit) !== JSON.stringify(payload.opencorvus.mission_outcome_audit ?? null) ||
    !terminalQuiescenceAudit.passed ||
    JSON.stringify(terminalQuiescenceAudit) !==
      JSON.stringify(payload.opencorvus.terminal_quiescence_audit ?? null) ||
    !bindingAudit.passed ||
    JSON.stringify(workflowBindings) !== JSON.stringify(payload.opencorvus.workflow_bindings ?? null) ||
    JSON.stringify(selectedWorkflowIDs) !== JSON.stringify(payload.opencorvus.selected_workflow_ids ?? null)
  ) {
    throw new Error(`Raw Mission/profile/Task/workflow binding mismatch: ${attempt.run_id}`)
  }
  if (digest(String(receipt.request?.text ?? "")) !== payload.benchmark.harness_request_sha256) {
    throw new Error(`Harness request hash mismatch: ${attempt.run_id}`)
  }
  const isolation = auditBenchmarkIsolation([...missionTranscript, ...transcript], {
    protectedPaths: [
      path.dirname(path.dirname(python)),
      sourceData,
      path.join(sourceData, "auth.json"),
      path.join(sourceData, "models.json"),
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
    protectedSecrets,
  })
  if (!isolation.passed) throw new Error(`Evaluator isolation mismatch: ${attempt.run_id}`)
  if (
    sandboxAudit.passed !== true ||
    sandboxAudit.boundary !== "linux_mount_namespace_unique_uid_unix_socket" ||
    sandboxAudit.wrapper_sha256 !== restrictedShellSHA256 ||
    sandboxAudit.uid !== 60_000 + Number(payload.benchmark.case_index) ||
    sandboxAudit.home !== "private" ||
    sandboxAudit.socket !== "scoped"
  ) {
    throw new Error(`Sandbox isolation mismatch: ${attempt.run_id}`)
  }
  if (
    protectedRootAudit.passed !== true ||
    protectedRootAudit.evidence?.uid !== 0 ||
    protectedRootAudit.evidence?.mode !== "700" ||
    protectedRootAudit.control?.uid !== 0 ||
    protectedRootAudit.control?.mode !== "700"
  ) {
    throw new Error(`Host boundary isolation mismatch: ${attempt.run_id}`)
  }
  const independentReplay = await replayScore(directory, payload)
  if (
    scorerReplay.passed !== true ||
    scorerReplay.example_id !== payload.benchmark.example_id ||
    JSON.stringify(independentReplay) !== JSON.stringify(scorerReplay)
  ) {
    throw new Error(`Scorer replay mismatch: ${attempt.run_id}`)
  }
  const events = eventText
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
  const toolAudit = summarizeBenchmarkToolEvents(events)
  if (
    !toolAudit.sequenceValid ||
    toolAudit.scoreEvents !== 1 ||
    toolAudit.attempts !== payload.benchmark.tool_attempts ||
    toolAudit.succeeded !== payload.benchmark.tool_succeeded ||
    toolAudit.failed !== payload.benchmark.tool_failed ||
    payload.benchmark.tool_calls !== payload.benchmark.tool_attempts
  ) {
    throw new Error(`Benchmark event ledger mismatch: ${attempt.run_id}`)
  }
  const usage = summarizeProviderUsageRows(ledger)
  for (const field of [
    "input",
    "output",
    "reasoning",
    "cacheRead",
    "cacheWrite",
    "total",
    "costUSD",
    "pricedCalls",
    "unpricedCalls",
    "modelCalls",
  ]) {
    if (usage[field as keyof typeof usage] !== payload.opencorvus.tokens[field]) {
      throw new Error(`Provider ledger mismatch (${field}): ${attempt.run_id}`)
    }
  }
  if (payload.opencorvus.model !== model || !providerUsageMatchesModel(ledger, model).passed) {
    throw new Error(`Provider ledger identity mismatch: ${attempt.run_id}`)
  }
  independentlyRawEligible.push(String(attempt.run_id))
}

const verifiedBatches = await Promise.all(
  (await walk(path.join(root, "batch-plans")).catch(() => [] as string[]))
    .filter((file) => file.endsWith("-plan.json"))
    .map(async (planPath) => {
      const planBytes = await fs.readFile(planPath)
      const plan = JSON.parse(planBytes.toString("utf8"))
      const planSchemaAudit = auditAutomationBenchBatchPlanSchema(plan)
      if (!planSchemaAudit.passed) {
        throw new Error(`Batch plan schema mismatch (${planSchemaAudit.reason}): ${plan.batch_run_id}`)
      }
      if (plan.model !== model || plan.launch_mode !== "mission") {
        throw new Error(`Batch plan model/launch mode mismatch: ${plan.batch_run_id}`)
      }
      const prefix = planPath.slice(0, -"-plan.json".length)
      const receipt = await fs
        .readFile(`${prefix}-receipt.json`, "utf8")
        .then(JSON.parse)
        .catch(() => undefined)
      const waveCompletion = await fs
        .readFile(`${prefix}-wave-1-complete.json`, "utf8")
        .then(JSON.parse)
        .catch(() => undefined)
      const planSHA256 = digest(planBytes)
      const audit = auditBatchEvidence({ plan, receipt, waveCompletion, attempts: independentAttempts, planSHA256 })
      return {
        batchRunID: plan.batch_run_id,
        profiles: plan.profiles as string[],
        repetition: plan.repetition ?? 1,
        planSHA256,
        receipt,
        audit,
        referencedRunIDs: new Set(reusableBatchCandidateRunIDs(audit)),
        eligibleRunIDs: new Set((audit.eligible_run_ids ?? []).map(String)),
        adoptedRunIDs: (audit.adopted_run_ids ?? []).map(String),
      }
    }),
)
if (verifiedBatches.length !== (catalog.batches ?? []).length) throw new Error("Catalog batch index is incomplete")
for (let pass = 0; pass < verifiedBatches.length; pass++) {
  let changed = false
  for (const batch of verifiedBatches.filter((item) => item.audit.passed === true && item.adoptedRunIDs.length > 0)) {
    const dependenciesPassed = batch.adoptedRunIDs.every((runID) =>
      verifiedBatches.some(
        (candidate) =>
          candidate.batchRunID !== batch.batchRunID &&
          candidate.referencedRunIDs.has(runID),
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
const independentlyEligible = independentlyRawEligible
  .filter((runID) =>
    verifiedBatches.some(
      (batch) => batch.audit.passed === true && batch.audit.status === "completed" && batch.eligibleRunIDs.has(runID),
    ),
  )
  .sort()
const declaredEligible = catalog.leaderboard.map((attempt) => String(attempt.run_id)).sort()
if (JSON.stringify(independentlyEligible) !== JSON.stringify(declaredEligible)) {
  throw new Error("Catalog leaderboard does not equal independently verified eligible attempts")
}
for (const attempt of catalog.attempts) {
  const expected = independentlyEligible.includes(String(attempt.run_id))
  if (attempt.leaderboard_eligible !== expected)
    throw new Error(`Catalog final eligibility mismatch: ${attempt.run_id}`)
}
const batchArtifactFiles = await walk(path.join(root, "batch-plans")).catch(() => [] as string[])
const batchRedactionAudits = await Promise.all(
  batchArtifactFiles
    .filter((file) => file.endsWith("-redaction-receipt.json"))
    .map(async (redactionPath) => {
      const redactionFileName = path.basename(redactionPath)
      const targetFileName = redactionFileName.replace(/-redaction-receipt\.json$/, "-receipt.json")
      const targetPath = path.join(path.dirname(redactionPath), targetFileName)
      return auditBatchReceiptRedaction({
        redactionFileName,
        redactionReceipt: JSON.parse(await fs.readFile(redactionPath, "utf8")),
        targetFileName,
        targetBytes: await fs.readFile(targetPath),
      })
    }),
)
if (batchRedactionAudits.some((audit) => !audit.passed)) {
  throw new Error("Batch receipt redaction chain did not reconcile")
}
const expectedPaperPaths = [
  "automationbench-case-set.json",
  "run-dispositions.json",
  ...(legacyTraceRunIDs.size > 0 ? ["legacy-trace-environment-attestation.json"] : []),
  "evidence-catalog.json",
  "leaderboard.md",
  ...batchArtifactFiles.map((file) => path.relative(root, file).replaceAll("\\", "/")),
  ...catalog.leaderboard.flatMap((record) => [
    `${record.evidence_directory}/result.json`,
    `${record.evidence_directory}/evidence-manifest.json`,
  ]),
].sort()
const declaredPaperPaths = paperManifest.files.map((item) => item.path).sort()
if (JSON.stringify(expectedPaperPaths) !== JSON.stringify(declaredPaperPaths)) {
  throw new Error("Paper artifact manifest does not cover the exact expected paper file set")
}
if (finalMode) {
  if (JSON.stringify([...(catalog.scope?.profiles ?? [])].sort()) !== JSON.stringify([...finalProfiles].sort())) {
    throw new Error("Final verifier profiles do not match the catalog primary profile scope")
  }
  if (catalog.scope?.repetitions !== repetitions) {
    throw new Error("Final verifier repetition count does not match the catalog scope")
  }
  const selectedRows = catalog.leaderboard.filter((attempt) => finalProfiles.includes(attempt.opencorvus?.profile))
  if (selectedRows.length !== finalProfiles.length * 50 * repetitions) {
    throw new Error(`Final matrix requires exactly ${finalProfiles.length * 50 * repetitions} selected-profile trials`)
  }
  const missingBatchProfiles = missingCompletedBatchProfileReceipts({
    batches: verifiedBatches,
    batchIndexes: Array.from({ length: 10 }, (_, index) => index + 1),
    profiles: finalProfiles,
    repetitions: Array.from({ length: repetitions }, (_, index) => index + 1),
  })
  if (missingBatchProfiles.length > 0) {
    throw new Error(
      `Final matrix requires completed receipts for: ${missingBatchProfiles
        .map((slot) => `repetition ${slot.repetition} batch ${slot.batch_index} ${slot.profile}`)
        .join(", ")}`,
    )
  }
  for (const profile of finalProfiles) {
    const rows = catalog.leaderboard.filter((attempt) => attempt.opencorvus?.profile === profile)
    const slots = rows
      .map((attempt) => `${attempt.benchmark?.repetition}:${attempt.benchmark?.case_index}`)
      .sort()
    const expected = Array.from({ length: repetitions }, (_, repetitionOffset) =>
      Array.from({ length: 50 }, (_, index) => `${repetitionOffset + 1}:${index + 1}`),
    ).flat().sort()
    if (JSON.stringify(slots) !== JSON.stringify(expected)) {
      throw new Error(`Final ${profile} matrix does not cover exact cases 1 through 50 at repetitions 1 through ${repetitions}`)
    }
  }
}
process.stdout.write(
  JSON.stringify({
    ok: true,
    mode: finalMode ? "final" : "development",
    attempts: catalog.attempts.length,
    eligible: declaredEligible.length,
    paper_files: paperManifest.files.length,
  }) + "\n",
)
