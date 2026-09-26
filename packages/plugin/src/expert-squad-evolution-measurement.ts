import { artifactReadLocatorKey, type ArtifactReadLocator } from "./artifact-catalog.js"
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
