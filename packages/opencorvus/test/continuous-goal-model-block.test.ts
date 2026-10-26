import { afterEach, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { ConfigPaths } from "@/config/paths"
import { Scheduler } from "@/scheduler"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Database, sql } from "@/storage/db"
import { EngineTaskTable } from "@/engine/engine.sql"
import { appendTaskOpenedInTransaction } from "@/engine/task-lifecycle"
import { ensureMissionSession } from "@/mission/session"
import { ProtocolStore } from "@/protocol/store"
import { Identifier } from "@/id/id"
import { UsageLedger } from "@/usage"
import { ContinuousGoalError, type ContinuousGoalOwner } from "@/continuous-goal/schema"
import {
  captureContinuousGoalUsage,
  createContinuousGoal,
  readContinuousGoal,
  resolveGoalOwner,
  updateContinuousGoal,
} from "@/continuous-goal/store"
import { initializeContinuousGoals, reconcileContinuousGoal } from "@/continuous-goal/controller"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Scheduler.disposeGlobal()
  await resetMemoryDatabase()
})

async function ownerFor(kind: ContinuousGoalOwner["kind"]) {
  if (kind === "task") {
    const session = await Session.create({ kind: "root" })
    const id = Identifier.ascending("task")
    Database.immediateTransaction((db) => {
      db.insert(EngineTaskTable)
        .values({
          id,
          project_id: Instance.project.id,
          session_id: session.id,
          source: "test",
          product_pillar: "code",
          title: "Model configuration contract",
          request: "Return a result",
          time_created: Date.now(),
          time_updated: Date.now(),
        })
        .run()
      appendTaskOpenedInTransaction({ db, taskID: id, sessionID: session.id, now: Date.now(), source: "test" })
    })
    return resolveGoalOwner({ kind, id })
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
        payload: { missionID, requestID: "model-block-open", requestFingerprint: "b".repeat(64) },
      }),
    )
    return resolveGoalOwner({ kind, id: session.id })
  }
  const session = await Session.create({ kind: "assistant" })
  return resolveGoalOwner({ kind, id: session.id })
}

async function unavailableProjectModel(directory: string) {
  const config = ConfigPaths.projectFile(directory)
  await fs.mkdir(path.dirname(config), { recursive: true })
  await fs.writeFile(config, JSON.stringify({ model: "goal-initialization-unavailable/model" }))
}

async function awaitModelBlock(directory: string, owner: ContinuousGoalOwner) {
  const deadline = Date.now() + 10_000
  let current
  while (Date.now() < deadline) {
    current = await Instance.provideProjectIdentity({ directory, fn: () => readContinuousGoal(resolveGoalOwner(owner)) })
    if (current?.status === "blocked") return current
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  throw new Error(`Goal did not settle its actual model blocker: ${JSON.stringify(current)}`)
}

for (const kind of ["chat", "task", "mission"] as const) {
  test(`${kind} records unavailable Project model admission and preserves explicit retries`, async () => {
    await using project = await memoryProject()
    const initial = await Instance.provideProjectIdentity({ directory: project.path, fn: async () => {
      const owner = await ownerFor(kind)
      const goal = createContinuousGoal(owner, { requestID: "create", objective: "Observe the real model admission", turnBudget: 2 }, "user")
      return { owner, goal }
    } })
    await unavailableProjectModel(project.path)
    await Instance.disposeAll()
    initializeContinuousGoals()
    try {
      const blocked = await awaitModelBlock(project.path, initial.owner)
      expect(blocked).toMatchObject({
        id: initial.goal.id, owner: { kind, id: initial.owner.id }, status: "blocked", reason: "model_unavailable",
        tokensUsed: initial.goal.tokensUsed, turnsAccepted: initial.goal.turnsAccepted, turnBudget: 2,
      })
      await Instance.provideProjectIdentity({ directory: project.path, fn: () => updateContinuousGoal(initial.owner, {
        requestID: "explicit-retry", goalID: blocked.id, expectedRevision: blocked.revision,
        status: "active", reason: "The operator explicitly retries model admission",
      }, "user") })
      expect(await awaitModelBlock(project.path, initial.owner)).toMatchObject({
        id: initial.goal.id, status: "blocked", reason: "model_unavailable",
        tokensUsed: initial.goal.tokensUsed, turnsAccepted: initial.goal.turnsAccepted,
      })
    } finally {
      await Scheduler.disposeGlobal()
    }
  }, 30_000)
}

test("parallel Projects retain their own unavailable-model Goal blockers", async () => {
  await using first = await memoryProject("goal-block-first")
  await using second = await memoryProject("goal-block-second")
  const fixtures = []
  for (const project of [first, second]) {
    const initial = await Instance.provideProjectIdentity({ directory: project.path, fn: async () => {
      const owner = await ownerFor("chat")
      return { owner, goal: createContinuousGoal(owner, { requestID: "create", objective: project.path }, "user") }
    } })
    await unavailableProjectModel(project.path)
    fixtures.push({ directory: project.path, ...initial })
  }
  await Instance.disposeAll()
  initializeContinuousGoals()
  try {
    const blocked = await Promise.all(fixtures.map(fixture => awaitModelBlock(fixture.directory, fixture.owner)))
    expect(blocked.map(goal => ({ id: goal.id, projectID: goal.projectID, status: goal.status, reason: goal.reason })))
      .toEqual(fixtures.map(fixture => ({ id: fixture.goal.id, projectID: fixture.owner.projectID, status: "blocked", reason: "model_unavailable" })))
  } finally {
    await Scheduler.disposeGlobal()
  }
}, 30_000)

for (const kind of ["chat", "task", "mission"] as const) {
  test(`${kind} records a missing model as a durable blocker and preserves usage across explicit retries`, async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const owner = await ownerFor(kind)
        const created = createContinuousGoal(
          owner,
          {
            requestID: "create",
            objective: "Verify the configured model",
            turnBudget: 2,
          },
          "user",
        )
        const capture = captureContinuousGoalUsage(owner.sessionID)!
        UsageLedger.record({
          providerID: "contract",
          modelID: "prior-stream",
          sessionID: owner.sessionID,
          purpose: "session",
          tokens: { total: 17, input: 15, output: 2, reasoning: 0, cache: { read: 0, write: 0 } },
          costUSD: 0,
          billing: { status: "unpriced" },
          onRecorded: capture,
        })
        expect(await reconcileContinuousGoal(owner)).toBe("blocked")
        const blocked = readContinuousGoal(owner)!
        expect(blocked).toMatchObject({
          id: created.id,
          objective: created.objective,
          status: "blocked",
          reason: "model_not_configured",
          tokensUsed: 17,
          turnsAccepted: 0,
          turnBudget: 2,
        })
        expect(await reconcileContinuousGoal(owner)).toBe("blocked")
        expect(readContinuousGoal(owner)).toEqual(blocked)
        const resumed = updateContinuousGoal(
          owner,
          {
            requestID: "resume",
            goalID: blocked.id,
            expectedRevision: blocked.revision,
            status: "active",
            reason: "Operator explicitly retries after reviewing the model requirement",
          },
          "user",
        )
        expect(resumed).toMatchObject({ id: created.id, status: "active", tokensUsed: 17, turnsAccepted: 0 })
        expect(await reconcileContinuousGoal(owner)).toBe("blocked")
        expect(readContinuousGoal(owner)).toMatchObject({
          id: created.id,
          status: "blocked",
          reason: "model_not_configured",
          tokensUsed: 17,
          turnsAccepted: 0,
        })
      },
    })
  })
}

test("concurrent missing-model admissions replay one durable blocker", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const owner = await ownerFor("chat")
      const created = createContinuousGoal(
        owner,
        { requestID: "create", objective: "Review the real model blocker" },
        "user",
      )
      const outcomes = await Promise.allSettled([reconcileContinuousGoal(owner), reconcileContinuousGoal(owner)])
      expect(
        outcomes
          .map((outcome) => {
            if (outcome.status === "fulfilled") return outcome.value
            if (ContinuousGoalError.isInstance(outcome.reason)) return outcome.reason.data.code
            throw outcome.reason
          })
          .sort(),
      ).toEqual(["blocked", "blocked"])
      expect(readContinuousGoal(owner)).toMatchObject({
        id: created.id,
        status: "blocked",
        reason: "model_not_configured",
        turnsAccepted: 0,
      })
      expect(
        Database.use((db) =>
          db.all(sql`SELECT json_extract(payload,'$.author') AS author
      FROM protocol_event WHERE type='continuous_goal.updated'
      AND json_extract(payload,'$.goal_id')=${created.id}`),
        ),
      ).toEqual([{ author: "goal-controller" }])
    },
  })
})

test("a user pause wins over an earlier model admission attempt", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const owner = await ownerFor("chat")
      const created = createContinuousGoal(
        owner,
        { requestID: "create", objective: "Respect the operator decision" },
        "user",
      )
      const pending = reconcileContinuousGoal(owner)
      const paused = updateContinuousGoal(
        owner,
        {
          requestID: "pause",
          goalID: created.id,
          expectedRevision: created.revision,
          status: "paused",
          reason: "Operator paused during model admission",
        },
        "user",
      )
      const outcome = await pending.then(
        (value) => value,
        (error) => {
          if (ContinuousGoalError.isInstance(error)) return error.data.code
          throw error
        },
      )
      expect(outcome).toBe("revision_conflict")
      expect(readContinuousGoal(owner)).toEqual(paused)
      expect(await reconcileContinuousGoal(owner)).toBe("paused")
    },
  })
})

test("a Mission close and reopen retains its Goal pause during model admission", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    const owner = await ownerFor("mission")
    const goal = createContinuousGoal(owner, { requestID: "create", objective: "Respect the original cancellation boundary" }, "user")
    const pending = reconcileContinuousGoal(owner)
    const settled = pending.then(value => ({ value }), error => ({ error }))
    try {
      Database.immediateTransaction(() => {
        ProtocolStore.appendEventInTransaction({
          kind: "event", type: "mission.execution.closed", aggregate: "session", aggregate_id: owner.sessionID,
          source: "mission.abort", correlation_id: randomUUID(),
          payload: { missionID: owner.missionID, requestID: "close", provenance: { kind: "request", surface: "api", reason: "Operator cancelled" } },
        })
        ProtocolStore.appendEventInTransaction({
          kind: "event", type: "mission.execution.opened", aggregate: "session", aggregate_id: owner.sessionID,
          source: "mission.wake", correlation_id: randomUUID(),
          payload: { missionID: owner.missionID, requestID: "reopen", requestFingerprint: "b".repeat(64) },
        })
      })
      expect(await settled).toEqual({ value: "paused" })
      expect(readContinuousGoal(owner)).toMatchObject({ id: goal.id, revision: goal.revision, status: "paused", reason: "mission_closed" })
    } finally {
      await settled
    }
  } })
})
