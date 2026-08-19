import type { MemoryKind, MemorySource } from "./memory.sql"

export type MemoryScope = "project"

/**
 * Kinds the Host owns: per-project singleton documents addressed by
 * deterministic identity whose chunk content is a JSON envelope, not prose.
 * They are excluded from agent-facing reads, from relevance search, and from
 * the full-text index. Stated once because three places used to restate it —
 * a private predicate in `index.ts`, a literal union in `project-memory.ts`,
 * and an omission from the search weight map — and the full-text rebuild in
 * `storage/mysql-transfer.ts` restated none of them, so a rebuilt index held
 * chunks the running one never had.
 */
export const HOST_OWNED_MEMORY_KINDS = ["user_message", "project_context"] as const

export type HostOwnedMemoryKind = (typeof HOST_OWNED_MEMORY_KINDS)[number]

export function isHostOwnedMemoryKind(kind: MemoryKind): kind is HostOwnedMemoryKind {
  return (HOST_OWNED_MEMORY_KINDS as readonly string[]).includes(kind)
}

export interface MemoryFile {
  /**
   * `importance` and `confidence` below are 0-100 integers self-reported by the
   * model that wrote the memory, and they are multiplied into the retrieval
   * score. They share a name with, but no scale or provenance with, the 0-1
   * values in intent analysis and DOM matching or the three-value labels in
   * fact-check and research.
   */
  id: string
  projectId: string
  scope: MemoryScope
  title: string
  source: MemorySource
  kind: MemoryKind
  key?: string
  importance: number
  confidence: number
  timeCreated: number
  timeUpdated: number
}

export interface MemoryChunk {
  id: string
  fileId: string
  projectId: string
  content: string
  tokenCount: number
  timeCreated: number
  timeUpdated: number
}

export interface MemorySearchResult {
  chunkId: string
  fileId: string
  fileTitle: string
  content: string
  scope: MemoryScope
  source: MemorySource
  kind: MemoryKind
  key?: string
  importance: number
  confidence: number
  score: number
  timeCreated: number
}

export type { MemoryKind, MemorySource }
