import { afterEach, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
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
import { reconcileContinuousGoal } from "@/continuous-goal/controller"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)

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
