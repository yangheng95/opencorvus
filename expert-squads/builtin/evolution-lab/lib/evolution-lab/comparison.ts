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

function variance(values: readonly number[], average: number) {
  return mean(values.map((value) => (value - average) ** 2))
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
    const average = mean(deltas)
    const populationVariance = variance(deltas, average)
    const standardError = Math.sqrt(populationVariance / deltas.length)
    const directional = deltas.map((delta) => (scorer.direction === "higher_better" ? delta : -delta))
    return [{
      scorer_id: scorer.scorer_id,
      mean: average,
      median: median(deltas),
      variance: populationVariance,
      confidence_interval: {
        confidence: 0.95,
        lower: average - 1.96 * standardError,
        upper: average + 1.96 * standardError,
      },
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

  const directionalMeans = campaign.scorers.flatMap((scorer) => {
    const delta = pairedDeltas.find((item) => item.scorer_id === scorer.scorer_id)
    if (!delta) return []
    const range = Math.abs(scorer.target - scorer.floor)
    if (range === 0 || scorer.weight === 0) return []
    return [{
      scorer_id: scorer.scorer_id,
      value: (scorer.direction === "higher_better" ? delta.mean : -delta.mean) / range,
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
  const regressions = directionalMeans.filter((item) => item.value < 0).map((item) => item.scorer_id).toSorted()
  const pairedCount = campaign.cases.length * campaign.repetitions
  const confidence = requiredUnavailable.size > 0 ? "low" : pairedCount >= 5 ? "high" : "medium"
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
          scorer.evaluator_kind === "prebuilt" && scorer.evaluator_config.name === "visual-feedback-verification",
      )
      .map((scorer) => scorer.scorer_id),
  )
  const visualResults = expectedSlots.flatMap((slot) =>
    evaluations.get(slot.key)?.scorers.filter((result) => visualScorerIDs.has(result.scorer_id)) ?? [],
  )
  const visualExpectedCount = expectedSlots.length * visualScorerIDs.size
  const visualReview = campaign.ui_rubric_digest === null
    ? { status: "not_applicable" as const, evidence: [] }
    : visualScorerIDs.size === 0 ||
        visualResults.length !== visualExpectedCount ||
        visualResults.some((result) => result.status === "unavailable")
      ? { status: "unavailable" as const, evidence: exactEvidence(visualResults.flatMap((result) => result.evidence)) }
      : { status: "reviewed" as const, evidence: exactEvidence(visualResults.flatMap((result) => result.evidence)) }
  const recommendation =
    requiredUnavailable.size > 0 ||
    visualReview.status === "unavailable" ||
    rewardHackingReview.findings.length > 0
      ? "inconclusive"
      : aggregateScore !== null &&
          aggregateScore > 0 &&
          regressions.length === 0 &&
          outcomeRates.candidate.failure <= outcomeRates.baseline.failure
        ? "promote"
        : "retain"

  return EvolutionArtifactSchemas["evolution-lab/comparison-recommendation"].parse({
    baseline_revision: campaign.baseline_revision,
    candidate_revision: candidate.candidate_revision,
    paired_deltas: pairedDeltas,
    cost_delta: costDelta,
    token_delta: tokenDelta,
    activity_duration_ms_delta: activityDurationDelta,
    outcome_rates: outcomeRates,
    aggregate_score: aggregateScore,
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
