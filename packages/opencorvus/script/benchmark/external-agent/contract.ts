import {
  comparePromptComposition,
  type PromptCompositionFingerprint,
} from "../../../src/session/prompt-composition"
import crypto from "node:crypto"
import { ProviderError } from "../../../src/provider/error"

export const EXTERNAL_BENCHMARK_SCHEMA_VERSION = 1 as const

export class EmptySuccessfulJsonResponseError extends Error {
  constructor(readonly route: string) {
    super(`Successful JSON response for ${route} had an empty body`)
    this.name = "EmptySuccessfulJsonResponseError"
  }
}

export function parseRequiredJsonResponse<T>(body: string, route: string): T {
  if (!body) throw new EmptySuccessfulJsonResponseError(route)
  return JSON.parse(body) as T
}

export async function retryReadOnlyProjection<T>(input: {
  read: () => Promise<T>
  deadline: number
  delayMs?: number
  now?: () => number
  delay?: (milliseconds: number) => Promise<void>
}): Promise<T> {
  const now = input.now ?? Date.now
  const delay = input.delay ?? ((milliseconds: number) => Bun.sleep(milliseconds))
  const delayMs = input.delayMs ?? 250
  while (true) {
    try {
      return await input.read()
    } catch (error) {
      if (!(error instanceof EmptySuccessfulJsonResponseError) || now() >= input.deadline) throw error
      await delay(Math.min(delayMs, Math.max(0, input.deadline - now())))
      if (now() >= input.deadline) throw error
    }
  }
}

export async function settlePendingSnapshotAfterRefresh<Pending, Snapshot>(input: {
  pending: Set<Pending>
  include?: (item: Pending) => boolean
  refresh: () => Promise<Snapshot>
  settle: (items: readonly Pending[], snapshot: Snapshot) => Promise<void>
}) {
  const items = [...input.pending].filter((item) => input.include?.(item) ?? true)
  for (const item of items) input.pending.delete(item)
  const snapshot = await input.refresh()
  await input.settle(items, snapshot)
  return items
}

export async function mapSettledWithBoundedConcurrency<Input, Output>(
  values: readonly Input[],
  concurrency: number,
  mapper: (value: Input, index: number) => Promise<Output>,
  options: { shouldStart?: () => boolean } = {},
) {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
    throw new Error("Bounded concurrency must be a positive safe integer")
  }
  const results = new Array<PromiseSettledResult<Output>>(values.length)
  let nextIndex = 0
  const workerCount = Math.min(concurrency, values.length)
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        if (options.shouldStart && !options.shouldStart()) {
          while (nextIndex < values.length) {
            const stoppedIndex = nextIndex
            nextIndex += 1
            results[stoppedIndex] = {
              status: "rejected",
              reason: new Error("Bounded concurrency admission stopped before mapper start"),
            }
          }
          return
        }
        const index = nextIndex
        nextIndex += 1
        if (index >= values.length) return
        try {
          results[index] = { status: "fulfilled", value: await mapper(values[index]!, index) }
        } catch (reason) {
          results[index] = { status: "rejected", reason }
        }
      }
    }),
  )
  return results
}

export function createRestartableDrain(input: { hasWork: () => boolean; drain: () => Promise<void> }) {
  let failure: Error | undefined
  let running: Promise<void> | undefined
  const start = () => {
    if (failure || running || !input.hasWork()) return
    const settled = Promise.resolve()
      .then(input.drain)
      .catch((error) => {
        failure = error instanceof Error ? error : new Error(String(error))
      })
    const tracked = settled.finally(() => {
      if (running === tracked) running = undefined
      start()
    })
    running = tracked
  }
  return {
    wake: start,
    failure: () => failure,
    waitForIdle: async () => {
      while (running || input.hasWork()) {
        if (failure) throw failure
        start()
        const current = running
        if (current) await current
      }
      if (failure) throw failure
    },
  }
}

export function auditBatchReceiptRedaction(input: {
  redactionFileName: string
  redactionReceipt: unknown
  targetFileName: string
  targetBytes: Uint8Array
}) {
  const receipt =
    input.redactionReceipt && typeof input.redactionReceipt === "object" && !Array.isArray(input.redactionReceipt)
      ? (input.redactionReceipt as Record<string, any>)
      : {}
  const match = /^batch-(\d{2})-([a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})-redaction-receipt\.json$/.exec(
    input.redactionFileName,
  )
  let target: Record<string, any> = {}
  let targetText = ""
  try {
    targetText = Buffer.from(input.targetBytes).toString("utf8")
    target = JSON.parse(targetText)
  } catch {}
  const sha256 = (bytes: Uint8Array) => crypto.createHash("sha256").update(bytes).digest("hex")
  const afterSHA256 = sha256(input.targetBytes)
  const redactedTailCount = ["wave_1", "wave_2"].reduce((count, wave) => {
    const launched = target[wave]?.launched
    return (
      count +
      (Array.isArray(launched)
        ? launched.filter((item) => typeof item?.stderr_tail === "string" && item.stderr_tail.includes("<redacted>"))
            .length
        : 0)
    )
  }, 0)
  const stderrTails = ["wave_1", "wave_2"].flatMap((wave) => {
    const launched = target[wave]?.launched
    return Array.isArray(launched)
      ? launched.map((item) => item?.stderr_tail).filter((value): value is string => typeof value === "string")
      : []
  })
  const exactLabelsRedacted = ["set-cookie", "x-codex-turn-state"].every((label) => {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const pattern = new RegExp(`(?:^|[\\s,{])["']?${escaped}["']?\\s*:\\s*["']?<redacted>["']?`, "i")
    return stderrTails.some((tail) => pattern.test(tail))
  })
  const violations = [
    ...(match ? [] : ["redaction_filename"]),
    ...(receipt.schema_version === 1 ? [] : ["redaction_schema"]),
    ...(receipt.kind === "automationbench_batch_receipt_secret_redaction" ? [] : ["redaction_kind"]),
    ...(receipt.target === input.targetFileName ? [] : ["redaction_target"]),
    ...(receipt.reason === "provider_response_header_diagnostic_disclosure" ? [] : ["redaction_reason"]),
    ...(JSON.stringify(receipt.redacted_labels) === JSON.stringify(["set-cookie", "x-codex-turn-state"])
      ? []
      : ["redaction_labels"]),
    ...(Number.isSafeInteger(receipt.created_at) && receipt.created_at > 0 ? [] : ["redaction_created_at"]),
    ...(Number.isSafeInteger(receipt.changed_stderr_tails) && receipt.changed_stderr_tails > 0
      ? []
      : ["redaction_changed_count"]),
    ...(/^[a-f0-9]{64}$/.test(String(receipt.before_sha256 ?? "")) && receipt.before_sha256 !== afterSHA256
      ? []
      : ["redaction_before_sha256"]),
    ...(receipt.after_sha256 === afterSHA256 ? [] : ["redaction_after_sha256"]),
    ...(match && input.targetFileName === `batch-${match[1]}-${match[2]}-receipt.json` ? [] : ["redaction_prefix"]),
    ...(match && target.batch_run_id === match[2] && Number(target.batch_index) === Number(match[1])
      ? []
      : ["redaction_batch_identity"]),
    ...(redactedTailCount >= Number(receipt.changed_stderr_tails ?? 0) ? [] : ["redaction_tail_count"]),
    ...(exactLabelsRedacted ? [] : ["redaction_exact_labels_missing"]),
    ...(ProviderError.redactSensitiveProviderText(targetText) === targetText ? [] : ["redaction_target_still_sensitive"]),
  ]
  return { passed: violations.length === 0, target_sha256: afterSHA256, redacted_tail_count: redactedTailCount, violations }
}
export const LEGACY_TRACE_ATTESTATION_KIND = "post_hoc_operator_environment_attestation" as const
export const LEGACY_TRACE_ATTESTATION_LIMITATION =
  "This is a post-hoc operator environment attestation, not a contemporaneous per-run environment receipt. It preserves the listed official scores without claiming independently complete legacy Task trace capture."

export function auditLegacyTraceEnvironmentAttestation(input: unknown) {
  const value = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, any>) : {}
  const runs = Array.isArray(value.runs) ? value.runs : []
  const basis = value.basis && typeof value.basis === "object" && !Array.isArray(value.basis) ? value.basis : {}
  const profiles = Array.isArray(basis.profile_files) ? basis.profile_files : []
  const violations = [
    ...(value.schema_version === 1 ? [] : ["attestation_schema"]),
    ...(value.kind === LEGACY_TRACE_ATTESTATION_KIND ? [] : ["attestation_kind"]),
    ...(value.event_max_bytes === 512 * 1024 ? [] : ["attestation_event_bound"]),
    ...(Number.isSafeInteger(value.created_at) && value.created_at > 0 ? [] : ["attestation_created_at"]),
    ...(value.limitation === LEGACY_TRACE_ATTESTATION_LIMITATION ? [] : ["attestation_limitation"]),
    ...(basis.launch_form === "fresh wsl -u root -- bash -lc coordinator process" ? [] : ["attestation_launch_form"]),
    ...(basis.windows_parent_override_present_at_attestation === false ? [] : ["attestation_windows_env"]),
    ...(basis.wsl_login_override_present_at_attestation === false ? [] : ["attestation_wsl_login_env"]),
    ...(basis.wsl_pid1_override_present_at_attestation === false ? [] : ["attestation_wsl_pid1_env"]),
    ...(profiles.length > 0 ? [] : ["attestation_profile_files"]),
    ...profiles.flatMap((profile: any, index: number) =>
      typeof profile?.path === "string" &&
      typeof profile?.mtime_ns === "number" && Number.isFinite(profile.mtime_ns) && profile.mtime_ns > 0 &&
      Number.isSafeInteger(profile?.bytes) &&
      /^[a-f0-9]{64}$/.test(String(profile?.sha256 ?? "")) &&
      profile?.override_marker_present === false
        ? []
        : [`attestation_profile_file:${index}`],
    ),
    ...runs.flatMap((runID: unknown, index: number) =>
      typeof runID === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(runID)
        ? []
        : [`attestation_run_id:${index}`],
    ),
    ...(new Set(runs).size === runs.length ? [] : ["attestation_duplicate_run_id"]),
  ]
  return { passed: violations.length === 0, run_ids: runs.filter((item): item is string => typeof item === "string"), violations }
}

export function completeTaskTraceReceipt(taskIDs: string[], traceEvents: Array<Record<string, any>>) {
  const exactTaskIDs = [...new Set(taskIDs)].sort()
  const expectedTaskIDs = new Set(exactTaskIDs)
  const violations: string[] = []
  for (const [index, event] of traceEvents.entries()) {
    if (typeof event?.taskID !== "string" || !expectedTaskIDs.has(event.taskID)) {
      violations.push(`trace_event_task_identity:${index}:${String(event?.taskID ?? "missing")}`)
    }
  }
  return {
    schema_version: 1,
    kind: "complete_post_quiescence_task_trace",
    passed: violations.length === 0,
    task_ids: exactTaskIDs,
    tasks: exactTaskIDs.map((taskID) => {
      const events = traceEvents.filter((event) => event.taskID === taskID)
      return {
        task_id: taskID,
        event_count: events.length,
        events_sha256: crypto.createHash("sha256").update(JSON.stringify(events)).digest("hex"),
      }
    }),
    violations,
  }
}

export const TASK_TRACE_LIVE_TAIL_BYTES = 2 * 1024 * 1024
export const TASK_TRACE_DEFAULT_EVENT_BYTES = 512 * 1024
const LEGACY_TASK_TRACE_KINDS = new Set([
  "llm_request",
  "helper_llm_call",
  "agent_turn",
  "agent_turn_failure",
  "orchestrator_wake",
  "orchestrator_wake_failure",
])

export function auditTaskTraceScopeSeal(input: {
  taskIDs: string[]
  traceEvents: Array<Record<string, any>>
  tracedSessionIDs: string[]
  declaredScope: unknown
  legacyDefaultBoundAttested?: boolean
}) {
  const completeReceipt = completeTaskTraceReceipt(input.taskIDs, input.traceEvents)
  const baseScope = {
    kind: "task_bound_agent_trace",
    mission_session_traced: false,
    mission_usage_preserved_in_provider_ledger: true,
    traced_session_ids: [...input.tracedSessionIDs].sort(),
  }
  const completeScope = { ...baseScope, complete_task_trace: completeReceipt }
  const current = JSON.stringify(input.declaredScope ?? null) === JSON.stringify(completeScope)
  const legacyLines = input.traceEvents.map((event) => Buffer.byteLength(JSON.stringify(event), "utf8") + 1)
  const legacyCompactBytes = legacyLines.reduce((total, bytes) => total + bytes, 0)
  const legacyEventsUseBoundedPhysicalKinds = input.traceEvents.every(
    (event, index) =>
      LEGACY_TASK_TRACE_KINDS.has(String(event?.kind)) &&
      event?.payload !== undefined &&
      legacyLines[index]! <= TASK_TRACE_DEFAULT_EVENT_BYTES + 1,
  )
  // In tail mode the product reads exactly 2 MiB and removes at most one
  // canonical event line. With the frozen default 512 KiB event cap, the
  // returned compact JSONL must therefore be at least 2 MiB - 512 KiB - 1.
  // A smaller known-kind projection proves the source never entered tail mode.
  const legacy =
    input.legacyDefaultBoundAttested === true &&
    legacyEventsUseBoundedPhysicalKinds &&
    legacyCompactBytes < TASK_TRACE_LIVE_TAIL_BYTES - TASK_TRACE_DEFAULT_EVENT_BYTES - 1 &&
    JSON.stringify(input.declaredScope ?? null) === JSON.stringify(baseScope)
  const violations = [
    ...(completeReceipt.passed ? [] : completeReceipt.violations),
    ...(current || legacy ? [] : ["complete_task_trace_seal_missing_or_unproven"]),
  ]
  return {
    passed: violations.length === 0,
    mode: current ? "complete_post_quiescence" : legacy ? "legacy_operator_attested_tail_lower_bound" : "invalid",
    complete_task_trace: completeReceipt,
    legacy_compact_jsonl_bytes: legacyCompactBytes,
    violations,
  }
}

export function auditBenchmarkBunRuntime(packageManager: unknown, actualVersion: string | undefined) {
  const expectedVersion =
    typeof packageManager === "string" && packageManager.startsWith("bun@")
      ? packageManager.slice("bun@".length).trim()
      : ""
  const actual = actualVersion?.trim() ?? ""
  return {
    passed: expectedVersion.length > 0 && actual === expectedVersion,
    expected_version: expectedVersion,
    actual_version: actual,
  }
}

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

export function providerUsageMatchesModel(rows: ProviderUsageRow[], model: string) {
  const separator = model.indexOf("/")
  if (separator <= 0 || separator === model.length - 1) {
    return { passed: false, provider_id: "", model_id: "" }
  }
  const providerID = model.slice(0, separator)
  const modelID = model.slice(separator + 1)
  return {
    passed: rows.every(
      (row) =>
        row.provider_id === providerID && row.model_id === modelID && row.purpose !== "provider-connectivity",
    ),
    provider_id: providerID,
    model_id: modelID,
  }
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
    "Mission is the real intake coordinator for this run. Delegate the complete business workflow to child Task work owned by the held Expert Squad; Mission must not execute benchmark operations itself.",
    "Every child Task request must retain the exact `This is an AutomationBench API-mode evaluation` statement and the complete SYSTEM/USER business-content block below.",
    "The SYSTEM/USER block is the sole semantic authority. Mission must assign every requested effect across the complete child-Task set. Within each child Task's assigned closure it may add ownership, lineage, dependencies, and evidence duties, but must not weaken, generalize, substitute, reinterpret, or omit an assigned operation, channel, target, value, format, or guard. The full block remains authority context and does not make one child duplicate effects explicitly assigned to a sibling Task.",
    "Every child Task Agent that performs benchmark work must load the project Skill named `automationbench-api` before acting and use only its project-local client for benchmark operations.",
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

const SEALED_SCORER_REPLAY_REQUIRED_CHECKS = [
  "partial_credit",
  "task_completed_correctly",
  "assertion_results",
  "end_state_sha256",
  "tool_attempts",
  "tool_succeeded",
  "tool_failed",
  "world_transition_chain",
] as const
const CURRENT_SCORER_REPLAY_REQUIRED_CHECKS = [
  ...SEALED_SCORER_REPLAY_REQUIRED_CHECKS,
  "scorer_world_stable",
] as const
const SCORER_REPLAY_COUNTERS = [
  "stateful_calls_verified_by_hash_chain",
  "replayed_non_stateful_calls",
  "skipped_non_stateful_calls",
] as const
const SCORER_REPLAY_TOP_LEVEL_FIELDS = new Set([
  "schema_version",
  "passed",
  "example_id",
  "checks",
  ...SCORER_REPLAY_COUNTERS,
])

function scorerReplayRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

export function auditScorerReplayEvidence(input: {
  sealed: unknown
  independent: unknown
  exampleID: unknown
}) {
  const sealed = scorerReplayRecord(input.sealed)
  const independent = scorerReplayRecord(input.independent)
  const sealedChecks = scorerReplayRecord(sealed?.checks)
  const independentChecks = scorerReplayRecord(independent?.checks)
  const violations: string[] = []
  if (!sealed) violations.push("sealed_replay_audit_shape")
  if (!independent) violations.push("independent_replay_audit_shape")
  if (sealed?.schema_version !== 1) violations.push("sealed_replay_schema_version")
  if (independent?.schema_version !== 1) violations.push("independent_replay_schema_version")
  if (sealed?.passed !== true) violations.push("sealed_replay_not_passed")
  if (independent?.passed !== true) violations.push("independent_replay_not_passed")
  if (sealed?.example_id !== input.exampleID) violations.push("sealed_replay_example_identity")
  if (independent?.example_id !== input.exampleID) violations.push("independent_replay_example_identity")
  if (!sealedChecks) violations.push("sealed_replay_checks_shape")
  if (!independentChecks) violations.push("independent_replay_checks_shape")
  for (const field of Object.keys(sealed ?? {})) {
    if (!SCORER_REPLAY_TOP_LEVEL_FIELDS.has(field)) violations.push(`sealed_replay_unknown_claim:${field}`)
  }
  for (const field of Object.keys(independent ?? {})) {
    if (!SCORER_REPLAY_TOP_LEVEL_FIELDS.has(field)) violations.push(`independent_replay_unknown_claim:${field}`)
  }
  for (const check of SEALED_SCORER_REPLAY_REQUIRED_CHECKS) {
    if (sealedChecks?.[check] !== true) violations.push(`sealed_replay_required_check:${check}`)
  }
  for (const check of CURRENT_SCORER_REPLAY_REQUIRED_CHECKS) {
    if (independentChecks?.[check] !== true) violations.push(`independent_replay_required_check:${check}`)
  }
  for (const [check, value] of Object.entries(independentChecks ?? {})) {
    if (value !== true) violations.push(`independent_replay_check_not_proven:${check}`)
  }
  for (const [check, value] of Object.entries(sealedChecks ?? {})) {
    if (value !== true || independentChecks?.[check] !== value) violations.push(`sealed_replay_check_mismatch:${check}`)
  }
  for (const field of SCORER_REPLAY_COUNTERS) {
    if (!Number.isSafeInteger(sealed?.[field]) || sealed?.[field] !== independent?.[field]) {
      violations.push(`scorer_replay_counter_mismatch:${field}`)
    }
  }
  for (const [field, value] of Object.entries(sealed ?? {})) {
    if (
      !SCORER_REPLAY_TOP_LEVEL_FIELDS.has(field) ||
      field === "checks" ||
      SCORER_REPLAY_COUNTERS.includes(field as (typeof SCORER_REPLAY_COUNTERS)[number])
    )
      continue
    if (JSON.stringify(value) !== JSON.stringify(independent?.[field])) {
      violations.push(`sealed_replay_claim_mismatch:${field}`)
    }
  }
  return { passed: violations.length === 0, violations }
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

export function auditMissionRunBinding(input: {
  resultProfile: string
  resultModel: string
  resultMissionID: unknown
  resultMissionSessionID: unknown
  resultTaskIDs: unknown
  wakeRequest: any
  wakeResponse: any
  missionSession: any
  missionRecord: any
  missionStatus: any
  projectGitInit: any
  taskBoards: Array<{ task_id: string; board: any }>
}) {
  const requestedSquads = Array.isArray(input.wakeRequest?.expertSquadIDs)
    ? [...input.wakeRequest.expertSquadIDs].sort()
    : []
  const heldSquads = Array.isArray(input.missionSession?.metadata?.mission?.visibleExpertSquadIDs)
    ? [...input.missionSession.metadata.mission.visibleExpertSquadIDs].sort()
    : []
  const resultTaskIDs = Array.isArray(input.resultTaskIDs) ? [...input.resultTaskIDs].map(String).sort() : []
  const recordTaskIDs = Array.isArray(input.missionRecord?.tasks)
    ? input.missionRecord.tasks.map((task: any) => String(task.id)).sort()
    : []
  const statusTaskIDs = Array.isArray(input.missionStatus?.tasks)
    ? input.missionStatus.tasks.map((task: any) => String(task.taskID)).sort()
    : []
  const boardTaskIDs = input.taskBoards.map((item) => String(item.task_id)).sort()
  const taskBindings = input.taskBoards.map((item) => ({
    task_id: item.task_id,
    source: item.board?.task?.source ?? null,
    bound_profile: item.board?.task?.packageRevisionBinding?.id ?? null,
    board_status: item.board?.task?.status ?? null,
    record_status:
      input.missionRecord?.tasks?.find((task: any) => String(task.id) === String(item.task_id))?.lifecycleStatus ?? null,
    status_status:
      input.missionStatus?.tasks?.find((task: any) => String(task.taskID) === String(item.task_id))?.lifecycleStatus ?? null,
  }))
  const exactTaskSet =
    JSON.stringify(resultTaskIDs) === JSON.stringify(recordTaskIDs) &&
    JSON.stringify(resultTaskIDs) === JSON.stringify(statusTaskIDs) &&
    JSON.stringify(resultTaskIDs) === JSON.stringify(boardTaskIDs)
  const exactSquad =
    JSON.stringify(requestedSquads) === JSON.stringify([input.resultProfile]) &&
    JSON.stringify(heldSquads) === JSON.stringify([input.resultProfile])
  return {
    passed:
      input.wakeRequest?.model === input.resultModel &&
      input.wakeRequest?.productPillar === "work" &&
      input.wakeResponse?.created === true &&
      input.wakeResponse?.productPillar === "work" &&
      input.projectGitInit?.created === true &&
      input.wakeResponse?.missionID === input.resultMissionID &&
      input.wakeResponse?.sessionID === input.resultMissionSessionID &&
      input.missionSession?.metadata?.mission?.id === input.resultMissionID &&
      input.missionSession?.kind === "mission" &&
      input.missionSession?.metadata?.mission?.productPillar === "work" &&
      input.missionRecord?.missionID === input.resultMissionID &&
      input.missionRecord?.sessionID === input.resultMissionSessionID &&
      input.missionStatus?.missionID === input.resultMissionID &&
      input.missionStatus?.sessionID === input.resultMissionSessionID &&
      exactSquad &&
      exactTaskSet &&
      taskBindings.every(
        (binding) =>
          binding.source === "mission" &&
          binding.bound_profile === input.resultProfile &&
          binding.board_status === binding.record_status &&
          binding.board_status === binding.status_status,
      ),
    requested_squads: requestedSquads,
    held_squads: heldSquads,
    task_ids: resultTaskIDs,
    task_bindings: taskBindings,
  }
}

function decodedJSON(value: unknown): any {
  if (typeof value !== "string") return value
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

export function canonicalTranscriptOrder(messages: TranscriptMessage[]): TranscriptMessage[] {
  return [...messages].sort((left, right) => {
    const leftTime = Number(left.info?.time?.created ?? 0)
    const rightTime = Number(right.info?.time?.created ?? 0)
    return leftTime - rightTime || String(left.info?.id ?? "").localeCompare(String(right.info?.id ?? ""))
  })
}

/** Rebuild Mission -> child Task -> Session lineage from the sealed relational snapshot. */
export function auditMissionEvidenceLineage(input: {
  snapshot: any
  missionID: string
  missionSessionID: string
  taskIDs: string[]
  missionTranscript: TranscriptMessage[]
  taskTranscripts: Array<{ task_id: string; transcript: TranscriptMessage[] }>
  flattenedTaskTranscript: TranscriptMessage[]
}) {
  const rows = input.snapshot?.rows ?? {}
  const missing = new Set(Array.isArray(input.snapshot?.missing_tables) ? input.snapshot.missing_tables : [])
  const sessions = Array.isArray(rows.session) ? rows.session : []
  const tasks = Array.isArray(rows.engine_task) ? rows.engine_task : []
  const messageRows = Array.isArray(rows.message) ? rows.message : []
  const transcriptSurfaceRows = Array.isArray(rows.benchmark_transcript_surface)
    ? rows.benchmark_transcript_surface
    : []
  const protocolInboxes = Array.isArray(rows.protocol_inbox) ? rows.protocol_inbox : []
  const protocolReceipts = Array.isArray(rows.protocol_delivery_receipt) ? rows.protocol_delivery_receipt : []
  const expectedTaskIDs = [...input.taskIDs].map(String).sort()
  const transcriptTaskIDs = input.taskTranscripts.map((item) => String(item.task_id)).sort()
  const exactTaskTranscriptSet =
    new Set(transcriptTaskIDs).size === transcriptTaskIDs.length &&
    JSON.stringify(expectedTaskIDs) === JSON.stringify(transcriptTaskIDs)
  const exactFlatten =
    JSON.stringify(canonicalTranscriptOrder(input.taskTranscripts.flatMap((item) => item.transcript))) ===
    JSON.stringify(canonicalTranscriptOrder(input.flattenedTaskTranscript))
  const missionSession = sessions.find((row: any) => String(row.id) === input.missionSessionID)
  const missionMetadata = decodedJSON(missionSession?.metadata)
  const missionSessionValid =
    missionSession?.kind === "mission" &&
    missionMetadata?.mission?.id === input.missionID &&
    missionMetadata?.mission?.productPillar === "work"
  const ownedTaskIDs = tasks
    .filter((row: any) => {
      const metadata = decodedJSON(row?.metadata)
      return (
        row?.source === "mission" &&
        metadata?.actor === "mission" &&
        metadata?.mission?.id === input.missionID &&
        metadata?.mission?.session_id === input.missionSessionID
      )
    })
    .map((row: any) => String(row.id))
    .sort()
  const exactOwnedTaskSet = JSON.stringify(ownedTaskIDs) === JSON.stringify(expectedTaskIDs)
  const taskRows = expectedTaskIDs.map((taskID) => tasks.find((row: any) => String(row.id) === taskID))
  const taskRowsValid = taskRows.every((row: any) => {
    const metadata = decodedJSON(row?.metadata)
    return (
      row?.source === "mission" &&
      row?.product_pillar === "work" &&
      metadata?.actor === "mission" &&
      metadata?.mission?.id === input.missionID &&
      metadata?.mission?.session_id === input.missionSessionID &&
      typeof row?.session_id === "string"
    )
  })
  const sessionTree = (rootID: string) => {
    const result = new Set([rootID])
    let changed = true
    while (changed) {
      changed = false
      for (const row of sessions) {
        if (result.has(String(row.parent_id)) && !result.has(String(row.id))) {
          result.add(String(row.id))
          changed = true
        }
      }
    }
    return result
  }
  const messageSessionByID = new Map(messageRows.map((row: any) => [String(row.id), String(row.session_id)]))
  const messagesMatchSnapshot = (
    transcript: TranscriptMessage[],
    allowed: Set<string>,
    surface: "mission" | "task",
    ownerID: string,
  ) => {
    const transcriptIDs = transcript.map((message) => String(message.info?.id ?? "")).sort()
    const snapshotIDs = transcriptSurfaceRows
      .filter((row: any) => row.surface === surface && String(row.owner_id) === ownerID)
      .map((row: any) => String(row.message_id))
      .sort()
    return (
      new Set(transcriptIDs).size === transcriptIDs.length &&
      JSON.stringify(transcriptIDs) === JSON.stringify(snapshotIDs) &&
      transcript.every((message) => {
      const id = String(message.info?.id ?? "")
      const sessionID = String(message.info?.sessionID ?? "")
      return id.length > 0 && allowed.has(sessionID) && messageSessionByID.get(id) === sessionID
      })
    )
  }
  const missionMessagesValid = messagesMatchSnapshot(
    input.missionTranscript,
    new Set([input.missionSessionID]),
    "mission",
    input.missionID,
  )
  const taskMessagesValid = input.taskTranscripts.every((item) => {
    const row = tasks.find((candidate: any) => String(candidate.id) === String(item.task_id))
    return (
      typeof row?.session_id === "string" &&
      messagesMatchSnapshot(item.transcript, sessionTree(row.session_id), "task", item.task_id)
    )
  })
  const missionInboxIDs = protocolInboxes
    .filter((row: any) => row.actor === "session" && String(row.actor_id) === input.missionSessionID)
    .map((row: any) => String(row.id))
    .sort()
  const terminalReceiptByInbox = new Map(
    protocolReceipts.flatMap((row: any) => {
      const receipt = decodedJSON(row.receipt)
      return receipt?.kind && receipt.kind !== "retry_wait" ? [[String(row.inbox_id), receipt] as const] : []
    }),
  )
  const pendingMissionInboxIDs = missionInboxIDs.filter((id) => !terminalReceiptByInbox.has(id))
  const deadLetterMissionInboxIDs = missionInboxIDs.filter(
    (id) => (terminalReceiptByInbox.get(id) as any)?.kind === "dead_letter",
  )
  const invalidTerminalMissionInboxIDs = missionInboxIDs.filter((id) => {
    const receipt = terminalReceiptByInbox.get(id) as any
    return receipt && receipt.kind !== "session_wake" && receipt.kind !== "dead_letter"
  })
  const unansweredMissionInboxIDs = missionInboxIDs.filter((id) => {
    const receipt = terminalReceiptByInbox.get(id) as any
    if (receipt?.kind !== "session_wake") return false
    const user = messageRows.find(
      (row: any) => String(row.id) === String(receipt.message_id) && String(row.session_id) === input.missionSessionID,
    )
    const assistant = messageRows.find(
      (row: any) =>
        row.role === "assistant" &&
        String(row.session_id) === input.missionSessionID &&
        String(row.parent_id) === String(receipt.message_id),
    )
    return !(
      user &&
      assistant &&
      typeof assistant.time_completed === "number" &&
      !assistant.error_name &&
      assistant.finish !== "error"
    )
  })
  const violations = [
    ...(["session", "engine_task", "message", "protocol_inbox", "protocol_delivery_receipt"].some(
      (table) => missing.has(table) || !Array.isArray(rows[table]),
    ) || !Array.isArray(rows.benchmark_transcript_surface)
      ? ["snapshot_relational_rows_missing"]
      : []),
    ...(input.snapshot?.mission_id === input.missionID &&
    input.snapshot?.mission_session_id === input.missionSessionID &&
    JSON.stringify([...(input.snapshot?.task_ids ?? [])].map(String).sort()) === JSON.stringify(expectedTaskIDs)
      ? []
      : ["snapshot_receipt_identity_mismatch"]),
    ...(missionSessionValid ? [] : ["mission_session_lineage_mismatch"]),
    ...(taskRowsValid && exactOwnedTaskSet ? [] : ["mission_task_creator_lineage_mismatch"]),
    ...(exactTaskTranscriptSet ? [] : ["task_transcript_set_mismatch"]),
    ...(exactFlatten ? [] : ["task_transcript_flatten_mismatch"]),
    ...(missionMessagesValid ? [] : ["mission_message_session_mismatch"]),
    ...(taskMessagesValid ? [] : ["task_message_session_mismatch"]),
    ...(pendingMissionInboxIDs.length === 0 ? [] : ["mission_scheduler_delivery_pending"]),
    ...(deadLetterMissionInboxIDs.length === 0 ? [] : ["mission_scheduler_delivery_dead_letter"]),
    ...(invalidTerminalMissionInboxIDs.length === 0 ? [] : ["mission_scheduler_delivery_invalid_terminal"]),
    ...(unansweredMissionInboxIDs.length === 0 ? [] : ["mission_scheduler_delivery_unanswered"]),
  ]
  return {
    passed: violations.length === 0,
    mission_session_valid: missionSessionValid,
    task_rows_valid: taskRowsValid,
    owned_task_ids: ownedTaskIDs,
    owned_task_set_matches: exactOwnedTaskSet,
    task_transcript_ids: transcriptTaskIDs,
    task_transcript_flatten_matches: exactFlatten,
    mission_messages_valid: missionMessagesValid,
    task_messages_valid: taskMessagesValid,
    mission_scheduler_inbox_ids: missionInboxIDs,
    pending_mission_scheduler_inbox_ids: pendingMissionInboxIDs,
    dead_letter_mission_scheduler_inbox_ids: deadLetterMissionInboxIDs,
    invalid_terminal_mission_scheduler_inbox_ids: invalidTerminalMissionInboxIDs,
    unanswered_mission_scheduler_inbox_ids: unansweredMissionInboxIDs,
    violations,
  }
}

export function auditMissionEvidenceCollections(input: {
  snapshot: any
  missionSessionID: string
  taskIDs: string[]
  taskBoards: Array<{ task_id: string; board: any }>
  taskInteractions: Array<{ task_id: string; interactions: Array<Record<string, any>> }>
  flattenedInteractions: Array<Record<string, any>>
  resultInteractions: Array<Record<string, any>>
  providerLedger: ProviderUsageRow[]
  taskTrace: Array<Record<string, any>>
}) {
  const canonicalInteractions = (items: Array<Record<string, any>>) =>
    [...items].sort(
      (left, right) =>
        String(left.task_id ?? "").localeCompare(String(right.task_id ?? "")) ||
        String(left.id ?? left.interactionID ?? "").localeCompare(String(right.id ?? right.interactionID ?? "")),
    )
  const taskIDs = [...input.taskIDs].map(String).sort()
  const interactionTaskIDs = input.taskInteractions.map((item) => String(item.task_id)).sort()
  const boardTaskIDs = input.taskBoards.map((item) => String(item.task_id)).sort()
  const fileFlattened = canonicalInteractions(
    input.taskInteractions.flatMap((item) =>
      item.interactions.map((interaction) => ({ ...interaction, task_id: item.task_id })),
    ),
  )
  const boardFlattened = canonicalInteractions(
    input.taskBoards.flatMap((item) =>
      (Array.isArray(item.board?.interactions) ? item.board.interactions : []).map((interaction: any) => ({
        ...interaction,
        task_id: item.task_id,
      })),
    ),
  )
  const interactionsMatch =
    JSON.stringify(taskIDs) === JSON.stringify(interactionTaskIDs) &&
    JSON.stringify(taskIDs) === JSON.stringify(boardTaskIDs) &&
    JSON.stringify(fileFlattened) === JSON.stringify(canonicalInteractions(input.flattenedInteractions)) &&
    JSON.stringify(fileFlattened) === JSON.stringify(canonicalInteractions(input.resultInteractions)) &&
    JSON.stringify(fileFlattened) === JSON.stringify(boardFlattened)
  const snapshotRows = input.snapshot?.rows ?? {}
  const snapshotLedgerPresent =
    Array.isArray(snapshotRows.provider_usage_event) &&
    !(Array.isArray(input.snapshot?.missing_tables) && input.snapshot.missing_tables.includes("provider_usage_event"))
  const snapshotLedger = (Array.isArray(snapshotRows.provider_usage_event)
    ? snapshotRows.provider_usage_event
    : [])
    .filter((row: any) => row.purpose !== "provider-connectivity")
    .sort((left: any, right: any) =>
      Number(left.occurred_at ?? 0) - Number(right.occurred_at ?? 0) || String(left.id).localeCompare(String(right.id)),
    )
  const ledgerMatches =
    snapshotLedgerPresent &&
    input.providerLedger.length > 0 &&
    JSON.stringify(snapshotLedger) === JSON.stringify(input.providerLedger)
  const sessions = Array.isArray(snapshotRows.session) ? snapshotRows.session : []
  const tasks = Array.isArray(snapshotRows.engine_task) ? snapshotRows.engine_task : []
  const allowedSessions = new Set<string>([input.missionSessionID])
  for (const taskID of taskIDs) {
    const root = tasks.find((row: any) => String(row.id) === taskID)?.session_id
    if (typeof root !== "string") continue
    allowedSessions.add(root)
    let changed = true
    while (changed) {
      changed = false
      for (const session of sessions) {
        if (allowedSessions.has(String(session.parent_id)) && !allowedSessions.has(String(session.id))) {
          allowedSessions.add(String(session.id))
          changed = true
        }
      }
    }
  }
  const knownPurposes = new Set([
    "session",
    "vcs-commit-message",
    "metric-judge",
    "acceptance-translation",
    "other",
  ])
  const ledgerSessionsMatch = input.providerLedger.every((row) =>
    row.purpose === "session"
      ? typeof row.session_id === "string" && allowedSessions.has(row.session_id)
      : knownPurposes.has(row.purpose) && row.session_id === null && row.agent_id === null,
  )
  const traceSessionIDs = new Set(
    input.taskTrace.map((event) => event.sessionID).filter((value): value is string => typeof value === "string"),
  )
  const taskUsageTraceMatches = input.providerLedger.every(
    (row) =>
      row.purpose !== "session" ||
      row.session_id === input.missionSessionID ||
      (typeof row.session_id === "string" && traceSessionIDs.has(row.session_id)),
  )
  const violations = [
    ...(interactionsMatch ? [] : ["mission_task_interactions_mismatch"]),
    ...(ledgerMatches ? [] : ["provider_ledger_snapshot_mismatch"]),
    ...(ledgerSessionsMatch ? [] : ["provider_ledger_session_lineage_mismatch"]),
    ...(taskUsageTraceMatches ? [] : ["task_provider_usage_trace_coverage_mismatch"]),
  ]
  return {
    passed: violations.length === 0,
    interactions_match: interactionsMatch,
    provider_ledger_snapshot_matches: ledgerMatches,
    provider_ledger_session_lineage_matches: ledgerSessionsMatch,
    task_provider_usage_trace_coverage_matches: taskUsageTraceMatches,
    traced_task_session_ids: [...traceSessionIDs].sort(),
    allowed_session_ids: [...allowedSessions].sort(),
    violations,
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
  const direct = (board as { processIncidents?: unknown } | undefined)?.processIncidents
  const missionTasks = (board as { launch_mode?: unknown; tasks?: unknown } | undefined)?.tasks
  const rows = Array.isArray(direct)
    ? direct
    : (board as any)?.launch_mode === "mission" && Array.isArray(missionTasks)
      ? missionTasks.flatMap((item: any) =>
          Array.isArray(item?.board?.processIncidents) ? item.board.processIncidents : [],
        )
      : undefined
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

export function auditMissionOutcome(input: {
  missionRecord: any
  missionStatus: any
  missionTranscript: TranscriptMessage[]
  taskTranscripts: Array<{ task_id: string; lifecycle_status: unknown; transcript: TranscriptMessage[] }>
}) {
  const statusTasks = Array.isArray(input.missionStatus?.tasks) ? input.missionStatus.tasks : []
  const recordTasks = Array.isArray(input.missionRecord?.tasks) ? input.missionRecord.tasks : []
  const statusByID = new Map(statusTasks.map((task: any) => [String(task.taskID), task]))
  const recordIDs = recordTasks.map((task: any) => String(task.id)).sort()
  const statusIDs = statusTasks.map((task: any) => String(task.taskID)).sort()
  const transcriptIDs = input.taskTranscripts.map((task) => task.task_id).sort()
  const childTasks = input.taskTranscripts.map((task) => ({
    task_id: task.task_id,
    ...auditTaskOutcome(task.lifecycle_status, task.transcript),
  }))
  const missionInactive =
    input.missionStatus?.status === "inactive" && input.missionRecord?.interruptible === false
  const exactTaskSet =
    JSON.stringify(recordIDs) === JSON.stringify(statusIDs) &&
    JSON.stringify(recordIDs) === JSON.stringify(transcriptIDs)
  const taskStatusesTerminal = statusTasks.every((task: any) =>
    ["completed", "failed", "cancelled"].includes(String(task.lifecycleStatus)),
  )
  const childrenScorable = childTasks.every((task) => task.scored_terminal)
  const transcriptSessionIDs = [
    ...new Set(input.missionTranscript.map((message) => String(message.info?.sessionID ?? ""))),
  ].sort()
  const missionSessionID = String(input.missionRecord?.sessionID ?? "")
  const transcriptSessionMatches =
    missionSessionID.length > 0 &&
    transcriptSessionIDs.length === 1 &&
    transcriptSessionIDs[0] === missionSessionID
  const assistants = input.missionTranscript.filter((message) => message.info?.role === "assistant")
  const users = input.missionTranscript.filter((message) => message.info?.role === "user")
  const latestAssistant = assistants.at(-1)
  const latestUser = users.at(-1)
  const assistantSettled = typeof latestAssistant?.info?.time?.completed === "number"
  const assistantRepliesToLatestUser =
    typeof latestUser?.info?.id === "string" &&
    latestAssistant?.info?.parentID === latestUser.info.id &&
    input.missionTranscript.at(-1)?.info?.id === latestAssistant?.info?.id
  const assistantHealthy =
    assistantSettled &&
    assistantRepliesToLatestUser &&
    latestAssistant?.info?.error === undefined &&
    latestAssistant?.info?.finish !== "error"
  const completionCalls = input.missionTranscript.flatMap((message) =>
    (message.parts ?? []).flatMap((part) => {
      if (part.type !== "tool" || part.tool !== "panel" || part.state?.status !== "completed") return []
      const raw = part.state.input
      const operation = raw && typeof raw === "object" && "operation" in raw ? raw.operation : raw
      if (operation?.action !== "complete_mission") return []
      let output: any
      try {
        output = typeof part.state.output === "string" ? JSON.parse(part.state.output) : part.state.output
      } catch {
        output = undefined
      }
      return [{ message, part, operation, output }]
    }),
  )
  const completion = completionCalls.length === 1 ? completionCalls[0] : undefined
  const acceptedTaskIDs = Array.isArray(completion?.output?.task_acceptances)
    ? completion.output.task_acceptances.map((item: any) => String(item.task_id)).sort()
    : []
  const acceptedTaskEvidenceValid = Array.isArray(completion?.output?.task_acceptances)
    ? completion.output.task_acceptances.every(
        (item: any) =>
          typeof item?.terminal_lifecycle_reference?.terminalEventID === "string" &&
          Array.isArray(item?.evidence_locators) &&
          item.evidence_locators.length > 0,
      )
    : false
  const completionReceiptMatches = input.missionRecord?.completion
    ? completionCalls.length === 1 &&
      completion?.output?.kind === "mission_completed" &&
      completion.output.mission_id === input.missionRecord?.missionID &&
      completion.output.mission_session_id === missionSessionID &&
      completion.output.assistant_message_id === completion.message.info?.id &&
      completion.output.tool_call_id === completion.part.callID &&
      completion.output.tool_part_id === completion.part.id &&
      completion.output.summary === input.missionRecord.completion.summary &&
      completion.output.assistant_message_id === input.missionRecord.completion.messageID &&
      completion.output.tool_call_id === input.missionRecord.completion.toolCallID &&
      completion.output.tool_part_id === input.missionRecord.completion.toolPartID &&
      completion.output.time_recorded === input.missionRecord.completion.timeRecorded &&
      acceptedTaskEvidenceValid &&
      JSON.stringify(acceptedTaskIDs) === JSON.stringify(recordIDs)
    : completionCalls.length === 0
  const scoredTerminal =
    missionInactive &&
    exactTaskSet &&
    taskStatusesTerminal &&
    childrenScorable &&
    transcriptSessionMatches &&
    assistantHealthy &&
    completionReceiptMatches
  return {
    passed: scoredTerminal,
    scored_terminal: scoredTerminal,
    mission_completed: input.missionRecord?.completion !== undefined,
    explicit_complete_mission: completionCalls.length === 1,
    completion_receipt_matches: completionReceiptMatches,
    mission_transcript_session_ids: transcriptSessionIDs,
    mission_assistant_settled: assistantSettled,
    mission_assistant_replies_to_latest_user: assistantRepliesToLatestUser,
    mission_assistant_healthy: assistantHealthy,
    mission_status: input.missionStatus?.status ?? null,
    child_task_count: childTasks.length,
    child_tasks: childTasks,
    status_task_ids: [...statusByID.keys()].sort(),
  }
}

export function auditMissionQuiescence(input: {
  missionRecord: any
  missionStatus: any
  taskBoards: Array<{ task_id: string; board: any }>
}) {
  const recordIDs = Array.isArray(input.missionRecord?.tasks)
    ? input.missionRecord.tasks.map((task: any) => String(task.id)).sort()
    : []
  const statusTasks = Array.isArray(input.missionStatus?.tasks) ? input.missionStatus.tasks : []
  const statusIDs = statusTasks.map((task: any) => String(task.taskID)).sort()
  const boardIDs = input.taskBoards.map((task) => task.task_id).sort()
  const taskAudits = input.taskBoards.map((task) => ({
    task_id: task.task_id,
    ...auditTerminalQuiescence(task.board),
  }))
  const exactTaskSet =
    JSON.stringify(recordIDs) === JSON.stringify(statusIDs) &&
    JSON.stringify(recordIDs) === JSON.stringify(boardIDs)
  const missionInactive =
    input.missionStatus?.status === "inactive" &&
    input.missionRecord?.interruptible === false &&
    Number(input.missionRecord?.pendingInteractions ?? 0) === 0
  const taskStatusesTerminal = statusTasks.every((task: any) =>
    ["completed", "failed", "cancelled"].includes(String(task.lifecycleStatus)),
  )
  return {
    passed: missionInactive && exactTaskSet && taskStatusesTerminal && taskAudits.every((task) => task.passed),
    mission_status: input.missionStatus?.status ?? null,
    mission_completed: input.missionRecord?.completion !== undefined,
    task_count: taskAudits.length,
    task_audits: taskAudits,
  }
}

export type BatchProfileSlot = {
  case_index: number
  profile: "base" | "advanced"
}

export type AutomationBenchTrialLease = {
  run_id: string
  pid: number
  case_id: string
  profile: "base" | "advanced"
  started_at: number
  batch_run_id: string
  batch_index: number
  batch_plan_sha256: string
}

export function acquireAutomationBenchTrialLease(input: {
  active: AutomationBenchTrialLease[]
  candidate: AutomationBenchTrialLease
  maxConcurrent: number
  maxPerBatch: number
}) {
  const sameBatch = input.active.filter(
    (item) =>
      item.batch_run_id === input.candidate.batch_run_id &&
      item.batch_index === input.candidate.batch_index &&
      item.batch_plan_sha256 === input.candidate.batch_plan_sha256,
  )
  const conflictingBatchIdentity = input.active.some(
    (item) =>
      item.batch_run_id === input.candidate.batch_run_id &&
      (item.batch_index !== input.candidate.batch_index ||
        item.batch_plan_sha256 !== input.candidate.batch_plan_sha256),
  )
  const reason = input.active.some((item) => item.case_id === input.candidate.case_id)
    ? "case_already_active"
    : conflictingBatchIdentity
      ? "batch_identity_conflict"
      : sameBatch.length >= input.maxPerBatch
        ? "batch_concurrency_exhausted"
        : input.active.length >= input.maxConcurrent
          ? "global_concurrency_exhausted"
          : null
  return reason
    ? { acquired: false as const, reason, active: input.active }
    : { acquired: true as const, reason: null, active: [...input.active, input.candidate] }
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

export function automationBenchCoordinatorBatchIndexes(value: string) {
  const batchIndexes = value.split(",").map((item) => Number(item))
  if (
    batchIndexes.length < 1 ||
    batchIndexes.length > 120 ||
    batchIndexes.some((batchIndex) => !Number.isInteger(batchIndex) || batchIndex < 1) ||
    new Set(batchIndexes).size !== batchIndexes.length ||
    batchIndexes.some((batchIndex, index) => index > 0 && batchIndex <= batchIndexes[index - 1]!)
  ) {
    throw new Error("Batch coordinator requires one to 120 ascending distinct positive batches")
  }
  return batchIndexes
}

export function activeAutomationBenchBatchRunIDs(
  active: Array<{ batch_run_id?: string }>,
  anchoredPlans: Array<{ batch_run_id?: string } | undefined>,
) {
  return new Set(
    [...active.map((item) => item.batch_run_id), ...anchoredPlans.map((item) => item?.batch_run_id)].filter(
      (batchRunID): batchRunID is string => typeof batchRunID === "string" && batchRunID.length > 0,
    ),
  )
}

export function rollingDashboardPlanPaths(
  contexts: Array<{
    planPath: string
    authorizationStarted: boolean
    receiptWritten: boolean
    receiptPublished: boolean
  }>,
) {
  return contexts
    .filter((context) => (context.authorizationStarted || context.receiptWritten) && !context.receiptPublished)
    .map((context) => context.planPath)
}

export function reconcileAutomationBenchBatchCandidates(input: {
  profile: "base" | "advanced"
  preexisting: Array<Record<string, any>>
  current: Array<Record<string, any>>
}) {
  const candidates = new Map<number, Record<string, any>>()
  for (const record of input.preexisting) {
    const caseIndex = Number(record.benchmark?.case_index)
    const existing = candidates.get(caseIndex)
    if (!Number.isInteger(caseIndex) || !record.run_id || (existing && existing.run_id !== record.run_id)) {
      throw new Error(`Invalid selected preexisting candidate for ${input.profile} case ${caseIndex}`)
    }
    candidates.set(caseIndex, record)
  }
  for (const record of input.current) {
    const caseIndex = Number(record.benchmark?.case_index)
    if (!Number.isInteger(caseIndex) || !record.run_id) continue
    const existing = candidates.get(caseIndex)
    if (existing && input.preexisting.some((candidate) => candidate.run_id === existing.run_id)) continue
    if (existing && existing.run_id !== record.run_id) {
      throw new Error(`Multiple eligible candidates exist for ${input.profile} case ${caseIndex}`)
    }
    candidates.set(caseIndex, record)
  }
  return candidates
}

export function reusableProfileRuns(
  catalog: { leaderboard: Array<Record<string, any>>; candidates: Array<Record<string, any>> },
  profile: "base" | "advanced",
  model: string,
  launchMode: string,
): Map<number, Record<string, any>> {
  const verified = new Map(
    catalog.leaderboard
      .filter(
        (record) =>
          record.opencorvus?.profile === profile &&
          record.opencorvus?.model === model &&
          record.opencorvus?.launch_mode === launchMode &&
          record.benchmark?.repetition === 1,
      )
      .map((record) => [Number(record.benchmark.case_index), record]),
  )
  const reusable = new Map<number, Record<string, any>>()
  for (const record of catalog.candidates.filter(
    (item) =>
      item.opencorvus?.profile === profile &&
      item.opencorvus?.model === model &&
      item.opencorvus?.launch_mode === launchMode &&
      item.benchmark?.repetition === 1,
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

export type AutomationBenchBatchPlanIdentity = {
  schema_version: number
  batch_index: number
  model: string
  launch_mode: string
  repetition: number
  trial_concurrency: number
  schedule_mode: string
  profiles: string[]
  case_count: number
}

function strictInteger(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) ? value : Number.NaN
}

export function automationBenchBatchPlanIdentity(plan: any): AutomationBenchBatchPlanIdentity {
  return {
    schema_version: strictInteger(plan?.schema_version),
    batch_index: strictInteger(plan?.batch_index),
    model: typeof plan?.model === "string" ? plan.model : "",
    launch_mode: typeof plan?.launch_mode === "string" ? plan.launch_mode : "",
    repetition: strictInteger(plan?.repetition),
    trial_concurrency: strictInteger(plan?.trial_concurrency),
    schedule_mode: typeof plan?.schedule_mode === "string" ? plan.schedule_mode : "",
    profiles:
      Array.isArray(plan?.profiles) && plan.profiles.every((profile: unknown) => typeof profile === "string")
        ? [...plan.profiles]
        : [],
    case_count: Array.isArray(plan?.cases) ? plan.cases.length : 0,
  }
}

export function automationBenchBatchPlanMatches(
  plan: any,
  expected: AutomationBenchBatchPlanIdentity,
) {
  return JSON.stringify(automationBenchBatchPlanIdentity(plan)) === JSON.stringify(expected)
}

export function auditAutomationBenchBatchPlanSchema(plan: any) {
  const schemaVersion = strictInteger(plan?.schema_version)
  const repetition = plan?.repetition === undefined ? null : strictInteger(plan.repetition)
  if (schemaVersion === 1 && repetition === null) {
    return { passed: true, schema_version: 1, repetition: null, legacy: true, reason: null }
  }
  if (schemaVersion === 2 && repetition === 1) {
    return { passed: true, schema_version: 2, repetition: 1, legacy: false, reason: null }
  }
  return {
    passed: false,
    schema_version: Number.isFinite(schemaVersion) ? schemaVersion : null,
    repetition: repetition !== null && Number.isFinite(repetition) ? repetition : null,
    legacy: false,
    reason: "batch_plan_schema",
  }
}

export function auditExcludedWrongExperimentBatch(input: {
  plan: any
  receipt?: any
  attempts: Array<Record<string, any>>
  dispositions: Record<string, { status: string; reason: string }>
  model: string
  planSHA256: string
}) {
  const violations: string[] = []
  const cases = Array.isArray(input.plan?.cases) ? input.plan.cases : []
  const expectedSlots = cases.map((item: any) => `${item.case_index}:base`).sort()
  const wave = Array.isArray(input.plan?.waves?.[0]) ? input.plan.waves[0] : []
  const plannedSlots = wave.map((item: any) => `${item.case_index}:${item.profile}`).sort()
  const launched = Array.isArray(input.receipt?.wave_1?.launched) ? input.receipt.wave_1.launched : []
  const launchedSlots = launched.map((item: any) => `${item.case_index}:${item.profile}`).sort()
  const eligible = Array.isArray(input.receipt?.wave_1?.eligible) ? input.receipt.wave_1.eligible : []
  const runIDs = launched.map((item: any) => String(item.run_id ?? "")).filter(Boolean)
  if (
    input.plan?.schema_version !== 2 ||
    !Number.isInteger(input.plan?.repetition) ||
    input.plan.repetition === 1 ||
    input.plan?.model !== input.model ||
    input.plan?.launch_mode !== "mission" ||
    JSON.stringify(input.plan?.profiles) !== JSON.stringify(["base"]) ||
    input.plan?.trial_concurrency !== 5 ||
    input.plan?.schedule_mode !== "rolling_case_slots_v1" ||
    !Number.isInteger(input.plan?.batch_index) ||
    cases.length !== 5 ||
    new Set(cases.map((item: any) => item.case_index)).size !== 5 ||
    input.plan?.waves?.length !== 1 ||
    JSON.stringify(plannedSlots) !== JSON.stringify(expectedSlots)
  ) {
    violations.push("wrong_experiment_plan_shape")
  }
  if (
    input.receipt?.status !== "failed" ||
    input.receipt?.batch_run_id !== input.plan?.batch_run_id ||
    input.receipt?.batch_index !== input.plan?.batch_index ||
    input.receipt?.repetition !== input.plan?.repetition ||
    launched.length !== 5 ||
    runIDs.length !== 5 ||
    new Set(runIDs).size !== 5 ||
    eligible.length !== 0 ||
    JSON.stringify(launchedSlots) !== JSON.stringify(expectedSlots)
  ) {
    violations.push("wrong_experiment_receipt_shape")
  }
  for (const item of launched) {
    const runID = String(item.run_id ?? "")
    const attempt = input.attempts.find((candidate) => candidate.run_id === runID)
    const disposition = input.dispositions[runID]
    if (
      !attempt ||
      attempt.benchmark?.batch_run_id !== input.plan?.batch_run_id ||
      attempt.benchmark?.batch_plan_sha256 !== input.planSHA256 ||
      attempt.benchmark?.batch_index !== input.plan?.batch_index ||
      attempt.benchmark?.wave_index !== 1 ||
      attempt.benchmark?.case_index !== item.case_index ||
      attempt.benchmark?.repetition !== input.plan?.repetition ||
      attempt.opencorvus?.profile !== "base" ||
      attempt.opencorvus?.model !== input.model ||
      attempt.opencorvus?.launch_mode !== "mission" ||
      disposition?.status !== "invalid_bug" ||
      disposition.reason !== "wrong_test_set_repetition"
    ) {
      violations.push(`wrong_experiment_run:${runID || "missing"}`)
    }
  }
  return { passed: violations.length === 0, run_ids: [...runIDs].sort(), violations }
}

export function automationBenchCaseSetAuthority(input: {
  caseIndex: unknown
  baseCount: number
  extendedCount: number
  sealedSHA256: unknown
  sealedCanonicalSHA256: unknown
  base: { sha256: string; canonical_sha256: string }
  extended: { sha256: string; canonical_sha256: string }
}) {
  const caseIndex = strictInteger(input.caseIndex)
  const authority = caseIndex >= 1 && caseIndex <= input.baseCount
    ? "base"
    : caseIndex > input.baseCount && caseIndex <= input.extendedCount
      ? "extended"
      : null
  const expected = authority === "base" ? input.base : authority === "extended" ? input.extended : undefined
  const violations = [
    ...(authority ? [] : ["case_index_out_of_manifest"]),
    ...(expected && input.sealedSHA256 === expected.sha256 && input.sealedCanonicalSHA256 === expected.canonical_sha256
      ? []
      : ["case_set_authority_mismatch"]),
  ]
  return { passed: violations.length === 0, authority, violations }
}

export const AUTOMATIONBENCH_BASE_RESTRICTED_SHELL_SHA256 =
  "32ed4bd67d0c51d4acc8f86c7fbc1c47b7fc68aa75d5bc0d69728f658e3893b0"

export function automationBenchRestrictedShellSourceFile(input: {
  caseIndex: unknown
  baseCount: number
  extendedCount: number
}) {
  const caseIndex = strictInteger(input.caseIndex)
  if (caseIndex < 1 || caseIndex > input.extendedCount) return null
  return caseIndex <= input.baseCount ? "restricted-agent-shell-base.sh" : "restricted-agent-shell.sh"
}

export function automationBenchRestrictedShellAuthority(input: {
  caseIndex: unknown
  baseCount: number
  extendedCount: number
  sealedSHA256: unknown
  extendedSHA256: string
}) {
  const sourceFile = automationBenchRestrictedShellSourceFile(input)
  const authority = sourceFile === "restricted-agent-shell-base.sh" ? "base" : sourceFile ? "extended" : null
  const expectedSHA256 = authority === "base"
    ? AUTOMATIONBENCH_BASE_RESTRICTED_SHELL_SHA256
    : authority === "extended"
      ? input.extendedSHA256
      : undefined
  const violations = [
    ...(authority ? [] : ["case_index_out_of_manifest"]),
    ...(expectedSHA256 && input.sealedSHA256 === expectedSHA256 ? [] : ["restricted_shell_authority_mismatch"]),
  ]
  return { passed: violations.length === 0, authority, expected_sha256: expectedSHA256 ?? null, violations }
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
  const planSchemaAudit = auditAutomationBenchBatchPlanSchema(input.plan)
  if (!planSchemaAudit.passed) reasons.push(planSchemaAudit.reason!)
  if (
    !["completed", "failed"].includes(input.receipt.status) ||
    input.receipt.batch_run_id !== input.plan.batch_run_id
  ) {
    reasons.push("batch_receipt_identity")
  }
  const expectedCases = (input.plan.cases ?? [])
    .map((item: any) => Number(item.case_index))
    .sort((a: number, b: number) => a - b)
  if (
    input.plan.trial_concurrency !== 5 ||
    typeof input.plan.model !== "string" ||
    input.plan.model.length === 0 ||
    input.plan.launch_mode !== "mission" ||
    expectedCases.length !== 5 ||
    new Set(expectedCases).size !== 5
  ) {
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
    if (!item.run_id && item.run_status === "coordinator_failed" && item.exit_code === -1 && expectedSlot) {
      reasons.push(`launched_trial_unstarted:${item.profile}:${item.case_index}`)
      continue
    }
    if (
      !attempt ||
      attempt.benchmark?.batch_run_id !== input.plan.batch_run_id ||
      attempt.benchmark?.batch_plan_sha256 !== input.planSHA256 ||
      attempt.benchmark?.wave_index !== item.waveIndex ||
      attempt.benchmark?.case_index !== item.case_index ||
      attempt.opencorvus?.profile !== item.profile ||
      attempt.opencorvus?.model !== input.plan.model ||
      attempt.opencorvus?.launch_mode !== input.plan.launch_mode ||
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
      attempt.opencorvus?.model !== input.plan.model ||
      attempt.opencorvus?.launch_mode !== input.plan.launch_mode ||
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
 * receipt has no structural, identity, coverage, or concurrency violation. The
 * only permitted audit reasons are post-hoc invalid eligible claims or a typed
 * unstarted slot that the audit derived from an expected receipt row with no
 * run id, `coordinator_failed`, and exit code -1. A run enters this list only
 * if the audit already retained it in `sealing_run_ids`.
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
  if (
    reasons.length === 0 ||
    !reasons.every(
      (reason) =>
        reason.startsWith("eligible_trial_raw_invalid:") || reason.startsWith("launched_trial_unstarted:"),
    )
  ) {
    return []
  }
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

export type BenchmarkScheduledWake = {
  id: string
  target: { scope: "session"; sessionID: string } | { scope: "task"; taskID: string }
  nextRun: number
  leaseUntil: number
  state: "scheduled" | "leased"
  claim: {
    leaseID: string
    ownerOccurrenceID: string
    activatedAt: number
  } | null
}

export function benchmarkInactivityDeadline(input: {
  now: number
  currentDeadline: number
  inactivityMs: number
  scheduledWakes: BenchmarkScheduledWake[]
}): number {
  if (
    input.scheduledWakes.some(
      (wake) => wake.state === "leased" || !Number.isFinite(wake.nextRun) || wake.nextRun <= input.now,
    )
  ) {
    return input.currentDeadline
  }
  const earliestFutureWake = input.scheduledWakes
    .filter(
      (wake) => wake.state === "scheduled" && Number.isFinite(wake.nextRun) && wake.nextRun > input.now,
    )
    .sort((left, right) => left.nextRun - right.nextRun || left.id.localeCompare(right.id))[0]
  return earliestFutureWake
    ? Math.max(input.currentDeadline, earliestFutureWake.nextRun + input.inactivityMs)
    : input.currentDeadline
}

export function advanceBenchmarkActivityWindow(input: {
  now: number
  currentDeadline: number
  inactivityMs: number
  previousSignature: string
  observedSignature: string
}) {
  const changed = input.observedSignature !== input.previousSignature
  return {
    changed,
    signature: changed ? input.observedSignature : input.previousSignature,
    deadline: changed ? input.now + input.inactivityMs : input.currentDeadline,
  }
}

export function benchmarkActivitySignature(input: {
  board: Record<string, any>
  transcript: TranscriptMessage[]
  trace: Array<Record<string, any>>
  benchmarkEventCount: number
  scheduledWakes?: BenchmarkScheduledWake[]
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
        scheduledWakes: (input.scheduledWakes ?? [])
          .map((wake) => [wake.id, wake.target, wake.nextRun, wake.state, wake.claim])
          .sort((left, right) => String(left[0]).localeCompare(String(right[0]))),
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
  const requiredAgentIDs = automationBenchSkillAgentIDs(input.profile)
  const requiredAgents = new Set(requiredAgentIDs)
  const observedAgents = new Set((input.matrix.agents ?? []).map((agent) => String(agent.agent_id ?? "")))
  const mounted: string[] = []
  const unmountable: Array<{ agent_id: string; base_role: string; reason: string }> = []
  const violations: string[] = []
  for (const agent of input.matrix.agents ?? []) {
    const agentID = String(agent.agent_id ?? "")
    const baseRole = String(agent.base_role ?? "")
    const grant = grantsByAgent.get(agentID)
    if (!requiredAgents.has(agentID)) {
      if (grant?.effective === true) violations.push(`unexpected_effective:${agentID}`)
      unmountable.push({
        agent_id: agentID,
        base_role: baseRole,
        reason: "profile_role_not_skill_owner",
      })
      continue
    }
    if (agent.skill_mountable !== true || agent.skill_tool_available !== true) {
      violations.push(
        agent.skill_mountable !== true
          ? `required_agent_not_mountable:${agentID}`
          : `required_agent_skill_tool_unavailable:${agentID}`,
      )
      unmountable.push({
        agent_id: agentID,
        base_role: baseRole,
        reason: agent.skill_mountable !== true ? "base_role_not_skill_mountable" : "skill_tool_not_projected",
      })
      continue
    }
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
  for (const agentID of requiredAgentIDs) {
    if (!observedAgents.has(agentID)) violations.push(`required_agent_missing:${agentID}`)
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
    required_agents: requiredAgentIDs,
    projection_hash: typeof input.matrix.projection_hash === "string" ? input.matrix.projection_hash : null,
    mounted_agents: mounted.sort(),
    unmountable_agents: unmountable.sort((left, right) => left.agent_id.localeCompare(right.agent_id)),
    violations,
  }
}

export function automationBenchSkillAgentIDs(profile: string): string[] {
  if (profile === "base") return [SCHEDULER_AGENT_ID, "base-developer", "base-planner", "base-tester"]
  if (profile === "advanced") {
    return [
      SCHEDULER_AGENT_ID,
      "requirement-engineer",
      "solution-architect",
      "source-investigator",
      "implementation-engineer",
      "test-engineer",
    ]
  }
  return []
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
 * projection audit, either as mounted or as explicitly unmountable. Every mounted Agent Session
 * that actually produces an assistant Message also gets an explicit runtime-adherence outcome for
 * the exact Skill load, and every real benchmark-client Bash invocation gets an ordering outcome
 * in the same Session. Projection, runtime load, and operational ordering remain three independently
 * measured facts; natural model non-adherence is reported without discarding its official score.
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
  if (!coverage.passed) violations.push(...coverage.violations.map((violation) => `coverage:${violation}`))
  if (input.projectionFile?.profile !== input.profile) violations.push("receipt_profile_mismatch")
  if (input.projectionFile?.skill?.name !== input.resultSkill?.name) violations.push("skill_name_mismatch")
  if (!same(projection, input.projectionFile?.skill?.projection)) violations.push("receipt_projection_mismatch")
  if (!same(projection, input.resultSkill?.projection)) violations.push("result_projection_mismatch")
  if (!same(coverage, input.projectionFile?.skill?.dispatched_coverage)) violations.push("receipt_coverage_mismatch")
  if (!same(coverage, input.resultSkill?.dispatched_coverage)) violations.push("result_coverage_mismatch")
  return { passed: violations.length === 0, projection, coverage, violations }
}

export function auditDispatchedSkillCoverage(input: {
  projection: {
    skill_name?: string
    mounted_agents: string[]
    unmountable_agents: Array<{ agent_id: string }>
  }
  transcript: TranscriptMessage[]
}) {
  const skillName = input.projection.skill_name ?? AUTOMATIONBENCH_SKILL_NAME
  const mounted = new Set(input.projection.mounted_agents)
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
  const ownerSessions = new Map<string, { agent_id: string; session_id: string }>()
  const successfulLoads: Array<{
    agent_id: string
    session_id: string
    message_index: number
    part_index: number
  }> = []
  const clientAttempts: Array<{
    agent_id: string
    session_id: string | null
    message_index: number
    part_index: number
    status: string | null
  }> = []
  const missingSessionIDs: Array<{ agent_id: string; message_index: number }> = []

  const sessionID = (message: TranscriptMessage) => {
    const value = message.info?.sessionID ?? message.info?.session_id
    return typeof value === "string" && value.length > 0 ? value : null
  }
  const invokesBenchmarkClient = (toolInput: Record<string, any>) => {
    const command = toolInput.command
    if (typeof command !== "string") return false
    return /(?:^|[\n;&|()])\s*(?:python3|python)\s+(?:\.\/)?automationbench_tool\.py(?:\s|$)/.test(command)
  }

  for (const [messageIndex, message] of input.transcript.entries()) {
    const agentID = message.info?.agent
    if (typeof agentID !== "string" || agentID.length === 0) continue
    const currentSessionID = sessionID(message)
    if (message.info?.role === "assistant" && mounted.has(agentID)) {
      if (currentSessionID) {
        ownerSessions.set(`${agentID}\u0000${currentSessionID}`, {
          agent_id: agentID,
          session_id: currentSessionID,
        })
      } else {
        missingSessionIDs.push({ agent_id: agentID, message_index: messageIndex })
      }
    }
    for (const [partIndex, part] of (message.parts ?? []).entries()) {
      if (part.type !== "tool") continue
      const state = part.state && typeof part.state === "object" ? part.state : {}
      const toolInput = state.input && typeof state.input === "object" ? state.input : {}
      if (
        part.tool === "skill" &&
        toolInput.name === skillName &&
        state.status === "completed" &&
        currentSessionID
      ) {
        successfulLoads.push({
          agent_id: agentID,
          session_id: currentSessionID,
          message_index: messageIndex,
          part_index: partIndex,
        })
      }
      if (part.tool === "bash" && invokesBenchmarkClient(toolInput)) {
        clientAttempts.push({
          agent_id: agentID,
          session_id: currentSessionID,
          message_index: messageIndex,
          part_index: partIndex,
          status: typeof state.status === "string" ? state.status : null,
        })
      }
    }
  }

  const loadBefore = (attempt: (typeof clientAttempts)[number]) =>
    successfulLoads.some(
      (load) =>
        load.agent_id === attempt.agent_id &&
        load.session_id === attempt.session_id &&
        (load.message_index < attempt.message_index ||
          (load.message_index === attempt.message_index && load.part_index < attempt.part_index)),
    )
  const missingLoads = [...ownerSessions.values()]
    .filter(
      (owner) =>
        !successfulLoads.some(
          (load) => load.agent_id === owner.agent_id && load.session_id === owner.session_id,
        ),
    )
    .sort(
      (left, right) =>
        left.agent_id.localeCompare(right.agent_id) || left.session_id.localeCompare(right.session_id),
    )
  const clientBeforeLoad = clientAttempts.filter((attempt) => mounted.has(attempt.agent_id) && !loadBefore(attempt))
  const unmountedClientAttempts = clientAttempts.filter((attempt) => !mounted.has(attempt.agent_id))
  const violations = [
    ...uncovered.map((agent) => `uncovered_agent:${agent}`),
    ...missingSessionIDs.map((item) => `missing_session_id:${item.agent_id}:${item.message_index}`),
  ]
  const adherenceViolations = [
    ...missingLoads.map((item) => `missing_skill_load:${item.agent_id}:${item.session_id}`),
    ...clientBeforeLoad.map(
      (item) =>
        `client_before_skill_load:${item.agent_id}:${item.session_id ?? "unknown"}:${item.message_index}:${item.part_index}`,
    ),
    ...unmountedClientAttempts.map(
      (item) =>
        `client_by_unmounted_agent:${item.agent_id}:${item.session_id ?? "unknown"}:${item.message_index}:${item.part_index}`,
    ),
  ]
  return {
    passed: violations.length === 0,
    runtime_adherence_passed: adherenceViolations.length === 0,
    dispatched_agents: dispatched,
    uncovered_agents: uncovered,
    dispatched_owner_sessions: [...ownerSessions.values()].sort(
      (left, right) =>
        left.agent_id.localeCompare(right.agent_id) || left.session_id.localeCompare(right.session_id),
    ),
    successful_skill_loads: successfulLoads,
    benchmark_client_attempts: clientAttempts,
    missing_skill_loads: missingLoads,
    client_before_skill_load: clientBeforeLoad,
    unmounted_client_attempts: unmountedClientAttempts,
    violations,
    runtime_adherence_violations: adherenceViolations,
  }
}

/** Keep treatment adherence observable without conditioning the official score on model behaviour. */
export function automationBenchRunValidity(input: {
  taskOutcomePassed: boolean
  profilePassed: boolean
  isolationPassed: boolean
  promptCompositionPassed: boolean
  skillProjectionPassed: boolean
  skillCoveragePassed: boolean
  skillRuntimeAdherencePassed: boolean
}) {
  return {
    valid:
      input.taskOutcomePassed &&
      input.profilePassed &&
      input.isolationPassed &&
      input.promptCompositionPassed &&
      input.skillProjectionPassed &&
      input.skillCoveragePassed,
    runtime_adherence_passed: input.skillRuntimeAdherencePassed,
  }
}

/** Compact receipt for the last successful public observation of a failed attempt. */
export function failureObservationReceipt(input: {
  runID: string
  runKey: string
  taskID?: string
  missionID?: string
  missionSessionID?: string
  taskIDs?: string[]
  capturedAt: number
  projection?: {
    skill_name?: string
    mounted_agents: string[]
    unmountable_agents: Array<{ agent_id: string }>
  }
  observation?: {
    transcript: TranscriptMessage[]
    missionTranscript?: TranscriptMessage[]
    tasks?: Array<{ task_id: string; transcript: TranscriptMessage[] }>
    trace: Array<Record<string, any>>
    interactions: Array<Record<string, any>>
    benchmarkEvents: Array<Record<string, any>>
  }
}) {
  if (!input.observation) {
    return {
      schema_version: EXTERNAL_BENCHMARK_SCHEMA_VERSION,
      run_id: input.runID,
      run_key: input.runKey,
      task_id: input.taskID ?? null,
      mission_id: input.missionID ?? null,
      mission_session_id: input.missionSessionID ?? null,
      task_ids: [...(input.taskIDs ?? [])].sort(),
      status: "unavailable" as const,
      reason: input.missionID || input.taskID ? "no_successful_observation" : "mission_not_created",
      captured_at: null,
      message_count: 0,
      mission_message_count: 0,
      task_message_count: 0,
      trace_event_count: 0,
      interaction_count: 0,
      benchmark_event_count: 0,
      skill_runtime_coverage: null,
    }
  }
  return {
    schema_version: EXTERNAL_BENCHMARK_SCHEMA_VERSION,
    run_id: input.runID,
    run_key: input.runKey,
    task_id: input.taskID ?? null,
    mission_id: input.missionID ?? null,
    mission_session_id: input.missionSessionID ?? null,
    task_ids: [...(input.taskIDs ?? input.observation.tasks?.map((task) => task.task_id) ?? [])].sort(),
    status: "captured" as const,
    reason: "last_successful_public_observation",
    captured_at: input.capturedAt,
    message_count:
      (input.observation.missionTranscript?.length ?? 0) + input.observation.transcript.length,
    mission_message_count: input.observation.missionTranscript?.length ?? 0,
    task_message_count: input.observation.transcript.length,
    trace_event_count: input.observation.trace.length,
    interaction_count: input.observation.interactions.length,
    benchmark_event_count: input.observation.benchmarkEvents.length,
    skill_runtime_coverage: input.projection
      ? auditDispatchedSkillCoverage({
          projection: input.projection,
          transcript: input.observation.transcript,
        })
      : null,
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
    let physicalSystemChanges = 0
    const firstDivergentLabels: Record<string, number> = {}
    const seenDigests = new Set<string>()
    for (const [index, fingerprint] of fingerprints.entries()) {
      const divergence = comparePromptComposition(index === 0 ? undefined : fingerprints[index - 1], fingerprint)
      if (
        index > 0 &&
        fingerprints[index - 1]?.physicalSystem?.sha256 !== undefined &&
        fingerprint.physicalSystem?.sha256 !== undefined &&
        fingerprints[index - 1]!.physicalSystem!.sha256 !== fingerprint.physicalSystem.sha256
      ) {
        physicalSystemChanges += 1
      }
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
      physical_system_changes: physicalSystemChanges,
      first_divergent_labels: firstDivergentLabels,
    }
  })
  const totals = sessions.reduce(
    (sum, item) => ({
      calls: sum.calls + item.calls,
      stable: sum.stable + item.stable_prefix_tokens_est,
      divergent: sum.divergent + item.divergent_tokens_est,
      resent: sum.resent + item.resent_prefix_tokens_est,
      physicalSystemChanges: sum.physicalSystemChanges + item.physical_system_changes,
    }),
    { calls: 0, stable: 0, divergent: 0, resent: 0, physicalSystemChanges: 0 },
  )
  return {
    sessions: sessions.sort((left, right) => right.divergent_tokens_est - left.divergent_tokens_est),
    calls: totals.calls,
    stable_prefix_tokens_est: totals.stable,
    divergent_tokens_est: totals.divergent,
    resent_prefix_tokens_est: totals.resent,
    physical_system_changes: totals.physicalSystemChanges,
    stable_prefix_share: totals.stable + totals.divergent === 0 ? null : totals.stable / (totals.stable + totals.divergent),
  }
}

/**
 * Fail-closed coverage receipt for a run produced by the instrumented runner.
 * `LLM.stream` emits `llm_request` before invoking the Provider, while a
 * session-purpose usage row exists only when that attempt returns usage. A
 * timed-out or otherwise failed attempt therefore has a fingerprint and no
 * usage row. The unsafe direction is the inverse: usage attributed to a
 * Session/Agent without a fingerprinted request attempt.
 */
export function auditPromptCompositionCoverage(traceEvents: unknown[], providerRows: ProviderUsageRow[]) {
  const requests = traceEvents.filter((raw) => {
    const event = raw as LLMRequestTraceEvent
    return event?.kind === "llm_request" && typeof event.sessionID === "string"
  }) as LLMRequestTraceEvent[]
  const fingerprinted = requests.filter((event) => event.payload?.promptComposition !== undefined)
  const sessionUsageRows = providerRows.filter((row) => row.purpose === "session")
  const violations: string[] = []
  if (requests.length === 0) violations.push("no_llm_request_events")
  if (fingerprinted.length !== requests.length) {
    violations.push(`missing_fingerprints:${requests.length - fingerprinted.length}`)
  }
  const requestCounts = new Map<string, number>()
  for (const event of requests) {
    if (typeof event.agentName !== "string" || !event.agentName) {
      violations.push(`unattributed_request_event:${String(event.sessionID)}`)
      continue
    }
    const key = `${event.sessionID}\u0000${event.agentName}`
    requestCounts.set(key, (requestCounts.get(key) ?? 0) + 1)
  }
  const usageCounts = new Map<string, number>()
  for (const [index, row] of sessionUsageRows.entries()) {
    if (!row.session_id || !row.agent_id) {
      violations.push(`unattributed_session_usage:${row.id || index}`)
      continue
    }
    const key = `${row.session_id}\u0000${row.agent_id}`
    usageCounts.set(key, (usageCounts.get(key) ?? 0) + 1)
  }
  for (const [key, usageCount] of [...usageCounts.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const requestCount = requestCounts.get(key) ?? 0
    if (usageCount <= requestCount) continue
    const [sessionID, agentID] = key.split("\u0000")
    violations.push(`usage_without_request_attempt:${sessionID}:${agentID}:${usageCount}:${requestCount}`)
  }
  const requestAttemptsWithoutUsage = [...requestCounts.entries()].reduce(
    (total, [key, requestCount]) => total + Math.max(0, requestCount - (usageCounts.get(key) ?? 0)),
    0,
  )
  return {
    passed: violations.length === 0,
    request_events: requests.length,
    fingerprinted_events: fingerprinted.length,
    session_usage_rows: sessionUsageRows.length,
    request_attempts_without_usage: requestAttemptsWithoutUsage,
    violations,
  }
}

/** Prompt fingerprints exist only on Task-bound AgentTrace; Mission usage remains ledger-only by architecture. */
export function auditTaskBoundPromptCompositionCoverage(input: {
  traceEvents: unknown[]
  providerRows: ProviderUsageRow[]
  missionSessionID: string
}) {
  const traceSessionIDs = new Set(
    input.traceEvents
      .map((raw) => (raw as Record<string, any>)?.sessionID)
      .filter((value): value is string => typeof value === "string"),
  )
  const taskSessionUsage = input.providerRows.filter(
    (row) =>
      row.purpose === "session" &&
      row.session_id !== input.missionSessionID &&
      typeof row.session_id === "string",
  )
  const untracedTaskUsage = taskSessionUsage.filter((row) => !traceSessionIDs.has(row.session_id!))
  const tracedTaskUsage = taskSessionUsage.filter((row) => traceSessionIDs.has(row.session_id!))
  const hasTaskRequestEvents = input.traceEvents.some(
    (raw) =>
      (raw as Record<string, any>)?.kind === "llm_request" &&
      (raw as Record<string, any>)?.sessionID !== input.missionSessionID,
  )
  const coverage = tracedTaskUsage.length > 0 || hasTaskRequestEvents
    ? auditPromptCompositionCoverage(input.traceEvents, tracedTaskUsage)
    : {
        passed: true,
        request_events: 0,
        fingerprinted_events: 0,
        session_usage_rows: 0,
        request_attempts_without_usage: 0,
        violations: [] as string[],
      }
  const violations = [
    ...coverage.violations,
    ...untracedTaskUsage.map((row) => `task_usage_without_task_trace:${row.id}`),
  ]
  return {
    passed: violations.length === 0,
    scope: "task_bound_agent_trace",
    mission_session_id: input.missionSessionID,
    mission_usage_rows: input.providerRows.filter(
      (row) => row.purpose === "session" && row.session_id === input.missionSessionID,
    ).length,
    task_usage_rows: taskSessionUsage.length,
    traced_task_session_ids: [...traceSessionIDs].sort(),
    request_events: coverage.request_events,
    fingerprinted_events: coverage.fingerprinted_events,
    session_usage_rows: coverage.session_usage_rows,
    request_attempts_without_usage: coverage.request_attempts_without_usage,
    violations,
  }
}
