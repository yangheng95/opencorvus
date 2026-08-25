import { afterAll, describe, expect, test } from "bun:test"
import { EngineTaskRootIngressTable } from "../src/engine/engine.sql"
import { configureTaskIngressRunner, waitForIngressDeliveryHooksForTest } from "../src/engine/task-root-ingress-delivery"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { acquireControlLease, currentControlLeaseInTransaction, renewControlLease } from "../src/engine/control-lease"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { AutomationDefinitionTombstoneTable, AutomationRunTable, AutomationTable } from "../src/scheduler/automation.sql"
import { AutomationService } from "../src/scheduler/automation-service"
import { taskWaitFireID } from "../src/scheduler/task-wait-fire-identity"
import { Session } from "../src/session"
import { Database, eq } from "../src/storage/db"
import { persistEstablishedTask } from "./fixture/engine-task"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(async () => {
  await waitForIngressDeliveryHooksForTest()
  await resetMemoryDatabase()
})

describe("delayed Task-wait immutable occurrence", () => {
  test("projects exact active Session and Task wake schedules for runtime settlement", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const taskID = Identifier.ascending("task")
        const root = await Session.create({ kind: "root", title: "Task wait schedule" })
        const mission = await Session.create({ kind: "root", title: "Session wait schedule" })
        const now = Date.now()
        const packageRevision = { scope: "built_in" as const, projectID: null, namespace: "builtin", id: "base", version: "2026.08.09.1", packageDigest: "b".repeat(64) }
        persistEstablishedTask({
          taskID, sessionID: root.id, now, title: "Task wait schedule", request: "Resume later", productPillar: "code",
          source: "test", priority: "normal", metadata: { actor: "user" }, projectID: Instance.project.id, packageRevision,
          executionCapsuleBinding: await prepareTaskProcessBinding({ mode: "native", taskID, projectID: Instance.project.id, rootDirectory: Instance.directory, packageRevisionSHA256: packageRevision.packageDigest, timeCreated: now }),
        })
        const taskWake = await AutomationService.createTaskWake({
          name: "task resume",
          projectId: Instance.project.id,
          taskId: taskID,
          durationMs: 60_000,
          reason: "resume exact task",
        })
        const sessionWake = await AutomationService.createDelayedSessionWake({
          name: "session resume",
          projectId: Instance.project.id,
          sessionId: mission.id,
          durationMs: 120_000,
          prompt: "resume exact session",
        })

        expect(
          AutomationService.pendingDelayedWakeSchedule({
            projectID: Instance.project.id,
            sessionIDs: [mission.id],
            taskIDs: [taskID],
            now,
          }),
        ).toEqual([
          {
            id: taskWake.id,
            projectID: Instance.project.id,
            target: { scope: "task", taskID },
            nextRun: taskWake.nextRun,
            leaseUntil: 0,
            state: "scheduled",
            claim: null,
          },
          {
            id: sessionWake.id,
            projectID: Instance.project.id,
            target: { scope: "session", sessionID: mission.id },
            nextRun: sessionWake.nextRun,
            leaseUntil: 0,
            state: "scheduled",
            claim: null,
          },
        ])
        const firstClaimAt = now + 1
        const firstClaim = acquireControlLease({
          target: "automation",
          targetID: taskWake.id,
          ownerOccurrenceID: "automation-attempt-a",
          now: firstClaimAt,
          leaseMilliseconds: 10_000,
        })
        if (!firstClaim.acquired) throw new Error("Expected the first delayed-wake claim")
        expect(
          AutomationService.pendingDelayedWakeSchedule({
            projectID: Instance.project.id,
            sessionIDs: [],
            taskIDs: [taskID],
            now: firstClaimAt,
          }),
        ).toEqual([
          {
            id: taskWake.id,
            projectID: Instance.project.id,
            target: { scope: "task", taskID },
            nextRun: taskWake.nextRun,
            leaseUntil: firstClaim.lease.expires_at,
            state: "leased",
            claim: {
              leaseID: firstClaim.lease.id,
              ownerOccurrenceID: firstClaim.lease.owner_occurrence_id,
              activatedAt: firstClaim.lease.time_activated,
            },
          },
        ])
        const renewedUntil = firstClaim.lease.expires_at + 10_000
        renewControlLease({
          target: "automation",
          targetID: taskWake.id,
          leaseID: firstClaim.lease.id,
          ownerOccurrenceID: firstClaim.lease.owner_occurrence_id,
          now: firstClaimAt + 100,
          expiresAt: renewedUntil,
        })
        expect(
          AutomationService.pendingDelayedWakeSchedule({
            projectID: Instance.project.id,
            sessionIDs: [],
            taskIDs: [taskID],
            now: firstClaimAt + 101,
          }),
        ).toEqual([
          {
            id: taskWake.id,
            projectID: Instance.project.id,
            target: { scope: "task", taskID },
            nextRun: taskWake.nextRun,
            leaseUntil: renewedUntil,
            state: "leased",
            claim: {
              leaseID: firstClaim.lease.id,
              ownerOccurrenceID: firstClaim.lease.owner_occurrence_id,
              activatedAt: firstClaim.lease.time_activated,
            },
          },
        ])
        const replacementClaimAt = renewedUntil + 1
        const replacementClaim = acquireControlLease({
          target: "automation",
          targetID: taskWake.id,
          ownerOccurrenceID: "automation-attempt-b",
          now: replacementClaimAt,
          leaseMilliseconds: 10_000,
        })
        if (!replacementClaim.acquired) throw new Error("Expected the replacement delayed-wake claim")
        expect(
          AutomationService.pendingDelayedWakeSchedule({
            projectID: Instance.project.id,
            sessionIDs: [],
            taskIDs: [taskID],
            now: replacementClaimAt,
          }),
        ).toEqual([
          {
            id: taskWake.id,
            projectID: Instance.project.id,
            target: { scope: "task", taskID },
            nextRun: taskWake.nextRun,
            leaseUntil: replacementClaim.lease.expires_at,
            state: "leased",
            claim: {
              leaseID: replacementClaim.lease.id,
              ownerOccurrenceID: replacementClaim.lease.owner_occurrence_id,
              activatedAt: replacementClaim.lease.time_activated,
            },
          },
        ])
      },
    })
  }, 30_000)

  test("binds accepted ingress to the exact Automation run and definition revision", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        configureTaskIngressRunner(async () => ({}))
        const taskID = Identifier.ascending("task")
        const root = await Session.create({ kind: "root", title: "Task wait facts" })
        const now = Date.now()
        const packageRevision = { scope: "built_in" as const, projectID: null, namespace: "builtin", id: "base", version: "2026.08.09.1", packageDigest: "a".repeat(64) }
        persistEstablishedTask({
          taskID, sessionID: root.id, now, title: "Task wait facts", request: "Resume once", productPillar: "code",
          source: "test", priority: "normal", metadata: { actor: "user" }, projectID: Instance.project.id, packageRevision,
          executionCapsuleBinding: await prepareTaskProcessBinding({ mode: "native", taskID, projectID: Instance.project.id, rootDirectory: Instance.directory, packageRevisionSHA256: packageRevision.packageDigest, timeCreated: now }),
        })
        const scheduled = await AutomationService.createTaskWake({ name: "resume", projectId: Instance.project.id, taskId: taskID, durationMs: 1, reason: "resume exact task" })
        await new Promise((resolve) => setTimeout(resolve, 5))
        await AutomationService.runDueNow()
        await waitForIngressDeliveryHooksForTest()
        const definition = Database.use((db) => db.select().from(AutomationTable).where(eq(AutomationTable.definition_id, scheduled.id)).orderBy(AutomationTable.revision).all())
        expect(definition.map((row) => row.revision)).toEqual([1])
        expect(Database.use((db) => db.select().from(AutomationDefinitionTombstoneTable).where(eq(AutomationDefinitionTombstoneTable.definition_id, scheduled.id)).get()))
          .toMatchObject({ definition_id: scheduled.id, revision: 2 })
        const run = Database.use((db) => db.select().from(AutomationRunTable).where(eq(AutomationRunTable.automation_revision_id, definition[0]!.id)).get())
        expect(run?.fire_id).toBe(taskWaitFireID(scheduled.id))
        const ingress = Database.use((db) => db.select().from(EngineTaskRootIngressTable).where(eq(EngineTaskRootIngressTable.source_id, run!.id)).get())
        expect(ingress).toMatchObject({ task_id: taskID, source: "automation_run", inline_payload: null })
        // The one-shot terminal transaction writes the succeeded receipt, the
        // tombstone and the end of the fire's lease as one fact.
        const settledLease = Database.use((db) => currentControlLeaseInTransaction(db, "automation", scheduled.id))!
        expect(settledLease.expires_at).toBeLessThanOrEqual(Date.now())
        expect(
          AutomationService.pendingDelayedWakeSchedule({
            projectID: Instance.project.id,
            sessionIDs: [],
            taskIDs: [taskID],
          }),
        ).toEqual([])
      },
    })
  }, 30_000)
})
