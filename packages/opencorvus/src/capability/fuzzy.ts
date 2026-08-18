import fuzzysort from "fuzzysort"
import { SEPARATORLESS_FILLER_CHARACTERS, SEPARATORLESS_FILLER_SCRIPT } from "./discovery-filler"

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

// Han, Kana, and Hangul requests arrive without word separators, so token coverage cannot see their
// terms, and Dice's coefficient collapses toward zero as soon as a short request meets a long
// candidate. Shared character runs are the term evidence those scripts do carry, and a longer run is
// a stronger term: four shared characters is a domain phrase, two is a single ordinary word.
const SEPARATORLESS_SCRIPT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u
const SEPARATORLESS_RUN_SCORES = [0, 0, 0.15, 0.46, 0.72, 0.86, 0.94] as const
const SEPARATORLESS_MAX_RUN = SEPARATORLESS_RUN_SCORES.length - 1

// The filler table lives in `discovery-filler.ts`: it is language data, not part of this scoring
// algorithm, and extending it should not mean editing a scoring function.
const SEPARATORLESS_FILLER_SET = new Set([...SEPARATORLESS_FILLER_CHARACTERS])

function fillerCharacter(character: string): boolean {
  return SEPARATORLESS_FILLER_SET.has(character) || SEPARATORLESS_FILLER_SCRIPT.test(character)
}

// A run is dropped only when every one of its characters is filler, which keeps compounds such as
// "个人" or "有效" intact.
function contentRun(run: string): boolean {
  if (!SEPARATORLESS_SCRIPT.test(run)) return false
  for (const character of run) if (!fillerCharacter(character)) return true
  return false
}

/**
 * Character runs of the request, indexed by run length.
 *
 * Computed once per scoring call and threaded through the candidate loop. It used to be memoized in
 * a module-level pair of `let` bindings keyed by the last query string, which made this otherwise
 * pure module carry process state: two interleaved queries thrashed the single slot back to a full
 * recompute per candidate, and no caller could scope or reset it.
 */
type SeparatorlessRuns = Map<number, Set<string>>

/** Undefined when the request carries no separatorless script, so the candidate loop skips it. */
function separatorlessQueryRuns(query: string): SeparatorlessRuns | undefined {
  if (!SEPARATORLESS_SCRIPT.test(query)) return undefined
  const compacted = compact(query)
  const runs = new Map<number, Set<string>>()
  for (let length = 2; length <= SEPARATORLESS_MAX_RUN; length += 1) {
    const values = new Set<string>()
    for (let start = 0; start + length <= compacted.length; start += 1) {
      const run = compacted.slice(start, start + length)
      if (contentRun(run)) values.add(run)
    }
    if (values.size > 0) runs.set(length, values)
  }
  return runs
}

// Two characters is the ordinary word length in these scripts, so one short run is weak evidence while
// several distinct runs is strong: "合同" alone could be a coincidence, "商务" plus "合同" plus "审查"
// is the request's own vocabulary. Scoring takes the better of the longest run and the share of the
// request's own character pairs the candidate carries, which also keeps conversational filler from
// diluting a request the way whole-query coverage would.
const SEPARATORLESS_MINIMUM_PAIR_COVERAGE = 0.25

function longestRunAt(runs: SeparatorlessRuns, candidate: string, start: number): number {
  for (let length = SEPARATORLESS_MAX_RUN; length > 2; length -= 1) {
    if (start + length > candidate.length) continue
    if (runs.get(length)?.has(candidate.slice(start, start + length))) return length
  }
  return 2
}

function separatorlessScore(runs: SeparatorlessRuns | undefined, candidate: string): number {
  if (!runs) return 0
  const pairs = runs.get(2)
  if (!pairs || pairs.size === 0) return 0
  const compacted = compact(candidate)
  const matched = new Set<string>()
  let longest = 0
  for (let start = 0; start + 2 <= compacted.length; start += 1) {
    const pair = compacted.slice(start, start + 2)
    if (!pairs.has(pair)) continue
    matched.add(pair)
    longest = Math.max(longest, longestRunAt(runs, compacted, start))
  }
  const coverage = matched.size / pairs.size
  const coverageScore = coverage < SEPARATORLESS_MINIMUM_PAIR_COVERAGE ? 0 : Math.min(1, coverage * 1.6) * 0.85
  return Math.max(SEPARATORLESS_RUN_SCORES[longest] ?? 0, coverageScore)
}

function fuzzyScore(query: string, candidate: string): number {
  return fuzzysort.single(query, candidate)?.score ?? 0
}

function sharedPrefixLength(left: string, right: string): number {
  const limit = Math.min(left.length, right.length)
  let shared = 0
  while (shared < limit && left[shared] === right[shared]) shared += 1
  return shared
}

// A bare substring test makes "plan" a full hit inside "seasonal production planning", which ranks
// packages that merely share a generic word above the one whose own vocabulary is the request. Whole
// words count fully; a word this token prefixes, or an inflection sharing almost all of it, counts as
// partial evidence; everything else falls back to fuzzy matching.
const TOKEN_STEM_MINIMUM = 5

function tokenPresenceScore(token: string, words: readonly string[], candidate: string): number {
  if (words.includes(token)) return 1
  let best = 0
  for (const word of words) {
    if (token.length >= 4 && word.startsWith(token)) return 0.8
    const shared = sharedPrefixLength(token, word)
    if (shared >= TOKEN_STEM_MINIMUM && shared >= Math.min(token.length, word.length) - 3) best = Math.max(best, 0.7)
  }
  return Math.max(best, fuzzyScore(token, candidate))
}

function tokenCoverageScore(query: string, candidate: string): number {
  const tokens = query.split(" ").filter((token) => token.length >= 2)
  if (tokens.length < 2) return 0
  const words = candidate.split(" ")
  const scores = tokens.map((token) => tokenPresenceScore(token, words, candidate))
  return scores.reduce((sum, score) => sum + score, 0) / scores.length
}

function scoreField(query: string, runs: SeparatorlessRuns | undefined, rawCandidate: string): number {
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
    separatorlessScore(runs, candidate),
  )
}

/**
 * Scores one long document field, such as a concatenated Skill or prompt body.
 *
 * A document long enough mentions every common word of a request, so token evidence there says far
 * less about relevance than the same evidence in a name, a description, or a selector summary. The
 * request appearing as a phrase is real evidence and keeps its full score; scattered token presence
 * is kept only as a discovery tail that ranks below any identity match.
 */
const DOCUMENT_TOKEN_DAMPING = 0.75

export function scoreDocumentField(query: string, rawCandidate: string): number {
  const normalizedQuery = normalizeDiscoveryText(query)
  const candidate = normalizeDiscoveryText(rawCandidate)
  if (!normalizedQuery || !candidate) return 0
  if (candidate.includes(normalizedQuery)) return 0.98
  return Math.max(
    separatorlessScore(separatorlessQueryRuns(normalizedQuery), candidate),
    tokenCoverageScore(normalizedQuery, candidate) * DOCUMENT_TOKEN_DAMPING,
  )
}

export function scoreDiscoveryFields(query: string, fields: readonly DiscoverySearchField[]): number | undefined {
  const normalizedQuery = normalizeDiscoveryText(query)
  if (!normalizedQuery) return undefined
  const runs = separatorlessQueryRuns(normalizedQuery)
  let best = 0
  for (const field of fields) {
    if (!Number.isFinite(field.weight) || field.weight <= 0 || field.weight > 1) {
      throw new Error(`Discovery field weight must be greater than zero and at most one: ${field.weight}`)
    }
    best = Math.max(best, scoreField(normalizedQuery, runs, field.text) * field.weight)
  }
  if (best < MINIMUM_DISCOVERY_SCORE) return undefined
  return Number(best.toFixed(6))
}
