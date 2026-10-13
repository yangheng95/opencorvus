import { afterEach, describe, expect, test } from "bun:test"
import { Hono } from "hono"
import { randomUUID } from "node:crypto"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Database } from "@/storage/db"
import { ensureMissionSession } from "@/mission/session"
import { EngineTaskTable } from "@/engine/engine.sql"
import { appendTaskOpenedInTransaction, appendTaskReopenedInTransaction } from "@/engine/task-lifecycle"
import { ProtocolStore } from "@/protocol/store"
import { Identifier } from "@/id/id"
import { SessionStatus } from "@/session/status"
import { ensureTaskMessageProtocolBridge } from "@/orchestrator/protocol/message-bridge"
import { UsageLedger } from "@/usage"
import { ContinuousGoalError } from "@/continuous-goal/schema"
import {
  createContinuousGoal,
  readContinuousGoal,
  updateContinuousGoal,
  resolveGoalOwner,
  goalOwnerForAgent,
  captureContinuousGoalUsage,
  inheritedContinuousGoal,
  goalScopeSessionIDs,
  requestGoalContinuation,
  projectGoalOwners,
} from "@/continuous-goal/store"
import { ContinuousGoalRoutes } from "@/server/routes/continuous-goal"
import { goalContinuationFrontier, reconcileContinuousGoal } from "@/continuous-goal/controller"
import { serverErrorResponse } from "@/server/error-handler"
import { ContinuousGoalTools } from "@/tool/continuous-goal"
import { Tool } from "@/tool/tool"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)

function errorCode(run: () => unknown) {
  try {
    run()
  } catch (error) {
    if (ContinuousGoalError.isInstance(error as Error))
      return (error as InstanceType<typeof ContinuousGoalError>).data.code
    throw error
  }
  throw new Error("Expected a typed goal contract error.")
}

function recordUsage(sessionID: string, total: number, onRecorded?: (id: string) => void) {
  UsageLedger.record({
    providerID: "contract-provider",
    modelID: "contract-model",
    sessionID,
    purpose: "session",
    tokens: { total, input: total - 2, output: 2, reasoning: 0, cache: { read: 0, write: 0 } },
    costUSD: 0,
    billing: { status: "unpriced" },
    onRecorded,
  })
}

async function taskOwner(mission?: { id: string; missionID: string }) {
  const root = await Session.create({ kind: "root", title: "Goal contract Task" })
  const id = Identifier.ascending("task")
  Database.immediateTransaction((db) => {
    db.insert(EngineTaskTable)
      .values({
        id,
        project_id: Instance.project.id,
        session_id: root.id,
        source: mission ? "mission" : "test",
        product_pillar: "code",
        title: "Goal contract Task",
        request: "Deliver result",
        time_created: Date.now(),
        time_updated: Date.now(),
        ...(mission
          ? { metadata: { actor: "mission", mission: { id: mission.missionID, session_id: mission.id } } }
          : {}),
      })
      .run()
    appendTaskOpenedInTransaction({ db, taskID: id, sessionID: root.id, now: Date.now(), source: "test" })
  })
  return { owner: resolveGoalOwner({ kind: "task", id }), root }
}

async function missionOwner() {
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
      payload: { missionID, requestID: "goal-test-open", requestFingerprint: "a".repeat(64) },
    }),
  )
  return { owner: resolveGoalOwner({ kind: "mission", id: session.id }), session, missionID }
}

describe("durable continuous goal contracts", () => {
  test("Chat creation, exact replay, pause, resume and completion persist real revisions", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant" })
        const owner = resolveGoalOwner({ kind: "chat", id: session.id })
        const input = { requestID: "create", objective: "Produce and verify a result", tokenBudget: 50, turnBudget: 3 }
        const goal = createContinuousGoal(owner, input, "user")
        expect(createContinuousGoal(owner, input, "user")).toEqual(goal)
        expect(errorCode(() => createContinuousGoal(owner, { ...input, objective: "different" }, "user"))).toBe(
          "conflict",
        )
        expect(projectGoalOwners()).toEqual([{ kind: "chat", id: session.id }])
        const paused = updateContinuousGoal(
          owner,
          {
            requestID: "pause",
            goalID: goal.id,
            expectedRevision: goal.revision,
            status: "paused",
            reason: "User requested pause",
          },
          "user",
        )
        expect(paused.status).toBe("paused")
        expect(await reconcileContinuousGoal(owner)).toBe("paused")
        expect(errorCode(() => requestGoalContinuation(owner, paused, "settled"))).toBe("inactive")
        const resumed = updateContinuousGoal(
          owner,
          {
            requestID: "resume",
            goalID: goal.id,
            expectedRevision: paused.revision,
            status: "active",
            reason: "User requested resume",
          },
          "user",
        )
        expect(resumed).toMatchObject({ id: goal.id, status: "active", tokensUsed: 0, turnsAccepted: 0 })
        const done = updateContinuousGoal(
          owner,
          {
            requestID: "complete",
            goalID: goal.id,
            expectedRevision: resumed.revision,
            status: "complete",
            reason: "Verified output",
          },
          session.id,
        )
        expect(readContinuousGoal(owner)).toEqual(done)
        expect(done.status).toBe("complete")
        expect(await reconcileContinuousGoal(owner)).toBe("complete")
      },
    })
  })

  test("one exact continuation reserves one turn and reports the explicit budget terminal", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant" })
        const owner = resolveGoalOwner({ kind: "chat", id: session.id })
        const goal = createContinuousGoal(
          owner,
          { requestID: "create", objective: "Bounded continuation", turnBudget: 1 },
          "user",
        )
        const results = await Promise.all(
          Array.from({ length: 6 }, async () => requestGoalContinuation(owner, goal, "reply-1")),
        )
        expect(new Set(results.map((row) => row.id)).size).toBe(1)
        expect(readContinuousGoal(owner)).toMatchObject({
          turnsAccepted: 1,
          status: "budget_limited",
          reason: "turn_budget",
        })
        expect(results[0]!.goalID).toBe(goal.id)
        expect(errorCode(() => requestGoalContinuation(owner, goal, "reply-2"))).toBe("inactive")
        const paused = updateContinuousGoal(
          owner,
          {
            requestID: "pause",
            goalID: goal.id,
            expectedRevision: goal.revision,
            status: "paused",
            reason: "User pause",
          },
          "user",
        )
        expect(errorCode(() => requestGoalContinuation(owner, goal, "reply-after-pause"))).toBe("revision_conflict")
        expect(await reconcileContinuousGoal(owner)).toBe("paused")
        expect(paused).toMatchObject({ status: "paused", reason: "User pause", turnsAccepted: 1 })
        const resumed = updateContinuousGoal(
          owner,
          {
            requestID: "resume",
            goalID: goal.id,
            expectedRevision: paused.revision,
            status: "active",
            turnBudget: 2,
            reason: "User increased automatic turn budget",
          },
          "user",
        )
        expect(resumed).toMatchObject({ status: "active", turnsAccepted: 1, turnBudget: 2 })
        expect(requestGoalContinuation(owner, resumed, "reply-2").number).toBe(2)
      },
    })
  })

  test("usage references count descendant requests and their late completion exactly once", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant" })
        const child = await Session.create({ kind: "assistant", parentID: session.id })
        const owner = resolveGoalOwner({ kind: "chat", id: session.id })
        recordUsage(session.id, 100)
        const goal = createContinuousGoal(
          owner,
          { requestID: "create", objective: "Meter exact requests", tokenBudget: 35 },
          "user",
        )
        const parentUsage = captureContinuousGoalUsage(session.id)
        const childUsage = captureContinuousGoalUsage(child.id)
        recordUsage(session.id, 20, parentUsage)
        recordUsage(child.id, 17, childUsage)
        expect(readContinuousGoal(owner)).toMatchObject({
          tokensUsed: 37,
          status: "budget_limited",
          reason: "token_budget",
        })
        const lateUsage = captureContinuousGoalUsage(child.id)
        updateContinuousGoal(
          owner,
          {
            requestID: "complete",
            goalID: goal.id,
            expectedRevision: goal.revision,
            status: "complete",
            reason: "Result verified",
          },
          session.id,
        )
        recordUsage(child.id, 8, lateUsage)
        recordUsage(session.id, 200)
        expect(readContinuousGoal(owner)).toMatchObject({ tokensUsed: 45, status: "complete" })
        const next = createContinuousGoal(owner, { requestID: "next", objective: "Another result" }, "user")
        expect(next).toMatchObject({ tokensUsed: 0, turnsAccepted: 0, status: "active" })
      },
    })
  })

  test("Task owner identity and cancellation project distinct goal facts", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { owner, root } = await taskOwner()
        const scheduler = await Session.create({ kind: "orchestrator", parentID: root.id })
        const worker = await Session.create({ kind: "build", parentID: scheduler.id })
        const goal = createContinuousGoal(owner, { requestID: "create", objective: "Complete Task outcome" }, "user")
        expect(goalOwnerForAgent(scheduler.id)).toEqual(owner)
        expect(inheritedContinuousGoal(worker.id)?.id).toBe(goal.id)
        expect(errorCode(() => goalOwnerForAgent(worker.id))).toBe("owner_forbidden")
        Database.immediateTransaction(() =>
          ProtocolStore.appendEventInTransaction({
            kind: "event",
            type: "task.cancelled",
            aggregate: "task",
            aggregate_id: owner.id,
            session_id: root.id,
            source: "test",
            payload: { execution_epoch: 1 },
          }),
        )
        expect(readContinuousGoal(owner)).toMatchObject({ id: goal.id, status: "paused", reason: "owner_cancelled" })
        const reopened = Database.immediateTransaction((db) =>
          appendTaskReopenedInTransaction({
            db,
            taskID: owner.id,
            sessionID: root.id,
            now: Date.now(),
            source: "test.operator",
          }),
        )
        expect(reopened).toMatchObject({ epoch: 2, status: "active" })
        expect(readContinuousGoal(owner)).toMatchObject({ status: "paused", reason: "owner_cancelled" })
        expect(await reconcileContinuousGoal(owner)).toBe("paused")
        const resumed = updateContinuousGoal(
          owner,
          {
            requestID: "resume",
            goalID: goal.id,
            expectedRevision: goal.revision,
            status: "active",
            reason: "User explicitly resumed the goal after reopening the Task",
          },
          "user",
        )
        expect(resumed).toMatchObject({ id: goal.id, status: "active" })
      },
    })
  })

  test("Mission includes its exact child Tasks and returns a typed overlapping-owner error", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { owner, session, missionID } = await missionOwner()
        const task = await taskOwner({ id: session.id, missionID })
        const worker = await Session.create({ kind: "build", parentID: task.root.id })
        const goal = createContinuousGoal(
          owner,
          { requestID: "create", objective: "Coordinate accepted deliveries" },
          "user",
        )
        expect(goalScopeSessionIDs(owner).sort()).toEqual([session.id, task.root.id, worker.id].sort())
        recordUsage(worker.id, 61, captureContinuousGoalUsage(worker.id))
        expect(readContinuousGoal(owner)).toMatchObject({ tokensUsed: 61, status: "active" })
        expect(
          errorCode(() =>
            createContinuousGoal(
              task.owner,
              {
                requestID: "nested",
                objective: "Overlap",
              },
              "user",
            ),
          ),
        ).toBe("overlapping_owner")
        expect(inheritedContinuousGoal(worker.id)?.id).toBe(goal.id)
      },
    })
  })

  test("public route and native Tool share one exact durable goal", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant" })
        const app = new Hono().onError(serverErrorResponse).route("/continuous-goal", ContinuousGoalRoutes())
        const url = "/continuous-goal/chat/" + session.id
        const response = await app.request(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ requestID: "http-create", objective: "One source", turnBudget: 2 }),
        })
        expect(response.status).toBe(200)
        const body = await response.json()
        const tool = await ContinuousGoalTools.find((tool) => tool.id === "get_continuous_goal")!.init()
        const result = await tool.execute(
          {},
          {
            sessionID: session.id,
            messageID: Identifier.ascending("message"),
            agent: "chat",
            callID: "read",
            abort: new AbortController().signal,
            messages: [],
            executionSurface: Tool.executionSurface(["get_continuous_goal"], []),
            metadata() {},
          },
        )
        expect(JSON.parse(result.output)).toEqual(body)
        const conflict = await app.request(url, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            requestID: "wrong",
            goalID: body.id,
            expectedRevision: "stale",
            status: "paused",
            reason: "Pause",
          }),
        })
        expect(conflict.status).toBe(409)
        expect(await conflict.json()).toMatchObject({
          name: "ContinuousGoalError",
          data: { code: "revision_conflict" },
        })
      },
    })
  })

  test("explicit blocking wins over quota and resuming preserves settled usage", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant" })
        const owner = resolveGoalOwner({ kind: "chat", id: session.id })
        const goal = createContinuousGoal(
          owner,
          { requestID: "create", objective: "Await an external decision", tokenBudget: 10 },
          "user",
        )
        recordUsage(session.id, 12, captureContinuousGoalUsage(session.id))
        const blocked = updateContinuousGoal(
          owner,
          {
            requestID: "block",
            goalID: goal.id,
            expectedRevision: goal.revision,
            status: "blocked",
            reason: "External decision required",
          },
          session.id,
        )
        expect(blocked).toMatchObject({ status: "blocked", tokensUsed: 12, reason: "External decision required" })
        expect(await reconcileContinuousGoal(owner)).toBe("blocked")
        const resumed = updateContinuousGoal(
          owner,
          {
            requestID: "resume",
            goalID: goal.id,
            expectedRevision: blocked.revision,
            status: "active",
            reason: "User supplied decision",
          },
          "user",
        )
        expect(resumed).toMatchObject({ status: "budget_limited", tokensUsed: 12, reason: "token_budget" })
        expect(await reconcileContinuousGoal(owner)).toBe("budget_limited")
      },
    })
  })

  test("different Projects retain exact independent owners and metering", async () => {
    await using first = await memoryProject("goal-first-project")
    await using second = await memoryProject("goal-second-project")
    const firstOwner = await Instance.provide({
      directory: first.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Same title" })
        const owner = resolveGoalOwner({ kind: "chat", id: session.id })
        createContinuousGoal(owner, { requestID: "create", objective: "Same objective" }, "user")
        recordUsage(session.id, 17, captureContinuousGoalUsage(session.id))
        return owner
      },
    })
    await Instance.provide({
      directory: second.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Same title" })
        const owner = resolveGoalOwner({ kind: "chat", id: session.id })
        createContinuousGoal(owner, { requestID: "create", objective: "Same objective" }, "user")
        recordUsage(session.id, 29, captureContinuousGoalUsage(session.id))
        expect(projectGoalOwners()).toEqual([{ kind: "chat", id: session.id }])
        expect(readContinuousGoal(owner)).toMatchObject({
          status: "active",
          tokensUsed: 29,
          projectID: owner.projectID,
        })
        expect(errorCode(() => resolveGoalOwner(firstOwner))).toBe("owner_unavailable")
      },
    })
    await Instance.provide({
      directory: first.path,
      fn: async () => {
        expect(readContinuousGoal(firstOwner)).toMatchObject({
          status: "active",
          tokensUsed: 17,
          projectID: firstOwner.projectID,
        })
      },
    })
  })

  test("a settled assistant batch advances the exact latest input frontier", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant" })
        const owner = resolveGoalOwner({ kind: "chat", id: session.id })
        const first = Identifier.ascending("message")
        const second = Identifier.ascending("message")
        const reply = Identifier.ascending("message")
        const now = Date.now()
        for (const [index, id] of [first, second].entries())
          await Session.updateMessage({
            id,
            sessionID: session.id,
            role: "user",
            author: "user",
            agent: "chat",
            model: { providerID: "contract-provider", modelID: "contract-model" },
            time: { created: now + index },
          })
        await Session.updateMessage({
          id: reply,
          sessionID: session.id,
          role: "assistant",
          author: "chat",
          agent: "chat",
          parentID: second,
          acceptedInputMessageIDs: [first, second],
          modelID: "contract-model",
          providerID: "contract-provider",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { total: 5, input: 3, output: 2, reasoning: 0, cache: { read: 0, write: 0 } },
          time: { created: now + 2, completed: now + 3 },
          finish: "stop",
        })
        expect(goalContinuationFrontier(owner)).toBe(reply)
        const goal = createContinuousGoal(
          owner,
          { requestID: "create", objective: "Continue the settled batch" },
          "user",
        )
        expect(requestGoalContinuation(owner, goal, goalContinuationFrontier(owner)!)).toMatchObject({
          goalID: goal.id,
          frontier: reply,
          number: 1,
        })
      },
    })
  })

  for (const kind of ["chat", "mission"] as const)
    test(`${kind} reopening preserves cancellation until an explicit goal revision`, async () => {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const selected =
            kind === "mission"
              ? await missionOwner()
              : await (async () => {
                  const session = await Session.create({ kind: "assistant" })
                  return { session, owner: resolveGoalOwner({ kind: "chat", id: session.id }), missionID: undefined }
                })()
          const { owner, session, missionID } = selected
          const goal = createContinuousGoal(
            owner,
            { requestID: "create", objective: "Remain paused until the user resumes this objective" },
            "user",
          )
          if (kind === "chat") {
            ensureTaskMessageProtocolBridge()
            for (const status of [{ type: "terminal", reason: "aborted" }, { type: "idle" }] as const) {
              const inputMessageID = Identifier.ascending("message")
              await Session.updateMessage({
                id: inputMessageID,
                sessionID: session.id,
                role: "user",
                author: "user",
                agent: "chat",
                model: { providerID: "contract-provider", modelID: "contract-model" },
                time: { created: Date.now() },
              })
              await SessionStatus.set(session.id, status, { inputMessageID })
            }
          } else
            Database.immediateTransaction(() => {
              const append = (type: string, payload: Record<string, unknown>, source: string) =>
                ProtocolStore.appendEventInTransaction({
                  kind: "event",
                  type,
                  aggregate: "session",
                  aggregate_id: session.id,
                  source,
                  correlation_id: randomUUID(),
                  emitted_at: goal.createdAt,
                  payload,
                })
              append(
                "mission.execution.closed",
                {
                  missionID,
                  requestID: "close",
                  provenance: { kind: "request", surface: "api", reason: "User cancelled" },
                },
                "mission.abort",
              )
              append(
                "mission.execution.opened",
                { missionID, requestID: "reopen", requestFingerprint: "b".repeat(64) },
                "mission.wake",
              )
            })
          expect(readContinuousGoal(owner)).toMatchObject({
            id: goal.id,
            status: "paused",
            reason: kind === "chat" ? "owner_cancelled" : "mission_closed",
          })
          expect(await reconcileContinuousGoal(owner)).toBe("paused")
          const resumed = updateContinuousGoal(
            owner,
            {
              requestID: "resume",
              goalID: goal.id,
              expectedRevision: goal.revision,
              status: "active",
              reason: "User explicitly resumed the continuous goal",
            },
            "user",
          )
          expect(resumed).toMatchObject({ id: goal.id, status: "active", turnsAccepted: 0, tokensUsed: 0 })
        },
      })
    })

  test("archive and restore retain one paused goal on the exact owner", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant" })
        const child = await Session.create({ kind: "assistant", parentID: session.id })
        const owner = resolveGoalOwner({ kind: "chat", id: session.id })
        const goal = createContinuousGoal(
          owner,
          { requestID: "create", objective: "Resume only explicitly after archive" },
          "user",
        )
        await Session.setArchived({ sessionID: child.id, time: Date.now() })
        expect(readContinuousGoal(owner)).toMatchObject({ id: goal.id, status: "active", revision: goal.revision })
        await Session.setArchived({ sessionID: session.id, time: Date.now() })
        await Session.setArchived({ sessionID: session.id, time: Date.now() })
        await Session.setArchived({ sessionID: session.id, time: null })
        const restored = readContinuousGoal(owner)!
        expect(restored).toMatchObject({ id: goal.id, status: "paused", reason: "owner_archived" })
        expect(await reconcileContinuousGoal(owner)).toBe("paused")
        expect(
          updateContinuousGoal(
            owner,
            {
              requestID: "resume",
              goalID: goal.id,
              expectedRevision: restored.revision,
              status: "active",
              reason: "User resumed the archived objective",
            },
            "user",
          ),
        ).toMatchObject({ status: "active", id: goal.id })
      },
    })
  })

  test("the production Task archive entry retains pause when a completed Task is restored", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { owner, root } = await taskOwner()
        const goal = createContinuousGoal(
          owner,
          { requestID: "create", objective: "Continue only after explicit resume" },
          "user",
        )
        Database.immediateTransaction(() =>
          ProtocolStore.appendEventInTransaction({
            kind: "event",
            type: "task.completed",
            aggregate: "task",
            aggregate_id: owner.id,
            session_id: root.id,
            source: "test",
            payload: { execution_epoch: 1 },
          }),
        )
        const { EngineService } = await import("@/task-api")
        await EngineService.setTaskArchived(owner.id, true)
        await EngineService.setTaskArchived(owner.id, false)
        expect(readContinuousGoal(owner)).toMatchObject({ id: goal.id, status: "paused", reason: "owner_archived" })
        expect(await reconcileContinuousGoal(owner)).toBe("paused")
      },
    })
  }, 20_000)
})
