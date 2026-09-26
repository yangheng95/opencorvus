import {
  artifactReadLocatorKey,
  engineArtifactSourceChain,
  type ArtifactReadLocator,
  type EngineArtifactEnvelope,
} from "./artifact-catalog.js"
import { canonicalEvolutionJSON } from "./expert-squad-evolution.js"

export type EvolutionReferenceArtifact = { locator: ArtifactReadLocator; envelope: EngineArtifactEnvelope }

/** The oldest known facts transported here; missing history stays unknown. No source-Task read. */
export function evolutionArtifactProvenance(envelope: EngineArtifactEnvelope) {
  const source = envelope.producer.owner_kind === "mission" ? engineArtifactSourceChain(envelope).at(-1) : undefined
  return source
    ? { producer: source.source_producer, sources: source.source_provenance.source_artifact_locators }
    : { producer: envelope.producer, sources: envelope.source_artifact_locators }
}

export class EvolutionArtifactReferenceError extends Error {
  override readonly name = "EvolutionArtifactReferenceError"
  constructor(readonly code: "conflicting_identity" | "missing_source", readonly locator: ArtifactReadLocator) {
    super(`Evolution Artifact reference ${code}: ${artifactReadLocatorKey(locator)}`)
  }
}

/** One caller-owned Task and frozen catalog. Only an exact import chain proves
 * identity: equal values, timestamps, labels or ordinary citations do not.
 * Local publication identities and immutable payloads stay intact.
 */
export function createEvolutionArtifactReferences<T extends EvolutionReferenceArtifact>(artifacts: readonly T[]) {
  const parent = new Map<string, string>()
  function key(locator: ArtifactReadLocator) {
    return root(artifactReadLocatorKey(locator))
  }
  function root(value: string): string {
    const traversed: string[] = []
    let result = value
    for (;;) {
      const next = parent.get(result)
      if (next === undefined || next === result) break
      traversed.push(result)
      result = next
    }
    for (const identity of traversed) parent.set(identity, result)
    return result
  }
  for (const artifact of artifacts) {
    const origins = artifact.envelope.producer.owner_kind === "mission"
      ? engineArtifactSourceChain(artifact.envelope).map((source) => source.source_locator)
      : []
    for (const origin of origins) {
      if (origin.source !== "engine_artifact") continue
      const left = key(artifact.locator)
      const right = key(origin)
      // Stable representatives of proven identities, not selection among values.
      parent.set(left < right ? right : left, left < right ? left : right)
    }
  }
  const groups = new Map<string, Map<string, T>>()
  const facts = new Map<string, string>()
  for (const artifact of artifacts) {
    const identity = key(artifact.locator)
    const fact = canonicalEvolutionJSON({
      artifact_type: artifact.envelope.artifact_type,
      schema_version: artifact.envelope.schema_version,
      payload: artifact.envelope.payload,
    })
    if (facts.has(identity) && facts.get(identity) !== fact)
      throw new EvolutionArtifactReferenceError("conflicting_identity", artifact.locator)
    facts.set(identity, fact)
    let group = groups.get(identity)
    if (!group) groups.set(identity, (group = new Map()))
    group.set(artifactReadLocatorKey(artifact.locator), artifact)
  }
  function resolve(locator: ArtifactReadLocator): T[] {
    const group = groups.get(key(locator))
    const exact = artifactReadLocatorKey(locator)
    return group ? [...group.keys()].sort((left, right) =>
      left === right ? 0 : left === exact ? -1 : right === exact ? 1 : left < right ? -1 : 1,
    ).map((identity) => group.get(identity)!) : []
  }
  return {
    key,
    same: (left: ArtifactReadLocator, right: ArtifactReadLocator) => key(left) === key(right),
    resolve,
    require(locator: ArtifactReadLocator) {
      const matches = resolve(locator)
      if (matches.length === 0) throw new EvolutionArtifactReferenceError("missing_source", locator)
      return matches
    },
  }
}

export type EvolutionArtifactReferences = ReturnType<typeof createEvolutionArtifactReferences>
