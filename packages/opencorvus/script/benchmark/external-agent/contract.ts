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
  const preexisting = new Map(
    ["base", "advanced"].flatMap((profile) =>
      (input.plan.preexisting_eligible?.[profile] ?? []).map((item: any) => [String(item.run_id), item] as const),
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
    const expectedSlot = input.plan.waves?.[item.waveIndex - 1]?.some(
      (slot: any) => slot.case_index === item.case_index && slot.profile === item.profile,
    )
    if (input.receipt.status === "failed" && (!item.run_id || attempt?.raw_leaderboard_eligible !== true)) continue
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
    launchedRunIDs.add(String(item.run_id))
    intervals.push({
      profile: item.profile,
      waveIndex: item.waveIndex,
      caseIndex: item.case_index,
      start: Number(attempt.started_at),
      end: Number(attempt.finished_at),
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
      attempt.raw_leaderboard_eligible !== true ||
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
      reasons.push(`eligible_trial:${item.profile}:${item.case_index}`)
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
