import { createHash } from "node:crypto"

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
  return entries.map((entry) => `${entry.namespace.length}:${entry.namespace}:${entry.id.length}:${entry.id}`).join("\n")
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
  return {
    activitySHA256: input.activitySHA256,
    deadlineMs: input.observedAtMs + input.inactivityWindowMs,
  }
}

export type EvolutionArtifactFact = {
  taskID: string
  artifactType: string
  locator: Record<string, unknown>
}

export type EvolutionEvidenceSummary = {
  counts: Record<string, number>
  recommendation: EvolutionArtifactFact
}

const REQUIRED_EVOLUTION_ARTIFACT_COUNTS: Readonly<Record<string, number>> = {
  "evolution-lab/opportunity": 1,
  "evolution-lab/failure-attribution": 1,
  "evolution-lab/campaign-spec": 1,
  "evolution-lab/candidate-revision": 1,
  "evolution-lab/run-evidence-bundle": 2,
  "evolution-lab/evaluation-result": 2,
  "evolution-lab/comparison-recommendation": 1,
}

export function summarizeEvolutionEvidence(facts: readonly EvolutionArtifactFact[]): EvolutionEvidenceSummary {
  const counts: Record<string, number> = {}
  for (const fact of facts) counts[fact.artifactType] = (counts[fact.artifactType] ?? 0) + 1
  const unavailable = Object.entries(REQUIRED_EVOLUTION_ARTIFACT_COUNTS).flatMap(([artifactType, required]) => {
    const observed = counts[artifactType] ?? 0
    return observed >= required ? [] : [`${artifactType}:${observed}/${required}`]
  })
  if (unavailable.length > 0) {
    throw new Error(`Evolution evidence graph is incomplete: ${unavailable.join(", ")}`)
  }
  const recommendation = facts.findLast(
    (fact) => fact.artifactType === "evolution-lab/comparison-recommendation",
  )!
  return { counts, recommendation }
}
