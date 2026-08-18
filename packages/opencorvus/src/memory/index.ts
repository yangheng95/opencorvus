import { Token } from "@/util/token"
import { Database, and, desc, eq, sql } from "@/storage/db"
import { MemoryFileTable, MemoryChunkTable } from "./memory.sql"
import { Identifier } from "@/id/id"
import { Log } from "@/util/log"
import { MemorySearch } from "./search"
import { isHostOwnedMemoryKind } from "./types"
import type {
  MemoryChunk as MemoryChunkRecord,
  MemoryFile as MemoryFileRecord,
  MemoryKind,
  MemoryScope,
  MemorySearchResult,
  MemorySource,
} from "./types"
import { ProtectedProjectMemoryError } from "./project-memory"

export namespace Memory {
  const log = Log.create({ service: "memory" })
  const DEFAULT_IMPORTANCE: Record<Kind, number> = {
    profile: 95,
    lesson: 88,
    fact: 76,
    note: 60,
    episode: 52,
    user_message: 100,
    project_context: 100,
  }
  const DEFAULT_CONFIDENCE: Record<Kind, number> = {
    profile: 92,
    lesson: 85,
    fact: 80,
    note: 72,
    episode: 68,
    user_message: 100,
    project_context: 100,
  }

  export type Scope = MemoryScope
  export type Kind = MemoryKind
  export type Source = MemorySource
  export type MemoryFile = MemoryFileRecord
  export type MemoryChunk = MemoryChunkRecord
  export type SearchResult = MemorySearchResult

  function fromFile(row: typeof MemoryFileTable.$inferSelect): MemoryFile {
    return {
      id: row.id,
      projectId: row.project_id,
      scope: "project",
      title: row.title,
      source: row.source,
      kind: row.kind,
      key: row.key ?? undefined,
      importance: MemorySearch.clampScore(row.importance, DEFAULT_IMPORTANCE[row.kind]),
      confidence: MemorySearch.clampScore(row.confidence, DEFAULT_CONFIDENCE[row.kind]),
      timeCreated: row.time_created,
      timeUpdated: row.time_updated,
    }
  }


  function splitChunks(markdown: string, maxTokens = 400) {
    const sections = markdown.split(/^(?=## )/m)
    const chunks: string[] = []
    for (const section of sections) {
      const trimmed = section.trim()
      if (!trimmed) continue
      if (Token.estimate(trimmed) <= maxTokens) {
        chunks.push(trimmed)
        continue
      }
      const paragraphs = trimmed.split(/\n\n+/)
      let current = ""
      for (const para of paragraphs) {
        const next = current ? current + "\n\n" + para : para
        if (Token.estimate(next) > maxTokens && current) {
          chunks.push(current)
          current = para
          continue
        }
        current = next
      }
      if (current) chunks.push(current)
    }
    return chunks.length > 0 ? chunks : [markdown.trim()]
  }

  function ftsInsert(db: Database.TxOrDb, chunkId: string, projectId: string, content: string) {
    db.run(sql`INSERT INTO memory_fts (content, chunk_id, project_id) VALUES (${content}, ${chunkId}, ${projectId})`)
  }

  function ftsDeleteInProject(db: Database.TxOrDb, chunkId: string, projectId: string) {
    db.run(sql`DELETE FROM memory_fts WHERE chunk_id = ${chunkId} AND project_id = ${projectId}`)
  }

  function ftsDeleteByFileInProject(db: Database.TxOrDb, fileId: string, projectId: string) {
    try {
      const chunkIds = db
        .select({ id: MemoryChunkTable.id })
        .from(MemoryChunkTable)
        .where(and(eq(MemoryChunkTable.file_id, fileId), eq(MemoryChunkTable.project_id, projectId)))
        .all()
      for (const { id } of chunkIds) ftsDeleteInProject(db, id, projectId)
    } catch (err) {
      throw new Error(
        `FTS delete by file failed for ${fileId} in project ${projectId}: ${err instanceof Error ? err.message : String(err)}`,
        {
          cause: err,
        },
      )
    }
  }

  function normalizeKey(raw: string) {
    return raw
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120)
  }

  function compactText(raw: string, max = 240) {
    const text = raw
      .replace(/^\s*[-*]\s+/, "")
      .replace(/^\s*\d+\.\s+/, "")
      .replace(/\s+/g, " ")
      .trim()
    if (text.length <= max) return text
    return text.slice(0, max - 1).trimEnd() + "…"
  }

  function summarizeLine(raw: string, max = 84) {
    const text = compactText(raw, max)
    return text.replace(/[.:;,\s]+$/g, "")
  }

  type AtomicKind = "profile" | "lesson" | "fact"

  function buildAtomicTitle(kind: AtomicKind, raw: string) {
    const prefix = kind === "lesson" ? "Lesson" : kind === "profile" ? "Profile" : "Fact"
    return `${prefix}: ${summarizeLine(raw, 72)}`
  }

  function buildAtomicContent(input: { kind: AtomicKind; text: string; episodeTitle: string; section: string }) {
    return [
      input.kind === "lesson" ? "## Lesson" : input.kind === "profile" ? "## Profile" : "## Fact",
      input.text,
      "",
      `Source episode: ${input.episodeTitle}`,
      `Section: ${input.section}`,
    ].join("\n")
  }

  function queryVariants(raw: string) {
    const base = compactText(raw, 400)
    const tokens = [...new Set(base.match(/[\p{L}\p{N}_]+/gu)?.map((item) => item.toLowerCase()) ?? [])].filter(
      (item) => item.length > 2,
    )
    const variants = [base]
    if (tokens.length > 3) variants.push(tokens.slice(0, 4).join(" "))
    if (tokens.length > 1) variants.push(tokens.slice(0, 2).join(" "))
    if (tokens.length > 4) variants.push(tokens.slice(0, 6).join(" "))
    return [...new Set(variants.filter(Boolean))]
  }

  function findByKey(input: { projectId: string; kind: Kind; key: string }) {
    const row = Database.use((db) =>
      db
        .select()
        .from(MemoryFileTable)
        .where(
          and(
            eq(MemoryFileTable.project_id, input.projectId),
            eq(MemoryFileTable.kind, input.kind),
            eq(MemoryFileTable.key, input.key),
          ),
        )
        .get(),
    )
    if (!row) return null
    return fromFile(row)
  }

  function parseSections(markdown: string) {
    const lines = markdown.split(/\r?\n/)
    const sections: Array<{ title: string; body: string }> = []
    let title = "Overview"
    let body: string[] = []
    const push = () => {
      const text = body.join("\n").trim()
      if (text) sections.push({ title, body: text })
      body = []
    }
    for (const line of lines) {
      const match = line.match(/^##+\s+(.*)$/)
      if (match) {
        push()
        title = match[1].trim()
        continue
      }
      body.push(line)
    }
    push()
    return sections
  }

  function atomicConfidence(kind: AtomicKind) {
    if (kind === "profile") return 92
    if (kind === "lesson") return 86
    return 80
  }

  function shouldKeepAtomic(_section: string, raw: string) {
    const text = compactText(raw)
    if (text.length < 24) return false
    if (text.length > 260) return false
    return true
  }

  function deriveAtomicMemories(input: { title: string; content: string }) {
    const seen = new Set<string>()
    const sections = parseSections(input.content)
    const kind: AtomicKind = "fact"
    const importance = 80
    const items: Array<{
      title: string
      content: string
      kind: AtomicKind
      key: string
      importance: number
      confidence: number
    }> = []

    for (const section of sections) {
      const entries = section.body
        .split(/\n+/)
        .map((line) => compactText(line))
        .filter(Boolean)
      for (const entry of entries) {
        if (!shouldKeepAtomic(section.title, entry)) continue
        const key = normalizeKey(`${kind}-${entry}`)
        if (!key || seen.has(key)) continue
        seen.add(key)
        items.push({
          title: buildAtomicTitle(kind, entry),
          content: buildAtomicContent({
            kind,
            text: entry,
            episodeTitle: input.title,
            section: section.title,
          }),
          kind,
          key,
          importance,
          confidence: atomicConfidence(kind),
        })
      }
    }

    return items.slice(0, 8)
  }

  export function createFile(input: {
    title: string
    source: Source
    projectId: string
    kind?: Kind
    key?: string
    importance?: number
    confidence?: number
  }) {
    const kind = input.kind ?? "note"
    if (isHostOwnedMemoryKind(kind)) throw new Error(`${kind} memory is host-owned`)
    const key = input.key ? normalizeKey(input.key) : undefined
    const id = Identifier.ascending("memory")
    const now = Date.now()
    Database.use((db) =>
      db
        .insert(MemoryFileTable)
        .values({
          id,
          project_id: input.projectId,
          title: input.title,
          source: input.source,
          kind,
          key: key ?? null,
          importance: MemorySearch.clampScore(input.importance, DEFAULT_IMPORTANCE[kind]),
          confidence: MemorySearch.clampScore(input.confidence, DEFAULT_CONFIDENCE[kind]),
        })
        .run(),
    )
    log.info("created memory file", {
      id,
      title: input.title,
      source: input.source,
      kind,
      key,
    })
    return {
      id,
      projectId: input.projectId,
      scope: "project",
      title: input.title,
      source: input.source,
      kind,
      key,
      importance: MemorySearch.clampScore(input.importance, DEFAULT_IMPORTANCE[kind]),
      confidence: MemorySearch.clampScore(input.confidence, DEFAULT_CONFIDENCE[kind]),
      timeCreated: now,
      timeUpdated: now,
    } satisfies MemoryFile
  }

  function updateFile(input: {
    fileId: string
    projectId: string
    title: string
    source: Source
    kind: Kind
    key?: string
    importance?: number
    confidence?: number
  }) {
    if (isHostOwnedMemoryKind(input.kind)) throw new Error(`${input.kind} memory is host-owned`)
    const now = Date.now()
    Database.use((db) =>
      db
        .update(MemoryFileTable)
        .set({
          title: input.title,
          source: input.source,
          kind: input.kind,
          key: input.key ? normalizeKey(input.key) : null,
          importance: MemorySearch.clampScore(input.importance, DEFAULT_IMPORTANCE[input.kind]),
          confidence: MemorySearch.clampScore(input.confidence, DEFAULT_CONFIDENCE[input.kind]),
          time_updated: now,
        })
        .where(and(eq(MemoryFileTable.id, input.fileId), eq(MemoryFileTable.project_id, input.projectId)))
        .run(),
    )
    return getFileInProject({ fileId: input.fileId, projectId: input.projectId })
  }

  export function writeChunks(fileId: string, projectId: string, markdown: string) {
    const texts = splitChunks(markdown)
    const chunks: MemoryChunk[] = []
    const now = Date.now()

    Database.transaction((db) => {
      const file = db
        .select({ kind: MemoryFileTable.kind })
        .from(MemoryFileTable)
        .where(and(eq(MemoryFileTable.id, fileId), eq(MemoryFileTable.project_id, projectId)))
        .get()
      if (file && isHostOwnedMemoryKind(file.kind)) {
        throw new ProtectedProjectMemoryError({
          message: `Project memory ledger file ${fileId} is read-only`,
          code: "protected_project_memory",
          fileID: fileId,
        })
      }
      ftsDeleteByFileInProject(db, fileId, projectId)
      db.delete(MemoryChunkTable)
        .where(and(eq(MemoryChunkTable.file_id, fileId), eq(MemoryChunkTable.project_id, projectId)))
        .run()
      for (const text of texts) {
        const id = Identifier.ascending("memchunk")
        const tokenCount = Token.estimate(text)
        db.insert(MemoryChunkTable)
          .values({
            id,
            file_id: fileId,
            project_id: projectId,
            content: text,
            token_count: tokenCount,
          })
          .run()
        chunks.push({
          id,
          fileId,
          projectId,
          content: text,
          tokenCount,
          timeCreated: now,
          timeUpdated: now,
        })
        ftsInsert(db, id, projectId, text)
      }
      db.update(MemoryFileTable)
        .set({ time_updated: now })
        .where(and(eq(MemoryFileTable.id, fileId), eq(MemoryFileTable.project_id, projectId)))
        .run()
    })

    log.info("wrote memory chunks", { fileId, count: chunks.length })
    return chunks
  }

  export function writeFile(input: {
    title: string
    content: string
    source: Source
    projectId: string
    kind?: Kind
    key?: string
    importance?: number
    confidence?: number
  }) {
    return Database.transaction(() => {
      const kind = input.kind ?? "note"
      if (isHostOwnedMemoryKind(kind)) throw new Error(`${kind} memory is host-owned`)
      const key = input.key ? normalizeKey(input.key) : undefined
      const existing = key
        ? findByKey({
            projectId: input.projectId,
            kind,
            key,
          })
        : null
      const file =
        existing ??
        createFile({
          title: input.title,
          source: input.source,
          projectId: input.projectId,
          kind,
          key,
          importance: input.importance,
          confidence: input.confidence,
        })
      if (existing) {
        updateFile({
          fileId: existing.id,
          projectId: input.projectId,
          title: input.title,
          source: input.source,
          kind,
          key,
          importance: input.importance,
          confidence: input.confidence,
        })
      }
      writeChunks(file.id, input.projectId, input.content)
      return getFileInProject({ fileId: file.id, projectId: input.projectId })!
    })
  }

  export function captureEpisode(input: {
    title: string
    content: string
    source: Source
    projectId: string
    importance?: number
    confidence?: number
    atomics?: Array<{
      kind: "profile" | "lesson" | "fact"
      text: string
      section: string
      importance?: number
    }>
  }) {
    const episode = writeFile({
      title: input.title,
      content: input.content,
      source: input.source,
      projectId: input.projectId,
      kind: "episode",
      importance: input.importance ?? DEFAULT_IMPORTANCE.episode,
      confidence: input.confidence ?? DEFAULT_CONFIDENCE.episode,
    })

    let derived: MemoryFile[]
    if (input.atomics && input.atomics.length > 0) {
      // Structured path: caller already knows the kind/importance of each atomic
      const seen = new Set<string>()
      derived = input.atomics.slice(0, 8).flatMap((atom) => {
        const text = compactText(atom.text)
        if (text.length < 24 || text.length > 260) return []
        const key = normalizeKey(`${atom.kind}-${text}`)
        if (!key || seen.has(key)) return []
        seen.add(key)
        return [
          writeFile({
            title: buildAtomicTitle(atom.kind, text),
            content: buildAtomicContent({
              kind: atom.kind,
              text,
              episodeTitle: input.title,
              section: atom.section,
            }),
            source: "reflection",
            projectId: input.projectId,
            kind: atom.kind,
            key,
            importance: atom.importance ?? DEFAULT_IMPORTANCE[atom.kind],
            confidence: DEFAULT_CONFIDENCE[atom.kind],
          }),
        ]
      })
      log.info("captured episode memory (structured atomics)", {
        fileId: episode.id,
        derived: derived.length,
        source: input.source,
      })
    } else {
      // Heuristic path: caller didn't supply structured atomics, derive from text as facts with flat importance
      derived = deriveAtomicMemories({
        title: input.title,
        content: input.content,
      }).map((item) =>
        writeFile({
          title: item.title,
          content: item.content,
          source: "reflection",
          projectId: input.projectId,
          kind: item.kind,
          key: item.key,
          importance: item.importance,
          confidence: item.confidence,
        }),
      )
      log.info("captured episode memory", {
        fileId: episode.id,
        derived: derived.length,
        source: input.source,
      })
    }
    return { episode, derived }
  }

  export function search(input: {
    query: string
    projectId: string
    limit?: number
    minScore?: number
    temporalDecay?: boolean
    kinds?: Kind[]
    sources?: Source[]
  }) {
    return MemorySearch.search(input)
  }

  export function recall(input: {
    query: string
    projectId: string
    limit?: number
    minScore?: number
    includeEpisodes?: boolean
  }) {
    const limit = input.limit ?? 4
    const seen = new Set<string>()
    const combined = queryVariants(input.query)
      .flatMap((query, idx) => {
        const minScore = Math.max(0.08, (input.minScore ?? 0.15) - idx * 0.03)
        const primary = search({
          query,
          projectId: input.projectId,
          limit: limit * 2,
          minScore,
          kinds: ["profile", "lesson", "fact", "note"],
        })
        const secondary =
          input.includeEpisodes === false
            ? []
            : search({
                query,
                projectId: input.projectId,
                limit,
                minScore: Math.max(0.06, minScore - 0.04),
                kinds: ["episode"],
                temporalDecay: true,
              })
        return [...primary, ...secondary]
      })
      .filter((item) => {
        if (seen.has(item.fileId)) return false
        seen.add(item.fileId)
        return true
      })
    return combined.slice(0, limit)
  }

  export function promptSection(input: {
    query: string
    projectId: string
    limit?: number
    minScore?: number
    heading?: string
    includeEpisodes?: boolean
  }) {
    const items = recall(input)
    if (items.length === 0) return null
    const heading = input.heading ?? "Auto-Recalled Memory"
    const lines = [`## ${heading}`, ""]
    for (const item of items) {
      lines.push(
        `- [${item.kind}/${item.scope}] ${item.fileTitle}: ${compactText(item.content, item.kind === "episode" ? 180 : 220)}`,
      )
    }
    lines.push("")
    lines.push("Use memory search for broader history or memory get for full details when needed.")
    return lines.join("\n")
  }

  export function listFiles(input: { projectId: string; kinds?: Kind[] }) {
    const rows = Database.use((db) =>
      db
        .select()
        .from(MemoryFileTable)
        .where(eq(MemoryFileTable.project_id, input.projectId))
        .orderBy(desc(MemoryFileTable.time_updated), desc(MemoryFileTable.time_created))
        .all(),
    )
    const files = rows.map(fromFile)
    const kinds = input.kinds
    if (!kinds || kinds.length === 0) return files.filter((row) => !isHostOwnedMemoryKind(row.kind))
    return files.filter((row) => kinds.includes(row.kind) && !isHostOwnedMemoryKind(row.kind))
  }

  export function getFile(fileId: string) {
    const row = Database.use((db) => db.select().from(MemoryFileTable).where(eq(MemoryFileTable.id, fileId)).get())
    if (!row || isHostOwnedMemoryKind(row.kind)) return null
    return fromFile(row)
  }

  export function getFileInProject(input: { fileId: string; projectId: string }) {
    const row = Database.use((db) =>
      db
        .select()
        .from(MemoryFileTable)
        .where(and(eq(MemoryFileTable.id, input.fileId), eq(MemoryFileTable.project_id, input.projectId)))
        .get(),
    )
    if (!row || isHostOwnedMemoryKind(row.kind)) return null
    return fromFile(row)
  }

  export function getChunks(fileId: string) {
    const rows = Database.use((db) => {
      const file = db
        .select({ kind: MemoryFileTable.kind })
        .from(MemoryFileTable)
        .where(eq(MemoryFileTable.id, fileId))
        .get()
      if (!file || isHostOwnedMemoryKind(file.kind)) return []
      return db.select().from(MemoryChunkTable).where(eq(MemoryChunkTable.file_id, fileId)).all()
    })
    return rows.map((row) => ({
      id: row.id,
      fileId: row.file_id,
      projectId: row.project_id,
      content: row.content,
      tokenCount: row.token_count,
      timeCreated: row.time_created,
      timeUpdated: row.time_updated,
    }))
  }

  export function getChunksInProject(input: { fileId: string; projectId: string }) {
    const rows = Database.use((db) => {
      const file = db
        .select({ kind: MemoryFileTable.kind })
        .from(MemoryFileTable)
        .where(and(eq(MemoryFileTable.id, input.fileId), eq(MemoryFileTable.project_id, input.projectId)))
        .get()
      if (!file || isHostOwnedMemoryKind(file.kind)) return []
      return db
        .select()
        .from(MemoryChunkTable)
        .where(and(eq(MemoryChunkTable.file_id, input.fileId), eq(MemoryChunkTable.project_id, input.projectId)))
        .all()
    })
    return rows.map((row) => ({
      id: row.id,
      fileId: row.file_id,
      projectId: row.project_id,
      content: row.content,
      tokenCount: row.token_count,
      timeCreated: row.time_created,
      timeUpdated: row.time_updated,
    }))
  }

  export function deleteFileInProject(input: { fileId: string; projectId: string }) {
    const deletedFile = Database.transaction((db) => {
      const file = db
        .select()
        .from(MemoryFileTable)
        .where(and(eq(MemoryFileTable.id, input.fileId), eq(MemoryFileTable.project_id, input.projectId)))
        .get()
      if (!file) return null
      if (isHostOwnedMemoryKind(file.kind)) {
        throw new ProtectedProjectMemoryError({
          message: `Project memory ledger file ${input.fileId} is read-only`,
          code: "protected_project_memory",
          fileID: input.fileId,
        })
      }
      ftsDeleteByFileInProject(db, input.fileId, input.projectId)
      db.delete(MemoryChunkTable)
        .where(and(eq(MemoryChunkTable.file_id, input.fileId), eq(MemoryChunkTable.project_id, input.projectId)))
        .run()
      db.delete(MemoryFileTable)
        .where(and(eq(MemoryFileTable.id, input.fileId), eq(MemoryFileTable.project_id, input.projectId)))
        .run()
      return fromFile(file)
    })
    if (deletedFile) log.info("deleted memory file", { fileId: input.fileId, projectId: input.projectId })
    return deletedFile
  }
}

