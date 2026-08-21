import {
  comparePromptComposition,
  type PromptCompositionFingerprint,
} from "../../../src/session/prompt-composition"
import crypto from "node:crypto"

export const EXTERNAL_BENCHMARK_SCHEMA_VERSION = 1 as const

export type TokenBreakdown = {
  input: number
  output: number
  reasoning: number
  cacheRead: number
  cacheWrite: number
  total: number
  costUSD: number
  pricedCalls: number
  unpricedCalls: number
  assistantMessages: number
}

export type ProviderUsageRow = {
  id: string
  occurred_at: number
  provider_id: string
  model_id: string
  purpose: string
  input_tokens: number
  output_tokens: number
  reasoning_tokens: number
  cache_read_tokens: number
  cache_write_tokens: number
  total_tokens: number
  cost_usd: number
  billing_status: string
  session_id: string | null
  agent_id: string | null
}

export function summarizeProviderUsageRows(rows: ProviderUsageRow[]): TokenBreakdown & { modelCalls: number } {
  const result: TokenBreakdown & { modelCalls: number } = {
    input: 0,
    output: 0,
    reasoning: 0,
    cacheRead: 0,
    cacheWrite: 0,
    total: 0,
    costUSD: 0,
    pricedCalls: 0,
    unpricedCalls: 0,
    assistantMessages: 0,
    modelCalls: rows.length,
  }
  for (const row of rows) {
    result.input += finiteNonnegative(row.input_tokens)
    result.output += finiteNonnegative(row.output_tokens)
    result.reasoning += finiteNonnegative(row.reasoning_tokens)
    result.cacheRead += finiteNonnegative(row.cache_read_tokens)
    result.cacheWrite += finiteNonnegative(row.cache_write_tokens)
    result.total += finiteNonnegative(row.total_tokens)
    result.costUSD += finiteNonnegative(row.cost_usd)
    if (row.billing_status === "priced") result.pricedCalls++
    if (row.billing_status === "unpriced") result.unpricedCalls++
  }
  return result
}

export function summarizeProviderUsageByAgent(rows: ProviderUsageRow[]) {
  const byAgent = new Map<string, ProviderUsageRow[]>()
  for (const row of rows) {
    const key = `${row.session_id ?? "unattributed"}\u0000${row.agent_id ?? "unattributed"}`
    const bucket = byAgent.get(key)
    if (bucket) bucket.push(row)
    else byAgent.set(key, [row])
  }
  return [...byAgent.entries()]
    .map(([key, bucket]) => {
      const [sessionID, agentID] = key.split("\u0000")
      return {
        session_id: sessionID === "unattributed" ? null : sessionID!,
        agent_id: agentID === "unattributed" ? null : agentID!,
        ...summarizeProviderUsageRows(bucket),
      }
    })
    .sort(
      (left, right) =>
        right.total - left.total ||
        String(left.agent_id).localeCompare(String(right.agent_id)) ||
        String(left.session_id).localeCompare(String(right.session_id)),
    )
}

export type TrajectoryEvent = {
  at: number
  end?: number
  lane: string
  kind: "llm" | "turn" | "tool" | "skill" | "benchmark" | "decision" | "failure"
  label: string
  source: "trace" | "transcript" | "benchmark"
}

export function benchmarkRunKey(startedAt: number, runID: string) {
  return `${new Date(startedAt).toISOString().replaceAll(":", "-")}-${runID}`
}

export function automationBenchToolConfig(socketPath: string) {
  return { socket_path: socketPath }
}

const STOCK_SINGLE_MODEL_BUDGET =
  "You have a budget of ~50 tool-using turns — favor parallel tool calls and avoid duplicate searches."

function removeStockSingleModelBudget(content: string) {
  const index = content.indexOf(STOCK_SINGLE_MODEL_BUDGET)
  if (index < 0) return content
  const before = content.slice(0, index)
  let after = content.slice(index + STOCK_SINGLE_MODEL_BUDGET.length)
  // The frozen sentence is normally surrounded by one separator space. Removing
  // the sentence would create a duplicate separator, so consume only that one
  // newly-adjacent space and preserve every other business-content byte.
  if (before.endsWith(" ") && after.startsWith(" ")) after = after.slice(1)
  return before + after
}

export function automationBenchHarnessRequest(prompt: unknown): string {
  if (!Array.isArray(prompt)) throw new Error("AutomationBench task prompt must be an array")
  let budgetOccurrences = 0
  const messages = prompt.map((item) => {
    if (!item || typeof item !== "object") throw new Error("AutomationBench task prompt contains a non-object message")
    const role = String((item as Record<string, unknown>).role ?? "")
    const originalContent = String((item as Record<string, unknown>).content ?? "")
    budgetOccurrences += originalContent.split(STOCK_SINGLE_MODEL_BUDGET).length - 1
    const content = removeStockSingleModelBudget(originalContent)
    return `${role.toUpperCase()}:\n${content}`
  })
  if (budgetOccurrences !== 1) {
    throw new Error(
      `AutomationBench stock single-model budget sentence must occur exactly once, observed ${budgetOccurrences}`,
    )
  }
  return [
    "This is an AutomationBench API-mode evaluation. The simulated business end state is the only scored deliverable.",
    "Load the project Skill named `automationbench-api` before acting and use only its project-local client for benchmark operations.",
    "Do not ask the operator a question, do not modify product files, and do not replace benchmark operations with a prose report.",
    "OpenCorvus is the evaluated multi-Agent harness. Tool, model, Agent, retry, and concurrent call counts are measured without a stock single-model turn budget.",
    ...messages,
  ].join("\n\n")
}

export function auditBenchmarkIsolation(
  transcript: unknown,
  input: {
    protectedPaths: string[]
    forbiddenMarkers: string[]
    protectedSecrets?: Array<{ label: string; value: string }>
  },
) {
  const strings: string[] = []
  const collect = (value: unknown) => {
    if (typeof value === "string") {
      strings.push(value)
      return
    }
    if (Array.isArray(value)) {
      for (const item of value) collect(item)
      return
    }
    if (value && typeof value === "object") {
      for (const item of Object.values(value)) collect(item)
    }
  }
  collect(transcript)
  const normalizedStrings = strings.map(normalizeAuditPath)
  const violations = new Set<string>()
  input.protectedPaths.forEach((value, index) => {
    const marker = normalizeAuditPath(value).replace(/\/$/, "")
    if (marker && normalizedStrings.some((text) => containsPathAtBoundary(text, marker))) {
      violations.add(`protected_path_${index + 1}`)
    }
  })
  input.forbiddenMarkers.forEach((value) => {
    const marker = value.toLowerCase()
    if (marker && strings.some((text) => text.toLowerCase().includes(marker))) {
      violations.add(`forbidden_marker:${value}`)
    }
  })
  for (const secret of input.protectedSecrets ?? []) {
    if (secret.value && strings.some((text) => text.includes(secret.value)))
      violations.add(`protected_secret:${secret.label}`)
  }
  return { passed: violations.size === 0, violations: [...violations] }
}

function normalizeAuditPath(value: string) {
  return value.replace(/[\\/]+/g, "/").toLowerCase()
}

function containsPathAtBoundary(text: string, marker: string) {
  let index = text.indexOf(marker)
  while (index >= 0) {
    const before = index === 0 ? "" : text[index - 1]!
    const afterIndex = index + marker.length
    const after = afterIndex >= text.length ? "" : text[afterIndex]!
    const beforeBoundary = before === "" || !/[a-z0-9_.-]/i.test(before)
    const afterBoundary = after === "" || after === "/" || !/[a-z0-9_.-]/i.test(after)
    if (beforeBoundary && afterBoundary) return true
    index = text.indexOf(marker, index + 1)
  }
  return false
}

export function sourceAuthSecretLeaves(value: unknown) {
  const secrets: Array<{ label: string; value: string }> = []
  const visit = (item: unknown, sensitive: boolean) => {
    if (typeof item === "string") {
      if (sensitive && item.length >= 8)
        secrets.push({ label: `source_auth_secret_${secrets.length + 1}`, value: item })
      return
    }
    if (Array.isArray(item)) {
      for (const child of item) visit(child, sensitive)
      return
    }
    if (!item || typeof item !== "object") return
    for (const [key, child] of Object.entries(item)) {
      visit(child, sensitive || /token|secret|password|credential|api[_-]?key|access|refresh/i.test(key))
    }
  }
  visit(value, false)
  return secrets
}

export function summarizeBenchmarkToolEvents(events: Array<Record<string, any>>) {
  const scoreIndex = events.findIndex((event) => event.kind === "score")
  const terminalIndex = scoreIndex < 0 ? events.length : scoreIndex
  const accepted = events
    .slice(0, terminalIndex)
    .filter((event) => event.kind === "tool" || event.kind === "tool_error")
  const succeeded = accepted.filter((event) => event.kind === "tool").length
  const failed = accepted.filter((event) => event.kind === "tool_error").length
  const sequenceValid = events.every((event, index) => event.sequence === index + 1)
  return {
    attempts: succeeded + failed,
    succeeded,
    failed,
    scoreEvents: events.filter((event) => event.kind === "score").length,
    scoreIndex,
    sequenceValid,
  }
}

export function evidenceFileSetMatches(actual: string[], expected: string[]) {
  return JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort())
}

export function permanentRunInvalidation(fileNames: string[], manifest: Record<string, unknown>) {
  if (fileNames.includes("cleanup-failure.json")) return { invalid: true, reason: "cleanup_failure" }
  if (fileNames.includes("evidence-seal-failure.json")) return { invalid: true, reason: "evidence_seal_failure" }
  if (fileNames.some((name) => /^redaction-receipt(?:-\d+)?\.json$/.test(name))) {
    return { invalid: true, reason: "post_seal_secret_redaction" }
  }
  if (manifest.redacted_from_manifest_sha256) return { invalid: true, reason: "post_seal_secret_redaction" }
  return { invalid: false as const }
}

export function auditRunBinding(input: {
  resultProfile: string
  resultTaskID: string | null | undefined
  resultWorkflow: unknown
  resultSelectedWorkflowID: string | null | undefined
  requestedProfile: unknown
  boundProfile: unknown
  boardTaskID: unknown
  responseTaskID: unknown
  boardWorkflow: any
}) {
  const selectedWorkflowID = input.boardWorkflow?.kind === "virtual_workflow" ? input.boardWorkflow.workflow_id : null
  return {
    passed:
      input.requestedProfile === input.resultProfile &&
      input.boundProfile === input.resultProfile &&
      input.boardTaskID === input.resultTaskID &&
      input.responseTaskID === input.resultTaskID &&
      JSON.stringify(input.boardWorkflow ?? null) === JSON.stringify(input.resultWorkflow ?? null) &&
      selectedWorkflowID === (input.resultSelectedWorkflowID ?? null),
    selectedWorkflowID,
  }
}

export function auditTaskOutcome(lifecycleStatus: unknown, transcript: TranscriptMessage[]) {
  let explicitFailTask = false
  const infrastructureFailures: Array<{ operation: string | null; message: string | null }> = []
  for (const message of transcript) {
    for (const part of message.parts ?? []) {
      const state = part.state && typeof part.state === "object" ? part.state : undefined
      if (
        part.type === "tool" &&
        part.tool === "manage_task" &&
        state?.status === "completed" &&
        state.input?.action === "fail_task"
      ) {
        explicitFailTask = true
      }
      const raw = state?.output
      let output: any = raw
      if (typeof raw === "string") {
        try {
          output = JSON.parse(raw)
        } catch {}
      }
      if (output?.kind === "infrastructure_failure") {
        infrastructureFailures.push({
          operation: typeof output.operation === "string" ? output.operation : null,
          message: typeof output.message === "string" ? output.message : null,
        })
      }
    }
  }
  const naturalCompleted = lifecycleStatus === "completed"
  const naturalFailed = lifecycleStatus === "failed" && explicitFailTask && infrastructureFailures.length === 0
  return {
    passed: naturalCompleted || naturalFailed,
    scored_terminal: naturalCompleted || naturalFailed,
    lifecycle_status: lifecycleStatus,
    explicit_fail_task: explicitFailTask,
    infrastructure_failures: infrastructureFailures,
    outcome: naturalCompleted ? "completed" : naturalFailed ? "natural_failed" : "invalid_terminal",
  }
}

export type TaskInfrastructureIncident = {
  id: string | null
  operation: string | null
  state: string | null
  reason: string | null
}

const TASK_INFRASTRUCTURE_ARTIFACT_KIND = "task-infrastructure-error"

function infrastructureIncidentsFromSnapshot(snapshot: unknown): TaskInfrastructureIncident[] | undefined {
  const rows = (snapshot as { rows?: Record<string, unknown> } | undefined)?.rows?.[
    "engine_artifact"
  ]
  if (!Array.isArray(rows)) return undefined
  const incidents: TaskInfrastructureIncident[] = []
  for (const row of rows as Array<Record<string, unknown>>) {
    if (row?.kind !== TASK_INFRASTRUCTURE_ARTIFACT_KIND) continue
    // The snapshot preserves SQLite column values, so a payload that was stored
    // as JSON text arrives as a string here and as an object nowhere else.
    let payload: Record<string, unknown> = {}
    if (typeof row.payload === "string") {
      try {
        payload = JSON.parse(row.payload) as Record<string, unknown>
      } catch {
        payload = {}
      }
    } else if (row.payload && typeof row.payload === "object") {
      payload = row.payload as Record<string, unknown>
    }
    const context = (payload.context ?? {}) as Record<string, unknown>
    incidents.push({
      id: typeof row.id === "string" ? row.id : null,
      operation: typeof payload.operation === "string" ? payload.operation : null,
      state: typeof context.state === "string" ? context.state : null,
      reason: typeof context.gateReason === "string" ? context.gateReason : null,
    })
  }
  return incidents
}

function infrastructureIncidentsFromBoard(board: unknown): TaskInfrastructureIncident[] | undefined {
  const rows = (board as { processIncidents?: unknown } | undefined)?.processIncidents
  if (!Array.isArray(rows)) return undefined
  return (rows as Array<Record<string, unknown>>)
    .filter((row) => row?.source === "infrastructure")
    .map((row) => ({
      id: typeof row.id === "string" ? row.id : null,
      // The board renders one incident line rather than the artifact payload, so
      // only the identity is comparable across the two sources.
      operation: null,
      state: null,
      reason: typeof row.errorName === "string" ? row.errorName : null,
    }))
}

/**
 * Disqualify a run whose Host recorded a `task-infrastructure-error`.
 *
 * `auditTaskOutcome` reads the Agent-visible transcript, where an infrastructure
 * failure appears only when a Tool returned one. A Task-root ingress that rests
 * in `host_fault` never reaches a Tool: the reduction surfaces one artifact and
 * abandons that scheduling round, so the transcript reads as an ordinary Task
 * and the run scored as if nothing had gone wrong. The Host's own record is the
 * only place that fault exists.
 *
 * It exists in two sealed files at once — the relational snapshot's
 * `engine_artifact` rows and the terminal board's incident list, which the board
 * derives from those same rows and keys by the same artifact id. Reading both
 * and requiring their identities to agree costs nothing and turns a silent
 * disagreement between the two into a checker failure instead of a coin flip
 * over which file the checker happened to read.
 *
 * Fail-closed when neither source is present: an unreadable Host record is not
 * evidence that the Host recorded nothing.
 */
export function auditTaskInfrastructureIncidents(input: { snapshot?: unknown; board?: unknown }) {
  const fromSnapshot = infrastructureIncidentsFromSnapshot(input.snapshot)
  const fromBoard = infrastructureIncidentsFromBoard(input.board)
  const missingSources = [
    ...(fromSnapshot === undefined ? ["runtime_database_snapshot"] : []),
    ...(fromBoard === undefined ? ["terminal_board"] : []),
  ]
  const byID = new Map<string, TaskInfrastructureIncident>()
  for (const incident of [...(fromSnapshot ?? []), ...(fromBoard ?? [])]) {
    const key = incident.id ?? `anonymous:${byID.size}`
    const current = byID.get(key)
    byID.set(key, {
      id: incident.id,
      operation: current?.operation ?? incident.operation,
      state: current?.state ?? incident.state,
      reason: current?.reason ?? incident.reason,
    })
  }
  const incidents = [...byID.values()].sort((left, right) => String(left.id).localeCompare(String(right.id)))
  const countsByReason: Record<string, number> = {}
  for (const incident of incidents) {
    const key = `${incident.operation ?? "unknown"}|${incident.reason ?? "unknown"}`
    countsByReason[key] = (countsByReason[key] ?? 0) + 1
  }
  const identities = (list: TaskInfrastructureIncident[] | undefined) =>
    list === undefined ? undefined : JSON.stringify(list.map((item) => item.id).sort())
  const snapshotIdentities = identities(fromSnapshot)
  const boardIdentities = identities(fromBoard)
  const sourcesAgree =
    snapshotIdentities === undefined || boardIdentities === undefined || snapshotIdentities === boardIdentities
  const violations: string[] = []
  if (missingSources.length === 2) violations.push("no_host_record_available")
  if (!sourcesAgree) violations.push("source_disagreement")
  if (incidents.length > 0) violations.push(`task_infrastructure_error:${incidents.length}`)
  return {
    passed: violations.length === 0,
    incidents,
    counts_by_reason: countsByReason,
    sources: {
      runtime_database_snapshot: fromSnapshot?.length ?? null,
      terminal_board: fromBoard?.length ?? null,
    },
    missing_sources: missingSources,
    sources_agree: sourcesAgree,
    violations,
  }
}

export function auditTerminalQuiescence(board: any) {
  const lifecycleStatus = String(board?.task?.status ?? "")
  const terminal = ["completed", "failed", "cancelled"].includes(lifecycleStatus)
  const occurrences = Array.isArray(board?.executionProjection?.occurrences)
    ? board.executionProjection.occurrences
    : []
  const unsettled = occurrences.flatMap((occurrence: any, index: number) => {
    const events = Array.isArray(occurrence?.events) ? occurrence.events : []
    const last = events.at(-1)
    const lastStatus = last?.status?.type
    const agent = typeof occurrence?.agent === "string" ? occurrence.agent : null
    if (lastStatus === "terminal" || (agent === "orchestrator" && lastStatus === "idle")) return []
    return [
      {
        index,
        agent,
        session_id: typeof occurrence?.sessionID === "string" ? occurrence.sessionID : null,
        last_status: typeof lastStatus === "string" ? lastStatus : null,
      },
    ]
  })
  return {
    passed: terminal && unsettled.length === 0,
    lifecycle_status: lifecycleStatus || null,
    occurrence_count: occurrences.length,
    unsettled_occurrences: unsettled,
  }
}

export type BatchProfileSlot = {
  case_index: number
  profile: "base" | "advanced"
}

export function rollingBatchChains(waves: BatchProfileSlot[][]) {
  if (waves.length < 1 || waves.some((wave) => wave.length !== 5)) {
    throw new Error("Rolling AutomationBench batches require one or more five-slot profile lists")
  }
  return waves[0]!.map((first) => {
    const chain = waves.map((wave) => wave.find((slot) => slot.case_index === first.case_index))
    if (chain.some((slot) => !slot) || new Set(chain.map((slot) => slot!.profile)).size !== chain.length) {
      throw new Error(`Rolling AutomationBench case ${first.case_index} requires one unique slot per profile list`)
    }
    return chain as BatchProfileSlot[]
  })
}

export async function executeRollingBatchChains<T>(input: {
  chains: ReadonlyArray<ReadonlyArray<BatchProfileSlot>>
  shouldRun: (slot: BatchProfileSlot) => boolean
  run: (slot: BatchProfileSlot, waveIndex: number) => Promise<T>
}) {
  return Promise.all(
    input.chains.map(async (chain) => {
      const outcomes: T[] = []
      for (const [offset, slot] of chain.entries()) {
        if (!input.shouldRun(slot)) continue
        outcomes.push(await input.run(slot, offset + 1))
      }
      return outcomes
    }),
  )
}

export function reusableProfileRuns(
  catalog: { leaderboard: Array<Record<string, any>>; candidates: Array<Record<string, any>> },
  profile: "base" | "advanced",
): Map<number, Record<string, any>> {
  const verified = new Map(
    catalog.leaderboard
      .filter((record) => record.opencorvus?.profile === profile && record.benchmark?.repetition === 1)
      .map((record) => [Number(record.benchmark.case_index), record]),
  )
  const reusable = new Map<number, Record<string, any>>()
  for (const record of catalog.candidates.filter(
    (item) => item.opencorvus?.profile === profile && item.benchmark?.repetition === 1,
  )) {
    const caseIndex = Number(record.benchmark.case_index)
    if (verified.has(caseIndex)) continue
    const existing = reusable.get(caseIndex)
    if (existing && existing.run_id !== record.run_id) {
      throw new Error(`Multiple reusable ${profile} candidates exist for case ${caseIndex}`)
    }
    reusable.set(caseIndex, record)
  }
  return new Map([...reusable, ...verified])
}

export function missingCompletedBatchProfileReceipts(input: {
  batches: Array<{
    profiles: string[]
    receipt?: { batch_index?: number }
    audit: { passed?: boolean; status?: string }
  }>
  batchIndexes: number[]
  profiles: string[]
}): Array<{ batch_index: number; profile: "base" | "advanced" }> {
  return input.batchIndexes.flatMap((caseBatchIndex) =>
    input.profiles.flatMap((profile) =>
      input.batches.some(
        (batch) =>
          batch.audit.passed === true &&
          batch.audit.status === "completed" &&
          batch.receipt?.batch_index === caseBatchIndex &&
          batch.profiles.includes(profile),
      )
        ? []
        : [{ batch_index: caseBatchIndex, profile: profile as BatchProfileSlot["profile"] }],
    ),
  )
}

type BatchPlanSlot = { case_index: number; profile: string }

export function auditBatchEvidence(input: {
  plan: any
  receipt?: any
  waveCompletion?: any
  attempts: Array<Record<string, any>>
  planSHA256: string
}) {
  if (!input.receipt) {
    return {
      passed: false,
      status: "orphan_plan",
      reasons: ["batch_receipt_missing"],
      eligible_run_ids: [] as string[],
      sealing_run_ids: [] as string[],
      adopted_run_ids: [] as string[],
    }
  }
  const reasons: string[] = []
  if (
    !["completed", "failed"].includes(input.receipt.status) ||
    input.receipt.batch_run_id !== input.plan.batch_run_id
  ) {
    reasons.push("batch_receipt_identity")
  }
  const expectedCases = (input.plan.cases ?? [])
    .map((item: any) => Number(item.case_index))
    .sort((a: number, b: number) => a - b)
  if (input.plan.trial_concurrency !== 5 || expectedCases.length !== 5 || new Set(expectedCases).size !== 5) {
    reasons.push("batch_plan_shape")
  }
  const expectedWave1 = (input.plan.waves?.[0] ?? []).map((item: any) => `${item.case_index}:${item.profile}`).sort()
  const rolling = input.plan.schedule_mode === "rolling_case_slots_v1"
  const waveIndexes = (input.plan.waves ?? []).map((_: any, index: number) => index + 1)
  if (rolling) {
    try {
      rollingBatchChains(input.plan.waves ?? [])
    } catch {
      reasons.push("rolling_plan_shape")
    }
  }
  const waveCompletionValid =
    input.waveCompletion?.status === "wave_1_complete" &&
    input.waveCompletion?.batch_run_id === input.plan.batch_run_id &&
    JSON.stringify(
      (input.waveCompletion?.eligible_slots ?? []).map((item: any) => `${item.case_index}:${item.profile}`).sort(),
    ) === JSON.stringify(expectedWave1)
  if (!rolling && (input.receipt.status === "completed" || input.waveCompletion) && !waveCompletionValid) {
    reasons.push("wave_1_completion")
  }
  const launched = waveIndexes.flatMap((waveIndex: number) =>
    (input.receipt[`wave_${waveIndex}`]?.launched ?? []).map((item: any) => ({ ...item, waveIndex })),
  )
  const eligibleClaims = waveIndexes.flatMap((waveIndex: number) =>
    (input.receipt[`wave_${waveIndex}`]?.eligible ?? []).map((item: any) => ({ ...item, waveIndex })),
  )
  const preexisting = new Map<string, BatchPlanSlot & { run_id: string }>(
    ["base", "advanced"].flatMap((profile) =>
      (input.plan.preexisting_eligible?.[profile] ?? []).map(
        (item: any) => [String(item.run_id), item] as [string, BatchPlanSlot & { run_id: string }],
      ),
    ),
  )
  const intervals: Array<{
    waveIndex: number
    profile: string
    caseIndex: number
    start: number
    end: number
  }> = []
  const launchedRunIDs = new Set<string>()
  for (const item of launched) {
    const attempt = input.attempts.find((record) => record.run_id === item.run_id)
    const expectedSlot = (input.plan.waves?.[item.waveIndex - 1] as BatchPlanSlot[] | undefined)?.some(
      (slot) => slot.case_index === item.case_index && slot.profile === item.profile,
    )
    if (
      !attempt ||
      attempt.benchmark?.batch_run_id !== input.plan.batch_run_id ||
      attempt.benchmark?.batch_plan_sha256 !== input.planSHA256 ||
      attempt.benchmark?.wave_index !== item.waveIndex ||
      attempt.benchmark?.case_index !== item.case_index ||
      attempt.opencorvus?.profile !== item.profile ||
      !expectedSlot ||
      !item.run_id ||
      launchedRunIDs.has(String(item.run_id))
    ) {
      reasons.push(`launched_trial:${item.profile}:${item.case_index}`)
      continue
    }
    const startedAt = attempt.started_at
    const finishedAt = attempt.finished_at
    if (
      typeof startedAt !== "number" ||
      typeof finishedAt !== "number" ||
      !Number.isFinite(startedAt) ||
      !Number.isFinite(finishedAt) ||
      finishedAt < startedAt
    ) {
      reasons.push(`launched_interval:${item.profile}:${item.case_index}`)
      continue
    }
    launchedRunIDs.add(String(item.run_id))
    intervals.push({
      profile: item.profile,
      waveIndex: item.waveIndex,
      caseIndex: item.case_index,
      start: startedAt,
      end: finishedAt,
    })
  }
  for (const waveIndex of waveIndexes) {
    const waveLaunched = launched.filter((item) => item.waveIndex === waveIndex)
    if (waveLaunched.length > 5 || new Set(waveLaunched.map((item) => item.case_index)).size !== waveLaunched.length) {
      reasons.push(`wave_launch_shape:${waveIndex}`)
    }
  }
  const eligibleRunIDs = new Set<string>()
  const sealingRunIDs = new Set<string>()
  const adoptedRunIDs = new Set<string>()
  for (const item of eligibleClaims) {
    const attempt = input.attempts.find((record) => record.run_id === item.run_id)
    const expectedSlot = input.plan.waves?.[item.waveIndex - 1]?.some(
      (slot: any) => slot.case_index === item.case_index && slot.profile === item.profile,
    )
    const adopted = preexisting.get(String(item.run_id))
    const currentBatch = attempt?.benchmark?.batch_run_id === input.plan.batch_run_id
    if (
      !attempt ||
      attempt.benchmark?.case_index !== item.case_index ||
      attempt.opencorvus?.profile !== item.profile ||
      !expectedSlot ||
      !item.run_id ||
      eligibleRunIDs.has(String(item.run_id)) ||
      (currentBatch
        ? !launchedRunIDs.has(String(item.run_id)) || attempt.benchmark?.batch_plan_sha256 !== input.planSHA256
        : !adopted ||
          adopted.case_index !== item.case_index ||
          adopted.profile !== item.profile ||
          attempt.leaderboard_eligible !== true)
    ) {
      reasons.push(`eligible_trial_contract:${item.profile}:${item.case_index}`)
      continue
    }
    if (attempt.raw_leaderboard_eligible !== true) {
      reasons.push(`eligible_trial_raw_invalid:${item.profile}:${item.case_index}`)
      continue
    }
    eligibleRunIDs.add(String(item.run_id))
    if (currentBatch) sealingRunIDs.add(String(item.run_id))
    else adoptedRunIDs.add(String(item.run_id))
  }
  for (const waveIndex of rolling ? [0] : waveIndexes) {
    const scoped = rolling ? intervals : intervals.filter((item) => item.waveIndex === waveIndex)
    const events = scoped.flatMap((item) => [
      { at: item.start, delta: 1 },
      { at: item.end, delta: -1 },
    ])
      .sort((left, right) => left.at - right.at || left.delta - right.delta)
    let active = 0
    for (const event of events) {
      active += event.delta
      if (active > 5) reasons.push(rolling ? "rolling_concurrency" : `wave_concurrency:${waveIndex}`)
    }
  }
  if (rolling) {
    for (const caseIndex of expectedCases) {
      const chain = intervals
        .filter((item) => item.caseIndex === caseIndex)
        .sort((left, right) => left.waveIndex - right.waveIndex)
      for (let index = 1; index < chain.length; index++) {
        if (chain[index]!.start < chain[index - 1]!.end) reasons.push(`rolling_case_overlap:${caseIndex}`)
      }
    }
  } else {
    const waveCompletedAt = Number(input.waveCompletion?.completed_at)
    if (waveCompletionValid && intervals.some((item) => item.waveIndex === 1 && item.end > waveCompletedAt)) {
      reasons.push("wave_1_barrier_end")
    }
    if (waveCompletionValid && intervals.some((item) => item.waveIndex === 2 && item.start < waveCompletedAt)) {
      reasons.push("wave_2_barrier_start")
    }
  }
  const selectedSlots = waveIndexes
    .flatMap((waveIndex) =>
      (input.receipt[`wave_${waveIndex}`]?.eligible ?? []).map((item: any) => `${item.case_index}:${item.profile}`),
    )
    .sort()
  const expectedSelectedSlots = expectedCases
    .flatMap((caseIndex) => (input.plan.profiles ?? []).map((profile: string) => `${caseIndex}:${profile}`))
    .sort()
  if (input.receipt.status === "completed" && JSON.stringify(selectedSlots) !== JSON.stringify(expectedSelectedSlots)) {
    reasons.push("selected_case_coverage")
  }
  return {
    passed: reasons.length === 0,
    status: reasons.length === 0 ? input.receipt.status : "invalid",
    reasons,
    eligible_run_ids: [...eligibleRunIDs].sort(),
    sealing_run_ids: [...sealingRunIDs].sort(),
    adopted_run_ids: [...adoptedRunIDs].sort(),
  }
}

/**
 * Runs whose own raw evidence is still sealed when a sibling is invalidated
 * after the original batch receipt was written.
 *
 * `auditBatchEvidence` intentionally rejects the old receipt because it claimed
 * the now-invalid sibling as eligible. That does not erase the exact launch and
 * per-run seal of another run in the same receipt. Reuse is safe only when the
 * receipt has no structural, identity, coverage, or concurrency violation: the
 * only permitted audit reasons are the post-hoc invalid eligible claims, and a
 * run enters this list only if the audit already retained it in
 * `sealing_run_ids`.
 */
export function reusableBatchCandidateRunIDs(audit: {
  passed?: boolean
  reasons?: unknown
  sealing_run_ids?: unknown
}): string[] {
  const sealingRunIDs = Array.isArray(audit.sealing_run_ids)
    ? audit.sealing_run_ids.filter((runID): runID is string => typeof runID === "string").sort()
    : []
  if (audit.passed === true) return sealingRunIDs
  const reasons = Array.isArray(audit.reasons)
    ? audit.reasons.filter((reason): reason is string => typeof reason === "string")
    : []
  if (reasons.length === 0 || !reasons.every((reason) => reason.startsWith("eligible_trial_raw_invalid:"))) return []
  return sealingRunIDs
}

export type PlannedAutomationBenchSlotState =
  | { kind: "running" }
  | { kind: "invalidated"; status: string; reason: string }
  | { kind: "queued" }

/** Project one planned slot from the authorities that already own its state. */
export function plannedAutomationBenchSlotState(input: {
  active: boolean
  invalidation?: { status: string; reason: string }
}): PlannedAutomationBenchSlotState {
  if (input.active) return { kind: "running" }
  if (input.invalidation) return { kind: "invalidated", ...input.invalidation }
  return { kind: "queued" }
}

export function paperEvidenceChecks(input: {
  manifestVerified: boolean
  providerLedgerVerified: boolean
  profileVerified: boolean
  isolationVerified: boolean
  benchmarkIdentityVerified: boolean
  rawEvidenceVerified: boolean
}) {
  const failed = Object.entries(input)
    .filter(([, passed]) => !passed)
    .map(([name]) => name)
  return { passed: failed.length === 0, failed }
}

type TranscriptMessage = {
  info?: Record<string, any>
  parts?: Array<Record<string, any>>
}

function finiteNonnegative(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0
}

export function summarizeTranscriptUsage(transcript: TranscriptMessage[]): TokenBreakdown {
  const result: TokenBreakdown = {
    input: 0,
    output: 0,
    reasoning: 0,
    cacheRead: 0,
    cacheWrite: 0,
    total: 0,
    costUSD: 0,
    pricedCalls: 0,
    unpricedCalls: 0,
    assistantMessages: 0,
  }
  for (const message of transcript) {
    const info = message.info
    if (info?.role !== "assistant" || !info.tokens) continue
    result.assistantMessages++
    result.input += finiteNonnegative(info.tokens.input)
    result.output += finiteNonnegative(info.tokens.output)
    result.reasoning += finiteNonnegative(info.tokens.reasoning)
    result.cacheRead += finiteNonnegative(info.tokens.cache?.read)
    result.cacheWrite += finiteNonnegative(info.tokens.cache?.write)
    result.total += finiteNonnegative(info.tokens.total)
    result.costUSD += finiteNonnegative(info.cost)
    if (info.billing?.status === "priced") result.pricedCalls++
    if (info.billing?.status === "unpriced") result.unpricedCalls++
  }
  return result
}

export function benchmarkActivitySignature(input: {
  board: Record<string, any>
  transcript: TranscriptMessage[]
  trace: Array<Record<string, any>>
  benchmarkEventCount: number
}): string {
  const messages = input.transcript.map((message) => ({
    id: message.info?.id,
    role: message.info?.role,
    agent: message.info?.agent,
    updated: message.info?.time?.updated ?? message.info?.time?.completed ?? message.info?.time?.created,
    parts: (message.parts ?? []).map((part) => ({
      id: part.id,
      type: part.type,
      status: part.state?.status,
      start: part.state?.time?.start ?? part.time?.start,
      end: part.state?.time?.end ?? part.time?.end,
      textLength: typeof part.text === "string" ? part.text.length : undefined,
    })),
  }))
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        task: {
          id: input.board.task?.id,
          status: input.board.task?.status,
          lifecycleStatus: input.board.task?.lifecycleStatus,
          completedAt: input.board.task?.completedAt ?? input.board.task?.time?.completed,
        },
        progress: (input.board.progress ?? []).map?.((item: any) => [
          item.id,
          item.kind,
          item.status,
          item.time?.created,
          item.time?.completed,
        ]),
        artifactRevisions: (input.board.artifacts ?? []).map((item: any) => [item.id, item.revision, item.kind]),
        messages,
        trace: input.trace.map((event) => [event.ts, event.kind, event.sessionID, event.agentName]),
        benchmarkEventCount: input.benchmarkEventCount,
      }),
    )
    .digest("hex")
}

export function normalizeTrajectory(input: {
  transcript: TranscriptMessage[]
  trace: Array<Record<string, any>>
  benchmarkEvents: Array<Record<string, any>>
}): TrajectoryEvent[] {
  const events: TrajectoryEvent[] = []
  const requestStarts = new Map<string, number[]>()
  for (const event of input.trace) {
    const at = finiteNonnegative(event.ts)
    const lane = typeof event.agentName === "string" && event.agentName ? event.agentName : "host"
    if (event.kind === "llm_request") {
      const queue = requestStarts.get(lane) ?? []
      queue.push(at)
      requestStarts.set(lane, queue)
      continue
    }
    if (["agent_turn", "orchestrator_wake", "agent_turn_failure", "orchestrator_wake_failure"].includes(event.kind)) {
      const queue = requestStarts.get(lane) ?? []
      const start = queue.shift() ?? at
      const failed = String(event.kind).endsWith("failure")
      events.push({
        at: start,
        end: at,
        lane,
        kind: failed ? "failure" : lane.includes("orchestrator") ? "decision" : "turn",
        label: event.kind,
        source: "trace",
      })
    }
  }
  for (const message of input.transcript) {
    const lane = typeof message.info?.agent === "string" && message.info.agent ? message.info.agent : "host"
    for (const part of message.parts ?? []) {
      if (part.type !== "tool") continue
      const at = finiteNonnegative(part.state?.time?.start ?? message.info?.time?.created)
      const end = finiteNonnegative(part.state?.time?.end)
      const label = String(part.tool ?? "tool")
      events.push({
        at,
        ...(end >= at && end > 0 ? { end } : {}),
        lane,
        kind: label === "skill" ? "skill" : part.state?.status === "error" ? "failure" : "tool",
        label,
        source: "transcript",
      })
    }
  }
  for (const event of input.benchmarkEvents) {
    events.push({
      at: finiteNonnegative(event.ts),
      ...(finiteNonnegative(event.end) >= finiteNonnegative(event.ts) ? { end: finiteNonnegative(event.end) } : {}),
      lane: "automationbench",
      kind: event.kind === "score" ? "decision" : event.kind === "error" ? "failure" : "benchmark",
      label: String(event.tool ?? event.kind ?? "benchmark"),
      source: "benchmark",
    })
  }
  return events.sort((left, right) => left.at - right.at || left.lane.localeCompare(right.lane))
}

function escapeXML(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;")
}

export function renderTrajectorySVG(input: {
  title: string
  events: TrajectoryEvent[]
  tokens: TokenBreakdown
  runDurationMs?: number
  modelCalls?: number
  toolCalls?: number
}): string {
  const lanes = [...new Set(input.events.map((event) => event.lane))]
  const min = Math.min(...input.events.map((event) => event.at), Date.now())
  const max = Math.max(...input.events.map((event) => event.end ?? event.at), min + 1)
  const width = 1400
  const left = 190
  const right = 40
  const top = 116
  const laneHeight = 52
  const height = top + Math.max(1, lanes.length) * laneHeight + 92
  const plotWidth = width - left - right
  const x = (value: number) => left + ((value - min) / Math.max(1, max - min)) * plotWidth
  const colors: Record<TrajectoryEvent["kind"], string> = {
    llm: "#2563eb",
    turn: "#2563eb",
    tool: "#0f766e",
    skill: "#7c3aed",
    benchmark: "#d97706",
    decision: "#15803d",
    failure: "#b91c1c",
  }
  const rows = lanes
    .map((lane, index) => {
      const y = top + index * laneHeight
      const marks = input.events
        .filter((event) => event.lane === lane)
        .sort((left, right) => (right.end ?? right.at) - right.at - ((left.end ?? left.at) - left.at))
        .map((event) => {
          const startX = x(event.at)
          const endX = x(event.end ?? event.at)
          const color = colors[event.kind]
          const durationWidth = Math.max(4, endX - startX)
          return `<g><title>${escapeXML(event.label)} · ${Math.max(0, (event.end ?? event.at) - event.at)} ms</title><rect x="${startX.toFixed(1)}" y="${y + 12}" width="${durationWidth.toFixed(1)}" height="20" rx="3" fill="${color}" opacity="0.88"/></g>`
        })
        .join("")
      return `<text x="${left - 14}" y="${y + 27}" text-anchor="end" font-size="13" fill="#111827">${escapeXML(lane)}</text><line x1="${left}" y1="${y + 38}" x2="${width - right}" y2="${y + 38}" stroke="#e5e7eb"/>${marks}`
    })
    .join("")
  const durationSeconds = (max - min) / 1000
  const runDurationSeconds = finiteNonnegative(input.runDurationMs) / 1000
  const durationLabel =
    input.runDurationMs === undefined
      ? `${durationSeconds.toFixed(1)} s event span`
      : `${runDurationSeconds.toFixed(1)} s run · ${durationSeconds.toFixed(1)} s event span`
  const callLabel = [
    input.modelCalls === undefined ? undefined : `${input.modelCalls} model calls`,
    input.toolCalls === undefined ? undefined : `${input.toolCalls} benchmark calls`,
  ].filter(Boolean)
  const ticks = [0, 0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const tickX = left + ratio * plotWidth
      return `<line x1="${tickX}" y1="${top - 12}" x2="${tickX}" y2="${height - 72}" stroke="#f3f4f6"/><text x="${tickX}" y="${top - 20}" text-anchor="middle" font-size="11" fill="#4b5563">${(durationSeconds * ratio).toFixed(0)}s</text>`
    })
    .join("")
  const legendKinds: Array<[TrajectoryEvent["kind"], string]> = [
    ["turn", "agent turn"],
    ["tool", "harness tool"],
    ["skill", "Skill"],
    ["benchmark", "benchmark API"],
    ["decision", "decision/scorer"],
    ["failure", "failure"],
  ]
  const legend = legendKinds
    .map(
      ([kind, label], index) =>
        `<rect x="${left + index * 170}" y="${height - 52}" width="14" height="14" rx="2" fill="${colors[kind]}"/><text x="${left + index * 170 + 21}" y="${height - 40}" font-size="11" fill="#374151">${label}</text>`,
    )
    .join("")
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">`,
    `<title id="title">${escapeXML(input.title)}</title>`,
    `<desc id="desc">Aligned OpenCorvus agent and AutomationBench tool trajectory.</desc>`,
    `<rect width="100%" height="100%" fill="#ffffff"/>`,
    `<text x="24" y="32" font-size="20" font-weight="600" fill="#111827">${escapeXML(input.title)}</text>`,
    `<text x="24" y="58" font-size="12" fill="#4b5563">${durationLabel} · ${input.events.length} events${callLabel.length ? ` · ${callLabel.join(" · ")}` : ""} · ${input.tokens.total.toLocaleString()} provider tokens · ${input.tokens.output.toLocaleString()} text output · ${input.tokens.reasoning.toLocaleString()} reasoning</text>`,
    ticks,
    `<line x1="${left}" y1="${top - 12}" x2="${width - right}" y2="${top - 12}" stroke="#9ca3af"/>`,
    rows,
    legend,
    `<text x="${width - right}" y="${height - 40}" text-anchor="end" font-size="11" fill="#6b7280">Hover marks in SVG for exact labels and durations.</text>`,
    `</svg>`,
  ].join("\n")
}

export const AUTOMATIONBENCH_SKILL_NAME = "automationbench-api"
export const AUTOMATIONBENCH_SKILL_REF = `default/skill/${AUTOMATIONBENCH_SKILL_NAME}`

export type SkillMountMatrix = {
  active_profile?: unknown
  projection_hash?: unknown
  skills?: Array<{ ref?: unknown; name?: unknown; location?: unknown; projection_source?: unknown }>
  agents?: Array<{
    agent_id?: unknown
    base_role?: unknown
    skill_mountable?: unknown
    skill_tool_available?: unknown
  }>
  matrix?: Array<{
    agent_id?: unknown
    grants?: Array<{ ref?: unknown; effective?: unknown; enabled?: unknown; reason?: unknown }>
  }>
}

/**
 * The experimental Skill is a project-local Skill, and a projected Expert Squad agent only sees the
 * Skills its manifest grants plus explicit operator mounts. Declaring `skill.enabled` in the result
 * without measuring the projection is a self-report: the first five-case wave wrote it while every
 * Agent's `skill` call returned zero matches. This audits the Host's own mount matrix instead.
 */
export function auditSkillProjection(input: {
  profile: string
  matrix: SkillMountMatrix
  skillName?: string
  skillRef?: string
  expectedLocation?: string
  expectedSHA256?: string
  poolSHA256?: string
}) {
  const skillName = input.skillName ?? AUTOMATIONBENCH_SKILL_NAME
  const skillRef = input.skillRef ?? AUTOMATIONBENCH_SKILL_REF
  const grantsByAgent = new Map(
    (input.matrix.matrix ?? []).map((row) => [
      String(row.agent_id ?? ""),
      (row.grants ?? []).find((grant) => grant.ref === skillRef),
    ]),
  )
  const pool = (input.matrix.skills ?? []).find((skill) => skill.ref === skillRef)
  const mounted: string[] = []
  const unmountable: Array<{ agent_id: string; base_role: string; reason: string }> = []
  const violations: string[] = []
  for (const agent of input.matrix.agents ?? []) {
    const agentID = String(agent.agent_id ?? "")
    const baseRole = String(agent.base_role ?? "")
    // An `explore` runtime template is neither Skill-mountable nor projected the `skill` Tool at
    // all, so demanding the mount there would be a fail-closed check no profile can ever pass.
    if (agent.skill_mountable !== true || agent.skill_tool_available !== true) {
      unmountable.push({
        agent_id: agentID,
        base_role: baseRole,
        reason: agent.skill_mountable !== true ? "base_role_not_skill_mountable" : "skill_tool_not_projected",
      })
      continue
    }
    const grant = grantsByAgent.get(agentID)
    if (grant?.effective !== true) {
      violations.push(`not_effective:${agentID}`)
      continue
    }
    if (grant.enabled !== true) {
      violations.push(`not_enabled:${agentID}:${String(grant.reason ?? "unknown")}`)
      continue
    }
    mounted.push(agentID)
  }
  if (input.matrix.active_profile !== input.profile) violations.push("profile_mismatch")
  if (!pool) violations.push("skill_absent_from_pool")
  else {
    if (pool.name !== skillName) violations.push("pool_name_mismatch")
    if (pool.projection_source !== "default") violations.push("pool_not_project_installed")
    if (
      input.expectedLocation &&
      normalizeAuditPath(String(pool.location ?? "")) !== normalizeAuditPath(input.expectedLocation)
    ) {
      violations.push("pool_location_mismatch")
    }
  }
  if (mounted.length === 0) violations.push("no_agent_mounted")
  if (input.expectedSHA256 && input.poolSHA256 && input.expectedSHA256 !== input.poolSHA256) {
    violations.push("skill_content_mismatch")
  }
  unmountable.push({
    agent_id: SCHEDULER_AGENT_ID,
    base_role: "orchestrator",
    reason: "scheduler_outside_mount_matrix",
  })
  return {
    passed: violations.length === 0,
    skill_name: skillName,
    skill_ref: skillRef,
    profile: input.profile,
    projection_hash: typeof input.matrix.projection_hash === "string" ? input.matrix.projection_hash : null,
    mounted_agents: mounted.sort(),
    unmountable_agents: unmountable.sort((left, right) => left.agent_id.localeCompare(right.agent_id)),
    violations,
  }
}

export const SCHEDULER_AGENT_ID = "orchestrator"

/**
 * The pre-Task projection audit can only speak about agents the Host's mount matrix listed. When
 * `SkillMount.matrix()` omitted scheduler-only `universal-build`, the audit reported a passing
 * projection while the worker that actually performed every Advanced mutation searched an empty
 * Skill surface — a false positive that survived two sealed runs.
 *
 * This closes that class of gap from the other side, against evidence rather than against the same
 * matrix: every Agent the sealed transcript shows actually running must be accounted for by the
 * projection audit, either as mounted or as explicitly unmountable. An Agent that ran without
 * appearing in either list means the projection never described the real execution.
 */
/**
 * Accept a sealed run's Skill evidence.
 *
 * The catalog and the independent verifier each used to hand-roll this comparison, which is how the
 * runner drifted away from both: a mis-targeted edit wrote `dispatched_coverage` into
 * `skill-projection.json` and left `result.json` without it, and nothing failed until a real batch
 * would have been rejected wholesale. One predicate, recomputed from raw evidence and required to
 * agree with both receipts, is the seam that keeps runner and checker from disagreeing silently.
 */
export function auditSkillEvidenceSeal(input: {
  profile: unknown
  resultSkill: any
  projectionFile: any
  transcript: TranscriptMessage[]
}) {
  const projection = auditSkillProjection({
    profile: String(input.profile ?? ""),
    matrix: input.projectionFile?.matrix ?? {},
  })
  const coverage = auditDispatchedSkillCoverage({ projection, transcript: input.transcript })
  const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right ?? null)
  const violations: string[] = []
  if (!projection.passed) violations.push("projection_failed")
  if (!coverage.passed) violations.push(`uncovered_agents:${coverage.uncovered_agents.join("|")}`)
  if (input.projectionFile?.profile !== input.profile) violations.push("receipt_profile_mismatch")
  if (input.projectionFile?.skill?.name !== input.resultSkill?.name) violations.push("skill_name_mismatch")
  if (!same(projection, input.projectionFile?.skill?.projection)) violations.push("receipt_projection_mismatch")
  if (!same(projection, input.resultSkill?.projection)) violations.push("result_projection_mismatch")
  if (!same(coverage, input.projectionFile?.skill?.dispatched_coverage)) violations.push("receipt_coverage_mismatch")
  if (!same(coverage, input.resultSkill?.dispatched_coverage)) violations.push("result_coverage_mismatch")
  return { passed: violations.length === 0, projection, coverage, violations }
}

export function auditDispatchedSkillCoverage(input: {
  projection: { mounted_agents: string[]; unmountable_agents: Array<{ agent_id: string }> }
  transcript: TranscriptMessage[]
}) {
  const accounted = new Set([
    ...input.projection.mounted_agents,
    ...input.projection.unmountable_agents.map((agent) => agent.agent_id),
  ])
  const dispatched = [
    ...new Set(
      input.transcript
        .map((message) => message.info?.agent)
        .filter((agent): agent is string => typeof agent === "string" && agent.length > 0),
    ),
  ].sort()
  const uncovered = dispatched.filter((agent) => !accounted.has(agent))
  return {
    passed: uncovered.length === 0,
    dispatched_agents: dispatched,
    uncovered_agents: uncovered,
  }
}

/**
 * Context-economics metric definitions.
 *
 * Defined in Phase 0 rather than in the phase that finally reports them: a
 * metric invented after the change it is meant to judge is a metric chosen to
 * flatter the change. `computable` says whether sealed evidence can answer it
 * today; the rest name what has to exist first.
 *
 * Every entry is a ratio, a count, or a share. None is a token ceiling — a
 * truncation gate buys its own metric by discarding the exact dates, URLs,
 * amounts and recipients strict scoring depends on.
 */
export const CONTEXT_ECONOMICS_METRICS = [
  {
    id: "fresh_input_per_case",
    unit: "tokens",
    direction: "lower_is_better",
    source: "provider_usage_ledger.input_tokens",
    computable: true,
  },
  {
    id: "cache_read_over_fresh_input",
    unit: "ratio",
    direction: "higher_is_better",
    source: "provider_usage_ledger.cache_read_tokens / input_tokens",
    computable: true,
  },
  {
    id: "agent_cache_hit",
    unit: "ratio",
    direction: "higher_is_better",
    source: "result.opencorvus.tokens_by_agent",
    computable: true,
  },
  {
    id: "model_calls_per_case",
    unit: "count",
    direction: "lower_is_better",
    source: "result.opencorvus.tokens.modelCalls",
    computable: true,
  },
  {
    id: "resent_prefix_tokens",
    unit: "tokens",
    direction: "lower_is_better",
    source: "trace.llm_request.promptComposition, consecutive calls per Session",
    computable: true,
  },
  {
    id: "stable_prefix_share",
    unit: "ratio",
    direction: "higher_is_better",
    source: "trace.llm_request.promptComposition, consecutive calls per Session",
    computable: true,
  },
  {
    id: "artifact_reads_per_agent",
    unit: "count",
    direction: "lower_is_better",
    source: "runtime-database-snapshot part projection, tool=artifact_read",
    computable: true,
  },
  {
    id: "first_business_write_share",
    unit: "ratio",
    direction: "lower_is_better",
    source: "automationbench-events.jsonl write operations against run duration",
    computable: true,
  },
  {
    id: "last_write_to_terminal_ms",
    unit: "milliseconds",
    direction: "lower_is_better",
    source: "automationbench-events.jsonl last write against terminal board time",
    computable: true,
  },
  {
    id: "repeat_obligation_cycles",
    unit: "count",
    direction: "lower_is_better",
    source: "obligation ledger",
    computable: false,
  },
] as const

type LLMRequestTraceEvent = {
  kind?: unknown
  sessionID?: unknown
  agentName?: unknown
  payload?: { promptComposition?: PromptCompositionFingerprint }
}

/**
 * Per-Session prompt reuse, derived from consecutive `llm_request` fingerprints.
 *
 * "Duplicated input" is defined here as tokens the Session had already sent in
 * an earlier call and paid for again because a block ahead of them changed.
 * That is a Host-side account of what *could* have been cached, not a claim
 * about what the Provider did cache — a cache read is a property of one common
 * prefix and cannot be decomposed per block. Comparing this series against the
 * ledger's own `cache_read_tokens` is what confirms or refutes the hypothesis.
 */
export function analyzePromptComposition(traceEvents: unknown[]) {
  const bySession = new Map<string, PromptCompositionFingerprint[]>()
  for (const raw of traceEvents) {
    const event = raw as LLMRequestTraceEvent
    if (event?.kind !== "llm_request") continue
    const fingerprint = event.payload?.promptComposition
    if (!fingerprint || typeof event.sessionID !== "string") continue
    const current = bySession.get(event.sessionID) ?? []
    current.push(fingerprint)
    bySession.set(event.sessionID, current)
  }
  const sessions = [...bySession.entries()].map(([sessionID, fingerprints]) => {
    let stableTokens = 0
    let divergentTokens = 0
    let resentTokens = 0
    let appendOnlyCalls = 0
    const firstDivergentLabels: Record<string, number> = {}
    const seenDigests = new Set<string>()
    for (const [index, fingerprint] of fingerprints.entries()) {
      const divergence = comparePromptComposition(index === 0 ? undefined : fingerprints[index - 1], fingerprint)
      stableTokens += divergence.stablePrefixTokensEst
      divergentTokens += divergence.divergentTokensEst
      if (divergence.appendOnly) appendOnlyCalls += 1
      if (divergence.comparable && divergence.firstDivergentLabel) {
        firstDivergentLabels[divergence.firstDivergentLabel] =
          (firstDivergentLabels[divergence.firstDivergentLabel] ?? 0) + 1
      }
      for (const [blockIndex, block] of fingerprint.blocks.entries()) {
        // A block at or past the divergence point is re-sent as fresh input.
        // If its exact digest was already sent by this Session, the Host paid
        // twice for text that never changed.
        if (blockIndex >= divergence.firstDivergentIndex && seenDigests.has(block.sha256)) {
          resentTokens += block.tokensEst
        }
        seenDigests.add(block.sha256)
      }
    }
    const total = stableTokens + divergentTokens
    return {
      session_id: sessionID,
      calls: fingerprints.length,
      stable_prefix_tokens_est: stableTokens,
      divergent_tokens_est: divergentTokens,
      resent_prefix_tokens_est: resentTokens,
      stable_prefix_share: total === 0 ? null : stableTokens / total,
      append_only_calls: appendOnlyCalls,
      first_divergent_labels: firstDivergentLabels,
    }
  })
  const totals = sessions.reduce(
    (sum, item) => ({
      calls: sum.calls + item.calls,
      stable: sum.stable + item.stable_prefix_tokens_est,
      divergent: sum.divergent + item.divergent_tokens_est,
      resent: sum.resent + item.resent_prefix_tokens_est,
    }),
    { calls: 0, stable: 0, divergent: 0, resent: 0 },
  )
  return {
    sessions: sessions.sort((left, right) => right.divergent_tokens_est - left.divergent_tokens_est),
    calls: totals.calls,
    stable_prefix_tokens_est: totals.stable,
    divergent_tokens_est: totals.divergent,
    resent_prefix_tokens_est: totals.resent,
    stable_prefix_share: totals.stable + totals.divergent === 0 ? null : totals.stable / (totals.stable + totals.divergent),
  }
}
