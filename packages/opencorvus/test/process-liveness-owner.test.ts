import { afterEach, describe, expect, test } from "bun:test"
import { currentControlLeaseInTransaction } from "@/engine/control-lease"
import { EngineTaskTable, EngineControlActivationLeaseTable } from "@/engine/engine.sql"
import {
  observeProcessLiveness,
  joinProcessLiveness,
  ProcessLivenessOwnerUnavailableError,
} from "@/engine/process-liveness"
import { reconcileTaskControlPlane } from "@/engine/task-root-ingress-delivery"
import { acceptTaskRootIngressInTransaction, acquireTaskRootIngressLease } from "@/engine/task-root-fact-store"
import { appendTaskOpenedInTransaction } from "@/engine/task-lifecycle"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import {
  currentRuntimeOccurrenceID,
  currentRuntimeProcessOccurrence,
  ProcessInstanceIDTestHooks,
} from "@/runtime/process-occurrence"
import { Session } from "@/session"
import { Database, eq } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("runtime physical process identity", () => {
  test("preserves exact identity across two Project lifetimes and reopen", async () => {
    await using first = await memoryProject()
    await using second = await memoryProject()
    const occurrenceID = currentRuntimeOccurrenceID()
    await Instance.provide({ directory: first.path, fn: () => reconcileTaskControlPlane() })
    const receipt = Database.use((db) => currentControlLeaseInTransaction(db, "runtime_process", occurrenceID))!
    await Instance.provide({ directory: second.path, fn: () => reconcileTaskControlPlane() })
    await Instance.provide({ directory: first.path, fn: () => Instance.dispose() })
    expect(observeProcessLiveness(occurrenceID)).toBe("exact_live")
    await Instance.provide({ directory: second.path, fn: () => Instance.dispose() })
    expect(observeProcessLiveness(occurrenceID)).toBe("exact_live")
    await Instance.provide({ directory: first.path, fn: () => reconcileTaskControlPlane() })
    const reopened = Database.use((db) => currentControlLeaseInTransaction(db, "runtime_process", occurrenceID))!
    expect({ receipt: reopened.id, identity: JSON.parse(reopened.owner_occurrence_id) }).toEqual({
      receipt: receipt.id,
      identity: { ...currentRuntimeProcessOccurrence(), occurrenceID },
    })
  })

  test("admits real Task activation after time advances across the former process deadline", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const now = Date.now()
        const root = await Session.create({ kind: "root", title: "Sleep-safe activation" })
        const taskID = Identifier.ascending("task")
        const ingress = Database.immediateTransaction((db) => {
          db.insert(EngineTaskTable)
            .values({
              id: taskID,
              project_id: Instance.project.id,
              session_id: root.id,
              source: "test",
              product_pillar: "work",
              title: "Sleep-safe activation",
              request: "Activate after a long clock jump",
              time_created: now,
            })
            .run()
          appendTaskOpenedInTransaction({ db, taskID, sessionID: root.id, now, source: "test.process-liveness" })
          return acceptTaskRootIngressInTransaction(db, {
            taskID,
            executionEpoch: 1,
            source: "inline",
            sourceID: "sleep-safe-activation",
            inlinePayload: { note: "continue" },
            semanticTurnLimit: 3,
            activationLimit: 4,
            now,
          })
        })
        const occurrenceID = currentRuntimeOccurrenceID()
        const liveness = joinProcessLiveness(occurrenceID, now)
        try {
          // Change the old storage deadline as well as advancing the admission
          // clock: physical observation and admission must use identity.
          Database.use((db) =>
            db
              .update(EngineControlActivationLeaseTable)
              .set({ expires_at: now - 1 })
              .where(eq(EngineControlActivationLeaseTable.id, liveness.receiptID))
              .run(),
          )
          const admission = acquireTaskRootIngressLease({
            ingressID: ingress.id,
            ownerOccurrenceID: occurrenceID,
            now: now + 8 * 60 * 60 * 1000,
            leaseMilliseconds: 60_000,
            assertControlOwnerInTransaction: (db) => liveness.assertOwnedInTransaction(db, occurrenceID),
          })
          expect({ acquired: admission.acquired, process: observeProcessLiveness(occurrenceID) }).toEqual({
            acquired: true,
            process: "exact_live",
          })
        } finally {
          liveness.release()
        }
        expect(() => liveness.assertOwned()).toThrow(ProcessLivenessOwnerUnavailableError)
      },
    })
  })

  test("observes a real child through long-expired timestamps and then its physical exit", async () => {
    const child = Bun.spawn([process.execPath, "-e", "setInterval(() => {}, 1000)"], {
      stdout: "ignore",
      stderr: "pipe",
    })
    try {
      const occurrenceID = "test-live-child"
      const now = Date.now()
      Database.use((db) =>
        db
          .insert(EngineControlActivationLeaseTable)
          .values({
            id: Identifier.ascending("activity"),
            target: "runtime_process",
            target_id: occurrenceID,
            owner_occurrence_id: JSON.stringify({
              pid: child.pid,
              processInstanceID: ProcessInstanceIDTestHooks.require(child.pid),
              occurrenceID,
            }),
            time_activated: now - 100_000,
            expires_at: now - 1,
          })
          .run(),
      )
      expect(observeProcessLiveness(occurrenceID)).toBe("exact_live")
      child.kill()
      await child.exited
      expect(observeProcessLiveness(occurrenceID)).toBe("dead_or_reused")
    } finally {
      if (child.exitCode === null) {
        child.kill()
        await child.exited
      }
    }
  })

  test("reports missing physical evidence explicitly and preserves an uncertain OS observation", () => {
    const occurrenceID = currentRuntimeOccurrenceID()
    const liveness = joinProcessLiveness(occurrenceID)
    try {
      expect(observeProcessLiveness(occurrenceID, () => "unknown_live")).toBe("unknown_live")
      Database.use((db) => db.insert(EngineControlActivationLeaseTable).values({
        id: Identifier.ascending("activity"), target: "runtime_process", target_id: "opaque-pre-upgrade-owner",
        owner_occurrence_id: "opaque-pre-upgrade-owner", time_activated: 1, expires_at: 2,
      }).run())
      expect(() => observeProcessLiveness("opaque-pre-upgrade-owner")).toThrow(ProcessLivenessOwnerUnavailableError)
      expect(() => observeProcessLiveness("missing-owner")).toThrow(ProcessLivenessOwnerUnavailableError)
      expect(() => liveness.assertOwned("different-occurrence")).toThrow(ProcessLivenessOwnerUnavailableError)
    } finally {
      liveness.release()
    }
  })
})
