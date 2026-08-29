import { afterEach, describe, expect, test } from "bun:test"
import {
  ControlLeaseFenceLostError,
  currentControlLeaseInTransaction,
  releaseControlLease,
} from "@/engine/control-lease"
import { EngineTaskTable } from "@/engine/engine.sql"
import { isProcessOccurrenceLive, joinProcessLivenessLease, PROCESS_LIVENESS_LEASE_MS } from "@/engine/process-liveness"
import { reconcileTaskControlPlane, TestHooks as TaskControlTestHooks } from "@/engine/task-root-ingress-delivery"
import {
  acceptTaskRootIngressInTransaction,
  acquireTaskRootIngressLease,
  projectTaskRootIngress,
} from "@/engine/task-root-fact-store"
import { appendTaskOpenedInTransaction } from "@/engine/task-lifecycle"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { currentRuntimeOccurrenceID } from "@/runtime/process-occurrence"
import { Session } from "@/session"
import { Database } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("runtime process liveness owner", () => {
  test("keeps one exact process receipt through the first Project disposal and expires it on the last", async () => {
    await using first = await memoryProject()
    await using second = await memoryProject()
    const occurrenceID = currentRuntimeOccurrenceID()

    await Instance.provide({ directory: first.path, fn: () => reconcileTaskControlPlane() })
    const firstLease = Database.use((db) => currentControlLeaseInTransaction(db, "runtime_process", occurrenceID))!

    await Instance.provide({ directory: second.path, fn: () => reconcileTaskControlPlane() })
    const joinedLease = Database.use((db) => currentControlLeaseInTransaction(db, "runtime_process", occurrenceID))!
    expect({
      firstLeaseID: firstLease.id,
      joinedLeaseID: joinedLease.id,
      joinedLive: Database.use((db) => isProcessOccurrenceLive(db, occurrenceID, Date.now())),
    }).toEqual({ firstLeaseID: firstLease.id, joinedLeaseID: firstLease.id, joinedLive: true })

    await Instance.provide({ directory: first.path, fn: () => Instance.dispose() })
    const afterFirstDisposal = Database.use((db) =>
      currentControlLeaseInTransaction(db, "runtime_process", occurrenceID),
    )!
    expect({
      leaseID: afterFirstDisposal.id,
      live: Database.use((db) => isProcessOccurrenceLive(db, occurrenceID, Date.now())),
    }).toEqual({ leaseID: firstLease.id, live: true })

    await Instance.provide({ directory: second.path, fn: () => Instance.dispose() })
    const afterLastDisposal = Database.use((db) =>
      currentControlLeaseInTransaction(db, "runtime_process", occurrenceID),
    )!
    expect({
      leaseID: afterLastDisposal.id,
      live: Database.use((db) => isProcessOccurrenceLive(db, occurrenceID, Date.now())),
    }).toEqual({ leaseID: firstLease.id, live: false })

    await Instance.provide({ directory: first.path, fn: () => reconcileTaskControlPlane() })
    const reopenedLease = Database.use((db) => currentControlLeaseInTransaction(db, "runtime_process", occurrenceID))!
    expect({
      ownerOccurrenceID: reopenedLease.owner_occurrence_id,
      live: Database.use((db) => isProcessOccurrenceLive(db, occurrenceID, Date.now())),
    }).toEqual({ ownerOccurrenceID: occurrenceID, live: true })
    await Instance.provide({ directory: first.path, fn: () => Instance.dispose() })
  })

  test("turns exact process fence loss into an absorbing Task-control refusal", async () => {
    using _runtime = TaskControlTestHooks.replaceTerminalIngressDeliveryRuntime(
      "runtime:test-process-liveness-fence-loss",
    )
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const occurrenceID = currentRuntimeOccurrenceID()
        await reconcileTaskControlPlane()
        const lease = Database.use((db) => currentControlLeaseInTransaction(db, "runtime_process", occurrenceID))!
        expect(
          releaseControlLease({
            target: "runtime_process",
            targetID: occurrenceID,
            leaseID: lease.id,
            ownerOccurrenceID: occurrenceID,
            now: Date.now(),
          }),
        ).toBe(true)

        let refusal: unknown
        try {
          await reconcileTaskControlPlane()
        } catch (error) {
          refusal = error
        }
        expect(refusal).toMatchObject({ name: ControlLeaseFenceLostError.name })
      },
    })
    await Instance.provide({ directory: project.path, fn: () => Instance.dispose() })

    let reopenedRefusal: unknown
    try {
      await Instance.provide({ directory: project.path, fn: () => reconcileTaskControlPlane() })
    } catch (error) {
      reopenedRefusal = error
    }
    expect(reopenedRefusal).toMatchObject({ name: ControlLeaseFenceLostError.name })
  })

  test("asserts the current process fence inside every transaction that admits a Task-root activation", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        for (const scenario of ["settled", "expired"] as const) {
          const root = await Session.create({ kind: "root", title: `Atomic liveness admission ${scenario}` })
          const taskID = Identifier.ascending("task")
          const projectionNow = scenario === "expired" ? Date.now() - PROCESS_LIVENESS_LEASE_MS - 1 : Date.now()
          const ingress = Database.immediateTransaction((db) => {
            db.insert(EngineTaskTable)
              .values({
                id: taskID,
                project_id: Instance.project.id,
                session_id: root.id,
                source: "test",
                product_pillar: "work",
                title: `Atomic liveness admission ${scenario}`,
                request: "Fence activation admission to the current process owner",
                time_created: projectionNow,
              })
              .run()
            appendTaskOpenedInTransaction({
              db,
              taskID,
              sessionID: root.id,
              now: projectionNow,
              source: "test.process-liveness-owner",
            })
            return acceptTaskRootIngressInTransaction(db, {
              taskID,
              executionEpoch: 1,
              source: "inline",
              sourceID: `atomic-process-fence-${scenario}`,
              inlinePayload: { note: "activate only under the current process fence" },
              semanticTurnLimit: 3,
              activationLimit: 4,
              now: projectionNow + 1,
            })
          })
          const occurrenceID = `runtime:test-atomic-process-liveness-admission-${scenario}`
          const liveness = joinProcessLivenessLease(occurrenceID, projectionNow)
          try {
            if (scenario === "settled") {
              expect(
                releaseControlLease({
                  target: "runtime_process",
                  targetID: occurrenceID,
                  leaseID: liveness.leaseID,
                  ownerOccurrenceID: occurrenceID,
                  now: Date.now(),
                }),
              ).toBe(true)
            }
            let refusal: unknown
            try {
              acquireTaskRootIngressLease({
                ingressID: ingress.id,
                ownerOccurrenceID: occurrenceID,
                now: projectionNow,
                leaseMilliseconds: 60_000,
                assertControlOwnerInTransaction: (db) =>
                  liveness.assertOwnedInTransaction(db, occurrenceID, Date.now()),
              })
            } catch (error) {
              refusal = error
            }
            expect({
              scenario,
              refusal: refusal instanceof Error ? refusal.name : undefined,
              ingress: projectTaskRootIngress(ingress.id, Date.now()).state,
            }).toEqual({ scenario, refusal: ControlLeaseFenceLostError.name, ingress: "ready" })
          } finally {
            liveness.release()
          }
        }
      },
    })
  })
})
