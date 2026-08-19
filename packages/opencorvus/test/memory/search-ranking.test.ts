import { expect, test } from "bun:test"
import { MemorySearch } from "../../src/memory/search"

/**
 * The ranking used to live inside the FTS5 query function, so none of it could
 * be checked without a live database and index. These cases exercise the
 * formula directly: they are the first assertions that touch the scoring math
 * itself rather than the query plumbing around it.
 */

const BASE: MemorySearch.ScoredCandidateRow = {
  chunk_id: "chunk-1",
  file_id: "file-1",
  title: "Title",
  content: "content",
  source: "user",
  kind: "fact",
  key: null,
  importance: 60,
  confidence: 75,
  time_created: 1_000_000,
  rank: -1,
}

function row(overrides: Partial<MemorySearch.ScoredCandidateRow>): MemorySearch.ScoredCandidateRow {
  return { ...BASE, ...overrides }
}

test("importance and confidence move the score monotonically", () => {
  const ranked = MemorySearch.rankCandidates(
    [
      row({ chunk_id: "low", importance: 0, confidence: 0 }),
      row({ chunk_id: "mid", importance: 50, confidence: 50 }),
      row({ chunk_id: "high", importance: 100, confidence: 100 }),
    ],
    { nowMs: BASE.time_created, minScore: 0, limit: 10 },
  )
  expect(ranked.map((item) => item.chunkId)).toEqual(["high", "mid", "low"])
  expect(ranked[0]!.score).toBeGreaterThan(ranked[1]!.score)
  expect(ranked[1]!.score).toBeGreaterThan(ranked[2]!.score)
})

test("out-of-range stored metrics fall back to the kind default instead of distorting the score", () => {
  const [defaulted] = MemorySearch.rankCandidates([row({ importance: Number.NaN, confidence: 10_000 })], {
    nowMs: BASE.time_created,
    minScore: 0,
    limit: 10,
  })
  expect(defaulted!.importance).toBe(60)
  expect(defaulted!.confidence).toBe(100)
})

test("temporal decay is opt-in and orders equal candidates by age", () => {
  const day = 24 * 60 * 60 * 1000
  const nowMs = BASE.time_created + 60 * day
  const candidates = [row({ chunk_id: "old" }), row({ chunk_id: "fresh", time_created: nowMs })]

  const undecayed = MemorySearch.rankCandidates(candidates, { nowMs, minScore: 0, limit: 10 })
  expect(undecayed[0]!.score).toBeCloseTo(undecayed[1]!.score, 10)

  const decayed = MemorySearch.rankCandidates(candidates, { nowMs, temporalDecay: true, minScore: 0, limit: 10 })
  expect(decayed.map((item) => item.chunkId)).toEqual(["fresh", "old"])
  // 60 days at a 30-day half-life is two half-lives.
  expect(decayed[1]!.score / decayed[0]!.score).toBeCloseTo(0.25, 6)
})

test("minScore drops candidates and limit cuts after ranking, not before", () => {
  const candidates = [
    row({ chunk_id: "a", importance: 100, confidence: 100 }),
    row({ chunk_id: "b", importance: 60, confidence: 75 }),
    row({ chunk_id: "c", importance: 0, confidence: 0 }),
  ]
  const all = MemorySearch.rankCandidates(candidates, { nowMs: BASE.time_created, minScore: 0, limit: 10 })
  expect(all).toHaveLength(3)

  const capped = MemorySearch.rankCandidates(candidates, { nowMs: BASE.time_created, minScore: 0, limit: 1 })
  expect(capped.map((item) => item.chunkId)).toEqual(["a"])

  const thresholded = MemorySearch.rankCandidates(candidates, {
    nowMs: BASE.time_created,
    minScore: all[0]!.score,
    limit: 10,
  })
  expect(thresholded.map((item) => item.chunkId)).toEqual(["a"])
})

test("non-searchable kinds never reach a score", () => {
  const ranked = MemorySearch.rankCandidates([row({ chunk_id: "singleton", kind: "project_context" })], {
    nowMs: BASE.time_created,
    minScore: 0,
    limit: 10,
  })
  expect(ranked).toEqual([])
})
