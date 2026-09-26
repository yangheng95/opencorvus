import { EvolutionArtifactSchemas } from "./expert-squad-evolution-artifact.js"
import { artifactReadLocatorKey, type ArtifactReadLocator, type EngineArtifactEnvelope } from "./artifact-catalog.js"
import { canonicalEvolutionJSON } from "./expert-squad-evolution.js"

type LocatedMeasurement = {
  locator: ArtifactReadLocator
  value: { case_id: string; arm: "baseline" | "candidate"; repetition: number }
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
