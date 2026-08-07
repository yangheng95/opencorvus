import fuzzysort from "fuzzysort"

export type DiscoverySearchField = {
  text: string
  weight: number
}

const MINIMUM_DISCOVERY_SCORE = 0.22

export function normalizeDiscoveryText(value: string): string {
  // NFKC means Unicode Normalization Form Compatibility Composition.
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ")
}

function compact(value: string): string {
  return value.replaceAll(" ", "")
}

function characterBigrams(value: string): Set<string> {
  const characters = [...compact(value)]
  const grams = new Set<string>()
  for (let index = 0; index < characters.length - 1; index += 1) {
    grams.add(`${characters[index]}${characters[index + 1]}`)
  }
  return grams
}

function bigramDiceCoefficient(left: string, right: string): number {
  const leftGrams = characterBigrams(left)
  const rightGrams = characterBigrams(right)
  if (leftGrams.size === 0 || rightGrams.size === 0) return 0
  let intersection = 0
  for (const gram of leftGrams) {
    if (rightGrams.has(gram)) intersection += 1
  }
  return (2 * intersection) / (leftGrams.size + rightGrams.size)
}

function fuzzyScore(query: string, candidate: string): number {
  return fuzzysort.single(query, candidate)?.score ?? 0
}

function tokenCoverageScore(query: string, candidate: string): number {
  const tokens = query.split(" ").filter((token) => token.length >= 2)
  if (tokens.length < 2) return 0
  const scores = tokens.map((token) => {
    if (candidate.includes(token)) return 1
    return fuzzyScore(token, candidate)
  })
  return scores.reduce((sum, score) => sum + score, 0) / scores.length
}

function scoreField(query: string, rawCandidate: string): number {
  const candidate = normalizeDiscoveryText(rawCandidate)
  if (!candidate) return 0
  if (candidate === query) return 1
  if (candidate.includes(query)) return 0.98
  if (compact(candidate).length >= 4 && query.includes(candidate)) {
    const coverage = compact(candidate).length / compact(query).length
    return 0.82 + Math.min(0.12, coverage * 0.12)
  }
  return Math.max(
    fuzzyScore(query, candidate),
    tokenCoverageScore(query, candidate) * 0.9,
    bigramDiceCoefficient(query, candidate) * 0.88,
  )
}

export function scoreDiscoveryFields(query: string, fields: readonly DiscoverySearchField[]): number | undefined {
  const normalizedQuery = normalizeDiscoveryText(query)
  if (!normalizedQuery) return undefined
  let best = 0
  for (const field of fields) {
    if (!Number.isFinite(field.weight) || field.weight <= 0 || field.weight > 1) {
      throw new Error(`Discovery field weight must be greater than zero and at most one: ${field.weight}`)
    }
    best = Math.max(best, scoreField(normalizedQuery, field.text) * field.weight)
  }
  if (best < MINIMUM_DISCOVERY_SCORE) return undefined
  return Number(best.toFixed(6))
}
