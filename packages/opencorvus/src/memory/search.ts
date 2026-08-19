import { Database, eq, sql } from "@/storage/db"
import { Log } from "@/util/log"
import { MemoryFileTable } from "./memory.sql"
import type { HostOwnedMemoryKind, MemoryKind, MemorySearchResult, MemorySource } from "./types"

export namespace MemorySearch {
  const log = Log.create({ service: "memory.search" })

  const HALF_LIFE_DAYS = 30
  const LAMBDA = Math.LN2 / HALF_LIFE_DAYS

  /**
   * Host-owned kinds are per-project singleton documents addressed by
   * deterministic identity, and their chunk content is a JSON envelope rather
   * than prose. They are not relevance-search results at all, so they are
   * absent from this map instead of carrying a zero weight: a zero weight let
   * them match full-text, consume candidate slots, and then vanish below
   * `minScore`, which reads as "indexed but unsearchable".
   *
   * Every other `MemoryKind` must appear here. `Partial<Record<...>>` was the
   * previous constraint, so a kind added to the union and forgotten here fell
   * out of `SEARCHABLE_KINDS` with nothing to say so — written, indexed, and
   * unfindable, which is the defect `HOST_OWNED_MEMORY_KINDS` was introduced
   * to end and which this map was never actually joined to.
   */
  const KIND_WEIGHT = {
    profile: 1.45,
    lesson: 1.25,
    fact: 1.1,
    note: 0.95,
    episode: 0.8,
  } as const satisfies Record<SearchableMemoryKind, number>

  type SearchableMemoryKind = Exclude<MemoryKind, HostOwnedMemoryKind>

  const SEARCHABLE_KINDS = Object.keys(KIND_WEIGHT) as SearchableMemoryKind[]

  function isSearchableKind(kind: MemoryKind): kind is SearchableMemoryKind {
    return kind in KIND_WEIGHT
  }

  function projectHasMemory(projectId: string): boolean {
    const row = Database.use((db) =>
      db
        .select({ id: MemoryFileTable.id })
        .from(MemoryFileTable)
        .where(eq(MemoryFileTable.project_id, projectId))
        .limit(1)
        .get(),
    )
    return row !== undefined
  }

  export function search(input: {
    query: string
    projectId: string
    limit?: number
    minScore?: number
    temporalDecay?: boolean
    kinds?: MemoryKind[]
    sources?: MemorySource[]
  }) {
    const limit = input.limit ?? 6
    const minScore = input.minScore ?? 0.1

    // Argument validation precedes every data-dependent short circuit below:
    // an unsupported kind is a caller error whether or not this project has
    // any memory yet, and returning [] for it would be the same silent
    // "indexed but unsearchable" behaviour the zero weight used to produce.
    const requestedKinds = input.kinds && input.kinds.length > 0 ? input.kinds : undefined
    const unsearchable = requestedKinds?.filter((kind) => !isSearchableKind(kind)) ?? []
    if (unsearchable.length > 0) {
      throw new Error(
        `Memory search kinds must be relevance-searchable. expected one of: ${SEARCHABLE_KINDS.join(", ")}; ` +
          `received: ${unsearchable.join(", ")}`,
      )
    }
    const searchedKinds = requestedKinds ?? SEARCHABLE_KINDS

    const query = buildFtsQuery(input.query)
    if (!query) {
      log.info("empty search query after tokenization")
      return []
    }
    if (!projectHasMemory(input.projectId)) {
      log.info("memory empty for project — skipping full-text search pipeline", { projectId: input.projectId })
      return []
    }

    const nowMs = Date.now()
    const candidates = Math.min(200, limit * 6)
    const kindFilter = sql`AND mf.kind IN (${sql.join(
      searchedKinds.map((kind) => sql`${kind}`),
      sql`, `,
    )})`
    const sourceFilter =
      input.sources && input.sources.length > 0
        ? sql`AND mf.source IN (${sql.join(
            input.sources.map((source) => sql`${source}`),
            sql`, `,
          )})`
        : sql``
    const rows = Database.use((db) =>
      db.all<{
        chunk_id: string
        file_id: string
        title: string
        content: string
        source: MemorySource
        kind: MemoryKind
        key: string | null
        importance: number
        confidence: number
        time_created: number
        rank: number
      }>(sql`
        SELECT
          mc.id as chunk_id,
          mc.file_id,
          mf.title,
          mc.content,
          mf.source,
          mf.kind,
          mf.key,
          mf.importance,
          mf.confidence,
          mc.time_created,
          memory_fts.rank as rank
        FROM memory_fts
        JOIN memory_chunk mc ON mc.id = memory_fts.chunk_id
        JOIN memory_file mf ON mf.id = mc.file_id
        WHERE memory_fts MATCH ${query}
          AND memory_fts.project_id = ${input.projectId}
          ${kindFilter}
          ${sourceFilter}
        ORDER BY memory_fts.rank
        LIMIT ${candidates}
      `),
    )

    const final = rankCandidates(rows, { nowMs, temporalDecay: input.temporalDecay, minScore, limit })
    log.info("full-text search", {
      query: input.query,
      projectId: input.projectId,
      kinds: input.kinds?.join(","),
      found: final.length,
      candidates: rows.length,
    })
    return final
  }

  /**
   * Kind already multiplies into `score`; ranking by kind first as well made the
   * relevance score unable to affect any cross-kind ordering, so the weakest
   * `profile` hit outranked the strongest `fact` hit unconditionally.
   */
  function compareResults(a: MemorySearchResult, b: MemorySearchResult) {
    if (Math.abs(b.score - a.score) > 0.001) return b.score - a.score
    return b.timeCreated - a.timeCreated
  }

  /**
   * One scored candidate row as the full-text query returns it. Naming the
   * shape is what lets the ranking be exercised without a database.
   */
  export type ScoredCandidateRow = {
    chunk_id: string
    file_id: string
    title: string
    content: string
    source: MemorySource
    kind: MemoryKind
    key: string | null
    importance: number
    confidence: number
    time_created: number
    rank: number
  }

  /**
   * Rank, threshold and cut the candidate set. Extracted from the query
   * function it used to be welded into: this formula is the part with a
   * statistical right and wrong, and it could not be checked at all while
   * reaching it required an FTS5 index and a live database.
   */
  export function rankCandidates(
    rows: readonly ScoredCandidateRow[],
    input: { nowMs: number; temporalDecay?: boolean; minScore: number; limit: number },
  ): MemorySearchResult[] {
    const results: MemorySearchResult[] = []
    for (const row of rows) {
      // The kind filter in the query already restricts the candidate set; this
      // narrows the row type rather than re-deciding what is searchable.
      if (!isSearchableKind(row.kind)) continue
      let score = bm25RankToScore(row.rank)
      score *= KIND_WEIGHT[row.kind]
      score *= 0.8 + clampScore(row.importance, 60) / 200
      score *= 0.85 + clampScore(row.confidence, 75) / 250
      if (input.temporalDecay) {
        const ageDays = (input.nowMs - row.time_created) / (1000 * 60 * 60 * 24)
        score *= Math.exp(-LAMBDA * ageDays)
      }
      if (score < input.minScore) continue

      results.push({
        chunkId: row.chunk_id,
        fileId: row.file_id,
        fileTitle: row.title,
        content: row.content,
        scope: "project",
        source: row.source,
        kind: row.kind,
        key: row.key ?? undefined,
        importance: clampScore(row.importance, 60),
        confidence: clampScore(row.confidence, 75),
        score,
        timeCreated: row.time_created,
      })
    }
    return results.sort(compareResults).slice(0, input.limit)
  }

  /**
   * The single 0..100 metric normalizer for stored memory rows. `index.ts`
   * held a byte-identical copy; two normalizers for one stored range can only
   * ever drift apart.
   */
  export function clampScore(value: number | undefined, defaultValue: number) {
    if (typeof value !== "number" || Number.isNaN(value)) return defaultValue
    return Math.max(0, Math.min(100, Math.round(value)))
  }

  function bm25RankToScore(rank: number) {
    const value = Math.abs(rank)
    return 1 / (1 + Math.exp(-(value - 1) * 1.5))
  }

  function buildFtsQuery(raw: string) {
    const tokens = raw.match(/[\p{L}\p{N}_]+/gu)
    if (!tokens || tokens.length === 0) return ""
    return tokens.map((token) => `"${token}"`).join(" ")
  }
}
