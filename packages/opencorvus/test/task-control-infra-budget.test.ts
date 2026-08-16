import { afterEach, describe, expect, test } from "bun:test"
import { DispatchOutcome } from "@/agent/dispatch-outcome"
import { exactEngineArtifactLocator } from "@/artifact-catalog"
import { resolveDispatchOccurrenceAuthority } from "@/engine/dispatch-lineage"
import { EngineArtifactTable, EngineTaskRootIngressTable, EngineTaskTable } from "@/engine/engine.sql"
import { recordTaskInfrastructureError } from "@/engine/persist"
import { appendTaskOpenedInTransaction } from "@/engine/task-lifecycle"
import {
  dispatchTaskLoop,
  TASK_EPOCH_INFRASTRUCTURE_INGRESS_BUDGET,
  TestHooks as TaskControlTestHooks,
} from "@/engine/task-root-ingress-delivery"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Database, eq } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

function seedTask(rootSessionID: string) {
  const taskID = Identifier.ascending("task")
  const now = Date.now()
  Database.immediateTransaction((db) => {
    db.insert(EngineTaskTable)
      .values({
        id: taskID,
        project_id: Instance.project.id,
        session_id: rootSessionID,
        source: "test",
        product_pillar: "code",
        title: "Infrastructure retry budget",
        request: "Bound the infrastructure-failure retry loop within one epoch",
        time_created: now,
      })
      .run()
    appendTaskOpenedInTransaction({ db, taskID, sessionID: rootSessionID, now, source: "test.budget" })
  })
  return taskID
}

/** One infrastructure failure as the dispatch pipeline reports it. */
async function reportInfrastructureFailure(taskID: string, dispatchID: string, sessionID: string) {
  const artifactID = recordTaskInfrastructureError({
    taskID,
    component: "dispatch-agent",
    operation: "recover-abandoned-dispatch",
    reason: `Worker for dispatch ${dispatchID} failed`,
    errorName: "AbandonedDispatchError",
    sessionID,
    context: { target: "base-developer", dispatchID },
    now: Date.now(),
  })
  return dispatchTaskLoop({
    taskID,
    event: {
      note: `Worker for dispatch ${dispatchID} failed`,
      dispatchInfrastructureFailure: {
        infrastructureFactID: artifactID,
        outcome: DispatchOutcome.infrastructureFailure({
          operation: "recover-abandoned-dispatch",
          message: `Worker for dispatch ${dispatchID} failed`,
          errorName: "AbandonedDispatchError",
          sessionID,
          recoveryAuthority: resolveDispatchOccurrenceAuthority({ taskID, dispatchID }),
          infrastructureError: exactEngineArtifactLocator({ taskID, artifactID }),
        }),
      },
    },
  })
}

function counts(taskID: string) {
  return Database.use((db) => ({
    ingresses: db
      .select()
      .from(EngineTaskRootIngressTable)
      .where(eq(EngineTaskRootIngressTable.task_id, taskID))
      .all().length,
    budgetSurfaces: db
      .select()
      .from(EngineArtifactTable)
      .where(eq(EngineArtifactTable.task_id, taskID))
      .all()
      .filter(
        (row) =>
          row.kind === "task-infrastructure-error" &&
          (row.payload as { operation?: string }).operation === "infrastructure-failure-budget-exhausted",
      ).length,
  }))
}

describe("infrastructure-failure retry budget", () => {
  test("stops minting retry wakes once the epoch budget is spent", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const root = await Session.create({ kind: "root", title: "Budget root" })
        const taskID = seedTask(root.id)
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })

        const results: string[] = []
        for (let attempt = 0; attempt < TASK_EPOCH_INFRASTRUCTURE_INGRESS_BUDGET + 2; attempt += 1) {
          const worker = await Session.create({
            kind: "delegated-worker",
            parentID: root.id,
            title: `Worker ${attempt}`,
          })
          results.push(await reportInfrastructureFailure(taskID, `dispatch-${attempt}`, worker.id))
        }

        const observed = counts(taskID)
        expect({
          accepted: results.filter((result) => result === "accepted").length,
          suppressed: results.filter((result) => result === "suppressed_budget_exhausted").length,
          ingresses: observed.ingresses,
          // One surface per epoch, however many failures follow.
          budgetSurfaces: observed.budgetSurfaces,
        }).toEqual({
          accepted: TASK_EPOCH_INFRASTRUCTURE_INGRESS_BUDGET,
          suppressed: 2,
          ingresses: TASK_EPOCH_INFRASTRUCTURE_INGRESS_BUDGET,
          budgetSurfaces: 1,
        })
      },
    })
  })

  test("does not spend budget when an already-accepted failure is replayed", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const root = await Session.create({ kind: "root", title: "Replay root" })
        const taskID = seedTask(root.id)
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })

        const worker = await Session.create({ kind: "delegated-worker", parentID: root.id, title: "Replayed worker" })
        const sessionID = worker.id
        const artifactID = recordTaskInfrastructureError({
          id: Identifier.deterministic("artifact", `replayed-failure\0${taskID}`),
          taskID,
          component: "dispatch-agent",
          operation: "recover-abandoned-dispatch",
          reason: "Worker lost its delivery owner",
          errorName: "AbandonedDispatchError",
          sessionID,
          context: { target: "base-developer", dispatchID: "dispatch-replayed" },
          now: Date.now(),
        })
        const event = {
          note: "Worker lost its delivery owner",
          dispatchInfrastructureFailure: {
            infrastructureFactID: artifactID,
            outcome: DispatchOutcome.infrastructureFailure({
              operation: "recover-abandoned-dispatch",
              message: "Worker lost its delivery owner",
              errorName: "AbandonedDispatchError",
              sessionID,
              recoveryAuthority: resolveDispatchOccurrenceAuthority({ taskID, dispatchID: "dispatch-replayed" }),
              infrastructureError: exactEngineArtifactLocator({ taskID, artifactID }),
            }),
          },
        }

        const results: string[] = []
        for (let attempt = 0; attempt < TASK_EPOCH_INFRASTRUCTURE_INGRESS_BUDGET + 2; attempt += 1) {
          results.push(await dispatchTaskLoop({ taskID, event }))
        }

        // The same durable fact is one wake, replayed. Recovery after a crash
        // must not look like fresh failures and burn the budget.
        expect({
          results: [...new Set(results)],
          ingresses: counts(taskID).ingresses,
          budgetSurfaces: counts(taskID).budgetSurfaces,
        }).toEqual({ results: ["accepted"], ingresses: 1, budgetSurfaces: 0 })
      },
    })
  })
})
