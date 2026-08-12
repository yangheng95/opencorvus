import { Database, eq, sql } from "@/storage/db"
import { Log } from "@/util/log"
import { MemoryFileTable } from "./memory.sql"
import type { MemoryKind, MemorySearchResult, MemorySource } from "./types"

export namespace MemorySearch {
  const log = Log.create({ service: "memory.search" })

  const HALF_LIFE_DAYS = 30
  const LAMBDA = Math.LN2 / HALF_LIFE_DAYS
  const KIND_WEIGHT: Record<MemoryKind, number> = {
    profile: 1.45,
    lesson: 1.25,
    fact: 1.1,
    note: 0.95,
    episode: 0.8,
    user_message: 0,
    project_context: 0,
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
    const kindFilter =
      input.kinds && input.kinds.length > 0
        ? sql`AND mf.kind IN (${sql.join(
            input.kinds.map((kind) => sql`${kind}`),
            sql`, `,
          )})`
        : sql`AND mf.kind <> 'user_message'`
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

    const results: MemorySearchResult[] = []
    for (const row of rows) {
      let score = bm25RankToScore(row.rank)
      score *= KIND_WEIGHT[row.kind]
      score *= 0.8 + clampScore(row.importance, 60) / 200
      score *= 0.85 + clampScore(row.confidence, 75) / 250
      if (input.temporalDecay) {
        const ageDays = (nowMs - row.time_created) / (1000 * 60 * 60 * 24)
        score *= Math.exp(-LAMBDA * ageDays)
      }
      if (score < minScore) continue

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

    const final = results.sort(compareResults).slice(0, limit)
    log.info("full-text search", {
      query: input.query,
      projectId: input.projectId,
      kinds: input.kinds?.join(","),
      found: final.length,
      candidates: rows.length,
    })
    return final
  }

  function compareResults(a: MemorySearchResult, b: MemorySearchResult) {
    if (a.kind !== b.kind) return KIND_WEIGHT[b.kind] - KIND_WEIGHT[a.kind]
    if (Math.abs(b.score - a.score) > 0.001) return b.score - a.score
    return b.timeCreated - a.timeCreated
  }

  function clampScore(value: number | undefined, defaultValue: number) {
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
