import type { MemoryKind, MemorySource } from "./memory.sql"

export type MemoryScope = "project"

export interface MemoryFile {
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
