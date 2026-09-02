import { afterEach, describe, expect, test } from "bun:test"
import { EngineControlActivationLeaseTable, EngineTaskTable } from "@/engine/engine.sql"
import {
  acquireTaskCompletionClosureInTransaction,
  releaseTaskCompletionClosureInTransaction,
  TaskCompletionClosureConflictError,
} from "@/engine/task-completion-closure"
import { appendTaskOpenedInTransaction } from "@/engine/task-lifecycle"
import { acceptTaskRootIngressInTransaction, projectTaskRootIngress } from "@/engine/task-root-fact-store"
import {
  configureTaskCancellationReconciler,
  reconcileTaskControlPlane,
  readTaskRootIngressEvidence,
  taskControlDriverSnapshot,
  TestHooks as TaskControlTestHooks,
} from "@/engine/task-root-ingress-delivery"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { ProtocolStore } from "@/protocol/store"
import { Session } from "@/session"
import { Database } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { TaskControlDriver } from "@/engine/task-control-driver"
import { restartTaskControlProjectFrontier } from "@/engine/task-root-ingress-disposition"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

/** A Task whose cancellation was requested but never converged — the state a
 * failed cancellation leaves behind. */
function seedCancellingTask(rootSessionID: string) {
  const taskID = Identifier.ascending("task")
  const now = Date.now()
  const ingress = Database.immediateTransaction((db) => {
    db.insert(EngineTaskTable)
      .values({
        id: taskID,
        project_id: Instance.project.id,
        session_id: rootSessionID,
        source: "test",
        product_pillar: "code",
        title: "Stalled cancellation",
        request: "Converge a cancellation without restarting the project",
        time_created: now,
      })
      .run()
    appendTaskOpenedInTransaction({ db, taskID, sessionID: rootSessionID, now, source: "test.cancel" })
    const accepted = acceptTaskRootIngressInTransaction(db, {
      taskID,
      executionEpoch: 1,
      source: "inline",
      sourceID: "cancelling-head",
      inlinePayload: { note: "work in flight when cancellation arrived" },
      semanticTurnLimit: 3,
      activationLimit: 4,
      now: now + 1,
    })
    ProtocolStore.appendEventInTransaction({
      kind: "event",
      type: "task.cancellation.requested",
      aggregate: "task",
      aggregate_id: taskID,
      task_id: null,
      session_id: rootSessionID,
      source: "test.cancel",
      emitted_at: now + 2,
      payload: { execution_epoch: 1 },
    })
    return accepted
  })
  return { taskID, ingressID: ingress.id, rootSessionID }
}

function settleCancellation(taskID: string, rootSessionID: string) {
  Database.immediateTransaction((db) => {
    ProtocolStore.appendEventInTransaction({
      kind: "event",
      type: "task.cancelled",
      aggregate: "task",
      aggregate_id: taskID,
      task_id: null,
      session_id: rootSessionID,
      source: "test.cancel",
      emitted_at: Date.now(),
      payload: { execution_epoch: 1 },
    })
  })
}

describe("cancellation convergence from the control-plane scan", () => {
  test("a cancellation coalesced after pass zero is converged by the fresh revision", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const root = await Session.create({ kind: "root", title: "Late cancellation root" })
        const taskID = Identifier.ascending("task")
        const now = Date.now()
        Database.immediateTransaction((db) => {
          db.insert(EngineTaskTable)
            .values({
              id: taskID,
              project_id: Instance.project.id,
              session_id: root.id,
              source: "test",
              product_pillar: "code",
              title: "Late coalesced cancellation",
              request: "Observe a cancellation appended after pass zero crossed its lifecycle check",
              time_created: now,
            })
            .run()
          appendTaskOpenedInTransaction({ db, taskID, sessionID: root.id, now, source: "test.cancel.coalesced" })
        })
        const seedTaskID = Identifier.ascending("task")
        Database.immediateTransaction((db) => {
          db.insert(EngineTaskTable)
            .values({
              id: seedTaskID,
              project_id: Instance.project.id,
              session_id: root.id,
              source: "test",
              product_pillar: "code",
              title: "Cancellation physical tail seed",
              request: "Establish the prior Project cancellation cursor",
              time_created: now,
            })
            .run()
          appendTaskOpenedInTransaction({
            db,
            taskID: seedTaskID,
            sessionID: root.id,
            now,
            source: "test.cancel.cursor-seed",
          })
          ProtocolStore.appendEventInTransaction({
            kind: "event",
            type: "task.cancellation.requested",
            aggregate: "task",
            aggregate_id: seedTaskID,
            task_id: null,
            session_id: root.id,
            source: "test.cancel.cursor-seed",
            emitted_at: now + 1_000,
            payload: { execution_epoch: 1 },
          })
        })
        let projectFrontier = TaskControlTestHooks.currentProjectFrontierSlice()
        while (projectFrontier.next) {
          projectFrontier = TaskControlTestHooks.currentProjectFrontierSlice(projectFrontier.next)
        }
        const projectCheckpoint = restartTaskControlProjectFrontier(projectFrontier.checkpoint)
        let attempts = 0
        configureTaskCancellationReconciler(async (requestedTaskID) => {
          expect(requestedTaskID).toBe(taskID)
          attempts += 1
          settleCancellation(taskID, root.id)
        })
        const productionDriver = new TaskControlDriver({
          scan: (requestedTaskID, context) =>
            TaskControlTestHooks.scanTaskControlPlane(requestedTaskID, context),
        })
        using _driver = { [Symbol.dispose]: () => productionDriver.dispose() }
        const sourcePasses: number[] = []
        const coalescedRequests: number[] = []
        let lateCancellationProjectDiscovery = false
        let appended = false
        using _interleaving = TaskControlTestHooks.replaceAfterSourceReconciliation(
          async ({ taskID: scannedTaskID, pass }) => {
            if (scannedTaskID !== taskID) return
            sourcePasses.push(pass)
            if (pass !== 0 || appended) return
            appended = true
            Database.immediateTransaction((db) => {
              ProtocolStore.appendEventInTransaction({
                kind: "event",
                type: "task.cancellation.requested",
                aggregate: "task",
                aggregate_id: taskID,
                task_id: null,
                session_id: root.id,
                source: "test.cancel.coalesced",
                emitted_at: now - 1_000,
                payload: { execution_epoch: 1 },
              })
            })
            lateCancellationProjectDiscovery = TaskControlTestHooks.currentProjectFrontierSlice(
              projectCheckpoint,
            ).taskIDs.includes(taskID)
            coalescedRequests.push(await productionDriver.request(taskID))
          },
        )

        await productionDriver.request(taskID, { propagateFailure: true })
        expect({
          attempts,
          coalescedRequests,
          freshPassObserved: sourcePasses.includes(1),
          lateCancellationProjectDiscovery,
        }).toEqual({
          attempts: 1,
          coalescedRequests: [0],
          freshPassObserved: true,
          lateCancellationProjectDiscovery: true,
        })
      },
    })
  })

  test("re-attempts a stalled cancellation and keeps a finite wake until it converges", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const root = await Session.create({ kind: "root", title: "Cancel root" })
        const { taskID, ingressID, rootSessionID } = seedCancellingTask(root.id)
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({
          runner: async () => {
            throw new Error("A cancelling Task must not start an Orchestrator Turn")
          },
        })

        let attempts = 0
        configureTaskCancellationReconciler(async () => {
          attempts += 1
        })

        await reconcileTaskControlPlane(taskID)
        const stalled = {
          attempts,
          projection: projectTaskRootIngress(ingressID, Date.now(), readTaskRootIngressEvidence).state,
          // Before this repair a stalled cancellation armed no timer at all,
          // so only a restart could ever move it.
          armed: taskControlDriverSnapshot().find((entry) => entry.taskID === taskID)?.wakeAt !== undefined,
        }

        // The reconciler's own convergence, on a later attempt.
        settleCancellation(taskID, rootSessionID)
        await reconcileTaskControlPlane(taskID)

        expect({
          stalled,
          converged: projectTaskRootIngress(ingressID, Date.now(), readTaskRootIngressEvidence).state,
        }).toEqual({
          stalled: { attempts: 1, projection: "cancelling", armed: true },
          converged: "terminal_inapplicable",
        })
      },
    })
  })
})

describe("Task completion closure", () => {
  test("frees the closure when the terminal transaction refuses", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const root = await Session.create({ kind: "root", title: "Closure root" })
        const taskID = Identifier.ascending("task")
        const now = Date.now()
        Database.immediateTransaction((db) => {
          db.insert(EngineTaskTable)
            .values({
              id: taskID,
              project_id: Instance.project.id,
              session_id: root.id,
              source: "test",
              product_pillar: "code",
              title: "Closure release",
              request: "Release a completion closure whose terminal transaction refused",
              time_created: now,
            })
            .run()
          appendTaskOpenedInTransaction({ db, taskID, sessionID: root.id, now, source: "test.closure" })
        })

        const acquire = (ownerID: string) =>
          Database.transaction((db) =>
            acquireTaskCompletionClosureInTransaction(db, {
              taskID,
              ownerID,
              orchestratorSessionID: root.id,
              orchestratorMessageID: Identifier.ascending("message"),
              toolCallID: Identifier.ascending("call"),
              toolPartID: Identifier.ascending("part"),
              timeAcquired: Date.now(),
            }),
          )

        acquire("owner-first")
        let conflicted = false
        try {
          acquire("owner-second")
        } catch (error) {
          conflicted = error instanceof TaskCompletionClosureConflictError
        }

        const released = Database.transaction((db) =>
          releaseTaskCompletionClosureInTransaction(db, { taskID, ownerID: "owner-first" }),
        )
        // Without the release the next attempt waits out the full lease while
        // the model retries into that window.
        const reacquired = acquire("owner-second")

        expect({
          conflicted,
          released,
          reacquiredBy: reacquired.owner_id,
          liveLeases: Database.use(
            (db) =>
              db
                .select()
                .from(EngineControlActivationLeaseTable)
                .all()
                .filter((row) => row.target === "lifecycle" && row.expires_at > Date.now()).length,
          ),
        }).toEqual({ conflicted: true, released: true, reacquiredBy: "owner-second", liveLeases: 1 })
      },
    })
  })
})
