import { createHash } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import z from "zod"
import {
  ArtifactReadLocatorListSchema,
  readExactArtifactsSettled,
  type ArtifactReadLocator,
  type EngineArtifactHost,
  type ExactArtifactRead,
} from "@opencorvus-ai/plugin/artifact-catalog"
import type { TaskArtifactHost, TaskArtifactRef } from "@opencorvus-ai/plugin/task-artifact"
import {
  AggregatorMetricEvaluatorConfigSchema,
  JudgeMetricEvaluatorConfigSchema,
  PrebuiltMetricEvaluatorConfigSchema,
  QueryMetricEvaluatorConfigSchema,
  ShellMetricEvaluatorConfigSchema,
} from "@opencorvus-ai/plugin"
import { Instance } from "@/project/instance"
import { runTaskCommandWithInactivity } from "@/shell/command-inactivity"
import { Filesystem } from "@/util/filesystem"
import { activeTaskExecutionCapsule } from "@/engine/task-execution-capsule-binding"
import { Log } from "@/util/log"
import {
  type VisualFeedbackVerificationIssue,
  summarizeVisualFeedbackVerification,
  validateVisualFeedbackVerification,
  type VisualFeedbackVerificationEvidenceReader,
  VISUAL_FEEDBACK_VERIFICATION_ARTIFACT_LABEL,
  VisualFeedbackVerificationListSchema,
} from "@/acceptance/visual-feedback-verification"
import { requireEngineArtifactByLocator } from "@/artifact-catalog"
import { readBrowserPreviewEvidenceByRow } from "@/browser-preview/persist"
import { Session } from "@/session"
import { clip01, readResultsForIteration, readSpecsForTask, writeMetricResult } from "./store"
import { canonicalMetricJSON } from "./canonical-json"
import {
  MetricExecutionEvidence,
  type MetricDirection,
  type MetricResult,
  type MetricSpec,
  type MetricUnavailableReasonCode,
} from "./types"

const log = Log.create({ service: "metric-executor" })

export interface MetricExecutorContext {
  /** Exact Artifact reader for the evaluator Task. */
  evidenceReader: Pick<EngineArtifactHost, "read">
  /** Immutable evidence publisher owned by the evaluator Task. */
  taskArtifacts: Pick<TaskArtifactHost, "stage" | "publish">
  /** Streaming LLM (Large Language Model) judge implementation. */
  judge?: JudgeRunner
  workDir?: string
}

export interface ExecuteMetricsInput {
  task_id: string
  iteration: number
  delivery_slice_revision_id?: string | null
  selected_evidence_locators: ArtifactReadLocator[]
  visual_feedback_verification_artifact_locators?: Array<Extract<ArtifactReadLocator, { source: "engine_artifact" }>>
}

export interface ExecuteMetricsOutcome {
  results: MetricResult[]
  unavailable: Array<{ spec_id: string; reason_code: MetricUnavailableReasonCode; evidence_ref: TaskArtifactRef }>
}

type SelectedEvidenceIdentity = {
  locator: ArtifactReadLocator
  media_type: string
  bytes: number
  sha256: string
}

type EvaluationAttempt =
  | {
      status: "measured"
      raw_value: number
      execution: unknown
      resources?: Array<{ name: string; media_type: string; bytes: Uint8Array }>
    }
  | {
      status: "unavailable"
      reason_code: MetricUnavailableReasonCode
      message: string
      execution: unknown
      resources?: Array<{ name: string; media_type: string; bytes: Uint8Array }>
    }

export async function executeMetrics(
  input: ExecuteMetricsInput,
  context: MetricExecutorContext,
): Promise<ExecuteMetricsOutcome> {
  const locators = ArtifactReadLocatorListSchema.parse(input.selected_evidence_locators)
  const selectedBatch = await readExactArtifactsSettled(context.evidenceReader, locators)
  const selectedEvidence = selectedBatch.reads.map(selectedEvidenceIdentity)
  const selectionFailure =
    selectedBatch.diagnostics.length === 0
      ? undefined
      : `Selected evidence could not be read completely: ${selectedBatch.diagnostics
          .map((diagnostic) => `${diagnostic.index}:${errorMessage(diagnostic.error)}`)
          .join("; ")}`
  const results: MetricResult[] = []
  const unavailable: ExecuteMetricsOutcome["unavailable"] = []
  const currentResults = new Map<string, MetricResult>()

  for (const spec of orderMetricSpecsForEvaluation(readSpecsForTask(input.task_id))) {
    let attempt: EvaluationAttempt
    if (selectionFailure) {
      attempt = unavailableAttempt("selected_evidence_unavailable", selectionFailure, {
        diagnostics: selectedBatch.diagnostics.map((diagnostic) => ({
          index: diagnostic.index,
          locator: diagnostic.locator,
          message: errorMessage(diagnostic.error),
        })),
      })
    } else {
      try {
        attempt = await evaluateSpec(spec, input, context, selectedBatch.reads, currentResults)
      } catch (cause) {
        const message = errorMessage(cause)
        log.warn("metric evaluator failed", { spec_id: spec.id, name: spec.name, error: message })
        attempt = unavailableAttempt("execution_failed", message, { error: message })
      }
    }
    const evidenceRef = await publishAttempt({
      taskArtifacts: context.taskArtifacts,
      spec,
      input,
      selectedEvidence,
      attempt,
    })
    const identity = {
      metric_spec_id: spec.id,
      task_id: input.task_id,
      iteration: input.iteration,
      delivery_slice_revision_id: input.delivery_slice_revision_id ?? null,
      evidence_ref: evidenceRef,
    }
    const result =
      attempt.status === "measured"
        ? writeMetricResult({
            ...identity,
            raw_value: attempt.raw_value,
            normalized_value: normalize(attempt.raw_value, spec),
            met_target: meetsThreshold(attempt.raw_value, spec.target, spec.direction),
            met_floor: meetsThreshold(attempt.raw_value, spec.floor, spec.direction),
            evidence_fresh: true,
          })
        : writeMetricResult({
            ...identity,
            raw_value: null,
            normalized_value: null,
            met_target: null,
            met_floor: null,
            evidence_fresh: false,
          })
    if (attempt.status === "unavailable") {
      unavailable.push({ spec_id: spec.id, reason_code: attempt.reason_code, evidence_ref: evidenceRef })
    }
    currentResults.set(spec.id, result)
    results.push(result)
  }
  return { results, unavailable }
}

function selectedEvidenceIdentity(read: ExactArtifactRead): SelectedEvidenceIdentity {
  return {
    locator: read.locator,
    media_type: read.media_type,
    bytes: read.bytes.byteLength,
    sha256: read.sha256,
  }
}

async function publishAttempt(input: {
  taskArtifacts: MetricExecutorContext["taskArtifacts"]
  spec: MetricSpec
  input: ExecuteMetricsInput
  selectedEvidence: SelectedEvidenceIdentity[]
  attempt: EvaluationAttempt
}): Promise<TaskArtifactRef> {
  const { resources = [], ...semanticAttempt } = input.attempt
  const evidence = MetricExecutionEvidence.parse({
    schema_version: 1,
    metric_spec_id: input.spec.id,
    task_id: input.input.task_id,
    iteration: input.input.iteration,
    evaluator_kind: input.spec.evaluator_kind,
    selected_evidence: input.selectedEvidence,
    ...semanticAttempt,
  })
  const stage = await input.taskArtifacts.stage({ trees: ["metric-evidence"] })
  const directory = createHash("sha256").update(input.spec.id).digest("hex")
  const filename = `${directory}/attempt.json`
  await mkdir(path.join(stage.treeDirectories["metric-evidence"]!, directory))
  await writeFile(path.join(stage.treeDirectories["metric-evidence"]!, filename), canonicalMetricJSON(evidence), {
    flag: "wx",
  })
  for (const resource of resources) {
    await writeFile(path.join(stage.treeDirectories["metric-evidence"]!, directory, resource.name), resource.bytes, {
      flag: "wx",
    })
  }
  const publication = await input.taskArtifacts.publish(stage, {
    snapshot_kind: "catalog",
    files: [
      { tree: "metric-evidence", path: filename, media_type: "application/json" },
      ...resources
        .map((resource) => ({
          tree: "metric-evidence" as const,
          path: `${directory}/${resource.name}`,
          media_type: resource.media_type,
        }))
        .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0)),
    ],
  })
  const attemptRef = publication.artifacts.find((artifact) => artifact.path === filename)
  if (!attemptRef) throw new Error(`Metric evidence publication omitted ${filename}`)
  return attemptRef
}

async function evaluateSpec(
  spec: MetricSpec,
  input: ExecuteMetricsInput,
  context: MetricExecutorContext,
  selectedEvidence: readonly ExactArtifactRead[],
  currentResults: ReadonlyMap<string, MetricResult>,
): Promise<EvaluationAttempt> {
  switch (spec.evaluator_kind) {
    case "shell":
      return runShell(spec, context, input.task_id)
    case "judge":
      return runJudge(spec, context, selectedEvidence)
    case "prebuilt":
      return runPrebuilt(spec, input)
    case "query":
      return runQuery(spec, input, currentResults)
    case "aggregator":
      return runAggregator(spec, input, currentResults)
  }
}

function currentIterationDependencies(spec: MetricSpec): string[] {
  if (spec.evaluator_kind === "query") {
    const config = QueryMetricEvaluatorConfigSchema.safeParse(spec.evaluator_config)
    if (config.success && config.data.query === "metric_result_value" && config.data.iteration_offset === 0) {
      return [config.data.metric_spec_id]
    }
  }
  if (spec.evaluator_kind === "aggregator") {
    const config = AggregatorMetricEvaluatorConfigSchema.safeParse(spec.evaluator_config)
    if (config.success && config.data.iteration_offset === 0) return config.data.of
  }
  return []
}

export function orderMetricSpecsForEvaluation(specs: readonly MetricSpec[]): MetricSpec[] {
  const byID = new Map(specs.map((spec) => [spec.id, spec]))
  const remaining = new Set(byID.keys())
  const completed = new Set<string>()
  const ordered: MetricSpec[] = []

  while (remaining.size > 0) {
    const ready = [...remaining]
      .filter((id) =>
        currentIterationDependencies(byID.get(id)!).every(
          (dependencyID) => !byID.has(dependencyID) || completed.has(dependencyID),
        ),
      )
      .sort()
    const next = ready.length > 0 ? ready : [...remaining].sort()
    for (const id of next) {
      ordered.push(byID.get(id)!)
      remaining.delete(id)
      completed.add(id)
    }
  }

  return ordered
}

export function normalize(rawValue: number, spec: MetricSpec): number {
  if (!Number.isFinite(rawValue)) throw new Error(`Metric ${spec.id} produced a non-finite value`)
  const { target, floor, direction } = spec
  if (direction === "higher_better") {
    if (target <= floor) return rawValue >= target ? 1 : 0
    return clip01((rawValue - floor) / (target - floor))
  }
  if (floor <= target) return rawValue <= target ? 1 : 0
  return clip01((floor - rawValue) / (floor - target))
}

function meetsThreshold(rawValue: number, threshold: number, direction: MetricDirection): boolean {
  return direction === "higher_better" ? rawValue >= threshold : rawValue <= threshold
}

async function runShell(spec: MetricSpec, context: MetricExecutorContext, taskID: string): Promise<EvaluationAttempt> {
  const parsed = ShellMetricEvaluatorConfigSchema.safeParse(spec.evaluator_config)
  if (!parsed.success) return unavailableAttempt("configuration_invalid", z.prettifyError(parsed.error), {})
  const config = parsed.data
  const cwd = config.cwd ? Filesystem.resolve(config.cwd) : (context.workDir ?? Filesystem.resolve(Instance.directory))
  const result = await runTaskCommandWithInactivity(
    { taskID, cwd },
    {
      executable: config.executable,
      args: config.args,
      env: process.env,
      inactivityTimeoutMs: config.inactivity_timeout_ms,
    },
  )
  const execution = {
    scorer_revision: config.scorer_revision,
    workspace_digest: config.workspace_digest,
    executable: config.executable,
    args: config.args,
    cwd,
    inactivity_timeout_ms: config.inactivity_timeout_ms,
    exit_code: result.exitCode ?? null,
    stdout: outputResourceIdentity("stdout.bin", result.stdoutBytes),
    stderr: outputResourceIdentity("stderr.bin", result.stderrBytes),
    failure: result.failure ?? null,
  }
  if (result.failure?.kind === "inactivity") {
    return unavailableAttempt(
      "inactivity_timeout",
      `Shell scorer produced no stdout/stderr activity for ${config.inactivity_timeout_ms}ms`,
      execution,
      shellOutputResources(result),
    )
  }
  if (result.failure || result.exitCode === undefined) {
    return unavailableAttempt(
      "execution_failed",
      result.failure?.message ?? "Shell scorer returned no exit code",
      execution,
      shellOutputResources(result),
    )
  }
  if (config.parse !== "exit_code" && result.exitCode !== 0) {
    return unavailableAttempt(
      "execution_failed",
      `Shell scorer exited with code ${result.exitCode}`,
      execution,
      shellOutputResources(result),
    )
  }
  if (config.parse === "exit_code") {
    const expected = config.expected_exit_code ?? 0
    return measured(result.exitCode === expected ? 1 : 0, execution, shellOutputResources(result))
  }
  if (config.parse === "stdout_number") {
    const match = result.stdout.match(/-?\d+(?:\.\d+)?/)
    if (!match)
      return unavailableAttempt(
        "parse_failed",
        "Shell scorer stdout contains no numeric value",
        execution,
        shellOutputResources(result),
      )
    const value = Number(match[0])
    return Number.isFinite(value)
      ? measured(value, execution, shellOutputResources(result))
      : unavailableAttempt(
          "parse_failed",
          "Shell scorer stdout value is not finite",
          execution,
          shellOutputResources(result),
        )
  }
  let expression: RegExp
  try {
    expression = new RegExp(config.pattern!)
  } catch (cause) {
    return unavailableAttempt("configuration_invalid", errorMessage(cause), execution, shellOutputResources(result))
  }
  const match = result.stdout.match(expression)
  if (!match?.[1]) {
    return unavailableAttempt(
      "parse_failed",
      "Shell scorer stdout does not contain capture group 1",
      execution,
      shellOutputResources(result),
    )
  }
  const value = Number(match[1])
  return Number.isFinite(value)
    ? measured(value, execution, shellOutputResources(result))
    : unavailableAttempt(
        "parse_failed",
        "Shell scorer captured value is not finite",
        execution,
        shellOutputResources(result),
      )
}

export interface JudgeRequest {
  spec: MetricSpec
  criteria: string
  rubric: Array<{ score: number; label: string; anchor: string; passes: boolean }>
  selectedEvidence: Array<{
    locator: ArtifactReadLocator
    mediaType: string
    bytes: Uint8Array
    sha256: string
  }>
}

export type JudgeStreamEvent = { type: "rationale_delta"; text: string } | { type: "result"; score: number }

export type JudgeRunner = (request: JudgeRequest) => AsyncIterable<JudgeStreamEvent>

export class MetricJudgeInactivityError extends Error {
  override readonly name = "MetricJudgeInactivityError"
}

export class MetricJudgeInputError extends Error {
  override readonly name = "MetricJudgeInputError"
}

export class MetricJudgeParseError extends Error {
  override readonly name = "MetricJudgeParseError"
}

async function runJudge(
  spec: MetricSpec,
  context: MetricExecutorContext,
  selectedEvidence: readonly ExactArtifactRead[],
): Promise<EvaluationAttempt> {
  const parsed = JudgeMetricEvaluatorConfigSchema.safeParse(spec.evaluator_config)
  if (!parsed.success) return unavailableAttempt("configuration_invalid", z.prettifyError(parsed.error), {})
  if (!context.judge) {
    return unavailableAttempt("provider_unavailable", "No streaming judge provider is configured", {
      scorer_revision: parsed.data.scorer_revision,
      provider_id: parsed.data.provider_id,
      model_id: parsed.data.model_id,
    })
  }
  if (selectedEvidence.length === 0) {
    return unavailableAttempt("input_unavailable", "Judge scorer requires explicit selected evidence", {
      scorer_revision: parsed.data.scorer_revision,
      provider_id: parsed.data.provider_id,
      model_id: parsed.data.model_id,
    })
  }
  let rationale = ""
  let score: number | undefined
  try {
    for await (const event of context.judge({
      spec,
      criteria: parsed.data.criteria,
      rubric: parsed.data.rubric,
      selectedEvidence: selectedEvidence.map((evidence) => ({
        locator: evidence.locator,
        mediaType: evidence.media_type,
        bytes: evidence.bytes,
        sha256: evidence.sha256,
      })),
    })) {
      if (event.type === "rationale_delta") {
        rationale += event.text
        continue
      }
      if (score !== undefined) {
        return unavailableAttempt("parse_failed", "Streaming judge emitted multiple final scores", {
          scorer_revision: parsed.data.scorer_revision,
          provider_id: parsed.data.provider_id,
          model_id: parsed.data.model_id,
          rationale,
        })
      }
      score = event.score
    }
  } catch (cause) {
    const reasonCode =
      cause instanceof MetricJudgeInactivityError
        ? "inactivity_timeout"
        : cause instanceof MetricJudgeInputError
          ? "input_unavailable"
          : cause instanceof MetricJudgeParseError
            ? "parse_failed"
            : "provider_unavailable"
    return unavailableAttempt(reasonCode, errorMessage(cause), {
      scorer_revision: parsed.data.scorer_revision,
      provider_id: parsed.data.provider_id,
      model_id: parsed.data.model_id,
      rationale,
    })
  }
  if (score === undefined || !Number.isFinite(score)) {
    return unavailableAttempt("parse_failed", "Streaming judge emitted no finite final score", {
      scorer_revision: parsed.data.scorer_revision,
      provider_id: parsed.data.provider_id,
      model_id: parsed.data.model_id,
      rationale,
    })
  }
  const rubricScores = parsed.data.rubric.map((level) => level.score)
  if (score < Math.min(...rubricScores) || score > Math.max(...rubricScores) || rationale.length === 0) {
    return unavailableAttempt("parse_failed", "Streaming judge response violates the frozen rubric", {
      scorer_revision: parsed.data.scorer_revision,
      provider_id: parsed.data.provider_id,
      model_id: parsed.data.model_id,
      rationale,
      score,
    })
  }
  return measured(score, {
    scorer_revision: parsed.data.scorer_revision,
    provider_id: parsed.data.provider_id,
    model_id: parsed.data.model_id,
    rationale,
    score,
  })
}

async function runPrebuilt(spec: MetricSpec, input: ExecuteMetricsInput): Promise<EvaluationAttempt> {
  const config = PrebuiltMetricEvaluatorConfigSchema.safeParse(spec.evaluator_config)
  if (!config.success) return unavailableAttempt("configuration_invalid", z.prettifyError(config.error), {})
  const locators = input.visual_feedback_verification_artifact_locators
  if (!locators?.length) {
    return unavailableAttempt("input_unavailable", "Visual feedback verification Artifact locator is required", {
      scorer_revision: config.data.scorer_revision,
    })
  }
  const artifacts = locators.map((locator) => requireEngineArtifactByLocator({ taskID: input.task_id, locator }))
  const identityMismatch = artifacts.find(
    (artifact) =>
      artifact.kind !== "visual_feedback_verification" ||
      artifact.label !== VISUAL_FEEDBACK_VERIFICATION_ARTIFACT_LABEL,
  )
  if (identityMismatch) {
    return unavailableAttempt(
      "input_unavailable",
      `Visual feedback verification Artifact ${identityMismatch.id} has identity ${identityMismatch.kind}/${identityMismatch.label}`,
      {
        scorer_revision: config.data.scorer_revision,
        locators,
      },
    )
  }
  const payloads = artifacts.map((artifact) => artifact.payload)
  const parsed = VisualFeedbackVerificationListSchema.safeParse(payloads)
  if (!parsed.success || parsed.data.length === 0) {
    return unavailableAttempt("input_unavailable", "Visual feedback verification evidence is invalid", {
      scorer_revision: config.data.scorer_revision,
      locators,
    })
  }
  const issues: VisualFeedbackVerificationIssue[] = []
  const summaries: string[] = []
  for (const verification of parsed.data) {
    summaries.push(summarizeVisualFeedbackVerification(verification))
    const validation = await validateVisualFeedbackVerification({
      verification,
      expectedTaskID: input.task_id,
      reader: visualFeedbackVerificationEvidenceReader,
    })
    if (!validation.passing) issues.push(...validation.issues)
  }
  // The metric stays 0/1 — changing what scores what is a separate decision —
  // but the evidence now carries which gate family rejected, so a reader can
  // tell an unreadable capture apart from a genuinely blank render.
  return measured(issues.length > 0 ? 0 : 1, {
    scorer_revision: config.data.scorer_revision,
    locators,
    summaries,
    issues,
    issue_codes: [...new Set(issues.map((entry) => entry.code))].sort(),
  })
}

async function runQuery(
  spec: MetricSpec,
  input: ExecuteMetricsInput,
  currentResults: ReadonlyMap<string, MetricResult>,
): Promise<EvaluationAttempt> {
  const config = QueryMetricEvaluatorConfigSchema.safeParse(spec.evaluator_config)
  if (!config.success) return unavailableAttempt("configuration_invalid", z.prettifyError(config.error), {})
  if (config.data.query === "constant_value") {
    return measured(config.data.value, {
      scorer_revision: config.data.scorer_revision,
      query: config.data.query,
      value: config.data.value,
    })
  }

  const iteration = input.iteration + config.data.iteration_offset
  if (iteration < 0) {
    return unavailableAttempt("input_unavailable", "Query metric result iteration is negative", {
      scorer_revision: config.data.scorer_revision,
      query: config.data.query,
      iteration,
    })
  }
  const row =
    config.data.iteration_offset === 0
      ? currentResults.get(config.data.metric_spec_id)
      : latestMetricResult(input.task_id, iteration, config.data.metric_spec_id)
  if (!row?.evidence_fresh) {
    return unavailableAttempt("input_unavailable", "Query metric result input is unavailable", {
      scorer_revision: config.data.scorer_revision,
      query: config.data.query,
      metric_spec_id: config.data.metric_spec_id,
      iteration,
      input_evidence: row?.evidence_ref ?? null,
    })
  }
  const raw = row[config.data.result_column]
  return Number.isFinite(raw)
    ? measured(raw, {
        scorer_revision: config.data.scorer_revision,
        query: config.data.query,
        metric_spec_id: config.data.metric_spec_id,
        iteration,
        result_column: config.data.result_column,
        input_evidence: row.evidence_ref,
      })
    : unavailableAttempt("parse_failed", `Query metric result column ${config.data.result_column} is not numeric`, {
        scorer_revision: config.data.scorer_revision,
        query: config.data.query,
        metric_spec_id: config.data.metric_spec_id,
        iteration,
      })
}

function latestMetricResult(taskID: string, iteration: number, metricSpecID: string): MetricResult | undefined {
  let latest: MetricResult | undefined
  for (const row of readResultsForIteration(taskID, iteration)) {
    if (row.metric_spec_id !== metricSpecID) continue
    if (
      !latest ||
      row.computed_at > latest.computed_at ||
      (row.computed_at === latest.computed_at && row.id > latest.id)
    ) {
      latest = row
    }
  }
  return latest
}

async function runAggregator(
  spec: MetricSpec,
  input: ExecuteMetricsInput,
  currentResults: ReadonlyMap<string, MetricResult>,
): Promise<EvaluationAttempt> {
  const config = AggregatorMetricEvaluatorConfigSchema.safeParse(spec.evaluator_config)
  if (!config.success) return unavailableAttempt("configuration_invalid", z.prettifyError(config.error), {})
  const iteration = input.iteration + config.data.iteration_offset
  if (iteration < 0)
    return unavailableAttempt("input_unavailable", "Aggregator iteration is negative", {
      scorer_revision: config.data.scorer_revision,
      iteration,
    })
  const wanted = new Set(config.data.of)
  const rows =
    config.data.iteration_offset === 0
      ? [...currentResults.values()].filter((row) => wanted.has(row.metric_spec_id))
      : readResultsForIteration(input.task_id, iteration).filter((row) => wanted.has(row.metric_spec_id))
  const latest = new Map<string, MetricResult>()
  for (const row of rows) {
    const current = latest.get(row.metric_spec_id)
    if (
      !current ||
      row.computed_at > current.computed_at ||
      (row.computed_at === current.computed_at && row.id > current.id)
    ) {
      latest.set(row.metric_spec_id, row)
    }
  }
  const unavailableInputs = config.data.of.filter((id) => latest.get(id)?.evidence_fresh !== true)
  if (unavailableInputs.length > 0) {
    return unavailableAttempt("input_unavailable", "Aggregator inputs are unavailable", {
      scorer_revision: config.data.scorer_revision,
      iteration,
      unavailable_metric_spec_ids: unavailableInputs,
      input_evidence: rows.map((row) => row.evidence_ref),
    })
  }
  const values = config.data.of.map(
    (id) => (latest.get(id) as Extract<MetricResult, { evidence_fresh: true }>).normalized_value,
  )
  const raw =
    config.data.op === "mean"
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : config.data.op === "min"
        ? Math.min(...values)
        : config.data.op === "max"
          ? Math.max(...values)
          : values.reduce((sum, value) => sum + value, 0)
  return measured(raw, {
    scorer_revision: config.data.scorer_revision,
    iteration,
    operation: config.data.op,
    input_evidence: config.data.of.map((id) => latest.get(id)!.evidence_ref),
  })
}

function measured(
  rawValue: number,
  execution: unknown,
  resources?: Array<{ name: string; media_type: string; bytes: Uint8Array }>,
): EvaluationAttempt {
  if (!Number.isFinite(rawValue)) return unavailableAttempt("parse_failed", "Scorer value is not finite", execution)
  return { status: "measured", raw_value: rawValue, execution, resources }
}

function unavailableAttempt(
  reasonCode: MetricUnavailableReasonCode,
  message: string,
  execution: unknown,
  resources?: Array<{ name: string; media_type: string; bytes: Uint8Array }>,
): EvaluationAttempt {
  return { status: "unavailable", reason_code: reasonCode, message, execution, resources }
}

function outputResourceIdentity(name: string, bytes: Uint8Array) {
  return { name, bytes: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") }
}

function shellOutputResources(result: { stdoutBytes: Uint8Array; stderrBytes: Uint8Array }) {
  return [
    { name: "stderr.bin", media_type: "application/octet-stream", bytes: result.stderrBytes },
    { name: "stdout.bin", media_type: "application/octet-stream", bytes: result.stdoutBytes },
  ]
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

// The evidence verdict declares what it reads; this is where those reads are
// bound to the real Session, Engine Artifact catalog, and evidence directory.
const visualFeedbackVerificationEvidenceReader: VisualFeedbackVerificationEvidenceReader<
  ReturnType<typeof requireEngineArtifactByLocator>
> = {
  engineArtifactByLocator: (readInput) => requireEngineArtifactByLocator(readInput),
  sessionMessages: (sessionID) => Session.messages({ sessionID }),
  browserPreviewEvidence: (readInput) => readBrowserPreviewEvidenceByRow(readInput),
}
