import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { createRightSidebarConversationSession } from "@/chat/session"
import { ConfigPaths } from "@/config/paths"
import { EngineTaskTable } from "@/engine/engine.sql"
import { appendTaskOpenedInTransaction } from "@/engine/task-lifecycle"
import { Identifier } from "@/id/id"
import { Instance, runOutsideInstanceContext } from "@/project/instance"
import { Server } from "@/server/server"
import { Session } from "@/session"
import { Database, eq } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function unavailableModel(directory: string) {
  const config = ConfigPaths.projectFile(directory)
  await fs.mkdir(path.dirname(config), { recursive: true })
  await fs.writeFile(config, JSON.stringify({ model: "mission-authoring-unavailable/model" }))
}

async function request(directory: string, method: "POST" | "PATCH", route: string, body: object) {
  await Instance.disposeAll()
  const response = await runOutsideInstanceContext(() => Server.App().request(route, {
    method,
    headers: { "x-opencorvus-directory": directory, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }))
  return { status: response.status, body: await response.json() }
}

test("cold Mission authoring returns its exact draft across projects with unavailable execution models", async () => {
  await using first = await memoryProject("mission-author-first")
  await using second = await memoryProject("mission-author-second")
  for (const [directory, marker] of [[first.path, "FIRST"], [second.path, "SECOND"]]) {
    await unavailableModel(directory!)
    const original = `Draft request ${marker}`
    const created = await request(directory!, "POST", "/mission/draft", {
      title: `Draft ${marker}`, request: original, productPillar: "work", expertSquadIDs: ["base"],
    })
    expect(created).toMatchObject({
      status: 200,
      body: { directory, title: `Draft ${marker}`, productPillar: "work", pendingPrompt: { text: original } },
    })
    const { missionID, sessionID } = created.body
    const edited = await request(directory!, "PATCH", `/mission/${missionID}/draft`, {
      expectedRequest: original, request: `Saved request ${marker}`,
    })
    expect(edited).toMatchObject({
      status: 200,
      body: { missionID, sessionID, directory, pendingPrompt: { text: `Saved request ${marker}` } },
    })
    const renamed = await request(directory!, "PATCH", `/mission/${missionID}/title`, { title: `Renamed ${marker}` })
    expect(renamed).toMatchObject({
      status: 200,
      body: { missionID, sessionID, directory, title: `Renamed ${marker}`, pendingPrompt: { text: `Saved request ${marker}` } },
    })
    const pinned = await request(directory!, "PATCH", `/work-ledger/item/mission/${sessionID}/pin`, { pinned: true })
    expect(pinned).toEqual({ status: 200, body: { pinned: true } })
    const stored = await Instance.provideProjectIdentity({ directory: directory!, fn: () => Session.get(sessionID) })
    expect(stored).toMatchObject({ id: sessionID, title: `Renamed ${marker}`, time: { pinned: expect.any(Number) } })
    const dispatch = await request(directory!, "POST", `/mission/${missionID}/dispatch`, { requestID: `dispatch-${marker}` })
    expect(dispatch).toMatchObject({
      status: 400,
      body: { name: "ProviderModelNotFoundError", data: { providerID: "mission-authoring-unavailable", modelID: "model" } },
    })
  }
}, 30_000)

test("cold Task titles and Chat/Work/Task pin controls persist their original metadata", async () => {
  await using project = await memoryProject("authoring-item-metadata")
  await using other = await memoryProject("authoring-item-other")
  const fixture = await Instance.provideProjectIdentity({ directory: project.path, fn: async () => {
    const root = await Session.create({ kind: "root", title: "Original Task root" })
    const taskID = Identifier.ascending("task")
    Database.immediateTransaction(db => {
      db.insert(EngineTaskTable).values({
        id: taskID, project_id: Instance.project.id, session_id: root.id,
        source: "test", product_pillar: "work", title: "Original Task", request: "Retain this original request",
        time_created: Date.now(), metadata: { actor: "user" },
      }).run()
      appendTaskOpenedInTransaction({ db, taskID, sessionID: root.id, now: Date.now(), source: "test.authoring" })
    })
    return {
      taskID,
      chat: await createRightSidebarConversationSession("chat", { title: "Original Chat" }),
      work: await createRightSidebarConversationSession("work", { title: "Original Work" }),
    }
  } })
  await unavailableModel(project.path)
  const renamed = await request(project.path, "PATCH", `/task/${fixture.taskID}/title`, { title: "Renamed Task" })
  expect(renamed).toEqual({ status: 200, body: true })
  for (const [kind, id] of [["task", fixture.taskID], ["chat", fixture.chat.id], ["chat", fixture.work.id]]) {
    expect(await request(project.path, "PATCH", `/work-ledger/item/${kind}/${id}/pin`, { pinned: true }))
      .toEqual({ status: 200, body: { pinned: true } })
  }
  const task = Database.use(db => db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, fixture.taskID)).get())
  expect(task).toMatchObject({ id: fixture.taskID, title: "Renamed Task", request: "Retain this original request", time_pinned: expect.any(Number) })
  for (const session of [fixture.chat, fixture.work]) {
    const stored = await Instance.provideProjectIdentity({ directory: project.path, fn: () => Session.get(session.id) })
    expect(stored).toMatchObject({ id: session.id, title: session.title, time: { pinned: expect.any(Number) } })
  }
  const mission = await request(project.path, "POST", "/mission/draft", {
    title: "Owned Mission", request: "Original owned draft", productPillar: "work", expertSquadIDs: ["base"],
  })
  expect(mission).toMatchObject({ status: 200, body: { title: "Owned Mission", directory: project.path } })
  await unavailableModel(other.path)
  for (const [kind, id] of [
    ["task", fixture.taskID], ["chat", fixture.chat.id], ["chat", fixture.work.id], ["mission", mission.body.sessionID],
  ]) {
    expect(await request(other.path, "PATCH", `/work-ledger/item/${kind}/${id}/pin`, { pinned: false }))
      .toMatchObject({ status: 404, body: { name: "NotFoundError" } })
  }
}, 30_000)
