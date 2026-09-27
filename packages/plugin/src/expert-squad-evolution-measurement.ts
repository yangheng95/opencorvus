import { EvolutionArtifactSchemas, EvolutionNativeMeasurementsSchema } from "./expert-squad-evolution-artifact.js"
import { EngineArtifactLocatorSchema } from "./artifact-catalog.js"
import type { MetricRecordedObservation, MetricRecordedSnapshot } from "./metric-evaluation.js"
import { z } from "zod"
import { artifactReadLocatorKey, type ArtifactReadLocator, type EngineArtifactEnvelope } from "./artifact-catalog.js"
import { canonicalEvolutionJSON } from "./expert-squad-evolution.js"
import type { EvolutionArtifactReferences } from "./expert-squad-evolution-reference.js"

type LocatedMeasurement = {
  locator: ArtifactReadLocator
  value: { case_id: string; arm: "baseline" | "candidate"; repetition: number }
}

type NativeCampaign = ReturnType<typeof EvolutionArtifactSchemas["evolution-lab/campaign-spec"]["parse"]>
type NativeRun = ReturnType<typeof EvolutionArtifactSchemas["evolution-lab/run-evidence-bundle"]["parse"]>
type NativeEvaluation = ReturnType<typeof EvolutionArtifactSchemas["evolution-lab/evaluation-result"]["parse"]>
type NativeLocatedRun = { locator: z.infer<typeof EngineArtifactLocatorSchema>; value: NativeRun }

/** Actual subject and frozen scorer identity, independent of the Campaign
 * named by the caller. A baseline observation may serve another Campaign. */
function nativeMeasuresRun(observation: MetricRecordedObservation, run: NativeRun, campaign: NativeCampaign) {
  const resource = run.run_evidence_resource
  return observation.trial_task_id === run.task_id &&
    observation.subject.sha256 === resource.sha256 && observation.subject.bytes === resource.bytes &&
    observation.subject.media_type === resource.media_type && campaign.scorers.some((scorer) =>
      scorer.scorer_id === observation.scorer_id && scorer.scorer_revision === observation.scorer_revision)
}

/** The persisted request can introduce an exact authorized Run; it cannot
 * prove a batch or assign every source in a Turn to this Campaign. */
export function evolutionNativeRequestedRuns(input: {
  snapshot: MetricRecordedSnapshot
  campaign: NativeCampaign
  campaignLocator: z.infer<typeof EngineArtifactLocatorSchema>
  candidateLocator: z.infer<typeof EngineArtifactLocatorSchema>
  runs: readonly NativeLocatedRun[]
  referenceKey: (locator: ArtifactReadLocator) => string
}): NativeLocatedRun[] {
  const requestSchema = z.object({
    campaign_spec_locator: EngineArtifactLocatorSchema,
    candidate_revision_locator: EngineArtifactLocatorSchema.nullable(),
    run_evidence_locator: EngineArtifactLocatorSchema,
  })
  const selected = new Map<string, NativeLocatedRun>()
  for (const observation of input.snapshot.observations) {
    const request = requestSchema.safeParse(observation.tool_request?.input)
    if (!request.success || input.referenceKey(request.data.campaign_spec_locator) !== input.referenceKey(input.campaignLocator)) continue
    for (const run of input.runs) {
      if (run.value.arm === "candidate" && (!request.data.candidate_revision_locator ||
          input.referenceKey(request.data.candidate_revision_locator) !== input.referenceKey(input.candidateLocator))) continue
      if (input.referenceKey(run.locator) !== input.referenceKey(request.data.run_evidence_locator) ||
          !nativeMeasuresRun(observation, run.value, input.campaign)) continue
      selected.set(artifactReadLocatorKey(run.locator), run)
    }
  }
  return [...selected.values()]
}

/** A missing Evaluation is a visible incomplete measurement, never an invented
 * Evaluation or an instruction to rerun a scorer. IDs distinguish every native
 * result, including partial calls and repeated evaluate calls in one Tool. */
export function deriveEvolutionNativeMeasurements(input: {
  snapshot: MetricRecordedSnapshot
  campaign: NativeCampaign
  runs: readonly NativeLocatedRun[]
  evaluations: readonly { value: NativeEvaluation }[]
}) {
  const covered = new Set(input.evaluations.flatMap(({ value }) =>
    value.measurement_identity?.owner_task_id === input.snapshot.task_id
      ? value.measurement_identity.scorer_results.map((result) => result.metric_result_id) : []))
  return EvolutionNativeMeasurementsSchema.parse({
    task_id: input.snapshot.task_id,
    result_ids: input.snapshot.observations.map((item) => item.metric_result_id).sort(),
    unpublished: input.snapshot.observations.flatMap((observation) => {
      const runs = input.runs.filter((run) => nativeMeasuresRun(observation, run.value, input.campaign))
      return covered.has(observation.metric_result_id) || runs.length === 0 ? [] : [{
        metric_result_id: observation.metric_result_id, evidence_ref: observation.evidence_ref,
        run_locators: runs.map((run) => run.locator),
      }]
    }).sort((a, b) => a.metric_result_id < b.metric_result_id ? -1 : a.metric_result_id > b.metric_result_id ? 1 : 0),
  })
}

/** Native result IDs identify the recorded scorer occurrences; the receipt
 * only transports them. Unrecorded identities retain their exact published
 * claim, without guessing an occurrence or rewriting historical records. */
export function createEvolutionMeasurementKey(input: {
  runs: readonly { locator: ArtifactReadLocator; value: unknown }[]
  referenceKey?: (locator: ArtifactReadLocator) => string
}) {
  const referenceKey = input.referenceKey ?? artifactReadLocatorKey
  const runs = new Map<string, string>()
  for (const run of input.runs) {
    const key = referenceKey(run.locator)
    const fact = canonicalEvolutionJSON(run.value)
    if (runs.has(key) && runs.get(key) !== fact)
      throw new Error(`Evolution Run reference has contradictory observations: ${key}`)
    runs.set(key, fact)
  }
  return (value: unknown): string => {
    if (!value || typeof value !== "object" || !("measurement_identity" in value) || value.measurement_identity === undefined)
      return canonicalEvolutionJSON(value)
    const { metric_receipt_resource: transport, run_evidence_locator: run, campaign_spec_locator: campaign,
      candidate_revision_locator: candidate, scorers, measurement_identity: identity, ...fact } =
      EvolutionArtifactSchemas["evolution-lab/evaluation-result"].parse(value)
    const byScorer = (a: { scorer_id: string }, b: { scorer_id: string }) => a.scorer_id < b.scorer_id ? -1 : a.scorer_id > b.scorer_id ? 1 : 0
    return canonicalEvolutionJSON({ ...fact,
      measurement_identity: { ...identity!, scorer_results: [...identity!.scorer_results].sort(byScorer) },
      scorers: [...scorers].sort(byScorer),
      campaign_spec_locator: referenceKey(campaign),
      candidate_revision_locator: candidate ? referenceKey(candidate) : null,
      run_observation: runs.has(referenceKey(run))
        ? { fact: runs.get(referenceKey(run)) } : { exact_locator: referenceKey(run) },
    })
  }
}

/** Group publication aliases of exactly the same measured fact. Callers parse
 * the full typed payload first. Callers with recorded measurement identities
 * supply the shared key, preserving distinct executions even at equal values.
 * No observation is superseded by its timestamp or by a more favorable value.
 */
export function groupEvolutionMeasurements<T extends LocatedMeasurement>(
  artifacts: readonly T[], factKey: (value: T["value"]) => string = canonicalEvolutionJSON,
): Map<string, T[][]> {
  const slots = new Map<string, Map<string, Map<string, T>>>()
  for (const artifact of artifacts) {
    const { case_id, arm, repetition } = artifact.value
    const slot = `${case_id}:${arm}:${repetition}`
    let observations = slots.get(slot)
    if (!observations) slots.set(slot, (observations = new Map()))
    const fact = factKey(artifact.value)
    let aliases = observations.get(fact)
    if (!aliases) observations.set(fact, (aliases = new Map()))
    aliases.set(artifactReadLocatorKey(artifact.locator), artifact)
  }
  return new Map(
    [...slots].map(([slot, observations]) => [
      slot,
      [...observations.keys()].sort().map((fact) => {
        const aliases = observations.get(fact)!
        return [...aliases.keys()].sort().map((key) => aliases.get(key)!)
      }),
    ]),
  )
}

type MeasurementPublication = { locator: ArtifactReadLocator; envelope: EngineArtifactEnvelope }

/** Complete the publication identities of the selected measured facts in one
 * caller-owned Task/catalog snapshot. This does not select a different value,
 * scoring occurrence or Trial, and does not claim completeness of unselected measurements.
 */
export function expandEvolutionMeasurementAliases<T extends MeasurementPublication>(
  selected: readonly T[],
  catalog: readonly T[],
  referenceKey: (locator: ArtifactReadLocator) => string = artifactReadLocatorKey,
): T[] {
  const factKey = createEvolutionMeasurementKey({
    runs: [...selected, ...catalog].filter((item) => item.envelope.artifact_type === "evolution-lab/run-evidence-bundle")
      .map((item) => ({ locator: item.locator, value: item.envelope.payload })),
    referenceKey,
  })
  const key = (artifact: T) => {
    const type = artifact.envelope.artifact_type
    return type === "evolution-lab/run-evidence-bundle" || type === "evolution-lab/evaluation-result"
      ? `${type}\0${factKey(artifact.envelope.payload)}`
      : undefined
  }
  const facts = new Set(selected.map(key).filter((value): value is string => value !== undefined))
  const result = new Map<string, T>()
  for (const artifact of [...selected, ...catalog]) {
    const fact = key(artifact)
    if (fact !== undefined && facts.has(fact)) result.set(artifactReadLocatorKey(artifact.locator), artifact)
  }
  return [...result.keys()].sort().map((identity) => result.get(identity)!)
}

/** Every published Evaluation whose own stamped facts bind it to one exact
 * Campaign/Candidate comparison, with the exact Runs it measured. Membership is
 * not the Owner's selection, so a comparison cannot omit a published
 * measurement. A Run names no exact Campaign; an unmeasured Run is never
 * assigned to a comparison from wider provenance. */
export function evolutionComparisonMembers<T extends MeasurementPublication>(input: {
  campaign: ArtifactReadLocator
  candidate: ArtifactReadLocator
  catalog: readonly T[]
  references: Pick<EvolutionArtifactReferences, "key" | "same">
}): T[] {
  const members = new Map<string, T>()
  const measuredRuns = new Set<string>()
  for (const artifact of input.catalog) {
    if (artifact.envelope.artifact_type !== "evolution-lab/evaluation-result") continue
    const parsed = EvolutionArtifactSchemas["evolution-lab/evaluation-result"].safeParse(artifact.envelope.payload)
    if (!parsed.success) continue
    const evaluation = parsed.data
    const bound =
      input.references.same(evaluation.campaign_spec_locator, input.campaign) &&
      (evaluation.arm === "baseline"
        ? evaluation.candidate_revision_locator === null
        : evaluation.candidate_revision_locator !== null &&
          input.references.same(evaluation.candidate_revision_locator, input.candidate))
    if (!bound) continue
    members.set(artifactReadLocatorKey(artifact.locator), artifact)
    measuredRuns.add(input.references.key(evaluation.run_evidence_locator))
  }
  for (const artifact of input.catalog)
    if (
      artifact.envelope.artifact_type === "evolution-lab/run-evidence-bundle" &&
      measuredRuns.has(input.references.key(artifact.locator))
    )
      members.set(artifactReadLocatorKey(artifact.locator), artifact)
  return [...members.keys()].sort().map((identity) => members.get(identity)!)
}

type RunObservation = ReturnType<(typeof EvolutionArtifactSchemas)["evolution-lab/run-evidence-bundle"]["parse"]>
type EvaluationObservation = ReturnType<(typeof EvolutionArtifactSchemas)["evolution-lab/evaluation-result"]["parse"]>

export type EvolutionAgreedFact<T> = { agreed: true; value: T } | { agreed: false; values: T[] }

export type EvolutionSlotScorer =
  | { status: "measured"; value: number; evidence: ArtifactReadLocator[] }
  | { status: "unavailable"; reasons: string[]; evidence: ArtifactReadLocator[] }
  | { status: "conflict"; values: number[]; evidence: ArtifactReadLocator[] }
  | { status: "missing" }

export type EvolutionSlotObservations<
  R extends { locator: ArtifactReadLocator; value: RunObservation },
  E extends { locator: ArtifactReadLocator; value: EvaluationObservation },
> = {
  /** Distinct observations; each inner array is one fact and its publication aliases. */
  runs: R[][]
  evaluations: E[][]
  /** More than one Trial Task, or more than one terminal occurrence of it. */
  trialConflict: boolean
  terminalIdentityUnavailable: boolean
  /** null: no Run. unavailable: no terminal observation. conflict: terminal observations disagree. */
  outcome: RunObservation["outcome"] | "conflict" | null
  resources: null | {
    token_usage: EvolutionAgreedFact<number>
    cost: EvolutionAgreedFact<number | null>
    activity_duration_ms: EvolutionAgreedFact<number | null>
  }
  /** Measurements contributing values: those of the terminal observation once one exists. */
  contributing: E[][]
  scorers: Map<string, EvolutionSlotScorer>
}

function agreed<T>(values: readonly T[]): EvolutionAgreedFact<T> {
  const distinct = [...new Map(values.map((value) => [canonicalEvolutionJSON(value), value])).values()]
  return distinct.length === 1 ? { agreed: true, value: distinct[0]! } : { agreed: false, values: distinct }
}

function exactLocators(values: readonly ArtifactReadLocator[]) {
  const byKey = new Map(values.map((value) => [artifactReadLocatorKey(value), value]))
  return [...byKey.keys()].sort().map((key) => byKey.get(key)!)
}

/** Derive each slot from every observation it holds. Nothing is dropped and no
 * observation wins by time or value: facts the contributing observations agree
 * on are used, disagreement stays an explicit conflict, and a typed
 * unavailable result records no value rather than contradicting one. Once a
 * Trial has a terminal observation, its inactive or awaiting observations stay
 * consumed evidence but supply no outcome, resource or scorer value. */
export function deriveEvolutionSlotObservations<
  R extends { locator: ArtifactReadLocator; value: RunObservation },
  E extends { locator: ArtifactReadLocator; value: EvaluationObservation },
>(input: {
  runs: readonly R[]
  evaluations: readonly E[]
  scorerIDs: readonly string[]
  referenceKey?: (locator: ArtifactReadLocator) => string
}): Map<string, EvolutionSlotObservations<R, E>> {
  const referenceKey = input.referenceKey ?? artifactReadLocatorKey
  const factKey = createEvolutionMeasurementKey({ runs: input.runs, referenceKey })
  const runGroups = groupEvolutionMeasurements(input.runs, factKey)
  const evaluationGroups = groupEvolutionMeasurements(input.evaluations, factKey)
  const slots = new Set([...runGroups.keys(), ...evaluationGroups.keys()])
  const result = new Map<string, EvolutionSlotObservations<R, E>>()
  for (const slot of [...slots].sort()) {
    const runs = runGroups.get(slot) ?? []
    const evaluations = evaluationGroups.get(slot) ?? []
    const terminal = runs.filter((aliases) => aliases[0]!.value.outcome !== "unavailable")
    const contributingRuns = terminal.length > 0 ? terminal : runs
    const trials = new Set([
      ...runs.map((aliases) => aliases[0]!.value.task_id),
      ...evaluations.map((aliases) => aliases[0]!.value.trial_task_id),
    ])
    const terminalIdentityUnavailable = terminal.length > 1 && terminal.some((aliases) => !aliases[0]!.value.terminal_event_id)
    const occurrences = new Set(terminal.flatMap((aliases) => {
      const run = aliases[0]!.value
      return run.terminal_event_id ? [`${run.task_id}\0${run.terminal_event_id}`] : []
    }))
    const knownTimeDisagreement = !terminalIdentityUnavailable && terminal.length > 1 &&
      !agreed(terminal.map((aliases) => aliases[0]!.value.terminal_time)).agreed
    const terminalOutcomes = agreed(terminal.map((aliases) => aliases[0]!.value.outcome))
    const runIndex = new Map<string, R[]>()
    for (const aliases of runs) for (const run of aliases) runIndex.set(referenceKey(run.locator), aliases)
    const contributing =
      runs.length === 0
        ? evaluations
        : evaluations.filter((aliases) => {
            const measured = runIndex.get(referenceKey(aliases[0]!.value.run_evidence_locator))
            return measured !== undefined && contributingRuns.includes(measured)
          })
    const scorers = new Map<string, EvolutionSlotScorer>()
    for (const scorerID of input.scorerIDs) {
      const results = contributing.flatMap((aliases) =>
        aliases[0]!.value.scorers.filter((scorer) => scorer.scorer_id === scorerID),
      )
      const measured = results.flatMap((scorer) => (scorer.status === "measured" ? [scorer] : []))
      const values = [...new Set(measured.map((scorer) => scorer.value))].sort((left, right) => left - right)
      // One observation keeps its own evidence order; several are merged exactly.
      const evidenceOf = (items: readonly { evidence: ArtifactReadLocator[] }[]) =>
        items.length === 1 ? items[0]!.evidence : exactLocators(items.flatMap((scorer) => scorer.evidence))
      const evidence = evidenceOf(results)
      scorers.set(
        scorerID,
        results.length === 0
          ? { status: "missing" }
          : values.length === 1
            ? { status: "measured", value: values[0]!, evidence: evidenceOf(measured) }
            : values.length > 1
              ? { status: "conflict", values, evidence }
              : {
                  status: "unavailable",
                  reasons: [...new Set(results.flatMap((scorer) => (scorer.status === "unavailable" ? [scorer.reason] : [])))].sort(),
                  evidence,
                },
      )
    }
    result.set(slot, {
      runs,
      evaluations,
      trialConflict: trials.size > 1 || occurrences.size > 1 || knownTimeDisagreement,
      terminalIdentityUnavailable,
      outcome:
        runs.length === 0
          ? null
          : terminal.length === 0
            ? "unavailable"
            : terminalOutcomes.agreed
              ? terminalOutcomes.value
              : "conflict",
      resources:
        contributingRuns.length === 0
          ? null
          : {
              token_usage: agreed(contributingRuns.map((aliases) => aliases[0]!.value.token_usage)),
              cost: agreed(contributingRuns.map((aliases) => aliases[0]!.value.cost)),
              activity_duration_ms: agreed(contributingRuns.map((aliases) => aliases[0]!.value.activity_duration_ms)),
            },
      contributing,
      scorers,
    })
  }
  return result
}

/** Coverage follows independent measured facts, not merely their shared slot.
 * A Review of any proven publication alias covers that one measurement only. */
export function evolutionMeasurementReviewCoverage(input: {
  evaluations: readonly (readonly { locator: ArtifactReadLocator }[])[]
  reviews: readonly { value: { evaluation_result_locator: ArtifactReadLocator; status: "reviewed" | "unavailable" } }[]
  referenceKey?: (locator: ArtifactReadLocator) => string
}) {
  const key = input.referenceKey ?? artifactReadLocatorKey
  const missing = input.evaluations.filter((aliases) =>
    !input.reviews.some(({ value }) => aliases.some(({ locator }) => key(locator) === key(value.evaluation_result_locator))),
  )
  const reviewed = input.evaluations.length > 0 && missing.length === 0 && input.evaluations.every((aliases) =>
    input.reviews.filter(({ value }) => aliases.some(({ locator }) => key(locator) === key(value.evaluation_result_locator)))
      .every(({ value }) => value.status === "reviewed"),
  )
  return { reviewed, missing: missing.map((aliases) => aliases.map(({ locator }) => locator)) }
}

type TrialMatrix = {
  runs: readonly (LocatedMeasurement & { value: { task_id: string } })[]
  evaluations: readonly (LocatedMeasurement & { value: { trial_task_id: string } })[]
}

/** Within one exact comparison matrix, one durable Trial Task cannot be two
 * case/arm/repetition slots. Same-slot aliases or later observations retain
 * their separate identities; neither equal bytes nor wall time picks a Trial. */
export function evolutionTrialSlotConflicts(input: TrialMatrix) {
  const trials = new Map<string, { slots: Set<string>; locators: Map<string, ArtifactReadLocator> }>()
  for (const { taskID, artifact } of [
    ...input.runs.map((artifact) => ({ taskID: artifact.value.task_id, artifact })),
    ...input.evaluations.map((artifact) => ({ taskID: artifact.value.trial_task_id, artifact })),
  ]) {
    let trial = trials.get(taskID)
    if (!trial) trials.set(taskID, (trial = { slots: new Set(), locators: new Map() }))
    const { case_id, arm, repetition } = artifact.value
    trial.slots.add(`${case_id}:${arm}:${repetition}`)
    trial.locators.set(artifactReadLocatorKey(artifact.locator), artifact.locator)
  }
  return [...trials.keys()].sort().flatMap((trial_task_id) => {
    const trial = trials.get(trial_task_id)!
    return trial.slots.size > 1 ? [{
      trial_task_id, slots: [...trial.slots].sort(),
      observation_locators: [...trial.locators.keys()].sort().map((key) => trial.locators.get(key)!),
    }] : []
  })
}

export class EvolutionTrialSlotConflictError extends Error {
  override readonly name = "EvolutionTrialSlotConflictError"
  constructor(readonly conflicts: ReturnType<typeof evolutionTrialSlotConflicts>) {
    super(`Evolution comparison reuses a Trial Task across distinct matrix slots: ${JSON.stringify(conflicts)}`)
  }
}

export function requireEvolutionTrialSlotIdentity(input: TrialMatrix): void {
  const conflicts = evolutionTrialSlotConflicts(input)
  if (conflicts.length) throw new EvolutionTrialSlotConflictError(conflicts)
}
