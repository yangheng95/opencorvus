import { VISUAL_FEEDBACK_VERIFICATION_SCORER_NAME } from "@opencorvus-ai/plugin"
import { EvolutionArtifactSchemas, EvolutionArtifactIntegrityError } from "./artifacts"

type Campaign = ReturnType<(typeof EvolutionArtifactSchemas)["evolution-lab/campaign-spec"]["parse"]>
type Candidate = ReturnType<(typeof EvolutionArtifactSchemas)["evolution-lab/candidate-revision"]["parse"]>
type Evaluation = ReturnType<(typeof EvolutionArtifactSchemas)["evolution-lab/evaluation-result"]["parse"]>
type RunEvidence = ReturnType<(typeof EvolutionArtifactSchemas)["evolution-lab/run-evidence-bundle"]["parse"]>
type Review = ReturnType<(typeof EvolutionArtifactSchemas)["evolution-lab/integrity-review"]["parse"]>
type Comparison = ReturnType<(typeof EvolutionArtifactSchemas)["evolution-lab/comparison-recommendation"]["parse"]>
type ArtifactLocator = Evaluation["campaign_spec_locator"]
type Located<T> = { locator: ArtifactLocator; value: T }

function mean(values: readonly number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function median(values: readonly number[]) {
  const ordered = values.toSorted((left, right) => left - right)
  const middle = Math.floor(ordered.length / 2)
  return ordered.length % 2 === 0 ? (ordered[middle - 1]! + ordered[middle]!) / 2 : ordered[middle]!
}

/**
 * Sample variance (Bessel's n-1 denominator). The population form understates
 * spread on the small repetition counts a campaign actually runs, which fed a
 * standard error — and therefore an interval — that was too narrow to be
 * trusted by whoever reads the published recommendation. Undefined for n < 2.
 */
function sampleVariance(values: readonly number[], average: number) {
  if (values.length < 2) return undefined
  return values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1)
}

/**
 * Two-sided 95% Student-t critical values by degrees of freedom. A campaign
 * pairs a handful of repetitions per case, so the normal 1.96 quantile the
 * previous revision used was wrong exactly where the samples are smallest —
 * at df=1 the correct multiplier is more than six times larger. Beyond the
 * table the t and normal quantiles agree to within a rounding of this scale.
 */
const T_QUANTILE_95_BY_DF: readonly number[] = [
  12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12,
  2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042,
]
const NORMAL_QUANTILE_95 = 1.96
const INTERVAL_CONFIDENCE = 0.95

/**
 * Confidence bands for the aggregate interval, expressed as a fraction of a
 * scorer's declared target-to-floor range. These two numbers are the only
 * calibration surface left in the recommendation: a half-width within 5% of a
 * scorer range distinguishes a real effect from noise at the granularity these
 * campaigns are written to, and beyond 15% the interval spans enough of the
 * range that the sign of the estimate is not informative on its own.
 */
const AGGREGATE_HIGH_CONFIDENCE_HALF_WIDTH = 0.05
const AGGREGATE_MEDIUM_CONFIDENCE_HALF_WIDTH = 0.15

function tQuantile95(degreesOfFreedom: number) {
  if (degreesOfFreedom < 1) return undefined
  return T_QUANTILE_95_BY_DF[degreesOfFreedom - 1] ?? NORMAL_QUANTILE_95
}

/** Mean, sample variance, and a two-sided 95% interval for one paired sample. */
function pairedInterval(values: readonly number[]) {
  const average = mean(values)
  const variance = sampleVariance(values, average)
  const quantile = tQuantile95(values.length - 1)
  if (variance === undefined || quantile === undefined) {
    return { mean: average, variance: 0, halfWidth: undefined }
  }
  return { mean: average, variance, halfWidth: quantile * Math.sqrt(variance / values.length) }
}

function slotKey(caseID: string, arm: "baseline" | "candidate", repetition: number) {
  return `${caseID}:${arm}:${repetition}`
}

function exactRevisionIdentity(left: Candidate["candidate_revision"], right: Candidate["candidate_revision"]) {
  return (
    left.namespace === right.namespace &&
    left.id === right.id &&
    left.version === right.version &&
    left.package_digest === right.package_digest
  )
}

function sameLocator(left: ArtifactLocator | null, right: ArtifactLocator | null) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function exactEvidence(values: readonly ArtifactLocator[]) {
  const entries = new Map(values.map((value) => [JSON.stringify(value), value]))
  return [...entries.entries()].toSorted(([left], [right]) => left.localeCompare(right)).map(([, value]) => value)
}

function averageByArm(runs: readonly RunEvidence[], arm: "baseline" | "candidate", field: "cost" | "token_usage") {
  return mean(runs.filter((run) => run.arm === arm).map((run) => run[field]))
}

type ExpectedSlot = { caseID: string; arm: "baseline" | "candidate"; repetition: number; key: string }

type IndexedComparisonEvidence = {
  evaluations: Map<string, Evaluation>
  evaluationLocators: Map<string, ArtifactLocator>
  reviews: Map<string, Review>
  runs: Map<string, RunEvidence>
  runLocators: Map<string, ArtifactLocator>
}

/**
 * Bind every submitted Artifact to its declared slot, refusing anything that
 * does not belong to the frozen Campaign.
 *
 * Extracted from `deriveComparisonRecommendation`, which ran indexing,
 * availability classification, delta statistics and the promotion rule as one
 * 300-line body: none of the four could be exercised without constructing
 * inputs valid for all of them.
 */
function indexComparisonEvidence(input: {
  campaign: Campaign
  candidate: Candidate
  campaignLocator: ArtifactLocator
  candidateLocator: ArtifactLocator
  evaluations: readonly Located<Evaluation>[]
  reviews: readonly Located<Review>[]
  runs: readonly Located<RunEvidence>[]
  expectedSlotKeys: ReadonlySet<string>
  expectedScorerIDs: readonly string[]
}): IndexedComparisonEvidence {
  const { campaign, candidate, expectedSlotKeys, expectedScorerIDs } = input
  const evaluations = new Map<string, Evaluation>()
  const evaluationLocators = new Map<string, ArtifactLocator>()
  for (const located of input.evaluations) {
    const evaluation = located.value
    const key = slotKey(evaluation.case_id, evaluation.arm, evaluation.repetition)
    if (!expectedSlotKeys.has(key)) throw new EvolutionArtifactIntegrityError(`comparison has undeclared evaluation slot ${key}`)
    if (evaluations.has(key)) throw new EvolutionArtifactIntegrityError(`comparison has duplicate evaluation slot ${key}`)
    const scorerIDs = evaluation.scorers.map((scorer) => scorer.scorer_id).toSorted()
    if (JSON.stringify(scorerIDs) !== JSON.stringify(expectedScorerIDs))
      throw new EvolutionArtifactIntegrityError(`comparison evaluation slot ${key} does not contain the exact scorer set`)
    const expectedRevision = evaluation.arm === "baseline"
      ? campaign.baseline_revision.package_digest
      : candidate.candidate_revision.package_digest
    if (evaluation.trial_revision_digest !== expectedRevision)
      throw new EvolutionArtifactIntegrityError(`comparison evaluation slot ${key} has the wrong package revision`)
    if (
      !sameLocator(evaluation.campaign_spec_locator, input.campaignLocator) ||
      !sameLocator(
        evaluation.candidate_revision_locator,
        evaluation.arm === "candidate" ? input.candidateLocator : null,
      )
    )
      throw new EvolutionArtifactIntegrityError(`comparison evaluation slot ${key} has the wrong Campaign or Candidate source`)
    evaluations.set(key, evaluation)
    evaluationLocators.set(key, located.locator)
  }
  const reviews = new Map<string, Review>()
  for (const located of input.reviews) {
    const review = located.value
    const key = slotKey(review.case_id, review.arm, review.repetition)
    if (!expectedSlotKeys.has(key)) throw new EvolutionArtifactIntegrityError(`comparison has undeclared review slot ${key}`)
    if (reviews.has(key)) throw new EvolutionArtifactIntegrityError(`comparison has duplicate review slot ${key}`)
    if (!sameLocator(review.evaluation_result_locator, evaluationLocators.get(key) ?? null))
      throw new EvolutionArtifactIntegrityError(`comparison review slot ${key} does not review its exact evaluation result`)
    reviews.set(key, review)
  }
  const runs = new Map<string, RunEvidence>()
  const runLocators = new Map<string, ArtifactLocator>()
  for (const located of input.runs) {
    const run = located.value
    const key = slotKey(run.case_id, run.arm, run.repetition)
    if (!expectedSlotKeys.has(key)) throw new EvolutionArtifactIntegrityError(`comparison has undeclared run slot ${key}`)
    if (runs.has(key)) throw new EvolutionArtifactIntegrityError(`comparison has duplicate run slot ${key}`)
    const expectedRevision = run.arm === "baseline"
      ? campaign.baseline_revision.package_digest
      : candidate.candidate_revision.package_digest
    if (Object.values(run.revision_equality).some((digest) => digest !== expectedRevision))
      throw new EvolutionArtifactIntegrityError(`comparison run slot ${key} has the wrong package revision`)
    if (
      run.workspace_digest !== campaign.workspace_digest ||
      run.environment_digest !== campaign.environment_digest ||
      run.model !== campaign.model
    )
      throw new EvolutionArtifactIntegrityError(`comparison run slot ${key} differs from the frozen Campaign runtime`)
    runs.set(key, run)
    runLocators.set(key, located.locator)
  }
  return { evaluations, evaluationLocators, reviews, runs, runLocators }
}

/**
 * Which dimensions no evidence supports. `requiredUnavailable` is the subset
 * that blocks a verdict outright; both are returned so the caller does not
 * have to re-derive one from the other.
 */
function classifyComparisonAvailability(input: {
  campaign: Campaign
  expectedSlots: readonly ExpectedSlot[]
  evidence: IndexedComparisonEvidence
}): { unavailable: Set<string>; requiredUnavailable: Set<string> } {
  const { campaign, expectedSlots } = input
  const { evaluations, reviews, runs, runLocators } = input.evidence

  const unavailable = new Set<string>()
  const requiredUnavailable = new Set<string>()
  for (const slot of expectedSlots) {
    const evaluation = evaluations.get(slot.key)
    const run = runs.get(slot.key)
    if (evaluation && run && evaluation.trial_task_id !== run.task_id)
      throw new EvolutionArtifactIntegrityError(`comparison slot ${slot.key} run and evaluation Task identities differ`)
    if (evaluation && run && !sameLocator(evaluation.run_evidence_locator, runLocators.get(slot.key)!))
      throw new EvolutionArtifactIntegrityError(`comparison slot ${slot.key} metric receipt and run Artifact differ`)
    if (!evaluation) requiredUnavailable.add(`evaluation:${slot.key}`)
    if (!run) requiredUnavailable.add(`run:${slot.key}`)
    const review = reviews.get(slot.key)
    if (!review || review.status === "unavailable") requiredUnavailable.add(`integrity_review:${slot.key}`)
    for (const scorer of campaign.scorers) {
      const result = evaluation?.scorers.find((item) => item.scorer_id === scorer.scorer_id)
      if (!result || result.status === "unavailable") requiredUnavailable.add(`scorer:${scorer.scorer_id}:${slot.key}`)
    }
  }
  for (const dimension of requiredUnavailable) unavailable.add(dimension)
  return { unavailable, requiredUnavailable }
}

export function deriveComparisonRecommendation(input: {
  campaign: Campaign
  campaignLocator: ArtifactLocator
  candidate: Candidate
  candidateLocator: ArtifactLocator
  evaluations: readonly Located<Evaluation>[]
  reviews: readonly Located<Review>[]
  runs: readonly Located<RunEvidence>[]
}): Comparison {
  const { campaign, candidate } = input
  if (!exactRevisionIdentity(campaign.baseline_revision, candidate.parent_revision))
    throw new EvolutionArtifactIntegrityError("comparison candidate parent must equal the frozen campaign baseline")
  if (
    campaign.target.namespace !== candidate.candidate_revision.namespace ||
    campaign.target.id !== candidate.candidate_revision.id
  )
    throw new EvolutionArtifactIntegrityError("comparison candidate identity must equal the frozen campaign target")

  const expectedSlots = campaign.cases.flatMap((caseID) =>
    Array.from({ length: campaign.repetitions }, (_, repetition) =>
      (["baseline", "candidate"] as const).map((arm) => ({ caseID, arm, repetition, key: slotKey(caseID, arm, repetition) })),
    ).flat(),
  )
  const expectedSlotKeys = new Set(expectedSlots.map((slot) => slot.key))
  const expectedScorerIDs = campaign.scorers.map((scorer) => scorer.scorer_id).toSorted()
  const {
    evaluations,
    evaluationLocators,
    reviews,
    runs,
    runLocators,
  } = indexComparisonEvidence({
    campaign,
    candidate,
    campaignLocator: input.campaignLocator,
    candidateLocator: input.candidateLocator,
    evaluations: input.evaluations,
    reviews: input.reviews,
    runs: input.runs,
    expectedSlotKeys,
    expectedScorerIDs,
  })
  const { unavailable, requiredUnavailable } = classifyComparisonAvailability({
    campaign,
    expectedSlots,
    evidence: { evaluations, evaluationLocators, reviews, runs, runLocators },
  })

  const pairedDeltas = campaign.scorers.flatMap((scorer) => {
    const deltas = campaign.cases.flatMap((caseID) =>
      Array.from({ length: campaign.repetitions }, (_, repetition) => {
        const baseline = evaluations
          .get(slotKey(caseID, "baseline", repetition))
          ?.scorers.find((result) => result.scorer_id === scorer.scorer_id)
        const candidateResult = evaluations
          .get(slotKey(caseID, "candidate", repetition))
          ?.scorers.find((result) => result.scorer_id === scorer.scorer_id)
        if (baseline?.status !== "measured" || candidateResult?.status !== "measured") return undefined
        return candidateResult.value - baseline.value
      }).filter((value): value is number => value !== undefined),
    )
    if (deltas.length === 0) return []
    const interval = pairedInterval(deltas)
    // A single repetition supports no interval at all. Publishing a zero-width
    // one would claim certainty the sample cannot support, so the interval
    // collapses to the point estimate and `halfWidth === undefined` propagates
    // into the aggregate, which then reports low confidence.
    const halfWidth = interval.halfWidth ?? 0
    const directional = deltas.map((delta) => (scorer.direction === "higher_better" ? delta : -delta))
    return [{
      scorer_id: scorer.scorer_id,
      mean: interval.mean,
      median: median(deltas),
      variance: interval.variance,
      confidence_interval: {
        confidence: INTERVAL_CONFIDENCE,
        lower: interval.mean - halfWidth,
        upper: interval.mean + halfWidth,
      },
      standardErrorKnown: interval.halfWidth !== undefined,
      win_tie_loss: {
        wins: directional.filter((value) => value > 0).length,
        ties: directional.filter((value) => value === 0).length,
        losses: directional.filter((value) => value < 0).length,
      },
    }]
  })

  const completeRuns = expectedSlots.map((slot) => runs.get(slot.key)).filter((run): run is RunEvidence => Boolean(run))
  const runCountsComplete = completeRuns.length === expectedSlots.length
  const costDelta = runCountsComplete
    ? averageByArm(completeRuns, "candidate", "cost") - averageByArm(completeRuns, "baseline", "cost")
    : null
  const tokenDelta = runCountsComplete
    ? averageByArm(completeRuns, "candidate", "token_usage") - averageByArm(completeRuns, "baseline", "token_usage")
    : null
  const activityComplete = runCountsComplete && completeRuns.every((run) => run.activity_duration_ms !== null)
  const activityDurationDelta = activityComplete
    ? mean(completeRuns.filter((run) => run.arm === "candidate").map((run) => run.activity_duration_ms!)) -
      mean(completeRuns.filter((run) => run.arm === "baseline").map((run) => run.activity_duration_ms!))
    : null
  if (costDelta === null) unavailable.add("cost_delta")
  if (tokenDelta === null) unavailable.add("token_delta")
  if (activityDurationDelta === null) unavailable.add("activity_duration_ms_delta")

  const outcomeRate = (arm: "baseline" | "candidate") => {
    const expected = expectedSlots.filter((slot) => slot.arm === arm)
    const values = expected.map((slot) => runs.get(slot.key)?.outcome ?? "unavailable")
    return {
      failure: values.filter((outcome) => outcome === "failure").length / expected.length,
      unavailable: values.filter((outcome) => outcome === "unavailable").length / expected.length,
    }
  }
  const outcomeRates = { baseline: outcomeRate("baseline"), candidate: outcomeRate("candidate") }

  // Each scorer's mean delta and its interval half-width, both divided by the
  // scorer's own declared target-to-floor range so scorers on different scales
  // become comparable and every threshold below is a fraction of a range the
  // campaign itself declared rather than a bare number.
  const directionalMeans = campaign.scorers.flatMap((scorer) => {
    const delta = pairedDeltas.find((item) => item.scorer_id === scorer.scorer_id)
    if (!delta) return []
    const range = Math.abs(scorer.target - scorer.floor)
    if (range === 0 || scorer.weight === 0) return []
    return [{
      scorer_id: scorer.scorer_id,
      value: (scorer.direction === "higher_better" ? delta.mean : -delta.mean) / range,
      halfWidth: delta.standardErrorKnown
        ? (delta.confidence_interval.upper - delta.confidence_interval.lower) / 2 / range
        : undefined,
      weight: scorer.weight,
    }]
  })
  if (directionalMeans.length !== campaign.scorers.filter((scorer) => scorer.weight > 0).length)
    requiredUnavailable.add("aggregate_score")
  for (const dimension of requiredUnavailable) unavailable.add(dimension)
  const weight = directionalMeans.reduce((sum, item) => sum + item.weight, 0)
  const aggregateScore = requiredUnavailable.size === 0 && weight > 0
    ? directionalMeans.reduce((sum, item) => sum + item.value * item.weight, 0) / weight
    : null
  // Uncertainty of the weighted mean, combining the per-scorer half-widths in
  // quadrature under the campaign's own weights. Scorers measure different
  // properties of the same runs, so independence is an approximation, and
  // combining t-intervals of differing degrees of freedom is another; both are
  // stated here rather than hidden behind a number. Unknown for any scorer
  // measured once, and that unknown propagates instead of being filled in.
  const aggregateHalfWidth =
    aggregateScore !== null && directionalMeans.every((item) => item.halfWidth !== undefined)
      ? Math.sqrt(
          directionalMeans.reduce((sum, item) => sum + ((item.weight / weight) * item.halfWidth!) ** 2, 0),
        )
      : undefined
  const aggregateInterval =
    aggregateScore !== null && aggregateHalfWidth !== undefined
      ? {
          confidence: INTERVAL_CONFIDENCE,
          lower: aggregateScore - aggregateHalfWidth,
          upper: aggregateScore + aggregateHalfWidth,
        }
      : null
  // A regression is a scorer whose whole interval sits below zero. Testing the
  // point estimate instead made every added scorer another independent chance
  // for noise to veto a promotion, so the rule grew stricter as the campaign
  // measured more — the opposite of what more evidence should do.
  const regressions = directionalMeans
    .filter((item) => item.halfWidth !== undefined && item.value + item.halfWidth < 0)
    .map((item) => item.scorer_id)
    .toSorted()
  // Confidence reports the width of the interval just computed, as a fraction
  // of a scorer range. The previous revision derived it from the sample count
  // alone, so it stayed "high" on five wildly inconsistent repetitions and the
  // variance it had already measured never reached the reader.
  const confidence =
    requiredUnavailable.size > 0 || aggregateHalfWidth === undefined
      ? "low"
      : aggregateHalfWidth <= AGGREGATE_HIGH_CONFIDENCE_HALF_WIDTH
        ? "high"
        : aggregateHalfWidth <= AGGREGATE_MEDIUM_CONFIDENCE_HALF_WIDTH
          ? "medium"
          : "low"
  const reviewedSlots = expectedSlots.flatMap((slot) => {
    const review = reviews.get(slot.key)
    return review?.status === "reviewed" ? [review] : []
  })
  const derivedUnknowns = [...new Set(reviewedSlots.flatMap((review) => [
    ...review.unknowns,
    ...review.accepted_limitations,
  ]))].toSorted()
  const rewardFindings = reviewedSlots.flatMap((review) =>
    review.findings.filter((finding) => finding.category === "reward_hacking" && finding.outcome === "failed"),
  )
  const rewardHackingReview = {
    findings: [...new Set(rewardFindings.map((finding) => finding.invariant))].toSorted(),
    evidence: exactEvidence(rewardFindings.flatMap((finding) => finding.evidence)),
  }
  const visualScorerIDs = new Set(
    campaign.scorers
      .filter(
        (scorer) =>
          scorer.evaluator_kind === "prebuilt" &&
          scorer.evaluator_config.name === VISUAL_FEEDBACK_VERIFICATION_SCORER_NAME,
      )
      .map((scorer) => scorer.scorer_id),
  )
  const visualResults = expectedSlots.flatMap((slot) =>
    evaluations.get(slot.key)?.scorers.filter((result) => visualScorerIDs.has(result.scorer_id)) ?? [],
  )
  const visualExpectedCount = expectedSlots.length * visualScorerIDs.size
  // Whether visual review applies is decided by the Campaign's visual scorers,
  // not by `ui_rubric_digest`. That field is the digest of the first `judge`
  // scorer's resource, so keying the gate on it opened the door with one key
  // and demanded another to walk through: a Campaign declaring a `judge`
  // scorer for code quality and no visual scorer left `visualScorerIDs` empty,
  // took the `unavailable` branch, and was pinned to `inconclusive` forever.
  // It failed open in the mirror case too — a Campaign with visual scorers but
  // no `judge` scorer had a null digest, so unavailable visual results skipped
  // the gate entirely and could not block a promote.
  const visualReview =
    visualScorerIDs.size === 0
      ? { status: "not_applicable" as const, evidence: [] }
      : visualResults.length !== visualExpectedCount ||
          visualResults.some((result) => result.status === "unavailable")
        ? { status: "unavailable" as const, evidence: exactEvidence(visualResults.flatMap((result) => result.evidence)) }
        : { status: "reviewed" as const, evidence: exactEvidence(visualResults.flatMap((result) => result.evidence)) }
  // Promotion needs the whole aggregate interval above zero, not just its
  // midpoint. Requiring `aggregateScore > 0` while separately vetoing any
  // negative point estimate made the declared `scorer.weight` values inert:
  // "no scorer below zero" already implies a non-negative weighted mean, so
  // the relative weights could be rewritten arbitrarily without changing a
  // single recommendation. Deciding on the interval restores them — the
  // weights set both the aggregate and the width of its uncertainty.
  const recommendation =
    requiredUnavailable.size > 0 ||
    visualReview.status === "unavailable" ||
    rewardHackingReview.findings.length > 0
      ? "inconclusive"
      : aggregateInterval !== null &&
          aggregateInterval.lower > 0 &&
          regressions.length === 0 &&
          outcomeRates.candidate.failure <= outcomeRates.baseline.failure
        ? "promote"
        : "retain"

  return EvolutionArtifactSchemas["evolution-lab/comparison-recommendation"].parse({
    baseline_revision: campaign.baseline_revision,
    candidate_revision: candidate.candidate_revision,
    paired_deltas: pairedDeltas.map(({ standardErrorKnown: _standardErrorKnown, ...delta }) => delta),
    cost_delta: costDelta,
    token_delta: tokenDelta,
    activity_duration_ms_delta: activityDurationDelta,
    outcome_rates: outcomeRates,
    aggregate_score: aggregateScore,
    aggregate_interval: aggregateInterval,
    regressions,
    unavailable_dimensions: [...unavailable].toSorted(),
    required_unavailable_dimensions: [...requiredUnavailable].toSorted(),
    unknowns: derivedUnknowns,
    visual_review: visualReview,
    reward_hacking_review: rewardHackingReview,
    confidence,
    recommendation,
  })
}
