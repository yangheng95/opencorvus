import { afterEach, expect, test } from "bun:test"
import { createRightSidebarConversationSession } from "../src/chat/session"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { Identifier } from "../src/id/id"
import { ensureMissionSession } from "../src/mission/session"
import { Instance, runOutsideInstanceContext } from "../src/project/instance"
import { Server } from "../src/server/server"
import { Database, eq } from "../src/storage/db"
import { EngineTaskTable } from "../src/engine/engine.sql"
import { createContinuousGoal, resolveGoalOwner } from "../src/continuous-goal/store"
import { Session } from "../src/session"
import { listArchivedWorkLedger, listWorkLedger } from "../src/work-ledger/projection"
import { persistEstablishedTask } from "./fixture/engine-task"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { Project } from "../src/project/project"

afterEach(async () => { Server.resetProjectRoutesAppForTest(); await resetMemoryDatabase() })

test("current Project names select exact Chat, Work, Mission and Task rows before pagination", async () => {
  await using first = await memoryProject("named-ledger-first")
  await using second = await memoryProject("named-ledger-second")
  const names = ["客户_50%\\行程Alpha", "客户x50ANYTHING\\行程Alpha"]
  const create = (directory: string, side: number) => Instance.provide({ directory, fn: async () => {
    await Project.update({ projectID: Instance.project.id, name: names[side]! })
    return {
      projectID: Instance.project.id,
      chat: await createRightSidebarConversationSession("chat", { title: `Named conversation ${side}` }),
      work: await createRightSidebarConversationSession("work", { title: `Named deliverable ${side}` }),
      mission: await ensureMissionSession({ missionID: `named-ledger-${side}`, defaultCwd: directory, productPillar: "work", heldExpertSquadIDs: ["base"] }),
      taskID: await task(`Named standalone ${side}`),
    }
  } })
  const left = await create(first.path, 0), right = await create(second.path, 1)
  const keys = (rows: Awaited<ReturnType<typeof listWorkLedger>>["rows"]) => rows.map(row => `${row.kind}:${row.id}`).sort()
  const expected = (owner: typeof left, project: boolean) => [
    ...(project ? [`project:${owner.projectID}`] : []), `chat:${owner.chat.id}`, `chat:${owner.work.id}`,
    `mission:${owner.mission.missionID}`, `task:${owner.taskID}`,
  ].sort()
  expect(keys((await listWorkLedger({ search: names[0]!.toLowerCase() })).rows)).toEqual(expected(left, true))
  expect(keys((await listWorkLedger({ search: names[1], directory: second.path })).rows)).toEqual(expected(right, true))
  const paged = async (reader: typeof listWorkLedger, search: string) => {
    const rows: Awaited<ReturnType<typeof listWorkLedger>>["rows"] = []
    let cursor: Awaited<ReturnType<typeof listWorkLedger>>["nextCursor"] = null
    do {
      const page = await reader({ search, limit: 1, ...(cursor ? {
        cursorPinned: cursor.pinned, cursorUpdated: cursor.updated, cursorRowKey: cursor.rowKey,
      } : {}) })
      rows.push(...page.rows)
      cursor = page.nextCursor
    } while (cursor)
    return keys(rows)
  }
  expect(await paged(listWorkLedger, names[0]!)).toEqual(expected(left, true))
  for (const [directory, owner] of [[first.path, left], [second.path, right]] as const) {
    await Instance.provideProjectIdentity({ directory, fn: async () => {
      for (const session of [owner.chat, owner.work, owner.mission]) await Session.setArchived({ sessionID: session.id, time: Date.now() })
      Database.use(db => db.update(EngineTaskTable).set({ time_archived: Date.now() }).where(eq(EngineTaskTable.id, owner.taskID)).run())
    } })
  }
  expect(keys((await listArchivedWorkLedger({ search: names[0]!.toLowerCase() })).rows)).toEqual(expected(left, false))
  expect(keys((await listArchivedWorkLedger({ search: names[1], directory: second.path })).rows)).toEqual(expected(right, false))
  expect(await paged(listArchivedWorkLedger, names[0]!)).toEqual(expected(left, false))
  const renamed = "新名_50%\\行程Omega"
  await Project.update({ projectID: left.projectID, name: renamed })
  expect(keys((await listArchivedWorkLedger({ search: renamed.toLowerCase() })).rows)).toEqual(expected(left, false))
}, 60_000)

test("the public selected reader keeps exact active and archived Chat, Work, Mission and Task identities", async () => {
  await using project = await memoryProject("selected-reader")
  await using other = await memoryProject("selected-reader-other")
  const owners = await Instance.provide({ directory: project.path, fn: async () => {
    const chat = await createRightSidebarConversationSession("chat", { title: "Selected Chat history" })
    const work = await createRightSidebarConversationSession("work", { title: "Selected Work history" })
    const mission = await ensureMissionSession({ missionID: "selected-mission", defaultCwd: project.path, productPillar: "work", heldExpertSquadIDs: ["base"] })
    const taskID = await task("Selected Task history")
    const generic = await Session.create({ kind: "assistant", title: "Generic session" })
    const goal = createContinuousGoal(resolveGoalOwner({ kind: "chat", id: chat.id }), { requestID: "selected-goal", objective: "Retain this archived goal" }, "user")
    return { chat, work, mission, taskID, generic, goal }
  } })
  const request = (url: string, directory = project.path) => runOutsideInstanceContext(() => Server.App().request(url, {
    headers: { "x-opencorvus-directory": directory },
  }))
  const read = async (kind: "task" | "session", id: string, directory = project.path) => {
    const response = await request(`/work-ledger/selection/${kind}/${id}?directory=${encodeURIComponent(directory)}`, directory)
    return { status: response.status, body: await response.json() }
  }
  const cases = [
    { kind: "session" as const, id: owners.chat.id, expected: { kind: "chat", experience: "chat", title: owners.chat.title } },
    { kind: "session" as const, id: owners.work.id, expected: { kind: "chat", experience: "work", title: owners.work.title } },
    { kind: "session" as const, id: owners.mission.id, expected: { kind: "mission", missionID: owners.mission.missionID } },
    { kind: "task" as const, id: owners.taskID, expected: { kind: "task", id: owners.taskID, title: "Selected Task history" } },
  ]
  for (const item of cases) expect(await read(item.kind, item.id)).toMatchObject({ status: 200, body: { ...item.expected, directory: project.path } })
  const archived = Date.now()
  await Instance.provideProjectIdentity({ directory: project.path, fn: async () => {
    for (const session of [owners.chat, owners.work, owners.mission]) await Session.setArchived({ sessionID: session.id, time: archived })
    Database.use(db => db.update(EngineTaskTable).set({ time_archived: archived }).where(eq(EngineTaskTable.id, owners.taskID)).run())
  } })
  for (const item of cases) expect(await read(item.kind, item.id)).toMatchObject({ status: 200, body: { ...item.expected, archived, directory: project.path } })
  const goalResponse = await request(`/continuous-goal/chat/${owners.chat.id}`)
  expect({ status: goalResponse.status, body: await goalResponse.json() }).toMatchObject({ status: 200, body: {
    id: owners.goal.id, objective: owners.goal.objective, status: "paused", reason: "owner_archived",
  } })
  for (const [id, directory] of [[owners.chat.id, other.path], [owners.generic.id, project.path], ["ses_missing-selected-reader", project.path]]) {
    expect(await read("session", id!, directory)).toMatchObject({ status: 404, body: { name: "NotFoundError" } })
  }
  const mutation = await runOutsideInstanceContext(() => Server.App().request(`/continuous-goal/chat/${owners.chat.id}`, {
    method: "POST", headers: { "x-opencorvus-directory": project.path, "Content-Type": "application/json" },
    body: JSON.stringify({ requestID: "archived-create", objective: "Explicit write contract" }),
  }))
  expect({ status: mutation.status, body: await mutation.json() }).toMatchObject({ status: 409, body: { name: "ContinuousGoalError", data: { code: "owner_unavailable" } } })
  const { EngineService } = await import("../src/task-api")
  const deleted = await Instance.provideProjectIdentity({ directory: project.path, fn: () => EngineService.deleteSession(owners.work.id, {
    projectID: owners.work.projectID,
  }) })
  expect(deleted).toMatchObject({ status: "physically_deleted", sessionHistoryRetained: false })
  expect(await read("session", owners.work.id)).toMatchObject({ status: 404, body: { name: "NotFoundError" } })
}, 60_000)

test("canonical Work experience searches preserve active, archived, Project and cursor identities after renaming", async () => {
  await using first = await memoryProject("experience-first")
  await using second = await memoryProject("experience-second")
  const create = (directory: string, label: string) => Instance.provide({ directory, fn: async () => {
    const active = await createRightSidebarConversationSession("work", { title: `${label} current` })
    const archived = await createRightSidebarConversationSession("work", { title: `${label} retained` })
    await createRightSidebarConversationSession("chat", { title: `${label} conversation` })
    await Session.setArchived({ sessionID: archived.id, time: Date.now() })
    return { active, archived }
  } })
  const left = await create(first.path, "Alpha"), right = await create(second.path, "Beta")
  const identities = (rows: Awaited<ReturnType<typeof listWorkLedger>>["rows"]) => rows.map(row => ({
    id: row.id, experience: row.kind === "chat" ? row.experience : row.kind,
  })).sort((a, b) => a.id.localeCompare(b.id))
  expect(identities((await listWorkLedger({ search: "WoRk" })).rows)).toEqual([
    { id: left.active.id, experience: "work" as const }, { id: right.active.id, experience: "work" as const },
  ].sort((a, b) => a.id.localeCompare(b.id)))
  expect(identities((await listWorkLedger({ search: "work", directory: first.path })).rows))
    .toEqual([{ id: left.active.id, experience: "work" }])
  expect(identities((await listArchivedWorkLedger({ search: "work" })).rows)).toEqual([
    { id: left.archived.id, experience: "work" as const }, { id: right.archived.id, experience: "work" as const },
  ].sort((a, b) => a.id.localeCompare(b.id)))
  expect(identities((await listArchivedWorkLedger({ search: "work", directory: second.path })).rows))
    .toEqual([{ id: right.archived.id, experience: "work" }])
  const page = await listWorkLedger({ search: "work", limit: 1 })
  expect(page.rows.length).toBe(1)
  const cursor = page.nextCursor!
  const next = await listWorkLedger({ search: "work", limit: 1,
    cursorPinned: cursor.pinned, cursorUpdated: cursor.updated, cursorRowKey: cursor.rowKey,
  })
  expect(identities([...page.rows, ...next.rows])).toEqual([
    { id: left.active.id, experience: "work" as const }, { id: right.active.id, experience: "work" as const },
  ].sort((a, b) => a.id.localeCompare(b.id)))
})

async function titles(values: string[]) {
  const rows: Session.Info[] = []
  for (const title of values) rows.push(await createRightSidebarConversationSession("chat", { title }))
  return rows
}

async function task(title: string, mission?: { id: string; missionID: string }) {
  const taskID = Identifier.ascending("task")
  const packageRevision = {
    scope: "built_in" as const, projectID: null, namespace: "builtin", id: "base",
    version: "2026.08.13.1", packageDigest: "a".repeat(64),
  }
  const now = Date.now()
  persistEstablishedTask({
    taskID, title, request: "Verify the current Work Ledger search projection",
    rootSession: Session.prepareRootNext({ kind: "root", directory: Instance.directory, title }),
    now, productPillar: "work", source: mission ? "mission" : "right-sidebar-conversation", projectID: Instance.project.id,
    metadata: mission
      ? { actor: "mission", mission: { id: mission.missionID, session_id: mission.id } }
      : { actor: "user" },
    packageRevision,
    executionCapsuleBinding: await prepareTaskProcessBinding({
      mode: "native", taskID, projectID: Instance.project.id, rootDirectory: Instance.directory,
      packageRevisionSHA256: packageRevision.packageDigest, timeCreated: now,
    }),
  })
  return taskID
}

test("search finds an older real conversation beyond the recent page and preserves its exact identity", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    const [older] = await titles(["较早的逐条阅读与来源"])
    await titles(Array.from({ length: 20 }, (_, index) => `Recent conversation ${index}`))
    const result = await listWorkLedger({ search: "逐条阅读", limit: 12 })
    expect(result.rows.map(row => ({ kind: row.kind, id: row.id, title: row.title, directory: row.directory })))
      .toEqual([{ kind: "chat", id: older!.id, title: older!.title, directory: project.path }])
  } })
})

test("literal search preserves percent, underscore, backslash, Chinese and ASCII case matching", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    const rows = await titles(["build_50%\\中文", "buildX50any\\中文", "100%done", "100Xdone", "A_B", "AxB"])
    for (const [search, selected] of [
      [" BUILD_50%\\中文 ", [0]], ["100%", [2]], ["A_B", [4]], ["\\中文", [0, 1]],
    ] as const) {
      const result = await listWorkLedger({ directory: project.path, search, limit: 12 })
      expect(result.rows.map(row => row.id).sort()).toEqual(selected.map(index => rows[index]!.id).sort())
    }
    const [archived, active] = await titles(["归档_50% 已完成", "归档_50% 进行中"])
    await Session.setArchived({ sessionID: archived!.id, time: Date.now() })
    expect((await listArchivedWorkLedger({ search: "归档_50%" })).rows.map(row => row.id)).toEqual([archived!.id])
    expect((await listWorkLedger({ search: "归档_50%" })).rows.map(row => row.id)).toEqual([active!.id])
  } })
})

test("the same search returns exact global and directory-scoped Project results", async () => {
  await using first = await memoryProject("search-project-first")
  await using second = await memoryProject("search-project-second")
  const left = await Instance.provide({ directory: first.path, fn: async () => (await titles(["共同片段 A"]))[0]! })
  const right = await Instance.provide({ directory: second.path, fn: async () => (await titles(["共同片段 B"]))[0]! })
  expect((await listWorkLedger({ search: "共同片段" })).rows.map(row => row.id).sort()).toEqual([left.id, right.id].sort())
  expect((await listWorkLedger({ search: "共同片段", directory: first.path })).rows.map(row => row.id)).toEqual([left.id])
  expect((await listWorkLedger({ search: "共同片段", directory: second.path })).rows.map(row => row.id)).toEqual([right.id])
})

test("kind search follows the canonical cursor and includes Mission child Tasks", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    const chats = await titles(["Alpha", "Beta", "Gamma"])
    const first = await listWorkLedger({ directory: project.path, search: "chat", limit: 1 })
    const actual = first.rows.map(row => row.id)
    let cursor = first.nextCursor
    while (cursor) {
      const page = await listWorkLedger({
        directory: project.path, search: "chat", limit: 1,
        cursorPinned: cursor.pinned, cursorUpdated: cursor.updated, cursorRowKey: cursor.rowKey,
      })
      actual.push(...page.rows.map(row => row.id))
      cursor = page.nextCursor
    }
    expect(actual).toEqual((await listWorkLedger({ directory: project.path, search: "chat", limit: 12 })).rows.map(row => row.id))
    expect(actual.toSorted()).toEqual(chats.map(row => row.id).sort())

    const mission = await ensureMissionSession({
      missionID: "search-owner", defaultCwd: project.path, productPillar: "work", heldExpertSquadIDs: ["base"],
    })
    const directID = await task("standalone_%\\记录")
    const taskID = await task("来源归档_50%", mission)
    for (const search of ["task", "来源归档_50%", taskID]) {
      const result = await listWorkLedger({ directory: project.path, search })
      expect(result.rows.filter(row => row.kind === "mission").map(row => ({ id: row.id, tasks: row.tasks.map(task => task.id) })))
        .toEqual([{ id: mission.missionID, tasks: [taskID] }])
    }
    expect((await listWorkLedger({ directory: project.path, search: "standalone_%\\" })).rows.map(row => row.id)).toEqual([directID])
    const kinds = await listWorkLedger({ directory: project.path, search: "task" })
    expect(kinds.rows.flatMap(row => row.kind === "mission" ? row.tasks.map(child => child.id) : [row.id]).sort())
      .toEqual([directID, taskID].sort())
    expect((await listWorkLedger({ directory: project.path, search: "mission" })).rows.map(row => row.id)).toEqual([mission.missionID])
  } })
}, 60_000)
