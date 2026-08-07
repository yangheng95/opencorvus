/**
 * QuickNote 服务层
 * 提供笔记创建、查询、更新和删除等操作
 */

import { Database, eq, desc } from "@/storage/db"
import { Identifier } from "@/id/id"
import { QuickNoteTable } from "./quicknote.sql"
import { extractTitle, validateContent } from "./text-processor"

export interface Note {
  note_id: string
  content: string
  summary: string
  tags: string
  status: string
  created_at: number
  updated_at: number
}

export interface CreateNoteResult {
  note_id: string
  summary: string
}

export function createNote(input: { content: string }): CreateNoteResult {
  const { content } = input
  if (!validateContent(content)) {
    throw new Error(`内容长度不能超过 2000 字符`)
  }

  const noteId = Identifier.ascending("note")
  const summary = extractTitle(content)
  const now = Date.now()

  Database.use((db) => {
    db.insert(QuickNoteTable)
      .values({
        id: noteId,
        content,
        summary,
        tags: "[]",
        status: "draft",
        time_created: now,
        time_updated: now,
      })
      .run()
  })

  return { note_id: noteId, summary }
}

export function listNotes(): Note[] {
  const rows = Database.use((db) => db.select().from(QuickNoteTable).orderBy(desc(QuickNoteTable.time_created)).all())

  return rows.map((row) => ({
    note_id: row.id,
    content: row.content,
    summary: row.summary,
    tags: row.tags,
    status: row.status,
    created_at: row.time_created,
    updated_at: row.time_updated,
  }))
}

export function getNote(id: string): Note | undefined {
  const row = Database.use((db) => db.select().from(QuickNoteTable).where(eq(QuickNoteTable.id, id)).get())
  if (!row) return undefined

  return {
    note_id: row.id,
    content: row.content,
    summary: row.summary,
    tags: row.tags,
    status: row.status,
    created_at: row.time_created,
    updated_at: row.time_updated,
  }
}

export function deleteNote(id: string): boolean {
  const existing = getNote(id)
  if (!existing) return false

  Database.use((db) => {
    db.delete(QuickNoteTable).where(eq(QuickNoteTable.id, id)).run()
  })

  return true
}

export function deleteProjectNotes(input: { projectID: string }, db?: Database.TxOrDb): void {
  const write = (target: Database.TxOrDb) =>
    target.delete(QuickNoteTable).where(eq(QuickNoteTable.project_id, input.projectID)).run()
  if (db) {
    write(db)
    return
  }
  Database.use(write)
}
