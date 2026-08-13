import { createHash } from "node:crypto"
import {
  ArtifactReadLocatorListSchema,
  ArtifactReadLocatorSchema,
  EngineArtifactEnvelopeSchema,
  EvolutionArtifactSchemas,
  EvolutionPackagePublishableArtifactTypeSchema,
  parseEvolutionArtifact,
  type ArtifactReadLocator,
  type EngineArtifactEnvelope,
  type EvolutionArtifactType,
} from "@opencorvus-ai/plugin"
import { deriveComparisonRecommendation } from "../../../expert-squads/builtin/evolution-lab/lib/evolution-lab/comparison"

export type MarketEntry = {
  namespace: string
  id: string
  name: string
  label: string
  description: string
  version: string
  installation_scopes: string[]
}

export type RandomSelection = {
  algorithm: "sha256-rejection-v1"
  seedHex: string
  poolSHA256: string
  poolCount: number
  counter: number
  index: number
  selected: MarketEntry
}

export type EvolutionRequestFact = {
  method: string
  route: string
  status: number
  durationMs: number
}

export type ArtifactFailureTransition = {
  artifact_id: string
  task_id: string
  kind: string
  label: string
  catalog_revision: number
  time_updated: number
  error_name?: string
  message?: string
}

export type ConversationFailureRow = {
  part_id: string
  message_id: string
  session_id: string
  time_created: number
  time_updated: number
  part_data: unknown
  message_data: unknown
}

export function positiveIntegerSetting(value: string | undefined, fallback: number, name: string): number {
  const raw = value?.trim()
  if (!raw) return fallback
  const parsed = Number(raw)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive safe integer`)
  return parsed
}

export type IsolatedProviderHandoff = Readonly<{
  auth: boolean
  models: boolean
}>

export function isolatedProviderHandoff(input: {
  copyAuth: boolean
  copyModels: boolean
}): IsolatedProviderHandoff {
  return Object.freeze({
    auth: input.copyAuth,
    models: input.copyModels,
  })
}

export function evolutionTargetLineageInstructions(): readonly string[] {
  return Object.freeze([
    "Treat the complete target identity above as one immutable tuple; preserve every character of project_id,",
    "project_directory, namespace, id, incumbent package digest, and Evolution Lab digest in every downstream Task.",
    "Never abbreviate, reconstruct, normalize, or copy these identifiers from prose; use the exact frozen values.",
    "If an exact target identity is unavailable, publish typed-unavailable evidence instead of inventing or weakening it.",
  ])
}

function recordValue(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

export function summarizeConversationFailureTransitions(rows: readonly ConversationFailureRow[]) {
  const transitions = rows.map((row) => {
    const part = recordValue(row.part_data)
    const message = recordValue(row.message_data)
    const state = recordValue(part.state)
    const failure = recordValue(state.failure)
    const error = recordValue(message.error)
    const errorData = recordValue(error.data)
    const raw = typeof state.raw === "string" ? state.raw : ""
    return {
      part_id: row.part_id,
      message_id: row.message_id,
      session_id: row.session_id,
      tool: typeof part.tool === "string" ? part.tool : undefined,
      status: typeof state.status === "string" ? state.status : undefined,
      time_created: row.time_created,
      time_updated: row.time_updated,
      raw_bytes: Buffer.byteLength(raw, "utf8"),
      raw_sha256: createHash("sha256").update(raw).digest("hex"),
      message_finish: typeof message.finish === "string" ? message.finish : undefined,
      failure_name:
        typeof failure.name === "string"
          ? failure.name
          : typeof error.name === "string"
            ? error.name
            : undefined,
      failure_message:
        typeof failure.message === "string"
          ? failure.message.slice(0, 1_000)
          : typeof errorData.message === "string"
            ? errorData.message.slice(0, 1_000)
            : undefined,
    }
  })
  return { count: transitions.length, first: transitions[0], tail: transitions.slice(-20) }
}

export function summarizeArtifactFailureTransitions(
  rows: ReadonlyArray<{
    artifact_id: string
    task_id: string
    kind: string
    label: string
    catalog_revision: number
    time_updated: number
    payload: unknown
  }>,
) {
  const failures = rows
    .filter((row) => {
      const payload = recordValue(row.payload)
      const delivery = recordValue(payload.delivery_result)
      return (
        row.label === "delivery_failed" ||
        row.kind.includes("error") ||
        delivery.status === "delivery_failed" ||
        payload.status === "failed"
      )
    })
    .sort((left, right) => left.catalog_revision - right.catalog_revision || left.artifact_id.localeCompare(right.artifact_id))
    .map((row): ArtifactFailureTransition => {
      const payload = recordValue(row.payload)
      const delivery = recordValue(payload.delivery_result)
      const errorName = delivery.error_name ?? payload.error_name ?? payload.errorName
      const message = delivery.message ?? payload.message ?? payload.reason
      return {
        artifact_id: row.artifact_id,
        task_id: row.task_id,
        kind: row.kind,
        label: row.label,
        catalog_revision: row.catalog_revision,
        time_updated: row.time_updated,
        ...(typeof errorName === "string" ? { error_name: errorName.slice(0, 160) } : {}),
        ...(typeof message === "string" ? { message: message.slice(0, 1_000) } : {}),
      }
    })
  return {
    count: failures.length,
    first: failures[0],
    tail: failures.slice(-20),
  }
}

export function summarizeEvolutionRequests(facts: readonly EvolutionRequestFact[]) {
  const groups = new Map<
    string,
    { method: string; route: string; status: number; count: number; totalDurationMs: number; maxDurationMs: number }
  >()
  for (const fact of facts) {
    const key = `${fact.method}\0${fact.route}\0${fact.status}`
    const current = groups.get(key) ?? {
      method: fact.method,
      route: fact.route,
      status: fact.status,
      count: 0,
      totalDurationMs: 0,
      maxDurationMs: 0,
    }
    current.count += 1
    current.totalDurationMs += fact.durationMs
    current.maxDurationMs = Math.max(current.maxDurationMs, fact.durationMs)
    groups.set(key, current)
  }
  return {
    total: facts.length,
    groups: [...groups.values()]
      .map((group) => ({
        method: group.method,
        route: group.route,
        status: group.status,
        count: group.count,
        total_duration_ms: group.totalDurationMs,
        max_duration_ms: group.maxDurationMs,
      }))
      .sort(
        (left, right) =>
          left.method.localeCompare(right.method) ||
          left.route.localeCompare(right.route) ||
          left.status - right.status,
      ),
    tail: facts.slice(-20),
  }
}

export function taskRoute(taskID: string, operation?: "artifact-read" | "interactions" | "transcript" | "turn-artifacts") {
  const base = `/task/${encodeURIComponent(taskID)}`
  return operation ? `${base}/${operation}` : base
}

export function missionCollectionRoute(directory: string, limit: number) {
  const query = new URLSearchParams({ directory, limit: String(limit) })
  return `/mission?${query.toString()}`
}

export function missionAbortRequest(reason: string) {
  return { surface: "api" as const, reason }
}

export type DeadlineSettlement =
  | { status: "settled" }
  | { status: "timed_out"; error: string }
  | { status: "failed"; error: string }

export type FailureObservationSettlement<T> =
  | { status: "skipped" }
  | { status: "settled"; value: T }
  | { status: "timed_out"; error: string }
  | { status: "failed"; error: string }

export async function settleOperationWithinDeadline(input: {
  operation: () => Promise<void>
  timeoutMs: number
  label: string
}): Promise<DeadlineSettlement> {
  if (!Number.isSafeInteger(input.timeoutMs) || input.timeoutMs <= 0) {
    throw new Error(`${input.label} timeout must be a positive safe integer`)
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      Promise.resolve()
        .then(input.operation)
        .then(
          () => ({ status: "settled" }) as const,
          (error) => ({
            status: "failed" as const,
            error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
          }),
        ),
      new Promise<DeadlineSettlement>((resolve) => {
        timer = setTimeout(
          () =>
            resolve({
              status: "timed_out",
              error: `${input.label} did not settle within ${input.timeoutMs}ms`,
            }),
          input.timeoutMs,
        )
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function settleFailureAfterBoundedAbort<T = never>(input: {
  abortMission?: (signal: AbortSignal) => Promise<void>
  abortTimeoutMs: number
  observeAfterAbort?: () => Promise<T>
  observationTimeoutMs?: number
  settleResources: () => Promise<void>
}) {
  if (input.observeAfterAbort && input.observationTimeoutMs === undefined) {
    throw new Error("Evolution E2E post-abort observation timeout is required")
  }
  let abortStatus: "skipped" | "settled" | "timed_out" | "failed" = "skipped"
  let abortError: string | undefined
  if (input.abortMission) {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      abortStatus = await Promise.race([
        input.abortMission(controller.signal).then(
          () => "settled" as const,
          (error) => {
            abortError = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
            return controller.signal.aborted ? ("timed_out" as const) : ("failed" as const)
          },
        ),
        new Promise<"timed_out">((resolve) => {
          timer = setTimeout(() => {
            controller.abort(new DOMException(`Mission abort exceeded ${input.abortTimeoutMs}ms`, "TimeoutError"))
            resolve("timed_out")
          }, input.abortTimeoutMs)
        }),
      ])
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
  let observation: FailureObservationSettlement<T> = { status: "skipped" }
  if (input.observeAfterAbort) {
    let value: T | undefined
    const settlement = await settleOperationWithinDeadline({
      operation: async () => {
        value = await input.observeAfterAbort!()
      },
      timeoutMs: input.observationTimeoutMs!,
      label: "Evolution E2E post-abort Mission status observation",
    })
    observation = settlement.status === "settled" ? { status: "settled", value: value as T } : settlement
  }
  await input.settleResources()
  return { abortStatus, ...(abortError ? { abortError } : {}), observation }
}

const RANDOM_SELECTION_DOMAIN = "opencorvus-random-expert-squad-evolution-v1"
const UINT64_RANGE = 1n << 64n

export const RANDOM_EVOLUTION_RESERVED_SQUAD_IDS = new Set([
  "advanced",
  "base",
  "evolution-lab",
  "research-studio",
  "squad-sdk",
])

function canonicalPool(entries: readonly MarketEntry[]) {
  return entries
    .map((entry) => `${entry.namespace.length}:${entry.namespace}:${entry.id.length}:${entry.id}`)
    .join("\n")
}

export function eligibleRandomEvolutionTargets(entries: readonly MarketEntry[]): MarketEntry[] {
  const unique = new Map<string, MarketEntry>()
  for (const entry of entries) {
    if (entry.installation_scopes.length !== 0) continue
    if (RANDOM_EVOLUTION_RESERVED_SQUAD_IDS.has(entry.id)) continue
    unique.set(`${entry.namespace}\u0000${entry.id}`, entry)
  }
  return [...unique.values()].sort(
    (left, right) => left.namespace.localeCompare(right.namespace) || left.id.localeCompare(right.id),
  )
}

export function selectRandomEvolutionTarget(entries: readonly MarketEntry[], seedHex: string): RandomSelection {
  const pool = eligibleRandomEvolutionTargets(entries)
  if (pool.length === 0) throw new Error("Random Expert Squad evolution requires at least one eligible Market target")
  if (!/^[a-f0-9]{64}$/.test(seedHex)) {
    throw new Error("Random Expert Squad evolution seed must be a lowercase 32-byte hexadecimal value")
  }
  const poolSHA256 = createHash("sha256").update(canonicalPool(pool), "utf8").digest("hex")
  const width = BigInt(pool.length)
  const acceptanceLimit = UINT64_RANGE - (UINT64_RANGE % width)
  for (let counter = 0; counter <= 0xffff_ffff; counter += 1) {
    const digest = createHash("sha256")
      .update(RANDOM_SELECTION_DOMAIN, "utf8")
      .update("\0", "utf8")
      .update(seedHex, "utf8")
      .update("\0", "utf8")
      .update(String(counter), "utf8")
      .digest()
    const sample = digest.readBigUInt64BE(0)
    if (sample >= acceptanceLimit) continue
    const index = Number(sample % width)
    return {
      algorithm: "sha256-rejection-v1",
      seedHex,
      poolSHA256,
      poolCount: pool.length,
      counter,
      index,
      selected: pool[index]!,
    }
  }
  throw new Error("Random Expert Squad evolution could not derive an unbiased selection")
}

export type ActivityDeadline = {
  activitySHA256: string
  deadlineMs: number
}

export function observeActivityDeadline(input: {
  previous?: ActivityDeadline
  activitySHA256: string
  observedAtMs: number
  inactivityWindowMs: number
}): ActivityDeadline {
  if (!/^[a-f0-9]{64}$/.test(input.activitySHA256)) {
    throw new Error("Mission activity cursor requires a SHA-256 scope digest")
  }
  if (!Number.isSafeInteger(input.observedAtMs) || input.observedAtMs < 0) {
    throw new Error("Mission activity observation time must be a non-negative safe integer")
  }
  if (!Number.isSafeInteger(input.inactivityWindowMs) || input.inactivityWindowMs <= 0) {
    throw new Error("Mission inactivity window must be a positive safe integer")
  }
  if (input.previous?.activitySHA256 === input.activitySHA256) return input.previous
  const deadlineMs = input.observedAtMs + input.inactivityWindowMs
  if (!Number.isSafeInteger(deadlineMs)) {
    throw new Error("Mission inactivity deadline must be a safe integer")
  }
  return {
    activitySHA256: input.activitySHA256,
    deadlineMs,
  }
}

export type EvolutionArtifactFact = {
  taskID: string
  locator: unknown
  envelope: unknown
}

export type EvolutionEvidenceSummary = {
  counts: Record<string, number>
  campaign: ParsedEvolutionArtifactFact
  candidate: ParsedEvolutionArtifactFact
  recommendation: ParsedEvolutionArtifactFact
}

type PublishableEvolutionArtifactType = Exclude<EvolutionArtifactType, "evolution-lab/promotion-receipt">

export type ParsedEvolutionArtifactFact = {
  taskID: string
  locator: ArtifactReadLocator
  envelope: EngineArtifactEnvelope
  artifactType: PublishableEvolutionArtifactType
  payload: ReturnType<typeof parseEvolutionArtifact>
}

function factIdentity(taskID: string, locator: ArtifactReadLocator) {
  return `${taskID}\0${JSON.stringify(locator)}`
}

function parseEvolutionFact(fact: EvolutionArtifactFact): ParsedEvolutionArtifactFact {
  const locator = ArtifactReadLocatorSchema.parse(fact.locator)
  const envelope = EngineArtifactEnvelopeSchema.parse(fact.envelope)
  const artifactType = EvolutionPackagePublishableArtifactTypeSchema.parse(envelope.artifact_type)
  return {
    taskID: fact.taskID,
    locator,
    envelope,
    artifactType,
    payload: parseEvolutionArtifact(artifactType, envelope.payload),
  }
}

function requireProducer(fact: ParsedEvolutionArtifactFact, agentID: string) {
  const producer = fact.envelope.producer
  if (producer.owner_kind !== "projected-worker" || producer.agent_id !== agentID) {
    throw new Error(`${fact.artifactType} requires projected worker ${agentID}`)
  }
}

function sameJSON(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
}

type ResourceContentIdentity = Readonly<{ media_type: string; bytes: number; sha256: string }>

function sameResourceContent(
  value: { media_type: string; bytes: number; sha256: string },
  expected: ResourceContentIdentity,
) {
  return value.media_type === expected.media_type && value.bytes === expected.bytes && value.sha256 === expected.sha256
}

export function assertRandomEvolutionCampaignContract(
  payload: unknown,
  expected: {
    caseID: string
    dataset: ResourceContentIdentity
    caseResource: ResourceContentIdentity
    modelConfiguration: ResourceContentIdentity
    environment: ResourceContentIdentity
    workspaceTemplate: ResourceContentIdentity
    workspaceDigest: string
    permissionSnapshot: ResourceContentIdentity
    scorerAsset: ResourceContentIdentity
    scorerID: string
    scorerRevision: string
    projectID: string
    projectDirectory: string
    targetNamespace: string
    targetID: string
    baselineDigest: string
    model: string
    maxRuns: number
    maxCost: number
  },
) {
  const campaign = EvolutionArtifactSchemas["evolution-lab/campaign-spec"].parse(payload)
  const frozenCase = campaign.frozen_inputs.cases[0]
  if (
    campaign.dataset_partition !== "development" ||
    !sameJSON(campaign.cases, [expected.caseID]) ||
    campaign.repetitions !== 1 ||
    campaign.model !== expected.model ||
    campaign.budget.max_runs !== expected.maxRuns ||
    campaign.budget.max_cost !== expected.maxCost ||
    campaign.trial_execution.status !== "available" ||
    campaign.trial_execution.installation_scope !== "project" ||
    campaign.target.scope !== "project" ||
    campaign.target.project_id !== expected.projectID ||
    campaign.target.project_directory !== expected.projectDirectory ||
    campaign.target.namespace !== expected.targetNamespace ||
    campaign.target.id !== expected.targetID ||
    campaign.baseline_revision.package_digest !== expected.baselineDigest ||
    !sameResourceContent(campaign.frozen_inputs.dataset, expected.dataset) ||
    campaign.frozen_inputs.cases.length !== 1 ||
    frozenCase?.case_id !== expected.caseID ||
    !frozenCase ||
    !sameResourceContent(frozenCase.resource, expected.caseResource) ||
    !sameResourceContent(campaign.frozen_inputs.model_configuration, expected.modelConfiguration) ||
    !sameResourceContent(campaign.frozen_inputs.environment, expected.environment) ||
    !sameResourceContent(campaign.frozen_inputs.workspace_template, expected.workspaceTemplate) ||
    campaign.workspace_digest !== expected.workspaceDigest ||
    !sameResourceContent(campaign.frozen_inputs.permission_snapshot, expected.permissionSnapshot) ||
    campaign.frozen_inputs.scorer_assets.length !== 1 ||
    campaign.frozen_inputs.scorer_assets[0]?.scorer_id !== expected.scorerID ||
    campaign.frozen_inputs.scorer_assets[0]?.scorer_revision !== expected.scorerRevision ||
    !sameResourceContent(campaign.frozen_inputs.scorer_assets[0]!.resource, expected.scorerAsset)
  ) {
    throw new Error("Campaign does not preserve the exact frozen input closure, runtime, scope, or run matrix")
  }
  return campaign
}

export function summarizeEvolutionEvidence(facts: readonly EvolutionArtifactFact[]): EvolutionEvidenceSummary {
  const parsed = facts.map(parseEvolutionFact)
  const byIdentity = new Map<string, ParsedEvolutionArtifactFact>()
  for (const fact of parsed) {
    const identity = factIdentity(fact.taskID, fact.locator)
    if (byIdentity.has(identity)) throw new Error(`Evolution evidence contains duplicate locator ${identity}`)
    byIdentity.set(identity, fact)
  }

  const recommendations = parsed.filter((fact) => fact.artifactType === "evolution-lab/comparison-recommendation")
  if (recommendations.length !== 1) {
    throw new Error(
      `Evolution evidence requires exactly one comparison recommendation; observed ${recommendations.length}`,
    )
  }
  const recommendation = recommendations[0]!
  requireProducer(recommendation, "evolution-recommendation-owner")

  const sourceLocators = ArtifactReadLocatorListSchema.parse(recommendation.envelope.source_artifact_locators)
  const sources = sourceLocators.map((locator) => {
    const source = byIdentity.get(factIdentity(recommendation.taskID, locator))
    if (!source) throw new Error(`Evolution recommendation source was not completely read: ${JSON.stringify(locator)}`)
    return source
  })
  const campaigns = sources.filter((fact) => fact.artifactType === "evolution-lab/campaign-spec")
  const candidates = sources.filter((fact) => fact.artifactType === "evolution-lab/candidate-revision")
  const runs = sources.filter((fact) => fact.artifactType === "evolution-lab/run-evidence-bundle")
  const evaluations = sources.filter((fact) => fact.artifactType === "evolution-lab/evaluation-result")
  if (sources.length !== campaigns.length + candidates.length + runs.length + evaluations.length) {
    throw new Error("Evolution recommendation contains an undeclared source Artifact type")
  }
  if (campaigns.length !== 1 || candidates.length !== 1) {
    throw new Error("Evolution recommendation requires exactly one campaign and one candidate source")
  }
  requireProducer(campaigns[0]!, "evolution-experiment-planner")
  requireProducer(candidates[0]!, "evolution-candidate-author")
  for (const run of runs) requireProducer(run, "evolution-evaluator")
  for (const evaluation of evaluations) {
    requireProducer(evaluation, "evolution-safety-auditor")
    const payload = EvolutionArtifactSchemas["evolution-lab/evaluation-result"].parse(evaluation.payload)
    if (payload.integrity_review?.status !== "reviewed") {
      throw new Error("Evolution evaluation requires a completed independent integrity review")
    }
  }

  const campaign = EvolutionArtifactSchemas["evolution-lab/campaign-spec"].parse(campaigns[0]!.payload)
  const candidate = EvolutionArtifactSchemas["evolution-lab/candidate-revision"].parse(candidates[0]!.payload)
  const exactRecommendation = deriveComparisonRecommendation({
    campaign,
    campaignLocator: campaigns[0]!.locator,
    candidate,
    candidateLocator: candidates[0]!.locator,
    runs: runs.map((fact) => ({
      locator: fact.locator,
      value: EvolutionArtifactSchemas["evolution-lab/run-evidence-bundle"].parse(fact.payload),
    })),
    evaluations: evaluations.map((fact) => ({
      locator: fact.locator,
      value: EvolutionArtifactSchemas["evolution-lab/evaluation-result"].parse(fact.payload),
    })),
  })
  const claimedRecommendation = EvolutionArtifactSchemas["evolution-lab/comparison-recommendation"].parse(
    recommendation.payload,
  )
  if (!sameJSON(exactRecommendation, claimedRecommendation)) {
    throw new Error("Evolution recommendation does not equal its exact Campaign, Candidate, run, and evaluation matrix")
  }

  const opportunities = parsed.filter((fact) => fact.artifactType === "evolution-lab/opportunity")
  const attributions = parsed.filter((fact) => fact.artifactType === "evolution-lab/failure-attribution")
  if (opportunities.length !== 1 || attributions.length !== 1) {
    throw new Error(
      `Evolution evidence requires one opportunity and one failure attribution; observed ${opportunities.length}/${attributions.length}`,
    )
  }
  const closure = [...opportunities, ...attributions, ...sources, recommendation]
  const counts: Record<string, number> = {}
  for (const fact of closure) counts[fact.artifactType] = (counts[fact.artifactType] ?? 0) + 1
  return { counts, campaign: campaigns[0]!, candidate: candidates[0]!, recommendation }
}

export function recommendationInteractiveArtifactIDs(
  transcript: readonly Record<string, unknown>[],
  sessionID: string,
) {
  return transcript.flatMap((message) => {
    const info = message.info as Record<string, unknown> | undefined
    if (info?.sessionID !== sessionID) return []
    return ((message.parts as Array<Record<string, unknown>> | undefined) ?? []).flatMap((part) =>
      part.type === "interactive-artifact" && typeof part.artifactID === "string" ? [part.artifactID] : [],
    )
  })
}
