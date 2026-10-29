import { afterEach, describe, expect, test } from "bun:test"
import { Hono } from "hono"
import { randomUUID } from "node:crypto"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Database } from "@/storage/db"
import { EngineTaskTable } from "@/engine/engine.sql"
import { appendTaskOpenedInTransaction } from "@/engine/task-lifecycle"
import { ensureMissionSession } from "@/mission/session"
import { ProtocolStore } from "@/protocol/store"
import { Identifier } from "@/id/id"
import { UsageLedger } from "@/usage"
import { type ContinuousGoalOwner } from "@/continuous-goal/schema"
import {
  captureContinuousGoalUsage,
  createContinuousGoal,
  goalOwnerForAgent,
  goalScopeSessionIDs,
  inheritedContinuousGoal,
  readContinuousGoal,
  resolveGoalOwner,
  updateContinuousGoal,
  type GoalOwner,
} from "@/continuous-goal/store"
import { ContinuousGoalRoutes } from "@/server/routes/continuous-goal"
import { serverErrorResponse } from "@/server/error-handler"
import { ContinuousGoalTools } from "@/tool/continuous-goal"
import { Tool } from "@/tool/tool"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)

async function ownerFixture(kind: ContinuousGoalOwner["kind"], mission?: GoalOwner) {
  if (kind === "task") {
    const session = await Session.create({ kind: "root", title: "Independent Task goal audit" })
    const id = Identifier.ascending("task")
    Database.immediateTransaction((db) => {
      db.insert(EngineTaskTable)
        .values({
          id,
          project_id: Instance.project.id,
          session_id: session.id,
          source: mission ? "mission" : "test",
          product_pillar: "code",
          title: "Independent Task goal audit",
          request: "Verify durable identity",
          time_created: Date.now(),
          time_updated: Date.now(),
          ...(mission
            ? { metadata: { actor: "mission", mission: { id: mission.missionID, session_id: mission.id } } }
            : {}),
        })
        .run()
      appendTaskOpenedInTransaction({ db, taskID: id, sessionID: session.id, now: Date.now(), source: "test" })
    })
    const agent = await Session.create({ kind: "orchestrator", parentID: session.id })
    return { owner: resolveGoalOwner({ kind, id }), session, agent }
  }
  if (kind === "mission") {
    const missionID = randomUUID()
    const session = await ensureMissionSession({
      missionID,
      defaultCwd: Instance.directory,
      productPillar: "work",
      heldExpertSquadIDs: ["base"],
    })
    Database.immediateTransaction(() =>
      ProtocolStore.appendEventInTransaction({
        kind: "event",
        type: "mission.execution.opened",
        aggregate: "session",
        aggregate_id: session.id,
        source: "mission.wake",
        correlation_id: randomUUID(),
        payload: { missionID, requestID: "audit-open", requestFingerprint: "c".repeat(64) },
      }),
    )
    return { owner: resolveGoalOwner({ kind, id: session.id }), session, agent: session }
  }
  const session = await Session.create({ kind: "assistant", title: "Independent Chat goal audit" })
  return { owner: resolveGoalOwner({ kind, id: session.id }), session, agent: session }
}

function goalApp() {
  return new Hono().onError(serverErrorResponse).route("/continuous-goal", ContinuousGoalRoutes())
}

function goalRequest(app: ReturnType<typeof goalApp>, owner: ContinuousGoalOwner, method: string, body?: unknown) {
  return app.request(`/continuous-goal/${owner.kind}/${owner.id}`, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

function recordUsage(sessionID: string, total: number, onRecorded?: (id: string) => void) {
  UsageLedger.record({
    providerID: "audit-provider",
    modelID: "audit-model",
    sessionID,
    purpose: "session",
    tokens: { total, input: total - 7, output: 2, reasoning: 1, cache: { read: 3, write: 1 } },
    costUSD: 0,
    billing: { status: "unpriced" },
    onRecorded,
  })
}

async function toolExecute(id: string, sessionID: string, args: unknown) {
  const tool = await ContinuousGoalTools.find((candidate) => candidate.id === id)!.init()
  return tool.execute(args as never, {
    sessionID,
    messageID: Identifier.ascending("message"),
    agent: "audit",
    callID: randomUUID(),
    abort: new AbortController().signal,
    messages: [],
    executionSurface: Tool.executionSurface([id], []),
    metadata() {},
  })
}

describe("independent continuous goal persistence and authority audit", () => {
  for (const kind of ["chat", "task", "mission"] as const) {
    test(`${kind}: real HTTP mutation, native Tool read, replay and revision error share persisted state`, async () => {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const { owner, agent } = await ownerFixture(kind)
          const app = goalApp()
          const input = {
            requestID: "http-create",
            objective: "  Verify one objective  ",
            tokenBudget: 80,
            turnBudget: 3,
          }
          const created = await goalRequest(app, owner, "POST", input)
          expect(created.status).toBe(200)
          const goal = await created.json()
          expect(goal).toMatchObject({
            objective: "Verify one objective",
            owner: { kind, id: owner.id },
            status: "active",
            tokensUsed: 0,
            turnsAccepted: 0,
          })
          expect(goalOwnerForAgent(agent.id)).toEqual(owner)
          expect(JSON.parse((await toolExecute("get_continuous_goal", agent.id, {})).output)).toEqual(goal)
          const replay = await goalRequest(app, owner, "POST", input)
          expect(await replay.json()).toEqual(goal)
          const wrongInput = await goalRequest(app, owner, "POST", { ...input, objective: "Another objective" })
          expect(wrongInput.status).toBe(409)
          expect(await wrongInput.json()).toMatchObject({ name: "ContinuousGoalError", data: { code: "conflict" } })
          const update = {
            requestID: "http-pause",
            goalID: goal.id,
            expectedRevision: goal.revision,
            status: "paused",
            reason: "User requested pause",
          }
          const paused = await goalRequest(app, owner, "PATCH", update)
          expect(paused.status).toBe(200)
          const current = await paused.json()
          expect(current).toMatchObject({ id: goal.id, status: "paused", tokenBudget: 80, turnBudget: 3 })
          expect(await (await goalRequest(app, owner, "PATCH", update)).json()).toEqual(current)
          const stale = await goalRequest(app, owner, "PATCH", { ...update, requestID: "stale", status: "active" })
          expect(stale.status).toBe(409)
          expect(await stale.json()).toMatchObject({ name: "ContinuousGoalError", data: { code: "revision_conflict" } })
          expect(await (await goalRequest(app, owner, "GET")).json()).toEqual(current)
        },
      })
    })

    test(`${kind}: late descendant settlement retains its original goal across completion and archive`, async () => {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const { owner, session, agent } = await ownerFixture(kind)
          const child = await Session.create({ kind: "build", parentID: agent.id })
          const input = { requestID: "first", objective: "First exact settlement", tokenBudget: 100 }
          const first = createContinuousGoal(owner, input, "user")
          const firstCapture = captureContinuousGoalUsage(child.id)
          expect(typeof firstCapture).toBe("function")
          updateContinuousGoal(
            owner,
            {
              requestID: "first-done",
              goalID: first.id,
              expectedRevision: first.revision,
              status: "complete",
              reason: "Result verified",
            },
            agent.id,
          )
          const second = createContinuousGoal(
            owner,
            { requestID: "second", objective: "Second exact settlement", tokenBudget: 100 },
            "user",
          )
          const secondCapture = captureContinuousGoalUsage(child.id)
          expect(typeof secondCapture).toBe("function")
          await Session.setArchived({ sessionID: session.id, time: 0 })
          const archivedRead = await goalRequest(goalApp(), owner, "GET")
          expect(archivedRead.status).toBe(200)
          expect(await archivedRead.json()).toMatchObject({
            id: second.id,
            objective: second.objective,
            status: "paused",
            reason: "owner_archived",
          })
          recordUsage(child.id, 17, firstCapture)
          recordUsage(child.id, 31, secondCapture)
          await Session.setArchived({ sessionID: session.id, time: null })
          expect(createContinuousGoal(owner, input, "user")).toMatchObject({
            id: first.id,
            status: "complete",
            tokensUsed: 17,
          })
          expect(readContinuousGoal(owner)).toMatchObject({
            id: second.id,
            status: "paused",
            reason: "owner_archived",
            tokensUsed: 31,
            tokenBudget: 100,
          })
          expect(goalScopeSessionIDs(owner).includes(child.id)).toBe(true)
        },
      })
    })

    test(`${kind}: descendant inherits exact accounting scope and gets a typed mutation refusal`, async () => {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const { owner, agent } = await ownerFixture(kind)
          const child = await Session.create({ kind: "build", parentID: agent.id })
          const goal = createContinuousGoal(owner, { requestID: "owner-goal", objective: "Shared evidence" }, "user")
          expect(inheritedContinuousGoal(child.id)).toEqual(goal)
          await expect(
            toolExecute("create_continuous_goal", child.id, { objective: "Parallel child goal" }),
          ).rejects.toMatchObject({ name: "ContinuousGoalError", data: { code: "owner_forbidden" } })
          await expect(
            toolExecute("update_continuous_goal", child.id, {
              goalID: goal.id,
              expectedRevision: goal.revision,
              status: "complete",
              reason: "Child claim",
            }),
          ).rejects.toMatchObject({ name: "ContinuousGoalError", data: { code: "owner_forbidden" } })
          recordUsage(child.id, 23, captureContinuousGoalUsage(child.id))
          expect(readContinuousGoal(owner)).toMatchObject({ id: goal.id, status: "active", tokensUsed: 23 })
        },
      })
    })

    test(`${kind}: retained owner deletion returns unavailable while preserving exact late usage`, async () => {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const { owner, session } = await ownerFixture(kind)
          if (kind === "chat")
            await Session.mergeMetadata({
              sessionID: session.id,
              patch: { globalChatStart: { requestID: "audit-retained-chat" } },
            })
          const goal = createContinuousGoal(owner, { requestID: "delete", objective: "Retain audit evidence" }, "user")
          const captured = captureContinuousGoalUsage(session.id)
          if (kind === "task")
            Database.immediateTransaction(() =>
              ProtocolStore.appendEventInTransaction({
                kind: "event",
                type: "task.completed",
                aggregate: "task",
                aggregate_id: owner.id,
                session_id: session.id,
                source: "test",
                payload: { execution_epoch: 1 },
              }),
            )
          const { EngineService } = await import("@/task-api")
          const result = await EngineService.deleteSession(session.id, {
            projectID: owner.projectID,
            deleteTasks: kind === "task",
          })
          expect(result).toMatchObject({ status: "tombstoned", sessionHistoryRetained: true })
          recordUsage(session.id, 37, captured)
          expect(readContinuousGoal(owner)).toMatchObject({
            id: goal.id,
            status: "paused",
            reason: "owner_unavailable",
            tokensUsed: 37,
          })
          for (const method of ["GET", "PATCH"]) {
            const response = await goalRequest(
              goalApp(),
              owner,
              method,
              method === "PATCH"
                ? {
                    requestID: "deleted-complete",
                    goalID: goal.id,
                    expectedRevision: goal.revision,
                    status: "complete",
                    reason: "Attempt after retained deletion",
                  }
                : undefined,
            )
            expect(response.status).toBe(409)
            expect(await response.json()).toMatchObject({
              name: "ContinuousGoalError",
              data: { code: "owner_unavailable" },
            })
          }
        },
      })
    })
  }

  test("archived Mission retains unresolved scope ownership over its child Task", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const mission = await ownerFixture("mission")
        const task = await ownerFixture("task", mission.owner)
        const goal = createContinuousGoal(
          mission.owner,
          { requestID: "mission", objective: "One Mission objective" },
          "user",
        )
        await Session.setArchived({ sessionID: mission.session.id, time: Date.now() })
        const response = await goalRequest(goalApp(), task.owner, "POST", {
          requestID: "task",
          objective: "Overlapping Task objective",
        })
        expect(response.status).toBe(409)
        expect(await response.json()).toMatchObject({
          name: "ContinuousGoalError",
          data: { code: "overlapping_owner" },
        })
        expect(inheritedContinuousGoal(task.agent.id)).toMatchObject({
          id: goal.id,
          status: "paused",
          reason: "owner_archived",
        })
        recordUsage(task.agent.id, 41, captureContinuousGoalUsage(task.agent.id))
        await Session.setArchived({ sessionID: mission.session.id, time: null })
        const restored = readContinuousGoal(mission.owner)!
        expect(restored).toMatchObject({ id: goal.id, status: "paused", reason: "owner_archived", tokensUsed: 41 })
        expect(
          updateContinuousGoal(
            mission.owner,
            {
              requestID: "resume",
              goalID: goal.id,
              expectedRevision: restored.revision,
              status: "active",
              reason: "User explicitly resumed",
            },
            "user",
          ),
        ).toMatchObject({ id: goal.id, status: "active" })
        expect(inheritedContinuousGoal(task.agent.id)?.id).toBe(goal.id)
      },
    })
  })

  test("archived child Task retains unresolved scope ownership when Mission requests a goal", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const mission = await ownerFixture("mission")
        const task = await ownerFixture("task", mission.owner)
        const goal = createContinuousGoal(task.owner, { requestID: "task", objective: "One Task objective" }, "user")
        Database.immediateTransaction(() =>
          ProtocolStore.appendEventInTransaction({
            kind: "event",
            type: "task.completed",
            aggregate: "task",
            aggregate_id: task.owner.id,
            session_id: task.session.id,
            source: "test",
            payload: { execution_epoch: 1 },
          }),
        )
        const { EngineService } = await import("@/task-api")
        await EngineService.setTaskArchived(task.owner.id, true)
        const response = await goalRequest(goalApp(), mission.owner, "POST", {
          requestID: "mission",
          objective: "Overlapping Mission objective",
        })
        expect(response.status).toBe(409)
        expect(await response.json()).toMatchObject({
          name: "ContinuousGoalError",
          data: { code: "overlapping_owner" },
        })
        await EngineService.setTaskArchived(task.owner.id, false)
        const restored = readContinuousGoal(task.owner)!
        expect(restored).toMatchObject({ id: goal.id, status: "paused", reason: "owner_archived" })
        expect(
          updateContinuousGoal(
            task.owner,
            {
              requestID: "resume",
              goalID: goal.id,
              expectedRevision: restored.revision,
              status: "active",
              reason: "User explicitly resumed",
            },
            "user",
          ),
        ).toMatchObject({ id: goal.id, status: "active" })
        expect(inheritedContinuousGoal(task.agent.id)?.id).toBe(goal.id)
      },
    })
  })

  test("public routes resolve Project ownership before reading or mutating a foreign goal", async () => {
    await using first = await memoryProject("independent-goal-first")
    await using second = await memoryProject("independent-goal-second")
    const owners = await Instance.provide({
      directory: first.path,
      fn: async () => {
        const result = []
        for (const kind of ["chat", "task", "mission"] as const) {
          const { owner } = await ownerFixture(kind)
          const goal = createContinuousGoal(owner, { requestID: "local", objective: "Current Project goal" }, "user")
          result.push({ owner, goal })
        }
        return result
      },
    })
    await Instance.provide({
      directory: second.path,
      fn: async () => {
        for (const { owner, goal } of owners) {
          for (const method of ["GET", "POST", "PATCH"]) {
            const response = await goalRequest(
              goalApp(),
              owner,
              method,
              method === "POST"
                ? { requestID: "foreign", objective: "Different Project" }
                : method === "PATCH"
                  ? {
                      requestID: "foreign",
                      goalID: goal.id,
                      expectedRevision: goal.revision,
                      status: "complete",
                      reason: "Different Project",
                    }
                  : undefined,
            )
            expect(response.status).toBe(409)
            expect(await response.json()).toMatchObject({
              name: "ContinuousGoalError",
              data: { code: "owner_unavailable" },
            })
          }
        }
      },
    })
  })
})
