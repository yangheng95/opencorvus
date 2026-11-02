import { afterEach, expect, test } from "bun:test"
import { EngineTaskTable } from "@/engine/engine.sql"
import { acknowledgeMailboxItem, listMailbox, recordMailboxMessage } from "@/engine/mailbox"
import { Identifier } from "@/id/id"
import { Instance, runOutsideInstanceContext } from "@/project/instance"
import { Project } from "@/project/project"
import { Server } from "@/server/server"
import { Session } from "@/session"
import { Database } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await resetMemoryDatabase()
})

async function seed(count = 70) {
  const root = await Session.create({ kind: "root", title: "Mailbox search root" })
  const id = Identifier.ascending("task")
  Database.use(db => db.insert(EngineTaskTable).values({
    id, project_id: Instance.project.id, session_id: root.id, source: "test",
    product_pillar: "work", title: "Mailbox search project", request: "Mailbox search service contract", time_created: Date.now(),
  }).run())
  const messages = Array.from({ length: count }, (_, index) => recordMailboxMessage({
    taskID: id, sessionID: root.id, agentID: "solution-architect", expertSquadID: "advanced",
    category: "notification", attention: true, evidenceLocators: [],
    subject: index === 0 ? "较早通知 Older-Needle" : `Notification ${index}`,
    body: index === 2 ? "Exact %_\\ 原始正文" : [1, 4, 7].includes(index) ? "phase-group" : `Canonical body ${index}`,
    summary: `Mailbox service fixture ${index}`, correlationID: `mailbox-search-${id}-${index}`,
  }))
  return { id, messages }
}

async function page(query: Record<string, string>, directory: string) {
  const response = await runOutsideInstanceContext(() => Server.App().request("/mailbox?" + new URLSearchParams(query), {
    headers: { "x-opencorvus-directory": directory },
  }))
  expect(response.status).toBe(200)
  return response.json() as Promise<ReturnType<typeof listMailbox>>
}

test("the public Mailbox search returns an original notification beyond the first forty", async () => {
  await using project = await memoryProject("mailbox-search-history")
  await Instance.provide({ directory: project.path, fn: async () => {
    const fixture = await seed()
    const result = await page({ search: "  older-needle  ", limit: "40" }, project.path)
    expect({ ids: result.items.map(item => item.id), active: result.activeCount, unread: result.unreadCount, next: result.nextCursor })
      .toEqual({ ids: [fixture.messages[0]!.id], active: 70, unread: 70, next: null })
  } })
})

test("Mailbox search preserves literal punctuation, Unicode, source identity and normalized project paths", async () => {
  await using project = await memoryProject("mailbox-search-literals")
  await Instance.provide({ directory: project.path, fn: async () => {
    const fixture = await seed()
    for (const [query, expected] of [["%_\\", 2], ["原始正文", 2], ["较早通知", 0], ["OLDER-NEEDLE", 0]] as const) {
      const result = await page({ search: query }, project.path)
      expect(result.items.map(item => item.id)).toEqual([fixture.messages[expected]!.id])
    }
    for (const query of ["SOLUTION-ARCHITECT", "advanced", project.path.replaceAll("\\", "/")]) {
      const result = listMailbox({ search: query, limit: 100 })
      expect({ count: result.items.length, active: result.activeCount }).toEqual({ count: 70, active: 70 })
    }
  } })
})

test("filtered Mailbox pages retain the canonical cursor order and original rows", async () => {
  await using project = await memoryProject("mailbox-search-cursor")
  await Instance.provide({ directory: project.path, fn: async () => {
    const fixture = await seed()
    const first = await page({ search: "phase-group", limit: "1" }, project.path)
    expect(first.items.map(item => item.id)).toEqual([fixture.messages[7]!.id])
    const second = await page({ search: "phase-group", limit: "1", cursorCreatedAt: String(first.nextCursor!.createdAt), cursorID: first.nextCursor!.id }, project.path)
    expect(second.items.map(item => item.id)).toEqual([fixture.messages[4]!.id])
    const third = await page({ search: "phase-group", limit: "1", cursorCreatedAt: String(second.nextCursor!.createdAt), cursorID: second.nextCursor!.id }, project.path)
    expect({ ids: third.items.map(item => item.id), next: third.nextCursor, active: third.activeCount }).toEqual({ ids: [fixture.messages[1]!.id], next: null, active: 70 })
  } })
})

test("read and archived searches project the same source notification and global counts", async () => {
  await using project = await memoryProject("mailbox-search-acknowledgement")
  await Instance.provide({ directory: project.path, fn: async () => {
    const fixture = await seed()
    acknowledgeMailboxItem({ messageID: fixture.messages[0]!.id, action: "read" })
    const read = await page({ search: "older-needle" }, project.path)
    expect({ id: read.items[0]!.id, subject: read.items[0]!.subject, read: Number.isSafeInteger(read.items[0]!.readAt), attention: read.items[0]!.attention, unread: read.unreadCount })
      .toEqual({ id: fixture.messages[0]!.id, subject: "较早通知 Older-Needle", read: true, attention: true, unread: 69 })
    acknowledgeMailboxItem({ messageID: fixture.messages[0]!.id, action: "archive" })
    const archived = await page({ search: "older-needle", view: "archived" }, project.path)
    expect({ ids: archived.items.map(item => item.id), active: archived.activeCount, archived: archived.archivedCount, unread: archived.unreadCount })
      .toEqual({ ids: [fixture.messages[0]!.id], active: 69, archived: 1, unread: 69 })
  } })
})

test("the public Mailbox query includes matching original notifications across registered projects", async () => {
  await using first = await memoryProject("mailbox-search-project-a")
  await using second = await memoryProject("mailbox-search-project-b")
  const a = await Instance.provide({ directory: first.path, fn: () => seed(1) })
  const b = await Instance.provide({ directory: second.path, fn: () => seed(1) })
  const result = await page({ search: "older-needle", limit: "100" }, first.path)
  expect({ tasks: result.items.map(item => item.taskID).sort(), active: result.activeCount })
    .toEqual({ tasks: [a.id, b.id].sort(), active: 2 })
})

test("current project names participate in global Mailbox search and paginated rename results", async () => {
  await using first = await memoryProject("mailbox-project-name-a")
  await using second = await memoryProject("mailbox-project-name-b")
  const name = "Inbox%_ 收件箱904"
  const a = await Instance.provide({ directory: first.path, fn: async () => {
    const fixture = await seed(3)
    const project = await Project.update({ projectID: Instance.project.id, name })
    return { ...fixture, projectID: project.id }
  } })
  const b = await Instance.provide({ directory: second.path, fn: async () => {
    const fixture = await seed(2)
    await Project.update({ projectID: Instance.project.id, name })
    return fixture
  } })
  const combined = await page({ search: "  INBOX%_ 收件箱904  ", limit: "100" }, first.path)
  expect({ ids: combined.items.map(item => item.id).sort(), active: combined.activeCount, unread: combined.unreadCount })
    .toEqual({ ids: [...a.messages, ...b.messages].map(item => item.id).sort(), active: 5, unread: 5 })

  const renamed = name + " · 更新"
  await Project.update({ projectID: a.projectID, name: renamed })
  let cursor: ReturnType<typeof listMailbox>["nextCursor"] = null
  for (const index of [2, 1, 0]) {
    const result = await page({
      search: renamed.toUpperCase(), limit: "1",
      ...(cursor ? { cursorCreatedAt: String(cursor.createdAt), cursorID: cursor.id } : {}),
    }, second.path)
    expect({ ids: result.items.map(item => item.id), task: result.items[0]?.taskID,
      directory: result.items[0]?.taskDirectory, active: result.activeCount, unread: result.unreadCount })
      .toEqual({ ids: [a.messages[index]!.id], task: a.id, directory: first.path, active: 5, unread: 5 })
    cursor = result.nextCursor
  }
  expect(cursor).toBeNull()
})
