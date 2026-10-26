import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { createRightSidebarConversationSession } from "@/chat/session"
import { ConfigPaths } from "@/config/paths"
import { createContinuousGoal, readContinuousGoal, resolveGoalOwner } from "@/continuous-goal/store"
import { EngineTaskTable } from "@/engine/engine.sql"
import { appendTaskOpenedInTransaction, taskLifecycleProjectionInTransaction } from "@/engine/task-lifecycle"
import { Identifier } from "@/id/id"
import { currentMissionExecutionClosure } from "@/mission/execution-closure"
import { ensureMissionSession } from "@/mission/session"
import { Instance, runOutsideInstanceContext } from "@/project/instance"
import { Server } from "@/server/server"
import { Session } from "@/session"
import { SessionPromptState } from "@/session/prompt/state"
import { Database, eq } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await resetMemoryDatabase()
})

async function unavailableModel(directory: string) {
  const config = ConfigPaths.projectFile(directory)
  await fs.mkdir(path.dirname(config), { recursive: true })
  await fs.writeFile(config, JSON.stringify({ model: "archive-unavailable/model" }))
}

function request(directory: string, route: string, body: object) {
  return runOutsideInstanceContext(() => Server.App().request(route, {
    method: "PATCH", headers: { "x-opencorvus-directory": directory, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }))
}

async function openedTask(mission?: { id: string; missionID: string }) {
  const root = await Session.create({ kind: "root", title: "Archive original task root" })
  const id = Identifier.ascending("task")
  Database.immediateTransaction(db => {
    db.insert(EngineTaskTable).values({
      id, project_id: Instance.project.id, session_id: root.id,
      source: mission ? "mission" : "test", product_pillar: "work", title: "Archive original task",
      request: "Retain the original execution history", time_created: Date.now(),
      metadata: mission ? { actor: "mission", mission: { id: mission.missionID, session_id: mission.id } } : { actor: "user" },
    }).run()
    appendTaskOpenedInTransaction({ db, taskID: id, sessionID: root.id, now: Date.now(), source: "test.archive" })
  })
  return { id, root }
}

for (const experience of ["chat", "work"] as const) {
  test(`cold ${experience} archive settles its exact Prompt and restores its original Session without a model`, async () => {
    await using project = await memoryProject(`archive-${experience}`)
    await using other = await memoryProject(`archive-${experience}-other`)
    const session = await Instance.provideProjectIdentity({ directory: project.path, fn: () =>
      createRightSidebarConversationSession(experience, { title: `Original ${experience} history` }),
    })
    const goal = await Instance.provideProjectIdentity({ directory: project.path, fn: () =>
      createContinuousGoal(resolveGoalOwner({ kind: "chat", id: session.id }), {
        requestID: "original-goal", objective: "Retain explicit Goal intent through archive", turnBudget: 2,
      }, "user"),
    })
    await unavailableModel(project.path)
    await unavailableModel(other.path)
    await Instance.disposeAll()
    const owner = await Instance.provideProjectIdentity({ directory: project.path, fn: () =>
      SessionPromptState.start(session.id, session.directory),
    })
    if (!owner) throw new Error("Expected the original Prompt owner")
    owner.addEventListener("abort", () => {
      void SessionPromptState.finish(session.id, owner, session.directory, owner.reason)
    }, { once: true })
    try {
      const route = `/coding/${experience}/session/${session.id}/archive`
      const archived = await request(project.path, route, { archived: true })
      expect({ status: archived.status, body: await archived.json(), cancelled: owner.aborted }).toMatchObject({
        status: 200, body: { session: { id: session.id, title: session.title, time: { archived: expect.any(Number) } } }, cancelled: true,
      })
      const replay = await request(project.path, route, { archived: true })
      expect({ status: replay.status, body: await replay.json() }).toMatchObject({
        status: 200, body: { session: { id: session.id, time: { archived: expect.any(Number) } } },
      })
      const restored = await request(project.path, route, { archived: false })
      expect({ status: restored.status, body: await restored.json() }).toMatchObject({
        status: 200, body: { session: { id: session.id, title: session.title, metadata: session.metadata } },
      })
      const stored = await Instance.provideProjectIdentity({ directory: project.path, fn: () => Session.get(session.id) })
      expect({ id: stored.id, archived: stored.time.archived, metadata: stored.metadata }).toEqual({
        id: session.id, archived: undefined, metadata: session.metadata,
      })
      expect(await Instance.provideProjectIdentity({ directory: project.path, fn: () =>
        readContinuousGoal(resolveGoalOwner({ kind: "chat", id: session.id })),
      })).toMatchObject({ id: goal.id, status: "paused", tokensUsed: 0, turnsAccepted: 0, turnBudget: 2 })
      const foreign = await request(other.path, route, { archived: false })
      expect({ status: foreign.status, body: await foreign.json() }).toMatchObject({ status: 404, body: { name: "NotFoundError" } })
    } finally {
      await Instance.provideProjectIdentity({ directory: project.path, fn: () =>
        SessionPromptState.finish(session.id, owner, session.directory, owner.reason),
      })
    }
  }, 60_000)
}

test("cold Task archive settles its original opened occurrence and restoration retains that terminal fact", async () => {
  await using project = await memoryProject("archive-task")
  const task = await Instance.provideProjectIdentity({ directory: project.path, fn: () => openedTask() })
  await unavailableModel(project.path)
  await Instance.disposeAll()
  const route = `/task/${task.id}/archive`
  const archived = await request(project.path, route, { archived: true, surface: "api", reason: "Operator archives original task" })
  expect({ status: archived.status, body: await archived.json() }).toEqual({ status: 200, body: true })
  const projection = () => Database.use(db => ({
    task: db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, task.id)).get(),
    lifecycle: taskLifecycleProjectionInTransaction(db, task.id),
  }))
  const terminal = await Instance.provideProjectIdentity({ directory: project.path, fn: projection })
  expect(terminal).toMatchObject({ task: { id: task.id, time_archived: expect.any(Number) }, lifecycle: { status: "cancelled" } })
  const restored = await request(project.path, route, { archived: false })
  expect({ status: restored.status, body: await restored.json() }).toEqual({ status: 200, body: true })
  const final = await Instance.provideProjectIdentity({ directory: project.path, fn: projection })
  expect({ archived: final.task?.time_archived, lifecycle: final.lifecycle }).toEqual({ archived: null, lifecycle: terminal.lifecycle })
}, 60_000)

test("cold Mission archive closes its original child Task and restoration retains the closed occurrence", async () => {
  await using project = await memoryProject("archive-mission")
  const fixture = await Instance.provideProjectIdentity({ directory: project.path, fn: async () => {
    const mission = await ensureMissionSession({ missionID: "archive-original-mission", defaultCwd: project.path, productPillar: "work", heldExpertSquadIDs: ["base"] })
    return { mission, task: await openedTask(mission) }
  } })
  await unavailableModel(project.path)
  await Instance.disposeAll()
  const route = `/mission/${fixture.mission.missionID}/archive`
  const archived = await request(project.path, route, { archived: true, surface: "api", reason: "Operator archives original mission" })
  expect({ status: archived.status, body: await archived.json() }).toMatchObject({
    status: 200, body: { sessionID: fixture.mission.id, missionID: fixture.mission.missionID, archived: expect.any(Number) },
  })
  const projection = () => ({
    closure: currentMissionExecutionClosure(fixture.mission.id),
    task: Database.use(db => taskLifecycleProjectionInTransaction(db, fixture.task.id)),
  })
  const terminal = await Instance.provideProjectIdentity({ directory: project.path, fn: projection })
  expect(terminal).toMatchObject({ closure: { state: "closed", source: "mission.archive" }, task: { status: "cancelled" } })
  const restored = await request(project.path, route, { archived: false })
  expect({ status: restored.status, body: await restored.json() }).toMatchObject({ status: 200, body: { sessionID: fixture.mission.id } })
  expect(await Instance.provideProjectIdentity({ directory: project.path, fn: projection })).toEqual(terminal)
}, 60_000)
