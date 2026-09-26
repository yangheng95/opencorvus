import { artifactReadLocatorKey, type ArtifactReadLocator, type EngineArtifactEnvelope } from "./artifact-catalog.js"
import { canonicalEvolutionJSON } from "./expert-squad-evolution.js"

type LocatedMeasurement = {
  locator: ArtifactReadLocator
  value: { case_id: string; arm: "baseline" | "candidate"; repetition: number }
}

/** Group publication aliases of exactly the same measured fact. Callers parse
 * the full typed payload first. Different receipts, values, Trials or recorded
 * usage remain separate observations even when their Campaign slot is equal.
 * No observation is superseded by its timestamp or by a more favorable value.
 */
export function groupEvolutionMeasurements<T extends LocatedMeasurement>(artifacts: readonly T[]): Map<string, T[][]> {
  const slots = new Map<string, Map<string, Map<string, T>>>()
  for (const artifact of artifacts) {
    const { case_id, arm, repetition } = artifact.value
    const slot = `${case_id}:${arm}:${repetition}`
    let observations = slots.get(slot)
    if (!observations) slots.set(slot, (observations = new Map()))
    const fact = canonicalEvolutionJSON(artifact.value)
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
 * receipt or Trial, and does not claim completeness of unselected measurements.
 */
export function expandEvolutionMeasurementAliases<T extends MeasurementPublication>(
  selected: readonly T[],
  catalog: readonly T[],
): T[] {
  const key = (artifact: T) => {
    const type = artifact.envelope.artifact_type
    return type === "evolution-lab/run-evidence-bundle" || type === "evolution-lab/evaluation-result"
      ? `${type}\0${canonicalEvolutionJSON(artifact.envelope.payload)}`
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
